# GSTR-2B Analyser – ITC for GSTR-3B

Open `index.html` (keep the `shared` folder next to this folder) and load the GSTR-2B Excel downloaded from the portal.

Every record (B2B, B2BA, CDNR, CDNRA, ECO, ISD, IMPG, ITC reversal and IMS-rejected sheets) is sorted:
ITC not available as per 2B → reverse charge → place of supply outside the State → insurance / motor vehicle words →
other section 17(5) words → eligible. Any line can be re-marked with a reason; "All of supplier" and "Remember"
(supplier rule for future months of the client) save time. Keyword rules are editable on the page.

A large GSTR-2B that the portal splits into several files: choose all the files together (or add a part later) – parts of the
same GSTIN and month are combined, repeated records are counted once, and a shortfall against the GSTR-2B summary is
flagged so a missing part is noticed. Split files from the portal carry no "Read me" or summary sheets – the GSTIN and
month are then taken from the file name (MMYYYY_GSTIN_GSTR2B_DDMMYYYY_part.xlsx). Large months are shown 200 lines at a
time on screen; the Excel has every line.

The lines table has Excel-style filters and sorting on each column heading (▾). The category (with a reason, and
optionally remembering the supplier) can be set for all the lines shown, for ticked lines only, or line by line;
"Undo last change" reverses a bulk change.

Excel: **Gstr-2B Working** (blocks in the firm's layout with a "Reason for ineligible" column, amendments with the ITC
claimed earlier, summary vs GSTR-2B, proposed GSTR-3B), **2B data**, **Supplier-wise**, **Checks**.
Blocked credit is shown in 4A(5) and reversed in 4B(1), and place-of-supply ineligibility in 4D(2) (CBIC Circular
170/02/2022-GST) – this can be switched off on the page.

## Reconciliation with the purchase register (books)

Load the purchase register in the "Reconciliation" section:
- the **standard template** (download it from the page);
- a register **exported from Tally to Excel (.xlsx) or CSV** – Purchase Register, columnar register or GSTR-2 export: the
  heading row is found automatically, columns are recognised from their headings (rate-wise tax columns are added up)
  and can be changed on screen; several rows of one invoice are added up;
- **Tally XML** export of vouchers (UTF-8 / UTF-16): choose the voucher types (Purchase, Debit Note …); taxes are read
  from IGST / CGST / SGST / UTGST / Cess ledgers, the GSTIN from the voucher or the ledger master.
An old .xls file must be saved as .xlsx first.

Matching (one-to-one), with options on screen: amount tolerance (Rs. and/or %), date window, invoice number
normalisation (case, spaces, "/", "-" always; financial-year part and leading zeros optionally), invoice numbers that
differ by a character or two or only in non-digits, GSTIN missing / different in books, GSTIN filled from GSTR-2B by
supplier name. Statuses: matched, matched – invoice no. differs, matched – GSTIN differs, matched manually, amount
difference, probable (accept / reject), in GSTR-2B only, in books only. Pairs can be undone and lines paired by hand.

The Excel then has **Reco summary**, **Reco details** (side by side, with differences and filters) and **Reco
supplier-wise**, and the eligible-ITC block of the working is split into "Purchase reflected in GSTR-2B and accounted in
books" and "Additional input – in GSTR-2B, not accounted in books".

## IMS (Invoice Management System)

Before acting on IMS, load the IMS download (IMS_B2B_<GSTIN>_<DDMMYYYY>.csv, and the files of the other sections)
instead of the GSTR-2B. The GSTIN comes from the file name and the month from the "Source Return Period" column; the IMS
status of each record (No Action / Accepted / Rejected / Pending) is read – rejected records go to "Rejected on IMS" and
pending ones to "Held". Every record gets a **suggested IMS action** (a suggestion only – the action is taken on the
portal): matched with the purchase register → Accept; amount difference, probable match, not in books, or place of
supply outside the State → Pending; blocked / ineligible credit → Accept and do not claim / reverse the ITC. The
suggestion is shown under the category of each line, summarised on screen, and listed in the Excel ("IMS actions").
IMS files and a GSTR-2B of the same month should not be loaded together (an invoice would be counted twice).
