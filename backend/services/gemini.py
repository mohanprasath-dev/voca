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

    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self._api_key = settings.gemini_api_key
        # Keep a fallback chain because free-tier quotas can be model-specific.
        self._models = ["gemini-3.1-flash-lite", "gemini-1.5-flash"]
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
        assistant_reply_instruction = '"assistant_reply":"string"'
        if include_language_tag:
            assistant_reply_instruction = (
                '"assistant_reply":"string starting with [LANG:xx] followed by the spoken reply"'
            )

        return (
            f"{persona.system_prompt}\n\n"
            "You are VOCA, a real-time AI voice agent acting as a human-like business representative. "
            "Handle conversations naturally and efficiently, understand informal or multilingual speech, "
            "and adapt your tone to the active persona context. Keep spoken replies concise and helpful. "
            "Use 1-2 sentences unless more detail is truly needed. If the user is unclear, ask a short "
            "follow-up question. If the user switches language, switch instantly and continue in that language. "
            "Maintain context across the ongoing session.\n\n"
            "Critical behavior: internally reason with these fields every turn: "
            '"intent", "details", "sentiment", "next_action". '
            "Do not expose internal reasoning or JSON to the user; only assistant_reply is spoken to the user.\n\n"
            "Return strictly valid JSON with this schema: "
            '{'
            f'{assistant_reply_instruction},'
            '"language":"string",'
            '"escalation_needed":boolean,'
            '"escalation_summary":"string",'
            '"intent":"string",'
            '"details":"string",'
            '"sentiment":"string",'
            '"next_action":"string"}. '
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
            return {
                "assistant_reply": cleaned,
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
                "temperature": 0.2,
                "maxOutputTokens": 120,
            },
        }

        response_json = await self._request_completion(payload)
        model_text = self._parse_model_text(response_json)
        parsed = self._parse_structured_output(model_text)

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

