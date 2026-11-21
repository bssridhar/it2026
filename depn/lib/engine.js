/*
 * Depreciation under Schedule II to the Companies Act, 2013.
 * window.Depn = { rates, computeYear, lifeSchedule, register, checks, helpers }
 *
 *  SLM rate  = (100% − residual%) ÷ useful life (on cost)
 *  WDV rate  = 1 − (residual ÷ cost)^(1 ÷ useful life)  (on opening written-down value)
 *  Pro rata from the date of addition / up to the date of sale, discard etc. (Note 2), by days in the financial year.
 *  Extra shift depreciation (Note 6): +50% for the period of double shift, +100% for triple shift; not for NESD assets.
 *  Carrying amount is never taken below the residual value (Note 5: residual generally not more than 5% of cost).
 */
(function (root) {
  "use strict";
  const DAY = 864e5;
  const D = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const days = (a, b) => Math.round((D(b) - D(a)) / DAY) + 1;       // inclusive
  const dmy = s => s ? s.split('-').reverse().join('-') : '';
  const addYears = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y + n, m - 1, d)); if (t.getUTCMonth() !== m - 1) t.setUTCDate(0); return iso(t); };
  const r2 = n => Math.round(n * 100) / 100;
  const num = v => { const n = Number(String(v ?? '').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
  const EXTRA = [{ code: 'LAND', group: 'Land', name: 'Freehold land – not depreciated (not in Part C)', life: 0, nesd: true }];
  const lookup = code => (root.SCHEDULE_II || []).concat(EXTRA).find(x => x.code === code);

  function rates(life, rvPct) {
    const rv = rvPct / 100;
    return { slm: life > 0 ? (1 - rv) / life : 0, wdv: life > 0 && rv > 0 ? 1 - Math.pow(rv, 1 / life) : (life > 0 ? 1 : 0) };
  }

  /* One asset for one financial year [fyStart, fyEnd]. a: { cost, put_to_use, opening_acc, method, life, rv_pct, sold_on, sale_value, double_days, triple_days, nesd } */
  function computeYear(a, fyStart, fyEnd) {
    const cost = num(a.cost), rvPct = a.rv_pct === '' || a.rv_pct === undefined ? 5 : num(a.rv_pct), life = num(a.life);
    const RV = cost * rvPct / 100, R = rates(life, rvPct), FYD = days(fyStart, fyEnd);
    const out = { cost, RV, life, rvPct, rateSLM: R.slm, rateWDV: R.wdv, FYD, method: a.method === 'WDV' ? 'WDV' : 'SLM', steps: [] };
    const put = a.put_to_use, sold = a.sold_on || '';
    out.isAddition = !!put && put >= fyStart && put <= fyEnd;
    out.openingGross = put && put < fyStart && !(sold && sold < fyStart) ? cost : 0;
    out.addition = out.isAddition && !(sold && sold < put) ? cost : 0;
    out.openingAcc = out.openingGross ? num(a.opening_acc) : 0;
    const openWDV = out.openingGross ? cost - out.openingAcc : out.addition;
    out.openingWDV = openWDV;
    if (!(life > 0)) { out.dep = 0; out.daysUsed = 0; out.steps.push('No useful life – not depreciated (e.g. freehold land).'); return finish(out, a, 0, fyStart, fyEnd); }
    if (!put) { out.dep = 0; out.daysUsed = 0; out.steps.push('Date put to use not entered – no depreciation (depreciation starts when the asset is available for use).'); return finish(out, a, 0, fyStart, fyEnd); }
    if (put > fyEnd) { out.dep = 0; out.daysUsed = 0; out.steps.push(`Put to use on ${dmy(put)}, after the year – no depreciation this year.`); return finish(out, a, 0, fyStart, fyEnd); }
    if (sold && sold < fyStart) { out.dep = 0; out.daysUsed = 0; out.steps.push(`Sold / discarded on ${dmy(sold)}, before the year.`); return finish(out, a, 0, fyStart, fyEnd); }
    const from = put > fyStart ? put : fyStart, to = sold && sold < fyEnd ? sold : fyEnd;
    const used = Math.max(0, days(from, to)); out.daysUsed = used;
    const endOfLife = life > 0 ? iso(D(addYears(put, life)) - DAY) : '';
    out.endOfLife = endOfLife;
    let dep;
    if (out.method === 'SLM') {
      const annual = (cost - RV) / (life || 1);
      dep = annual * used / FYD;
      out.steps.push(`SLM rate = (100% − ${rvPct}%) ÷ ${life} years = ${(R.slm * 100).toFixed(4)}% of cost.`);
      out.steps.push(`Depreciation = (${fmt(cost)} − residual ${fmt(RV)}) ÷ ${life} × ${used} ÷ ${FYD} days = ${fmt(dep)}.`);
    } else {
      dep = openWDV * R.wdv * used / FYD;
      out.steps.push(`WDV rate = 1 − (${rvPct}%)^(1 ÷ ${life}) = ${(R.wdv * 100).toFixed(4)}%.`);
      out.steps.push(`Depreciation = opening WDV ${fmt(openWDV)} × ${(R.wdv * 100).toFixed(4)}% × ${used} ÷ ${FYD} days = ${fmt(dep)}.`);
      if (endOfLife && endOfLife <= fyEnd && !(sold && sold < endOfLife)) { const d2 = Math.max(0, openWDV - RV); if (Math.abs(d2 - dep) > 0.5) out.steps.push(`Useful life ends on ${dmy(endOfLife)} in this year – the carrying amount is written down to the residual value: ${fmt(d2)}.`); dep = d2; }
    }
    // extra shift (Note 6)
    const dbl = Math.min(used, num(a.double_days)), tpl = Math.min(used - dbl, num(a.triple_days));
    out.extra = 0;
    if ((dbl || tpl) && used) {
      if (a.nesd) out.steps.push('Extra shift depreciation is not permitted for this asset (NESD) – ignored.');
      else { out.extra = dep / used * (0.5 * dbl + 1 * tpl); out.steps.push(`Extra shift (Note 6): ${dbl} day(s) double shift × 50% + ${tpl} day(s) triple shift × 100% = ${fmt(out.extra)}.`); dep += out.extra; }
    }
    const room = Math.max(0, openWDV - RV);
    if (dep > room) { out.steps.push(`Limited to the carrying amount above the residual value: ${fmt(openWDV)} − ${fmt(RV)} = ${fmt(room)}.`); dep = room; }
    out.dep = dep;
    return finish(out, a, dep, fyStart, fyEnd);
  }
  function finish(out, a, dep, fyStart, fyEnd) {
    const sold = a.sold_on && a.sold_on >= fyStart && a.sold_on <= fyEnd && (out.openingGross || out.addition);
    out.deletion = 0; out.accOnDeletion = 0; out.profit = 0; out.wdvOnSale = 0;
    const accBefore = out.openingAcc + dep;
    if (sold) {
      out.deletion = out.openingGross || out.addition; out.accOnDeletion = accBefore; out.wdvOnSale = out.deletion - accBefore;
      out.saleValue = num(a.sale_value); out.profit = out.saleValue - out.wdvOnSale;
    }
    out.closingGross = out.openingGross + out.addition - out.deletion;
    out.closingAcc = accBefore - out.accOnDeletion;
    out.closingWDV = out.closingGross - out.closingAcc;
    return out;
  }
  const fmt = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* year-by-year schedule over the useful life (for one asset), financial years ending on fyEndMD (MM-DD) */
  function lifeSchedule(a, fyEndMD = '03-31') {
    if (!a.put_to_use || !(num(a.life) > 0)) return [];
    const [py] = a.put_to_use.split('-').map(Number);
    let fyEnd = `${py}-${fyEndMD}`; if (fyEnd < a.put_to_use) fyEnd = `${py + 1}-${fyEndMD}`;
    const rows = []; let acc = 0;
    for (let i = 0; i < num(a.life) + 2; i++) {
      const fyStart = iso(D(addYears(fyEnd, -1)) + DAY);
      const asset = Object.assign({}, a, { opening_acc: acc, sold_on: '' });
      const r = computeYear(asset, fyStart, fyEnd);
      rows.push({ fy: `${fyStart.slice(0, 4)}-${fyEnd.slice(2, 4)}`, fyStart, fyEnd, opening: r.openingWDV, dep: r.dep, closing: r.openingWDV - r.dep, days: r.daysUsed });
      acc += r.dep;
      if (r.openingWDV - r.dep <= r.RV + 0.005) break;
      fyEnd = addYears(fyEnd, 1);
    }
    return rows;
  }

  /* accumulated depreciation from the date put to use up to the day before fyStart (same method, single shift, no revision of life) */
  function accTo(a, fyStart) {
    const md = iso(D(fyStart) - DAY).slice(5);
    return lifeSchedule(Object.assign({}, a, { double_days: 0, triple_days: 0 }), md).filter(r => r.fyEnd < fyStart).reduce((t, r) => t + r.dep, 0);
  }

  /* register: all assets for one financial year + audit checks */
  function register(assets, fyStart, fyEnd, coType) {
    const rows = assets.map(a => {
      const s = lookup(a.code) || {};
      const life = a.life_override ? num(a.life_override) : (s.life || 0);
      const r = computeYear(Object.assign({}, a, { life, nesd: !!s.nesd }), fyStart, fyEnd);
      r.fyEnd = fyEnd;
      return Object.assign(r, { a, s, group: a.group || s.group || 'Unclassified', scheduleLife: s.life || 0, books: a.books_dep === '' || a.books_dep === undefined ? null : num(a.books_dep) });
    });
    const issues = [];
    rows.forEach(r => {
      const a = r.a, who = `${a.asset_id || ''} ${a.desc || ''}`.trim() || '(asset)';
      if (!r.s.code) issues.push(['err', `${who}: Schedule II class not chosen.`]);
      if (r.s.code && a.life_override && num(a.life_override) !== r.scheduleLife) {
        if (coType === 'other' && num(a.life_override) > r.scheduleLife) issues.push(['err', `${who}: useful life ${a.life_override} years is longer than ${r.scheduleLife} years in Part C – not permitted for this company (Part A para 3(ii)).`]);
        else issues.push(['warn', `${who}: useful life ${a.life_override} years differs from ${r.scheduleLife} years in Part C – disclose the useful life used (Note 3(ii))${coType === 'indas' ? ' and the justification (Part A para 3(i))' : ''}.`]);
      }
      if (r.rvPct > 5) issues.push([coType === 'other' ? 'err' : 'warn', `${who}: residual value ${r.rvPct}% of cost is more than 5% (Note 5)${coType === 'other' ? ' – not permitted for this company (para 3(ii))' : ' – disclose the justification (para 3(i))'}.`]);
      if ((num(a.double_days) || num(a.triple_days)) && r.s.nesd) issues.push(['err', `${who}: extra shift depreciation claimed on an NESD asset (Note 6).`]);
      if (r.openingGross && !num(a.opening_acc) && r.life > 0) issues.push(['warn', `${who}: brought forward from an earlier year but the opening accumulated depreciation is nil – enter it (or use "Fill opening accumulated depreciation").`]);
      if (r.life > 0 && r.closingGross && r.closingWDV <= r.RV + 0.5) issues.push(['info', `${who}: fully depreciated (carried at residual value) – check whether it is still in use and whether the useful life estimate needs review.`]);
      if (!a.put_to_use && num(a.cost)) issues.push(['warn', `${who}: date put to use not entered – no depreciation computed (capital work-in-progress?).`]);
      if (r.life > 0 && r.method === 'WDV' && r.rvPct === 0) issues.push(['warn', `${who}: WDV with nil residual value gives a 100% rate – enter the residual value.`]);
      if (r.openingAcc > r.cost - r.RV + 0.5) issues.push(['err', `${who}: opening accumulated depreciation exceeds cost less residual value.`]);
      if (r.books !== null && Math.abs(r.books - r.dep) > 1) issues.push(['warn', `${who}: depreciation as per books ${fmt(r.books)} vs computed ${fmt(r.dep)} – difference ${fmt(r.books - r.dep)}.`]);
      if (r.s.code === 'IV(i)(b)') issues.push(['info', `${who}: continuous process plant – useful life taken as ${r.life} years as in the Schedule text used; verify against the current text of Schedule II.`]);
    });
    const groups = {};
    rows.forEach(r => { const g = groups[r.group] = groups[r.group] || { group: r.group, openingGross: 0, addition: 0, deletion: 0, closingGross: 0, openingAcc: 0, dep: 0, accOnDeletion: 0, closingAcc: 0, closingWDV: 0, openingWDV: 0, books: 0, hasBooks: false };
      ['openingGross', 'addition', 'deletion', 'closingGross', 'openingAcc', 'dep', 'accOnDeletion', 'closingAcc', 'closingWDV'].forEach(k => g[k] += r[k]);
      g.openingWDV += r.openingGross - r.openingAcc; if (r.books !== null) { g.books += r.books; g.hasBooks = true; } });
    const tot = Object.values(groups).reduce((t, g) => { Object.keys(g).forEach(k => { if (typeof g[k] === 'number') t[k] = (t[k] || 0) + g[k]; }); return t; }, { group: 'Total' });
    return { rows, groups: Object.values(groups), tot, issues };
  }

  root.Depn = { rates, computeYear, lifeSchedule, accTo, register, EXTRA, helpers: { dmy, days, addYears, r2, fmt, num, lookup, iso, D } };
})(window);
