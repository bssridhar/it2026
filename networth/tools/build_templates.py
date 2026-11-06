"""
Builds the net worth certificate templates in ../templates.

    python3 tools/build_templates.py <firm's sample certificate .docx>
    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py

The firm's letterhead (the header of the sample, with its logo) is kept as it is. The body is rebuilt from
the sample's wording with {placeholders}; the sample's client details are not kept. Two versions are made:
certificate.docx (with the letterhead) and certificate_plain.docx (no header, for pre-printed letterhead paper).
"""
import copy
import os
import sys

import docx
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "templates")
FONT = "Times New Roman"


def clear_body(d):
    body = d.element.body
    for el in list(body):
        if el.tag != qn("w:sectPr"):
            body.remove(el)


def para(d, runs=(), align=None, before=0, after=4, indent=None, keep=False, border=False, size=None):
    p = d.add_paragraph()
    if isinstance(runs, str):
        runs = [(runs, False)]
    for item in runs:
        text, bold = item[0], item[1]
        r = p.add_run(text)
        r.bold = bold
        if len(item) > 2 and item[2]:
            r.underline = True
        if size:
            r.font.size = Pt(size)
    pf = p.paragraph_format
    pf.space_before, pf.space_after = Pt(before), Pt(after)
    if align:
        p.alignment = {"c": WD_ALIGN_PARAGRAPH.CENTER, "j": WD_ALIGN_PARAGRAPH.JUSTIFY, "r": WD_ALIGN_PARAGRAPH.RIGHT, "l": WD_ALIGN_PARAGRAPH.LEFT}[align]
    if indent is not None:
        pf.left_indent = Cm(indent)
    if keep:
        pf.keep_with_next = True
    if border:
        pPr = p._p.get_or_add_pPr()
        bdr = OxmlElement("w:pBdr")
        for side in ("top", "left", "bottom", "right"):
            e = OxmlElement(f"w:{side}")
            e.set(qn("w:val"), "single"); e.set(qn("w:sz"), "6"); e.set(qn("w:space"), "2"); e.set(qn("w:color"), "000000")
            bdr.append(e)
        pPr.append(bdr)
    return p


def table(d, widths, rows, borders=None):
    """rows: list of rows; a row is a list of (text, bold, align) cells."""
    t = d.add_table(rows=0, cols=len(widths))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for row in rows:
        cells = t.add_row().cells
        for i, c in enumerate(row):
            cells[i].width = widths[i]
            text, bold, align = (c + (None, None))[:3] if isinstance(c, tuple) else (c, False, None)
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            if align:
                p.alignment = {"r": WD_ALIGN_PARAGRAPH.RIGHT, "c": WD_ALIGN_PARAGRAPH.CENTER}[align]
            r = p.add_run(text)
            r.bold = bool(bold)
    for gc, w in zip(t._tbl.tblGrid.findall(qn("w:gridCol")), widths):
        gc.set(qn("w:w"), str(int(w.twips)))
    if borders:
        tblPr = t._tbl.tblPr
        b = OxmlElement("w:tblBorders")
        for side in borders:
            e = OxmlElement(f"w:{side}")
            e.set(qn("w:val"), "single"); e.set(qn("w:sz"), "6"); e.set(qn("w:color"), "000000")
            b.append(e)
        tblPr.append(b)
    return t


def row_border(row, sides=("top", "bottom")):
    for c in row.cells:
        tcPr = c._tc.get_or_add_tcPr()
        b = OxmlElement("w:tcBorders")
        for s in sides:
            e = OxmlElement(f"w:{s}")
            e.set(qn("w:val"), "single"); e.set(qn("w:sz"), "6"); e.set(qn("w:color"), "000000")
            b.append(e)
        tcPr.append(b)


