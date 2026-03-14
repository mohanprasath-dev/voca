from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Configures CORS for the FastAPI application
def setup_cors(app: FastAPI):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Restrict this in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
