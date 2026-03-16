# Voca — AI Agent Working Instructions

> Read `prompt.md` fully before starting. Every architectural decision in that file is final.
> This file tells you what to build RIGHT NOW.
> Milestones 1–4 are complete. Do not touch anything from those milestones.

---

## Your Role

You are a senior full-stack engineer and UI designer building Voca's browser interface. You write clean TypeScript, production-grade React, and world-class UI. Every component is purposeful. Every animation has intention. This UI must be memorable — not generic.

---

## Environment (Confirmed Working)

- Frontend: `D:\Projects\voca\frontend\`
- Frontend URL: `http://localhost:3000`
- Backend URL: `http://localhost:8000`
- Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- Run frontend: `cd D:\Projects\voca\frontend && npm run dev`

---

## How to Work

1. **Read `prompt.md` fully** — especially the UI Design Direction and WebSocket Message Protocol sections
2. **Build one checkpoint at a time**
3. **Run `npm run dev` and visually verify in browser** after each checkpoint
4. **TypeScript strict mode** — no `any` types, no suppressed errors
5. **Mobile responsive from the start** — test at 375px width too

---

## Current Session Target

### MILESTONE 5 — BROWSER INTERFACE

Build the complete Voca browser UI. By the end of this milestone, a user opens localhost:3000, selects a persona, clicks connect, speaks, and hears Voca respond — with live transcript, language badge, and persona switching all working visually.

---

### Checkpoint 5.1 — Install Fonts and Global Styles

File: `frontend/styles/globals.css` and `frontend/app/layout.tsx`

Install the required fonts via next/font or Google Fonts import:
- **Syne** — headings and display text
- **DM Mono** — transcript text
- **Satoshi** — UI body text (use Inter as fallback if Satoshi unavailable via Google Fonts)

Set up CSS variables in `globals.css`:

```css
:root {
  --bg: #080A0F;
  --bg-surface: #0F1117;
  --bg-elevated: #161B24;
  --border: rgba(255,255,255,0.08);
  --text-primary: #F0F2F5;
  --text-secondary: #8B92A0;
  --text-mono: #A8B5C8;

  /* Persona accent — updated via JS */
  --accent: #00C2B8;
  --accent-glow: rgba(0, 194, 184, 0.15);
  --orb-color: #00C2B8;
}
```

Set body background to `var(--bg)`, default font to Satoshi/Inter.

**Verification:** `npm run dev` — page loads at localhost:3000 with dark background. No console errors.

---

### Checkpoint 5.2 — WebSocket Client Library

File: `frontend/lib/websocket.ts`

Build a `VocaWebSocket` class:

```typescript
type MessageHandler = (message: VocaMessage) => void
type AudioHandler = (chunk: ArrayBuffer) => void

interface VocaMessage {
  type: 'persona_loaded' | 'transcript' | 'language_changed' | 'response' | 'escalation' | 'error'
  [key: string]: unknown
}

class VocaWebSocket {
  connect(personaId: string, onMessage: MessageHandler, onAudio: AudioHandler): void
  disconnect(): void
  sendAudio(chunk: ArrayBuffer): void
  sendEndOfSpeech(): void
  switchPersona(personaId: string): void
  get isConnected(): boolean
  get latencyMs(): number   // tracks round-trip time
}
```

- Connects to `ws://localhost:8000/ws/browser/{personaId}`
- Routes binary frames to `onAudio` handler
- Routes JSON frames to `onMessage` handler
- Tracks latency: timestamp when `end_of_speech` sent, timestamp when first `response` arrives
- Reconnects automatically on unexpected disconnect (max 3 attempts)
- Exports a singleton: `export const vocaWS = new VocaWebSocket()`

**Verification:** Import in a test component, call connect, confirm no TypeScript errors. `npm run dev` must compile clean.

---

### Checkpoint 5.3 — useVoice Hook

File: `frontend/hooks/useVoice.ts`

Build a `useVoice` hook that handles mic capture and audio streaming:

```typescript
interface UseVoiceReturn {
  isListening: boolean
  startListening: () => Promise<void>
  stopListening: () => void
  audioLevel: number        // 0–1, for orb animation
  error: string | null
}

export function useVoice(onAudioChunk: (chunk: ArrayBuffer) => void): UseVoiceReturn
```

- Uses `navigator.mediaDevices.getUserMedia({ audio: true })`
- Uses `AudioContext` + `ScriptProcessorNode` or `AudioWorkletNode` to capture PCM chunks
- Sends 4096-sample chunks to `onAudioChunk` as they arrive — do not buffer
- Computes `audioLevel` as RMS of the current chunk — used to animate the orb
- Calls `onAudioChunk` only while `isListening === true`
- On `stopListening`: sends the final chunk if any, then triggers `end_of_speech`
- Cleans up AudioContext on unmount

