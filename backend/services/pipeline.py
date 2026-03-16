import logging

from models.persona import PersonaConfig
from services.gemini import GeminiService
from services.murf import MurfService
from services.persona import PersonaService


logger = logging.getLogger("voca.pipeline")


class VocaPipeline:
    """Coordinates persona context, Gemini responses, and Murf synthesis config."""

    def __init__(self, persona_id: str, persona_service: PersonaService | None = None) -> None:
        self.persona_service = persona_service or PersonaService()
        self.persona_id = persona_id
        self.persona: PersonaConfig = self.persona_service.get_persona(persona_id)
        self.system_prompt: str = self.persona_service.get_system_prompt(persona_id)
        self.voice_config: dict = self.persona_service.get_voice_config(persona_id)

        self.gemini_service = GeminiService()
        self.murf_service = MurfService()

        self.history: list[dict] = []
        self.escalation_needed: bool = False
        self.escalation_summary: str = ""

    async def respond(self, user_message: str) -> dict:
        response_text, language_code = await self.gemini_service.respond(
            message=user_message,
            system_prompt=self.system_prompt,
            history=self.history,
        )

        self.history.append({"role": "user", "content": user_message})
        self.history.append({"role": "assistant", "content": response_text})

        self._detect_escalation(response_text)

        return {
            "text": response_text,
            "language": language_code,
            "escalation_needed": self.escalation_needed,
            "escalation_summary": self.escalation_summary,
            "voice_config": self.voice_config,
        }

    async def generate_audio(self, text: str):
        return self.murf_service.generate_audio(
            text=text,
            voice_id=self.voice_config["murf_voice_id"],
            style=self.voice_config["murf_style"],
            language=self.voice_config["language"],
        )

    def _detect_escalation(self, response_text: str) -> None:
        lower_response = response_text.lower()
        escalation_keywords = self.persona.knowledge_base.escalation_keywords
        contains_keyword = any(keyword.lower() in lower_response for keyword in escalation_keywords)
        has_explicit_flag = "escalation_needed=true" in lower_response

        if contains_keyword or has_explicit_flag:
            self.escalation_needed = True
            self.escalation_summary = response_text
            logger.info("Escalation triggered for persona %s", self.persona_id)
