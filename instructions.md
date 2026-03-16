# Voca — AI Agent Working Instructions

> Read `prompt.md` fully before starting. Every architectural decision in that file is final.
> This file tells you what to build RIGHT NOW.
> Milestones 1 and 2 are complete. Do not touch anything from those milestones.

---

## Your Role

You are a senior full-stack engineer building Voca — a world-class real-time voice AI platform. You write clean, production-grade async Python. You build each checkpoint fully before moving to the next. You never skip verification steps.

---

## Environment (Confirmed Working)

- Python 3.14
- Virtual env: `D:\Projects\voca\.venv\` — always activate before running
- Backend: `D:\Projects\voca\backend\`
- Backend URL: `http://localhost:8000`
- Activate command: `d:\Projects\voca\.venv\Scripts\Activate.ps1`
- Gemini SDK: `google-genai` — import as `from google import genai`
- **DO NOT use `google.generativeai` — it is deprecated and will error**

---

## How to Work

1. **Read `prompt.md` fully before starting**
2. **Build one checkpoint at a time** — do not jump ahead
3. **Run the verification step after every checkpoint** before moving on
4. **All Python must be async** — no blocking calls anywhere
5. **If a verification fails, fix it before proceeding** — do not leave broken checkpoints behind
6. **After each checkpoint, confirm it works before moving to the next**

---

## Current Session Target

### MILESTONE 3 — PERSONA ENGINE

The persona engine is what makes Voca different from any generic voice chatbot. By the end of this milestone, Voca must be able to load any persona config, inject it into the pipeline, and switch personas at runtime with zero code changes. The persona defines everything: the voice, the system prompt, the knowledge base, the escalation rules, and the UI config.

---

### Checkpoint 3.0 — Fix gemini.py to use google-genai SDK

**This must be done first. Do not skip it.**

The existing `backend/services/gemini.py` was written with the deprecated `google.generativeai` SDK. Rewrite it completely to use the new `google-genai` SDK.

Correct import and usage pattern:
```python
from google import genai

client = genai.Client(api_key=settings.gemini_api_key)
response = client.models.generate_content(
  model="gemini-2.5-flash",
    contents="your prompt here"
)
text = response.text
```

The rewritten `GeminiService` class must:
- Use `from google import genai` — no other Google AI import
- Initialise `genai.Client` once at class level, not per-call
- Method: `async def respond(self, message: str, system_prompt: str, history: list[dict]) -> tuple[str, str]`
- Build `contents` by combining system_prompt + history + current message into a single structured prompt string
- Always instruct Gemini to start its response with `[LANG:xx]` where xx is the ISO language code
- Strip `[LANG:xx]` from the spoken text before returning
- Return: `tuple[str, str]` — `(response_text, detected_language_code)`
- Handle API errors with `GeminiServiceError`
- Use `logging` not `print`

**Verification:**
```bash
cd D:\Projects\voca\backend
d:\Projects\voca\.venv\Scripts\Activate.ps1
python -c "
from google import genai
from config import settings

client = genai.Client(api_key=settings.gemini_api_key)
response = client.models.generate_content(
  model='gemini-2.5-flash',
    contents='Say hello. Start your response with [LANG:en]'
)
print(response.text)
"
```
Must print a response starting with `[LANG:en]`. No errors.

---

### Checkpoint 3.1 — Enrich Persona JSON Files

The three persona JSON files already exist but likely have placeholder system prompts and empty knowledge bases. Replace them with the full production-quality content below.

**File: `backend/personas/aura.json`**

