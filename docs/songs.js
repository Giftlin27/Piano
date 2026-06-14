// Built-in demo tunes, plus a small text-notation parser.
//
// Demos are written in the same text notation the "Type notes" box accepts and
// run through parseText, so what you read here is exactly what plays.

import { noteToMidi } from "./chords.js";

// Parse free text into events. Tokens separated by spaces:
//   C4 D4 E4        sequential notes (default octave 4)
//   C4+E4+G4        a chord (notes joined with +)
//   G4:2            note held for 2 beats (default 1)
//   - or _ or rest  a rest
export function parseText(text, { bpm = 110 } = {}) {
  const beat = 60 / bpm;
  const events = [];
  let t = 0;
  for (const tok of text.trim().split(/\s+/).filter(Boolean)) {
    const [body, beatsStr] = tok.split(":");
    const beats = beatsStr ? parseFloat(beatsStr) || 1 : 1;
    const dur = beats * beat;
    if (body === "-" || body === "_" || body.toLowerCase() === "rest") {
      t += dur;
      continue;
    }
    for (const n of body.split("+")) {
      const midi = noteToMidi(n);
      if (midi != null) events.push({ midi, start: t, duration: dur * 0.9, velocity: 0.85 });
    }
    t += dur;
  }
  return events;
}

// Familiar melodies, transcribed note-for-note (melody only, so they're
// unambiguously correct). For a specific hymn/song, upload its MIDI file.
export const DEMO_SONGS = {
  "Ode to Joy": parseText(
    "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2 " +
    "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2",
    { bpm: 140 }
  ),
  "Twinkle, Twinkle Little Star": parseText(
    "C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 " +
    "G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 " +
    "C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2",
    { bpm: 150 }
  ),
  "Mary Had a Little Lamb": parseText(
    "E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 " +
    "E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:2",
    { bpm: 150 }
  ),
  "Happy Birthday": parseText(
    "G4:0.75 G4:0.25 A4 G4 C5 B4:2 " +
    "G4:0.75 G4:0.25 A4 G4 D5 C5:2 " +
    "G4:0.75 G4:0.25 G5 E5 C5 B4 A4:1.5 " +
    "F5:0.75 F5:0.25 E5 C5 D5 C5:2",
    { bpm: 160 }
  ),
};
