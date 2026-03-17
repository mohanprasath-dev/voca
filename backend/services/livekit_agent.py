from __future__ import annotations

import json
import logging
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, JobProcess, cli, llm, tokenize, room_io
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, NOT_GIVEN
from livekit.plugins import deepgram, murf, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from models.session import Message
from services.gemini import GeminiService
from services.persona import get_persona_service
from services.session import get_session_service

logger = logging.getLogger("voca.livekit")

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.local", override=True)

LANGUAGE_TAG_RE = re.compile(r"^\s*\[LANG:(?P<language>[^\]]+)\]\s*", re.IGNORECASE)
MURF_STYLE_MAP = {
    "conversational": "Conversation",
    "conversation": "Conversation",
    "promotional": "Promo",
    "promo": "Promo",
}


def _parse_room_name(room_name: str) -> tuple[str, str]:
    if not room_name.startswith("voca-"):
        raise ValueError(f"Unexpected room name: {room_name}")

    persona_part = room_name.removeprefix("voca-")
    persona_id, session_id = persona_part.rsplit("-", 1)
    return persona_id, session_id


def _extract_language_tag(text: str) -> str | None:
    match = LANGUAGE_TAG_RE.match(text)
    if not match:
        return None
    return match.group("language").strip()


def _strip_language_tag(text: str) -> str:
    return LANGUAGE_TAG_RE.sub("", text, count=1).strip()


def _normalize_locale(language: str | None, default_locale: str) -> str:
    if not language:
        return default_locale

    normalized = str(language).strip().replace("_", "-")
    if not normalized:
        return default_locale

    if "-" not in normalized:
        if normalized.lower() == "en":
            return default_locale
        return f"{normalized.lower()}-IN"

    parts = normalized.split("-", 1)
    return f"{parts[0].lower()}-{parts[1].upper()}"


def _resolve_voice_id(voice_config: dict[str, Any], locale: str) -> str:
    language_voice_map = voice_config.get("language_voice_map")
    if isinstance(language_voice_map, dict):
        mapped_voice = language_voice_map.get(locale)
        if mapped_voice:
            return str(mapped_voice)
    return str(voice_config.get("murf_voice_id", "en-US-matthew"))


def _resolve_style(style_name: str | None) -> str:
    if not style_name:
        return "Conversation"
    normalized = str(style_name).strip().lower()
    return MURF_STYLE_MAP.get(normalized, style_name)


async def _publish_event(room: rtc.Room, payload: dict[str, object]) -> None:
    await room.local_participant.publish_data(json.dumps(payload), reliable=True, topic="voca")


class GeminiLiveKitLLM(llm.LLM):
    def __init__(
        self,
        *,
        gemini_service: GeminiService,
        persona_id: str,
        session_id: str,
        room: rtc.Room,
        tts_engine: murf.TTS,
        agent: "VocaLiveKitAgent",
    ) -> None:
        super().__init__()
        self._gemini_service = gemini_service
        self._persona_id = persona_id
        self._session_id = session_id
        self._room = room
        self._tts_engine = tts_engine
        self._agent = agent

    @property
    def model(self) -> str:
        return "gemini-2.5-flash"

    @property
    def provider(self) -> str:
        return "Gemini"

    def chat(
        self,
        *,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool] | None = None,
        conn_options=DEFAULT_API_CONNECT_OPTIONS,
        parallel_tool_calls=NOT_GIVEN,
        tool_choice=NOT_GIVEN,
        extra_kwargs=NOT_GIVEN,
    ) -> llm.LLMStream:
        return GeminiLiveKitLLMStream(
            self,
            chat_ctx=chat_ctx,
            tools=tools or [],
            conn_options=conn_options,
        )


