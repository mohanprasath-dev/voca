from __future__ import annotations

from collections.abc import AsyncGenerator, AsyncIterator
from typing import Any

import httpx

from config import settings


class MurfService:
    """Murf Falcon TTS client for low-latency speech synthesis."""

    def __init__(self, timeout_seconds: float = 30.0) -> None:
        self._api_key = settings.murf_api_key
        self._endpoint = "https://api.murf.ai/v1/speech/stream"
        self._timeout = timeout_seconds

    def _build_payload(self, text: str, voice_config: dict[str, Any]) -> dict[str, Any]:
        return {
            "text": text,
            "voiceId": voice_config.get("murf_voice_id"),
            "style": voice_config.get("murf_style"),
            "language": voice_config.get("language", "en-IN"),
            "format": "PCM",
            "sampleRate": 24000,
        }

    def _build_headers(self) -> dict[str, str]:
        return {
            "api-key": self._api_key,
            "Content-Type": "application/json",
        }

    async def stream(
        self,
        text: str,
        voice_config: dict[str, Any],
    ) -> AsyncGenerator[bytes, None]:
        payload = self._build_payload(text=text, voice_config=voice_config)
        headers = self._build_headers()

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            async with client.stream(
                "POST",
                self._endpoint,
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes(chunk_size=4096):
                    if chunk:
                        yield chunk

    async def stream_speech(
        self,
        text: str,
        voice_config: dict[str, Any],
    ) -> AsyncIterator[bytes]:
        async for chunk in self.stream(text=text, voice_config=voice_config):
            yield chunk

    async def synthesize_once(self, text: str, voice_config: dict[str, Any]) -> bytes:
        payload = self._build_payload(text=text, voice_config=voice_config)
        headers = self._build_headers()

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                self._endpoint,
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return response.content
