# Voca — AI Agent Working Instructions

> Read `prompt.md` fully before starting. Every architectural decision in that file is final.
> This file tells you what to build RIGHT NOW.
> Milestone 1 is complete and verified. Do not touch anything from Milestone 1.

---

## Your Role

You are a senior full-stack engineer building Voca — a world-class real-time voice AI platform. You write clean, production-grade, streaming-first async Python. You test each service in isolation before wiring it into the pipeline. You never take shortcuts that create technical debt.

---

## Environment (Confirmed Working)

- Python 3.14
- Virtual env: `D:\Projects\voca\.venv\` — always activate before running
- Backend: `D:\Projects\voca\backend\`
- Backend URL: `http://localhost:8000`
- All packages installed: fastapi, uvicorn, websockets, httpx, python-dotenv, deepgram-sdk, google-generativeai, twilio, aiohttp

---

## How to Work

1. **Read `prompt.md` fully before starting**
2. **Build one checkpoint at a time** — do not jump ahead
3. **Test each service standalone** before wiring into the pipeline
4. **All Python must be async** — no blocking calls anywhere
5. **Streaming is non-negotiable** — Murf and Deepgram must stream, never wait for full response
6. **If a service call fails, Voca must say something** — never go silent on error
7. **After each checkpoint, confirm it works before moving to the next**

---

## Current Session Target

### MILESTONE 2 — VOICE PIPELINE CORE

Build the three core services (Murf, Deepgram, Gemini) in isolation, then wire them into a pipeline orchestrator. By the end of this milestone, the full voice loop must work: speak → transcribe → think → speak back.

---

### Checkpoint 2.1 — Murf Falcon TTS Service

File: `backend/services/murf.py`

Build a `MurfService` class that:

- Connects to Murf Falcon TTS API via HTTP streaming
- Murf Falcon streaming endpoint: `https://api.murf.ai/v1/speech/stream`
- Accepts: `text` (str), `voice_id` (str), `style` (str), `language` (str)
- Returns: async generator that yields audio chunks (bytes) as they stream
- Uses `httpx.AsyncClient` for streaming — do not use requests
- Sets correct headers: `api-key: {MURF_API_KEY}`, `Content-Type: application/json`
- Request body must include: `voiceId`, `text`, `style`, `format: "WAV"`, `sampleRate: 24000`
- Handles HTTP errors gracefully — raises a `MurfServiceError` with a clear message
- Includes a standalone test function `test_murf()` at the bottom that generates a 5-word phrase and prints the byte count received — gated behind `if __name__ == "__main__"`

**Verification:** Run `python services/murf.py` from `backend/`. It must print a byte count greater than 0 with no errors.

---

### Checkpoint 2.2 — Deepgram STT Service

File: `backend/services/deepgram.py`

Build a `DeepgramService` class that:

- Connects to Deepgram streaming STT via WebSocket
- Uses `deepgram-sdk` — import `DeepgramClient, LiveTranscriptionEvents, LiveOptions`
- Model: `nova-2` (better Indian accent support)
- Language: `multi` — enables automatic language detection
- Returns transcripts via an async callback pattern
- Method signature: `async def transcribe_stream(self, audio_generator, on_transcript: callable)`
- The `on_transcript` callback receives: `(transcript: str, language: str, is_final: bool)`
- Handles connection errors gracefully — logs and raises `DeepgramServiceError`
- Includes a standalone test function `test_deepgram()` that reads a short WAV file and prints the transcript — gated behind `if __name__ == "__main__"`

**Verification:** Run `python services/deepgram.py` from `backend/`. It must print a non-empty transcript.

---

### Checkpoint 2.3 — Gemini Brain Service

File: `backend/services/gemini.py`

Build a `GeminiService` class that:

- Uses `google-generativeai` SDK
- Model: `gemini-2.0-flash`
- Method: `async def respond(self, message: str, system_prompt: str, history: list[dict]) -> tuple[str, str]`
- `history` is a list of `{"role": "user"|"model", "parts": ["..."]}` dicts
- Always prepends the persona system prompt as a system instruction — not as a user message
- Maintains full conversation context — never truncates history
- Response must include language detection: prompt Gemini to always start its response with `[LANG:xx]` where `xx` is the ISO language code (e.g. `[LANG:ta]` for Tamil, `[LANG:en]` for English)
- Strip the `[LANG:xx]` tag from spoken response but extract and return it separately
- Returns: `tuple[str, str]` — `(response_text, detected_language_code)`
- Handles API errors gracefully — raises `GeminiServiceError`
- Includes standalone test gated behind `if __name__ == "__main__"`

