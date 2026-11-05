# DSC Register (Google Sheets)

A live register of the digital signature certificates (USB tokens) held for clients. The firm's **Google Sheet is
the database**; a small program attached to the sheet (Google Apps Script) shows it as a web page that all staff
open from one link. Every change is saved straight to the sheet, so everyone sees the same register.

**Setup:** follow [SETUP.md](SETUP.md) once. Files to paste into Google: `google/Code.gs` and `google/Index.html`.
`index.html` in this folder is only the launcher used by the home page (it opens the web-app link set in
`home-config.js`).

## Features

* **Register** – DSC no. (your numbering), holder, associated company / firm, designation, PAN, mobile, e-mail, class,
  type, certifying authority, token, dates of issue and expiry, where it is kept, status, remarks. Search, filter, sort.
  A DSC number cannot be used twice.
* **Expiry report** – DSCs expired and expiring in the next 15 days (changeable); print it, or filter the sheet.
* **Reminders** – a message per DSC (or for all listed) to copy, open in **WhatsApp** with the client's number, or open
  in **Gmail**; each reminder sent is logged and the last one shows in the expiry list. Wording in Settings.
* **Renewals** – date, validity (new expiry worked out), certifying authority, fee, invoice, payment status; updates
  the DSC's expiry; pending payments totalled.
* **Movement** – hand over / receive back with date and time, person and purpose; status updates; printable
  **acknowledgement slip** with signature lines.
* **History** per DSC; **dashboard** of active, expired, expiring, out of office and in office.
* **Daily e-mail to the office** (optional) listing DSCs expired or due and DSCs out of the office too long.
* **Safe for several users** – changes are recorded against the user's Google e-mail; if two people edit the same
  DSC at once, the second save is refused with a message to refresh and redo it, instead of overwriting.
* **Access** – only people the sheet is shared with (as Editor) can open the register.

Do not record DSC passwords or PINs in the register.
