"""
Audio capture system for real-time Stereo Mix recording with chunking
"""
import asyncio
import wave
import pyaudio
import sounddevice as sd
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, AsyncGenerator
import threading
import queue
from loguru import logger

from ..config import settings


class AudioCapture:
    """Handles real-time audio capture from Stereo Mix with automatic chunking"""
    
    def __init__(self):
        self.sample_rate = settings.SAMPLE_RATE
        self.channels = settings.CHANNELS
        self.chunk_duration = settings.CHUNK_DURATION
        self.audio_format = pyaudio.paInt16
        self.chunk_size = 1024
        
        self.is_recording = False
        self.audio_queue = queue.Queue()
        self.current_chunk_data = []
        self.chunk_counter = 0
        self.start_time = None
        
        # Callbacks
        self.on_chunk_ready: Optional[Callable] = None
        
        # Initialize PyAudio
        self.audio = pyaudio.PyAudio()
        self.stream = None
        
    def find_audio_device(self) -> Optional[int]:
        """Find Stereo Mix device; fall back to default microphone input."""
        try:
            device_count = self.audio.get_device_count()
            # Prefer Stereo Mix / loopback devices for system audio capture
            for i in range(device_count):
                device_info = self.audio.get_device_info_by_index(i)
                device_name = device_info.get('name', '').lower()
                if any(k in device_name for k in ['stereo mix', 'stereomix', 'what u hear', 'loopback']):
                    if device_info['maxInputChannels'] > 0:
                        logger.info(f"Found system-audio device: {device_info['name']} (Index: {i})")
                        return i

            # Fall back to first available input device (microphone)
            logger.warning("Stereo Mix not found — falling back to default microphone input.")
            for i in range(device_count):
                device_info = self.audio.get_device_info_by_index(i)
                if device_info['maxInputChannels'] > 0:
                    logger.info(f"Using microphone fallback: {device_info['name']} (Index: {i})")
                    return i

            logger.error("No audio input devices found.")
            return None

        except Exception as e:
            logger.error(f"Error finding audio device: {e}")
            return None

    # Keep old name as alias for backward compatibility
    def find_stereo_mix_device(self) -> Optional[int]:
        return self.find_audio_device()
    
    def audio_callback(self, in_data, frame_count, time_info, status):
        """Callback function for audio stream"""
        if status:
            logger.warning(f"Audio stream status: {status}")
        
        # Add audio data to current chunk
        audio_data = np.frombuffer(in_data, dtype=np.int16)
        self.current_chunk_data.extend(audio_data)
        
        # Check if chunk duration is reached
        current_duration = len(self.current_chunk_data) / self.sample_rate
        
        if current_duration >= self.chunk_duration:
            # Chunk is ready - put it in the queue
            chunk_data = np.array(self.current_chunk_data[:self.sample_rate * self.chunk_duration], dtype=np.int16)
            
            self.audio_queue.put({
                'chunk_id': self.chunk_counter,
                'data': chunk_data,
                'timestamp': datetime.now(),
                'duration': self.chunk_duration,
                'sample_rate': self.sample_rate
            })
            
            # Keep remaining data for next chunk
            remaining_samples = self.sample_rate * self.chunk_duration
            self.current_chunk_data = self.current_chunk_data[remaining_samples:]
            self.chunk_counter += 1
        
        return (in_data, pyaudio.paContinue)
    
    def save_chunk_to_file(self, chunk_data: dict) -> str:
        """Save audio chunk to WAV file"""
        timestamp = chunk_data['timestamp'].strftime("%Y%m%d_%H%M%S")
        filename = f"chunk_{chunk_data['chunk_id']:04d}_{timestamp}.wav"
        filepath = Path(settings.AUDIO_CHUNKS_DIR) / filename
        
        # Ensure directory exists
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with wave.open(str(filepath), 'wb') as wav_file:
                wav_file.setnchannels(self.channels)
                wav_file.setsampwidth(self.audio.get_sample_size(self.audio_format))
                wav_file.setframerate(self.sample_rate)
                wav_file.writeframes(chunk_data['data'].tobytes())
            
            logger.info(f"Saved audio chunk: {filename}")
            return str(filepath)
            
        except Exception as e:
            logger.error(f"Error saving audio chunk {filename}: {e}")
            return None
    
    async def start_recording(self, save_files: bool = True) -> AsyncGenerator[dict, None]:
        """Start recording audio and yield chunks as they become available"""
        device_index = self.find_audio_device()
        if device_index is None:
            raise RuntimeError("No audio input device found. Please connect a microphone or enable Stereo Mix.")
        
        self.is_recording = True
        self.start_time = datetime.now()
        self.chunk_counter = 0
        self.current_chunk_data = []
        
        # Clear the queue
        while not self.audio_queue.empty():
            self.audio_queue.get()
        
        try:
            # Start audio stream
            self.stream = self.audio.open(
                format=self.audio_format,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                input_device_index=device_index,
                frames_per_buffer=self.chunk_size,
                stream_callback=self.audio_callback,
                start=True
            )
            
            logger.info(f"Started recording from Stereo Mix (Device {device_index})")
            
            # Yield chunks as they become available
            while self.is_recording:
                try:
                    # Wait for chunk with timeout
                    chunk_data = self.audio_queue.get(timeout=1.0)
                    
                    # Save to file if requested
                    if save_files:
                        filepath = self.save_chunk_to_file(chunk_data)
                        chunk_data['filepath'] = filepath
                    
                    # Calculate timing information
                    elapsed_time = (chunk_data['timestamp'] - self.start_time).total_seconds()
                    chunk_data['start_time'] = elapsed_time - self.chunk_duration
                    chunk_data['end_time'] = elapsed_time
                    
                    yield chunk_data
                    
                except queue.Empty:
                    # No chunk ready, continue waiting
                    await asyncio.sleep(0.1)
                    continue
                    
        except Exception as e:
            logger.error(f"Error during recording: {e}")
            raise
        finally:
            self.stop_recording()
    
    def stop_recording(self):
        """Stop the audio recording"""
        self.is_recording = False
        
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
            
        logger.info("Stopped audio recording")
    
    def list_audio_devices(self):
        """List all available audio input devices"""
        print("\nAvailable Audio Input Devices:")
        print("-" * 50)
        
        device_count = self.audio.get_device_count()
        for i in range(device_count):
            try:
                device_info = self.audio.get_device_info_by_index(i)
                if device_info['maxInputChannels'] > 0:
                    print(f"{i:2d}: {device_info['name']}")
                    print(f"    Channels: {device_info['maxInputChannels']}")
                    print(f"    Sample Rate: {device_info['defaultSampleRate']}")
                    print()
            except Exception as e:
                print(f"{i:2d}: Error getting device info - {e}")
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        self.stop_recording()
        if hasattr(self, 'audio'):
            self.audio.terminate()


