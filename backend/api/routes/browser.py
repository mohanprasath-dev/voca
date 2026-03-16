import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from api.dependencies import get_persona_service
from services.persona import PersonaNotFoundError, PersonaService
from services.pipeline import VocaPipeline

# Browser WebSocket endpoint for real-time streaming
router = APIRouter()

logger = logging.getLogger("voca.browser")


def _build_session_summary_message(summary) -> dict:
	return {
		"type": "session_summary",
		"session_id": summary.session_id,
		"persona_name": summary.persona_name,
		"duration_seconds": summary.duration_seconds,
		"turn_count": summary.turn_count,
		"detected_languages": summary.detected_languages,
		"escalated": summary.escalated,
		"resolution_status": summary.resolution_status,
		"summary": summary.summary,
	}


@router.websocket("/{persona_id}")
async def browser_websocket(
	websocket: WebSocket,
	persona_id: str,
	persona_service: PersonaService = Depends(get_persona_service),
) -> None:
	await websocket.accept()

	try:
		pipeline = VocaPipeline(persona_id=persona_id, persona_service=persona_service)
	except PersonaNotFoundError as exc:
		await websocket.send_json({"type": "error", "message": str(exc)})
		await websocket.close(code=1008)
		return

	await websocket.send_json(
		{
			"type": "persona_loaded",
			"persona_id": pipeline.persona.id,
			"display_name": pipeline.persona.display_name,
			"ui_config": pipeline.persona.ui_config.model_dump(),
		}
	)

	try:
		while True:
			payload = await websocket.receive_json()
			message_type = payload.get("type")

			if message_type == "end_session":
				summary = await pipeline.close_session()
				await websocket.send_json(_build_session_summary_message(summary))
				continue

			if message_type == "switch_persona":
				requested_persona_id = str(payload.get("persona_id", "")).strip()
				if not requested_persona_id:
					await websocket.send_json({"type": "error", "message": "persona_id is required"})
					continue

				try:
					pipeline = VocaPipeline(persona_id=requested_persona_id, persona_service=persona_service)
				except PersonaNotFoundError as exc:
					await websocket.send_json({"type": "error", "message": str(exc)})
					continue

				await websocket.send_json(
					{
						"type": "persona_loaded",
						"persona_id": pipeline.persona.id,
						"display_name": pipeline.persona.display_name,
						"ui_config": pipeline.persona.ui_config.model_dump(),
					}
				)
				continue

			if message_type == "transcript":
				transcript = str(payload.get("text", "")).strip()
				if not transcript:
					await websocket.send_json({"type": "error", "message": "Transcript text is required"})
					continue

				previous_language = pipeline.current_language

				try:
					response_data = await pipeline.respond(transcript)
				except Exception as exc:
					logger.exception("Pipeline response failed")
					await websocket.send_json({"type": "error", "message": f"Pipeline error: {exc}"})
					continue

				detected_language = response_data["language"]

				await websocket.send_json(
					{
						"type": "transcript",
						"text": transcript,
						"language": detected_language,
					}
				)

				if previous_language != detected_language:
					await websocket.send_json(
						{
							"type": "language_changed",
							"from": previous_language,
							"to": detected_language,
						}
					)

				await websocket.send_json(
					{
						"type": "response",
						"text": response_data["text"],
						"language": detected_language,
					}
				)

				if response_data["escalation_needed"]:
					await websocket.send_json(
						{
							"type": "escalation",
							"summary": response_data["escalation_summary"],
							"message": pipeline.persona.escalation_message,
						}
					)
				continue

			await websocket.send_json({"type": "error", "message": f"Unsupported message type: {message_type}"})
	except WebSocketDisconnect as exc:
		logger.info("Browser websocket disconnected for persona %s (code=%s)", pipeline.persona.id, exc.code)
		if exc.code == 1000:
			try:
				await pipeline.close_session()
			except Exception:
				logger.exception("Failed to close session on clean disconnect")
