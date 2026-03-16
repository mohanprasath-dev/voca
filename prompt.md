# Voca — Product Specification & Architecture

> This file is the single source of truth for the Voca product.
> Every AI agent working on this codebase must read this file before writing a single line of code.
> Do not deviate from the decisions made here without explicit instruction.

## Build Status
- [x] Milestone 1 — Foundation ✅
- [x] Milestone 2 — Voice Pipeline Core ✅ (services built, Murf verified 200/80572 bytes)
- [x] Milestone 3 — Persona Engine ✅ (3 personas, PersonaService, pipeline wired, WebSocket persona switch)
- [x] Milestone 4 — Multilingual Intelligence ✅ (language detection, voice switching, mid-conversation switch, en/ta/hi verified)
- [ ] Milestone 5 — Browser Interface ← CURRENT
- [ ] Milestone 6 — Telephony Layer
- [ ] Milestone 7 — Post-Call Intelligence
- [ ] Milestone 8 — Production Readiness
- [ ] Milestone 9 — Demo Hardening
- [ ] Milestone 10 — Presentation

## Confirmed Decisions (Do Not Revisit)
- Python 3.14 — confirmed working, all packages installed
- Project path: `D:\Projects\voca\` — no spaces in path
- Virtual environment: `D:\Projects\voca\.venv\`
- Backend runs on: `http://localhost:8000`
- Frontend runs on: `http://localhost:3000`
- `/health` endpoint verified returning `{"status":"ok","version":"1.0.0"}`
- 3 personas loaded and verified on startup: aura, nova, apex
- Murf Falcon TTS — confirmed working (HTTP 200, 80,572 bytes returned)
- Deepgram SDK — installed, `deepgram-sdk` package, Nova-2 model
- **Gemini SDK — use `google-genai` (new SDK), NOT `google-generativeai` (deprecated)**
  - Import: `from google import genai`
  - Client: `genai.Client(api_key=...)`
  - Model: `gemini-2.5-flash`
- All packages installed in venv: fastapi, uvicorn, websockets, httpx, python-dotenv,
  pydantic-settings, deepgram-sdk, google-genai, twilio, aiohttp
- Gemini response format: always starts with `[LANG:xx]` tag, stripped before TTS
- `/personas` endpoint verified returning 3 personas, no system_prompt leakage
- WebSocket at `/ws/browser/{persona_id}` — verified working with persona_loaded, language_changed, transcript, response, escalation events
- Multilingual: language_voice_map in all 3 personas, pipeline tracks current_language, voice switches per language

---

## What is Voca?

Voca is the voice layer for any phone number or web deployment on earth.

It is not a chatbot. It is not an IVR. It is not a phone tree.

Voca is a real-time conversational voice agent that answers every call, in any language, at any hour — with a natural, human-like voice. It adapts its entire personality, knowledge base, tone, and language to whoever deploys it. A hospital gets a calm clinical front desk. A school gets a warm admin assistant. A startup gets a sharp support agent. One platform. Any deployment. Every conversation handled.

**The one-liner:**
> "Twilio gave every app a phone number. Voca gives every phone number a brain."

---

## The Problem

Every day, billions of phone calls go unanswered. Patients call hospitals at 2AM and reach a busy tone. Parents call schools during exam week and wait on hold. Job applicants call recruiters and never hear back. Citizens call government helplines and disconnect after 30 minutes. The problem is not that people don't care. The problem is that humans cannot be available 24/7, and phones don't care.

---

## Target Users

- Hospitals, clinics, diagnostic labs
- Universities, schools, coaching institutes
- Startups, SaaS companies, e-commerce brands
- Government helplines and NGOs
- Any entity that receives calls and cannot always answer them

---

## Core Capabilities

1. **Answers every call or browser session 24/7** — no hold music, no missed calls
2. **Real-time voice conversation** — natural, not robotic, under 800ms end-to-end
3. **Persona engine** — full personality, knowledge, and tone adapts per deployment
4. **Multilingual mid-conversation switching** — detects language, responds in kind, follows switches
5. **Smart escalation** — detects its limits, hands off gracefully with full spoken briefing
6. **Post-call intelligence** — every session logged, summarised, confirmed via WhatsApp
7. **Two interfaces** — browser (WebSocket) and telephony (Twilio) from the same backend brain

---

## Tech Stack

