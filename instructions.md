# Voca — AI Agent Working Instructions

> Read `prompt.md` fully before starting.
> Milestones 1–7 are complete. Do not touch core functionality — only polish and harden.

---

## Environment

- Python 3.14, venv: `D:\Projects\voca\.venv\`
- Backend: `D:\Projects\voca\backend\`
- Frontend: `D:\Projects\voca\frontend\`
- Activate: `d:\Projects\voca\.venv\Scripts\Activate.ps1`

---

## Current Session Target

### MILESTONE 9 — DEMO HARDENING

The product is built. This milestone makes it unbreakable for the 3-minute demo. Every issue that could embarrass on stage gets fixed now. Every edge case that could cause silence or crash gets handled. The demo must run perfectly 5 times in a row.

---

### Checkpoint 9.1 — Fix WebSocket Status Indicator

File: `frontend/app/page.tsx` and `frontend/lib/websocket.ts`

The status bar currently flips between Connected and Disconnected. This must be rock solid.

- The WebSocket connection effect must only depend on `activePersona?.id` — nothing else
- When backend is running, status must show `Connected` within 2 seconds of page load and stay there
- When persona switches, connection must re-establish cleanly without flickering
- Status bar dot: green when connected, red when disconnected — no intermediate states

**Verification:** Start backend + frontend. Open localhost:3000. Status bar must show green `Connected` within 2 seconds and stay green for 30 seconds without flickering.

---

### Checkpoint 9.2 — Mic Permission and Error Handling

File: `frontend/hooks/useVoice.ts` and `frontend/app/page.tsx`

When the user clicks the orb for the first time, the browser asks for mic permission. Handle all cases gracefully:

- If mic permission denied: orb returns to idle, show a brief toast/banner "Microphone access required"
- If AudioContext fails to start: same fallback
- If mic stops mid-conversation (device unplugged etc): orb returns to idle, show "Microphone disconnected"
- Never leave orb stuck in `listening` state with no audio being sent

**Verification:** Open localhost:3000. Click orb and deny mic permission. Confirm orb returns to idle with an error message. No console errors thrown uncaught.

---

### Checkpoint 9.3 — Audio Playback Reliability

File: `frontend/app/page.tsx`

The current audio playback collects all WAV chunks then plays. Make it more reliable:

- If `decodeAudioData` fails (malformed audio): catch the error, set orbState to `idle`, log the error — do not crash
- Add a 10 second timeout: if no audio arrives within 10 seconds of `end_of_speech` being sent, reset orb to `idle` and show brief message "Taking longer than expected..."
- After audio finishes playing: always reset orbState to `idle` — even if `onended` doesn't fire (add a fallback timeout based on audio duration)
- Never leave orb stuck in `processing` or `speaking` state

**Verification:** Start a conversation. Confirm orb returns to `idle` after Voca finishes speaking every time.

---

### Checkpoint 9.4 — Persona Switch Polish

File: `frontend/app/page.tsx` and `frontend/components/PersonaSwitcher.tsx`

Persona switching must be instant and smooth for the demo:

- Persona switch is disabled while orb is in `listening`, `processing`, or `speaking` state — pills show 50% opacity and cursor not-allowed
- When switching persona: immediately update orb color and accent color — do not wait for WebSocket reconnect
- After persona switch: transcript clears, summary panel clears, language resets to `en`
- PersonaSwitcher shows a subtle loading indicator on the newly selected pill while WebSocket reconnects

**Verification:** Start a conversation. Try switching persona mid-conversation — pills must be disabled. End conversation, switch persona — orb color must change instantly, transcript must clear.

---

### Checkpoint 9.5 — Loading State on Page Start

File: `frontend/app/page.tsx`

The page currently shows a plain "Initializing Core..." text while loading. Make it feel premium:

- Loading screen: full dark background, centered Voca wordmark or logo, subtle pulsing animation
- Loading text: `INITIALIZING` in monospace, small, letter-spaced
- Smooth fade transition from loading screen to main UI when personas load
- If personas fail to load (backend down): show "Unable to connect. Please ensure the server is running." with a retry button

**Verification:** Stop the backend, open localhost:3000. Must show the error state with retry button. Start backend, click retry — must connect and show main UI.

---

### Checkpoint 9.6 — End Session Flow

The demo needs a clean way to end a session and show the summary:

- After Voca finishes speaking (orb returns to idle), show a subtle "End Session" button below the orb
- Button only appears after at least 1 completed exchange (user spoke + Voca responded)
- Clicking it sends `{"type": "end_session"}` and triggers the summary panel
- Summary panel shows: persona name, duration, turn count, languages used, AI summary text
- "New Conversation" button on summary panel clears everything and starts fresh

**Verification:** Have a 2-turn conversation. Confirm "End Session" button appears. Click it. Confirm summary panel slides up with real AI-generated summary.

---

### Checkpoint 9.7 — Visual Polish Pass

A quick pass on the most visible rough edges:

- Transcript area: if empty, show subtle centered text "Start speaking..." (not "Waiting for conversation to start..." — too long)
- Language badge: if language is `en` on load before any conversation, show nothing (hide badge until first language detection)
- Status bar latency: show `--ms` when not yet measured, not `0ms`
- Orb idle animation: confirm it's actually pulsing (scale oscillating) — if static, fix the Framer Motion animation
- Page title: set to "Voca" in layout.tsx

**Verification:** Visual check at localhost:3000. All items above confirmed correct.

---

### Checkpoint 9.8 — Final Demo Run

Run the complete demo sequence 3 times and confirm it works every time:

**Demo sequence:**
1. Open localhost:3000 — loads cleanly, Apex persona active, orb pulsing
2. Click Aura persona — orb turns teal instantly
3. Click orb — mic activates
4. Speak: "Hello, I'd like to book an appointment"
5. Orb goes to processing then speaking — Murf voice responds
6. Speak in Tamil: "நான் நாளை வர விரும்புகிறேன்"
7. Voca responds in Tamil — language badge updates to Tamil
8. Click "End Session" — summary panel slides up with AI summary
9. Click "New Conversation" — everything resets
10. Switch to Apex — orb turns indigo
11. Speak: "How do I reset my password?"
12. Voca responds — confirm it works

**Definition of done:** All 12 steps complete without errors, 3 times in a row. No stuck orb states. No console errors. No flickering status bar.

---

## Constraints

- Do NOT refactor any working backend services
- Do NOT change the WebSocket message protocol
- Do NOT change persona JSON files
- Only fix, polish, and harden — do not add new features

---

## Code Quality

- No new `any` types introduced
- All error states show user-facing messages — never silent failures
- Framer Motion for all new animations
- No hardcoded strings — use constants for timeouts and thresholds

---

## After This Milestone

Once demo runs perfectly 3 times in a row, move to **Milestone 10 — Presentation**.