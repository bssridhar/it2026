/* GSTR-2B Analyser – page logic */
(function () {
"use strict";
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CATS = G2B.CATS, CAT = G2B.CAT, HEADS = ['igst', 'cgst', 'sgst', 'cess'];
const LS = { cur: 'gst2b-current-v1', rules: 'gst2b-rules-v1', sup: 'gst2b-suppliers-' };
const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* not kept */ } };
const blank = () => ({ kind: 'gst2b-case', file: '', data: null, settings: { home: '', claimReverse: true }, overrides: {}, supplierRules: {} });
let st = Object.assign(blank(), get(LS.cur, {}));
let rules = Object.assign({}, G2B.DEFAULT_RULES, get(LS.rules, {}));
let rows = [], filter = 'all';
const save = () => set(LS.cur, st);
const supKey = () => LS.sup + ((st.data && st.data.info.gstin) || 'none');

/* ---------- load ---------- */
async function loadFile(f) {
  if (!/\.xlsx$/i.test(f.name)) { $('#topMsgs').innerHTML = '<div class="m-err">Choose the GSTR-2B Excel (.xlsx) downloaded from the portal.</div>'; return; }
  try {
    const data = G2B.read(LLPXlsx.readWorkbook(new Uint8Array(await f.arrayBuffer())));
    if (!data.records.length) throw new Error('no invoices or notes were found in the file');
    if (st.data && Object.keys(st.overrides).length && !(await ask('Replace the GSTR-2B on screen?', `The lines marked for ${esc(st.data.info.period)} ${esc(st.data.info.fy)} will be cleared. Save the case file first if you need it. Suppliers you asked to remember are kept.`))) return;
    st = Object.assign(blank(), { file: f.name, data, settings: { home: G2B.stateOf(data.info.gstin), claimReverse: true } });
    st.supplierRules = get(LS.sup + data.info.gstin, {});
    save(); render();
    const kinds = {}; data.records.forEach(r => kinds[r.sheet] = (kinds[r.sheet] || 0) + 1);
    $('#topMsgs').innerHTML = `<div class="m-ok">${esc(f.name)}: GSTR-2B of ${esc(data.info.legal || '')} for ${esc(data.info.period)} ${esc(data.info.fy)} – ${data.records.length} records (${Object.entries(kinds).map(([k, n]) => `${esc(k)} ${n}`).join(', ')}).</div>`;
  } catch (e) { $('#topMsgs').innerHTML = `<div class="m-err">${esc(f.name)}: ${esc(e.message || e)}</div>`; }
}
const drop = $('#drop');
drop.onclick = () => $('#xfile').click();
drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#xfile').click(); } };
$('#xfile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadFile(f); };
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = (e.dataTransfer.files || [])[0]; if (f) loadFile(f); });

