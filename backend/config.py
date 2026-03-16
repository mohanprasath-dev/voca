from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    murf_api_key: str
    deepgram_api_key: str
    gemini_api_key: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_phone_number: str
    public_url: str = "http://localhost:8000"

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
