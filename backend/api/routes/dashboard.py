from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_persona_service, get_session_service
from services.persona import PersonaNotFoundError, PersonaService
from services.session import SessionService

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


@router.get("/sessions")
async def list_sessions(session_service: SessionService = Depends(get_session_service)) -> list[dict]:
	sessions = session_service.list_sessions(limit=20)
	return [session.model_dump() for session in sessions]


@router.get("/sessions/stats")
async def session_stats(session_service: SessionService = Depends(get_session_service)) -> dict:
	sessions = session_service.list_sessions(limit=10_000)
	if not sessions:
		return {
			"total_sessions": 0,
			"resolved": 0,
			"escalated": 0,
			"abandoned": 0,
			"languages_used": [],
			"avg_duration_seconds": 0.0,
			"avg_turns": 0.0,
		}

	resolved = sum(1 for session in sessions if session.resolution_status == "resolved")
	escalated = sum(1 for session in sessions if session.resolution_status == "escalated")
	abandoned = sum(1 for session in sessions if session.resolution_status == "abandoned")

	seen_languages: set[str] = set()
	languages_used: list[str] = []
	for session in sessions:
		for language in session.detected_languages:
			if language not in seen_languages:
				seen_languages.add(language)
				languages_used.append(language)

	durations = [float(session.duration_seconds or 0.0) for session in sessions]
	turns = [int(session.turn_count or 0) for session in sessions]
	avg_duration = sum(durations) / len(durations) if durations else 0.0
	avg_turns = sum(turns) / len(turns) if turns else 0.0

	return {
		"total_sessions": len(sessions),
		"resolved": resolved,
		"escalated": escalated,
		"abandoned": abandoned,
		"languages_used": languages_used,
		"avg_duration_seconds": round(avg_duration, 1),
		"avg_turns": round(avg_turns, 1),
	}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, session_service: SessionService = Depends(get_session_service)) -> dict:
	session = session_service.get_session(session_id)
	if session is None:
		raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
	return session.model_dump()
