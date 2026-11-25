"""
Builds the Word templates in ../templates for the HUF tool:

    affidavit.docx      – Affidavit for HUF (stamp paper), in the firm's format
    pan_datasheet.docx  – data sheet for the PAN application of the HUF

    python3 tools/build_templates.py
    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py

Placeholders are filled by index.html with docxtemplater. The space at the top of the first page (for the
stamp paper) is a paragraph with "space before" = 1111 twips, which the tool replaces with the height chosen;
the page size is set by the tool as well.
"""
import os

import docx
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, Twips

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "templates")
FONT = "Times New Roman"


def base_doc(size=12):
    d = docx.Document()
    st = d.styles["Normal"]
    st.font.name = FONT
    st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    st.font.size = Pt(size)
    st.paragraph_format.space_after = Pt(6)
    st.paragraph_format.line_spacing = 1.15
    s = d.sections[0]
    s.page_width, s.page_height = Twips(12240), Twips(15840)   # Letter, as in the firm's format; the tool can change it
    s.top_margin, s.bottom_margin, s.left_margin, s.right_margin = Cm(2.6), Cm(2.6), Cm(2.54), Cm(2.54)
    d.core_properties.author = ""
    d.core_properties.title = ""
    return d


def para(d, runs, align=None, before=0, after=6, keep=False, size=None):
    p = d.add_paragraph()
    if isinstance(runs, str):
        runs = [(runs, False)]
    for item in runs:
        r = p.add_run(item[0])
        r.bold = item[1]
        if len(item) > 2 and item[2]:
            r.underline = True
        if size:
            r.font.size = Pt(size)
    pf = p.paragraph_format
    pf.space_before, pf.space_after = Pt(before), Pt(after)
    if align:
        p.alignment = {"c": WD_ALIGN_PARAGRAPH.CENTER, "j": WD_ALIGN_PARAGRAPH.JUSTIFY, "r": WD_ALIGN_PARAGRAPH.RIGHT, "l": WD_ALIGN_PARAGRAPH.LEFT}[align]
    if keep:
        pf.keep_with_next = True
    return p


def borders(t, val="single"):
    tblPr = t._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{side}")
        e.set(qn("w:val"), val); e.set(qn("w:sz"), "4"); e.set(qn("w:color"), "000000")
        b.append(e)
    tblPr.append(b)


def table(d, widths, rows, bordered=True, bold_first=False):
    t = d.add_table(rows=0, cols=len(widths))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for i, c in enumerate(row):
            text, bold, align = (c + (False, None))[:3] if isinstance(c, tuple) else (c, False, None)
            cells[i].width = widths[i]
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.0
            if align:
                p.alignment = {"r": WD_ALIGN_PARAGRAPH.RIGHT, "c": WD_ALIGN_PARAGRAPH.CENTER}[align]
            r = p.add_run(text)
            r.bold = bool(bold) or (bold_first and ri == 0)
    for gc, w in zip(t._tbl.tblGrid.findall(qn("w:gridCol")), widths):
        gc.set(qn("w:w"), str(int(w.twips)))
    borders(t, "single" if bordered else "nil")
    return t


def affidavit():
    d = base_doc(12)
    # space at the top of the first page for the stamp paper (replaced by the tool)
    p = para(d, "", after=0)
    p.paragraph_format.space_before = Twips(1111)
    para(d, [("AFFIDAVIT FOR HUF", True, True)], align="c", before=6, after=12)
    para(d, [("I, ", False), ("{karta_name}", True), (" (Karta), {karta_rel} {karta_father}, aged about {karta_age} years, residing at {karta_address_inline} and as Karta of my Hindu Undivided Family (HUF) affirm on oath and declare as under: –", False)], align="j", after=10)
    para(d, [("1.  That I am Karta of our HUF which is known as ", False), ("{huf_name}", True), (".", False)], align="j", after=10)
    para(d, "{#newpage}", after=0)
    p = para(d, "", after=0)
    p.add_run().add_break(WD_BREAK.PAGE)
    para(d, "{/newpage}", after=0)
    para(d, "2.  That, at present the HUF consists of the following persons : –", align="j", before=6, after=8, keep=True)
    table(d, [Cm(1.4), Cm(6), Cm(3.6), Cm(5.4)], [
        [("Sr. No.", True), ("{col_head}", True), ("Name of Father", True), ("Address", True)],
        ["{#members}{n}", "{name_cell}", "{father}", "{address}{/members}"],
    ])
    para(d, "", after=4)
    para(d, "{#clauses}", after=0)
    para(d, "{n}.  {text}", align="j", after=8)
    para(d, "{/clauses}", after=0)
    para(d, "", after=18)
    table(d, [Cm(9), Cm(7.5)], [
        ["Place : {place}", ("({karta_name})", False, "c")],
        ["Date : {aff_date}", ("Deponent", False, "c")],
    ], bordered=False)
    para(d, "", after=24)
    para(d, [("VERIFICATION", True, True)], align="c", before=12, after=12, keep=True)
    para(d, "I, {karta_name}, {karta_rel} {karta_father}, aged {karta_age} years, residing at {karta_address_inline} hereby verify that as per my best of my knowledge above mentioned contents of this affidavit are true and correct and nothing is hidden there in.", align="j", after=30, keep=True)
    table(d, [Cm(9), Cm(7.5)], [
        ["", ("({karta_name})", False, "c")],
        ["", ("Karta", False, "c")],
        ["Place : {place}", ""],
        ["Date : {aff_date}", ""],
    ], bordered=False)
    d.save(os.path.join(OUT, "affidavit.docx"))


def datasheet():
    d = base_doc(11)
    s = d.sections[0]
    s.page_width, s.page_height = Twips(11906), Twips(16838)   # A4
    s.top_margin = s.bottom_margin = Cm(1.8)
    s.left_margin = s.right_margin = Cm(2)
    para(d, [("PAN APPLICATION – DATA SHEET", True)], align="c", after=2, size=14)
    para(d, [("{huf_name}", True)], align="c", after=2, size=12)
    para(d, "Hindu Undivided Family · Prepared on {today}{ref_text}", align="c", after=10, size=9)
    para(d, "{#secs}", after=0)
    para(d, [("{title}", True)], before=8, after=4, keep=True)
    table(d, [Cm(6.5), Cm(10.5)], [["{#rows}{label}", "{value}{/rows}"]])
    para(d, "{/secs}", after=0)
    para(d, [("Members of the HUF (as in the affidavit)", True)], before=10, after=4, keep=True)
    table(d, [Cm(1.2), Cm(5.2), Cm(3.4), Cm(3.4), Cm(3.8)], [
        [("No.", True), ("Name", True), ("Relationship", True), ("Father's name", True), ("Aadhaar / DOB", True)],
        ["{#members}{n}", "{name}", "{relation}", "{father}", "{aadhaar_dob}{/members}"],
    ])
    para(d, [("Documents to attach", True)], before=10, after=4, keep=True)
    para(d, "{#docs}", after=0)
    para(d, "☐  {.}", after=2)
    para(d, "{/docs}", after=0)
    para(d, [("Points to check", True)], before=10, after=4, keep=True)
    para(d, "{#notes}", after=0)
    para(d, "•  {.}", after=2, size=10)
    para(d, "{/notes}", after=0)
    d.save(os.path.join(OUT, "pan_datasheet.docx"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    affidavit()
    datasheet()
    print("Templates written to", os.path.abspath(OUT))
