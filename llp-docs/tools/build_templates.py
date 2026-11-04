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
    """Sample file whose name contains `needle`; a .doc is converted to .docx with LibreOffice."""
    import subprocess, tempfile
    files = [f for f in os.listdir(folder) if needle.lower() in f.lower()]
    for f in files:
        if f.endswith(".docx"):
            return os.path.join(folder, f)
    for f in files:
        if f.endswith(".doc"):
            tmp = tempfile.mkdtemp()
            subprocess.run(["soffice", "--headless", "--convert-to", "docx", "--outdir", tmp,
                            os.path.join(folder, f)], check=True, capture_output=True)
            return os.path.join(tmp, f[:-4] + ".docx")
    raise SystemExit(f"Sample containing '{needle}' (.docx or .doc) not found in {folder}")


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



# ------------------------------------------------------------ LLP Agreement
def para_before(p, text):
    """Insert a plain paragraph holding `text` before p (used for loop tags)."""
    new = OxmlElement("w:p")
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = text
    t.set(qn("xml:space"), "preserve")
    r.append(t)
    new.append(r)
    p._p.addprevious(new)
    return new


def para_after(p, text):
    new = OxmlElement("w:p")
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = text
    t.set(qn("xml:space"), "preserve")
    r.append(t)
    new.append(r)
    p._p.addnext(new)
    return new


def wrap_loop(first, last, name):
    para_before(first, "{#" + name + "}")
    para_after(last, "{/" + name + "}")


