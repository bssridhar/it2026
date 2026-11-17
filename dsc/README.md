# DSC Register

Open `index.html` (keep the `shared` folder of the tool kit next to this folder).

**Where the register is kept.** In Chrome or Edge, click "Choose the folder of the register" and pick a folder – for
example a folder on the office server that everyone can reach. The register is saved there as `dsc_register.json`
after every change; the tool remembers the folder (the browser asks for permission once per visit – "Reconnect").
In other browsers the register is kept in the browser; use "Save a copy (JSON)" / "Open a JSON file".

**One person edits at a time.** While the register is open, the tool keeps a small file `dsc_register.lock` in the
folder with the user's name, refreshed every 30 seconds. Anyone else who opens the tool sees "The register is open
with <name> (since …, last active …)" and gets it read only, refreshed every 30 seconds. "Take over editing" is
there for when the other person has left it open; the other screen then turns read only. A lock not refreshed for
2 minutes (a computer switched off, a page closed abruptly) is treated as released. If the file is changed outside
the tool after it was opened, the tool does not overwrite it but asks which version to keep. The first save of each
day keeps a copy of the earlier version in `backup/`.

**Contents.** Company / client, DSC holder, valid till, purpose (GST, MCA, Income Tax, TDS, EPFO, ESIC, ICEGATE, DGFT,
bank, e-tender, other), mobile, email, PAN, DIN, issuer, class / type, token serial, token with (office / client),
movements in and out with an acknowledgment (PDF), remarks. **Token PINs and passwords are not stored.**

Import from the existing Excel list (headings like Sl No / Company / Name / Valid Till / Purpose; other columns such
as Mobile, Email, PAN are picked up if present); export to Excel; renewal reminder text for the client.