class AudioChunkProcessor:
    """Processes audio chunks and manages the pipeline"""
    
    def __init__(self, audio_capture: AudioCapture):
        self.capture = audio_capture
        self.processing_callbacks = []
        
    def add_processing_callback(self, callback: Callable):
        """Add a callback function to process each audio chunk"""
        self.processing_callbacks.append(callback)
    
    async def start_processing_pipeline(self):
        """Start the full audio processing pipeline"""
        logger.info("Starting audio processing pipeline...")
        
        try:
            async for chunk in self.capture.start_recording():
                logger.info(f"Processing chunk {chunk['chunk_id']}: {chunk['start_time']:.1f}s - {chunk['end_time']:.1f}s")
                
                # Process chunk through all callbacks
                for callback in self.processing_callbacks:
                    try:
                        await callback(chunk)
                    except Exception as e:
                        logger.error(f"Error in processing callback: {e}")
                        
        except KeyboardInterrupt:
            logger.info("Audio processing stopped by user")
        except Exception as e:
            logger.error(f"Error in audio processing pipeline: {e}")
        finally:
            self.capture.stop_recording()


# Test function
async def test_audio_capture():
    """Test the audio capture system"""
    capture = AudioCapture()
    
    # List available devices
    capture.list_audio_devices()
    
    # Test recording for 30 seconds
    print("\nStarting 30-second test recording...")
    chunk_count = 0
    
    try:
        async for chunk in capture.start_recording():
            chunk_count += 1
            print(f"Received chunk {chunk['chunk_id']}: {len(chunk['data'])} samples, {chunk['duration']}s")
            
            if chunk_count >= 2:  # Stop after 2 chunks (30 seconds)
                break
                
    except KeyboardInterrupt:
        print("Test stopped by user")
    finally:
        capture.stop_recording()


if __name__ == "__main__":
    # Run test
    asyncio.run(test_audio_capture())