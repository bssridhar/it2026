"""
Builds templates/Networth_data_template.xlsx – the Excel sheet in which a net worth certificate's details can
be keyed in and then imported into the tool.

    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py

Hidden keys (column A of "Details", row 1 of the other sheets) are what the tool reads; do not change them.
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "Networth_data_template.xlsx")
HEAD = Font(bold=True, color="FFFFFF")
HEAD_FILL = PatternFill("solid", fgColor="1F5FAE")
REQ_FILL = PatternFill("solid", fgColor="FFF2CC")
SEC_FILL = PatternFill("solid", fgColor="DDE7F5")
THIN = Side(style="thin", color="B7BEC9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")

DETAILS = [
    ("#", "CERTIFICATE"),
    ("case_name", "Case name (for your reference, e.g. Australia visa – Subashini)", False, "text"),
    ("address", "Residential address (Alt+Enter for new lines)", True, "text"),
    ("purpose", "Purpose – completes \"…their ability to meet …\" (e.g. the Education cost for Masters Degree …, University …, Location …)", True, "text"),
    ("cert_date", "Date of certificate (DD/MM/YYYY)", True, "date"),
    ("place", "Place", True, "text"),
    ("udin", "UDIN (if already generated)", False, "text"),
    ("#", "CURRENCY (entered by you; the tool does not change it)"),
    ("currency", "Foreign currency code (e.g. AUD, USD, EUR, GBP, CAD, NZD, SGD)", True, "text"),
    ("rate", "Conversion rate – INR for 1 unit of the foreign currency", True, "number"),
    ("rate_date", "Rate as on (DD/MM/YYYY)", True, "date"),
    ("rate_source", "Source of the rate (e.g. RBI reference rate, bank's TT buying rate)", False, "text"),
]
PERSONS = [
    ("name", "Name", 30, True, None), ("role", "Role (e.g. Student, Father & Sponsor)", 26, True, None),
    ("aadhaar", "Aadhaar no. (optional)", 20, False, None), ("pan", "PAN (optional)", 14, False, None),
    ("print", "Show in certificate (Yes/No)", 14, False, ["Yes", "No"]),
]
SECTIONS = [
    ("title", "Name in the summary", 40, True), ("annex", "Heading in the list of documents", 42, True),
    ("type", "Type (Asset / Liability)", 18, True),
]
DEFAULT_SECTIONS = [
    ("Personal / Family Savings in India", "PERSONAL / FAMILY SAVINGS FROM INDIA", "Asset"),
    ("Current Investments in India", "CURRENT INVESTMENTS IN INDIA", "Asset"),
    ("Current Income in India", "CURRENT INCOME IN INDIA", "Asset"),
    ("Immovable properties held in India", "IMMOVABLE PROPERTIES IN INDIA", "Asset"),
    ("Educational Loan", "EDUCATIONAL LOAN", "Asset"),
    ("Mortgage Loan", "MORTGAGE LOAN", "Liability"),
]
ITEMS = [
    ("section", "Section (choose from the list)", 32, True), ("sub", "Sub-heading (e.g. FIXED DEPOSIT WITH BANKS)", 28, False),
    ("desc", "Particulars as they should appear (Alt+Enter for new lines)", 60, True), ("amount", "Amount (Rs.)", 16, True),
    ("evidence", "Document (Original seen / Scanned copy / Pending)", 18, False), ("note", "Internal note (not printed)", 28, False),
]


def head(ws, cols, row=2):
    for i, c in enumerate(cols, 1):
        ws.cell(row=1, column=i, value=c[0])
        h = ws.cell(row=row, column=i, value=c[1] + (" *" if c[3] else ""))
        h.font, h.fill, h.border, h.alignment = HEAD, HEAD_FILL, BOX, Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[h.column_letter].width = c[2]
    ws.row_dimensions[1].hidden = True
    ws.row_dimensions[2].height = 36
    ws.freeze_panes = "A3"


def build():
    wb = Workbook()
    ins = wb.active
    ins.title = "Instructions"
    for i, (t, b) in enumerate([
        ("Net worth certificate – data template", True), ("", False),
        ("1. 'Details': address, purpose, date, place and the currency with its conversion rate.", False),
        ("2. 'Persons': the student and each sponsor, in the order they should appear in the certificate.", False),
        ("3. 'Sections': the headings of the certificate. Add a row for a new type of asset or liability (Type: Asset or Liability).", False),
        ("   Liabilities are deducted. Sections with no items are left out of the certificate.", False),
        ("4. 'Items': one row per document – choose the section, give the sub-heading, the particulars exactly as they should be printed, and the amount in rupees.", False),
        ("   Enter liabilities as positive amounts; the tool deducts them.", False),
        ("5. Save, and use 'Import Excel' in the Net Worth Certificate tool.", False),
        ("Do not change the hidden column A of 'Details' or the hidden first row of the other sheets.", False),
    ], 1):
        c = ins.cell(row=i, column=1, value=t)
        c.font = Font(bold=b, size=13 if i == 1 else 11)
    ins.column_dimensions["A"].width = 130

    ws = wb.create_sheet("Details")
    ws["B1"], ws["C1"] = "Particulars", "Details"
    for c in (ws["B1"], ws["C1"]):
        c.font, c.fill, c.border = HEAD, HEAD_FILL, BOX
    r = 2
    for row in DETAILS:
        if row[0] == "#":
            ws.cell(row=r, column=2, value=row[1]).font = Font(bold=True)
            for col in (2, 3):
                ws.cell(row=r, column=col).fill = SEC_FILL
            r += 1
            continue
        key, label, req, kind = row
        ws.cell(row=r, column=1, value=key)
        lc, vc = ws.cell(row=r, column=2, value=label + (" *" if req else "")), ws.cell(row=r, column=3)
        lc.border = vc.border = BOX
        lc.alignment = vc.alignment = WRAP
        if req:
            vc.fill = REQ_FILL
        vc.number_format = "DD/MM/YYYY" if kind == "date" else ("0.0000" if kind == "number" else "@")
        if key in ("address", "purpose"):
            ws.row_dimensions[r].height = 60
        r += 1
    ws.column_dimensions["A"].hidden = True
    ws.column_dimensions["B"].width = 60
    ws.column_dimensions["C"].width = 70

    ps = wb.create_sheet("Persons")
    head(ps, PERSONS)
    dv = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
    ps.add_data_validation(dv)
    dv.add("E3:E30")
    for rr in range(3, 13):
        for i, c in enumerate(PERSONS, 1):
            cell = ps.cell(row=rr, column=i)
            cell.border, cell.number_format = BOX, "@"
            if c[3]:
                cell.fill = REQ_FILL
        ps.cell(row=rr, column=5, value="Yes")

    ss = wb.create_sheet("Sections")
    head(ss, SECTIONS)
    dvt = DataValidation(type="list", formula1='"Asset,Liability"', allow_blank=False)
    ss.add_data_validation(dvt)
    dvt.add("C3:C40")
    for i, (t, a, ty) in enumerate(DEFAULT_SECTIONS, 3):
        for j, v in enumerate((t, a, ty), 1):
            ss.cell(row=i, column=j, value=v).border = BOX
    for rr in range(3 + len(DEFAULT_SECTIONS), 21):
        for j in range(1, 4):
            ss.cell(row=rr, column=j).border = BOX

    it = wb.create_sheet("Items")
    head(it, ITEMS)
    dvs = DataValidation(type="list", formula1="=Sections!$A$3:$A$40", allow_blank=True)
    dve = DataValidation(type="list", formula1='"Original seen,Scanned copy,Pending"', allow_blank=True)
    it.add_data_validation(dvs)
    it.add_data_validation(dve)
    dvs.add("A3:A200")
    dve.add("E3:E200")
    for rr in range(3, 61):
        for i, c in enumerate(ITEMS, 1):
            cell = it.cell(row=rr, column=i)
            cell.border = BOX
            cell.alignment = WRAP
            cell.number_format = "#,##,##0" if c[0] == "amount" else "@"
            if c[3]:
                cell.fill = REQ_FILL
    wb.active = 1
    wb.save(OUT)
    print("Written", os.path.abspath(OUT))


if __name__ == "__main__":
    build()
