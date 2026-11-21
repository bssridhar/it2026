/* ROC Compliance – page logic (one to five directors) */
(function () {
"use strict";
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const C = window.RocCompose, LS = 'roc-current-v1', MAX = C.MAX_DIRS;
const get = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } };
let st = C.normalize(merge(C.blank(), get() || {}));
let cur = 0;                                     // director shown in the form
const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* not kept */ } };
function merge(b, d) { Object.keys(d || {}).forEach(k => { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && d[k] && typeof d[k] === 'object') merge(b[k], d[k]); else b[k] = d[k]; }); return b; }
const getP = (o, path) => path.split('.').reduce((x, k) => x == null ? '' : x[k], o);
const setP = (o, path, val) => { const ks = path.split('.'); let x = o; ks.slice(0, -1).forEach(k => x = x[k] = x[k] || {}); x[ks[ks.length - 1]] = val; };
const firm = () => (window.HOME_CONFIG && HOME_CONFIG.firmName) || '';
const toInputDate = s => C.isoOf(s);
const FIELD = Object.fromEntries(C.FIELDS.map(f => [f[0], f])), DF = Object.fromEntries(C.DFIELDS.map(f => [f[0], f]));

$('#event').innerHTML = C.EVENTS.map(e => `<option value="${e.id}"${e.ready ? '' : ' disabled'}${e.id === st.event ? ' selected' : ''}>${esc(e.label)}</option>`).join('');

/* ---------- common details ---------- */
function ctl(attr, k, type, opts) {
  return type === 'select' ? `<select ${attr}="${k}">${opts.map(([vv, l]) => `<option value="${esc(vv)}">${esc(l)}</option>`).join('')}</select>`
    : type === 'textarea' ? `<textarea ${attr}="${k}" rows="2"></textarea>` : type === 'date' ? `<input type="date" ${attr}="${k}" data-date="1">` : `<input ${attr}="${k}">`;
}
function buildForm() {
  const secs = {}; C.FIELDS.forEach(f => (secs[f[2]] = secs[f[2]] || []).push(f));
  const order = ['Company', 'Appointment', 'Board meeting', 'General meeting', 'Signatory'];
  $('#form').innerHTML = order.filter(s => secs[s]).map(sec => `<details class="sec" open data-sec="${esc(sec)}"><summary>${esc(sec)}</summary><div class="secgrid" style="margin-top:8px">${secs[sec].map(([k, label, , type, opts]) =>
    `<div class="${type === 'textarea' ? 'full' : ''}"><label>${esc(label.replace(/ \(DD-MM-YYYY\)/, ''))}</label>${ctl('data-f', k, type, opts)}</div>`).join('')}</div></details>`).join('')
    + `<details class="sec" open data-sec="Directors"><summary>Proposed directors</summary><div class="bar" id="dtabs" style="margin:8px 0"></div><div class="secgrid" id="dform"></div>
       <h3 style="font-size:.92rem;margin:12px 0 4px">Other companies / firms / bodies in which this director is interested (for MBP-1 and DIR-8)</h3>
       <div class="tw" style="max-height:none"><table class="t" id="intT"></table></div><button type="button" class="link" id="addInt">+ Add a row</button></details>`;
  $('#reqMode').innerHTML = FIELD.mode[4].map(([vv, l]) => `<option value="${esc(vv)}">${esc(l)}</option>`).join('');
  $$('[data-f]').forEach(el => {
    const k = el.dataset.f, val = getP(st, k);
    el.value = el.dataset.date ? toInputDate(val) : (val ?? '');
    el.onchange = () => { let x = el.value.trim(); if (el.dataset.date && x) x = x.split('-').reverse().join('-'); if (k === 'co.cin') x = x.toUpperCase(); setP(st, k, x); save(); $$(`[data-f="${k}"]`).forEach(o => { if (o !== el) o.value = el.value; }); refresh(); };
  });
  $('#addInt').onclick = () => { st.dirs[cur].interests.push({ name: '', cin: '', nature: 'Director', share: '', date: '', ceased: '' }); save(); renderInt(); };
  renderDir();
}

/* ---------- directors ---------- */
function renderDir() {
  if (cur >= st.dirs.length) cur = st.dirs.length - 1;
  $('#dtabs').innerHTML = st.dirs.map((d, i) => `<button type="button" class="${i === cur ? 'primary' : ''}" data-tab="${i}">Director ${i + 1}${d.name ? ' – ' + esc(d.name) : ''}</button>`).join('')
    + (st.dirs.length < MAX ? `<button type="button" class="link" id="addDir">+ Add a director (up to ${MAX})</button>` : `<span class="hint">Maximum of ${MAX} directors.</span>`)
    + (st.dirs.length > 1 ? `<span style="flex:1"></span><button type="button" class="link danger" id="delDir">Remove Director ${cur + 1}</button>` : '');
  $$('#dtabs [data-tab]').forEach(b => b.onclick = () => { cur = +b.dataset.tab; renderDir(); });
  if ($('#addDir')) $('#addDir').onclick = () => { st.dirs.push(C.blankDir()); cur = st.dirs.length - 1; save(); renderDir(); refresh(); $('#numDirs').value = String(st.dirs.length); };
  if ($('#delDir')) $('#delDir').onclick = async () => { const d = st.dirs[cur]; if (!(await ask(`Remove Director ${cur + 1}?`, `${esc(d.name || 'This director')} and the details entered for ${d.name ? 'him / her' : 'this director'} will be removed.`))) return; st.dirs.splice(cur, 1); cur = Math.max(0, cur - 1); save(); renderDir(); refresh(); $('#numDirs').value = String(st.dirs.length); };
  const d = st.dirs[cur];
  $('#dform').innerHTML = C.DFIELDS.map(([k, label, type, opts]) => `<div class="${type === 'textarea' ? 'full' : ''}" data-wrap="${k}"><label>${esc(label.replace(/ \(DD-MM-YYYY\)/, ''))}</label>${ctl('data-df', k, type, opts)}</div>`).join('');
  $$('[data-df]').forEach(el => { const k = el.dataset.df; el.value = el.dataset.date ? toInputDate(d[k]) : (d[k] ?? '');
    el.onchange = () => { let x = el.value.trim(); if (el.dataset.date && x) x = x.split('-').reverse().join('-'); if (k === 'pan') x = x.toUpperCase(); d[k] = x; save(); if (k === 'name') renderDir(); else showDin(); refresh(); }; });
  showDin(); renderInt();
}
const showDin = () => { const w = $('[data-wrap="din"]'); if (w) w.style.display = st.dirs[cur].hasDin === 'no' ? 'none' : ''; };
function renderInt() {
  const L = st.dirs[cur].interests = st.dirs[cur].interests || [];
  $('#intT').innerHTML = `<thead><tr><th>#</th><th>Name of the company / LLP / firm / body</th><th>CIN / LLPIN / registration</th><th>Nature of interest (Director / Partner / Member …)</th><th>Shareholding</th><th>Date interest arose</th><th>Date of cessation (if any)</th><th></th></tr></thead><tbody>${L.map((x, i) => `<tr><td>${i + 1}</td>
    <td><input class="w-l" data-i="${i}" data-k="name" value="${esc(x.name)}"></td><td><input class="w-m" data-i="${i}" data-k="cin" value="${esc(x.cin)}"></td><td><input class="w-m" data-i="${i}" data-k="nature" value="${esc(x.nature)}" placeholder="Director"></td>
    <td><input class="w-s" data-i="${i}" data-k="share" value="${esc(x.share)}" placeholder="e.g. 10%"></td><td><input type="date" data-i="${i}" data-k="date" value="${esc(C.isoOf(x.date))}"></td><td><input class="w-m" data-i="${i}" data-k="ceased" value="${esc(x.ceased)}"></td>
    <td><button type="button" class="link sm danger" data-del="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="hint">None entered – the forms will show NIL.</td></tr>'}</tbody>`;
  $$('#intT [data-k]').forEach(el => el.onchange = () => { let x = el.value.trim(); if (el.type === 'date' && x) x = x.split('-').reverse().join('-'); L[+el.dataset.i][el.dataset.k] = x; save(); refresh(false); });
  $$('#intT [data-del]').forEach(b => b.onclick = () => { L.splice(+b.dataset.del, 1); save(); renderInt(); refresh(false); });
}

