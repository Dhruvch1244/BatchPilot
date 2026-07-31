BatchPilot
==========

Requirements: Java 17 or newer. Most corporate/work laptops already have
this installed. Check by opening a terminal/command prompt and running:

    java -version

If that fails, install Java from https://adoptium.net (choose the JRE or
JDK for your OS) and try again.

Windows
-------
Double-click BatchPilot.bat.

A window will open - that window IS the BatchPilot server, so keep it open
while you use the app. Your browser will open automatically after a few
seconds, normally at http://localhost:8743 (BatchPilot automatically uses a
different port instead if that one's already taken on your machine - see
"Changing the port" below). To stop BatchPilot, just close that window.

If your company blocks console windows from popping up and you'd rather run
it silently instead, use BatchPilot-Silent.vbs (double-click it) - it starts
BatchPilot with no visible window at all and opens your browser the same
way. Since there's no window to close in that case, use
Stop-BatchPilot.bat to stop it later. (Some locked-down corporate PCs
disable VBScript entirely - if double-clicking the .vbs file does nothing,
use BatchPilot.bat instead.)

macOS / Linux
-------------
Open a terminal in this folder and run:

    ./run.sh

Your browser will open automatically, normally at http://localhost:8743
(a different port instead if that one's already taken - see "Changing the
port" below). Press Ctrl+C in that terminal to stop BatchPilot.

Where your data is stored
--------------------------
BatchPilot keeps everything locally on your own machine - your saved
environments, settings, and search history live under a ".batchpilot"
folder in your home directory. Nothing is sent anywhere except to the SSH
environments you explicitly connect to.

Changing the port
------------------
BatchPilot listens on port 8743 by default, but if that's already taken by
something else on your machine, it automatically finds and uses the next
free port instead - it won't just fail to start. The launcher scripts
already know to look for the actual port and open the right one in your
browser; if the browser doesn't open automatically for any reason, check
the ".batchpilot/port.txt" file in your home directory for the port
actually in use, or look near the top of the server window's output for a
line like "Tomcat started on port <port>".

If you'd rather force a specific port yourself, edit BatchPilot.bat /
run.sh and add --server.port=<some other port> to the "java -jar" line.
