from __future__ import annotations

import json
import re
from typing import Any

from google import genai

from config import settings
from models.persona import Persona
from models.session import Message


class GeminiService:
    """Gemini Flash client for persona-grounded conversational reasoning."""

    MAX_HISTORY_TURNS = 6
    _JSON_OBJECT_RE = re.compile(r"\{[\s\S]*\}")
    _ASSISTANT_REPLY_RE = re.compile(r'"assistant_reply"\s*:\s*"(?P<reply>(?:\\.|[^"\\])*)')
    _LANGUAGE_RE = re.compile(r'"language"\s*:\s*"(?P<language>(?:\\.|[^"\\])*)')

    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self._api_key = settings.gemini_api_key
        # Keep a fallback chain because availability/quotas can vary by model.
        self._models = ["gemini-3.1-pro-preview", "gemini-3.1-flash-lite"]
        self._model = self._models[0]
        self._timeout = timeout_seconds
        self._client = genai.Client(api_key=self._api_key)

    @staticmethod
    def _is_quota_error(exc: Exception) -> bool:
        text = str(exc).lower()
        return (
            "resource_exhausted" in text
            or "quota exceeded" in text
            or "429" in text
        )

    def _build_prompt(self, persona: Persona, include_language_tag: bool = False) -> str:
        tag_instruction = (
            "You MUST start your `assistant_reply` with the language tag [LANG:xx] "
            "(e.g., [LANG:es] for Spanish) followed exactly by your human-like verbal response. "
        ) if include_language_tag else ""

        return (
            f"{persona.system_prompt}\n\n"
            "You are VOCA, a real-time AI voice agent acting as a human-like business representative. "
            "You are an expert at handling conversations naturally and efficiently. You perfectly understand "
            "informal, heavily accented, or multilingual speech. The user's audio is being transcribed live. "
            "IMPORTANT REASONING RULES:\n"
            "1. ADAPT YOUR TONE: Match the user's energy but stay true to the active persona context.\n"
            "2. CONVERSATIONAL FILLERS: Humans use words like 'Umm', 'uhh', 'hmm', 'well...', 'let's see'. "
            "You SHOULD use these naturally at the start of sentences if you need to think or act smoothly.\n"
            "3. NO ROBOTIC SPEECH: Do NOT sound like a typical AI. Avoid perfect grammar if casual is better. "
            "Do not give bulleted lists—speak everything as a fluid paragraph.\n"
            "4. MATCH THE LANGUAGE: If the user speaks Spanish, French, Hindi, or any other language, "
            "SWITCH INSTANTLY. The language tag inside your reply will ensure the TTS engine uses the right voice.\n\n"
            f"{tag_instruction}"
        )

    def _build_contents(self, messages: list[Message]) -> list[dict[str, Any]]:
        recent = messages[-self.MAX_HISTORY_TURNS:] if len(messages) > self.MAX_HISTORY_TURNS else messages
        contents: list[dict[str, Any]] = []
        for message in recent:
            role = "model" if message.role == "assistant" else "user"
            contents.append(
                {
                    "role": role,
                    "parts": [{"text": message.content}],
                }
            )
        return contents

    async def _request_completion(self, payload: dict[str, Any]) -> dict[str, Any]:
        generation_config = payload.get("generationConfig", {})
        last_exc: Exception | None = None
        for model_name in self._models:
            try:
                self._model = model_name
                response = await self._client.aio.models.generate_content(
                    model=model_name,
                    contents=payload.get("contents", []),
                    config={
                        "systemInstruction": payload.get("system_instruction", {})
                        .get("parts", [{}])[0]
                        .get("text", ""),
                        "temperature": generation_config.get("temperature"),
                        "maxOutputTokens": generation_config.get("maxOutputTokens"),
                        "response_mime_type": "application/json",
                        "response_schema": {
                            "type": "OBJECT",
                            "properties": {
                                "assistant_reply": {"type": "STRING", "description": "The exact words VOCA will speak out loud. Must include language tag if requested."},
                                "language": {"type": "STRING", "description": "ISO language code, eg 'es' or 'en'"},
                                "escalation_needed": {"type": "BOOLEAN"},
                                "escalation_summary": {"type": "STRING"},
                                "intent": {"type": "STRING"},
                                "details": {"type": "STRING"},
                                "sentiment": {"type": "STRING"},
                                "next_action": {"type": "STRING"}
                            },
                            "required": ["assistant_reply", "language", "escalation_needed", "intent"]
                        }
                    },
                )
                return response
            except Exception as exc:
                last_exc = exc
                if self._is_quota_error(exc):
                    continue
                raise

        if last_exc is not None:
            raise last_exc
        raise RuntimeError("Gemini request failed without an exception")

    def _parse_model_text(self, response_json: dict[str, Any] | Any) -> str:
        response_text = getattr(response_json, "text", None)
        if response_text:
            return str(response_text).strip()

        candidates = response_json.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini returned no candidates")

        parts = (
            candidates[0]
            .get("content", {})
            .get("parts", [])
        )
        if not parts or "text" not in parts[0]:
            raise ValueError("Gemini response did not contain text")

        return str(parts[0]["text"]).strip()

    def _parse_structured_output(self, model_text: str) -> dict[str, Any]:
        cleaned = model_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        if cleaned.startswith("{") and '"assistant_reply"' in cleaned:
            extracted_reply_match = self._ASSISTANT_REPLY_RE.search(cleaned)
            extracted_lang_match = self._LANGUAGE_RE.search(cleaned)
            extracted_reply = ""
            extracted_language = ""
            if extracted_reply_match:
                extracted_reply = bytes(extracted_reply_match.group("reply"), "utf-8").decode("unicode_escape").strip()
            if extracted_lang_match:
                extracted_language = bytes(extracted_lang_match.group("language"), "utf-8").decode("unicode_escape").strip()
            if extracted_reply:
                return {
                    "assistant_reply": extracted_reply,
                    "language": extracted_language,
                    "escalation_needed": False,
                    "escalation_summary": "",
                }

        parsed: dict[str, Any] | None = None
        try:
            candidate = json.loads(cleaned)
            if isinstance(candidate, dict):
                parsed = candidate
        except json.JSONDecodeError:
            parsed = None

        if parsed is None:
            match = self._JSON_OBJECT_RE.search(cleaned)
            if match:
                try:
                    candidate = json.loads(match.group(0))
                    if isinstance(candidate, dict):
                        parsed = candidate
                except json.JSONDecodeError:
                    parsed = None

        if parsed is None:
            # Fallback: keep the raw model text as the assistant reply so the
            # caller always receives usable output.
            fallback_reply = cleaned
            if cleaned.startswith("{") and '"assistant_reply"' in cleaned:
                fallback_reply = "I heard you, but I need a second. Could you try that once more?"
            return {
                "assistant_reply": fallback_reply,
                "language": "",
                "escalation_needed": False,
                "escalation_summary": "",
            }

        return {
            "assistant_reply": str(parsed.get("assistant_reply", "")).strip(),
            "language": str(parsed.get("language", "")).strip(),
            "escalation_needed": bool(parsed.get("escalation_needed", False)),
            "escalation_summary": str(parsed.get("escalation_summary", "")).strip(),
        }

    async def _generate_reply(
        self,
        persona: Persona,
        messages: list[Message],
        *,
        include_language_tag: bool = False,
    ) -> dict[str, Any]:
        payload = {
            "system_instruction": {
                "parts": [{"text": self._build_prompt(persona, include_language_tag=include_language_tag)}],
            },
            "contents": self._build_contents(messages),
            "generationConfig": {
                "temperature": 0.8,
                "maxOutputTokens": 80,
            },
        }

        response_json = await self._request_completion(payload)
        model_text = self._parse_model_text(response_json)
        parsed = self._parse_structured_output(model_text)

        if include_language_tag and parsed.get("assistant_reply") and not str(parsed["assistant_reply"]).lstrip().startswith("[LANG:"):
            language = str(parsed.get("language") or "").strip()
            if language:
                parsed["assistant_reply"] = f"[LANG:{language}] {parsed['assistant_reply']}"

        if not parsed["assistant_reply"]:
            parsed["assistant_reply"] = "I heard you, but I need a second. Could you try that once more?"
        return parsed

    async def generate_reply(
        self,
        persona: Persona,
        messages: list[Message],
    ) -> dict[str, Any]:
        return await self._generate_reply(persona, messages, include_language_tag=False)

    async def generate_livekit_reply(
        self,
        persona: Persona,
        messages: list[Message],
    ) -> dict[str, Any]:
        return await self._generate_reply(persona, messages, include_language_tag=True)


if __name__ == "__main__":
    import asyncio
    from models.persona import VoiceConfig, UIConfig, KnowledgeBase
    from datetime import datetime, UTC

    async def test():
        svc = GeminiService()
        persona = Persona(
            id="test_persona",
            name="Test Persona",
            display_name="Test",
            organization="Test Org",
            system_prompt="You are a helpful assistant.",
            knowledge_base=KnowledgeBase(),
            ui_config=UIConfig(accent_color="#000", orb_color="#000", label="Test"),
            voice_config=VoiceConfig(murf_voice_id="en-US-matthew", murf_style="Conversation", language="en-US"),
            escalation_message="Escalating..."
        )
        msgs = [Message(role="user", content="Hello", timestamp=datetime.now(UTC), language_detected="en-US")]
        res = await svc.generate_reply(persona, msgs)
        print(f"Response: {res.get('assistant_reply')}, Lang: {res.get('language')}")

    asyncio.run(test())

