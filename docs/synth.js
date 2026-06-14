// Web Audio sound engine shared by every page.
//
//   noteOn / noteOff  -> sustained voices for live playing (key held down)
//   strike            -> a self-contained struck note for scheduled playback
//   playChord         -> convenience for the chord grid (uses strike)
//
// All voices run through a master compressor so stacking notes never clips.

import { chordFrequencies } from "./chords.js";

let ctx = null;
let master = null;
const sustained = new Map();   // midi -> { gain, oscs }
const scheduled = new Set();   // oscillators from strike(), for stopAll()

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -10;
    master.ratio.value = 12;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function resume() { audio(); }
export function now() { return audio().currentTime; }
export function midiToFreq(midi) { return 440 * 2 ** ((midi - 69) / 12); }

// Build the two partials (fundamental + quiet 2nd harmonic) into a gain node.
function makeOscs(ac, freq, into, startAt) {
  return [[freq, 1.0], [2 * freq, 0.25]].map(([f, amp]) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const og = ac.createGain();
    og.gain.value = amp;
    o.connect(og).connect(into);
    o.start(startAt);
    return o;
  });
}

// --- Live playing -----------------------------------------------------------

export function noteOn(midi, velocity = 0.8) {
  const ac = audio();
  if (sustained.has(midi)) noteOff(midi);
  const t = ac.currentTime;
  const peak = velocity * 0.25;

  const gain = ac.createGain();
  gain.connect(master);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);   // attack
  gain.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.5); // light decay->sustain

  sustained.set(midi, { gain, oscs: makeOscs(ac, midiToFreq(midi), gain, t) });
}

export function noteOff(midi) {
  const v = sustained.get(midi);
  if (!v) return;
  sustained.delete(midi);
  const t = ctx.currentTime;
  v.gain.gain.cancelScheduledValues(t);
  v.gain.gain.setTargetAtTime(0.0001, t, 0.08);   // smooth release
  v.oscs.forEach((o) => o.stop(t + 0.4));
}

// --- Scheduled playback -----------------------------------------------------

export function strike(midi, when, duration, velocity = 0.85) {
  const ac = audio();
  const dur = Math.max(duration, 0.15);
  const peak = velocity * 0.25;

  const gain = ac.createGain();
  gain.connect(master);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  for (const o of makeOscs(ac, midiToFreq(midi), gain, when)) {
    o.stop(when + dur + 0.1);
    scheduled.add(o);
    o.onended = () => scheduled.delete(o);
  }
}

export function stopAll() {
  const t = audio().currentTime;
  for (const o of scheduled) { try { o.stop(t); } catch {} }
  scheduled.clear();
  for (const midi of [...sustained.keys()]) noteOff(midi);
}

// --- Chord grid -------------------------------------------------------------

export function playChord(name) {
  const t = now() + 0.001;
  const freqs = chordFrequencies(name);
  // strike() takes midi; convert freq->midi to reuse the same voice.
  for (const f of freqs) {
    const midi = Math.round(69 + 12 * Math.log2(f / 440));
    strike(midi, t, 1.6, 0.8 / Math.sqrt(freqs.length));
  }
}
