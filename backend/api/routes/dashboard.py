import logging

from fastapi import APIRouter

from services.session import get_session_service

logger = logging.getLogger("voca")
router = APIRouter()


@router.get("/sessions")
async def list_sessions():
    """Return all session records."""
    svc = get_session_service()
    return svc.list_sessions()


@router.get("/sessions/stats")
async def get_session_stats():
    """Return aggregate session stats."""
    svc = get_session_service()
    return svc.get_stats()
