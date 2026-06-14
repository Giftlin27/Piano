"""Music theory: note names, frequencies, and chord interval definitions.

Everything here is pure data + math so it can be unit-tested without audio
hardware. The synth and the workbook builder both import from this module so
the two stay in sync (same chord names, same layout).
"""

from __future__ import annotations

# Semitone offset of each pitch class from C, using sharps.
NOTE_OFFSETS: dict[str, int] = {
    "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5,
    "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11,
}

# Roots laid out as the rows of the Excel grid.
ROOTS: list[str] = list(NOTE_OFFSETS.keys())

# Chord qualities -> intervals in semitones above the root.
# The dict order defines the column order in the Excel grid.
QUALITIES: dict[str, list[int]] = {
    "maj":  [0, 4, 7],
    "min":  [0, 3, 7],
    "7":    [0, 4, 7, 10],
    "maj7": [0, 4, 7, 11],
    "min7": [0, 3, 7, 10],
    "dim":  [0, 3, 6],
    "aug":  [0, 4, 8],
    "sus4": [0, 5, 7],
}

# Octave the chords are voiced in (C4 = middle C).
BASE_OCTAVE = 4

# Roots tried longest-first so "C#" is matched before "C" when parsing.
_ROOTS_BY_LEN = sorted(NOTE_OFFSETS, key=len, reverse=True)


def midi_number(note: str, octave: int) -> int:
    """MIDI note number, e.g. C4 -> 60, A4 -> 69."""
    return 12 * (octave + 1) + NOTE_OFFSETS[note]


def midi_to_freq(midi: int) -> float:
    """Equal-tempered frequency in Hz for a MIDI note number (A4 = 440)."""
    return 440.0 * 2.0 ** ((midi - 69) / 12.0)


def parse_chord(name: str) -> tuple[str, str]:
    """Split a chord name like 'C#min7' into ('C#', 'min7').

    Raises ValueError if the root or quality is not recognised.
    """
    name = name.strip()
    for root in _ROOTS_BY_LEN:
        if name.startswith(root):
            quality = name[len(root):] or "maj"
            if quality not in QUALITIES:
                raise ValueError(f"Unknown chord quality: {quality!r}")
            return root, quality
    raise ValueError(f"Unrecognised chord name: {name!r}")


def chord_frequencies(name: str) -> list[float]:
    """Return the frequency (Hz) of every note in the named chord."""
    root, quality = parse_chord(name)
    base = midi_number(root, BASE_OCTAVE)
    return [midi_to_freq(base + interval) for interval in QUALITIES[quality]]
