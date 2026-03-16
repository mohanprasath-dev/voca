# Voca — AI Agent Working Instructions

> Read `prompt.md` fully before starting. Pay special attention to the Telephony Architecture section.
> Milestones 1–5 are complete. Do not touch anything from those milestones.

---

## Environment

- Python 3.14, venv: `D:\Projects\voca\.venv\`
- Backend: `D:\Projects\voca\backend\`
- Activate: `d:\Projects\voca\.venv\Scripts\Activate.ps1`
- Gemini SDK: `google-genai`, model: `gemini-2.5-flash`

---

## Current Session Target

### MILESTONE 6 — TELEPHONY LAYER

By the end of this milestone, calling the Twilio phone number must connect to Voca's brain, speak naturally, and hear Murf Falcon's voice respond — over a real phone call.

---

### Checkpoint 6.1 — Install Audio Conversion Dependencies

Twilio streams mulaw 8kHz audio. Deepgram needs PCM 16kHz. Murf returns WAV 24kHz. Conversion is required at every step.

Install required packages:

```bash
pip install audioop-lts
```

Note: `audioop` was removed from Python 3.13+ stdlib. `audioop-lts` is the drop-in replacement. Import it as `import audioop`.

Also install ngrok for local tunneling (needed for Twilio webhooks to reach localhost):

```bash
npm install -g ngrok
```

**Verification:**
```bash
python -c "import audioop; print('audioop OK')"
```
Must print `audioop OK`.

---

### Checkpoint 6.2 — Audio Conversion Utility

File: `backend/services/audio_utils.py`

Build audio conversion functions used by the telephony pipeline:

```python
def mulaw_to_pcm16(mulaw_bytes: bytes) -> bytes:
    """Convert mulaw 8kHz bytes to PCM16 8kHz bytes."""

def pcm16_8k_to_16k(pcm_bytes: bytes) -> bytes:
    """Upsample PCM16 from 8kHz to 16kHz for Deepgram."""

def wav_24k_to_mulaw_8k(wav_bytes: bytes) -> bytes:
    """Convert WAV 24kHz (from Murf) to mulaw 8kHz for Twilio.
    Steps: strip WAV header → resample 24k→8k → PCM→mulaw encode"""
```

All functions use `audioop` for conversion. No external libraries.

**Verification:**
```bash
python -c "
from services.audio_utils import mulaw_to_pcm16, pcm16_8k_to_16k, wav_24k_to_mulaw_8k
# Test with synthetic silence (zero bytes)
mulaw_silence = bytes([0xFF] * 160)  # 20ms of mulaw silence
pcm = mulaw_to_pcm16(mulaw_silence)
pcm16k = pcm16_8k_to_16k(pcm)
print(f'mulaw→pcm: {len(mulaw_silence)} → {len(pcm)} bytes')
print(f'8k→16k: {len(pcm)} → {len(pcm16k)} bytes')
print('Audio utils OK')
"
```
Must print byte counts and `Audio utils OK`.

---

### Checkpoint 6.3 — Twilio Incoming Call Webhook

File: `backend/api/routes/telephony.py`

Build the TwiML webhook endpoint that Twilio hits when a call comes in:

**`POST /telephony/incoming`**

- Accepts Twilio's form-encoded POST request
- Reads `To` parameter to determine which Twilio number was called
- Maps number to persona (or defaults to `apex` if no mapping found)
- Returns TwiML XML response that:
  - Greets the caller with a brief `<Say>` message using a natural voice
  - Opens a `<Connect><Stream>` pointing to `wss://{host}/ws/telephony/{persona_id}`
  - Sets `track="inbound_track"` on the Stream

TwiML response format:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://{host}/ws/telephony/{persona_id}">
      <Parameter name="persona_id" value="{persona_id}"/>
    </Stream>
  </Connect>
</Response>
```

- `host` must be read from a `PUBLIC_URL` environment variable (set to ngrok URL during demo)
- Add `PUBLIC_URL` to `config.py` and `.env`
- Response Content-Type must be `application/xml`

**`GET /telephony/status`** — health check returning `{"telephony": "ready", "number": "<TWILIO_PHONE_NUMBER>"}`

**Verification:**
```bash
curl -X POST http://localhost:8000/telephony/incoming \
  -d "To=%2B15551234567&From=%2B919876543210&CallSid=CA123"
```
Must return valid TwiML XML with a `<Stream url="wss://...">` element.

---

### Checkpoint 6.4 — Telephony WebSocket Handler

File: `backend/api/routes/telephony.py`

Build the WebSocket endpoint at `/ws/telephony/{persona_id}` that handles the Twilio Media Stream:

**Connection lifecycle:**
1. On WebSocket connect: create `VocaPipeline` for the persona
2. Wait for Twilio `start` event — extract `streamSid`, log call start
3. Send Voca's greeting audio immediately:
   - Generate greeting via Gemini: "Hello, you've reached [org name]. How can I help you today?"
   - Convert to Murf TTS → WAV → mulaw 8kHz
   - Send to Twilio as base64 media event
4. Accumulate incoming `media` events — decode base64 → mulaw bytes
5. Use VAD (Voice Activity Detection) to detect end of speech:
   - Simple energy-based VAD: if 600ms of silence detected after speech, treat as end of utterance
   - Silence threshold: RMS of mulaw chunk below 200
6. On end of utterance:
   - Convert accumulated mulaw → PCM16 8kHz → PCM16 16kHz
   - Send to Deepgram STT → get transcript
   - Send transcript to Gemini via pipeline → get response text
   - Convert response to Murf TTS → WAV → mulaw 8kHz
   - Stream mulaw back to Twilio as base64 media events
   - Send `mark` event when done
7. On Twilio `stop` event: log call end, close pipeline

**Escalation handling:**
- If `pipeline.escalation_needed` is True after a turn:
  - Speak the persona's `escalation_message` via Murf
  - Send a WhatsApp notification to the business owner (Milestone 7 stub — just log for now)
  - End the call gracefully

**Error handling:**
- If Deepgram or Gemini fails mid-call: speak a fallback message via Murf ("I'm having trouble understanding, please hold")
- Never go silent — Voca must always say something

**Verification:** Cannot fully verify without ngrok + Twilio. Instead, create a unit test:
```bash
python -c "
import asyncio
from services.audio_utils import mulaw_to_pcm16, pcm16_8k_to_16k
from services.pipeline import VocaPipeline

