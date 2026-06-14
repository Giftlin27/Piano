' Worksheet_SelectionChange handler injected into the chord sheet by
' build_workbook.py. If automatic injection fails (VBA project access not
' trusted), open the workbook, press Alt+F11, double-click the chord sheet in
' the Project Explorer, and paste this code into its code window.
'
' It fires whenever the selection changes; if the selected cell is inside the
' ChordGrid named range it shells out to the Python backend to play the chord.

Private Sub Worksheet_SelectionChange(ByVal Target As Range)
    On Error Resume Next
    If Intersect(Target, Me.Range("ChordGrid")) Is Nothing Then Exit Sub

    Dim chord As String
    chord = Trim(CStr(Target.Cells(1, 1).Value))
    If Len(chord) = 0 Then Exit Sub

    ' "pyw" is the windowed Python launcher (no console flash). If you don't
    ' have the py launcher, change this to "pythonw" or a full path to it.
    Shell "pyw """ & ThisWorkbook.Path & "\play_chord.py"" """ & chord & """", vbHide
End Sub