def build_agreement():
    d = docx.Document(find(SRC, "agreement"))
    P = list(d.paragraphs)

    def at(start):
        for i in range(start, len(P)):
            if P[i].text.strip():
                return i
        raise SystemExit("unexpected agreement layout")

    # locate by text so small layout changes in the sample don't break the build
    def idx(prefix, start=0):
        for i in range(start, len(P)):
            if P[i].text.strip().startswith(prefix):
                return i
        raise SystemExit(f"Agreement: paragraph starting '{prefix}' not found")

    i_title = idx("LLP AGREEMENT OF")
    set_runs(P[at(i_title + 1)], ["{llp_name_upper} "])
    i = idx("THIS Agreement")
    set_runs(P[i], [P[i].runs[0].text, "THIS Agreement of LLP made at {place_upper} this {agr_date_text}. "])

    # parties
    i1 = idx("BETWEEN") + 1
    i1 = at(i1)
    p = P[i1]
    set_runs(p, ["{title} {name_upper}", ", {relation_upper} ", "{relation_name_upper}",
                 ", {religion_text}aged about {age} years, residing at ", "{address_inline}",
                 ", which expression shall, unless it be repugnant to the subject or context thereof, include their legal heirs, successors, nominees and permitted assignees and hereinafter called the {ordinal_upper} PARTY ; and"])
    i2 = at(i1 + 1)
    delete_par(P[i2])
    wrap_loop(p, p, "parties")
    i = idx("(FIRST")
    set_runs(P[i], ["({parties_collective_upper} SHALL BE COLLECTIVELY REFERRED TO AS PARTNERS)"])
    i = idx("WHEREAS the First Party")
    set_runs(P[i], ["WHEREAS the {ordinal} Party is ", "{title} {name_upper}"])
    delete_par(P[idx("WHEREAS the Second Party")])
    wrap_loop(P[i], P[i], "parties")
    i = idx("NOW")
    set_runs(P[i], ["NOW  The {parties_collective} are interested in forming a Limited Liability Partnership under the Limited Liability Partnership Act 2008 and that they intend to write down the terms and conditions of the said formation and "])

    i = idx("A Limited Liability Partnership shall be carried on")
    set_runs(P[i], [P[i].runs[0].text, "{llp_name_upper}", " and hereinafter called as LLP."])
    i = idx("The LLP shall have its registered office")
    set_runs(P[i], ["The LLP shall have its registered office at ", "{llp_address_inline}", "", "",
                    " and/or at such other place or places, as shall be agreed to by the majority of the partners from time to time."])
    i = idx("The Contribution of the")
    set_runs(P[i], ["The Contribution of the", " ", "LLP shall be Rs. {total_contribution} /- (Rupees {total_contribution_words} only) which shall be contributed by the partners in the following proportions."])
    i = idx("First Party 90%")
    set_runs(P[i], ["{ordinal} Party {contribution_pct}% i.e. Rs. {contribution} /- (Rupees {contribution_words} only)"])
    delete_par(P[idx("Second Party 10%")])
    wrap_loop(P[i], P[i], "parties")
    i = idx("Mrs. ANUSHA") if any(x.text.strip().startswith("Mrs. ANUSHA") for x in P[i:]) else None
    j = [k for k in range(len(P)) if "(First Party)" in P[k].text][0]
    set_runs(P[j], [P[j].runs[0].text, "{title} ", "{name_upper}", "\t({ordinal} Party) - {profit_pct} %"])
    k = [k for k in range(len(P)) if "(Second Party)" in P[k].text][0]
    delete_par(P[k])
    wrap_loop(P[j], P[j], "parties")

    i = idx("6. The business of the LLP")
    first = at(i + 1)
    last = idx("Admission of New Partner") - 1
    while not P[last].text.strip():
        last -= 1
    set_runs(P[first], ["{.}"])
    for k in range(first + 1, last + 1):
        delete_par(P[k])
    wrap_loop(P[first], P[first], "main_objects")

    i = idx("The Contribution of the partner may be")
    set_runs(P[i], [P[i].runs[0].text, "Rs. {incoming_min_contribution}."])
    i = idx("The First Party & Second Party shall act")
    set_runs(P[i], ["The {dp_parties} shall act as the {dp_word} of the LLP in terms of the requirement of the Limited Liability Partnership Act, 2008."])
    i = idx("The LLP shall pay Rs.")
    t = P[i].runs[0].text
    t = t.replace("Rs. 50000/- (Twenty Fifty Thousand only)", "Rs. {remuneration}/- (Rupees {remuneration_words} only)")
    if "{remuneration}" not in t:
        raise SystemExit("Agreement: remuneration clause not recognised")
    set_runs(P[i], [t])
    i = idx("First 6,00,000")
    set_runs(P[i], [P[i].runs[0].text.replace("Rs, ", "Rs. ")])
    i = idx("It is expressly agreed that the bank account")
    set_runs(P[i], [P[i].runs[0].text, P[i].runs[1].text.replace("by the two parties", "by the {parties_count_words} parties")])
    i = [k for k in range(len(P)) if "the Court of Law at" in P[k].text][0]
    set_runs(P[i], [r.text for r in P[i].runs[:-1]] + ["the Court of Law at {jurisdiction}."])
    for k, p in enumerate(P):
        for r in p.runs:
            if "wounded up" in r.text:
                r.text = r.text.replace("wounded up", "wound up")
            if 'share" in the LLP' in r.text:
                r.text = r.text.replace('share" in the LLP', "share in the LLP")

    # signatures: one line per partner, then two witnesses
    i = idx("For and on behalf of")
    set_runs(P[i + 1], ["{llp_name_upper}", ""])
    sig = idx("(Partner)", i)
    set_runs(P[sig], [P[sig].runs[0].text, "({title} {name_upper} – {ordinal} Party)"])
    P[sig].paragraph_format.space_before = Pt(42)
    P[sig].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    set_runs(P[sig], ["", "({title} {name_upper} – {ordinal} Party)"])
    wrap_loop(P[sig], P[sig], "parties")
    w = idx("Witness:")
    P[w].paragraph_format.space_before = Pt(30)
    w2 = idx("(Partner)", w)
    set_runs(P[w2], ["1."])
    P[w2].paragraph_format.space_before = Pt(36)
    two = para_after(P[w2], "2.")
    pPr = OxmlElement("w:pPr")
    sp = OxmlElement("w:spacing")
    sp.set(qn("w:before"), str(36 * 20))
    pPr.append(sp)
    two.insert(0, pPr)

    # Schedule 1 B - other business
    i = idx("THE OTHER BUSINESS ARE:")
    first = at(i + 1)
    last = idx("SCHEDULE 2") - 1
    while not P[last].text.strip():
        last -= 1
    set_runs(P[first], ["{.}"])
    for k in range(first + 1, last + 1):
        delete_par(P[k])
    wrap_loop(P[first], P[first], "other_objects")

    # the sample's body text is Arial; a few runs had no font and fell back to the default serif font
    for p in d.paragraphs:
        for r in p.runs:
            if r.text.strip() and not r.font.name:
                r.font.name = "Arial"
                if not r.font.size:
                    r.font.size = Pt(11)
    scrub_props(d)
    d.save(os.path.join(OUT, "llp_agreement.docx"))


# ------------------------------------------------------------ Data sheet / request list
def new_doc(landscape=False):
    d = docx.Document()
    sec = d.sections[0]
    sec.page_width, sec.page_height = (Mm(297), Mm(210)) if landscape else (Mm(210), Mm(297))
    if landscape:
        sec.orientation = WD_ORIENT.LANDSCAPE
    sec.left_margin = sec.right_margin = Cm(2)
    sec.top_margin = sec.bottom_margin = Cm(1.8)
    st = d.styles["Normal"]
    st.font.name = "Arial"
    st.font.size = Pt(10)
    st.paragraph_format.space_after = Pt(3)
    return d


def heading(d, text, size=13, before=10):
    p = d.add_paragraph()
    p.paragraph_format.space_before = Pt(before)
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(size)
    return p


