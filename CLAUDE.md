# Practice tool kit – conventions for new tools

- Each tool is a static page in its own folder (`<tool>/index.html`), opened from disk; no server, nothing uploaded.
- Every tool page must:
  - link back to the home page (`<a href="../index.html">← All tools</a>`);
  - include the desk calculator: `<script src="../shared/calc.js"></script>` just before `</body>`
    (it adds the flashing "Calculator" box at the bottom right);
  - have Save / Open case file (JSON) and keep a draft in localStorage; the save button is `#saveCase` (it downloads a
    `.json` through an `<a download>` click) and the open button clicks a hidden `<input type="file" accept=".json">`;
    load `<script src="../shared/casefile.js"></script>` before `calc.js` – it turns these into Save (into the opened
    file) / Save as… / Open with the browser's file picker, or – when opened from the tool kit server – into case files kept
    on the server (`/api/cases/<tool>`, `/api/case/<tool>/<name>.json`);
  - a register shared by the team (like DSC, Procedures) is kept in the database folder through `shared/db.js`
    (`KitDB.store('<name>')`: JSON file, lock, daily backup) instead of a case file;
    with the tool kit server (`server/kit-server.ps1`, opened at http://<main computer>:8080) the same KitDB API goes
    through the server – any register name of lower-case letters / digits / _ is accepted (no server change needed);
  - carry the "shared folder missing" check (the `__sharedMissing` script) right after `<meta charset>`.
- Register each tool in `home-config.js` and add a row to `README.md`. The home page (`index.html`) also loads
  `shared/calc.js`.
- Never commit client data (sample documents with Aadhaar, PAN, etc.); test with dummy data only. `database/` is
  git-ignored and must never be committed or put in the zip.
- Outputs follow the ICAI Code of Ethics: nothing that solicits professional work.
- Every release zip: raise `version` in `version.js`, set its date and "whatsNew"; the zip (git archive, top folder
  `Practice_tool_kit/`) must not contain `database/`, `backups/`, `my-settings.js` or `kit-config.json` (all git-ignored). Office-specific
  settings belong in `my-settings.js` (sample: `my-settings.sample.js`), not in `home-config.js`.
