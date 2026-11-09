# Practice tool kit

Browser-based tools that fill the firm's standard formats from one set of inputs.
**Double-click `index.html` in this folder** to open the home page and pick a tool; each tool has an
"All tools" link back to it. Nothing is uploaded anywhere – everything runs in the browser.

| Folder | Tool |
|---|---|
| `llp-docs/` | LLP Registration Tool Kit: Form 9, consent letter, subscription sheet, NOC, LLP Agreement, data sheet, print set |
| `company-docs/` | Company Registration Tool Kit (Private Limited and OPC): NOC, data sheet for SPICe+ (e-MoA / e-AoA) |
| `partnership-docs/` | Partnership Deed: deed, NOC for the place of business, data sheet, checklist |
| `networth/` | Net Worth Certificate (visa): Excel import, locked conversion rate, draft PDF with DRAFT watermark, final PDF and Word |
| `cii/` | Cost Inflation Index: CII table (2001-02 to 2026-27) and indexed cost calculator with working |
| `taxcalc/` | Income Tax Calculator, tax year 2026-27, new regime: slab-wise working, rebate, surcharge, cess |
| `tds/` | TDS rate chart (section 393, Income-tax Act, 2025) and calculator, with the section and Sl. No. to select on the portal |
| `huf/` | HUF Formation: affidavit (stamp paper) and PAN data sheet for the HUF |
| `voucher/` | Payment Voucher: PDF in the voucher-book format, Cash / Cheque / UPI, numbering, register |
| `trust/` | Trust Formation: deed, NOC, resolution, PAN and Form 104 data sheets, formalities checklist |
| `pfesi/` | EPF and ESI monthly returns: ECR file, ESIC upload file (.xls), registers, summary and reconciliation |
| `26as-ais-tis/` | Form 26AS · AIS · TIS Consolidator: income consolidation workbook (Excel) for the computation of total income, TDS credit, review points |
| `shared/` | Code used by the tools – keep it next to the tool folders |

## Home page settings – `home-config.js`

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
