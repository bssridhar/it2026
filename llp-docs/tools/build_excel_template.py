"""
Builds templates/LLP_data_template.xlsx - the Excel sheet in which the LLP and partner
details can be keyed in and then uploaded to the web form.

    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py

Row 1 of "Partners" and column A of "LLP" hold the field keys the web form reads.
They are hidden; do not delete or edit them. Visible headings can be reworded freely.
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "LLP_data_template.xlsx")

HEAD = Font(bold=True, color="FFFFFF")
HEAD_FILL = PatternFill("solid", fgColor="1F5FAE")
REQ_FILL = PatternFill("solid", fgColor="FFF2CC")
SEC_FILL = PatternFill("solid", fgColor="DDE7F5")
THIN = Side(style="thin", color="B7BEC9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")

# key, heading, width, required, kind (text/date/list), list values, note
PARTNER_COLS = [
    ("designation", "Designation", 20, True, "list", ["Designated Partner", "Partner"], ""),
    ("name", "Full name (as per PAN)", 28, True, "text", None, ""),
    ("relation", "Relation", 10, True, "list", ["S/o", "D/o", "W/o"], ""),
    ("father_name", "Father's name (in full)", 28, True, "text", None, ""),
    ("relation_name", "Husband's name (only if W/o)", 26, False, "text", None, ""),
    ("dob", "Date of birth (DD/MM/YYYY)", 16, True, "date", None, ""),
    ("pan", "PAN", 14, True, "text", None, ""),
    ("mobile", "Mobile no.", 16, True, "text", None, ""),
    ("email", "E-mail id", 28, True, "text", None, ""),
    ("addr1", "Address line 1 (door no., street)", 32, True, "text", None, ""),
    ("addr2", "Address line 2 (area)", 26, False, "text", None, ""),
    ("city", "City / District", 18, True, "text", None, ""),
    ("pin", "PIN code", 10, True, "text", None, ""),
    ("state", "State", 16, False, "text", None, ""),
    ("address_proof", "Proof of address", 18, False, "list", ["BANK STATEMENT", "AADHAR", "PASSPORT", "VOTER ID", "DRIVING LICENCE", "ELECTRICITY BILL"], ""),
    ("bank_last_txn", "Date of last transaction in bank statement (DD/MM/YYYY)", 22, False, "date", None, ""),
    ("occupation", "Occupation", 16, False, "text", None, ""),
    ("nationality", "Nationality", 12, False, "text", None, ""),
    ("dpin", "DPIN / DIN (blank if not allotted)", 18, False, "text", None, ""),
    ("nominee_of", "Body corporate / firm whose nominee (else NA)", 26, False, "text", None, ""),
    ("prof_membership", "Professional membership & COP no. (else NA)", 26, False, "text", None, ""),
]

LLP_ROWS = [
    ("#", "LLP DETAILS"),
    ("llp_name", "Proposed name of LLP", True, "text"),
    ("ro_addr1", "Registered office – address line 1", True, "text"),
    ("ro_addr2", "Registered office – address line 2", False, "text"),
    ("ro_city", "Registered office – city / district", True, "text"),
    ("ro_pin", "Registered office – PIN code", True, "text"),
    ("ro_state", "Registered office – State", True, "text"),
    ("place", "Place of signing", True, "text"),
    ("date", "Date of signing (DD/MM/YYYY)", True, "date"),
    ("id_proof", "Proof of identity for Form 9 (e.g. PAN)", False, "text"),
    ("#", "NOC FROM OWNER OF REGISTERED OFFICE PREMISES"),
    ("owner_name", "Name of owner", True, "text"),
    ("noc_date", "Date of NOC (DD/MM/YYYY)", True, "date"),
    ("noc_place", "Place of NOC (blank = place of signing)", False, "text"),
    ("prop_same", "Property address same as registered office? (Yes/No)", False, "yesno"),
    ("prop_addr", "Property address, if different (use Alt+Enter for new lines)", False, "text"),
    ("#", "WITNESS (SUBSCRIPTION SHEET)"),
    ("witness_name", "Name of witness", False, "text"),
    ("witness_profession", "Profession, with professional membership no.", False, "text"),
    ("witness_address", "Address of witness", False, "text"),
]

N_PARTNER_ROWS = 25


def build():
    wb = Workbook()

    # ---------------- Instructions
    ins = wb.active
    ins.title = "Instructions"
    lines = [
        ("LLP incorporation – data template", True),
        ("", False),
        ("1. Fill in the 'LLP' sheet (one value per row in column C).", False),
        ("2. Fill in the 'Partners' sheet: one row per partner, starting from row 3. Rows with no name are ignored.", False),
        ("3. Cells shaded yellow are required.", False),
        ("4. Enter dates as DD/MM/YYYY (or as Excel dates). Enter PAN, mobile and PIN as typed text.", False),
        ("5. Save the file and use 'Upload filled Excel' in the web form. Check the details shown on screen before generating the documents.", False),
        ("6. Do not delete or change the hidden column A of the 'LLP' sheet or the hidden row 1 of the 'Partners' sheet.", False),
        ("", False),
        ("The 'Date of last transaction in bank statement' column is used to warn if the statement is more than 2 months old.", False),
        ("Do not enter Aadhaar numbers in this file; they are not needed for these documents.", False),
    ]
    for i, (t, b) in enumerate(lines, 1):
        c = ins.cell(row=i, column=1, value=t)
        c.font = Font(bold=b, size=13 if i == 1 else 11)
    ins.column_dimensions["A"].width = 120

    # ---------------- LLP
    ws = wb.create_sheet("LLP")
    ws["B1"], ws["C1"] = "Particulars", "Details"
    for c in (ws["B1"], ws["C1"]):
        c.font, c.fill, c.border = HEAD, HEAD_FILL, BOX
    yesno = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
    ws.add_data_validation(yesno)
    r = 2
    for row in LLP_ROWS:
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
        lc.alignment = WRAP
        vc.alignment = WRAP
        if req:
            vc.fill = REQ_FILL
        if kind == "date":
            vc.number_format = "DD/MM/YYYY"
        else:
            vc.number_format = "@"
        if kind == "yesno":
            vc.value = "Yes"
            yesno.add(vc)
        if key == "id_proof":
            vc.value = "PAN"
        r += 1
    ws.column_dimensions["A"].hidden = True
    ws.column_dimensions["B"].width = 58
    ws.column_dimensions["C"].width = 60
    ws.freeze_panes = "B2"

    # ---------------- Partners
    ps = wb.create_sheet("Partners")
    for i, (key, head, width, req, kind, values, _) in enumerate(PARTNER_COLS, 1):
        ps.cell(row=1, column=i, value=key)
        h = ps.cell(row=2, column=i, value=head + (" *" if req else ""))
        h.font, h.fill, h.border, h.alignment = HEAD, HEAD_FILL, BOX, Alignment(wrap_text=True, vertical="center")
        col = h.column_letter
        ps.column_dimensions[col].width = width
        rng = f"{col}3:{col}{N_PARTNER_ROWS + 2}"
        if kind == "list":
            dv = DataValidation(type="list", formula1='"' + ",".join(values) + '"', allow_blank=True)
            ps.add_data_validation(dv)
            dv.add(rng)
        for rr in range(3, N_PARTNER_ROWS + 3):
            c = ps.cell(row=rr, column=i)
            c.border = BOX
            c.number_format = "DD/MM/YYYY" if kind == "date" else "@"
            if req:
                c.fill = REQ_FILL
            if key == "designation":
                c.value = "Designated Partner" if rr < 5 else None
    ps.row_dimensions[1].hidden = True
    ps.row_dimensions[2].height = 48
    ps.freeze_panes = "C3"

    wb.active = 1
    wb.save(OUT)
    print("Written", os.path.abspath(OUT))


if __name__ == "__main__":
    build()
