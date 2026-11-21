/* GSTR-9 / 9C working – page logic */
(function () {
"use strict";
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = GstParse.MONTHS, LS = 'gst9-current-v1';
const blank = () => ({ kind: 'gst9-case', gstin: '', legal: '', trade: '', fy: '', due1: 11, due3b: 20, months: {} });
let st = blank();
try { const v = JSON.parse(localStorage.getItem(LS) || 'null'); if (v && v.kind === 'gst9-case') st = Object.assign(blank(), v); } catch (e) { /* no draft */ }
const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* draft not kept */ } };

/* ---------- reading PDFs ---------- */
async function readFiles(files) {
  const msgs = [];
  for (const f of files) {
    if (!/\.pdf$/i.test(f.name)) { msgs.push(['err', `${f.name}: not a PDF.`]); continue; }
    try {
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
      const r = GstParse.parse(await GstParse.pdfTokens(pdf));
      if (!r.type) { msgs.push(['err', `${f.name}: ${r.error}.`]); continue; }
      if (!r.month) { msgs.push(['err', `${f.name}: the tax period could not be read.`]); continue; }
      const nm = r.type === '3B' ? 'GSTR-3B' : 'GSTR-1';
      if (st.gstin && r.gstin && r.gstin !== st.gstin) { msgs.push(['err', `${f.name}: GSTIN ${r.gstin} differs from ${st.gstin} – not loaded (clear all to start another GSTIN).`]); continue; }
      if (st.fy && r.fy && r.fy !== st.fy) { msgs.push(['err', `${f.name}: financial year ${r.fy} differs from ${st.fy} – not loaded.`]); continue; }
      if (!st.gstin) Object.assign(st, { gstin: r.gstin, legal: r.legal, trade: r.trade });
      if (!st.fy) st.fy = r.fy;
      const M = st.months[r.month] = st.months[r.month] || {}, k = r.type === '3B' ? 'b3' : 'r1';
      const old = M[k];
      r.file = f.name; M[k] = r;
      msgs.push([r.missing.length ? 'warn' : 'ok', `${f.name}: ${nm} for ${r.month}${r.quarter ? ' (quarterly – ' + esc(r.period) + ')' : ''}, filed ${r.arnDate || '–'}${old ? ' – replaced the one loaded earlier' + (old.arnDate ? ' (filed ' + old.arnDate + ')' : '') : ''}${r.missing.length ? '. Not read: ' + r.missing.join(', ') : ''}.`]);
    } catch (e) { msgs.push(['err', `${f.name}: could not be read (${esc(e.message || e)}).`]); }
  }
  save(); render();
  $('#topMsgs').innerHTML = msgs.map(([k, t]) => `<div class="m-${k}">${esc(t)}</div>`).join('');
}
const drop = $('#drop');
drop.onclick = () => $('#pdfs').click();
drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#pdfs').click(); } };
$('#pdfs').onchange = e => { const f = Array.from(e.target.files); e.target.value = ''; if (f.length) { $('#topMsgs').innerHTML = `<div class="m-info">Reading ${f.length} file(s)…</div>`; readFiles(f); } };
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = Array.from(e.dataTransfer.files || []); if (f.length) readFiles(f); });

