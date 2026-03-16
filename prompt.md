# Voca — Product Specification & Architecture

> This file is the single source of truth for the Voca product.
> Every AI agent working on this codebase must read this file before writing a single line of code.
> Do not deviate from the decisions made here without explicit instruction.

## Build Status
- [x] Milestone 1 — Foundation ✅
- [x] Milestone 2 — Voice Pipeline Core ✅
- [x] Milestone 3 — Persona Engine ✅
- [x] Milestone 4 — Multilingual Intelligence ✅
- [x] Milestone 5 — Browser Interface ✅ (full UI working, persona switch, language badge, orb animations, WebSocket connected)
- [ ] Milestone 6 — Telephony Layer ← CURRENT
- [ ] Milestone 7 — Post-Call Intelligence
- [ ] Milestone 8 — Production Readiness
- [ ] Milestone 9 — Demo Hardening
- [ ] Milestone 10 — Presentation

## Confirmed Decisions (Do Not Revisit)
- Python 3.14, project path: `D:\Projects\voca\`
- Virtual environment: `D:\Projects\voca\.venv\`
- Backend: `http://localhost:8000`, Frontend: `http://localhost:3000`
- Gemini SDK: `google-genai`, model: `gemini-2.5-flash`
- All packages installed in venv: fastapi, uvicorn, websockets, httpx, python-dotenv, pydantic-settings, deepgram-sdk, google-genai, twilio, aiohttp
- Murf Falcon TTS — confirmed working
- WebSocket at `/ws/browser/{persona_id}` — fully working with all message types
- Multilingual: en/ta/hi verified, language_voice_map in all personas
- Browser UI: fully working, persona switch, orb animations, transcript, language badge, status bar

---

## What is Voca?

Voca is the voice layer for any phone number or web deployment on earth. Real-time conversational voice agent, any language, any hour, any persona.

**The one-liner:**
> "Twilio gave every app a phone number. Voca gives every phone number a brain."

---

## Core Capabilities

1. Answers every call or browser session 24/7
2. Real-time voice conversation — under 800ms end-to-end
3. Persona engine — personality, knowledge, tone adapts per deployment
4. Multilingual mid-conversation switching
5. Smart escalation with spoken briefing
6. Post-call intelligence — logged, summarised, WhatsApp confirmed
7. Two interfaces — browser (WebSocket) and telephony (Twilio)

---

## Tech Stack

### Backend
- Python 3.14, FastAPI (async)
- Murf Falcon TTS (streaming)
- Deepgram STT (streaming WebSocket, Nova-2)
- Gemini `gemini-2.5-flash` via `google-genai`
- Twilio Media Streams (WebSocket) for telephony
- Twilio WhatsApp API for notifications

### Frontend
- Next.js 14, TypeScript, Tailwind CSS, Framer Motion ✅ complete

---

## Project Structure

```
voca/
├── backend/
│   ├── api/routes/
│   │   ├── browser.py        ✅ WebSocket /ws/browser/{persona_id}
│   │   ├── telephony.py      ← BUILD THIS (Milestone 6)
│   │   └── dashboard.py      ✅ /personas endpoints
│   ├── services/
│   │   ├── murf.py           ✅
│   │   ├── deepgram.py       ✅
│   │   ├── gemini.py         ✅ google-genai, gemini-2.5-flash
│   │   ├── pipeline.py       ✅ language state, voice switching
│   │   ├── persona.py        ✅ singleton, 3 personas
│   │   ├── session.py        ← BUILD THIS (Milestone 7)
│   │   └── whatsapp.py       ← BUILD THIS (Milestone 7)
│   ├── personas/
│   │   ├── aura.json         ✅ with language_voice_map
│   │   ├── nova.json         ✅
│   │   └── apex.json         ✅
│   ├── models/persona.py     ✅
│   └── main.py               ✅
└── frontend/                 ✅ complete
```

---

