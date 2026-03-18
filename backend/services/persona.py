from __future__ import annotations

import glob
import json
import logging
from pathlib import Path
from typing import Any

from models.persona import Persona

logger = logging.getLogger("voca")
PERSONAS_DIR = Path(__file__).resolve().parents[1] / "personas"


class PersonaService:
    """Loads and manages persona configurations from JSON files."""

    def __init__(self) -> None:
        self._personas: dict[str, Persona] = {}
        self.load_all()

    def load_all(self) -> None:
        self._personas.clear()
        for path in glob.glob(str(PERSONAS_DIR / "*.json")):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                persona = Persona(**data)
                self._personas[persona.id] = persona
        logger.info("PersonaService loaded %d personas", len(self._personas))

    def get_by_id(self, persona_id: str) -> Persona | None:
        p = self._personas.get(persona_id)
        if p is None and persona_id == "custom":
            from models.persona import VoiceConfig, UIConfig, KnowledgeBase
            return Persona(
                id="custom",
                name="Custom Persona",
                display_name="Custom",
                organization="Voca",
                system_prompt="You are a helpful AI assistant.",
                knowledge_base=KnowledgeBase(),
                voice_config=VoiceConfig(murf_voice_id="en-US-matthew", murf_style="Conversational", language="en-US"),
                ui_config=UIConfig(accent_color="#FF3366", orb_color="#FF3366", label="Custom AI"),
                escalation_message="I cannot help with that right now."
            )
        return p

    def list_all(self) -> list[dict[str, Any]]:
        base_list = [p.model_dump() for p in self._personas.values()]
        if "custom" not in self._personas:
            base_list.append(self.get_by_id("custom").model_dump())
        return base_list


# Module-level singleton
_persona_service: PersonaService | None = None


def get_persona_service() -> PersonaService:
    global _persona_service
    if _persona_service is None:
        _persona_service = PersonaService()
    return _persona_service
