"""Generate PianoChords.xlsm: the clickable chord grid wired to the backend.

Run once (or whenever you change the chord set):

    python build_workbook.py

Layout produced:

    Row 3 : quality headers   (maj, min, 7, maj7, ...)
    Col A : root notes        (C, C#, D, ...)
    Grid  : chord names       (Cmaj, Cmin, ...) -> named range "ChordGrid"

The VBA Worksheet_SelectionChange handler (see vba_glue.bas) is injected
automatically. That requires Excel Trust Center ->
"Trust access to the VBA project object model" to be enabled; if it isn't,
the script prints instructions for pasting the handler by hand.
"""

from __future__ import annotations

from pathlib import Path

import xlwings as xw

from chords import QUALITIES, ROOTS

OUTPUT = Path(__file__).with_name("PianoChords.xlsm")
GRID_TOP = 4          # first data row (1-based)
GRID_LEFT = 2         # first data column (B)
GLUE = Path(__file__).with_name("vba_glue.bas")


def _vba_body() -> str:
    """The handler source with comment lines stripped (Excel keeps the rest)."""
    lines = GLUE.read_text(encoding="utf-8").splitlines()
    body = [ln for ln in lines if not ln.lstrip().startswith("'")]
    return "\n".join(body).strip()


def _inject_vba(book: xw.Book, sheet: xw.Sheet) -> bool:
    """Add the SelectionChange handler to the sheet's code module."""
    try:
        code_name = sheet.api.CodeName
        module = book.api.VBProject.VBComponents(code_name).CodeModule
        module.AddFromString(_vba_body())
        return True
    except Exception:  # noqa: BLE001 - usually "programmatic access not trusted"
        return False


def build() -> None:
    app = xw.App(visible=False, add_book=False)
    try:
        book = app.books.add()
        sheet = book.sheets[0]
        sheet.name = "Chords"

        sheet["A1"].value = "Piano Chords  -  click any cell to play"
        sheet["A1"].font.bold = True
        sheet["A1"].font.size = 14

        # Quality headers across the top of the grid.
        for c, quality in enumerate(QUALITIES):
            cell = sheet.cells(GRID_TOP - 1, GRID_LEFT + c)
            cell.value = quality
            cell.font.bold = True

        # Root labels down the side + the chord names in the grid body.
        for r, root in enumerate(ROOTS):
            sheet.cells(GRID_TOP + r, GRID_LEFT - 1).value = root
            sheet.cells(GRID_TOP + r, GRID_LEFT - 1).font.bold = True
            for c, quality in enumerate(QUALITIES):
                sheet.cells(GRID_TOP + r, GRID_LEFT + c).value = f"{root}{quality}"

        # Name the data body so the VBA can test membership cheaply.
        top_left = sheet.cells(GRID_TOP, GRID_LEFT)
        bottom_right = sheet.cells(GRID_TOP + len(ROOTS) - 1, GRID_LEFT + len(QUALITIES) - 1)
        grid = sheet.range(top_left, bottom_right)
        grid.api.HorizontalAlignment = -4108  # xlCenter
        book.names.add("ChordGrid", refers_to=f"=Chords!{grid.address}")

        sheet.autofit()

        injected = _inject_vba(book, sheet)

        book.save(str(OUTPUT))
        book.close()
    finally:
        app.quit()

    print(f"Created {OUTPUT.name}")
    if injected:
        print("VBA handler injected. Open it, enable macros, and click a chord.")
    else:
        print(
            "\nCould not inject VBA automatically.\n"
            "Enable Excel > File > Options > Trust Center > Trust Center Settings\n"
            "  > Macro Settings > 'Trust access to the VBA project object model',\n"
            "then re-run this script -- or paste vba_glue.bas into the Chords\n"
            "sheet's code window manually (Alt+F11)."
        )


if __name__ == "__main__":
    build()
