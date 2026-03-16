# Voca — AI Agent Working Instructions

> Read `prompt.md` fully before starting.
> Milestones 1–6 are complete. Do not touch anything from those milestones.

---

## Environment

- Python 3.14, venv: `D:\Projects\voca\.venv\`
- Backend: `D:\Projects\voca\backend\`
- Frontend: `D:\Projects\voca\frontend\`
- Activate: `d:\Projects\voca\.venv\Scripts\Activate.ps1`
- Gemini SDK: `google-genai`, model: `gemini-2.5-flash`

---

## Current Session Target

### MILESTONE 7 — POST-CALL INTELLIGENCE

By the end of this milestone, every conversation is automatically logged, an AI summary is generated, and the summary is displayed to the user in the browser as a clean panel after the conversation ends. This is what transforms Voca from a voice chatbot into a voice product.

---

### Checkpoint 7.1 — Session Pydantic Models

File: `backend/models/session.py`

Replace whatever is there with these exact models:

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

class TranscriptTurn(BaseModel):
    role: str                    # "user" or "voca"
    text: str
    language: str
    timestamp: datetime

class SessionSummary(BaseModel):
    session_id: str
    persona_id: str
    persona_name: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    transcript: list[TranscriptTurn] = []
    detected_languages: list[str] = []
    escalated: bool = False
    escalation_reason: Optional[str] = None
    summary: Optional[str] = None
    resolution_status: str = "in_progress"   # "resolved", "escalated", "abandoned"
    turn_count: int = 0
```

**Verification:**
```bash
python -c "
from models.session import SessionSummary, TranscriptTurn
from datetime import datetime
s = SessionSummary(session_id='test', persona_id='apex', persona_name='Apex', started_at=datetime.now())
print(s.model_dump())
print('Session models OK')
"
```

---

### Checkpoint 7.2 — SessionService

File: `backend/services/session.py`

Build a `SessionService` class:

```python
class SessionService:
    def __init__(self):
        self._sessions: dict[str, SessionSummary] = {}   # in-memory store

    def create_session(self, persona_id: str, persona_name: str) -> str:
        """Create a new session, return session_id."""

    def add_turn(self, session_id: str, role: str, text: str, language: str) -> None:
        """Append a transcript turn to the session."""

    def mark_escalated(self, session_id: str, reason: str) -> None:
        """Mark session as escalated with reason."""

    def end_session(self, session_id: str) -> SessionSummary:
        """
        Close the session:
        - Set ended_at to now
        - Calculate duration_seconds
        - Collect detected_languages (unique, ordered by first appearance)
        - Set turn_count
        - Set resolution_status: 'escalated' if escalated, 'resolved' if turn_count > 0, else 'abandoned'
        - Generate AI summary via Gemini (see below)
        - Return the completed SessionSummary
        """

    def get_session(self, session_id: str) -> SessionSummary | None:
        """Return session by ID or None."""

    def list_sessions(self, limit: int = 20) -> list[SessionSummary]:
        """Return most recent sessions, newest first."""
```

**AI Summary generation in `end_session`:**
Use `google-genai` to generate a 2-3 sentence summary of the conversation:

```python
from google import genai
from config import settings

client = genai.Client(api_key=settings.gemini_api_key)

transcript_text = "\n".join(
    f"{turn.role.upper()}: {turn.text}"
    for turn in session.transcript
)

prompt = f"""Summarize this voice conversation in 2-3 sentences.
Focus on: what the caller needed, whether it was resolved, and any notable details.
Be concise and factual. Do not use bullet points.

TRANSCRIPT:
{transcript_text}

SUMMARY:"""

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt
)
session.summary = response.text.strip()
```

If the transcript is empty, set summary to `"No conversation recorded."`

**Verification:**
```bash
python -c "
import asyncio
from services.session import SessionService
from datetime import datetime

svc = SessionService()
sid = svc.create_session('apex', 'Apex')
svc.add_turn(sid, 'user', 'Hi I want to reset my password', 'en')
svc.add_turn(sid, 'voca', 'Sure, go to login page and click Forgot Password', 'en')
svc.add_turn(sid, 'user', 'Thanks that worked', 'en')
summary = svc.end_session(sid)
print(f'Session ID: {summary.session_id}')
print(f'Turn count: {summary.turn_count}')
print(f'Status: {summary.resolution_status}')
print(f'Summary: {summary.summary}')
print('SessionService OK')
"
```
Must print a coherent 2-3 sentence summary and `SessionService OK`.

---

### Checkpoint 7.3 — Wire SessionService into Pipeline

File: `backend/services/pipeline.py`

Update `VocaPipeline` to use `SessionService`:

- Import and instantiate `SessionService` at the top of the module as a singleton: `session_service = SessionService()`
- In `VocaPipeline.__init__`: call `session_service.create_session(persona_id, persona.name)` — store `self.session_id`
- In `process_audio` after transcription: call `session_service.add_turn(self.session_id, 'user', transcript, language)`
- In `process_audio` after Gemini responds: call `session_service.add_turn(self.session_id, 'voca', response_text, language)`
- If escalation triggered: call `session_service.mark_escalated(self.session_id, escalation_summary)`
- Add method: `async def close_session(self) -> SessionSummary` — calls `session_service.end_session(self.session_id)` and returns the summary

