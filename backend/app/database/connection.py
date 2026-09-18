"""
Database connection and operations manager.
Supports MongoDB (local or Atlas) with seamless automatic fallback to
robust, persistent local disk storage (data/meetings_db.json).
Ensures meetings, audio chunks, and summaries survive server restarts
even when remote MongoDB credentials or network are offline.
"""
import asyncio
import copy
import glob
import json
import os
import re
from datetime import datetime, date
from typing import Dict, List, Optional, Any
from loguru import logger
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, OperationFailure

from ..config import settings


def _json_serializer(obj: Any) -> Any:
    """Helper serializer for datetimes and non-standard objects."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if hasattr(obj, "dict") and callable(obj.dict):
        return obj.dict()
    if hasattr(obj, "model_dump") and callable(obj.model_dump):
        return obj.model_dump()
    return str(obj)


class LocalStorageManager:
    """
    Disk-backed persistent document store located at data/meetings_db.json.
    Ensures zero data loss across restarts if MongoDB is unavailable.
    """

    def __init__(self):
        self.file_path = os.path.join(settings.DATA_DIR, "meetings_db.json")
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.chunks: Dict[str, List[Dict[str, Any]]] = {}
        self.summaries: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self._initialized = False

    async def initialize(self):
        """Load persistent storage from disk and recover any untracked transcripts."""
        async with self._lock:
            if self._initialized:
                return

            os.makedirs(settings.DATA_DIR, exist_ok=True)
            if os.path.exists(self.file_path):
                try:
                    with open(self.file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.sessions = data.get("sessions", {})
                        self.chunks = data.get("chunks", {})
                        self.summaries = data.get("summaries", {})
                        logger.info(
                            f"[Local Storage] Loaded {len(self.sessions)} sessions, "
                            f"{sum(len(c) for c in self.chunks.values())} chunks from {self.file_path}"
                        )
                except Exception as e:
                    logger.error(f"[Local Storage] Error reading {self.file_path}: {e}. Creating fresh store.")
                    self.sessions = {}
                    self.chunks = {}
                    self.summaries = {}

            # Recover any past transcription files from disk that aren't yet in storage
            recovered_count = self._recover_past_transcriptions()
            if recovered_count > 0:
                self._flush_to_disk()

            self._initialized = True

    def _recover_past_transcriptions(self) -> int:
        """
        Scan data/transcriptions for any chunk_*.txt files from past meetings
        and index them into persistent sessions so they display in the UI.
        """
        trans_dir = getattr(settings, "TRANSCRIPTIONS_DIR", os.path.join(settings.DATA_DIR, "transcriptions"))
        if not os.path.exists(trans_dir):
            return 0

        txt_files = sorted(glob.glob(os.path.join(trans_dir, "chunk_*.txt")))
        if not txt_files:
            return 0

        pattern = re.compile(r"chunk_(\d+)_(\d{8})_(\d{6})")
        grouped: Dict[str, Dict[str, Any]] = {}

        for fpath in txt_files:
            fname = os.path.basename(fpath)
            m = pattern.match(fname)
            if not m:
                continue

            chunk_id = int(m.group(1))
            d_str = m.group(2)
            t_str = m.group(3)
            try:
                dt = datetime.strptime(f"{d_str}_{t_str}", "%Y%m%d_%H%M%S")
            except Exception:
                dt = datetime.utcnow()

            # Read transcribed text content
            full_text = ""
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                if "--------------------------------------------------" in content:
                    parts = content.split("--------------------------------------------------")
                    if len(parts) > 1:
                        body = parts[1]
                        full_text = body.split("--- Segments ---")[0].strip() if "--- Segments ---" in body else body.strip()
            except Exception:
                pass

            # Group chunks that belong to the same recording session
            matched_sess = None
            for s_key, s_info in grouped.items():
                last_dt = s_info["last_dt"]
                if abs((dt - last_dt).total_seconds()) < 180 and chunk_id > s_info["last_chunk_id"]:
                    matched_sess = s_key
                    break

            if chunk_id == 0 or not matched_sess:
                sess_key = f"session_{d_str}_{t_str}"
                matched_sess = sess_key
                grouped[sess_key] = {
                    "start_time": dt,
                    "last_dt": dt,
                    "last_chunk_id": chunk_id,
                    "chunks": []
                }

            grouped[matched_sess]["last_dt"] = dt
            grouped[matched_sess]["last_chunk_id"] = chunk_id
            grouped[matched_sess]["chunks"].append({
                "_id": f"chunk_{matched_sess}_{chunk_id}",
                "session_id": matched_sess,
                "chunk_id": chunk_id,
                "timestamp": dt.isoformat(),
                "start_time": float(chunk_id * 15),
                "end_time": float((chunk_id + 1) * 15),
                "duration": 15.0,
                "transcript": {"full_text": full_text, "confidence": 1.0, "language": "en"},
                "speakers": {"speakers": ["Speaker 1"]},
                "emotions": {"primary_emotion": "neutral"},
                "jargon": [],
                "micro_summary": "",
                "processing_status": "completed",
                "created_at": dt.isoformat()
            })

        new_sessions = 0
        for s_key, s_info in grouped.items():
            if s_key not in self.sessions:
                st = s_info["start_time"]
                et = s_info["last_dt"]
                chunks_list = s_info["chunks"]
                duration = max((c.get("end_time", 0.0) for c in chunks_list), default=0.0)
                formatted_name = f"Meeting {st.strftime('%b %d, %Y %I:%M %p')}"

                self.sessions[s_key] = {
                    "_id": f"sess_{s_key}",
                    "session_id": s_key,
                    "start_time": st.isoformat(),
                    "end_time": et.isoformat(),
                    "status": "completed",
                    "metadata": {"session_name": formatted_name},
                    "summary_stats": {
                        "total_chunks": len(chunks_list),
                        "duration_seconds": duration,
                        "final_summary_generated": False
                    },
                    "created_at": st.isoformat(),
                    "updated_at": et.isoformat()
                }
                self.chunks[s_key] = chunks_list
                new_sessions += 1

        if new_sessions > 0:
            logger.info(f"[Local Storage] Auto-recovered {new_sessions} past meeting sessions from disk transcriptions")
        return new_sessions

    def _flush_to_disk(self):
        """Synchronously persist data to disk using an atomic write."""
        temp_file = f"{self.file_path}.tmp"
        try:
            payload = {
                "sessions": self.sessions,
                "chunks": self.chunks,
                "summaries": self.summaries,
                "saved_at": datetime.utcnow().isoformat()
            }
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, default=_json_serializer, indent=2)
            if os.path.exists(self.file_path):
                os.replace(temp_file, self.file_path)
            else:
                os.rename(temp_file, self.file_path)
        except Exception as e:
            logger.error(f"[Local Storage] Failed to write database to disk: {e}")
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

    async def flush(self):
        """Async wrapper to flush data to disk."""
        async with self._lock:
            self._flush_to_disk()

    # Session CRUD
    async def create_session(self, session_id: str, metadata: Optional[Dict] = None) -> bool:
        async with self._lock:
            now = datetime.utcnow().isoformat()
            doc = {
                "_id": f"sess_{session_id}",
                "session_id": session_id,
                "start_time": now,
                "status": "active",
                "metadata": metadata or {},
                "created_at": now
            }
            self.sessions[session_id] = doc
            self._flush_to_disk()
            return True

    async def end_session(self, session_id: str, summary_stats: Optional[Dict] = None) -> bool:
        async with self._lock:
            if session_id in self.sessions:
                now = datetime.utcnow().isoformat()
                self.sessions[session_id]["status"] = "completed"
                self.sessions[session_id]["end_time"] = now
                self.sessions[session_id]["updated_at"] = now
                if summary_stats:
                    self.sessions[session_id]["summary_stats"] = summary_stats
                self._flush_to_disk()
                return True
            return False

    async def get_session(self, session_id: str) -> Optional[Dict]:
        async with self._lock:
            sess = self.sessions.get(session_id)
            return copy.deepcopy(sess) if sess else None

    async def get_all_sessions(self, limit: int = 100) -> List[Dict]:
        async with self._lock:
            all_s = list(self.sessions.values())
            sorted_s = sorted(
                all_s, 
                key=lambda x: str(x.get("start_time", "")), 
                reverse=True
            )
            return copy.deepcopy(sorted_s[:limit])

    async def get_active_sessions(self) -> List[Dict]:
        async with self._lock:
            active = [s for s in self.sessions.values() if s.get("status") == "active"]
            sorted_active = sorted(
                active, 
                key=lambda x: str(x.get("start_time", "")), 
                reverse=True
            )
            return copy.deepcopy(sorted_active)

    async def update_session_summary_status(self, session_id: str, has_summary: bool = True) -> bool:
        async with self._lock:
            if session_id in self.sessions:
                self.sessions[session_id]["has_summary"] = has_summary
                self.sessions[session_id]["summary_generated_at"] = datetime.utcnow().isoformat()
                self._flush_to_disk()
                return True
            return False

    async def delete_session(self, session_id: str) -> bool:
        async with self._lock:
            deleted = False
            if session_id in self.sessions:
                del self.sessions[session_id]
                deleted = True
            if session_id in self.chunks:
                del self.chunks[session_id]
                deleted = True
            if session_id in self.summaries:
                del self.summaries[session_id]
                deleted = True
            if deleted:
                self._flush_to_disk()
            return deleted

    # Chunk CRUD
    async def save_chunk(self, session_id: str, chunk_data: Dict) -> bool:
        async with self._lock:
            if session_id not in self.chunks:
                self.chunks[session_id] = []

            document = {
                "_id": chunk_data.get("_id") or f"chunk_{session_id}_{chunk_data.get('chunk_id', 0)}",
                "session_id": session_id,
                "chunk_id": chunk_data["chunk_id"],
                "timestamp": chunk_data.get("timestamp", datetime.utcnow()),
                "start_time": chunk_data.get("start_time", 0.0),
                "end_time": chunk_data.get("end_time", 0.0),
                "duration": chunk_data.get("duration", 15.0),
                "transcript": chunk_data.get("transcript", {}),
                "speakers": chunk_data.get("speakers", {}),
                "emotions": chunk_data.get("emotions", {}),
                "jargon": chunk_data.get("jargon", []),
                "micro_summary": chunk_data.get("micro_summary", ""),
                "processing_status": chunk_data.get("processing_status", "completed"),
                "created_at": datetime.utcnow().isoformat()
            }

            chunks_list = self.chunks[session_id]
            for idx, c in enumerate(chunks_list):
                if c["chunk_id"] == chunk_data["chunk_id"]:
                    chunks_list[idx] = document
                    break
            else:
                chunks_list.append(document)

            self._flush_to_disk()
            return True

    async def get_chunks(self, session_id: str) -> List[Dict]:
        async with self._lock:
            chunks = self.chunks.get(session_id, [])
            sorted_chunks = sorted(chunks, key=lambda x: x.get("chunk_id", 0))
            return copy.deepcopy(sorted_chunks)

    async def get_latest_chunks(self, limit: int = 10) -> List[Dict]:
        async with self._lock:
            all_chunks = []
            for c_list in self.chunks.values():
                all_chunks.extend(c_list)
            sorted_chunks = sorted(
                all_chunks, 
                key=lambda x: str(x.get("timestamp", "")), 
                reverse=True
            )
            return copy.deepcopy(sorted_chunks[:limit])

    # Summary CRUD
    async def save_summary(self, session_id: str, summary_data: Dict) -> bool:
        async with self._lock:
            doc = {
                "_id": f"summary_{session_id}",
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat(),
                "combined_transcript": summary_data.get("combined_transcript", ""),
                "final_summary": summary_data.get("final_summary", ""),
                "speakers_summary": summary_data.get("speakers_summary", {}),
                "emotions_summary": summary_data.get("emotions_summary", {}),
                "jargon_summary": summary_data.get("jargon_summary", []),
                "total_chunks": summary_data.get("total_chunks", 0),
                "total_duration": summary_data.get("total_duration", 0.0),
                "meeting_metadata": summary_data.get("meeting_metadata", {}),
                "created_at": datetime.utcnow().isoformat()
            }
            self.summaries[session_id] = doc
            self._flush_to_disk()
            return True

    async def save_structured_summary(self, session_id: str, summary_data: Dict) -> bool:
        async with self._lock:
            existing = self.summaries.get(session_id, {})
            existing.update({
                "session_id": session_id,
                "structured_summary": summary_data.get("structured_summary"),
                "generated_at": summary_data.get("generated_at", datetime.utcnow().isoformat()),
                "summary_version": summary_data.get("summary_version", "1.0.0"),
                "model_used": summary_data.get("model_used", settings.GROQ_MODEL),
                "total_chunks": summary_data.get("total_chunks", 0),
                "total_duration": summary_data.get("total_duration", 0.0),
                "transcript_preview": summary_data.get("transcript_preview", ""),
                "updated_at": datetime.utcnow().isoformat()
            })
            if "_id" not in existing:
                existing["_id"] = f"summary_{session_id}"
                existing["created_at"] = datetime.utcnow().isoformat()

            self.summaries[session_id] = existing
            self._flush_to_disk()
            return True

    async def get_summary(self, session_id: str) -> Optional[Dict]:
        async with self._lock:
            summary = self.summaries.get(session_id)
            return copy.deepcopy(summary) if summary else None

    async def get_structured_summary(self, session_id: str) -> Optional[Dict]:
        async with self._lock:
            summary = self.summaries.get(session_id)
            if summary and "structured_summary" in summary:
                return copy.deepcopy(summary)
            return None

    async def get_all_summaries(self, limit: int = 50) -> List[Dict]:
        async with self._lock:
            all_s = list(self.summaries.values())
            sorted_s = sorted(
                all_s, 
                key=lambda x: str(x.get("timestamp", x.get("generated_at", ""))), 
                reverse=True
            )
            return copy.deepcopy(sorted_s[:limit])


# Global persistent local storage
local_storage = LocalStorageManager()


class DatabaseConnection:
    """MongoDB connection manager with automatic Local Disk Persistence fallback."""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.database: Optional[AsyncIOMotorDatabase] = None
        self.chunks_collection: Optional[AsyncIOMotorCollection] = None
        self.summaries_collection: Optional[AsyncIOMotorCollection] = None
        self.sessions_collection: Optional[AsyncIOMotorCollection] = None
        self.local_storage = local_storage
        self.connection_error: Optional[str] = None
        
    async def connect(self):
        """Establish database connection with graceful fallback to disk persistence."""
        # Always initialize local persistent storage first
        await self.local_storage.initialize()

        mongo_url = settings.MONGODB_URL
        if not mongo_url or mongo_url.strip() == "":
            logger.info("No MONGODB_URL configured. Running with persistent local database.")
            self.client = None
            return

        try:
            logger.info(f"Connecting to MongoDB at {mongo_url}")
            self.client = AsyncIOMotorClient(
                mongo_url,
                serverSelectionTimeoutMS=4000,
                connectTimeoutMS=4000,
                socketTimeoutMS=4000
            )
            # Test connection
            await self.client.admin.command('ping')
            
            # Setup database and collections
            self.database = self.client[settings.DATABASE_NAME]
            self.chunks_collection = self.database[settings.CHUNKS_COLLECTION]
            self.summaries_collection = self.database[settings.SUMMARIES_COLLECTION]
            self.sessions_collection = self.database["sessions"]
            
            await self.create_indexes()
            self.connection_error = None
            logger.info("Successfully connected to MongoDB Atlas / Server")
            
        except OperationFailure as e:
            err_msg = str(e)
            if "bad auth" in err_msg or "authentication failed" in err_msg:
                self.connection_error = (
                    "MongoDB Atlas Authentication Failed: Check your username and password "
                    "in backend/.env (Database Access in MongoDB Atlas console)."
                )
            else:
                self.connection_error = f"MongoDB operation failure: {err_msg}"
            logger.warning(f"{self.connection_error}. Active fallback: Persistent Local Database (data/meetings_db.json).")
            self.client = None
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            self.connection_error = f"MongoDB server unreachable: {e}"
            logger.warning(f"MongoDB connection timeout. Active fallback: Persistent Local Database (data/meetings_db.json).")
            self.client = None
        except Exception as e:
            self.connection_error = f"MongoDB connection error: {e}"
            logger.warning(f"Database error ({e}). Active fallback: Persistent Local Database (data/meetings_db.json).")
            self.client = None

    async def create_indexes(self):
        """Create database indexes for optimal performance."""
        if not self.client:
            return
        try:
            await self.chunks_collection.create_index("session_id")
            await self.chunks_collection.create_index("chunk_id")
            await self.chunks_collection.create_index("timestamp")
            await self.chunks_collection.create_index([("session_id", 1), ("chunk_id", 1)])
            
            await self.summaries_collection.create_index("session_id")
            await self.summaries_collection.create_index("timestamp")
            
            await self.sessions_collection.create_index("session_id")
            await self.sessions_collection.create_index("start_time")
            logger.info("Database indexes verified successfully")
        except Exception as e:
            logger.warning(f"Notice: creating database indexes skipped or failed: {e}")
    
    async def disconnect(self):
        """Close database connection."""
        if self.client:
            self.client.close()
            self.client = None
            logger.info("MongoDB database connection closed")
        await self.local_storage.flush()
    
    def is_connected(self) -> bool:
        """Check if remote MongoDB is actively connected."""
        return self.client is not None
    
    def is_storage_ready(self) -> bool:
        """Check if storage (either MongoDB or persistent local storage) is available."""
        return True

    async def health_check(self) -> bool:
        """Check database health."""
        if self.client:
            try:
                await self.client.admin.command('ping')
                return True
            except Exception:
                return False
        # When running with persistent local disk storage, storage is healthy
        return True


# Global database instance
db = DatabaseConnection()


class ChunkOperations:
    """Operations for audio chunks across MongoDB and persistent storage."""
    
    @staticmethod
    async def save_chunk(session_id: str, chunk_data: Dict) -> bool:
        """Save chunk to local persistent disk storage and MongoDB if connected."""
        # 1. Always save to local persistent storage first
        await db.local_storage.save_chunk(session_id, chunk_data)
        logger.info(f"[Storage] Saved chunk {chunk_data['chunk_id']} for session {session_id}")

        # 2. If MongoDB is connected, also mirror to MongoDB
        if db.is_connected():
            try:
                document = {
                    "session_id": session_id,
                    "chunk_id": chunk_data["chunk_id"],
                    "timestamp": chunk_data.get("timestamp", datetime.utcnow()),
                    "start_time": chunk_data.get("start_time", 0.0),
                    "end_time": chunk_data.get("end_time", 0.0),
                    "duration": chunk_data.get("duration", 15.0),
                    "transcript": chunk_data.get("transcript", {}),
                    "speakers": chunk_data.get("speakers", {}),
                    "emotions": chunk_data.get("emotions", {}),
                    "jargon": chunk_data.get("jargon", []),
                    "micro_summary": chunk_data.get("micro_summary", ""),
                    "processing_status": chunk_data.get("processing_status", "completed"),
                    "created_at": datetime.utcnow()
                }
                await db.chunks_collection.replace_one(
                    {"session_id": session_id, "chunk_id": chunk_data["chunk_id"]},
                    document,
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"Error mirroring chunk to MongoDB: {e}")

        return True

    @staticmethod
    async def get_chunks_for_session(session_id: str) -> List[Dict]:
        """Retrieve all chunks for a session, checking MongoDB or falling back to local storage."""
        if db.is_connected():
            try:
                cursor = db.chunks_collection.find({"session_id": session_id}).sort("chunk_id", 1)
                chunks = await cursor.to_list(length=None)
                if chunks:
                    for chunk in chunks:
                        chunk["_id"] = str(chunk["_id"])
                    return chunks
            except Exception as e:
                logger.warning(f"Error reading chunks from MongoDB: {e}. Falling back to local storage.")

        return await db.local_storage.get_chunks(session_id)

    @staticmethod
    async def get_latest_chunks(limit: int = 10) -> List[Dict]:
        """Get the most recent chunks across all sessions."""
        if db.is_connected():
            try:
                cursor = db.chunks_collection.find().sort("timestamp", -1).limit(limit)
                chunks = await cursor.to_list(length=limit)
                if chunks:
                    for chunk in chunks:
                        chunk["_id"] = str(chunk["_id"])
                    return chunks
            except Exception as e:
                logger.warning(f"Error reading latest chunks from MongoDB: {e}. Falling back to local storage.")

        return await db.local_storage.get_latest_chunks(limit)


class SummaryOperations:
    """Operations for meeting summaries across MongoDB and persistent storage."""
    
    @staticmethod
    async def save_summary(session_id: str, summary_data: Dict) -> bool:
        """Save final meeting summary to storage."""
        await db.local_storage.save_summary(session_id, summary_data)
        logger.info(f"[Storage] Saved summary for session {session_id}")

        if db.is_connected():
            try:
                document = {
                    "session_id": session_id,
                    "timestamp": datetime.utcnow(),
                    "combined_transcript": summary_data.get("combined_transcript", ""),
                    "final_summary": summary_data.get("final_summary", ""),
                    "speakers_summary": summary_data.get("speakers_summary", {}),
                    "emotions_summary": summary_data.get("emotions_summary", {}),
                    "jargon_summary": summary_data.get("jargon_summary", []),
                    "total_chunks": summary_data.get("total_chunks", 0),
                    "total_duration": summary_data.get("total_duration", 0.0),
                    "meeting_metadata": summary_data.get("meeting_metadata", {}),
                    "created_at": datetime.utcnow()
                }
                await db.summaries_collection.replace_one(
                    {"session_id": session_id},
                    document,
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"Error mirroring summary to MongoDB: {e}")

        return True

    @staticmethod
    async def get_summary(session_id: str) -> Optional[Dict]:
        """Retrieve summary for a session."""
        if db.is_connected():
            try:
                summary = await db.summaries_collection.find_one({"session_id": session_id})
                if summary:
                    summary["_id"] = str(summary["_id"])
                    return summary
            except Exception as e:
                logger.warning(f"Error retrieving summary from MongoDB: {e}. Falling back to local storage.")

        return await db.local_storage.get_summary(session_id)

    @staticmethod
    async def save_structured_summary(session_id: str, summary_data: Dict) -> bool:
        """Save structured Groq/LangChain summary to persistent storage."""
        await db.local_storage.save_structured_summary(session_id, summary_data)
        logger.info(f"[Storage] Saved structured summary for session {session_id}")

        if db.is_connected():
            try:
                doc = {
                    "session_id": session_id,
                    "structured_summary": summary_data.get("structured_summary"),
                    "generated_at": summary_data.get("generated_at", datetime.utcnow()),
                    "summary_version": summary_data.get("summary_version", "1.0.0"),
                    "model_used": summary_data.get("model_used", settings.GROQ_MODEL),
                    "total_chunks": summary_data.get("total_chunks", 0),
                    "total_duration": summary_data.get("total_duration", 0.0),
                    "transcript_preview": summary_data.get("transcript_preview", ""),
                    "updated_at": datetime.utcnow()
                }
                await db.summaries_collection.update_one(
                    {"session_id": session_id},
                    {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow()}},
                    upsert=True
                )
            except Exception as e:
                logger.warning(f"Error mirroring structured summary to MongoDB: {e}")

        return True

    @staticmethod
    async def get_structured_summary(session_id: str) -> Optional[Dict]:
        """Retrieve structured summary for a session."""
        if db.is_connected():
            try:
                summary = await db.summaries_collection.find_one({"session_id": session_id})
                if summary and "structured_summary" in summary:
                    summary["_id"] = str(summary["_id"])
                    return summary
            except Exception as e:
                logger.warning(f"Error retrieving structured summary from MongoDB: {e}. Falling back to local storage.")

        return await db.local_storage.get_structured_summary(session_id)

    @staticmethod
    async def get_all_summaries(limit: int = 50) -> List[Dict]:
        """Get all meeting summaries."""
        if db.is_connected():
            try:
                cursor = db.summaries_collection.find().sort("timestamp", -1).limit(limit)
                summaries = await cursor.to_list(length=limit)
                if summaries:
                    for summary in summaries:
                        summary["_id"] = str(summary["_id"])
                    return summaries
            except Exception as e:
                logger.warning(f"Error retrieving summaries from MongoDB: {e}. Falling back to local storage.")

        return await db.local_storage.get_all_summaries(limit)


class SessionOperations:
    """Operations for session management across MongoDB and persistent storage."""
    
    @staticmethod
    async def create_session(session_id: str, metadata: Optional[Dict] = None) -> bool:
        """Create a new session in storage."""
        await db.local_storage.create_session(session_id, metadata)
        logger.info(f"[Storage] Created session {session_id}")

        if db.is_connected():
            try:
                document = {
                    "session_id": session_id,
                    "start_time": datetime.utcnow(),
                    "status": "active",
                    "metadata": metadata or {},
                    "created_at": datetime.utcnow()
                }
                await db.sessions_collection.insert_one(document)
            except Exception as e:
                logger.warning(f"Error mirroring new session to MongoDB: {e}")

        return True

    @staticmethod
    async def end_session(session_id: str, summary_stats: Optional[Dict] = None) -> bool:
        """Mark a session as completed in storage."""
        await db.local_storage.end_session(session_id, summary_stats)
        logger.info(f"[Storage] Ended session {session_id}")

        if db.is_connected():
            try:
                update_data = {
                    "status": "completed",
                    "end_time": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                if summary_stats:
                    update_data["summary_stats"] = summary_stats
                await db.sessions_collection.update_one(
                    {"session_id": session_id},
                    {"$set": update_data}
                )
            except Exception as e:
                logger.warning(f"Error mirroring end_session to MongoDB: {e}")

        return True

    @staticmethod
    async def get_active_sessions() -> List[Dict]:
        """Get all active sessions."""
        if db.is_connected():
            try:
                cursor = db.sessions_collection.find({"status": "active"}).sort("start_time", -1)
                sessions = await cursor.to_list(length=None)
                if sessions:
                    for session in sessions:
                        session["_id"] = str(session["_id"])
                    return sessions
            except Exception as e:
                logger.warning(f"Error retrieving active sessions from MongoDB: {e}. Falling back to local storage.")

        return await db.local_storage.get_active_sessions()

    @staticmethod
    async def get_session(session_id: str) -> Optional[Dict]:
        """Retrieve a specific session by ID."""
        if db.is_connected():
            try:
                session = await db.sessions_collection.find_one({"session_id": session_id})
                if session:
                    session["_id"] = str(session["_id"])
                    return session
            except Exception as e:
                logger.warning(f"Error retrieving session {session_id} from MongoDB: {e}. Falling back to local storage.")

        return await db.local_storage.get_session(session_id)

    @staticmethod
    async def get_all_sessions(limit: int = 100) -> List[Dict]:
        """Get all sessions (newest first)."""
        if db.is_connected():
            try:
                cursor = db.sessions_collection.find().sort("start_time", -1).limit(limit)
                sessions = await cursor.to_list(length=limit)
                if sessions:
                    for s in sessions:
                        s["_id"] = str(s["_id"])
                    return sessions
            except Exception as e:
                logger.warning(f"Error retrieving all sessions from MongoDB: {e}. Falling back to local storage.")

        return await db.local_storage.get_all_sessions(limit)

    @staticmethod
    async def update_session_summary_status(session_id: str, has_summary: bool = True) -> bool:
        """Mark whether a summary has been generated for a session."""
        await db.local_storage.update_session_summary_status(session_id, has_summary)

        if db.is_connected():
            try:
                await db.sessions_collection.update_one(
                    {"session_id": session_id},
                    {"$set": {"has_summary": has_summary, "summary_generated_at": datetime.utcnow()}}
                )
            except Exception as e:
                logger.warning(f"Error updating summary status in MongoDB: {e}")

        return True

    @staticmethod
    async def delete_session(session_id: str) -> bool:
        """Delete a meeting session, its chunks, and its summaries completely."""
        local_deleted = await db.local_storage.delete_session(session_id)

        if db.is_connected():
            try:
                await db.sessions_collection.delete_one({"session_id": session_id})
                await db.chunks_collection.delete_many({"session_id": session_id})
                await db.summaries_collection.delete_many({"session_id": session_id})
            except Exception as e:
                logger.warning(f"Error deleting session from MongoDB: {e}")

        logger.info(f"[Storage] Deleted meeting session {session_id}")
        return True


# Global lifecycle functions
async def initialize_database():
    """Initialize database and persistent storage."""
    await db.connect()


async def cleanup_database():
    """Cleanup database connections."""
    await db.disconnect()