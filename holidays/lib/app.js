/* Holiday List – office_holidays.json in the database folder / tool kit server: view by year; edit with a lock. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const K = window.KitDB, N = window.KitNotices, S = K.store('office_holidays');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let data = N.blankHolidays(), mode = 'view', other = null, beat = null, tW = null;
  const msg = (k, t) => { $('#msgs').innerHTML = t ? `<div class="m-${k}">${esc(t)}</div>` : ''; };
  const sorted = () => data.holidays.filter(h => h.date).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const fix = d => Object.assign(N.blankHolidays(), d || {}, { holidays: ((d && d.holidays) || []).map(h => Object.assign({ id: uid(), date: '', name: '' }, h)) });

  /* ---------- the list ---------- */
  function view() {
    const today = N.todayIso(), list = sorted(), next = list.find(h => h.date >= today);
    const dayNo = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5;
    $('#next').innerHTML = next ? (() => { const d = dayNo(next.date) - dayNo(today);
      return `<div class="nextbox">Next holiday: <b>${esc(next.name || 'Holiday')}</b> – ${N.weekday(next.date)}, ${N.dmy(next.date)} ${d === 0 ? '(today)' : d === 1 ? '(tomorrow)' : `(in ${d} days)`}</div>`; })() : '';
    const years = [...new Set(list.map(h => h.date.slice(0, 4)))];
    $('#years').innerHTML = years.length ? years.map(y => { const L = list.filter(h => h.date.slice(0, 4) === y);
      return `<h2>Holidays ${y} <span class="hint">(${L.length})</span></h2><table><thead><tr><th>#</th><th style="width:130px">Date</th><th style="width:120px">Day</th><th>Occasion</th></tr></thead><tbody>${L.map((h, i) =>
        `<tr class="${h === next ? 'next' : h.date < today ? 'past' : ''}"><td class="n">${i + 1}</td><td>${N.dmy(h.date)}</td><td>${N.weekday(h.date)}</td><td>${esc(h.name)}${h === next ? '<span class="badge">next</span>' : ''}</td></tr>`).join('')}</tbody></table>`; }).join('<div style="height:14px"></div>')
      : '<p class="hint">No holidays in the list yet. Click "Edit the list" to add them.</p>';
  }
  function editTable() {
    const rows = data.holidays.map((h, i) => [h, i]).sort((a, b) => (a[0].date || '9') < (b[0].date || '9') ? -1 : 1);
    $('#tE tbody').innerHTML = rows.map(([h, i]) => `<tr><td><input type="date" data-i="${i}" data-k="date" value="${esc(h.date)}"></td><td><input data-i="${i}" data-k="name" value="${esc(h.name)}" placeholder="e.g. Christmas"></td><td><button type="button" class="link danger" data-del="${i}" title="Delete">✕</button></td></tr>`).join('') || '<tr><td colspan="3" class="hint">No holidays yet.</td></tr>';
  }
  $('#tE').addEventListener('change', e => { const i = e.target.dataset.i; if (i == null || mode !== 'rw') return; data.holidays[+i][e.target.dataset.k] = e.target.value.trim(); if (e.target.dataset.k === 'date') editTable(); save(); });
  $('#tE').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b || mode !== 'rw') return; data.holidays.splice(+b.dataset.del, 1); editTable(); save(); });
  $('#addOne').onclick = () => { data.holidays.push({ id: uid(), date: '', name: '' }); editTable(); const el = document.querySelector(`#tE [data-i="${data.holidays.length - 1}"][data-k="date"]`); if (el) el.focus(); };
  $('#bulkAdd').onclick = () => {
    const have = new Set(data.holidays.map(h => h.date)); let n = 0; const bad = [];
    $('#bulk').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => {
      const m = l.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})\s*[-–:,]?\s*(.*)$/) || l.match(/^(\d{4})-(\d{2})-(\d{2})\s*[-–:,]?\s*(.*)$/);
      if (!m) { bad.push(l); return; }
      const iso = m[3].length === 4 ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : `${m[1]}-${m[2]}-${m[3]}`;
      if (isNaN(Date.parse(iso)) || have.has(iso)) { if (isNaN(Date.parse(iso))) bad.push(l); return; }
      data.holidays.push({ id: uid(), date: iso, name: (m[4] || '').trim() }); have.add(iso); n++;
    });
    editTable(); save(); $('#bulk').value = bad.join('\n');
    msg(bad.length ? 'warn' : 'ok', `${n} holiday(s) added.${bad.length ? ` ${bad.length} line(s) could not be read – they are left in the box.` : ''}`);
  };

  /* ---------- saving ---------- */
  function save() { if (mode !== 'rw') return; clearTimeout(tW); tW = setTimeout(put, 400); }
  async function put() {
    try {
      const r = await S.write(Object.assign({}, data, { holidays: data.holidays.filter(h => h.date || h.name), updated: new Date().toISOString(), updatedBy: K.user() }));
      if (r.conflict) { if (r.other) data = fix(r.other); editTable(); msg('warn', 'Someone else changed the list in the meantime – their version is shown now. Please make your change again.'); }
      else if (!document.querySelector('#msgs .m-warn')) msg('ok', 'Saved.');
    } catch (e) { msg('err', 'Not saved: ' + K.why(e)); }
  }

  /* ---------- view / edit ---------- */
  function showMode() {
    $('#viewCard').hidden = mode === 'rw'; $('#editCard').hidden = mode !== 'rw';
    $('#editBtn').hidden = mode === 'rw'; $('#doneBtn').hidden = mode !== 'rw';
    const st = $('#state'); st.className = 'state ' + (mode === 'rw' ? 'rw' : mode === 'ro' ? 'ro' : '');
    st.textContent = mode === 'rw' ? 'Editing – saved at once' : mode === 'ro' ? `Read only – ${other && other.user || 'someone else'} is editing` : '';
  }
  async function load() {
    const r = await S.read();
    if (r && r.data) data = fix(r.data);
    else { // holidays entered in version 37 (in the notices file)
      try { const n = await K.store('office_notices').read(); if (n && n.data && Array.isArray(n.data.holidays) && n.data.holidays.length) data = fix({ holidays: n.data.holidays }); } catch (e) { /* none */ }
    }
  }
  $('#editBtn').onclick = async () => {
    let u = K.user();
    if (!u) { u = (prompt('Your name – shown to others while you are editing:', '') || '').trim(); if (!u) return; K.setUser(u); }
    try {
      if (!(await ready())) return;
      const lk = await S.acquire(u, false);
      if (lk.busy) { mode = 'ro'; other = lk.lock; showMode(); return msg('warn', `${other.user || 'Someone else'} is editing the holiday list now – try again when they have finished.`); }
      const fresh = !(await S.read());
      await load(); mode = 'rw'; if (fresh) await S.write(data);
      editTable(); showMode(); msg('', '');
      clearInterval(beat); beat = setInterval(async () => { try { const h = await S.heartbeat(K.user()); if (h.lost) { mode = 'view'; showMode(); msg('warn', `${h.lock.user || 'Someone else'} has taken over editing.`); } } catch (e) { /* next time */ } }, 30000);
    } catch (e) { msg('err', K.why(e)); }
  };
  $('#doneBtn').onclick = async () => { clearTimeout(tW); await put(); clearInterval(beat); await S.release(); mode = 'view'; showMode(); await load(); view(); };
  window.addEventListener('pagehide', () => { if (mode === 'rw') S.release(); });
  $('#printBtn').onclick = () => window.print();
  $('#copyBtn').onclick = async () => {
    const t = sorted().filter(h => h.date >= N.todayIso().slice(0, 4) + '-01-01').map(h => `${N.dmy(h.date)}  ${N.weekday(h.date)}  –  ${h.name}`).join('\n');
    try { await navigator.clipboard.writeText('Holiday list\n\n' + t); msg('ok', 'The list is copied – paste it into an email or message.'); } catch (e) { msg('err', 'The browser did not allow copying.'); }
  };

  /* the database folder must be reachable (server: always; folder: connected and allowed) */
  async function ready() {
    let p = null; try { p = await K.restore(); } catch (e) { p = null; }
    if (p === 'granted') return true;
    try {
      if (p) { if ((await K.permit()) === 'granted') return true; msg('warn', 'Permission to the database folder was not given.'); return false; }
      await K.connect(name => Promise.resolve(confirm(`"${name}" is not the tool kit folder. Create the "database" folder inside it and use it?`))); return true;
    } catch (e) { msg(e && e.name === 'AbortError' ? 'warn' : 'err', K.why(e)); return false; }
  }

  (async () => {
    showMode();
    if (!K.supported) { view(); return msg('warn', 'Open the tool kit from the tool kit server to see the holiday list.'); }
    let p = null; try { p = await K.restore(); } catch (e) { p = null; }
    if (p === 'granted') { try { await load(); } catch (e) { msg('err', K.why(e)); } }
    else msg('warn', p ? 'The holiday list is in the database folder – click "Edit the list" once to allow access (or open the tool kit from the tool kit server).' : 'Open the tool kit from the tool kit server address to see the holiday list.');
    view();
  })();
})();
