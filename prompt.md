# Voca — Product Specification & Architecture

> This file is the single source of truth for the Voca product.
> Every AI agent working on this codebase must read this file before writing a single line of code.
> Do not deviate from the decisions made here without explicit instruction.

## Build Status
- [x] Milestone 1 — Foundation ✅
- [x] Milestone 2 — Voice Pipeline Core ✅
- [x] Milestone 3 — Persona Engine ✅
- [x] Milestone 4 — Multilingual Intelligence ✅
- [x] Milestone 5 — Browser Interface ✅
- [x] Milestone 6 — Telephony Layer ✅ (code complete, browser demo is primary)
- [x] Milestone 7 — Post-Call Intelligence ✅ (session logging, AI summary, SummaryPanel UI)
- [ ] Milestone 9 — Demo Hardening ← CURRENT
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
- Browser UI: fully working — persona switch, orb animations, transcript, language badge, status bar, summary panel
- Session logging + AI summary — working end-to-end
- WebSocket reconnect loop — fixed (removed orbState dependency from connection effect)

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
6. Post-call intelligence — logged, summarised, displayed in UI
7. Two interfaces — browser (WebSocket) and telephony (Twilio)

---

## Tech Stack

### Backend
- Python 3.14, FastAPI (async)
- Murf Falcon TTS (streaming)
- Deepgram STT (streaming WebSocket, Nova-2)
- Gemini `gemini-2.5-flash` via `google-genai`
- Twilio Media Streams for telephony
- SessionService (in-memory, AI summary via Gemini)

### Frontend
- Next.js 14, TypeScript, Tailwind CSS, Framer Motion — complete
- VoiceOrb, PersonaSwitcher, Transcript, LanguageBadge, StatusBar, SummaryPanel — all built

---

## WebSocket Message Protocol

Backend → Frontend:
```
{"type": "persona_loaded", "persona_id": "...", "display_name": "...", "ui_config": {...}}
{"type": "transcript", "text": "...", "language": "en"}
{"type": "language_changed", "from": "en", "to": "ta"}
{"type": "response", "text": "...", "language": "ta"}
{"type": "escalation", "summary": "..."}
{"type": "session_summary", "session_id": "...", "summary": "...", ...}
{"type": "error", "message": "..."}
```
Binary frames = Murf TTS audio (WAV, 24000Hz)

Frontend → Backend:
```
{"type": "end_of_speech"}
{"type": "switch_persona", "persona_id": "nova"}
{"type": "end_session"}
```
Binary frames = raw PCM audio from mic

---

## The Three Personas

- **Aura** — Hospital, teal `#00C2B8`, `en-IN-rohan`
- **Nova** — University, amber `#F59E0B`, `en-IN-priya`
- **Apex** — Startup, indigo `#6366F1`, `en-IN-arjun`

---

## Demo Sequence (3 minutes — this is what wins)

1. Open browser → select Aura (Hospital) → speak Tamil → Voca responds in Tamil → switch to Apex live → English conversation → summary panel appears after session ends
2. Close with: "Twilio gave every app a phone number. Voca gives every phone number a brain."

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
10. WebSocket connection effect must NOT depend on orbState or any UI state