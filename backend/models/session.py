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
