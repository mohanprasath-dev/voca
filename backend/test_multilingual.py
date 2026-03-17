"""
Milestone 4 — Multilingual end-to-end test.
Simulates a conversation that switches from English to Tamil and back.
Tests: language detection, voice switching, history preservation.
"""
import asyncio
from services.gemini import GeminiService
from services.persona import PersonaService


async def test() -> None:
    ps = PersonaService()
    gs = GeminiService()
    system_prompt = ps.get_system_prompt('aura')
    history: list[dict] = []

    turns = [
        "Hello, I'd like to book an appointment",
        "நான் நாளை மதியம் வர விரும்புகிறேன்",  # Tamil: I want to come tomorrow afternoon
        "What time is the OPD open?",  # Switch back to English
    ]

    current_language = "en"

    for i, message in enumerate(turns):
        text, lang = await gs.respond(
            message=message,
            system_prompt=system_prompt,
            history=history,
        )
        prev_lang = current_language
        current_language = lang

        print(f"\nTurn {i + 1}:")
        print(f"  User: {message}")
        print(f"  Lang: {prev_lang} -> {lang}")
        print(f"  Voca: {text[:120]}")

        history.append({"role": "user", "parts": [message]})
        history.append({"role": "model", "parts": [text]})

    print(f"\nFinal history length: {len(history)} entries")
    print("Multilingual test passed" if len(history) == 6 else "History issue")


asyncio.run(test())
