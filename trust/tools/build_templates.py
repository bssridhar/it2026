"""
Builds the Word templates in ../templates for the Trust tool:

    trust_deed.docx  – trust deed in the firm's format. The body is a list of "blocks" composed by index.html,
                       so clause numbering stays right when objects or clauses are added or removed.
    letter.docx      – letters and resolutions (NOC for the office, trustees' resolution for the bank account)
    sheet.docx       – data sheets and checklists (PAN application, Form 104, formalities checklist)

    python3 tools/build_templates.py
    python3 tools/build_excel_template.py
    python3 tools/embed_templates.py
"""
import os

import docx
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "templates")
FONT = "Times New Roman"


def base(size=12, spacing=1.5, margins=(2.54, 2.54, 3.17, 3.17)):
    d = docx.Document()
    st = d.styles["Normal"]
    st.font.name = FONT
    st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    st.font.size = Pt(size)
    st.paragraph_format.space_after = Pt(6)
    st.paragraph_format.line_spacing = spacing
    s = d.sections[0]
    s.page_width, s.page_height = Cm(21), Cm(29.7)
    s.top_margin, s.bottom_margin, s.left_margin, s.right_margin = [Cm(x) for x in margins]
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


def page_footer(d):
    p = d.sections[0].footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for txt, ins in (("Page ", None), (None, "PAGE"), (" of ", None), (None, "NUMPAGES")):
        r = p.add_run(txt or "")
        r.font.size = Pt(10)
        if ins:
            field(r, ins)


def para(d, text="", bold=False, align="j", before=0, after=6, left=None, hanging=None, keep=False, size=None, underline=False, tab=None):
    p = d.add_paragraph()
    if text:
        r = p.add_run(text)
        r.bold = bold
        r.underline = underline
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
    return p


def tag(d, t):
    return para(d, t, after=0, align="l")


def borders(t, val="single"):
    tblPr = t._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{side}")
        e.set(qn("w:val"), val); e.set(qn("w:sz"), "4"); e.set(qn("w:color"), "000000")
        b.append(e)
    tblPr.append(b)


def table(d, widths, rows, bordered=True, header=True, size=None, spacing=1.0):
    t = d.add_table(rows=0, cols=len(widths))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for i, c in enumerate(row):
            cells[i].width = widths[i]
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = spacing
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(c)
            r.bold = header and ri == 0
            if size:
                r.font.size = Pt(size)
    for gc, w in zip(t._tbl.tblGrid.findall(qn("w:gridCol")), widths):
        gc.set(qn("w:w"), str(int(w.twips)))
    borders(t, "single" if bordered else "nil")
    return t


# ---------------------------------------------------------------- trust deed
def deed():
    d = base(12, 1.5)
    s = d.sections[0]
    s.page_width, s.page_height = Cm(21.59), Cm(27.94)   # Letter, as in the firm's format; the tool can switch to A4 / Legal
    page_footer(d)
    para(d, "TRUST DEED OF", bold=True, align="c", after=6, size=13)
    para(d, "{trust_name_upper}", bold=True, align="c", after=18, size=13)
    para(d, "{intro}", after=10, tab=1.27)
    tag(d, "{#founders}")
    para(d, "{n}.\t{text}", left=1.27, hanging=0.63, after=8, tab=1.27)
    tag(d, "{/founders}")
    para(d, "", after=0).add_run("hereinafter called ")
    d.paragraphs[-1].add_run("{founders_called}").bold = True
    d.paragraphs[-1].paragraph_format.space_after = Pt(12)

    tag(d, "{#blocks}")
    # plain paragraph
    tag(d, "{#l0}"); para(d, "{text}", after=10); tag(d, "{/l0}")
    tag(d, "{#l0b}"); para(d, "{text}", bold=True, after=10, keep=True); tag(d, "{/l0b}")
    # numbered clause 1., 2.
    tag(d, "{#l1}"); para(d, "{num}\t{text}", left=1.27, hanging=1.27, after=10, tab=1.27); tag(d, "{/l1}")
    tag(d, "{#l1b}")
    p = para(d, "", left=1.27, hanging=1.27, after=8, tab=1.27, keep=True)
    p.add_run("{num}\t"); p.add_run("{text}").bold = True
    tag(d, "{/l1b}")
    # (a), a) level
    tag(d, "{#l2}"); para(d, "{num}\t{text}", left=2.29, hanging=1.02, after=8, tab=2.29); tag(d, "{/l2}")
    tag(d, "{#l2b}")
    p = para(d, "", left=2.29, hanging=1.02, after=6, tab=2.29, keep=True)
    p.add_run("{num}\t"); p.add_run("{text}").bold = True
    tag(d, "{/l2b}")
    tag(d, "{#l2l}"); para(d, "{num}\t{text}", left=2.29, hanging=1.02, after=10, tab=2.29, align="l"); tag(d, "{/l2l}")
    # sub-objects under a heading
    tag(d, "{#l3}"); para(d, "{num}\t{text}", left=3.05, hanging=0.76, after=6, tab=3.05); tag(d, "{/l3}")
    # first trustees table
    tag(d, "{#trustees}")
    table(d, [Cm(1.4), Cm(5.6), Cm(3.6), Cm(4.4)], [["Sl. No", "Name of the Member", "Aadhaar No.", "Position"],
                                                    ["{#rows}{n}", "{name}", "{aadhaar}", "{position}{/rows}"]])
    para(d, "", after=6)
    tag(d, "{/trustees}")
    tag(d, "{/blocks}")

    para(d, "IN WITNESS WHEREOF THE {founder_word} AND THE TRUSTEE(S) HEREIN HAVE SET THEIR HANDS THIS DAY AND YEAR ABOVE MENTIONED.", bold=True, before=12, after=12)
    para(d, "ACCEPTED", bold=True, after=0, keep=True)
    tag(d, "{#signs}")
    para(d, "({name_upper})", bold=False, align="r", before=42, after=0)
    para(d, "{position}", align="r", after=6, size=10)
    tag(d, "{/signs}")
    para(d, "WITNESS:-", bold=True, before=12, after=8, keep=True)
    tag(d, "{#witnesses}")
    para(d, "{n}.\t{text}", left=1.27, hanging=1.27, after=24, tab=1.27, align="l")
    tag(d, "{/witnesses}")
    d.save(os.path.join(OUT, "trust_deed.docx"))


