from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class VoiceConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    murf_voice_id: str
    murf_style: str
    language: str

class UIConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    accent_color: str
    orb_color: str
    label: str

class FAQItem(BaseModel):
    question: str
    answer: str

class KnowledgeBase(BaseModel):
    model_config = ConfigDict(extra="allow")
    faqs: List[FAQItem] = []
    timings: dict = {}
    escalation_keywords: List[str] = []
    emergency_keywords: List[str] = []

class Persona(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    display_name: str
    organization: str
    system_prompt: str
    knowledge_base: KnowledgeBase
    voice_config: VoiceConfig
    ui_config: UIConfig
    escalation_message: str
    emergency_message: Optional[str] = None
