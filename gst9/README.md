# GSTR-9 / 9C Working

Open `index.html` (keep the `shared` folder of the tool kit next to this folder). Choose or drop the GSTR-1 and GSTR-3B
PDFs downloaded from the GST portal – any number of months, in any order. Each PDF's return type, GSTIN, year and month
are read from the PDF; a month loaded again replaces the earlier one. A PDF of another GSTIN or year is not loaded.

The Excel workbook has:
- **GSTR Recon** – the firm's working-sheet layout: GSTR-3B, GSTR-1 (with 3B vs GSTR-1 difference), BOOKS (blank),
  Input (3B vs books) and ITC break-up, with formulas.
- **GSTR-3B data / GSTR-1 data** – every table read, month-wise, with totals.
- **GSTR-9 draft** – Tables 4 to 9 (and 10 to 13 as inputs) linked to the data sheets by formulas.
- **Summary 9C** – books vs GSTR-3B vs GSTR-1 (output) and books vs GSTR-3B vs GSTR-2B (ITC).
- **Filing dates** and **Checks**.

Parsing: `lib/parse.js` (pdf.js text, labels + amounts). Workbook: `lib/book.js` (ExcelJS). Test only with dummy data or
data you are permitted to use; do not commit client returns.
