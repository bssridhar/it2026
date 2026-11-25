"""
Builds templates/roc_doc.docx – one general Word template for every document of the ROC compliance tool.
The body is a list of blocks composed by lib/compose.js (title, heading, paragraph, numbered line, tables,
signature block, page break), with an optional letter-head of the company at the top.

    python3 tools/build_templates.py
    python3 tools/embed_templates.py
"""
import os

import docx
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "templates")
FONT = "Times New Roman"


def base():
    d = docx.Document()
    st = d.styles["Normal"]
    st.font.name = FONT
    st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    st.font.size = Pt(11.5)
    st.paragraph_format.space_after = Pt(6)
    st.paragraph_format.line_spacing = 1.15
    s = d.sections[0]
    s.page_width, s.page_height = Cm(21), Cm(29.7)
    s.top_margin, s.bottom_margin, s.left_margin, s.right_margin = Cm(2), Cm(2), Cm(2.5), Cm(2)
    d.core_properties.author = ""
    d.core_properties.title = ""
    return d


def field(run, instr):
    for t, v in (("begin", None), ("instr", instr), ("separate", None), ("end", None)):
        if t == "instr":
            e = OxmlElement("w:instrText"); e.set(qn("xml:space"), "preserve"); e.text = v
        else:
            e = OxmlElement("w:fldChar"); e.set(qn("w:fldCharType"), t)
        run._r.append(e)
        if t == "separate":
            tt = OxmlElement("w:t"); tt.text = "1"; run._r.append(tt)


def footer(d):
    p = d.sections[0].footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for txt, ins in (("Page ", None), (None, "PAGE"), (" of ", None), (None, "NUMPAGES")):
        r = p.add_run(txt or ""); r.font.size = Pt(9)
        if ins:
            field(r, ins)


def para(d, text="", bold=False, align="j", before=0, after=6, left=None, hanging=None, keep=False, size=None, tab=None, italic=False, border_bottom=False):
    p = d.add_paragraph()
    if text:
        r = p.add_run(text); r.bold = bold; r.italic = italic
        if size:
            r.font.size = Pt(size)
    pf = p.paragraph_format
    pf.space_before, pf.space_after = Pt(before), Pt(after)
    p.alignment = {"c": WD_ALIGN_PARAGRAPH.CENTER, "j": WD_ALIGN_PARAGRAPH.JUSTIFY, "l": WD_ALIGN_PARAGRAPH.LEFT, "r": WD_ALIGN_PARAGRAPH.RIGHT}[align]
    if left is not None:
        pf.left_indent = Cm(left)
    if hanging:
        pf.first_line_indent = Cm(-hanging)
    if tab is not None:
        pf.tab_stops.add_tab_stop(Cm(tab), WD_TAB_ALIGNMENT.LEFT)
    if keep:
        pf.keep_with_next = True
    if border_bottom:
        pPr = p._p.get_or_add_pPr(); b = OxmlElement("w:pBdr"); e = OxmlElement("w:bottom")
        for k, v in (("w:val", "single"), ("w:sz", "8"), ("w:space", "4"), ("w:color", "444444")):
            e.set(qn(k), v)
        b.append(e); pPr.append(b)
    return p


def tag(d, t):
    p = d.add_paragraph(t); p.paragraph_format.space_after = Pt(0)


def table(d, widths, rows, header=True, size=10.5):
    t = d.add_table(rows=len(rows), cols=len(widths))
    t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for j, w in enumerate(widths):
        t.columns[j].width = w
    # fixed layout, so that Word and LibreOffice keep the column widths
    tblPr = t._tbl.tblPr; lay = OxmlElement("w:tblLayout"); lay.set(qn("w:type"), "fixed"); tblPr.append(lay)
    for i, row in enumerate(rows):
        for j, txt in enumerate(row):
            c = t.cell(i, j); c.width = widths[j]
            p = c.paragraphs[0]; r = p.add_run(txt); r.font.size = Pt(size)
            p.paragraph_format.space_after = Pt(2); p.paragraph_format.line_spacing = 1.0
            if header and i == 0:
                r.bold = True
    return t


