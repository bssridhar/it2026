/* ROC Compliance – page logic */
(function () {
"use strict";
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const C = window.RocCompose, LS = 'roc-current-v1';
const get = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } };
let st = merge(C.blank(), get() || {});
const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) { /* not kept */ } };
function merge(b, d) { Object.keys(d || {}).forEach(k => { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && d[k] && typeof d[k] === 'object') merge(b[k], d[k]); else b[k] = d[k]; }); return b; }
const getP = (o, path) => path.split('.').reduce((x, k) => x == null ? '' : x[k], o);
const setP = (o, path, val) => { const ks = path.split('.'); let x = o; ks.slice(0, -1).forEach(k => x = x[k] = x[k] || {}); x[ks[ks.length - 1]] = val; };
const firm = () => (window.HOME_CONFIG && HOME_CONFIG.firmName) || '';

/* ---------- event ---------- */
$('#event').innerHTML = C.EVENTS.map(e => `<option value="${e.id}"${e.ready ? '' : ' disabled'}${e.id === st.event ? ' selected' : ''}>${esc(e.label)}</option>`).join('');

/* ---------- form ---------- */
const FIELD = Object.fromEntries(C.FIELDS.map(f => [f[0], f]));
const toInputDate = s => C.isoOf(s);
function buildForm() {
  const secs = {}; C.FIELDS.forEach(f => (secs[f[2]] = secs[f[2]] || []).push(f));
  $('#form').innerHTML = Object.entries(secs).map(([sec, fs]) => `<details class="sec" open data-sec="${esc(sec)}"><summary>${esc(sec)}</summary><div class="secgrid" style="margin-top:8px">${fs.map(([k, label, , type, opts]) => {
    const full = type === 'textarea' ? ' full' : '';
    const ctl = type === 'select' ? `<select data-f="${k}">${opts.map(([vv, l]) => `<option value="${esc(vv)}">${esc(l)}</option>`).join('')}</select>`
      : type === 'textarea' ? `<textarea data-f="${k}" rows="2"></textarea>` : type === 'date' ? `<input type="date" data-f="${k}" data-date="1">` : `<input data-f="${k}">`;
    return `<div class="${full}"><label>${esc(label.replace(/ \(DD-MM-YYYY\)/, ''))}</label>${ctl}</div>`; }).join('')}</div></details>`).join('');
  // the two choices repeated at the top (requirements list)
  ['#reqMode', '#reqDin'].forEach(id => { const k = $(id).dataset.f; $(id).innerHTML = FIELD[k][4].map(([vv, l]) => `<option value="${esc(vv)}">${esc(l)}</option>`).join(''); });
  $$('[data-f]').forEach(el => {
    const k = el.dataset.f, val = getP(st, k);
    el.value = el.dataset.date ? toInputDate(val) : (val ?? '');
    el.onchange = () => { let x = el.value.trim(); if (el.dataset.date && x) x = x.split('-').reverse().join('-'); if (k === 'dir.pan' || k === 'co.cin') x = x.toUpperCase(); setP(st, k, x); save(); sync(k); refresh(); };
  });
}
function sync(k) { $$(`[data-f="${k}"]`).forEach(el => { const val = getP(st, k); el.value = el.dataset.date ? toInputDate(val) : (val ?? ''); }); }
function showSections() {
  const add = st.mode !== 'general';
  const sec = n => $(`details[data-sec="${n}"]`);
  // the general meeting is needed in both cases (regularisation / appointment); the Board meeting only for an additional director
  if (sec('Board meeting')) sec('Board meeting').style.display = add ? '' : 'none';
  const din = $('[data-f="dir.din"]'); if (din) din.closest('div').style.display = st.dir.hasDin === 'no' ? 'none' : '';
  const sm = sec('General meeting'); if (sm) sm.querySelector('summary').textContent = add ? 'General meeting (for regularising the appointment – fill when known)' : 'General meeting';
}

