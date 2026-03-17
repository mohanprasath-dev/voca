from starlette.requests import HTTPConnection

from services.persona import PersonaService
from services.session import SessionService


def get_persona_service_dep(connection: HTTPConnection) -> PersonaService:
    """Return the app-level singleton PersonaService."""
    return connection.app.state.persona_service


def get_session_service_dep(connection: HTTPConnection) -> SessionService:
    """Return the app-level singleton SessionService."""
    return connection.app.state.session_service
