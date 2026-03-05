"""
Quick test for audio capture and chunking pipeline.
Run from the backend/ directory:
    ..\venv\Scripts\python.exe ..\scripts\test_capture.py
"""
import sys
import os
import asyncio

# Make backend package importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.audio.capture import AudioCapture

CHUNK_DURATION = 5   # seconds per chunk (shorter than default 15 for quick testing)
NUM_CHUNKS     = 2   # how many chunks to capture before stopping


async def test():
    print("=" * 55)
    print("  AUDIO CAPTURE & CHUNKING TEST")
    print("=" * 55)

    capture = AudioCapture()
    capture.chunk_duration = CHUNK_DURATION   # override for faster test

    # 1. List devices
    print("\n[1] Available audio input devices:")
    count = capture.audio.get_device_count()
    for i in range(count):
        info = capture.audio.get_device_info_by_index(i)
        if info["maxInputChannels"] > 0:
            print(f"    {i}: {info['name']}  "
                  f"(ch={info['maxInputChannels']}, "
                  f"rate={int(info['defaultSampleRate'])})")

    # 2. Detect device that will be used
    device_idx = capture.find_audio_device()
    if device_idx is None:
        print("\n❌ No audio input device found. Check microphone permissions.")
        return
    info = capture.audio.get_device_info_by_index(device_idx)
    print(f"\n[2] Using device {device_idx}: {info['name']}")

    # 3. Record chunks
    print(f"\n[3] Recording {NUM_CHUNKS} chunk(s) of {CHUNK_DURATION}s each...")
    print("    🎤 Speak or play audio now!\n")

    chunk_count = 0
    try:
        async for chunk in capture.start_recording(save_files=True):
            chunk_count += 1
            max_amp = abs(chunk["data"]).max()
            print(f"    ✅ Chunk {chunk['chunk_id']:02d} received  |  "
                  f"samples={len(chunk['data'])}  |  "
                  f"duration={chunk['duration']}s  |  "
                  f"max_amplitude={max_amp}  |  "
                  f"file={chunk.get('file_path', 'not saved')}")

            if chunk_count >= NUM_CHUNKS:
                capture.stop_recording()
                break
    except KeyboardInterrupt:
        capture.stop_recording()

    # 4. Summary
    print(f"\n[4] Done — captured {chunk_count} chunk(s).")
    if chunk_count == NUM_CHUNKS:
        print("    ✅ Audio capture and chunking working correctly!")
    else:
        print("    ⚠️  Did not receive expected number of chunks.")

    capture.audio.terminate()


if __name__ == "__main__":
    asyncio.run(test())
