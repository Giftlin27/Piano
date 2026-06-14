// Sound engine shared by every page.
//
// Primary path: real instrument samples via WebAudioFont (grand piano, pipe
// organs, strings). Fallback path: built-in oscillator synthesis — used while
// samples are still downloading, or if the CDN is unreachable (offline). The
// public API is unchanged: setVoice / noteOn / noteOff / strike / stopAll /
// playChord / now / resume.

import { chordFrequencies } from "./chords.js";

const WAF_PLAYER_URL = "https://cdn.jsdelivr.net/gh/surikov/webaudiofont/npm/dist/WebAudioFontPlayer.js";
const WAF_DATA_BASE = "https://cdn.jsdelivr.net/gh/surikov/webaudiofontdata/sound/";

// Each voice: a WebAudioFont GM instrument (code) + oscillator fallback params.
export const VOICES = {
  "Grand Piano": {
    waf: "0000",
    type: "triangle", partials: [[1, 1], [2, 0.35], [3, 0.12], [4, 0.06]],
    attack: 0.004, sustain: false, sustainLevel: 0.25, decay: 1.6, release: 0.25,
  },
  "Church Organ": {
    waf: "0190",
    type: "sine", partials: [[1, 1], [2, 0.7], [3, 0.5], [4, 0.35], [6, 0.2], [8, 0.12]],
    attack: 0.03, sustain: true, release: 0.12,
  },
  "Chapel Organ": {
    waf: "0160",
    type: "sine", partials: [[1, 1], [2, 0.4], [3, 0.25], [5, 0.12]],
    attack: 0.05, sustain: true, release: 0.18, vibrato: { rate: 5, depth: 6 },
  },
  "Reed Harmonium": {
    waf: "0200",
    type: "sawtooth", partials: [[1, 1], [2, 0.3]],
    attack: 0.06, sustain: true, release: 0.2, vibrato: { rate: 5.5, depth: 8 },
  },
  "Strings": {
    waf: "0480",
    type: "sawtooth", partials: [[1, 1], [2, 0.5], [3, 0.2]],
    attack: 0.18, sustain: true, release: 0.45, vibrato: { rate: 5, depth: 7 },
  },
};
for (const v of Object.values(VOICES)) v._norm = v.partials.reduce((s, [, g]) => s + g, 0);

export const VOICE_NAMES = Object.keys(VOICES);
let voice = VOICES["Grand Piano"];

let ctx = null;
let master = null;
const sustained = new Map();    // osc fallback: midi -> { gain, nodes }
const scheduled = new Set();    // osc fallback: nodes from strike()
const wafSustained = new Map(); // samples: midi -> envelope
const wafScheduled = new Set(); // samples: envelopes from strike()

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

export function now() { return audio().currentTime; }
export function midiToFreq(midi) { return 440 * 2 ** ((midi - 69) / 12); }

// --- WebAudioFont sample loading -------------------------------------------

let wafPlayer = null;
let wafEnabled = true;
const varName = (v) => `_tone_${v.waf}_FluidR3_GM_sf2_file`;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = res;
    s.onerror = () => rej(new Error("failed to load " + src));
    document.head.appendChild(s);
  });
}

async function ensurePlayer() {
  if (wafPlayer) return wafPlayer;
  await loadScript(WAF_PLAYER_URL);
  wafPlayer = new window.WebAudioFontPlayer();
  return wafPlayer;
}

// Returns the decoded preset for a voice, or null if samples aren't ready yet.
function presetFor(v) {
  return v._loaded ? window[varName(v)] : null;
}

async function ensureInstrument(v) {
  if (!wafEnabled || v._loaded) return;
  if (v._loading) return v._loading;
  v._loading = (async () => {
    const p = await ensurePlayer();
    const name = varName(v);
    if (!window[name]) await loadScript(WAF_DATA_BASE + `${v.waf}_FluidR3_GM_sf2_file.js`);
    p.loader.decodeAfterLoading(audio(), name);
    await new Promise((res) => p.loader.waitLoad(res));
    v._loaded = true;
  })().catch((e) => { console.warn("WebAudioFont disabled:", e.message); wafEnabled = false; });
  return v._loading;
}

export function setVoice(name) {
  if (VOICES[name]) { voice = VOICES[name]; ensureInstrument(voice); }
}
export function resume() { audio(); ensureInstrument(voice); }

// --- Oscillator fallback ----------------------------------------------------

function buildOsc(ac, freq, into, startAt, v) {
  const nodes = [];
  let lfoGain = null;
  if (v.vibrato) {
    const lfo = ac.createOscillator();
    lfo.frequency.value = v.vibrato.rate;
    lfoGain = ac.createGain();
    lfoGain.gain.value = v.vibrato.depth;
    lfo.connect(lfoGain); lfo.start(startAt);
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

function oscNoteOn(midi, velocity) {
  const ac = audio(); const v = voice; const t = ac.currentTime; const peak = velocity * 0.3;
  const gain = ac.createGain(); gain.connect(master);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + v.attack);
  if (!v.sustain) gain.gain.exponentialRampToValueAtTime(peak * v.sustainLevel, t + v.attack + v.decay);
  sustained.set(midi, { gain, nodes: buildOsc(ac, midiToFreq(midi), gain, t, v), v });
}

function oscStrike(midi, when, duration, velocity) {
  const ac = audio(); const v = voice; const dur = Math.max(duration, 0.12); const peak = velocity * 0.3;
  const gain = ac.createGain(); gain.connect(master);
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
  for (const n of buildOsc(ac, midiToFreq(midi), gain, when, v)) {
    n.stop(end); scheduled.add(n); n.onended = () => scheduled.delete(n);
  }
}

// --- Public playing API (samples when ready, else oscillators) --------------

export function noteOn(midi, velocity = 0.85) {
  const ac = audio();
  if (wafSustained.has(midi) || sustained.has(midi)) noteOff(midi);
  const preset = presetFor(voice);
  if (preset) {
    const env = wafPlayer.queueWaveTable(ac, master, preset, ac.currentTime, midi, 9999, velocity);
    wafSustained.set(midi, env);
  } else {
    oscNoteOn(midi, velocity);
  }
}

export function noteOff(midi) {
  const env = wafSustained.get(midi);
  if (env) {
    wafSustained.delete(midi);
    try { env.cancel(); } catch {}
    return;
  }
  const s = sustained.get(midi);
  if (!s) return;
  sustained.delete(midi);
  const t = ctx.currentTime;
  s.gain.gain.cancelScheduledValues(t);
  s.gain.gain.setTargetAtTime(0.0001, t, s.v.release / 3);
  for (const n of s.nodes) { try { n.stop(t + s.v.release + 0.2); } catch {} }
}

export function strike(midi, when, duration, velocity = 0.85) {
  const ac = audio();
  const preset = presetFor(voice);
  if (preset) {
    const env = wafPlayer.queueWaveTable(ac, master, preset, when, midi, Math.max(duration, 0.12), velocity);
    wafScheduled.add(env);
  } else {
    oscStrike(midi, when, duration, velocity);
  }
}

export function stopAll() {
  const t = audio().currentTime;
  if (wafPlayer) { try { wafPlayer.cancelQueue(ctx); } catch {} }
  for (const env of wafSustained.values()) { try { env.cancel(); } catch {} }
  wafSustained.clear();
  wafScheduled.clear();
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
