"""
Pydantic models for API request/response validation
"""
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    """Individual transcript segment"""
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds") 
    text: str = Field(..., description="Transcript text")
    confidence: float = Field(default=0.0, description="Transcription confidence score")
    speaker: Optional[str] = Field(default=None, description="Speaker identifier")


class TranscriptionResult(BaseModel):
    """Complete transcription result"""
    full_text: str = Field(..., description="Full transcribed text")
    segments: List[TranscriptSegment] = Field(..., description="Individual transcript segments")
    language: str = Field(default="en", description="Detected language")
    language_probability: float = Field(default=0.0, description="Language detection confidence")
    error: Optional[str] = Field(default=None, description="Error message if transcription failed")


class SpeakerInfo(BaseModel):
    """Speaker identification information"""
    speakers: List[str] = Field(..., description="List of identified speakers")
    speaker_segments: List[TranscriptSegment] = Field(..., description="Segments with speaker labels")
    speaker_mapping: Dict[str, List[TranscriptSegment]] = Field(..., description="Segments grouped by speaker")


class EmotionScore(BaseModel):
    """Emotion detection score"""
    dominant_emotion: str = Field(..., description="Most likely emotion")
    confidence: float = Field(..., description="Confidence score for dominant emotion")
    all_emotions: Dict[str, float] = Field(..., description="Scores for all detected emotions")


class JargonTerm(BaseModel):
    """Detected jargon term with definition"""
    term: str = Field(..., description="The technical term")
    score: float = Field(..., description="Relevance score")
    definition: str = Field(..., description="Definition or explanation")
    source: str = Field(..., description="Source of detection (keybert, spacy, etc.)")
    entity_type: Optional[str] = Field(default=None, description="Entity type if from NER")


class ProcessedChunk(BaseModel):
    """Complete processed audio chunk"""
    chunk_id: int = Field(..., description="Chunk sequence number")
    timestamp: datetime = Field(..., description="Processing timestamp")
    start_time: float = Field(..., description="Start time in meeting")
    end_time: float = Field(..., description="End time in meeting")
    duration: float = Field(..., description="Chunk duration in seconds")
    transcript: TranscriptionResult = Field(..., description="Transcription results")
    speakers: SpeakerInfo = Field(..., description="Speaker identification results")
    emotions: Dict[str, EmotionScore] = Field(..., description="Emotions by speaker")
    jargon: List[JargonTerm] = Field(..., description="Detected jargon terms")
    micro_summary: Optional[str] = Field(default="", description="Brief summary of this chunk (optional)")
    processing_status: str = Field(..., description="Processing status")
    error: Optional[str] = Field(default=None, description="Error message if processing failed")


class ChunkUpdate(BaseModel):
    """WebSocket update for a processed chunk"""
    type: str = Field(default="chunk_update", description="Message type")
    session_id: str = Field(..., description="Session identifier")
    chunk: ProcessedChunk = Field(..., description="Processed chunk data")


class SpeakerSummary(BaseModel):
    """Summary information for a speaker"""
    speaker_id: str = Field(..., description="Speaker identifier")
    total_segments: int = Field(..., description="Number of speech segments")
    total_duration: float = Field(..., description="Total speaking time in seconds")
    word_count: int = Field(..., description="Total words spoken")
    dominant_emotion: str = Field(..., description="Most frequent emotion")
    emotion_distribution: Dict[str, float] = Field(..., description="Emotion percentages")


class MeetingSummary(BaseModel):
    """Complete meeting summary"""
    session_id: str = Field(..., description="Session identifier")
    timestamp: datetime = Field(..., description="Summary creation time")
    combined_transcript: str = Field(..., description="Full meeting transcript")
    final_summary: str = Field(..., description="AI-generated meeting summary")
    speakers_summary: Dict[str, SpeakerSummary] = Field(..., description="Summary by speaker")
    emotions_summary: Dict[str, float] = Field(..., description="Overall emotion distribution")
    jargon_summary: List[JargonTerm] = Field(..., description="All jargon terms found")
    total_chunks: int = Field(..., description="Number of audio chunks processed")
    total_duration: float = Field(..., description="Total meeting duration in seconds")
    meeting_metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional meeting metadata")


