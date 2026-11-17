/*
 * GSTR-2B (Excel downloaded from the GST portal) – reader and ITC classifier.
 * window.G2B = { read(sheets), classify(data, settings, overrides, supplierRules), CATS, STATES, DEFAULT_RULES, stateOf, norm }
 *
 * read(): sheets = LLPXlsx.readWorkbook(bytes) -> { info, records[], summary }
 *   record: { id, sheet, sec, kind ('inv'|'note'|'isd'|'imp'|'rev'|'rej'), amend, sign, gstin, name, docno, doctype, notetype,
 *             date, value, pos, rcm, txval, igst, cgst, sgst, cess, period, fdate, avail, reason, pct, source, irn, irndate,
 *             orig: { no, date, type } }   (amounts carry the sign: credit notes are negative)
 */
(function (root) {
  "use strict";
  const STATES = { '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar',
    '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
    '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
    '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory' };
  const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
  const stateOf = gstin => STATES[String(gstin || '').slice(0, 2)] || '';

  // category -> label, GSTR-3B treatment
  const CATS = [
    ['elig', 'Eligible ITC', '4A(5)'],
    ['blocked', 'Blocked credit – section 17(5)', '4A(5) and reversed in 4B(1)'],
    ['insmot', 'Insurance / motor vehicle related', '4A(5) and reversed in 4B(1)'],
    ['pos', 'Ineligible – place of supply', '4D(2)'],
    ['notavl', 'ITC not available as per GSTR-2B', '4D(2)'],
    ['inelig', 'Ineligible – others', '4A(5) and reversed in 4B(1)'],
    ['rcm', 'Reverse charge', '3.1(d) and 4A(3)'],
    ['imp', 'Import of goods', '4A(1)'],
    ['isd', 'Inward supplies from ISD', '4A(4)'],
    ['rev37a', 'ITC reversal – rule 37A', '4B(2)'],
    ['hold', 'Held – not claimed this month', 'Not in this GSTR-3B'],
    ['rejected', 'Rejected on IMS', 'Not in GSTR-3B'],
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c[0], c]));

  /* keyword | reason – one per line; editable in the tool */
  const DEFAULT_RULES = {
    insmot: [
      'INSURANCE | Insurance – blocked u/s 17(5)(ab) / (b)(i) if it relates to a motor vehicle, or is life / health insurance; check the policy',
      'ASSURANCE | Insurance – blocked u/s 17(5)(ab) / (b)(i) if it relates to a motor vehicle, or is life / health insurance; check the policy',
      'ICICI LOMBARD | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'HDFC ERGO | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'TATA AIG | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'IFFCO TOKIO | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'ROYAL SUNDARAM | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'CHOLAMANDALAM MS | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'BAJAJ ALLIANZ | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'GO DIGIT | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'ACKO | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'ZUNO | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'UNIVERSAL SOMPO | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'FUTURE GENERALI | General insurance – check whether it relates to a motor vehicle (s.17(5)(ab))',
      'AUTO | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'AUTOS | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'AUTOMOBILE | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'AUTOMOBILES | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'AUTOMOTIVE | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'VAHAN | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'MOTORS | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'CARS | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'HONDA | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'HYUNDAI | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'MARUTI | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'TOYOTA | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'TATA MOTORS | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'MAHINDRA AND MAHINDRA | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
      'MAHINDRA & MAHINDRA | Motor vehicle – purchase s.17(5)(a) / repair, servicing s.17(5)(ab); check the invoice',
    ].join('\n'),
    blocked: [
      'RESTAURANT | Food and beverages – s.17(5)(b)(i)',
      'RESTAURANTS | Food and beverages – s.17(5)(b)(i)',
      'CATERERS | Outdoor catering – s.17(5)(b)(i)',
      'CATERING | Outdoor catering – s.17(5)(b)(i)',
      'SWEETS | Food and beverages – s.17(5)(b)(i)',
      'BAKERY | Food and beverages – s.17(5)(b)(i)',
      'CAFE | Food and beverages – s.17(5)(b)(i)',
      'CLUB | Membership of a club – s.17(5)(b)(ii)',
      'GYM | Health and fitness centre – s.17(5)(b)(ii)',
      'FITNESS | Health and fitness centre – s.17(5)(b)(ii)',
      'SALON | Beauty treatment – s.17(5)(b)(i)',
      'SPA | Beauty treatment – s.17(5)(b)(i)',
      'BEAUTY | Beauty treatment – s.17(5)(b)(i)',
      'HOSPITAL | Health services – s.17(5)(b)(i)',
      'HOSPITALS | Health services – s.17(5)(b)(i)',
      'CLINIC | Health services – s.17(5)(b)(i)',
      'BUILDERS | Construction of immovable property – s.17(5)(c) / (d); check',
      'CONSTRUCTIONS | Construction of immovable property – s.17(5)(c) / (d); check',
    ].join('\n'),
  };

  /* ---------- reading ---------- */
  const str = v => v === undefined || v === null ? '' : String(v).trim();
  const num = v => { if (typeof v === 'number') return v; const n = Number(String(v ?? '').replace(/[,\s₹]/g, '')); return isFinite(n) ? n : 0; };
  const colOf = ref => ref.replace(/\d+$/, ''), rowOf = ref => +ref.replace(/^[A-Z]+/, '');
  const cIdx = c => c.split('').reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0);

  function sheetKind(name) {
    if (/rejected/i.test(name)) return 'rej';
    if (/ITC Reversal/i.test(name) || /^B2B-DNRA?$/i.test(name)) return 'rev';
    if (/^IMPG/i.test(name)) return 'imp';
    if (/^ISD/i.test(name)) return 'isd';
    if (/CDNR/i.test(name)) return 'note';
    if (/^(B2B|B2BA|ECO|ECOA)$/i.test(name)) return 'inv';
    return null;
  }

  function readSheet(name, cells) {
    const kind = sheetKind(name); if (!kind) return [];
    const rows = {}; Object.keys(cells).forEach(ref => { (rows[rowOf(ref)] = rows[rowOf(ref)] || {})[colOf(ref)] = cells[ref]; });
    const rnums = Object.keys(rows).map(Number).sort((a, b) => a - b);
    const hr = rnums.find(r => Object.values(rows[r]).some(v => /^GSTIN of (supplier|ISD)$/i.test(str(v)) || /Icegate Reference Date/i.test(str(v))));
    if (!hr) return [];
    const H = rows[hr] || {}, S = rows[hr + 1] || {};
    const cols = Array.from(new Set(Object.keys(H).concat(Object.keys(S)))).sort((a, b) => cIdx(a) - cIdx(b));
    const label = c => str(S[c]) || str(H[c]);
    const gcol = cols.find(c => /^GSTIN of/i.test(str(H[c])));
    const gi = gcol ? cIdx(gcol) : 0;
    const after = (re, from = gi) => cols.find(c => cIdx(c) > from - (gcol ? 0 : 1) && re.test(label(c)));
    const F = {
      gstin: gcol, name: after(/^Trade\/Legal name/i),
      docno: after(/^(Invoice number|Note number|ISD Document number|Number)$/i), doctype: after(/^(Invoice type|Note type|ISD Document type)$/i),
      notetype: after(/^Note Supply type$/i), date: after(/^(Invoice Date|Note date|ISD Document date|Date)$/i), value: after(/^(Invoice Value|Note Value)/i),
      pos: after(/^Place of supply/i), rcm: after(/Reverse Charge/i), txval: after(/^Taxable Value/i),
      igst: after(/^Integrated Tax/i), cgst: after(/^Central Tax/i), sgst: after(/^State\/UT Tax/i), cess: after(/^Cess/i),
      period: after(/Period$/i), fdate: after(/Filing Date$/i), avail: after(/^(ITC Availability|Eligibility of ITC)$/i), reason: after(/^Reason$/i),
      pct: after(/Applicable %/i), source: after(/^Source$/i), irn: after(/^IRN$/i), irndate: after(/^IRN Date$/i),
      port: after(/Port Code/i), icegate: after(/Icegate Reference Date/i), isdorig: after(/^Original Invoice Number/i), isdorigdate: after(/^Original invoice date/i),
    };
    // amendments: original details before the GSTIN column
    const amend = /A$/.test(name.replace(/\s*\(.*\)\s*$/, '').trim());
    const O = {};
    if (gcol && amend) cols.filter(c => cIdx(c) < gi).forEach(c => { const l = label(c); if (/type/i.test(l)) O.type = c; else if (/date/i.test(l)) O.date = c; else if (/number/i.test(l)) O.no = c; });
    const out = [];
    for (const r of rnums.filter(r => r >= hr + 2)) {
      const R = rows[r], g = k => F[k] ? R[F[k]] : undefined;
      const docno = str(g('docno')), gstin = str(g('gstin'));
      if (!docno && !gstin) continue;
      if (/^total$/i.test(gstin) || /^total$/i.test(docno)) continue;
      const doctype = str(g('doctype'));
      const sign = (kind === 'note' || kind === 'isd' || /DNR/i.test(name)) && /credit/i.test(doctype) ? -1 : 1;
      const rec = { sheet: name, kind, amend, sign,
        gstin, name: str(g('name')) || (kind === 'imp' ? 'Port ' + str(g('port')) : ''), docno, doctype: doctype || (kind === 'imp' ? (/SEZ/i.test(name) ? 'Bill of entry (SEZ)' : 'Bill of entry') : ''),
        notetype: str(g('notetype')), date: str(g('date')), value: sign * num(g('value')), pos: str(g('pos')), rcm: str(g('rcm')),
        txval: sign * num(g('txval')), igst: sign * num(g('igst')), cgst: sign * num(g('cgst')), sgst: sign * num(g('sgst')), cess: sign * num(g('cess')),
        period: str(g('period')), fdate: str(g('fdate')) || str(g('icegate')), avail: str(g('avail')), reason: str(g('reason')), pct: str(g('pct')), source: str(g('source')), irn: str(g('irn')), irndate: str(g('irndate')),
        orig: { no: O.no ? str(R[O.no]) : (F.isdorig ? str(g('isdorig')) : ''), date: O.date ? str(R[O.date]) : (F.isdorigdate ? str(g('isdorigdate')) : ''), type: O.type ? str(R[O.type]) : '' }, row: r };
      rec.id = `${name}|${gstin}|${docno}|${rec.date}|${r}`;
      out.push(rec);
    }
    return out;
  }

  function readInfo(sheets) {
    const rm = sheets['Read me'] || {}, info = {};
    Object.keys(rm).forEach(ref => { if (colOf(ref) !== 'A') return; const k = str(rm[ref]), v = str(rm['C' + rowOf(ref)]);
      if (/^Financial Year$/i.test(k)) info.fy = v; else if (/^Tax Period$/i.test(k)) info.period = v; else if (/^GSTIN$/i.test(k)) info.gstin = v;
      else if (/^Legal Name$/i.test(k)) info.legal = v; else if (/^Trade Name/i.test(k)) info.trade = v; else if (/^Date of generation$/i.test(k)) info.generated = v; });
    return info;
  }

  /* summary sheets: rows with a GSTR-3B table reference */
  function readSummary(sheets) {
    const out = [];
    ['ITC Available', 'ITC not available', 'ITC Reversal', 'ITC Rejected'].forEach(sn => {
      const s = sheets[sn]; if (!s) return; let part = '';
      Object.keys(s).filter(ref => colOf(ref) === 'B').map(rowOf).sort((a, b) => a - b).forEach(r => {
        const a = str(s['A' + r]), b = str(s['B' + r]), t = str(s['C' + r]);
        if (/^Part [AB]$/i.test(a)) part = a;
        if (/^(I|II|III|IV|V)$/.test(a)) out.push({ sheet: sn, part, no: a, head: b, table: t.replace(/\s+/g, ' '), igst: num(s['D' + r]), cgst: num(s['E' + r]), sgst: num(s['F' + r]), cess: num(s['G' + r]) });
      });
    });
    return out;
  }

  /* portal file name: MMYYYY_GSTIN_GSTR2B_DDMMYYYY[_part].xlsx, e.g. 102026_33AABCT0551H1ZR_GSTR2B_15112026_1.xlsx */
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- IMS download (CSV) ----------
     IMS_<section>_<GSTIN>_<DDMMYYYY>.csv: two title lines, a heading row ("GSTIN of Supplier, ... Status ...") and the records. */
  function csvRows(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch; }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.map(r => r.map(x => x.trim()));
  }
  function readIms(text, fileName) {
    const rows = csvRows(String(text).replace(/^﻿/, ''));
    if (!/IMS/i.test((rows[0] || []).join(' ')) && !/^IMS_/i.test(fileName || '')) throw new Error('this does not look like a file downloaded from IMS');
    const hi = rows.findIndex(r => r.some(c => /^GSTIN of (supplier|ISD)$/i.test(c)));
    if (hi < 0) throw new Error('the heading row (GSTIN of Supplier …) was not found');
    const H = rows[hi].map(c => c.replace(/\s+/g, ' ').trim()), title = rows.slice(0, hi).map(r => r.join(' ')).join(' ');
    const col = re => H.findIndex(h => re.test(h));
    const C = { gstin: col(/^GSTIN of/i), name: col(/Trade\/Legal name/i), docno: col(/^(Invoice|Note|Document) Number$/i), doctype: col(/^(Invoice|Note|Document) Type$/i), date: col(/^(Invoice|Note|Document) Date$/i),
      value: col(/^(Invoice|Note|Document) Value/i), status: col(/^Status$/i), pos: col(/^Place of Supply$/i), txval: col(/^Taxable Value/i), igst: col(/^Integrated Tax/i), cgst: col(/^Central Tax/i), sgst: col(/^State\/UT Tax/i), cess: col(/^Cess/i),
      remarks: col(/^Remarks$/i), source: col(/^Source$/i), period: col(/^Source Return Period$/i), fstatus: col(/Filing Status/i), fdate: col(/Filing Date/i), freq: col(/Filing Frequency/i),
      origno: col(/^Original (Invoice|Note|Document) Number$/i), origdate: col(/^Original (Invoice|Note|Document) Date$/i), origtype: col(/^Original (Invoice|Note|Document) Type$/i) };
    const sec = ((/^IMS_([^_]+(?:_[^_]+)*?)_\d{2}[0-9A-Z]{13}_/i.exec(fileName || '') || [])[1] || 'B2B').toUpperCase();
    const amend = C.origno >= 0 || /amend/i.test(title) || /A$/.test(sec.replace(/[^A-Z]/g, ''));
    const isNote = /CN|DN|NOTE/.test(sec) || /credit|debit\s*note/i.test(title);
    const num = v => { const n = Number(String(v || '').replace(/[,\s₹]/g, '')); return isFinite(n) ? n : 0; };
    const g = (r, k) => C[k] >= 0 ? (r[C[k]] || '') : '';
    const recs = [], periods = {};
    rows.slice(hi + 1).forEach((r, i) => {
      const gstin = g(r, 'gstin'), docno = g(r, 'docno'); if (!gstin && !docno) return;
      const doctype = g(r, 'doctype'), sign = /credit/i.test(doctype) || (/CN/.test(sec) && !/debit/i.test(doctype)) ? -1 : 1;
      const p = g(r, 'period'); if (p) periods[p] = (periods[p] || 0) + 1;
      const rec = { sheet: 'IMS ' + sec, kind: isNote ? 'note' : 'inv', amend, sign, gstin, name: g(r, 'name'), docno, doctype, notetype: '', date: g(r, 'date'), value: sign * num(g(r, 'value')),
        pos: g(r, 'pos'), rcm: 'No', txval: sign * num(g(r, 'txval')), igst: sign * num(g(r, 'igst')), cgst: sign * num(g(r, 'cgst')), sgst: sign * num(g(r, 'sgst')), cess: sign * num(g(r, 'cess')),
        period: p, fdate: g(r, 'fdate'), avail: '', reason: '', pct: '', source: g(r, 'source'), irn: '', irndate: '', imsStatus: g(r, 'status') || 'No Action', imsRemarks: g(r, 'remarks'),
        srcStatus: g(r, 'fstatus'), freq: g(r, 'freq'), orig: { no: g(r, 'origno'), date: g(r, 'origdate'), type: g(r, 'origtype') }, row: hi + 2 + i };
      rec.id = `${rec.sheet}|${gstin}|${docno}|${rec.date}|${rec.row}`;
      recs.push(rec);
    });
    const fn = /IMS_.*?_(\d{2}[0-9A-Z]{13})_(\d{2})(\d{2})(\d{4})/i.exec(fileName || '');
    const top = Object.entries(periods).sort((a, b) => b[1] - a[1])[0];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let period = '', fy = '';
    if (top) { const m = /^(\d{1,2})\/(\d{4})$/.exec(top[0]); if (m) { const mo = +m[1], y = +m[2], f0 = mo >= 4 ? y : y - 1; period = MONTHS[mo - 1]; fy = `${f0}-${String(f0 + 1).slice(2)}`; } }
    const info = { gstin: fn ? fn[1].toUpperCase() : '', period, fy, generated: fn ? `${fn[2]}/${fn[3]}/${fn[4]}` : '', ims: true, fromName: true, imsPeriods: periods };
    return { info, records: recs, summary: [] };
  }

  function infoFromName(name) {
    const m = /(\d{2})(\d{4})_(\d{2}[0-9A-Z]{13})_GSTR-?2B_(\d{2})(\d{2})(\d{4})(?:_(\d+))?/i.exec(name || '');
    if (!m || +m[1] < 1 || +m[1] > 12) return null;
    const mo = +m[1], y = +m[2], fy0 = mo >= 4 ? y : y - 1;
    return { gstin: m[3].toUpperCase(), period: MONTHS[mo - 1], fy: `${fy0}-${String(fy0 + 1).slice(2)}`, generated: `${m[4]}/${m[5]}/${m[6]}`, part: m[7] ? +m[7] : null };
  }

  function read(sheets, fileName) {
    const info = readInfo(sheets);
    const fn = infoFromName(fileName);
    if (fn) { info.part = fn.part;
      if (!info.gstin) { Object.assign(info, { gstin: fn.gstin, period: fn.period, fy: fn.fy, generated: info.generated || fn.generated }); info.fromName = true; } }
    if (!info.gstin && !Object.keys(sheets).some(sheetKind)) throw new Error('this does not look like a GSTR-2B downloaded from the GST portal (no "Read me" sheet and no B2B / CDNR sheets)');
    let records = [];
    Object.keys(sheets).forEach(n => { records = records.concat(readSheet(n, sheets[n])); });
    return { info, records, summary: readSummary(sheets) };
  }

  /* Several files of the same GSTR-2B (the portal splits a large GSTR-2B into parts): one data set.
     parts: [{ file, data }] -> { info, records, summary, files, notes }  – throws if GSTIN / period differ */
  function merge(parts) {
    parts = parts.slice().sort((a, b) => (a.data.info.part || 0) - (b.data.info.part || 0));
    const withInfo = parts.filter(p => p.data.info.gstin);
    const base = Object.assign({}, (withInfo.find(p => !p.data.info.fromName) || withInfo[0] || parts[0]).data.info);
    if (withInfo.some(p => p.data.info.fromName)) base.fromName = !withInfo.some(p => !p.data.info.fromName);
    const key = i => `${i.gstin}|${i.period}|${i.fy}`;
    const odd = withInfo.filter(p => key(p.data.info) !== key(base));
    if (odd.length) throw new Error(`${odd.map(p => p.file).join(', ')}: GSTIN / period ${odd.map(p => `${p.data.info.gstin} ${p.data.info.period} ${p.data.info.fy}`).join('; ')} differs from ${base.gstin} ${base.period} ${base.fy} – load the parts of one GSTR-2B together`);
    const notes = [], seen = new Map(), records = [], ids = new Set();
    const kinds = new Set(parts.map(p => p.data.info.ims ? 'ims' : '2b'));
    if (kinds.size > 1) notes.push(['warn', 'IMS records and a GSTR-2B have been loaded together – an invoice can appear in both and be counted twice. Load the IMS files or the GSTR-2B, not both.']);
    const ck = r => [r.sheet, r.gstin, r.docno, r.date, r.doctype, r.txval, r.igst, r.cgst, r.sgst, r.cess].join('|');
    parts.forEach((p, k) => {
      let dup = 0;
      p.data.records.forEach(r => { const c = ck(r), at = seen.get(c);
        if (at !== undefined && at !== k) { dup++; return; }
        seen.set(c, k); let id = r.id; while (ids.has(id)) id += '#' + k; ids.add(id); records.push(Object.assign({}, r, { part: p.file, id })); });
      if (dup) notes.push(['warn', `${p.file}: ${dup} record(s) already in an earlier part – counted once.`]);
      if (!p.data.info.gstin && parts.length > 1) notes.push(['info', `${p.file}: no "Read me" sheet – taken as part of ${base.gstin} ${base.period} ${base.fy}.`]);
      if (p.data.info.fromName) notes.push(['info', `${p.file}: no "Read me" sheet – GSTIN ${p.data.info.gstin} and period ${p.data.info.period} ${p.data.info.fy} taken from the file name${p.data.info.part ? ` (part ${p.data.info.part})` : ''}.`]);
    });
    // summary: the portal may repeat the full summary in each part, or give part-wise figures
    const sums = parts.map(p => p.data.summary).filter(s => s && s.length), sig = s => JSON.stringify(s.map(x => [x.sheet, x.part, x.no, x.igst, x.cgst, x.sgst, x.cess]));
    let summary = sums[0] || [];
    if (sums.length > 1 && !sums.every(s => sig(s) === sig(sums[0]))) {
      summary = sums[0].map(x => Object.assign({}, x)); sums.slice(1).forEach(s => s.forEach(y => { const t = summary.find(x => x.sheet === y.sheet && x.part === y.part && x.no === y.no); if (t) ['igst', 'cgst', 'sgst', 'cess'].forEach(h => t[h] += y[h]); else summary.push(Object.assign({}, y)); }));
      notes.push(['info', 'The summary sheets differ between the parts – the part-wise summaries have been added together. Compare with the GSTR-2B summary on the portal.']);
    }
    return { info: base, records, summary, files: parts.map(p => ({ file: p.file, n: p.data.records.length })), notes };
  }

  /* ---------- classification ---------- */
  function parseRules(text) {
    return String(text || '').split(/\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => { const [k, ...r] = l.split('|'); const kw = k.trim();
      const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'); return { kw, reason: (r.join('|').trim() || kw), re: new RegExp('(^|[^A-Z0-9])' + esc + '($|[^A-Z0-9])', 'i') }; }).filter(x => x.kw);
  }

  /* settings: { home (state name), rules: {insmot, blocked} }; overrides: { id: {cat, reason} }; supplierRules: { gstin: {cat, reason, name} } */
  function classify(data, settings, overrides, supplierRules) {
    const home = settings.home || stateOf(data.info.gstin), H = norm(home);
    const R = { insmot: parseRules(settings.rules && settings.rules.insmot), blocked: parseRules(settings.rules && settings.rules.blocked) };
    return data.records.map(rec => {
      let cat = 'elig', reason = '', flags = [];
      const nm = rec.name.toUpperCase();
      const posOut = rec.pos && H && norm(rec.pos) !== H;
      if (rec.kind === 'rej' || /^reject/i.test(rec.imsStatus || '')) { cat = 'rejected'; reason = 'Rejected on the IMS dashboard'; }
      else if (/^pending/i.test(rec.imsStatus || '')) { cat = 'hold'; reason = 'Kept pending on IMS'; }
      else if (rec.kind === 'rev') { cat = 'rev37a'; reason = 'ITC reversal shown in GSTR-2B (rule 37A) – 4B(2)'; }
      else if (rec.kind === 'imp') cat = 'imp';
      else if (/^no$/i.test(rec.avail)) { cat = 'notavl'; reason = 'ITC not available as per GSTR-2B' + (rec.reason ? ` – ${rec.reason}` : ''); }
      else if (rec.kind === 'isd') cat = 'isd';
      else if (/^y/i.test(rec.rcm)) { cat = 'rcm'; reason = ''; if (posOut) flags.push(`Reverse charge with place of supply ${rec.pos}`); }
      else if (posOut) { cat = 'pos'; reason = `Place of supply ${rec.pos} – outside ${home} (ITC not available; report in 4D(2))`; }
      else {
        const m1 = R.insmot.find(x => x.re.test(nm)), m2 = !m1 && R.blocked.find(x => x.re.test(nm));
        if (m1) { cat = 'insmot'; reason = m1.reason; } else if (m2) { cat = 'blocked'; reason = m2.reason; }
      }
      const auto = { cat, reason };
      // tax type vs place of supply
      if (rec.pos && H && rec.kind !== 'imp') { const intra = norm(rec.pos) === norm(stateOf(rec.gstin)); if (rec.igst && intra && norm(rec.pos) === H) flags.push('IGST charged though supplier and place of supply are in the same State'); if ((rec.cgst || rec.sgst) && !intra) flags.push('CGST/SGST charged though place of supply is outside the supplier\'s State'); }
      const fixed = ['rejected', 'rev37a', 'imp', 'isd'].includes(cat);
      const sr = supplierRules && rec.gstin && supplierRules[rec.gstin];
      let src = 'auto';
      if (sr && !fixed) { cat = sr.cat; reason = sr.reason || reason; src = 'supplier'; }
      const ov = overrides && overrides[rec.id];
      if (ov) { if (ov.cat) { cat = ov.cat; src = 'user'; } if (ov.reason !== undefined && ov.reason !== null) reason = ov.reason; }
      if (cat === 'elig' && src !== 'auto' && reason === auto.reason) reason = '';
      return Object.assign({}, rec, { reason2bOrig: rec.reason, cat, reason, auto, src, flags });
    });
  }

  root.G2B = { read, readIms, merge, infoFromName, classify, CATS, CAT, STATES, DEFAULT_RULES, stateOf, norm, parseRules };
})(typeof window !== 'undefined' ? window : globalThis);