def kv_table(d, rows, widths=(Cm(6.2), Cm(10.8))):
    t = d.add_table(rows=0, cols=2)
    set_borders(t)
    for label, val in rows:
        cells = t.add_row().cells
        cells[0].width, cells[1].width = widths
        cells[0].paragraphs[0].add_run(label).bold = True
        cells[1].paragraphs[0].add_run(val)
    return t


def build_datasheet():
    d = new_doc()
    p = d.add_paragraph()
    r = p.add_run("DATA SHEET – {llp_name_upper}")
    r.bold = True
    r.font.size = Pt(14)
    d.add_paragraph("For internal use while filing the incorporation forms. Prepared on {today}. "
                    "Check each entry against the original documents.")
    heading(d, "A. Proposed LLP")
    kv_table(d, [
        ("Proposed name", "{llp_name_upper}"),
        ("Registered office address", "{llp_address}"),
        ("E-mail id of LLP", "{llp_email}"),
        ("Main business", "{main_business}"),
        ("Total contribution", "Rs. {total_contribution} (Rupees {total_contribution_words} only)"),
        ("Number of partners", "{n_partners} (designated partners: {n_dps})"),
        ("Place and date of signing", "{place}, {date}"),
        ("Owner of registered office premises", "{owner_name_upper} (NOC dated {noc_date})"),
    ])
    heading(d, "B. Partners")
    d.add_paragraph("{#partners}")
    heading(d, "{n}. {title} {name_upper} – {designation}", size=11, before=8)
    kv_table(d, [
        ("Father's name", "{father_name_upper}"),
        ("Relation", "{relation} {relation_name_upper}"),
        ("Date of birth / age", "{dob} ({age} years)"),
        ("Gender", "{gender}"),
        ("Nationality / resident in India", "{nationality} / {resident}"),
        ("PAN", "{pan}"),
        ("DPIN / DIN", "{dpin}"),
        ("Mobile no. / e-mail id", "{mobile} / {email}"),
        ("Residential address", "{address}"),
        ("Occupation", "{occupation}"),
        ("Proof of identity / address", "{id_proof} / {address_proof}"),
        ("Contribution", "Rs. {contribution} ({contribution_pct}%)"),
        ("Profit sharing ratio", "{profit_pct}%"),
        ("Bank statement – last transaction", "{bank_last_txn}"),
    ])
    d.add_paragraph("{/partners}")
    heading(d, "C. Pending items")
    d.add_paragraph("{#pending}")
    d.add_paragraph("☐ {.}")
    d.add_paragraph("{/pending}")
    d.add_paragraph("{^pending}Nothing pending.{/pending}")
    scrub_props(d)
    d.save(os.path.join(OUT, "data_sheet.docx"))


def build_request_list():
    d = new_doc()
    p = d.add_paragraph()
    r = p.add_run("Documents and details required")
    r.bold = True
    r.font.size = Pt(14)
    d.add_paragraph("Proposed LLP: {llp_name_upper}")
    d.add_paragraph("Date: {today}")
    d.add_paragraph("To complete the incorporation papers, the following documents and details are still required. "
                    "Please send clear copies (PDF downloaded from the issuing website wherever possible).")
    d.add_paragraph("{#partner_items}")
    heading(d, "{title} {name_upper} ({designation})", size=11, before=8)
    d.add_paragraph("{#items}")
    d.add_paragraph("{n}. {text}")
    d.add_paragraph("{/items}")
    d.add_paragraph("{/partner_items}")
    d.add_paragraph("{#has_llp_items}")
    heading(d, "For the registered office and the LLP", size=11, before=8)
    d.add_paragraph("{/has_llp_items}")
    d.add_paragraph("{#llp_items}")
    d.add_paragraph("{n}. {text}")
    d.add_paragraph("{/llp_items}")
    scrub_props(d)
    d.save(os.path.join(OUT, "request_list.docx"))


FONT_MAP = {b"Liberation Serif": b"Times New Roman", b"Liberation Sans": b"Arial",
            b"WenQuanYi Zen Hei": b"SimSun", b"FreeSans": b"Arial"}


def fix_fonts(path):
    """LibreOffice conversion of .doc files substitutes its own fonts; restore the Windows ones."""
    import zipfile
    with zipfile.ZipFile(path) as z:
        items = [(i.filename, z.read(i)) for i in z.infolist()]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in items:
            if name.endswith(".xml"):
                for a, b in FONT_MAP.items():
                    data = data.replace(a, b)
            z.writestr(name, data)


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
    build_agreement()
    build_datasheet()
    build_request_list()
    for f in os.listdir(OUT):
        if f.endswith(".docx"):
            dedupe_zip(os.path.join(OUT, f))
            fix_fonts(os.path.join(OUT, f))
    print("Templates written to", os.path.abspath(OUT))
