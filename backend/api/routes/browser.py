import logging

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from api.dependencies import get_persona_service
from services.persona import PersonaNotFoundError, PersonaService
from services.pipeline import VocaPipeline

# Browser WebSocket endpoint for real-time streaming
router = APIRouter()

logger = logging.getLogger("voca.browser")


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

				await websocket.send_json({"type": "transcript", "text": transcript})

				try:
					response_data = await pipeline.respond(transcript)
				except Exception as exc:
					logger.exception("Pipeline response failed")
					await websocket.send_json({"type": "error", "message": f"Pipeline error: {exc}"})
					continue

				await websocket.send_json(
					{
						"type": "response",
						"text": response_data["text"],
						"language": response_data["language"],
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
	except WebSocketDisconnect:
		logger.info("Browser websocket disconnected for persona %s", pipeline.persona.id)
