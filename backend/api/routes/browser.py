from __future__ import annotations

import json
import logging
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.persona import Persona
from services.deepgram import DeepgramService
from services.persona import get_persona_service
from services.pipeline import PipelineService
from services.session import get_session_service

logger = logging.getLogger("voca")
router = APIRouter()


def _load_persona(persona_id: str) -> Persona | None:
    svc = get_persona_service()
    return svc.get_by_id(persona_id)


async def _send_persona_loaded(websocket: WebSocket, persona_id: str) -> Persona | None:
    persona = _load_persona(persona_id)
    if not persona:
        await websocket.send_json({"type": "error", "message": f"Persona '{persona_id}' not found"})
        return None

    await websocket.send_json(
        {
            "type": "persona_loaded",
            "persona_id": persona.id,
            "display_name": persona.display_name,
            "ui_config": persona.ui_config.model_dump(),
        }
    )
    return persona


@router.websocket("/{persona_id}")
async def browser_ws(websocket: WebSocket, persona_id: str) -> None:
    await websocket.accept()

    persona = await _send_persona_loaded(websocket, persona_id)
    if not persona:
        await websocket.close(1008)
        return

    # Services
    session_svc = get_session_service()
    pipeline = PipelineService()
    deepgram_svc = DeepgramService()

    # Session state
    session = session_svc.create_session(persona.id)
    current_language: str | None = None

    audio_buffer: list[bytes] = []

    async def safe_send_json(payload: dict[str, object]) -> bool:
        try:
            await websocket.send_json(payload)
            return True
        except Exception:
            return False

    async def safe_send_bytes(chunk: bytes) -> bool:
        try:
            await websocket.send_bytes(chunk)
            return True
        except Exception:
            return False

    async def process_full_utterance() -> None:
        nonlocal current_language, audio_buffer
        if not audio_buffer:
            return

        # Send a tiny priming PCM chunk immediately so playback can start while
        # STT/LLM/TTS processing continues.
        if not await safe_send_bytes(b"\x00" * 4096):
            return

        audio_bytes = b"".join(audio_buffer)
        audio_buffer = []

        try:
            transcript_text, detected_language = await deepgram_svc.transcribe_bytes(audio_bytes)
        except Exception as exc:
            logger.error("Deepgram transcription error: %s", exc)
            await websocket.send_json({"type": "error", "message": "Speech recognition failed. Please try again."})
            return

        transcript_text = str(transcript_text).strip()
        detected_language = str(detected_language or current_language or "en")

        if current_language and detected_language != current_language:
            if not await safe_send_json({
                "type": "language_changed",
                "from": current_language,
                "to": detected_language,
            }):
                return
        current_language = detected_language

        if not transcript_text:
            transcript_text = "I could not hear clear speech."

        if not await safe_send_json({
            "type": "transcript",
            "text": transcript_text,
            "language": detected_language,
        }):
            return

        model_user_text = transcript_text
        if transcript_text == "I could not hear clear speech.":
            model_user_text = "The user audio was silent or unclear. Ask them politely to repeat."

        turn_start = time.monotonic()
        try:
            result = await pipeline.handle_text_turn(
                session=session,
                persona=persona,
                user_text=model_user_text,
                language_hint=current_language,
            )

            assistant_text = result["assistant_text"]
            assistant_lang = result.get("assistant_language", current_language or "en")

            # Send response text
            if not await safe_send_json({
                "type": "response",
                "text": assistant_text,
                "language": assistant_lang,
            }):
                return

            # Handle escalation
            if result.get("escalation_needed"):
                if not await safe_send_json({
                    "type": "escalation",
                    "message": result.get("escalation_summary", "Escalation triggered."),
                }):
                    return

            # Stream TTS audio chunks
            audio_stream = result.get("audio_stream")
            if audio_stream:
                async for chunk in audio_stream:
                    if not await safe_send_bytes(chunk):
                        return

            turn_end = time.monotonic()
            latency_ms = int((turn_end - turn_start) * 1000)
            logger.info(
                "Turn latency: %dms | Session: %s | Text: %.40s...",
                latency_ms,
                session.session_id,
                transcript_text,
            )
        except Exception as exc:
            logger.error("Pipeline error: %s", exc)
            await safe_send_json({"type": "error", "message": "Something went wrong, please try again."})

    try:
        while True:
            try:
                message = await websocket.receive()
            except RuntimeError as exc:
                if "disconnect message" in str(exc):
                    break
                raise

            # Binary = raw audio from mic
            if "bytes" in message and message["bytes"]:
                raw_audio = message["bytes"]
                audio_buffer.append(raw_audio)
                continue

            text_data = message.get("text")
            if not text_data:
                continue

            try:
                payload = json.loads(text_data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid message payload"})
                continue

            message_type = payload.get("type")

            if message_type == "ping":
                await safe_send_json({"type": "pong", "ts": payload.get("ts")})

            elif message_type == "end_of_speech":
                await process_full_utterance()

            elif message_type == "switch_persona":
                next_persona_id = str(payload.get("persona_id", "")).strip()
                if not next_persona_id:
                    await websocket.send_json({"type": "error", "message": "Missing persona_id"})
                    continue

                new_persona = await _send_persona_loaded(websocket, next_persona_id)
                if new_persona:
                    persona = new_persona
                    # Create a new session for the new persona
                    session = session_svc.create_session(persona.id)
                    current_language = None
                    audio_buffer = []

            elif message_type == "end_session":
                summary_data = await session_svc.end_session(session.session_id)
                await websocket.send_json({
                    "type": "session_summary",
                    **summary_data,
                })

    except WebSocketDisconnect:
        logger.info("Browser WS disconnected: session %s", session.session_id)
    except Exception as exc:
        logger.error("Browser WS error: %s", exc)
