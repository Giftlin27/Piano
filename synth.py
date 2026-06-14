"""Turn a chord into audible sound.

Synthesizes a chord as a sum of sine partials with a plucked/struck envelope,
renders it to an in-memory 16-bit PCM WAV, and plays it through Windows'
built-in ``winsound`` (no third-party audio library required).
"""

from __future__ import annotations

import io
import wave

import numpy as np

from chords import chord_frequencies

SAMPLE_RATE = 44_100
DURATION = 1.6          # seconds per chord
MAX_AMPLITUDE = 0.85    # headroom so the mix never clips


def _envelope(n_samples: int) -> np.ndarray:
    """A short attack followed by exponential decay (piano-ish)."""
    t = np.linspace(0, DURATION, n_samples, endpoint=False)
    attack = np.clip(t / 0.008, 0, 1)          # ~8 ms fade-in, kills clicks
    decay = np.exp(-3.0 * t)                    # exponential ring-out
    return attack * decay


def render_wav(chord_name: str) -> bytes:
    """Render the named chord to WAV file bytes (mono, 16-bit, 44.1 kHz)."""
    freqs = chord_frequencies(chord_name)
    n = int(SAMPLE_RATE * DURATION)
    t = np.linspace(0, DURATION, n, endpoint=False)

    mix = np.zeros(n, dtype=np.float64)
    for f in freqs:
        # Fundamental + a quieter 2nd harmonic for a little warmth.
        mix += np.sin(2 * np.pi * f * t)
        mix += 0.25 * np.sin(2 * np.pi * 2 * f * t)

    mix *= _envelope(n)
    mix /= np.max(np.abs(mix)) or 1.0          # normalise
    samples = np.int16(mix * MAX_AMPLITUDE * 32767)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(samples.tobytes())
    return buf.getvalue()


def play(chord_name: str) -> None:
    """Synthesize and play a chord, blocking until playback finishes.

    Blocking matters: when launched via ``pythonw`` the process must stay
    alive until the sound completes, otherwise it gets cut off.
    """
    import winsound  # Windows-only; imported lazily so the rest is portable.

    wav_bytes = render_wav(chord_name)
    winsound.PlaySound(wav_bytes, winsound.SND_MEMORY)