def signature(d):
    para(d, [("Conversion Rate assumed 1 {cur} = {rate} INR", False)], before=10, after=8, keep=True)
    sig = table(d, [Cm(8.5), Cm(8.5)], [
        ["", ("As per Information and Documents", False, "c")],
        ["", ("Produced before us.", False, "c")],
        ["", ("For {firm_name}", True, "c")],
        ["", ("{firm_tag}", True, "c")],
        ["", ""], ["", ""],
        ["{place}", ("({signatory_upper})", True, "c")],
        ["{date}", ("{designation}", True, "c")],
        ["", ("Membership No: {membership_no}", True, "c")],
        ["", ("UDIN: {udin}", False, "c")],
    ])
    # keep the signature block together on one page
    for row in sig.rows[:-1]:
        for cell in row.cells:
            for p in cell.paragraphs:
                p.paragraph_format.keep_with_next = True
    return sig


def build(src, plain):
    d = docx.Document(src)
    clear_body(d)
    st = d.styles["Normal"]
    st.font.name = FONT
    st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    st.font.size = Pt(11)
    if plain:
        sec = d.sections[0]
        for p in sec.header.paragraphs:
            p._p.getparent().remove(p._p)
        sectPr = sec._sectPr
        for ref in sectPr.findall(qn("w:headerReference")):
            sectPr.remove(ref)
        sec.top_margin = Cm(5)

    para(d, [("CHARTERED ACCOUNTANT’S CERTIFICATE", True, True)], align="c", after=0)
    para(d, [("TO WHOMSOEVER IT MAY CONCERN", True, True)], align="c", after=12)
    para(d, [("I, ", False), ("{signatory_title} {signatory_upper}", True), (", {member_text}, certify that I have reviewed the financial condition of ", False),
             ("{persons_text}", True), (", residing at ", False), ("{address_inline}", True),
             (" with a view of establishing their ability to meet {purpose}.", False)], align="j", after=12)

    # summary
    t = table(d, [Cm(9.5), Cm(3.5), Cm(3.5)], [
        [("Source of Funds", True), ("{cur}", True, "r"), ("INR", True, "r")],
        ["{#summary}{n}.  {title}", ("{fc}", False, "r"), ("{inr}{/summary}", False, "r")],
        [("TOTAL", True), ("{total_fc} {cur}", True, "r"), ("{total_inr}", True, "r")],
    ])
    row_border(t.rows[0], ("top", "bottom"))
    row_border(t.rows[2], ("top", "bottom"))
    para(d, "(In Words Rupees {total_inr_words} only)", before=6, after=0)
    para(d, "(In words {cur} {total_fc_words} only)", after=0)
    signature(d)

    # annexure on a new page
    p = para(d, "")
    p.runs and None
    p.add_run().add_break(WD_BREAK.PAGE)
    para(d, "The following documents were reviewed to support the above statement:-", after=10)
    para(d, "{#sections}", after=0)
    para(d, [("{annex_title} (Amt. in Rs.)", True)], border=True, before=8, after=8, keep=True)
    para(d, "{#groups}", after=0)
    para(d, [("{sub}", True)], before=4, after=4, keep=True)
    table(d, [Cm(13), Cm(3.5)], [["{#items}{desc}", ("{amount}{/items}", False, "r")]])
    para(d, "{/groups}", after=0)
    tt = table(d, [Cm(10), Cm(3.5), Cm(3)], [[("Total", True, "c"), ("{fc} {cur}", True, "r"), ("{inr}", True, "r")]])
    row_border(tt.rows[0], ("top", "bottom"))
    para(d, "{/sections}", after=0)
    signature(d)
    d.core_properties.author = ""
    d.core_properties.last_modified_by = ""
    d.core_properties.title = ""
    name = "certificate_plain.docx" if plain else "certificate.docx"
    d.save(os.path.join(OUT, name))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python3 build_templates.py <sample certificate .docx>")
    os.makedirs(OUT, exist_ok=True)
    build(sys.argv[1], plain=False)
    build(sys.argv[1], plain=True)
    print("Templates written to", os.path.abspath(OUT))
