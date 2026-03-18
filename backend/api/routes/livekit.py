from __future__ import annotations

from fastapi import APIRouter, HTTPException
from livekit import api as lkapi

from config import settings
from services.persona import get_persona_service
from services.session import get_session_service

router = APIRouter()


@router.get("/livekit/token")
async def get_token(persona_id: str = "apex", custom_prompt: str | None = None) -> dict[str, str]:
    persona = get_persona_service().get_by_id(persona_id)
    if not persona and persona_id != "custom":
        raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found")

    if not settings.livekit_api_key or not settings.livekit_api_secret or not settings.livekit_url:
        raise HTTPException(status_code=500, detail="LiveKit credentials are not configured")

    session = get_session_service().create_session(persona_id, custom_prompt)
    room_name = f"voca-{persona_id}-{session.session_id}"
    participant_name = f"user-{persona_id}-{session.session_id}"

    token = (
        lkapi.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(participant_name)
        .with_name(participant_name)
        .with_grants(lkapi.VideoGrants(room_join=True, room=room_name))
        .with_room_config(
            lkapi.RoomConfiguration(
                agents=[lkapi.RoomAgentDispatch(agent_name="voca-agent")],
            )
        )
    )

    return {
        "token": token.to_jwt(),
        "url": settings.livekit_url,
        "persona_id": persona_id,
        "session_id": session.session_id,
        "room_name": room_name,
        "participant_name": participant_name,
    }


@router.post("/livekit/session/end")
async def end_livekit_session(session_id: str) -> dict[str, object]:
    return await get_session_service().end_session(session_id)