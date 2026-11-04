"""
Builds the fill-in templates in ../templates from the firm's sample documents.

Usage:  python3 build_templates.py <folder-with-samples>

The sample (filled) documents contain client data and are NOT kept in this
repository. Only the resulting templates, which contain {placeholders}
instead of client data, are committed.

Placeholders use docxtemplater syntax: {tag}. Loops: {#partners}...{/partners}.
"""
import sys, os, re
import docx
from docx.shared import Pt, Cm, Mm
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates")


def find(folder, needle):
    for f in os.listdir(folder):
        if needle.lower() in f.lower() and f.endswith(".docx"):
            return os.path.join(folder, f)
    raise SystemExit(f"Sample containing '{needle}' (.docx) not found in {folder}")


def set_runs(p, texts):
    """Assign texts to the paragraph's runs by index; runs beyond len(texts) are emptied."""
    runs = p.runs
    for i, r in enumerate(runs):
        r.text = texts[i] if i < len(texts) else ""


def delete_par(p):
    p._element.getparent().remove(p._element)


def cell_par(table, r, c, i=0):
    return table.rows[r].cells[c].paragraphs[i]


def scrub_props(d):
    cp = d.core_properties
    cp.author = ""
    cp.last_modified_by = ""
    cp.title = ""
    cp.comments = ""


# ---------------------------------------------------------------- Form 9
def build_form9():
    d = docx.Document(find(SRC, "form-9"))
    P = d.paragraphs
    # To, M/s. <LLP> (Under Incorporation)
    set_runs(P[4], ["M/s. ", "{llp_name_upper}", " ", "(", "Under Incorporation)"])
    # Proposed address: one paragraph with line breaks
    set_runs(P[5], ["{llp_address}"])
    P[5].alignment = WD_ALIGN_PARAGRAPH.LEFT
    # Sub / body
    r = P[10].runs
    texts = [x.text for x in r]
    texts[1] = "{name_upper}"
    texts[6] = "{llp_name_upper}"
    set_runs(P[10], texts)
    # Enclosures
    set_runs(P[15], ["Enclosed:", " – Proof of Identity – {id_proof}"])
    set_runs(P[16], [P[16].runs[0].text.split("Proof")[0] + "Proof of Address – {address_proof}"])
    delete_par(P[7])
    delete_par(P[6])

    t = d.tables[0]
    vals = {
        1: [" ", "{dpin}"],
        2: [" ", "{name_upper}"],
        3: ["{father_name_upper}"],
        5: None,
        6: ["{mobile}"],
        7: ["{pan}"],
        8: ["{occupation}"],
        9: ["{dob}"],
        10: ["{nationality}"],
        11: ["{nominee_of}"],
        12: ["{prof_membership}"],
    }
    for row, tx in vals.items():
        if tx:
            set_runs(cell_par(t, row, 2), tx)
    # Address (two paragraphs -> one)
    set_runs(cell_par(t, 4, 2, 0), ["{address}"])
    delete_par(cell_par(t, 4, 2, 1))
    # E-mail (value is in paragraph 1)
    set_runs(cell_par(t, 5, 2, 1), ["", "{email}"])

    s = d.tables[1]
    set_runs(cell_par(s, 0, 0, 0), ["Designation: {designation}"])
    set_runs(cell_par(s, 0, 1, 0), [" ", "Date: ", "{date}", "", "", "", "\n"])
    set_runs(cell_par(s, 0, 1, 2), ["Place: {place}"])
    scrub_props(d)
    d.save(os.path.join(OUT, "form9_consent.docx"))


# ------------------------------------------------------- Consent letter
def build_consent_letter():
    d = docx.Document(find(SRC, "consent_letter"))
    P = d.paragraphs
    set_runs(P[0], ["CONSENT TO ACT AS {designation_upper}"])
    set_runs(P[4], [
        "I", ",", " ", "{name} ", "{relation}", " ", "{relation_name_upper}",
        ", aged about {age} years, residing ", "at ", "{address_inline}", " ",
        "hereby give my consent to become {designation} of the", " ",
        "{llp_name_upper}",
        ", pursuant to section 7(4)/25(3)(c) of the Limited Liability Partnership Act, 2008.",
    ])
    # the 15th run did not exist; add the trailing text to the last run instead
    runs = P[4].runs
    if runs[-1].text != ", pursuant to section 7(4)/25(3)(c) of the Limited Liability Partnership Act, 2008.":
        last = runs[-1]
        last.text = last.text + ""
        nr = P[4].add_run(", pursuant to section 7(4)/25(3)(c) of the Limited Liability Partnership Act, 2008.")
        nr.bold = None
        if runs[0].font.size:
            nr.font.size = runs[0].font.size
        if runs[0].font.name:
            nr.font.name = runs[0].font.name
    delete_par(P[5])
    P = d.paragraphs
    for p in P:
        if p.text.strip() == "Chennai":
            set_runs(p, [p.runs[0].text, "{place}"])
        elif p.text.strip() == "15-09-2026":
            set_runs(p, [p.runs[0].text, "{date_dash}"])
        elif "VELUPULA ANUSHA" in p.text:
            set_runs(p, ["({name_upper}", ")"])
    scrub_props(d)
    d.save(os.path.join(OUT, "consent_letter.docx"))


