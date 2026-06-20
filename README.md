# 🤖 AI Meeting Assistant

A **Real-Time Meeting Transcription & Analysis System** built with a **FastAPI** backend and a **React** frontend.  
The system captures live audio (via Stereo Mix or microphone), transcribes it in real-time using **Faster Whisper**, detects speaker emotions, extracts technical jargon, and generates meeting summaries — all streamed to the browser through **WebSockets**.

---

## 🚀 Features

| Category | Feature |
|---|---|
| 🎤 **Audio Capture** | Real-time system audio capture via Stereo Mix or microphone using PyAudio |
| 📝 **Transcription** | Speech-to-text using Faster Whisper (configurable model size) |
| 😊 **Emotion Detection** | Per-speaker emotion analysis using DistilRoBERTa (`j-hartmann/emotion-english-distilroberta-base`) |
| 🔍 **Jargon Detection** | Technical term extraction with KeyBERT + Wikipedia-powered definitions |
| 🏷️ **Named Entity Recognition** | Organization, product, and event detection using spaCy |
| 📊 **Live Dashboard** | Real-time transcript, emotion charts, speaker stats, and jargon panel in the browser |
| 📡 **WebSocket Streaming** | Chunk-by-chunk real-time updates pushed to all connected clients |
| 💾 **Database Persistence** | MongoDB storage for chunks, summaries, and sessions (with automatic in-memory fallback) |
| 📄 **Transcription Files** | Every chunk's transcription is saved as a `.txt` file under `data/transcriptions/` |
| 🎧 **Audio Recordings** | Raw audio chunks saved as `.wav` files under `data/audio_recordings/` |
| 📋 **Meeting Summary** | Automatic session summary generated when a session is stopped |

---

## 🏗️ Architecture

```
┌─────────────┐    WebSocket     ┌─────────────────────────────────────────┐
│   React     │◄═══════════════►│           FastAPI Backend               │
│  Frontend   │   (real-time)    │                                         │
│ :3000       │    HTTP REST     │  ┌─────────┐  ┌──────────────────────┐  │
│             │◄────────────────►│  │  Main   │  │   AI Processor       │  │
└─────────────┘                  │  │  App    │  │  ┌─Whisper──────────┐│  │
                                 │  │         │  │  │ Transcription    ││  │
                                 │  └────┬────┘  │  ├─Emotion──────────┤│  │
                                 │       │       │  │ DistilRoBERTa    ││  │
                                 │  ┌────▼────┐  │  ├─Jargon───────────┤│  │
                                 │  │WebSocket│  │  │ KeyBERT + spaCy  ││  │
                                 │  │ Manager │  │  ├─Summary──────────┤│  │
                                 │  └─────────┘  │  │ Extractive       ││  │
                                 │               │  └──────────────────┘│  │
                                 │  ┌──────────┐ │  ┌──────────────────┐│  │
                                 │  │  Audio   │ │  │ Chunk Processor  ││  │
                                 │  │  Capture │ │  │ (Stitcher)       ││  │
                                 │  └──────────┘ │  └──────────────────┘│  │
                                 │               └──────────────────────┘  │
                                 │  ┌──────────────────────────────────┐   │
                                 │  │  MongoDB (or In-Memory Fallback) │   │
                                 │  └──────────────────────────────────┘   │
                                 └─────────────────────────────────────────┘
```

---

## 📋 Requirements

* **Python 3.8+** (3.10+ recommended)
* **Node.js 16+** and npm
* **Microphone / Stereo Mix** access for audio capture
* **MongoDB** (optional — the system runs fully with an in-memory fallback if unavailable)

---

## 🛠️ Installation

### ⚠️ Important Notes

