# 🎙️ Voca

> "The Voice Layer for Every Conversation on Earth."

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi)
![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-blue?logo=livekit)
![Murf AI](https://img.shields.io/badge/Murf_AI-Falcon-FF4081)
![MIT License](https://img.shields.io/badge/License-MIT-green.svg)
![Hackathon](https://img.shields.io/badge/Murf_AI_Hackathon-March_2025-blueviolet)

## What is Voca
Voca is a real-time, multilingual AI voice agent designed to sound and feel entirely human. It replaces robotic IVRs with a seamless, highly responsive, conversational interface. Powered by advanced reasoning, ultra-low latency TTS, and robust language detection, Voca perfectly adapts to the caller's language and tone, providing world-class support for diverse business needs.

## Features
- ⚡ **Ultra-Low Latency:** Powered by LiveKit WebRTC and Murf Falcon TTS.
- 🌍 **Seamless Multilingual:** Detects caller language instantly and switches on the fly.
- 🧠 **Human-Like Reasoning:** Gemini 3.1 Pro/Flash-Lite models enable natural phrasing and interruptions.
- 🎨 **Premium UI:** A world-class dark-themed dashboard with audio-reactive visualizers and glassmorphism.
- 🎭 **Dynamic Personas:** Context-aware switching between different business units.

## Three Personas
| Persona | Role | Organization | Style |
|---|---|---|---|
| **Aura** | Front Desk | City General Hospital | Calm, clinical, empathetic, and unhurried. |
| **Nova** | Admin | Horizon University | Warm, structured, patient, and encouraging. |
| **Apex** | Tech Support | TechFlow Inc | Sharp, fast, solution-oriented, friendly. |

## Architecture
```text
  User Audio -> Deepgram STT -> Text
                                  v
Gemini 3.1 LLM <- System Prompt & Context
      v
  Text Reply -> Murf Falcon TTS -> Audio
                                     v
                           LiveKit WebRTC Stream -> User Speaker
```

## Tech Stack
| Component | Technology |
|---|---|
| **Frontend** | Next.js 14, React, Tailwind CSS, Framer Motion |
| **Backend** | Python, FastAPI |
| **Voice Engine** | LiveKit |
| **Speech-to-Text** | Deepgram |
| **Text-to-Speech** | Murf Falcon |
| **LLM** | Gemini 3.1 Pro & Flash-Lite |

## Quick Start

### 1. Clone & Install Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Start Backend Server
```bash
uvicorn main:app --reload --port 8000
```

### 3. Start LiveKit Agent
```bash
python services/livekit_agent.py dev
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables
Create `.env` in the `backend` directory:
```env
LIVEKIT_URL=wss://...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
DEEPGRAM_API_KEY=...
GEMINI_API_KEY=...
MURF_API_KEY=...
```

## Pages
| Page | Route | Description |
|---|---|---|
| **Landing** | `/` | Introduction, features, and tech stack overview. |
| **App** | `/app` | The main conversational interface with the Voice Orb. |
| **Dashboard** | `/dashboard` | View metrics, latency, and session history. |
| **About** | `/about` | Project background and builder information. |

## Built By
**Mohan Prasath**
- GitHub: [mohanprasath-dev](https://github.com/mohanprasath-dev)
- LinkedIn: [mohanprasath21](https://linkedin.com/in/mohanprasath21)
- Website: [mohanprasath.dev](https://mohanprasath.dev)

## Hackathon
Built for the **Murf AI Voice Hackathon** (March 18, 2025). 
Category: Real-time Voice AI · Multilingual · Voice Infrastructure