class GeminiLiveKitLLMStream(llm.LLMStream):
    async def _run(self) -> None:
        persona = get_persona_service().get_by_id(self._llm._persona_id)
        if persona is None:
            raise ValueError(f"Persona '{self._llm._persona_id}' not found")

        session_service = get_session_service()
        session = session_service.get_session(self._llm._session_id)
        if session is None:
            raise ValueError(f"Session '{self._llm._session_id}' not found")

        history: list[Message] = []
        for item in self._chat_ctx.items:
            if not isinstance(item, llm.ChatMessage):
                continue
            if item.role not in {"user", "assistant"}:
                continue

            text_content = item.text_content
            if not text_content:
                continue

            role = "assistant" if item.role == "assistant" else "user"
            history.append(
                Message(
                    role=role,
                    content=text_content.strip(),
                    timestamp=datetime.now(UTC),
                    language_detected=self._llm._agent.current_language,
                )
            )

        result = await self._llm._gemini_service.generate_livekit_reply(persona=persona, messages=history)
        raw_reply = str(result["assistant_reply"]).strip()
        detected_language = _extract_language_tag(raw_reply) or str(result.get("language") or persona.voice_config.language)
        cleaned_reply = _strip_language_tag(raw_reply)

        previous_language = self._llm._agent.current_language
        self._llm._agent.current_language = detected_language

        voice_config = persona.voice_config.model_dump()
        locale = _normalize_locale(detected_language, str(voice_config.get("language", "en-IN")))
        self._llm._tts_engine.update_options(
            locale=locale,
            voice=_resolve_voice_id(voice_config, locale),
            style=_resolve_style(voice_config.get("murf_style")),
        )

        session_service.add_message(
            session.session_id,
            Message(
                role="assistant",
                content=cleaned_reply,
                timestamp=datetime.now(UTC),
                language_detected=detected_language,
            ),
        )

        if previous_language and previous_language != detected_language:
            await _publish_event(
                self._llm._room,
                {
                    "type": "language_changed",
                    "from": previous_language,
                    "to": detected_language,
                },
            )

        await _publish_event(
            self._llm._room,
            {
                "type": "response",
                "text": cleaned_reply,
                "language": detected_language,
            },
        )

        self._event_ch.send_nowait(
            llm.ChatChunk(
                id=f"reply-{session.session_id}",
                delta=llm.ChoiceDelta(role="assistant", content=cleaned_reply),
            )
        )


class VocaLiveKitAgent(Agent):
    def __init__(self, *, persona_id: str, session_id: str, room: rtc.Room) -> None:
        persona = get_persona_service().get_by_id(persona_id)
        if persona is None:
            raise ValueError(f"Persona '{persona_id}' not found")

        voice_config = persona.voice_config.model_dump()
        default_locale = str(voice_config.get("language", "en-IN"))
        default_voice = _resolve_voice_id(voice_config, default_locale)
        tts_engine = murf.TTS(
            model="FALCON",
            locale=default_locale,
            voice=default_voice,
            style=_resolve_style(voice_config.get("murf_style")),
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            text_pacing=True,
        )

        self._room = room
        self._session_id = session_id
        self.current_language = default_locale

        super().__init__(
            instructions=persona.system_prompt,
            llm=GeminiLiveKitLLM(
                gemini_service=GeminiService(),
                persona_id=persona_id,
                session_id=session_id,
                room=room,
                tts_engine=tts_engine,
                agent=self,
            ),
            tts=tts_engine,
        )

    async def on_user_turn_completed(
        self,
        turn_ctx: llm.ChatContext,
        new_message: llm.ChatMessage,
    ) -> None:
        text_content = new_message.text_content
        if not text_content:
            return

        get_session_service().add_message(
            self._session_id,
            Message(
                role="user",
                content=text_content.strip(),
                timestamp=datetime.now(UTC),
                language_detected=self.current_language,
            ),
        )

        await _publish_event(
            self._room,
            {
                "type": "transcript",
                "text": text_content.strip(),
                "language": self.current_language,
            },
        )


server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="voca-agent")
async def voca_agent(ctx: JobContext) -> None:
    persona_id, session_id = _parse_room_name(ctx.room.name)
    logger.info("Starting LiveKit agent for persona=%s session=%s room=%s", persona_id, session_id, ctx.room.name)

    session = AgentSession(
        stt=deepgram.STT(
            model="nova-2",
            language="en",
            detect_language=False,
            smart_format=True,
        ),
        llm=NOT_GIVEN,
        tts=NOT_GIVEN,
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    await session.start(
        agent=VocaLiveKitAgent(persona_id=persona_id, session_id=session_id, room=ctx.room),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda _params: noise_cancellation.BVC(),
            ),
        ),
    )

    await ctx.connect()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    if "--dev" in sys.argv:
        sys.argv[sys.argv.index("--dev")] = "dev"
    cli.run_app(server)