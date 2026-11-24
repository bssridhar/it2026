/*
 * Case files – Save to the file that was opened, and Save as.
 *
 * Every tool has a "Save case file" button (#saveCase; DSC: #saveJson) that builds the JSON and downloads it, and an
 * "Open" button that clicks a hidden <input type="file" accept=".json">. This script, loaded on each tool page:
 *   - Open: shows the browser's file picker (File System Access API) and remembers the file it opened;
 *   - Save: writes back into that same file (no new copy in Downloads); with no file yet, asks where to save it;
 *   - Save as…: (button added next to Save) always asks for a file name / folder – a new copy;
 *   - shows the name of the file in use; "New" / "Clear" buttons forget it, so a fresh case is not written over an old one.
 * The file in use is remembered for the tool (IndexedDB) so that the next visit still saves into it.
 * Browsers without the API (Firefox, Safari) keep the earlier behaviour: Save downloads a copy.
 * Nothing is sent anywhere – the file stays on this computer.
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
  if (!FS) return;
  const KEY = 'cf:' + location.pathname.replace(/\/index\.html$/, '/').split('/').slice(-2).join('/');
  const TYPES = [{ description: 'Case file (JSON)', accept: { 'application/json': ['.json'] } }];
  let handle = null, pending = null, label = null, lastSaved = '';

  /* ---- remember the file across visits ---- */
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('casefile', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const put = async v => { try { const db = await idb(); const tx = db.transaction('h', 'readwrite'); v ? tx.objectStore('h').put(v, KEY) : tx.objectStore('h').delete(KEY); } catch (e) { /* not essential */ } };
  const get = async () => { try { const db = await idb(); return await new Promise(res => { const r = db.transaction('h').objectStore('h').get(KEY); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); }); } catch (e) { return null; } };
  function setHandle(h) { handle = h; lastSaved = ''; put(h); show(); }

  /* ---- keep the blobs of object URLs, so a download can be turned into a file write ---- */
  const blobs = new Map(), mk = URL.createObjectURL.bind(URL), rv = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = o => { const u = mk(o); if (o instanceof Blob) blobs.set(u, o); return u; };
  URL.revokeObjectURL = u => { blobs.delete(u); rv(u); };

  async function writeTo(h, blob) { const w = await h.createWritable(); await w.write(blob); await w.close(); }
  async function permitted(h) {
    const o = { mode: 'readwrite' };
    if ((await h.queryPermission(o)) === 'granted') return true;
    return (await h.requestPermission(o)) === 'granted';
  }
  async function doSave(blob, name, mode) {
    try {
      if (mode === 'save' && handle) {
        if (!(await permitted(handle))) throw new Error('Permission to write to the file was not given.');
        await writeTo(handle, blob); lastSaved = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); show(); flash();
        return;
      }
      const h = await window.showSaveFilePicker({ suggestedName: handle ? handle.name : name, types: TYPES });
      await writeTo(h, blob); setHandle(h); lastSaved = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); show(); flash();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      alert('The case file could not be saved: ' + (e && e.message || e) + '\nUse "Save as…" to choose another file.');
    }
  }

  /* downloads of .json while a Save is in progress are written to the file instead */
  const aclick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const p = pending;
    if (p && this.download && /\.json$/i.test(this.download)) {
      pending = null;
      const blob = blobs.get(this.href);
      if (blob) { doSave(blob, this.download, p); return; }
    }
    return aclick.call(this);
  };

  /* ---- open through the picker ---- */
  function hookInput(inp) {
    inp.click = async function () {
      try {
        const [h] = await window.showOpenFilePicker({ types: TYPES, multiple: false });
        const f = await h.getFile();
        const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
        setHandle(h);
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) { if (!e || e.name !== 'AbortError') HTMLInputElement.prototype.click.call(inp); }
    };
  }

  /* ---- UI: file name, Save as… ---- */
  function show() {
    if (!label) return;
    label.hidden = !handle;
    if (!handle) return;
    label.querySelector('b').textContent = handle.name;
    label.querySelector('i').textContent = lastSaved ? ` · saved ${lastSaved}` : '';
  }
  function flash() { if (!label) return; label.style.background = '#e6f2ea'; setTimeout(() => { label.style.background = ''; }, 1200); }

  function init() {
    const saveBtn = document.getElementById('saveCase') || document.getElementById('saveJson');
    const inp = document.querySelector('input[type=file][accept=".json"]');
    if (!saveBtn) return;
    if (inp) hookInput(inp);
    const copyBtn = saveBtn.id === 'saveJson'; // DSC: this button is "Save a copy" – a user's click is Save as; the main Save uses it to save

    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (b === saveBtn) { pending = copyBtn && e.isTrusted ? 'saveas' : (pending === 'saveas' ? 'saveas' : 'save'); setTimeout(() => { pending = null; }, 0); }
      if (/^(newCase|clear|clearAll|clearReg)$/.test(b.id)) setTimeout(() => { setHandle(null); }, 0);
    }, true);

    if (!copyBtn) {
      const sa = document.createElement('button'); sa.type = 'button'; sa.id = 'saveCaseAs'; sa.textContent = 'Save as…';
      sa.title = 'Save the case in a new file (choose the name and folder)';
      sa.addEventListener('click', () => { pending = 'saveas'; saveBtn.click(); pending = null; });
      saveBtn.after(sa);
      saveBtn.title = 'Save into the case file that was opened (or choose where to save it the first time)';
    }
    label = document.createElement('span');
    label.className = 'cf-file'; label.hidden = true;
    label.style.cssText = 'font-size:.8rem;color:var(--muted,#5b6475);border:1px solid var(--line,#d9dde5);border-radius:12px;padding:2px 4px 2px 9px;white-space:nowrap;transition:background .3s';
    label.innerHTML = 'File: <b></b><i style="font-style:normal"></i> <button type="button" title="Forget this file – the next Save asks for a new file" style="border:none;background:none;padding:0 4px;cursor:pointer;color:inherit;font:inherit">✕</button>';
    label.querySelector('button').addEventListener('click', () => setHandle(null));
    (document.getElementById('saveCaseAs') || saveBtn).after(label);
    get().then(h => { if (h && !handle) { handle = h; show(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
