"""Tests for the pure music-theory layer (no audio hardware needed)."""

import math

import pytest

from chords import (
    QUALITIES,
    ROOTS,
    chord_frequencies,
    midi_number,
    midi_to_freq,
    parse_chord,
)


def test_reference_pitches():
    assert midi_number("A", 4) == 69
    assert midi_number("C", 4) == 60
    assert midi_to_freq(69) == pytest.approx(440.0)


def test_c_major_is_c_e_g():
    # C4, E4, G4
    assert chord_frequencies("Cmaj") == pytest.approx([261.63, 329.63, 392.00], abs=0.01)


def test_quality_intervals_match_frequencies():
    # Frequency ratios must equal 2**(semitones/12) above the root.
    for quality, intervals in QUALITIES.items():
        freqs = chord_frequencies(f"C{quality}")
        root = freqs[0]
        for interval, f in zip(intervals, freqs):
            assert f / root == pytest.approx(2 ** (interval / 12), rel=1e-9)


@pytest.mark.parametrize(
    "name,expected",
    [("C#min7", ("C#", "min7")), ("Gmaj7", ("G", "maj7")), ("C", ("C", "maj"))],
)
def test_parse_chord(name, expected):
    assert parse_chord(name) == expected


@pytest.mark.parametrize("bad", ["H", "Cwut", "", "  "])
def test_parse_chord_rejects_garbage(bad):
    with pytest.raises(ValueError):
        parse_chord(bad)


def test_every_grid_cell_parses():
    # Mirrors what build_workbook.py writes into the grid.
    for root in ROOTS:
        for quality in QUALITIES:
            assert chord_frequencies(f"{root}{quality}")
