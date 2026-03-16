# Voca — Product Specification & Architecture

> This file is the single source of truth for the Voca product.
> Every AI agent working on this codebase must read this file before writing a single line of code.
> Do not deviate from the decisions made here without explicit instruction.

## Build Status
- [x] Milestone 1 — Foundation ✅
- [x] Milestone 2 — Voice Pipeline Core ✅ (services built, Murf verified 200/80572 bytes)
- [x] Milestone 3 — Persona Engine ✅ (3 personas, PersonaService, pipeline wired, WebSocket persona switch)
- [ ] Milestone 4 — Multilingual Intelligence ← CURRENT
- [ ] Milestone 5 — Browser Interface
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
  - The old `google.generativeai` package is deprecated — do not use it anywhere
- All packages installed in venv: fastapi, uvicorn, websockets, httpx, python-dotenv,
  pydantic-settings, deepgram-sdk, google-genai, twilio, aiohttp
- Gemini response format: always starts with `[LANG:xx]` tag, stripped before TTS
- `/personas` endpoint verified returning 3 personas, no system_prompt leakage
- WebSocket at `/ws/browser/{persona_id}` sends `persona_loaded` on connect, supports `switch_persona`

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
│   │   │   ├── browser.py        # WebSocket endpoint for browser clients
│   │   │   ├── telephony.py      # Twilio webhook + Media Streams endpoint
│   │   │   └── dashboard.py      # Session logs and summaries + /personas endpoints
│   │   └── middleware/
│   │       ├── cors.py
│   │       └── logging.py
│   ├── services/
│   │   ├── murf.py               # Murf Falcon TTS service
│   │   ├── deepgram.py           # Deepgram STT service
│   │   ├── gemini.py             # Gemini brain (uses google-genai SDK)
│   │   ├── pipeline.py           # Orchestrates murf + deepgram + gemini
│   │   ├── persona.py            # Loads and manages persona configs (singleton)
│   │   ├── session.py            # Session logging and summary generation
│   │   └── whatsapp.py           # Twilio WhatsApp notification service
│   ├── personas/
│   │   ├── aura.json             # Hospital front desk persona ✅
│   │   ├── nova.json             # School/university admin persona ✅
│   │   └── apex.json             # Startup customer support persona ✅
│   ├── models/
│   │   ├── persona.py            # Pydantic models for persona schema ✅
│   │   └── session.py            # Pydantic models for session schema
│   ├── main.py                   # FastAPI app entry point
│   ├── config.py                 # Environment config loader
│   └── .env                      # API keys (never commit this)
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx               # Main Voca interface
    │   └── dashboard/
    │       └── page.tsx           # Session dashboard
    ├── components/
    │   ├── VoiceOrb.tsx          # Central animated orb — listening/speaking states
    │   ├── PersonaSwitcher.tsx   # One-click persona selector
    │   ├── Transcript.tsx        # Live conversation transcript
    │   ├── LanguageBadge.tsx     # Detected language indicator
    │   ├── SummaryPanel.tsx      # Post-conversation summary
    │   └── StatusBar.tsx         # Connection + latency indicator
    ├── hooks/
    │   ├── useVoice.ts           # Mic capture + WebSocket audio streaming
    │   └── usePersona.ts         # Persona state management
    ├── lib/
    │   └── websocket.ts          # WebSocket client wrapper
    └── styles/
        └── globals.css
```

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

### Telephony Flow
```
Phone call → Twilio → POST /telephony/incoming
→ TwiML response (Media Streams WebSocket URL)
→ Twilio streams audio → FastAPI /ws/telephony
→ Deepgram STT → transcript
→ Gemini (with persona system prompt + conversation history)
→ Murf Falcon TTS → audio streamed back via Twilio
```

---

## Multilingual Architecture

This is Voca's killer feature and demo centrepiece. The multilingual system works as follows:

- **Detection:** Gemini detects the language of every user message and returns `[LANG:xx]` at the start of every response
- **State tracking:** `VocaPipeline` maintains `self.current_language` — updated every turn
- **Murf voice switching:** When language changes, the Murf voice ID switches to match:
  - `en` → use persona's default `murf_voice_id` (e.g. `en-IN-rohan`)
  - `ta` (Tamil) → `ta-IN-rohan` or closest Tamil voice
  - `hi` (Hindi) → `hi-IN-rohan` or closest Hindi voice
- **Context preservation:** Language switch does NOT reset conversation history
- **Mid-sentence switch:** If user switches language mid-conversation, Voca follows on the very next response
- **Supported languages:** English (`en`), Tamil (`ta`), Hindi (`hi`) — minimum for demo

### Murf Voice ID Mapping
```
en → en-IN-rohan (Aura), en-IN-priya (Nova), en-IN-arjun (Apex)
ta → ta-IN-rohan (all personas)
hi → hi-IN-rohan (all personas)
```

---

## Persona Schema

Each persona is a JSON file in `/backend/personas/` with this exact structure:

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
- **Murf voice:** `en-IN-rohan`, style: `Conversational`
- **Handles:** Appointment booking, doctor timings, test prep instructions, report status, emergency detection
- **Escalation trigger:** Billing disputes, complex medical queries, patient distress
- **Emergency trigger:** Keywords like "chest pain", "unconscious", "bleeding" — immediate escalation with calm voice

### Nova — School / University Admin
- **Tone:** Warm, structured, patient, encouraging
- **Accent color:** `#F59E0B` (amber)
- **Murf voice:** `en-IN-priya`, style: `Conversational`
- **Handles:** Admission queries, fee structure, exam schedules, result status, course information
- **Escalation trigger:** Scholarship appeals, disciplinary queries, parent complaints

