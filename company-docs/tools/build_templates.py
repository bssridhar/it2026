"""
Builds the company templates in ../templates.

Usage:  python3 build_templates.py <folder-with-samples>

The sample NOC contained client data and is NOT kept in this repository; only the
template, with {placeholders} in place of client data, is committed.
Helper functions are shared with the LLP builder (llp-docs/tools/build_templates.py).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "llp-docs", "tools"))
import build_templates as base  # noqa: E402
from build_templates import (find, set_runs, delete_par, scrub_props, new_doc, heading,  # noqa: E402
                             kv_table, fix_fonts, dedupe_zip)
from docx.shared import Pt, Cm  # noqa: E402
from docx.enum.text import WD_ALIGN_PARAGRAPH  # noqa: E402

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(HERE, "..", "templates")


def idx(P, prefix, start=0):
    for i in range(start, len(P)):
        if P[i].text.strip().startswith(prefix):
            return i
    raise SystemExit(f"NOC: paragraph starting '{prefix}' not found")


def build_noc():
    import docx
    d = docx.Document(find(SRC, "objection"))
    P = list(d.paragraphs)
    i = idx(P, "From")
    t = P[i].runs[0].text
    set_runs(P[i], [t[:t.rstrip().rfind("\t") + 1] + "{noc_date}"])
    set_runs(P[i + 1], ["\t{owner_name}"])
    # owner's address: one paragraph with line breaks
    j = i + 2
    to = idx(P, "To", j)
    set_runs(P[j], ["{owner_address}"])
    P[j].paragraph_format.left_indent = Cm(1.27)
    P[j].paragraph_format.first_line_indent = Cm(0)
    for k in range(j + 1, to):
        if P[k].text.strip():
            delete_par(P[k])
    r = idx(P, "The Registrar of Companies")
    set_runs(P[r + 1], ["\t{roc_city}"])
    k = idx(P, "The company M/s.")
    set_runs(P[k], ["The company M/s. {company_name_upper} (under incorporation) has approached me for using my premises as Registered office."])
    k = idx(P, "The proposed registered")
    set_runs(P[k], ["The proposed registered office of the company is "])
    a = k + 1
    while not P[a].text.strip():
        a += 1
    b = idx(P, "The above said address")
    set_runs(P[a], ["{property_address}"])
    P[a].alignment = WD_ALIGN_PARAGRAPH.LEFT
    for m in range(a + 1, b):
        if P[m].text.strip():
            delete_par(P[m])
    s = [p for p in P if p.text.strip().startswith("(") and p.text.strip().endswith(")")][-1]
    set_runs(s, ["(", "{owner_name}", ")"])
    scrub_props(d)
    d.save(os.path.join(OUT, "noc_registered_office.docx"))


def build_datasheet():
    d = new_doc()
    p = d.add_paragraph()
    r = p.add_run("DATA SHEET – {company_name_upper}")
    r.bold = True
    r.font.size = Pt(14)
    d.add_paragraph("For internal use while filing SPICe+ (with e-MoA and e-AoA). Prepared on {today}. "
                    "Check each entry against the original documents.")
    heading(d, "A. Proposed company")
    kv_table(d, [
        ("Type of company", "{company_type}"),
        ("Proposed name 1", "{company_name_upper}"),
        ("Proposed name 2", "{name2_upper}"),
        ("Registered office address", "{ro_address}"),
        ("Registrar of Companies", "{roc_city}"),
        ("E-mail id of company", "{company_email}"),
        ("Authorised capital", "Rs. {authorised} (Rupees {authorised_words} only), divided into {auth_shares} equity shares of Rs. {face_value} each"),
        ("Subscribed capital", "Rs. {subscribed} – {sub_shares} equity shares of Rs. {face_value} each"),
        ("Number of directors / subscribers", "{n_directors} / {n_subscribers}"),
        ("Owner of registered office premises", "{owner_name_upper} (NOC dated {noc_date})"),
    ])
    heading(d, "B. Main objects (for e-MoA)")
    d.add_paragraph("{#main_objects}")
    d.add_paragraph("{n}. {text}")
    d.add_paragraph("{/main_objects}")
    heading(d, "C. Directors, subscribers and nominee")
    d.add_paragraph("{#persons}")
    heading(d, "{n}. {title} {name_upper} – {role}", size=11, before=8)
    kv_table(d, [
        ("Father's name", "{father_name_upper}"),
        ("Relation", "{relation} {relation_name_upper}"),
        ("Date of birth / age", "{dob} ({age} years)"),
        ("Gender", "{gender}"),
        ("Nationality / resident in India", "{nationality} / {resident}"),
        ("PAN", "{pan}"),
        ("DIN", "{din}"),
        ("Mobile no. / e-mail id", "{mobile} / {email}"),
        ("Residential address", "{address}"),
        ("Occupation / educational qualification", "{occupation} / {education}"),
        ("Proof of identity / address", "{id_proof} / {address_proof}"),
        ("Shares subscribed", "{shares_text}"),
        ("Relationship with member (nominee)", "{nominee_relation}"),
        ("Bank statement – last transaction", "{bank_last_txn}"),
    ])
    d.add_paragraph("{/persons}")
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
    d.add_paragraph("Proposed company: {name_upper}")
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
    heading(d, "For the registered office and the company", size=11, before=8)
    d.add_paragraph("{/has_llp_items}")
    d.add_paragraph("{#llp_items}")
    d.add_paragraph("{n}. {text}")
    d.add_paragraph("{/llp_items}")
    scrub_props(d)
    d.save(os.path.join(OUT, "request_list.docx"))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build_noc()
    build_datasheet()
    build_request_list()
    for f in os.listdir(OUT):
        if f.endswith(".docx"):
            dedupe_zip(os.path.join(OUT, f))
            fix_fonts(os.path.join(OUT, f))
    print("Templates written to", os.path.abspath(OUT))
