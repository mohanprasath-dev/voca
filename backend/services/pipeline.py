from __future__ import annotations

from datetime import datetime, UTC
from collections.abc import AsyncIterator
from typing import Any

from models.persona import Persona
from models.session import Message, Session
from services.deepgram import DeepgramService
from services.gemini import GeminiService
from services.murf import MurfService


class PipelineService:
    """Coordinates speech-to-text, LLM reasoning, and text-to-speech."""

    def __init__(
        self,
        murf_service: MurfService | None = None,
        deepgram_service: DeepgramService | None = None,
        gemini_service: GeminiService | None = None,
    ) -> None:
        self._murf = murf_service or MurfService()
        self._deepgram = deepgram_service or DeepgramService()
        self._gemini = gemini_service or GeminiService()

    async def handle_text_turn(
        self,
        session: Session,
        persona: Persona,
        user_text: str,
        language_hint: str | None = None,
    ) -> dict[str, Any]:
        user_message = Message(
            role="user",
            content=user_text,
            timestamp=datetime.now(UTC),
            language_detected=language_hint,
        )
        session.messages.append(user_message)

        gemini_output = await self._gemini.generate_reply(
            persona=persona,
            messages=session.messages,
        )

        assistant_message = Message(
            role="assistant",
            content=gemini_output["assistant_reply"],
            timestamp=datetime.now(UTC),
            language_detected=gemini_output.get("language"),
        )
        session.messages.append(assistant_message)

        voice_config = persona.voice_config.model_dump()
        voice_config["language"] = (
            gemini_output.get("language")
            or language_hint
            or voice_config.get("language", "en-IN")
        )

        audio_stream: AsyncIterator[bytes] = self._murf.stream(
            text=assistant_message.content,
            voice_config=voice_config,
        )

        return {
            "assistant_text": assistant_message.content,
            "assistant_language": gemini_output.get("language"),
            "escalation_needed": gemini_output.get("escalation_needed", False),
            "escalation_summary": gemini_output.get("escalation_summary", ""),
            "audio_stream": audio_stream,
        }
