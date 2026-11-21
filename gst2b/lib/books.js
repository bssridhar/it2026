/*
 * Purchase register (books) – reading for the GSTR-2B reconciliation.
 * window.G2BBooks = { FIELDS, readTable(bytes|text, name), guessMap(headers), applyMap(table, map), readTallyXml(bytesOrText), aggregate(raw, opts), template(ExcelJS) }
 *
 * Accepted:
 *  - the standard template of this tool (Excel);
 *  - a register exported from Tally to Excel (.xlsx) – Purchase Register / columnar register / GSTR-2 export – or any Excel / CSV
 *    with a heading row: the columns are recognised from their headings and can be changed on screen;
 *  - Tally XML export of vouchers (Purchase / Debit Note), UTF-8 or UTF-16.
 * A raw row: { vdate, vno, vtype, name, gstin, invno, invdate, doctype, txval, igst, cgst, sgst, cess, total, rcm }  (dates ISO yyyy-mm-dd)
 */
(function (root) {
  "use strict";
  // key, label, multi (several columns added), heading pattern, pattern to exclude
  const FIELDS = [
    ['gstin', 'Supplier GSTIN', false, /gstin|gst\s*no|gst\s*reg/i],
    ['name', 'Supplier name', false, /supplier\s*name|party\s*name|name\s*of\s*(the\s*)?supplier|^particulars$|^party$|^supplier$|ledger\s*name|^name$/i],
    ['invno', 'Supplier invoice no.', false, /supplier\s*inv(oice)?\.?\s*(no|number)|^inv(oice)?\.?\s*(no|number)|bill\s*(no|number)|^ref(erence)?\.?\s*(no|number)?$|document\s*(no|number)|note\s*(no|number)/i],
    ['invdate', 'Supplier invoice date', false, /supplier\s*inv(oice)?\.?\s*date|^inv(oice)?\.?\s*date|bill\s*date|ref(erence)?\.?\s*date|document\s*date|note\s*date/i],
    ['vdate', 'Voucher date', false, /^(voucher\s*|vch\.?\s*)?date$|posting\s*date|accounting\s*date/i],
    ['vno', 'Voucher no.', false, /(voucher|vch)\.?\s*(no|number)/i],
    ['vtype', 'Voucher type', false, /(voucher|vch)\.?\s*type/i],
    ['doctype', 'Document type (invoice / credit note / debit note)', false, /document\s*type|invoice\s*type|note\s*type|doc\.?\s*type/i],
    ['txval', 'Taxable value', true, /taxable|assessable|^value$|^purchases?\b/i, /tax\s*amount|total|tax\s*paid|purchase\s*tax/i],
    ['igst', 'IGST', true, /igst|integrated/i, /rate/i],
    ['cgst', 'CGST', true, /cgst|central\s*tax/i, /rate/i],
    ['sgst', 'SGST / UTGST', true, /sgst|utgst|state\s*(\/\s*ut\s*)?tax|state\s*tax/i, /rate/i],
    ['cess', 'Cess', true, /cess/i, /rate/i],
    ['total', 'Invoice value (total)', false, /gross\s*total|invoice\s*value|total\s*amount|bill\s*amount|^total$/i],
    ['rcm', 'Reverse charge (Y/N)', false, /reverse\s*charge|^rcm/i],
  ];
  const str = v => v === undefined || v === null ? '' : String(v).trim();
  const num = v => { if (typeof v === 'number') return v; let s = String(v ?? '').trim(); if (!s) return 0; const neg = /^\(.*\)$/.test(s); s = s.replace(/[()₹,\s]|Dr|Cr/gi, ''); const n = Number(s); return isFinite(n) ? (neg ? -n : n) : 0; };
  const colOf = ref => ref.replace(/\d+$/, ''), rowOf = ref => +ref.replace(/^[A-Z]+/, '');
  const cIdx = c => c.split('').reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0);

  function isoDate(v) {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v === 'number') { if (v < 1 || v > 80000) return ''; return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10); }
    const s = String(v).trim();
    let m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; }
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
    m = /^(\d{4})(\d{2})(\d{2})$/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    m = /^(\d{1,2})[\s\-\/]([A-Za-z]{3})[A-Za-z]*[\s\-\/,]+(\d{2,4})/.exec(s);
    if (m && MON[m[2].toLowerCase()]) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(MON[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    return '';
  }

  /* ---------- tables (Excel / CSV) ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch; }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    const cells = {}; rows.forEach((r, i) => r.forEach((v, j) => { if (v !== '') { let c = '', n = j + 1; while (n) { c = String.fromCharCode(65 + (n - 1) % 26) + c; n = Math.floor((n - 1) / 26); } const t = v.trim(); cells[c + (i + 1)] = /^-?[\d,]*\.?\d+$/.test(t) ? Number(t.replace(/,/g, '')) : t; } }));
    return { CSV: cells };
  }

  /* find the heading row of every sheet; returns the best table */
  function tables(sheets) {
    const out = [];
    Object.entries(sheets).forEach(([name, cells]) => {
      const rows = {}; Object.keys(cells).forEach(ref => { (rows[rowOf(ref)] = rows[rowOf(ref)] || {})[colOf(ref)] = cells[ref]; });
      const rn = Object.keys(rows).map(Number).sort((a, b) => a - b);
      let best = null;
      rn.slice(0, 40).forEach(r => { const H = rows[r], hs = Object.values(H).map(str);
        const score = FIELDS.filter(f => hs.some(h => f[3].test(h) && !(f[4] && f[4].test(h)))).length + (hs.some(h => /gstin/i.test(h)) ? 2 : 0) + (hs.some(h => /inv|bill|ref/i.test(h)) ? 1 : 0);
        if (score >= 4 && (!best || score > best.score)) best = { r, score }; });
      if (!best) return;
      // headings may run over two rows (Tally: "Supplier Invoice" / "No.") – join the row below where it has text and no numbers
      const H = Object.assign({}, rows[best.r]), next = rows[best.r + 1] || {};
      const twoRow = Object.values(next).length && Object.values(next).every(v => typeof v === 'string' && !/^\d/.test(v));
      if (twoRow) Object.entries(next).forEach(([c, v]) => { H[c] = str(H[c]) ? `${str(H[c])} ${str(v)}` : str(v); });
      const headers = Object.keys(H).sort((a, b) => cIdx(a) - cIdx(b)).map(c => ({ col: c, text: str(H[c]) })).filter(h => h.text);
      const data = rn.filter(r => r > best.r + (twoRow ? 1 : 0)).map(r => rows[r]);
      out.push({ sheet: name, headerRow: best.r, headers, data, score: best.score });
    });
    out.sort((a, b) => b.score - a.score || b.data.length - a.data.length);
    return out;
  }

  function readTable(input, fileName) {
    let sheets;
    if (typeof input === 'string') sheets = parseCSV(input);
    else sheets = root.LLPXlsx.readWorkbook(input);
    const t = tables(sheets);
    if (!t.length) throw new Error('no heading row with GSTIN / invoice number / tax columns was found – use the standard template, or check the export');
    return t;
  }

  function guessMap(headers) {
    const map = {}, used = new Set();
    FIELDS.forEach(([k, , multi, re, not]) => {
      const hits = headers.filter(h => re.test(h.text) && !(not && not.test(h.text)) && !used.has(h.col));
      if (!hits.length) return;
      if (multi) { map[k] = hits.map(h => h.col); hits.forEach(h => used.add(h.col)); } else { map[k] = hits[0].col; used.add(hits[0].col); }
    });
    // "Date" alone is the voucher date; if there is no invoice date, use it for both
    return map;
  }

  function applyMap(t, map) {
    const g = (R, k) => { const c = map[k]; if (!c) return undefined; if (Array.isArray(c)) return c.reduce((s, x) => s + num(R[x]), 0); return R[c]; };
    const out = [];
    t.data.forEach(R => {
      const invno = str(g(R, 'invno')), gstin = str(g(R, 'gstin')).toUpperCase().replace(/\s/g, ''), name = str(g(R, 'name'));
      const amt = ['txval', 'igst', 'cgst', 'sgst', 'cess'].reduce((o, k) => (o[k] = map[k] ? (Array.isArray(map[k]) ? g(R, k) : num(g(R, k))) : 0, o), {});
      if (!invno && !gstin && !name) return;
      if (/^(grand\s*)?total|^opening|^closing/i.test(name) || /^(grand\s*)?total/i.test(invno)) return;
      if (!amt.txval && !amt.igst && !amt.cgst && !amt.sgst && !amt.cess) return;
      out.push(Object.assign({ vdate: isoDate(g(R, 'vdate')), vno: str(g(R, 'vno')), vtype: str(g(R, 'vtype')), name, gstin: /^\d{2}[A-Z0-9]{13}$/.test(gstin) ? gstin : '', gstinRaw: gstin,
        invno, invdate: isoDate(g(R, 'invdate')), doctype: str(g(R, 'doctype')), total: num(g(R, 'total')), rcm: str(g(R, 'rcm')) }, amt));
    });
    return out;
  }

  /* ---------- Tally XML ---------- */
  function decode(input) {
    if (typeof input === 'string') return input;
    const b = input;
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b);
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b);
    if (b.length > 4 && b[1] === 0 && b[3] === 0) return new TextDecoder('utf-16le').decode(b);
    return new TextDecoder('utf-8').decode(b);
  }
  const TAX = [['igst', /igst|integrated/i], ['cgst', /cgst|central\s*tax/i], ['sgst', /sgst|utgst|state\s*tax/i], ['cess', /cess/i]];
  function readTallyXml(input) {
    let text = decode(input).replace(/^﻿/, '').replace(/&#(?:[0-8]|1[1-2]|1[4-9]|2\d|3[01]);/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('the XML file could not be read – export it again from Tally (Export → XML)');
    const kid = (el, tag) => { for (const c of el.children) if (c.tagName === tag) return c.textContent.trim(); return ''; };
    // GSTIN of ledgers, if masters were exported too
    const ledGstin = {};
    Array.from(doc.getElementsByTagName('LEDGER')).forEach(l => { const n = l.getAttribute('NAME') || kid(l, 'NAME'); let g = kid(l, 'PARTYGSTIN') || kid(l, 'GSTIN');
      if (!g) { const x = l.getElementsByTagName('GSTIN')[0]; if (x) g = x.textContent.trim(); } if (n && g) ledGstin[n] = g.toUpperCase(); });
    const vouchers = Array.from(doc.getElementsByTagName('VOUCHER')), types = {}, out = [];
    vouchers.forEach(v => {
      if (/^yes$/i.test(kid(v, 'ISCANCELLED')) || /^yes$/i.test(kid(v, 'ISOPTIONAL')) || /^yes$/i.test(kid(v, 'ISDELETED'))) return;
      const vtype = kid(v, 'VOUCHERTYPENAME') || v.getAttribute('VCHTYPE') || '';
      types[vtype] = (types[vtype] || 0) + 1;
      const party = kid(v, 'PARTYLEDGERNAME') || kid(v, 'PARTYNAME');
      const gstin = (kid(v, 'PARTYGSTIN') || kid(v, 'GSTIN') || ledGstin[party] || '').toUpperCase();
      const amt = { txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }; let total = 0;
      const entries = Array.from(v.children).filter(c => /LEDGERENTRIES\.LIST$/.test(c.tagName));
      entries.forEach(e => { const ln = kid(e, 'LEDGERNAME'), a = Math.abs(num(kid(e, 'AMOUNT')));
        if (ln === party || /^yes$/i.test(kid(e, 'ISPARTYLEDGER'))) { total = a; return; }
        const t = TAX.find(([, re]) => re.test(ln)); if (t) { amt[t[0]] += a; return; }
        if (/round/i.test(ln)) return;
        if (/tds|tcs/i.test(ln)) return;
        amt.txval += a; });
      Array.from(v.children).filter(c => /INVENTORYENTRIES\.LIST$/.test(c.tagName)).forEach(e => { amt.txval += Math.abs(num(kid(e, 'AMOUNT'))); });
      out.push(Object.assign({ vdate: isoDate(kid(v, 'DATE')), vno: kid(v, 'VOUCHERNUMBER'), vtype, name: party, gstin: /^\d{2}[A-Z0-9]{13}$/.test(gstin) ? gstin : '', gstinRaw: gstin,
        invno: kid(v, 'REFERENCE') || kid(v, 'SUPPLIERINVOICENO') || kid(v, 'VOUCHERNUMBER'), invdate: isoDate(kid(v, 'REFERENCEDATE')) || isoDate(kid(v, 'DATE')), doctype: '', total, rcm: '' }, amt));
    });
    if (!vouchers.length) throw new Error('no vouchers were found in the XML – export the Purchase / Debit Note vouchers (Day Book or register) as XML');
    return { rows: out, types };
  }

  /* ---------- one record per supplier invoice ---------- */
  const isReturn = r => /debit\s*note|purchase\s*return|credit\s*note/i.test(r.vtype) || /credit/i.test(r.doctype);
  function aggregate(raw, opts) {
    const o = opts || {}, by = new Map();
    raw.forEach(r => {
      if (o.types && r.vtype && o.types[r.vtype] === false) return;
      if (o.from && (r.vdate || r.invdate) < o.from) return;
      if (o.to && (r.vdate || r.invdate) > o.to) return;
      const sign = isReturn(r) ? -1 : 1;
      const k = [r.gstin || r.name.toUpperCase(), r.invno.toUpperCase(), r.invdate, sign].join('|');
      let x = by.get(k);
      if (!x) { x = { gstin: r.gstin, gstinRaw: r.gstinRaw, name: r.name, invno: r.invno, invdate: r.invdate, vdate: r.vdate, vnos: [], vtype: r.vtype, doctype: r.doctype || (sign < 0 ? 'Credit note / return' : 'Invoice'), sign, txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, total: 0, rcm: r.rcm, lines: 0 }; by.set(k, x); }
      ['txval', 'igst', 'cgst', 'sgst', 'cess', 'total'].forEach(h => { x[h] += sign < 0 ? -Math.abs(r[h] || 0) : (r[h] || 0); });
      if (r.vno && !x.vnos.includes(r.vno)) x.vnos.push(r.vno); x.lines++;
    });
    return Array.from(by.values()).map((x, i) => Object.assign(x, { id: `B${i}|${x.gstin}|${x.invno}|${x.invdate}`, vno: x.vnos.join(', ') }));
  }

  /* ---------- standard template ---------- */
  const TPL = ['Voucher date', 'Voucher no', 'Supplier name', 'Supplier GSTIN', 'Supplier invoice no', 'Invoice date', 'Document type', 'Taxable value', 'IGST', 'CGST', 'SGST/UTGST', 'Cess', 'Reverse charge (Y/N)', 'Remarks'];
  function template(ExcelJS) {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Purchase register');
    ws.addRow(TPL); ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    TPL.forEach((t, i) => { const c = ws.getCell(1, i + 1); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FAE' } }; c.alignment = { wrapText: true, vertical: 'middle' }; ws.getColumn(i + 1).width = [12, 12, 34, 18, 18, 12, 14, 14, 12, 12, 12, 10, 10, 30][i]; });
    ws.getRow(1).height = 32; ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (let r = 2; r <= 1001; r++) { ['A', 'F'].forEach(c => ws.getCell(c + r).numFmt = 'dd/mm/yyyy'); ['H', 'I', 'J', 'K', 'L'].forEach(c => ws.getCell(c + r).numFmt = '#,##0.00'); ws.getCell('G' + r).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Invoice,Credit note,Debit note"'] }; ws.getCell('M' + r).dataValidation = { type: 'list', allowBlank: true, formulae: ['"N,Y"'] }; }
    const n = wb.addWorksheet('Instructions'); n.getColumn(1).width = 120;
    ['Purchase register for reconciliation with GSTR-2B – one row per supplier invoice (several rows of the same invoice, e.g. rate-wise, are added up).', '',
      'Supplier GSTIN and Supplier invoice no are the keys of the match – enter them as in the supplier\'s invoice.',
      'Document type: Invoice, Credit note (supplier\'s credit note / your purchase return – amounts are taken as reductions) or Debit note.',
      'Amounts: positive figures. Taxable value without tax; IGST / CGST / SGST / Cess as charged.',
      'Voucher date and Voucher no are for reference (and for limiting the period on screen). Do not change the heading row.'].forEach((t, i) => { n.getCell('A' + (i + 1)).value = t; if (!i) n.getCell('A1').font = { bold: true }; });
    return wb;
  }

  root.G2BBooks = { FIELDS, readTable, guessMap, applyMap, readTallyXml, aggregate, template, isoDate, decode };
})(typeof window !== 'undefined' ? window : globalThis);
