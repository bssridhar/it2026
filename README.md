# Practice tool kit

Browser-based tools that fill the firm's standard formats from one set of inputs.
**Double-click `index.html` in this folder** to open the home page and pick a tool; each tool has an
"All tools" link back to it. Nothing is uploaded anywhere – everything runs in the browser.

**Copying the kit:** keep the whole folder together. Every tool uses the common code in `shared/`, so a tool's folder
copied on its own will not work (it shows a red "Part of the tool kit is missing" message). Copy or unzip the complete
folder – `index.html`, `home-config.js`, `shared/` and the tool folders – to the same place.

| Folder | Tool |
|---|---|
| `llp-docs/` | LLP Registration Tool Kit: Form 9, consent letter, subscription sheet, NOC, LLP Agreement, data sheet, print set |
| `company-docs/` | Company Registration Tool Kit (Private Limited and OPC): NOC, data sheet for SPICe+ (e-MoA / e-AoA) |
| `partnership-docs/` | Partnership Deed: deed, NOC for the place of business, data sheet, checklist |
| `networth/` | Net Worth Certificate (visa): Excel import, locked conversion rate, draft PDF with DRAFT watermark, final PDF and Word |
| `cii/` | Capital Gains Calculation: CII table, gain with / without indexation, tax, planning options (house, bonds, both) and time limits, ITA 1961 and 2025 sections |
| `taxcalc/` | Income Tax Calculator, tax year 2026-27, new regime: slab-wise working, rebate, surcharge, cess |
| `tds/` | TDS rate chart (section 393, Income-tax Act, 2025) and calculator, with the section and Sl. No. to select on the portal |
| `huf/` | HUF Formation: affidavit (stamp paper) and PAN data sheet for the HUF |
| `voucher/` | Payment Voucher: PDF in the voucher-book format, Cash / Cheque / UPI, numbering, register |
| `trust/` | Trust Formation: deed, NOC, resolution, PAN and Form 104 data sheets, formalities checklist |
| `pfesi/` | EPF and ESI monthly returns: ECR file, ESIC upload file (.xls), registers, summary and reconciliation |
| `26as-ais-tis/` | Form 26AS · AIS · TIS Consolidator: income consolidation workbook (Excel) for the computation of total income, TDS credit, review points |
| `roc/` | ROC Compliance: appointment of directors, up to 5 at a time (private company) – client checklist, procedure and due dates, notices, resolutions, DIR-2, DIR-8, MBP-1, appointment letter, DIR-12 data sheet, register entry |
| `depn/` | Depreciation under Schedule II, Companies Act, 2013: single-asset rate and pro rata working, life-time schedule, fixed asset register (Excel import) with audit checks, PPE note, disclosure |
| `gst2b/` | GSTR-2B Analyser: reads the GSTR-2B Excel, sorts ITC into eligible / blocked 17(5) / insurance-motor / POS / RCM / others with reasons, amendments, GSTR-3B figures, Excel working |
| `gst9/` | GSTR-9 / 9C Working: reads GSTR-1 and GSTR-3B PDFs (1 to 12 months) – GSTR Recon sheet with formulas, month-wise data, GSTR-9 draft, books-vs-returns summary, filing dates, checks |
| `dsc/` | DSC Register: validity, purpose, token custody with acknowledgment, reminders; JSON register in a chosen (shared) folder with a lock against simultaneous editing |
| `procs/` | Checklists and Procedures: client checklists, procedures and links by category (Income-tax, GST, ROC, General), copy into email with formatting, archive with category tabs |
| `shared/` | Code used by the tools – keep it next to the tool folders |

## Home page settings – `home-config.js`

Your own changes (firm name, notices, hidden tools) go in `my-settings.js` (see "Updating the tool kit"); `home-config.js` is replaced by every update.


Open `home-config.js` in Notepad (or any text editor) to change:

