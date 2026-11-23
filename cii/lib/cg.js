/*
 * Capital gains – computation and tax planning options (Income-tax Act, 1961 and Income-tax Act, 2025).
 * window.CG = { CII, compute(c), SECTIONS, fyLabel, fyOf, addMonths }
 *
 * Long-term gains on transfers on or after 23-07-2024: 12.5% without indexation (s.112 / s.197); land or building acquired before
 * 23-07-2024 and transferred by a resident individual / HUF: the lower of 12.5% without indexation and 20% with indexation.
 * Transfers before 23-07-2024: 20% with indexation. Listed equity (s.112A / s.198): 12.5% above Rs. 1.25 lakh (10% above
 * Rs. 1 lakh before 23-07-2024), no indexation. Short-term listed equity (s.111A / s.196): 20% (15% before 23-07-2024).
 * Exemptions: s.54 / s.82 (residential house to residential house), s.54F / s.86 (other asset to residential house, in proportion
 * to the net consideration invested), s.54EC / s.85 (land or building – specified bonds, up to Rs. 50 lakh, within six months).
 * The 2025 Act section numbers are as in the published concordance tables; the report asks for them to be verified.
 */
(function (root) {
  "use strict";
  const CII = { 2001: 100, 2002: 105, 2003: 109, 2004: 113, 2005: 117, 2006: 122, 2007: 129, 2008: 137, 2009: 148, 2010: 167, 2011: 184, 2012: 200,
    2013: 220, 2014: 240, 2015: 254, 2016: 264, 2017: 272, 2018: 280, 2019: 289, 2020: 301, 2021: 317, 2022: 331, 2023: 348, 2024: 363, 2025: 376, 2026: 384 };
  const YEARS = Object.keys(CII).map(Number), FIRST = YEARS[0], LAST = YEARS[YEARS.length - 1];
  const CUTOFF = '2024-07-23', ITA2025 = '2026-04-01', CAP_FROM = '2023-04-01', HOUSE_CAP = 1e8, BOND_CAP = 5e6, TWO_HOUSE = 2e7;

  /* provisions: [subject, ITA 1961, ITA 2025] */
  const SECTIONS = [
    ['Capital gains – charge', 's.45', 's.67'],
    ['Short-term capital asset – period of holding', 's.2(42A)', 's.2(101)'],
    ['Mode of computation; indexed cost (Explanation)', 's.48', 's.72'],
    ['Stamp duty value as full value of consideration (land or building)', 's.50C', 's.78'],
    ['Cost – fair market value on 01-04-2001', 's.55(2)(b)', 'corresponding provision – verify'],
    ['Short-term gain – listed equity shares / equity-oriented units', 's.111A', 's.196'],
    ['Long-term gain – tax rate', 's.112', 's.197'],
    ['Long-term gain – listed equity shares / equity-oriented units', 's.112A', 's.198'],
    ['Exemption – residential house sold, residential house bought / built', 's.54', 's.82'],
    ['Exemption – land or building, investment in specified bonds', 's.54EC', 's.85'],
    ['Exemption – other long-term asset sold, residential house bought / built', 's.54F', 's.86'],
    ['Deposit in the Capital Gains Accounts Scheme, 1988', 's.54(2), s.54F(4)', 'within s.82 / s.86 – verify'],
    ['Interest for deferment of advance tax – capital gains proviso', 's.234C', 'corresponding provision – verify'],
    ['TDS by the buyer on immovable property (Rs. 50 lakh or more)', 's.194-IA', 's.393 (table) – verify'],
  ];

  /* slab rates of individuals / HUF by regime and financial year of the sale */
  function slabs(regime, fy, age, resident) {
    if (regime === 'new' && fy >= 2020) {
      if (fy >= 2025) return [[400000, 0], [800000, 5], [1200000, 10], [1600000, 15], [2000000, 20], [2400000, 25], [Infinity, 30]];
      if (fy === 2024) return [[300000, 0], [700000, 5], [1000000, 10], [1200000, 15], [1500000, 20], [Infinity, 30]];
      if (fy === 2023) return [[300000, 0], [600000, 5], [900000, 10], [1200000, 15], [1500000, 20], [Infinity, 30]];
      return [[250000, 0], [500000, 5], [750000, 10], [1000000, 15], [1250000, 20], [1500000, 25], [Infinity, 30]];
    }
    const b = !resident ? 250000 : age === '80+' ? 500000 : age === '60-80' ? 300000 : 250000;
    return [[b, 0], [500000, 5], [1000000, 20], [Infinity, 30]].filter((s, i, a) => i === 0 || s[0] > a[0][0]);
  }
  const slabTax = (ti, sl) => { let t = 0, prev = 0; for (const [upto, r] of sl) { if (ti > prev) t += (Math.min(ti, upto) - prev) * r / 100; prev = upto; } return t; };

  /* dates */
  const fyLabel = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  const fyOf = iso => { const [y, m] = iso.split('-').map(Number); return m >= 4 ? y : y - 1; };
  function addMonths(iso, m) { const [y, mo, d] = iso.split('-').map(Number); const t = new Date(Date.UTC(y, mo - 1 + m, d)); if (t.getUTCDate() !== d) t.setUTCDate(0); return t.toISOString().slice(0, 10); }
  const addDays = (iso, n) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const dmy = iso => iso.split('-').reverse().join('-');
  function heldFor(a, b) { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); let months = (y2 - y1) * 12 + (m2 - m1); if (d2 < d1) months--;
    const days = Math.round((Date.parse(b) - Date.parse(addMonths(a, months))) / 864e5); return { months, days, totalDays: Math.round((Date.parse(b) - Date.parse(a)) / 864e5) }; }
  function ltLimit(asset, sdate) { if (asset === 'listed') return 12; if (asset === 'land' || asset === 'unlisted') return 24; return sdate >= CUTOFF ? 24 : 36; }

  const N = v => Number(String(v ?? '').replace(/,/g, '')) || 0;
  const inr = n => Math.round(n).toLocaleString('en-IN');

  function compute(c) {
    const errs = [];
    if (!String(c.name || '').trim()) errs.push('Enter the name of the assessee.');
    if (!c.pdate) errs.push('Enter the date of purchase.');
    if (!c.sdate) errs.push('Enter the date of sale.');
    if (!(N(c.pamt) > 0) && !(N(c.fmv) > 0)) errs.push('Enter the amount of purchase.');
    if (!(N(c.samt) > 0)) errs.push('Enter the amount of sale.');
    if (c.pdate && c.sdate && c.sdate <= c.pdate) errs.push('The date of sale must be after the date of purchase.');
    const sfy = c.sdate ? fyOf(c.sdate) : 0;
    if (c.sdate && sfy < FIRST) errs.push('Sales before 01-04-2001 are not covered by this table (base year 2001-02).');
    (c.imps || []).forEach((im, i) => { if (N(im.amt) && !im.date) errs.push(`Improvement ${i + 1}: enter the date.`); if (im.date && c.sdate && (im.date > c.sdate || (c.pdate && im.date < c.pdate))) errs.push(`Improvement ${i + 1}: the date must be between purchase and sale.`); });
    if (N(c.bonds) > BOND_CAP) errs.push('Investment in capital gains bonds cannot exceed Rs. 50,00,000 (s.54EC / s.85).');
    if (c.due === 'custom' && !c.dueDate) errs.push('Enter the due date of the return (or choose one of the listed dates).');
    if (errs.length) return { errs };

    const r = { errs: [], notes: [], sfy, act: c.sdate >= ITA2025 ? '2025' : '1961' };
    const res = c.seller === 'res', ind = c.seller === 'res' || c.seller === 'nri', after = c.sdate >= CUTOFF;
    const hold = heldFor(c.pdate, c.sdate), lim = ltLimit(c.asset, c.sdate), ltFrom = addDays(addMonths(c.pdate, lim), 1), longTerm = c.sdate >= ltFrom;
    Object.assign(r, { hold, lim, longTerm, after, ltFrom });

    // indexation – applicable or not, and why
    let ix;
    if (!longTerm) ix = { applicable: false, reason: `short-term holding – the asset was held for not more than ${lim} months (s.2(42A) / s.2(101))` };
    else if (c.asset === 'listed') ix = { applicable: false, reason: 'the asset being listed equity shares / equity-oriented units – long-term gains are taxed under s.112A / s.198 without indexation' };
    else if (!after) ix = { applicable: true, both: false, reason: 'transfer before 23-07-2024 – long-term gain with indexation, taxed at 20% (s.112)' };
    else if (c.asset === 'land' && res && c.pdate < CUTOFF) ix = { applicable: true, both: true, reason: 'land or building acquired before 23-07-2024, transferred by a resident individual / HUF – tax is the lower of 12.5% without indexation and 20% with indexation (proviso to s.112(1) / s.197)' };
    else ix = { applicable: false, reason: 'transfer on or after 23-07-2024 – the Finance (No. 2) Act, 2024 withdrew indexation' +
      (c.asset === 'land' ? (res ? ', and the property was acquired on or after 23-07-2024' : ', and the seller is not a resident individual / HUF') : ' for this asset (the exception is only for land or building acquired before 23-07-2024 by a resident individual / HUF)') };
    r.ix = ix;

    const pfy = fyOf(c.pdate), baseFy = Math.max(pfy, FIRST), ciiS = CII[sfy], ciiP = CII[baseFy];
    if (ix.applicable && !ciiS) return { errs: [`The CII for ${fyLabel(sfy)} is not in the table (latest: ${fyLabel(LAST)}). Add it when it is notified.`] };
    Object.assign(r, { pfy, baseFy, ciiS, ciiP });

    // cost and consideration
    let cost = N(c.pamt), costNote = 'actual cost of purchase';
    if (c.pdate < '2001-04-01' && N(c.fmv) > 0) {
      let fmv = N(c.fmv), capNote = '';
      if (c.asset === 'land' && N(c.fmvsdv) > 0 && fmv > N(c.fmvsdv)) { fmv = N(c.fmvsdv); capNote = ` (FMV Rs. ${inr(N(c.fmv))} limited to the stamp duty value Rs. ${inr(fmv)} on that date)`; }
      if (fmv > cost) { cost = fmv; costNote = `FMV as on 01-04-2001${capNote}, being higher than the actual cost of Rs. ${inr(N(c.pamt))}`; }
      else costNote = `actual cost, being higher than the FMV as on 01-04-2001 of Rs. ${inr(fmv)}${capNote}`;
    }
    const imps = (c.imps || []).filter(im => N(im.amt) > 0).map(im => {
      const fy = fyOf(im.date), ignored = im.date < '2001-04-01';
      return { date: im.date, fy, ignored, cost: N(im.amt), cii: CII[fy], idx: ignored || !ix.applicable ? 0 : N(im.amt) * ciiS / CII[fy] };
    });
    const idxCost = ix.applicable ? cost * ciiS / ciiP : null;
    let full = N(c.samt), fullNote = 'sale consideration';
    if (c.asset === 'land' && N(c.sdv) > N(c.samt)) {
      if (N(c.sdv) > N(c.samt) * 1.1) { full = N(c.sdv); fullNote = `stamp duty value – exceeds 110% of the consideration of Rs. ${inr(N(c.samt))} (s.50C / s.78)`; }
      else fullNote = `sale consideration – the stamp duty value of Rs. ${inr(N(c.sdv))} is within 110% of it (s.50C / s.78)`;
    }
    const exp = N(c.exp), impCost = imps.filter(i => !i.ignored).reduce((a, i) => a + i.cost, 0), impIdx = imps.reduce((a, i) => a + i.idx, 0);
    const gainPlain = full - exp - cost - impCost, gainIdx = ix.applicable ? full - exp - idxCost - impIdx : null, netCons = full - exp;
    Object.assign(r, { cost, costNote, idxCost, imps, impCost, impIdx, full, fullNote, exp, gainPlain, gainIdx, netCons });
    if (c.asset === 'other') r.notes.push(['warn', 'Bonds and debentures (other than capital indexed bonds and sovereign gold bonds) do not get indexation, and units of specified mutual funds acquired on or after 01-04-2023 are short-term whatever the period (s.50AA).']);
    if (c.asset === 'listed' && c.pdate < '2018-02-01') r.notes.push(['info', 'Listed equity acquired before 01-02-2018: the cost may be stepped up to the FMV on 31-01-2018 (s.55(2)(ac)). Enter that cost as the amount of purchase if it is higher.']);

    // nature of the tax
    const kind = !longTerm ? (c.asset === 'listed' ? 'stcg111A' : 'stcgSlab') : c.asset === 'listed' ? 'ltcg112A' : !after ? 'ltcgOld' : 'ltcg112';
    const rate = { stcg111A: after ? 20 : 15, ltcg112A: after ? 12.5 : 10, ltcgOld: 20, ltcg112: 12.5, stcgSlab: 0 }[kind];
    r.kind = kind;
    r.rateText = { stcg111A: `${rate}% (s.111A / s.196)`, stcgSlab: ind ? 'normal (slab) rates – added to the other income' : `normal rate of ${N(c.orate) || 30}%`,
      ltcg112A: `${rate}% on the gain above Rs. ${after ? '1,25,000' : '1,00,000'} (s.112A / s.198)`, ltcgOld: '20% with indexation (s.112)',
      ltcg112: ix.both ? 'lower of 12.5% without indexation and 20% with indexation (s.112 / s.197)' : '12.5% without indexation (s.112 / s.197)' }[kind];

    // exemptions open to this sale
    const house = longTerm && ind ? (c.asset === 'land' && c.resHouse === 'yes' ? 's54' : 's54F') : null;
    const bondsOk = longTerm && c.asset === 'land';
    const cap = c.sdate >= CAP_FROM ? HOUSE_CAP : Infinity;
    r.houseSec = house; r.bondsOk = bondsOk; r.houseCap = cap;
    if (c.seller === 'nri') r.notes.push(['info', 'Non-resident individual / HUF: s.54 / s.54F / s.54EC (s.82 / s.86 / s.85) are available, but not the option of 20% with indexation for land or building and not the adjustment of the unexhausted basic exemption limit (both only for residents). TDS by the buyer is under s.195 (2025 Act: s.393 table) at the rates in force – the seller may apply for a lower deduction certificate.']);
    r.unavail = [];
    if (longTerm && !ind) r.unavail.push(['Options 2 and 4 – residential house (s.54 / s.54F; s.82 / s.86)', 'available only to an individual or HUF (resident or non-resident) – not to a firm, LLP, company or other assessee']);
    if (longTerm && c.asset !== 'land') r.unavail.push(['Options 3 and 4 – capital gains bonds (s.54EC / s.85)', 'available only on the transfer of land or building (or both)']);
    if (!longTerm) r.unavail.push(['Options 2 to 5 – house / bonds', 'the gain is short-term; these exemptions are only for long-term gains']);
    if (house === 's54F') r.notes.push(['info', 's.54F / s.86: on the date of transfer the assessee should not own more than one residential house other than the new one, and should not buy another within two years or build another within three years after the transfer. The exemption is the gain × amount invested ÷ net consideration.']);

    // basic exemption shortfall, losses
    const other = N(c.other), sl = slabs(c.regime || 'new', sfy, c.age, res), belAmt = ind ? sl[0][0] : 0, shortfall = res ? Math.max(0, belAmt - other) : 0;
    const stcl = N(c.stcl), ltcl = N(c.ltcl), lossAvail = longTerm ? ltcl + stcl : stcl;
    Object.assign(r, { bel: belAmt, shortfall, other, lossAvail });

    function exemptions(G, H, B) {
      let s54 = 0, s54F = 0, s54EC = 0;
      if (G > 0 && house === 's54') s54 = Math.min(G, H, cap);
      if (G > 0 && house === 's54F' && netCons > 0) s54F = Math.min(G, G * Math.min(H, cap, netCons) / netCons);
      if (G > 0 && bondsOk) s54EC = Math.min(B, BOND_CAP, G);
      const sum = s54 + s54F + s54EC, tot = Math.min(G, sum);
      if (sum > tot) { const k = tot / sum; s54 *= k; s54F *= k; s54EC *= k; }
      return { s54, s54F, s54EC, tot };
    }
    function surRate(ti) {
      if (!ind) return N(c.srate);
      const newR = (c.regime || 'new') === 'new';
      const s = ti > 5e7 ? (newR ? 25 : 37) : ti > 2e7 ? 25 : ti > 1e7 ? 15 : ti > 5e6 ? 10 : 0;
      return kind === 'stcgSlab' ? s : Math.min(s, 15);
    }
    function taxOn(G, H, B, rt) {
      const e = exemptions(G, H, B), afterEx = Math.max(0, G - e.tot), setoff = Math.min(lossAvail, afterEx), taxable = afterEx - setoff;
      let base = 0, adj = 0, thr = 0, net = taxable;
      if (kind === 'stcgSlab') base = ind ? slabTax(other + taxable, sl) - slabTax(other, sl) : taxable * (N(c.orate) || 30) / 100;
      else { adj = Math.min(shortfall, net); net -= adj; if (kind === 'ltcg112A') { thr = Math.min(after ? 125000 : 100000, net); net -= thr; } base = net * rt / 100; }
      return { G, ...e, afterEx, setoff, taxable, adj, thr, net, base, rate: rt };
    }
    function option(id, title, H, B) {
      const A = taxOn(gainPlain, H, B, rate);
      const I = ix.applicable ? taxOn(gainIdx, H, B, 20) : null;
      let pick = A, basis = 'without indexation';
      if (ix.applicable && !ix.both) { pick = I; basis = 'with indexation'; }
      else if (ix.both && I.base < A.base) { pick = I; basis = '20% with indexation – lower'; }
      else if (ix.both) basis = I.base === A.base ? 'both equal' : '12.5% without indexation – lower';
      const ti = other + pick.taxable, sr = surRate(ti), sur = pick.base * sr / 100, cess = (pick.base + sur) * 0.04, total = Math.round(pick.base + sur + cess);
      const hInv = house ? H : 0, bInv = bondsOk ? Math.min(B, BOND_CAP) : 0;
      return { id, title, H: hInv, B: bInv, A, I, pick, basis, sr, sur, cess, total, invested: hInv + bInv, cash: netCons - total - hInv - bInv };
    }

    const H = N(c.house), B = Math.min(N(c.bonds), BOND_CAP);
    r.options = [option(1, 'Option 1 – pay the tax', 0, 0)];
    const gMax = ix.applicable ? Math.max(gainPlain, gainIdx) : gainPlain;
    if (longTerm && gMax > 0 && (house || bondsOk)) {
      if (house) r.options.push(option(2, `Option 2 – residential house (${house === 's54' ? 's.54 / s.82' : 's.54F / s.86'})`, H, 0));
      if (bondsOk) r.options.push(option(3, 'Option 3 – capital gains bonds (s.54EC / s.85)', 0, B));
      if (house && bondsOk) r.options.push(option(4, 'Option 4 – house and bonds together', H, B));
      // investment needed for full exemption
      const bFull = bondsOk ? Math.min(gMax, BOND_CAP) : 0, rest = gMax - bFull;
      const hFor = left => house === 's54' ? left : netCons * left / gMax;
      r.need = { gain: gMax, houseOnly: house ? hFor(gMax) : null, bondsOnly: bondsOk ? bFull : null, houseWithBonds: house && bondsOk ? hFor(rest) : null };
      r.need.capHit = !!house && (bondsOk ? r.need.houseWithBonds : r.need.houseOnly) > cap;
      if (house) {
        const hNeed = Math.ceil(Math.min(bondsOk ? r.need.houseWithBonds : r.need.houseOnly, cap));
        r.options.push(option(5, !bondsOk ? 'Option 5 – full exemption through the house' : hNeed > 0 ? 'Option 5 – full exemption: bonds up to the limit, house for the balance' : 'Option 5 – full exemption: bonds alone cover the gain', hNeed, bFull));
      } else r.options.push(option(5, 'Option 5 – maximum bonds (up to Rs. 50 lakh)', 0, bFull));
    } else if (!longTerm) r.notes.push(['warn', 'Short-term gain: the reinvestment exemptions (s.54, s.54F, s.54EC / s.82, s.86, s.85) are only for long-term gains – Option 1 alone applies.']);
    r.options.forEach(o => { o.saved = r.options[0].total - o.total; });

    if (!longTerm) r.notes.push(['tip', `Long-term from ${dmy(ltFrom)}: the asset becomes long-term if it is transferred on or after this date (held for more than ${lim} months). Compare the tax before fixing the date of the transfer.`]);
    if (house === 's54' && gMax > 0 && gMax <= TWO_HOUSE) r.notes.push(['tip', 'Proviso to s.54(1) / s.82: as the long-term gain does not exceed Rs. 2 crore, the assessee may, once in a lifetime, invest in two residential houses in India and claim the exemption for both.']);
    if (house === 's54F' && r.need) r.notes.push(['tip', `s.54F / s.86 is based on the net consideration, not the gain: the whole gain is exempt only if Rs. ${inr(netCons)} (the net consideration) is invested in the house. Investing an amount equal to the gain (Rs. ${inr(gMax)}) is not enough. With bonds, each exemption is worked out on the gain – house exemption = gain × cost of the house ÷ net consideration – and the total is limited to the gain.`]);
    if ((r.need && r.need.capHit) || (house && N(c.house) > cap)) r.notes.push(['warn', 'Investment in the new house above Rs. 10 crore is not counted for the exemption (s.54 / s.54F, sales from 01-04-2023; s.82 / s.86) – full exemption is not possible through the house alone.']);
    if (bondsOk) r.notes.push(['info', 'Bonds: the Rs. 50 lakh limit is for the year of transfer and the next year together (proviso to s.54EC(1) / s.85). Interest is taxable. If the bonds are transferred or used as security for a loan or advance within five years, the exempted gain becomes taxable in that year.']);
    if (house) r.notes.push(['info', 'House: it must be a residential house in India. If it is transferred within three years of its purchase / construction, the exemption is withdrawn as the section provides.']);
    if (house && bondsOk) r.notes.push(['info', 'House and bonds together: each exemption is worked out on the gain and the total is limited to the gain.']);
    if (res && shortfall > 0 && kind !== 'stcgSlab') r.notes.push(['info', `Basic exemption limit: other income Rs. ${inr(other)} is below Rs. ${inr(belAmt)} (${(c.regime || 'new') === 'old' ? 'old' : 'new'} regime) – the shortfall of Rs. ${inr(shortfall)} is set off against the gain (provisos to s.111A, s.112, s.112A; s.196 to s.198).`]);
    if (lossAvail > 0) r.notes.push(['info', `Capital losses of Rs. ${inr(lossAvail)} set off against the gain${longTerm ? ' (long-term loss only against long-term gain; short-term loss against either)' : ' (short-term loss only; a long-term loss cannot be set off against a short-term gain)'}.`]);
    if (ind && kind === 'stcgSlab') r.notes.push(['info', 'Short-term gain at slab rates: the tax shown is the increase in tax on the other income because of the gain. Rebate under s.87A (and its 2025 Act equivalent) is not considered.']);
    if (r.act === '2025') r.notes.push(['info', `The transfer is in tax year ${fyLabel(sfy)} – the Income-tax Act, 2025 applies. Sections of both Acts are shown; the 2025 Act numbers are from the published concordance – verify before quoting.`]);

    // deadlines
    const S = c.sdate, due = c.due === 'custom' ? c.dueDate : `${sfy + 1}-${c.due === 'oct' ? '10-31' : c.due === 'aug' ? '08-31' : '07-31'}`, D = [];
    r.dueDate = due;
    if (house) {
      D.push([`Purchase of the new residential house (${house === 's54' ? 's.54 / s.82' : 's.54F / s.86'})`, `${addMonths(S, -12)} to ${addMonths(S, 24)}`, 'one year before or two years after the date of transfer']);
      D.push(['Construction of the new residential house – to be completed by', addMonths(S, 36), 'within three years after the date of transfer']);
      D.push(['Deposit of the amount not yet used for the house in the Capital Gains Accounts Scheme, 1988 – on or before', due, `due date of the return of income for ${r.act === '2025' ? 'tax year' : 'FY'} ${fyLabel(sfy)} (as selected – check the due date and any extension)`]);
      D.push(['CGAS amount not used for the house by this date is taxed as long-term gain of the year in which three years expire', addMonths(S, 36), 'three years from the date of transfer']);
      D.push(['New house not to be transferred before', '3 years from its purchase / construction', 'else the exemption is withdrawn']);
    }
    if (bondsOk) {
      D.push(['Investment in specified bonds (NHAI, REC, PFC, IRFC and other notified bonds) – by', addMonths(S, 6), 'within six months after the date of transfer (s.54EC / s.85)']);
      D.push(['Bonds not to be transferred or pledged before', '5 years from the date of allotment', 'lock-in']);
    }
    [[`${sfy}-06-15`, '15%'], [`${sfy}-09-15`, '45%'], [`${sfy}-12-15`, '75%'], [`${sfy + 1}-03-15`, '100%']].forEach(([d, p]) => { if (d >= S) D.push([`Advance tax instalment (cumulative ${p}) – include the tax on the capital gain`, d, 'tax on the gain paid in the instalments falling after the gain arises – no interest for the earlier instalments on that part (proviso to s.234C; verify the 2025 Act provision)']); });
    if (c.asset === 'land' && c.seller !== 'nri' && Math.max(N(c.samt), N(c.sdv)) >= 5e6) D.push(['TDS by the buyer @ 1% (resident seller); the buyer deposits it and issues the certificate', 'with each payment', 's.194-IA / s.393 (table) of the 2025 Act – consideration or stamp duty value Rs. 50 lakh or more; a non-resident seller is covered by s.195 instead']);
    D.push(['Return of income – report the gain and the exemptions claimed (schedule CG)', due, 'due date as selected; the exemption is claimed in the return']);
    r.deadlines = D.map(([what, when, why]) => ({ what, when: when.replace(/(\d{4})-(\d{2})-(\d{2})/g, '$3-$2-$1'), why }));
    return r;
  }

  root.CG = { CII, YEARS, FIRST, LAST, CUTOFF, SECTIONS, compute, fyLabel, fyOf, addMonths };
})(typeof window !== 'undefined' ? window : globalThis);
