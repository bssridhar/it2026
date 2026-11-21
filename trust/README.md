# Trust Formation

Open `index.html` (or pick the tool on the home page). Everything runs in the browser; nothing is uploaded.

## Inputs (on screen, or through the Excel template)

1. **Trust** – name, corpus, statutory references (Income-tax Act, 2025 by default; 1961 wording available),
   immovable property on formation, optional clauses (other trustees' contribution, take-over of similar trusts,
   no activities outside India, arbitration).
2. **Principal office** – address lines and the owner (for the NOC).
3. **Founders and trustees** – one card per person: title, name, S/o-D/o-W/o, father's / husband's name, date of birth
   (age is printed), Aadhaar, PAN, address, position, and Founder / Trustee / Bank signatory flags.
4. **Objects** – the objects of the firm's format (Vasavi Mitra Foundation deed) are loaded; tick / untick, edit,
   move up / down, add new ones or add from the standard library (objects of the earlier format). Give **Order No.** 1 to
   the main object, 2 to the next…; "Arrange by order No." sorts the list. The deed prints them as a), b), c)….
5. **Administration** – minimum and maximum trustees, term of office bearers, optional meeting clauses, and the
   **operation of the bank account**: office bearers jointly or individually as decided by the Board (firm's format),
   any one office bearer individually, office bearers jointly (all / any two / three), either office bearer jointly with
   another (e.g. President or Secretary with the Treasurer), trustees individually / any two jointly / all jointly, or
   own wording; optional single-signature limit and the Board's power to authorise any trustee. The same wording is
   used in clause 5(e) of the deed and in the bank resolution.
6. **Execution** – place, date (or blank day with month and year), jurisdiction, additional clauses, witnesses.
7. **Registration, PAN, bank, Form 104** – Sub-Registrar, Document No., trust PAN, bank, contact, FCRA / public trust
   registration, section 354(2) approval, note on proposed activities.
8. **Formalities** – ten steps with documents, done / date / note, and the Form 106 / Form 105 timing.

## Documents

Trust Deed (Letter / A4 / Legal) · NOC for the principal office · Resolution for opening and operating the bank account
(as per the deed, with specimen signatures) · PAN data sheet ·
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
