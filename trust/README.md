# Trust Formation

Open `index.html` (or pick the tool on the home page). Everything runs in the browser; nothing is uploaded.

## Inputs (on screen, or through the Excel template)

1. **Trust** – name, corpus, statutory references (Income-tax Act, 2025 by default; 1961 wording available),
   immovable property on formation, optional clauses (other trustees' contribution, take-over of similar trusts,
   no activities outside India, arbitration).
2. **Principal office** – address lines and the owner (for the NOC).
3. **Founders and trustees** – one card per person: title, name, S/o-D/o-W/o, father's / husband's name, date of birth
   (age is printed), Aadhaar, PAN, address, position, and Founder / Trustee / Bank signatory flags.
4. **Objects** – the objects of the firm's format are loaded; tick / untick, edit, reorder, add. Objects with the same
   heading are printed under it as (i), (ii)…
5. **Administration** – minimum and maximum trustees, term, meeting frequency, quorums, notice, bank operation.
6. **Execution** – place, date (or blank day with month and year), jurisdiction, additional clauses, witnesses.
7. **Registration, PAN, bank, Form 104** – Sub-Registrar, Document No., trust PAN, bank, contact, FCRA / public trust
   registration, section 354(2) approval, note on proposed activities.
8. **Formalities** – ten steps with documents, done / date / note, and the Form 106 / Form 105 timing.

## Documents

Trust Deed · NOC for the principal office · Trustees' resolution for the bank account · PAN data sheet ·
Form No. 104 data sheet · Note on proposed activities · Formalities checklist.

## Statutory references

* Provisional registration: section 332(3) (Table: Sl. No. 1) and provisional approval: section 354(2), Form No. 104,
  order in Form No. 106 – from the Form No. 104 FAQs on the Income Tax e-filing portal.
* Deed wording under the 2025 Act: investments – section 350 (Schedule XVI); approval of the recipient trust on
  dissolution – section 354. Verify against the Act before use.

## Templates

```
python3 tools/build_templates.py        # trust_deed.docx, letter.docx, sheet.docx
python3 tools/build_excel_template.py   # Trust_data_template.xlsx (objects from tools/objects.json)
python3 tools/embed_templates.py        # lib/templates.js
```
