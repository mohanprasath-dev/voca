#!/bin/bash
set -e

echo "Starting Voca Backend + Worker..."

# Start the LiveKit worker in the background
python3 -m services.livekit_agent &

# Start the FastAPI server in the foreground
python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT
