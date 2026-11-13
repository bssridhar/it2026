/* Depreciation tool – page logic (state, single-asset calculator, register, PPE note, exports). */
(function () {
"use strict";
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const H = Depn.helpers, { fmt, num, dmy, lookup, iso, D, addYears } = H;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = r => (r * 100).toFixed(2) + '%';
const pct4 = r => (r * 100).toFixed(4) + '%';
const LS = 'depn-current-v1';
const store = { get(d) { try { const v = localStorage.getItem(LS); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) { /* draft not kept */ } } };
const CLASSES = (window.SCHEDULE_II || []).concat(Depn.EXTRA);
const S3 = g => /^Plant and Machinery|^Laboratory/.test(g) ? 'Plant and Equipment' : g === 'Furniture and fittings' ? 'Furniture and Fixtures' : g === 'Motor vehicles' ? 'Vehicles'
  : g === 'Computers and data processing units' ? 'Computers' : g;  // Land, Buildings, Office equipment stay; the rest are "Others – specify nature"
const defFyEnd = () => { const t = new Date(), y = t.getMonth() >= 3 ? t.getFullYear() + 1 : t.getFullYear(); return `${y}-03-31`; };
const blankSingle = () => ({ desc: '', code: 'IV(i)(a)', cost: '', put_to_use: '', method: 'SLM', rv_pct: '5', life_override: '', double_days: '', triple_days: '', opening_acc: '', sold_on: '', sale_value: '' });
const blankAsset = () => ({ asset_id: '', desc: '', code: '', group: '', put_to_use: '', cost: '', opening_acc: '', method: 'SLM', life_override: '', rv_pct: '', sold_on: '', sale_value: '', double_days: '', triple_days: '', books_dep: '', location: '' });
const blank = () => ({ kind: 'depn-case', company: '', fy_end: defFyEnd(), coType: 'other', tab: 'single', single: blankSingle(), assets: [] });
let st = Object.assign(blank(), store.get({}));
st.single = Object.assign(blankSingle(), st.single); st.assets = (st.assets || []).map(a => Object.assign(blankAsset(), a));
const fyStart = () => iso(D(addYears(st.fy_end, -1)) + 864e5);
const fyLabel = () => `${fyStart().slice(0, 4)}-${st.fy_end.slice(2, 4)}`;
const save = () => store.set(st);
const msg = (el, cls, t) => { $(el).innerHTML = t ? `<div class="m-${cls}">${t}</div>` : ''; };

/* ---------- common ---------- */
function bindTop() {
  $$('[data-f]').forEach(el => { el.value = st[el.dataset.f] ?? ''; el.onchange = () => { st[el.dataset.f] = el.value; if (el.dataset.f === 'fy_end' && !el.value) st.fy_end = defFyEnd(); save(); renderAll(); }; });
  $$('input[name=coType]').forEach(r => { r.checked = r.value === st.coType; r.onchange = () => { st.coType = r.value; save(); renderAll(); }; });
}
function showTab(t) { st.tab = t; save(); $$('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t)); $$('[data-pane]').forEach(p => p.hidden = p.dataset.pane !== t); }
$$('[data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
function classOptions(sel) {
  const groups = {}; CLASSES.forEach(c => (groups[c.group] = groups[c.group] || []).push(c));
  return '<option value="">– choose –</option>' + Object.entries(groups).map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(c => `<option value="${esc(c.code)}"${c.code === sel ? ' selected' : ''}>${esc(c.code)} – ${esc(c.name)} (${c.life ? c.life + ' yrs' : 'nil'}${c.nesd ? ', NESD' : ''})</option>`).join('')}</optgroup>`).join('');
}
function renderAll() { $('#fyInfo').textContent = `Financial year ${fyLabel()}: ${dmy(fyStart())} to ${dmy(st.fy_end)} (${H.days(fyStart(), st.fy_end)} days)`; renderSingle(); renderReg(); renderNote(); renderRef(); }

/* ---------- 1. single asset ---------- */
function singleAsset() {
  const s = st.single, c = lookup(s.code) || {};
  return Object.assign({}, s, { life: s.life_override ? num(s.life_override) : (c.life || 0), nesd: !!c.nesd, rv_pct: s.rv_pct === '' ? 5 : num(s.rv_pct) });
}
function bindSingle() {
  $('#sCode').innerHTML = classOptions(st.single.code);
  $$('[data-s]').forEach(el => { el.value = st.single[el.dataset.s] ?? ''; el.onchange = () => { st.single[el.dataset.s] = el.value.trim(); save(); renderSingle(); }; });
}
function renderSingle() {
  const s = st.single, c = lookup(s.code), a = singleAsset(), F = fyStart(), E = st.fy_end;
  $('#sClassInfo').innerHTML = c ? `Part C useful life <b>${c.life || 'nil'}${c.life ? ' years' : ''}</b>${c.nesd ? ' · NESD (no extra shift depreciation)' : ' · extra shift depreciation allowed'} · group: ${esc(c.group)}` : 'Choose the class of asset.';
  const out = [];
  if (c && s.life_override && num(s.life_override) !== c.life) out.push(st.coType === 'other' && num(s.life_override) > c.life ? ['err', `A useful life of ${s.life_override} years is longer than ${c.life} years in Part C – not permitted for this company (Part A para 3(ii)).`] : ['warn', `Useful life differs from Part C – disclose the life used (Note 3(ii))${st.coType === 'indas' ? ' and the justification (para 3(i))' : ''}.`]);
  if (a.rv_pct > 5) out.push([st.coType === 'other' ? 'err' : 'warn', `Residual value is more than 5% of cost (Note 5)${st.coType === 'other' ? ' – not permitted for this company (para 3(ii))' : ' – disclose the justification (para 3(i))'}.`]);
  if (c && c.nesd && (num(s.double_days) || num(s.triple_days))) out.push(['err', 'This class is NESD – extra shift depreciation is not allowed (Note 6).']);
  if (s.put_to_use && s.put_to_use > E) out.push(['info', `Put to use after ${dmy(E)} – no depreciation in ${fyLabel()}.`]);
  if (s.put_to_use && s.put_to_use < F && !num(s.opening_acc) && a.life > 0) out.push(['warn', `Put to use before ${dmy(F)} – enter the accumulated depreciation at the start of the year, or compute it from the date put to use.`]);
  if (s.code === 'IV(i)(b)') out.push(['info', 'Continuous process plant – 8 years as in the text of the Schedule used for this tool; check the current text of Schedule II.']);
  $('#sMsgs').innerHTML = out.map(([k, t]) => `<div class="m-${k}">${esc(t)}</div>`).join('');
  $('#sOpenWrap').style.display = s.put_to_use && s.put_to_use < F ? '' : 'none';
  if (!c || !num(s.cost)) { $('#sKpis').innerHTML = '<div><span>Enter the class, cost and date put to use</span><b>–</b></div>'; $('#sSteps').innerHTML = ''; $('#sCmp').innerHTML = ''; $('#sLife').innerHTML = ''; $('#sLifeNote').textContent = ''; return; }
  const r = Depn.computeYear(a, F, E);
  const R = Depn.rates(a.life, a.rv_pct);
  $('#sKpis').innerHTML = [
    ['Useful life', a.life ? `${a.life} years` : 'nil'], ['SLM rate (on cost)', a.life ? pct4(R.slm) : '–'], ['WDV rate (on WDV)', a.life ? pct4(R.wdv) : '–'],
    ['Days used in the year', `${r.daysUsed} of ${r.FYD}`], [`Depreciation ${fyLabel()} (${r.method})`, 'Rs. ' + fmt(r.dep)], ['Residual value', 'Rs. ' + fmt(r.RV)],
    [`Carrying amount on ${dmy(E)}`, r.deletion ? 'sold' : 'Rs. ' + fmt(r.closingWDV)]].concat(r.deletion ? [['Profit / (loss) on sale', 'Rs. ' + fmt(r.profit)]] : [])
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  const steps = [`Depreciable amount = cost ${fmt(r.cost)} − residual value ${fmt(r.RV)} (${r.rvPct}% of cost) = ${fmt(r.cost - r.RV)}.`];
  if (r.isAddition) steps.push(`Put to use on ${dmy(s.put_to_use)} – depreciation for ${r.daysUsed} days from ${dmy(s.put_to_use)} to ${dmy(s.sold_on && s.sold_on <= E ? s.sold_on : E)} out of ${r.FYD} days in the year (Note 2).`);
  else if (r.openingGross) steps.push(`Brought forward: cost ${fmt(r.cost)} − accumulated depreciation ${fmt(r.openingAcc)} = opening carrying amount ${fmt(r.openingWDV)}; ${r.daysUsed} days used in the year.`);
  steps.push(...r.steps);
  if (r.deletion) steps.push(`On sale: carrying amount ${fmt(r.wdvOnSale)}, sale value ${fmt(r.saleValue)} – ${r.profit >= 0 ? 'profit' : 'loss'} of ${fmt(Math.abs(r.profit))}.`);
  $('#sSteps').innerHTML = steps.map(t => `<li>${esc(t)}</li>`).join('');
  const rs = Depn.computeYear(Object.assign({}, a, { method: 'SLM' }), F, E), rw = Depn.computeYear(Object.assign({}, a, { method: 'WDV' }), F, E);
  $('#sCmp').innerHTML = `<thead><tr><th>Method</th><th class="n">Rate</th><th class="n">Depreciation ${fyLabel()}</th><th class="n">Carrying amount on ${dmy(E)}</th></tr></thead><tbody>
    <tr><td>SLM</td><td class="n">${pct4(R.slm)}</td><td class="n">${fmt(rs.dep)}</td><td class="n">${fmt(rs.closingWDV)}</td></tr>
    <tr><td>WDV</td><td class="n">${pct4(R.wdv)}</td><td class="n">${fmt(rw.dep)}</td><td class="n">${fmt(rw.closingWDV)}</td></tr></tbody>`;
  const md = st.fy_end.slice(5), single = Object.assign({}, a, { double_days: 0, triple_days: 0, opening_acc: 0, sold_on: '' });
  const ls = Depn.lifeSchedule(Object.assign({}, single, { method: 'SLM' }), md), lw = Depn.lifeSchedule(Object.assign({}, single, { method: 'WDV' }), md);
  const n = Math.max(ls.length, lw.length);
  $('#sLifeNote').textContent = s.put_to_use ? `from ${dmy(s.put_to_use)}` : 'enter the date put to use';
  if (!n) { $('#sLife').innerHTML = ''; return; }
  let tS = 0, tW = 0, rowsH = '';
  for (let i = 0; i < n; i++) { const x = ls[i], y = lw[i]; tS += x ? x.dep : 0; tW += y ? y.dep : 0;
    const fy = (x || y).fy, cur = (x || y).fyEnd === st.fy_end ? ' style="font-weight:700"' : '';
    rowsH += `<tr${cur}><td>${fy}</td><td class="n">${(x || y).days}</td><td class="n">${x ? fmt(x.opening) : ''}</td><td class="n">${x ? fmt(x.dep) : ''}</td><td class="n">${x ? fmt(x.closing) : ''}</td><td class="n">${y ? fmt(y.opening) : ''}</td><td class="n">${y ? fmt(y.dep) : ''}</td><td class="n">${y ? fmt(y.closing) : ''}</td></tr>`; }
  $('#sLife').innerHTML = `<thead><tr><th>Year</th><th class="n">Days</th><th class="n">SLM – opening</th><th class="n">SLM – depreciation</th><th class="n">SLM – closing</th><th class="n">WDV – opening</th><th class="n">WDV – depreciation</th><th class="n">WDV – closing</th></tr></thead><tbody>${rowsH}</tbody>
    <tfoot><tr><td>Total</td><td></td><td></td><td class="n">${fmt(tS)}</td><td></td><td></td><td class="n">${fmt(tW)}</td><td></td></tr></tfoot>`;
}
$('#sFillAcc').onclick = () => { const a = singleAsset(); if (!a.put_to_use || !(a.life > 0)) return; st.single.opening_acc = String(H.r2(Depn.accTo(a, fyStart()))); save(); bindSingle(); renderSingle(); };
$('#sClear').onclick = () => { st.single = blankSingle(); save(); bindSingle(); renderSingle(); };
$('#sToReg').onclick = () => { const s = st.single; if (!lookup(s.code) || !num(s.cost)) return msg('#sMsgs', 'err', 'Enter the class and cost first.');
  st.assets.push(Object.assign(blankAsset(), { asset_id: '', desc: s.desc, code: s.code, put_to_use: s.put_to_use, cost: s.cost, opening_acc: s.opening_acc, method: s.method, life_override: s.life_override, rv_pct: s.rv_pct === '5' ? '' : s.rv_pct, sold_on: s.sold_on, sale_value: s.sale_value, double_days: s.double_days, triple_days: s.triple_days }));
  save(); renderReg(); renderNote(); msg('#sMsgs', 'ok', `Added to the fixed asset register (now ${st.assets.length} asset${st.assets.length > 1 ? 's' : ''}).`); };

/* ---------- 2. register ---------- */
let res = null;
const COLS = [['asset_id', 'w-s'], ['desc', 'w-l'], ['code', 'sel'], ['group', 'w-m'], ['put_to_use', 'date'], ['cost', 'num'], ['opening_acc', 'num'], ['method', 'meth'], ['life_override', 'w-s'], ['rv_pct', 'w-s'], ['sold_on', 'date'], ['sale_value', 'num'], ['double_days', 'w-s'], ['triple_days', 'w-s'], ['books_dep', 'num']];
const compute = () => { res = Depn.register(st.assets.map(a => Object.assign({}, a, { group: a.group || S3((lookup(a.code) || {}).group || 'Unclassified') })), fyStart(), st.fy_end, st.coType); return res; };
function renderReg() {
  compute();
  const q = ($('#q').value || '').toLowerCase();
  const tb = $('#reg tbody'); tb.innerHTML = '';
  res.rows.forEach((r, i) => {
    const a = st.assets[i];
    if (q && !`${a.asset_id} ${a.desc} ${a.code} ${a.group} ${a.location}`.toLowerCase().includes(q)) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td>` + COLS.map(([k, t]) => {
      if (t === 'sel') return `<td><select data-i="${i}" data-k="${k}" style="width:110px">${classOptions(a[k])}</select></td>`;
      if (t === 'meth') return `<td><select data-i="${i}" data-k="${k}"><option${a[k] === 'SLM' ? ' selected' : ''}>SLM</option><option${a[k] === 'WDV' ? ' selected' : ''}>WDV</option></select></td>`;
      if (t === 'date') return `<td><input type="date" data-i="${i}" data-k="${k}" value="${esc(a[k])}"></td>`;
      return `<td><input class="${t}" data-i="${i}" data-k="${k}" value="${esc(a[k])}"${k === 'group' ? ` placeholder="${esc(S3((lookup(a.code) || {}).group || ''))}"` : ''}></td>`;
    }).join('') + `<td class="n c">${r.life || '–'}</td><td class="n c">${r.life ? pct(r.method === 'SLM' ? r.rateSLM : r.rateWDV) : '–'}</td><td class="n c">${r.daysUsed}</td><td class="n c">${fmt(r.dep)}</td><td class="n c">${fmt(r.closingWDV)}</td>
      <td class="n c" style="color:${r.books !== null && Math.abs(r.books - r.dep) > 1 ? 'var(--err)' : 'inherit'}">${r.books === null ? '' : fmt(r.books - r.dep)}</td><td class="n c">${r.deletion ? fmt(r.profit) : ''}</td>
      <td><button type="button" class="link sm danger" data-del="${i}" title="Remove">✕</button></td>`;
    tb.appendChild(tr);
  });
  const t = res.tot;
  $('#reg tfoot').innerHTML = st.assets.length ? `<tr><td colspan="6">Total (${st.assets.length})</td><td class="n">${fmt(st.assets.reduce((s, a) => s + num(a.cost), 0))}</td><td class="n">${fmt(t.openingAcc || 0)}</td><td colspan="11"></td><td class="n">${fmt(t.dep || 0)}</td><td class="n">${fmt(t.closingWDV || 0)}</td><td></td><td class="n">${fmt(res.rows.reduce((s, r) => s + r.profit, 0))}</td><td></td></tr>` : '';
  if (!st.assets.length) tb.innerHTML = '<tr><td colspan="24" class="hint" style="padding:14px">No assets yet – import the register from Excel, add assets, or add the asset from tab 1.</td></tr>';
  tb.querySelectorAll('[data-k]').forEach(el => el.onchange = () => { st.assets[+el.dataset.i][el.dataset.k] = el.value.trim(); save(); renderReg(); renderNote(); });
  tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { const a = st.assets[+b.dataset.del]; if (await ask('Remove this asset?', esc(`${a.asset_id} ${a.desc}`.trim() || 'Asset ' + (+b.dataset.del + 1)))) { st.assets.splice(+b.dataset.del, 1); save(); renderReg(); renderNote(); } });
  const e = res.issues.filter(x => x[0] === 'err').length, w = res.issues.filter(x => x[0] === 'warn').length;
  $('#regMsgs').innerHTML = st.assets.length ? `<div class="m-${e ? 'err' : w ? 'warn' : 'ok'}" style="margin-top:10px">${e || w ? `${e} error(s) and ${w} point(s) to review – see tab 3, "Audit checks".` : 'No exceptions in the audit checks.'}</div>` : '';
}
$('#q').oninput = renderReg;
$('#addAsset').onclick = () => { st.assets.push(blankAsset()); save(); renderReg(); renderNote(); const ins = $$('#reg tbody input[data-k="desc"]'); if (ins.length) ins[ins.length - 1].focus(); };
$('#clearReg').onclick = async () => { if (st.assets.length && await ask('Clear the register?', `All ${st.assets.length} assets will be removed. Save the case file first if you need it.`)) { st.assets = []; save(); renderReg(); renderNote(); } };
$('#fillAcc').onclick = () => { let n = 0; const F = fyStart();
  st.assets.forEach(a => { const c = lookup(a.code); if (!c || !(c.life > 0) || !a.put_to_use || a.put_to_use >= F || num(a.opening_acc)) return;
    const life = a.life_override ? num(a.life_override) : c.life; a.opening_acc = String(H.r2(Depn.accTo(Object.assign({}, a, { life, rv_pct: a.rv_pct === '' ? 5 : num(a.rv_pct) }), F))); n++; });
  save(); renderReg(); renderNote(); msg('#regMsgs', n ? 'ok' : 'info', n ? `Opening accumulated depreciation filled for ${n} asset(s) of earlier years – check these against the books.` : 'No asset of an earlier year with a blank opening accumulated depreciation.'); };
$('#rollFwd').onclick = async () => {
  if (!st.assets.length) return;
  const sold = res.rows.filter(r => r.a.sold_on && r.a.sold_on <= st.fy_end).length;
  if (!(await ask(`Carry forward to ${(+st.fy_end.slice(0, 4))}-${String(+st.fy_end.slice(2, 4) + 1).padStart(2, '0')}?`, `Save this year's case file first. The closing accumulated depreciation becomes the opening figure for next year; ${sold} asset(s) sold or discarded are dropped; shift days and depreciation as per books are cleared.`))) return;
  st.assets = res.rows.filter(r => !(r.a.sold_on && r.a.sold_on <= st.fy_end) && r.a.put_to_use && r.a.put_to_use <= st.fy_end).map((r, i) => Object.assign({}, st.assets[res.rows.indexOf(r)], { opening_acc: String(H.r2(r.closingAcc)), double_days: '', triple_days: '', books_dep: '' }))
    .concat(st.assets.filter(a => !a.put_to_use || a.put_to_use > st.fy_end));
  st.fy_end = addYears(st.fy_end, 1); save(); bindTop(); renderAll(); msg('#regMsgs', 'ok', `Carried forward to ${fyLabel()}.`);
};

/* import */
const KEYS = Object.keys(blankAsset());
$('#dlTpl').onclick = () => { const bin = atob(window.LLP_TEMPLATES.Fixed_asset_register_template); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); download('Fixed_asset_register_template.xlsx', u, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); };
$('#upXlsx').onclick = () => $('#xlsxFile').click();
$('#xlsxFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const sheets = LLPXlsx.readWorkbook(new Uint8Array(await f.arrayBuffer()));
    const colOf = ref => ref.replace(/\d+$/, ''), rowOf = ref => +ref.replace(/^[A-Z]+/, '');
    let found = null;
    for (const [name, cells] of Object.entries(sheets)) {
      const byRow = {}; Object.keys(cells).forEach(ref => { (byRow[rowOf(ref)] = byRow[rowOf(ref)] || {})[colOf(ref)] = cells[ref]; });
      const hr = Object.keys(byRow).map(Number).sort((a, b) => a - b).find(r => { const v = Object.values(byRow[r]).map(LLPXlsx.str); return v.includes('cost') && v.includes('code'); });
      if (hr) { found = { name, byRow, hr }; break; }
    }
    if (!found) throw new Error('no sheet with the key row of the template (cost, code …) was found – use the Excel template');
    const map = {}; Object.entries(found.byRow[found.hr]).forEach(([c, v]) => { if (KEYS.includes(LLPXlsx.str(v))) map[c] = LLPXlsx.str(v); });
    const list = [], warn = [];
    Object.keys(found.byRow).map(Number).filter(r => r > found.hr + 1).sort((a, b) => a - b).forEach(r => {
      const row = found.byRow[r], a = blankAsset();
      Object.entries(map).forEach(([c, k]) => { const v = row[c]; if (v === undefined) return;
        if (k === 'put_to_use' || k === 'sold_on') { const d = LLPXlsx.date(v); if (d === null) warn.push(`Row ${r}: "${LLPXlsx.str(v)}" is not a date (${k === 'put_to_use' ? 'date put to use' : 'date sold'}).`); a[k] = d || ''; }
        else if (k === 'method') a[k] = /wdv|written/i.test(LLPXlsx.str(v)) ? 'WDV' : 'SLM';
        else a[k] = LLPXlsx.str(v); });
      if (!a.desc && !a.cost && !a.asset_id) return;
      if (a.code && !lookup(a.code)) { const m = CLASSES.find(c => c.code.toLowerCase() === a.code.toLowerCase().replace(/\s+/g, '')); if (m) a.code = m.code; else warn.push(`Row ${r}: class "${a.code}" is not a Schedule II code – choose the class.`); }
      list.push(a);
    });
    if (!list.length) throw new Error('the register has no asset rows');
    if (st.assets.length && !(await ask('Replace the register?', `${st.assets.length} asset(s) on screen will be replaced by ${list.length} from ${esc(f.name)}.`))) return;
    st.assets = list; save(); renderReg(); renderNote();
    $('#regMsgs').innerHTML = `<div class="m-ok" style="margin-top:10px">Imported ${list.length} assets from "${esc(found.name)}" (${esc(f.name)}).</div>` + warn.slice(0, 30).map(w => `<div class="m-warn">${esc(w)}</div>`).join('');
  } catch (err) { msg('#regMsgs', 'err', 'Not imported: ' + esc(err.message || err)); }
};

