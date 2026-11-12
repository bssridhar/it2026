# Exchange Rate for Tax – Income-tax and GST

Open `index.html` (or pick the tool on the home page). Everything runs in the browser.

**Convert a transaction** – choose the nature of the transaction; the tool works out the date the law points to and the
rate to use, looks up the SBI rate in the built-in archive and shows the rupee value, the legal basis, the working and notes.

| Nature | Rate and date |
|---|---|
| Business income of a resident keeping accounts in rupees | ICDS VI – rate on the date of the transaction; closing rate at the end of the tax year for outstanding items |
| Salary, interest on securities, NR shipping, dividends, capital gains | Rule 206, Table Sl. 1, 2, 4, 5, 6 – SBI TT buying rate on the last day of the preceding month |
| House property / business / other sources in foreign currency | Rule 206, Table Sl. 3 – last day of the tax year; Rule 206(3) where brought into India earlier |
| Income with TDS | Rule 206(2)(b)(ii) – date tax was required to be deducted |
| TDS on income payable in foreign currency | Rule 207 – SBI TT buying rate on the date tax is required to be deducted; last published rate if none that day |
| Export / import of services (GST) | CGST rule 34(2) – rate as per GAAP for the date of time of supply (section 13) |
| Export / import of goods (GST) | CGST rule 34(1) – CBIC notified rate (section 14, Customs Act) for the date of time of supply (section 12) – entered by you |

Where no rate was published on the statutory date, the last published rate is taken (Rule 207(1); Rule 206 is silent and
the same approach is applied, as stated in the working). Where the archive skips a **weekday**, the tool warns that the
archive may be incomplete and asks you to verify and enter the rate.

**Search rates by date** – all SBI rates (TT / bill, buying / selling; USD, EUR, GBP, JPY) for a date; month-end TT
buying rates for a year (Excel); rates you add (later dates, other currencies, CBIC Customs rates).

**Working paper** – PDF with the basis, working, rate, source and the screenshot of the source (attach or paste with
Ctrl+V). **Register** – all conversions, Excel export, working papers in one PDF. **ICDS VI** – exchange difference on
realisation and at the year end.

## Rate archive

`lib/sbi_rates.js` is built by `tools/build_rates.py` from rates collected from officialforexrates.com, an independent
archive of the SBI daily forex rates ("to be used as reference rates") from 01-01-2022 (it states it is not associated
with SBI). The archive has gaps on some working days; verify the rate adopted against the source and keep the
screenshot. Rates after the archive date are added under "Rates added by you" until the archive is refreshed.