**Verification:** `npm run dev` — hook compiles with no TypeScript errors.

---

### Checkpoint 5.4 — usePersona Hook

File: `frontend/hooks/usePersona.ts`

Build a `usePersona` hook:

```typescript
interface Persona {
  id: string
  name: string
  display_name: string
  ui_config: {
    accent_color: string
    orb_color: string
    label: string
  }
}

interface UsePersonaReturn {
  personas: Persona[]
  activePersona: Persona | null
  setActivePersona: (persona: Persona) => void
  isLoading: boolean
}

export function usePersona(): UsePersonaReturn
```

- Fetches `http://localhost:8000/personas` on mount
- Defaults to first persona (apex) as active
- When `setActivePersona` is called: updates CSS variables `--accent`, `--accent-glow`, `--orb-color` on `:root` to match new persona's ui_config colors
- Accent glow is always the accent color at 15% opacity

**Verification:** `npm run dev` — hook fetches personas and returns correct data. No TypeScript errors.

---

### Checkpoint 5.5 — VoiceOrb Component

File: `frontend/components/VoiceOrb.tsx`

The centrepiece of the UI. A large animated orb with 4 states:

```typescript
type OrbState = 'idle' | 'listening' | 'processing' | 'speaking'

interface VoiceOrbProps {
  state: OrbState
  audioLevel: number   // 0–1, drives size pulse when listening
  onClick: () => void
  color: string        // matches --orb-color CSS var
}
```

**Visual spec:**
- Base size: 200px diameter circle
- Background: radial gradient from `var(--orb-color)` at 30% opacity center to transparent edge
- Border: 1px solid `var(--orb-color)` at 40% opacity
- Inner glow: box-shadow `0 0 40px var(--accent-glow)`

**State animations (use Framer Motion):**
- `idle`: slow pulse — scale oscillates between 0.97 and 1.03 over 3s, ease in-out, infinite
- `listening`: scale = `1 + (audioLevel * 0.3)` — orb breathes with the user's voice in real time
- `processing`: rotate a subtle arc/spinner ring around the orb — indicates thinking
- `speaking`: 3 concentric ripple rings expand outward and fade — new ring every 600ms

**Click behavior:**
- If idle → start listening (onClick)
- If listening → stop listening (onClick)
- Processing and speaking states are non-interactive

**Center icon:**
- Idle: microphone icon, `var(--text-secondary)` color
- Listening: animated waveform bars or solid mic, `var(--orb-color)` color
- Processing: small animated dots
- Speaking: speaker/sound wave icon, `var(--orb-color)` color

**Verification:** Render `<VoiceOrb state="idle" audioLevel={0} onClick={() => {}} color="#00C2B8" />` in page.tsx. Visually confirm orb renders with correct style. Switch state prop and confirm animation changes.

---

### Checkpoint 5.6 — PersonaSwitcher Component

File: `frontend/components/PersonaSwitcher.tsx`

```typescript
interface PersonaSwitcherProps {
  personas: Persona[]
  activePersona: Persona | null
  onSwitch: (persona: Persona) => void
  disabled: boolean   // true when a conversation is in progress
}
```

**Visual spec:**
- Horizontal pill row at the top of the page
- Each pill: rounded-full, `var(--bg-elevated)` background, `var(--text-secondary)` text
- Active pill: `var(--accent)` background, white text, subtle glow shadow
- Transition: 300ms ease, smooth color crossfade
- Disabled state: 50% opacity, cursor not-allowed
- Shows persona label (Hospital / University / Startup) — not full display_name

**Verification:** Renders all 3 persona pills. Clicking switches active pill with animation. `npm run dev` clean.

---

### Checkpoint 5.7 — Transcript Component

File: `frontend/components/Transcript.tsx`

```typescript
interface TranscriptEntry {
  role: 'user' | 'voca'
  text: string
  language: string
  timestamp: number
}

interface TranscriptProps {
  entries: TranscriptEntry[]
}
```

