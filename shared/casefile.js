/*
 * Case files – Open, Save (into the file that was opened) and Save as.
 *
 * Every tool has a "Save case file" button (#saveCase; DSC: #saveJson) that builds the JSON and downloads it, and an
 * "Open" button that clicks a hidden <input type="file" accept=".json">. This script, loaded on each tool page, turns
 * these into:
 *   - Open: choose a case file; the tool remembers which file it is;
 *   - Save: writes back into that same file – no dialog; with no file yet it asks for a name once;
 *   - Save as…: (button added next to Save) always asks for a name – a new copy, which is then the file in use;
 *   - the name of the file in use is shown; "New" / "Clear" buttons forget it, so a fresh case is not saved over an old one.
 *
 * Where the case files are kept:
 *   - tool kit opened from the TOOL KIT SERVER (http://<main computer>:8080): on the server, in <data folder>\cases\<tool>\
 *     (a copy of the previous version is kept once a day in its "backup" folder); "From this computer…" opens a file
 *     from the computer and "Download a copy" saves one to it;
 *   - tool kit opened from the folder in Chrome / Edge: in the file chosen on this computer (File System Access API);
 *   - other browsers: Save downloads a copy, as before.
 */
(function () {
  'use strict';
  /* pages opened from the tool kit server (http://…) have no navigator.clipboard – plain-text copy through the copy command */
  if (!navigator.clipboard) {
    const writeText = t => new Promise((res, rej) => {
      const on = e => { e.clipboardData.setData('text/plain', String(t)); e.preventDefault(); };
      document.addEventListener('copy', on); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.removeEventListener('copy', on); ok ? res() : rej(new Error('The browser did not allow copying.'));
    });
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true }); } catch (e) { /* not possible */ }
  }
  const FS = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
  const HTTP = /^https?:$/.test(location.protocol);
  if (!FS && !HTTP) return;
  const TOOL = (location.pathname.split('/').filter(Boolean)[0] || 'home').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const KEY = 'cf:' + location.pathname.replace(/\/index\.html$/, '/').split('/').slice(-2).join('/');
  const TYPES = [{ description: 'Case file (JSON)', accept: { 'application/json': ['.json'] } }];
  const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let mode = FS ? 'fs' : 'none', handle = null, srvName = '', pending = null, label = null, lastSaved = '', inputEl = null;

  /* is the page served by the tool kit server? */
  /* case files on the server need server version 40 or later; an older running server – Save downloads a copy, as before */
  let srvOld = false;
  const serverReady = HTTP ? fetch('/api/info', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => {
    if (j && j.server && (+j.version || 0) >= 40) { mode = 'server'; return true; }
    if (j && j.server) srvOld = true;
    return false; }).catch(() => false) : Promise.resolve(false);

  /* ---- remember the file across visits ---- */
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('casefile', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const putH = async v => { try { const db = await idb(); const tx = db.transaction('h', 'readwrite'); v ? tx.objectStore('h').put(v, KEY) : tx.objectStore('h').delete(KEY); } catch (e) { /* not essential */ } };
  const getH = async () => { try { const db = await idb(); return await new Promise(res => { const r = db.transaction('h').objectStore('h').get(KEY); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; } };
  const SKEY = 'cfs:' + TOOL;
  function setHandle(h) { handle = h; lastSaved = ''; putH(h); show(); }
  function setSrv(n) { srvName = n || ''; lastSaved = ''; try { n ? localStorage.setItem(SKEY, n) : localStorage.removeItem(SKEY); } catch (e) { /* not essential */ } show(); }
  function forget() { if (mode === 'server') setSrv(''); else setHandle(null); }

  /* ---- keep the blobs of object URLs, so a download can be turned into a save ---- */
  const blobs = new Map(), mk = URL.createObjectURL.bind(URL), rv = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = o => { const u = mk(o); if (o instanceof Blob) blobs.set(u, o); return u; };
  URL.revokeObjectURL = u => { blobs.delete(u); rv(u); };
  const aclick = HTMLAnchorElement.prototype.click;
  function download(blob, name) { const a = document.createElement('a'); a.href = mk(blob); a.download = name; document.body.appendChild(a); aclick.call(a); a.remove(); setTimeout(() => rv(a.href), 4000); }

  /* ---- server: case files in <data>\cases\<tool>\ ---- */
  const cleanName = n => { n = String(n || '').trim().replace(/\.json$/i, '').replace(/[^A-Za-z0-9 _.,()&+-]+/g, '_').replace(/^[ .]+|[ .]+$/g, '').slice(0, 120); return n ? n + '.json' : ''; };
  const caseUrl = n => `/api/case/${encodeURIComponent(TOOL)}/${encodeURIComponent(n)}`;
  async function srvList() { const r = await fetch(`/api/cases/${encodeURIComponent(TOOL)}`, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status === 404 ? 'The tool kit server on the main computer is running an older version. Restart it there: "Stop tool kit server.bat", then "Start tool kit server (hidden).vbs". Meanwhile use "Download a copy to this computer".' : 'The tool kit server did not list the case files (' + r.status + ').'); return r.json(); }
  async function srvPut(n, blob) { const r = await fetch(caseUrl(n), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: await blob.text() }); if (!r.ok) { let j = null; try { j = await r.json(); } catch (e) { /* none */ } throw new Error((j && j.error) || ('the server answered ' + r.status)); } }
  async function srvGet(n) { const r = await fetch(caseUrl(n), { cache: 'no-store' }); if (!r.ok) throw new Error('The case file could not be read (' + r.status + ').'); return r.text(); }
  const fmtTime = ms => { const d = new Date(ms); return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

  /* a small dialog for Open / Save as on the server */
  function dialog(kind, suggested, blob) {
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.style.cssText = 'border:1px solid #c9d2df;border-radius:12px;padding:16px 18px;width:min(620px,94vw);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1d2330;background:#fff';
      d.innerHTML = `<h3 style="margin:0 0 4px">${kind === 'open' ? 'Open a case file' : 'Save the case file as'}</h3>
        <p style="margin:0 0 10px;color:#5b6475;font-size:.85rem">Case files of this tool on the tool kit server${kind === 'open' ? '' : ' – type a new name, or click a name to replace that file'}.</p>
        ${kind === 'save' ? `<label style="display:block;font-size:.85rem;color:#5b6475;margin-bottom:4px">File name</label><input id="cfName" style="width:100%;padding:7px 9px;border:1px solid #c9d2df;border-radius:6px;font:inherit;margin-bottom:10px" value="${esc(String(suggested || '').replace(/\.json$/i, ''))}">` : '<input id="cfFind" placeholder="Search" style="width:100%;padding:7px 9px;border:1px solid #c9d2df;border-radius:6px;font:inherit;margin-bottom:8px">'}
        <div id="cfList" style="max-height:46vh;overflow:auto;border:1px solid #e3e7ee;border-radius:8px"><div style="padding:10px;color:#5b6475">Loading…</div></div>
        <div id="cfErr" style="color:#a32020;font-size:.88rem;margin-top:8px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center">
          ${kind === 'open' ? '<button type="button" id="cfLocal">From this computer…</button>' : '<button type="button" id="cfDl">Download a copy to this computer</button>'}
          <span style="flex:1"></span><button type="button" id="cfCancel">Cancel</button>
          <button type="button" id="cfOk" style="background:#1f5fae;color:#fff;border-color:#1f5fae;font-weight:600">${kind === 'open' ? 'Open' : 'Save'}</button></div>`;
      d.querySelectorAll('button').forEach(b => { b.style.font = 'inherit'; b.style.padding = b.style.padding || '7px 12px'; b.style.borderRadius = '6px'; if (!b.style.border) b.style.border = '1px solid #c9d2df'; if (!b.style.background) b.style.background = '#fff'; b.style.cursor = 'pointer'; });
      document.body.appendChild(d);
      let files = [], sel = '';
      const done = v => { d.close(); d.remove(); resolve(v); };
      const list = () => {
        const q = kind === 'open' ? (d.querySelector('#cfFind').value || '').toLowerCase() : '';
        const L = files.filter(f => !q || f.name.toLowerCase().includes(q));
        d.querySelector('#cfList').innerHTML = L.length ? L.map(f => `<div data-n="${esc(f.name)}" style="display:flex;gap:10px;padding:7px 10px;border-bottom:1px solid #eef1f6;cursor:pointer;${f.name === sel ? 'background:#e6eefa;' : ''}"><span style="flex:1">${esc(f.name.replace(/\.json$/i, ''))}</span><span style="color:#5b6475;font-size:.82rem;white-space:nowrap">${fmtTime(f.modified)}</span></div>`).join('')
          : `<div style="padding:10px;color:#5b6475">${files.length ? 'Nothing matches.' : 'No case files of this tool on the server yet.'}</div>`;
      };
      d.querySelector('#cfList').addEventListener('click', e => { const r = e.target.closest('[data-n]'); if (!r) return; sel = r.dataset.n; if (kind === 'save') d.querySelector('#cfName').value = sel.replace(/\.json$/i, ''); list(); });
      d.querySelector('#cfList').addEventListener('dblclick', e => { const r = e.target.closest('[data-n]'); if (r && kind === 'open') done({ name: r.dataset.n }); });
      if (kind === 'open') d.querySelector('#cfFind').addEventListener('input', list);
      d.querySelector('#cfCancel').onclick = () => done(null);
      d.addEventListener('cancel', e => { e.preventDefault(); done(null); });
      if (kind === 'open') d.querySelector('#cfLocal').onclick = () => done({ local: true });
      else d.querySelector('#cfDl').onclick = () => { download(blob, cleanName(d.querySelector('#cfName').value) || suggested); done(null); };
      d.querySelector('#cfOk').onclick = () => {
        if (kind === 'open') { if (!sel) { d.querySelector('#cfErr').textContent = 'Choose a file in the list.'; return; } return done({ name: sel }); }
        const n = cleanName(d.querySelector('#cfName').value); if (!n) { d.querySelector('#cfErr').textContent = 'Enter a file name.'; return; }
        if (files.some(f => f.name.toLowerCase() === n.toLowerCase()) && n.toLowerCase() !== srvName.toLowerCase() && !confirm(`"${n.replace(/\.json$/i, '')}" already exists. Replace it?`)) return;
        done({ name: n });
      };
      d.showModal();
      srvList().then(f => { files = f.sort((a, b) => b.modified - a.modified); list(); }).catch(e => { d.querySelector('#cfList').innerHTML = ''; d.querySelector('#cfErr').textContent = e.message; });
      if (kind === 'save') setTimeout(() => { const i = d.querySelector('#cfName'); i.focus(); i.select(); }, 0);
    });
  }

  /* ---- saving ---- */
  async function writeTo(h, blob) { const w = await h.createWritable(); await w.write(blob); await w.close(); }
  async function permitted(h) { const o = { mode: 'readwrite' }; if ((await h.queryPermission(o)) === 'granted') return true; return (await h.requestPermission(o)) === 'granted'; }
  async function doSave(blob, name, how) {
    try {
      if (mode === 'server') {
        let n = how === 'save' ? srvName : '';
        if (!n) { const r = await dialog('save', srvName || name, blob); if (!r) return; n = r.name; }
        await srvPut(n, blob); if (n !== srvName) setSrv(n); lastSaved = now(); show(); flash(); return;
      }
      if (how === 'save' && handle) {
        if (!(await permitted(handle))) throw new Error('Permission to write to the file was not given.');
        await writeTo(handle, blob); lastSaved = now(); show(); flash(); return;
      }
      const h = await window.showSaveFilePicker({ suggestedName: handle ? handle.name : name, types: TYPES });
      await writeTo(h, blob); setHandle(h); lastSaved = now(); show(); flash();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('The case file could not be saved: ' + (e && e.message || e) + '\nUse "Save as…" to choose another name.');
    }
  }
  /* downloads of .json while a Save is in progress become a save */
  HTMLAnchorElement.prototype.click = function () {
    const p = pending;
    if (p && mode !== 'none' && this.download && /\.json$/i.test(this.download)) {
      pending = null;
      const blob = blobs.get(this.href);
      if (blob) { doSave(blob, this.download, p); return; }
    }
    return aclick.call(this);
  };

  /* ---- opening ---- */
  function deliver(inp, file) { const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); }
  function hookInput(inp) {
    inputEl = inp;
    inp.click = async function () {
      if (mode === 'server') {
        const r = await dialog('open');
        if (!r) return;
        if (r.local) { setSrv(''); return HTMLInputElement.prototype.click.call(inp); }
        try { const t = await srvGet(r.name); setSrv(r.name); deliver(inp, new File([t], r.name, { type: 'application/json' })); }
        catch (e) { alert(e.message || String(e)); }
        return;
      }
      if (mode !== 'fs') return HTMLInputElement.prototype.click.call(inp);
      try {
        const [h] = await window.showOpenFilePicker({ types: TYPES, multiple: false });
        const f = await h.getFile(); setHandle(h); deliver(inp, f);
      } catch (e) { if (!e || e.name !== 'AbortError') HTMLInputElement.prototype.click.call(inp); }
    };
  }

  /* ---- UI: file name, Save as… ---- */
  function show() {
    if (!label) return;
    const name = mode === 'server' ? srvName : handle && handle.name;
    label.hidden = !name;
    if (!name) return;
    label.querySelector('b').textContent = mode === 'server' ? name.replace(/\.json$/i, '') : name;
    label.querySelector('i').textContent = (mode === 'server' ? ' (on the server)' : '') + (lastSaved ? ` · saved ${lastSaved}` : '');
  }
  function flash() { if (!label) return; label.style.background = '#e6f2ea'; setTimeout(() => { label.style.background = ''; }, 1200); }

  async function init() {
    const saveBtn = document.getElementById('saveCase') || document.getElementById('saveJson');
    const inp = document.querySelector('input[type=file][accept=".json"]');
    if (!saveBtn) return;
    if (inp) hookInput(inp);
    const copyBtn = saveBtn.id === 'saveJson'; // DSC: this button is "Save a copy" – a user's click is Save as; the main Save uses it to save
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (b === saveBtn) { pending = copyBtn && e.isTrusted ? 'saveas' : (pending === 'saveas' ? 'saveas' : 'save'); setTimeout(() => { pending = null; }, 0); }
      if (/^(newCase|clear|clearAll|clearReg)$/.test(b.id)) setTimeout(forget, 0);
    }, true);
    await serverReady;
    if (srvOld) saveBtn.title = 'The tool kit server is an older version – Save downloads a copy. Restart the server on the main computer to save case files on the server.';
    if (mode === 'none') return;
    if (!copyBtn) {
      const sa = document.createElement('button'); sa.type = 'button'; sa.id = 'saveCaseAs'; sa.textContent = 'Save as…';
      sa.title = mode === 'server' ? 'Save the case under a new name on the tool kit server' : 'Save the case in a new file (choose the name and folder)';
      sa.addEventListener('click', () => { pending = 'saveas'; saveBtn.click(); pending = null; });
      saveBtn.after(sa);
      saveBtn.title = 'Save into the case file that was opened (the first time: choose a name)';
    }
    label = document.createElement('span');
    label.className = 'cf-file'; label.hidden = true;
    label.style.cssText = 'font-size:.8rem;color:var(--muted,#5b6475);border:1px solid var(--line,#d9dde5);border-radius:12px;padding:2px 4px 2px 9px;white-space:nowrap;transition:background .3s';
    label.innerHTML = 'File: <b></b><i style="font-style:normal"></i> <button type="button" title="Forget this file – the next Save asks for a name" style="border:none;background:none;padding:0 4px;cursor:pointer;color:inherit;font:inherit">✕</button>';
    label.querySelector('button').addEventListener('click', forget);
    (document.getElementById('saveCaseAs') || saveBtn).after(label);
    if (mode === 'server') { try { srvName = localStorage.getItem(SKEY) || ''; } catch (e) { srvName = ''; } show(); }
    else getH().then(h => { if (h && !handle) { handle = h; show(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
