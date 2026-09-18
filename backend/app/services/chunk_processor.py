"""
Chunk stitching and final summarization system
"""
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Set, Counter
from collections import defaultdict, Counter
from loguru import logger

from ..models.schemas import (
    ProcessedChunk, MeetingSummary, SpeakerSummary,
    JargonTerm, EmotionScore
)
from ..database import ChunkOperations, SummaryOperations
from .ai_processor import SummarizationService


class SpeakerConsistencyManager:
    """Manages consistent speaker labeling across chunks"""
    
    def __init__(self):
        self.speaker_mapping = {}  # Maps chunk speakers to consistent labels
        self.next_speaker_id = 1
        
    def get_consistent_speaker_id(self, chunk_speakers: List[str], chunk_id: int) -> Dict[str, str]:
        """Map chunk speakers to consistent speaker IDs"""
        mapping = {}
        
        for chunk_speaker in chunk_speakers:
            if chunk_speaker not in self.speaker_mapping:
                # Assign new consistent ID
                consistent_id = f"Speaker_{self.next_speaker_id}"
                self.speaker_mapping[chunk_speaker] = consistent_id
                self.next_speaker_id += 1
                
            mapping[chunk_speaker] = self.speaker_mapping[chunk_speaker]
            
        return mapping
    
    def apply_consistent_labeling(self, chunk_data: ProcessedChunk) -> ProcessedChunk:
        """Apply consistent speaker labels to a chunk"""
        # Get mapping for this chunk's speakers
        chunk_speakers = chunk_data.speakers.speakers
        mapping = self.get_consistent_speaker_id(chunk_speakers, chunk_data.chunk_id)
        
        # Update speaker information
        new_speakers = [mapping[speaker] for speaker in chunk_speakers]
        chunk_data.speakers.speakers = new_speakers
        
        # Update segments
        for segment in chunk_data.speakers.speaker_segments:
            if segment.speaker and segment.speaker in mapping:
                segment.speaker = mapping[segment.speaker]
        
        # Update speaker mapping
        new_speaker_mapping = {}
        for original_speaker, segments in chunk_data.speakers.speaker_mapping.items():
            if original_speaker in mapping:
                consistent_speaker = mapping[original_speaker]
                new_speaker_mapping[consistent_speaker] = segments
                
                # Update segment speaker labels
                for segment in segments:
                    segment.speaker = consistent_speaker
        
        chunk_data.speakers.speaker_mapping = new_speaker_mapping
        
        # Update emotions mapping
        new_emotions = {}
        for original_speaker, emotion_data in chunk_data.emotions.items():
            if original_speaker in mapping:
                consistent_speaker = mapping[original_speaker]
                new_emotions[consistent_speaker] = emotion_data
        
        chunk_data.emotions = new_emotions
        
        return chunk_data