# --------------------------------------------------------------- NOC
def build_noc():
    d = docx.Document(find(SRC, "noc"))
    P = d.paragraphs
    set_runs(P[0], ["{noc_date}"])
    set_runs(P[1], ["{noc_place_upper}"])
    set_runs(P[5], ["This is to state that", ", I", ", ", "{owner_name_upper}", ",",
                    " do hereby declare and state that I am the owner of the property situated at"])
    set_runs(P[6], ["{property_address}"])
    P[6].paragraph_format.left_indent = Cm(0)
    P[6].paragraph_format.first_line_indent = Cm(0)
    set_runs(P[10], [
        "I have no objection in using the said property as the registered address for the Limited Liability Partnership ",
        "{llp_name_upper}"])
    set_runs(P[16], ["(", "{owner_name_upper}", "", "", ")"])
    delete_par(P[8])
    delete_par(P[7])
    scrub_props(d)
    d.save(os.path.join(OUT, "noc_registered_office.docx"))


# --------------------------------------------------- Subscription sheet
SUB_PARA = (
    "We, the several partners whose names are subscribed below, are desirous of being formed into a LLP "
    "for carrying on a lawful business with a view to earn profit and have entered or agreed to enter into "
    "a LLP agreement in writing.\n"
    "We respectively agree to contribute money or other property or other benefit or to perform services "
    "for the LLP in accordance with the LLP agreement, the particulars of which are stated against our "
    "respective names.\n"
    "We hereby give our consent to become a partner/ designated partner/ nominee/ nominee & designated "
    "partner of the LLP pursuant to section 7(4) / 25(3)(c) of the Limited Liability Partnership Act, 2008."
)
HEADERS = [
    "NAME OF EACH PARTNER/DESIGNATED PARTNER /NOMINEE / NOMINEE & DESIGNATED PARTNER",
    "DESIGNATION (DESIGNATED PARTNER / PARTNER/ NOMINEE/ NOMINEE & DESIGNATED PARTNER",
    "SIGNATURE OF DESIGNATED PARTNER/PARTNER/ NOMINEE OF BODY CORPORATE",
    "NAME ADDRESS AND PROFESSION (ALONG WITH PROFESSIONAL MEMBERSHIP NUMBER) OF WITNESS",
    "SIGNATURE OF WITNESS",
]


def set_borders(table):
    tblPr = table._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for e in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{e}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:color"), "000000")
        b.append(el)
    tblPr.append(b)


def row_height(row, cm):
    trPr = row._tr.get_or_add_trPr()
    h = OxmlElement("w:trHeight")
    h.set(qn("w:val"), str(int(cm * 567)))
    h.set(qn("w:hRule"), "atLeast")
    trPr.append(h)
    cs = OxmlElement("w:cantSplit")
    trPr.append(cs)


def build_subscription():
    d = docx.Document()
    sec = d.sections[0]
    sec.orientation = WD_ORIENT.LANDSCAPE
    sec.page_width, sec.page_height = Mm(297), Mm(210)
    for m in ("left_margin", "right_margin"):
        setattr(sec, m, Cm(1.5))
    sec.top_margin = sec.bottom_margin = Cm(1.5)
    st = d.styles["Normal"]
    st.font.name = "Arial"
    st.font.size = Pt(10)
    st.paragraph_format.space_after = Pt(0)

    p = d.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("NAME OF THE LLP :- {llp_name_upper}")
    r.bold = True
    r.underline = True
    d.add_paragraph()
    for line in SUB_PARA.split("\n"):
        q = d.add_paragraph(line)
        q.alignment = WD_ALIGN_PARAGRAPH.CENTER
    d.add_paragraph()

    widths = [Cm(7.6), Cm(3.6), Cm(4.4), Cm(8.0), Cm(3.8)]
    t = d.add_table(rows=2, cols=5)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_borders(t)
    for i, h in enumerate(HEADERS):
        c = t.rows[0].cells[i]
        c.width = widths[i]
        c.paragraphs[0].add_run(h).font.size = Pt(9)
    # header repeats on each page
    trPr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement("w:tblHeader")
    trPr.append(th)

    body = [
        "{#partners}{name_upper}",
        "{designation_upper}",
        "",
        "{witness_details}",
        "{/partners}",
    ]
    for i, txt in enumerate(body):
        c = t.rows[1].cells[i]
        c.width = widths[i]
        c.paragraphs[0].add_run(txt)
    row_height(t.rows[1], 3.2)

    d.add_paragraph()
    d.add_paragraph("DATE:- {date}")
    d.add_paragraph("PLACE:- {place}")
    scrub_props(d)
    d.save(os.path.join(OUT, "subscription_sheet.docx"))


def dedupe_zip(path):
    """LibreOffice-converted files can end up with duplicate zip entries; keep the last one."""
    import zipfile
    with zipfile.ZipFile(path) as z:
        items = {}
        for info in z.infolist():
            items[info.filename] = (info, z.read(info))
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, (info, data) in items.items():
            z.writestr(name, data)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build_form9()
    build_consent_letter()
    build_noc()
    build_subscription()
    for f in os.listdir(OUT):
        if f.endswith(".docx"):
            dedupe_zip(os.path.join(OUT, f))
    print("Templates written to", os.path.abspath(OUT))
