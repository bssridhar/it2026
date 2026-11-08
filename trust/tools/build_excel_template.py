"""
Builds templates/Trust_data_template.xlsx – the sheet in which the trust's details are keyed in, checked and
imported into the tool.

    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py

Hidden keys (column A of "Trust", row 1 of the other sheets) are what the tool reads; do not change them.
The "Check" columns use formulas to flag obvious mistakes (Aadhaar, PAN, PIN, age) while you type.
"""
import json
import os
from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "templates", "Trust_data_template.xlsx")
HEAD = Font(bold=True, color="FFFFFF")
HEAD_FILL = PatternFill("solid", fgColor="1F5FAE")
REQ_FILL = PatternFill("solid", fgColor="FFF2CC")
SEC_FILL = PatternFill("solid", fgColor="DDE7F5")
BAD_FILL = PatternFill("solid", fgColor="F8D7DA")
THIN = Side(style="thin", color="B7BEC9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")

TRUST = [
    ("#", "TRUST"),
    ("trust_name", "Name of the trust (e.g. ABC CHARITABLE TRUST)", True, "text", None),
    ("corpus", "Initial corpus settled (Rs.)", True, "number", None),
    ("#", "PRINCIPAL OFFICE OF THE TRUST"),
    ("off_flat", "Flat / Door / Block No.", True, "text", None),
    ("off_building", "Premises / Building", False, "text", None),
    ("off_road", "Road / Street", False, "text", None),
    ("off_area", "Area / Locality", True, "text", None),
    ("off_city", "Town / City / District", True, "text", None),
    ("off_state", "State", True, "text", None),
    ("off_pin", "PIN code", True, "text", None),
    ("off_owner", "Owner of the premises (for the NOC)", False, "text", None),
    ("off_owner_rel", "Owner's relationship (e.g. S/o ...)", False, "text", None),
    ("#", "EXECUTION OF THE DEED"),
    ("exec_place", "Place of execution (with PIN)", True, "text", None),
    ("exec_date", "Date of execution (leave blank to fill in at execution)", False, "date", None),
    ("jurisdiction", "Courts having jurisdiction (city)", True, "text", None),
    ("sro", "Sub-Registrar office for registration", False, "text", None),
    ("#", "ADMINISTRATION"),
    ("min_trustees", "Minimum number of trustees", True, "number", None),
    ("max_trustees", "Maximum number of trustees", True, "number", None),
    ("term_years", "Term of office bearers elected on vacancy (years)", True, "number", None),
    ("ec_meet_months", "Executive committee meets once in (months)", True, "number", None),
    ("ec_quorum", "Quorum for executive committee meetings", True, "number", None),
    ("tr_meet_months", "Meeting of all trustees once in (months)", True, "number", None),
    ("tr_quorum", "Quorum for meetings of trustees", True, "number", None),
    ("notice_days", "Days of notice for meetings", True, "number", None),
    ("bank_rule", "Bank account operated by", True, "text", ["Either of President or Secretary jointly with Treasurer", "Any two trustees jointly", "Managing Trustee singly", "As authorised by the Board of Trustees"]),
    ("#", "BANK AND PAN"),
    ("bank_name", "Bank for the trust account", False, "text", None),
    ("bank_branch", "Branch", False, "text", None),
    ("mobile", "Mobile number of the trust (for PAN / Form 104)", False, "text", None),
    ("email", "E-mail of the trust", False, "text", None),
]
PERSONS = [
    ("title", "Title", 9, True, ["Mr.", "Ms.", "Mrs.", "Miss.", "Dr."]),
    ("name", "Name", 26, True, None),
    ("rel", "S/o, D/o or W/o", 9, True, ["S/o", "D/o", "W/o"]),
    ("father", "Father's / husband's name", 24, True, None),
    ("dob", "Date of birth (DD/MM/YYYY)", 13, True, None),
    ("aadhaar", "Aadhaar No. (12 digits)", 17, True, None),
    ("pan", "PAN", 13, False, None),
    ("address", "Residential address", 40, True, None),
    ("mobile", "Mobile", 13, False, None),
    ("email", "E-mail", 22, False, None),
    ("occupation", "Occupation", 16, False, None),
    ("founder", "Founder (Yes/No)", 10, True, ["Yes", "No"]),
    ("trustee", "Trustee (Yes/No)", 10, True, ["Yes", "No"]),
    ("position", "Position", 18, False, ["President", "Vice President", "Secretary", "Treasurer", "Managing Trustee", "Trustee"]),
    ("signatory", "Bank signatory (Yes/No)", 11, False, ["Yes", "No"]),
]