class ChunkStitcher:
    """Combines multiple chunks into a coherent meeting transcript"""
    
    def __init__(self):
        self.summarizer = SummarizationService()
        self.speaker_manager = SpeakerConsistencyManager()
        
    async def stitch_chunks(self, session_id: str, chunks: List[ProcessedChunk]) -> MeetingSummary:
        """Combine multiple chunks into a final meeting summary"""
        logger.info(f"Stitching {len(chunks)} chunks for session {session_id}")
        
        if not chunks:
            return await self._create_empty_summary(session_id)
        
        # Sort chunks by chunk_id to ensure correct order
        chunks.sort(key=lambda x: x.chunk_id)
        
        # Apply consistent speaker labeling
        consistent_chunks = []
        for chunk in chunks:
            consistent_chunk = self.speaker_manager.apply_consistent_labeling(chunk)
            consistent_chunks.append(consistent_chunk)
        
        # Combine transcripts
        combined_transcript = self._combine_transcripts(consistent_chunks)
        
        # Combine speakers information
        speakers_summary = self._create_speakers_summary(consistent_chunks)
        
        # Combine emotions
        emotions_summary = self._combine_emotions(consistent_chunks)
        
        # Combine jargon
        jargon_summary = self._combine_jargon(consistent_chunks)
        
        # Generate baseline final summary from stitched transcript
        summary_input = combined_transcript if combined_transcript else " ".join([getattr(c.transcript, 'full_text', '') for c in consistent_chunks])
        final_summary = await self.summarizer.create_full_summary(summary_input)
        
        # Calculate metadata
        total_duration = sum(chunk.duration for chunk in consistent_chunks)
        
        # Create meeting summary
        meeting_summary = MeetingSummary(
            session_id=session_id,
            timestamp=datetime.utcnow(),
            combined_transcript=combined_transcript,
            final_summary=final_summary,
            speakers_summary=speakers_summary,
            emotions_summary=emotions_summary,
            jargon_summary=jargon_summary,
            total_chunks=len(consistent_chunks),
            total_duration=total_duration,
            meeting_metadata={
                "chunk_range": {
                    "start": min(chunk.chunk_id for chunk in consistent_chunks),
                    "end": max(chunk.chunk_id for chunk in consistent_chunks)
                },
                "processing_time": datetime.utcnow().isoformat(),
                "speaker_consistency_applied": True
            }
        )
        
        logger.info(f"Successfully stitched chunks for session {session_id}")
        return meeting_summary
    
    def _combine_transcripts(self, chunks: List[ProcessedChunk]) -> str:
        """Combine transcripts from all chunks in chronological order"""
        transcript_parts = []
        
        for chunk in chunks:
            if chunk.transcript.full_text.strip():
                # Add timestamp and transcript
                start_time = int(chunk.start_time)
                minutes = start_time // 60
                seconds = start_time % 60
                timestamp = f"[{minutes:02d}:{seconds:02d}]"
                
                # Group by speaker if speaker info is available
                if chunk.speakers.speaker_mapping:
                    for speaker, segments in chunk.speakers.speaker_mapping.items():
                        speaker_text = " ".join([seg.text for seg in segments if seg.text.strip()])
                        if speaker_text.strip():
                            transcript_parts.append(f"{timestamp} {speaker}: {speaker_text}")
                else:
                    transcript_parts.append(f"{timestamp} {chunk.transcript.full_text}")
        
        return "\n".join(transcript_parts)
    
    def _create_speakers_summary(self, chunks: List[ProcessedChunk]) -> Dict[str, SpeakerSummary]:
        """Create summary information for each speaker"""
        speaker_data = defaultdict(lambda: {
            'segments': [],
            'total_duration': 0,
            'emotions': []
        })
        
        # Collect data for each speaker across all chunks
        for chunk in chunks:
            for speaker, segments in chunk.speakers.speaker_mapping.items():
                speaker_data[speaker]['segments'].extend(segments)
                
                # Calculate speaking duration for this chunk
                chunk_duration = sum(seg.end - seg.start for seg in segments)
                speaker_data[speaker]['total_duration'] += chunk_duration
                
                # Collect emotions
                if speaker in chunk.emotions:
                    speaker_data[speaker]['emotions'].append(chunk.emotions[speaker])
        
        # Create speaker summaries
        speakers_summary = {}
        for speaker, data in speaker_data.items():
            segments = data['segments']
            
            # Calculate word count
            word_count = sum(len(seg.text.split()) for seg in segments)
            
            # Determine dominant emotion
            emotions = data['emotions']
            if emotions:
                emotion_counter = Counter()
                for emotion_score in emotions:
                    emotion_counter[emotion_score.dominant_emotion] += 1
                
                dominant_emotion = emotion_counter.most_common(1)[0][0]
                
                # Calculate emotion distribution
                total_emotions = len(emotions)
                emotion_distribution = {
                    emotion: count / total_emotions 
                    for emotion, count in emotion_counter.items()
                }
            else:
                dominant_emotion = "neutral"
                emotion_distribution = {"neutral": 1.0}
            
            speakers_summary[speaker] = SpeakerSummary(
                speaker_id=speaker,
                total_segments=len(segments),
                total_duration=data['total_duration'],
                word_count=word_count,
                dominant_emotion=dominant_emotion,
                emotion_distribution=emotion_distribution
            )
        
        return speakers_summary
    
    def _combine_emotions(self, chunks: List[ProcessedChunk]) -> Dict[str, float]:
        """Combine emotion data across all chunks"""
        all_emotions = defaultdict(list)
        
        # Collect all emotion scores
        for chunk in chunks:
            for speaker, emotion_score in chunk.emotions.items():
                for emotion, score in emotion_score.all_emotions.items():
                    all_emotions[emotion].append(score)
        
        # Calculate average scores
        emotions_summary = {}
        for emotion, scores in all_emotions.items():
            emotions_summary[emotion] = sum(scores) / len(scores)
        
        return emotions_summary
    
    def _combine_jargon(self, chunks: List[ProcessedChunk]) -> List[JargonTerm]:
        """Combine and deduplicate jargon terms"""
        jargon_map = {}
        
        for chunk in chunks:
            for term in chunk.jargon:
                term_key = term.term.lower()
                
                if term_key in jargon_map:
                    # Update score if this occurrence has higher confidence
                    if term.score > jargon_map[term_key].score:
                        jargon_map[term_key] = term
                else:
                    jargon_map[term_key] = term
        
        # Sort by score and return top terms
        sorted_jargon = sorted(jargon_map.values(), key=lambda x: x.score, reverse=True)
        return sorted_jargon[:20]  # Limit to top 20 terms
    
    async def _create_empty_summary(self, session_id: str) -> MeetingSummary:
        """Create an empty summary for sessions with no chunks"""
        return MeetingSummary(
            session_id=session_id,
            timestamp=datetime.utcnow(),
            combined_transcript="No content recorded.",
            final_summary="No meeting content was captured.",
            speakers_summary={},
            emotions_summary={},
            jargon_summary=[],
            total_chunks=0,
            total_duration=0.0,
            meeting_metadata={"empty_session": True}
        )


