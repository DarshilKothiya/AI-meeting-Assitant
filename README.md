# 🤖 AI Meeting Assistant

A **Real-Time Meeting Transcription & Intelligence System** featuring a **FastAPI** backend, **Groq + LangChain** LLM summarization, and a modern **React** frontend.

The system captures live audio (via Stereo Mix or microphone), transcribes speech in real time with **Faster Whisper**, analyzes speaker emotions, extracts technical jargon with definitions, and synthesizes structured executive summaries, decisions, and action items streamed via **WebSockets**.

---

## 🚀 Key Features

| Category | Feature | Description |
|---|---|---|
| 🎤 **Audio Capture** | **Stereo Mix & Microphone** | Capture system audio (Zoom, Google Meet, Teams, YouTube) or microphone input via PyAudio |
| 📝 **Live Transcription** | **Faster Whisper** | High-speed, local speech-to-text with configurable model size (`tiny`, `base`, `small`, etc.) |
| 😊 **Emotion Analysis** | **DistilRoBERTa** | Real-time speaker emotion detection (`joy`, `neutral`, `anger`, `sadness`, `surprise`, `fear`, `disgust`) |
| 🔍 **Jargon Detection** | **KeyBERT + Wikipedia** | Extracts technical terms, algorithms, and libraries in real-time with automated Wikipedia definitions |
| 🧠 **AI Meeting Intelligence** | **LangChain + Groq LLM** | Generates executive summaries, key decisions, unresolved issues, and structured action items |
| ✅ **Action Items Tracker** | **Centralized Hub** | Dedicated view tracking actionable tasks, assignees, deadlines, and statuses across all meetings |
| 📊 **Interactive Dashboard** | **Real-Time Streaming** | Live transcription feed, audio device switcher, emotion distribution charts, and jargon glossary |
| 📁 **Meeting History** | **Full Archive & Details** | Browse past meetings, replay chunks, view full transcripts, and regenerate AI summaries on demand |
| 💾 **Dual Storage Engine** | **MongoDB + Local JSON** | Cloud/local MongoDB with automatic persistent fallback to `data/meetings_db.json` (zero data loss) |
| 🔄 **Auto-Recovery** | **Disk Transcript Scan** | Automatically indexes and recovers raw chunk transcripts from `data/transcriptions/` on startup |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               React Frontend                                │
│   ┌───────────────────┬───────────────────┬─────────────────────────────┐   │
│   │  Live Dashboard   │  Meeting History  │   Action Items View / Hub   │   │
│   │  (WebSockets)     │  (REST API)       │   (Task & Assignee Tracker) │   │
│   └─────────▲─────────┴─────────▲─────────┴──────────────▲──────────────┘   │
└─────────────┼───────────────────┼────────────────────────┼──────────────────┘
              │ WebSocket (live)  │ HTTP REST              │ HTTP REST