### Apex — Startup Customer Support
- **Tone:** Sharp, fast, solution-oriented, friendly but efficient
- **Accent color:** `#6366F1` (indigo)
- **Murf voice:** `en-IN-arjun`, style: `Conversational`
- **Handles:** Product FAQs, billing queries, feature requests, bug reports, onboarding help
- **Escalation trigger:** Refund requests, data issues, legal queries

---

## UI Design Direction

**Aesthetic:** Dark + expressive. Not a generic dashboard. This is a product people will remember.

**Visual identity:**
- Background: Deep near-black (`#080A0F`) with subtle noise texture overlay
- Typography: Display font — `Syne` or `Cabinet Grotesk` for headings. Body — `DM Mono` for transcripts, `Satoshi` for UI text
- Central element: A large animated voice orb that pulses gently when idle, expands and breathes when listening, emits ripple waves when Voca is speaking
- The orb color shifts per persona — teal for Aura, amber for Nova, indigo for Apex
- Persona switcher: Horizontal pill selector at the top, smooth crossfade transition between personas including orb color, label, and background accent
- Transcript: Appears below the orb, left-aligned, monospaced, streams in word by word
- Language badge: Top right corner, subtle pill showing detected language
- Latency indicator: Bottom right, small, shows ms response time

**Motion principles:**
- Orb uses spring physics — never linear
- Page load: staggered reveal, orb scales up from 0 with a subtle bloom
- Persona switch: smooth 400ms crossfade, orb color transitions via CSS variable interpolation
- Transcript words stream in with 20ms stagger per word
- Speaking state: orb emits 3 concentric ripple rings, opacity fading outward

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
3. **Streaming first.** Murf TTS and Deepgram STT must both stream — no waiting for full response
4. **Persona is injected at session start** — not on every message. Store in session state
5. **Conversation history maintained per session** — Gemini must have full context, not just the last message
6. **Error states must be voiced** — if something fails, Voca says something, it doesn't go silent
7. **TypeScript strict mode** on the frontend — no `any` types
8. **Every component is named and purposeful** — no `Component1.tsx` or `index.tsx` dumping grounds
9. **Mobile responsive from the start** — not retrofitted at the end
10. **Clean git history** — one commit per milestone checkpoint, descriptive messages
11. **Use `google-genai` SDK only** — never import from `google.generativeai`
12. **Language switch never resets history** — multilingual is seamless, not a new session

---

## What This Is NOT

- Not a chatbot with a voice skin
- Not a phone tree (no "press 1 for English")
- Not an IVR system
- Not a demo — a real deployable product
- Not a single-use-case tool — it is horizontal infrastructure

---

## Hackathon Context

This is being built for a national-level hackathon using the Murf Falcon TTS API. The judging criteria will include innovation, practicality, scalability, and quality of demo. Voca wins by being the only submission that is positioned as infrastructure rather than a feature, demonstrated live with a real phone call and a real browser session, and switching personas and languages live on stage.

Demo sequence (3 minutes):
1. Open browser. Switch persona to Aura (Hospital). Speak in Tamil. Voca responds in Tamil, handles appointment query. Switch to Apex live. English conversation. Judges see the persona change instantly.
2. Pull out phone. Call the Twilio number on screen. Put on speaker. Speak naturally. Murf Falcon voice answers live in the room. Books something. WhatsApp confirmation arrives on screen.
3. Close with the one-liner.