/* ---------- requirements list (choices at the top) ---------- */
$('#numDirs').innerHTML = Array.from({ length: MAX }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
$('#numDirs').onchange = async e => {
  const n = +e.target.value;
  if (n > st.dirs.length) while (st.dirs.length < n) st.dirs.push(C.blankDir());
  else if (n < st.dirs.length) { const drop = st.dirs.slice(n).filter(d => d.name || d.din || d.pan);
    if (drop.length && !(await ask('Remove directors?', `Details entered for ${drop.map(d => esc(d.name || 'a director')).join(', ')} will be removed.`))) { e.target.value = String(st.dirs.length); return; }
    st.dirs = st.dirs.slice(0, n); }
  save(); renderDir(); refresh();
};
$('#allDin').onchange = e => { st.allHaveDin = e.target.value; save(); refresh(); };
function renderReq() {
  $('#numDirs').value = String(st.dirs.length); $('#allDin').value = st.allHaveDin || 'yes';
  const t = C.reqText(st); $('#reqText').textContent = t;
  $('#reqMail').href = `mailto:?subject=${encodeURIComponent(`Appointment of ${st.dirs.length > 1 ? 'Directors' : 'a Director'} – information and documents required` + (st.co.name ? ' – ' + st.co.name : ''))}&body=${encodeURIComponent(t + (firm() ? '\n\nRegards,\n' + firm() : ''))}`;
}
$('#reqCopy').onclick = async () => { const t = $('#reqText').textContent; try { await navigator.clipboard.writeText(t); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#reqText')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); } $('#reqCopy').textContent = 'Copied'; setTimeout(() => $('#reqCopy').textContent = 'Copy the text', 1500); };
$('#reqPdf').onclick = () => {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }); let y = 16;
  const W = 180, line = (t, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 10); doc.splitTextToSize(t, o.w || W).forEach(l => { if (y > 282) { doc.addPage(); y = 16; } doc.text(l, o.x || 15, y); y += (o.s || 10) * 0.45; }); y += o.after ?? 1.5; };
  const lines = C.reqText(st).split('\n');
  if (firm()) line(firm(), { b: true, s: 12, after: 3 });
  line(lines[0], { b: true, s: 12, after: 3 }); line(lines[2], { after: 3 });
  lines.slice(4).forEach(t => { if (!t) { y += 1.5; return; } const m = /^(\d+\.)\s(.*)$/.exec(t); if (m) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(m[1], 15, y); line(m[2], { x: 23, w: W - 8 }); } else if (/^[A-Z][A-Z ()0-9]+$/.test(t)) line(t.charAt(0) + t.slice(1).toLowerCase(), { b: true, s: 10.5 }); else line(t); });
  doc.save(`Documents_required_${(st.co.name || 'company').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}.pdf`);
};
$('#reqDoc').onclick = () => { const d = C.docs(st).find(x => x.id === 'reqlist'); download(`${d.file}.docx`, makeDocx(d), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); };

/* ---------- procedure, checks ---------- */
function renderSteps() { $('#steps').innerHTML = `<thead><tr><th>#</th><th>Step</th><th>Provision</th><th>Due by</th></tr></thead><tbody>${C.steps(st).map((x, i) => `<tr><td>${i + 1}</td><td class="wrapc">${esc(x.step)}</td><td class="small">${esc(x.law)}</td><td>${esc(x.due || '')}</td></tr>`).join('')}</tbody>`; }
function renderChecks() { const order = { err: 0, warn: 1, info: 2, ok: 3 }; $('#issues').innerHTML = C.checks(st).sort((a, b) => order[a[0]] - order[b[0]]).map(([k, t]) => `<div class="m-${k}">${esc(t)}</div>`).join(''); }
function showSections() {
  const add = st.mode !== 'general', sec = n => $(`details[data-sec="${n}"]`);
  if (sec('Board meeting')) sec('Board meeting').style.display = add ? '' : 'none';
  const sm = sec('General meeting'); if (sm) sm.querySelector('summary').textContent = add ? 'General meeting (for regularising the appointments – fill when known)' : 'General meeting';
}

