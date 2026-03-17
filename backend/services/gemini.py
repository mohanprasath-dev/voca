from __future__ import annotations

import json
from typing import Any

from google import genai

from config import settings
from models.persona import Persona
from models.session import Message


class GeminiService:
    """Gemini Flash client for persona-grounded conversational reasoning."""

    MAX_HISTORY_TURNS = 6

    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self._api_key = settings.gemini_api_key
        self._model = "gemini-2.5-flash"
        self._timeout = timeout_seconds
        self._client = genai.Client(api_key=self._api_key)

    def _build_prompt(self, persona: Persona, include_language_tag: bool = False) -> str:
        assistant_reply_instruction = '"assistant_reply":"string"'
        if include_language_tag:
            assistant_reply_instruction = (
                '"assistant_reply":"string starting with [LANG:xx] followed by the spoken reply"'
            )

        return (
            f"{persona.system_prompt}\n\n"
            "Return strictly valid JSON with this schema: "
            '{'
            f'{assistant_reply_instruction},'
            '"language":"string",'
            '"escalation_needed":boolean,"escalation_summary":"string"}. '
            "If you include a language tag, it must be part of assistant_reply. "
            "Do not wrap in markdown."
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
        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=payload.get("contents", []),
            config={
                "systemInstruction": payload.get("system_instruction", {})
                .get("parts", [{}])[0]
                .get("text", ""),
                "temperature": generation_config.get("temperature"),
                "maxOutputTokens": generation_config.get("maxOutputTokens"),
            },
        )
        return response

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

        parsed = json.loads(cleaned)
        return {
            "assistant_reply": str(parsed.get("assistant_reply", "")).strip(),
            "language": str(parsed.get("language", "unknown")).strip(),
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
                "temperature": 0.2,
                "maxOutputTokens": 120,
            },
        }

        response_json = await self._request_completion(payload)
        model_text = self._parse_model_text(response_json)
        parsed = self._parse_structured_output(model_text)

        if not parsed["assistant_reply"]:
            raise ValueError("Gemini returned empty assistant reply")
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

