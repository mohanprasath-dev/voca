# Voca — AI Agent Working Instructions

> Read `prompt.md` fully before starting. Every architectural decision in that file is final.
> This file tells you what to build RIGHT NOW.
> Milestones 1, 2, and 3 are complete. Do not touch anything from those milestones.

---

## Your Role

You are a senior full-stack engineer building Voca — a world-class real-time voice AI platform. You write clean, production-grade async Python. You build each checkpoint fully before moving to the next. You never skip verification steps.

---

## Environment (Confirmed Working)

- Python 3.14
- Virtual env: `D:\Projects\voca\.venv\` — always activate before running
- Backend: `D:\Projects\voca\backend\`
- Backend URL: `http://localhost:8000`
- Activate command: `d:\Projects\voca\.venv\Scripts\Activate.ps1`
- Gemini SDK: `google-genai` — import as `from google import genai`, model: `gemini-2.5-flash`
- **DO NOT use `google.generativeai` — it is deprecated and will error**

---

## How to Work

1. **Read `prompt.md` fully before starting**
2. **Build one checkpoint at a time** — do not jump ahead
3. **Run the verification step after every checkpoint** before moving on
4. **All Python must be async** — no blocking calls anywhere
5. **If a verification fails, fix it before proceeding**

---

## Current Session Target

### MILESTONE 4 — MULTILINGUAL INTELLIGENCE

This is Voca's killer feature and the centrepiece of the hackathon demo. By the end of this milestone, Voca must detect the caller's language on every turn, respond in the same language, switch Murf voices to match, and handle mid-conversation language switches seamlessly — without losing conversation context.

The demo moment this enables: speak Tamil to Aura, she responds in Tamil. Switch to English mid-sentence, she follows instantly. Judges see it live.

---

### Checkpoint 4.1 — Add `language_voice_map` to Persona JSON Files

Update all three persona JSON files to add a `language_voice_map` inside `voice_config`. This maps ISO language codes to the correct Murf voice ID for that language.

Add this field to `voice_config` in all three persona files:

**aura.json** — add inside `voice_config`:
```json
"language_voice_map": {
  "en": "en-IN-rohan",
  "ta": "ta-IN-rohan",
  "hi": "hi-IN-rohan"
}
```

**nova.json** — add inside `voice_config`:
```json
"language_voice_map": {
  "en": "en-IN-priya",
  "ta": "ta-IN-rohan",
  "hi": "hi-IN-rohan"
}
```

**apex.json** — add inside `voice_config`:
```json
"language_voice_map": {
  "en": "en-IN-arjun",
  "ta": "ta-IN-rohan",
  "hi": "hi-IN-rohan"
}
```

Also update the `VoiceConfig` Pydantic model in `backend/models/persona.py` to include:
```python
language_voice_map: dict[str, str] = {}
```

**Verification:**
```bash
python -c "
from services.persona import PersonaService
ps = PersonaService()
vc = ps.get_voice_config('aura')
print(vc)
"
```
Must print the voice config dict including `language_voice_map` with 3 entries.

---

### Checkpoint 4.2 — Language State in Pipeline

File: `backend/services/pipeline.py`

Update `VocaPipeline` to track and use language state:

- Add `self.current_language: str = "en"` at init — default to English
- Add `self.language_history: list[str] = []` — track language per turn for analytics
- After Gemini responds and returns `(response_text, detected_language)`:
  - Update `self.current_language = detected_language`
  - Append to `self.language_history`
  - If language changed from previous turn, log: `Language switched: {prev} → {detected_language}`
- When calling Murf TTS, resolve the correct voice ID using:
  ```python
  voice_map = self.voice_config.get("language_voice_map", {})
  voice_id = voice_map.get(self.current_language, self.voice_config["murf_voice_id"])
  ```
  This falls back to the default voice if language not in map
- Language switch must NOT reset conversation history — context is always preserved

**Verification:**
```bash
python -c "
import asyncio
from services.pipeline import VocaPipeline

async def test():
    p = VocaPipeline('aura')
    print(f'Default language: {p.current_language}')
    print(f'Voice map: {p.voice_config.get(\"language_voice_map\")}')
    # Simulate language detection
    p.current_language = 'ta'
    voice_map = p.voice_config.get('language_voice_map', {})
    voice_id = voice_map.get(p.current_language, p.voice_config['murf_voice_id'])
    print(f'Tamil voice resolved: {voice_id}')

asyncio.run(test())
"
```
Must print `Default language: en`, the voice map, and `Tamil voice resolved: ta-IN-rohan`.

---

### Checkpoint 4.3 — Strengthen Gemini Language Instruction

File: `backend/services/gemini.py`

Update the `GeminiService.respond()` method to make language detection more robust:

The prompt sent to Gemini must explicitly instruct:
1. Detect the language of the user's message
2. Respond entirely in that same language — not just the first sentence
3. Start the response with `[LANG:xx]` where `xx` is the 2-letter ISO code
4. If the user switches language mid-conversation, follow immediately

Update the prompt assembly in `respond()` to append this instruction block after the system prompt, before the conversation history:

```
LANGUAGE RULE: Detect the language of the user's latest message.
Respond entirely in that language.
Always begin your response with [LANG:xx] where xx is the ISO 639-1 code.
Examples: [LANG:en] for English, [LANG:ta] for Tamil, [LANG:hi] for Hindi.
If the user switches language, you switch immediately in your next response.
Never mix languages in a single response.
```

