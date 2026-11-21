# Form 26AS · AIS · TIS Consolidator

Open `index.html` (or pick the tool on the home page). Everything runs in the browser; nothing is uploaded.

1. **Add the statements** – drop Form 26AS, AIS and TIS PDFs of the same assessee (TIS is optional). Each file is
   identified from its contents. Password-protected PDFs ask for the password: Form 26AS – date of birth as DDMMYYYY;
   AIS / TIS – PAN in lowercase followed by DDMMYYYY.
2. **Check the summary** – nature-wise totals as per 26AS, as per AIS/TIS and "Consider for SOI", and the list of
   additional information to be considered.
3. **Download Excel** – `Income_Consolidation_AY<year>_<PAN>.xlsx` with four sheets:
   * **Income Summary** – one table per nature of income (Salary; Interest split into Bank – Savings / Term-other
     deposits – and Other interest; Dividend; Contract; Professional fees; Fees for technical services; Rent;
     Commission; Business receipts; Partner's remuneration; Winnings; Other receipts), with totals, grand total and a
     "for information – not income" block (sale consideration, cash withdrawals u/s 194N, TCS).
   * **TDS Credit (26AS)** – deductor-wise amount, tax deducted / collected, deposited and booking status.
   * **Additional Information** – rule-based points for review.
   * **26AS & AIS Check** – part-wise review of every Part of 26AS and AIS, with raw lines for parts that need manual review.
4. **Save case file / Open case file** – a JSON file with the figures read from the statements (not the PDFs).
   A draft is kept in this browser; **Clear** removes it before starting the next assessee.

## Rules

* **Consider for SOI**: 26AS figure if only in 26AS; AIS/TIS figure if only in AIS/TIS; 26AS figure if both agree;
  the higher figure if they differ.
* 26AS Part I / II lines are grouped by deductor and section; the nature comes from the section
  (Income-tax Act, 1961). Codes under the Income-tax Act, 2025 are flagged for manual review (only 392 – salary – is
  mapped).
* AIS TDS entries are matched to 26AS by TAN and section; SFT entries (savings / deposit interest, dividend) are matched
  by name and taken once where the same income is also reported under TDS (as TIS does).
* TIS category totals are compared with the AIS lines taken.

## Flags raised (Additional Information)

194J(a) entries with TDS at 10%; salary credits (months with two credits, missing months, nil TDS); booking status other
than "F"; 26AS vs AIS differences and items only in one of them; tax challans of other years and no advance tax;
refunds; 26AS Parts III–X with entries; AIS entries other than income (purchases, sale of securities etc.); address
(PIN) mismatch; 80TTA / 80TTB (age from AIS date of birth); data dates; governing Act.

## Limits

Tested on statements with entries in 26AS Part I and AIS salary, interest, professional fees and tax payments. Other
sections use the same logic but should be checked the first time they occur. If the portal changes its layout, the
tool reports what it could not read instead of guessing. Libraries: `../shared/pdf.min.js` (pdf.js) and
`../shared/exceljs.min.js` (ExcelJS, MIT licence – `../shared/LICENSE-exceljs.txt`).