async def test():
    p = VocaPipeline('apex')
    print(f'Pipeline ready for telephony: {p.persona.name}')
    # Simulate audio processing
    mulaw_silence = bytes([0xFF] * 1600)  # 200ms silence
    pcm = mulaw_to_pcm16(mulaw_silence)
    pcm16k = pcm16_8k_to_16k(pcm)
    print(f'Audio conversion pipeline: {len(mulaw_silence)} → {len(pcm16k)} bytes')
    print('Telephony pipeline ready')

asyncio.run(test())
"
```

---

### Checkpoint 6.5 — Number-to-Persona Routing

File: `backend/api/routes/telephony.py`

Add a `PERSONA_PHONE_MAP` at the top of the telephony router:

```python
# Maps Twilio phone numbers to persona IDs
# Add your Twilio numbers here
PERSONA_PHONE_MAP: dict[str, str] = {
    # "+15551234567": "aura",  # Hospital line
    # "+15557654321": "nova",  # University line
}
DEFAULT_PERSONA = "apex"

def get_persona_for_number(phone_number: str) -> str:
    return PERSONA_PHONE_MAP.get(phone_number, DEFAULT_PERSONA)
```

Also add a `POST /telephony/configure` endpoint that allows updating the map at runtime:
```json
{"phone_number": "+15551234567", "persona_id": "aura"}
```

This means on demo day, you can assign specific numbers to specific personas without restarting the backend.

**Verification:**
```bash
curl -X POST http://localhost:8000/telephony/configure \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+15551234567", "persona_id": "aura"}'
```
Must return `{"success": true, "phone_number": "+15551234567", "persona_id": "aura"}`.

---

### Checkpoint 6.6 — Register Routes in main.py

File: `backend/main.py`

Ensure the telephony router is registered:

```python
from api.routes.telephony import router as telephony_router
app.include_router(telephony_router, prefix="/telephony")
app.include_router(telephony_router)  # for /ws/telephony WebSocket (no prefix)
```

Add `PUBLIC_URL` to `backend/config.py`:
```python
public_url: str = "http://localhost:8000"
```

Add to `.env`:
```
PUBLIC_URL=http://localhost:8000
```

**Verification:**
```bash
uvicorn main:app --reload
curl http://localhost:8000/telephony/status
```
Must return `{"telephony": "ready"}`.

---

### Checkpoint 6.7 — ngrok Tunnel Setup

This is the bridge between Twilio (cloud) and your local FastAPI server.

Start ngrok:
```bash
ngrok http 8000
```

Copy the `https://xxxx.ngrok.io` URL. Update `.env`:
```
PUBLIC_URL=https://xxxx.ngrok.io
```

In the Twilio Console:
1. Go to Phone Numbers → Manage → Active Numbers
2. Click your number
3. Under Voice & Fax → A Call Comes In → Webhook:
   - Set to: `https://xxxx.ngrok.io/telephony/incoming`
   - Method: HTTP POST
4. Save

**Verification:** Call the Twilio number from your phone. The call should connect. Even if audio isn't working yet, the call connecting confirms the webhook is wired correctly.

---

### Checkpoint 6.8 — End-to-End Phone Call Test

With backend running, ngrok tunneling, and Twilio configured:

1. Call the Twilio number
2. Confirm Voca answers with a greeting (Murf voice)
3. Speak a sentence — confirm Voca responds intelligently
4. Speak in Tamil — confirm Voca responds in Tamil
5. Say something that triggers escalation — confirm escalation message is spoken

**Definition of done:** Full natural voice conversation works over a real phone call. Murf Falcon's voice answers. The conversation feels real.

---

## Constraints

- Do NOT build WhatsApp notifications yet (Milestone 7)
- Do NOT build session logging yet (Milestone 7)
- Focus entirely on: audio conversion → TwiML webhook → Media Streams WebSocket → full phone call working

---

## Code Quality

- `audioop` for all audio conversion — no ffmpeg, no subprocess
- All WebSocket handling is async
- mulaw↔PCM conversion is in `audio_utils.py` — not inline in the route
- Twilio credentials loaded from config, never hardcoded

---

## If You Hit a Problem

1. State the problem in one sentence
2. Two solutions with tradeoffs
3. Recommend one
4. Wait for confirmation

---

## After This Milestone

Once a real phone call works end-to-end, the next session targets **Milestone 7 — Post-Call Intelligence**.