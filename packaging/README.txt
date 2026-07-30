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
seconds at http://localhost:8743. To stop BatchPilot, just close that
window.

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

Your browser will open automatically at http://localhost:8743. Press
Ctrl+C in that terminal to stop BatchPilot.

Where your data is stored
--------------------------
BatchPilot keeps everything locally on your own machine - your saved
environments, settings, and search history live under a ".batchpilot"
folder in your home directory. Nothing is sent anywhere except to the SSH
environments you explicitly connect to.

Changing the port
------------------
BatchPilot listens on port 8743 by default. If that's already in use on
your machine, edit BatchPilot.bat / run.sh and add
--server.port=<some other port> to the "java -jar" line, then open that
port instead in your browser.
