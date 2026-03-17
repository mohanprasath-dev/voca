import os
import unittest
from unittest.mock import AsyncMock, patch

# Ensure service modules can import settings during tests.
os.environ.setdefault("MURF_API_KEY", "test-murf-key")
os.environ.setdefault("DEEPGRAM_API_KEY", "test-deepgram-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("LIVEKIT_API_KEY", "test-livekit-key")
os.environ.setdefault("LIVEKIT_API_SECRET", "test-livekit-secret")
os.environ.setdefault("LIVEKIT_URL", "wss://example.livekit.cloud")

from models.persona import KnowledgeBase, Persona, UIConfig, VoiceConfig
from models.session import Message, Session
from services.deepgram import DeepgramService
from services.gemini import GeminiService
from services.murf import MurfService
from services.pipeline import PipelineService


def build_persona() -> Persona:
    return Persona(
        id="apex",
        name="Apex",
        display_name="Apex - Startup Support",
        organization="Voca Labs",
        system_prompt="You are Apex. Reply briefly.",
        knowledge_base=KnowledgeBase(
            faqs=[],
            timings={},
            escalation_keywords=["refund"],
            emergency_keywords=[],
        ),
        voice_config=VoiceConfig(
            murf_voice_id="en-IN-test",
            murf_style="conversational",
            language="en-IN",
        ),
        ui_config=UIConfig(
            accent_color="#6366F1",
            orb_color="#6366F1",
            label="Startup",
        ),
        escalation_message="Connecting you to a human expert.",
        emergency_message="",
    )


class TestMurfService(unittest.IsolatedAsyncioTestCase):
    async def test_synthesize_once_returns_audio_bytes(self) -> None:
        service = MurfService()

        class FakeResponse:
            def __init__(self) -> None:
                self.content = b"audio-bytes"

            def raise_for_status(self) -> None:
                return None

        class FakeClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

            async def post(self, *args, **kwargs):
                return FakeResponse()

        with patch("services.murf.httpx.AsyncClient", return_value=FakeClient()):
            result = await service.synthesize_once(
                text="Hello world",
                voice_config={
                    "murf_voice_id": "en-IN-test",
                    "murf_style": "warm",
                    "language": "en-IN",
                },
            )

        self.assertEqual(result, b"audio-bytes")

    def test_build_payload_uses_voice_config(self) -> None:
        service = MurfService()
        payload = service._build_payload(
            text="Hi",
            voice_config={
                "murf_voice_id": "v1",
                "murf_style": "natural",
                "language": "en-IN",
            },
        )
        self.assertEqual(payload["voiceId"], "v1")
        self.assertEqual(payload["style"], "natural")
        self.assertEqual(payload["language"], "en-IN")


class TestDeepgramService(unittest.TestCase):
    def test_parse_transcript_event_returns_expected_shape(self) -> None:
        service = DeepgramService()
        payload = {
            "type": "Results",
            "is_final": True,
            "channel": {
                "alternatives": [
                    {
                        "transcript": "book an appointment",
                        "confidence": 0.93,
                        "detected_language": "en",
                    }
                ]
            },
        }

        parsed = service.parse_transcript_event(payload)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["transcript"], "book an appointment")
        self.assertTrue(parsed["is_final"])
        self.assertEqual(parsed["language"], "en")


class TestGeminiService(unittest.IsolatedAsyncioTestCase):
    async def test_generate_reply_parses_structured_json(self) -> None:
        service = GeminiService()
        persona = build_persona()
        history = [Message(role="user", content="I need refund support")]

        fake_model_payload = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": (
                                    '{"assistant_reply":"I can help with that.",'
                                    '"language":"en",'
                                    '"escalation_needed":true,'
                                    '"escalation_summary":"User requested a refund."}'
                                )
                            }
                        ]
                    }
                }
            ]
        }

        with patch.object(
            service,
            "_request_completion",
            new=AsyncMock(return_value=fake_model_payload),
        ):
            output = await service.generate_reply(persona=persona, messages=history)

        self.assertEqual(output["assistant_reply"], "I can help with that.")
        self.assertTrue(output["escalation_needed"])


class TestPipelineService(unittest.IsolatedAsyncioTestCase):
    async def test_handle_text_turn_wires_services(self) -> None:
        class FakeMurf:
            async def stream(self, text, voice_config):
                self.last_text = text
                self.last_voice_config = voice_config
                yield b"fake-audio"

        class FakeGemini:
            async def generate_reply(self, persona, messages):
                return {
                    "assistant_reply": "Your appointment is booked.",
                    "language": "en",
                    "escalation_needed": False,
                    "escalation_summary": "",
                }

        pipeline = PipelineService(
            murf_service=FakeMurf(),
            deepgram_service=DeepgramService(),
            gemini_service=FakeGemini(),
        )

        session = Session(session_id="s1", persona_id="apex")
        persona = build_persona()

        result = await pipeline.handle_text_turn(
            session=session,
            persona=persona,
            user_text="Book a demo call for Monday",
            language_hint="en",
        )

        self.assertEqual(result["assistant_text"], "Your appointment is booked.")
        audio_chunks = []
        async for chunk in result["audio_stream"]:
            audio_chunks.append(chunk)

        self.assertEqual(audio_chunks, [b"fake-audio"])
        self.assertEqual(len(session.messages), 2)


if __name__ == "__main__":
    unittest.main()
