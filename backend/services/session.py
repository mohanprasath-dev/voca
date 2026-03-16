from datetime import datetime
import logging
import uuid

from google import genai

from config import settings
from models.session import SessionSummary, TranscriptTurn


logger = logging.getLogger("voca.session")


class SessionService:
    def __init__(self):
        self._sessions: dict[str, SessionSummary] = {}
        self._client = genai.Client(api_key=settings.gemini_api_key)

    def create_session(self, persona_id: str, persona_name: str) -> str:
        """Create a new session, return session_id."""
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = SessionSummary(
            session_id=session_id,
            persona_id=persona_id,
            persona_name=persona_name,
            started_at=datetime.now(),
            transcript=[],
            detected_languages=[],
        )
        return session_id

    def add_turn(self, session_id: str, role: str, text: str, language: str) -> None:
        """Append a transcript turn to the session."""
        session = self._sessions.get(session_id)
        if not session:
            return

        turn = TranscriptTurn(
            role=role,
            text=text,
            language=language,
            timestamp=datetime.now(),
        )
        session.transcript.append(turn)

    def mark_escalated(self, session_id: str, reason: str) -> None:
        """Mark session as escalated with reason."""
        session = self._sessions.get(session_id)
        if not session:
            return
        session.escalated = True
        session.escalation_reason = reason

    def _build_summary(self, session: SessionSummary) -> str:
        if not session.transcript:
            return "No conversation recorded."

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

        response = self._client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return (response.text or "").strip() or "No conversation recorded."

    def end_session(self, session_id: str) -> SessionSummary:
        """Close and finalize the session summary."""
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"Session not found: {session_id}")

        if session.ended_at is None:
            session.ended_at = datetime.now()
            session.duration_seconds = max(
                (session.ended_at - session.started_at).total_seconds(),
                0.0,
            )
            session.turn_count = len(session.transcript)

            seen_languages: set[str] = set()
            ordered_languages: list[str] = []
            for turn in session.transcript:
                if turn.language not in seen_languages:
                    seen_languages.add(turn.language)
                    ordered_languages.append(turn.language)
            session.detected_languages = ordered_languages

            if session.escalated:
                session.resolution_status = "escalated"
            elif session.turn_count > 0:
                session.resolution_status = "resolved"
            else:
                session.resolution_status = "abandoned"

            try:
                session.summary = self._build_summary(session)
            except Exception:
                logger.exception("Failed to generate session summary for %s", session_id)
                session.summary = "No conversation recorded." if session.turn_count == 0 else "Summary unavailable due to a temporary error."

        return session

    def get_session(self, session_id: str) -> SessionSummary | None:
        """Return session by ID or None."""
        return self._sessions.get(session_id)

    def list_sessions(self, limit: int = 20) -> list[SessionSummary]:
        """Return most recent sessions, newest first."""
        sessions = sorted(
            self._sessions.values(),
            key=lambda item: item.started_at,
            reverse=True,
        )
        return sessions[:limit]
