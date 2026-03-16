import logging
import base64
import json
from urllib.parse import parse_qs
from urllib.parse import urlparse

import audioop

from fastapi import APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from config import settings
from services.audio_utils import mulaw_to_pcm16, pcm16_8k_to_16k, wav_24k_to_mulaw_8k
from services.deepgram import DeepgramService, DeepgramServiceError
from services.persona import PersonaNotFoundError
from services.pipeline import VocaPipeline

# Twilio webhook + Media Streams WebSocket endpoint
router = APIRouter()

logger = logging.getLogger("voca.telephony")

PERSONA_PHONE_MAP: dict[str, str] = {}
DEFAULT_PERSONA = "apex"
SILENCE_THRESHOLD = 200
SILENCE_DURATION_MS = 600
TWILIO_SAMPLE_RATE = 8000
TWILIO_MEDIA_CHUNK_SIZE = 160


class TelephonyConfigRequest(BaseModel):
  phone_number: str
  persona_id: str


def get_persona_for_number(phone_number: str) -> str:
    """Return the persona ID mapped to the called phone number."""
    return PERSONA_PHONE_MAP.get(phone_number, DEFAULT_PERSONA)


def get_stream_url(persona_id: str) -> str:
    """Build the Twilio Media Streams websocket URL from the configured public URL."""
    parsed = urlparse(settings.public_url)
    host = parsed.netloc or parsed.path.strip("/")
    return f"wss://{host}/ws/telephony/{persona_id}"


@router.post("/incoming")
async def incoming_call(request: Request) -> Response:
    """Return TwiML that connects the incoming call to the telephony websocket."""
    raw_body = (await request.body()).decode("utf-8")
    form = parse_qs(raw_body)
    called_number = str(form.get("To", [""])[0]).strip()
    persona_id = get_persona_for_number(called_number)
    stream_url = get_stream_url(persona_id)

    logger.info("Incoming call for %s routed to persona %s", called_number or "unknown", persona_id)

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Please hold while I connect you.</Say>
  <Connect>
    <Stream url="{stream_url}" track="inbound_track">
      <Parameter name="persona_id" value="{persona_id}"/>
    </Stream>
  </Connect>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.get("/status")
async def telephony_status() -> dict:
    """Return telephony readiness and configured Twilio number."""
    return {"telephony": "ready", "number": settings.twilio_phone_number}


@router.post("/configure")
async def configure_telephony(request: Request, config: TelephonyConfigRequest) -> dict:
  """Update the runtime phone-number-to-persona mapping."""
  persona_service = request.app.state.persona_service
  try:
    persona_service.get_persona(config.persona_id)
  except PersonaNotFoundError as exc:
    raise HTTPException(status_code=404, detail=str(exc)) from exc

  PERSONA_PHONE_MAP[config.phone_number] = config.persona_id
  logger.info("Configured phone number %s for persona %s", config.phone_number, config.persona_id)
  return {"success": True, "phone_number": config.phone_number, "persona_id": config.persona_id}


async def _transcribe_mulaw_audio(deepgram_service: DeepgramService, mulaw_audio: bytes) -> tuple[str, str]:
  """Convert mulaw audio to Deepgram-ready PCM and return the final transcript and language."""
  pcm8k = mulaw_to_pcm16(mulaw_audio)
  pcm16k = pcm16_8k_to_16k(pcm8k)
  transcripts: list[tuple[str, str, bool]] = []

  async def audio_generator():
    yield pcm16k

  async def on_transcript(transcript: str, language: str, is_final: bool) -> None:
    if transcript.strip():
      transcripts.append((transcript.strip(), language, is_final))

  await deepgram_service.transcribe_stream(audio_generator(), on_transcript)

  final_transcripts = [item for item in transcripts if item[2]]
  if final_transcripts:
    transcript, language, _ = final_transcripts[-1]
    return transcript, language
  if transcripts:
    transcript, language, _ = transcripts[-1]
    return transcript, language
  return "", "en"


async def _synthesize_text_to_mulaw(pipeline: VocaPipeline, text: str) -> bytes:
  """Generate Murf WAV audio for text, then convert it to Twilio mulaw 8kHz."""
  wav_chunks: list[bytes] = []
  async for chunk in await pipeline.generate_audio(text):
    if chunk:
      wav_chunks.append(chunk)
  wav_bytes = b"".join(wav_chunks)
  return wav_24k_to_mulaw_8k(wav_bytes)


