"""
Core AI processing pipeline for meeting transcription and analysis
"""
import asyncio
import os
import tempfile
import numpy as np
import wave
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from loguru import logger

# AI Models
from faster_whisper import WhisperModel
from transformers import pipeline, AutoModelForSeq2SeqLM, AutoTokenizer
import torch
from keybert import KeyBERT
import spacy
import wikipediaapi

from ..config import settings


class TranscriptionService:
    """Handles speech-to-text transcription using Faster-Whisper"""
    
    def __init__(self):
        self.model = None
        self.device = settings.WHISPER_DEVICE
        
    async def initialize(self):
        """Initialize the Whisper model"""
        if self.model is None:
            logger.info(f"Loading Whisper model: {settings.WHISPER_MODEL}")
            self.model = WhisperModel(
                settings.WHISPER_MODEL, 
                device=self.device,
                compute_type="float16" if self.device == "cuda" else "int8"
            )
            logger.info("Whisper model loaded successfully")
    
    async def transcribe_audio(self, audio_data: np.ndarray, sample_rate: int) -> Dict:
        """Transcribe audio data to text"""
        await self.initialize()
        
        try:
            # Save audio data to temporary file for Whisper
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                with wave.open(temp_file.name, 'wb') as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)  # 16-bit
                    wav_file.setframerate(sample_rate)
                    wav_file.writeframes(audio_data.tobytes())
                
                # Transcribe
                segments, info = self.model.transcribe(
                    temp_file.name,
                    beam_size=5,
                    language="en"
                )
                
                # Collect transcription results
                transcript_segments = []
                full_text = ""
                
                for segment in segments:
                    segment_dict = {
                        "start": segment.start,
                        "end": segment.end,
                        "text": segment.text.strip(),
                        "confidence": getattr(segment, 'avg_logprob', 0.0)
                    }
                    transcript_segments.append(segment_dict)
                    full_text += segment.text.strip() + " "
                
                # Cleanup temp file
                os.unlink(temp_file.name)
                
                return {
                    "full_text": full_text.strip(),
                    "segments": transcript_segments,
                    "language": info.language,
                    "language_probability": info.language_probability
                }
                
        except Exception as e:
            logger.error(f"Error in transcription: {e}")
            return {
                "full_text": "",
                "segments": [],
                "language": "en",
                "language_probability": 0.0,
                "error": str(e)
            }



class EmotionDetectionService:
    """Handles emotion detection using HuggingFace transformers"""
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.classifier = None
        
    async def initialize(self):
        """Initialize the emotion detection model"""
        if self.classifier is None:
            try:
                logger.info(f"Loading emotion detection model: {settings.EMOTION_MODEL}")
                self.classifier = pipeline(
                    "text-classification",
                    model=settings.EMOTION_MODEL,
                    device=0 if torch.cuda.is_available() and settings.ENABLE_GPU else -1
                )
                logger.info("Emotion detection model loaded successfully")
            except Exception as e:
                logger.error(f"Error loading emotion model: {e}")
                self.classifier = None
    
    async def detect_emotions(self, speaker_mapping: Dict[str, List[Dict]]) -> Dict:
        """Detect emotions for each speaker"""
        await self.initialize()
        
        emotions_by_speaker = {}
        
        for speaker, segments in speaker_mapping.items():
            # Combine all text from this speaker
            combined_text = " ".join([seg["text"] for seg in segments])
            
            if not combined_text.strip():
                emotions_by_speaker[speaker] = {
                    "dominant_emotion": "neutral",
                    "confidence": 0.0,
                    "all_emotions": {}
                }
                continue
            
            try:
                if self.classifier:
                    # Analyze emotion
                    results = self.classifier(combined_text[:512])  # Limit text length
                    
                    emotions_by_speaker[speaker] = {
                        "dominant_emotion": results[0]["label"].lower(),
                        "confidence": results[0]["score"],
                        "all_emotions": {r["label"].lower(): r["score"] for r in results}
                    }
                else:
                    # Fallback
                    emotions_by_speaker[speaker] = {
                        "dominant_emotion": "neutral",
                        "confidence": 0.0,
                        "all_emotions": {"neutral": 1.0}
                    }
                    
            except Exception as e:
                logger.error(f"Error detecting emotions for {speaker}: {e}")
                emotions_by_speaker[speaker] = {
                    "dominant_emotion": "neutral",
                    "confidence": 0.0,
                    "all_emotions": {"neutral": 1.0}
                }
        
        return emotions_by_speaker


