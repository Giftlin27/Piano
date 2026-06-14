// Schedules a list of note events for audio playback while lighting up the
// keyboard in time. Events: { midi, start, duration, velocity } (seconds).

import { strike, stopAll, now, resume } from "./synth.js";

export function createPlayer(keyboard) {
  let timers = [];
  let playing = false;

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function stop() {
    clearTimers();
    stopAll();
    keyboard.clearHighlights();
    playing = false;
  }

  function play(events, { onEnd } = {}) {
    stop();
    if (!events.length) return;
    resume();
    playing = true;

    const lead = 0.15;
    const t0 = now() + lead;
    let total = 0;

    for (const ev of events) {
      const vel = ev.velocity ?? 0.85;
      // Split hands: notes below middle C (60) = left hand, otherwise right.
      const hand = ev.hand || (ev.midi < 60 ? "left" : "right");
      strike(ev.midi, t0 + ev.start, ev.duration, vel);
      // Visual highlight, scheduled in wall-clock time.
      timers.push(setTimeout(() => keyboard.highlight(ev.midi, true, hand),
                             (lead + ev.start) * 1000));
      timers.push(setTimeout(() => keyboard.highlight(ev.midi, false, hand),
                             (lead + ev.start + ev.duration) * 1000));
      total = Math.max(total, ev.start + ev.duration);
    }

    timers.push(setTimeout(() => {
      playing = false;
      keyboard.clearHighlights();
      onEnd?.();
    }, (lead + total + 0.3) * 1000));
  }

  return { play, stop, get playing() { return playing; } };
}
