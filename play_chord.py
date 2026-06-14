"""Command-line entry point called by Excel's VBA on cell selection.

Usage:
    pythonw play_chord.py "Cmaj"

Kept deliberately tiny so process start-up (the dominant latency when Excel
launches it per click) stays low. Errors are written to play_chord.log rather
than raised, since there's no console when invoked via pythonw.
"""

from __future__ import annotations

import sys
from pathlib import Path

from synth import play


def main(argv: list[str]) -> int:
    if len(argv) < 2 or not argv[1].strip():
        return 0  # Nothing selected / blank cell -> silently do nothing.

    chord_name = argv[1].strip()
    try:
        play(chord_name)
    except Exception as exc:  # noqa: BLE001 - log everything, never pop a dialog
        log = Path(__file__).with_name("play_chord.log")
        log.write_text(f"Failed to play {chord_name!r}: {exc}\n", encoding="utf-8")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
