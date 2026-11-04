# LLP Incorporation Documents – web form

Fill in one form and get the standard LLP incorporation documents as Word (.docx) files:

| # | Document | Copies |
|---|----------|--------|
| 1 | Form 9 – Consent to act as designated partner/partner | one per partner |
| 2 | Consent letter to act as designated partner | one per partner |
| 3 | Subscription sheet | one, all partners |
| 4 | NOC from owner of registered office premises | one |

## How to use

1. Download or clone this folder (`llp-docs`) to your computer.
2. Double-click `index.html`. It opens in Chrome, Edge or Firefox. You don't need internet access or a server.
3. Fill in the LLP, partners, NOC and witness details, then click **Generate documents**.
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

## Checks built in

* PAN format, duplicate PAN, e-mail and mobile number
* Warning if the LLP name does not end with "LLP" / "Limited Liability Partnership" (Sec. 15(1), LLP Act, 2008)
* Warning if there are fewer than 2 partners (Sec. 6(1)) or fewer than 2 designated partners (Sec. 7(1))

The wording of each document is the firm's own standard format. Check the generated documents
against the current MCA (FiLLiP) requirements and the client's KYC before they are signed.

## Folder contents

* `index.html` – the web form
* `templates/` – the Word templates (editable)
* `lib/` – docxtemplater and PizZip (MIT licence) and the embedded templates
* `tools/build_templates.py` – one-time script that turned the firm's sample documents into templates
  (the samples contained client data and are not kept here)
* `tools/embed_templates.py` – packs `templates/*.docx` into `lib/templates.js`