/* ---------- render ---------- */
const ctx = () => ({ info: st.data.info, rows, summary: st.data.summary, settings: st.settings });
function classify() { rows = st.data ? G2B.classify(st.data, { home: st.settings.home, rules }, st.overrides, st.supplierRules) : []; }
function render() {
  const has = !!st.data;
  ['infoCard', 'sumCard', 'recCard', 'chkCard', 'outCard'].forEach(id => $('#' + id).hidden = !has);
  $('#r_insmot').value = rules.insmot; $('#r_blocked').value = rules.blocked;
  renderSupRules();
  if (!has) return;
  classify();
  const I = st.data.info;
  $('#gstin').value = I.gstin || ''; $('#legal').value = I.legal || ''; $('#period').value = `${I.period || ''} ${I.fy || ''}`;
  $('#home').innerHTML = Object.values(G2B.STATES).map(s => `<option${s === st.settings.home ? ' selected' : ''}>${esc(s)}</option>`).join('');
  $('#claimReverse').checked = !!st.settings.claimReverse;
  $('#who').textContent = `${rows.length} records · generated ${I.generated || ''}`;
  renderSummary(); renderChips(); renderRows(); renderChecks();
}
function renderSummary() {
  const T = G2BBook.totals(rows);
  $('#catSum').innerHTML = `<thead><tr><th>Category</th><th class="n">Lines</th><th class="n">Taxable</th><th class="n">Tax</th><th>GSTR-3B</th></tr></thead><tbody>${CATS.filter(c => T[c[0]]).map(c => { const t = T[c[0]];
    return `<tr><td>${esc(c[1])}</td><td class="n">${t.n}</td><td class="n">${fmt(t.txval)}</td><td class="n">${fmt(t.igst + t.cgst + t.sgst + t.cess)}</td><td class="small">${esc(c[2])}</td></tr>`; }).join('')}</tbody>`;
  const b = G2BBook.threeB(ctx()), sf = G2BBook.summaryFig(ctx());
  const line = (l, o, cmp, bold) => `<tr${bold ? ' style="font-weight:700"' : ''}><td>${l}</td>${HEADS.map(h => `<td class="n">${fmt(o[h])}</td>`).join('')}<td class="n small">${cmp ? fmt(HEADS.reduce((s, h) => s + (cmp[h] || 0), 0)) : ''}</td></tr>`;
  $('#tb3').innerHTML = `<thead><tr><th>Table</th><th class="n">IGST</th><th class="n">CGST</th><th class="n">SGST</th><th class="n">Cess</th><th class="n">2B summary (total tax)</th></tr></thead><tbody>
    ${line('3.1(d) RCM liability (taxable ' + fmt(b.d31.txval) + ')', b.d31)}${line('4A(1) Import of goods', b.a1, sf.has && sf.a1)}${line('4A(3) Reverse charge', b.a3, sf.has && sf.a3)}${line('4A(4) ISD', b.a4, sf.has && sf.a4)}${line('4A(5) All other ITC', b.a5, sf.has && sf.a5)}
    ${line('4B(1) Reversed – 17(5) etc.', b.b1)}${line('4B(2) Reversed – others', b.b2, sf.has && sf.b2)}${line('4C Net ITC', b.c, null, true)}${line('4D(2) Ineligible – POS / 16(4)', b.d2, sf.has && sf.d2)}${line('Not claimed this month', b.notClaimed)}</tbody>`;
  $('#tb3note').textContent = 'Amendments are counted here at their revised value; in the Excel only the difference over the ITC claimed on the original is taken (enter it in the yellow cells).';
}
function renderChips() {
  const T = G2BBook.totals(rows);
  const list = [['all', `All (${rows.length})`], ['inel', 'All ineligible / blocked']].concat(CATS.filter(c => T[c[0]]).map(c => [c[0], `${c[1]} (${T[c[0]].n})`])).concat(rows.some(r => r.amend) ? [['amend', 'Amendments']] : []).concat(rows.some(r => r.flags.length) ? [['flag', 'Points to check']] : []);
  if (!list.some(x => x[0] === filter)) filter = 'all';
  $('#chips').innerHTML = list.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${esc(l)}</button>`).join('');
  $$('#chips [data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; renderChips(); renderRows(); });
}
function renderRows() {
  const q = ($('#q').value || '').toLowerCase();
  const show = rows.filter(r => (filter === 'all' || r.cat === filter || (filter === 'inel' && ['blocked', 'insmot', 'pos', 'notavl', 'inelig'].includes(r.cat)) || (filter === 'amend' && r.amend) || (filter === 'flag' && r.flags.length))
    && (!q || `${r.name} ${r.gstin} ${r.docno}`.toLowerCase().includes(q)));
  const opts = sel => CATS.map(c => `<option value="${c[0]}"${c[0] === sel ? ' selected' : ''}>${esc(c[1])}</option>`).join('');
  $('#recs').innerHTML = `<thead><tr><th>#</th><th>Section</th><th>Supplier</th><th>Number / date</th><th>Place of supply</th><th>RCM</th><th class="n">Taxable</th><th class="n">IGST</th><th class="n">CGST</th><th class="n">SGST</th><th class="n">Cess</th><th>Category</th><th>Reason for ineligible / remarks</th><th></th></tr></thead><tbody>${show.map(r => {
    const i = rows.indexOf(r), cls = [r.cat !== r.auto.cat ? 'changed' : '', r.flags.length ? 'flag' : ''].join(' ');
    return `<tr class="${cls}" title="${esc(r.flags.join('\n'))}"><td>${i + 1}</td><td class="small">${esc(r.sheet)}${r.amend ? `<br>orig. ${esc(r.orig.no)}` : ''}</td><td class="wrap">${esc(r.name)}<br><span class="small">${esc(r.gstin)}</span></td>
      <td>${esc(r.docno)}<br><span class="small">${esc(r.date)} ${r.sign < 0 ? '· credit note' : /debit/i.test(r.doctype) ? '· debit note' : ''}</span></td><td>${esc(r.pos)}</td><td>${esc(r.rcm)}</td>
      ${['txval', ...HEADS].map(h => `<td class="n">${fmt(r[h])}</td>`).join('')}
      <td><select class="cat" data-i="${i}">${opts(r.cat)}</select>${r.src !== 'auto' ? `<div class="small">${r.src === 'user' ? 'marked' : 'supplier rule'} · auto: ${esc(CAT[r.auto.cat][1])}</div>` : ''}</td>
      <td><input class="rsn" data-i="${i}" value="${esc(r.reason)}" placeholder="${['elig', 'rcm', 'imp', 'isd'].includes(r.cat) ? 'optional remarks' : 'reason for ineligible'}"></td>
      <td style="white-space:nowrap">${r.gstin ? `<button type="button" class="link sm" data-all="${i}" title="Apply this category and reason to every line of this supplier">All of supplier</button><br><button type="button" class="link sm" data-rem="${i}" title="Use this category for this supplier in future months">${st.supplierRules[r.gstin] ? 'Remembered ✓' : 'Remember'}</button>` : ''}${r.src === 'user' ? `<br><button type="button" class="link sm" data-undo="${i}">Undo</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="14" class="hint">Nothing to show.</td></tr>'}</tbody>`;
  $$('#recs select.cat').forEach(el => el.onchange = () => { const r = rows[+el.dataset.i]; const o = st.overrides[r.id] = st.overrides[r.id] || {}; o.cat = el.value;
    if (o.reason === undefined || o.reason === r.auto.reason) o.reason = el.value === r.auto.cat ? r.auto.reason : (['elig', 'rcm', 'imp', 'isd', 'hold'].includes(el.value) ? '' : (o.reason || ''));
    if (el.value === r.auto.cat && (o.reason === r.auto.reason)) delete st.overrides[r.id]; save(); refresh(); });
  $$('#recs input.rsn').forEach(el => el.onchange = () => { const r = rows[+el.dataset.i]; const o = st.overrides[r.id] = st.overrides[r.id] || {}; o.reason = el.value.trim(); if (!o.cat) o.cat = r.cat; save(); refresh(); });
  $$('#recs [data-all]').forEach(b => b.onclick = () => { const r = rows[+b.dataset.all]; let n = 0; rows.forEach(x => { if (x.gstin === r.gstin && x !== r && !['rejected', 'rev37a', 'imp', 'isd'].includes(x.cat)) { st.overrides[x.id] = { cat: r.cat, reason: r.reason }; n++; } });
    save(); refresh(); $('#topMsgs').innerHTML = `<div class="m-ok">${n} other line(s) of ${esc(r.name)} set to "${esc(CAT[r.cat][1])}".</div>`; });
  $$('#recs [data-rem]').forEach(b => b.onclick = () => { const r = rows[+b.dataset.rem];
    if (st.supplierRules[r.gstin]) delete st.supplierRules[r.gstin]; else st.supplierRules[r.gstin] = { cat: r.cat, reason: r.reason, name: r.name };
    set(supKey(), st.supplierRules); save(); refresh(); });
  $$('#recs [data-undo]').forEach(b => b.onclick = () => { delete st.overrides[rows[+b.dataset.undo].id]; save(); refresh(); });
}
function renderChecks() {
  const order = { err: 0, warn: 1, info: 2, ok: 3 };
  $('#issues').innerHTML = G2BBook.checks(ctx()).sort((a, b) => order[a[0]] - order[b[0]]).map(([k, t]) => `<div class="m-${k}">${esc(t)}</div>`).join('');
}
function renderSupRules() {
  const e = Object.entries(st.supplierRules || {});
  $('#supRules').innerHTML = e.length ? `<table class="t"><thead><tr><th>GSTIN</th><th>Name</th><th>Category</th><th>Reason</th><th></th></tr></thead><tbody>${e.map(([g, x]) => `<tr><td>${esc(g)}</td><td>${esc(x.name)}</td><td>${esc((CAT[x.cat] || [])[1])}</td><td>${esc(x.reason)}</td><td><button type="button" class="link sm danger" data-forget="${esc(g)}">Forget</button></td></tr>`).join('')}</tbody></table>` : 'None.';
  $$('[data-forget]').forEach(b => b.onclick = () => { delete st.supplierRules[b.dataset.forget]; set(supKey(), st.supplierRules); save(); refresh(); });
}
function refresh() { const y = window.scrollY; render(); window.scrollTo(0, y); }
$('#q').oninput = renderRows;
$('#home').onchange = e => { st.settings.home = e.target.value; save(); refresh(); };
$('#claimReverse').onchange = e => { st.settings.claimReverse = e.target.checked; save(); refresh(); };
$('#toggleRules').onclick = () => { const b = $('#rulesBox'); b.hidden = !b.hidden; $('#toggleRules').textContent = b.hidden ? 'Show' : 'Hide'; };
$('#saveRules').onclick = () => { rules = { insmot: $('#r_insmot').value, blocked: $('#r_blocked').value }; set(LS.rules, rules); refresh(); $('#topMsgs').innerHTML = '<div class="m-ok">Rules saved; lines re-sorted (lines you marked are kept).</div>'; };
$('#resetRules').onclick = () => { $('#r_insmot').value = G2B.DEFAULT_RULES.insmot; $('#r_blocked').value = G2B.DEFAULT_RULES.blocked; };