class SummaryUpdate(BaseModel):
    """WebSocket update for final summary"""
    type: str = Field(default="summary_update", description="Message type")
    session_id: str = Field(..., description="Session identifier")
    summary: MeetingSummary = Field(..., description="Complete meeting summary")


class SessionInfo(BaseModel):
    """Session information"""
    session_id: str = Field(..., description="Unique session identifier")
    start_time: datetime = Field(..., description="Session start time")
    status: str = Field(..., description="Session status (active, completed, etc.)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Session metadata")
    end_time: Optional[datetime] = Field(default=None, description="Session end time")
    summary_stats: Optional[Dict[str, Any]] = Field(default=None, description="Summary statistics")


class AudioDeviceInfo(BaseModel):
    """Audio device information"""
    device_id: int = Field(..., description="Device index")
    name: str = Field(..., description="Device name")
    channels: int = Field(..., description="Number of input channels")
    sample_rate: float = Field(..., description="Default sample rate")


class SystemStatus(BaseModel):
    """System health and status"""
    status: str = Field(..., description="Overall system status")
    database_connected: bool = Field(..., description="Database connection status")
    ai_models_loaded: bool = Field(..., description="AI models loading status")
    active_sessions: int = Field(..., description="Number of active sessions")
    available_audio_devices: List[AudioDeviceInfo] = Field(..., description="Available audio devices")
    version: str = Field(default="1.0.0", description="API version")


class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(default=None, description="Detailed error description")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")


class StartSessionRequest(BaseModel):
    """Request to start a new session"""
    session_name: Optional[str] = Field(default=None, description="Optional session name")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Session metadata")


class StartSessionResponse(BaseModel):
    """Response for starting a new session"""
    session_id: str = Field(..., description="Generated session identifier")
    status: str = Field(..., description="Session status")
    message: str = Field(..., description="Status message")


class StopSessionRequest(BaseModel):
    """Request to stop a session"""
    session_id: str = Field(..., description="Session to stop")


class StopSessionResponse(BaseModel):
    """Response for stopping a session"""
    session_id: str = Field(..., description="Stopped session identifier")
    status: str = Field(..., description="Final session status")
    total_chunks: int = Field(..., description="Total chunks processed")
    total_duration: float = Field(..., description="Total session duration")
    message: str = Field(..., description="Status message")


# WebSocket message types
class WebSocketMessage(BaseModel):
    """Base WebSocket message"""
    type: str = Field(..., description="Message type")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")
    session_id: Optional[str] = Field(default=None, description="Session identifier if applicable")


class StatusMessage(WebSocketMessage):
    """Status update message"""
    type: str = Field(default="status", description="Message type")
    status: str = Field(..., description="Status text")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Additional status details")


class ConnectionMessage(WebSocketMessage):
    """Connection status message"""
    type: str = Field(default="connection", description="Message type")
    status: str = Field(..., description="Connection status (connected, disconnected)")
    client_id: str = Field(..., description="Client identifier")


class HeartbeatMessage(WebSocketMessage):
    """Heartbeat message for connection maintenance"""
    type: str = Field(default="heartbeat", description="Message type")
    server_time: datetime = Field(default_factory=datetime.utcnow, description="Server timestamp")


# ============================================================================
# LLM Structured Meeting Summary Schemas (Groq + LangChain)
# ============================================================================

class ActionItem(BaseModel):
    """Individual action item extracted from meeting transcript"""
    task: str = Field(..., description="Actionable task or deliverable")
    assignee: Optional[str] = Field(default="Not mentioned", description="Person responsible, or 'Not mentioned'")
    deadline: Optional[str] = Field(default="Not mentioned", description="Explicit deadline or due date, or 'Not mentioned'")
    status: Optional[str] = Field(default="Pending", description="Status (Pending, In Progress, Completed, or 'Not mentioned')")


