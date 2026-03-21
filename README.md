# 🤖 AI Meeting Assistant

A **Real-Time Audio Streaming System** built using **FastAPI WebSockets** and **Python microphone client**.
This system enables **live meeting recording, audio streaming, and real-time AI processing**, making it ideal for meeting assistants, transcription services, and audio analytics systems.

---

# 🚀 Features

* 🔊 Real-time audio streaming via WebSocket
* 🎤 Cross-platform microphone capture using `sounddevice`
* 💾 Automatic audio file saving with timestamps
* 🧠 AI-powered transcription and analysis
* 📝 Real-time meeting summaries
* 🔍 Keyword and jargon detection
* 🎛️ Audio input device selection
* 📡 Live connection status monitoring

---

# 📋 Requirements

* Python **3.8+** (3.13 recommended)
* Microphone access
* Internet or local network connection
* **MongoDB** (local or cloud)

---

# 🛠 Installation

## ⚠️ Important Notes

* **AI packages may require additional setup** on some systems
* **Windows users**: Some packages need Microsoft Visual C++ Build Tools
* **Installation order matters** - follow steps below carefully

## 1️⃣ Clone and Setup Virtual Environment

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

## 2️⃣ Install Dependencies (Step-by-Step)

### Step 2.1: Core Web Framework
```bash
pip install fastapi uvicorn[standard] websockets python-multipart pydantic python-dotenv loguru
```

### Step 2.2: Database Packages
```bash
pip install motor pymongo
```

### Step 2.3: Audio Processing
```bash
pip install pyaudio sounddevice librosa soundfile
```

### Step 2.4: Data Processing
```bash
pip install numpy pandas scikit-learn
```

### Step 2.5: NLP Packages
```bash
pip install nltk textblob spacy
python -m spacy download en_core_web_sm
```

### Step 2.6: AI Models (May take time)
```bash
pip install transformers sentence-transformers keybert
```

### Step 2.7: Speech Processing (Large packages)
```bash
pip install faster-whisper torch torchaudio
```

### Step 2.8: Final Utilities
```bash
pip install aiofiles httpx requests wikipedia-api
```

## 3️⃣ Alternative: Install All at Once

```bash
pip install -r requirements.txt
```

*If this fails, use the step-by-step method above*

---

# ⚙️ Configuration

## 1️⃣ Environment Setup

Create `.env` file in the `backend/` directory:

```env
# MongoDB Connection
MONGO_URI=mongodb://localhost:27017/meeting_assistant
# OR use MongoDB Atlas (cloud)
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/meeting_assistant

# Server Settings
HOST=0.0.0.0
PORT=8000
DEBUG=true

# AI Model Settings
WHISPER_MODEL_SIZE=base
TRANSCRIPTION_LANGUAGE=en
```

## 2️⃣ MongoDB Setup

### Local MongoDB
```bash
# Install MongoDB Community Server
# Start MongoDB service
net start MongoDB
```

### MongoDB Atlas (Cloud)
1. Create free account at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create free cluster
3. Get connection string
4. Add to `.env` file

---

# ▶️ Quick Start

## 1️⃣ Start Backend Server

```bash
cd backend
# Make sure venv is activated
python -m app.main
```

Server will start on:
```
http://localhost:8000
```

## 2️⃣ Start Frontend

```bash
cd frontend
npm install
npm start
```

Frontend will start on:
```
http://localhost:3000
```

---

# 📁 Project Structure

```
AI-meeting-Assistant/
│
├── backend/                    # FastAPI server
│   ├── app/
│   │   ├── main.py            # Main application
│   │   ├── services/          # AI processing services
│   │   ├── models/            # Database models
│   │   └── websocket/         # WebSocket handlers
│   ├── .env                   # Environment variables
│   └── requirements.txt       # Backend dependencies
│
├── frontend/                   # React frontend
│   ├── src/
│   ├── public/
│   └── package.json
│
├── venv/                      # Virtual environment
├── data/                      # Generated data
│   ├── transcriptions/
│   └── audio_chunks/
└── README.md
```

---

# 🐛 Troubleshooting

## Common Installation Issues

### Issue: "Microsoft Visual C++ Build Tools required"
**Solution:**
1. Download [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Install "Desktop development with C++"
3. Restart and retry installation

### Issue: "Rust compiler required"
**Solution:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Restart terminal and retry
```

### Issue: "ModuleNotFoundError: No module named 'fastapi'"
**Solution:**
```bash
# Ensure venv is activated
venv\Scripts\activate

# Install packages directly with venv python
..\venv\Scripts\python.exe -m pip install fastapi uvicorn
```

### Issue: "Port already in use"
**Solution:**
```bash
# Kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# OR use different port
# Edit .env: PORT=8001
```

### Issue: "MongoDB connection failed"
**Solution:**
1. Check MongoDB is running
2. Verify connection string in `.env`
3. Check firewall settings

## Audio Issues

### Issue: "No audio device found"
```bash
python -c "import sounddevice; print(sounddevice.query_devices())"
```

### Issue: "Permission denied"
- Run as administrator
- Check microphone permissions in system settings

---

# 🎧 Recommended Settings

### Meeting Recording
```
Sample rate: 16000 Hz
Channels: 1 (Mono)
Chunk duration: 15 seconds
```

### High Quality Recording
```
Sample rate: 44100 Hz
Channels: 2 (Stereo)
Chunk duration: 30 seconds
```

---

# 🌐 API Endpoints

## WebSocket Connection
```
ws://localhost:8000/ws/{session_id}
```

## REST API
```
GET  /api/health              # Health check
GET  /api/sessions           # List sessions
POST /api/sessions           # Create session
GET  /api/sessions/{id}      # Get session details
DELETE /api/sessions/{id}    # Delete session
```

---

# 🧠 AI Features

## Speech-to-Text
- Uses **Faster Whisper** for transcription
- Supports multiple languages
- Real-time processing

## Meeting Analysis
- **Keyword extraction** using KeyBERT
- **Jargon detection** with custom models
- **Summary generation** using transformers

## Audio Processing
- **Voice activity detection**
- **Audio quality enhancement**
- **Noise reduction**

---

# 📊 Performance Optimization

| Goal                | Recommendation                  |
| ------------------- | ------------------------------- |
| Lower latency       | Reduce chunk size to 10s        |
| Better accuracy     | Use larger Whisper model        |
| Lower memory usage  | Use `base` or `small` models    |
| Faster processing   | Enable GPU (if available)       |

---

# 🔒 Security Considerations

For production deployment:

* Use **HTTPS/WSS** instead of HTTP/WS
* Add **authentication** middleware
* Configure **CORS** properly
* Use **environment variables** for secrets
* Set up **rate limiting**
* Enable **input validation**

---

# 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m "Add feature"`
4. Push to branch: `git push origin feature-name`
5. Open Pull Request

---

# 📄 License

This project is **open source** and free to use for learning and development.

---

# ⭐ Support

If you like this project:

* ⭐ Star the repository
* 🍴 Fork it
* 🧠 Contribute improvements
* 🐛 Report issues

---

**Happy Meeting Assistant! 🎵🤖**
