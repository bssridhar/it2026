# Partnership Deed – web form

| # | Document |
|---|----------|
| 0 | Print set – the deed and the NOC in one Word file |
| 1 | Partnership deed (firm's format, 26 clauses) |
| 2 | NOC from the owner for use of the premises as the principal place of business |
| 3 | Data sheet (internal) – firm and partner details for PAN, GST and bank account applications, pending items |

Also from the **Checklist** section: a **request list** of pending documents for the client (Word file, or text to paste).

## How to use

1. Keep the `partnership-docs` and `shared` folders side by side, and open the tool from the home page
   (`index.html` at the top level) or by double-clicking `partnership-docs/index.html`.
2. Enter the number of partners and click **Set up partner forms**, then upload each partner's PAN, Aadhaar and
   bank statement PDFs – or use the Excel template.
3. Fill in the firm and deed details, the object clause (or use **Suggest draft objects**), the NOC and the
   witnesses, then click **Generate documents**.

## What the deed takes from the form

* Firm name, principal place of business, place and date of execution (written in words), date of commencement,
  duration (blank = "at will"), accounting year end
* Parties: title, name, S/o–D/o–W/o, religion (optional), age on the date of the deed, address – any number of
  partners ("Party of the First / Second / Third … Part")
* Object clause – one paragraph per line
* Capital – "Rs. x each" when all partners bring the same amount, otherwise a list per partner
* Profit sharing ratio (must total 100%)
* Salary to working partners with the Section 40(b) limits; if no salary is entered the clause says no salary is payable
* Interest on capital (% per annum; 0 = no interest)
* Managing partner (optional) for the clause on raising loans
* Notice period for retirement (one, two or three months)
* Witnesses (name, address, occupation, relationship) – or left blank to be written by hand
* Space at the top of page 1 for printing on stamp paper (can be switched off)

## Checks

* At least 2 partners; more than 50 flagged (Section 464, Companies Act, 2013 with Rule 10 of the Companies
  (Miscellaneous) Rules, 2014)
* Profit shares total 100%
* A partner under 18 on the date of the deed blocks generation (Section 30, Indian Partnership Act, 1932)
* Interest on capital above 12% flagged (Section 40(b), Income-tax Act, 1961 – check the provision in force)
* PAN format and duplicates, e-mail, mobile, PIN code; PAN / Aadhaar / bank statement cross-checks; bank statement
  older than 2 months

## Changes from the sample deed's wording

* Arbitration clause refers to the **Arbitration and Conciliation Act, 1996** (the sample referred to the Arbitration
  Act, 1940, which the 1996 Act repealed)
* Interest clause says "% per annum"
* Salary clause refers to Section 40(b) "or the corresponding provision of the income-tax law for the time being in force"
* Typing corrections (e.g. "hereinafter", "hereto", "arise between the said partners", "forbidden", "insolvency",
  "thereof", "SECOND PART") and his/her where the sample used "his"

## Folder contents

* `index.html` – the web form
* `templates/` – deed, NOC, data sheet, request list (Word) and the Excel data template
* `lib/templates.js` – the templates, embedded so the page works when opened from disk
* `tools/build_templates.py` – builds the Word templates (the deed from the firm's sample wording)
* `tools/build_excel_template.py`, `tools/embed_templates.py` – Excel template and packing
