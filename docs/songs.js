// Built-in demo tunes, plus a small text-notation parser.
// A "step" is { notes: [names], beats } played in sequence; notes together in
// one step sound as a chord; an empty notes array is a rest.

import { noteToMidi } from "./chords.js";

// Turn sequential steps into absolute-time events.
function buildEvents(steps, { bpm = 100, legato = 0.92 } = {}) {
  const beat = 60 / bpm;
  const events = [];
  let t = 0;
  for (const { notes, beats } of steps) {
    const dur = beats * beat;
    for (const n of notes) {
      const midi = typeof n === "number" ? n : noteToMidi(n);
      if (midi != null) events.push({ midi, start: t, duration: dur * legato, velocity: 0.85 });
    }
    t += dur;
  }
  return events;
}

// A short, singable arrangement of the refrain of
// "There Shall Be Showers of Blessing" (melody + block chords).
const SHOWERS = [
  { notes: ["Bb4", "Bb3", "D4", "F4"], beats: 1 },   // Show-  (Bb)
  { notes: ["Bb4"], beats: 0.5 },                    // ers
  { notes: ["C5"], beats: 0.5 },                     // of
  { notes: ["D5", "Bb3", "D4", "F4"], beats: 1.5 },  // bless-
  { notes: ["C5"], beats: 0.5 },                     // ing,
  { notes: ["Bb4", "Eb3", "G3", "Bb3"], beats: 1 },  // Show-  (Eb)
  { notes: ["C5"], beats: 0.5 },                     // ers
  { notes: ["D5"], beats: 0.5 },                     // of
  { notes: ["Eb5", "Eb3", "G3", "Bb3"], beats: 1.5 },// bless-
  { notes: ["D5"], beats: 0.5 },                     // ing
  { notes: ["C5", "F3", "A3", "C4"], beats: 1 },     // we     (F)
  { notes: ["C5"], beats: 2 },                       // need;  (F->)
  { notes: ["Bb4", "Bb3", "D4", "F4"], beats: 3 },   // (Bb resolve)
];

export const DEMO_SONGS = {
  "Showers of Blessing (refrain — arrangement)": buildEvents(SHOWERS, { bpm: 96 }),
};

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
