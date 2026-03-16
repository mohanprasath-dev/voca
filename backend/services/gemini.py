import asyncio
import logging
import re

from google import genai

from config import settings

logger = logging.getLogger("voca.gemini")

class GeminiServiceError(Exception):
    """Raised when GeminiService cannot generate a response."""

class GeminiService:
    """Generates persona-aware conversational responses using Gemini Flash."""

    _client: genai.Client | None = None
    _model_name = "gemini-2.5-flash"
    _language_tag_pattern = re.compile(r"^\s*\[LANG:([a-z]{2}(?:-[A-Z]{2})?)\]\s*", re.IGNORECASE)

    def __init__(self) -> None:
        if GeminiService._client is None:
            GeminiService._client = genai.Client(api_key=settings.gemini_api_key)

    async def respond(
        self,
        message: str,
        system_prompt: str,
        history: list[dict],
    ) -> tuple[str, str]:
        """Return Gemini's spoken response text and detected language code."""
        prompt = self._build_prompt(message=message, system_prompt=system_prompt, history=history)

        try:
            response = await asyncio.to_thread(
                self._client.models.generate_content,
                model=self._model_name,
                contents=prompt,
            )
        except Exception as exc:
            logger.exception("Gemini generate_content call failed")
            raise GeminiServiceError("Gemini API request failed") from exc

        response_text = (response.text or "").strip()
        if not response_text:
            logger.error("Gemini returned an empty response")
            raise GeminiServiceError("Gemini returned an empty response")

        language_code, spoken_text = self._extract_language_and_text(response_text)
        logger.info("Generated Gemini response in language %s", language_code)
        return spoken_text, language_code

    def _build_prompt(self, message: str, system_prompt: str, history: list[dict]) -> str:
        history_lines: list[str] = []
        for item in history:
            role = str(item.get("role", "user")).strip() or "user"
            content = str(item.get("content", "")).strip()
            if not content:
                parts = item.get("parts", [])
                if isinstance(parts, list):
                    content = " ".join(str(part).strip() for part in parts if str(part).strip())
            if content:
                history_lines.append(f"{role.upper()}: {content}")

        history_block = "\n".join(history_lines) if history_lines else "No prior conversation history."

        return "\n\n".join(
            [
                "SYSTEM INSTRUCTIONS:",
                system_prompt.strip(),
                "LANGUAGE RULE: Detect the language of the user's latest message.",
                "Respond entirely in that language.",
                "Always begin your response with [LANG:xx] where xx is the ISO 639-1 code.",
                "Examples: [LANG:en] for English, [LANG:ta] for Tamil, [LANG:hi] for Hindi.",
                "If the user switches language, you switch immediately in your next response.",
                "Never mix languages in a single response.",
                "OUTPUT RULES:",
                "1. Detect the user's language from the conversation context.",
                "2. Start the response with [LANG:xx] where xx is the ISO language code you are using.",
                "3. Keep the reply concise and natural for a spoken voice conversation.",
                "4. Do not explain the language tag.",
                "CONVERSATION HISTORY:",
                history_block,
                "LATEST USER MESSAGE:",
                message.strip(),
            ]
        )

    def _extract_language_and_text(self, response_text: str) -> tuple[str, str]:
        match = self._language_tag_pattern.match(response_text)
        if not match:
            logger.warning("Gemini response missing language tag; defaulting to en")
            return "en", response_text

        language_code = match.group(1).lower()
        spoken_text = self._language_tag_pattern.sub("", response_text, count=1).strip()
        if not spoken_text:
            logger.error("Gemini response contained a language tag but no spoken text")
            raise GeminiServiceError("Gemini returned no spoken text")

        return language_code, spoken_text
