// Live Piano page: a full playable keyboard (mouse / touch / computer keys)
// with a selectable instrument voice.

import { buildKeyboard, attachComputerKeyboard } from "./keyboard.js";
import { resume, setVoice, VOICE_NAMES } from "./synth.js";

const kb = buildKeyboard(document.getElementById("keyboard"), {
  low: 21, high: 108, labels: true,   // full 88-key piano, A0 .. C8
});
attachComputerKeyboard(kb, 60);        // computer keys start at middle C

// Instrument voice selector.
const voiceSel = document.getElementById("voice");
for (const name of VOICE_NAMES) {
  const opt = document.createElement("option");
  opt.value = name; opt.textContent = name;
  voiceSel.appendChild(opt);
}
voiceSel.addEventListener("change", () => setVoice(voiceSel.value));

// Unlock audio on the first interaction (mobile autoplay policy).
window.addEventListener("pointerdown", resume, { once: true });
window.addEventListener("keydown", resume, { once: true });