class StructuredSummary(BaseModel):
    """Complete structured meeting intelligence summary"""
    meeting_overview: str = Field(
        ..., 
        description="Comprehensive overview of the meeting background, goals, and context"
    )
    executive_summary: str = Field(
        ..., 
        description="Clear, executive-ready narrative summarizing discussions, progress, and outcomes"
    )
    key_points: List[str] = Field(
        default_factory=list, 
        description="List of primary discussion points and takeaways"
    )
    decisions_made: List[str] = Field(
        default_factory=list, 
        description="Explicit decisions, approvals, or strategic directions agreed upon"
    )
    action_items: List[ActionItem] = Field(
        default_factory=list, 
        description="Action items extracted with assignees and deadlines"
    )
    questions_and_issues: List[str] = Field(
        default_factory=list, 
        description="Open questions, risks, blockers, or unresolved issues raised"
    )
    key_topics: List[str] = Field(
        default_factory=list, 
        description="Major topics, concepts, or technical terms addressed"
    )
    participants: List[str] = Field(
        default_factory=list, 
        description="List of identified speakers or participants ('Not mentioned' if unknown)"
    )
    follow_up_items: List[str] = Field(
        default_factory=list, 
        description="Follow-up meetings, syncs, or items scheduled"
    )
    concise_summary: str = Field(
        ..., 
        description="Punchy, informative 1-2 sentence quick summary of the meeting"
    )


class MeetingSummaryResponse(BaseModel):
    """Response payload for meeting summary API"""
    session_id: str = Field(..., description="Session identifier")
    summary: StructuredSummary = Field(..., description="Structured summary data")
    generated_at: datetime = Field(..., description="Timestamp of summary generation")
    summary_version: str = Field(default="1.0.0", description="Summary schema version")
    model_used: str = Field(..., description="Name of LLM model used")
    is_cached: bool = Field(default=False, description="True if retrieved from database cache")
    total_chunks: int = Field(default=0, description="Total chunks processed")
    total_duration: float = Field(default=0.0, description="Meeting duration in seconds")


class GenerateSummaryRequest(BaseModel):
    """Request payload for generating or regenerating summary"""
    force_regenerate: bool = Field(default=False, description="Force re-generation bypassing cache")


class MeetingListItem(BaseModel):
    """Meeting summary representation for list view"""
    session_id: str = Field(..., description="Unique meeting session ID")
    session_name: Optional[str] = Field(default=None, description="Human-readable session name")
    start_time: datetime = Field(..., description="Start timestamp")
    end_time: Optional[datetime] = Field(default=None, description="End timestamp")
    status: str = Field(..., description="Meeting status: active, completed, failed")
    total_chunks: int = Field(default=0, description="Total audio chunks")
    duration_seconds: float = Field(default=0.0, description="Total meeting duration in seconds")
    has_summary: bool = Field(default=False, description="Whether an AI summary is generated")
    concise_summary: Optional[str] = Field(default=None, description="Short summary preview if available")


class MeetingDetailResponse(BaseModel):
    """Complete meeting detail including transcript and summary"""
    session_id: str = Field(..., description="Session identifier")
    session_name: Optional[str] = Field(default=None, description="Session name")
    start_time: datetime = Field(..., description="Start timestamp")
    end_time: Optional[datetime] = Field(default=None, description="End timestamp")
    status: str = Field(..., description="Meeting status")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Session metadata")
    total_chunks: int = Field(default=0, description="Number of chunks")
    duration_seconds: float = Field(default=0.0, description="Total duration in seconds")
    combined_transcript: str = Field(default="", description="Full stitched transcript")
    chunks: List[Dict[str, Any]] = Field(default_factory=list, description="Processed chunk details")
    summary: Optional[StructuredSummary] = Field(default=None, description="Structured summary if available")
    summary_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Generation metadata (model, timestamp, version)")