```json
{
  "id": "aura",
  "name": "Aura",
  "display_name": "Aura — Hospital Front Desk",
  "organization": "City General Hospital",
  "system_prompt": "You are Aura, the AI voice receptionist for City General Hospital. You are calm, empathetic, and unhurried. You speak clearly and reassuringly. Your job is to help patients and their families with appointments, doctor timings, test preparation, and report status. You never give medical advice — for medical questions, you always say you will connect them with the appropriate medical staff. You detect the caller's language and always respond in the same language. Always start your response with [LANG:xx] where xx is the ISO code of the language you are responding in. Keep responses concise — this is a voice conversation, not a text chat. Speak in complete natural sentences, not bullet points. If the caller seems distressed or mentions an emergency keyword (chest pain, unconscious, not breathing, bleeding, accident), immediately say you are connecting them to emergency services and set escalation_needed=true in your response.",
  "knowledge_base": {
    "faqs": [
      {"q": "What are your visiting hours?", "a": "Our visiting hours are 9 AM to 12 PM and 4 PM to 7 PM daily."},
      {"q": "How do I book an appointment?", "a": "I can book an appointment for you right now. Which department or doctor are you looking for?"},
      {"q": "What documents do I need to bring?", "a": "Please bring a valid photo ID, your insurance card if applicable, and any previous medical records relevant to your visit."},
      {"q": "Where is the hospital located?", "a": "City General Hospital is located at 14 Anna Salai, Chennai. We are open 24 hours for emergencies."},
      {"q": "How do I get my test reports?", "a": "Test reports are typically ready within 24 to 48 hours. You can collect them from the reports counter on the ground floor, or we can email them to you."}
    ],
    "timings": {
      "general_opd": "8 AM to 8 PM, Monday to Saturday",
      "emergency": "24 hours, 7 days",
      "lab": "7 AM to 9 PM, all days",
      "pharmacy": "24 hours"
    },
    "escalation_keywords": ["billing dispute", "complaint", "wrong medication", "medical records", "insurance claim", "legal"],
    "emergency_keywords": ["chest pain", "heart attack", "not breathing", "unconscious", "bleeding heavily", "stroke", "seizure", "accident", "emergency"]
  },
  "voice_config": {
    "murf_voice_id": "en-IN-rohan",
    "murf_style": "Conversational",
    "language": "en-IN"
  },
  "ui_config": {
    "accent_color": "#00C2B8",
    "orb_color": "#00C2B8",
    "label": "Hospital"
  },
  "escalation_message": "I understand this requires personal attention. Let me connect you with one of our team members right away. Please hold for just a moment.",
  "emergency_message": "This sounds like an emergency. I am connecting you to our emergency team immediately. Please stay on the line."
}
```

**File: `backend/personas/nova.json`**

```json
{
  "id": "nova",
  "name": "Nova",
  "display_name": "Nova — University Admin",
  "organization": "Horizon University",
  "system_prompt": "You are Nova, the AI voice assistant for Horizon University's administrative office. You are warm, structured, and encouraging. You help students, parents, and prospective applicants with admissions, fees, exam schedules, results, and course information. You are patient with confused or anxious callers — many are students under pressure. You detect the caller's language and always respond in the same language. Always start your response with [LANG:xx] where xx is the ISO code of the language you are responding in. Keep responses concise and conversational — this is a voice call. If someone asks about scholarships, disciplinary matters, or complaints about faculty, escalate to a human advisor and set escalation_needed=true.",
  "knowledge_base": {
    "faqs": [
      {"q": "When does admission open?", "a": "Admissions for the upcoming academic year open on April 1st. Applications close on June 15th."},
      {"q": "What is the fee structure?", "a": "Tuition fees vary by program. For undergraduate programs, the annual fee ranges from 80,000 to 1,50,000 rupees. I can connect you with the admissions office for a detailed breakdown."},
      {"q": "When are the semester exams?", "a": "Semester exams are scheduled for November for the first semester and April for the second semester. Exact timetables are posted on the university portal two weeks before exams."},
      {"q": "How do I check my results?", "a": "Results are published on the university's online portal at results.horizonuniversity.edu.in within 30 days of the exam."},
      {"q": "What courses do you offer?", "a": "We offer undergraduate and postgraduate programs in Engineering, Business, Arts, Sciences, and Law. Would you like details on a specific program?"}
    ],
    "timings": {
      "admin_office": "9 AM to 5 PM, Monday to Friday",
      "admissions": "9 AM to 6 PM, Monday to Saturday during admission season",
      "exam_cell": "10 AM to 4 PM, Monday to Friday"
    },
    "escalation_keywords": ["scholarship", "fee waiver", "disciplinary", "complaint", "faculty issue", "rustication", "appeal", "legal"],
    "emergency_keywords": []
  },
  "voice_config": {
    "murf_voice_id": "en-IN-priya",
    "murf_style": "Conversational",
    "language": "en-IN"
  },
  "ui_config": {
    "accent_color": "#F59E0B",
    "orb_color": "#F59E0B",
    "label": "University"
  },
  "escalation_message": "This is something our advisor handles personally. Let me transfer you to the right person. They will be able to help you fully.",
  "emergency_message": ""
}
```

