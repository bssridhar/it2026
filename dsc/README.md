# DSC Register

Open `index.html` (keep the `shared` folder of the tool kit next to this folder).

**Where the register is kept.** In the tool kit's `database` folder (next to `shared`), as `dsc_register.json` – the
same folder that the other tools with a shared register use. In Chrome or Edge, click "Connect the database folder"
(here or at the bottom of the home page) and choose the tool kit folder; the `database` folder is created there. The
register is saved after every change; the tool remembers the folder (the browser asks for permission once per visit –
"Reconnect"). A folder chosen in the earlier version is still used until the database folder is connected – open the
register, then connect the database folder: the register on screen is put into it.
In other browsers the register is kept in the browser; use "Save a copy (JSON)" / "Open a JSON file".

**Save / Save and close.** Every change is saved at once (in the folder, or in the browser if no folder is chosen); the
status next to the buttons shows when it was last saved. "Save and close" saves, releases the register for others and
shows "Open again". Without a folder, "Save" offers to choose a folder or downloads a copy (JSON).

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

**Key tag colour and location.** Each DSC has a key tag colour (shown as a coloured label and a coloured stripe at the
start of its row) and the place where the token is kept. "Settings" maintains the colours (name and colour) and the
locations – add, rename (the DSCs using it change too) or delete (cleared from the DSCs). The lists are saved in the
register file, so everyone sees the same choices. Filters by location and key tag; recording a token "In" asks where it
is kept. Defaults: Pink, Orange, White, Green, Blue; BSS Cabin, Box 1, Box 2.

Import from the existing Excel list (headings like Sl No / Company / Name / Valid Till / Purpose / Location / Key Tag Colour; other columns such
as Mobile, Email, PAN are picked up if present); export to Excel; renewal reminder text for the client.

**Inactive clients.** A DSC that the client will not renew (account closed, not renewing, left the office) can be marked
**inactive** – "Mark inactive" on an expired row, or Status in Edit. It stays in the register under the filter
"Inactive clients", but is not counted or shown in the expired / renewal lists and has no reminder. "Reactivate" brings
it back. In the Excel export the Status column shows "Inactive – <reason>"; an import reads it back.