* **AI packages may require additional setup** on some systems.
* **Windows users**: Some packages need [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
* **Installation order matters** — follow the steps below carefully.

### 1️⃣ Clone and Setup Virtual Environment

```bash
git clone https://github.com/DarshilKothiya/AI-meeting-Assitant.git
cd AI-meeting-Assistant

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate
```

### 2️⃣ Install Backend Dependencies (Step-by-Step)

#### Step 2.1: Core Web Framework
```bash
pip install fastapi uvicorn[standard] websockets python-multipart pydantic python-dotenv loguru
```

#### Step 2.2: Database Packages
```bash
pip install motor pymongo
```

#### Step 2.3: Audio Processing
```bash
pip install pyaudio sounddevice librosa soundfile
```

#### Step 2.4: Data Processing
```bash
pip install numpy pandas scikit-learn
```

#### Step 2.5: NLP Packages
```bash
pip install nltk textblob spacy
python -m spacy download en_core_web_sm
```

#### Step 2.6: AI Models (may take time to download)
```bash
pip install transformers sentence-transformers keybert
```

#### Step 2.7: Speech Processing (large packages)
```bash
pip install faster-whisper torch torchaudio
```

#### Step 2.8: Final Utilities
```bash
pip install aiofiles httpx requests wikipedia-api
```

#### Alternative: Install All at Once
```bash
pip install -r requirements.txt
```
> If this fails, use the step-by-step method above.

### 3️⃣ Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
# MongoDB Connection
MONGODB_URL=mongodb://localhost:27017
# OR use MongoDB Atlas (cloud):
# MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/?appName=YourApp

# AI Model device: "cpu" or "cuda"
WHISPER_DEVICE=cpu

# Debug mode (True/False)
DEBUG=True
```

> **Note**: If MongoDB is unavailable, the system automatically falls back to **in-memory storage** — no configuration needed.

### Audio Device

By default the system looks for **Stereo Mix** (captures system audio output). If not found, it falls back to the default microphone.

To enable Stereo Mix on Windows:
1. Right-click the speaker icon → **Sounds** → **Recording** tab
2. Right-click in the empty area → **Show Disabled Devices**
3. Right-click **Stereo Mix** → **Enable**

---

## ▶️ Quick Start

### 1️⃣ Start the Backend Server

```bash
cd backend
python -m app.main
```

The server starts on **http://localhost:8000** with hot-reload enabled in debug mode.

### 2️⃣ Start the Frontend

```bash
cd frontend
npm start
```

The React app starts on **http://localhost:3000**.

### 3️⃣ Use the Application

1. Open **http://localhost:3000** in your browser
2. The dashboard will automatically connect via WebSocket (green "Connected" badge)
3. Click **Start Session** to begin recording
4. Live transcription, emotions, speakers, and jargon will populate in real-time
5. Click **Stop Session** to generate a final meeting summary

---

## 📁 Project Structure

```
AI-meeting-Assistant/
│
├── backend/                          # FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app, routes, lifespan, session mgmt
│   │   ├── config.py                 # Settings (audio, models, DB, paths)
│   │   ├── audio/
│   │   │   └── capture.py            # PyAudio recording & chunk pipeline
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   └── connection.py         # MongoDB + in-memory fallback ops
│   │   ├── models/
│   │   │   └── schemas.py            # Pydantic models (ProcessedChunk, etc.)
│   │   ├── services/
│   │   │   ├── ai_processor.py       # Whisper, Emotion, Jargon, Summary services
│   │   │   └── chunk_processor.py    # Chunk stitching & session summary
│   │   └── websocket/
│   │       └── manager.py            # WebSocket connection & message broadcasting
│   └── .env                          # Environment variables
│
├── frontend/                         # React frontend (Create React App)
│   ├── public/
│   ├── src/
│   │   ├── App.jsx                   # Root app with router
│   │   ├── index.jsx                 # React entry point
│   │   ├── index.css                 # Global styles
│   │   ├── components/
│   │   │   ├── Dashboard.jsx         # Main dashboard (active component)
│   │   │   ├── Navbar.jsx            # Top navigation bar
│   │   │   ├── TranscriptPanel.jsx   # Live transcript display
│   │   │   ├── Sidebar.jsx           # Emotions, speakers, jargon, stats
│   │   │   └── MainDashboard.jsx     # Alternative MUI-based dashboard
│   │   └── services/
│   │       ├── apiService.js         # Axios HTTP client
│   │       └── websocketService.js   # Native WebSocket client
│   └── package.json
│
├── data/                             # Generated at runtime
│   ├── audio_recordings/             # Saved .wav chunks
│   └── transcriptions/               # Saved .txt transcription files
│
├── scripts/                          # Diagnostic & test scripts
│   ├── test_system.py                # Full system diagnostic
│   ├── test_audio_devices.py         # Audio device listing
│   ├── test_capture.py               # Audio capture test
│   ├── test_transcription.py         # Whisper transcription test
│   └── test_live_pipeline.py         # End-to-end pipeline test
│
├── requirements.txt                  # Python dependencies
├── venv/                             # Python virtual environment
└── README.md
```

---

## 🌐 API Reference

### WebSocket

| Endpoint | Description |
|---|---|
| `ws://localhost:8000/ws` | Real-time WebSocket connection for live updates |

**Client → Server messages:**
| Type | Payload | Description |
|---|---|---|
| `subscribe` | `{ "type": "subscribe", "session_id": "..." }` | Subscribe to session updates |
| `unsubscribe` | `{ "type": "unsubscribe", "session_id": "..." }` | Unsubscribe from session |
| `heartbeat` | `{ "type": "heartbeat" }` | Keep-alive response |

**Server → Client messages:**
| Type | Description |
|---|---|
| `connection` | Connection confirmation with `client_id` |
| `chunk_update` | Processed chunk with transcript, emotions, speakers, jargon, micro-summary |
| `summary_update` | Final meeting summary when session stops |
| `status` | Processing status messages |
| `heartbeat` | Periodic keep-alive |

### REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System health check (DB, AI models, audio devices) |
| `POST` | `/sessions/start` | Start a new recording session |
| `POST` | `/sessions/stop` | Stop session and generate summary |
| `GET` | `/sessions/active` | List all active sessions |
| `GET` | `/sessions/{id}/status` | Get status of a specific session |
| `GET` | `/audio/devices` | List available audio input devices |
| `GET` | `/system/connections` | WebSocket connection statistics |

---

## 🧠 AI Pipeline

Each audio chunk (default: 15 seconds) passes through a five-stage AI pipeline:

```
Audio Chunk
    │
    ▼
┌──────────────────┐
│ 1. Transcription │  Faster Whisper (model: tiny/base/small/medium/large)
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2. Speaker Label │  All segments labeled as Speaker_1 (single-speaker mode)
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3. Emotion       │  DistilRoBERTa emotion classifier per speaker
│    Detection     │  (joy, sadness, anger, fear, surprise, disgust, neutral)
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 4. Jargon        │  KeyBERT keyword extraction + spaCy NER
│    Detection     │  + Wikipedia API definition lookup
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 5. Micro-Summary │  Extractive first-sentence summary
└──────────────────┘
```

### Models Used

| Service | Model | Purpose |
|---|---|---|
| Transcription | `faster-whisper` (configurable: tiny → large) | Speech-to-text |
| Emotion Detection | `j-hartmann/emotion-english-distilroberta-base` | Text emotion classification |
| Jargon Extraction | `distilbert-base-nli-mean-tokens` (via KeyBERT) | Technical keyword extraction |
| Named Entities | `en_core_web_sm` (spaCy) | ORG, PRODUCT, EVENT detection |
| Definitions | Wikipedia API | Term definitions |

---

## 📊 Performance Tuning

| Goal | Recommendation |
|---|---|
| Lower latency | Reduce `CHUNK_DURATION` to `10` in `config.py` |
| Better accuracy | Use a larger Whisper model (`base`, `small`, `medium`) |
| Lower memory | Use `tiny` model with `int8` compute type |
| Faster processing | Set `WHISPER_DEVICE=cuda` and `ENABLE_GPU=True` |
| Skip jargon slowness | Reduce `MAX_JARGON_TERMS` in `config.py` |

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Solution |
|---|---|
| `Microsoft Visual C++ Build Tools required` | Install [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) → "Desktop development with C++" |
| `ModuleNotFoundError: No module named 'fastapi'` | Ensure venv is activated: `venv\Scripts\activate` |
| `Port already in use` | `netstat -ano \| findstr :8000` then `taskkill /PID <PID> /F` |
| `MongoDB connection failed` | System auto-falls back to in-memory storage. Check `.env` if persistence needed. |
| `spaCy model not found` | Run `python -m spacy download en_core_web_sm` |
| `No audio device found` | Run `python scripts/test_audio_devices.py` to list devices |
| `Stereo Mix not available` | Enable it in Windows Sound settings → Recording tab → Show Disabled Devices |
| `Audio stream status: 2` | Non-critical warning — audio overrun, system handles it automatically |

### Diagnostic Scripts

```bash
# Run the full system diagnostic
python scripts/test_system.py

# Test audio devices only
python scripts/test_audio_devices.py

# Test audio capture only
python scripts/test_capture.py

# Test Whisper transcription
python scripts/test_transcription.py

# Test full live pipeline
python scripts/test_live_pipeline.py
```

---

## 🔒 Security Considerations

For production deployment:

* Use **HTTPS/WSS** instead of HTTP/WS
* Add **authentication** middleware
* Configure **CORS** properly (currently allows `localhost:3000` only)
* Use **environment variables** for secrets (never commit `.env`)
* Set up **rate limiting**
* Enable **input validation** on all endpoints

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m "Add feature"`
4. Push to branch: `git push origin feature-name`
5. Open a Pull Request

---

## 📄 License

This project is **open source** and free to use for learning and development.

---

## ⭐ Support

If you find this project useful:

* ⭐ Star the repository
* 🍴 Fork it
* 🧠 Contribute improvements
* 🐛 Report issues

---

**Happy Meeting Transcribing! 🎙️🤖**
