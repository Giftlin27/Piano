// Live Piano page: a playable keyboard (mouse / touch / computer keys).

import { buildKeyboard, attachComputerKeyboard } from "./keyboard.js";
import { resume } from "./synth.js";

const kb = buildKeyboard(document.getElementById("keyboard"), {
  low: 48, high: 84, labels: true,   // C3 .. C6
});
attachComputerKeyboard(kb, 60);      // computer keys start at C4

// Unlock audio on the first interaction (mobile autoplay policy).
window.addEventListener("pointerdown", resume, { once: true });
window.addEventListener("keydown", resume, { once: true });