**Verification:** Run `python services/gemini.py` from `backend/`. Must print a coherent response and a language code.

---

### Checkpoint 2.4 — Pipeline Orchestrator

File: `backend/services/pipeline.py`

Build a `VocaPipeline` class that:

- Takes a `persona_id` at initialisation — loads persona config via `PersonaService`
- Maintains conversation history for the session
- Maintains detected language state (updates per turn)
- Core method: `async def process_audio(self, audio_bytes: bytes) -> AsyncGenerator[bytes, None]`
  - Sends audio to Deepgram STT → gets transcript + language
  - Updates language state if changed
  - Sends transcript + persona system prompt + history to Gemini → gets response text
  - Appends both user message and assistant response to history
  - Sends response text to Murf TTS with persona voice config → streams audio chunks back
  - Yields audio chunks as they arrive from Murf — do not buffer
- Error method: `async def error_audio(self, message: str) -> AsyncGenerator[bytes, None]`
  - Converts error message to Murf TTS audio and streams it back
  - Used when any service fails — Voca must always say something
- Escalation detection: after Gemini responds, check if response contains `escalation_needed=true`
  - If yes, set `self.escalation_needed = True` and `self.escalation_summary`

**Critical rules:**
- Never buffer the full Murf audio before yielding — stream chunks immediately
- Never call Murf until Gemini has fully responded
- Always update history before yielding audio

---

### Checkpoint 2.5 — WebSocket Browser Route

File: `backend/api/routes/browser.py`

Build a WebSocket endpoint at `/ws/browser/{persona_id}` that:

- Accepts WebSocket connection
- Creates a `VocaPipeline` instance for the session with the given `persona_id`
- Receives binary audio frames from the browser (raw PCM/WAV chunks)
- Accumulates audio until end-of-speech signal: JSON `{"type": "end_of_speech"}` from client
- When end_of_speech received: passes accumulated audio to `pipeline.process_audio()`
- Streams audio chunks back to browser as binary WebSocket frames
- Sends JSON messages after each stage:
  - `{"type": "transcript", "text": "...", "language": "..."}` after transcription
  - `{"type": "response", "text": "..."}` after Gemini responds
  - `{"type": "escalation", "summary": "..."}` if escalation triggered
  - `{"type": "error", "message": "..."}` on any failure
- Handles disconnection cleanly — no dangling async tasks

---

### Checkpoint 2.6 — End-to-End Loop Verification

Test the full pipeline:

1. Connect to `ws://localhost:8000/ws/browser/apex` using wscat or a Python test script
2. Send a WAV audio file as binary frames
3. Send `{"type": "end_of_speech"}`
4. Verify receipt of: transcript message → response message → binary audio chunks

Install wscat if needed:
```bash
npm install -g wscat
```

Create `backend/test_pipeline.py` — a simple Python WebSocket test client that:
- Connects to the WebSocket
- Sends a test WAV file in chunks
- Sends end_of_speech
- Prints all received messages
- Saves received audio to `test_output.wav`

**Definition of done:** You send audio. Voca transcribes, thinks, and sends back audio. Full loop. No errors.

---

## Constraints For This Session

- Do NOT build any frontend yet
- Do NOT build Twilio telephony yet
- Do NOT build session logging yet
- Do NOT build WhatsApp notifications yet
- Focus entirely on: Murf → Deepgram → Gemini → Pipeline → WebSocket → verified loop

---

## Code Quality Standards

- **Every service class has a docstring** explaining what it does and what it depends on
- **Every method has type hints** — inputs and return types explicit
- **Errors are specific** — `MurfServiceError`, `DeepgramServiceError`, `GeminiServiceError`
- **Async everywhere** — if you use `requests` instead of `httpx`, stop and fix it
- **No print statements** — use `logging` with logger named `voca.{service_name}`
- **Streaming is the default** — if accumulating full response before returning, stop and fix it

---

## If You Hit a Problem

1. State the problem in one sentence
2. Give two solutions with tradeoffs
3. Recommend one
4. Wait for confirmation

Do not silently pick a workaround.

---

## After This Milestone

Once Milestone 2 is verified end-to-end, the next session targets **Milestone 3 — Persona Engine**.
