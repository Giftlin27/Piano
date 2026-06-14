# 🎹 Piano Chords

Tap a chord, hear it. Two front-ends, one chord engine:

- **Web app** (`docs/`) — runs in any browser on any device, no install.
  Synthesizes sound with the Web Audio API. **This is what's deployed to
  GitHub Pages.**
- **Excel app** (`*.py`, `vba_glue.bas`) — click a cell in an Excel grid to
  play the chord locally via a small Python backend.

## 🌐 Use it on any device (web)

Once Pages is enabled (see **Deployment** below) the app is live at:

```
https://giftlin27.github.io/Piano/
```

Open it on a phone, tablet, or computer and tap any chord. To run it locally:

```powershell
py -m http.server -d docs 8000   # then open http://localhost:8000
```

## Deployment (GitHub Pages)

A workflow at `.github/workflows/deploy-pages.yml` publishes `docs/` on every
push to `main`. It **enables Pages automatically** (`enablement: true`), so no
manual setup is normally needed — just push and watch the Actions tab.

If your account/org blocks the workflow from enabling Pages, do it once by
hand: **Settings → Pages → Build and deployment → Source → “GitHub Actions”**,
then re-run the workflow. The Pages URL appears on the Actions run and in
Settings → Pages.

---

## 🖥️ Excel version (local)

Click a cell in an Excel grid and hear the chord. Excel is the UI; a small
Python program is the sound engine.

## How it works

```
  Excel (.xlsm)                         Python backend
  ┌────────────────────┐   Shell()     ┌──────────────────────┐
  │ chord grid          │  ──────────▶  │ play_chord.py "Cmaj" │
  │ Worksheet_Selection │   cell text   │   synth.py  (NumPy)  │
  │   Change (VBA)      │               │   winsound (WAV)     │
  └────────────────────┘               └──────────┬───────────┘
                                              🔊 plays the chord
```

1. The grid has root notes (C, C#, D …) down the side and chord qualities
   (maj, min, 7, maj7, min7, dim, aug, sus4) across the top. Each cell holds a
   chord name like `Cmaj`.
2. When you select a cell, a VBA `Worksheet_SelectionChange` event reads the
   chord name and launches `pythonw play_chord.py "<name>"`.
3. Python synthesizes the chord from sine waves with an envelope and plays it
   instantly via Windows' built-in `winsound` — no audio files, no extra
   audio libraries.

## Setup

```powershell
pip install -r requirements.txt   # numpy + xlwings
python build_workbook.py          # creates PianoChords.xlsm
```

Then open **PianoChords.xlsm**, enable macros, and click any chord cell.

> **Python must be launchable** — the VBA calls `pyw` (the windowed Python
> launcher that ships with python.org installers). Check with `py --version`.
> If you don't have the launcher, change `pyw` to `pythonw` (or a full path to
> `pythonw.exe`) in `vba_glue.bas`. Note: the Microsoft Store "python.exe"
> shim does **not** work when shelled out to — use the real interpreter or the
> `py`/`pyw` launcher.

### If the VBA didn't inject automatically

`build_workbook.py` tries to write the VBA for you, which needs:

**Excel → File → Options → Trust Center → Trust Center Settings → Macro
Settings → ✅ Trust access to the VBA project object model**

Enable it and re-run the script, or paste `vba_glue.bas` into the `Chords`
sheet's code window by hand (Alt+F11 → double-click `Chords`).

## Try the backend without Excel

```powershell
python play_chord.py "Gmaj7"
python -c "from synth import play; play('Amin7')"
```

## Files

**Web app (deployed to Pages)**

| File              | Role                                                      |
|-------------------|----------------------------------------------------------|
| `docs/index.html` | Page shell                                                |
| `docs/style.css`  | Responsive dark UI                                        |
| `docs/chords.js`  | Note frequencies + chord intervals (port of `chords.py`) |
| `docs/synth.js`   | Web Audio synthesis (port of `synth.py`)                 |
| `docs/app.js`     | Builds the grid, plays a chord on tap                    |

**Excel app (local)**

| File               | Role                                                        |
|--------------------|-------------------------------------------------------------|
| `chords.py`        | Note frequencies + chord interval definitions (pure data)   |
| `synth.py`         | Sine-wave synthesis → in-memory WAV → playback              |
| `play_chord.py`    | Tiny CLI entry point the VBA shells out to                   |
| `build_workbook.py`| Generates `PianoChords.xlsm` and injects the VBA            |
| `vba_glue.bas`     | The `Worksheet_SelectionChange` handler (source of truth)   |

## Customising

Add or change chords in `chords.py` (`QUALITIES` / `ROOTS`) and re-run
`python build_workbook.py`. Tweak tone/length in `synth.py` (`DURATION`,
harmonics, envelope decay).