# ---------------------------------------------------------------- letter / resolution
def letter():
    d = base(12, 1.15, (2.2, 2.2, 2.5, 2.5))
    tag(d, "{#head}"); para(d, "{head}", bold=True, align="c", after=12, size=12); tag(d, "{/head}")
    tag(d, "{#date_line}"); para(d, "{date_line}", align="r", after=10); tag(d, "{/date_line}")
    tag(d, "{#to}"); para(d, "To,", align="l", after=0); para(d, "{to}", align="l", after=12); tag(d, "{/to}")
    tag(d, "{#subject}")
    p = para(d, "", align="l", after=12); p.add_run("Sub: ").bold = True; p.add_run("{subject}").bold = True
    tag(d, "{/subject}")
    tag(d, "{#salutation}"); para(d, "{salutation}", align="l", after=8); tag(d, "{/salutation}")
    tag(d, "{#paras}"); para(d, "{.}", after=10); tag(d, "{/paras}")
    tag(d, "{#resolved}"); para(d, "{.}", left=1.0, after=10); tag(d, "{/resolved}")
    tag(d, "{#after_head}"); para(d, "{after_head}", bold=True, align="l", before=8, after=6); tag(d, "{/after_head}")
    tag(d, "{#after}"); para(d, "{.}", align="l", after=14, left=0.6); tag(d, "{/after}")
    tag(d, "{#closing}"); para(d, "{closing}", align="l", before=6, after=36); tag(d, "{/closing}")
    para(d, "{sign}", align="l", after=12)
    tag(d, "{#place_date}"); para(d, "{place_date}", align="l", after=10); tag(d, "{/place_date}")
    tag(d, "{#hasEncl}"); para(d, "Enclosures:", bold=True, align="l", before=8, after=2); tag(d, "{/hasEncl}")
    tag(d, "{#encl}"); para(d, "{n}. {text}", align="l", after=2, left=0.6); tag(d, "{/encl}")
    d.save(os.path.join(OUT, "letter.docx"))


# ---------------------------------------------------------------- data sheet / checklist
def sheet():
    d = base(10.5, 1.0, (1.6, 1.6, 1.8, 1.8))
    page_footer(d)
    para(d, "{title}", bold=True, align="c", after=2, size=14)
    para(d, "{subtitle}", bold=True, align="c", after=2, size=11.5)
    para(d, "{meta}", align="c", after=10, size=8.5)
    tag(d, "{#secs}")
    para(d, "{heading}", bold=True, align="l", before=10, after=4, keep=True, size=11.5)
    tag(d, "{#note}"); para(d, "{note}", align="j", after=6, size=9.5); tag(d, "{/note}")
    tag(d, "{#hasKv}")
    table(d, [Cm(6.4), Cm(11)], [["{#kv}{k}", "{v}{/kv}"]], header=False)
    tag(d, "{/hasKv}")
    tag(d, "{#grid}")
    table(d, [Cm(1), Cm(4.4), Cm(3.4), Cm(3.4), Cm(5.2)], [["{h1}", "{h2}", "{h3}", "{h4}", "{h5}"],
                                                         ["{#rows}{c1}", "{c2}", "{c3}", "{c4}", "{c5}{/rows}"]], size=9.5)
    tag(d, "{/grid}")
    tag(d, "{#items}"); para(d, "☐  {.}", align="l", after=3, left=0.6, hanging=0.6); tag(d, "{/items}")
    tag(d, "{#bullets}"); para(d, "•  {.}", align="j", after=3, left=0.6, hanging=0.6, size=9.5); tag(d, "{/bullets}")
    tag(d, "{#paras}"); para(d, "{.}", align="j", after=6); tag(d, "{/paras}")
    tag(d, "{/secs}")
    d.save(os.path.join(OUT, "sheet.docx"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    deed()
    letter()
    sheet()
    print("Templates written to", os.path.abspath(OUT))
