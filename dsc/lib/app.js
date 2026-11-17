/* DSC Register – page logic */
(function () {
"use strict";
const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const S = window.DscStore;
const PURPOSES = ['GST', 'MCA', 'Income Tax', 'TDS (TRACES)', 'EPFO', 'ESIC', 'ICEGATE', 'DGFT', 'Bank', 'e-Tender'];
const LS = { draft: 'dsc-draft-v1', user: 'dsc-user' };
const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* not kept */ } };
const blank = () => ({ kind: 'dsc-register', version: 1, updated: '', updatedBy: '', records: [] });
let reg = Object.assign(blank(), get(LS.draft, {}));
let mode = 'local';            // 'local' | 'rw' (folder, editing) | 'ro' (folder, read only – another person has it open)
let otherLock = null, beatTimer = null, filter = 'all', savedAt = null, savedWhere = '';
const user = () => ($('#user').value || '').trim();
$('#user').value = get(LS.user, '');
$('#user').onchange = () => set(LS.user, user());

/* ---------- dates ---------- */
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayNo = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; };
const daysLeft = r => { const a = dayNo(r.validTill), b = dayNo(todayIso()); return a === null ? null : a - b; };
const dmy = iso => iso ? iso.split('-').reverse().join('-') : '';
const band = d => d === null ? 'none' : d < 0 ? 'exp' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'ok';
const stamp = t => new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const uid = () => 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- saving ---------- */
async function persist(note) {
  reg.updated = new Date().toISOString(); reg.updatedBy = user() || reg.updatedBy;
  set(LS.draft, reg);
  if (mode === 'rw') {
    try {
      const r = await S.write(reg);
      if (r.conflict) { conflict(r.other); return false; }
      savedAt = Date.now(); savedWhere = 'folder'; showSaved();
      msg('ok', `${note ? note + ' – ' : ''}saved in the folder at ${stamp(Date.now())}.`);
    } catch (e) { msg('err', `Not saved in the folder: ${e.message || e}. Your change is kept in this browser; try again.`); return false; }
  } else if (mode === 'local') { savedAt = Date.now(); savedWhere = 'browser'; showSaved(); }
  if (mode === 'local' && note) msg('ok', `${note} – kept in this browser. Use "Save a copy (JSON)" to keep it in a file${S.supported ? ', or choose the folder of the register' : ''}.`);
  return true;
}
function conflict(other) {
  banner('ro', `The register in the folder was changed by ${esc((other && other.updatedBy) || 'someone else')}${other && other.updated ? ' at ' + stamp(other.updated) : ''} after you opened it. Your last change has not been saved there.
    <div class="bar" style="margin-top:6px"><button type="button" id="cfReload">Load their version (your last change is lost)</button><button type="button" id="cfMine" class="danger">Save my version over theirs</button></div>`);
  $('#cfReload').onclick = async () => { await openFolder(true); };
  $('#cfMine').onclick = async () => { if (await ask('Overwrite?', 'The register in the folder will be replaced with the one on your screen; changes made by the other person since you opened it will be lost (the daily backup keeps the earlier version).')) { await S.read(); const r = await S.write(reg); if (r.ok) { banner(); msg('ok', 'Saved over the other version.'); } } };
}

