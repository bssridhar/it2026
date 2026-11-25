"""
Builds templates/Partnership_data_template.xlsx - the Excel sheet in which the company and
director/subscriber details can be keyed in and uploaded to the web form.

    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py

Row 1 of "Partners" and column A of "Firm" hold the field keys the web form reads.
They are hidden; do not delete or edit them.
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "Partnership_data_template.xlsx")

HEAD = Font(bold=True, color="FFFFFF")
HEAD_FILL = PatternFill("solid", fgColor="1F5FAE")
REQ_FILL = PatternFill("solid", fgColor="FFF2CC")
SEC_FILL = PatternFill("solid", fgColor="DDE7F5")
THIN = Side(style="thin", color="B7BEC9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")

# key, heading, width, required, kind, list values
PERSON_COLS = [
    ("title", "Title", 8, False, "list", ["Mr.", "Mrs.", "Ms.", "Dr."]),
    ("name", "Full name (as per PAN)", 28, True, "text", None),
    ("relation", "Relation", 10, True, "list", ["S/o", "D/o", "W/o"]),
    ("father_name", "Father's name (in full; optional if W/o)", 28, False, "text", None),
    ("relation_name", "Husband's name (required if W/o)", 24, False, "text", None),
    ("dob", "Date of birth (DD/MM/YYYY)", 16, True, "date", None),
    ("gender", "Gender", 12, False, "list", ["Male", "Female", "Transgender"]),
    ("religion", "Religion (optional)", 14, False, "text", None),
    ("pan", "PAN", 14, True, "text", None),
    ("mobile", "Mobile no.", 16, True, "text", None),
    ("email", "E-mail id", 28, True, "text", None),
    ("addr1", "Address line 1 (door no., street)", 32, True, "text", None),
    ("addr2", "Address line 2 (area)", 26, False, "text", None),
    ("city", "City / District", 18, True, "text", None),
    ("pin", "PIN code", 10, True, "text", None),
    ("state", "State", 16, False, "text", None),
    ("bank_last_txn", "Date of last transaction in bank statement (DD/MM/YYYY)", 22, False, "date", None),
    ("capital", "Capital (Rs.)", 14, True, "number", None),
    ("profit_pct", "Profit share %", 12, True, "number", None),
    ("working", "Working partner", 10, False, "list", ["Yes", "No"]),
    ("salary", "Salary per month (Rs.; working partners)", 16, False, "number", None),
]

COMPANY_ROWS = [
    ("#", "FIRM DETAILS"),
    ("firm_name", "Name of the firm", True, "text"),
    ("pob_addr1", "Principal place of business – address line 1", True, "text"),
    ("pob_addr2", "Principal place of business – address line 2", False, "text"),
    ("pob_city", "Principal place of business – city / district", True, "text"),
    ("pob_pin", "Principal place of business – PIN code", True, "text"),
    ("pob_state", "Principal place of business – State", False, "text"),
    ("firm_email", "E-mail id of firm", False, "text"),
    ("#", "DEED"),
    ("place", "Place of execution", True, "text"),
    ("deed_date", "Date of deed (DD/MM/YYYY)", True, "date"),
    ("commencement", "Date of commencement (DD/MM/YYYY; blank = date of deed)", False, "date"),
    ("duration", "Duration (blank = at will)", False, "text"),
    ("interest_rate", "Interest on capital (% per annum; 0 = no interest)", False, "number"),
    ("managing_partner", "Managing partner (name, or blank for none)", False, "text"),
    ("objects", "Business of the firm (one object per line; Alt+Enter for a new line)", True, "text"),
    ("#", "NOC FROM OWNER OF BUSINESS PREMISES"),
    ("owner_name", "Name of owner", True, "text"),
    ("noc_date", "Date of NOC (DD/MM/YYYY)", True, "date"),
    ("prop_same", "Property address same as place of business? (Yes/No)", False, "yesno"),
    ("prop_addr", "Property address, if different (Alt+Enter for new lines)", False, "text"),
    ("#", "WITNESSES"),
    ("w1_details", "Witness 1 – name, address, occupation, relationship (Alt+Enter for new lines)", False, "text"),
    ("w2_details", "Witness 2 – name, address, occupation, relationship", False, "text"),
]

N_ROWS = 20


def build():
    wb = Workbook()
    ins = wb.active
    ins.title = "Instructions"
    lines = [
        ("Partnership deed – data template", True),
        ("", False),
        ("1. Fill in the 'Firm' sheet (one value per row in column C).", False),
        ("2. Fill in the 'Partners' sheet: one row per partner, starting from row 3. Rows with no name are ignored.", False),
        ("3. Cells shaded yellow are required.", False),
        ("4. Enter dates as DD/MM/YYYY (or as Excel dates). Enter PAN, mobile and PIN as typed text.", False),
        ("5. Save the file and use 'Upload filled Excel' in the web form. Check the details on screen before generating the documents.", False),
        ("6. Do not delete or change the hidden column A of the 'Firm' sheet or the hidden row 1 of the 'Partners' sheet.", False),
        ("", False),
        ("Do not enter Aadhaar numbers in this file; they are not needed for these documents.", False),
    ]
    for i, (t, b) in enumerate(lines, 1):
        c = ins.cell(row=i, column=1, value=t)
        c.font = Font(bold=b, size=13 if i == 1 else 11)
    ins.column_dimensions["A"].width = 120

    ws = wb.create_sheet("Firm")
    ws["B1"], ws["C1"] = "Particulars", "Details"
    for c in (ws["B1"], ws["C1"]):
        c.font, c.fill, c.border = HEAD, HEAD_FILL, BOX
    yesno = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
    ws.add_data_validation(yesno)
    r = 2
    for row in COMPANY_ROWS:
        if row[0] == "#":
            ws.cell(row=r, column=2, value=row[1]).font = Font(bold=True)
            for col in (2, 3):
                ws.cell(row=r, column=col).fill = SEC_FILL
            r += 1
            continue
        key, label, req, kind = row
        ws.cell(row=r, column=1, value=key)
        lc = ws.cell(row=r, column=2, value=label + (" *" if req else ""))
        vc = ws.cell(row=r, column=3)
        lc.border = vc.border = BOX
        lc.alignment = vc.alignment = WRAP
        if req:
            vc.fill = REQ_FILL
        vc.number_format = "DD/MM/YYYY" if kind == "date" else ("#,##,##0" if kind == "number" else "@")
        if kind == "yesno":
            vc.value = "Yes"
            yesno.add(vc)
        if key == "interest_rate":
            vc.value = 12
        if key in ("objects", "w1_details", "w2_details"):
            ws.row_dimensions[r].height = 90
        r += 1
    ws.column_dimensions["A"].hidden = True
    ws.column_dimensions["B"].width = 58
    ws.column_dimensions["C"].width = 60
    ws.freeze_panes = "B2"

    ps = wb.create_sheet("Partners")
    for i, (key, head, width, req, kind, values) in enumerate(PERSON_COLS, 1):
        ps.cell(row=1, column=i, value=key)
        h = ps.cell(row=2, column=i, value=head + (" *" if req else ""))
        h.font, h.fill, h.border, h.alignment = HEAD, HEAD_FILL, BOX, Alignment(wrap_text=True, vertical="center")
        col = h.column_letter
        ps.column_dimensions[col].width = width
        if kind == "list":
            dv = DataValidation(type="list", formula1='"' + ",".join(values) + '"', allow_blank=True)
            ps.add_data_validation(dv)
            dv.add(f"{col}3:{col}{N_ROWS + 2}")
        for rr in range(3, N_ROWS + 3):
            c = ps.cell(row=rr, column=i)
            c.border = BOX
            c.number_format = "DD/MM/YYYY" if kind == "date" else ("#,##,##0" if kind == "number" else "@")
            if req:
                c.fill = REQ_FILL
            if key == "working" and rr < 5:
                c.value = "Yes"
    ps.row_dimensions[1].hidden = True
    ps.row_dimensions[2].height = 48
    ps.freeze_panes = "C3"

    wb.active = 1
    wb.save(OUT)
    print("Written", os.path.abspath(OUT))


if __name__ == "__main__":
    build()
