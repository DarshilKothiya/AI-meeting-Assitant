"""
MongoDB database connection and operations
"""
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from loguru import logger

from ..config import settings


class DatabaseConnection:
    """MongoDB database connection manager"""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.database: Optional[AsyncIOMotorDatabase] = None
        self.chunks_collection: Optional[AsyncIOMotorCollection] = None
        self.summaries_collection: Optional[AsyncIOMotorCollection] = None
        self.sessions_collection: Optional[AsyncIOMotorCollection] = None
        
    async def connect(self):
        """Establish database connection"""
        try:
            logger.info(f"Connecting to MongoDB at {settings.MONGODB_URL}")
            
            # Create client with connection parameters
            self.client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                serverSelectionTimeoutMS=5000,  # 5 second timeout
                connectTimeoutMS=5000,
                socketTimeoutMS=5000
            )
            
            # Test connection
            await self.client.admin.command('ping')
            
            # Get database and collections
            self.database = self.client[settings.DATABASE_NAME]
            self.chunks_collection = self.database[settings.CHUNKS_COLLECTION]
            self.summaries_collection = self.database[settings.SUMMARIES_COLLECTION]
            self.sessions_collection = self.database["sessions"]
            
            # Create indexes for better performance
            await self.create_indexes()
            
            logger.info("Successfully connected to MongoDB")
            
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            logger.warning("Running without database persistence")
            self.client = None
        except Exception as e:
            logger.error(f"Unexpected database connection error: {e}")
            self.client = None
    
    async def create_indexes(self):
        """Create database indexes for optimal performance"""
        if not self.client:
            return
            
        try:
            # Chunks collection indexes
            await self.chunks_collection.create_index("session_id")
            await self.chunks_collection.create_index("chunk_id")
            await self.chunks_collection.create_index("timestamp")
            await self.chunks_collection.create_index([("session_id", 1), ("chunk_id", 1)])
            
            # Summaries collection indexes
            await self.summaries_collection.create_index("session_id")
            await self.summaries_collection.create_index("timestamp")
            
            # Sessions collection indexes
            await self.sessions_collection.create_index("session_id")
            await self.sessions_collection.create_index("start_time")
            
            logger.info("Database indexes created successfully")
            
        except Exception as e:
            logger.error(f"Error creating database indexes: {e}")
    
    async def disconnect(self):
        """Close database connection"""
        if self.client:
            self.client.close()
            logger.info("Database connection closed")
    
    def is_connected(self) -> bool:
        """Check if database is connected"""
        return self.client is not None
    
    async def health_check(self) -> bool:
        """Check database health"""
        if not self.client:
            return False
        
        try:
            await self.client.admin.command('ping')
            return True
        except Exception:
            return False


# Global database instance
db = DatabaseConnection()


class ChunkOperations:
    """Database operations for audio chunks"""
    
    @staticmethod
    async def save_chunk(session_id: str, chunk_data: Dict) -> bool:
        """Save processed chunk data to database"""
        if not db.is_connected():
            logger.warning("Database not connected, skipping chunk save")
            return False
        
        try:
            # Prepare document for storage
            document = {
                "session_id": session_id,
                "chunk_id": chunk_data["chunk_id"],
                "timestamp": chunk_data["timestamp"],
                "start_time": chunk_data["start_time"],
                "end_time": chunk_data["end_time"],
                "duration": chunk_data["duration"],
                "transcript": chunk_data["transcript"],
                "speakers": chunk_data["speakers"],
                "emotions": chunk_data["emotions"],
                "jargon": chunk_data["jargon"],
                "micro_summary": chunk_data["micro_summary"],
                "processing_status": chunk_data["processing_status"],
                "created_at": datetime.utcnow()
            }
            
            # Insert or update chunk
            await db.chunks_collection.replace_one(
                {"session_id": session_id, "chunk_id": chunk_data["chunk_id"]},
                document,
                upsert=True
            )
            
            logger.info(f"Saved chunk {chunk_data['chunk_id']} for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving chunk to database: {e}")
            return False
    
    @staticmethod
    async def get_chunks_for_session(session_id: str) -> List[Dict]:
        """Retrieve all chunks for a session"""
        if not db.is_connected():
            return []
        
        try:
            cursor = db.chunks_collection.find(
                {"session_id": session_id}
            ).sort("chunk_id", 1)
            
            chunks = await cursor.to_list(length=None)
            
            # Convert ObjectId to string for JSON serialization
            for chunk in chunks:
                chunk["_id"] = str(chunk["_id"])
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error retrieving chunks for session {session_id}: {e}")
            return []
    
    @staticmethod
    async def get_latest_chunks(limit: int = 10) -> List[Dict]:
        """Get the most recent chunks across all sessions"""
        if not db.is_connected():
            return []
        
        try:
            cursor = db.chunks_collection.find().sort("timestamp", -1).limit(limit)
            chunks = await cursor.to_list(length=limit)
            
            # Convert ObjectId to string
            for chunk in chunks:
                chunk["_id"] = str(chunk["_id"])
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error retrieving latest chunks: {e}")
            return []


