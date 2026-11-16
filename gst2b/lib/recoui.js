/* GSTR-2B vs purchase register – page section (uses window.G2BTool from app.js) */
(function () {
"use strict";
const T = window.G2BTool, $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = iso => iso ? iso.split('-').reverse().join('/') : '';
const R = G2BReco, Bk = G2BBooks, ST = Object.fromEntries(R.STATUS.map(s => [s[0], s]));
let res = null, chip = 'all', pageN = 200, optsOpen = false, mapOpen = null;
const later = () => setTimeout(render, 0);  // re-draw after the change / blur of the field has finished
const st = () => T.state();

/* ---------- loading the register ---------- */
$('#bkLoad').onclick = () => $('#bkFile').click();
$('#bkTpl').onclick = async () => { const wb = Bk.template(ExcelJS); const buf = await wb.xlsx.writeBuffer(); T.download('Purchase_register_template.xlsx', buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); };
$('#bkFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const S = st(); const msg = (k, t) => $('#bkMsgs').innerHTML = `<div class="m-${k}">${esc(t)}</div>`;
  try {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (/\.xls$/i.test(f.name)) throw new Error('old Excel (.xls) files cannot be read here – open the file in Excel and save it as .xlsx (Excel Workbook), then load it');
    if (/\.xml$/i.test(f.name) || /^\s*<|^﻿?\s*</.test(Bk.decode(bytes.slice(0, 400)).replace(/^﻿/, ''))) {
      const x = Bk.readTallyXml(bytes);
      const on = {}; Object.keys(x.types).forEach(t => on[t] = /purchase|debit\s*note/i.test(t));
      S.books = { file: f.name, kind: 'xml', raw: x.rows, types: x.types, typeOn: on, from: '', to: '' };
      msg('ok', `${f.name}: ${x.rows.length} voucher(s) read from the Tally XML. Voucher types: ${Object.entries(x.types).map(([t, n]) => `${t} ${n}`).join(', ')}. Choose the types to include below.`);
    } else {
      const isCsv = /\.csv$/i.test(f.name) || /\.txt$/i.test(f.name);
      const tables = Bk.readTable(isCsv ? new TextDecoder('utf-8').decode(bytes) : bytes, f.name);
      const t = tables[0], map = Bk.guessMap(t.headers);
      S.books = { file: f.name, kind: 'table', tables: tables.map(x => ({ sheet: x.sheet, headers: x.headers, data: x.data, headerRow: x.headerRow })), sheet: t.sheet, map, raw: Bk.applyMap(t, map), from: '', to: '' };
      const miss = ['invno', 'gstin', 'txval'].filter(k => !map[k]).map(k => Bk.FIELDS.find(f => f[0] === k)[1]);
      msg(miss.length ? 'warn' : 'ok', `${f.name}: sheet "${t.sheet}", heading row ${t.headerRow}, ${S.books.raw.length} row(s) read.${miss.length ? ' Not recognised: ' + miss.join(', ') + ' – choose the columns below.' : ' Check the columns recognised below.'}`);
    }
    S.recoMan = S.recoMan || { links: [], rejects: [] };
    T.save(); render();
  } catch (err) { msg('err', `${f.name}: ${err.message || err}`); }
};
$('#bkClear').onclick = async () => { if (await T.ask('Remove the purchase register?', 'The reconciliation and the pairs you made will be cleared.')) { const S = st(); delete S.books; S.recoMan = { links: [], rejects: [] }; T.save(); T.refresh(); } };

/* ---------- column mapping / voucher types / period ---------- */
function renderMap() {
  const S = st(), b = S.books;
  if (!b) { $('#bkMap').innerHTML = ''; return; }
  let h = '';
  if (b.kind === 'table') {
    const t = b.tables.find(x => x.sheet === b.sheet) || b.tables[0];
    const opt = (sel) => `<option value="">– not in the file –</option>` + t.headers.map(x => `<option value="${x.col}"${x.col === sel ? ' selected' : ''}>${esc(x.col)}: ${esc(x.text.slice(0, 50))}</option>`).join('');
    h += `<details id="mapDet"${(mapOpen === null ? Object.keys(b.map).length < 5 : mapOpen) ? ' open' : ''}><summary><b>Columns of the register</b> <span class="hint">(${b.raw.length} rows read from "${esc(b.sheet)}" – open to change)</span></summary><div class="grid" style="margin-top:8px">`;
    if (b.tables.length > 1) h += `<div><label>Sheet</label><select id="bkSheet">${b.tables.map(x => `<option${x.sheet === b.sheet ? ' selected' : ''}>${esc(x.sheet)}</option>`).join('')}</select></div>`;
    Bk.FIELDS.forEach(([k, label, multi]) => {
      if (multi) h += `<div><label>${esc(label)} <span class="hint">(columns added)</span></label><div class="mcols">${t.headers.map(x => `<label><input type="checkbox" data-mk="${k}" value="${x.col}"${(b.map[k] || []).includes(x.col) ? ' checked' : ''}> ${esc(x.text.slice(0, 40))}</label>`).join('')}</div></div>`;
      else h += `<div><label>${esc(label)}</label><select data-sk="${k}">${opt(b.map[k])}</select></div>`;
    });
    h += `</div><div class="bar" style="margin-top:8px"><button type="button" class="primary sm" id="bkApply">Apply the columns</button></div></details>`;
  } else {
    h += `<div><b>Voucher types to include</b> ${Object.entries(b.types).map(([t, n]) => `<label style="display:inline-flex;gap:6px;margin-right:14px;color:var(--ink)"><input type="checkbox" data-vt="${esc(t)}" style="width:auto"${b.typeOn[t] ? ' checked' : ''}> ${esc(t)} (${n})</label>`).join('')}</div>
      <p class="hint">Debit Note / purchase return vouchers are taken as reductions (supplier's credit note). Taxes are read from ledgers named IGST / CGST / SGST / UTGST / Cess; the taxable value is the rest of the voucher (other than round-off, TDS / TCS).</p>`;
  }
  h += `<div class="bar" style="margin-top:8px"><label style="margin:0">Voucher date from</label><input type="date" id="bkFrom" value="${esc(b.from || '')}" style="width:auto"><label style="margin:0">to</label><input type="date" id="bkTo" value="${esc(b.to || '')}" style="width:auto"><span class="hint">blank = all rows of the register</span></div>`;
  $('#bkMap').innerHTML = h;
  if ($('#bkSheet')) $('#bkSheet').onchange = e => { b.sheet = e.target.value; const t = b.tables.find(x => x.sheet === b.sheet); b.map = Bk.guessMap(t.headers); b.raw = Bk.applyMap(t, b.map); T.save(); render(); };
  if ($('#bkApply')) $('#bkApply').onclick = () => { const map = {}; $$('[data-sk]').forEach(s => { if (s.value) map[s.dataset.sk] = s.value; });
    $$('[data-mk]').forEach(c => { if (c.checked) (map[c.dataset.mk] = map[c.dataset.mk] || []).push(c.value); });
    const t = b.tables.find(x => x.sheet === b.sheet) || b.tables[0]; b.map = map; b.raw = Bk.applyMap(t, map); T.save(); render(); $('#bkMsgs').innerHTML = `<div class="m-ok">${b.raw.length} row(s) read with the columns chosen.</div>`; };
  if ($('#mapDet')) $('#mapDet').ontoggle = e => { mapOpen = e.target.open; };
  $$('[data-vt]').forEach(c => c.onchange = () => { b.typeOn[c.dataset.vt] = c.checked; T.save(); later(); });
  $('#bkFrom').onchange = e => { b.from = e.target.value; T.save(); later(); };
  $('#bkTo').onchange = e => { b.to = e.target.value; T.save(); later(); };
}

/* ---------- options ---------- */
function opts() { return Object.assign({}, R.DEFAULTS, st().recoOpts || {}); }
function renderOpts() {
  const o = opts();
  $('#bkOpts').innerHTML = `<details id="optsDet"${optsOpen ? ' open' : ''}><summary><b>Matching options</b> <span class="hint">amount tolerance Rs.${fmt(o.tolAbs)}${o.tolPct ? ' or ' + o.tolPct + '%' : ''} · date window ${o.dateDays} days · invoice no. ${[o.ignoreFY && 'ignoring year part', o.ignoreZeros && 'leading zeros', o.useDigits && 'digits'].filter(Boolean).join(', ')} · up to ${o.maxEdit} character(s) different</span></summary>
    <div class="grid" style="margin-top:8px">
      <div><label>Amount tolerance (Rs.) – taxable value and each tax</label><input id="oTolAbs" value="${o.tolAbs}" inputmode="decimal"></div>
      <div><label>or tolerance (% of the amount), whichever is higher</label><input id="oTolPct" value="${o.tolPct}" inputmode="decimal"></div>
      <div><label>Date window for fuzzy / probable matches (days, 0 = any)</label><input id="oDays" value="${o.dateDays}" inputmode="numeric"></div>
      <div><label>Invoice no. may differ by up to (characters)</label><input id="oEdit" value="${o.maxEdit}" inputmode="numeric"></div>
      <div class="full chkrow">
        <label><input type="checkbox" id="oFY"${o.ignoreFY ? ' checked' : ''}> Ignore the financial-year part of the invoice no. (/26-27, 2026-27)</label>
        <label><input type="checkbox" id="oZero"${o.ignoreZeros ? ' checked' : ''}> Ignore leading zeros (INV0012 = INV12)</label>
        <label><input type="checkbox" id="oDig"${o.useDigits ? ' checked' : ''}> Treat invoice nos. with the same digits as similar (SL-663 = SL663 = 663)</label>
        <label><input type="checkbox" id="oAcross"${o.acrossGstin ? ' checked' : ''}> Match when the GSTIN in books is missing / different but invoice no. and amounts agree</label>
        <label><input type="checkbox" id="oName"${o.nameFill ? ' checked' : ''}> Take a missing GSTIN in books from GSTR-2B by supplier name</label>
        <label><input type="checkbox" id="oProb"${o.probable ? ' checked' : ''}> Suggest probable matches by amount (same GSTIN, invoice no. not similar)</label>
      </div>
    </div><p class="hint">Spaces, "/", "-" and case are always ignored in invoice numbers. Rounding differences up to the tolerance are treated as matched; the difference is still shown.</p></details>`;
  $('#optsDet').ontoggle = e => { optsOpen = e.target.open; };
  const n = (id, k, int) => { $(id).onchange = e => { const v = Number(String(e.target.value).replace(/,/g, '')); if (isFinite(v) && v >= 0) { st().recoOpts = Object.assign({}, st().recoOpts, { [k]: int ? Math.round(v) : v }); T.save(); later(); } }; };
  n('#oTolAbs', 'tolAbs'); n('#oTolPct', 'tolPct'); n('#oDays', 'dateDays', true); n('#oEdit', 'maxEdit', true);
  [['#oFY', 'ignoreFY'], ['#oZero', 'ignoreZeros'], ['#oDig', 'useDigits'], ['#oAcross', 'acrossGstin'], ['#oName', 'nameFill'], ['#oProb', 'probable']].forEach(([id, k]) => $(id).onchange = e => { st().recoOpts = Object.assign({}, st().recoOpts, { [k]: e.target.checked }); T.save(); later(); });
}

/* ---------- results ---------- */
function compute() {
  const S = st(); if (!S.data || !S.books) { res = null; return; }
  const books = Bk.aggregate(S.books.raw, { types: S.books.kind === 'xml' ? S.books.typeOn : null, from: S.books.from, to: S.books.to });
  res = R.run(T.rows(), books, opts(), S.recoMan || { links: [], rejects: [] });
  res.sum = R.summary(res);
}
function rowsOf(k) {
  if (!res) return [];
  const p = res.pairs.map(x => Object.assign({ kind: 'pair' }, x)), a = res.only2b.map(x => ({ kind: 'a', status: 'only2b', a: x })), b = res.onlyBooks.map(x => ({ kind: 'b', status: 'onlybooks', b: x }));
  let all = p.concat(a, b);
  if (k === 'open') all = all.filter(x => ['mismatch', 'probable', 'only2b', 'onlybooks'].includes(x.status));
  else if (k !== 'all') all = all.filter(x => x.status === k);
  const q = ($('#recoQ').value || '').toLowerCase();
  if (q) all = all.filter(x => `${x.a ? x.a.name + ' ' + x.a.gstin + ' ' + x.a.docno : ''} ${x.b ? x.b.name + ' ' + x.b.gstin + ' ' + x.b.invno + ' ' + x.b.vno : ''}`.toLowerCase().includes(q));
  return all;
}
function render() {
  const S = st(), has = !!S.data;
  $('#recoCard').hidden = !has; if (!has) return;
  $('#bkInfo').textContent = S.books ? `Loaded: ${S.books.file}` : 'No purchase register loaded.';
  $('#bkClear').hidden = !S.books; $('#bkTpl').hidden = false;
  renderMap(); renderOpts(); compute();
  if (!res) { ['recoSum', 'recoChips', 'recoT', 'recoSup'].forEach(id => $('#' + id).innerHTML = ''); $('#recoQ').hidden = true; return; }
  $('#recoQ').hidden = false;
  const s = res.sum, tA = res.A.reduce((t, a) => t + R.tax(a), 0), tB = res.B.reduce((t, b) => t + R.tax(b), 0);
  $('#recoSum').innerHTML = `<div class="kpis" style="margin-bottom:10px"><div><span>GSTR-2B – documents / tax</span><b>${res.A.length} · ${fmt(tA)}</b></div><div><span>Books – invoices / tax</span><b>${res.B.length} · ${fmt(tB)}</b></div><div><span>Difference in tax (2B − books)</span><b>${fmt(tA - tB)}</b></div><div><span>Matched (all kinds)</span><b>${['matched', 'invdiff', 'gstindiff', 'manual'].reduce((t, k) => t + s[k].n, 0)}</b></div><div><span>Open items</span><b>${['mismatch', 'probable', 'only2b', 'onlybooks'].reduce((t, k) => t + s[k].n, 0)}</b></div></div>
    <div class="tw" style="max-height:none"><table class="t"><thead><tr><th>Status</th><th class="n">Documents</th><th class="n">2B taxable</th><th class="n">2B tax</th><th class="n">Books taxable</th><th class="n">Books tax</th><th class="n">Difference in tax</th><th>Meaning</th></tr></thead><tbody>
    ${R.STATUS.map(([k, l, m]) => `<tr><td>${esc(l)}</td><td class="n">${s[k].n}</td><td class="n">${fmt(s[k].aTx)}</td><td class="n">${fmt(s[k].aTax)}</td><td class="n">${fmt(s[k].bTx)}</td><td class="n">${fmt(s[k].bTax)}</td><td class="n">${fmt(s[k].aTax - s[k].bTax)}</td><td class="small" style="white-space:normal">${esc(m)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Total</td><td class="n">${Object.values(s).reduce((t, x) => t + x.n, 0)}</td><td class="n">${fmt(Object.values(s).reduce((t, x) => t + x.aTx, 0))}</td><td class="n">${fmt(tA)}</td><td class="n">${fmt(Object.values(s).reduce((t, x) => t + x.bTx, 0))}</td><td class="n">${fmt(tB)}</td><td class="n">${fmt(tA - tB)}</td><td></td></tr></tfoot></table></div>`;
  const chips = [['all', 'All'], ['open', 'Open items']].concat(R.STATUS.filter(x => s[x[0]].n).map(x => [x[0], `${x[1]} (${s[x[0]].n})`]));
  if (!chips.some(c => c[0] === chip)) chip = 'all';
  $('#recoChips').innerHTML = chips.map(([k, l]) => `<button type="button" data-rc="${k}" aria-pressed="${k === chip}">${esc(l)}</button>`).join('');
  $$('[data-rc]').forEach(b => b.onclick = () => { chip = b.dataset.rc; pageN = 200; render(); });
  renderTable(); renderSup();
}
function renderTable() {
  const all = rowsOf(chip), show = all.slice(0, pageN), S = st();
  const cand = a => res.onlyBooks.filter(b => b.gstin === a.gstin || !b.gstin).slice(0, 60);
  $('#recoT').innerHTML = `<thead><tr><th>Status</th><th>Supplier</th><th>2B – document</th><th class="n">2B taxable</th><th class="n">2B tax</th><th>Books – invoice / voucher</th><th class="n">Books taxable</th><th class="n">Books tax</th><th class="n">Diff. taxable</th><th class="n">Diff. tax</th><th>Notes</th><th></th></tr></thead><tbody>${show.map(x => {
    const a = x.a, b = x.b, id = x.kind === 'pair' ? `${a.id}>${b.id}` : '';
    const cls = { matched: 'ok', invdiff: 'ok', gstindiff: 'ok', manual: 'ok', mismatch: 'bad', probable: 'warn', only2b: 'warn', onlybooks: 'bad' }[x.status];
    let act = '';
    if (x.kind === 'pair') act = x.status === 'probable' ? `<button type="button" class="link sm" data-acc="${esc(id)}">Accept</button><br><button type="button" class="link sm danger" data-rej="${esc(id)}">Reject</button>` : `<button type="button" class="link sm" data-unl="${esc(id)}">Unpair</button>`;
    else if (x.kind === 'a') { const c = cand(a); act = c.length ? `<select class="pairsel" data-a="${esc(a.id)}" style="width:170px"><option value="">Pair with books…</option>${c.map(bb => `<option value="${esc(bb.id)}">${esc(bb.invno)} · ${dmy(bb.invdate)} · ${fmt(R.tax(bb))}</option>`).join('')}</select>` : ''; }
    return `<tr class="st-${cls}"><td class="small">${esc(ST[x.status][1])}</td><td class="wrap">${esc((a || b).name)}<br><span class="small">${esc((a || b).gstin || (b && b.gstinRaw) || '')}</span></td>
      <td>${a ? `${esc(a.docno)}<br><span class="small">${esc(a.date)} · ${esc(a.sheet)}</span>` : ''}</td><td class="n">${a ? fmt(a.txval) : ''}</td><td class="n">${a ? fmt(R.tax(a)) : ''}</td>
      <td>${b ? `${esc(b.invno)}<br><span class="small">${dmy(b.invdate)}${b.vno ? ' · vch ' + esc(b.vno) : ''}</span>` : ''}</td><td class="n">${b ? fmt(b.txval) : ''}</td><td class="n">${b ? fmt(R.tax(b)) : ''}</td>
      <td class="n">${x.d ? fmt(x.d.txval) : ''}</td><td class="n">${x.d ? fmt(x.d.tax) : ''}</td><td class="small" style="white-space:normal;min-width:160px">${esc((x.flags || []).join('; '))}</td><td style="white-space:nowrap">${act}</td></tr>`; }).join('') || '<tr><td colspan="12" class="hint">Nothing to show.</td></tr>'}</tbody>${all.length > show.length ? `<tfoot><tr><td colspan="12">Showing ${show.length} of ${all.length} – <button type="button" class="link" id="recoMore">show more</button></td></tr></tfoot>` : ''}`;
  if ($('#recoMore')) $('#recoMore').onclick = () => { pageN += 200; renderTable(); };
  const man = () => { S.recoMan = S.recoMan || { links: [], rejects: [] }; return S.recoMan; };
  $$('[data-acc]').forEach(b => b.onclick = () => { const [ai, bi] = b.dataset.acc.split('>'); man().links.push([ai, bi]); T.save(); render(); });
  $$('[data-rej]').forEach(b => b.onclick = () => { const [ai, bi] = b.dataset.rej.split('>'); man().rejects.push([ai, bi]); T.save(); render(); });
  $$('[data-unl]').forEach(b => b.onclick = () => { const [ai, bi] = b.dataset.unl.split('>'); const m = man(); m.links = m.links.filter(l => !(l[0] === ai && l[1] === bi)); m.rejects.push([ai, bi]); T.save(); render(); });
  $$('.pairsel').forEach(s => s.onchange = () => { if (!s.value) return; man().links.push([s.dataset.a, s.value]); T.save(); later(); });
}
function renderSup() {
  const list = res.suppliers.map(x => Object.assign(x, { dt: x.a.tax - x.b.tax })).filter(x => Math.abs(x.dt) > 1 || x.open2b || x.openBooks).sort((p, q) => Math.abs(q.dt) - Math.abs(p.dt));
  $('#recoSup').innerHTML = `<details><summary><b>Supplier-wise differences</b> <span class="hint">(${list.length} supplier(s) with a difference or open items – all suppliers are in the Excel)</span></summary>
    <div class="tw" style="margin-top:8px"><table class="t"><thead><tr><th>GSTIN</th><th>Supplier</th><th class="n">2B docs</th><th class="n">2B tax</th><th class="n">Books invoices</th><th class="n">Books tax</th><th class="n">Difference</th><th class="n">Only in 2B</th><th class="n">Only in books</th></tr></thead><tbody>
    ${list.slice(0, 300).map(x => `<tr><td>${esc(x.gstin || '')}</td><td class="wrap">${esc(x.name)}</td><td class="n">${x.a.n}</td><td class="n">${fmt(x.a.tax)}</td><td class="n">${x.b.n}</td><td class="n">${fmt(x.b.tax)}</td><td class="n">${fmt(x.dt)}</td><td class="n">${x.open2b || ''}</td><td class="n">${x.openBooks || ''}</td></tr>`).join('')}</tbody></table></div></details>`;
}
$('#recoQ').oninput = () => { pageN = 200; renderTable(); };

window.G2BRecoUI = { render, result: () => res };
render();
})();