async def _send_twilio_media(websocket: WebSocket, stream_sid: str, mulaw_audio: bytes) -> None:
  """Send mulaw audio back to Twilio as base64 media events followed by a mark event."""
  for start in range(0, len(mulaw_audio), TWILIO_MEDIA_CHUNK_SIZE):
    chunk = mulaw_audio[start : start + TWILIO_MEDIA_CHUNK_SIZE]
    payload = base64.b64encode(chunk).decode("ascii")
    await websocket.send_json(
      {
        "event": "media",
        "streamSid": stream_sid,
        "media": {"payload": payload},
      }
    )

  await websocket.send_json(
    {
      "event": "mark",
      "streamSid": stream_sid,
      "mark": {"name": "response_complete"},
    }
  )


@router.websocket("/ws/telephony/{persona_id}")
async def telephony_websocket(websocket: WebSocket, persona_id: str) -> None:
  """Handle Twilio Media Streams for live phone calls."""
  await websocket.accept()

  try:
    pipeline = VocaPipeline(persona_id)
  except PersonaNotFoundError as exc:
    logger.error("Telephony websocket rejected for unknown persona %s", persona_id)
    await websocket.close(code=1008, reason=str(exc))
    return

  deepgram_service = DeepgramService()
  stream_sid = ""
  call_sid = ""
  utterance_buffer = bytearray()
  speaking_detected = False
  silence_ms = 0.0

  async def speak_text(text: str) -> None:
    if not stream_sid:
      return
    mulaw_audio = await _synthesize_text_to_mulaw(pipeline, text)
    await _send_twilio_media(websocket, stream_sid, mulaw_audio)

  try:
    while True:
      message = await websocket.receive_text()
      event = json.loads(message)
      event_type = event.get("event")

      if event_type == "start":
        start_event = event.get("start", {})
        stream_sid = str(start_event.get("streamSid", ""))
        call_sid = str(start_event.get("callSid", ""))
        logger.info("Telephony stream started: callSid=%s streamSid=%s persona=%s", call_sid, stream_sid, persona_id)

        greeting_text = f"Hello, you've reached {pipeline.persona.organization}. How can I help you today?"
        await speak_text(greeting_text)
        continue

      if event_type == "media":
        media = event.get("media", {})
        payload = str(media.get("payload", ""))
        if not payload:
          continue

        mulaw_chunk = base64.b64decode(payload)
        pcm_chunk = mulaw_to_pcm16(mulaw_chunk)
        rms = audioop.rms(pcm_chunk, 2) if pcm_chunk else 0
        chunk_duration_ms = (len(mulaw_chunk) / TWILIO_SAMPLE_RATE) * 1000

        if rms >= SILENCE_THRESHOLD:
          speaking_detected = True
          silence_ms = 0.0
          utterance_buffer.extend(mulaw_chunk)
          continue

        if speaking_detected:
          utterance_buffer.extend(mulaw_chunk)
          silence_ms += chunk_duration_ms
          if silence_ms < SILENCE_DURATION_MS:
            continue

          utterance_audio = bytes(utterance_buffer)
          utterance_buffer.clear()
          speaking_detected = False
          silence_ms = 0.0

          try:
            transcript, transcript_language = await _transcribe_mulaw_audio(deepgram_service, utterance_audio)
            if not transcript:
              await speak_text("I'm having trouble understanding, please hold.")
              continue

            pipeline.current_language = transcript_language or pipeline.current_language
            response_data = await pipeline.respond(transcript)
            await speak_text(response_data["text"])

            if response_data["escalation_needed"]:
              logger.info("Escalation triggered during call %s; WhatsApp notification stub logged", call_sid or "unknown")
              await speak_text(pipeline.persona.escalation_message)
              await websocket.close()
              return
          except (DeepgramServiceError, Exception):
            logger.exception("Telephony turn processing failed")
            await speak_text("I'm having trouble understanding, please hold.")
        continue

      if event_type == "stop":
        logger.info("Telephony stream stopped: callSid=%s streamSid=%s persona=%s", call_sid, stream_sid, persona_id)
        break
  except WebSocketDisconnect:
    logger.info("Telephony websocket disconnected: callSid=%s streamSid=%s persona=%s", call_sid, stream_sid, persona_id)
