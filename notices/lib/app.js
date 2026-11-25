/* Notices and Birthdays – edits office_notices.json and team_birthdays.json in the database folder / server (holidays: Holiday List). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const K = window.KitDB, N = window.KitNotices;
  const SN = K.store('office_notices'), SB = K.store('team_birthdays'), SH = K.store('office_holidays');
  let hols = null;   // the Holiday List file – read only here, for the preview
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let mode = 'off', other = null, beat = null, tN = null, tB = null;
  let notices = N.blankNotices(), bdays = N.blankBirthdays();
  const msg = (k, t) => { $('#msgs').innerHTML = t ? `<div class="m-${k}">${esc(t)}</div>` : ''; };
  const user = () => ($('#user').value || '').trim();
  $('#user').value = K.user(); $('#user').onchange = () => K.setUser(user());

  /* ---------- tables ---------- */
  function render() {
    const today = N.todayIso();
    $('#tN tbody').innerHTML = notices.notices.map((x, i) => `<tr class="${x.until && x.until < today ? 'past' : ''}"><td><input data-t="n" data-i="${i}" data-k="text" value="${esc(x.text)}" placeholder="e.g. TDS returns for Q3 due on 31-01-2027"></td>
      <td><input type="date" data-t="n" data-i="${i}" data-k="from" value="${esc(x.from)}"></td><td><input type="date" data-t="n" data-i="${i}" data-k="until" value="${esc(x.until)}"></td>
      <td><button type="button" class="link danger edit-only" data-del="n" data-i="${i}" title="Delete">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="hint">No notices.</td></tr>';
    $('#tB tbody').innerHTML = bdays.people.map((p, i) => `<tr><td><input data-t="b" data-i="${i}" data-k="name" value="${esc(p.name)}" placeholder="Name"></td>
      <td><select data-t="b" data-i="${i}" data-k="day"><option value="">–</option>${Array.from({ length: 31 }, (_, d) => `<option${+p.day === d + 1 ? ' selected' : ''}>${d + 1}</option>`).join('')}</select></td>
      <td><select data-t="b" data-i="${i}" data-k="month"><option value="">–</option>${MONTHS.map((m, k) => `<option value="${k + 1}"${+p.month === k + 1 ? ' selected' : ''}>${m}</option>`).join('')}</select></td>
      <td><button type="button" class="link danger edit-only" data-del="b" data-i="${i}" title="Delete">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="hint">No birthdays entered.</td></tr>';
    preview();
  }
  function preview() {
    const lines = N.important(notices, hols), names = N.birthdaysOn(bdays), soon = N.upcoming(bdays, null, 30);
    $('#preview').innerHTML = (lines.length ? `<div class="pv-imp">${lines.map(t => `<div>${esc(t)}</div>`).join('')}</div>` : '<div class="hint" style="padding:8px 12px">No important notice today – the strip is not shown.</div>') +
      (names.length ? `<div class="pv-bday">🎂 Happy Birthday wishes to our Team member${names.length > 1 ? 's' : ''} ${names.map(n => '“' + esc(n) + '”').join(', ')} 🎉🎈</div>` : '');
    $('#soon').innerHTML = soon.length ? '<b>Coming up (30 days):</b> ' + soon.map(x => `${esc(x.name)} – ${N.dmy(x.date).slice(0, 5)}${x.inDays === 0 ? ' (today)' : x.inDays === 1 ? ' (tomorrow)' : ''}`).join(' · ') : '';
  }
  const listOf = t => t === 'n' ? notices.notices : bdays.people;
  document.addEventListener('change', e => {
    const el = e.target, t = el.dataset.t; if (!t || mode !== 'rw') return;
    const row = listOf(t)[+el.dataset.i]; if (!row) return;
    row[el.dataset.k] = el.value.trim(); if (t === 'b' && el.dataset.k !== 'name') row[el.dataset.k] = el.value ? +el.value : '';
    preview();
    save(t === 'b' ? 'b' : 'n');
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-del]'); if (!b || mode !== 'rw') return;
    listOf(b.dataset.del).splice(+b.dataset.i, 1); render(); save(b.dataset.del === 'b' ? 'b' : 'n');
  });
  const add = (t, row) => { if (mode !== 'rw') return msg('warn', 'Open for editing first.'); const L = listOf(t); L.push(row); render(); const el = document.querySelector(`[data-t="${t}"][data-i="${L.length - 1}"]`); if (el) el.focus(); };
  $('#addN').onclick = () => add('n', { id: uid(), text: '', from: '', until: '' });
  $('#addB').onclick = () => add('b', { id: uid(), name: '', day: '', month: '' });

  /* ---------- saving ---------- */
  function save(which) {
    if (mode !== 'rw') return;
    if (which === 'b') { clearTimeout(tB); tB = setTimeout(() => put(SB, bdays, 'b'), 400); } else { clearTimeout(tN); tN = setTimeout(() => put(SN, notices, 'n'), 400); }
  }
  async function put(S, obj, which) {
    try {
      const r = await S.write(Object.assign({}, obj, { updated: new Date().toISOString(), updatedBy: user() }));
      if (r.conflict) { if (r.other) { if (which === 'b') bdays = fixB(r.other); else notices = fixN(r.other); render(); } msg('warn', 'Someone else changed it in the meantime – their version is shown now. Please make your change again.'); }
      else msg('ok', 'Saved – the home page shows it (refresh the home page to see it).');
    } catch (e) { msg('err', 'Not saved: ' + K.why(e)); }
  }
  const fixN = d => Object.assign(N.blankNotices(), { notices: [] }, d || {});
  const fixB = d => Object.assign(N.blankBirthdays(), d || {});

  /* ---------- opening (lock) ---------- */
  function showState() {
    document.body.classList.toggle('ro', mode !== 'rw');
    const st = $('#state');
    st.className = 'state ' + (mode === 'rw' ? 'rw' : mode === 'ro' ? 'ro' : 'off');
    st.textContent = mode === 'rw' ? `Open for editing – saved in "${K.name()}"` : mode === 'ro' ? `Read only – ${other && other.user || 'someone else'} is editing` : 'Not open';
    $('#takeBtn').hidden = mode !== 'ro';
    $('#stateHint').textContent = mode === 'rw' ? 'Every change is saved at once. Close this page when you finish, so that others can edit.' : mode === 'ro' ? 'You can see the notices; editing opens when the other person closes this page (or after two minutes of inactivity).' : '';
  }
  async function open(force) {
    const u = user();
    if (!u) { const n = (prompt('Your name – shown to others while you are editing:', '') || '').trim(); if (!n) return msg('warn', 'Enter your name first.'); $('#user').value = n; K.setUser(n); }
    clearInterval(beat);
    try {
      const a = await SN.acquire(user(), !!force), b = a.busy ? null : await SB.acquire(user(), !!force);
      if (a.busy || (b && b.busy)) { if (!a.busy) await SN.release(); mode = 'ro'; other = a.busy ? a.lock : b.lock; } else { mode = 'rw'; other = null; }
      const rn = await SN.read(), rb = await SB.read();
      try { const rh = await SH.read(); hols = rh && rh.data; } catch (e) { hols = null; }
      notices = rn && rn.data ? fixN(rn.data) : N.blankNotices();
      bdays = rb && rb.data ? fixB(rb.data) : N.blankBirthdays();
      if (mode === 'rw') { if (!(rn && rn.data)) await SN.write(notices); if (!(rb && rb.data)) await SB.write(bdays); }
      $('#openBtn').hidden = true; showState(); render(); msg('', '');
      beat = setInterval(tick, 30000);
    } catch (e) { msg('err', K.why(e)); }
  }
  async function tick() {
    try {
      if (mode === 'rw') { const h = await SN.heartbeat(user()); await SB.heartbeat(user()); if (h.lost) { mode = 'ro'; other = h.lock; showState(); } }
      else if (mode === 'ro') { other = await SN.peekLock(); if (!other || Date.now() - (other.beat || 0) >= SN.STALE_MS) await open(); else { const rn = await SN.read(), rb = await SB.read(); if (rn && rn.data) notices = fixN(rn.data); if (rb && rb.data) bdays = fixB(rb.data); render(); showState(); } }
    } catch (e) { /* not reachable now – next tick */ }
  }
  $('#takeBtn').onclick = () => { if (confirm(`${other && other.user || 'The other person'} may be editing now. Take over only after checking with them. Take over?`)) open(true); };
  window.addEventListener('pagehide', () => { if (mode === 'rw') { SN.release(); SB.release(); } });

  async function start() {
    render(); showState();
    if (!K.supported) { msg('warn', 'Open the tool kit from the tool kit server (or use Chrome / Edge) to edit the notices.'); return; }
    let p = null; try { p = await K.restore(); } catch (e) { p = null; }
    const ob = $('#openBtn');
    if (p === 'granted') { if (user()) return open(); ob.hidden = false; ob.textContent = 'Open for editing'; ob.onclick = () => open(); return; }
    ob.hidden = false;
    if (p) { ob.textContent = `Open from the database folder "${K.name()}"`; ob.onclick = async () => { try { if ((await K.permit()) === 'granted') open(); else msg('warn', 'Permission to the folder was not given.'); } catch (e) { msg('err', K.why(e)); } }; }
    else { ob.textContent = 'Connect the database folder'; ob.onclick = async () => { try { await K.connect(name => Promise.resolve(confirm(`"${name}" is not the tool kit folder. Create the "database" folder inside it and use it?`))); open(); } catch (e) { msg(e && e.name === 'AbortError' ? 'warn' : 'err', K.why(e)); } }; }
    $('#stateHint').textContent = 'The notices are kept in the shared database folder. Best: open the tool kit from the tool kit server address.';
  }
  start();
})();
