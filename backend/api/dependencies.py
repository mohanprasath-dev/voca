from starlette.requests import HTTPConnection

from services.persona import PersonaService


def get_persona_service(connection: HTTPConnection) -> PersonaService:
    """Return the app-level singleton PersonaService."""
    return connection.app.state.persona_service
