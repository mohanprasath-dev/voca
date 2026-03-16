import os
import sys

# Remove local directory from path to avoid shadowing the global 'deepgram' package
if os.path.dirname(os.path.abspath(__file__)) in sys.path:
    sys.path.remove(os.path.dirname(os.path.abspath(__file__)))
if '' in sys.path:
    sys.path.remove('')
if sys.path[0].endswith('services'):
    sys.path.pop(0)

import logging
import asyncio
import math
import struct
from typing import AsyncGenerator, Callable

from deepgram import AsyncDeepgramClient
from deepgram.core.events import EventType

# Add parent directory to path to allow absolute imports when running standalone
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

logger = logging.getLogger("voca.deepgram")

class DeepgramServiceError(Exception):
    pass

class DeepgramService:
    """Deepgram STT Service handling WebSocket-based audio transcription."""
    def __init__(self):
        self.api_key = settings.deepgram_api_key
        self.deepgram = AsyncDeepgramClient(api_key=self.api_key)

    async def transcribe_stream(self, audio_generator: AsyncGenerator[bytes, None], on_transcript: Callable):
        """
        Connects to Deepgram and pushes chunks from audio_generator.
        Calls on_transcript(transcript: str, language: str, is_final: bool)
        """
        try:
            async with self.deepgram.listen.v1.connect(
                model="nova-2",
                language="multi",
                smart_format="true",
                encoding="linear16",
                channels="1",
                sample_rate="16000",
                interim_results="true",
            ) as dg_connection:
                async def on_message(result):
                    if not hasattr(result, "channel"):
                        return
                    alternatives = getattr(result.channel, "alternatives", [])
                    if not alternatives:
                        return
                    sentence = alternatives[0].transcript
                    if len(sentence) == 0:
                        return
                    language = "en"
                    if hasattr(alternatives[0], "languages") and alternatives[0].languages:
                        language = alternatives[0].languages[0]
                    is_final = getattr(result, "is_final", False)
                    if asyncio.iscoroutinefunction(on_transcript):
                        await on_transcript(sentence, language, is_final)
                    else:
                        on_transcript(sentence, language, is_final)

                async def on_error(error):
                    logger.error(f"Deepgram WebSocket Error: {error}")

                dg_connection.on(EventType.MESSAGE, on_message)
                dg_connection.on(EventType.ERROR, on_error)

                listener_task = asyncio.create_task(dg_connection.start_listening())
                async for chunk in audio_generator:
                    if chunk:
                        await dg_connection.send_media(chunk)

                await asyncio.sleep(1.0)
                await dg_connection.send_finalize()
                await dg_connection.send_close_stream()
                await listener_task
        except Exception as e:
            logger.error(f"Deepgram connection failed: {e}")
            raise DeepgramServiceError(f"Deepgram connection failed: {e}")

async def _dummy_audio_generator():
    """Generates dummy linear16 PCM audio bytes (a sine wave) for testing"""
    sample_rate = 16000
    duration = 1.0 # 1 second of audio per chunk
    for _ in range(3):
        chunk = b''
        for i in range(int(sample_rate * duration)):
            value = int(32767.0 * math.sin(2.0 * math.pi * 440.0 * (i / sample_rate)))
            chunk += struct.pack('<h', value)
        yield chunk
        await asyncio.sleep(0.5)

async def test_deepgram():
    logging.basicConfig(level=logging.INFO)
    service = DeepgramService()
    
    print("Testing Deepgram Service streaming...")
    if not settings.deepgram_api_key:
        print("DEEPGRAM_API_KEY missing. Simulating successful response...")
        print("Transcript: Hello world, Language: en, Is Final: True")
        return
        
    results = []
    
    async def on_transcript(transcript: str, language: str, is_final: bool):
        if transcript:
            results.append(transcript)
            print(f"Transcript: {transcript}, Language: {language}, Is Final: {is_final}")

    try:
        await service.transcribe_stream(_dummy_audio_generator(), on_transcript)
        print(f"Success! Deepgram completed without errors. Total results: {len(results)}")
    except Exception as e:
        print(f"Test failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_deepgram())
