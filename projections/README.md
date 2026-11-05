# Financial Projections

Projected financial statements for loan proposals, built from a few assumptions. Results update on screen as
you type and can be downloaded as an Excel workbook or printed / saved as PDF.

## Inputs

1. **General** – name, constitution (sets a default tax rate), first financial year, number of years (3–10),
   **units: Rs. '000s or Rs. lakhs** (switching converts the figures already entered), tax rate, minimum cash balance.
2. **Opening position** – capital, unsecured loans, creditors, other current liabilities, stock, debtors, other current
   assets, investments (or tick *New business*). Opening cash is worked out as the balancing figure.
3. **Turnover and costs** – first-year turnover, **% increase every year**, **cost of purchases (% of turnover)**,
   other direct expenses, other income, salaries (with yearly increase), administrative & selling expenses
   (% of turnover), rent & fixed expenses (with yearly increase).
4. **Working capital** – **debtors (days of turnover)**, **creditors (days of purchases)**, **stock (days of purchases)**,
   other current assets and liabilities.
5. **Fixed assets** – blocks with WDV rates, opening WDV and additions year by year.
6. **Bank finance** – no loan, **cash credit**, **term loan**, or **both**:
   * Cash credit: limit (or equal to MPBF each year), rate, average utilisation, existing balance, and the MPBF
     method – turnover method (20% of turnover) or the second method of lending (75% of current assets less other
     current liabilities).
   * Term loans (any number, new or existing): amount, year of disbursement, rate, moratorium, repayment period,
     equal principal instalments or EMI.
7. **Year-wise inputs** – growth % for individual years, capital introduced, drawings / dividend.
8. **Ratio benchmarks** – editable (defaults are typical lender norms).

## Output (screen, Excel and print)

Profit & loss · Balance sheet (cash & bank = balancing figure) · Cash flow (reconciled with the balance sheet) ·
Fixed assets & depreciation · Loans & interest (yearly) · Term loan schedule (monthly, Excel) · Working capital &
MPBF · Ratio analysis with benchmarks · DSCR · Break-even · Cost of project & means of finance · Assumptions · Checks.

## Checks

* **Cash & bank never negative** (or below the minimum entered). The *Add the capital needed* button adds the smallest
  capital introduction, year by year, that clears the shortfall.
* **MPBF** – the cash credit limit must not exceed the MPBF in any year; *Set the limit equal to MPBF* fixes it.
  Under the second method, net working capital below 25% of current assets is flagged.
* **Unfavourable ratios highlighted** in red (current ratio, NWC to current assets, debt-equity, TOL/TNW, DSCR yearly
  and average, interest coverage, fixed asset coverage, negative margins, break-even above the benchmark).
* Opening balance sheet that doesn't balance; negative net worth; cash flow not agreeing with the balance sheet.

## Method notes

* Closing stock = purchases × stock days / 365; debtors = turnover × debtor days / 365; creditors = purchases ×
  creditor days / 365.
* Term loan interest is worked out monthly on the reducing balance; interest during the moratorium is paid.
* Cash credit interest = limit × utilisation × rate.
* MPBF is assessed on current assets excluding cash & bank (cash is the balancing figure).
* DSCR = (PAT + depreciation + interest) / (interest + term loan repayments).
* Tax is provided at the rate entered on the profit before tax; no tax in a loss year and no carry-forward of losses.

## Files

* `index.html` – the tool · `lib/engine.js` – calculations · `lib/report.js` – statements
* `../shared/xlsxwrite.js` – Excel writer