/* ---------- folder and lock ---------- */
function banner(kind, html) { $('#banner').innerHTML = kind ? `<div class="banner ${kind}">${html}</div>` : ''; }
function msg(k, t) { $('#topMsgs').innerHTML = t ? `<div class="m-${k}">${esc(t)}</div>` : ''; }
async function openFolder(silent) {
  if (!user()) { $('#user').focus(); msg('warn', 'Enter your name first – it is shown to others who open the register while you have it open.'); return; }
  set(LS.user, user());
  clearInterval(beatTimer); document.body.classList.remove('closed');
  const lk = await S.acquire(user(), false);
  savedAt = null; if (lk.busy) { mode = 'ro'; otherLock = lk.lock; }
  let note = '';
  if (lk.busy) { /* read only */ } else { mode = 'rw'; otherLock = null; if (lk.stale) note = ` ${lk.stale.user} had left it open without closing (last active ${stamp(lk.stale.beat)}); it is now open for you.`; }
  const r = await S.read();
  if (r && r.data) reg = Object.assign(blank(), r.data);
  else if (mode === 'rw') {
    const local = get(LS.draft, null);
    if (local && local.records && local.records.length && await ask('Start the register in this folder?', `There is no register in "${esc(S.dirName())}" yet. Put the ${local.records.length} DSC(s) on this screen into it?`)) reg = Object.assign(blank(), local);
    else reg = blank();
    await S.write(reg);
  }
  set(LS.draft, reg);
  showMode();
  beatTimer = setInterval(tick, 30000);
  render();
  if ((!silent || note) && mode === 'rw') msg(note ? 'info' : 'ok', `Register opened from the folder "${S.dirName()}" – ${reg.records.length} DSC(s).${note}`);
}
async function tick() {
  try {
    if (mode === 'rw') { const h = await S.heartbeat(user()); if (h.lost) { mode = 'ro'; otherLock = h.lock; showMode(); render(); } }
    else if (mode === 'ro') { otherLock = await S.peekLock(); const r = await S.read(); if (r && r.data) reg = Object.assign(blank(), r.data); showMode(); render(); }
  } catch (e) { /* folder not reachable now – try again at the next tick */ }
}
function showMode() {
  const ro = mode === 'ro';
  document.body.classList.toggle('readonly', ro);
  $$('.edit-only').forEach(b => b.classList.toggle('ro-hide', ro));
  $('#where').textContent = mode === 'local' ? 'in this browser only' : `folder: ${S.dirName()}${ro ? ' · read only' : mode === 'closed' ? ' · closed' : ''}`;
  $$('.edit-only').forEach(b => b.classList.toggle('ro-hide', ro || mode === 'closed'));
  showSaved();
  $('#folderInfo').innerHTML = mode === 'local' ? '' : `<span class="hint">File <b>${S.FILE}</b> in the folder <b>${esc(S.dirName())}</b>${reg.updated ? ` · last saved ${stamp(reg.updated)} by ${esc(reg.updatedBy || '–')}` : ''}. A backup of the previous version is kept in its <b>backup</b> folder once a day.</span>`;
  if (ro) {
    const l = otherLock || {}, free = !l.beat || Date.now() - l.beat >= S.STALE_MS;
    banner('ro', `${free ? 'The register is no longer in use by anyone else.' : `<b>The register is open with ${esc(l.user || 'another person')}</b> (since ${l.since ? stamp(l.since) : '–'}, last active ${l.beat ? stamp(l.beat) : '–'}).`} You are seeing it <b>read only</b>, refreshed every 30 seconds – changes cannot be made, to avoid overwriting each other's work.
      <div class="bar" style="margin-top:6px"><button type="button" id="roRetry">${free ? 'Open for editing' : 'Check again'}</button>${free ? '' : `<button type="button" id="roTake" class="danger">Take over editing</button>`}</div>`);
    $('#roRetry').onclick = () => openFolder();
    if ($('#roTake')) $('#roTake').onclick = async () => { if (await ask('Take over?', `${esc(l.user || 'The other person')} may be making changes now; if you take over, their unsaved changes may not be saved (they will see that you took over). Take over only if you have checked with them.`)) { await S.acquire(user(), true); openFolder(); } };
  } else banner();
  $('#modeHint').textContent = mode === 'local'
    ? (S.supported ? 'Choose the folder where the register is to be kept (e.g. a shared office folder). The tool remembers it; whoever opens the tool uses the same file, and only one person can edit at a time.' : 'This browser cannot keep the register in a folder (use Chrome or Edge for that). The register is kept in this browser – use "Save a copy (JSON)" and "Open a JSON file" to keep it in a file.')
    : (mode === 'rw' ? 'Every change is saved in the folder as soon as it is made. When you finish, click "Save and close" so that others can edit.' : '');
}
$('#chooseFolder').onclick = async () => {
  if (!S.supported) { msg('warn', 'Keeping the register in a folder needs Chrome or Edge. In this browser use "Save a copy (JSON)".'); return; }
  if (!user()) { $('#user').focus(); msg('warn', 'Enter your name first.'); return; }
  try { await S.release(); await S.connect(); await openFolder(); } catch (e) { if (e && e.name !== 'AbortError') msg('err', `The folder could not be used: ${e.message || e}`); }
};
$('#reconnect').onclick = async () => { try { const p = await S.permit(); if (p === 'granted') { $('#reconnect').hidden = true; await openFolder(); } else msg('warn', 'Permission to the folder was not given.'); } catch (e) { msg('err', e.message || String(e)); } };
window.addEventListener('pagehide', () => { if (mode === 'rw') S.release(); });