/* ---------- display ---------- */
function render() {
  $('#gstin').value = st.gstin; $('#legal').value = st.legal + (st.trade && st.trade !== st.legal ? ` (${st.trade})` : ''); $('#fy').value = st.fy;
  $('#due1').value = st.due1; $('#due3b').value = st.due3b;
  const md = GstBook.monthData(st);
  $('#who').textContent = `${md.filter(o => o.has1).length} GSTR-1 · ${md.filter(o => o.has3b).length} GSTR-3B`;
  const cell = (has, ret, m, k) => has ? `<td>${esc(ret.arnDate || '✓')} <button type="button" class="link sm danger" data-rm="${m}|${k}" title="Remove">✕</button></td>` : '<td class="miss">–</td>';
  const n = (v, show) => show ? `<td class="n">${fmt(v)}</td>` : '<td class="n miss">–</td>';
  const d = (v, show) => show ? `<td class="n ${Math.abs(v) > 1 ? 'bad' : 'ok-t'}">${fmt(v)}</td>` : '<td class="n miss">–</td>';
  let T = {}; const add = (k, v) => T[k] = (T[k] || 0) + v;
  const rows = md.map(o => {
    const s3 = o.b_sales + o.b_zero, t3 = o.b_igst + o.b_cgst + o.b_sgst, s1 = o.s_txval - o.cn_txval, t1 = o.s_igst + o.s_cgst + o.s_sgst - o.cn_igst - o.cn_cgst - o.cn_sgst;
    const itc = o.itc_net_igst + o.itc_net_cgst + o.itc_net_sgst;
    if (o.has3b) { add('s3', s3); add('t3', t3); add('itc', itc); add('cash', o.cash); } if (o.has1) { add('s1', s1); add('t1', t1); } if (o.has1 && o.has3b) { add('dv', s3 - s1); add('dt', t3 - t1); }
    return `<tr><td>${o.month}</td>${cell(o.has1, o.r1, o.month, 'r1')}${cell(o.has3b, o.b3, o.month, 'b3')}${n(s3, o.has3b)}${n(t3, o.has3b)}${n(s1, o.has1)}${n(t1, o.has1)}${d(s3 - s1, o.has1 && o.has3b)}${d(t3 - t1, o.has1 && o.has3b)}${n(itc, o.has3b)}${n(o.cash, o.has3b)}</tr>`;
  }).join('');
  $('#grid').innerHTML = `<thead><tr><th>Month</th><th>GSTR-1 filed</th><th>GSTR-3B filed</th><th class="n">3B sales</th><th class="n">3B output tax</th><th class="n">GSTR-1 net sales</th><th class="n">GSTR-1 net tax</th><th class="n">Diff. sales</th><th class="n">Diff. tax</th><th class="n">3B net ITC (4C)</th><th class="n">Tax paid in cash</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td>Total</td><td></td><td></td><td class="n">${fmt(T.s3)}</td><td class="n">${fmt(T.t3)}</td><td class="n">${fmt(T.s1)}</td><td class="n">${fmt(T.t1)}</td><td class="n">${fmt(T.dv)}</td><td class="n">${fmt(T.dt)}</td><td class="n">${fmt(T.itc)}</td><td class="n">${fmt(T.cash)}</td></tr></tfoot>`;
  $$('[data-rm]').forEach(b => b.onclick = () => { const [m, k] = b.dataset.rm.split('|'); delete st.months[m][k]; if (!Object.keys(st.months[m]).length) delete st.months[m]; if (!Object.keys(st.months).length) { const keep = { due1: st.due1, due3b: st.due3b }; st = Object.assign(blank(), keep); } save(); render(); });
  const any = Object.keys(st.months).length;
  const order = { err: 0, warn: 1, info: 2, ok: 3 };
  $('#issues').innerHTML = any ? GstBook.checks(st).sort((a, b) => order[a[0]] - order[b[0]]).map(([k, t]) => `<div class="m-${k}">${esc(t)}</div>`).join('') : '<div class="m-info">Load the returns to see the checks.</div>';
  $('#dlXlsx').disabled = !any;
}
['due1', 'due3b'].forEach(k => $('#' + k).onchange = e => { const v = parseInt(e.target.value, 10); st[k] = v >= 1 && v <= 31 ? v : (k === 'due1' ? 11 : 20); save(); render(); });

/* ---------- download ---------- */
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
const tag = () => `${(st.trade || st.legal || 'GSTIN').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}_${st.gstin}_FY${st.fy}`;
$('#dlXlsx').onclick = async () => {
  try { const wb = GstBook.build(ExcelJS, st); const buf = await wb.xlsx.writeBuffer();
    download(`GSTR9_working_${tag()}.xlsx`, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    $('#outMsgs').innerHTML = '<div class="m-ok">Workbook downloaded. Fill the yellow cells from the books and the portal.</div>'; }
  catch (e) { $('#outMsgs').innerHTML = `<div class="m-err">Not downloaded: ${esc(e.message || e)}</div>`; }
};

/* ---------- case files ---------- */
$('#saveCase').onclick = () => download(`GSTR9_${tag()}.json`, JSON.stringify(st), 'application/json');
$('#openCase').onclick = () => $('#caseFile').click();
$('#caseFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.kind !== 'gst9-case') throw 0; st = Object.assign(blank(), d); save(); render(); $('#topMsgs').innerHTML = `<div class="m-ok">Opened ${esc(f.name)}.</div>`; }
  catch (err) { $('#topMsgs').innerHTML = '<div class="m-err">That file is not a GSTR-9 working case file.</div>'; } };
$('#clearAll').onclick = async () => { if (await ask('Clear all?', 'All the returns loaded will be removed from this screen. Save the case file first if you need it.')) { st = blank(); save(); render(); $('#topMsgs').innerHTML = ''; } };
function ask(title, html) { return new Promise(done => { $('#askTitle').textContent = title; $('#askBody').innerHTML = html; const dl = $('#askDlg'); const end = v => { dl.close(); done(v); }; $('#askYes').onclick = () => end(true); $('#askNo').onclick = () => end(false); dl.oncancel = () => done(false); dl.showModal(); }); }

window.Gst9Tool = { state: () => st };
render();
})();