class SummaryOperations:
    """Database operations for meeting summaries"""
    
    @staticmethod
    async def save_summary(session_id: str, summary_data: Dict) -> bool:
        """Save final meeting summary to database"""
        if not db.is_connected():
            logger.warning("Database not connected, skipping summary save")
            return False
        
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
                "total_duration": summary_data.get("total_duration", 0),
                "meeting_metadata": summary_data.get("meeting_metadata", {}),
                "created_at": datetime.utcnow()
            }
            
            # Insert or update summary
            await db.summaries_collection.replace_one(
                {"session_id": session_id},
                document,
                upsert=True
            )
            
            logger.info(f"Saved summary for session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving summary to database: {e}")
            return False
    
    @staticmethod
    async def get_summary(session_id: str) -> Optional[Dict]:
        """Retrieve summary for a session"""
        if not db.is_connected():
            return None
        
        try:
            summary = await db.summaries_collection.find_one({"session_id": session_id})
            
            if summary:
                summary["_id"] = str(summary["_id"])
            
            return summary
            
        except Exception as e:
            logger.error(f"Error retrieving summary for session {session_id}: {e}")
            return None
    
    @staticmethod
    async def get_all_summaries(limit: int = 50) -> List[Dict]:
        """Get all meeting summaries"""
        if not db.is_connected():
            return []
        
        try:
            cursor = db.summaries_collection.find().sort("timestamp", -1).limit(limit)
            summaries = await cursor.to_list(length=limit)
            
            # Convert ObjectId to string
            for summary in summaries:
                summary["_id"] = str(summary["_id"])
            
            return summaries
            
        except Exception as e:
            logger.error(f"Error retrieving summaries: {e}")
            return []


class SessionOperations:
    """Database operations for session management"""
    
    @staticmethod
    async def create_session(session_id: str, metadata: Optional[Dict] = None) -> bool:
        """Create a new session"""
        if not db.is_connected():
            logger.warning("Database not connected, skipping session creation")
            return False
        
        try:
            document = {
                "session_id": session_id,
                "start_time": datetime.utcnow(),
                "status": "active",
                "metadata": metadata or {},
                "created_at": datetime.utcnow()
            }
            
            await db.sessions_collection.insert_one(document)
            logger.info(f"Created session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            return False
    
    @staticmethod
    async def end_session(session_id: str, summary_stats: Optional[Dict] = None) -> bool:
        """Mark a session as completed"""
        if not db.is_connected():
            return False
        
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
            
            logger.info(f"Ended session {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error ending session: {e}")
            return False
    
    @staticmethod
    async def get_active_sessions() -> List[Dict]:
        """Get all active sessions"""
        if not db.is_connected():
            return []
        
        try:
            cursor = db.sessions_collection.find({"status": "active"}).sort("start_time", -1)
            sessions = await cursor.to_list(length=None)
            
            # Convert ObjectId to string
            for session in sessions:
                session["_id"] = str(session["_id"])
            
            return sessions
            
        except Exception as e:
            logger.error(f"Error retrieving active sessions: {e}")
            return []


# Initialize database connection
async def initialize_database():
    """Initialize database connection"""
    await db.connect()


# Cleanup function
async def cleanup_database():
    """Cleanup database connection"""
    await db.disconnect()