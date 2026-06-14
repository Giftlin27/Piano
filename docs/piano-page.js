// Live Piano page: a full playable keyboard with selectable voices, plus the
// "organist" inputs (demo / MIDI / typed notes / image) that play back on the
// keyboard with left/right-hand colouring.

import { buildKeyboard, attachComputerKeyboard } from "./keyboard.js";
import { createPlayer } from "./player.js";
import { resume, setVoice, VOICE_NAMES } from "./synth.js";
import { parseMidi } from "./midi.js";
import { DEMO_SONGS, parseText } from "./songs.js";
import { recognize } from "./omr.js";

const kb = buildKeyboard(document.getElementById("keyboard"), {
  low: 21, high: 108, labels: true,   // full 88-key piano
});
attachComputerKeyboard(kb, 60);        // computer keys start at middle C
const player = createPlayer(kb);
const status = document.getElementById("status");

function setStatus(msg) { status.textContent = msg; }

function playEvents(events, label) {
  resume();
  if (!events.length) { setStatus(`${label}: nothing to play.`); return; }
  setStatus(`Playing ${label} — ${events.length} notes…`);
  player.play(events, { onEnd: () => setStatus(`${label}: done.`) });
}

// --- Voice selector ---
const voiceSel = document.getElementById("voice");
for (const name of VOICE_NAMES) {
  const opt = document.createElement("option");
  opt.value = name; opt.textContent = name;
  voiceSel.appendChild(opt);
}
voiceSel.addEventListener("change", () => setVoice(voiceSel.value));

// --- Stop ---
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
  playEvents(DEMO_SONGS[demoSelect.value], demoSelect.value);
});

// --- MIDI upload (replay only enabled once a valid file is loaded) ---
let midiEvents = null;
let midiName = "";
const midiPlayBtn = document.getElementById("midi-play");

document.getElementById("midi-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) { midiEvents = null; midiPlayBtn.disabled = true; return; }
  try {
    midiEvents = parseMidi(await file.arrayBuffer());
    midiName = file.name;
    midiPlayBtn.disabled = midiEvents.length === 0;
    playEvents(midiEvents, midiName);
  } catch (err) {
    setStatus(`Couldn't read MIDI: ${err.message}`);
    midiEvents = null;
    midiPlayBtn.disabled = true;
  }
});
midiPlayBtn.addEventListener("click", () => {
  if (midiEvents && midiEvents.length) playEvents(midiEvents, midiName);
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
    if (events.length) playEvents(events, "scanned image");
    else setStatus(note);
  } catch (err) {
    setStatus(`OMR failed: ${err.message}`);
  }
});

// Unlock audio on first interaction (mobile autoplay policy).
window.addEventListener("pointerdown", resume, { once: true });
window.addEventListener("keydown", resume, { once: true });