### Backend
- **Runtime:** Python 3.14
- **Framework:** FastAPI (async)
- **Voice Output:** Murf Falcon TTS API (streaming)
- **Voice Input:** Deepgram STT (streaming WebSocket, Nova-2 model)
- **AI Brain:** Google Gemini (`gemini-2.5-flash`) via `google-genai` SDK
- **Telephony:** Twilio Media Streams (WebSocket)
- **Notifications:** Twilio WhatsApp API
- **Deployment:** Vercel Serverless (Python runtime)
- **Session Storage:** In-memory for prototype, Redis-ready for production

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Audio:** Web Audio API (native browser)
- **WebSocket:** Native browser WebSocket API
- **Deployment:** Vercel

---

## Project Structure

```
voca/
├── backend/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── browser.py        # WebSocket endpoint ✅
│   │   │   ├── telephony.py      # Twilio webhook + Media Streams endpoint
│   │   │   └── dashboard.py      # /personas endpoints ✅
│   │   └── middleware/
│   │       ├── cors.py
│   │       └── logging.py
│   ├── services/
│   │   ├── murf.py               # Murf Falcon TTS service ✅
│   │   ├── deepgram.py           # Deepgram STT service ✅
│   │   ├── gemini.py             # Gemini brain ✅ (google-genai, language detection)
│   │   ├── pipeline.py           # Orchestrator ✅ (language state, voice switching)
│   │   ├── persona.py            # PersonaService singleton ✅
│   │   ├── session.py            # Session logging
│   │   └── whatsapp.py           # Twilio WhatsApp
│   ├── personas/
│   │   ├── aura.json             ✅ (with language_voice_map)
│   │   ├── nova.json             ✅ (with language_voice_map)
│   │   └── apex.json             ✅ (with language_voice_map)
│   ├── models/
│   │   ├── persona.py            ✅ (VoiceConfig with language_voice_map)
│   │   └── session.py
│   ├── main.py                   ✅
│   ├── config.py                 ✅
│   └── .env
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx               # Main Voca interface ← BUILD THIS
    │   └── dashboard/
    │       └── page.tsx           # Session dashboard
    ├── components/
    │   ├── VoiceOrb.tsx          # Central animated orb ← BUILD THIS
    │   ├── PersonaSwitcher.tsx   # One-click persona selector ← BUILD THIS
    │   ├── Transcript.tsx        # Live conversation transcript ← BUILD THIS
    │   ├── LanguageBadge.tsx     # Detected language indicator ← BUILD THIS
    │   ├── SummaryPanel.tsx      # Post-conversation summary ← BUILD THIS
    │   └── StatusBar.tsx         # Connection + latency indicator ← BUILD THIS
    ├── hooks/
    │   ├── useVoice.ts           # Mic capture + WebSocket audio streaming ← BUILD THIS
    │   └── usePersona.ts         # Persona state management ← BUILD THIS
    ├── lib/
    │   └── websocket.ts          # WebSocket client wrapper ← BUILD THIS
    └── styles/
        └── globals.css
```

---

## WebSocket Message Protocol (Confirmed)

The backend sends these JSON messages over `/ws/browser/{persona_id}`:

```
{"type": "persona_loaded", "persona_id": "...", "display_name": "...", "ui_config": {...}}
{"type": "transcript", "text": "...", "language": "en"}
{"type": "language_changed", "from": "en", "to": "ta"}
{"type": "response", "text": "...", "language": "ta"}
{"type": "escalation", "summary": "..."}
{"type": "error", "message": "..."}
```

Binary frames = Murf TTS audio chunks (WAV format, 24000Hz sample rate)

The frontend sends these messages:
```
{"type": "end_of_speech"}           — signals end of user audio
{"type": "switch_persona", "persona_id": "nova"}  — switches persona
```

Binary frames from browser = raw PCM/WAV audio chunks from mic

---

## API Architecture

### Browser WebSocket Flow
```
Browser mic → WebSocket → FastAPI /ws/browser
→ Deepgram STT (streaming) → transcript
→ Gemini (with persona system prompt + conversation history)
→ Murf Falcon TTS (streaming audio)
→ WebSocket → Browser speakers
```

---

## Multilingual Architecture

- **Detection:** Gemini returns `[LANG:xx]` on every response
- **Voice switching:** pipeline resolves voice from `language_voice_map` per turn
- **Context:** language switch never resets history
- **Supported:** English (`en`), Tamil (`ta`), Hindi (`hi`) — all verified

