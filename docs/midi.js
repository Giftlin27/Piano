// Minimal Standard MIDI File parser -> note events in seconds.
// Handles format 0/1, running status, tempo changes, note-on/off (vel 0 = off).
// Returns [{ midi, start, duration, velocity }] sorted by start time.

class Reader {
  constructor(view) { this.v = view; this.p = 0; }
  u8() { return this.v.getUint8(this.p++); }
  u16() { const x = this.v.getUint16(this.p); this.p += 2; return x; }
  u32() { const x = this.v.getUint32(this.p); this.p += 4; return x; }
  str(n) { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8()); return s; }
  // MIDI variable-length quantity.
  vlq() {
    let val = 0, b;
    do { b = this.u8(); val = (val << 7) | (b & 0x7f); } while (b & 0x80);
    return val;
  }
}

export function parseMidi(arrayBuffer) {
  const r = new Reader(new DataView(arrayBuffer));
  if (r.str(4) !== "MThd") throw new Error("Not a MIDI file");
  r.u32(); // header length
  r.u16(); // format
  const ntrks = r.u16();
  const division = r.u16();
  if (division & 0x8000) throw new Error("SMPTE time division not supported");
  const ticksPerQuarter = division;

  // Collect (absolute tick) events across all tracks.
  const tempos = [{ tick: 0, usPerQuarter: 500000 }]; // default 120 BPM
  const raw = []; // { tick, type:'on'|'off', midi, vel }

  for (let t = 0; t < ntrks; t++) {
    if (r.str(4) !== "MTrk") break;
    const len = r.u32();
    const end = r.p + len;
    let tick = 0;
    let status = 0;

    while (r.p < end) {
      tick += r.vlq();
      let b = r.u8();
      if (b & 0x80) { status = b; } else { r.p--; } // running status
      const cmd = status & 0xf0;

      if (status === 0xff) {            // meta
        const meta = r.u8();
        const mlen = r.vlq();
        if (meta === 0x51) {            // set tempo
          const us = (r.u8() << 16) | (r.u8() << 8) | r.u8();
          tempos.push({ tick, usPerQuarter: us });
        } else {
          r.p += mlen;
        }
      } else if (status === 0xf0 || status === 0xf7) { // sysex
        r.p += r.vlq();
      } else if (cmd === 0x90 || cmd === 0x80) {       // note on/off
        const midi = r.u8();
        const vel = r.u8();
        if (cmd === 0x90 && vel > 0) raw.push({ tick, type: "on", midi, vel });
        else raw.push({ tick, type: "off", midi, vel: 0 });
      } else if (cmd === 0xc0 || cmd === 0xd0) {       // 1-byte messages
        r.u8();
      } else {                                          // 2-byte messages
        r.u8(); r.u8();
      }
    }
    r.p = end;
  }

  tempos.sort((a, b) => a.tick - b.tick);
  raw.sort((a, b) => a.tick - b.tick);

  // Tick -> seconds using the tempo map.
  const tickToSec = (tick) => {
    let sec = 0, last = 0, us = 500000;
    for (const tp of tempos) {
      if (tp.tick > tick) break;
      sec += ((tp.tick - last) / ticksPerQuarter) * (us / 1e6);
      last = tp.tick;
      us = tp.usPerQuarter;
    }
    sec += ((tick - last) / ticksPerQuarter) * (us / 1e6);
    return sec;
  };

  // Pair note-ons with the next matching note-off.
  const open = new Map(); // midi -> tick
  const events = [];
  for (const e of raw) {
    if (e.type === "on") {
      open.set(e.midi, { tick: e.tick, vel: e.vel });
    } else {
      const o = open.get(e.midi);
      if (o) {
        open.delete(e.midi);
        const start = tickToSec(o.tick);
        events.push({
          midi: e.midi,
          start,
          duration: Math.max(tickToSec(e.tick) - start, 0.08),
          velocity: Math.min(o.vel / 127, 1),
        });
      }
    }
  }
  events.sort((a, b) => a.start - b.start);
  return events;
}
