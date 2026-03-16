from pydantic import BaseModel


class VoiceConfig(BaseModel):
    murf_voice_id: str
    murf_style: str
    language: str


class UIConfig(BaseModel):
    accent_color: str
    orb_color: str
    label: str


class KnowledgeBase(BaseModel):
    faqs: list[dict]
    timings: dict
    escalation_keywords: list[str]
    emergency_keywords: list[str]


class PersonaConfig(BaseModel):
    id: str
    name: str
    display_name: str
    organization: str
    system_prompt: str
    knowledge_base: KnowledgeBase
    voice_config: VoiceConfig
    ui_config: UIConfig
    escalation_message: str
    emergency_message: str
