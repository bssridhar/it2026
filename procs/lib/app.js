/* Checklists and Procedures – library of standard client lists / procedures / links, copied into emails with formatting. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const today = () => new Date().toISOString().slice(0, 10);
  const dmy = iso => iso ? iso.split('-').reverse().join('-') : '';
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const LS = 'procs-lib-v1', LSO = 'procs-copyopts-v1';

  /* ---------- state ---------- */
  const clone = o => JSON.parse(JSON.stringify(o));
  let lib; try { lib = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { lib = null; }
  if (!lib || lib.kind !== 'procedures-library') lib = clone(window.PROC_SEED);
  let opts; try { opts = JSON.parse(localStorage.getItem(LSO) || 'null') || {}; } catch (e) { opts = {}; }
  opts = Object.assign({ greet: false, name: '', heading: true }, opts);
  let tab = 'active', cat = 'all', q = '', cur = null; const sel = new Set();
  /* database folder (shared/db.js): mode 'local' (this browser only) | 'rw' (folder, editing) | 'ro' (someone else is editing) */
  const K = window.KitDB, DB = K.store('procedures_library');
  let mode = 'local', otherLock = null, beat = null, wTimer = null;
  const keepLocal = () => { try { localStorage.setItem(LS, JSON.stringify(lib)); } catch (e) { msg('err', 'The library could not be kept in this browser (too large?).'); } };
  const save = () => { keepLocal(); if (mode === 'rw') { clearTimeout(wTimer); wTimer = setTimeout(writeDb, 400); } };
  async function writeDb() {
    try {
      const r = await DB.write(Object.assign({}, lib, { updated: new Date().toISOString(), updatedBy: K.user() }));
      if (r.conflict) { if (r.other) { lib = normalise(r.other); keepLocal(); render(); } msg('warn', 'The library was changed in the folder by someone else – their version is now shown. Please make your change again.'); }
    } catch (e) { msg('err', 'Could not save in the database folder: ' + (e.message || e) + ' – the change is kept in this browser.'); }
  }
  const canEdit = () => { if (mode !== 'ro') return true; msg('warn', `${otherLock && otherLock.user || 'Someone else'} has the library open for editing – it is read only for you. You can still copy items.`); return false; };
  const saveOpts = () => { try { localStorage.setItem(LSO, JSON.stringify(opts)); } catch (e) {} };
  const msg = (k, t) => { $('#topMsgs').innerHTML = t ? `<div class="m-${k}">${esc(t)}</div>` : ''; if (t && k === 'ok') setTimeout(() => { $('#topMsgs').innerHTML = ''; }, 4000); };
  const due = it => it.reviewBy && it.reviewBy < today();

  /* ---------- confirm dialog ---------- */
  function ask(title, text, yes = 'OK') {
    return new Promise(res => { $('#askT').textContent = title; $('#askM').textContent = text; $('#askYes').textContent = yes; const d = $('#askDlg');
      const done = v => { d.close(); $('#askYes').onclick = $('#askNo').onclick = null; res(v); };
      $('#askYes').onclick = () => done(true); $('#askNo').onclick = () => done(false); d.oncancel = () => done(false); d.showModal(); });
  }

  /* ---------- sanitising pasted / stored HTML ---------- */
  const KEEP = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', P: 'p', BR: 'br', OL: 'ol', UL: 'ul', LI: 'li', H1: 'h4', H2: 'h4', H3: 'h4', H4: 'h4', H5: 'h4', H6: 'h4',
    A: 'a', TABLE: 'table', THEAD: 'thead', TBODY: 'tbody', TR: 'tr', TD: 'td', TH: 'th', DIV: 'p', BLOCKQUOTE: 'p' };
  const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'IFRAME', 'OBJECT', 'EMBED', 'svg', 'SVG', 'IMG', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'NOSCRIPT']);
  function clean(html) {
    const doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
    const out = document.createElement('div');
    (function walk(src, dst) {
      src.childNodes.forEach(n => {
        if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1 || DROP.has(n.tagName)) return;
        let tag = KEEP[n.tagName];
        const st = (n.getAttribute('style') || '').toLowerCase();
        if (!tag && n.tagName === 'SPAN') { if (/font-weight:\s*(bold|[6-9]00)/.test(st)) tag = 'b'; else if (/font-style:\s*italic/.test(st)) tag = 'i'; }
        if (!tag) { walk(n, dst); return; }
        const e = document.createElement(tag);
        if (tag === 'a') { const h = n.getAttribute('href') || ''; if (/^(https?:|mailto:)/i.test(h)) { e.setAttribute('href', h); } else { walk(n, dst); return; } }
        if ((tag === 'td' || tag === 'th')) ['colspan', 'rowspan'].forEach(a => { if (n.getAttribute(a)) e.setAttribute(a, n.getAttribute(a)); });
        walk(n, e);
        if (tag === 'b' && n.tagName === 'B' && /font-weight:\s*normal/.test(st)) { while (e.firstChild) dst.appendChild(e.firstChild); return; } // Google Docs wrapper
        dst.appendChild(e);
      });
    })(doc.body, out);
    out.querySelectorAll('p,h4,li').forEach(e => { if (!e.textContent.trim() && !e.querySelector('br,table')) e.remove(); });
    return out.innerHTML.replace(/ /g, ' ').trim();
  }

  /* ---------- rendering ---------- */
  const inTab = it => tab === 'archive' ? it.archived : !it.archived;
  const match = it => !q || (it.title + ' ' + it.cat + ' ' + it.validFor + ' ' + it.url + ' ' + (new DOMParser().parseFromString(it.html || '', 'text/html').body.textContent)).toLowerCase().includes(q);
  const shown = () => lib.items.filter(it => inTab(it) && (cat === 'all' || it.cat === cat) && match(it))
    .sort((a, b) => lib.cats.indexOf(a.cat) - lib.cats.indexOf(b.cat) || a.title.localeCompare(b.title));
  function render() {
    const tabItems = lib.items.filter(inTab);
    $('#pills').innerHTML = [['all', 'All'], ...lib.cats.map(c => [c, c])].map(([k, t]) => {
      const n = k === 'all' ? tabItems.length : tabItems.filter(i => i.cat === k).length;
      return `<button type="button" data-cat="${esc(k)}" class="${cat === k ? 'on' : ''}">${esc(t)}<span class="n">${n}</span></button>`; }).join('');
    const L = shown();
    [...sel].forEach(id => { if (!L.some(i => i.id === id)) sel.delete(id); });
    $('#list').innerHTML = L.length ? L.map(it => `<div class="it${it.id === cur ? ' cur' : ''}" data-id="${it.id}">
      <input type="checkbox" data-sel="${it.id}" ${sel.has(it.id) ? 'checked' : ''} title="Select for copying several together">
      <div><div class="t">${esc(it.title)}</div><div class="m"><span>${esc(it.cat)}</span>${it.kind === 'link' ? '<span class="badge link">Link</span>' : ''}${it.validFor ? `<span class="badge">${esc(it.validFor)}</span>` : ''}${!it.archived && due(it) ? '<span class="badge due">Review due</span>' : ''}${it.archived ? `<span class="badge arch">Archived ${dmy(it.archivedOn)}</span>` : ''}</div></div></div>`).join('')
      : `<div class="empty">${tab === 'archive' ? 'Nothing archived here.' : 'No items here. Click "+ New item".'}</div>`;
    $('#count').textContent = `${L.length} item${L.length === 1 ? '' : 's'}${sel.size ? ` · ${sel.size} selected` : ''}`;
    $('#selAll').checked = L.length > 0 && L.every(i => sel.has(i.id));
    preview();
  }
  function preview() {
    const it = lib.items.find(i => i.id === cur), P = $('#prev');
    const multi = sel.size > 1;
    const optsHtml = `<div class="copyopts">
      <label style="margin:0;display:flex;gap:5px;align-items:center;color:var(--ink)"><input type="checkbox" id="o_greet" ${opts.greet ? 'checked' : ''}> Start with "Dear</label><input type="text" id="o_name" value="${esc(opts.name)}" placeholder="client's name">,"
      <label style="margin:0;display:flex;gap:5px;align-items:center;color:var(--ink)"><input type="checkbox" id="o_head" ${opts.heading ? 'checked' : ''}> Title as heading</label></div>`;
    if (!it && !multi) { P.innerHTML = '<div class="empty">Select an item on the left.</div>'; return; }
    let h = '';
    if (multi) h += `<div class="bar" style="margin-bottom:8px"><button type="button" class="primary" id="copySel">Copy ${sel.size} selected for email</button><button type="button" class="small" id="clearSel">Clear selection</button></div>`;
    if (it) {
      h += `<h2>${esc(it.title)}</h2><div class="meta">${esc(it.cat)}${it.validFor ? ' · ' + esc(it.validFor) : ''}${it.reviewBy ? ' · review by ' + dmy(it.reviewBy) : ''} · updated ${dmy(it.updated)}${it.archived ? ' · <b style="color:var(--err)">archived on ' + dmy(it.archivedOn) + '</b>' : ''}</div>`;
      if (it.archived) h += `<div class="msgs"><div class="m-err">Archived – kept for reference. Restore it to use it again, or copy it after confirming.</div></div>`;
      else if (due(it)) h += `<div class="msgs"><div class="m-warn">Review due (${dmy(it.reviewBy)}) – check that it is still correct, then edit the review date, or archive it.</div></div>`;
      if (it.note) h += `<div class="hint" style="margin:0 0 8px">Internal note: ${esc(it.note)}</div>`;
      h += `<div class="bar" style="margin-bottom:6px">
        <button type="button" class="primary" id="copyOne">Copy for email</button>
        ${it.kind === 'link' ? '<button type="button" id="copyUrl">Copy link only</button><button type="button" id="openUrl">Open link</button>' : ''}
        <button type="button" class="edit-only" id="editIt">Edit</button>
        <button type="button" class="edit-only" id="dupIt" title="A copy to edit – e.g. for the next assessment year">Duplicate</button>
        ${it.archived ? '<button type="button" class="edit-only" id="restIt">Restore</button><button type="button" class="danger edit-only" id="delIt">Delete</button>' : '<button type="button" class="danger edit-only" id="archIt">Archive</button>'}
      </div>`;
      h += optsHtml + `<div class="doc">${it.kind === 'link' ? linkBody(it) : (it.html || '<p class="hint">(no text)</p>')}</div>`;
    } else h += optsHtml;
    P.innerHTML = h;
    bindPreview(it);
  }
  const linkBody = it => `${it.html || ''}<p><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.url)}</a></p>`;

  function bindPreview(it) {
    const on = (id, f) => { const e = document.getElementById(id); if (e) e.onclick = f; };
    const og = $('#o_greet'), on_ = $('#o_name'), oh = $('#o_head');
    if (og) { og.onchange = () => { opts.greet = og.checked; saveOpts(); }; on_.oninput = () => { opts.name = on_.value; if (on_.value && !og.checked) { og.checked = opts.greet = true; } saveOpts(); }; oh.onchange = () => { opts.heading = oh.checked; saveOpts(); }; }
    on('copySel', () => copyItems(lib.items.filter(i => sel.has(i.id)).sort((a, b) => shown().indexOf(a) - shown().indexOf(b))));
    on('clearSel', () => { sel.clear(); render(); });
    if (!it) return;
    on('copyOne', () => copyItems([it]));
    on('copyUrl', () => copyText(it.url, 'Link copied.'));
    on('openUrl', () => window.open(it.url, '_blank', 'noopener'));
    on('editIt', () => canEdit() && openEditor(it));
    on('dupIt', () => { if (!canEdit()) return; const d = Object.assign(clone(it), { id: uid(), title: it.title + ' (copy)', archived: false, archivedOn: '', created: today(), updated: today() }); lib.items.push(d); save(); cur = d.id; tab = 'active'; setTab(); openEditor(d); });
    on('archIt', async () => { if (!canEdit()) return; if (!(await ask('Archive this item?', `"${it.title}" moves to the Archive tab (under ${it.cat}). It stays there for reference and can be restored.`, 'Archive'))) return;
      it.archived = true; it.archivedOn = today(); it.updated = today(); save(); cur = null; render(); msg('ok', 'Archived.'); });
    on('restIt', () => { if (!canEdit()) return; it.archived = false; it.archivedOn = ''; it.updated = today(); save(); tab = 'active'; cur = it.id; setTab(); msg('ok', 'Restored to the Active tab.'); });
    on('delIt', async () => { if (!canEdit()) return; if (!(await ask('Delete permanently?', `"${it.title}" will be removed from the library. This cannot be undone (unless an earlier library file is opened).`, 'Delete'))) return;
      lib.items = lib.items.filter(i => i !== it); save(); cur = null; render(); });
  }

  /* ---------- copying for email ---------- */
  const NAVY = '#1f3a5f', F = 'font-family:Calibri,Arial,Helvetica,sans-serif;';
  function emailHtml(items) {
    const box = document.createElement('div');
    const P = (html, css) => `<p style="${F}font-size:11pt;color:#222222;margin:0 0 8pt;${css || ''}">${html}</p>`;
    let h = '';
    if (opts.greet) h += P(`Dear ${esc(opts.name.trim() || 'Sir / Madam')},`);
    items.forEach((it, k) => {
      if (opts.heading || it.kind === 'link' && !it.html) h += `<p style="${F}font-size:12pt;font-weight:bold;color:${NAVY};margin:${k || opts.greet ? '14pt' : '0'} 0 6pt">${esc(it.title)}</p>`;
      if (it.html) h += it.html;
      if (it.kind === 'link') h += P(`<a href="${esc(it.url)}" style="color:#1155cc">${opts.heading || it.html ? 'Click here to view' : esc(it.title)}</a> <span style="color:#666666;font-size:9.5pt">(${esc(it.url)})</span>`);
    });
    box.innerHTML = h;
    box.querySelectorAll('h4').forEach(e => { const p = document.createElement('p'); p.innerHTML = e.innerHTML; p.setAttribute('style', F + 'font-size:11pt;font-weight:bold;color:' + NAVY + ';margin:10pt 0 4pt'); e.replaceWith(p); });
    box.querySelectorAll('p:not([style])').forEach(e => e.setAttribute('style', F + 'font-size:11pt;color:#222222;margin:0 0 8pt'));
    box.querySelectorAll('ol,ul').forEach(e => e.setAttribute('style', F + 'font-size:11pt;color:#222222;margin:0 0 8pt 0;padding-left:24pt'));
    box.querySelectorAll('li').forEach(e => e.setAttribute('style', F + 'font-size:11pt;color:#222222;margin:0 0 3pt'));
    box.querySelectorAll('li ol, li ul').forEach(e => e.setAttribute('style', F + 'font-size:11pt;margin:3pt 0 3pt 0;padding-left:20pt'));
    box.querySelectorAll('table').forEach(e => { e.setAttribute('style', 'border-collapse:collapse;margin:0 0 8pt'); e.setAttribute('cellpadding', '4'); e.setAttribute('border', '1'); });
    box.querySelectorAll('td,th').forEach(e => e.setAttribute('style', F + 'font-size:10.5pt;border:1px solid #999999;padding:4px 8px;vertical-align:top' + (e.tagName === 'TH' ? ';background:#e3e9f2;font-weight:bold' : '')));
    box.querySelectorAll('a:not([style])').forEach(e => e.setAttribute('style', 'color:#1155cc'));
    return `<div style="${F}font-size:11pt;color:#222222">${box.innerHTML}</div>`;
  }
  function emailText(items) {
    const div = document.createElement('div'); div.innerHTML = emailHtml(items);
    div.querySelectorAll('li').forEach(li => { const ol = li.parentElement.tagName === 'OL'; li.prepend((ol ? [...li.parentElement.children].indexOf(li) + 1 + '. ' : '• ')); });
    div.querySelectorAll('p,li,tr').forEach(e => e.append('\n'));
    return div.textContent.replace(/\n{3,}/g, '\n\n').trim();
  }
  async function copyItems(items) {
    if (!items.length) return;
    const arch = items.filter(i => i.archived), old = items.filter(i => !i.archived && due(i));
    if (arch.length && !(await ask('Copy archived item?', `${arch.map(i => '"' + i.title + '"').join(', ')} ${arch.length > 1 ? 'are' : 'is'} archived – possibly out of date. Copy anyway?`, 'Copy anyway'))) return;
    if (old.length && !(await ask('Review due', `${old.map(i => '"' + i.title + '"').join(', ')} ${old.length > 1 ? 'are' : 'is'} past the review date. Copy anyway?`, 'Copy anyway'))) return;
    const html = emailHtml(items), text = emailText(items);
    const done = () => msg('ok', `Copied ${items.length > 1 ? items.length + ' items ' : ''}with formatting – paste into the email (Ctrl+V).`);
    try { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); done(); return; } } catch (e) { /* fallback */ }
    const onCopy = ev => { ev.clipboardData.setData('text/html', html); ev.clipboardData.setData('text/plain', text); ev.preventDefault(); };
    document.addEventListener('copy', onCopy); const ok = document.execCommand('copy'); document.removeEventListener('copy', onCopy);
    ok ? done() : msg('err', 'The browser did not allow copying.');
  }
  async function copyText(t, m) { try { await navigator.clipboard.writeText(t); msg('ok', m); } catch (e) { msg('err', 'The browser did not allow copying.'); } }

  /* ---------- editor ---------- */
  let editing = null;
  const catOptions = (selv) => lib.cats.map(c => `<option${c === selv ? ' selected' : ''}>${esc(c)}</option>`).join('');
  function openEditor(it) {
    editing = it || null;
    $('#edHead').textContent = it ? 'Edit item' : 'New item';
    $('#e_title').value = it ? it.title : ''; $('#e_cat').innerHTML = catOptions(it ? it.cat : (cat !== 'all' ? cat : lib.cats[0]));
    $('#e_kind').value = it ? it.kind : 'doc'; $('#e_valid').value = it ? it.validFor : ''; $('#e_review').value = it ? it.reviewBy : '';
    $('#e_url').value = it ? it.url : ''; $('#e_note').value = it ? it.note : ''; $('#e_body').innerHTML = it ? it.html : '';
    kindVis(); $('#edDlg').showModal(); $('#e_title').focus();
  }
  function kindVis() { const l = $('#e_kind').value === 'link'; $('#e_urlWrap').hidden = !l; $('#e_bodyLbl').textContent = l ? 'Description (optional – copied above the link)' : 'Text'; }
  $('#e_kind').onchange = kindVis;
  $('#edCancel').onclick = () => $('#edDlg').close();
  $('#edSave').onclick = () => {
    const title = $('#e_title').value.trim(), kind = $('#e_kind').value, url = $('#e_url').value.trim();
    if (!title) { $('#e_title').focus(); return alert('Enter a title.'); }
    if (kind === 'link' && !/^https?:\/\//i.test(url)) { $('#e_url').focus(); return alert('Enter the link, starting with https://'); }
    const d = { title, cat: $('#e_cat').value, kind, url: kind === 'link' ? url : '', validFor: $('#e_valid').value.trim(), reviewBy: $('#e_review').value, note: $('#e_note').value.trim(), html: clean($('#e_body').innerHTML), updated: today() };
    if (editing) Object.assign(editing, d); else { const n = Object.assign({ id: uid(), archived: false, archivedOn: '', created: today() }, d); lib.items.push(n); editing = n; }
    cur = editing.id; if (editing.archived) tab = 'archive'; else tab = 'active'; cat = 'all';
    save(); $('#edDlg').close(); setTab(); msg('ok', 'Saved in the library. Use "Save library" to write it to the file.');
  };
  $('#e_body').addEventListener('paste', e => {
    const html = e.clipboardData.getData('text/html'), txt = e.clipboardData.getData('text/plain');
    e.preventDefault();
    document.execCommand('insertHTML', false, html ? clean(html) : esc(txt).replace(/\r?\n/g, '<br>'));
  });
  $('#tb').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  $('#tb').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const c = b.dataset.c; $('#e_body').focus();
    if (c === 'h4' || c === 'p') document.execCommand('formatBlock', false, c);
    else if (c === 'link') { const u = prompt('Link (https://…)'); if (u && /^(https?:|mailto:)/i.test(u.trim())) document.execCommand('createLink', false, u.trim()); }
    else if (c === 'table') { const r = Math.max(1, Math.min(30, parseInt(prompt('Number of rows', '3'), 10) || 0)), k = Math.max(1, Math.min(8, parseInt(prompt('Number of columns', '2'), 10) || 0));
      if (r && k) document.execCommand('insertHTML', false, '<table><tbody>' + Array.from({ length: r }, () => '<tr>' + '<td>&nbsp;</td>'.repeat(k) + '</tr>').join('') + '</tbody></table><p><br></p>'); }
    else document.execCommand(c, false, null);
  });

  /* ---------- bulk links ---------- */
  $('#bulkLinks').onclick = () => { if (!canEdit()) return; $('#b_cat').innerHTML = catOptions(cat !== 'all' ? cat : 'General'); $('#b_text').value = ''; $('#bulkDlg').showModal(); };
  $('#bulkCancel').onclick = () => $('#bulkDlg').close();
  $('#bulkAdd').onclick = () => {
    const lines = $('#b_text').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean); let n = 0; const bad = [];
    const host = u => { try { const h = new URL(u).hostname; return /zoho/.test(h) ? (/sheet/.test(h) ? 'Zoho Sheet' : /writer/.test(u) ? 'Zoho Writer' : 'Zoho WorkDrive') : /docs\.google/.test(h) ? 'Google Docs' : h; } catch (e) { return 'Link'; } };
    lines.forEach(l => {
      const m = l.match(/^(.*?)\s*[|\t]\s*(https?:\/\/\S+)\s*$/) || l.match(/^()(https?:\/\/\S+)$/);
      if (!m) { bad.push(l); return; }
      const url = m[2], title = m[1].trim() || `${host(url)} document – rename (…${url.replace(/[?#].*$/, '').slice(-6)})`;
      if (lib.items.some(i => i.url === url && !i.archived)) return;
      lib.items.push({ id: uid(), cat: $('#b_cat').value, title, kind: 'link', url, html: '', note: m[1].trim() ? '' : 'Added in bulk – give it a proper title.', validFor: '', reviewBy: '', archived: false, archivedOn: '', created: today(), updated: today() }); n++;
    });
    save(); $('#bulkDlg').close(); tab = 'active'; cat = $('#b_cat').value; setTab();
    msg(bad.length ? 'warn' : 'ok', `${n} link${n === 1 ? '' : 's'} added${bad.length ? `; ${bad.length} line(s) without a link were skipped` : ''}. Links already in the library were not added again.`);
  };

  /* ---------- categories ---------- */
  function catRows() {
    $('#catRows').innerHTML = lib.cats.map((c, i) => { const n = lib.items.filter(it => it.cat === c).length;
      return `<div class="catrow"><input data-i="${i}" value="${esc(c)}"><span class="hint" style="margin:0;width:70px">${n} item${n === 1 ? '' : 's'}</span><button type="button" class="small" data-up="${i}" ${i ? '' : 'disabled'} title="Move up">↑</button><button type="button" class="small danger" data-del="${i}" ${n ? 'disabled' : ''}>Delete</button></div>`; }).join('');
  }
  $('#manageCats').onclick = () => { if (!canEdit()) return; catRows(); $('#catDlg').showModal(); };
  $('#catRows').addEventListener('change', e => { const i = e.target.dataset.i; if (i == null) return; const old = lib.cats[i], nv = e.target.value.trim();
    if (!nv || lib.cats.includes(nv)) { e.target.value = old; return; } lib.cats[i] = nv; lib.items.forEach(it => { if (it.cat === old) it.cat = nv; }); if (cat === old) cat = nv; save(); catRows(); });
  $('#catRows').addEventListener('click', e => { const u = e.target.dataset.up, d = e.target.dataset.del;
    if (u) { const i = +u; [lib.cats[i - 1], lib.cats[i]] = [lib.cats[i], lib.cats[i - 1]]; save(); catRows(); }
    if (d) { lib.cats.splice(+d, 1); if (!lib.cats.includes(cat)) cat = 'all'; save(); catRows(); } });
  $('#addCat').onclick = () => { const v = $('#newCat').value.trim(); if (v && !lib.cats.includes(v)) { lib.cats.push(v); save(); catRows(); } $('#newCat').value = ''; };
  $('#catDone').onclick = () => { $('#catDlg').close(); render(); };

  /* ---------- list events ---------- */
  function setTab() { document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab)); render(); }
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; cat = 'all'; cur = null; sel.clear(); setTab(); });
  $('#pills').onclick = e => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.cat; render(); };
  $('#list').onclick = e => { const s = e.target.dataset.sel; if (s) { e.target.checked ? sel.add(s) : sel.delete(s); render(); return; } const r = e.target.closest('.it'); if (r) { cur = r.dataset.id; render(); } };
  $('#selAll').onchange = e => { shown().forEach(i => e.target.checked ? sel.add(i.id) : sel.delete(i.id)); render(); };
  $('#q').oninput = e => { q = e.target.value.trim().toLowerCase(); render(); };
  $('#newItem').onclick = () => canEdit() && openEditor(null);

  /* ---------- library file: export / import ---------- */
  function normalise(d) {
    const L = { kind: 'procedures-library', version: d.version || 1, cats: (d.cats || []).slice(), items: (d.items || []).map(it => Object.assign({ kind: 'doc', html: '', url: '', note: '', validFor: '', reviewBy: '', archived: false, archivedOn: '' }, it, { html: clean(it.html || '') })) };
    L.items.forEach(it => { if (!L.cats.includes(it.cat)) L.cats.push(it.cat); });
    return L;
  }
  $('#exportLib').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({}, lib, { exportedOn: new Date().toISOString() }), null, 1)], { type: 'application/json' })); a.download = `procedures_library_copy_${today()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); msg('ok', 'A copy of the library has been downloaded.'); };
  $('#importLib').onclick = () => { if (canEdit()) $('#importFile').click(); };
  $('#importFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let d; try { d = JSON.parse(await f.text()); if (d.kind !== 'procedures-library' || !Array.isArray(d.items)) throw 0; } catch (err) { msg('err', 'That file is not a checklists and procedures library.'); return; }
    if (!(await ask('Replace the library?', `The library ${mode === 'rw' ? 'in the database folder' : 'on this screen'} (${lib.items.length} items) will be replaced by "${f.name}" (${d.items.length} items).${mode === 'rw' ? ' The daily backup keeps the earlier version.' : ''}`, 'Replace'))) return;
    lib = normalise(d); save(); tab = 'active'; cat = 'all'; cur = null; sel.clear(); setTab(); msg('ok', `Imported ${f.name}.`);
  };

  /* ---------- database folder ---------- */
  function showDb() {
    const st = $('#dbState'), nm = K.name();
    document.body.classList.toggle('ro', mode === 'ro');
    st.className = 'dbstate ' + mode;
    st.textContent = mode === 'rw' ? `Database: folder "${nm}" – saved automatically` : mode === 'ro' ? `Database: folder "${nm}" – read only (${otherLock && otherLock.user || 'someone else'} is editing)` : 'Database: not connected – kept in this browser only';
    $('#dbConnect').hidden = mode !== 'local'; $('#dbTake').hidden = mode !== 'ro';
    $('#dbHint').textContent = !K.supported ? 'This browser cannot keep the library in the database folder (use Chrome or Edge). Use Export / Import to keep it in a file.'
      : mode === 'local' ? 'Connect the database folder once on this computer: choose the tool kit folder (the one that contains "shared") – the library is kept in its "database" folder (procedures_library.json) and the whole team uses the same file. Only one person can edit at a time; the others see it read only.'
      : mode === 'rw' ? 'Every change is saved in the database folder at once. A backup of the previous version is kept daily in database/backup. Close the page when you finish so that others can edit.' : 'You can view and copy items. Editing opens when the other person closes the library (or after two minutes of inactivity).';
  }
  async function openDb(silent) {
    const u = ($('#dbUser').value || '').trim();
    if (!u) { $('#dbUser').focus(); msg('warn', 'Enter your name first – it is shown to others while you have the library open.'); return; }
    K.setUser(u); clearInterval(beat);
    try {
      const lk = await DB.acquire(u, false);
      if (lk.busy) { mode = 'ro'; otherLock = lk.lock; } else { mode = 'rw'; otherLock = null; }
      const r = await DB.read();
      if (r && r.data && Array.isArray(r.data.items)) lib = normalise(r.data);
      else if (mode === 'rw') {
        const n = lib.items.length;
        if (!(await ask('Start the library in the database folder?', `There is no library in the folder "${K.name()}" yet. Put the ${n} item(s) on this screen into it?`, 'Yes'))) lib = clone(window.PROC_SEED);
        await DB.write(lib);
      }
      keepLocal(); showDb(); render();
      beat = setInterval(tickDb, 30000);
      if (!silent || lk.stale) msg(mode === 'rw' ? 'ok' : 'warn', mode === 'rw' ? `Library opened from the folder "${K.name()}" – ${lib.items.length} items.${lk.stale ? ` ${lk.stale.user} had left it open; it is now open for you.` : ''}` : `${otherLock.user || 'Someone else'} has the library open for editing – it is read only for you.`);
    } catch (e) { msg('err', 'The database folder could not be used: ' + (e.message || e)); mode = 'local'; showDb(); }
  }
  async function tickDb() {
    try {
      if (mode === 'rw') { const h = await DB.heartbeat(K.user()); if (h.lost) { mode = 'ro'; otherLock = h.lock; showDb(); msg('warn', `${h.lock.user || 'Someone else'} has taken over the library – it is read only for you now.`); } }
      else if (mode === 'ro') { otherLock = await DB.peekLock(); const r = await DB.read(); if (r && r.data) { lib = normalise(r.data); keepLocal(); render(); }
        if (!otherLock || Date.now() - (otherLock.beat || 0) >= DB.STALE_MS) { await openDb(true); if (mode === 'rw') msg('ok', 'The library is free now – open for editing.'); } else showDb(); }
    } catch (e) { /* folder not reachable now – try again at the next tick */ }
  }
  $('#dbUser').value = K.user();
  $('#dbUser').onchange = () => K.setUser($('#dbUser').value.trim());
  $('#dbConnect').onclick = async () => {
    if (!K.supported) return msg('warn', 'This needs Chrome or Edge.');
    if (!($('#dbUser').value || '').trim()) { $('#dbUser').focus(); return msg('warn', 'Enter your name first.'); }
    try { await K.connect(name => ask('Use this folder?', `"${name}" is not the tool kit folder (it has no "shared" folder). Create the "database" folder inside "${name}" and use it? (Recommended: Cancel, and choose the tool kit folder.)`, 'Use it')); await openDb(); }
    catch (e) { msg(e && e.name === 'AbortError' ? 'warn' : 'err', K.why(e)); }
  };
  $('#dbReconnect').onclick = async () => { try { if ((await K.permit()) === 'granted') { $('#dbReconnect').hidden = true; await openDb(); } else msg('warn', 'Permission to the folder was not given.'); } catch (e) { msg('err', e.message || String(e)); } };
  $('#dbTake').onclick = async () => { if (!(await ask('Open for editing?', `${otherLock && otherLock.user || 'The other person'} may be making changes now; if you take over, their changes after this may not be saved. Take over only after checking with them.`, 'Take over'))) return;
    try { await DB.acquire(K.user(), true); await openDb(); } catch (e) { msg('err', e.message || String(e)); } };
  window.addEventListener('pagehide', () => { if (mode === 'rw') { clearTimeout(wTimer); DB.release(); } });
  showDb();
  if (K.supported) K.restore().then(p => {
    if (p === 'granted' && K.user()) openDb(true);
    else if (p) { $('#dbReconnect').hidden = false; $('#dbConnect').hidden = true; $('#dbReconnect').textContent = `Reconnect to the database folder "${K.name()}"`; }
  });

  setTab();
})();