function showSaved() {
  const el = $('#savedAt'); if (!el) return;
  if (mode === 'closed') { el.className = 'saved'; el.textContent = 'Saved and closed.'; return; }
  if (mode === 'ro') { el.className = 'saved warn'; el.textContent = 'Read only – not editing.'; return; }
  if (!savedAt) { el.className = 'saved'; el.textContent = mode === 'rw' ? 'All changes are saved in the folder automatically.' : ''; return; }
  el.className = savedWhere === 'browser' ? 'saved warn' : 'saved';
  el.textContent = savedWhere === 'browser' ? `Saved in this browser only at ${stamp(savedAt)} – choose a folder or save a copy to keep it in a file.` : `All changes saved in the folder – last at ${stamp(savedAt)}.`;
}
$('#saveBtn').onclick = async () => {
  if (mode === 'ro' || mode === 'closed') return msg('warn', mode === 'ro' ? 'The register is open with someone else – it is read only for you.' : 'The register is closed – click "Open again" to edit.');
  if (mode === 'local') {
    if (S.supported && await ask('Where should the register be saved?', 'The register is now kept only in this browser. Choose a folder to keep it as a file there (recommended – it is then saved there after every change), or Cancel to download a copy (JSON) instead.')) { $('#chooseFolder').click(); return; }
    $('#saveJson').click(); savedAt = Date.now(); savedWhere = 'browser'; showSaved(); msg('ok', 'A copy (JSON) has been downloaded – keep it in a safe folder; open it next time with "Open a JSON file".'); return;
  }
  if (await persist('')) showSaved();
};
$('#closeBtn').onclick = async () => {
  if (mode === 'closed') return;
  if (mode === 'local') { $('#saveBtn').click(); return; }
  if (mode === 'rw') { const ok = await persist(''); if (!ok) return; }
  clearInterval(beatTimer);
  if (mode === 'rw') await S.release();
  mode = 'closed'; document.body.classList.add('closed'); banner();
  showMode(); showSaved(); render();
  $('#banner').innerHTML = `<div class="banner info">The register is saved and closed${S.dirName() ? ` (folder "${esc(S.dirName())}")` : ''}. Others can now open it for editing. You can close this page. <button type="button" id="reopen">Open again</button></div>`;
  $('#reopen').onclick = () => { document.body.classList.remove('closed'); openFolder(); };
};

