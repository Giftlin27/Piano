// Web Audio sound engine shared by every page.
//
//   setVoice / VOICE_NAMES   pick the instrument timbre
//   noteOn / noteOff         sustained voices for live playing (key held)
//   strike                   a scheduled note for playback
//   playChord                convenience for the chord grid
//
// Each "voice" is a set of harmonic partials + an amplitude envelope. Organs
// sustain while held; piano-like voices decay. Everything runs through a
// master compressor so stacked notes never clip.

import { chordFrequencies } from "./chords.js";

// partials: [harmonic multiple, relative gain]. sustain: hold while held.
export const VOICES = {
  "Grand Piano": {
    type: "triangle",
    partials: [[1, 1], [2, 0.35], [3, 0.12], [4, 0.06]],
    attack: 0.004, sustain: false, sustainLevel: 0.25, decay: 1.6, release: 0.25,
  },
  "Church Organ": {
    type: "sine",
    partials: [[1, 1], [2, 0.7], [3, 0.5], [4, 0.35], [6, 0.2], [8, 0.12]],
    attack: 0.03, sustain: true, release: 0.12,
  },
  "Chapel Organ": {
    type: "sine",
    partials: [[1, 1], [2, 0.4], [3, 0.25], [5, 0.12]],
    attack: 0.05, sustain: true, release: 0.18,
    vibrato: { rate: 5, depth: 6 },
  },
  "Reed Harmonium": {
    type: "sawtooth",
    partials: [[1, 1], [2, 0.3]],
    attack: 0.06, sustain: true, release: 0.2,
    vibrato: { rate: 5.5, depth: 8 },
  },
  "Strings": {
    type: "sawtooth",
    partials: [[1, 1], [2, 0.5], [3, 0.2]],
    attack: 0.18, sustain: true, release: 0.45,
    vibrato: { rate: 5, depth: 7 },
  },
};

// Pre-compute the sum of partial gains for loudness normalisation.
for (const v of Object.values(VOICES)) v._norm = v.partials.reduce((s, [, g]) => s + g, 0);

export const VOICE_NAMES = Object.keys(VOICES);
let voice = VOICES["Grand Piano"];
export function setVoice(name) { if (VOICES[name]) voice = VOICES[name]; }

let ctx = null;
let master = null;
const sustained = new Map();   // midi -> { gain, nodes }
const scheduled = new Set();   // nodes from strike(), for stopAll()

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -12;
    master.ratio.value = 12;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function resume() { audio(); }
export function now() { return audio().currentTime; }
export function midiToFreq(midi) { return 440 * 2 ** ((midi - 69) / 12); }

// Build all oscillators (partials + optional vibrato LFO) for one note.
function buildNote(ac, freq, into, startAt, v) {
  const nodes = [];
  let lfoGain = null;
  if (v.vibrato) {
    const lfo = ac.createOscillator();
    lfo.frequency.value = v.vibrato.rate;
    lfoGain = ac.createGain();
    lfoGain.gain.value = v.vibrato.depth;   // cents
    lfo.connect(lfoGain);
    lfo.start(startAt);
    nodes.push(lfo);
  }
  for (const [mult, amp] of v.partials) {
    const o = ac.createOscillator();
    o.type = v.type || "sine";
    o.frequency.value = freq * mult;
    if (lfoGain) lfoGain.connect(o.detune);
    const og = ac.createGain();
    og.gain.value = amp / v._norm;
    o.connect(og).connect(into);
    o.start(startAt);
    nodes.push(o);
  }
  return nodes;
}

function stopNodes(nodes, when) {
  for (const n of nodes) { try { n.stop(when); } catch {} }
}

// --- Live playing -----------------------------------------------------------

export function noteOn(midi, velocity = 0.85) {
  const ac = audio();
  if (sustained.has(midi)) noteOff(midi);
  const v = voice;
  const t = ac.currentTime;
  const peak = velocity * 0.3;

  const gain = ac.createGain();
  gain.connect(master);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + v.attack);
  if (!v.sustain) {
    gain.gain.exponentialRampToValueAtTime(peak * v.sustainLevel, t + v.attack + v.decay);
  }

  sustained.set(midi, { gain, nodes: buildNote(ac, midiToFreq(midi), gain, t, v), v });
}

export function noteOff(midi) {
  const s = sustained.get(midi);
  if (!s) return;
  sustained.delete(midi);
  const t = ctx.currentTime;
  s.gain.gain.cancelScheduledValues(t);
  s.gain.gain.setTargetAtTime(0.0001, t, s.v.release / 3);
  stopNodes(s.nodes, t + s.v.release + 0.2);
}

// --- Scheduled playback -----------------------------------------------------

export function strike(midi, when, duration, velocity = 0.85) {
  const ac = audio();
  const v = voice;
  const dur = Math.max(duration, 0.12);
  const peak = velocity * 0.3;

  const gain = ac.createGain();
  gain.connect(master);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + v.attack);

  let end;
  if (v.sustain) {
    const relStart = Math.max(when + v.attack, when + dur);
    gain.gain.setValueAtTime(peak, relStart);
    gain.gain.exponentialRampToValueAtTime(0.0001, relStart + v.release);
    end = relStart + v.release + 0.05;
  } else {
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    end = when + dur + 0.05;
  }

  const nodes = buildNote(ac, midiToFreq(midi), gain, when, v);
  for (const n of nodes) {
    n.stop(end);
    scheduled.add(n);
    n.onended = () => scheduled.delete(n);
  }
}

export function stopAll() {
  const t = audio().currentTime;
  for (const n of scheduled) { try { n.stop(t); } catch {} }
  scheduled.clear();
  for (const midi of [...sustained.keys()]) noteOff(midi);
}

// --- Chord grid -------------------------------------------------------------

export function playChord(name) {
  const t = now() + 0.001;
  const freqs = chordFrequencies(name);
  for (const f of freqs) {
    const midi = Math.round(69 + 12 * Math.log2(f / 440));
    strike(midi, t, 1.6, 0.8 / Math.sqrt(freqs.length));
  }
}
