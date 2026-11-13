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

  function read(sheets) {
    const info = readInfo(sheets);
    if (!info.gstin && !sheets['B2B']) throw new Error('this does not look like a GSTR-2B downloaded from the GST portal (no "Read me" / "B2B" sheet)');
    let records = [];
    Object.keys(sheets).forEach(n => { records = records.concat(readSheet(n, sheets[n])); });
    return { info, records, summary: readSummary(sheets) };
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
      if (rec.kind === 'rej') { cat = 'rejected'; reason = 'Rejected on the IMS dashboard'; }
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

  root.G2B = { read, classify, CATS, CAT, STATES, DEFAULT_RULES, stateOf, norm, parseRules };
})(typeof window !== 'undefined' ? window : globalThis);
