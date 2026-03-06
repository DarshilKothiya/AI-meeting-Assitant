"""
Test: verify that after audio arrives, transcription is produced.

Uses existing WAV recordings in data/audio_recordings/ so no
microphone capture is needed.

Run from the project root:
    .venv/Scripts/python scripts/test_transcription.py
    -- or --
    python scripts/test_transcription.py
"""
import sys
import os
import asyncio
import wave
import numpy as np
from pathlib import Path

# ── path setup ────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR  = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# ── helpers ───────────────────────────────────────────────────────────────────
SEP = "─" * 60

def ok(msg):  print(f"  ✅  {msg}")
def fail(msg): print(f"  ❌  {msg}")
def info(msg): print(f"  ℹ️   {msg}")


def load_wav(path: Path):
    """Return (numpy int16 array, sample_rate) for a mono WAV file."""
    with wave.open(str(path), "rb") as wf:
        sample_rate = wf.getframerate()
        n_frames    = wf.getnframes()
        raw         = wf.readframes(n_frames)
    audio = np.frombuffer(raw, dtype=np.int16)
    return audio, sample_rate


def pick_wav_file() -> Path:
    """Return the best available WAV file for testing (kept for single-file use)."""
    recordings = PROJECT_ROOT / "data" / "audio_recordings"
    candidates = [
        recordings / "meeting_audio_20250919_000119.wav",
        recordings / "meeting_audio_20250919_000134.wav",
    ]
    # recent chunk files
    candidates += sorted(recordings.glob("chunk_*.wav"))

    for p in candidates:
        if p.exists() and p.stat().st_size > 0:
            return p

    raise FileNotFoundError(
        f"No WAV files found in {recordings}. "
        "Run a short recording session first."
    )


def all_wav_files() -> list:
    """Return every WAV file in audio_recordings/, sorted by name."""
    recordings = PROJECT_ROOT / "data" / "audio_recordings"
    return sorted(recordings.glob("*.wav"))


# ── main test ─────────────────────────────────────────────────────────────────
async def test_transcription_pipeline():
    print(SEP)
    print("  AUDIO → TRANSCRIPTION PIPELINE TEST  (all chunks)")
    print(SEP)

    # ── Step 1: find all WAV files ────────────────────────────────────────────
    print("\n[1] Scanning audio_recordings/ for WAV files …")
    wav_files = all_wav_files()
    if not wav_files:
        fail("No WAV files found in data/audio_recordings/. "
             "Run a recording session first.")
        return False

    # Show which files already have transcriptions so user knows what's new
    transcriptions_dir = PROJECT_ROOT / "data" / "transcriptions"
    existing_stems = {p.stem.split("_whisper_")[0] for p in transcriptions_dir.glob("*_whisper_*.txt")}

    for wf in wav_files:
        already = "  (already transcribed)" if wf.stem in existing_stems else "  ← will transcribe"
        info(f"{wf.name}{already}")

    # ── Step 2: initialise TranscriptionService once ──────────────────────────
    print("\n[2] Initialising Whisper (TranscriptionService) …")
    try:
        from app.services.ai_processor import TranscriptionService
        svc = TranscriptionService()
        await svc.initialize()
        ok("Whisper model loaded.")
    except Exception as e:
        fail(f"TranscriptionService init failed: {e}")
        import traceback; traceback.print_exc()
        return False

    # ── Step 3: transcribe every WAV file ─────────────────────────────────────
    print()
    all_passed = True
    for idx, wav_path in enumerate(wav_files, 1):
        print(f"[{idx}/{len(wav_files)}] {wav_path.name}")

        # Load
        try:
            audio_data, sample_rate = load_wav(wav_path)
            duration_s = len(audio_data) / sample_rate
            max_amp    = int(np.abs(audio_data).max())
            info(f"  samples={len(audio_data):,}  rate={sample_rate} Hz  "
                 f"duration={duration_s:.2f}s  max_amplitude={max_amp}")
            if duration_s < 0.5:
                fail(f"  Too short ({duration_s:.2f}s) — skipping.")
                continue
        except Exception as e:
            fail(f"  Failed to load: {e}")
            all_passed = False
            continue

        # Transcribe
        try:
            result = await svc.transcribe_audio(audio_data, sample_rate,
                                                source_file=str(wav_path))
        except Exception as e:
            fail(f"  transcribe_audio() raised: {e}")
            import traceback; traceback.print_exc()
            all_passed = False
            continue

        # Evaluate
        if "error" in result:
            fail(f"  Transcription error: {result['error']}")
            all_passed = False
            continue

        full_text = result.get("full_text", "").strip()
        segments  = result.get("segments", [])
        language  = result.get("language", "?")

        if full_text:
            ok(f"  [{language}] {len(segments)} segment(s) — \"{full_text[:120]}\"")
        else:
            info(f"  [{language}] No speech detected (silent chunk) — "
                 "empty transcript saved.")
        print()

    return all_passed


# ── entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    passed = asyncio.run(test_transcription_pipeline())
    print()
    print(SEP)
    print("  RESULT:", "PASS ✅" if passed else "FAIL ❌")
    print(SEP)
    sys.exit(0 if passed else 1)
