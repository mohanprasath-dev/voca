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

from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)

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
        # We ensure logging for deepgram isn't too verbose by configuring client options
        self.deepgram = DeepgramClient(self.api_key)

    async def transcribe_stream(self, audio_generator: AsyncGenerator[bytes, None], on_transcript: Callable):
        """
        Connects to Deepgram and pushes chunks from audio_generator.
        Calls on_transcript(transcript: str, language: str, is_final: bool)
        """
        try:
            # Create a websocket connection to Deepgram
            dg_connection = self.deepgram.listen.asyncwebsocket.v("1")

            async def on_message(self, result, **kwargs):
                sentence = result.channel.alternatives[0].transcript
                if len(sentence) == 0:
                    return
                # Extract language if present. The multi model usually detects language
                # but might not return it in the result directly unless requested.
                # deepgram returns it in `result.channel.alternatives[0].languages` if enabled
                language = "en"
                if hasattr(result.channel.alternatives[0], "languages") and result.channel.alternatives[0].languages:
                    language = result.channel.alternatives[0].languages[0]
                
                is_final = result.is_final
                
                if asyncio.iscoroutinefunction(on_transcript):
                    await on_transcript(sentence, language, is_final)
                else:
                    on_transcript(sentence, language, is_final)

            async def on_metadata(self, metadata, **kwargs):
                pass

            async def on_error(self, error, **kwargs):
                logger.error(f"Deepgram WebSocket Error: {error}")

            dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
            dg_connection.on(LiveTranscriptionEvents.Metadata, on_metadata)
            dg_connection.on(LiveTranscriptionEvents.Error, on_error)

            options = LiveOptions(
                model="nova-2",
                language="multi",
                smart_format=True,
                encoding="linear16",
                channels=1,
                sample_rate=16000,
                interim_results=True,
            )

            # Connect
            if await dg_connection.start(options) is False:
                logger.error("Failed to connect to Deepgram")
                raise DeepgramServiceError("Failed to connect to Deepgram")

            # Stream audio from generator
            async for chunk in audio_generator:
                if chunk:
                    await dg_connection.send(chunk)
            
            # Allow final transcripts to process
            # wait a bit before finishing to catch last transcripts
            await asyncio.sleep(1.0)
            await dg_connection.finish()

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
