# DSC Register

Keeps track of the digital signature certificates (USB tokens) held for clients.

## Where the data lives

The register is an Excel file, **DSC_Register.xlsx**, kept in **Zoho Sheet** (or Zoho WorkDrive) as the master copy.
The tool reads and writes that file; it does not connect to Zoho itself.

**Daily routine (several staff, different PCs)**

1. Download the latest DSC_Register.xlsx from Zoho.
2. In the tool, enter your name and click **Open register (Excel)**.
3. Make the changes (add DSCs, record movements, renewals, reminders).
4. Click **Save register (Excel)** and upload the saved file to Zoho, replacing the earlier copy.

Each save increases the **version number** and records who saved it, shown at the top of the tool and in the
file's *Info* sheet. If two people worked on copies at the same time, open one and use **Merge another copy**
with the other: for each DSC the more recent change is kept, and all movement, renewal and reminder entries
from both copies are kept. The tool warns before you close it with changes not yet saved to Excel.

**Starting off:** click **Download blank file**, paste your existing numbered list into the *DSC Register* sheet
(row 1 headings stay as they are), and open it in the tool.

## Features

* **Register** – DSC no. (your numbering), holder, associated company / firm, designation, PAN, mobile, e-mail,
  class, type, certifying authority, token, dates of issue and expiry, where it is kept, status, remarks.
  Search, filter (expiring, out of office, in office, inactive) and sort. Duplicate DSC numbers are refused.
* **Expiry report** – DSCs already expired and those expiring in the next 15 days (changeable in Settings);
  download as Excel or print.
* **Reminders** – a message for each DSC (or all listed) that can be copied, opened in **WhatsApp** (wa.me link to
  the client's mobile) or opened in the **e-mail** program. Each reminder sent is recorded, and the last
  reminder date shows in the expiry list. The wording is editable in Settings.
* **Renewals** – date, validity (new expiry worked out automatically), certifying authority, token, fee, invoice
  and payment status; the DSC's expiry is updated. Pending payments are totalled.
* **Movement** – hand over to the client or staff and receive back, with date and time, person and purpose.
  The DSC's status updates, the dashboard lists DSCs out of the office and for how long, and an
  **acknowledgement slip** with signature lines can be printed.
* **History** of each DSC – movements, renewals and reminders.
* **Dashboard** – active, expired, expiring, out of office, in office.

Do not record DSC passwords or PINs in the register.
