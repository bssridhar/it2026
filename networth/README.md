# Net Worth Certificate (visa)

Open `index.html` (or pick the tool on the home page). Everything runs in the browser; nothing is uploaded.

## Steps

1. **Enter the details** on screen, or click **Download Excel template**, fill it in and use **Import Excel**.
   The template has four sheets: Details, Persons, Sections (the headings – add a row for a new type of
   asset or liability) and Items (one row per document reviewed, with its Ref No – SB a/c no., FDR no.,
   document no. – which is printed next to the particulars).
2. **Currency and rate** – choose the currency (or "Other…" for any 3-letter code), enter the INR rate for
   1 unit, the date and the source, attach a screenshot of the source if you wish, and click **Lock the rate**.
   The tool never fetches or changes a rate by itself. To change it, click **Change the rate** (it asks for
   confirmation, because a draft already sent will no longer match).
   Enter the **estimated cost** in the same currency to print "…which is estimated to be 50000 USD" after the
   purpose (leave it blank to omit).
3. **Assets and liabilities** – edit, reorder, add or remove sections (**+ Add a new type of asset / liability**,
   Type: Asset or Liability). Liabilities are entered as positive amounts and shown as "Less: …" in brackets.
   Sections with no items are left out. Each item has a document status (Original seen / Scanned copy /
   Pending / Self declaration) and an internal note that is not printed.
   **Gold Jewellery** (type "Gold Jewellery"): enter purity, weight and rate per gram – the value is weight × rate,
   and "Weight: … g (22 carat) @ Rs. … per g" is printed under the particulars. Choose who gives the declaration,
   the date and source of the gold rate, and click **Self declaration (PDF, working paper)** to get the client's
   declaration for signature and your records.
4. **Draft PDF for client confirmation** – "DRAFT" across the middle of every page (left to right, or diagonal
   if chosen), a "DRAFT FOR CONFIRMATION" footer and UDIN shown as "(to be generated)".
5. **Final certificate** – PDF or Word. The final certificate is blocked while any item is "Pending", and asks
   for confirmation if the UDIN is missing (a UDIN is required for every certificate signed by a member).

## Totals panel

A small panel at the right shows total assets, total liabilities, net worth and the estimated cost in the
foreign currency, and whether net worth exceeds the cost. Close it with × and reopen it with the "Totals" tab.
If net worth is less than the estimated cost, the tool asks for confirmation before a draft or final certificate
is generated.

## Calculation

* Each section's foreign-currency figure = section INR ÷ rate, rounded to the nearest unit.
* The foreign-currency total is the sum of the rounded section figures, so the summary always adds up;
  the tool tells you when this differs from converting the rupee total directly.
* Rupee words are in lakhs / crores; foreign-currency words in lakhs / crores (as in the firm's format) or
  thousands / millions.

## Other options

* **Save case file / Open case file** – one `.json` file per client (includes the rate screenshot). The current
  case is also kept in the browser automatically.
* **Firm settings** – signatory, membership number, firm name and the letterhead lines used in the PDF.
* Letterhead on/off (for pre-printed letterhead paper), amounts with commas, Aadhaar masking, rate date and
  source on the certificate, rate screenshot as a last page of the PDF.
* Checks: Aadhaar check digit (Verhoeff), PAN format, missing amounts, rate date after the certificate date.

## Templates (for maintenance)

```
python3 tools/build_templates.py <firm's sample certificate .docx>   # Word templates, keeps the letterhead
python3 tools/build_excel_template.py                                 # Excel data template
python3 tools/embed_templates.py                                      # embeds them into lib/templates.js
```

The PDF is drawn by `lib/certpdf.js` using jsPDF and jsPDF-AutoTable (in `../shared`, MIT licence).
