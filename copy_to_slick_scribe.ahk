#Requires AutoHotkey v2.0
CoordMode("Mouse", "Screen")  ; Use screen coordinates for MouseMove

^Enter::  ; Ctrl+Enter hotkey for pasting data with verification
{
    global originalClipboard
    originalClipboard := A_Clipboard  ; Save original clipboard content
    clipboardText := A_Clipboard

    ; Use a regex pattern with named capture groups for the expected format:
    ; Time | Annotation | Comment | Link
    if RegExMatch(clipboardText, "^(?<time>\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))\s*\|\s*(?<annotation>.*?)\s*\|\s*(?<comment>.*?)\s*\|\s*(?<link>.*)$", &match)
    {
        ; Save current mouse position to return later
        MouseGetPos(&startX, &startY)
        
        ; --- Set the Time Field ---
        MouseMove(-167, 0, 0, "R")    ; Move relative to current position to the Time field
        attempt := 0
        success := false
        while (attempt < 3 && !success)
        {
            attempt += 1
            ; Perform four single clicks to activate the time field
            Click()
            Sleep(200)
            Click()
            Sleep(200)
            Click()
            Sleep(200)
            Click()
            Sleep(500)
            
            Send("^a")
            Sleep(150)
            Send("{Delete}")
            Sleep(150)
            SendInput(match.time)
            Sleep(300)
            
            Send("^a")
            Sleep(150)
            Send("^c")
            Sleep(200)
            currentTime := Trim(A_Clipboard)
            if (currentTime = match.time)
            {
                Send("{Enter}")
                success := true
            }
            else if (attempt < 3)
            {
                Sleep(500)
            }
        }
        if (!success)
        {
            MsgBox("Failed to set time after 3 attempts.")
        }
        
        ; --- Paste the Annotation ---
        MouseMove(167, 0, 0, "R")     ; Move to the Annotation field
        Click()
        Sleep(100)
        SendInput("{Raw}" match.annotation)
        Sleep(100)
        
        ; --- Paste the Comment ---
        Send("{Tab}")                ; Move to the Comment field
        Sleep(100)
        SendInput("{Raw}" match.comment)
        Sleep(100)
        
        ; --- Set the Link (if provided) ---
        if (Trim(match.link) != "")  ; Only process if link is not empty
        {
            ; From the starting mouse position, move 30 pixels to the left and double-click to open the popup.
            MouseMove(startX - 30, startY, 0)  ; Use absolute coordinates: 30 pixels left of startX
            Sleep(100)
            Click("left", 2)
            Sleep(100)
            
            ; Wait for the popup window titled "Annotation Metadata" (up to 3 seconds)
            if !WinWaitActive("Annotation Metadata", "", 3)
            {
                MsgBox("Popup did not appear.")
            }
            else
            {
                ; Retrieve the popup's position.
                winX := 0
                winY := 0
                winWidth := 0
                winHeight := 0
                WinGetPos(&winX, &winY, &winWidth, &winHeight, "Annotation Metadata")
                ; Move to the text field: (122,42) relative to the popup.
                MouseMove(winX + 122, winY + 42, 0)
                Sleep(100)
                Click  ; Click to focus the text field
                Sleep(100)
                SendInput(match.link)
                Sleep(100)
                ; Now move to the OK button: (355,74) relative to the popup.
                MouseMove(winX + 355, winY + 74, 0)
                Sleep(100)
                Click
                Sleep(100)
            }
        }
        
        ; Return mouse to original position
        MouseMove(startX, startY, 0)
        
        A_Clipboard := originalClipboard
    }
    else
    {
        MsgBox("Clipboard content is not in the correct format.`nUse: 9:45:15 AM | Annotation | Comment | Link")
    }
}

^!Enter::  ; Ctrl+Alt+Enter hotkey to clear all fields
{
    global originalClipboard
    MouseGetPos(&startX, &startY)
    
    MouseMove(-167, 0, 0, "R")
    Click("left", 2)  ; Double-click to activate the Time field
    Sleep(300)
    Send("^a")
    Sleep(50)
    Send("{Delete}")
    Sleep(100)
    
    MouseMove(167, 0, 0, "R")
    Click()
    Sleep(100)
    Send("^a")
    Sleep(50)
    Send("{Delete}")
    
    Send("{Tab}")
    Sleep(100)
    Send("^a")
    Sleep(50)
    Send("{Delete}")
    
    MouseMove(startX, startY, 0)
    A_Clipboard := originalClipboard
}
