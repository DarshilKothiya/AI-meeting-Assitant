"""
AI Meeting Summary Service using LangChain and Groq LLM
Provides structured meeting intelligence, action item extraction,
and chunking for long transcripts.
"""
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
import asyncio
from loguru import logger

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..config import settings
from ..models.schemas import (
    StructuredSummary, ActionItem, MeetingSummaryResponse, ProcessedChunk
)
from ..database import SummaryOperations, SessionOperations, ChunkOperations


class GroqConfigurationError(Exception):
    """Raised when Groq API key or configuration is missing or invalid."""
    pass


class TranscriptEmptyError(Exception):
    """Raised when the meeting transcript is empty or contains no speech."""
    pass


class SummaryService:
    """
    Dedicated LLM summarization pipeline powered by Groq and LangChain.
    Extracts structured meeting intelligence with anti-hallucination guardrails.
    """

    SYSTEM_PROMPT = """You are an elite, highly rigorous AI Meeting Intelligence Assistant.
Your task is to analyze meeting transcripts and produce a precise, structured, factual executive summary.

CRITICAL INSTRUCTIONS & GUARDRAILS:
1. STRICT FACTUALITY: Rely EXCLUSIVELY on information explicitly stated in the transcript. Do NOT extrapolate, speculate, or hallucinate.
2. MISSING INFORMATION: If a field or detail (such as participant names, deadlines, owners, or decisions) is not explicitly present in the transcript, you MUST specify "Not mentioned" rather than guessing.
3. DECISIONS VS DISCUSSION: Clearly distinguish between topics merely discussed/debated versus explicit decisions or agreements reached.
4. ACTION ITEMS: For each action item, identify:
   - task: Specific, clear description of the assigned work.
   - assignee: The specific person or role explicitly tasked, or "Not mentioned".
   - deadline: The exact target date or timeline explicitly mentioned, or "Not mentioned".
   - status: The current status mentioned (e.g., "Pending", "In Progress", "Completed", or "Not mentioned").
5. PARTICIPANTS: List only individuals or speakers identifiable from the transcript or speaker tags. If names are unavailable, list identified speaker labels (e.g., "Speaker 1", "Speaker 2") or "Not mentioned".
6. QUESTIONS & ISSUES: Highlight critical open questions, roadblocks, risks, or unresolved debates.
7. TECHNICAL ACCURACY: Preserve technical terminology, metrics, project names, and architectural decisions accurately.
8. CONCISE SUMMARY: Provide a high-impact, 1 to 2 sentence executive takeaway that captures the essence of the entire meeting.
"""

    CHUNK_SUMMARY_PROMPT = """You are an AI Meeting Assistant analyzing a section of a larger meeting transcript.
Summarize this section accurately and factually:
- Main discussion points and topics
- Any decisions agreed upon in this section
- Any action items with owners and deadlines mentioned
- Any open questions or blockers raised

Transcript Section:
{chunk_text}
"""

    def __init__(self):
        self._llm = None
        self._model_name = settings.GROQ_MODEL
        self._api_key = settings.GROQ_API_KEY

    def _get_llm(self, model_name: Optional[str] = None) -> Tuple[ChatGroq, str]:
        """Initialize or return the ChatGroq client with validated API key."""
        api_key = settings.GROQ_API_KEY
        if not api_key or api_key == "your_groq_api_key_here" or not api_key.strip():
            raise GroqConfigurationError(
                "GROQ_API_KEY is not configured. Please set GROQ_API_KEY in your .env file "
                "or environment variables (obtain a free key at https://console.groq.com/keys)."
            )

        target_model = model_name or settings.GROQ_MODEL or "openai/gpt-oss-120b"
        return ChatGroq(
            model=target_model,
            api_key=api_key,
            temperature=0.1,
            max_retries=2,
            timeout=45.0,
        ), target_model

    def prepare_transcript_from_chunks(self, chunks: List[Dict[str, Any]]) -> str:
        """
        Clean and format raw chunk data into a coherent, chronological transcript with timestamps and speakers.
        """
        if not chunks:
            return ""

        # Sort chunks chronologically by chunk_id or start_time
        sorted_chunks = sorted(chunks, key=lambda c: c.get("chunk_id", 0))
        lines = []

        for chunk in sorted_chunks:
            # Extract text safely
            transcript_data = chunk.get("transcript") or {}
            full_text = ""
            if isinstance(transcript_data, dict):
                full_text = transcript_data.get("full_text", "").strip()
            elif isinstance(chunk.get("text"), str):
                full_text = chunk.get("text", "").strip()

            if not full_text:
                continue

            # Format start time in [MM:SS]
            start_time = chunk.get("start_time", 0)
            mins = int(start_time // 60)
            secs = int(start_time % 60)
            timestamp_str = f"[{mins:02d}:{secs:02d}]"

            # Extract speaker information
            speakers_data = chunk.get("speakers") or {}
            speaker_label = chunk.get("speaker") or "Speaker"
            if isinstance(speakers_data, dict) and speakers_data.get("speakers"):
                speaker_list = speakers_data.get("speakers", [])
                if speaker_list:
                    speaker_label = ", ".join(speaker_list)
            elif isinstance(speakers_data, list) and speakers_data:
                speaker_label = ", ".join(speakers_data)

            lines.append(f"{timestamp_str} {speaker_label}: {full_text}")

        return "\n".join(lines).strip()

    async def generate_summary(
        self, 
        session_id: str, 
        raw_transcript: Optional[str] = None,
        force_regenerate: bool = False
    ) -> MeetingSummaryResponse:
        """
        Main pipeline:
        1. Check DB cache if force_regenerate is False.
        2. Fetch chunks / transcript if not provided directly.
        3. Preprocess and clean transcript.
        4. Check length: single-pass vs map-reduce chunking.
        5. Invoke Groq through LangChain with structured Pydantic output.
        6. Persist structured summary to MongoDB / in-memory database.
        7. Return structured MeetingSummaryResponse.
        """
        logger.info(f"SummaryService: processing summary request for session {session_id} (force_regenerate={force_regenerate})")

        # Step 1: Check existing cached summary
        if not force_regenerate:
            cached_doc = await SummaryOperations.get_structured_summary(session_id)
            if cached_doc and cached_doc.get("structured_summary"):
                logger.info(f"SummaryService: returning cached summary for session {session_id}")
                return MeetingSummaryResponse(
                    session_id=session_id,
                    summary=StructuredSummary(**cached_doc["structured_summary"]),
                    generated_at=cached_doc.get("generated_at", datetime.utcnow()),
                    summary_version=cached_doc.get("summary_version", "1.0.0"),
                    model_used=cached_doc.get("model_used", settings.GROQ_MODEL),
                    is_cached=True,
                    total_chunks=cached_doc.get("total_chunks", 0),
                    total_duration=cached_doc.get("total_duration", 0.0),
                )

        # Step 2: Assemble transcript if not directly supplied
        transcript_text = (raw_transcript or "").strip()
        chunks = []

        if not transcript_text:
            chunks = await ChunkOperations.get_chunks_for_session(session_id)
            transcript_text = self.prepare_transcript_from_chunks(chunks)

        if not transcript_text or len(transcript_text.strip()) < 10:
            logger.warning(f"SummaryService: no speech content available for session {session_id}")
            raise TranscriptEmptyError(
                f"Cannot generate summary: meeting session '{session_id}' has no transcribed speech."
            )

        # Calculate metadata
        total_chunks = len(chunks) if chunks else 1
        total_duration = 0.0
        if chunks:
            total_duration = max(c.get("end_time", 0.0) for c in chunks)

        # Step 3: Run LangChain + Groq structured extraction
        llm, model_name = self._get_llm()
        structured_llm = llm.with_structured_output(StructuredSummary)

        structured_result: StructuredSummary
        chunk_threshold = settings.SUMMARY_CHUNK_SIZE  # e.g., 6000 chars (~1000-1500 words)

        async def _execute_summarization(active_llm: ChatGroq, active_structured_llm: Any) -> StructuredSummary:
            if len(transcript_text) > chunk_threshold:
                logger.info(f"SummaryService: transcript is long ({len(transcript_text)} chars) -> running hierarchical summarization")
                return await self._summarize_long_transcript(
                    active_llm, active_structured_llm, transcript_text
                )
            else:
                logger.info(f"SummaryService: running direct single-pass summarization ({len(transcript_text)} chars)")
                return await self._summarize_single_pass(
                    active_structured_llm, transcript_text
                )

        try:
            structured_result = await _execute_summarization(llm, structured_llm)
        except Exception as e:
            err_msg = str(e).lower()
            if "model_not_found" in err_msg or "does not exist or you do not have access" in err_msg or "404" in err_msg:
                logger.warning(f"Groq model '{model_name}' unavailable ({e}). Attempting automatic fallback.")
                fallback_models = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
                candidate_models = [m for m in fallback_models if m != model_name]
                succeeded = False
                for fb_model in candidate_models:
                    try:
                        logger.info(f"Attempting fallback Groq model: '{fb_model}'")
                        fb_llm, fb_name = self._get_llm(model_name=fb_model)
                        fb_structured = fb_llm.with_structured_output(StructuredSummary)
                        structured_result = await _execute_summarization(fb_llm, fb_structured)
                        model_name = fb_name
                        succeeded = True
                        logger.info(f"Successfully generated summary using fallback Groq model '{fb_model}'")
                        break
                    except Exception as fb_err:
                        logger.warning(f"Fallback model '{fb_model}' failed: {fb_err}")
                if not succeeded:
                    raise
            else:
                raise

        # Step 4: Persist structured summary to database
        summary_payload = {
            "session_id": session_id,
            "structured_summary": structured_result.model_dump(),
            "generated_at": datetime.utcnow(),
            "summary_version": "1.0.0",
            "model_used": model_name,
            "total_chunks": total_chunks,
            "total_duration": total_duration,
            "transcript_preview": transcript_text[:500],
        }

        await SummaryOperations.save_structured_summary(session_id, summary_payload)
        await SessionOperations.update_session_summary_status(session_id, True)

        logger.info(f"SummaryService: successfully generated and saved summary for session {session_id}")

        return MeetingSummaryResponse(
            session_id=session_id,
            summary=structured_result,
            generated_at=summary_payload["generated_at"],
            summary_version="1.0.0",
            model_used=model_name,
            is_cached=False,
            total_chunks=total_chunks,
            total_duration=total_duration,
        )

    async def _summarize_single_pass(
        self, 
        structured_llm: Any, 
        transcript_text: str
    ) -> StructuredSummary:
        """Generate structured summary in a single pass for standard-length meetings."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", self.SYSTEM_PROMPT),
            ("human", "Here is the full meeting transcript:\n\n{transcript}\n\nAnalyze it and generate the structured summary."),
        ])

        chain = prompt | structured_llm
        try:
            # LangChain async invocation
            result = await chain.ainvoke({"transcript": transcript_text})
            return result
        except Exception as e:
            logger.error(f"SummaryService error in single-pass invocation: {e}")
            raise

    async def _summarize_long_transcript(
        self, 
        llm: ChatGroq, 
        structured_llm: Any, 
        transcript_text: str
    ) -> StructuredSummary:
        """
        Hierarchical summarization for long meetings:
        1. Split transcript into logical chunks using LangChain RecursiveCharacterTextSplitter.
        2. Summarize each chunk into an intermediate section summary.
        3. Combine section summaries and generate the final StructuredSummary.
        """
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.SUMMARY_CHUNK_SIZE,
            chunk_overlap=settings.SUMMARY_CHUNK_OVERLAP,
            separators=["\n\n", "\n", ". ", " "],
        )
        splits = text_splitter.split_text(transcript_text)
        logger.info(f"SummaryService: split transcript into {len(splits)} chunks for intermediate summarization")

        # Map phase: generate intermediate summary for each chunk
        intermediate_summaries = []
        chunk_prompt = ChatPromptTemplate.from_template(self.CHUNK_SUMMARY_PROMPT)
        chunk_chain = chunk_prompt | llm

        for idx, chunk_text in enumerate(splits):
            logger.info(f"SummaryService: processing intermediate chunk {idx + 1}/{len(splits)}")
            response = await chunk_chain.ainvoke({"chunk_text": chunk_text})
            summary_content = getattr(response, "content", str(response))
            intermediate_summaries.append(f"### Section {idx + 1} Summary:\n{summary_content}")

        combined_intermediate = "\n\n".join(intermediate_summaries)

        # Reduce phase: synthesize intermediate summaries into final StructuredSummary
        reduce_prompt = ChatPromptTemplate.from_messages([
            ("system", self.SYSTEM_PROMPT + "\n\nYou are provided with detailed section-by-section summaries of a long meeting. Synthesize them into the comprehensive final structured summary."),
            ("human", "Here are the section summaries of the meeting:\n\n{section_summaries}\n\nGenerate the complete final structured meeting summary."),
        ])

        reduce_chain = reduce_prompt | structured_llm
        final_summary = await reduce_chain.ainvoke({"section_summaries": combined_intermediate})
        return final_summary


# Global summary service singleton
summary_service = SummaryService()
