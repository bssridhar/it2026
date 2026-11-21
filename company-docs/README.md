# Company Incorporation Documents – web form

For a **Private Limited Company** or a **One Person Company (OPC)** filed through SPICe+ with e-MoA and e-AoA.

| # | Document | Notes |
|---|----------|-------|
| 1 | NOC from owner of registered office premises (firm's format) | addressed to the Registrar of Companies |
| 2 | Data sheet (internal) | company, capital, main objects, every director / subscriber / nominee, pending items – for keying into SPICe+, e-MoA and e-AoA |

Also from the **Checklist** section: a **request list** of pending documents for the client (Word file, or text to paste).

## How to use

1. Keep the `company-docs` and `shared` folders side by side and double-click `company-docs/index.html`.
2. Choose **Private Limited** or **One Person Company** and enter the number of persons who are
   *directors and subscribers*, *directors only* and *subscribers only*, then click **Set up forms**.
   For an OPC a **nominee** form is added automatically.
3. For each person, upload the PAN, Aadhaar and bank statement PDFs (or use the Excel template – see below).
   Shaded fields came from a document; check every field. The address is taken from the bank statement.
4. Enter the company details, share capital and main objects, the NOC details, and click **Generate documents**.

## Checklist

For each director and subscriber: PAN, Aadhaar, bank statement, photograph, mobile/e-mail, DSC, and two
information-only items needed for SPICe+ – **educational qualification** and **number of years at the present
residential address** (no document is asked for; the item ticks itself once the detail is entered). For an OPC
nominee: PAN, Aadhaar, bank statement, photograph, mobile/e-mail and the signed nominee consent (INC-3).
For the company: proposed names and main objects, proof of registered office, rent agreement, signed NOC, and
e-MoA / e-AoA reviewed. Unticked items go into the data sheet and the client request list.

## Main objects

The **Suggest draft objects** button drafts a main objects clause from standard clause wording (type of activity,
services, goods, customers, India / abroad). It is a starting point for the e-MoA and must be reviewed. A warning
appears if the description mentions an activity that may need a licence or be open only to members of a profession.

## Checks built in

* Names end with "Private Limited"; an OPC name contains "(OPC)" (warning)
* Private company: at least 2 members (Section 3(1)(b)), at most 200 members (Section 2(68)),
  at least 2 directors (Section 149(1)) – Companies Act, 2013
* OPC: exactly one member (Section 2(62)), at least one director (Section 149(1)), one nominee; member and nominee
  must be Indian citizens resident in India (Rule 3, Companies (Incorporation) Rules, 2014)
* At least one director resident in India (Section 149(3)); more than 15 directors flagged (Section 149(1))
* Authorised capital is a whole multiple of the face value; shares subscribed do not exceed the authorised capital
* PAN format and duplicates, DIN (8 digits), e-mail, mobile, PIN code
* PAN / Aadhaar / bank statement name, date of birth and father's name compared; bank statement older than
  2 months flagged in red

## Excel template

**Download Excel template** gives `Company_data_template.xlsx` with a **Company** sheet and a **Persons** sheet
(one row per person, with a role column). **Upload filled Excel** fills the form. Don't delete the hidden column A
of the Company sheet or the hidden row 1 of the Persons sheet.

## Folder contents

* `index.html` – the web form
* `templates/` – NOC, data sheet, request list (Word) and the Excel data template
* `lib/templates.js` – the templates, embedded so the page works when opened from disk
* `tools/build_templates.py` – builds the templates (the NOC from the firm's sample, which is not kept here)
* `tools/build_excel_template.py` – builds the Excel template
* `tools/embed_templates.py` – packs the templates into `lib/templates.js`
