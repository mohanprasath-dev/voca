import glob
import json
import logging
from fastapi import FastAPI
from api.routes import browser, telephony, dashboard
from api.middleware.cors import setup_cors

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voca")

# Initialize app
app = FastAPI(title="Voca API", version="1.0.0")

# Setup CORS
setup_cors(app)

# Include routers
app.include_router(browser.router, prefix="/ws/browser", tags=["Websocket Browser"])
app.include_router(telephony.router, prefix="/telephony", tags=["Telephony"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])

@app.on_event("startup")
async def startup_event():
    # Load and optionally log personas count on startup
    persona_files = glob.glob("personas/*.json")
    # For now, just logging the count to satisfy Checkpoint 1.3
    logger.info(f"Voca API started. Loaded {len(persona_files)} personas.")

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/personas")
async def list_personas():
    personas = []
    for file_path in glob.glob("personas/*.json"):
        with open(file_path, "r", encoding="utf-8") as f:
            persona = json.load(f)
            personas.append(persona)
    return personas
