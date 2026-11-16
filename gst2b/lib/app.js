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
if (st.data && !st.parts) st.parts = [{ file: st.file || 'GSTR-2B', data: st.data }];
if (st.parts && st.parts.length) { try { st.data = G2B.merge(st.parts); } catch (e) { st.data = null; } }
let draftNote = '';
let rules = Object.assign({}, G2B.DEFAULT_RULES, get(LS.rules, {}));
let rows = [], filter = 'all';
const PAGE = 200; let pageN = PAGE;
/* the draft keeps the files read and the marks; a very large GSTR-2B may not fit in the browser's storage –
   then only the marks and settings are kept (they are applied again when the same files are loaded) */
const save = () => {
  const full = Object.assign({}, st, { data: null });
  try { localStorage.setItem(LS.cur, JSON.stringify(full)); draftNote = ''; return; } catch (e) { /* too large */ }
  try { localStorage.setItem(LS.cur, JSON.stringify(Object.assign({}, full, { parts: null }))); } catch (e) { /* not kept */ }
  draftNote = 'This GSTR-2B is too large to keep in the browser as a draft. Your marks and reasons are kept and will be applied again when you load the same files – or use "Save case file" to keep everything.';
};
const supKey = () => LS.sup + ((st.data && st.data.info.gstin) || 'none');