## WebSocket Message Protocol (Confirmed Working)

Backend → Frontend:
```
{"type": "persona_loaded", "persona_id": "...", "display_name": "...", "ui_config": {...}}
{"type": "transcript", "text": "...", "language": "en"}
{"type": "language_changed", "from": "en", "to": "ta"}
{"type": "response", "text": "...", "language": "ta"}
{"type": "escalation", "summary": "..."}
{"type": "error", "message": "..."}
```
Binary frames = Murf TTS audio (WAV, 24000Hz)

Frontend → Backend:
```
{"type": "end_of_speech"}
{"type": "switch_persona", "persona_id": "nova"}
```
Binary frames = raw PCM audio from mic

---

## Telephony Architecture (Milestone 6)

### How Twilio Media Streams works
```
Phone call → Twilio → POST /telephony/incoming
  → FastAPI returns TwiML with <Stream> pointing to wss://your-domain/ws/telephony/{persona_id}
  → Twilio opens WebSocket to /ws/telephony/{persona_id}
  → Twilio streams mulaw 8kHz audio as base64-encoded JSON messages
  → FastAPI decodes mulaw → PCM → Deepgram STT
  → Gemini response → Murf TTS → re-encode to mulaw
  → Stream mulaw audio back to Twilio via WebSocket
  → Twilio plays audio to caller
```

### Twilio WebSocket message format (inbound from Twilio)
```json
{"event": "start", "start": {"streamSid": "...", "callSid": "...", "customParameters": {...}}}
{"event": "media", "media": {"payload": "<base64 mulaw audio>"}}
{"event": "stop"}
```

### Twilio WebSocket message format (outbound to Twilio)
```json
{"event": "media", "streamSid": "...", "media": {"payload": "<base64 mulaw audio>"}}
{"event": "mark", "streamSid": "...", "mark": {"name": "response_complete"}}
```

### Audio format details
- Twilio sends: mulaw (G.711 µ-law), 8000Hz, 8-bit, mono
- Murf returns: WAV, 24000Hz, 16-bit, mono
- Conversion needed: mulaw 8kHz ↔ PCM 16kHz (Deepgram needs 16kHz minimum)
- Use `audioop` (Python stdlib) for mulaw↔PCM conversion
- Use `audioop.ratecv` for sample rate conversion

---

## Persona Schema

```json
{
  "voice_config": {
    "murf_voice_id": "en-IN-rohan",
    "murf_style": "Conversational",
    "language": "en-IN",
    "language_voice_map": {"en": "en-IN-rohan", "ta": "ta-IN-rohan", "hi": "hi-IN-rohan"}
  },
  "ui_config": {"accent_color": "#00C2B8", "orb_color": "#00C2B8", "label": "Hospital"}
}
```

---

## The Three Personas

- **Aura** — Hospital, teal `#00C2B8`, `en-IN-rohan`
- **Nova** — University, amber `#F59E0B`, `en-IN-priya`
- **Apex** — Startup, indigo `#6366F1`, `en-IN-arjun`

---

## Environment Variables

```env
MURF_API_KEY=
DEEPGRAM_API_KEY=
GEMINI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

## Non-Negotiable Engineering Rules

1. Never hardcode API keys
2. All backend routes are async
3. Streaming first — never buffer full response
4. Persona injected at session start
5. Conversation history maintained per session
6. Error states must be voiced
7. TypeScript strict mode on frontend
8. Use `google-genai` SDK only
9. Language switch never resets history
10. mulaw↔PCM conversion must happen in telephony layer — never send raw mulaw to Deepgram

---

## Hackathon Demo Sequence (3 minutes)

1. Open browser → Aura persona → speak Tamil → Voca responds Tamil → switch to Apex → English conversation
2. Call Twilio number on speaker → Murf voice answers live → books something → WhatsApp confirmation arrives
3. Close with: "Twilio gave every app a phone number. Voca gives every phone number a brain."