def head(ws, cols, extra=None):
    for i, c in enumerate(cols, 1):
        ws.cell(row=1, column=i, value=c[0])
        h = ws.cell(row=2, column=i, value=c[1] + (" *" if c[3] else ""))
        h.font, h.fill, h.border, h.alignment = HEAD, HEAD_FILL, BOX, Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[h.column_letter].width = c[2]
    ws.row_dimensions[1].hidden = True
    ws.row_dimensions[2].height = 40
    ws.freeze_panes = "C3"


def lst(ws, rng, items):
    dv = DataValidation(type="list", formula1='"' + ",".join(items) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(rng)


def build():
    wb = Workbook()
    ins = wb.active
    ins.title = "Instructions"
    for i, (t, b) in enumerate([
        ("Trust – data template", True), ("", False),
        ("1. 'Trust': name, corpus, principal office, execution, administration, bank and contact details.", False),
        ("2. 'Persons': every founder and trustee, one row each, in the order they should appear in the deed. Mark Founder / Trustee and the position.", False),
        ("   The 'Check' column turns red when the Aadhaar, PAN, PIN or age looks wrong.", False),
        ("3. 'Objects': the objects clause of the deed, as in the firm's format. Set 'Use' to No to drop an object, edit the wording, or add rows.", False),
        ("   Rows with the same 'Group heading' are printed under that heading; leave it blank for a stand-alone object.", False),
        ("4. 'Clauses': any additional clauses to be added to the deed.", False),
        ("5. 'Witnesses': the two witnesses (optional – can be written in at execution).", False),
        ("6. Save, and use 'Import Excel' in the Trust tool.", False),
        ("Do not change the hidden column A of 'Trust' or the hidden first row of the other sheets.", False),
    ], 1):
        c = ins.cell(row=i, column=1, value=t)
        c.font = Font(bold=b, size=13 if i == 1 else 11)
    ins.column_dimensions["A"].width = 130

    ws = wb.create_sheet("Trust")
    ws["B1"], ws["C1"], ws["D1"] = "Particulars", "Details", "Check"
    for c in (ws["B1"], ws["C1"], ws["D1"]):
        c.font, c.fill, c.border = HEAD, HEAD_FILL, BOX
    defaults = {"min_trustees": 2, "max_trustees": 10, "term_years": 3, "ec_meet_months": 3, "ec_quorum": 3, "tr_meet_months": 6, "tr_quorum": 3,
                "notice_days": 15, "bank_rule": "Either of President or Secretary jointly with Treasurer", "corpus": 10000, "off_state": "Tamil Nadu", "jurisdiction": "Chennai"}
    r = 2
    for row in TRUST:
        if row[0] == "#":
            ws.cell(row=r, column=2, value=row[1]).font = Font(bold=True)
            for col in (2, 3, 4):
                ws.cell(row=r, column=col).fill = SEC_FILL
            r += 1
            continue
        key, label, req, kind, choices = row
        ws.cell(row=r, column=1, value=key)
        lc, vc = ws.cell(row=r, column=2, value=label + (" *" if req else "")), ws.cell(row=r, column=3, value=defaults.get(key))
        lc.border = vc.border = ws.cell(row=r, column=4).border = BOX
        lc.alignment = vc.alignment = WRAP
        if req:
            vc.fill = REQ_FILL
        vc.number_format = "DD/MM/YYYY" if kind == "date" else ("#,##,##0" if kind == "number" else "@")
        if choices:
            lst(ws, vc.coordinate, choices)
        if key == "off_pin":
            ws.cell(row=r, column=4, value=f'=IF(C{r}="","",IF(AND(LEN(C{r})=6,ISNUMBER(--C{r})),"OK","PIN must be 6 digits"))')
        if key in ("min_trustees", "max_trustees", "ec_quorum", "tr_quorum", "corpus"):
            dv = DataValidation(type="whole", operator="greaterThan", formula1="0", allow_blank=True, showErrorMessage=True, error="Enter a whole number above zero")
            ws.add_data_validation(dv); dv.add(vc.coordinate)
        r += 1
    ws.column_dimensions["A"].hidden = True
    ws.column_dimensions["B"].width = 52
    ws.column_dimensions["C"].width = 56
    ws.column_dimensions["D"].width = 22

    ps = wb.create_sheet("Persons")
    head(ps, PERSONS)
    chk_col = len(PERSONS) + 1
    h = ps.cell(row=2, column=chk_col, value="Check")
    h.font, h.fill, h.border = HEAD, HEAD_FILL, BOX
    ps.column_dimensions[h.column_letter].width = 30
    col = {c[0]: ps.cell(row=1, column=i).column_letter for i, c in enumerate(PERSONS, 1)}
    for i, c in enumerate(PERSONS, 1):
        if c[4]:
            L = ps.cell(row=1, column=i).column_letter
            lst(ps, f"{L}3:{L}40", c[4])
    for rr in range(3, 23):
        for i, c in enumerate(PERSONS, 1):
            cell = ps.cell(row=rr, column=i)
            cell.border, cell.alignment = BOX, WRAP
            cell.number_format = "DD/MM/YYYY" if c[0] == "dob" else "@"
            if c[3]:
                cell.fill = REQ_FILL
        a, p, n, d = f"{col['aadhaar']}{rr}", f"{col['pan']}{rr}", f"{col['name']}{rr}", f"{col['dob']}{rr}"
        f = (f'=IF({n}="","",IF(LEN(SUBSTITUTE({a}," ",""))<>12,"Aadhaar must have 12 digits",'
             f'IF(AND({p}<>"",LEN({p})<>10),"PAN must have 10 characters",'
             f'IF(AND({d}<>"",DATEDIF({d},TODAY(),"y")<18),"Below 18 years","OK"))))')
        cc = ps.cell(row=rr, column=chk_col, value=f)
        cc.border = BOX
    L = ps.cell(row=1, column=chk_col).column_letter
    ps.conditional_formatting.add(f"{L}3:{L}22", FormulaRule(formula=[f'AND({L}3<>"",{L}3<>"OK")'], fill=BAD_FILL))
    for k in ("founder", "trustee"):
        for rr in range(3, 23):
            pass

    os_ = wb.create_sheet("Objects")
    head(os_, [("use", "Use (Yes/No)", 9, True), ("head", "Group heading (blank for a stand-alone object)", 34, False), ("text", "Object", 110, True)])
    lst(os_, "A3:A120", ["Yes", "No"])
    rr = 3
    with open(os.path.join(HERE, "objects.json")) as fh:
        for g in json.load(fh):
            for t in g["items"]:
                for j, v in enumerate(("Yes", g["head"], t), 1):
                    c = os_.cell(row=rr, column=j, value=v)
                    c.border, c.alignment = BOX, WRAP
                rr += 1
    for r2 in range(rr, rr + 15):
        for j in range(1, 4):
            os_.cell(row=r2, column=j).border = BOX

    cs = wb.create_sheet("Clauses")
    head(cs, [("text", "Additional clause (one per row, without the number)", 120, False)])
    for r2 in range(3, 15):
        cs.cell(row=r2, column=1).border = BOX
        cs.cell(row=r2, column=1).alignment = WRAP

    w = wb.create_sheet("Witnesses")
    head(w, [("name", "Name", 30, False), ("rel", "S/o, D/o or W/o and name", 30, False), ("address", "Address", 60, False)])
    for r2 in range(3, 5):
        for j in range(1, 4):
            w.cell(row=r2, column=j).border = BOX
    wb.active = 1
    wb.save(OUT)
    print("Written", os.path.abspath(OUT))


if __name__ == "__main__":
    build()
