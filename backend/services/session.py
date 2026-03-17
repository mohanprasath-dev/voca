from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from config import settings
from models.session import Message, Session, SessionSummary

logger = logging.getLogger("voca")

SUMMARY_PROMPT = (
    "You are a post-call analyst. Given the transcript below, return ONLY a valid "
    "JSON object with these keys:\n"
    '  "intent": short description of what the caller wanted,\n'
    '  "resolution_status": "resolved" | "escalated" | "unresolved",\n'
    '  "escalation_needed": boolean,\n'
    '  "sentiment": "positive" | "neutral" | "negative",\n'
    '  "action_items": list of follow-up strings,\n'
    '  "summary_text": a 2-3 sentence human-readable summary.\n'
    "Do not wrap in markdown."
)


class SessionService:
    """In-memory session store with AI summary via Gemini."""

    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}
        self._summaries_text: dict[str, str] = {}
        self._store_path = Path(__file__).resolve().parents[1] / "data" / "sessions.json"
        self._api_key = settings.gemini_api_key
        self._model = "gemini-3.1-flash-lite"
        self._endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self._model}:generateContent"
        )
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        if not self._store_path.exists():
            self._sessions = {}
            self._summaries_text = {}
            return

        try:
            payload = json.loads(self._store_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            logger.warning("Session store unreadable, starting fresh in-memory state: %s", exc)
            self._sessions = {}
            self._summaries_text = {}
            return
        sessions_payload = payload.get("sessions", {})
        summaries_payload = payload.get("summaries_text", {})

        self._sessions = {
            session_id: Session.model_validate(session_data)
            for session_id, session_data in sessions_payload.items()
        }
        self._summaries_text = {
            str(session_id): str(summary)
            for session_id, summary in summaries_payload.items()
        }

    def _save_to_disk(self) -> None:
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "sessions": {
                session_id: session.model_dump(mode="json")
                for session_id, session in self._sessions.items()
            },
            "summaries_text": self._summaries_text,
        }
        tmp_path = self._store_path.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
        tmp_path.replace(self._store_path)

    def create_session(self, persona_id: str) -> Session:
        self._load_from_disk()
        session_id = str(uuid.uuid4())[:8]
        session = Session(session_id=session_id, persona_id=persona_id)
        self._sessions[session_id] = session
        self._save_to_disk()
        logger.info("Session created: %s for persona %s", session_id, persona_id)
        return session

    def get_session(self, session_id: str) -> Session | None:
        self._load_from_disk()
        return self._sessions.get(session_id)

    def add_message(self, session_id: str, message: Message) -> None:
        self._load_from_disk()
        session = self._sessions.get(session_id)
        if session:
            session.messages.append(message)
            self._save_to_disk()

    async def end_session(self, session_id: str) -> dict[str, Any]:
        self._load_from_disk()
        session = self._sessions.get(session_id)
        if not session:
            return {"summary": "Session not found."}

        ended_at = datetime.now(UTC)
        duration_seconds = int((ended_at - session.started_at).total_seconds())
        turn_count = len([m for m in session.messages if m.role == "user"])
        languages = list({
            m.language_detected
            for m in session.messages
            if m.language_detected
        })

        summary_text = "Session completed."
        structured_summary: SessionSummary | None = None
        try:
            summary_payload = await self._generate_ai_summary(session)
            structured_summary = summary_payload.get("structured_summary")
            summary_text = summary_payload.get("summary_text", summary_text)
        except Exception as exc:
            logger.error("AI summary generation failed: %s", exc)

        if structured_summary is not None:
            session.summary = structured_summary

        self._summaries_text[session_id] = summary_text
        self._save_to_disk()

        return {
            "session_id": session_id,
            "summary": summary_text,
            "duration_seconds": duration_seconds,
            "turn_count": turn_count,
            "languages_used": languages,
            "persona_id": session.persona_id,
        }

    def list_sessions(self) -> list[dict[str, Any]]:
        self._load_from_disk()
        results: list[dict[str, Any]] = []
        for sid, session in self._sessions.items():
            ended_at = datetime.now(UTC)
            duration = int((ended_at - session.started_at).total_seconds())
            turn_count = len([m for m in session.messages if m.role == "user"])
            languages = list({
                m.language_detected
                for m in session.messages
                if m.language_detected
            })
            summary_text = self._summaries_text.get(sid, "")
            escalated = session.summary.escalation_needed if session.summary else False

            results.append({
                "session_id": sid,
                "persona_id": session.persona_id,
                "started_at": session.started_at.isoformat(),
                "duration_seconds": duration,
                "turn_count": turn_count,
                "languages_used": languages,
                "resolution_status": session.summary.resolution_status if session.summary else "completed",
                "escalation_needed": escalated,
                "summary_text": summary_text,
                "messages": [
                    {
                        "role": m.role,
                        "content": m.content,
                        "language_detected": m.language_detected,
                        "timestamp": m.timestamp.isoformat(),
                    }
                    for m in session.messages
                ],
            })
        return results

    def get_stats(self) -> dict[str, Any]:
        self._load_from_disk()
        total = len(self._sessions)
        resolved = 0
        escalated = 0
        durations: list[int] = []
        all_languages: set[str] = set()

        for sid, session in self._sessions.items():
            duration = int((datetime.now(UTC) - session.started_at).total_seconds())
            durations.append(duration)

            for m in session.messages:
                if m.language_detected:
                    all_languages.add(m.language_detected)

            if session.summary:
                if session.summary.escalation_needed:
                    escalated += 1
                elif session.summary.resolution_status == "resolved":
                    resolved += 1

        avg_duration = round(sum(durations) / max(len(durations), 1))

        return {
            "total_sessions": total,
            "resolved": resolved,
            "escalated": escalated,
            "avg_duration_seconds": avg_duration,
            "languages_used": sorted(all_languages),
        }

    async def _generate_ai_summary(self, session: Session) -> dict[str, Any]:
        if not session.messages:
            return {
                "summary_text": "No conversation recorded.",
                "structured_summary": SessionSummary(),
            }

        transcript_lines: list[str] = []
        for msg in session.messages:
            role_label = "Caller" if msg.role == "user" else "Agent"
            transcript_lines.append(f"{role_label}: {msg.content}")

        transcript_text = "\n".join(transcript_lines)

        payload = {
            "system_instruction": {
                "parts": [{"text": SUMMARY_PROMPT}],
            },
            "contents": [
                {"role": "user", "parts": [{"text": transcript_text}]},
            ],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 400,
            },
        }

        params = {"key": self._api_key}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self._endpoint, params=params, json=payload)
            response.raise_for_status()
            data = response.json()

        candidates = data.get("candidates", [])
        if not candidates:
            return {
                "summary_text": "Unable to generate summary.",
                "structured_summary": SessionSummary(),
            }

        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()

        # Try to parse JSON to get both summary_text and structured fields.
        try:
            cleaned = text
            if cleaned.startswith("```"):
                cleaned = cleaned.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(cleaned)
            structured = SessionSummary(
                intent=parsed.get("intent"),
                resolution_status=parsed.get("resolution_status"),
                escalation_needed=bool(parsed.get("escalation_needed", False)),
                sentiment=parsed.get("sentiment"),
                action_items=list(parsed.get("action_items", [])),
            )
            return {
                "summary_text": str(parsed.get("summary_text", text)),
                "structured_summary": structured,
            }
        except (json.JSONDecodeError, KeyError):
            return {
                "summary_text": text,
                "structured_summary": SessionSummary(),
            }


# Module-level singleton
_session_service: SessionService | None = None


def get_session_service() -> SessionService:
    global _session_service
    if _session_service is None:
        _session_service = SessionService()
    return _session_service
