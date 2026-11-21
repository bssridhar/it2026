# EPF and ESI Monthly Returns

Open `index.html` (or pick the tool on the home page). Everything runs in the browser; nothing is uploaded.

1. **Import salary sheet** – the firm's monthly salary working sheet (the tool finds the header row with "UAN" and
   "Employee Name" and reads Employee ID, Member ID (ESI), UAN, Department, Designation, Gross Salary, Basic+DA and the
   ESI contribution column), or the tool's own template ("Download salary template").
2. **Check the employees** – PF wages, NCP days, ESI days, PF / EPS / higher-wages flags, ESI Auto / Yes / No, reason code
   and last working day for ESI, date of birth (EPS stops at 58), refund of advances.
3. **Contributions** – EPF A/c 1, 2, 10, 21, 22 and ESI employees' / employer's share.
4. **Checks** – UAN / IP number missing, wrong length or repeated; employees within the ESI ceiling without an IP number;
   ESI continued above the ceiling; average daily wage rule; age 58; reason code needing a last working day.
5. **Files and forms** – ECR file (.txt, ECR 2.0, `#~#` separated), ESIC monthly contribution file (.xls, Excel 97-2003,
   all text), ECR in Excel, EPF and ESI contribution registers (PDF), monthly summary and reconciliation (PDF).
6. **Filing record** – TRRN, challan dates and amounts as per the portals, notes; differences are shown.
7. **Save month file / Start next month** – employees carry forward; at the start of a new ESI contribution period
   (April, October) employees above the ceiling go back to "Auto".

## Rates and ceilings (editable – "Rates and ceilings")

EPF 12% / EPS 8.33% / admin 0.5% (minimum Rs.500) / EDLI 0.5%; EPF wage ceiling Rs.15,000, and Rs.25,000 from
17-09-2026 – a month in which the ceiling changes is split by calendar days. ESI 0.75% / 3.25%, ceiling Rs.21,000,
employee's share nil at an average daily wage up to Rs.176, rounded to the next higher rupee. Verify against the latest
EPFO / ESIC notifications.

The .xls file is written by `../shared/xlswrite.js` (a small BIFF8 writer in this kit).
