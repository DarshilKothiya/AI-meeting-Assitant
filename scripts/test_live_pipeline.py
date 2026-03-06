"""
Live end-to-end pipeline test:
  microphone/Stereo Mix  →  audio chunk  →  Whisper transcription  →  data/transcriptions/

No server, no database needed.  Press Ctrl+C to stop.

Run from project root:
    .\\venv\\Scripts\\python.exe scripts/test_live_pipeline.py
"""
import sys
import os
import asyncio
from pathlib import Path
from datetime import datetime

# ── path setup ────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR  = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

SEP = "═" * 62

def ok(msg):   print(f"  ✅  {msg}", flush=True)
def fail(msg): print(f"  ❌  {msg}", flush=True)
def info(msg): print(f"  ℹ️   {msg}", flush=True)
def live(msg): print(f"  🎙️   {msg}", flush=True)


async def run_pipeline(num_chunks: int = 3):
    print(SEP)
    print("  LIVE PIPELINE TEST  –  Audio → Transcription")
    print(SEP)
    print(f"\n  Will capture {num_chunks} chunk(s) then stop automatically.")
    print("  Press Ctrl+C at any time to stop early.\n")

    # ── 1. Initialise Whisper ─────────────────────────────────────────────────
    print("[1] Loading Whisper model …")
    try:
        from app.services.ai_processor import TranscriptionService
        svc = TranscriptionService()
        await svc.initialize()
        ok(f"Whisper ready on {svc.device}.")
    except Exception as e:
        fail(f"Could not load Whisper: {e}")
        import traceback; traceback.print_exc()
        return False

    # ── 2. Initialise audio capture ───────────────────────────────────────────
    print("\n[2] Opening audio device …")
    try:
        from app.audio.capture import AudioCapture
        from app.config import settings
        capture = AudioCapture()
        capture.chunk_duration = 10   # 10 s per chunk for faster feedback

        device_idx = capture.find_audio_device()
        if device_idx is None:
            fail("No audio input device found. Connect a microphone and retry.")
            return False

        dev_info = capture.audio.get_device_info_by_index(device_idx)
        ok(f"Device [{device_idx}]: {dev_info['name']}")
    except Exception as e:
        fail(f"Audio initialisation failed: {e}")
        import traceback; traceback.print_exc()
        return False

    # ── 3. Record + transcribe loop ───────────────────────────────────────────
    transcriptions_dir = Path(settings.TRANSCRIPTIONS_DIR)
    transcriptions_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[3] Recording {num_chunks} × {capture.chunk_duration}s chunks …")
    print("    🎤  Speak or play audio now!\n")

    chunk_count   = 0
    saved_files   = []
    all_good      = True

    try:
        async for chunk in capture.start_recording(save_files=True):
            chunk_count += 1
            chunk_id   = chunk["chunk_id"]
            wav_path   = chunk.get("filepath") or chunk.get("file_path")
            audio_data = chunk["data"]
            sample_rate= chunk["sample_rate"]

            import numpy as np
            max_amp = int(abs(audio_data).max())
            live(f"Chunk {chunk_id:02d} arrived  |  "
                 f"duration={chunk['duration']}s  |  "
                 f"max_amplitude={max_amp}  |  "
                 f"saved → {Path(wav_path).name if wav_path else 'not saved'}")

            # ── Transcribe ───────────────────────────────────────────────────
            print(f"       ↳ transcribing …", end="", flush=True)
            try:
                result = await svc.transcribe_audio(
                    audio_data,
                    sample_rate,
                    source_file=wav_path
                )
            except Exception as e:
                print()
                fail(f"Transcription error on chunk {chunk_id}: {e}")
                all_good = False
                if chunk_count >= num_chunks:
                    capture.stop_recording()
                    break
                continue

            full_text = result.get("full_text", "").strip()
            segments  = result.get("segments", [])
            language  = result.get("language", "?")
            error     = result.get("error")

            if error:
                print()
                fail(f"  Whisper error: {error}")
                all_good = False
            elif full_text:
                print(f" done.")
                ok(f"  [{language}] {len(segments)} segment(s): \"{full_text[:120]}\"")
                # Show each segment
                for seg in segments:
                    print(f"           [{seg['start']:.1f}s–{seg['end']:.1f}s]  {seg['text']}")
            else:
                print(f" done.")
                info(f"  No speech detected in chunk {chunk_id} (silent audio).")

            # Find the saved transcription file
            stem = Path(wav_path).stem if wav_path else f"audio_chunk_{chunk_id:04d}"
            matches = sorted(transcriptions_dir.glob(f"{stem}_whisper_*.txt"))
            if matches:
                saved_files.append(matches[-1])
                ok(f"  Saved → {matches[-1].name}")
            print()

            if chunk_count >= num_chunks:
                capture.stop_recording()
                break

    except KeyboardInterrupt:
        print("\n  ⏹️   Stopped by user.")
        capture.stop_recording()

    # ── 4. Summary ────────────────────────────────────────────────────────────
    print(SEP)
    print(f"  Chunks captured  : {chunk_count}")
    print(f"  Transcriptions   : {len(saved_files)}")
    if saved_files:
        print("  Files in data/transcriptions/:")
        for f in saved_files:
            print(f"    • {f.name}")
    print()

    if chunk_count > 0 and all_good:
        ok("PIPELINE WORKING — live audio is being transcribed automatically!")
        passed = True
    elif chunk_count > 0:
        info("Pipeline ran but some chunks had errors (see above).")
        passed = False
    else:
        fail("No chunks received. Check microphone permissions.")
        passed = False

    return passed


# ── entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Live audio → transcription pipeline test")
    parser.add_argument("--chunks", type=int, default=3,
                        help="Number of chunks to capture before stopping (default: 3)")
    args = parser.parse_args()

    passed = asyncio.run(run_pipeline(num_chunks=args.chunks))
    print(SEP)
    print("  RESULT:", "PASS ✅" if passed else "FAIL ❌")
    print(SEP)
    sys.exit(0 if passed else 1)