/* ---------- 3. note ---------- */
const NOTE_COLS = [['openingGross', 'Gross – opening'], ['addition', 'Additions'], ['deletion', 'Disposals'], ['closingGross', 'Gross – closing'], ['openingAcc', 'Acc. depn – opening'], ['dep', 'For the year'], ['accOnDeletion', 'On disposals'], ['closingAcc', 'Acc. depn – closing'], ['closingWDV', 'Net – closing'], ['openingWDV', 'Net – opening']];
function disclosure() {
  const used = {}; res.rows.forEach(r => { if (r.life > 0) (used[r.group] = used[r.group] || new Set()).add(r.method); });
  const methods = Object.entries(used).map(([g, m]) => `${g}: ${[...m].map(x => x === 'SLM' ? 'straight line method' : 'written down value method').join(' and ')}`);
  const diff = res.rows.filter(r => r.s.code && r.a.life_override && num(r.a.life_override) !== r.scheduleLife);
  const lines = [];
  if (methods.length) lines.push(`Depreciation is provided on the ${Object.values(used).every(m => m.size === 1 && m.has('SLM')) ? 'straight line method' : Object.values(used).every(m => m.size === 1 && m.has('WDV')) ? 'written down value method' : 'methods stated below'} over the useful lives of the assets as prescribed in Part C of Schedule II to the Companies Act, 2013${diff.length ? ', except as stated below' : ''}, pro rata from the date the asset is put to use and up to the date of sale or discard. The residual value is taken at ${[...new Set(res.rows.filter(r => r.life > 0).map(r => r.rvPct + '%'))].join(' / ')} of the original cost.`);
  if (methods.length > 1 || !Object.values(used).every(m => m.size === 1)) lines.push('Methods used: ' + methods.join('; ') + '.');
  if (diff.length) lines.push('Useful lives different from Schedule II: ' + [...new Map(diff.map(r => [`${r.s.code}|${r.a.life_override}`, `${r.s.name} – ${r.a.life_override} years (Schedule II: ${r.scheduleLife} years)`])).values()].join('; ') + (st.coType === 'indas' ? '. Justification: [state the basis, e.g. technical evaluation of the expected usage].' : '.'));
  return lines;
}
function renderNote() {
  if (!res) compute();
  $('#noteFy').textContent = `${fyLabel()} – Rs.`;
  const G = res.groups, T = res.tot;
  $('#ppe').innerHTML = G.length ? `<thead><tr><th>Class</th>${NOTE_COLS.map(([, h]) => `<th class="n">${h}</th>`).join('')}</tr></thead><tbody>${G.map(g => `<tr><td>${esc(g.group)}</td>${NOTE_COLS.map(([k]) => `<td class="n">${fmt(g[k])}</td>`).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr><td>Total</td>${NOTE_COLS.map(([k]) => `<td class="n">${fmt(T[k] || 0)}</td>`).join('')}</tr></tfoot>` : '<tbody><tr><td class="hint">The register is empty.</td></tr></tbody>';
  $('#discl').innerHTML = G.length ? disclosure().map(l => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('') + '<p class="hint">Draft wording – adapt to the company\'s accounting policy.</p>' : '';
  const bk = res.rows.filter(r => r.books !== null), bkT = bk.reduce((s, r) => s + r.books, 0), cT = bk.reduce((s, r) => s + r.dep, 0);
  const prof = res.rows.reduce((s, r) => s + (r.deletion && r.profit > 0 ? r.profit : 0), 0), loss = res.rows.reduce((s, r) => s + (r.deletion && r.profit < 0 ? -r.profit : 0), 0);
  $('#chkKpis').innerHTML = [['Assets', st.assets.length], ['Depreciation for the year', fmt(T.dep || 0)], ['Additions', fmt(T.addition || 0)], ['Profit / loss on sale', `${fmt(prof)} / (${fmt(loss)})`]]
    .concat(bk.length ? [['As per books (where given)', fmt(bkT)], ['Books – computed', fmt(bkT - cT)]] : []).map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  const order = { err: 0, warn: 1, info: 2 };
  $('#issues').innerHTML = !st.assets.length ? '' : res.issues.length ? res.issues.slice().sort((a, b) => order[a[0]] - order[b[0]]).map(([k, t]) => `<div class="m-${k}">${esc(t)}</div>`).join('') : '<div class="m-ok">No exceptions.</div>';
}

/* ---------- 4. reference ---------- */
function renderRef() {
  const rv = $('#refRv').value === '' ? 5 : num($('#refRv').value), q = ($('#refQ').value || '').toLowerCase();
  $('#refT').innerHTML = `<thead><tr><th>Code</th><th>Nature of assets</th><th class="n">Useful life</th><th>NESD</th><th class="n">SLM rate</th><th class="n">WDV rate</th></tr></thead><tbody>${(window.SCHEDULE_II || []).filter(c => !q || `${c.code} ${c.group} ${c.name}`.toLowerCase().includes(q)).map(c => { const R = Depn.rates(c.life, rv);
    return `<tr><td>${esc(c.code)}</td><td style="white-space:normal"><span class="hint">${esc(c.group)}</span><br>${esc(c.name)}</td><td class="n">${c.life} years</td><td>${c.nesd ? 'NESD' : ''}</td><td class="n">${pct(R.slm)}</td><td class="n">${pct(R.wdv)}</td></tr>`; }).join('')}</tbody>`;
}
$('#refRv').oninput = renderRef; $('#refQ').oninput = renderRef;

/* ---------- exports ---------- */
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const tag = () => `${(st.company || 'Company').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}_FY${fyLabel()}`;
const P = s => String(s ?? '').replace(/−/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/✕/g, 'x');
const AT = { theme: 'grid', styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: [180, 186, 196], lineWidth: 0.1 }, headStyles: { fillColor: [31, 95, 174], textColor: 255, fontStyle: 'bold' }, footStyles: { fillColor: [235, 238, 243], textColor: 20, fontStyle: 'bold' } };
function pdfHead(doc, title, w) { doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(P(st.company || 'Company'), 14, 13); doc.setFontSize(10.5); doc.text(P(title), 14, 19); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(P(`Financial year ${fyLabel()} (${dmy(fyStart())} to ${dmy(st.fy_end)}) · Schedule II, Companies Act, 2013`), 14, 24); }
function pdfFoot(doc) { const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), Hh = doc.internal.pageSize.getHeight(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(110); doc.text(`Prepared on ${dmy(iso(Date.now()))} · page ${i} of ${n}`, W - 14, Hh - 6, { align: 'right' }); doc.setTextColor(0); } }
const OUT = {
  single: () => {
    const s = st.single, a = singleAsset(), c = lookup(s.code); if (!c || !num(s.cost)) throw new Error('enter the class and cost first');
    const r = Depn.computeYear(a, fyStart(), st.fy_end), R = Depn.rates(a.life, a.rv_pct);
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    pdfHead(doc, 'Depreciation working – ' + (s.desc || c.name));
    doc.autoTable(Object.assign({}, AT, { startY: 29, styles: Object.assign({}, AT.styles, { fontSize: 8.5 }), columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' } }, body: [
      ['Class (Part C)', P(`${c.code} – ${c.name}`)], ['Useful life', `${a.life} years${s.life_override && num(s.life_override) !== c.life ? ` (Part C: ${c.life} years)` : ''}${c.nesd ? ' · NESD' : ''}`], ['Method', r.method === 'SLM' ? 'Straight line' : 'Written down value'],
      ['Cost (Rs.)', fmt(r.cost)], ['Residual value', `${r.rvPct}% = Rs. ${fmt(r.RV)}`], ['Date put to use', dmy(s.put_to_use)], ['SLM rate / WDV rate', `${pct4(R.slm)} / ${pct4(R.wdv)}`],
      ['Days used in the year', `${r.daysUsed} of ${r.FYD}`], [`Depreciation for ${fyLabel()} (Rs.)`, fmt(r.dep)], [`Carrying amount on ${dmy(st.fy_end)} (Rs.)`, r.deletion ? `sold – profit / (loss) ${fmt(r.profit)}` : fmt(r.closingWDV)]] }));
    const steps = $$('#sSteps li').map((li, i) => [String(i + 1), P(li.textContent)]);
    doc.autoTable(Object.assign({}, AT, { startY: doc.lastAutoTable.finalY + 5, head: [['', 'Working']], body: steps, styles: Object.assign({}, AT.styles, { fontSize: 8.5 }), columnStyles: { 0: { cellWidth: 8 } } }));
    const rowsL = $$('#sLife tbody tr').map(tr => Array.from(tr.children).map(td => td.textContent)), ft = $$('#sLife tfoot td').map(td => td.textContent);
    if (rowsL.length) doc.autoTable(Object.assign({}, AT, { startY: doc.lastAutoTable.finalY + 5, head: [['Year', 'Days', 'SLM opening', 'SLM depn', 'SLM closing', 'WDV opening', 'WDV depn', 'WDV closing']], body: rowsL, foot: [ft],
      columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(i => [i, { halign: 'right' }])) }));
    doc.setFontSize(7.5); doc.text(doc.splitTextToSize('Pro rata by days (Note 2). SLM rate = (100% - residual %) / life; WDV rate = 1 - (residual / cost)^(1 / life). Life schedule assumes single shift and no change in estimates.', 180), 14, doc.lastAutoTable.finalY + 6);
    pdfFoot(doc); doc.save(`Depreciation_working_${(s.desc || c.code).replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}_FY${fyLabel()}.pdf`); return 'Working downloaded.';
  },
  regxls: () => {
    if (!st.assets.length) throw new Error('the register is empty');
    const head = ['Asset ID', 'Description', 'Schedule II class', 'Nature (Part C)', 'Class in PPE note', 'Location', 'Put to use', 'Method', 'Useful life (years)', 'Residual %', 'Rate %', 'Cost', 'Opening gross', 'Additions', 'Disposals', 'Closing gross',
      'Opening acc. depn', 'Days used', 'Depreciation for the year', 'of which extra shift', 'Acc. depn on disposals', 'Closing acc. depn', 'Closing WDV', 'Sold on', 'Sale value', 'Profit / (loss) on sale', 'Depn as per books', 'Books – computed'];
    const r2 = H.r2, rows = [head].concat(res.rows.map(r => { const a = r.a; return [a.asset_id, a.desc, a.code, r.s.name || '', r.group, a.location, dmy(a.put_to_use), r.method, r.life, r.rvPct, r2((r.method === 'SLM' ? r.rateSLM : r.rateWDV) * 1e6) / 1e4, r2(r.cost), r2(r.openingGross), r2(r.addition), r2(r.deletion), r2(r.closingGross),
      r2(r.openingAcc), r.daysUsed, r2(r.dep), r2(r.extra || 0), r2(r.accOnDeletion), r2(r.closingAcc), r2(r.closingWDV), dmy(a.sold_on), r.deletion ? r2(r.saleValue) : '', r.deletion ? r2(r.profit) : '', r.books === null ? '' : r2(r.books), r.books === null ? '' : r2(r.books - r.dep)]; }));
    const note = [['Class'].concat(NOTE_COLS.map(c => c[1]))].concat(res.groups.map(g => [g.group].concat(NOTE_COLS.map(([k]) => r2(g[k]))))).concat([['Total'].concat(NOTE_COLS.map(([k]) => r2(res.tot[k] || 0)))]);
    const chk = [['Type', 'Audit check']].concat(res.issues.map(([k, t]) => [k === 'err' ? 'Error' : k === 'warn' ? 'Review' : 'Note', t])).concat([[], ['Disclosure (draft)']]).concat(disclosure().map(l => ['', l]));
    const top = [[st.company || 'Company'], [`Fixed asset register and depreciation – Schedule II, Companies Act, 2013 – FY ${fyLabel()} (${dmy(fyStart())} to ${dmy(st.fy_end)})`], []];
    download(`Depreciation_register_${tag()}.xls`, XlsWrite.build([{ name: 'Register', rows: top.concat(rows) }, { name: 'PPE note', rows: top.concat(note) }, { name: 'Audit checks', rows: top.concat(chk) }]), 'application/vnd.ms-excel');
    return `Register downloaded – ${st.assets.length} assets, depreciation Rs. ${fmt(res.tot.dep || 0)}.`;
  },
  regpdf: () => {
    if (!st.assets.length) throw new Error('the register is empty');
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    pdfHead(doc, 'Fixed asset register and depreciation');
    const body = res.rows.map((r, i) => { const a = r.a; return [i + 1, P(`${a.asset_id ? a.asset_id + ' ' : ''}${a.desc}`), P(a.code), dmy(a.put_to_use), r.life || '-', r.life ? `${r.method} ${pct(r.method === 'SLM' ? r.rateSLM : r.rateWDV)}` : '-', fmt(r.openingGross), fmt(r.addition), fmt(r.deletion), fmt(r.openingAcc), r.daysUsed, fmt(r.dep), fmt(r.accOnDeletion), fmt(r.closingAcc), fmt(r.closingWDV), r.deletion ? fmt(r.profit) : '']; });
    const T = res.tot;
    doc.autoTable(Object.assign({}, AT, { startY: 28, styles: Object.assign({}, AT.styles, { fontSize: 6.5, cellPadding: 1 }), head: [['#', 'Asset', 'Class', 'Put to use', 'Life', 'Method / rate', 'Opening gross', 'Additions', 'Disposals', 'Opening acc.', 'Days', 'Depreciation', 'Acc. on disposal', 'Closing acc.', 'Closing WDV', 'Profit/(loss)']], body,
      foot: [['', 'Total', '', '', '', '', fmt(T.openingGross || 0), fmt(T.addition || 0), fmt(T.deletion || 0), fmt(T.openingAcc || 0), '', fmt(T.dep || 0), fmt(T.accOnDeletion || 0), fmt(T.closingAcc || 0), fmt(T.closingWDV || 0), fmt(res.rows.reduce((s, r) => s + r.profit, 0))]],
      columnStyles: Object.assign({ 0: { cellWidth: 5 }, 2: { cellWidth: 13 }, 3: { cellWidth: 14 }, 4: { cellWidth: 7, halign: 'right' }, 5: { cellWidth: 17 }, 10: { cellWidth: 8, halign: 'right' } }, Object.fromEntries([6, 7, 8, 9, 11, 12, 13, 14, 15].map(i => [i, { halign: 'right', cellWidth: 18 }]))) }));
    pdfFoot(doc); doc.save(`Depreciation_register_${tag()}.pdf`); return 'Register (PDF) downloaded.';
  },
  notepdf: () => {
    if (!st.assets.length) throw new Error('the register is empty');
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    pdfHead(doc, 'Property, plant and equipment – reconciliation of carrying amounts (Rs.)');
    doc.autoTable(Object.assign({}, AT, { startY: 28, styles: Object.assign({}, AT.styles, { fontSize: 8 }), head: [['Class'].concat(NOTE_COLS.map(c => c[1]))], body: res.groups.map(g => [P(g.group)].concat(NOTE_COLS.map(([k]) => fmt(g[k])))),
      foot: [['Total'].concat(NOTE_COLS.map(([k]) => fmt(res.tot[k] || 0)))], columnStyles: Object.fromEntries(NOTE_COLS.map((c, i) => [i + 1, { halign: 'right' }])) }));
    doc.autoTable(Object.assign({}, AT, { startY: doc.lastAutoTable.finalY + 6, head: [['Disclosure – depreciation methods and useful lives (Note 3) – draft']], body: disclosure().map(l => [P(l)]), styles: Object.assign({}, AT.styles, { fontSize: 8.5 }) }));
    if (res.issues.length) doc.autoTable(Object.assign({}, AT, { startY: doc.lastAutoTable.finalY + 6, head: [['Type', 'Audit check']], body: res.issues.map(([k, t]) => [k === 'err' ? 'Error' : k === 'warn' ? 'Review' : 'Note', P(t)]), columnStyles: { 0: { cellWidth: 18 } },
      didParseCell: d => { if (d.section === 'body' && d.column.index === 0) d.cell.styles.textColor = d.cell.raw === 'Error' ? [163, 32, 32] : d.cell.raw === 'Review' ? [138, 90, 0] : [31, 79, 143]; } }));
    pdfFoot(doc); doc.save(`PPE_note_and_checks_${tag()}.pdf`); return 'PPE note and checks downloaded.';
  },
};
$('#sPdf').onclick = () => { try { msg('#sMsgs', 'ok', OUT.single()); } catch (e) { msg('#sMsgs', 'err', 'Not downloaded: ' + esc(e.message || e)); } };
$$('[data-out]').forEach(b => b.onclick = () => { try { msg('#outMsgs', 'ok', OUT[b.dataset.out]()); } catch (e) { msg('#outMsgs', 'err', 'Not downloaded: ' + esc(e.message || e)); } });

/* ---------- case files ---------- */
$('#saveCase').onclick = () => download(`Depreciation_${tag()}.json`, JSON.stringify(st, null, 1), 'application/json');
$('#openCase').onclick = () => $('#caseFile').click();
$('#caseFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.kind !== 'depn-case') throw 0; st = Object.assign(blank(), d); st.single = Object.assign(blankSingle(), d.single); st.assets = (d.assets || []).map(a => Object.assign(blankAsset(), a)); save(); init(); msg('#topMsgs', 'ok', `Opened ${esc(f.name)}.`); }
  catch (err) { msg('#topMsgs', 'err', 'That file is not a depreciation case file.'); } };
$('#newCase').onclick = async () => { if (await ask('Start a new case?', 'The company details, the asset on tab 1 and the register on screen will be cleared. Save the case file first if you need it.')) { st = blank(); save(); init(); msg('#topMsgs', '', ''); } };
function ask(title, html) { return new Promise(done => { $('#askTitle').textContent = title; $('#askBody').innerHTML = html; const dl = $('#askDlg'); const end = v => { dl.close(); done(v); }; $('#askYes').onclick = () => end(true); $('#askNo').onclick = () => end(false); dl.oncancel = () => done(false); dl.showModal(); }); }

function init() { bindTop(); bindSingle(); showTab(st.tab || 'single'); renderAll(); }
window.DepnTool = { state: () => st, result: () => res };
init();
})();