def build():
    d = base()
    footer(d)
    # letter-head of the company (optional)
    tag(d, "{#lh}")
    para(d, "{lh_name}", bold=True, align="c", after=0, size=14)
    para(d, "{lh_line}", align="c", after=0, size=9.5)
    para(d, "{lh_line2}", align="c", after=12, size=9.5, border_bottom=True)
    tag(d, "{/lh}")
    tag(d, "{#blocks}")
    tag(d, "{#title}"); para(d, "{text}", bold=True, align="c", after=4, size=12.5, keep=True); tag(d, "{/title}")
    tag(d, "{#sub}"); para(d, "{text}", align="c", after=10, size=10, italic=True, keep=True); tag(d, "{/sub}")
    tag(d, "{#h}"); para(d, "{text}", bold=True, align="l", before=8, after=4, keep=True); tag(d, "{/h}")
    tag(d, "{#p}"); para(d, "{text}", after=8); tag(d, "{/p}")
    tag(d, "{#pl}"); para(d, "{text}", align="l", after=4); tag(d, "{/pl}")
    tag(d, "{#pr}"); para(d, "{text}", align="r", after=4); tag(d, "{/pr}")
    tag(d, "{#pb}"); para(d, "{text}", bold=True, after=8, keep=True); tag(d, "{/pb}")
    tag(d, "{#res}"); para(d, "{text}", after=8, left=0.5); tag(d, "{/res}")
    tag(d, "{#n}"); para(d, "{num}\t{text}", left=1.0, hanging=1.0, after=5, tab=1.0); tag(d, "{/n}")
    tag(d, "{#n2}"); para(d, "{num}\t{text}", left=2.0, hanging=1.0, after=4, tab=2.0); tag(d, "{/n2}")
    tag(d, "{#note}"); para(d, "{text}", align="l", after=6, size=9, italic=True); tag(d, "{/note}")
    # two-column table: label – value
    tag(d, "{#kv}")
    table(d, [Cm(6.5), Cm(10.0)], [["{#rows}{k}", "{v}{/rows}"]], header=False)
    para(d, "", after=6)
    tag(d, "{/kv}")
    # three-column table with heading row
    tag(d, "{#t3}")
    table(d, [Cm(1.3), Cm(8.6), Cm(6.6)], [["{h1}", "{h2}", "{h3}"], ["{#rows}{c1}", "{c2}", "{c3}{/rows}"]])
    para(d, "", after=6)
    tag(d, "{/t3}")
    # four-column table with heading row
    tag(d, "{#t4}")
    table(d, [Cm(1.2), Cm(6.6), Cm(4.4), Cm(4.3)], [["{h1}", "{h2}", "{h3}", "{h4}"], ["{#rows}{c1}", "{c2}", "{c3}", "{c4}{/rows}"]])
    para(d, "", after=6)
    tag(d, "{/t4}")
    # five-column table with heading row
    tag(d, "{#t5}")
    table(d, [Cm(1.1), Cm(5.4), Cm(3.6), Cm(3.0), Cm(3.4)], [["{h1}", "{h2}", "{h3}", "{h4}", "{h5}"], ["{#rows}{c1}", "{c2}", "{c3}", "{c4}", "{c5}{/rows}"]], size=10)
    para(d, "", after=6)
    tag(d, "{/t5}")
    # signature block (right or left)
    tag(d, "{#sign}")
    para(d, "{for_line}", align="{al}" if False else "l", before=10, after=36, keep=True)
    para(d, "{name}", bold=True, align="l", after=0, keep=True)
    para(d, "{line1}", align="l", after=0, keep=True)
    para(d, "{line2}", align="l", after=8)
    tag(d, "{/sign}")
    tag(d, "{#space}"); para(d, "", after=14); tag(d, "{/space}")
    tag(d, "{#brk}")
    p = d.add_paragraph(); p.add_run().add_break(WD_BREAK.PAGE); p.paragraph_format.space_after = Pt(0)
    tag(d, "{/brk}")
    tag(d, "{/blocks}")
    os.makedirs(OUT, exist_ok=True)
    d.save(os.path.join(OUT, "roc_doc.docx"))
    print("Written roc_doc.docx")


if __name__ == "__main__":
    build()