/* ---------- download, case files ---------- */
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const tag = () => { const I = st.data.info; return `${(I.trade || I.legal || 'GSTIN').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}_${I.period}_${I.fy}`; };
$('#dlXlsx').onclick = async () => {
  try { const wb = G2BBook.build(ExcelJS, ctx()); const buf = await wb.xlsx.writeBuffer(); download(`GSTR2B_working_${tag()}.xlsx`, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    $('#outMsgs').innerHTML = '<div class="m-ok">Workbook downloaded.' + (rows.some(r => r.amend) ? ' Enter the ITC claimed on the original documents in the yellow cells of the Amendments block.' : '') + '</div>'; }
  catch (e) { $('#outMsgs').innerHTML = `<div class="m-err">Not downloaded: ${esc(e.message || e)}</div>`; }
};
$('#saveCase').onclick = () => { if (!st.data) return; download(`GSTR2B_${tag()}.json`, JSON.stringify(Object.assign({}, st, { rules })), 'application/json'); };
$('#openCase').onclick = () => $('#caseFile').click();
$('#caseFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.kind !== 'gst2b-case' || !d.data) throw 0; st = Object.assign(blank(), d); delete st.rules; save(); refresh(); $('#topMsgs').innerHTML = `<div class="m-ok">Opened ${esc(f.name)}.</div>`; }
  catch (err) { $('#topMsgs').innerHTML = '<div class="m-err">That file is not a GSTR-2B analyser case file.</div>'; } };
$('#newCase').onclick = async () => { if (await ask('Clear?', 'The GSTR-2B and the lines marked will be cleared from this screen (remembered suppliers and rules are kept).')) { st = blank(); save(); refresh(); $('#topMsgs').innerHTML = ''; } };
function ask(title, html) { return new Promise(done => { $('#askTitle').textContent = title; $('#askBody').innerHTML = html; const dl = $('#askDlg'); const end = v => { dl.close(); done(v); }; $('#askYes').onclick = () => end(true); $('#askNo').onclick = () => end(false); dl.oncancel = () => done(false); dl.showModal(); }); }

window.G2BTool = { state: () => st, rows: () => rows };
render();
})();
