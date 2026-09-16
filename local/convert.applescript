on run argv
 set sourcePath to item 1 of argv
 set outputPath to item 2 of argv
 set sourceName to item 3 of argv
 set sourceWordPath to (POSIX file sourcePath) as text
 set outputWordPath to (POSIX file outputPath) as text
 with timeout of 90 seconds
  tell application "Microsoft Word"
   try
    activate
    open file name sourceWordPath add to recent files false
    repeat 50 times
     if exists document sourceName then exit repeat
     delay 0.1
    end repeat
    if not (exists document sourceName) then error "Word hat die temporäre Kopie nicht geöffnet."
    activate object document sourceName
    if name of active document is not sourceName then error "Das aktive Dokument ist nicht die temporäre Kopie. Export abgebrochen."
    set print revisions of document sourceName to true
    set show revisions of document sourceName to true
    set show comments of view of window 1 of document sourceName to true
    set show revisions and comments of view of window 1 of document sourceName to true
    set revisions mode of view of window 1 of document sourceName to balloon revisions
    if name of active document is not sourceName then error "Das aktive Dokument wurde gewechselt. Bitte während der Konvertierung nicht in Word arbeiten."
    save as active document file name outputWordPath file format format PDF
    try
     if name of active document is sourceName then close active document saving no
    end try
   on error errorText number errorNumber
    try
     if exists document sourceName then
      activate object document sourceName
      if name of active document is sourceName then close active document saving no
     end if
    end try
    error errorText number errorNumber
   end try
  end tell
 end timeout
end run
