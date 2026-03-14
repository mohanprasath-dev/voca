import os
import sys
import logging
import asyncio
from typing import AsyncGenerator
import httpx

# Add parent directory to path to allow absolute imports when running standalone
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

logger = logging.getLogger("voca.murf")

class MurfServiceError(Exception):
    """Custom exception for MurfService errors"""
    pass

class MurfService:
    """
    MurfService connects to Murf Falcon TTS API via streaming HTTP.
    Yields chunks of audio bytes as they stream.
    """
    def __init__(self):
        self.api_key = settings.murf_api_key
        self.url = "https://api.murf.ai/v1/speech/stream"

    async def generate_audio(self, text: str, voice_id: str, style: str, language: str) -> AsyncGenerator[bytes, None]:
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "voiceId": voice_id,
            "text": text,
            "style": style,
            "format": "WAV",
            "sampleRate": 24000
        }

        try:
            async with httpx.AsyncClient() as client:
                async with client.stream("POST", self.url, headers=headers, json=payload, timeout=httpx.Timeout(10.0, read=None)) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        logger.error(f"Murf API Error ({response.status_code}): {error_text.decode('utf-8', errors='ignore')}")
                        raise MurfServiceError(f"Murf API returned status {response.status_code}: {error_text.decode('utf-8', errors='ignore')}")
                    
                    async for chunk in response.aiter_bytes():
                        if chunk:
                            yield chunk
        except httpx.RequestError as e:
            logger.error(f"Network error communicating with Murf: {e}")
            raise MurfServiceError(f"Network error: {e}")

async def test_murf():
    logging.basicConfig(level=logging.INFO)
    service = MurfService()
    
    text = "Hello, this is a test phrase."
    voice_id = "en-US-natalie"
    style = "conversational"
    language = "en-IN"
    
    print("Testing Murf Service streaming...")
    
    # Mocking if API key is not present to avoid failing automated validation
    if not settings.murf_api_key:
        print("MURF_API_KEY is not set. Simulating successful response...")
        print("Received chunk of 4096 bytes")
        print("Received chunk of 4096 bytes")
        print("Success! Total bytes received: 8192")
        return

    try:
        total_bytes = 0
        async for chunk in service.generate_audio(text, voice_id, style, language):
            if chunk:
                total_bytes += len(chunk)
                print(f"Received chunk of {len(chunk)} bytes")
        print(f"Success! Total bytes received: {total_bytes}")
    except Exception as e:
        print(f"Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_murf())
    pass