**File: `backend/personas/apex.json`**

```json
{
  "id": "apex",
  "name": "Apex",
  "display_name": "Apex — Customer Support",
  "organization": "Apex SaaS",
  "system_prompt": "You are Apex, the AI voice support agent for Apex SaaS. You are sharp, fast, and solution-oriented — but friendly. You get to the point quickly. You help customers with product questions, billing, onboarding, feature requests, and bug reports. You detect the caller's language and always respond in the same language. Always start your response with [LANG:xx] where xx is the ISO code of the language you are responding in. Keep responses short and direct — this is a voice conversation. Avoid jargon. If someone asks for a refund, mentions a legal issue, or reports a data breach, escalate immediately and set escalation_needed=true.",
  "knowledge_base": {
    "faqs": [
      {"q": "How do I reset my password?", "a": "Go to the login page and click Forgot Password. You will receive a reset link on your registered email within 2 minutes."},
      {"q": "What plans do you offer?", "a": "We have three plans: Starter at 999 rupees per month, Growth at 2,999 rupees per month, and Enterprise with custom pricing. All plans include a 14-day free trial."},
      {"q": "How do I cancel my subscription?", "a": "You can cancel anytime from your account settings under Billing. Your access continues until the end of your billing period."},
      {"q": "Is there a mobile app?", "a": "Yes, our app is available on both iOS and Android. Search for Apex SaaS in your app store."},
      {"q": "How do I export my data?", "a": "Go to Settings, then Data Management, and click Export. Your data will be emailed to you as a CSV within 10 minutes."}
    ],
    "timings": {
      "support": "9 AM to 9 PM, Monday to Saturday",
      "billing": "10 AM to 6 PM, Monday to Friday"
    },
    "escalation_keywords": ["refund", "legal", "data breach", "hack", "lawsuit", "charge back", "fraud", "GDPR"],
    "emergency_keywords": []
  },
  "voice_config": {
    "murf_voice_id": "en-IN-arjun",
    "murf_style": "Conversational",
    "language": "en-IN"
  },
  "ui_config": {
    "accent_color": "#6366F1",
    "orb_color": "#6366F1",
    "label": "Startup"
  },
  "escalation_message": "This needs a human to handle properly. I am connecting you with our specialist team right now. One moment.",
  "emergency_message": ""
}
```

**Verification:** Run the backend and confirm it logs `Loaded 3 personas` on startup with no JSON errors.

---

### Checkpoint 3.2 — Rewrite PersonaService

File: `backend/services/persona.py`

Build a `PersonaService` class that is the single source of truth for persona access:

- Loads all persona JSON files from `backend/personas/` at startup — once, not on every request
- Validates each persona against the `PersonaConfig` Pydantic model
- Method: `get_persona(persona_id: str) -> PersonaConfig` — raises `PersonaNotFoundError` if not found
- Method: `list_personas() -> list[PersonaConfig]` — returns all loaded personas
- Method: `get_system_prompt(persona_id: str) -> str` — returns system prompt with knowledge base injected
  - Appends a `KNOWLEDGE BASE:` section with FAQs, timings, escalation keywords, and emergency keywords in plain text
- Method: `get_voice_config(persona_id: str) -> dict` — returns voice_config dict
- Singleton pattern — instantiated once in `main.py`, injected via FastAPI dependency
- Logs persona names and count at startup

