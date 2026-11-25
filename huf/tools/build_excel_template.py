"""
Builds templates/HUF_data_template.xlsx – the sheet in which the HUF details can be keyed in and imported into the tool.

    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py

Hidden keys (column A of "Details", row 1 of the other sheets) are what the tool reads; do not change them.
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "HUF_data_template.xlsx")
HEAD = Font(bold=True, color="FFFFFF")
HEAD_FILL = PatternFill("solid", fgColor="1F5FAE")
REQ_FILL = PatternFill("solid", fgColor="FFF2CC")
SEC_FILL = PatternFill("solid", fgColor="DDE7F5")
THIN = Side(style="thin", color="B7BEC9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")

DETAILS = [
    ("#", "HUF AND KARTA"),
    ("huf_name", "Name of the HUF (e.g. RAMESH K HUF)", True, "text", None),
    ("karta_name", "Name of the Karta", True, "text", None),
    ("karta_rel", "Karta is (son of / daughter of / wife of)", True, "text", ["son of", "daughter of", "wife of"]),
    ("karta_father", "Father's name of the Karta (husband's name if 'wife of')", True, "text", None),
    ("karta_dob", "Karta's date of birth (DD/MM/YYYY)", True, "date", None),
    ("karta_aadhaar", "Karta's Aadhaar number", False, "text", None),
    ("karta_pan", "Karta's PAN", False, "text", None),
    ("karta_mobile", "Mobile number (for the PAN application)", False, "text", None),
    ("karta_email", "E-mail (for the PAN application)", False, "text", None),
    ("#", "ADDRESS OF THE KARTA (also the HUF's address)"),
    ("addr_flat", "Flat / Door / Block No.", True, "text", None),
    ("addr_building", "Name of premises / building / village", False, "text", None),
    ("addr_road", "Road / Street / Lane", False, "text", None),
    ("addr_area", "Area / Locality / Taluk", True, "text", None),
    ("addr_city", "Town / City / District", True, "text", None),
    ("addr_state", "State", True, "text", None),
    ("addr_pin", "PIN code", True, "text", None),
    ("address_print", "Address as it should read in the affidavit (optional – leave blank to build it from the lines above)", False, "text", None),
    ("#", "AFFIDAVIT"),
    ("since_date", "HUF in existence since (DD/MM/YYYY)", True, "date", None),
    ("since_basis", "Basis of that date, printed in brackets (optional, e.g. date of marriage)", False, "text", None),
    ("place", "Place of execution", True, "text", None),
    ("aff_date", "Date of the affidavit (leave blank to fill in at execution)", False, "date", None),
    ("#", "PAN APPLICATION"),
    ("pan_name_card", "Name to be printed on the PAN card (optional; default is the HUF name)", False, "text", None),
    ("pan_income", "Source of income", False, "text", ["No income", "Income from house property", "Capital gains", "Income from other sources", "Business / profession"]),
    ("pan_ao", "AO code (Area code / AO type / Range code / AO No.), if known", False, "text", None),
]
MEMBERS = [
    ("name", "Name of the member", 28, True, None),
    ("relation", "Relationship to the Karta", 18, True, ["Wife", "Son", "Daughter", "Mother", "Son's wife", "Grandson", "Granddaughter", "Brother", "Other"]),
    ("father", "Name of father", 24, True, None),
    ("dob", "Date of birth (DD/MM/YYYY)", 14, False, None),
    ("aadhaar", "Aadhaar number", 18, False, None),
    ("address", "Address (leave blank if same as the Karta)", 40, False, None),
    ("show_rel", "Print relationship and DOB in the affidavit (Yes/No)", 18, False, ["Yes", "No"]),
]


def head(ws, cols):
    for i, c in enumerate(cols, 1):
        ws.cell(row=1, column=i, value=c[0])
        h = ws.cell(row=2, column=i, value=c[1] + (" *" if c[3] else ""))
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
        ("HUF – affidavit and PAN data template", True), ("", False),
        ("1. 'Details': the HUF, the Karta, the Karta's address, the affidavit details and the PAN application details.", False),
        ("2. 'Members': every member other than the Karta, in the order they should appear (the Karta is added as No. 1 automatically).", False),
        ("3. 'Clauses': any additional declarations to be added to the affidavit (optional).", False),
        ("4. Save, and use 'Import Excel' in the HUF tool.", False),
        ("Do not change the hidden column A of 'Details' or the hidden first row of the other sheets.", False),
    ], 1):
        c = ins.cell(row=i, column=1, value=t)
        c.font = Font(bold=b, size=13 if i == 1 else 11)
    ins.column_dimensions["A"].width = 120

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
        key, label, req, kind, choices = row
        ws.cell(row=r, column=1, value=key)
        lc, vc = ws.cell(row=r, column=2, value=label + (" *" if req else "")), ws.cell(row=r, column=3)
        lc.border = vc.border = BOX
        lc.alignment = vc.alignment = WRAP
        if req:
            vc.fill = REQ_FILL
        vc.number_format = "DD/MM/YYYY" if kind == "date" else "@"
        if choices:
            dv = DataValidation(type="list", formula1='"' + ",".join(choices) + '"', allow_blank=True)
            ws.add_data_validation(dv)
            dv.add(vc.coordinate)
        if key == "address_print":
            ws.row_dimensions[r].height = 48
        r += 1
    ws.column_dimensions["A"].hidden = True
    ws.column_dimensions["B"].width = 62
    ws.column_dimensions["C"].width = 60

    ms = wb.create_sheet("Members")
    head(ms, MEMBERS)
    for i, c in enumerate(MEMBERS, 1):
        if c[4]:
            dv = DataValidation(type="list", formula1='"' + ",".join(c[4]) + '"', allow_blank=True)
            ms.add_data_validation(dv)
            dv.add(f"{ms.cell(row=3, column=i).column_letter}3:{ms.cell(row=3, column=i).column_letter}40")
    for rr in range(3, 16):
        for i, c in enumerate(MEMBERS, 1):
            cell = ms.cell(row=rr, column=i)
            cell.border, cell.alignment = BOX, WRAP
            cell.number_format = "DD/MM/YYYY" if c[0] == "dob" else "@"
            if c[3]:
                cell.fill = REQ_FILL

    cs = wb.create_sheet("Clauses")
    head(cs, [("text", "Additional declaration (one per row, without the number)", 110, False)])
    for rr in range(3, 13):
        cs.cell(row=rr, column=1).border = BOX
        cs.cell(row=rr, column=1).alignment = WRAP
    wb.active = 1
    wb.save(OUT)
    print("Written", os.path.abspath(OUT))


if __name__ == "__main__":
    build()
