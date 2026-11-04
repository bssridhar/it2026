# Statute Update Tracker

Checks the official government websites for Income-tax, GST, Company Law, ESI, PF, RBI and FEMA
(and any other statute you add) once a day, and lists the **new** notifications, circulars, advisories,
press releases and similar items that were not on those pages at the previous check.

* It reads **only the websites you list**. A website can be added only if its address ends with one of the
  **allowed government domains** (`gov.in`, `nic.in` and `rbi.org.in` to start with; see Settings).
  It ignores links on those pages that lead to other websites (social media, private sites). It also
  does not follow a page that redirects to such a website.
* Every item links back to the page on the official website where it was found.
* Statutes and websites can be **added, edited and deleted** from the screen.
* It runs on your own computer. Nothing is sent anywhere except the requests to the government websites
  and, if you switch it on, the e-mail to yourself.

## What you need

Python 3.8 or later. Nothing else needs to be installed, because the tool uses only Python's standard library.
On Windows, install Python from python.org and tick **"Add python.exe to PATH"** during installation.

## How to use it

1. Copy the `statute-tracker` folder to your computer.
2. Double-click **`Start Statute Tracker.bat`** (Windows). On Mac or Linux, run `python3 app.py` in the folder.
   The screen opens in your web browser at `http://127.0.0.1:8765`. Keep the black window open while you use it.
3. The first time, open **Statutes & websites**, click **Edit / Test** on each website and then
   **Test - show what is read**. The test lists the items the tool can read from that page.
   * If the test fails with *page not found*, the department may have moved the page. Open the department's
     website, go to the page that lists the notifications or circulars, copy its address and paste it in.
   * If it reads **no items**, the page probably builds its list with JavaScript. The tool then
     watches the page and tells you when it **changes**, so you know to open it.
4. Click **Check now**. **The first check only records** what is already on each page. From the next
   check on, only items that are **new** are shown under **Updates**.

### Checking every day without opening the screen (Windows)

Double-click **`Set up daily check (Windows).bat`** once. This creates a Windows scheduled task that runs
`daily_check.bat` every day at 9:15 AM; change the time inside the file if you like. The computer has to be on
at that time. If it was off, the screen checks automatically the next time you open it (this can be switched off
in Settings). The output of the last scheduled run is saved in `data\last_check_log.txt`.

On Mac or Linux, add a line like this with `crontab -e`:

```
15 9 * * * cd /path/to/statute-tracker && python3 tracker.py check --email
```

### Getting the updates by e-mail

Under **Settings > E-mail the daily report**, enter the mail server details and the address to send to, tick
*Send an e-mail after each check* and click **Send a test e-mail**. For Gmail, use server `smtp.gmail.com`,
port `465`, and an **App password** (Google Account > Security > 2-Step Verification > App passwords).
These settings are kept only on your computer, in `data/email_settings.json`.

## Adding, editing and deleting

On the **Statutes & websites** tab:

| To | Click |
|---|---|
| Add a statute (e.g. Customs, SEBI, Labour Codes) | **+ Add statute** |
| Rename or delete a statute | **Rename** / **Delete** next to its name |
| Add a website to a statute | **+ Add website** |
| Change a website's address, filters or note, or switch it off | **Edit / Test** |
| Remove a website | **Delete** on its row |

For each website you can set the following:

* **Keep only items containing any of these words**: useful when one page covers many subjects. The FEMA
  entries read RBI's notifications but keep only items mentioning FEMA, foreign exchange, A.P. (DIR Series),
  ECB, LRS and similar terms.
* **Ignore items containing any of these words**: for example `tender, recruitment, vacancy`.
* **Type of page**: normally *Detect automatically*. RSS/Atom feeds (such as RBI's) are read directly.
* **Old TLS settings**: tick this only if the test shows a "secure connection failed" error. Some government
  servers use old encryption settings. The certificate is still checked.

When you change a website's address or filters, the next check records its items again as a fresh starting point.

All settings are kept in `config.json`, which can also be edited in a text editor.

## Websites included to start with

The starting list was prepared on 04-11-2026. The note against each website says whether its address was found
on the official site through a web search, or still has to be confirmed by you with **Test**. The addresses
could not be opened directly while this tool was being built, so test each one once on your computer.

| Statute | Websites |
|---|---|
| Income-tax | incometaxindia.gov.in: circulars, notifications, communications, press releases; incometax.gov.in: e-filing portal latest updates |
| GST | cbic-gst.gov.in: Central Tax and Central Tax (Rate) notifications; cbic.gov.in; gst.gov.in: news and advisories; gstcouncil.gov.in |
| Company Law | mca.gov.in |
| ESI | esic.gov.in: circulars and home page |
| PF | epfindia.gov.in: circulars and home page |
| RBI | rbi.org.in: notifications RSS, press releases RSS, notifications page |
| FEMA | rbi.org.in: notifications filtered for FEMA terms, Master Directions filtered for FEMA terms |

## Limits

* Some government websites block automated or overseas access, change their page layout, or are down at
  times. Websites that could not be checked are listed under *Notes on the last check*, so nothing fails
  silently. The next check catches up, because items are compared with everything seen before.
* Pages that build their lists with JavaScript (some portals) can be watched only for *changes*; open them to see what changed.
* A *page changed* note can also appear for small edits such as a new date on the page.
* The tool reports what the website shows. The notification, circular or order itself (and the Gazette, where
  applicable) remains the authority.

## Files

| File | Purpose |
|---|---|
| `app.py` | The screen (a small web server on this computer only) |
| `tracker.py` | Reads the websites and works out what is new. `python tracker.py check`, `python tracker.py test URL`, `python tracker.py list` |
| `ui.html` | The screen's page |
| `config.json` | Statutes, websites and allowed domains |
| `data/` | What has been seen, the history of new items, e-mail settings (created on first run; not shared) |
| `reports/` | `latest.html` and a dated report for each day (last 90 kept) |
| `tests/` | Offline tests: `python -m unittest discover -s tests` |
