// Renders a playable piano keyboard and exposes a small API:
//   kb.element              the DOM node
//   kb.highlight(midi, on)  light a key (used during playback)
// Pointer (mouse/touch) input plays notes live via the synth.

import { isBlackKey, midiToName } from "./chords.js";
import { noteOn, noteOff } from "./synth.js";

export function buildKeyboard(container, { low = 48, high = 84, labels = false } = {}) {
  container.classList.add("kb");
  container.innerHTML = "";

  const whites = [];
  for (let m = low; m <= high; m++) if (!isBlackKey(m)) whites.push(m);
  const whiteW = 100 / whites.length;

  const keyEls = new Map();

  function makeKey(midi, black) {
    const el = document.createElement("div");
    el.className = "key " + (black ? "black" : "white");
    el.dataset.midi = midi;
    if (labels && !black && midi % 12 === 0) {   // label C of each octave
      const span = document.createElement("span");
      span.className = "label";
      span.textContent = midiToName(midi);
      el.appendChild(span);
    }
    keyEls.set(midi, el);
    return el;
  }

  // White keys first (flow), black keys positioned over the seams.
  for (const m of whites) container.appendChild(makeKey(m, false));

  let whiteIndex = 0;
  for (let m = low; m <= high; m++) {
    if (isBlackKey(m)) {
      const el = makeKey(m, true);
      // Centre the black key over the seam between the surrounding white keys.
      el.style.left = `${whiteIndex * whiteW - whiteW * 0.31}%`;
      el.style.width = `${whiteW * 0.62}%`;
      container.appendChild(el);
    } else {
      whiteIndex++;
    }
  }

  // --- pointer interaction (with drag-glissando) ---
  const down = new Set();
  let pointerDown = false;

  function press(midi) {
    if (midi == null || down.has(midi)) return;
    down.add(midi);
    keyEls.get(midi)?.classList.add("down");
    noteOn(midi);
  }
  function release(midi) {
    if (midi == null || !down.has(midi)) return;
    down.delete(midi);
    keyEls.get(midi)?.classList.remove("down");
    noteOff(midi);
  }
  function midiAt(target) {
    const k = target?.closest?.(".key");
    return k ? Number(k.dataset.midi) : null;
  }

  container.addEventListener("pointerdown", (e) => {
    pointerDown = true;
    press(midiAt(e.target));
    e.preventDefault();
  });
  container.addEventListener("pointermove", (e) => {
    if (!pointerDown) return;
    const m = midiAt(document.elementFromPoint(e.clientX, e.clientY));
    for (const d of [...down]) if (d !== m) release(d);
    press(m);
  });
  const endAll = () => { pointerDown = false; for (const d of [...down]) release(d); };
  window.addEventListener("pointerup", endAll);
  window.addEventListener("pointercancel", endAll);

  return {
    element: container,
    range: { low, high },
    highlight(midi, on) {
      keyEls.get(midi)?.classList.toggle("playing", on);
    },
    clearHighlights() {
      keyEls.forEach((el) => el.classList.remove("playing"));
    },
  };
}

// Map the computer keyboard onto the piano, starting at `base` (default C4=60).
export function attachComputerKeyboard(kb, base = 60) {
  // a w s e d f t g y h u j  -> C C# D D# E F F# G G# A A# B, then up an octave
  const offsets = { a:0, w:1, s:2, e:3, d:4, f:5, t:6, g:7, y:8, h:9, u:10, j:11,
                    k:12, o:13, l:14, p:15, ";":16, "'":17 };
  const held = new Set();

  window.addEventListener("keydown", (e) => {
    if (e.repeat || !(e.key in offsets)) return;
    const midi = base + offsets[e.key];
    if (held.has(midi)) return;
    held.add(midi);
    kb.highlight(midi, true);
    noteOn(midi);
  });
  window.addEventListener("keyup", (e) => {
    if (!(e.key in offsets)) return;
    const midi = base + offsets[e.key];
    held.delete(midi);
    kb.highlight(midi, false);
    noteOff(midi);
  });
}
