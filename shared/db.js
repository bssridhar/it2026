/*
 * The tool kit's database folder – one folder for the shared registers / libraries of all the tools
 * (DSC Register, Checklists and Procedures, …), normally  <tool kit folder>/database  next to "shared".
 *
 * A web page opened from disk can write only into a folder that the user has picked once (File System Access API:
 * Chrome / Edge). "Connect" asks for the folder once per computer / browser and remembers it; the browser may ask
 * "Allow" once per visit. If the tool kit folder is picked, its "database" sub-folder is created and used; if a folder
 * named "database" is picked, it is used as it is; any other folder (after confirmation) gets a "database" sub-folder.
 *
 * Each register is a JSON file with a lock file (who has it open; refreshed every 30 s; stale after 2 minutes) and a
 * daily backup of the previous version in database/backup/.
 *
 * window.KitDB = { supported, connect(confirmOther), restore(), permit(), verify(), why(err), handle(), name(), user(), setUser(n),
 *                  store(base) → { FILE, LOCK, STALE_MS, session, read(), write(obj), acquire(user, force),
 *                                  heartbeat(user), peekLock(), release() } }
 */
(function (root) {
  'use strict';
  const supported = typeof root.showDirectoryPicker === 'function';
  const STALE_MS = 120000, session = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let dir = null, picked = '';

  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('kit-database', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function idbSet(v) { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, 'folder'); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { /* not kept */ } }
  async function idbGet() { try { const db = await idb(); return await new Promise(res => { const t = db.transaction('h').objectStore('h').get('folder'); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); } catch (e) { return null; } }

  async function hasDir(h, name) { try { await h.getDirectoryHandle(name); return true; } catch (e) { return false; } }
  /* pick the folder: the tool kit folder (→ its "database" sub-folder), a folder named "database", or another folder */
  async function connect(confirmOther) {
    let h;
    try { h = await root.showDirectoryPicker({ id: 'kit-database', mode: 'readwrite' }); }
    catch (e) { if (e && e.name === 'AbortError') e.stage = 'picker'; throw e; }
    let d = h;
    if (h.name.toLowerCase() !== 'database') {
      if (await hasDir(h, 'shared')) d = await h.getDirectoryHandle('database', { create: true });
      else if (h.name.toLowerCase() === 'shared') { const e = new Error('shared'); e.name = 'SharedFolder'; throw e; }
      else if (await hasDir(h, 'database')) d = await h.getDirectoryHandle('database');
      else {
        // the folder that holds the tool kit folder (e.g. the folder made when the zip was extracted)?
        const kits = []; for await (const [n, c] of h.entries()) if (c.kind === 'directory' && await hasDir(c, 'shared')) kits.push(c);
        if (kits.length === 1) { h = kits[0]; d = await h.getDirectoryHandle('database', { create: true }); }
        else if (confirmOther && !(await confirmOther(h.name))) { const e = new Error(h.name); e.name = 'NotKitFolder'; e.folder = h.name; throw e; }
        else d = await h.getDirectoryHandle('database', { create: true });
      }
    }
    picked = h.name; dir = d; await idbSet(d); return d;
  }
  /* check that the folder can be written, and list the registers in it */
  async function verify() {
    if (!dir) throw new Error('No database folder is connected.');
    const t = await dir.getFileHandle('.write-test', { create: true }); const w = await t.createWritable(); await w.write('ok'); await w.close(); await dir.removeEntry('.write-test');
    const files = []; for await (const [n, h] of dir.entries()) if (h.kind === 'file' && /\.json$/i.test(n)) files.push(n);
    return files.sort();
  }
  /* a plain-language reason for an error from the folder picker / file access */
  function why(e) {
    const n = e && e.name, m = (e && e.message) || String(e);
    if (n === 'NotKitFolder') return `The folder "${e.folder}" is not the tool kit folder (it has no "shared" folder in it), so it was not used. Click the button again and choose the folder that contains index.html, "shared", "dsc" and the other tool folders.`;
    if (n === 'SharedFolder') return 'You chose the "shared" folder (program files). Click the button again and choose the folder one level up – the tool kit folder that contains "shared".';
    if (n === 'AbortError') return 'The folder was not connected. After you choose the folder and click "Select folder", the browser should ask a second question – "Let site edit files?" – click "Edit files" there. If the browser asked nothing, its "File editing" permission is switched off: type chrome://settings/content/fileEditing (Edge: edge://settings/content/fileEditing) in the address bar, choose "Sites can ask to edit files and folders", remove any entry for file:/// under "Not allowed", then press Ctrl+F5 here and try again. If the browser said the folder "contains system files", keep the tool kit in its own folder (e.g. D:\\Practice_tool_kit).' + (m && m !== 'cancelled' ? ` [Browser: ${m}]` : '');
    if (n === 'NotAllowedError') return 'Permission to edit the folder was not given. Click the button again, choose the folder and answer "Edit files" / "Allow" when the browser asks.';
    if (n === 'SecurityError' || /system files|not allowed|unsafe/i.test(m)) return 'The browser does not allow this folder (e.g. the top of a drive, or a system folder such as Desktop / Documents / Windows). Keep the tool kit in its own folder, e.g. D:\\Practice_tool_kit or Z:\\Office\\Practice_tool_kit, and choose that folder.';
    if (n === 'NotFoundError') return 'The folder is not reachable now (network drive disconnected, or the folder was moved / renamed). Click the button again and choose it.';
    return `${m} (${n || 'error'})`;
  }
  /* folder chosen earlier: 'granted' | 'prompt' (needs a click – permit()) | null */
  async function restore() { const h = await idbGet(); if (!h) return null; dir = h; try { return await h.queryPermission({ mode: 'readwrite' }); } catch (e) { return 'prompt'; } }
  async function permit() { if (!dir) return 'denied'; return dir.requestPermission({ mode: 'readwrite' }); }

  const USER = 'kit-user';
  const user = () => { try { return localStorage.getItem(USER) || localStorage.getItem('dsc-user')?.replace(/^"|"$/g, '') || ''; } catch (e) { return ''; } };
  const setUser = n => { try { localStorage.setItem(USER, n || ''); } catch (e) {} };

  function store(base) {
    const FILE = base + '.json', LOCK = base + '.lock';
    let known = null; // lastModified of the file as last read / written by this session
    const d = () => { if (!dir) throw new Error('The database folder is not connected.'); return dir; };
    async function fileOf(name) { try { return await d().getFileHandle(name); } catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; } }
    async function readJson(name) { const fh = await fileOf(name); if (!fh) return null; const f = await fh.getFile(); const t = await f.text(); return { data: t.trim() ? JSON.parse(t) : null, modified: f.lastModified }; }
    async function writeText(name, text, sub) {
      const dd = sub ? await d().getDirectoryHandle(sub, { create: true }) : d();
      const fh = await dd.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close();
      return (await fh.getFile()).lastModified;
    }
    async function read() { const r = await readJson(FILE); known = r ? r.modified : null; return r; }
    /* refuses (conflict) if the file was changed by someone else after this session read / wrote it */
    async function write(obj) {
      const cur = await fileOf(FILE);
      if (cur) {
        const f = await cur.getFile();
        if (known !== null && f.lastModified !== known) { let other = null; try { other = JSON.parse(await f.text()); } catch (e) { /* unreadable */ } return { conflict: true, other }; }
        const day = new Date().toISOString().slice(0, 10), bn = `${base}_${day}.json`;
        try { const bd = await d().getDirectoryHandle('backup', { create: true }); let has = true; try { await bd.getFileHandle(bn); } catch (e) { has = false; } if (!has) await writeText(bn, await f.text(), 'backup'); } catch (e) { /* backup not made */ }
      }
      known = await writeText(FILE, JSON.stringify(obj, null, 1));
      return { ok: true, modified: known };
    }
    async function acquire(u, force) {
      const r = await readJson(LOCK).catch(() => null), l = r && r.data, now = Date.now();
      if (l && l.session !== session && !force && now - (l.beat || 0) < STALE_MS) return { busy: true, lock: l };
      const mine = { user: u, session, since: l && l.session === session ? l.since : now, beat: now };
      await writeText(LOCK, JSON.stringify(mine));
      return { ok: true, lock: mine, stale: l && l.session !== session && now - (l.beat || 0) >= STALE_MS ? l : null };
    }
    async function heartbeat(u) {
      const r = await readJson(LOCK).catch(() => null), l = r && r.data;
      if (l && l.session !== session) return { lost: true, lock: l };
      await writeText(LOCK, JSON.stringify({ user: u, session, since: l ? l.since : Date.now(), beat: Date.now() }));
      return { ok: true };
    }
    async function peekLock() { const r = await readJson(LOCK).catch(() => null); return r && r.data; }
    async function release() { try { const r = await readJson(LOCK); if (r && r.data && r.data.session === session) await d().removeEntry(LOCK); } catch (e) { /* a stale lock expires by itself */ } }
    return { FILE, LOCK, STALE_MS, session, read, write, acquire, heartbeat, peekLock, release };
  }

  root.KitDB = { supported, STALE_MS, session, connect, restore, permit, verify, why, picked: () => picked, handle: () => dir, name: () => dir ? dir.name : '', useDir: h => { dir = h; }, user, setUser, store };
})(window);
