// Builds the chord grid from the shared theory tables and plays a chord on tap.

import { ROOTS, QUALITIES } from "./chords.js";
import { playChord } from "./synth.js";

function buildGrid() {
  const table = document.getElementById("grid");
  const qualities = Object.keys(QUALITIES);

  // Header row: empty corner + one cell per quality.
  const head = document.createElement("tr");
  head.appendChild(document.createElement("th")); // corner
  for (const q of qualities) {
    const th = document.createElement("th");
    th.textContent = q;
    head.appendChild(th);
  }
  table.appendChild(head);

  // One row per root.
  for (const root of ROOTS) {
    const tr = document.createElement("tr");
    const rh = document.createElement("th");
    rh.textContent = root;
    rh.className = "root";
    tr.appendChild(rh);

    for (const q of qualities) {
      const td = document.createElement("td");
      const name = `${root}${q}`;
      td.className = "chord";
      td.dataset.chord = name;
      td.textContent = name;
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function flash(cell) {
  cell.classList.add("active");
  setTimeout(() => cell.classList.remove("active"), 220);
}

function wireEvents() {
  const table = document.getElementById("grid");
  // Event delegation; pointerdown fires instantly and counts as the user
  // gesture that unlocks audio on mobile.
  table.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest("td.chord");
    if (!cell) return;
    e.preventDefault();
    try {
      playChord(cell.dataset.chord);
      flash(cell);
    } catch (err) {
      console.error(err);
    }
  });
}

buildGrid();
wireEvents();
