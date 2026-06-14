// Organist page: feed in music (MIDI / demo / text / image) and watch the
// keyboard play it back with sound.

import { buildKeyboard } from "./keyboard.js";
import { createPlayer } from "./player.js";
import { resume } from "./synth.js";
import { parseMidi } from "./midi.js";
import { DEMO_SONGS, parseText } from "./songs.js";
import { recognize } from "./omr.js";

const kb = buildKeyboard(document.getElementById("keyboard"), { low: 36, high: 96 });
const player = createPlayer(kb);
const status = document.getElementById("status");

function setStatus(msg) { status.textContent = msg; }

function playEvents(events, label) {
  resume();
  if (!events.length) { setStatus(`${label}: nothing to play.`); return; }
  setStatus(`Playing ${label} — ${events.length} notes…`);
  player.play(events, { onEnd: () => setStatus(`${label}: done.`) });
}

document.getElementById("stop").addEventListener("click", () => {
  player.stop();
  setStatus("Stopped.");
});

// --- Demo songs ---
const demoSelect = document.getElementById("demo-select");
for (const name of Object.keys(DEMO_SONGS)) {
  const opt = document.createElement("option");
  opt.value = name; opt.textContent = name;
  demoSelect.appendChild(opt);
}
document.getElementById("demo-play").addEventListener("click", () => {
  const name = demoSelect.value;
  playEvents(DEMO_SONGS[name], name);
});

// --- MIDI upload ---
document.getElementById("midi-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    playEvents(parseMidi(buf), file.name);
  } catch (err) {
    setStatus(`Couldn't read MIDI: ${err.message}`);
  }
});

// --- Text notation ---
document.getElementById("text-play").addEventListener("click", () => {
  const text = document.getElementById("text-input").value;
  if (!text.trim()) { setStatus("Type some notes first, e.g. C4 E4 G4."); return; }
  playEvents(parseText(text), "your notes");
});

// --- Experimental OMR ---
document.getElementById("image-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setStatus("Scanning image… (experimental, please wait)");
  try {
    const { events, note } = await recognize(file);
    setStatus(note);
    if (events.length) {
      setStatus(note + " Playing…");
      player.play(events, { onEnd: () => setStatus(note + " Done.") });
    }
  } catch (err) {
    setStatus(`OMR failed: ${err.message}`);
  }
});

window.addEventListener("pointerdown", resume, { once: true });
