// Chord synthesis with the Web Audio API.
// Browser port of synth.py: each note = sine fundamental + quiet 2nd harmonic,
// shaped by a short attack and exponential decay. Works on every modern
// browser, desktop and mobile.

import { chordFrequencies } from "./chords.js";

const DURATION = 1.6; // seconds per chord

let ctx = null;
let master = null;

// Lazily create the AudioContext. Must be called from a user gesture (a tap),
// which is exactly when we play — satisfies mobile autoplay policies.
function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    // A gentle limiter so stacking up to 4 notes never clips harshly.
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -10;
    master.ratio.value = 12;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function playChord(name) {
  const ac = audio();
  const freqs = chordFrequencies(name);
  const now = ac.currentTime;
  const n = freqs.length;

  for (const f of freqs) {
    // [frequency, relative amplitude] — fundamental + 2nd harmonic.
    for (const [freq, amp] of [[f, 1.0], [2 * f, 0.25]]) {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const g = ac.createGain();
      const peak = (amp / n) * 0.8;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now + 0.008);       // ~8 ms attack
      g.gain.exponentialRampToValueAtTime(0.0001, now + DURATION); // decay

      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + DURATION + 0.1);
    }
  }
}
