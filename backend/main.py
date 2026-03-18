import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import browser, dashboard, livekit
from api.middleware.cors import setup_cors
from services.persona import get_persona_service
from services.session import get_session_service
from config import settings
from dotenv import load_dotenv

# Setup logging
import os


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voca")

# Initialize app
app = FastAPI(title="Voca API", version="1.0.0")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
setup_cors(app)

# Include routers
app.include_router(browser.router, prefix="/ws/browser", tags=["Websocket Browser"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(livekit.router, tags=["LiveKit"])


@app.on_event("startup")
async def startup_event():
    persona_svc = get_persona_service()
    session_svc = get_session_service()
    app.state.persona_service = persona_svc
    app.state.session_service = session_svc
    personas = persona_svc.list_all()
    logger.info("Voca API started. Loaded %d personas.", len(personas))


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/personas")
async def list_personas():
    svc = get_persona_service()
    return svc.list_all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=False)