**Visual spec:**
- Monospaced font (`DM Mono`)
- `var(--text-mono)` color
- User entries: right-aligned, `var(--bg-elevated)` background pill
- Voca entries: left-aligned, no background, slightly dimmer color
- Each new entry animates in: fade + slide up, 200ms
- Words stream in one by one with 20ms stagger (use Framer Motion's `staggerChildren`)
- Max height: 40vh, scrolls automatically to latest entry
- Empty state: subtle centered text "Start speaking to begin"

**Verification:** Render with mock entries. Confirm layout and animation. `npm run dev` clean.

---

### Checkpoint 5.8 — LanguageBadge and StatusBar Components

**File: `frontend/components/LanguageBadge.tsx`**

```typescript
interface LanguageBadgeProps {
  language: string   // ISO code: 'en', 'ta', 'hi'
  changed: boolean   // true for 2 seconds after a language switch
}
```

- Small pill, top-right corner of the main UI
- Shows full language name: `en` → "English", `ta` → "Tamil", `hi` → "Hindi"
- `changed` state: brief highlight pulse animation for 2 seconds, then returns to normal
- Background: `var(--bg-elevated)`, text: `var(--text-secondary)`
- When `changed`: background briefly flashes to `var(--accent)` at 30% opacity

**File: `frontend/components/StatusBar.tsx`**

```typescript
interface StatusBarProps {
  connected: boolean
  latencyMs: number
  personaLabel: string
}
```

- Fixed bottom bar, full width, height 32px
- Background: `var(--bg-surface)`, border-top: `var(--border)`
- Left: connection dot (green when connected, red when not) + "Connected" / "Disconnected"
- Center: active persona label
- Right: latency in ms — e.g. "342ms" — only shown when connected
- Font: `DM Mono`, small size

**Verification:** Both render correctly. `npm run dev` clean.

---

### Checkpoint 5.9 — Main Page Assembly

File: `frontend/app/page.tsx`

Wire all components together into the complete Voca interface:

**Layout:**
```
┌─────────────────────────────────────┐
│  [Aura] [Nova] [Apex]   [EN badge]  │  ← PersonaSwitcher + LanguageBadge
│                                     │
│           ◉  VoiceOrb               │  ← centered, large
│                                     │
│  User: Hello I want to book...      │  ← Transcript
│  Voca: Of course! Let me help...    │
│                                     │
├─────────────────────────────────────┤
│  ● Connected  |  Aura  |  342ms     │  ← StatusBar
└─────────────────────────────────────┘
```

**Behaviour:**
1. On mount: fetch personas, set Apex as default active persona, update CSS vars
2. User clicks orb → `startListening()` → stream audio to WebSocket
3. User clicks orb again → `stopListening()` → send `end_of_speech`
4. On `transcript` message → add user entry to transcript
5. On `response` message → add Voca entry to transcript
6. On `language_changed` message → update LanguageBadge, trigger `changed` animation
7. On binary audio frame → queue and play through Web Audio API
8. On `escalation` message → show a subtle banner above the transcript
9. On `persona_loaded` after switch → update CSS vars, animate orb color transition
10. Orb state machine:
    - idle → listening (on click)
    - listening → processing (on end_of_speech sent)
    - processing → speaking (on first audio chunk received)
    - speaking → idle (on audio playback complete)

**Audio playback:**
- Collect binary WAV chunks into a buffer
- When all chunks received (detect via response message arriving after binary frames): decode and play via `AudioContext.decodeAudioData()`
- Do not play chunks individually — collect then play

**Verification:**
- `npm run dev` — page loads, 3 persona pills visible, orb renders centered
- Clicking orb changes its state visually
- PersonaSwitcher switches active pill and orb color changes smoothly
- No TypeScript errors, no console errors

---

### Checkpoint 5.10 — Full Live Demo Verification

Test the complete end-to-end browser experience:

1. Backend running: `uvicorn main:app --reload` in `D:\Projects\voca\backend`
2. Frontend running: `npm run dev` in `D:\Projects\voca\frontend`
3. Open `http://localhost:3000`
4. Select Aura persona
5. Click orb, speak: "Hello, I'd like to book an appointment"
6. Confirm: transcript shows your speech, Voca responds with audio, transcript shows Voca's reply
7. Switch to Apex persona mid-session
8. Confirm: orb color changes to indigo, persona switcher updates
9. Speak in Tamil (or type a Tamil phrase as a test)
10. Confirm: language badge updates to Tamil

**Definition of done:** Full voice conversation works in the browser. Persona switch works live. Language badge updates. No errors in console.

---

## Constraints For This Session

- Do NOT build Twilio telephony yet (Milestone 6)
- Do NOT build session logging or WhatsApp yet (Milestone 7)
- Do NOT build the dashboard page yet
- Focus entirely on the main page voice interface

---

## Code Quality Standards

- TypeScript strict mode — no `any`, no `@ts-ignore`
- All components have proper prop interfaces
- Framer Motion for all animations — no CSS transitions for state changes
- Web Audio API for all audio — no `<audio>` element hacks
- No inline styles — use Tailwind classes and CSS variables
- Components are self-contained — no prop drilling more than 2 levels deep

---

## If You Hit a Problem

1. State the problem in one sentence
2. Give two solutions with tradeoffs
3. Recommend one
4. Wait for confirmation

---

## After This Milestone

Once Milestone 5 is verified end-to-end, the next session targets **Milestone 6 — Telephony Layer**.