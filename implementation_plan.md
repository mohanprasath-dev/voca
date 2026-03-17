# Voca — Complete Audit & Final Polish

Full audit, fix, and feature build for the Voca real-time AI voice agent platform. The project has a working skeleton — backend WebSocket connects and frontend renders — but several critical services are stubs, the Gemini model is wrong, session management is missing, and the landing/dashboard pages don't exist.

## Audit Summary

### What's Working ✅
- Backend starts, `/health` and `/personas` endpoints work
- WebSocket connects at `/ws/browser/{persona_id}` and sends [persona_loaded](file:///D:/Projects/voca/backend/api/routes/browser.py#26-40)
- Persona switching via WebSocket works
- Frontend renders: VoiceOrb, PersonaSwitcher, Transcript, LanguageBadge, StatusBar, SummaryPanel
- VAD (voice activity detection) code is fully implemented in [useVoice.ts](file:///D:/Projects/voca/frontend/hooks/useVoice.ts)
- Orb pulsing animation works (Framer Motion loop)
- Language badge hidden on initial load (controlled by `hasLanguageDetection`)
- StatusBar already shows `--ms` before first response
- Page title already set to "Voca" in [layout.tsx](file:///D:/Projects/voca/frontend/app/layout.tsx)
- Error states for mic permission and error notices are implemented

### What's Broken/Missing ❌
- [gemini.py](file:///D:/Projects/voca/backend/services/gemini.py) uses `gemini-2.0-flash` — must be `gemini-2.5-flash`
- [services/session.py](file:///D:/Projects/voca/backend/services/session.py) is an empty stub — no session storage or AI summary
- [services/persona.py](file:///D:/Projects/voca/backend/services/persona.py) is an empty stub — not used but referenced by [dependencies.py](file:///D:/Projects/voca/backend/api/dependencies.py)
- [api/routes/dashboard.py](file:///D:/Projects/voca/backend/api/routes/dashboard.py) is empty — no `/sessions` or `/sessions/stats` endpoints
- [browser.py](file:///D:/Projects/voca/backend/api/routes/browser.py) sends hardcoded placeholder summary, doesn't use the voice pipeline
- No landing page exists
- Dashboard page is a broken stub (wrong [SummaryPanel](file:///D:/Projects/voca/frontend/components/SummaryPanel.tsx#19-47) usage without props)
- No navigation between landing → app → dashboard

## Proposed Changes

### Backend Core Services

#### [MODIFY] [gemini.py](file:///D:/Projects/voca/backend/services/gemini.py)
- Change `self._model` from `"gemini-2.0-flash"` to `"gemini-2.5-flash"`
- Cap conversation history at last 10 messages in [_build_contents](file:///D:/Projects/voca/backend/services/gemini.py#34-45)

#### [MODIFY] [session.py](file:///D:/Projects/voca/backend/services/session.py)
- Implement `SessionService` class with in-memory dict of sessions
- `create_session(persona_id)` → creates a new [Session](file:///D:/Projects/voca/backend/models/session.py#18-25) with UUID
- [get_session(session_id)](file:///D:/Projects/voca/backend/api/dependencies.py#12-15) → retrieves session
- `end_session(session_id)` → generates AI summary via Gemini, stores end time
- `list_sessions()` → returns all sessions
- `get_stats()` → aggregate stats (total, resolved, escalated, avg duration, languages)

#### [MODIFY] [persona.py](file:///D:/Projects/voca/backend/services/persona.py)
- Implement `PersonaService` with `load_all()`, `get_by_id(persona_id)` methods
- Load from `personas/*.json` on initialization

---

### Backend Routes

#### [MODIFY] [browser.py](file:///D:/Projects/voca/backend/api/routes/browser.py)
- Create [PipelineService](file:///D:/Projects/voca/backend/services/pipeline.py#14-67) on connection, integrate full voice pipeline
- Handle binary audio frames from frontend → forward to Deepgram STT
- On transcript result → feed to Gemini → stream Murf TTS audio back
- On `end_session` → generate real AI summary via SessionService
- Track session with `SessionService`, log all messages
- Add end-to-end latency logging

#### [MODIFY] [dashboard.py](file:///D:/Projects/voca/backend/api/routes/dashboard.py)
- `GET /sessions` → returns list of all sessions with summary data
- `GET /sessions/stats` → returns aggregate stats

#### [MODIFY] [dependencies.py](file:///D:/Projects/voca/backend/api/dependencies.py)
- Fix class name references to match actual `PersonaService` and `SessionService`

#### [MODIFY] [main.py](file:///D:/Projects/voca/backend/main.py)
- Initialize `PersonaService` and `SessionService` on startup via `app.state`

---

### Frontend Pages

#### [NEW] [page.tsx (root)](file:///D:/Projects/voca/frontend/app/page.tsx)
- Landing page with:
  - Full dark background (`#080A0F`)
  - Hero section: "Voca" wordmark, tagline, CTA button → `/app`
  - Three feature cards for the three personas with accent colors
  - Stats row: "35+ Languages", "130ms Latency", "3 Personas", "Real-time AI"
  - Bottom tagline
  - Framer Motion scroll animations
  - Responsive

#### [NEW] [page.tsx (app)](file:///D:/Projects/voca/frontend/app/app/page.tsx)
- Move current voice interface from root [page.tsx](file:///D:/Projects/voca/frontend/app/page.tsx) to `app/app/page.tsx`

#### [MODIFY] [page.tsx (dashboard)](file:///D:/Projects/voca/frontend/app/dashboard/page.tsx)
- Complete rebuild: stats cards, session history table, expandable transcripts
- Fetch from `/api/dashboard/sessions` and `/api/dashboard/sessions/stats`
- Auto-refresh every 30 seconds
- Empty state, responsive

---

### Frontend Navigation & Error States

#### [MODIFY] [StatusBar.tsx](file:///D:/Projects/voca/frontend/components/StatusBar.tsx)
- Add "Dashboard →" link

#### Navigation between pages
- Landing → App (CTA button)
- App → Dashboard (StatusBar link)
- Dashboard → App (header button)

#### Error states to add in app page
- Server offline banner with retry
- Already handled: mic denied, response failure notices

---

## Verification Plan

### Automated (terminal commands)
1. **Backend startup**: `cd D:\Projects\voca\backend && d:\Projects\voca\.venv\Scripts\python.exe -m uvicorn main:app --reload` — verify no import errors
2. **Frontend build**: `cd D:\Projects\voca\frontend && npm run build` — verify TypeScript compilation passes

### Manual Verification via Browser
1. `http://localhost:3000` — landing page loads with hero, cards, stats, animations
2. `http://localhost:3000/app` — voice interface loads, status bar shows "Connected"
3. `http://localhost:3000/dashboard` — dashboard loads, shows empty state or sessions
4. CTA on landing → navigates to `/app`
5. StatusBar "Dashboard →" link → navigates to `/dashboard`
6. Click orb → mic activates → speak → VAD detects silence → orb goes to processing
7. Persona switch changes orb color instantly

> [!IMPORTANT]
> Full voice pipeline testing (speak → STT → Gemini → TTS → playback) requires valid API keys for Deepgram, Gemini, and Murf. The user should verify this manually with their credentials.
