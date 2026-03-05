"""
Main FastAPI application for Meeting Transcription System
"""
import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import pyaudio

from .config import settings
from .models.schemas import (
    SystemStatus, ErrorResponse, StartSessionRequest, StartSessionResponse,
    StopSessionRequest, StopSessionResponse, SessionInfo, AudioDeviceInfo,
    ProcessedChunk
)
from .database import initialize_database, cleanup_database, SessionOperations, db
from .services.ai_processor import AIProcessor
from .services.chunk_processor import (
    initialize_meeting_processor, process_session_chunk, 
    generate_session_summary, get_session_status
)
from .websocket.manager import connection_manager, start_heartbeat_task
from .audio.capture import AudioCapture, AudioChunkProcessor


# Global instances
ai_processor = AIProcessor()
active_sessions = {}  # {session_id: session_info}
session_processors = {}  # {session_id: AudioChunkProcessor}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Meeting Transcription System")
    
    # Initialize database
    await initialize_database()
    
    # Initialize AI services
    await ai_processor.initialize_all()
    
    # Initialize meeting processor
    await initialize_meeting_processor()
    
    # Start background tasks
    heartbeat_task = asyncio.create_task(start_heartbeat_task())
    
    logger.info("System initialization complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Meeting Transcription System")
    
    # Stop all active sessions
    for session_id in list(active_sessions.keys()):
        await stop_session_internal(session_id)
    
    # Cancel background tasks
    heartbeat_task.cancel()
    
    # Cleanup database
    await cleanup_database()
    
    logger.info("System shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Meeting Transcription System",
    description="Real-time meeting transcription with AI analysis",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    client_id = await connection_manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle client message
            await connection_manager.handle_client_message(client_id, message)
            
    except WebSocketDisconnect:
        connection_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        connection_manager.disconnect(client_id)


# Health check endpoint
@app.get("/health", response_model=SystemStatus)
async def health_check():
    """System health check"""
    # Check database connection
    db_connected = await db.health_check()
    
    # Get audio devices
    audio_devices = []
    try:
        audio = pyaudio.PyAudio()
        device_count = audio.get_device_count()
        
        for i in range(device_count):
            try:
                device_info = audio.get_device_info_by_index(i)
                if device_info['maxInputChannels'] > 0:
                    audio_devices.append(AudioDeviceInfo(
                        device_id=i,
                        name=device_info['name'],
                        channels=device_info['maxInputChannels'],
                        sample_rate=device_info['defaultSampleRate']
                    ))
            except:
                continue
        
        audio.terminate()
    except Exception as e:
        logger.error(f"Error getting audio devices: {e}")
    
    # Get active sessions count
    active_sessions_count = len(active_sessions)
    
    return SystemStatus(
        status="healthy" if db_connected else "degraded",
        database_connected=db_connected,
        ai_models_loaded=True,  # Assume loaded if we got this far
        active_sessions=active_sessions_count,
        available_audio_devices=audio_devices
    )


# Session management endpoints
@app.post("/sessions/start", response_model=StartSessionResponse)
async def start_session(request: StartSessionRequest, background_tasks: BackgroundTasks):
    """Start a new transcription session"""
    try:
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        
        # Create session in database
        await SessionOperations.create_session(
            session_id, 
            {
                "session_name": request.session_name,
                **request.metadata
            }
        )
        
        # Create session info
        session_info = {
            "session_id": session_id,
            "start_time": datetime.utcnow(),
            "status": "active",
            "chunk_count": 0,
            "metadata": request.metadata
        }
        
        active_sessions[session_id] = session_info
        
        # Start audio processing for this session
        background_tasks.add_task(start_audio_processing, session_id)
        
        # Send status update
        await connection_manager.send_status_update(
            session_id, 
            f"Session {session_id} started", 
            {"session_name": request.session_name}
        )
        
        logger.info(f"Started session {session_id}")
        
        return StartSessionResponse(
            session_id=session_id,
            status="active",
            message=f"Session started successfully"
        )
        
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sessions/stop", response_model=StopSessionResponse)
async def stop_session(request: StopSessionRequest):
    """Stop a transcription session"""
    session_id = request.session_id
    
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        return await stop_session_internal(session_id)
    except Exception as e:
        logger.error(f"Error stopping session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def stop_session_internal(session_id: str) -> StopSessionResponse:
    """Internal function to stop a session"""
    session_info = active_sessions.get(session_id)
    if not session_info:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Stop audio processing
    if session_id in session_processors:
        session_processors[session_id].capture.stop_recording()
        del session_processors[session_id]
    
    # Generate final summary
    await connection_manager.send_status_update(
        session_id, 
        "Generating final summary...", 
        {"stage": "summarization"}
    )
    
    summary = await generate_session_summary(session_id)
    
    if summary:
        # Send summary to connected clients
        await connection_manager.send_summary_update(session_id, summary.dict())
    
    # Update session status
    session_info["status"] = "completed"
    session_info["end_time"] = datetime.utcnow()
    
    # Calculate duration and stats
    duration = (session_info["end_time"] - session_info["start_time"]).total_seconds()
    
    # Update database
    await SessionOperations.end_session(
        session_id, 
        {
            "total_chunks": session_info["chunk_count"],
            "duration_seconds": duration,
            "final_summary_generated": summary is not None
        }
    )
    
    # Remove from active sessions
    del active_sessions[session_id]
    
    # Send final status update
    await connection_manager.send_status_update(
        session_id, 
        "Session completed", 
        {"final_summary_available": summary is not None}
    )
    
    logger.info(f"Stopped session {session_id}")
    
    return StopSessionResponse(
        session_id=session_id,
        status="completed",
        total_chunks=session_info["chunk_count"],
        total_duration=duration,
        message="Session stopped and summary generated"
    )


@app.get("/sessions/active", response_model=List[SessionInfo])
async def get_active_sessions():
    """Get all active sessions"""
    sessions = []
    
    for session_id, info in active_sessions.items():
        sessions.append(SessionInfo(
            session_id=session_id,
            start_time=info["start_time"],
            status=info["status"],
            metadata=info["metadata"],
            end_time=info.get("end_time")
        ))
    
    return sessions


@app.get("/sessions/{session_id}/status")
async def get_session_status_endpoint(session_id: str):
    """Get status of a specific session"""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    status = await get_session_status(session_id)
    if status:
        return status
    else:
        return active_sessions[session_id]


# Audio processing functions
async def start_audio_processing(session_id: str):
    """Start audio processing for a session"""
    try:
        logger.info(f"Starting audio processing for session {session_id}")
        
        # Create audio capture and processor
        audio_capture = AudioCapture()
        processor = AudioChunkProcessor(audio_capture)
        
        # Add processing callback
        async def process_chunk_callback(chunk_data):
            await process_audio_chunk(session_id, chunk_data)
        
        processor.add_processing_callback(process_chunk_callback)
        
        # Store processor reference
        session_processors[session_id] = processor
        
        # Start processing pipeline
        await processor.start_processing_pipeline()
        
    except Exception as e:
        logger.error(f"Error in audio processing for session {session_id}: {e}")
        
        # Send error status
        await connection_manager.send_status_update(
            session_id,
            f"Audio processing error: {str(e)}",
            {"error": True}
        )
        
        # Mark session as failed
        if session_id in active_sessions:
            active_sessions[session_id]["status"] = "failed"


async def process_audio_chunk(session_id: str, chunk_data: Dict):
    """Process a single audio chunk"""
    try:
        logger.info(f"Processing audio chunk {chunk_data['chunk_id']} for session {session_id}")
        
        # Send processing status
        await connection_manager.send_status_update(
            session_id,
            f"Processing chunk {chunk_data['chunk_id']}...",
            {"chunk_id": chunk_data['chunk_id'], "stage": "ai_processing"}
        )
        
        # Process through AI pipeline
        processed_chunk = await ai_processor.process_audio_chunk(chunk_data)
        
        # Create ProcessedChunk object
        chunk_obj = ProcessedChunk(**processed_chunk)
        
        # Store in meeting processor
        await process_session_chunk(session_id, chunk_obj)
        
        # Update session statistics
        if session_id in active_sessions:
            active_sessions[session_id]["chunk_count"] += 1
        
        # Send real-time update to clients
        await connection_manager.send_chunk_update(session_id, processed_chunk)
        
        logger.info(f"Successfully processed chunk {chunk_data['chunk_id']} for session {session_id}")
        
    except Exception as e:
        logger.error(f"Error processing chunk for session {session_id}: {e}")
        
        # Send error status
        await connection_manager.send_status_update(
            session_id,
            f"Error processing chunk {chunk_data.get('chunk_id', 'unknown')}: {str(e)}",
            {"error": True, "chunk_id": chunk_data.get('chunk_id')}
        )


# System information endpoints
@app.get("/system/connections")
async def get_connection_stats():
    """Get WebSocket connection statistics"""
    return connection_manager.get_connection_stats()


@app.get("/audio/devices", response_model=List[AudioDeviceInfo])
async def list_audio_devices():
    """List available audio input devices"""
    devices = []
    
    try:
        audio = pyaudio.PyAudio()
        device_count = audio.get_device_count()
        
        for i in range(device_count):
            try:
                device_info = audio.get_device_info_by_index(i)
                if device_info['maxInputChannels'] > 0:
                    devices.append(AudioDeviceInfo(
                        device_id=i,
                        name=device_info['name'],
                        channels=device_info['maxInputChannels'],
                        sample_rate=device_info['defaultSampleRate']
                    ))
            except:
                continue
        
        audio.terminate()
    except Exception as e:
        logger.error(f"Error listing audio devices: {e}")
        raise HTTPException(status_code=500, detail="Error accessing audio devices")
    
    return devices


# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return ErrorResponse(
        error="Internal server error",
        detail=str(exc)
    )


if __name__ == "__main__":
    import uvicorn
    
    # Configure logging
    logger.add(
        settings.LOG_FILE,
        rotation="1 day",
        retention="30 days",
        level=settings.LOG_LEVEL
    )
    
    # Run the application
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )