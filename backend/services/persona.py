from __future__ import annotations

import glob
import json
import logging
from typing import Any

from models.persona import Persona

logger = logging.getLogger("voca")


class PersonaService:
    """Loads and manages persona configurations from JSON files."""

    def __init__(self) -> None:
        self._personas: dict[str, Persona] = {}
        self.load_all()

    def load_all(self) -> None:
        self._personas.clear()
        for path in glob.glob("personas/*.json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                persona = Persona(**data)
                self._personas[persona.id] = persona
        logger.info("PersonaService loaded %d personas", len(self._personas))

    def get_by_id(self, persona_id: str) -> Persona | None:
        return self._personas.get(persona_id)

    def list_all(self) -> list[dict[str, Any]]:
        return [p.model_dump() for p in self._personas.values()]


# Module-level singleton
_persona_service: PersonaService | None = None


def get_persona_service() -> PersonaService:
    global _persona_service
    if _persona_service is None:
        _persona_service = PersonaService()
    return _persona_service
