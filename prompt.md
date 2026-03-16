# Voca — Product Specification & Architecture

> This file is the single source of truth for the Voca product.
> Every AI agent working on this codebase must read this file before writing a single line of code.
> Do not deviate from the decisions made here without explicit instruction.

## Build Status
- [x] Milestone 1 — Foundation ✅
- [x] Milestone 2 — Voice Pipeline Core ✅
- [x] Milestone 3 — Persona Engine ✅
- [x] Milestone 4 — Multilingual Intelligence ✅
- [x] Milestone 5 — Browser Interface ✅ (full UI working, persona switch, language badge, orb animations)
- [x] Milestone 6 — Telephony Layer ✅ (code complete, TwiML webhook working, phone demo deferred — browser demo is primary)
- [ ] Milestone 7 — Post-Call Intelligence ← CURRENT
- [ ] Milestone 8 — Production Readiness
- [ ] Milestone 9 — Demo Hardening
- [ ] Milestone 10 — Presentation

## Confirmed Decisions (Do Not Revisit)
- Python 3.14, project path: `D:\Projects\voca\`
- Virtual environment: `D:\Projects\voca\.venv\`
- Backend: `http://localhost:8000`, Frontend: `http://localhost:3000`
- Gemini SDK: `google-genai`, model: `gemini-2.5-flash`
- All packages installed in venv: fastapi, uvicorn, websockets, httpx, python-dotenv, pydantic-settings, deepgram-sdk, google-genai, twilio, aiohttp, audioop-lts
- Murf Falcon TTS — confirmed working
- WebSocket at `/ws/browser/{persona_id}` — fully working
- Multilingual: en/ta/hi verified
- Browser UI: fully working — persona switch, orb animations, transcript, language badge, status bar
- Telephony: code complete, webhook verified, phone demo deferred

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
- Twilio Media Streams for telephony
- Twilio WhatsApp API for notifications

### Frontend
- Next.js 14, TypeScript, Tailwind CSS, Framer Motion ✅ complete

---

## Project Structure

```
voca/
├── backend/
│   ├── api/routes/
│   │   ├── browser.py        ✅
│   │   ├── telephony.py      ✅
│   │   └── dashboard.py      ✅ /personas — needs session endpoints added
│   ├── services/
│   │   ├── murf.py           ✅
│   │   ├── deepgram.py       ✅
│   │   ├── gemini.py         ✅
│   │   ├── pipeline.py       ✅
│   │   ├── persona.py        ✅
│   │   ├── session.py        ← BUILD THIS
│   │   └── whatsapp.py       ← BUILD THIS (stub only)
│   ├── personas/             ✅ aura, nova, apex
│   ├── models/
│   │   ├── persona.py        ✅
│   │   └── session.py        ← BUILD THIS
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
{"type": "session_summary", "summary": {...}}   ← NEW in Milestone 7
```

---

## Session Data Model

Each conversation session must store:
```json
{
  "session_id": "uuid",
  "persona_id": "aura",
  "persona_name": "Aura",
  "started_at": "ISO timestamp",
  "ended_at": "ISO timestamp",
  "duration_seconds": 120,
  "transcript": [
    {"role": "user", "text": "...", "language": "en", "timestamp": "ISO"},
    {"role": "voca", "text": "...", "language": "en", "timestamp": "ISO"}
  ],
  "detected_languages": ["en", "ta"],
  "escalated": false,
  "escalation_reason": null,
  "summary": "Caller asked about appointment booking. Resolved successfully.",
  "resolution_status": "resolved",
  "turn_count": 4
}
```

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
PUBLIC_URL=
```

---

## Non-Negotiable Engineering Rules

1. Never hardcode API keys
2. All backend routes are async
3. Streaming first
4. Persona injected at session start
5. Conversation history maintained per session
6. Error states must be voiced
7. TypeScript strict mode on frontend
8. Use `google-genai` SDK only
9. Language switch never resets history
10. Sessions stored in-memory for prototype — dict keyed by session_id

---

## Hackathon Demo Sequence (3 minutes)

1. Open browser → Aura persona → speak Tamil → Voca responds Tamil → switch to Apex → English conversation
2. After conversation ends → summary panel appears showing what was discussed
3. Close with: "Twilio gave every app a phone number. Voca gives every phone number a brain."