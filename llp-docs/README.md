# LLP Incorporation Documents – web form

Fill in one form and get the standard LLP incorporation documents as Word (.docx) files:

| # | Document | Copies |
|---|----------|--------|
| 0 | **Print set** – all documents below (except the data sheet) in one Word file, in signing order | one |
| 1 | Form 9 – Consent to act as designated partner/partner | one per partner |
| 2 | Consent letter to act as designated partner | one per partner |
| 3 | Subscription sheet | one, all partners |
| 4 | NOC from owner of registered office premises | one |
| 5 | LLP Agreement (firm's standard format) | one |
| 6 | Data sheet for filing (internal) | one |

Also available from the **Checklist** section: a **request list** of pending documents for the client
(Word file, or text to paste into an e-mail or message).

## How to use

1. Download or clone this folder (`llp-docs`) to your computer.
2. Double-click `index.html`. It opens in Chrome, Edge or Firefox. You don't need internet access or a server.
3. Enter the number of designated partners and other partners, and click **Set up partner forms**.
4. For each partner, upload the **PAN**, **Aadhaar** and **bank statement** PDFs. The fields fill in
   automatically (shaded fields came from a document). Check them and complete the rest.
5. Fill in the LLP, NOC and witness details, then click **Generate documents**.
   A ZIP file with all the documents downloads, and you can also download each file on its own.
4. **Save case file** stores the data entered as a `.json` file, and **Open case file** reloads it,
   for example to change a date or add a partner later.

Client data stays on your computer: nothing is uploaded. The form also keeps an unsaved
draft in the browser; use **Clear form** to remove it once a matter is done.

## Changing the wording of a document

The formats are in the `templates` folder. Open one in Word, change the text and keep the
`{placeholders}` (for example `{name_upper}`, `{llp_name_upper}`, `{date}`). Then either:

* use the file once: choose it under **Advanced** in the form, or
* make the change permanent: save it in `templates` and run `python3 tools/embed_templates.py`.

### Placeholders available

LLP: `llp_name`, `llp_name_upper`, `llp_address`, `place`, `date` (dd/mm/yyyy), `date_dash` (dd-mm-yyyy), `id_proof`

Partner: `name`, `name_upper`, `relation`, `relation_name_upper`, `father_name`, `father_name_upper`, `dob`, `age`,
`address`, `address_inline`, `email`, `mobile`, `pan`, `occupation`, `nationality`, `dpin`, `nominee_of`,
`prof_membership`, `designation`, `designation_upper`, `address_proof`

NOC: `owner_name`, `owner_name_upper`, `property_address`, `noc_date`, `noc_place_upper`

Subscription sheet table rows: `{#partners}` … `{/partners}` with `name_upper`, `designation_upper`, `witness_details`

## LLP Agreement

Section 6 of the form takes the agreement details: date (or blank, to fill in by hand), courts for the
dispute clause, remuneration to the designated partner, the minimum contribution of an incoming partner,
the main business (clause 6) and the other business (Schedule 1 part B), one object per line.
Each partner's **contribution** and **profit share** are entered in section 3; the profit share defaults
to the contribution percentage and must add up to 100%. Amounts are written in words in the Indian
system (lakh / crore). The parties, contribution table, profit-sharing table, designated partners
clause and signature lines grow with the number of partners.

### Drafting the objects clause

Inside section 6, **Draft the objects clause** takes the type of activity (trading, manufacturing, services,
consultancy, contracts, import/export, IT, e-commerce, agency), the services provided, the goods dealt in,
the customers or sectors, and whether the business is in India only or also abroad.
**Suggest draft objects** writes a draft from standard clause wording, one clause per activity plus a
closing incidental clause. The draft can be edited freely. When **Use in LLP agreement** is ticked, clause 6
(main business) is replaced by the draft and kept in step with any further edits.

The draft is built from fixed wording inside the tool (it works offline and nothing is sent anywhere).
It is a starting point: review it for the client's actual business. A warning appears if the description
mentions an activity that may need a regulator's licence or registration, or that may be open only to
members of a profession.

## Print set

`0_PRINT_SET_All_Documents.docx` holds every document to be signed, each starting on a new page with its own
page size (the subscription sheet stays landscape) and the agreement's "Page x of y" footer counting
only the agreement's pages. Print this one file instead of opening each document.

## Checklist and request list

Section 7 lists, for each partner, PAN, Aadhaar, bank statement, photograph, mobile/e-mail, DSC and the signed
consents, and for the LLP the proposed names, proof of registered office, rent agreement, NOC, subscription
sheet and LLP Agreement. Items received through an upload (or a complete mobile/e-mail) tick themselves.
Unticked items appear in the data sheet as pending, and the client-facing items go into the request list.

## Loading the details from Excel (for scanned KYC copies)

Scanned PAN, Aadhaar or bank statement copies can't be read automatically. For these, use the Excel route:

1. Click **Download Excel template** (section 1 of the form). The file is `templates/LLP_data_template.xlsx`.
2. Fill in the **LLP** sheet (LLP, registered office, NOC and witness details) and the **Partners** sheet
   (one row per partner, from row 3). Cells shaded yellow are required, and the designation, relation and
   proof of address cells have drop-down lists.
3. Click **Upload filled Excel**. The form fills in, with the number of partners set from the rows in the file.
   Check the details on screen, then click **Generate documents**.

* Enter the **date of last transaction in the bank statement** for each partner; it is used for the
  2-month warning in **Document checks**.
* Dates can be typed as DD/MM/YYYY or entered as Excel dates.
* Invalid dates, PIN codes that aren't 6 digits and unknown designations are reported after the upload.
* Don't delete the hidden column A of the LLP sheet or the hidden row 1 of the Partners sheet; the form
  uses them to find each field.
* To change the template layout, edit `tools/build_excel_template.py` and run it, then run
  `tools/embed_templates.py`.

## Reading PAN, Aadhaar and bank statement PDFs

| Detail | Taken from |
|---|---|
| Name, PAN, date of birth, father's name | PAN (Aadhaar if not on PAN) |
| S/o / D/o / W/o | Aadhaar |
| Residential address | **Bank statement** (Aadhaar only if no bank address is found) |
| E-mail, mobile | Bank statement, if shown unmasked |
| Date of last transaction | Bank statement |

* The PDFs are read inside the browser and are not uploaded or stored anywhere.
* This works on PDFs that contain text: e-PAN, e-Aadhaar downloaded from UIDAI and statements downloaded
  from net banking. **Scanned or photographed copies are only images**; they are flagged and the details
  must be typed in.
* e-Aadhaar PDFs are password protected. The form asks for the password (UIDAI format: first 4 letters
  of the name in capitals followed by the year of birth).
* The Aadhaar number is never read, stored or printed.
* A field you have typed over is not overwritten by a later upload.
* Bank statement layouts differ from bank to bank. If a bank's layout is not read correctly,
  share a sample (with personal details masked) so the reading rules can be adjusted.

The **Document checks** panel at the end of the screen shows:

* a warning (in red) if the last transaction in a bank statement is more than 2 months before today
* names, dates of birth and father's names that differ between PAN, Aadhaar and bank statement
* scanned copies, missing PIN codes and documents not yet uploaded

## Checks built in

* PAN format, duplicate PAN, e-mail and mobile number
* Warning if the LLP name does not end with "LLP" / "Limited Liability Partnership" (Sec. 15(1), LLP Act, 2008)
* Warning if there are fewer than 2 partners (Sec. 6(1)) or fewer than 2 designated partners (Sec. 7(1))

The wording of each document is the firm's own standard format. Check the generated documents
against the current MCA (FiLLiP) requirements and the client's KYC before they are signed.

## Folder contents

* `index.html` – the web form
* `templates/` – the Word templates (editable): Form 9, consent letter, subscription sheet, NOC, LLP Agreement,
  data sheet, request list, and the Excel data template
* `lib/` – docxtemplater, PizZip (MIT licence), pdf.js (Apache 2.0 licence), the embedded templates
  `extract.js` (reads the PAN, Aadhaar and bank statement PDFs), `xlsxread.js` (reads the Excel template)
  `merge.js` (builds the print set) and `objects.js` (suggests the draft objects clause)
* `tools/build_templates.py` – one-time script that turned the firm's sample documents into templates
  (the samples contained client data and are not kept here)
* `tools/build_excel_template.py` – builds the Excel data template
* `tools/embed_templates.py` – packs the templates into `lib/templates.js`
