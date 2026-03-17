from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlencode

import httpx

from config import settings


class DeepgramService:
    """Deepgram Nova-3 streaming STT helper utilities."""

    def __init__(self) -> None:
        self._api_key = settings.deepgram_api_key
        self._base_ws_url = "wss://api.deepgram.com/v1/listen"
        self._base_http_url = "https://api.deepgram.com/v1/listen"

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

    async def transcribe_audio_bytes(
        self,
        audio_bytes: bytes,
        language: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, str] = {
            "model": "nova-3",
            "encoding": "linear16",
            "sample_rate": "16000",
            "channels": "1",
            "punctuate": "true",
            "smart_format": "true",
        }
        if language:
            params["language"] = language

        headers = {
            "Authorization": f"Token {self._api_key}",
            "Content-Type": "audio/raw",
        }

        url = f"{self._base_http_url}?{urlencode(params)}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, content=audio_bytes)
            response.raise_for_status()
            payload = response.json()

        alternatives = (
            payload.get("results", {})
            .get("channels", [{}])[0]
            .get("alternatives", [])
        )
        if not alternatives:
            return {"transcript": "", "language": language or "en"}

        top = alternatives[0]
        return {
            "transcript": str(top.get("transcript", "")).strip(),
            "language": top.get("detected_language") or language or "en",
        }

    @staticmethod
    def _pcm16_to_wav(audio_bytes: bytes, sample_rate: int = 16000, channels: int = 1, bits_per_sample: int = 16) -> bytes:
        byte_rate = sample_rate * channels * (bits_per_sample // 8)
        block_align = channels * (bits_per_sample // 8)
        data_size = len(audio_bytes)
        riff_size = 36 + data_size

        header = b"RIFF"
        header += riff_size.to_bytes(4, byteorder="little")
        header += b"WAVE"
        header += b"fmt "
        header += (16).to_bytes(4, byteorder="little")
        header += (1).to_bytes(2, byteorder="little")
        header += channels.to_bytes(2, byteorder="little")
        header += sample_rate.to_bytes(4, byteorder="little")
        header += byte_rate.to_bytes(4, byteorder="little")
        header += block_align.to_bytes(2, byteorder="little")
        header += bits_per_sample.to_bytes(2, byteorder="little")
        header += b"data"
        header += data_size.to_bytes(4, byteorder="little")
        return header + audio_bytes

    async def transcribe_bytes(self, audio_bytes: bytes) -> tuple[str, str]:
        wav_bytes = self._pcm16_to_wav(audio_bytes)
        params = {
            "model": "nova-2",
            "language": "multi",
            "smart_format": "true",
        }
        headers = {
            "Authorization": f"Token {self._api_key}",
            "Content-Type": "audio/wav",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                self._base_http_url,
                params=params,
                headers=headers,
                content=wav_bytes,
            )
            response.raise_for_status()
            result = response.json()

        channels = result.get("results", {}).get("channels", [])
        if not channels:
            return "", "en"

        alternatives = channels[0].get("alternatives", [])
        if not alternatives:
            return "", "en"

        transcript = str(alternatives[0].get("transcript", "")).strip()
        language = (
            channels[0].get("detected_language")
            or alternatives[0].get("detected_language")
            or "en"
        )
        return transcript, str(language)
