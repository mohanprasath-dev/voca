import glob
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# Browser WebSocket endpoint for real-time streaming
router = APIRouter()


def _load_persona(persona_id: str) -> dict[str, Any] | None:
	persona_file = Path("personas") / f"{persona_id}.json"
	if persona_file.exists():
		with persona_file.open("r", encoding="utf-8") as file:
			return json.load(file)

	for path in glob.glob("personas/*.json"):
		with open(path, "r", encoding="utf-8") as file:
			persona = json.load(file)
			if persona.get("id") == persona_id:
				return persona
	return None


async def _send_persona_loaded(websocket: WebSocket, persona_id: str) -> None:
	persona = _load_persona(persona_id)
	if not persona:
		await websocket.send_json({"type": "error", "message": f"Persona '{persona_id}' not found"})
		return

	await websocket.send_json(
		{
			"type": "persona_loaded",
			"persona_id": persona.get("id", persona_id),
			"display_name": persona.get("display_name", persona.get("name", persona_id)),
			"ui_config": persona.get("ui_config", {}),
		}
	)


@router.websocket("/{persona_id}")
async def browser_ws(websocket: WebSocket, persona_id: str) -> None:
	await websocket.accept()
	active_persona_id = persona_id
	await _send_persona_loaded(websocket, active_persona_id)

	try:
		while True:
			message = await websocket.receive()

			text_data = message.get("text")
			if not text_data:
				continue

			try:
				payload = json.loads(text_data)
			except json.JSONDecodeError:
				await websocket.send_json({"type": "error", "message": "Invalid message payload"})
				continue

			message_type = payload.get("type")
			if message_type == "switch_persona":
				next_persona_id = str(payload.get("persona_id", "")).strip()
				if not next_persona_id:
					await websocket.send_json({"type": "error", "message": "Missing persona_id"})
					continue

				active_persona_id = next_persona_id
				await _send_persona_loaded(websocket, active_persona_id)
			elif message_type == "end_session":
				await websocket.send_json(
					{
						"type": "session_summary",
						"session_id": "browser-session",
						"summary": "Session ended.",
						"duration_seconds": 0,
						"turn_count": 0,
						"languages_used": [],
					}
				)
	except WebSocketDisconnect:
		return
