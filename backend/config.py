from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    murf_api_key: str
    deepgram_api_key: str
    gemini_api_key: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_phone_number: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