* **`firmName` and `tagline`** – shown at the top of the home page
* **`ticker`** – the notices that scroll across the top (internal notices, what's new, reminders);
  use `[]` to hide the ticker
* **`categories`** – the headings tools are grouped under, in order
* **`tools`** – one entry per tool: title, category, path to its `index.html`, a one-line description,
  `status` (`"available"` or `"planned"` for "Coming soon") and `added` (date; tools added in the last
  30 days show a "New" badge)

To add a new tool: put it in its own folder next to `llp-docs`, then copy one entry in `tools`, change the
values and set `status` to `"available"`.

The home page also has a search box (press `/` to jump to it) and a "Recently used" row that remembers the
last three tools opened in that browser.

Each tool's own README explains its inputs, checks and templates.

## Calculator

Every tool has a desk calculator (`shared/calc.js`): click the flashing **Calculator** box at the bottom right
of the page. It has GT, memory (M+, M−, MRC), %, √, 00, a tape, and "Use in field" to put the figure into the
field last clicked. New tools must include `<script src="../shared/calc.js"></script>` before `</body>`.

## Updating the tool kit

1. Save the new zip file (e.g. `Practice_tool_kit_v28.zip`).
2. Double-click **`Update tool kit.bat`** in the tool kit folder and choose the zip (or drop the zip on the `.bat`).
   It shows the version installed and the version in the zip, warns if someone has a register open for editing,
   backs up the `database` folder to `backups\database_<date>.zip` (the latest 20 are kept), copies the new files
   over the tool kit and shows the version now installed.
3. Ask everyone to close and reopen the tool kit pages (or press Ctrl+F5).

The update never touches `database`, `backups` or `my-settings.js`. The version and "What's new" are shown at the
bottom of the home page (`version.js`). The `.bat` needs Windows 10 / 11 (PowerShell).

**Your own settings – `my-settings.js`.** The firm name, the line under it, your own notices for the ticker and the
tools to hide go in `my-settings.js` (made from `my-settings.sample.js` at the first update; edit it in Notepad).
Updates replace `home-config.js` but never `my-settings.js`.

## Tool kit server – using the tool kit on the office LAN (recommended)

The main computer runs a small server (Windows PowerShell – nothing to install); everyone opens the tool kit in the
browser at its address, and the shared registers (DSC Register, Checklists and Procedures) are kept by the server in
one data folder. No folder has to be connected or allowed on any computer.

1. **Data folder** – in `kit-config.json` (made from `kit-config.sample.json` at the first start; edit in Notepad):
   `{ "port": 8080, "dataFolder": "database" }`. `dataFolder` may be a full path, e.g. `"D:\\OfficeData\\Toolkit"`
   (write each `\` twice); a plain name is a folder inside the tool kit folder. Updates never replace this file.
2. **Once, on the main computer** – right-click **`Set up tool kit server (run as administrator).bat`** → *Run as
   administrator*. It allows the other computers to connect (URL reservation and a Windows firewall rule for the port).
3. **Start** – double-click **`Start tool kit server.bat`**. The window shows the address, e.g.
   `http://BSS-SERVER:8080/`. Keep the window open (minimised); closing it stops the server. To start it with Windows,
   put a shortcut to the `.bat` in the Startup folder (Windows key + R → `shell:startup`).
4. **On every computer** – open that address in Chrome / Edge and bookmark it. Use the bookmark instead of opening
   `index.html` from the folder. The bottom of the home page shows "on the tool kit server …" and the data folder.

Data entered earlier "in this browser only" is brought in with **Open a JSON file** (DSC) / **Import a file**
(Procedures) from the copies saved with "Save a copy (JSON)" / "Export a copy".
Pages opened through the server cannot use the browser's "save into the opened file" (it needs a secure https
address) – Save case file downloads a copy as before; copying for email works.

## Database folder – `database`

Without the tool kit server (the tool kit opened from the folder), the tools that keep a register shared by the whole team – **DSC Register** (`dsc_register.json`) and **Checklists and
Procedures** (`procedures_library.json`) – keep it in the `database` folder of the tool kit, next to `shared`
(`shared/db.js`). Connect it once on each computer, in Chrome or Edge: click **Connect** at the bottom of the home page
(or in the tool) and choose the **tool kit folder** – the `database` folder is created there. The browser may ask
"Allow" once per visit.

- Only one person can edit a register at a time; the others see it read only, with the name of the person editing.
- The first save of each day keeps the previous version in `database/backup`.
- The `database` folder holds client data: it is not part of the zip files of the tool kit and is never committed to
  the code repository. When updating the tool kit, copy the new files over the old ones – do not delete the old
  folder – so that `database` stays. Keep a periodic copy of it elsewhere, and limit access to the folder to staff.
- Use the tool kit from a shared office folder (server / NAS) so that everyone uses the same `database`. Cloud-sync
  folders (OneDrive, Google Drive) may create "conflicted copies" if two people save within the sync delay.

## Case files – Save and Save as

Every tool saves its work as a case file (`.json`) on this computer (`shared/casefile.js`). In Chrome and Edge:

- **Open case file** opens the file with the browser's file picker, and its name is shown next to the buttons.
- **Save case file** writes back into that same file – no new copy in Downloads. With no file open, it asks where
  to save the first time and then keeps saving into that file. The browser may ask once for permission to save
  changes to the file.
- **Save as…** saves into a new file (choose the name and folder) and continues with that file.
- The ✕ next to the file name, and **New / Clear**, forget the file, so the next Save asks for a new file.

The tool remembers the file in use for the next visit. In Firefox and Safari, Save downloads a copy as before.
New tools load `<script src="../shared/casefile.js"></script>` before `calc.js`.
