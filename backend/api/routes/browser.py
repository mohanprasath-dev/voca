from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import UTC, datetime
from typing import Any

import aiohttp
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from models.persona import Persona
from models.session import Message
from services.deepgram import DeepgramService
from services.gemini import GeminiService
from services.murf import MurfService
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

    # Deepgram streaming connection
    dg_ws: aiohttp.ClientWebSocketResponse | None = None
    aio_session: aiohttp.ClientSession | None = None
    audio_buffer: list[bytes] = []
    final_transcript_parts: list[str] = []

    async def open_deepgram() -> None:
        nonlocal dg_ws, aio_session
        if dg_ws is not None:
            return
        url = deepgram_svc.build_ws_url(language=current_language)
        headers = deepgram_svc.build_headers()
        aio_session = aiohttp.ClientSession()
        dg_ws = await aio_session.ws_connect(url, headers=headers)
        logger.info("Deepgram stream opened for session %s", session.session_id)

    async def close_deepgram() -> None:
        nonlocal dg_ws, aio_session
        if dg_ws:
            try:
                await dg_ws.close()
            except Exception:
                pass
            dg_ws = None
        if aio_session:
            try:
                await aio_session.close()
            except Exception:
                pass
            aio_session = None

    async def read_deepgram_results() -> None:
        nonlocal current_language
        if dg_ws is None:
            return
        try:
            async for msg in dg_ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    result = deepgram_svc.parse_transcript_event(msg.data)
                    if result is None:
                        continue

                    transcript = result["transcript"]
                    is_final = result["is_final"]
                    detected_lang = result.get("language") or "en"

                    # Detect language change
                    if detected_lang and detected_lang != current_language and current_language is not None:
                        await websocket.send_json({
                            "type": "language_changed",
                            "from": current_language,
                            "to": detected_lang,
                        })
                    current_language = detected_lang

                    # Send interim/final transcript to frontend
                    await websocket.send_json({
                        "type": "transcript",
                        "text": transcript,
                        "language": detected_lang,
                    })

                    if is_final:
                        final_transcript_parts.append(transcript)
                elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                    break
        except Exception as exc:
            logger.error("Deepgram read error: %s", exc)

    async def process_full_utterance() -> None:
        nonlocal final_transcript_parts
        if not final_transcript_parts:
            return

        full_text = " ".join(final_transcript_parts)
        final_transcript_parts = []

        if not full_text.strip():
            return

        turn_start = time.monotonic()
        try:
            result = await pipeline.handle_text_turn(
                session=session,
                persona=persona,
                user_text=full_text,
                language_hint=current_language,
            )

            assistant_text = result["assistant_text"]
            assistant_lang = result.get("assistant_language", current_language or "en")

            # Send response text
            await websocket.send_json({
                "type": "response",
                "text": assistant_text,
                "language": assistant_lang,
            })

            # Handle escalation
            if result.get("escalation_needed"):
                await websocket.send_json({
                    "type": "escalation",
                    "message": result.get("escalation_summary", "Escalation triggered."),
                })

            # Stream TTS audio chunks
            audio_stream = result.get("audio_stream")
            if audio_stream:
                async for chunk in audio_stream:
                    await websocket.send_bytes(chunk)

            turn_end = time.monotonic()
            latency_ms = int((turn_end - turn_start) * 1000)
            logger.info(
                "Turn latency: %dms | Session: %s | Text: %.40s...",
                latency_ms,
                session.session_id,
                full_text,
            )
        except Exception as exc:
            logger.error("Pipeline error: %s", exc)
            await websocket.send_json({"type": "error", "message": "Something went wrong, please try again."})

    # Deepgram reader task
    dg_reader_task: asyncio.Task[None] | None = None

    try:
        while True:
            message = await websocket.receive()

            # Binary = raw audio from mic
            if "bytes" in message and message["bytes"]:
                raw_audio = message["bytes"]
                if dg_ws is None:
                    await open_deepgram()
                    dg_reader_task = asyncio.create_task(read_deepgram_results())
                if dg_ws and not dg_ws.closed:
                    await dg_ws.send_bytes(raw_audio)
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

            if message_type == "end_of_speech":
                # Close Deepgram to flush final results
                if dg_ws and not dg_ws.closed:
                    try:
                        await dg_ws.send_str(json.dumps({"type": "CloseStream"}))
                    except Exception:
                        pass

                # Wait for reader task to finish
                if dg_reader_task:
                    try:
                        await asyncio.wait_for(dg_reader_task, timeout=5.0)
                    except asyncio.TimeoutError:
                        dg_reader_task.cancel()
                    dg_reader_task = None

                await close_deepgram()

                # Process the utterance
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
                    final_transcript_parts = []

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
    finally:
        if dg_reader_task:
            dg_reader_task.cancel()
        await close_deepgram()