**Verification:**
```bash
python -c "
import asyncio
from services.pipeline import VocaPipeline

async def test():
    p = VocaPipeline('apex')
    print(f'Session ID created: {p.session_id}')
    print('Pipeline session wiring OK')

asyncio.run(test())
"
```
Must print a session ID (UUID format) and `Pipeline session wiring OK`.

---

### Checkpoint 7.4 — Session End WebSocket Event

File: `backend/api/routes/browser.py`

Update the WebSocket handler to send a session summary when the conversation ends:

- Add a way for the client to signal end of session: JSON message `{"type": "end_session"}`
- When received: call `await pipeline.close_session()` → get `SessionSummary`
- Send to client:
```json
{
  "type": "session_summary",
  "session_id": "...",
  "persona_name": "Apex",
  "duration_seconds": 45.2,
  "turn_count": 4,
  "detected_languages": ["en"],
  "escalated": false,
  "resolution_status": "resolved",
  "summary": "Caller asked about password reset. Issue resolved successfully in one step."
}
```
- Also send summary automatically if WebSocket disconnects cleanly (client closed tab)

**Verification:** Cannot fully verify without live audio — confirm the route compiles clean and the `end_session` handler is present in the file.

---

### Checkpoint 7.5 — Dashboard API Endpoints

File: `backend/api/routes/dashboard.py`

Add session endpoints alongside the existing `/personas` endpoints:

**`GET /sessions`** — returns list of recent sessions (newest first, limit 20)
- Response: array of SessionSummary objects (full data)

**`GET /sessions/{session_id}`** — returns single session by ID

**`GET /sessions/stats`** — returns aggregate stats:
```json
{
  "total_sessions": 12,
  "resolved": 10,
  "escalated": 1,
  "abandoned": 1,
  "languages_used": ["en", "ta"],
  "avg_duration_seconds": 38.5,
  "avg_turns": 3.2
}
```

All endpoints use the singleton `SessionService` via FastAPI dependency.

**Verification:**
```bash
uvicorn main:app --reload
curl http://localhost:8000/sessions
curl http://localhost:8000/sessions/stats
```
Both must return valid JSON with no errors. Sessions list may be empty on fresh start — that's fine.

---

### Checkpoint 7.6 — SummaryPanel Frontend Component

File: `frontend/components/SummaryPanel.tsx`

Build the post-conversation summary panel:

```typescript
interface SessionSummaryData {
  session_id: string
  persona_name: string
  duration_seconds: number
  turn_count: number
  detected_languages: string[]
  escalated: boolean
  resolution_status: string
  summary: string
}

interface SummaryPanelProps {
  data: SessionSummaryData | null
  onDismiss: () => void
}
```

**Visual spec:**
- Appears as a slide-up panel from the bottom of the transcript area
- Dark glassmorphism card, border with persona accent color
- Header: persona name + resolution status badge (green "Resolved" / red "Escalated" / gray "Ended")
- Body: the AI-generated summary text in a readable font
- Stats row: duration (e.g. "0:45"), turns (e.g. "4 turns"), languages (e.g. "EN · TA")
- Dismiss button: subtle "×" top right — clears the panel and resets for new conversation
- Entrance animation: slide up + fade in via Framer Motion
- Exit animation: slide down + fade out

**Verification:** Render with mock data in `page.tsx`. Confirm it appears and dismisses correctly.

---

### Checkpoint 7.7 — Wire SummaryPanel into Main Page

File: `frontend/app/page.tsx`

- Add state: `const [sessionSummary, setSessionSummary] = useState<SessionSummaryData | null>(null)`
- In the WebSocket message handler, when `message.type === 'session_summary'`: set `sessionSummary` state
- When orb returns to idle after speaking AND turn count > 0: send `{"type": "end_session"}` to backend
- Render `<SummaryPanel data={sessionSummary} onDismiss={() => setSessionSummary(null)} />` below the transcript
- On dismiss: clear summary, reset transcript entries, ready for new conversation

**Verification:**
- Start backend + frontend
- Have a short conversation (2-3 turns)
- After Voca finishes speaking, orb returns to idle
- Click orb again to end session — summary panel should slide up with the AI summary
- Clicking dismiss clears everything and resets for a new conversation

---

## Constraints

- WhatsApp notifications are a stub only — log to console, do not actually send
- Session data is in-memory — resets on backend restart (acceptable for hackathon)
- Do NOT build export functionality yet
- Focus: session logging → AI summary → summary panel in UI

---

## Code Quality

- SessionService is a singleton — one instance shared across all connections
- All Gemini calls in SessionService are synchronous (summary generation happens after call ends, not during)
- No session data ever sent to the frontend during an active conversation — only after `end_session`
- TypeScript strict mode, no `any` types in frontend components

---

## If You Hit a Problem

1. State the problem in one sentence
2. Two solutions with tradeoffs
3. Recommend one
4. Wait for confirmation

---

## After This Milestone

Once Milestone 7 is verified, the next session targets **Milestone 9 — Demo Hardening** (skipping Milestone 8 Production Readiness for the hackathon — demo quality takes priority).