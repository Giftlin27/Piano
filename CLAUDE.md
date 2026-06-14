# CLAUDE.md

Guidance for working in this repo.

## What this project is

A piano chord player with **two front-ends sharing one chord model**:

- **Web app** (`docs/`) — static site deployed to GitHub Pages; synthesizes
  sound in-browser with the Web Audio API. Works on any device.
- **Excel app** (Python) — clicking a cell fires VBA that shells out to Python,
  which synthesizes the chord and plays it via Windows' `winsound`.

The JS files in `docs/` are deliberate ports of the Python modules. **When you
change chord theory or synthesis, update both sides** (`chords.py` ⇔
`docs/chords.js`, `synth.py` ⇔ `docs/synth.js`) so the two front-ends stay
identical.

```
Excel .xlsm  --Worksheet_SelectionChange (VBA)-->  pyw play_chord.py "Cmaj"
                                                        |
                                            synth.py (NumPy) -> WAV -> winsound 🔊
```

## Architecture / data flow

1. `chords.py` — pure music theory: pitch-class offsets, MIDI/frequency math,
   chord interval tables (`ROOTS`, `QUALITIES`), and `parse_chord` /
   `chord_frequencies`. No audio, no I/O — safe to unit-test anywhere.
2. `synth.py` — `render_wav(name)` builds an in-memory 16-bit PCM WAV from
   summed sine partials + an attack/decay envelope; `play(name)` plays it
   (blocking, so `pyw` stays alive until the sound finishes).
3. `play_chord.py` — tiny CLI the VBA invokes (`pyw play_chord.py "Cmaj"`).
   Kept minimal for fast process start-up; logs errors to `play_chord.log`
   instead of raising (no console under `pyw`).
4. `build_workbook.py` — generates `PianoChords.xlsm` via xlwings: writes the
   grid, defines the `ChordGrid` named range, and injects the VBA handler.
5. `vba_glue.bas` — **source of truth** for the `Worksheet_SelectionChange`
   handler. `build_workbook.py` reads it at build time; it's also the file to
   paste manually if auto-injection is blocked.

`chords.py` is imported by both `synth.py` and `build_workbook.py` so the grid
and the player always agree on chord names.

## Commands

```powershell
# Web app
py -m http.server -d docs 8000           # serve locally at localhost:8000

# Excel app
py -m pip install -r requirements.txt    # numpy + xlwings (+ pytest)
py build_workbook.py                      # (re)generate PianoChords.xlsm
py play_chord.py "Gmaj7"                  # play a chord without Excel
py -m pytest -q                           # run theory-layer tests
```

## Deployment

`.github/workflows/deploy-pages.yml` publishes `docs/` to GitHub Pages on push
to `main`. One-time setup: repo Settings → Pages → Source → "GitHub Actions".
Live URL: https://giftlin27.github.io/Piano/ . No build step — the workflow
just uploads `docs/` as the Pages artifact.

## Environment notes (important)

- **Use the `py` / `pyw` launcher, not `python`.** On this machine bare
  `python`/`pythonw` resolve to the Microsoft Store shim, which fails when
  shelled out to. The real interpreter is Python 3.14 under
  `%LOCALAPPDATA%\Python\pythoncore-3.14-64`. The VBA therefore calls `pyw`.
- **VBA auto-injection needs a Trust Center setting:** Excel → Options → Trust
  Center → Macro Settings → "Trust access to the VBA project object model".
  Without it, `build_workbook.py` still produces the workbook but prints
  instructions to paste `vba_glue.bas` by hand (Alt+F11 → `Chords` sheet).
- Building requires Excel installed (xlwings drives it over COM).
- `PianoChords.xlsm`, `*.wav`, and `play_chord.log` are generated and
  gitignored — regenerate, don't commit them.

## Conventions

- Chord names are `root + quality`, e.g. `Cmaj`, `C#min7`, `Gsus4`. Roots use
  sharps only. To add chords, edit `ROOTS` / `QUALITIES` in `chords.py` and
  re-run `build_workbook.py` — never hard-code chord lists elsewhere.
- Tone/length lives in `synth.py` (`DURATION`, harmonics, envelope decay).
- Keep `play_chord.py` lean; it runs once per click and start-up time is the
  dominant latency.