/* ---------- documents ---------- */
let picked = null;
function renderDocs() {
  const list = C.docs(st);
  if (!picked) picked = new Set(list.map(d => d.id));
  const groups = {}; list.forEach(d => (groups[d.group || 'Other'] = groups[d.group || 'Other'] || []).push(d));
  $('#docs').innerHTML = Object.entries(groups).map(([g, L]) => `<div class="grp">${esc(g)}</div>${L.map(d => `<label><input type="checkbox" data-doc="${d.id}"${picked.has(d.id) ? ' checked' : ''}> <span>${esc(d.title)} <button type="button" class="link sm" data-one="${d.id}">Word</button></span></label>`).join('')}`).join('');
  $$('[data-doc]').forEach(c => c.onchange = () => { c.checked ? picked.add(c.dataset.doc) : picked.delete(c.dataset.doc); });
  $$('[data-one]').forEach(b => b.onclick = e => { e.preventDefault(); const d = C.docs(st).find(x => x.id === b.dataset.one); download(`${d.file}.docx`, makeDocx(d), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); });
}
$('#selAll').onclick = () => { picked = new Set(C.docs(st).map(d => d.id)); renderDocs(); };
$('#selNone').onclick = () => { picked = new Set(); renderDocs(); };
$('#letterhead').checked = st.letterhead !== false;
$('#letterhead').onchange = e => { st.letterhead = e.target.checked; save(); };
function b64ToBytes(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function makeDocx(d) {
  const doc = new window.docxtemplater(new PizZip(b64ToBytes(window.LLP_TEMPLATES.roc_doc)), { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
  doc.render({ lh: d.lh && st.letterhead !== false ? [C.lh(st)] : [], blocks: d.blocks });
  return doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
}
$('#dlZip').onclick = () => {
  const list = C.docs(st).filter(d => picked.has(d.id)); if (!list.length) return msg('#outMsgs', 'warn', 'Select at least one document.');
  try { const z = new PizZip(); list.forEach((d, i) => z.file(`${String(i + 1).padStart(2, '0')}_${d.file}.docx`, makeDocx(d)));
    const tag = (st.co.name || 'Company').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30);
    download(`Appointment_of_director${st.dirs.length > 1 ? 's' : ''}_${tag}.zip`, z.generate({ type: 'uint8array', compression: 'DEFLATE' }), 'application/zip');
    msg('#outMsgs', 'ok', `${list.length} document(s) downloaded for ${st.dirs.length} director(s). Check every document before it is printed and signed.`); }
  catch (e) { msg('#outMsgs', 'err', 'Not downloaded: ' + (e.message || e)); }
};

/* ---------- Excel template and import ---------- */
const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FAE' } }, YEL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const listDV = opts => ({ type: 'list', allowBlank: true, formulae: ['"' + opts.map(o => o[1].replace(/"/g, '').replace(/,/g, ' ')).join(',') + '"'] });
$('#dlXlsx').onclick = async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Details'), dw = wb.addWorksheet('Directors'), it = wb.addWorksheet('Other interests');
  ws.columns = [{ header: 'Section', width: 18 }, { header: 'Particulars', width: 62 }, { header: 'Value', width: 50 }, { header: 'key', width: 10, hidden: true }];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ['A1', 'B1', 'C1'].forEach(r => ws.getCell(r).fill = HEAD);
  C.FIELDS.forEach(([k, label, sec, type, opts]) => { const row = ws.addRow([sec, label, type === 'select' ? (opts.find(o => o[0] === getP(st, k)) || opts[0])[1] : (getP(st, k) || ''), k]);
    const c = row.getCell(3); c.fill = YEL; c.alignment = { wrapText: true }; if (type === 'select') c.dataValidation = listDV(opts); if (type === 'date') c.numFmt = '@'; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  // one column for each director
  dw.columns = [{ header: 'Particulars', width: 52 }].concat(Array.from({ length: MAX }, (_, i) => ({ header: `Director ${i + 1}`, width: 30 }))).concat([{ header: 'key', width: 10, hidden: true }]);
  dw.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; for (let i = 1; i <= MAX + 1; i++) dw.getCell(1, i).fill = HEAD;
  C.DFIELDS.forEach(([k, label, type, opts]) => { const row = dw.addRow([label].concat(Array.from({ length: MAX }, (_, i) => { const d = st.dirs[i]; if (!d) return ''; return type === 'select' ? (opts.find(o => o[0] === d[k]) || opts[0])[1] : (d[k] || ''); })).concat([k]));
    for (let i = 2; i <= MAX + 1; i++) { const c = row.getCell(i); c.fill = YEL; c.alignment = { wrapText: true }; if (type === 'select') c.dataValidation = listDV(opts); if (type === 'date') c.numFmt = '@'; } });
  dw.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  it.columns = [{ header: 'Director no. (1-5)', width: 10 }, { header: 'Name of the company / LLP / firm / body', width: 44 }, { header: 'CIN / LLPIN / registration no.', width: 26 }, { header: 'Nature of interest (Director / Partner / Member …)', width: 26 }, { header: 'Shareholding', width: 14 }, { header: 'Date interest arose (DD-MM-YYYY)', width: 18 }, { header: 'Date of cessation, if any', width: 18 }];
  it.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; for (let i = 1; i <= 7; i++) it.getCell(1, i).fill = HEAD;
  st.dirs.forEach((d, n) => (d.interests || []).forEach(x => it.addRow([n + 1, x.name, x.cin, x.nature, x.share, x.date, x.ceased])));
  const n = wb.addWorksheet('Instructions'); n.getColumn(1).width = 120;
  [`Appointment of Directors (up to ${MAX}) – details for the ROC compliance tool.`, '', '"Details": company, meetings and the signing director – fill the yellow Value column; dates as DD-MM-YYYY.',
    `"Directors": one column for each proposed director (Director 1 to Director ${MAX}); leave the columns of directors not being appointed blank.`, '"Other interests": every company, LLP, firm or body in which a director is a director, partner or member – give the director number (1 to 5) in the first column.',
    'Choose from the drop-down where one is given. Do not change the hidden "key" columns. Do not enter Aadhaar numbers or passwords.'].forEach((t, i) => { n.getCell('A' + (i + 1)).value = t; if (!i) n.getCell('A1').font = { bold: true }; });
  download('ROC_Appointment_of_Directors_details.xlsx', await wb.xlsx.writeBuffer(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};
const conv = (F, type, opts, val, fallback) => {
  if (val === undefined || val === null || val === '') return undefined;
  if (type === 'date') { const d = LLPXlsx.date(val); return d ? d.split('-').reverse().join('-') : String(val).trim(); }
  if (type === 'select') { const s = String(val).trim().toLowerCase(), o = opts.find(([vv, l]) => vv.toLowerCase() === s || l.replace(/,/g, ' ').toLowerCase() === s || l.toLowerCase() === s); return o ? o[0] : fallback; }
  return LLPXlsx.str(val);
};
$('#upXlsx').onclick = () => $('#xlsxFile').click();
$('#xlsxFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const sh = LLPXlsx.readWorkbook(new Uint8Array(await f.arrayBuffer()));
    const det = sh['Details']; if (!det) throw new Error('the "Details" sheet of the template was not found');
    const rowOf = r => +r.replace(/^[A-Z]+/, ''), colOf = r => r.replace(/\d+$/, ''); let n = 0;
    Object.keys(det).filter(r => /^D\d+$/.test(r) && rowOf(r) > 1).forEach(r => { const k = String(det[r]).trim(), F = FIELD[k]; if (!F) return;
      let val = conv(F, F[3], F[4], det['C' + rowOf(r)], getP(st, k)); if (val === undefined) return; if (k === 'co.cin') val = String(val).toUpperCase(); setP(st, k, val); n++; });
    // directors: one column each (B..F), key in the column after the last director
    const dw = sh['Directors'], dirs = [];
    if (dw) {
      const keyCol = String.fromCharCode(66 + MAX), cols = Array.from({ length: MAX }, (_, i) => String.fromCharCode(66 + i));
      const rows = Object.keys(dw).filter(r => colOf(r) === keyCol && rowOf(r) > 1).map(r => ({ r: rowOf(r), k: String(dw[r]).trim() })).filter(x => DF[x.k]);
      cols.forEach((c, i) => { const d = C.blankDir(); let any = false;
        rows.forEach(({ r, k }) => { const [, , type, opts] = DF[k]; let val = conv(DF[k], type, opts, dw[c + r], d[k]); if (val === undefined) return; if (k === 'pan') val = String(val).toUpperCase(); d[k] = val; if (!['salutation', 'hasDin', 'designation', 'capacity', 'nationality'].includes(k)) any = true; });
        if (any) { d.slot = i; dirs.push(d); } });
    }
    if (!dirs.length) throw new Error('no director details were found in the "Directors" sheet');
    const it = sh['Other interests'];
    if (it) { const rows = {}; Object.keys(it).forEach(r => { (rows[rowOf(r)] = rows[rowOf(r)] || {})[colOf(r)] = it[r]; });
      Object.keys(rows).map(Number).filter(r => r > 1).sort((a, b) => a - b).forEach(r => { const R = rows[r]; if (!R.B) return; const no = parseInt(R.A, 10) || 1, d = dirs.find(x => x.slot === no - 1) || dirs[0]; const dt = R.F !== undefined ? LLPXlsx.date(R.F) : '';
        d.interests.push({ name: LLPXlsx.str(R.B), cin: LLPXlsx.str(R.C), nature: LLPXlsx.str(R.D) || 'Director', share: LLPXlsx.str(R.E), date: dt ? dt.split('-').reverse().join('-') : LLPXlsx.str(R.F), ceased: LLPXlsx.str(R.G) }); }); }
    dirs.forEach(d => delete d.slot); st.dirs = dirs; cur = 0;
    save(); buildForm(); refresh();
    msg('#topMsgs', 'ok', `${f.name}: ${n} company / meeting detail(s) and ${dirs.length} director(s) imported (${dirs.map(d => d.name || 'name not given').join(', ')}). Check the details below.`);
  } catch (err) { msg('#topMsgs', 'err', `Not imported: ${err.message || err}`); }
};

/* ---------- case files ---------- */
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function msg(el, k, t) { $(el).innerHTML = t ? `<div class="m-${k}">${esc(t)}</div>` : ''; }
$('#saveCase').onclick = () => download(`ROC_${(st.co.name || 'company').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}_appointment.json`, JSON.stringify(st, null, 1), 'application/json');
$('#openCase').onclick = () => $('#caseFile').click();
$('#caseFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.kind !== 'roc-case') throw 0; st = C.normalize(merge(C.blank(), d)); cur = 0; save(); buildForm(); refresh(); $('#letterhead').checked = st.letterhead !== false; msg('#topMsgs', 'ok', `Opened ${f.name}.`); }
  catch (err) { msg('#topMsgs', 'err', 'That file is not a ROC compliance case file.'); } };
$('#newCase').onclick = async () => { if (await ask('Start a new case?', 'The details on screen will be cleared. Save the case file first if you need it.')) { st = C.blank(); cur = 0; save(); buildForm(); refresh(); msg('#topMsgs', '', ''); } };
function ask(title, html) { return new Promise(done => { $('#askTitle').textContent = title; $('#askBody').innerHTML = html; const dl = $('#askDlg'); const end = v => { dl.close(); done(v); }; $('#askYes').onclick = () => end(true); $('#askNo').onclick = () => end(false); dl.oncancel = () => done(false); dl.showModal(); }); }

function refresh(redoc = true) {
  showSections(); renderReq(); renderSteps(); renderChecks();
  if (redoc) { picked = null; renderDocs(); }
  const req = ['co.name', 'co.cin', 'sign.name'], done = req.filter(k => getP(st, k)).length + st.dirs.filter(d => d.name && d.pan && d.address).length;
  $('#fillPill').textContent = `${st.dirs.length} director(s) · ${done} of ${req.length + st.dirs.length} key details filled`;
}
window.RocTool = { state: () => st, makeDocx, docs: () => C.docs(st) };
buildForm(); refresh();
})();
