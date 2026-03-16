import logging
from fastapi import FastAPI
from api.routes import browser, dashboard
from api.routes.telephony import router as telephony_router
from api.middleware.cors import setup_cors
from services.persona import PersonaService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voca")

# Initialize app
app = FastAPI(title="Voca API", version="1.0.0")

# Initialize singleton services
persona_service = PersonaService()
app.state.persona_service = persona_service

# Setup CORS
setup_cors(app)

# Include routers
app.include_router(browser.router, prefix="/ws/browser", tags=["Websocket Browser"])
app.include_router(telephony_router, prefix="/telephony", tags=["Telephony"])
app.include_router(telephony_router)
app.include_router(dashboard.router, tags=["Dashboard"])

@app.on_event("startup")
async def startup_event():
    logger.info("Voca API started. Loaded %d personas.", len(persona_service.list_personas()))

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}