class JargonDetectionService:
    """Handles technical jargon detection and definition lookup"""
    
    def __init__(self):
        self.keybert = None
        self.nlp = None
        self.wiki = None
        
    async def initialize(self):
        """Initialize jargon detection models"""
        if self.keybert is None:
            try:
                logger.info("Loading jargon detection models")
                self.keybert = KeyBERT('distilbert-base-nli-mean-tokens')
                
                # Load spaCy model (download if needed)
                try:
                    self.nlp = spacy.load("en_core_web_sm")
                except OSError:
                    logger.warning("spaCy model not found. Please install: python -m spacy download en_core_web_sm")
                    self.nlp = None
                
                # Initialize Wikipedia API
                self.wiki = wikipediaapi.Wikipedia(
                    user_agent='AI-Meeting-Assistant/1.0 (contact@example.com)',
                    language='en'
                )
                
                logger.info("Jargon detection models loaded successfully")
            except Exception as e:
                logger.error(f"Error loading jargon detection models: {e}")
    
    async def detect_jargon(self, full_text: str) -> List[Dict]:
        """Detect technical jargon and provide definitions"""
        await self.initialize()
        
        if not full_text.strip():
            return []
        
        try:
            jargon_terms = []
            
            if self.keybert:
                # Extract key terms using KeyBERT
                keywords = self.keybert.extract_keywords(
                    full_text, 
                    keyphrase_ngram_range=(1, 3),
                    stop_words='english',
                    top_k=settings.MAX_JARGON_TERMS,
                    use_mmr=True,
                    diversity=0.5
                )
                
                for keyword, score in keywords:
                    if score >= settings.MIN_JARGON_SCORE:
                        definition = await self.get_definition(keyword)
                        
                        jargon_terms.append({
                            "term": keyword,
                            "score": score,
                            "definition": definition,
                            "source": "keybert"
                        })
            
            # Also extract named entities if spaCy is available
            if self.nlp:
                doc = self.nlp(full_text)
                for ent in doc.ents:
                    if ent.label_ in ["ORG", "PRODUCT", "EVENT", "WORK_OF_ART"]:
                        # Check if not already in jargon_terms
                        if not any(term["term"].lower() == ent.text.lower() for term in jargon_terms):
                            definition = await self.get_definition(ent.text)
                            
                            jargon_terms.append({
                                "term": ent.text,
                                "score": 0.7,  # Default score for named entities
                                "definition": definition,
                                "source": "spacy",
                                "entity_type": ent.label_
                            })
            
            return jargon_terms[:settings.MAX_JARGON_TERMS]
            
        except Exception as e:
            logger.error(f"Error in jargon detection: {e}")
            return []
    
    async def get_definition(self, term: str) -> str:
        """Get definition for a term from Wikipedia or return generic description"""
        try:
            if self.wiki:
                page = self.wiki.page(term)
                if page.exists():
                    # Get first paragraph as definition
                    summary = page.summary
                    if summary:
                        # Take first sentence or first 200 characters
                        first_sentence = summary.split('.')[0] + '.'
                        if len(first_sentence) <= 200:
                            return first_sentence
                        else:
                            return summary[:200] + "..."
            
            return f"Technical term: {term}"
            
        except Exception as e:
            logger.error(f"Error getting definition for '{term}': {e}")
            return f"Technical term: {term}"