/* ---------- other interests ---------- */
function renderInt() {
  const L = st.dir.interests = st.dir.interests || [];
  $('#intT').innerHTML = `<thead><tr><th>#</th><th>Name of the company / LLP / firm / body</th><th>CIN / LLPIN / registration</th><th>Nature of interest (Director / Partner / Member …)</th><th>Shareholding</th><th>Date interest arose</th><th>Date of cessation (if any)</th><th></th></tr></thead><tbody>${L.map((x, i) => `<tr><td>${i + 1}</td>
    <td><input class="w-l" data-i="${i}" data-k="name" value="${esc(x.name)}"></td><td><input class="w-m" data-i="${i}" data-k="cin" value="${esc(x.cin)}"></td><td><input class="w-m" data-i="${i}" data-k="nature" value="${esc(x.nature)}" placeholder="Director"></td>
    <td><input class="w-s" data-i="${i}" data-k="share" value="${esc(x.share)}" placeholder="e.g. 10%"></td><td><input type="date" data-i="${i}" data-k="date" value="${esc(C.isoOf(x.date))}"></td><td><input class="w-m" data-i="${i}" data-k="ceased" value="${esc(x.ceased)}"></td>
    <td><button type="button" class="link sm danger" data-del="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="hint">None entered – the forms will show NIL.</td></tr>'}</tbody>`;
  $$('#intT [data-k]').forEach(el => el.onchange = () => { let x = el.value.trim(); if (el.type === 'date' && x) x = x.split('-').reverse().join('-'); L[+el.dataset.i][el.dataset.k] = x; save(); refresh(false); });
  $$('#intT [data-del]').forEach(b => b.onclick = () => { L.splice(+b.dataset.del, 1); save(); renderInt(); refresh(false); });
}
$('#addInt').onclick = () => { st.dir.interests.push({ name: '', cin: '', nature: 'Director', share: '', date: '', ceased: '' }); save(); renderInt(); };

/* ---------- requirements list ---------- */
function renderReq() {
  const t = C.reqText(st); $('#reqText').textContent = t;
  $('#reqMail').href = `mailto:?subject=${encodeURIComponent('Appointment of a Director – information and documents required' + (st.co.name ? ' – ' + st.co.name : ''))}&body=${encodeURIComponent(t + (firm() ? '\n\nRegards,\n' + firm() : ''))}`;
}
$('#reqCopy').onclick = async () => { const t = $('#reqText').textContent; try { await navigator.clipboard.writeText(t); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#reqText')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); } $('#reqCopy').textContent = 'Copied'; setTimeout(() => $('#reqCopy').textContent = 'Copy the text', 1500); };
$('#reqPdf').onclick = () => {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a4' }); let y = 16;
  const W = 180, line = (t, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 10); doc.splitTextToSize(t, o.w || W).forEach(l => { if (y > 282) { doc.addPage(); y = 16; } doc.text(l, o.x || 15, y); y += (o.s || 10) * 0.45; }); y += o.after ?? 1.5; };
  if (firm()) line(firm(), { b: true, s: 12, after: 3 });
  const items = C.reqItems(st);
  line(`Information and documents required – Appointment of a Director${st.co.name ? ' – ' + st.co.name : ''}`, { b: true, s: 12, after: 3 });
  line(`For the appointment of ${st.dir.name ? (st.dir.salutation + ' ' + st.dir.name) : 'the proposed director'} as ${st.mode !== 'general' ? 'an Additional Director by the Board of Directors' : 'a Director at the general meeting'}, kindly provide the following:`, { after: 3 });
  let k = 0; items.forEach(s => { y += 1; line(s.sec, { b: true, s: 10.5 }); s.items.forEach(t => { const n = `${++k}.`; doc.setFontSize(10); doc.text(n, 15, y); line(t, { x: 23, w: W - 8 }); }); });
  y += 3; line('Scanned copies may be sent by e-mail; the signed forms are to be returned in original or as signed scans, as advised.');
  doc.save(`Documents_required_${(st.co.name || 'company').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}.pdf`);
};
$('#reqDoc').onclick = () => { const d = C.docs(st).find(x => x.id === 'reqlist'); download(`${d.file}.docx`, makeDocx(d), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); };

/* ---------- procedure ---------- */
function renderSteps() {
  $('#steps').innerHTML = `<thead><tr><th>#</th><th>Step</th><th>Provision</th><th>Due by</th></tr></thead><tbody>${C.steps(st).map((x, i) => `<tr><td>${i + 1}</td><td class="wrapc">${esc(x.step)}</td><td class="small">${esc(x.law)}</td><td>${esc(x.due || '')}</td></tr>`).join('')}</tbody>`;
}
function renderChecks() { const order = { err: 0, warn: 1, info: 2, ok: 3 }; $('#issues').innerHTML = C.checks(st).sort((a, b) => order[a[0]] - order[b[0]]).map(([k, t]) => `<div class="m-${k}">${esc(t)}</div>`).join(''); }

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
    const tag = (st.co.name || 'Company').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30) + '_' + (st.dir.name || 'Director').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 20);
    download(`Appointment_of_director_${tag}.zip`, z.generate({ type: 'uint8array', compression: 'DEFLATE' }), 'application/zip');
    msg('#outMsgs', 'ok', `${list.length} document(s) downloaded. Check every document before it is printed and signed.`); }
  catch (e) { msg('#outMsgs', 'err', 'Not downloaded: ' + (e.message || e)); }
};

