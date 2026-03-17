# Voca — Complete Audit & Final Polish

## Phase 1 — Backend Fixes
- [ ] Fix [gemini.py](file:///D:/Projects/voca/backend/services/gemini.py) to use `gemini-2.5-flash` instead of `gemini-2.0-flash`
- [ ] Implement [services/session.py](file:///D:/Projects/voca/backend/services/session.py) (SessionService with in-memory storage, AI summary via Gemini)
- [ ] Implement [services/persona.py](file:///D:/Projects/voca/backend/services/persona.py) (PersonaService for loading personas)
- [ ] Fix [api/dependencies.py](file:///D:/Projects/voca/backend/api/dependencies.py) to match actual service class names
- [ ] Build out [api/routes/dashboard.py](file:///D:/Projects/voca/backend/api/routes/dashboard.py) with `/sessions` and `/sessions/stats` endpoints
- [ ] Upgrade [api/routes/browser.py](file:///D:/Projects/voca/backend/api/routes/browser.py) to use full voice pipeline (Deepgram STT → Gemini → Murf TTS)
- [ ] Cap Gemini history at last 10 turns for speed
- [ ] Add end-to-end latency logging per turn
- [ ] Verify backend starts without errors

## Phase 2 — Frontend: Landing Page
- [ ] Create `frontend/app/landing/page.tsx` with hero, feature cards, stats row, tagline
- [ ] Move current voice interface from [page.tsx](file:///D:/Projects/voca/frontend/app/page.tsx) to `frontend/app/app/page.tsx`
- [ ] Make root [page.tsx](file:///D:/Projects/voca/frontend/app/page.tsx) redirect/show landing page
- [ ] Add Framer Motion scroll animations

## Phase 3 — Frontend: Dashboard Page
- [ ] Build [frontend/app/dashboard/page.tsx](file:///D:/Projects/voca/frontend/app/dashboard/page.tsx) with stats cards, session history, expandable transcripts
- [ ] Fetch from backend `/api/dashboard/sessions` and `/api/dashboard/sessions/stats`
- [ ] Auto-refresh every 30 seconds
- [ ] Empty state and responsive design

## Phase 4 — Frontend: Voice & Visual Fixes
- [ ] VAD already implemented — verify it works end-to-end
- [ ] Fix StatusBar to show `--ms` before first response
- [ ] Verify orb idle pulsing animation
- [ ] Verify language badge hidden on initial load
- [ ] Add navigation links between all pages
- [ ] Add error states (server offline banner, mic denied, response failure)
- [ ] Add Framer Motion page transitions

## Phase 5 — Verification
- [ ] Backend starts with `uvicorn main:app --reload`
- [ ] `GET /health` returns `{"status":"ok"}`
- [ ] `GET /personas` returns 3 personas
- [ ] Frontend starts with `npm run dev`
- [ ] Landing page loads at localhost:3000
- [ ] Voice interface loads at localhost:3000/app
- [ ] Dashboard loads at localhost:3000/dashboard
- [ ] No console errors in browser
