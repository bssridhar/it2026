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