class SummarizationService:
    """Handles text summarization using BART/T5"""
    
    def __init__(self):
        self.model = None
        self.tokenizer = None
        
    async def initialize(self):
        """Summarization disabled — skipping model load"""
        pass
    
    async def create_micro_summary(self, text: str) -> str:
        """Return first sentence as a simple summary (model disabled)"""
        if not text.strip():
            return "No content to summarize."
        sentences = text.split('.')
        return (sentences[0] + '.') if sentences and len(sentences[0]) > 10 else (text[:100] + "..." if len(text) > 100 else text)

    async def _create_micro_summary_model(self, text: str) -> str:
        """(disabled) model-based micro summary"""
        await self.initialize()
        if not text.strip():
            return "No content to summarize."
        try:
            if self.model and self.tokenizer and len(text) > 50:
                inputs = self.tokenizer(
                    text[:1024], return_tensors='pt',
                    max_length=1024, truncation=True
                )
                if torch.cuda.is_available() and settings.ENABLE_GPU:
                    inputs = {k: v.cuda() for k, v in inputs.items()}
                with torch.no_grad():
                    summary_ids = self.model.generate(
                        inputs['input_ids'],
                        max_length=50, min_length=10,
                        length_penalty=2.0, num_beams=4, early_stopping=True
                    )
                return self.tokenizer.decode(summary_ids[0], skip_special_tokens=True)
            else:
                # Fallback: extract first sentence or truncate
                sentences = text.split('.')
                if sentences and len(sentences[0]) > 10:
                    return sentences[0] + '.'
                else:
                    return text[:100] + "..." if len(text) > 100 else text
                    
        except Exception as e:
            logger.error(f"Error creating micro-summary: {e}")
            # Fallback
            return text[:100] + "..." if len(text) > 100 else text
    
    async def create_full_summary(self, combined_text: str) -> str:
        """Return first 3 sentences as summary (model disabled)"""
        if not combined_text.strip():
            return "No content to summarize."
        sentences = [s.strip() for s in combined_text.split('.') if s.strip()]
        return '. '.join(sentences[:3]) + '.' if sentences else combined_text[:300]

    async def _create_full_summary_model(self, combined_text: str) -> str:
        """(disabled) model-based full summary"""
        await self.initialize()
        if not combined_text.strip():
            return "No content to summarize."
        try:
            if self.model and self.tokenizer:
                # For longer text, summarize in chunks
                max_chunk_length = 1024
                chunks = [combined_text[i:i+max_chunk_length] 
                         for i in range(0, len(combined_text), max_chunk_length)]
                
                summaries = []
                for chunk in chunks:
                    if len(chunk.strip()) > 50:
                        inputs = self.tokenizer(
                            chunk, return_tensors='pt',
                            max_length=1024, truncation=True
                        )
                        if torch.cuda.is_available() and settings.ENABLE_GPU:
                            inputs = {k: v.cuda() for k, v in inputs.items()}
                        with torch.no_grad():
                            summary_ids = self.model.generate(
                                inputs['input_ids'],
                                max_length=150, min_length=30,
                                length_penalty=2.0, num_beams=4, early_stopping=True
                            )
                        summaries.append(
                            self.tokenizer.decode(summary_ids[0], skip_special_tokens=True)
                        )
                
                # Combine and summarize again if multiple chunks
                if len(summaries) > 1:
                    combined_summaries = " ".join(summaries)
                    if len(combined_summaries) > 200:
                        inputs = self.tokenizer(
                            combined_summaries, return_tensors='pt',
                            max_length=1024, truncation=True
                        )
                        if torch.cuda.is_available() and settings.ENABLE_GPU:
                            inputs = {k: v.cuda() for k, v in inputs.items()}
                        with torch.no_grad():
                            final_ids = self.model.generate(
                                inputs['input_ids'],
                                max_length=200, min_length=50,
                                length_penalty=2.0, num_beams=4, early_stopping=True
                            )
                        return self.tokenizer.decode(final_ids[0], skip_special_tokens=True)
                    else:
                        return combined_summaries
                elif len(summaries) == 1:
                    return summaries[0]
            
            # Fallback: manual summarization
            sentences = combined_text.split('.')
            important_sentences = sentences[:3]  # Take first few sentences
            return '. '.join(important_sentences) + '.'
            
        except Exception as e:
            logger.error(f"Error creating full summary: {e}")
            return combined_text[:300] + "..." if len(combined_text) > 300 else combined_text


class AIProcessor:
    """Main AI processing coordinator"""
    
    def __init__(self):
        self.transcription = TranscriptionService()
        self.emotion = EmotionDetectionService()
        self.jargon = JargonDetectionService()
        self.summarizer = SummarizationService()
        
    async def initialize_all(self):
        """Initialize all AI services"""
        logger.info("Initializing all AI services...")
        await asyncio.gather(
            self.transcription.initialize(),
            self.emotion.initialize(),
            self.jargon.initialize()
        )
        logger.info("All AI services initialized")
    
    async def process_audio_chunk(self, chunk_data: Dict) -> Dict:
        """Process a single audio chunk through the full AI pipeline"""
        try:
            logger.info(f"Processing audio chunk {chunk_data['chunk_id']}")
            
            audio_data = chunk_data['data']
            sample_rate = chunk_data['sample_rate']
            
            # Step 1: Transcription
            transcription_result = await self.transcription.transcribe_audio(audio_data, sample_rate)
            
            # Step 2: Speaker — label all segments as Speaker_1 (diarization removed)
            segments = transcription_result['segments']
            for seg in segments:
                seg['speaker'] = 'Speaker_1'
            speaker_result = {
                'speakers': ['Speaker_1'],
                'speaker_segments': segments,
                'speaker_mapping': {'Speaker_1': segments}
            }
            
            # Step 3: Emotion Detection
            emotions = await self.emotion.detect_emotions(speaker_result['speaker_mapping'])
            
            # Step 4: Jargon Detection
            jargon_terms = await self.jargon.detect_jargon(transcription_result['full_text'])
            
            # Step 5: Micro-Summary
            micro_summary = await self.summarizer.create_micro_summary(transcription_result['full_text'])
            
            # Compile results
            result = {
                "chunk_id": chunk_data['chunk_id'],
                "timestamp": chunk_data['timestamp'],
                "start_time": chunk_data.get('start_time', 0),
                "end_time": chunk_data.get('end_time', chunk_data['duration']),
                "duration": chunk_data['duration'],
                "transcript": transcription_result,
                "speakers": speaker_result,
                "emotions": emotions,
                "jargon": jargon_terms,
                "micro_summary": micro_summary,
                "processing_status": "completed"
            }
            
            logger.info(f"Successfully processed chunk {chunk_data['chunk_id']}")
            return result
            
        except Exception as e:
            logger.error(f"Error processing chunk {chunk_data.get('chunk_id', 'unknown')}: {e}")
            return {
                "chunk_id": chunk_data.get('chunk_id', 'unknown'),
                "timestamp": chunk_data.get('timestamp'),
                "processing_status": "failed",
                "error": str(e)
            }