class MeetingProcessor:
    """Main processor for managing meeting sessions and generating summaries"""
    
    def __init__(self):
        self.chunk_stitcher = ChunkStitcher()
        self.active_sessions = {}  # Track active session data
        
    async def initialize(self):
        """Initialize the meeting processor"""
        await self.chunk_stitcher.summarizer.initialize()
        logger.info("Meeting processor initialized")
    
    async def add_chunk_to_session(self, session_id: str, chunk_data: ProcessedChunk) -> bool:
        """Add a processed chunk to an active session"""
        try:
            # Store chunk in database
            chunk_dict = chunk_data.dict()
            success = await ChunkOperations.save_chunk(session_id, chunk_dict)
            
            if success:
                # Update session tracking
                if session_id not in self.active_sessions:
                    self.active_sessions[session_id] = {
                        'chunk_count': 0,
                        'last_update': datetime.utcnow()
                    }
                
                self.active_sessions[session_id]['chunk_count'] += 1
                self.active_sessions[session_id]['last_update'] = datetime.utcnow()
                
                logger.info(f"Added chunk {chunk_data.chunk_id} to session {session_id}")
                return True
            else:
                logger.error(f"Failed to save chunk {chunk_data.chunk_id} for session {session_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error adding chunk to session {session_id}: {e}")
            return False
    
    async def finalize_session(self, session_id: str) -> Optional[MeetingSummary]:
        """Generate final summary for a completed session"""
        try:
            logger.info(f"Finalizing session {session_id}")
            
            # Retrieve all chunks for this session
            chunk_dicts = await ChunkOperations.get_chunks_for_session(session_id)
            
            if not chunk_dicts:
                logger.warning(f"No chunks found for session {session_id}")
                return await self.chunk_stitcher._create_empty_summary(session_id)
            
            # Convert dictionaries to ProcessedChunk objects
            chunks = []
            for chunk_dict in chunk_dicts:
                try:
                    # Remove MongoDB-specific fields
                    chunk_dict.pop('_id', None)
                    chunk_dict.pop('session_id', None)
                    chunk_dict.pop('created_at', None)
                    
                    chunk = ProcessedChunk(**chunk_dict)
                    chunks.append(chunk)
                except Exception as e:
                    logger.error(f"Error converting chunk data: {e}")
                    continue
            
            # Generate meeting summary
            meeting_summary = await self.chunk_stitcher.stitch_chunks(session_id, chunks)
            
            # Save summary to database
            summary_dict = meeting_summary.dict()
            await SummaryOperations.save_summary(session_id, summary_dict)
            
            # Clean up session tracking
            if session_id in self.active_sessions:
                del self.active_sessions[session_id]
            
            logger.info(f"Successfully finalized session {session_id} with {len(chunks)} chunks")
            return meeting_summary
            
        except Exception as e:
            logger.error(f"Error finalizing session {session_id}: {e}")
            return None
    
    async def get_session_progress(self, session_id: str) -> Optional[Dict]:
        """Get current progress for an active session"""
        if session_id in self.active_sessions:
            session_info = self.active_sessions[session_id].copy()
            
            # Get latest chunks from database
            recent_chunks = await ChunkOperations.get_chunks_for_session(session_id)
            session_info['total_chunks'] = len(recent_chunks)
            
            if recent_chunks:
                latest_chunk = max(recent_chunks, key=lambda x: x['chunk_id'])
                session_info['latest_chunk_id'] = latest_chunk['chunk_id']
                session_info['estimated_duration'] = latest_chunk.get('end_time', 0)
            
            return session_info
        
        return None
    
    def get_active_sessions(self) -> List[str]:
        """Get list of active session IDs"""
        return list(self.active_sessions.keys())


# Global meeting processor instance
meeting_processor = MeetingProcessor()


async def initialize_meeting_processor():
    """Initialize the global meeting processor"""
    await meeting_processor.initialize()


# Utility functions for external use
async def process_session_chunk(session_id: str, chunk_data: ProcessedChunk) -> bool:
    """Add a chunk to a session - convenience function"""
    return await meeting_processor.add_chunk_to_session(session_id, chunk_data)


async def generate_session_summary(session_id: str) -> Optional[MeetingSummary]:
    """Generate final summary for a session - convenience function"""
    return await meeting_processor.finalize_session(session_id)


async def get_session_status(session_id: str) -> Optional[Dict]:
    """Get status of an active session - convenience function"""
    return await meeting_processor.get_session_progress(session_id)