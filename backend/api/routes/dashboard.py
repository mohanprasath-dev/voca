from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_persona_service
from services.persona import PersonaNotFoundError, PersonaService

# Routes for viewing session logs and summaries
router = APIRouter()


@router.get("/personas")
async def list_personas(persona_service: PersonaService = Depends(get_persona_service)) -> list[dict]:
	personas = persona_service.list_personas()
	return [
		{
			"id": persona.id,
			"name": persona.name,
			"display_name": persona.display_name,
			"ui_config": persona.ui_config.model_dump(),
		}
		for persona in personas
	]


@router.get("/personas/{persona_id}")
async def get_persona(persona_id: str, persona_service: PersonaService = Depends(get_persona_service)) -> dict:
	try:
		persona = persona_service.get_persona(persona_id)
	except PersonaNotFoundError as exc:
		raise HTTPException(status_code=404, detail=str(exc)) from exc

	return persona.model_dump(exclude={"system_prompt"})
