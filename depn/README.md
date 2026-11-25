# Depreciation – Schedule II, Companies Act, 2013

Open `index.html` (keep the `shared` folder of the tool kit next to this folder).

1. **Asset added during the year** – class from Part C, cost, date put to use, method, residual %, shift days.
   Shows the SLM and WDV rates, pro rata depreciation by days (Note 2), extra shift (Note 6, not for NESD assets),
   the step-by-step working, SLM vs WDV for the year and the year-by-year schedule over the useful life. PDF of the working.
2. **Fixed asset register** – import from `Fixed_asset_register_template.xlsx` (download from the tool), additions,
   disposals with profit / loss, opening accumulated depreciation (or fill it from the date put to use),
   depreciation as per books for comparison, carry forward to the next year. Excel (.xls) and PDF.
3. **PPE note and audit checks** – class-wise reconciliation of gross and net carrying amounts, draft Note 3 disclosure,
   exceptions (life longer than Part C, residual above 5%, extra shift on NESD assets, books vs computed, etc.), CARO 2020 para 3(i) reminders.
4. **Schedule II reference** – Part C lives with SLM and WDV rates for any residual %.

Formulae: SLM rate = (1 − residual %) ÷ life on cost; WDV rate = 1 − (residual ÷ cost)^(1 ÷ life) on opening WDV.
Part C data: `lib/schedule2.js` (from the text of the Schedule). Template: `python3 tools/build_excel_template.py && python3 tools/embed_templates.py`.
