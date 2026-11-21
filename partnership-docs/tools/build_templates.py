"""
Builds the partnership templates in ../templates.

    python3 tools/build_templates.py
    python3 tools/embed_templates.py

The deed is built from the wording of the firm's sample partnership deed (a scanned, signed copy that
is not kept here), with client details replaced by {placeholders}. The NOC for the place of business is
adapted from the LLP tool's NOC template. Helpers are shared with llp-docs/tools/build_templates.py.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, os.path.join(HERE, "..", "..", "llp-docs", "tools"))
from build_templates import (set_runs, scrub_props, new_doc, heading, kv_table,  # noqa: E402
                             fix_fonts, dedupe_zip, set_borders)
import docx  # noqa: E402
from docx.shared import Pt, Cm, Mm  # noqa: E402
from docx.enum.text import WD_ALIGN_PARAGRAPH  # noqa: E402
from docx.oxml import OxmlElement  # noqa: E402
from docx.oxml.ns import qn  # noqa: E402

OUT = os.path.join(ROOT, "templates")
FONT = "Times New Roman"


# ------------------------------------------------------------------ deed helpers
class Deed:
    def __init__(self):
        d = docx.Document()
        sec = d.sections[0]
        sec.page_width, sec.page_height = Mm(210), Mm(297)
        sec.left_margin = Cm(3)
        sec.right_margin = Cm(2.2)
        sec.top_margin = Cm(2)
        sec.bottom_margin = Cm(2)
        st = d.styles["Normal"]
        st.font.name = FONT
        st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
        st.font.size = Pt(12)
        st.paragraph_format.space_after = Pt(6)
        st.paragraph_format.line_spacing = 1.15
        self.d = d
        self.n = 0
        self._footer()

    def _footer(self):
        p = self.d.sections[0].footer.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

        def field(code):
            r = p.add_run()
            for kind, text in (("begin", None), ("instr", code), ("separate", None), ("end", None)):
                if kind == "instr":
                    e = OxmlElement("w:instrText")
                    e.set(qn("xml:space"), "preserve")
                    e.text = text
                else:
                    e = OxmlElement("w:fldChar")
                    e.set(qn("w:fldCharType"), kind)
                r._r.append(e)
                if kind == "separate":
                    t = OxmlElement("w:t")
                    t.text = "1"
                    r._r.append(t)
            r.bold = True
        b = p.add_run("Page ")
        b.bold = True
        field(" PAGE ")
        b = p.add_run(" of ")
        b.bold = True
        field(" NUMPAGES ")

    def para(self, parts, align="justify", indent=None, before=None, after=None, keep=False):
        """parts: str or list of (text, bold) tuples."""
        p = self.d.add_paragraph()
        if isinstance(parts, str):
            parts = [(parts, False)]
        for text, bold in parts:
            r = p.add_run(text)
            r.bold = bold
        p.alignment = {"justify": WD_ALIGN_PARAGRAPH.JUSTIFY, "center": WD_ALIGN_PARAGRAPH.CENTER,
                       "left": WD_ALIGN_PARAGRAPH.LEFT, "right": WD_ALIGN_PARAGRAPH.RIGHT}[align]
        if indent is not None:
            p.paragraph_format.left_indent = Cm(indent)
        if before is not None:
            p.paragraph_format.space_before = Pt(before)
        if after is not None:
            p.paragraph_format.space_after = Pt(after)
        if keep:
            p.paragraph_format.keep_with_next = True
        return p

    def head(self, text):
        return self.para([(text, True)], align="left", before=10, keep=True)

    def clause(self, parts):
        """A numbered clause with a hanging indent."""
        self.n += 1
        if isinstance(parts, str):
            parts = [(parts, False)]
        p = self.para([(f"{self.n}.\t", False)] + list(parts), indent=0.9)
        p.paragraph_format.first_line_indent = Cm(-0.9)
        p.paragraph_format.tab_stops.add_tab_stop(Cm(0.9))
        return p

    def plain(self, text):
        return self.para(text)

    def save(self, name):
        scrub_props(self.d)
        self.d.save(os.path.join(OUT, name))


def build_deed():
    D = Deed()
    D.para("{#stamp_space}")
    sp = D.para("")
    sp.paragraph_format.space_before = Pt(250)  # room for the stamp paper's printed band
    D.para("{/stamp_space}")
    D.para([("PARTNERSHIP DEED", True)], align="center", after=0)
    D.para([("OF", True)], align="center", after=0)
    p = D.para([("{firm_name_upper}", True)], align="center", after=0)
    p.runs[0].font.name = "Arial"
    D.para([("{place_of_business_inline}", True)], align="center", after=12)

    D.para([("PREAMBLE:", True)], align="left")
    D.para([("THIS DEED OF PARTNERSHIP", True), (" executed at {place}, this {deed_date_words} between,", False)])
    D.para("{#partners}")
    p = D.para([("{n}.\t", False), ("{title} {name_upper}", True), (", {relation_upper} of ", False), ("{relation_name_upper}", True),
                (", {religion_text}aged about {age} years, residing at {address_inline}, hereinafter called as the ", False),
                ("PARTY OF THE {ordinal_upper} PART;", True)], indent=0.9)
    p.paragraph_format.first_line_indent = Cm(-0.9)
    D.para("{/partners}")

    D.para([("WHEREAS Parties of the ", False), ("{parts_collective}", True),
            (" parts are working in partnership under the name and style of ", False), ("{firm_name_upper}", True),
            (" with effect from {commencement} at {place_of_business_inline}, in consideration of sharing the profits and losses, "
             "to become and remain partners in the business on and from {commencement}.", False)], before=8)
    D.para([("AND WHEREAS", True), (" the above said parties decided to document and formalize the deed from {commencement} "
                                    "with the below terms & conditions:", False)])
    D.head("NOW THIS INDENTURE WITNESSETH:")

    D.head("NAME CLAUSE:")
    D.clause([("The Parties of the {parts_collective} parts have agreed that hereto they shall become and remain partners in the "
               "business to be carried on under the name and style of ", False), ("{firm_name_upper}.", True)])
    D.clause("The Partners of the {parts_collective} parts have agreed to carry on business in partnership and have commenced "
             "the partnership from {commencement}.")
    D.clause("The duration of the Partnership shall be {duration_text}.")

    D.head("PLACE OF BUSINESS:")
    D.clause([("The place of the business of partnership shall be at ", False), ("{place_of_business_inline}", True),
              (", and at such other place or places as the partners may mutually determine from time to time.", False)])

    D.head("OBJECT CLAUSE:")
    D.clause("The business of the partnership shall be to carry on the business as follows :-")
    D.para("{#objects}")
    D.para("{.}")
    D.para("{/objects}")

    D.head("CAPITAL CLAUSE:")
    D.clause("The partners hereto will subscribe to such capital as may be agreed upon from time to time. {capital_text}")
    D.para("{#capital_list}")
    D.para("{n}. {title} {name_upper}\t–\tRs. {capital}/- (Rupees {capital_words} Only)", align="left", indent=1.5)
    D.para("{/capital_list}")
    D.clause("Any additional capital required shall be contributed as per mutual agreement.")
    D.clause("Drawings will be made as per mutual agreement.")

    D.head("BOOKS OF ACCOUNT AND ITS ACCESS:")
    D.clause("The accounts of the Partnership shall be closed on the {year_end} every year.")
    D.clause("All necessary and proper books of accounts shall be kept and maintained and such accounts shall always be open "
             "for inspection by all the partners during the office hours.")

    D.head("PROFIT & LOSS SHARING RATIO:")
    D.clause("The profit and loss of the firm shall be consolidated at the year end and shall be divided and borne by the "
             "partners in the following proportions:")
    D.para("{#partners}")
    p = D.para([("{n}. {title} {name_upper}", True), ("\t{profit_pct}%", True)], align="left", indent=1.5, after=2)
    p.paragraph_format.tab_stops.add_tab_stop(Cm(12))
    D.para("{/partners}")

    D.head("EXPENSES AND OUTGOINGS:")
    D.clause("All expenses and outgoings incidental to or relating to the partnership business such as rent, interest, "
             "salaries, rates and taxes etc., shall be met out of the revenue of the firm before ascertaining the amount of "
             "profit and loss for the purpose of division between the partners.")

    D.head("SALARY TO PARTNERS:")
    D.para("{#has_salary}")
    D.clause("Salary shall be paid to the working partners of the firm at the rate of {salary_text} per month from the first "
             "year of its operation and on such terms and conditions as may be mutually agreed upon by all the partners, "
             "provided that such remuneration shall not exceed the following maximum allowable amount prescribed by "
             "Section 40(b) of the Income Tax Act (or the corresponding provision of the income-tax law for the time being "
             "in force):-")
    t = D.d.add_table(rows=2, cols=2)
    rows = [("On the first Rs. 6,00,000/- of the book profit or in case of a loss", "Rs. 3,00,000/- or 90% of the book profit, whichever is higher"),
            ("On the balance of the book profit", "60%")]
    for i, (a, b) in enumerate(rows):
        t.rows[i].cells[0].width = Cm(8)
        t.rows[i].cells[1].width = Cm(7.5)
        t.rows[i].cells[0].paragraphs[0].add_run(a)
        t.rows[i].cells[1].paragraphs[0].add_run(b)
    D.para("{/has_salary}")
    D.para("{^has_salary}")
    D.n -= 1  # the alternative wording takes the same clause number
    D.clause("No salary or remuneration shall be paid to the partners unless otherwise agreed in writing by all the partners.")
    D.para("{/has_salary}")

    D.head("INTEREST ON CAPITAL:")
    D.clause("{interest_text}")

    D.head("BANK OPERATION:")
    D.clause("The Partners may open bank account/accounts with any bank/banks and the same shall be operated either jointly or "
             "individually by the parties of the {parts_collective} Parts as decided by the partners from time to time.")

    D.head("AUTHORITY OF PARTNERS:")
    D.clause("In the event of the partnership business being in need of funds, the partners may raise loans from outsiders "
             "either under the joint signatures of all the partners{managing_partner_text} on such terms and conditions as the "
             "parties hereto may deem expedient.")
    D.clause("If any partner is desirous of retiring from the said partnership he/she shall be entitled to do so by giving "
             "{notice_possessive} notice in writing to the other Partners of his/her intention to retire and on expiration of "
             "{notice_period} from the date of such notice, he/she shall cease to be a partner and his/her interest in the "
             "partnership shall cease on and from that date. Immediately on receipt of the aforesaid notice his/her accounts "
             "including goodwill shall be drawn upon and settled forthwith.")
    D.clause("The retiring partner will hand over the property of the partnership under his/her possession and/or any other "
             "books/documents etc., belonging to the partnership or any of its clients to the remaining partners upon due "
             "receipt forthwith and the partnership firm shall also issue to the retiring partner a “no claim receipt” "
             "to this effect. On retirement, a retiring partner shall not in any way interfere with the business of the "
             "partnership.")
    D.clause("All the partners and their authorized agents if any, are hereby authorized jointly and severally to represent "
             "the firm before any civil or criminal courts, courts of insolvency, income-tax authorities and sales-tax "
             "authorities, port and custom authorities and registrar of assurances, official assignees, officers of the "
             "Government of India or State Government. Each partner is further authorized to conduct the partnership "
             "business jointly and severally and swear necessary affidavits and to sign and verify all written statements "
             "and petitions and do defend suits brought against the firm, to withdraw money from court or to get refund from "
             "Income-tax department or Sales tax department and other Government Departments. No partner shall without the "
             "consent of the other partners:")
    for letter, text in [
        ("a)", "Compound, release or discharge any debt or claim which shall be due or owing to the partnership without "
               "receiving the full amount thereof."),
        ("b)", "Become bail, surety or security of any person or Corporation or do anything whereby the property of the "
               "partnership shall be attached or taken in to execution."),
        ("c)", "Assign or mortgage or transfer his/her share of interest in the partnership."),
        ("d)", "Lend money or give credit or have dealings on behalf of the firm with any person or employee to whom the "
               "partners have forbidden him/her to trust or deal with."),
    ]:
        p = D.para(f"{letter}\t{text}", indent=1.8)
        p.paragraph_format.first_line_indent = Cm(-0.9)
        p.paragraph_format.tab_stops.add_tab_stop(Cm(1.8))

    D.head("ARBITRATION:")
    D.clause("If during the continuance of the partnership or any time afterwards any dispute or difference or question shall "
             "arise between the said partners or any of their representatives regarding the partnership accounts or "
             "transactions thereof, the dissolution or winding up thereof, the construction, meaning or rights and "
             "liabilities of the partners or their representatives under this deed, then every such dispute, difference or "
             "question shall be referred to arbitration under the {arbitration_act} or any statutory modifications thereof "
             "for the time being in force and its award shall be binding on the partners and/or their representatives.")
    D.clause("Any of the above clauses may be varied, altered, amended, substituted or added by mutual consent of the partners "
             "such consents being expressed whether in writing or orally implied from conduct.")
    D.clause("The partners are herewith empowered to represent and bind the firm for all contracts entered into by them with "
             "the Government, all agencies, firms and any other body and they can jointly enter into contract and sign "
             "necessary documents and such contracts and agreements shall be binding on the firm, and shall be deemed as "
             "entered into by this firm.")
    D.clause("The partners by mutual consent can take in any number of partners as permissible under the laws in force from "
             "time to time.")
    D.clause("No partner shall, without the previous consent of all the existing partners in writing, become a partner / "
             "director / shareholder of any other firm/company and/or person or persons carrying on a similar and/or "
             "competitive business.")
    D.clause("The death, insolvency or lunacy of any partner shall not automatically dissolve the partnership.")
    D.para("Death or insolvency of any partner shall not dissolve the firm, but at the happening of such contingency arising "
           "in the case of parties hereto, such partner shall be deemed to have retired from the partnership as on the date "
           "of such contingency and his/her heir shall be paid by or shall pay to the firm the amount due as if such partner "
           "has retired on the date of such contingency. In the case of such contingency even sole surviving partner shall "
           "carry on business for a maximum period of 60 days within which either the business is discontinued or new "
           "partner is taken and his/her inclusion is approved by appropriate authorities.", indent=0.9)
    D.clause("In all other matters the partnership shall be governed by the Indian Partnership Act, 1932 or any statutory "
             "modifications thereof for the time being in force.")

    D.para([("IN WITNESS WHEREOF THE PARTIES HERETO HAVE SUBSCRIBED THEIR HANDS HEREIN ON THIS {deed_date_words_upper} "
             "IN THE PRESENCE OF THE WITNESSES", True)], before=10, keep=True)

    # signatures: partners on the right, witnesses on the left
    D.para("{#partners}")
    p = D.para([("({title} {name_upper})", True)], align="right", before=40, after=0, keep=True)
    D.para([("(PARTY OF THE {ordinal_upper} PART)", True)], align="right")
    D.para("{/partners}")
    D.head("WITNESSES:")
    D.para("{#witnesses}")
    p = D.para([("{n}.", False)], align="left", before=36, after=0, keep=True)
    D.para("{details}", align="left", indent=0.9)
    D.para("{/witnesses}")
    D.save("partnership_deed.docx")


def build_noc():
    src = os.path.join(ROOT, "..", "llp-docs", "templates", "noc_registered_office.docx")
    d = docx.Document(src)
    for p in d.paragraphs:
        if p.text.startswith("I have no objection"):
            set_runs(p, ["I have no objection in using the said property as the principal place of business of the partnership firm ",
                         "M/s. {firm_name_upper}"])
    scrub_props(d)
    d.save(os.path.join(OUT, "noc_place_of_business.docx"))


def build_datasheet():
    d = new_doc()
    p = d.add_paragraph()
    r = p.add_run("DATA SHEET – {firm_name_upper}")
    r.bold = True
    r.font.size = Pt(14)
    d.add_paragraph("For internal use (PAN, GST and bank account applications). Prepared on {today}. "
                    "Check each entry against the original documents.")
    heading(d, "A. Partnership firm")
    kv_table(d, [
        ("Name of the firm", "{firm_name_upper}"),
        ("Principal place of business", "{place_of_business}"),
        ("E-mail id of firm", "{firm_email}"),
        ("Date of deed / commencement", "{deed_date} / {commencement}"),
        ("Duration", "{duration_text}"),
        ("Total capital", "Rs. {total_capital} (Rupees {total_capital_words} only)"),
        ("Interest on capital", "{interest_rate}"),
        ("Managing partner", "{managing_partner}"),
        ("Number of partners", "{n_partners}"),
        ("Owner of business premises", "{owner_name_upper} (NOC dated {noc_date})"),
    ])
    heading(d, "B. Business (object clause)")
    d.add_paragraph("{#objects_n}")
    d.add_paragraph("{n}. {text}")
    d.add_paragraph("{/objects_n}")
    heading(d, "C. Partners")
    d.add_paragraph("{#partners}")
    heading(d, "{n}. {title} {name_upper}", size=11, before=8)
    kv_table(d, [
        ("Father's name", "{father_name_upper}"),
        ("Relation", "{relation} {relation_name_upper}"),
        ("Date of birth / age", "{dob} ({age} years)"),
        ("Gender", "{gender}"),
        ("PAN", "{pan}"),
        ("Mobile no. / e-mail id", "{mobile} / {email}"),
        ("Residential address", "{address}"),
        ("Capital", "Rs. {capital}"),
        ("Profit sharing ratio", "{profit_pct}%"),
        ("Working partner / salary", "{working} / {salary_text}"),
    ])
    d.add_paragraph("{/partners}")
    heading(d, "D. Pending items")
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
    d.add_paragraph("Proposed partnership firm: {name_upper}")
    d.add_paragraph("Date: {today}")
    d.add_paragraph("To complete the partnership deed and related papers, the following documents and details are still "
                    "required. Please send clear copies (PDF downloaded from the issuing website wherever possible).")
    d.add_paragraph("{#partner_items}")
    heading(d, "{title} {name_upper} ({designation})", size=11, before=8)
    d.add_paragraph("{#items}")
    d.add_paragraph("{n}. {text}")
    d.add_paragraph("{/items}")
    d.add_paragraph("{/partner_items}")
    d.add_paragraph("{#has_llp_items}")
    heading(d, "For the firm and its place of business", size=11, before=8)
    d.add_paragraph("{/has_llp_items}")
    d.add_paragraph("{#llp_items}")
    d.add_paragraph("{n}. {text}")
    d.add_paragraph("{/llp_items}")
    scrub_props(d)
    d.save(os.path.join(OUT, "request_list.docx"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build_deed()
    build_noc()
    build_datasheet()
    build_request_list()
    for f in os.listdir(OUT):
        if f.endswith(".docx"):
            dedupe_zip(os.path.join(OUT, f))
            fix_fonts(os.path.join(OUT, f))
    print("Templates written to", os.path.abspath(OUT))
