# HUF Formation – Affidavit and PAN Data Sheet

Open `index.html` (or pick the tool on the home page). Everything runs in the browser; nothing is uploaded.

1. Enter the HUF, the Karta and the Karta's address, or click **Download Excel template**, fill it in and use
   **Import Excel** (sheets: Details, Members, Clauses).
2. Add the other members (the Karta is No. 1 automatically). Tick "Show rel./DOB" to print the relationship and
   date of birth under a member's name (ticked by default for children and grandchildren).
3. Enter the date from which the HUF is in existence, the place, and any additional declarations. The date of the
   affidavit can be left blank to be filled in at execution.
4. Layout: page size, space at the top of page 1 for the stamp paper, members table on a new page, heading of the
   name column, Aadhaar masking.
5. **Affidavit (Word)** – for printing on stamp paper and execution.
6. **PAN data sheet (Word)** – the details for the PAN application of the HUF, from the same data, with the list of
   members, documents to attach and points to check.

Checks: required fields, Aadhaar check digit, PAN and PIN format, Karta not a minor, date of existence not before the
Karta's birth or after the affidavit date, "HUF" in the name.

Templates (built from the firm's format, without client data):

```
python3 tools/build_templates.py
python3 tools/build_excel_template.py
python3 tools/embed_templates.py
```
