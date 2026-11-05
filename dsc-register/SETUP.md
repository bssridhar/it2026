# DSC Register on Google Sheets – one-time setup

About 15 minutes, done once by the person whose Google account will own the register (preferably the firm's
account, not a staff member's personal one). You need the two files in the `dsc-register/google` folder:
**Code.gs** and **Index.html**.

## 1. Create the Google Sheet

1. Go to <https://sheets.google.com> and create a blank spreadsheet. Name it **DSC Register**.
2. Menu **File → Settings**: check that the time zone is **(GMT+05:30) India Standard Time**.

## 2. Add the program

1. In the sheet, menu **Extensions → Apps Script**. A new tab opens.
2. Click on **Code.gs** on the left, delete everything in it, and paste the whole of `Code.gs` from this folder.
3. Click **+** next to *Files* → **HTML**, name it exactly **Index** (Google adds `.html`), delete what is in it,
   and paste the whole of `Index.html` from this folder.
4. Click the **Save** icon. Rename the project at the top to **DSC Register**.

## 3. Create the sheets

1. Go back to the spreadsheet tab and **reload** it. A new menu **DSC Register** appears (it can take a few seconds).
2. Click **DSC Register → 1. Set up the sheets**.
3. Google asks for permission. Choose your account. Because this is your own script, Google shows
   *"Google hasn't verified this app"* – click **Advanced → Go to DSC Register (unsafe)** → **Allow**.
   This is normal for a script you write yourself; it runs only inside your Google account.
4. Five tabs appear: **DSC Register, Movements, Renewals, Reminders, Settings**. Do not rename them or their
   first-row headings.

## 4. Bring in your existing DSC list

Copy your existing numbered list into the **DSC Register** tab, from row 2, matching the column headings
(DSC No, Name of holder, Associated company / firm, …, Date of expiry, Status). At minimum fill **DSC No**,
**Name of holder** and **Date of expiry**; put **In office** in *Status* for DSCs kept with you. Leave
*Last updated*, *Updated by* and *Revision* blank.

## 5. Publish it as a web app

1. In the Apps Script tab: **Deploy → New deployment**.
2. Click the gear next to *Select type* → **Web app**.
3. Description: `DSC Register`.
   * **Execute as:** **User accessing the web app**
   * **Who has access:** **Anyone with Google account** (or, with Google Workspace, *Anyone within your organisation*)
4. Click **Deploy**, allow access if asked, and **copy the Web app URL** (it ends in `/exec`).

Only people who can edit the Google Sheet can use the register: anyone else who opens the link gets a
"no access" error. Each change is recorded against the Google e-mail of the person who made it.

## 6. Give staff access

In the spreadsheet: **Share** → add each staff member's Google e-mail as **Editor**. The first time a staff member
opens the web-app link, Google asks them to allow it (the same *unverified app* screen as above). The permission list
includes sending e-mail, because the program contains the daily e-mail; the program only sends that one summary
e-mail from the owner's account.

## 7. Link it to the home page

Open `home-config.js` (in the main tool folder) in Notepad and paste the web-app URL between the quotes of
`dscAppUrl: ""`. Save. The **DSC Register** card on the home page now opens the register.

## 8. Daily e-mail (optional)

In the register's **Settings** tab, enter who should receive the daily summary (comma-separated e-mails; blank =
the sheet owner) and the number of days a DSC may be out before it is flagged. Then, in the spreadsheet, menu
**DSC Register → 2. Turn on the daily e-mail**. Every morning around 8 am, the summary lists DSCs expired or due
within the set days and DSCs out of the office too long; nothing is sent on days with nothing to report.
**Send the daily e-mail now** sends one straight away to check.

## Updating the program later

When a new version of `Code.gs` or `Index.html` is provided: paste it over the old one in Apps Script, save, then
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The link stays the same.

## Good to know

* The Google Sheet *is* the register – you can also view, filter or print it directly in Google Sheets.
  Avoid editing the *Movements*, *Renewals* and *Reminders* tabs by hand; use the register for those.
* Google keeps the sheet's version history (**File → Version history**), so an accidental change can be undone.
* Do not record DSC passwords or PINs anywhere in the sheet.