/* ---------- table ---------- */
function purposeText(r) { return (r.purposes || []).concat(r.purposeOther ? [r.purposeOther] : []); }
function render() {
  const q = ($('#q').value || '').toLowerCase();
  const recs = reg.records.slice().sort((a, b) => (a.validTill || '9999') < (b.validTill || '9999') ? -1 : 1);
  const cnt = { exp: 0, d30: 0, d60: 0, d90: 0, ok: 0, none: 0, office: 0 };
  recs.forEach(r => { cnt[band(daysLeft(r))]++; if (r.location === 'Office') cnt.office++; });
  $('#kpis').innerHTML = [['DSCs', recs.length], ['Expired', cnt.exp], ['Expiring in 30 days', cnt.d30], ['31–60 days', cnt.d60], ['61–90 days', cnt.d90], ['Tokens in the office', cnt.office]].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  const chips = [['all', 'All'], ['exp', 'Expired'], ['d30', 'Within 30 days'], ['d60', '31–60 days'], ['d90', '61–90 days'], ['ok', 'Valid beyond 90 days'], ['office', 'Token in the office']];
  $('#chips').innerHTML = chips.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('');
  $$('#chips [data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
  const show = recs.filter(r => (filter === 'all' || (filter === 'office' ? r.location === 'Office' : band(daysLeft(r)) === filter))
    && (!q || `${r.company} ${r.name} ${r.mobile} ${r.pan} ${r.din} ${purposeText(r).join(' ')}`.toLowerCase().includes(q)));
  const ro = mode === 'ro';
  $('#tbl').innerHTML = `<thead><tr><th>#</th><th>Company / client</th><th>DSC holder</th><th>Valid till</th><th class="n">Days left</th><th>Purpose</th><th>Token with</th><th>Last movement</th><th></th></tr></thead><tbody>${show.map((r, i) => {
    const d = daysLeft(r), bd = band(d), last = (r.custody || [])[r.custody && r.custody.length - 1];
    return `<tr><td>${i + 1}</td><td class="wrap" style="white-space:normal">${esc(r.company)}</td><td style="white-space:normal">${esc(r.name)}${r.mobile ? `<br><span class="hint">${esc(r.mobile)}</span>` : ''}</td><td>${dmy(r.validTill)}</td>
      <td class="n d-${bd === 'd30' ? '30' : bd === 'd60' ? '60' : bd === 'd90' ? '90' : bd}">${d === null ? '–' : d < 0 ? `expired ${-d} d ago` : d}</td>
      <td style="white-space:normal">${purposeText(r).map(p => `<span class="tag">${esc(p)}</span>`).join('')}</td><td>${esc(r.location || '–')}</td>
      <td class="small">${last ? `${last.dir === 'In' ? 'In from' : 'Out to'} ${esc(last.person)}<br>${stamp(last.at)}` : ''}</td>
      <td style="white-space:nowrap"><button type="button" class="link sm" data-edit="${r.id}">${ro ? 'View' : 'Edit'}</button> · <button type="button" class="link sm" data-cust="${r.id}">In / out</button> · <button type="button" class="link sm" data-rem="${r.id}">Reminder</button></td></tr>`; }).join('') || `<tr><td colspan="9" class="hint" style="padding:14px">${reg.records.length ? 'Nothing matches.' : 'No DSCs yet – add one, or import your Excel list.'}</td></tr>`}</tbody>`;
  $$('[data-edit]').forEach(b => b.onclick = () => edit(b.dataset.edit));
  $$('[data-cust]').forEach(b => b.onclick = () => custody(b.dataset.cust));
  $$('[data-rem]').forEach(b => b.onclick = () => remind(b.dataset.rem));
}
$('#q').oninput = render;

/* ---------- add / edit ---------- */
$('#purposeBox').innerHTML = PURPOSES.map(p => `<label><input type="checkbox" name="purposes" value="${esc(p)}"> ${esc(p)}</label>`).join('');
let editing = null;
function edit(id) {
  const f = $('#editForm'), r = id ? reg.records.find(x => x.id === id) : { purposes: [] };
  editing = id || null;
  ['company', 'name', 'validTill', 'location', 'purposeOther', 'mobile', 'email', 'pan', 'din', 'issuer', 'dscType', 'serial', 'remarks'].forEach(k => f.elements[k].value = r[k] || '');
  $$('#purposeBox input').forEach(c => c.checked = (r.purposes || []).includes(c.value));
  $('#editTitle').textContent = id ? `${r.name} – ${r.company}` : 'Add a DSC';
  $('#delBtn').hidden = !id || mode === 'ro';
  $$('#editForm input, #editForm select, #editForm textarea').forEach(el => el.disabled = mode === 'ro');
  $('#editForm button[type=submit]').hidden = mode === 'ro';
  $('#editDlg').showModal();
}
$('#addBtn').onclick = () => { if (mode !== 'closed') edit(null); };
$('#editCancel').onclick = () => $('#editDlg').close();
$('#editForm').addEventListener('submit', async () => {
  if (mode === 'ro') return;
  const f = $('#editForm'), v = {};
  ['company', 'name', 'validTill', 'location', 'purposeOther', 'mobile', 'email', 'pan', 'din', 'issuer', 'dscType', 'serial', 'remarks'].forEach(k => v[k] = f.elements[k].value.trim());
  v.pan = v.pan.toUpperCase(); v.purposes = $$('#purposeBox input').filter(c => c.checked).map(c => c.value);
  if (editing) Object.assign(reg.records.find(x => x.id === editing), v, { updatedAt: new Date().toISOString() });
  else reg.records.push(Object.assign({ id: uid(), custody: [], created: new Date().toISOString() }, v));
  render(); await persist(editing ? 'Changed' : 'Added');
});
$('#delBtn').onclick = async () => { const r = reg.records.find(x => x.id === editing); if (!r) return;
  if (await ask('Delete this DSC?', `${esc(r.name)} – ${esc(r.company)} will be removed from the register.`)) { reg.records = reg.records.filter(x => x !== r); $('#editDlg').close(); render(); await persist('Deleted'); } };

/* ---------- custody ---------- */
let custId = null;
function custody(id) {
  const r = reg.records.find(x => x.id === id); custId = id;
  $('#custTitle').textContent = `Token in / out – ${r.name} (${r.company})`;
  const f = $('#custForm'), now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  f.elements.at.value = now.toISOString().slice(0, 16); f.elements.person.value = ''; f.elements.note.value = '';
  f.elements.dir.value = r.location === 'Office' ? 'Out' : 'In';
  $$('#custForm input, #custForm select').forEach(el => el.disabled = mode === 'ro');
  $('#custLog').innerHTML = `<thead><tr><th>Date and time</th><th>Movement</th><th>From / to</th><th>Purpose</th><th>Recorded by</th></tr></thead><tbody>${(r.custody || []).slice().reverse().map(c => `<tr><td>${stamp(c.at)}</td><td>${c.dir === 'In' ? 'Received' : 'Handed over'}</td><td>${esc(c.person)}</td><td>${esc(c.note)}</td><td>${esc(c.by)}</td></tr>`).join('') || '<tr><td colspan="5" class="hint">No movements recorded.</td></tr>'}</tbody>`;
  $('#ackBtn').hidden = !(r.custody || []).length;
  $('#custDlg').showModal();
}
$('#custCancel').onclick = () => $('#custDlg').close();
$('#custForm').addEventListener('submit', async () => {
  if (mode === 'ro') return;
  const r = reg.records.find(x => x.id === custId), f = $('#custForm');
  const c = { at: new Date(f.elements.at.value).toISOString(), dir: f.elements.dir.value, person: f.elements.person.value.trim(), note: f.elements.note.value.trim(), by: user() };
  (r.custody = r.custody || []).push(c); r.location = c.dir === 'In' ? 'Office' : 'Client';
  render(); await persist(`Token ${c.dir === 'In' ? 'received from' : 'handed over to'} ${c.person}`);
});
$('#ackBtn').onclick = () => {
  const r = reg.records.find(x => x.id === custId), c = r.custody[r.custody.length - 1];
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a5' }), firm = (window.HOME_CONFIG && HOME_CONFIG.firmName) || '';
  let y = 16; const line = (t, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 10); doc.splitTextToSize(t, 124).forEach(l => { doc.text(l, 12, y); y += (o.s || 10) * 0.5; }); y += 2; };
  line(firm, { b: true, s: 12 }); line(c.dir === 'In' ? 'Acknowledgment – receipt of DSC token' : 'Acknowledgment – return of DSC token', { b: true, s: 11 }); y += 2;
  [['DSC holder', r.name], ['Company / client', r.company], ['Valid till', dmy(r.validTill)], ['Token', r.serial || '–'], [c.dir === 'In' ? 'Received from' : 'Handed over to', c.person], ['Date and time', stamp(c.at)], ['Purpose / remarks', c.note || '–']].forEach(([k, v]) => line(`${k}: ${v}`));
  y += 4; line(c.dir === 'In' ? 'The DSC token above has been received for safe custody and use for the purpose stated, and will be returned on request.' : 'The DSC token above has been returned / handed over.');
  y += 14; doc.setFontSize(9); doc.text(c.dir === 'In' ? 'Received by (for the firm)' : 'Handed over by (for the firm)', 12, y); doc.text(c.dir === 'In' ? 'Handed over by' : 'Received by', 90, y);
  doc.save(`DSC_${c.dir === 'In' ? 'receipt' : 'return'}_${(r.name || 'token').replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
};

/* ---------- reminder ---------- */
function remind(id) {
  const r = reg.records.find(x => x.id === id), d = daysLeft(r), firm = (window.HOME_CONFIG && HOME_CONFIG.firmName) || '';
  const txt = `Dear ${r.name},\n\nThe Digital Signature Certificate (DSC) of ${r.name}${r.company ? ` (${r.company})` : ''}${purposeText(r).length ? `, used for ${purposeText(r).join(', ')},` : ''} ${d !== null && d < 0 ? `expired on ${dmy(r.validTill)}` : `is valid till ${dmy(r.validTill)}${d !== null ? ` (${d} day${d === 1 ? '' : 's'} from today)` : ''}`}.\n\nPlease arrange for its renewal${d !== null && d < 0 ? '' : ' before that date'}, so that filings are not held up. Once renewed, the new certificate will have to be registered again on the portals where it is used.\n\nRegards,\n${user() || ''}${firm ? '\n' + firm : ''}`;
  $('#remText').value = txt;
  $('#remMail').href = `mailto:${encodeURIComponent(r.email || '')}?subject=${encodeURIComponent('Renewal of Digital Signature Certificate – ' + r.name)}&body=${encodeURIComponent(txt)}`;
  $('#remDlg').showModal();
}
$('#remCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#remText').value); $('#remCopy').textContent = 'Copied'; setTimeout(() => $('#remCopy').textContent = 'Copy', 1500); } catch (e) { $('#remText').select(); document.execCommand('copy'); } };
$('#remClose').onclick = () => $('#remDlg').close();

/* ---------- Excel import / export, JSON copy ---------- */
$('#importX').onclick = () => { if (mode === 'ro') return msg('warn', 'The register is read only now.'); $('#importFile').click(); };
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const sheets = LLPXlsx.readWorkbook(new Uint8Array(await f.arrayBuffer())), colOf = r => r.replace(/\d+$/, ''), rowOf = r => +r.replace(/^[A-Z]+/, '');
    let rows = [], hdrFound = false;
    for (const cells of Object.values(sheets)) {
      const byRow = {}; Object.keys(cells).forEach(ref => { (byRow[rowOf(ref)] = byRow[rowOf(ref)] || {})[colOf(ref)] = cells[ref]; });
      const rn = Object.keys(byRow).map(Number).sort((a, b) => a - b);
      const hr = rn.find(r => { const v = Object.values(byRow[r]).map(x => String(x).trim()); return v.some(x => /valid/i.test(x)) && v.some(x => /^name|holder/i.test(x)); });
      if (!hr) continue; hdrFound = true;
      const H = byRow[hr], find = re => Object.keys(H).find(c => re.test(String(H[c]).trim()));
      const C = { company: find(/^company|client|entity/i), name: find(/^name|holder/i), valid: find(/valid|expiry/i), purpose: find(/purpose|portal|use/i), mobile: find(/mobile|phone/i), email: find(/e-?mail/i), pan: find(/^pan/i), din: find(/^din/i), loc: find(/token\s*with|custody|location/i), remarks: find(/remark/i) };
      rn.filter(r => r > hr).forEach(r => { const R = byRow[r], g = k => C[k] ? String(R[C[k]] ?? '').trim() : '';
        if (!g('name') && !g('company')) return;
        const vd = C.valid ? LLPXlsx.date(R[C.valid]) : '';
        const ps = g('purpose').split(/[,\/&+;]|\band\b/i).map(s => s.trim()).filter(Boolean);
        const known = ps.map(p => PURPOSES.find(k => k.toLowerCase() === p.toLowerCase() || (p.toLowerCase() === 'it' && k === 'Income Tax') || (/roc|mca/i.test(p) && k === 'MCA'))).filter(Boolean);
        const other = ps.filter(p => !PURPOSES.some(k => k.toLowerCase() === p.toLowerCase()) && !(p.toLowerCase() === 'it') && !/roc|mca/i.test(p));
        rows.push({ id: uid(), company: g('company'), name: g('name'), validTill: vd || '', purposes: [...new Set(known)], purposeOther: other.join(', '), mobile: g('mobile'), email: g('email'), pan: g('pan').toUpperCase(), din: g('din'), location: /office/i.test(g('loc')) ? 'Office' : /client/i.test(g('loc')) ? 'Client' : '', remarks: g('remarks'), custody: [], created: new Date().toISOString(), badDate: vd === null });
      });
      break;
    }
    if (!hdrFound) throw new Error('no heading row with "Name" and "Valid Till" was found');
    const key = r => `${r.company}|${r.name}|${r.validTill}`.toLowerCase(), have = new Set(reg.records.map(key));
    const fresh = rows.filter(r => !have.has(key(r)));
    const bad = rows.filter(r => r.badDate || !r.validTill);
    if (!(await ask('Import?', `${rows.length} DSC(s) found in ${esc(f.name)}; ${fresh.length} new, ${rows.length - fresh.length} already in the register (skipped).${bad.length ? ` ${bad.length} without a readable "Valid till" date – check them after import.` : ''}`))) return;
    fresh.forEach(r => delete r.badDate); reg.records = reg.records.concat(fresh); render(); await persist(`${fresh.length} DSC(s) imported`);
  } catch (err) { msg('err', `Not imported: ${err.message || err}`); }
};
$('#exportX').onclick = async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('DSC register');
  const H = ['Sl No', 'Company', 'Name', 'Valid Till', 'Days left', 'Status', 'Purpose', 'Token with', 'Last movement', 'Mobile', 'Email', 'PAN', 'DIN', 'Issued by', 'Class / type', 'Token / serial', 'Remarks'];
  ws.addRow(H); ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; H.forEach((h, i) => { ws.getCell(1, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FAE' } }; ws.getColumn(i + 1).width = [6, 32, 26, 12, 10, 16, 26, 10, 30, 13, 26, 12, 10, 18, 22, 18, 30][i]; });
  const lab = { exp: 'Expired', d30: 'Within 30 days', d60: '31–60 days', d90: '61–90 days', ok: 'Valid', none: '–' };
  reg.records.slice().sort((a, b) => (a.validTill || '9999') < (b.validTill || '9999') ? -1 : 1).forEach((r, i) => { const d = daysLeft(r), last = (r.custody || [])[r.custody.length - 1];
    const row = ws.addRow([i + 1, r.company, r.name, r.validTill ? new Date(r.validTill + 'T00:00:00Z') : null, d, lab[band(d)], purposeText(r).join(', '), r.location || '', last ? `${last.dir === 'In' ? 'In from' : 'Out to'} ${last.person}, ${stamp(last.at)}` : '', r.mobile, r.email, r.pan, r.din, r.issuer, r.dscType, r.serial, r.remarks]);
    row.getCell(4).numFmt = 'dd-mm-yyyy'; if (d !== null && d <= 30) row.getCell(6).font = { bold: true, color: { argb: 'FFA32020' } }; });
  ws.views = [{ state: 'frozen', ySplit: 1 }]; ws.autoFilter = { from: 'A1', to: `Q${Math.max(2, reg.records.length + 1)}` };
  download(`DSC_register_${todayIso()}.xlsx`, await wb.xlsx.writeBuffer(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
$('#saveJson').onclick = () => download(`dsc_register_${todayIso()}.json`, JSON.stringify(reg, null, 1), 'application/json');
$('#openJson').onclick = () => { if (mode === 'ro') return msg('warn', 'The register is read only now.'); $('#jsonFile').click(); };
$('#jsonFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.kind !== 'dsc-register') throw 0;
    if (reg.records.length && !(await ask('Replace the register?', `The ${reg.records.length} DSC(s) on screen${mode === 'rw' ? ' (and in the folder)' : ''} will be replaced by the ${d.records.length} in ${esc(f.name)}.`))) return;
    reg = Object.assign(blank(), d); render(); await persist(`Opened ${f.name}`); }
  catch (err) { msg('err', 'That file is not a DSC register.'); } };

function ask(title, html) { return new Promise(done => { $('#askTitle').textContent = title; $('#askBody').innerHTML = html; const dl = $('#askDlg'); const end = v => { dl.close(); done(v); }; $('#askYes').onclick = () => end(true); $('#askNo').onclick = () => end(false); dl.oncancel = () => done(false); dl.showModal(); }); }

/* ---------- start ---------- */
(async () => {
  showMode(); render();
  if (!S.supported) return;
  const p = await S.restore();
  if (p === 'granted') await openFolder(true);
  else if (p) { $('#reconnect').hidden = false; $('#reconnect').textContent = `Reconnect to the folder "${S.dirName()}"`; msg('info', `The register is kept in the folder "${S.dirName()}" – click "Reconnect" to open it (the browser asks for permission once per visit).`); }
})();
window.DscTool = { reg: () => reg, mode: () => mode, openFolder, tick };
})();