┌─────────────▼───────────────────▼────────────────────────▼──────────────────┐
│                              FastAPI Backend                                │
│                                                                             │
│   ┌─────────────────────┐    ┌──────────────────────────────────────────┐   │
│   │  Audio Capture      │    │  AI Processing Pipeline                  │   │
│   │  (Stereo Mix / Mic) │───►│  ├─ Faster Whisper (Speech-to-Text)      │   │
│   └─────────────────────┘    │  ├─ DistilRoBERTa (Emotion Detection)    │   │
│                              │  ├─ KeyBERT + spaCy (Jargon Extraction)  │   │
│                              │  └─ Wikipedia API (Definition Resolver)  │   │
│                              └────────────────────┬─────────────────────┘   │
│                                                   │                         │
│   ┌───────────────────────────────────────────────▼─────────────────────┐   │
│   │  Meeting Intelligence Service (LangChain + Groq LLM)                │   │
│   │  ├─ Transcript Chunking (RecursiveCharacterTextSplitter)            │   │
│   │  ├─ Executive Summarization & Key Decisions Extraction              │   │
│   │  └─ Structured Action Items (Task, Assignee, Deadline, Status)      │   │
│   └───────────────────────────────────────────────┬─────────────────────┘   │
│                                                   │                         │
│   ┌───────────────────────────────────────────────▼─────────────────────┐   │
│   │  Dual Storage Architecture                                          │   │
│   │  ├─ Primary Mirror: MongoDB Atlas / Local MongoDB                   │   │
│   │  └─ Persistent Local Database: data/meetings_db.json (Auto Fallback)│   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
AI-meeting-Assistant/
├── backend/
│   ├── app/
│   │   ├── audio/
│   │   │   ├── __init__.py
│   │   │   └── capture.py               # Audio capture & chunking (PyAudio)
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   └── connection.py            # MongoDB + Local JSON persistence manager
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py               # Pydantic schemas (Chunks, Sessions, Summaries)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── ai_processor.py          # Faster Whisper, Emotion, Jargon, NER
│   │   │   ├── chunk_processor.py       # Audio chunk stitching & real-time routing
│   │   │   └── summary_service.py       # Groq + LangChain structured summarization
│   │   ├── websocket/
│   │   │   ├── __init__.py
│   │   │   └── manager.py               # Real-time WebSocket connection manager
│   │   ├── config.py                    # Environment & configuration settings
│   │   ├── main.py                      # FastAPI application routes & lifespan
│   │   └── __init__.py
│   ├── .env                             # Backend environment variables
│   └── .env.example                     # Example environment template
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActionItemsView.jsx      # Aggregated action items dashboard
│   │   │   ├── Dashboard.jsx            # Live recording & transcription dashboard
│   │   │   ├── MeetingDetails.jsx       # Single meeting view, transcripts & summaries
│   │   │   ├── MeetingsList.jsx         # Meeting archive & history browser
│   │   │   ├── Navbar.jsx               # Navigation bar & audio device selector
│   │   │   ├── Sidebar.jsx              # Navigation menu & live stats drawer
│   │   │   └── TranscriptPanel.jsx      # Live streaming transcription panel
│   │   ├── services/
│   │   │   ├── apiService.js            # Axios REST client
│   │   │   └── websocketService.js      # WebSocket client manager
│   │   ├── App.jsx                      # Main app shell & view router
│   │   ├── index.css                    # Tailwind / global styling
│   │   └── index.jsx                    # React root entry point
│   └── package.json
│
├── data/                                # Runtime data directory (git-ignored)
│   ├── audio_recordings/                # Raw audio chunks (.wav)
│   ├── transcriptions/                  # Raw text transcriptions (.txt)
│   └── meetings_db.json                 # Persistent local JSON database
│
├── scripts/                             # Diagnostics & testing scripts
│   ├── test_audio_devices.py            # Audio device listing
│   ├── test_capture.py                  # Audio capture test
│   ├── test_live_pipeline.py            # End-to-end pipeline test
│   ├── test_system.py                   # Full system diagnostic
│   └── test_transcription.py            # Whisper transcription test
│
├── requirements.txt                     # Backend Python dependencies
├── .gitignore                           # Git ignore rules
└── README.md
```

---

## 📋 Prerequisites

* **Python 3.10+** (tested on Python 3.10, 3.11, 3.13)
* **Node.js 18+** & **npm**
* **Audio Input**: Microphone or Windows **Stereo Mix** (for capturing system/meeting audio)
* **Groq API Key**: (Free tier available at [console.groq.com](https://console.groq.com)) for AI summarization & action items
* **MongoDB**: Optional (MongoDB Atlas or local `mongodb://localhost:27017`). The system automatically uses persistent local storage (`data/meetings_db.json`) if MongoDB is offline.
* **Windows Users**: [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (required by PyAudio / C-extensions).

---

## 🛠️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/DarshilKothiya/AI-meeting-Assitant.git
cd AI-meeting-Assistant
```

### 2️⃣ Backend Setup

#### Create & Activate Virtual Environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

#### Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

> **Note for PyAudio on Windows**: If `pip install pyaudio` fails, install using `pip install pipwin && pipwin install pyaudio` or download the matching pre-compiled wheel from [Gohlke Wheels](https://github.com/cgohlke/pyaudio).

---

### 3️⃣ Configure Environment Variables

Create or update `.env` inside the `backend/` directory:

```bash
# backend/.env

# Server Settings
DEBUG=True

# MongoDB Connection (Optional - leave default or use Atlas URI)
MONGODB_URL=mongodb://localhost:27017
# Example MongoDB Atlas URI:
# MONGODB_URL=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?appName=Cluster0

# AI Transcription Device ("cpu" or "cuda")
WHISPER_DEVICE=cpu
WHISPER_MODEL=tiny

# Groq API Configuration (Required for Structured Summaries & Action Items)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
# Recommended alternatives: llama-3.3-70b-versatile, llama3-70b-8192

# Summary Chunking (for handling long transcripts)
SUMMARY_CHUNK_SIZE=6000
SUMMARY_CHUNK_OVERLAP=500
```

---

### 4️⃣ Frontend Setup

```bash
cd frontend
npm install
cd ..
```

---

## 🎧 Audio Device Setup (Capturing Meeting Audio)

To transcribe what other people are saying in Zoom, Microsoft Teams, Google Meet, or YouTube:

### Windows (Stereo Mix)
1. Right-click the speaker icon in your taskbar → **Sound Settings** → **More sound settings**.
2. Go to the **Recording** tab.
3. If **Stereo Mix** is not visible, right-click anywhere in the list and check **Show Disabled Devices**.
4. Right-click **Stereo Mix** and select **Enable**.
5. In the web app, select **Stereo Mix** from the top navbar dropdown before starting a meeting.

---

## ▶️ Running the Application

### 1. Start the Backend Server

```bash
# From the project root (with venv activated):
cd backend
python -m app.main
```
The FastAPI server will start at **http://localhost:8000** (Swagger documentation: **http://localhost:8000/docs**).

### 2. Start the Frontend React App

In a separate terminal:
```bash
cd frontend
npm start
```
The React frontend will open automatically at **http://localhost:3000**.

---

## 🖥️ Using the Application

### 1. Live Dashboard (`/` or `/live`)
* Select your preferred audio input device in the top navigation bar.
* Click **Start Session**, enter a session name (e.g., *"Sprint Planning"*), and start speaking or playing meeting audio.
* Watch the live transcription, speaker turns, emotions, and technical jargon glossary update in real time.
* Click **Stop Session** when the meeting ends.

### 2. Meeting Details & AI Summary (`/details`)
* Inspect the complete stitched transcript and individual audio chunks.
* Click **Generate Summary** (or **Regenerate Summary**) to trigger the Groq + LangChain intelligence engine.
* View:
  * **Executive Overview**: High-level synopsis.
  * **Key Discussion Points**: Breakdown of what was covered.
  * **Explicit Decisions**: Agreements and commitments made.
  * **Action Items**: Structured table with task, assignee, deadline, and status.
  * **Open Questions & Risks**: Unresolved topics and blockers.

### 3. Meeting History (`/meetings`)
* Browse all completed and active meeting sessions.
* View meeting duration, chunk counts, start timestamps, and summary status badges.
* Open any past meeting to review notes or delete old recordings.

### 4. Action Items Hub (`/action-items`)
* View all action items extracted across all your meetings in a unified dashboard.
* Filter and search tasks by status, assignee, or meeting.

---

## 🌐 API Reference

### Real-Time WebSocket

* **URL**: `ws://localhost:8000/ws`

| Message Type | Direction | Payload Description |
|---|---|---|
| `subscribe` | Client → Server | `{ "type": "subscribe", "session_id": "<id>" }` |
| `unsubscribe` | Client → Server | `{ "type": "unsubscribe", "session_id": "<id>" }` |
| `heartbeat` | Client ↔ Server | Keep-alive ping/pong (`{ "type": "heartbeat" }`) |
| `chunk_update` | Server → Client | Real-time chunk with transcript, emotions, speakers, and jargon |
| `summary_update` | Server → Client | Final meeting summary emitted on session stop |

---

### REST API Endpoints

#### Session & Recording Management
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/sessions/start` | Start recording session (`session_name`, `device_id`) |
| `POST` | `/sessions/stop` | Stop recording session and finalize audio |
| `GET` | `/sessions/active` | Get currently active recording sessions |
| `GET` | `/sessions/{id}/status` | Get real-time status of a recording session |

#### Meeting Archive & Details
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/meetings` | List all historical meeting sessions |
| `GET` | `/meetings/{id}` | Get full meeting details, chunks, and transcript |
| `DELETE` | `/meetings/{id}` | Delete a meeting and all associated local data |

#### AI Meeting Intelligence & Summaries
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/meetings/{id}/summary` | Generate/regenerate structured Groq summary |
| `GET` | `/meetings/{id}/summary` | Retrieve existing structured summary |
| `GET` | `/action-items` | Get all aggregated action items across meetings |

#### System & Audio Utilities
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/audio/devices` | List available system audio input devices |
| `GET` | `/health` | Check health of database, Groq, and AI services |
| `GET` | `/system/connections` | View active WebSocket connections |

---

## 🧠 AI Pipeline Details

```
Audio Chunk (15s)
   │
   ├──► 1. Faster Whisper ────────► Speech-to-Text Transcription
   │
   ├──► 2. DistilRoBERTa ─────────► Emotion Classification (7 classes)
   │
   ├──► 3. KeyBERT + spaCy ───────► Jargon Extraction + NER
   │         │
   │         └──► Wikipedia API ──► Real-time Glossary & Definitions
   │
   └──► 4. LangChain + Groq ──────► Anti-Hallucination Structured Intelligence
                                    ├─ Executive Summary
                                    ├─ Decisions vs. Discussions
                                    └─ Action Items (Task, Owner, Deadline)
```

---

## 🛠️ Diagnostics & Testing

Verify your environment using the included test suite:

```bash
# Test audio input devices (detects Stereo Mix and Microphones)
python scripts/test_audio_devices.py

# Test 15-second audio capture
python scripts/test_capture.py

# Test Faster Whisper transcription
python scripts/test_transcription.py

# Run full system diagnostic (DB, AI models, Audio)
python scripts/test_system.py
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m "Add amazing feature"`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - feel free to use it for personal and commercial projects.
