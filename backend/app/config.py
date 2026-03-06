"""
Configuration settings for the Meeting Transcription System
"""
import os
from typing import Optional
from dotenv import load_dotenv, find_dotenv

# Auto-search for .env in current and parent directories
_env_path = find_dotenv(usecwd=True) or os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
)
_loaded = load_dotenv(_env_path, override=True)
print(f"[config] .env loaded={_loaded} path={_env_path} MONGO={os.getenv('MONGODB_URL','NOT SET')}")

class Settings:
    # Server Configuration
    HOST: str = "localhost"
    PORT: int = 8000
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    
    # MongoDB Configuration
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    DATABASE_NAME: str = "meeting_transcription"
    CHUNKS_COLLECTION: str = "chunks"
    SUMMARIES_COLLECTION: str = "summaries"
    
    # Audio Configuration
    CHUNK_DURATION: int = 15  # seconds
    SAMPLE_RATE: int = 16000
    CHANNELS: int = 1
    AUDIO_FORMAT: str = "wav"
    AUDIO_DEVICE_NAME: str = "Stereo Mix"  # Preferred; falls back to default mic if not found
    
    # AI Model Configuration
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "tiny")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    
    # HuggingFace Model
    EMOTION_MODEL: str = "j-hartmann/emotion-english-distilroberta-base"
    SUMMARIZATION_MODEL: str = "facebook/bart-large-cnn"
    
    # Processing Configuration
    MAX_WORKERS: int = 4
    ENABLE_GPU: bool = False
    
    # File Paths  (config.py lives in backend/app/, so go up two levels to reach project root)
    BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))          # backend/app/
    PROJECT_ROOT: str = os.path.dirname(os.path.dirname(BASE_DIR))      # project root
    DATA_DIR: str = os.path.join(PROJECT_ROOT, "data")
    AUDIO_CHUNKS_DIR: str = os.path.join(DATA_DIR, "audio_recordings")
    TRANSCRIPTIONS_DIR: str = os.path.join(DATA_DIR, "transcriptions")
    TEMP_DIR: str = os.path.join(DATA_DIR, "temp")
    
    # WebSocket Configuration
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 100
    
    # Jargon Detection Configuration
    MIN_JARGON_SCORE: float = 0.5
    MAX_JARGON_TERMS: int = 10
    
    # Logging Configuration
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "meeting_transcription.log")

# Global settings instance
settings = Settings()

# Environment variable overrides
def load_env_settings():
    """Load settings from environment variables if available"""
    if os.getenv("MONGODB_URL"):
        settings.MONGODB_URL = os.getenv("MONGODB_URL")
    
    if os.getenv("WHISPER_DEVICE"):
        settings.WHISPER_DEVICE = os.getenv("WHISPER_DEVICE")
    
    if os.getenv("DEBUG"):
        settings.DEBUG = os.getenv("DEBUG").lower() == "true"

# Load environment settings on import
load_env_settings()