### Murf Voice ID Mapping
```
en → en-IN-rohan (Aura), en-IN-priya (Nova), en-IN-arjun (Apex)
ta → ta-IN-rohan (all personas)
hi → hi-IN-rohan (all personas)
```

---

## Persona Schema

```json
{
  "id": "aura",
  "name": "Aura",
  "display_name": "Aura — Hospital Front Desk",
  "organization": "City General Hospital",
  "system_prompt": "...",
  "knowledge_base": {
    "faqs": [],
    "timings": {},
    "escalation_keywords": [],
    "emergency_keywords": []
  },
  "voice_config": {
    "murf_voice_id": "en-IN-rohan",
    "murf_style": "Conversational",
    "language": "en-IN",
    "language_voice_map": {
      "en": "en-IN-rohan",
      "ta": "ta-IN-rohan",
      "hi": "hi-IN-rohan"
    }
  },
  "ui_config": {
    "accent_color": "#00C2B8",
    "orb_color": "#00C2B8",
    "label": "Hospital"
  },
  "escalation_message": "...",
  "emergency_message": "..."
}
```

---

## The Three Personas

### Aura — Hospital Front Desk
- **Tone:** Calm, clinical, empathetic, unhurried
- **Accent color:** `#00C2B8` (teal)
- **Murf voice:** `en-IN-rohan`

### Nova — School / University Admin
- **Tone:** Warm, structured, patient, encouraging
- **Accent color:** `#F59E0B` (amber)
- **Murf voice:** `en-IN-priya`

### Apex — Startup Customer Support
- **Tone:** Sharp, fast, solution-oriented, friendly but efficient
- **Accent color:** `#6366F1` (indigo)
- **Murf voice:** `en-IN-arjun`

---

## UI Design Direction

**Aesthetic:** Dark + expressive. Not a generic dashboard. This is a product people will remember.

**Visual identity:**
- Background: Deep near-black (`#080A0F`) with subtle noise texture overlay
- Typography: `Syne` or `Cabinet Grotesk` for headings. `DM Mono` for transcripts. `Satoshi` for UI text
- Central element: Large animated voice orb — pulses when idle, breathes when listening, emits ripple waves when speaking
- Orb color shifts per persona: teal (Aura), amber (Nova), indigo (Apex)
- Persona switcher: Horizontal pill selector, smooth crossfade — orb color, label, and background accent all change
- Transcript: Below orb, left-aligned, monospaced, streams word by word
- Language badge: Top right, subtle pill showing detected language
- Latency indicator: Bottom right, small, shows ms

**Motion principles:**
- Orb uses spring physics — never linear
- Page load: staggered reveal, orb scales up from 0 with bloom
- Persona switch: 400ms crossfade, orb color via CSS variable interpolation
- Transcript: words stream in with 20ms stagger
- Speaking state: 3 concentric ripple rings, opacity fading outward

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

1. **Never hardcode API keys.** Always load from environment via `config.py`
2. **All backend routes are async.** No blocking calls anywhere
3. **Streaming first.** Murf TTS and Deepgram STT must both stream
4. **Persona is injected at session start** — not on every message
5. **Conversation history maintained per session**
6. **Error states must be voiced** — Voca never goes silent
7. **TypeScript strict mode** on the frontend — no `any` types
8. **Every component is named and purposeful**
9. **Mobile responsive from the start**
10. **Clean git history** — one commit per milestone checkpoint
11. **Use `google-genai` SDK only**
12. **Language switch never resets history**

---

## What This Is NOT

- Not a chatbot with a voice skin
- Not a phone tree
- Not an IVR system
- Not a demo — a real deployable product
- Not a single-use-case tool — horizontal infrastructure

---

## Hackathon Context

National-level hackathon using Murf Falcon TTS API. Judged on innovation, practicality, scalability, demo quality.

Demo sequence (3 minutes):
1. Open browser. Switch persona to Aura (Hospital). Speak in Tamil. Voca responds in Tamil. Switch to Apex live. English conversation. Judges see persona change instantly.
2. Pull out phone. Call Twilio number on screen. Put on speaker. Murf Falcon voice answers live. Books something. WhatsApp confirmation arrives on screen.
3. Close with the one-liner.