**Verification:**
```bash
python -c "
import asyncio
from services.gemini import GeminiService

async def test():
    gs = GeminiService()
    # Test Tamil detection
    text, lang = await gs.respond(
        message='நான் ஒரு அப்பாயின்ட்மென்ட் எடுக்க விரும்புகிறேன்',
        system_prompt='You are a helpful assistant.',
        history=[]
    )
    print(f'Detected language: {lang}')
    print(f'Response: {text[:100]}')

asyncio.run(test())
"
```
Must print `Detected language: ta` and a Tamil response text.

---

### Checkpoint 4.4 — Language Change WebSocket Event

File: `backend/api/routes/browser.py`

After each pipeline turn, if the language changed from the previous turn, send a WebSocket event to the client:

```json
{"type": "language_changed", "from": "en", "to": "ta"}
```

This event must be sent AFTER the transcript message and BEFORE the audio chunks, so the frontend can update the language badge in real time.

Update the transcript message to always include the detected language:
```json
{"type": "transcript", "text": "...", "language": "ta"}
```

The response message must also include detected language:
```json
{"type": "response", "text": "...", "language": "ta"}
```

**Verification:** Connect with a Python WebSocket test client, send a Tamil audio clip or simulate a Tamil transcript, and confirm `language_changed` event arrives with correct `from` and `to` values.

---

### Checkpoint 4.5 — Graceful Fallback for Unsupported Languages

File: `backend/services/pipeline.py`

If Gemini detects a language not in the persona's `language_voice_map`:

- Log a warning: `Language {lang} not in voice map for persona {persona_id}, falling back to default`
- Use the persona's default `murf_voice_id` for TTS
- Keep `self.current_language` updated to the detected language — do not revert
- Voca still responds in the detected language via Gemini — only the TTS voice falls back

**Verification:**
```bash
python -c "
import asyncio
from services.pipeline import VocaPipeline

async def test():
    p = VocaPipeline('apex')
    # Simulate unsupported language
    voice_map = p.voice_config.get('language_voice_map', {})
    unsupported = 'fr'
    voice_id = voice_map.get(unsupported, p.voice_config['murf_voice_id'])
    print(f'Fallback voice for French: {voice_id}')
    assert voice_id == p.voice_config['murf_voice_id'], 'Should fall back to default'
    print('Fallback logic correct')

asyncio.run(test())
"
```
Must print the default voice ID and `Fallback logic correct`.

---

### Checkpoint 4.6 — End-to-End Multilingual Verification

This is the full integration test for Milestone 4. Run a complete simulation without real audio — use Gemini directly to simulate a multilingual conversation.

Create `backend/test_multilingual.py`:

```python
"""
Milestone 4 — Multilingual end-to-end test.
Simulates a conversation that switches from English to Tamil and back.
Tests: language detection, voice switching, history preservation.
"""
import asyncio
from services.gemini import GeminiService
from services.persona import PersonaService

async def test():
    ps = PersonaService()
    gs = GeminiService()
    system_prompt = ps.get_system_prompt('aura')
    history = []

    turns = [
        "Hello, I'd like to book an appointment",
        "நான் நாளை மதியம் வர விரும்புகிறேன்",  # Tamil: I want to come tomorrow afternoon
        "What time is the OPD open?",             # Switch back to English
    ]

    current_language = "en"

    for i, message in enumerate(turns):
        text, lang = await gs.respond(
            message=message,
            system_prompt=system_prompt,
            history=history
        )
        prev_lang = current_language
        current_language = lang

        print(f"\nTurn {i+1}:")
        print(f"  User: {message}")
        print(f"  Lang: {prev_lang} → {lang}")
        print(f"  Voca: {text[:120]}")

        history.append({"role": "user", "parts": [message]})
        history.append({"role": "model", "parts": [text]})

    print(f"\nFinal history length: {len(history)} entries")
    print("✅ Multilingual test passed" if len(history) == 6 else "❌ History issue")

asyncio.run(test())
```

Run it:
```bash
python test_multilingual.py
```

**Definition of done:**
- Turn 1: `lang` = `en`, English response
- Turn 2: `lang` = `ta`, Tamil response
- Turn 3: `lang` = `en`, English response
- History has 6 entries (3 user + 3 model)
- No errors

---

## Constraints For This Session

- Do NOT build the browser UI yet (Milestone 5)
- Do NOT build Twilio telephony yet (Milestone 6)
- Do NOT build session logging or WhatsApp yet (Milestone 7)
- Focus entirely on: voice map → pipeline language state → Gemini language instruction → WebSocket events → fallback logic → end-to-end test

---

## Code Quality Standards

- Every method has type hints
- Language detection logic is in the pipeline — not scattered across services
- No hardcoded language codes — always use the persona's `language_voice_map`
- Log every language switch at INFO level
- Use `logging` not `print` in service files

---

## If You Hit a Problem

1. State the problem in one sentence
2. Give two solutions with tradeoffs
3. Recommend one
4. Wait for confirmation

---

## After This Milestone

Once Milestone 4 is verified end-to-end, the next session targets **Milestone 5 — Browser Interface**.