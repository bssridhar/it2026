/*
 * Reads PAN, Aadhaar and bank-statement PDFs in the browser (pdf.js) and picks out
 * the details needed for the LLP documents. Nothing is uploaded anywhere.
 *
 * Works on PDFs that contain text (e-PAN, e-Aadhaar downloaded from UIDAI, statements
 * downloaded from net banking). Scanned/photographed copies contain only an image;
 * these are detected and reported so the details can be keyed in by hand.
 *
 * The Aadhaar number is never read, stored or printed.
 */
window.LLPExtract = (function () {
  "use strict";

  /* ------------------------------------------------------------ PDF -> lines */
  async function readPdf(file, askPassword) {
    const data = new Uint8Array(await file.arrayBuffer());
    const task = window.pdfjsLib.getDocument({ data, isEvalSupported: false });
    task.onPassword = (update, reason) => {
      const pw = askPassword(reason === 2); // 2 = incorrect password
      if (pw === null || pw === undefined) { task.destroy(); return; }
      update(pw);
    };
    let pdf;
    try { pdf = await task.promise; }
    catch (e) {
      if (e && e.name === "PasswordException") throw new Error("The PDF is password protected and no password was given.");
      throw new Error("The file could not be opened as a PDF.");
    }
    const lines = [];
    let chars = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const items = tc.items
        .filter(it => it.str && it.str.trim())
        .map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || 8, s: it.str }));
      chars += items.reduce((a, i) => a + i.s.trim().length, 0);
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const pageLines = [];
      for (const it of items) {
        const tol = Math.max(2, it.h * 0.45);
        let line = pageLines.find(l => Math.abs(l.y - it.y) <= tol);
        if (!line) { line = { y: it.y, items: [] }; pageLines.push(line); }
        line.items.push(it);
      }
      pageLines.sort((a, b) => b.y - a.y);
      for (const l of pageLines) {
        l.items.sort((a, b) => a.x - b.x);
        const cells = [];
        let cur = null;
        for (const it of l.items) {
          const gap = cur ? it.x - cur.end : 0;
          if (!cur || gap > Math.max(14, it.h * 1.6)) {
            cur = { x: it.x, end: it.x + it.w, text: it.s };
            cells.push(cur);
          } else {
            cur.text += (gap > it.h * 0.15 && !/\s$/.test(cur.text) && !/^\s/.test(it.s) ? " " : "") + it.s;
            cur.end = it.x + it.w;
          }
        }
        cells.forEach(c => { c.text = c.text.replace(/\s+/g, " ").trim(); });
        const cl = cells.filter(c => c.text);
        if (cl.length) lines.push({ page: n, y: l.y, cells: cl, text: cl.map(c => c.text).join("   ") });
      }
    }
    return { lines, text: lines.map(l => l.text).join("\n"), scanned: chars < 25 * pdf.numPages, pages: pdf.numPages };
  }

  /* ------------------------------------------------------------ helpers */
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  const DATE_RE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b|\b(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/,]+(\d{4}|\d{2})\b|\b(\d{4})-(\d{2})-(\d{2})\b/g;

  function mkDate(y, m, d) {
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d);
    return (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) ? dt : null;
  }
  function datesIn(s) {
    const out = [];
    DATE_RE.lastIndex = 0;
    let m;
    while ((m = DATE_RE.exec(s))) {
      let d = null;
      if (m[1]) d = mkDate(+m[3], +m[2] - 1, +m[1]);
      else if (m[4]) { const mon = MONTHS[m[5].toLowerCase().slice(0, m[5].length > 3 && m[5].toLowerCase().startsWith("sept") ? 4 : 3)]; if (mon !== undefined) d = mkDate(+m[6], mon, +m[4]); }
      else if (m[7]) d = mkDate(+m[7], +m[8] - 1, +m[9]);
      if (d) out.push({ date: d, index: m.index, raw: m[0] });
    }
    return out;
  }
  const iso = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  const ascii = s => !/[^\x00-\x7F\u2013\u2019]/.test(s);
  const isNameLike = s => /^[A-Za-z][A-Za-z .']{1,60}$/.test(s) && /[A-Za-z]{2}/.test(s);
  const HONORIFIC = /^(MR|MRS|MS|MISS|SHRI|SRI|SMT|KUM|KUMARI|DR|M\/S)\.?\s+/i;
  const cleanName = s => (s || "").replace(HONORIFIC, "").replace(/\s+/g, " ").replace(/[.,]+$/, "").trim();
  const PIN_RE = /\b(\d{3})\s?(\d{3})\b/;
  const LABEL_RE = /^([A-Za-z][A-Za-z .'\/()-]{1,30}?)\s*:\s*(.*)$/;
  const ADDR_LABEL_OK = /^(city|state|pin|pin ?code|pincode|district|dist|country|town|village|post|po|taluk|area|locality)$/i;

  /** Value for a label: text after the label in the same cell, else next cell, else next line. */
  function labelled(lines, labelRe, exclude) {
    for (let i = 0; i < lines.length; i++) {
      const cells = lines[i].cells;
      for (let c = 0; c < cells.length; c++) {
        const t = cells[c].text;
        if (exclude && exclude.test(t)) continue;
        const m = t.match(labelRe);
        if (!m) continue;
        const rest = (m[m.length - 1] || "").replace(/^[\s:\-–]+/, "").trim();
        if (rest) return { value: rest, line: i, cell: c };
        if (cells[c + 1]) return { value: cells[c + 1].text, line: i, cell: c + 1 };
        for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
          const cand = lines[j].cells.find(x => ascii(x.text));
          if (cand) return { value: cand.text, line: j, cell: lines[j].cells.indexOf(cand) };
        }
      }
    }
    return null;
  }

  /** Collect address lines starting at (line, x) until a PIN code is reached. */
  function collectAddress(lines, start, firstText, x, maxLines) {
    const parts = [];
    let gotPin = false;
    const push = t => {
      t = t.replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "");
      if (t) parts.push(t);
      if (PIN_RE.test(t)) gotPin = true;
    };
    if (firstText) push(firstText);
    for (let j = start + 1; j < lines.length && !gotPin && parts.length < maxLines; j++) {
      const cells = lines[j].cells.filter(c => ascii(c.text));
      if (!cells.length) continue;
      // the cell nearest to the address column
      let cell = cells.reduce((best, c) => Math.abs(c.x - x) < Math.abs(best.x - x) ? c : best, cells[0]);
      if (Math.abs(cell.x - x) > 60) break;
      const lm = /^[SDWC]\s*\/\s*O\b/i.test(cell.text) ? null : cell.text.match(LABEL_RE);
      if (lm) {
        if (ADDR_LABEL_OK.test(lm[1].trim())) { push(lm[2]); continue; }
        break; // another field (Account No, Email, ...) - address has ended
      }
      if (datesIn(cell.text).length && /\d+\.\d{2}/.test(lines[j].text)) break; // reached transactions
      push(cell.text);
    }
    return { lines: parts, complete: gotPin };
  }

  /* ------------------------------------------------------------ PAN */
  function parsePan(doc) {
    const f = {}, notes = [];
    const pan = doc.text.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
    if (pan) f.pan = pan[0];
    const fat = labelled(doc.lines, /(?:^|\/\s*)father'?s?\s*name\s*[:\-]?\s*(.*)$/i);
    const nm = labelled(doc.lines, /(?:^|\/\s*)name\s*[:\-]?\s*(.*)$/i, /father|mother|bank|branch|account|card/i);
    if (nm && isNameLike(nm.value)) f.name = cleanName(nm.value);
    if (fat && isNameLike(fat.value)) f.father_name = cleanName(fat.value);
    const dobL = labelled(doc.lines, /(?:^|\/\s*)(?:date of birth|dob)\s*[:\-]?\s*(.*)$/i);
    let dob = dobL && datesIn(dobL.value)[0];
    if (!dob) dob = datesIn(doc.text)[0];
    if (dob) f.dob = iso(dob.date);
    if (!f.name) {
      // Older card layout without labels: NAME, FATHER'S NAME, DOB one below the other
      const skip = /INCOME|TAX|DEPARTMENT|GOVT|INDIA|PERMANENT|ACCOUNT|NUMBER|CARD|SIGNATURE|^E-?PAN/i;
      const cand = [];
      for (const l of doc.lines) {
        if (dob && l.text.includes(dob.raw)) break;
        for (const c of l.cells) if (/^[A-Z][A-Z .']+$/.test(c.text) && c.text.length > 2 && !skip.test(c.text)) cand.push(c.text);
      }
      if (cand[0]) { f.name = cleanName(cand[0]); notes.push("Name read from an unlabelled PAN layout – please check."); }
      if (cand[1] && !f.father_name) f.father_name = cleanName(cand[1]);
    }
    if (!f.pan) notes.push("PAN number not found in this file.");
    return { fields: f, notes };
  }

  /* ------------------------------------------------------------ Aadhaar */
  function parseAadhaar(doc) {
    const f = {}, notes = [];
    const L = doc.lines;
    // date of birth
    let dobIdx = -1;
    for (let i = 0; i < L.length; i++) {
      const m = L[i].text.match(/(?:DOB|D\.O\.B|Date of Birth)[^0-9]{0,15}(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
      if (m) { const d = datesIn(m[1])[0]; if (d) { f.dob = iso(d.date); dobIdx = i; break; } }
    }
    if (!f.dob && /Year of Birth/i.test(doc.text)) notes.push("Aadhaar shows only the year of birth.");
    // name: English line just above the DOB line
    if (dobIdx > 0) {
      for (let i = dobIdx - 1; i >= Math.max(0, dobIdx - 3); i--) {
        const c = L[i].cells.find(x => isNameLike(x.text) && !/government|india|aadhaar|unique|authority/i.test(x.text));
        if (c) { f.name = cleanName(c.text); break; }
      }
    }
    // relation (S/O, D/O, W/O, C/O)
    const rel = doc.text.match(/\b([SDWC])\s*\/\s*O\s*[:\-]?\s*([A-Za-z][A-Za-z .']{1,60}?)\s*(?:,|\n|$)/i);
    if (rel) {
      const k = rel[1].toUpperCase();
      f.relation = { S: "S/o", D: "D/o", W: "W/o", C: "C/o" }[k];
      f.relation_person = cleanName(rel[2]);
      if (k === "C") notes.push("Aadhaar shows C/O (care of), which may not be the father's name.");
    }
    // address: after the "Address" label, else the block after "To"
    let addr = null;
    for (let i = 0; i < L.length && !addr; i++) {
      for (const c of L[i].cells) {
        const m = c.text.match(/^address\s*[:\-]?\s*(.*)$/i);
        if (m && ascii(c.text)) { addr = collectAddress(L, i, m[1], c.x, 8); break; }
      }
    }
    if (!addr || !addr.lines.length) {
      const to = L.findIndex(l => /^to$/i.test(l.cells[0].text));
      if (to >= 0) {
        let i = to + 1;
        while (i < L.length && !L[i].cells.some(c => isNameLike(c.text))) i++;
        if (i < L.length) addr = collectAddress(L, i, "", L[i].cells[0].x, 8);
      }
    }
    if (addr && addr.lines.length) {
      let text = addr.lines.join("\n")
        .replace(/\b[SDWC]\s*\/\s*O\s*[:\-]?\s*[A-Za-z .']+,?\s*/i, "")   // drop "S/O: name,"
        .replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, "")                           // never keep an Aadhaar no.
        .replace(/\bVID\b.*$/gim, "");
      f.address = text.split("\n").map(s => s.trim().replace(/^,|,$/g, "").trim()).filter(Boolean).join("\n");
      if (!addr.complete) notes.push("PIN code not found at the end of the Aadhaar address.");
    }
    const mob = doc.text.match(/Mobile\s*(?:No\.?)?\s*[:\-]?\s*(\d{10})\b/i);
    if (mob) f.mobile = mob[1];
    if (!f.name && !f.dob) notes.push("This does not look like an e-Aadhaar PDF.");
    return { fields: f, notes };
  }

  /* ------------------------------------------------------------ Bank statement */
  function parseBank(doc) {
    const f = {}, notes = [];
    const L = doc.lines;
    // account holder name
    let nm = labelled(L, /^(?:customer|account holder(?:'s)?|a\/c holder|account)?\s*name\s*[:\-]\s*(.*)$/i, /branch|bank|nominee|ifsc|scheme|product/i)
          || labelled(L, /^(?:customer|account holder(?:'s)?|account)\s*name\s*[:\-]?\s*(.*)$/i, /branch|bank|nominee/i);
    let nameLine = -1, nameX = 0;
    if (nm) { f.name = cleanName(nm.value); nameLine = nm.line; nameX = L[nm.line].cells[nm.cell].x; }
    else {
      for (let i = 0; i < L.length && nameLine < 0; i++)
        for (const c of L[i].cells)
          if (HONORIFIC.test(c.text) && isNameLike(c.text.replace(/\//, ""))) { f.name = cleanName(c.text); nameLine = i; nameX = c.x; break; }
    }
    // address
    let addr = null;
    for (let i = 0; i < L.length && !addr; i++) {
      for (const c of L[i].cells) {
        const m = c.text.match(/^(?:customer |communication |mailing |correspondence |registered )?address\s*[:\-]?\s*(.*)$/i);
        if (m && !/e-?mail/i.test(c.text)) {
          const x = m[1] ? c.x : (L[i].cells[L[i].cells.indexOf(c) + 1] || c).x;
          const first = m[1] || (L[i].cells[L[i].cells.indexOf(c) + 1] || {}).text || "";
          addr = collectAddress(L, i, first, x, 7);
          break;
        }
      }
    }
    if ((!addr || !addr.lines.length) && nameLine >= 0) addr = collectAddress(L, nameLine, "", nameX, 7);
    if (addr && addr.lines.length) {
      f.address = addr.lines.join("\n");
      if (!addr.complete) notes.push("PIN code not found in the bank statement address – please check the address.");
    } else notes.push("Address not found in the bank statement.");
    // e-mail and mobile (only if not masked)
    const em = doc.text.match(/e-?mail(?:\s*id)?\s*[:\-]?\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i);
    if (em && !/x{3,}|\*/i.test(em[1])) f.email = em[1].toLowerCase();
    const mob = doc.text.match(/(?:mobile|mob)(?:\s*no\.?)?\s*[:\-]?\s*(?:\+?91[\s-]?)?(\d{10})\b/i);
    if (mob) f.mobile = "+91 " + mob[1];
    // last transaction: lines that begin with a date and carry an amount
    let last = null, count = 0;
    for (const l of L) {
      if (/statement|period|opening|closing|generated|printed|as on|as of|from\s.*\sto\s|date of issue/i.test(l.text)) continue;
      const head = l.cells.slice(0, 2).map(c => c.text).join(" ");
      const d = datesIn(head)[0];
      if (!d || d.index > 6) continue;
      if (!/\d[\d,]*\.\d{2}\b/.test(l.text)) continue;
      count++;
      if (!last || d.date > last) last = d.date;
    }
    const period = doc.text.match(/(?:period|from)[^0-9]{0,25}([0-9][^\n]{4,14}?)\s*(?:to|-)\s*([0-9][^\n]{4,14})/i);
    return { fields: f, notes, lastTxn: last ? iso(last) : "", txnCount: count, period: period ? (period[1] + " to " + period[2]).trim() : "" };
  }

  /* ------------------------------------------------------------ comparisons */
  function nameKey(s) {
    return cleanName(s || "").toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
  }
  function sameName(a, b) {
    if (!a || !b) return true;
    const A = nameKey(a), B = nameKey(b);
    if (A === B) return true;
    // allow initials: every word of the shorter must match a word or initial of the longer
    const ta = A.split(" "), tb = B.split(" ");
    const [s, l] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
    const pool = l.slice();
    return s.every(w => {
      const i = pool.findIndex(p => p === w || (w.length === 1 && p[0] === w) || (p.length === 1 && w[0] === p));
      if (i < 0) return false; pool.splice(i, 1); return true;
    }) && (s.length === l.length);
  }
  function monthsBefore(today, n) {
    const d = new Date(today.getFullYear(), today.getMonth() - n, today.getDate());
    if (d.getDate() !== today.getDate()) d.setDate(0); // e.g. 31 Dec -> 31 Oct, 30 Apr -> 28/29 Feb
    return d;
  }

  return { readPdf, parsePan, parseAadhaar, parseBank, sameName, monthsBefore, datesIn, iso };
})();
