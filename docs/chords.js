// Music theory: note frequencies + chord interval definitions.
// Browser port of chords.py — keep the two in sync (same names, same layout).

// Semitone offset of each pitch class from C, using sharps.
export const NOTE_OFFSETS = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

// Roots = rows of the grid.
export const ROOTS = Object.keys(NOTE_OFFSETS);

// Chord qualities -> intervals (semitones above root). Order = column order.
export const QUALITIES = {
  maj:  [0, 4, 7],
  min:  [0, 3, 7],
  "7":  [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dim:  [0, 3, 6],
  aug:  [0, 4, 8],
  sus4: [0, 5, 7],
};

// Octave chords are voiced in (C4 = middle C).
const BASE_OCTAVE = 4;

// Roots tried longest-first so "C#" matches before "C" when parsing.
const ROOTS_BY_LEN = [...ROOTS].sort((a, b) => b.length - a.length);

export function midiNumber(note, octave) {
  return 12 * (octave + 1) + NOTE_OFFSETS[note];
}

export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

// Split "C#min7" -> ["C#", "min7"]. Throws on unknown root/quality.
export function parseChord(name) {
  const n = name.trim();
  for (const root of ROOTS_BY_LEN) {
    if (n.startsWith(root)) {
      const quality = n.slice(root.length) || "maj";
      if (!(quality in QUALITIES)) throw new Error(`Unknown quality: ${quality}`);
      return [root, quality];
    }
  }
  throw new Error(`Unrecognised chord: ${name}`);
}

// Frequencies (Hz) of every note in the named chord.
export function chordFrequencies(name) {
  const [root, quality] = parseChord(name);
  const base = midiNumber(root, BASE_OCTAVE);
  return QUALITIES[quality].map((i) => midiToFreq(base + i));
}

// --- Note name <-> MIDI (used by the keyboard, text parser, players) --------

const FLAT_TO_SHARP = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
  Cb: "B", Fb: "E",
};
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// "C#4", "Bb3", "G" (octave defaults to 4) -> MIDI number. null if invalid.
export function noteToMidi(text, defaultOctave = 4) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)?$/.exec(text.trim());
  if (!m) return null;
  let letter = m[1].toUpperCase() + (m[2] || "");
  if (letter in FLAT_TO_SHARP) letter = FLAT_TO_SHARP[letter];
  else if (letter.endsWith("b")) letter = FLAT_TO_SHARP[letter] || letter;
  const pc = NOTE_OFFSETS[letter];
  if (pc === undefined) return null;
  const octave = m[3] !== undefined ? parseInt(m[3], 10) : defaultOctave;
  return 12 * (octave + 1) + pc;
}

// MIDI -> "C#4" (sharps).
export function midiToName(midi) {
  return SHARP_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function isBlackKey(midi) {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}
