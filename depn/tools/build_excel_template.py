"""
Builds templates/Fixed_asset_register_template.xlsx – the fixed asset register the depreciation tool imports.

    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py

Row 1 holds hidden keys read by the tool; row 2 shows the headings. The "Schedule II" sheet lists the Part C classes;
the class column of the register has a drop-down of those codes.
"""
import os
import re
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "templates", "Fixed_asset_register_template.xlsx")
HEAD, FILL = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="1F5FAE")
REQ = PatternFill("solid", fgColor="FFF2CC")
THIN = Side(style="thin", color="B7BEC9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

COLS = [
    ("asset_id", "Asset ID", 10, False, "@"), ("desc", "Description", 32, True, "@"), ("code", "Schedule II class (code)", 16, True, "@"),
    ("group", "Class for the PPE note (optional – default: Schedule II group)", 22, False, "@"),
    ("put_to_use", "Date put to use", 13, True, "DD/MM/YYYY"), ("cost", "Original cost", 14, True, "#,##,##0.00"),
    ("opening_acc", "Accumulated depreciation at the start of the year", 16, False, "#,##,##0.00"),
    ("method", "Method (SLM / WDV)", 10, True, "@"), ("life_override", "Useful life used, if different from Schedule II (years)", 14, False, "0"),
    ("rv_pct", "Residual value % (blank = 5%)", 11, False, "0.00"), ("sold_on", "Date sold / discarded", 13, False, "DD/MM/YYYY"),
    ("sale_value", "Sale value", 13, False, "#,##,##0.00"), ("double_days", "Days on double shift", 9, False, "0"), ("triple_days", "Days on triple shift", 9, False, "0"),
    ("books_dep", "Depreciation as per books (for audit check)", 15, False, "#,##,##0.00"), ("location", "Location / tag (optional)", 16, False, "@"),
]


def schedule_rows():
    js = open(os.path.join(HERE, "..", "lib", "schedule2.js"), encoding="utf-8").read()
    return re.findall(r"code: '([^']+)', group: '([^']+)', name: '((?:[^'\\]|\\.)*)', life: (\d+), nesd: (true|false)", js)


def build():
    wb = Workbook()
    ins = wb.active
    ins.title = "Instructions"
    for i, (t, b) in enumerate([
        ("Fixed asset register – depreciation under Schedule II, Companies Act, 2013", True), ("", False),
        ("One row per asset (or per significant component – Note 4). Choose the Schedule II class code from the drop-down (see the 'Schedule II' sheet).", False),
        ("Assets added during the year: enter the date put to use and cost; leave the accumulated depreciation blank.", False),
        ("Assets brought forward: enter the original cost, date put to use and the accumulated depreciation at the start of the year.", False),
        ("Useful life used: only if the company uses a life different from Schedule II (the tool flags it for disclosure / audit).", False),
        ("Days on double / triple shift: only for assets not marked NESD (Note 6).", False),
        ("Depreciation as per books: optional – the tool compares it with the computed figure.", False),
        ("Do not change the hidden first row.", False),
    ], 1):
        ins.cell(row=i, column=1, value=t).font = Font(bold=b, size=13 if i == 1 else 11)
    ins.column_dimensions["A"].width = 140

    ws = wb.create_sheet("Register")
    for i, (k, h, w, req, f) in enumerate(COLS, 1):
        ws.cell(row=1, column=i, value=k)
        c = ws.cell(row=2, column=i, value=h + (" *" if req else ""))
        c.font, c.fill, c.border, c.alignment = HEAD, FILL, BOX, Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[c.column_letter].width = w
    ws.row_dimensions[1].hidden = True
    ws.row_dimensions[2].height = 54
    ws.freeze_panes = "C3"
    for r in range(3, 503):
        for i, (k, h, w, req, f) in enumerate(COLS, 1):
            c = ws.cell(row=r, column=i)
            c.border, c.number_format = BOX, f
            if req:
                c.fill = REQ
    rows = schedule_rows()
    dv = DataValidation(type="list", formula1=f"='Schedule II'!$A$2:$A${len(rows) + 1}", allow_blank=True)
    ws.add_data_validation(dv); dv.add("C3:C502")
    dm = DataValidation(type="list", formula1='"SLM,WDV"', allow_blank=True)
    ws.add_data_validation(dm); dm.add("H3:H502")

    sc = wb.create_sheet("Schedule II")
    for i, h in enumerate(["Code", "Group", "Nature of assets", "Useful life (years)", "NESD"], 1):
        c = sc.cell(row=1, column=i, value=h); c.font, c.fill = HEAD, FILL
    for r, (code, group, name, life, nesd) in enumerate(rows, 2):
        for i, v in enumerate([code, group, name.replace("\\'", "'"), int(life), "NESD" if nesd == "true" else ""], 1):
            sc.cell(row=r, column=i, value=v)
    for col, w in zip("ABCDE", (14, 34, 90, 10, 8)):
        sc.column_dimensions[col].width = w
    wb.active = 1
    wb.save(OUT)
    print("Written", os.path.abspath(OUT), len(rows), "Schedule II classes")


if __name__ == "__main__":
    build()