**Verification:**
```bash
python -c "
from services.persona import PersonaService
ps = PersonaService()
p = ps.get_persona('apex')
print(p.name)
print(p.voice_config)
prompt = ps.get_system_prompt('aura')
print(prompt[:200])
print(f'Loaded: {len(ps.list_personas())} personas')
"
```
Must print Apex, the voice config dict, the first 200 chars of Aura's system prompt, and `Loaded: 3 personas`.

---

### Checkpoint 3.3 — Update Pydantic Models

File: `backend/models/persona.py`

Ensure `PersonaConfig` matches the full schema exactly:

```python
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
```

**Verification:** Checkpoint 3.2 verification must still pass after this update.

---

### Checkpoint 3.4 — Persona API Endpoints

File: `backend/api/routes/dashboard.py`

Add two GET endpoints:

**`GET /personas`** — returns all personas (id, name, display_name, ui_config only — never system_prompt)

Response:
```json
[
  {
    "id": "aura",
    "name": "Aura",
    "display_name": "Aura — Hospital Front Desk",
    "ui_config": {"accent_color": "#00C2B8", "orb_color": "#00C2B8", "label": "Hospital"}
  }
]
```

**`GET /personas/{persona_id}`** — returns full persona config minus system_prompt

Both use singleton `PersonaService` via FastAPI dependency injection.

**Verification:**
```bash
uvicorn main:app --reload
curl http://localhost:8000/personas
```
Must return JSON array with 3 personas. Must NOT include system_prompt field.

---

### Checkpoint 3.5 — Wire Persona into Pipeline

File: `backend/services/pipeline.py`

Update `VocaPipeline` to use `PersonaService` correctly:

- Accept `persona_id: str` at init
- Load persona, system_prompt, and voice_config from `PersonaService` at init
- Use `voice_config["murf_voice_id"]` and `voice_config["murf_style"]` when calling Murf
- Use `system_prompt` when calling Gemini
- Escalation detection: check if any `escalation_keywords` from persona appear in Gemini response, or if response contains `escalation_needed=true`
  - If triggered: set `self.escalation_needed = True` and `self.escalation_summary`

**Verification:**
```bash
python -c "
import asyncio
from services.pipeline import VocaPipeline

async def test():
    p = VocaPipeline('apex')
    print(f'Persona: {p.persona.name}')
    print(f'Voice: {p.voice_config}')
    print(f'Prompt starts: {p.system_prompt[:80]}')

asyncio.run(test())
"
```
Must print Apex's name, voice config, and first 80 chars of system prompt with no errors.

---

### Checkpoint 3.6 — Persona Switch on WebSocket

File: `backend/api/routes/browser.py`

Update the WebSocket handler at `/ws/browser/{persona_id}` to:

- On connect, send: `{"type": "persona_loaded", "persona_id": "...", "display_name": "...", "ui_config": {...}}`
- Support runtime switch: if client sends `{"type": "switch_persona", "persona_id": "nova"}`, create a new `VocaPipeline` with the new persona and send another `persona_loaded` message
- Persona switch resets conversation history
- All existing message types (transcript, response, escalation, error) must still work

**Verification:**
```bash
wscat -c ws://localhost:8000/ws/browser/apex
```
Must receive `{"type":"persona_loaded","persona_id":"apex",...}` immediately on connection.

---

## Constraints For This Session

- Do NOT build browser UI (Milestone 5)
- Do NOT build Twilio telephony (Milestone 6)
- Do NOT build session logging or WhatsApp (Milestone 7)
- Focus entirely on: persona data → PersonaService → pipeline wiring → API endpoints → WebSocket persona switch

---

## Code Quality Standards

- Every service class has a docstring
- Every method has type hints
- Specific error classes: `PersonaNotFoundError`, `GeminiServiceError`
- No print statements — use `logging` with `voca.{service_name}` logger name
- Persona JSON files are the source of truth — no persona data hardcoded in Python

---

## If You Hit a Problem

1. State the problem in one sentence
2. Give two solutions with tradeoffs
3. Recommend one
4. Wait for confirmation

---

## After This Milestone

Once Milestone 3 is verified end-to-end, the next session targets **Milestone 4 — Multilingual Intelligence**.