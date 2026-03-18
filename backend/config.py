from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent
ENV_FILES = (BASE_DIR / ".env", BASE_DIR / ".env.local")

class Settings(BaseSettings):
    murf_api_key: str
    deepgram_api_key: str
    gemini_api_key: str
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    livekit_url: str = ""
    port: int = 8000

    model_config = SettingsConfigDict(
        env_file=tuple(str(path) for path in ENV_FILES),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
