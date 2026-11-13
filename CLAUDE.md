# Practice tool kit – conventions for new tools

- Each tool is a static page in its own folder (`<tool>/index.html`), opened from disk; no server, nothing uploaded.
- Every tool page must:
  - link back to the home page (`<a href="../index.html">← All tools</a>`);
  - include the desk calculator: `<script src="../shared/calc.js"></script>` just before `</body>`
    (it adds the flashing "Calculator" box at the bottom right);
  - have Save / Open case file (JSON) and keep a draft in localStorage;
  - carry the "shared folder missing" check (the `__sharedMissing` script) right after `<meta charset>`.
- Register each tool in `home-config.js` and add a row to `README.md`. The home page (`index.html`) also loads
  `shared/calc.js`.
- Never commit client data (sample documents with Aadhaar, PAN, etc.); test with dummy data only.
- Outputs follow the ICAI Code of Ethics: nothing that solicits professional work.
