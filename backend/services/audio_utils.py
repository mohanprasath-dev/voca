import audioop
import io
import wave


def mulaw_to_pcm16(mulaw_bytes: bytes) -> bytes:
    """Convert mulaw 8kHz bytes to PCM16 8kHz bytes."""
    return audioop.ulaw2lin(mulaw_bytes, 2)


def pcm16_8k_to_16k(pcm_bytes: bytes) -> bytes:
    """Upsample PCM16 from 8kHz to 16kHz for Deepgram."""
    converted, _ = audioop.ratecv(pcm_bytes, 2, 1, 8000, 16000, None)
    return converted


def wav_24k_to_mulaw_8k(wav_bytes: bytes) -> bytes:
    """Convert WAV 24kHz bytes from Murf to mulaw 8kHz bytes for Twilio."""
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav_file:
        sample_width = wav_file.getsampwidth()
        channels = wav_file.getnchannels()
        framerate = wav_file.getframerate()
        frames = wav_file.readframes(wav_file.getnframes())

    if channels != 1:
        frames = audioop.tomono(frames, sample_width, 0.5, 0.5)

    if sample_width != 2:
        frames = audioop.lin2lin(frames, sample_width, 2)

    if framerate != 8000:
        frames, _ = audioop.ratecv(frames, 2, 1, framerate, 8000, None)

    return audioop.lin2ulaw(frames, 2)