/* ---------- Excel template and import ---------- */
$('#dlXlsx').onclick = async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Details'), it = wb.addWorksheet('Other interests');
  ws.columns = [{ header: 'Section', width: 18 }, { header: 'Particulars', width: 62 }, { header: 'Value', width: 50 }, { header: 'key', width: 10, hidden: true }];
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; ['A1', 'B1', 'C1'].forEach(r => ws.getCell(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FAE' } });
  C.FIELDS.forEach(([k, label, sec, type, opts]) => { const row = ws.addRow([sec, label, type === 'select' ? (opts.find(o => o[0] === getP(st, k)) || opts[0])[1] : (getP(st, k) || ''), k]);
    const c = row.getCell(3); c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; c.alignment = { wrapText: true };
    if (type === 'select') c.dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + opts.map(o => o[1].replace(/"/g, '').replace(/,/g, ' ')).join(',') + '"'] };
    if (type === 'date') c.numFmt = '@'; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  it.columns = [{ header: 'S. No.', width: 7 }, { header: 'Name of the company / LLP / firm / body', width: 44 }, { header: 'CIN / LLPIN / registration no.', width: 26 }, { header: 'Nature of interest (Director / Partner / Member …)', width: 26 }, { header: 'Shareholding', width: 14 }, { header: 'Date interest arose (DD-MM-YYYY)', width: 18 }, { header: 'Date of cessation, if any', width: 18 }];
  it.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; for (let i = 1; i <= 7; i++) it.getCell(1, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FAE' } };
  (st.dir.interests || []).forEach((x, i) => it.addRow([i + 1, x.name, x.cin, x.nature, x.share, x.date, x.ceased]));
  const n = wb.addWorksheet('Instructions'); n.getColumn(1).width = 120;
  ['Appointment of a Director – details for the ROC compliance tool.', '', 'Fill the yellow "Value" column of the Details sheet; dates as DD-MM-YYYY. Choose from the drop-down where one is given.', 'List in "Other interests" every company, LLP, firm or body in which the director is a director, partner or member (for Forms MBP-1 and DIR-8).', 'Do not change the hidden "key" column. Do not enter Aadhaar numbers or passwords.']
    .forEach((t, i) => { n.getCell('A' + (i + 1)).value = t; if (!i) n.getCell('A1').font = { bold: true }; });
  download('ROC_Appointment_of_Director_details.xlsx', await wb.xlsx.writeBuffer(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};
$('#upXlsx').onclick = () => $('#xlsxFile').click();
$('#xlsxFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const sh = LLPXlsx.readWorkbook(new Uint8Array(await f.arrayBuffer()));
    const det = sh['Details']; if (!det) throw new Error('the "Details" sheet of the template was not found');
    const rowOf = r => +r.replace(/^[A-Z]+/, ''); let n = 0;
    Object.keys(det).filter(r => /^D\d+$/.test(r) && rowOf(r) > 1).forEach(r => { const k = String(det[r]).trim(), F = FIELD[k]; if (!F) return; let val = det['C' + rowOf(r)];
      if (val === undefined || val === null || val === '') return;
      if (F[3] === 'date') { const d = LLPXlsx.date(val); val = d ? d.split('-').reverse().join('-') : String(val).trim(); }
      else if (F[3] === 'select') { const s = String(val).trim().toLowerCase(), o = F[4].find(([vv, l]) => vv.toLowerCase() === s || l.replace(/,/g, ' ').toLowerCase() === s || l.toLowerCase() === s); val = o ? o[0] : getP(st, k); }
      else val = LLPXlsx.str(val);
      if (k === 'dir.pan' || k === 'co.cin') val = String(val).toUpperCase();
      setP(st, k, val); n++; });
    const it = sh['Other interests'], L = [];
    if (it) { const rows = {}; Object.keys(it).forEach(r => { const c = r.replace(/\d+$/, ''), rr = rowOf(r); (rows[rr] = rows[rr] || {})[c] = it[r]; });
      Object.keys(rows).map(Number).filter(r => r > 1).sort((a, b) => a - b).forEach(r => { const R = rows[r]; if (!R.B) return; const d = R.F !== undefined ? LLPXlsx.date(R.F) : '';
        L.push({ name: LLPXlsx.str(R.B), cin: LLPXlsx.str(R.C), nature: LLPXlsx.str(R.D) || 'Director', share: LLPXlsx.str(R.E), date: d ? d.split('-').reverse().join('-') : LLPXlsx.str(R.F), ceased: LLPXlsx.str(R.G) }); });
      st.dir.interests = L; }
    save(); buildForm(); renderInt(); refresh();
    msg('#topMsgs', 'ok', `${f.name}: ${n} detail(s) and ${L.length} other interest(s) imported. Check the details below.`);
  } catch (err) { msg('#topMsgs', 'err', `Not imported: ${err.message || err}`); }
};

/* ---------- case files ---------- */
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function msg(el, k, t) { $(el).innerHTML = t ? `<div class="m-${k}">${esc(t)}</div>` : ''; }
$('#saveCase').onclick = () => download(`ROC_${(st.co.name || 'company').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 30)}_appointment.json`, JSON.stringify(st, null, 1), 'application/json');
$('#openCase').onclick = () => $('#caseFile').click();
$('#caseFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.kind !== 'roc-case') throw 0; st = merge(C.blank(), d); save(); buildForm(); renderInt(); refresh(); $('#letterhead').checked = st.letterhead !== false; msg('#topMsgs', 'ok', `Opened ${f.name}.`); }
  catch (err) { msg('#topMsgs', 'err', 'That file is not a ROC compliance case file.'); } };
$('#newCase').onclick = async () => { if (await ask('Start a new case?', 'The details on screen will be cleared. Save the case file first if you need it.')) { st = C.blank(); save(); buildForm(); renderInt(); refresh(); msg('#topMsgs', '', ''); } };
function ask(title, html) { return new Promise(done => { $('#askTitle').textContent = title; $('#askBody').innerHTML = html; const dl = $('#askDlg'); const end = v => { dl.close(); done(v); }; $('#askYes').onclick = () => end(true); $('#askNo').onclick = () => end(false); dl.oncancel = () => done(false); dl.showModal(); }); }

function refresh(redoc = true) {
  showSections(); renderReq(); renderSteps(); renderChecks();
  if (redoc) { picked = null; renderDocs(); }
  const req = ['co.name', 'co.cin', 'dir.name', 'dir.dob', 'dir.pan', 'dir.address', 'sign.name'], done = req.filter(k => getP(st, k)).length;
  $('#fillPill').textContent = `${done} of ${req.length} key details filled`;
}
window.RocTool = { state: () => st, makeDocx, docs: () => C.docs(st) };
buildForm(); renderInt(); refresh();
})();
