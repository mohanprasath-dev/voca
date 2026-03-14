from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    language_detected: Optional[str] = None

class SessionSummary(BaseModel):
    intent: Optional[str] = None
    resolution_status: Optional[str] = None
    escalation_needed: bool = False
    sentiment: Optional[str] = None
    action_items: List[str] = []

class Session(BaseModel):
    session_id: str
    persona_id: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List[Message] = []
    summary: Optional[SessionSummary] = None
    caller_number: Optional[str] = None
