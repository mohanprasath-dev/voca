# Voca Workspace Instructions

## Architecture
- Voca has two apps:
  - `backend/`: FastAPI services, WebSocket voice pipeline, session and dashboard APIs.
  - `frontend/`: Next.js App Router UI with routes `/`, `/landing`, `/app`, `/dashboard`.
- Real-time browser flow is fixed by protocol:
  - Frontend sends binary PCM audio + JSON events (`end_of_speech`, `switch_persona`, `end_session`).
  - Backend sends transcript/response JSON events and binary TTS chunks.
- Keep service boundaries:
  - Routing and transport in `backend/api/routes/**`.
  - Business logic in `backend/services/**`.
  - Schemas in `backend/models/**`.

## Build And Test
- Backend setup and run:
  - `d:\Projects\voca\.venv\Scripts\Activate.ps1`
  - `cd backend`
  - `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000`
- Backend tests:
  - `cd backend`
  - `python -m unittest discover -s tests -p "test_milestone2_services.py"`
- Frontend run/build/lint:
  - `cd frontend`
  - `npm run dev`
  - `npm run build`
  - `npm run lint`

## Conventions
- Prefer async I/O and typed code in backend; do not introduce blocking network calls in request/WebSocket paths.
- Keep WebSocket message protocol stable; do not rename message `type` values without explicit request.
- Use constants for thresholds/timeouts instead of magic numbers.
- Frontend state updates should avoid flicker or stuck UI states (`idle`, `listening`, `processing`, `speaking`).
- Preserve existing persona data contract in `backend/personas/*.json`.

## Project Constraints
- Do not refactor working backend services unless requested.
- Do not change persona JSON schema or values unless requested.
- Prefer targeted edits over broad rewrites.
- For product and milestone intent, consult `prompt.md` and `instructions.md` before major changes.

## Common Pitfalls
- Starting frontend/backend from wrong directory can fail commands; always `cd` to the app folder first.
- Deepgram/WebSocket lifecycle bugs can leak connections; ensure close/cleanup paths are preserved.
- Hardcoded localhost endpoints are expected in this workspace; avoid partial environment-variable migrations unless requested.
