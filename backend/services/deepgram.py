from __future__ import annotations

import json
from typing import Any

from config import settings


class DeepgramService:
    """Deepgram Nova-3 streaming STT helper utilities."""

    def __init__(self) -> None:
        self._api_key = settings.deepgram_api_key
        self._base_ws_url = "wss://api.deepgram.com/v1/listen"

    def build_ws_url(self, language: str | None = None) -> str:
        params = {
            "model": "nova-3",
            "encoding": "linear16",
            "sample_rate": "16000",
            "channels": "1",
            "interim_results": "true",
            "smart_format": "true",
            "punctuate": "true",
        }
        if language:
            params["language"] = language

        query = "&".join(f"{key}={value}" for key, value in params.items())
        return f"{self._base_ws_url}?{query}"

    def build_headers(self) -> dict[str, str]:
        return {"Authorization": f"Token {self._api_key}"}

    def parse_transcript_event(self, payload: str | bytes | dict[str, Any]) -> dict[str, Any] | None:
        data: dict[str, Any]
        if isinstance(payload, dict):
            data = payload
        elif isinstance(payload, bytes):
            data = json.loads(payload.decode("utf-8"))
        else:
            data = json.loads(payload)

        if data.get("type") != "Results":
            return None

        alternatives = (
            data.get("channel", {})
            .get("alternatives", [])
        )
        if not alternatives:
            return None

        transcript = alternatives[0].get("transcript", "").strip()
        if not transcript:
            return None

        return {
            "transcript": transcript,
            "is_final": bool(data.get("is_final", False)),
            "confidence": float(alternatives[0].get("confidence", 0.0)),
            "language": alternatives[0].get("detected_language"),
        }