/* ---------- load (one GSTR-2B may come in several parts) ---------- */
const kk = i => `${i.gstin}|${i.period}|${i.fy}`;
async function loadFiles(files) {
  const msgs = [], fresh = [];
  for (const f of files) {
    if (!/\.xlsx$/i.test(f.name)) { msgs.push(['err', `${f.name}: choose the GSTR-2B Excel (.xlsx) downloaded from the portal.`]); continue; }
    try { const data = G2B.read(LLPXlsx.readWorkbook(new Uint8Array(await f.arrayBuffer())), f.name);
      if (!data.records.length && !data.summary.length) throw new Error('no invoices or notes were found in the file');
      fresh.push({ file: f.name, data }); }
    catch (e) { msgs.push(['err', `${f.name}: ${e.message || e}`]); }
  }
  if (fresh.length) {
    const cur = st.parts || [], k0 = fresh.find(p => p.data.info.gstin);
    const same = cur.length && st.data && (!k0 || kk(k0.data.info) === kk(st.data.info));
    const marksOnly = !st.data && st.lastKey && k0 && kk(k0.data.info) === st.lastKey;
    let parts;
    if (same) parts = cur.filter(p => !fresh.some(q => q.file === p.file)).concat(fresh);
    else {
      if (!marksOnly && st.data && Object.keys(st.overrides).length && !(await ask('Replace the GSTR-2B on screen?', `The lines marked for ${esc(st.data.info.period)} ${esc(st.data.info.fy)} will be cleared. Save the case file first if you need it. Suppliers you asked to remember are kept.`))) { show(msgs); return; }
      parts = fresh;
    }
    try {
      const data = G2B.merge(parts);
      if (same) { st.parts = parts; st.data = data; st.file = parts.map(p => p.file).join(', '); }
      else if (marksOnly) { st.parts = parts; st.data = data; st.file = parts.map(p => p.file).join(', '); msgs.push(['info', 'Your earlier marks for this month have been applied again.']); }
      else { st = Object.assign(blank(), { parts, file: parts.map(p => p.file).join(', '), data, settings: { home: G2B.stateOf(data.info.gstin), claimReverse: true } }); st.supplierRules = get(LS.sup + data.info.gstin, {}); }
      st.lastKey = kk(data.info);
      save(); render();
      if (draftNote) msgs.push(['info', draftNote]);
      msgs.push(['ok', `GSTR-2B of ${data.info.legal || data.info.gstin} for ${data.info.period} ${data.info.fy}: ${data.records.length} records from ${parts.length} file(s) – ${data.files.map(x => `${x.file} (${x.n})`).join(', ')}.`]);
      data.notes.forEach(n => msgs.push(n));
      const gap = shortfall(); if (gap) msgs.push(['warn', gap]);
    } catch (e) { msgs.push(['err', e.message || String(e)]); }
  }
  show(msgs);
}
function show(msgs) { $('#topMsgs').innerHTML = msgs.map(([k, t]) => `<div class="m-${k}">${esc(t)}</div>`).join(''); }
/* records read vs the GSTR-2B summary (ITC available, other than reverse charge) – flags a part not loaded */
function shortfall() {
  if (!st.data || !st.data.summary.length) return '';
  const sf = G2BBook.summaryFig({ info: st.data.info, rows: [], summary: st.data.summary, settings: st.settings });
  const want = HEADS.reduce((s, h) => s + (sf.a5[h] || 0), 0);
  const got = st.data.records.filter(r => ['inv', 'note'].includes(r.kind) && !r.amend && !/^y/i.test(r.rcm) && !/^no$/i.test(r.avail)).reduce((s, r) => s + HEADS.reduce((t, h) => t + r[h], 0), 0);
  return Math.abs(want - got) > 1 ? `ITC (other than reverse charge and amendments) in the records read is ${fmt(got)} against ${fmt(want)} in the GSTR-2B summary – difference ${fmt(want - got)}. If the portal gave this GSTR-2B in more than one file, load the remaining part(s) too (they are added to this month). A difference can also come from amendments.` : '';
}
const drop = $('#drop');
drop.onclick = () => $('#xfile').click();
drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#xfile').click(); } };
$('#xfile').onchange = e => { const f = Array.from(e.target.files); e.target.value = ''; if (f.length) loadFiles(f); };
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = Array.from(e.dataTransfer.files || []); if (f.length) loadFiles(f); });

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
  const P = st.parts || [];
  $('#parts').innerHTML = P.length ? 'Files: ' + P.map((p, k) => `${esc(p.file)} (${p.data.records.length} records)${P.length > 1 ? ` <button type="button" class="link sm danger" data-part="${k}">remove</button>` : ''}`).join(' · ') : '';
  $$('[data-part]').forEach(b => b.onclick = () => { st.parts.splice(+b.dataset.part, 1); st.data = G2B.merge(st.parts); st.file = st.parts.map(p => p.file).join(', '); save(); refresh(); });
  const gap = shortfall(); $('#gapMsg').innerHTML = gap ? `<div class="m-warn">${esc(gap)}</div>` : '';
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
  $('#tb3note').textContent = 'Amendments are counted here at their revised value; in the Excel only the difference over the ITC claimed on the original is taken (enter it in the yellow cells).' + (st.data.summary.length ? '' : ' The files loaded have no summary sheets ("ITC Available" etc.), so the comparison with the GSTR-2B summary is not shown – compare the totals with the summary on the portal.');
}
function renderChips() {
  const T = G2BBook.totals(rows);
  const list = [['all', `All (${rows.length})`], ['inel', 'All ineligible / blocked']].concat(CATS.filter(c => T[c[0]]).map(c => [c[0], `${c[1]} (${T[c[0]].n})`])).concat(rows.some(r => r.amend) ? [['amend', 'Amendments']] : []).concat(rows.some(r => r.flags.length) ? [['flag', 'Points to check']] : []);
  if (!list.some(x => x[0] === filter)) filter = 'all';
  $('#chips').innerHTML = list.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${esc(l)}</button>`).join('');
  $$('#chips [data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; pageN = PAGE; renderChips(); renderRows(); });
}
function renderRows() {
  const q = ($('#q').value || '').toLowerCase();
  const all = rows.filter(r => (filter === 'all' || r.cat === filter || (filter === 'inel' && ['blocked', 'insmot', 'pos', 'notavl', 'inelig'].includes(r.cat)) || (filter === 'amend' && r.amend) || (filter === 'flag' && r.flags.length))
    && (!q || `${r.name} ${r.gstin} ${r.docno}`.toLowerCase().includes(q)));
  const opts = sel => CATS.map(c => `<option value="${c[0]}"${c[0] === sel ? ' selected' : ''}>${esc(c[1])}</option>`).join('');
  const show = all.slice(0, pageN);
  $('#recs').innerHTML = `<thead><tr><th>#</th><th>Section</th><th>Supplier</th><th>Number / date</th><th>Place of supply</th><th>RCM</th><th class="n">Taxable</th><th class="n">IGST</th><th class="n">CGST</th><th class="n">SGST</th><th class="n">Cess</th><th>Category</th><th>Reason for ineligible / remarks</th><th></th></tr></thead><tbody>${show.map(r => {
    const i = rows.indexOf(r), cls = [r.cat !== r.auto.cat ? 'changed' : '', r.flags.length ? 'flag' : ''].join(' ');
    return `<tr class="${cls}" title="${esc(r.flags.join('\n'))}"><td>${i + 1}</td><td class="small">${esc(r.sheet)}${r.amend ? `<br>orig. ${esc(r.orig.no)}` : ''}</td><td class="wrap">${esc(r.name)}<br><span class="small">${esc(r.gstin)}</span></td>
      <td>${esc(r.docno)}<br><span class="small">${esc(r.date)} ${r.sign < 0 ? '· credit note' : /debit/i.test(r.doctype) ? '· debit note' : ''}</span></td><td>${esc(r.pos)}</td><td>${esc(r.rcm)}</td>
      ${['txval', ...HEADS].map(h => `<td class="n">${fmt(r[h])}</td>`).join('')}
      <td><select class="cat" data-i="${i}">${opts(r.cat)}</select>${r.src !== 'auto' ? `<div class="small">${r.src === 'user' ? 'marked' : 'supplier rule'} · auto: ${esc(CAT[r.auto.cat][1])}</div>` : ''}</td>
      <td><input class="rsn" data-i="${i}" value="${esc(r.reason)}" placeholder="${['elig', 'rcm', 'imp', 'isd'].includes(r.cat) ? 'optional remarks' : 'reason for ineligible'}"></td>
      <td style="white-space:nowrap">${r.gstin ? `<button type="button" class="link sm" data-all="${i}" title="Apply this category and reason to every line of this supplier">All of supplier</button><br><button type="button" class="link sm" data-rem="${i}" title="Use this category for this supplier in future months">${st.supplierRules[r.gstin] ? 'Remembered ✓' : 'Remember'}</button>` : ''}${r.src === 'user' ? `<br><button type="button" class="link sm" data-undo="${i}">Undo</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="14" class="hint">Nothing to show.</td></tr>'}</tbody>${all.length > show.length ? `<tfoot><tr><td colspan="14">Showing ${show.length} of ${all.length} lines – <button type="button" class="link" id="more">show ${Math.min(PAGE, all.length - show.length)} more</button> · <button type="button" class="link" id="moreAll">show all</button> (use the category buttons or search to narrow down)</td></tr></tfoot>` : ''}`;
  if ($('#more')) { $('#more').onclick = () => { pageN += PAGE; renderRows(); }; $('#moreAll').onclick = () => { pageN = all.length; renderRows(); }; }
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
$('#q').oninput = () => { pageN = PAGE; renderRows(); };
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
$('#saveCase').onclick = () => { if (!st.data) return; download(`GSTR2B_${tag()}.json`, JSON.stringify(Object.assign({}, st, { rules, data: null })), 'application/json'); };
$('#openCase').onclick = () => $('#caseFile').click();
$('#caseFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.kind !== 'gst2b-case' || !(d.data || (d.parts && d.parts.length))) throw 0; st = Object.assign(blank(), d); delete st.rules; if (!st.parts) st.parts = [{ file: st.file || f.name, data: st.data }]; st.data = G2B.merge(st.parts); save(); refresh(); $('#topMsgs').innerHTML = `<div class="m-ok">Opened ${esc(f.name)}.</div>`; }
  catch (err) { $('#topMsgs').innerHTML = '<div class="m-err">That file is not a GSTR-2B analyser case file.</div>'; } };
$('#newCase').onclick = async () => { if (await ask('Clear?', 'The GSTR-2B and the lines marked will be cleared from this screen (remembered suppliers and rules are kept).')) { st = blank(); save(); refresh(); $('#topMsgs').innerHTML = ''; } };
function ask(title, html) { return new Promise(done => { $('#askTitle').textContent = title; $('#askBody').innerHTML = html; const dl = $('#askDlg'); const end = v => { dl.close(); done(v); }; $('#askYes').onclick = () => end(true); $('#askNo').onclick = () => end(false); dl.oncancel = () => done(false); dl.showModal(); }); }

window.G2BTool = { state: () => st, rows: () => rows };
render();
})();
