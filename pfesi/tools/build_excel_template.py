"""
Builds templates/PF_ESI_salary_template.xlsx – a salary sheet the EPF & ESI tool can import. (The tool also reads the
firm's own salary working sheet: it finds the header row with "UAN" and "Employee Name".)

    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py
"""
import os
from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "PF_ESI_salary_template.xlsx")
HEAD = Font(bold=True, color="FFFFFF")
FILL = PatternFill("solid", fgColor="1F5FAE")
BAD = PatternFill("solid", fgColor="F8D7DA")
THIN = Side(style="thin", color="B7BEC9")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
COLS = [
    ("Employee ID", 11, "@"), ("Employee Name", 28, "@"), ("UAN No(PF)", 15, "@"), ("Member ID(ESI)", 14, "@"),
    ("Department", 14, "@"), ("Designation", 18, "@"), ("Date of Birth", 12, "DD/MM/YYYY"),
    ("Gross Salary", 13, "#,##,##0"), ("Basic+DA (PF wages)", 14, "#,##,##0"), ("NCP Days", 9, "0"), ("Days Paid (ESI)", 10, "0"),
    ("ESI Applicable (Auto/Yes/No)", 13, "@"), ("EPS Member (Yes/No)", 11, "@"), ("PF on higher wages (Yes/No)", 12, "@"), ("PF Applicable (Yes/No)", 11, "@"),
    ("Reason Code (ESI, zero days)", 12, "@"), ("Last Working Day", 12, "DD/MM/YYYY"), ("Refund of Advances", 11, "#,##,##0"), ("Check", 32, "@"),
]


def build():
    wb = Workbook()
    ins = wb.active
    ins.title = "Instructions"
    for i, (t, b) in enumerate([
        ("EPF & ESI – monthly salary template", True), ("", False),
        ("One row per employee for the wage month. Gross Salary = total wages earned for the month; Basic+DA = wages for PF.", False),
        ("NCP Days = days without pay (non-contributory). Days Paid (ESI) = days for which wages are paid (blank = days in month less NCP days).", False),
        ("ESI Applicable: Auto (decided by the IP number and the ESI ceiling), Yes (covered for the contribution period), No.", False),
        ("EPS Member: No for members not eligible for pension (e.g. joined after 01-09-2014 with wages above the ceiling then).", False),
        ("PF on higher wages: Yes where contribution is on actual wages above the ceiling (EPS stays capped).", False),
        ("Reason Code: only when Days Paid is 0 (e.g. 2 = left service, 1 = on leave). Last Working Day is needed for codes 2, 3, 4, 5, 6 and 10.", False),
        ("The 'Check' column flags a UAN that is not 12 digits or an IP number that is not 10 digits.", False),
    ], 1):
        ins.cell(row=i, column=1, value=t).font = Font(bold=b, size=13 if i == 1 else 11)
    ins.column_dimensions["A"].width = 140
    ws = wb.create_sheet("Salary")
    for i, (h, w, f) in enumerate(COLS, 1):
        c = ws.cell(row=1, column=i, value=h)
        c.font, c.fill, c.border, c.alignment = HEAD, FILL, BOX, Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[c.column_letter].width = w
    ws.row_dimensions[1].height = 42
    ws.freeze_panes = "C2"
    for r in range(2, 202):
        for i, (h, w, f) in enumerate(COLS, 1):
            c = ws.cell(row=r, column=i)
            c.border, c.number_format = BOX, f
        ws.cell(row=r, column=len(COLS), value=f'=IF(B{r}="","",IF(AND(C{r}<>"",LEN(SUBSTITUTE(C{r}," ",""))<>12),"UAN must have 12 digits",IF(AND(D{r}<>"",LEN(SUBSTITUTE(D{r}," ",""))<>10),"IP No. must have 10 digits","OK")))')
    for col, items in (("L", ["Auto", "Yes", "No"]), ("M", ["Yes", "No"]), ("N", ["No", "Yes"]), ("O", ["Yes", "No"]), ("P", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"])):
        dv = DataValidation(type="list", formula1='"' + ",".join(items) + '"', allow_blank=True)
        ws.add_data_validation(dv)
        dv.add(f"{col}2:{col}201")
    ws.conditional_formatting.add("S2:S201", FormulaRule(formula=['AND(S2<>"",S2<>"OK")'], fill=BAD))
    wb.active = 1
    wb.save(OUT)
    print("Written", os.path.abspath(OUT))


if __name__ == "__main__":
    build()
