/*
 * GSTR-2B vs purchase register – matching.
 * window.G2BReco = { DEFAULTS, STATUS, normInv, run(twoB, books, opts, manual) }
 *
 * twoB: classified 2B records (G2B.classify); books: G2BBooks.aggregate(...)
 * manual: { links: [[aId, bId]], rejects: [[aId, bId]] }
 * Passes, one-to-one: manual links → same GSTIN + same invoice no. (normalised) → same GSTIN + similar invoice no. and amounts
 * within tolerance → same invoice no. and amounts, GSTIN different / missing in books → same GSTIN + same amounts, invoice no.
 * not similar ("probable", to be accepted or rejected) → the rest are in 2B only / in books only.
 */
(function (root) {
  "use strict";
  const DEFAULTS = { tolAbs: 10, tolPct: 0, dateDays: 45, maxEdit: 2, ignoreFY: true, ignoreZeros: true, useDigits: true, acrossGstin: true, probable: true, nameFill: true };
  const STATUS = [
    ['matched', 'Matched', 'Same GSTIN and invoice number; amounts agree (within the tolerance)'],
    ['invdiff', 'Matched – invoice no. differs slightly', 'Same GSTIN and amounts; invoice number differs only in format / a character or two'],
    ['gstindiff', 'Matched – GSTIN differs in books', 'Same invoice number and amounts; GSTIN in the books is missing or different'],
    ['manual', 'Matched manually', 'Paired by you (or a probable match you accepted)'],
    ['mismatch', 'Amount difference', 'Same GSTIN and invoice number, but taxable value or tax differs beyond the tolerance'],
    ['probable', 'Probable match – to review', 'Same GSTIN and amounts within the date window, invoice number not similar'],
    ['only2b', 'In GSTR-2B, not in books', 'Not accounted in the purchase register (additional ITC / not yet accounted)'],
    ['onlybooks', 'In books, not in GSTR-2B', 'ITC as per books not reflected in GSTR-2B – section 16(2)(aa); follow up with the supplier'],
  ];
  const HEADS = ['igst', 'cgst', 'sgst', 'cess'];
  const tax = r => HEADS.reduce((s, h) => s + (r[h] || 0), 0);

  function normInv(s, o) {
    let x = String(s || '').toUpperCase().trim();
    if (o.ignoreFY) {
      const y = x.replace(/(?<!\d)(?:20)?(\d{2})\s*[-\/]\s*(?:20)?(\d{2})(?!\d)/g, (m, a, b) => ((+a + 1) % 100 === +b ? ' ' : m));
      if (y.replace(/[^A-Z0-9]/g, '')) x = y;
    }
    x = x.replace(/[^A-Z0-9]/g, '');
    if (o.ignoreZeros) x = x.replace(/(^|[A-Z])0+(?=\d)/g, '$1');
    return x;
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) { const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
      if (best > max) return max + 1; prev = cur; }
    return prev[b.length];
  }
  function similar(x, y, o) {
    if (!x || !y) return 0;
    if (x === y) return 1;
    if (o.useDigits) { const dx = x.replace(/\D/g, ''), dy = y.replace(/\D/g, ''); if (dx.length >= 3 && dx === dy) return 0.9; }
    if (Math.min(x.length, y.length) >= 4 && (x.endsWith(y) || y.endsWith(x))) return 0.85;
    if (Math.min(x.length, y.length) >= 5) { const d = lev(x, y, o.maxEdit); if (d <= o.maxEdit) return 0.8 - d * 0.05; }
    return 0;
  }
  const dayNo = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; };
  const isoOf = dmy => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

  function compare(a, b, o) {
    const d = { txval: a.txval - b.txval }; HEADS.forEach(h => d[h] = a[h] - b[h]); d.tax = tax(a) - tax(b);
    const lim = v => Math.max(o.tolAbs, Math.abs(v) * o.tolPct / 100);
    const okTx = Math.abs(d.txval) <= lim(a.txval), okTax = Math.abs(d.tax) <= lim(tax(a)), okHeads = HEADS.every(h => Math.abs(d[h]) <= lim(a[h]));
    const exact = Math.abs(d.txval) < 0.01 && HEADS.every(h => Math.abs(d[h]) < 0.01);
    const flags = [];
    if (okTax && !okHeads) flags.push('Tax head differs (IGST vs CGST/SGST)');
    const da = dayNo(a.iso), db = dayNo(b.invdate);
    if (da !== null && db !== null && da !== db) flags.push(`Invoice date differs by ${Math.abs(da - db)} day(s) (${b.invdate.split('-').reverse().join('/')} in books)`);
    if (!exact && okTx && okTax && okHeads) flags.push('Difference within the tolerance');
    return { d, ok: okTx && okTax && okHeads, exact, flags, dayGap: da !== null && db !== null ? Math.abs(da - db) : null };
  }

  function run(twoB, books, opts, manual) {
    const o = Object.assign({}, DEFAULTS, opts || {}), man = manual || { links: [], rejects: [] };
    const A = twoB.filter(r => ['inv', 'note'].includes(r.kind)).map(r => Object.assign({}, r, { iso: isoOf(r.date), n: normInv(r.docno, o) }));
    const gst2b = new Set(A.map(a => a.gstin));
    // GSTIN missing in the books – take it from the GSTR-2B by supplier name, if the name is unique there
    const nk = s => String(s || '').toUpperCase().replace(/\bM\s*\/\s*S\b|\bMESSRS\b/g, ' ').replace(/\bPRIVATE\b/g, 'PVT').replace(/\bLIMITED\b/g, 'LTD').replace(/\bCOMPANY\b/g, 'CO').replace(/&/g, 'AND').replace(/[^A-Z0-9]/g, '');
    const byName = {}; A.forEach(a => { const k = nk(a.name); if (!k) return; (byName[k] = byName[k] || new Set()).add(a.gstin); });
    const B = books.map(b => { const x = Object.assign({}, b, { n: normInv(b.invno, o), gFill: '' });
      if (!x.gstin && o.nameFill) { const s = byName[nk(x.name)]; if (s && s.size === 1) { x.gstin = [...s][0]; x.gFill = 'GSTIN taken from GSTR-2B by supplier name'; } }
      return x; });
    const usedA = new Set(), usedB = new Set(), pairs = [];
    const rej = new Set((man.rejects || []).map(p => p.join('>')));
    const pair = (a, b, status, how) => { const c = compare(a, b, o); usedA.add(a.id); usedB.add(b.id);
      let st = status; if (status === 'matched' && !c.ok) st = 'mismatch';
      const flags = c.flags.slice(); if (b.gFill) flags.push(b.gFill); if (how) flags.unshift(how);
      if (status === 'gstindiff') flags.push(`GSTIN in books: ${b.gstinRaw || b.gstin || '(blank)'}`);
      pairs.push({ a, b, status: st, d: c.d, flags }); };
    const Aid = new Map(A.map(a => [a.id, a])), Bid = new Map(B.map(b => [b.id, b]));
    (man.links || []).forEach(([ai, bi]) => { const a = Aid.get(ai), b = Bid.get(bi); if (a && b && !usedA.has(ai) && !usedB.has(bi)) pair(a, b, 'manual', 'Paired manually'); });
    const bG = {}; B.forEach(b => { (bG[b.gstin || '-'] = bG[b.gstin || '-'] || []).push(b); });
    const aG = {}; A.forEach(a => { (aG[a.gstin] = aG[a.gstin] || []).push(a); });
    const bN = {}; B.forEach(b => { if (b.n) (bN[b.n] = bN[b.n] || []).push(b); });
    const sgn = r => (r.txval < 0 || tax(r) < 0 || r.sign < 0) ? -1 : 1;
    const free = list => (list || []).filter(b => !usedB.has(b.id));
    const close = (a, b) => compare(a, b, o).ok;
    const inWindow = (a, b) => { const x = dayNo(a.iso), y = dayNo(b.invdate); return x === null || y === null || !o.dateDays || Math.abs(x - y) <= o.dateDays; };
    const best = (a, list) => list.sort((p, q) => Math.abs(tax(a) - tax(p)) + Math.abs(a.txval - p.txval) / 100 - (Math.abs(tax(a) - tax(q)) + Math.abs(a.txval - q.txval) / 100))[0];
    // 1. same GSTIN + same normalised invoice number
    A.forEach(a => { if (usedA.has(a.id)) return; const c = free(bG[a.gstin]).filter(b => b.n && b.n === a.n && sgn(b) === sgn(a) && !rej.has(a.id + '>' + b.id)); if (c.length) pair(a, best(a, c), 'matched'); });
    // 2. same GSTIN, similar invoice number, amounts within tolerance
    A.forEach(a => { if (usedA.has(a.id)) return; const c = free(bG[a.gstin]).filter(b => sgn(b) === sgn(a) && similar(a.n, b.n, o) > 0 && close(a, b) && inWindow(a, b) && !rej.has(a.id + '>' + b.id));
      if (c.length) { c.sort((p, q) => similar(a.n, q.n, o) - similar(a.n, p.n, o)); pair(a, c[0], 'invdiff', `Invoice no. in books: ${c[0].invno}`); } });
    // 3. same invoice number and amounts, GSTIN different / missing in books
    if (o.acrossGstin) A.forEach(a => { if (usedA.has(a.id)) return; const c = (bN[a.n] || []).filter(b => !usedB.has(b.id) && b.gstin !== a.gstin && close(a, b) && !rej.has(a.id + '>' + b.id));
      if (c.length === 1) pair(a, c[0], 'gstindiff'); });
    // 4. probable: same GSTIN, amounts within tolerance and date window, invoice number not similar – only where unique
    if (o.probable) A.forEach(a => { if (usedA.has(a.id)) return; const c = free(bG[a.gstin]).filter(b => sgn(b) === sgn(a) && close(a, b) && inWindow(a, b) && !rej.has(a.id + '>' + b.id));
      if (c.length === 1) { const others = (aG[a.gstin] || []).filter(x => x !== a && !usedA.has(x.id) && close(x, c[0])); if (!others.length) pair(a, c[0], 'probable', `Invoice no. in books: ${c[0].invno}`); } });
    const only2b = A.filter(a => !usedA.has(a.id)), onlyBooks = B.filter(b => !usedB.has(b.id));
    // supplier-wise
    const sup = {};
    const add = (g, name, side, r) => { const k = g || '(no GSTIN) ' + name; const s = sup[k] = sup[k] || { gstin: g, name, a: { n: 0, txval: 0, tax: 0 }, b: { n: 0, txval: 0, tax: 0 }, open2b: 0, openBooks: 0 }; if (!s.name && name) s.name = name; s[side].n++; s[side].txval += r.txval; s[side].tax += tax(r); };
    A.forEach(a => add(a.gstin, a.name, 'a', a)); B.forEach(b => add(b.gstin, b.name, 'b', b));
    only2b.forEach(a => sup[a.gstin || '(no GSTIN) ' + a.name].open2b++); onlyBooks.forEach(b => sup[b.gstin || '(no GSTIN) ' + b.name].openBooks++);
    return { opts: o, pairs, only2b, onlyBooks, A, B, suppliers: Object.values(sup) };
  }

  /* totals by status: count, 2B taxable / tax, books taxable / tax */
  function summary(res) {
    const z = () => ({ n: 0, aTx: 0, aTax: 0, bTx: 0, bTax: 0 }), out = Object.fromEntries(STATUS.map(s => [s[0], z()]));
    res.pairs.forEach(p => { const s = out[p.status]; s.n++; s.aTx += p.a.txval; s.aTax += tax(p.a); s.bTx += p.b.txval; s.bTax += tax(p.b); });
    res.only2b.forEach(a => { const s = out.only2b; s.n++; s.aTx += a.txval; s.aTax += tax(a); });
    res.onlyBooks.forEach(b => { const s = out.onlybooks; s.n++; s.bTx += b.txval; s.bTax += tax(b); });
    return out;
  }


  /* Suggested IMS action for each IMS record – a suggestion only; the decision and the action on the portal are the user's.
     reco: result of run() or null (no purchase register loaded) */
  function imsActions(rows, reco) {
    const pairOf = {}; if (reco) { reco.pairs.forEach(p => { pairOf[p.a.id] = p; }); reco.only2b.forEach(a => { pairOf[a.id] = { status: 'only2b' }; }); }
    return rows.filter(r => r.imsStatus !== undefined).map(r => {
      const p = pairOf[r.id], ps = p ? p.status : null; let act, why;
      if (r.cat === 'rejected') { act = 'Reject'; why = 'Already rejected on IMS'; }
      else if (r.cat === 'hold') { act = 'Pending'; why = r.reason || 'Held / kept pending'; }
      else if (r.cat === 'pos') { act = 'Pending'; why = 'Place of supply outside the State – ask the supplier to correct the invoice; ITC not available as it stands'; }
      else if (reco && ['mismatch'].includes(ps)) { act = 'Pending'; why = `Amount differs from books (tax ${(p.d.tax || 0).toFixed(2)}) – get it corrected; reject only if the invoice is wrong`; }
      else if (reco && ps === 'probable') { act = 'Pending'; why = 'Probable match with books – review the pairing first'; }
      else if (reco && ps === 'only2b') { act = 'Pending'; why = 'Not in the purchase register – check receipt of goods / services; reject if not your purchase'; }
      else if (['blocked', 'insmot', 'inelig'].includes(r.cat)) { act = 'Accept'; why = 'Purchase is yours but ITC is blocked / ineligible – accept, and do not claim / reverse the ITC (4B(1)); reject only if it is not your purchase'; }
      else if (reco && ['matched', 'invdiff', 'gstindiff', 'manual'].includes(ps)) { act = 'Accept'; why = 'Matched with the purchase register' + (ps === 'invdiff' ? ' (invoice no. differs slightly)' : ps === 'gstindiff' ? ' (GSTIN differs in books – correct the books)' : ''); }
      else { act = 'Accept'; why = reco ? 'Accepted' : 'No purchase register loaded – check with the books before accepting'; }
      const differs = !/^no action$/i.test(r.imsStatus || 'No Action') && !new RegExp('^' + act, 'i').test(r.imsStatus);
      return { r, act, why, books: ps, differs, cur: r.imsStatus || 'No Action' };
    });
  }

  root.G2BReco = { DEFAULTS, STATUS, normInv, similar, run, summary, tax, imsActions };
})(typeof window !== 'undefined' ? window : globalThis);
