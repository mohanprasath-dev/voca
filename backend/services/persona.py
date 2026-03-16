import json
import logging
from pathlib import Path

from models.persona import PersonaConfig


logger = logging.getLogger("voca.persona")


class PersonaNotFoundError(Exception):
    """Raised when a requested persona ID does not exist."""


class PersonaService:
    """Loads, validates, and serves persona configuration data."""

    def __init__(self, personas_dir: Path | None = None) -> None:
        base_dir = Path(__file__).resolve().parent.parent
        self._personas_dir = personas_dir or (base_dir / "personas")
        self._personas: dict[str, PersonaConfig] = {}
        self._load_personas()

    def _load_personas(self) -> None:
        if not self._personas_dir.exists():
            raise FileNotFoundError(f"Personas directory not found: {self._personas_dir}")

        persona_files = sorted(self._personas_dir.glob("*.json"))
        if not persona_files:
            raise FileNotFoundError(f"No persona files found in {self._personas_dir}")

        loaded_personas: dict[str, PersonaConfig] = {}
        for persona_file in persona_files:
            with persona_file.open("r", encoding="utf-8") as file:
                data = json.load(file)

            persona = PersonaConfig.model_validate(data)
            loaded_personas[persona.id] = persona

        self._personas = loaded_personas
        persona_names = ", ".join(p.display_name for p in self._personas.values())
        logger.info("Loaded %d personas: %s", len(self._personas), persona_names)

    def get_persona(self, persona_id: str) -> PersonaConfig:
        persona = self._personas.get(persona_id)
        if persona is None:
            raise PersonaNotFoundError(f"Persona '{persona_id}' not found")
        return persona

    def list_personas(self) -> list[PersonaConfig]:
        return list(self._personas.values())

    def get_system_prompt(self, persona_id: str) -> str:
        persona = self.get_persona(persona_id)
        kb = persona.knowledge_base

        faq_lines: list[str] = []
        for faq in kb.faqs:
            question = faq.get("q") or faq.get("question") or ""
            answer = faq.get("a") or faq.get("answer") or ""
            if question and answer:
                faq_lines.append(f"- Q: {question}\n  A: {answer}")

        timing_lines = [f"- {key}: {value}" for key, value in kb.timings.items()]
        escalation_lines = [f"- {keyword}" for keyword in kb.escalation_keywords]
        emergency_lines = [f"- {keyword}" for keyword in kb.emergency_keywords]

        knowledge_base_block = "\n".join(
            [
                "KNOWLEDGE BASE:",
                "FAQs:",
                *(faq_lines or ["- None"]),
                "Timings:",
                *(timing_lines or ["- None"]),
                "Escalation Keywords:",
                *(escalation_lines or ["- None"]),
                "Emergency Keywords:",
                *(emergency_lines or ["- None"]),
            ]
        )

        return f"{persona.system_prompt.strip()}\n\n{knowledge_base_block}"

    def get_voice_config(self, persona_id: str) -> dict:
        persona = self.get_persona(persona_id)
        return persona.voice_config.model_dump()
