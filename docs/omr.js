// EXPERIMENTAL optical music recognition.
//
// This is a best-effort toy, NOT a reliable transcriber. It looks for ONE
// staff, detects dark blobs that look like noteheads, and guesses pitches
// assuming treble clef. Real sheet music (chords, beams, multiple voices,
// rhythm) will produce wrong results. For accuracy, upload MIDI instead.

// White-key MIDI numbers C2..C7, used to step diatonically by staff position.
const WHITE = [];
for (let m = 36; m <= 96; m++) {
  if (![1, 3, 6, 8, 10].includes(m % 12)) WHITE.push(m);
}

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    return img;
  } finally {
    // Revoke later; the bitmap is already decoded into `img`.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function toBinary(img, maxW = 1000) {
  const scale = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  // Mean luminance -> threshold; ink (dark) = 1.
  const mask = new Uint8Array(w * h);
  let sum = 0;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const v = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    lum[i] = v; sum += v;
  }
  const thr = (sum / (w * h)) * 0.72;
  for (let i = 0; i < w * h; i++) mask[i] = lum[i] < thr ? 1 : 0;
  return { mask, w, h };
}

// Find a run of 5 roughly-evenly-spaced horizontal lines = a staff.
function findStaff({ mask, w, h }) {
  const rowDark = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) n += mask[y * w + x];
    rowDark[y] = n / w;
  }
  // Candidate line rows: locally dark rows above a fraction of the width.
  const lines = [];
  for (let y = 1; y < h - 1; y++) {
    if (rowDark[y] > 0.35 && rowDark[y] >= rowDark[y - 1] && rowDark[y] >= rowDark[y + 1]) {
      if (!lines.length || y - lines[lines.length - 1] > 3) lines.push(y);
    }
  }
  // Take the first 5 with consistent spacing.
  for (let i = 0; i + 4 < lines.length; i++) {
    const five = lines.slice(i, i + 5);
    const gaps = [];
    for (let k = 1; k < 5; k++) gaps.push(five[k] - five[k - 1]);
    const avg = gaps.reduce((a, b) => a + b) / gaps.length;
    if (avg > 5 && gaps.every((g) => Math.abs(g - avg) < avg * 0.4)) {
      return { lines: five, spacing: avg };
    }
  }
  return null;
}

// Remove thin horizontal staff lines, preserving thicker blobs (noteheads/stems).
function removeStaffLines(bin, staff) {
  const { mask, w } = bin;
  for (const y of staff.lines) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] && !(mask[(y - 2) * w + x] && mask[(y + 2) * w + x])) {
        mask[y * w + x] = 0;
      }
    }
  }
}

// Connected-component blobs (4-neighbour flood fill).
function blobs({ mask, w, h }) {
  const seen = new Uint8Array(w * h);
  const out = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    let minX = w, maxX = 0, minY = h, maxY = 0, area = 0, sx = 0, sy = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      const nb = [p - 1, p + 1, p - w, p + w];
      for (const q of nb) {
        if (q >= 0 && q < w * h && mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    out.push({ minX, maxX, minY, maxY, area, cx: sx / area, cy: sy / area,
               width: maxX - minX + 1, height: maxY - minY + 1 });
  }
  return out;
}

function pitchFromY(cy, staff) {
  const step = staff.spacing / 2;             // one diatonic step = half a gap
  const bottomLine = staff.lines[4];          // E4 in treble clef
  const e4 = WHITE.indexOf(64);
  const idx = e4 + Math.round((bottomLine - cy) / step);
  return WHITE[Math.max(0, Math.min(WHITE.length - 1, idx))];
}

export async function recognize(file) {
  const img = await loadImage(file);
  const bin = toBinary(img);
  const staff = findStaff(bin);
  if (!staff) {
    return { events: [], note: "No staff lines found — is this a clear photo of printed music?" };
  }
  removeStaffLines(bin, staff);

  const sp = staff.spacing;
  // Keep blobs that are roughly notehead-sized and near the staff.
  const top = staff.lines[0] - sp * 4;
  const bot = staff.lines[4] + sp * 4;
  const heads = blobs(bin).filter((b) =>
    b.height > sp * 0.6 && b.height < sp * 2.2 &&
    b.width > sp * 0.6 && b.width < sp * 2.6 &&
    b.area > sp * sp * 0.4 &&
    b.cy > top && b.cy < bot
  ).sort((a, b) => a.cx - b.cx);

  const events = [];
  let t = 0;
  for (const b of heads) {
    events.push({ midi: pitchFromY(b.cy, staff), start: t, duration: 0.45, velocity: 0.85 });
    t += 0.5;
  }
  return {
    events,
    note: `Detected 1 staff and ${heads.length} note-like blob(s). ` +
          `Results are approximate — treble clef assumed, rhythm ignored.`,
  };
}
