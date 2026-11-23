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

/* ---------- settings: key tag colours, locations (kept in the register, shared by all users) ---------- */
const defSettings = () => ({ tagColors: [{ name: 'Pink', hex: '#f4a6c6' }, { name: 'Orange', hex: '#f6a04d' }, { name: 'White', hex: '#ffffff' }, { name: 'Green', hex: '#5cb85c' }, { name: 'Blue', hex: '#4a90d9' }], locations: ['BSS Cabin', 'Box 1', 'Box 2'] });
const fixReg = d => { const x = Object.assign(blank(), d || {}); x.settings = Object.assign(defSettings(), (d && d.settings) || {}); return x; };
const tagHex = n => { const t = reg.settings.tagColors.find(c => c.name === n); return t ? t.hex : '#cccccc'; };
const inkOn = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#1d2330'; const v = parseInt(m[1], 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255; return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1d2330' : '#ffffff'; };
const swatch = n => n ? `<span class="keytag" style="background:${esc(tagHex(n))};color:${inkOn(tagHex(n))}">${esc(n)}</span>` : '–';
const fillSelects = () => {
  const S2 = reg.settings, opt = (list, sel) => '<option value="">–</option>' + list.map(v => `<option${v === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  $$('select[name=storage]').forEach(el => { const v = el.value; el.innerHTML = opt(S2.locations, v); });
  $$('select[name=tagColor]').forEach(el => { const v = el.value; el.innerHTML = opt(S2.tagColors.map(c => c.name), v); });
  const fl = $('#fLoc').value, ft = $('#fTag').value;
  $('#fLoc').innerHTML = `<option value="">All locations</option>${S2.locations.map(v => `<option${v === fl ? ' selected' : ''}>${esc(v)}</option>`).join('')}<option value="-"${fl === '-' ? ' selected' : ''}>(no location)</option>`;
  $('#fTag').innerHTML = `<option value="">All key tags</option>${S2.tagColors.map(c => `<option${c.name === ft ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="-"${ft === '-' ? ' selected' : ''}>(no key tag)</option>`;
};
function renderSettings() {
  const S2 = reg.settings, ro = locked() || mode === 'closed';
  const use = (k, v) => reg.records.filter(r => r[k] === v).length;
  $('#setTags').innerHTML = S2.tagColors.map((c, i) => `<div class="setrow"><input type="color" data-th="${i}" value="${esc(c.hex)}"${ro ? ' disabled' : ''}><input type="text" data-tn="${i}" value="${esc(c.name)}"${ro ? ' disabled' : ''}><span class="hint">${use('tagColor', c.name)} DSC(s)</span>${ro ? '' : `<button type="button" class="link sm danger" data-td="${i}">Delete</button>`}</div>`).join('') || '<p class="hint">None.</p>';
  $('#setLocs').innerHTML = S2.locations.map((l, i) => `<div class="setrow"><input type="text" data-ln="${i}" value="${esc(l)}"${ro ? ' disabled' : ''}><span class="hint">${use('storage', l)} DSC(s)</span>${ro ? '' : `<button type="button" class="link sm danger" data-ld="${i}">Delete</button>`}</div>`).join('') || '<p class="hint">None.</p>';
  ['newTag', 'newTagHex', 'addTag', 'newLoc', 'addLoc'].forEach(id => $('#' + id).disabled = ro);
  const save = async note => { fillSelects(); render(); renderSettings(); await persist(note); };
  $$('[data-th]').forEach(el => el.onchange = () => { S2.tagColors[+el.dataset.th].hex = el.value; save('Key tag colour changed'); });
  $$('[data-tn]').forEach(el => el.onchange = () => { const i = +el.dataset.tn, old = S2.tagColors[i].name, nw = el.value.trim();
    if (!nw || S2.tagColors.some((c, j) => j !== i && c.name.toLowerCase() === nw.toLowerCase())) { el.value = old; return msg('warn', 'That colour name is blank or already in the list.'); }
    S2.tagColors[i].name = nw; reg.records.forEach(r => { if (r.tagColor === old) r.tagColor = nw; }); save(`Key tag "${old}" renamed to "${nw}"`); });
  $$('[data-td]').forEach(el => el.onclick = async () => { const c = S2.tagColors[+el.dataset.td], n = use('tagColor', c.name);
    if (!(await ask(`Delete the colour "${esc(c.name)}"?`, n ? `${n} DSC(s) have this key tag – it will be cleared from them.` : 'No DSC uses it.'))) return;
    reg.records.forEach(r => { if (r.tagColor === c.name) r.tagColor = ''; }); S2.tagColors.splice(+el.dataset.td, 1); $('#setDlg').open || $('#setDlg').showModal(); save(`Key tag "${c.name}" deleted`); });
  $$('[data-ln]').forEach(el => el.onchange = () => { const i = +el.dataset.ln, old = S2.locations[i], nw = el.value.trim();
    if (!nw || S2.locations.some((l, j) => j !== i && l.toLowerCase() === nw.toLowerCase())) { el.value = old; return msg('warn', 'That location is blank or already in the list.'); }
    S2.locations[i] = nw; reg.records.forEach(r => { if (r.storage === old) r.storage = nw; }); save(`Location "${old}" renamed to "${nw}"`); });
  $$('[data-ld]').forEach(el => el.onclick = async () => { const l = S2.locations[+el.dataset.ld], n = use('storage', l);
    if (!(await ask(`Delete the location "${esc(l)}"?`, n ? `${n} DSC(s) are kept there – the location will be cleared from them.` : 'No DSC is kept there.'))) return;
    reg.records.forEach(r => { if (r.storage === l) r.storage = ''; }); S2.locations.splice(+el.dataset.ld, 1); $('#setDlg').open || $('#setDlg').showModal(); save(`Location "${l}" deleted`); });
  $('#addTag').onclick = () => { const n = $('#newTag').value.trim(); if (!n) return; if (S2.tagColors.some(c => c.name.toLowerCase() === n.toLowerCase())) return msg('warn', `"${n}" is already in the list.`); S2.tagColors.push({ name: n, hex: $('#newTagHex').value }); $('#newTag').value = ''; save(`Key tag "${n}" added`); };
  $('#addLoc').onclick = () => { const n = $('#newLoc').value.trim(); if (!n) return; if (S2.locations.some(l => l.toLowerCase() === n.toLowerCase())) return msg('warn', `"${n}" is already in the list.`); S2.locations.push(n); $('#newLoc').value = ''; save(`Location "${n}" added`); };
}
$('#setBtn').onclick = () => { renderSettings(); $('#setDlg').showModal(); };
$('#setClose').onclick = () => $('#setDlg').close();
$('#fLoc').onchange = () => render(); $('#fTag').onchange = () => render();
let reg = fixReg(get(LS.draft, {}));
let mode = 'local';            // 'local' | 'rw' (folder, editing) | 'ro' (folder, read only – another person has it open)
let otherLock = null, beatTimer = null, filter = 'all', savedAt = null, savedWhere = '';
const user = () => ($('#user').value || '').trim();
$('#user').value = get(LS.user, '') || (window.KitDB ? window.KitDB.user() : '');
$('#user').onchange = () => { set(LS.user, user()); if (window.KitDB) window.KitDB.setUser(user()); };
/* the database folder is known (connected earlier) but not opened yet in this visit – editing waits for it */
const needConn = () => mode === 'local' && S.supported && S.hasDir();
const locked = () => mode === 'ro' || needConn();  // no editing: someone else has it, or the folder is not opened yet
/* name of the person (asked if missing), then the browser's permission for the folder, then open the register */
async function connectKnown() {
  if (!user()) { const n = (prompt('Your name – shown to others who open the register while you have it open:', '') || '').trim(); if (!n) { msg('warn', 'Enter your name to open the register.'); return false; } $('#user').value = n; }
  set(LS.user, user()); if (window.KitDB) window.KitDB.setUser(user());
  try { const p = await S.permit(); if (p !== 'granted') { msg('warn', 'Permission to the database folder was not given – click "Open the register" again and answer "Allow" / "Edit files".'); return false; } }
  catch (e) { msg('err', window.KitDB.why(e)); return false; }
  $('#reconnect').hidden = true; banner(); await openFolder(); return mode !== 'local';
}

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
  if (mode === 'local' && note) msg('ok', `${note} – kept in this browser. Use "Save a copy (JSON)" to keep it in a file${S.supported ? ', or connect the database folder' : ''}.`);
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
  if (!user()) { const n = (prompt('Your name – shown to others who open the register while you have it open:', '') || '').trim(); if (!n) { $('#user').focus(); msg('warn', 'Enter your name first – it is shown to others who open the register while you have it open.'); return; } $('#user').value = n; if (window.KitDB) window.KitDB.setUser(n); }
  set(LS.user, user());
  clearInterval(beatTimer); document.body.classList.remove('closed');
  const lk = await S.acquire(user(), false);
  savedAt = null; if (lk.busy) { mode = 'ro'; otherLock = lk.lock; }
  let note = '';
  if (lk.busy) { /* read only */ } else { mode = 'rw'; otherLock = null; if (lk.stale) note = ` ${lk.stale.user} had left it open without closing (last active ${stamp(lk.stale.beat)}); it is now open for you.`; }
  const r = await S.read();
  if (r && r.data) reg = fixReg(r.data);
  else if (mode === 'rw') {
    const local = get(LS.draft, null);
    if (local && local.records && local.records.length && await ask('Start the register in this folder?', `There is no register in "${esc(S.dirName())}" yet. Put the ${local.records.length} DSC(s) on this screen into it?`)) reg = fixReg(local);
    else reg = fixReg(null);
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
    else if (mode === 'ro') { otherLock = await S.peekLock(); const r = await S.read(); if (r && r.data) reg = fixReg(r.data); showMode(); render(); }
  } catch (e) { /* folder not reachable now – try again at the next tick */ }
}
function showMode() {
  const ro = mode === 'ro';
  document.body.classList.toggle('readonly', ro);
  $$('.edit-only').forEach(b => b.classList.toggle('ro-hide', ro));
  $('#where').textContent = mode === 'local' ? 'in this browser only' : `folder: ${S.dirName()}${ro ? ' · read only' : mode === 'closed' ? ' · closed' : ''}`;
  $$('.edit-only').forEach(b => b.classList.toggle('ro-hide', ro || mode === 'closed' || needConn()));
  showSaved(); if ($('#setDlg').open) renderSettings();
  $('#folderInfo').innerHTML = mode === 'local' ? '' : `<span class="hint">File <b>${S.FILE}</b> in the folder <b>${esc(S.dirName())}</b>${reg.updated ? ` · last saved ${stamp(reg.updated)} by ${esc(reg.updatedBy || '–')}` : ''}. A backup of the previous version is kept in its <b>backup</b> folder once a day.</span>`;
  if (ro) {
    const l = otherLock || {}, free = !l.beat || Date.now() - l.beat >= S.STALE_MS;
    banner('ro', `${free ? 'The register is no longer in use by anyone else.' : `<b>The register is open with ${esc(l.user || 'another person')}</b> (since ${l.since ? stamp(l.since) : '–'}, last active ${l.beat ? stamp(l.beat) : '–'}).`} You are seeing it <b>read only</b>, refreshed every 30 seconds – changes cannot be made, to avoid overwriting each other's work.
      <div class="bar" style="margin-top:6px"><button type="button" id="roRetry">${free ? 'Open for editing' : 'Check again'}</button>${free ? '' : `<button type="button" id="roTake" class="danger">Take over editing</button>`}</div>`);
    $('#roRetry').onclick = () => openFolder();
    if ($('#roTake')) $('#roTake').onclick = async () => { if (await ask('Take over?', `${esc(l.user || 'The other person')} may be making changes now; if you take over, their unsaved changes may not be saved (they will see that you took over). Take over only if you have checked with them.`)) { await S.acquire(user(), true); openFolder(); } };
  } else banner();
  $('#modeHint').textContent = mode === 'local'
    ? (S.supported ? 'Click "Connect the database folder" and choose the tool kit folder (the one that contains "shared") – the register is kept in its "database" folder, which all the tools use. Choose it once on each computer; whoever opens the tool uses the same file, and only one person can edit at a time.' : 'This browser cannot keep the register in a folder (use Chrome or Edge for that). The register is kept in this browser – use "Save a copy (JSON)" and "Open a JSON file" to keep it in a file.')
    : (mode === 'rw' ? 'Every change is saved in the folder as soon as it is made. When you finish, click "Save and close" so that others can edit.' : '');
}
$('#chooseFolder').onclick = async () => {
  if (!S.supported) { msg('warn', 'Keeping the register in a folder needs Chrome or Edge. In this browser use "Save a copy (JSON)".'); return; }
  if (!user()) { $('#user').focus(); msg('warn', 'Enter your name first.'); return; }
  try { await S.release(); await S.connect(); await openFolder(); } catch (e) { msg(e && e.name === 'AbortError' ? 'warn' : 'err', window.KitDB.why(e)); }
};
$('#reconnect').onclick = () => connectKnown();
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
  if (mode === 'local' && needConn()) { await connectKnown(); return; }
  if (mode === 'local') {
    if (S.supported && await ask('Where should the register be saved?', 'The database folder is not connected on this computer yet, so the register is kept only in this browser. Continue – choose the tool kit folder (the one that contains "shared"); the register is then kept in its "database" folder and saved there after every change. Cancel – download a copy (JSON) instead.')) { $('#chooseFolder').click(); return; }
    $('#saveJson').click(); savedAt = Date.now(); savedWhere = 'browser'; showSaved(); msg('ok', 'The register has been saved as a JSON file – keep it in a safe folder; open it next time with "Open a JSON file".'); return;
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
  fillSelects(); const fl = $('#fLoc').value, ft = $('#fTag').value;
  const show = recs.filter(r => (filter === 'all' || (filter === 'office' ? r.location === 'Office' : band(daysLeft(r)) === filter))
    && (!fl || (fl === '-' ? !r.storage : r.storage === fl)) && (!ft || (ft === '-' ? !r.tagColor : r.tagColor === ft))
    && (!q || `${r.company} ${r.name} ${r.mobile} ${r.pan} ${r.din} ${r.storage || ''} ${r.tagColor || ''} ${purposeText(r).join(' ')}`.toLowerCase().includes(q)));
  const ro = locked();
  $('#tbl').innerHTML = `<thead><tr><th>#</th><th>Company / client</th><th>DSC holder</th><th>Valid till</th><th class="n">Days left</th><th>Purpose</th><th>Token with</th><th>Location</th><th>Key tag</th><th>Last movement</th><th></th></tr></thead><tbody>${show.map((r, i) => {
    const d = daysLeft(r), bd = band(d), last = (r.custody || [])[r.custody && r.custody.length - 1];
    return `<tr><td${r.tagColor ? ` style="box-shadow:inset 6px 0 0 ${esc(tagHex(r.tagColor))}"` : ''}>${i + 1}</td><td class="wrap" style="white-space:normal">${esc(r.company)}</td><td style="white-space:normal">${esc(r.name)}${r.mobile ? `<br><span class="hint">${esc(r.mobile)}</span>` : ''}</td><td>${dmy(r.validTill)}</td>
      <td class="n d-${bd === 'd30' ? '30' : bd === 'd60' ? '60' : bd === 'd90' ? '90' : bd}">${d === null ? '–' : d < 0 ? `expired ${-d} d ago` : d}</td>
      <td style="white-space:normal">${purposeText(r).map(p => `<span class="tag">${esc(p)}</span>`).join('')}</td><td>${esc(r.location || '–')}</td><td>${esc(r.storage || '–')}</td><td style="white-space:nowrap">${swatch(r.tagColor)}</td>
      <td class="small">${last ? `${last.dir === 'In' ? 'In from' : 'Out to'} ${esc(last.person)}<br>${stamp(last.at)}` : ''}</td>
      <td style="white-space:nowrap"><button type="button" class="link sm" data-edit="${r.id}">${ro ? 'View' : 'Edit'}</button> · <button type="button" class="link sm" data-cust="${r.id}">In / out</button> · <button type="button" class="link sm" data-rem="${r.id}">Reminder</button></td></tr>`; }).join('') || `<tr><td colspan="11" class="hint" style="padding:14px">${reg.records.length ? 'Nothing matches.' : 'No DSCs yet – add one, or import your Excel list.'}</td></tr>`}</tbody>`;
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
  editing = id || null; fillSelects();
  const tsel = f.elements.tagColor, prev = () => { $('#tagPrev').innerHTML = swatch(tsel.value); }; tsel.onchange = prev; setTimeout(prev, 0);
  ['company', 'name', 'validTill', 'location', 'storage', 'tagColor', 'purposeOther', 'mobile', 'email', 'pan', 'din', 'issuer', 'dscType', 'serial', 'remarks'].forEach(k => f.elements[k].value = r[k] || '');
  $$('#purposeBox input').forEach(c => c.checked = (r.purposes || []).includes(c.value));
  $('#editTitle').textContent = id ? `${r.name} – ${r.company}` : 'Add a DSC';
  $('#delBtn').hidden = !id || locked();
  $$('#editForm input, #editForm select, #editForm textarea').forEach(el => el.disabled = locked());
  $('#editForm button[type=submit]').hidden = locked();
  $('#editDlg').showModal();
}
$('#addBtn').onclick = () => { if (mode !== 'closed') edit(null); };
$('#editCancel').onclick = () => $('#editDlg').close();
$('#editForm').addEventListener('submit', async () => {
  if (locked()) return;
  const f = $('#editForm'), v = {};
  ['company', 'name', 'validTill', 'location', 'storage', 'tagColor', 'purposeOther', 'mobile', 'email', 'pan', 'din', 'issuer', 'dscType', 'serial', 'remarks'].forEach(k => v[k] = f.elements[k].value.trim());
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
  f.elements.dir.value = r.location === 'Office' ? 'Out' : 'In'; fillSelects(); f.elements.storage.value = r.storage || '';
  const inOnly = () => $('#custForm .inOnly').style.display = f.elements.dir.value === 'In' ? '' : 'none'; f.elements.dir.onchange = inOnly; inOnly();
  $$('#custForm input, #custForm select').forEach(el => el.disabled = locked());
  $('#custLog').innerHTML = `<thead><tr><th>Date and time</th><th>Movement</th><th>From / to</th><th>Purpose</th><th>Recorded by</th></tr></thead><tbody>${(r.custody || []).slice().reverse().map(c => `<tr><td>${stamp(c.at)}</td><td>${c.dir === 'In' ? 'Received' : 'Handed over'}</td><td>${esc(c.person)}</td><td>${esc(c.note)}</td><td>${esc(c.by)}</td></tr>`).join('') || '<tr><td colspan="5" class="hint">No movements recorded.</td></tr>'}</tbody>`;
  $('#ackBtn').hidden = !(r.custody || []).length;
  $('#custDlg').showModal();
}
$('#custCancel').onclick = () => $('#custDlg').close();
$('#custForm').addEventListener('submit', async () => {
  if (locked()) return;
  const r = reg.records.find(x => x.id === custId), f = $('#custForm');
  const c = { at: new Date(f.elements.at.value).toISOString(), dir: f.elements.dir.value, person: f.elements.person.value.trim(), note: f.elements.note.value.trim(), by: user() };
  if (c.dir === 'In') { c.storage = f.elements.storage.value; if (c.storage) r.storage = c.storage; }
  (r.custody = r.custody || []).push(c); r.location = c.dir === 'In' ? 'Office' : 'Client';
  render(); await persist(`Token ${c.dir === 'In' ? 'received from' : 'handed over to'} ${c.person}`);
});
$('#ackBtn').onclick = () => {
  const r = reg.records.find(x => x.id === custId), c = r.custody[r.custody.length - 1];
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'a5' }), firm = (window.HOME_CONFIG && HOME_CONFIG.firmName) || '';
  let y = 16; const line = (t, o = {}) => { doc.setFont('helvetica', o.b ? 'bold' : 'normal'); doc.setFontSize(o.s || 10); doc.splitTextToSize(t, 124).forEach(l => { doc.text(l, 12, y); y += (o.s || 10) * 0.5; }); y += 2; };
  line(firm, { b: true, s: 12 }); line(c.dir === 'In' ? 'Acknowledgment – receipt of DSC token' : 'Acknowledgment – return of DSC token', { b: true, s: 11 }); y += 2;
  [['DSC holder', r.name], ['Company / client', r.company], ['Valid till', dmy(r.validTill)], ['Token', r.serial || '–'], ['Key tag / location', [r.tagColor, r.storage].filter(Boolean).join(' / ') || '–'], [c.dir === 'In' ? 'Received from' : 'Handed over to', c.person], ['Date and time', stamp(c.at)], ['Purpose / remarks', c.note || '–']].forEach(([k, v]) => line(`${k}: ${v}`));
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
$('#importX').onclick = () => { if (needConn()) return connectKnown(); if (locked()) return msg('warn', 'The register is read only now.'); $('#importFile').click(); };
const matchList = (v, list) => { if (!v) return ''; const m = list.find(x => x.toLowerCase().replace(/\s+/g, '') === v.toLowerCase().replace(/\s+/g, '')); return m || v; };
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
      const C = { company: find(/^company|client|entity/i), name: find(/^name|holder/i), valid: find(/valid|expiry/i), purpose: find(/purpose|portal|use/i), mobile: find(/mobile|phone/i), email: find(/e-?mail/i), pan: find(/^pan/i), din: find(/^din/i), loc: find(/token\s*with|custody/i), storage: find(/^location|box|kept\s*at|place/i), tag: find(/key\s*tag|tag\s*colou?r|colou?r/i), remarks: find(/remark/i) };
      rn.filter(r => r > hr).forEach(r => { const R = byRow[r], g = k => C[k] ? String(R[C[k]] ?? '').trim() : '';
        if (!g('name') && !g('company')) return;
        const vd = C.valid ? LLPXlsx.date(R[C.valid]) : '';
        const ps = g('purpose').split(/[,\/&+;]|\band\b/i).map(s => s.trim()).filter(Boolean);
        const known = ps.map(p => PURPOSES.find(k => k.toLowerCase() === p.toLowerCase() || (p.toLowerCase() === 'it' && k === 'Income Tax') || (/roc|mca/i.test(p) && k === 'MCA'))).filter(Boolean);
        const other = ps.filter(p => !PURPOSES.some(k => k.toLowerCase() === p.toLowerCase()) && !(p.toLowerCase() === 'it') && !/roc|mca/i.test(p));
        rows.push({ id: uid(), company: g('company'), name: g('name'), validTill: vd || '', purposes: [...new Set(known)], purposeOther: other.join(', '), mobile: g('mobile'), email: g('email'), pan: g('pan').toUpperCase(), din: g('din'), location: /office/i.test(g('loc')) ? 'Office' : /client/i.test(g('loc')) ? 'Client' : '', storage: matchList(g('storage'), reg.settings.locations), tagColor: matchList(g('tag'), reg.settings.tagColors.map(c => c.name)), remarks: g('remarks'), custody: [], created: new Date().toISOString(), badDate: vd === null });
      });
      break;
    }
    if (!hdrFound) throw new Error('no heading row with "Name" and "Valid Till" was found');
    const key = r => `${r.company}|${r.name}|${r.validTill}`.toLowerCase(), have = new Set(reg.records.map(key));
    const fresh = rows.filter(r => !have.has(key(r)));
    const bad = rows.filter(r => r.badDate || !r.validTill);
    if (!(await ask('Import?', `${rows.length} DSC(s) found in ${esc(f.name)}; ${fresh.length} new, ${rows.length - fresh.length} already in the register (skipped).${bad.length ? ` ${bad.length} without a readable "Valid till" date – check them after import.` : ''}`))) return;
    fresh.forEach(r => { delete r.badDate; if (r.storage && !reg.settings.locations.includes(r.storage)) reg.settings.locations.push(r.storage); if (r.tagColor && !reg.settings.tagColors.some(c => c.name === r.tagColor)) reg.settings.tagColors.push({ name: r.tagColor, hex: '#cccccc' }); }); reg.records = reg.records.concat(fresh); render(); await persist(`${fresh.length} DSC(s) imported`);
  } catch (err) { msg('err', `Not imported: ${err.message || err}`); }
};
$('#exportX').onclick = async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('DSC register');
  const H = ['Sl No', 'Company', 'Name', 'Valid Till', 'Days left', 'Status', 'Purpose', 'Token with', 'Location', 'Key tag colour', 'Last movement', 'Mobile', 'Email', 'PAN', 'DIN', 'Issued by', 'Class / type', 'Token / serial', 'Remarks'];
  ws.addRow(H); ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; H.forEach((h, i) => { ws.getCell(1, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FAE' } }; ws.getColumn(i + 1).width = [6, 32, 26, 12, 10, 16, 26, 10, 12, 12, 30, 13, 26, 12, 10, 18, 22, 18, 30][i]; });
  const lab = { exp: 'Expired', d30: 'Within 30 days', d60: '31–60 days', d90: '61–90 days', ok: 'Valid', none: '–' };
  reg.records.slice().sort((a, b) => (a.validTill || '9999') < (b.validTill || '9999') ? -1 : 1).forEach((r, i) => { const d = daysLeft(r), last = (r.custody || [])[r.custody.length - 1];
    const row = ws.addRow([i + 1, r.company, r.name, r.validTill ? new Date(r.validTill + 'T00:00:00Z') : null, d, lab[band(d)], purposeText(r).join(', '), r.location || '', r.storage || '', r.tagColor || '', last ? `${last.dir === 'In' ? 'In from' : 'Out to'} ${last.person}, ${stamp(last.at)}` : '', r.mobile, r.email, r.pan, r.din, r.issuer, r.dscType, r.serial, r.remarks]);
    row.getCell(4).numFmt = 'dd-mm-yyyy'; if (r.tagColor) row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + tagHex(r.tagColor).slice(1).toUpperCase() } }; if (d !== null && d <= 30) row.getCell(6).font = { bold: true, color: { argb: 'FFA32020' } }; });
  ws.views = [{ state: 'frozen', ySplit: 1 }]; ws.autoFilter = { from: 'A1', to: `S${Math.max(2, reg.records.length + 1)}` };
  download(`DSC_register_${todayIso()}.xlsx`, await wb.xlsx.writeBuffer(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
$('#saveJson').onclick = () => download(`dsc_register_${todayIso()}.json`, JSON.stringify(reg, null, 1), 'application/json');
$('#openJson').onclick = () => { if (locked()) return msg('warn', 'The register is read only now.'); $('#jsonFile').click(); };
$('#jsonFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (d.kind !== 'dsc-register') throw 0;
    if (reg.records.length && !(await ask('Replace the register?', `The ${reg.records.length} DSC(s) on screen${mode === 'rw' ? ' (and in the folder)' : ''} will be replaced by the ${d.records.length} in ${esc(f.name)}.`))) return;
    reg = fixReg(d); render(); await persist(`Opened ${f.name}`); }
  catch (err) { msg('err', 'That file is not a DSC register.'); } };

function ask(title, html) { return new Promise(done => { $('#askTitle').textContent = title; $('#askBody').innerHTML = html; const dl = $('#askDlg'); const end = v => { dl.close(); done(v); }; $('#askYes').onclick = () => end(true); $('#askNo').onclick = () => end(false); dl.oncancel = () => done(false); dl.showModal(); }); }

/* ---------- start ---------- */
(async () => {
  showMode(); render();
  if (!S.supported) return;
  const p = await S.restore();
  if (p && S.legacy()) msg('info', `The register is in the folder "${S.dirName()}" chosen earlier. To move it to the tool kit's database folder: open it, then click "Connect the database folder" and choose the tool kit folder – the register on screen is put into the new folder.`);
  if (p === 'granted') await openFolder(!S.legacy());
  else if (p) {
    $('#reconnect').hidden = false; $('#reconnect').textContent = `Open the register from "${S.dirName()}"`;
    showMode(); render();
    banner('info', `<b>The DSC register is in the database folder "${esc(S.dirName())}".</b> <button type="button" class="primary" id="openDbNow">Open the register</button><br><span style="font-size:.85rem">The browser asks for permission once per visit – answer "Allow". Editing is available after it is opened.</span>`);
    $('#openDbNow').onclick = () => connectKnown();
  }
})();
window.DscTool = { reg: () => reg, mode: () => mode, openFolder, tick };
})();
