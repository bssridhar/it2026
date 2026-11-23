/*
 * The tool kit's database folder – one folder for the shared registers / libraries of all the tools
 * (DSC Register, Checklists and Procedures, …), normally  <tool kit folder>/database  next to "shared".
 *
 * A web page opened from disk can write only into a folder that the user has picked once (File System Access API:
 * Chrome / Edge). "Connect" asks for the folder once per computer / browser and remembers it; the browser may ask
 * "Allow" once per visit. If the tool kit folder is picked, its "database" sub-folder is created and used; if a folder
 * named "database" (or any other folder, after confirmation) is picked, that folder is used as it is.
 *
 * Each register is a JSON file with a lock file (who has it open; refreshed every 30 s; stale after 2 minutes) and a
 * daily backup of the previous version in database/backup/.
 *
 * window.KitDB = { supported, connect(confirmOther), restore(), permit(), handle(), name(), user(), setUser(n),
 *                  store(base) → { FILE, LOCK, STALE_MS, session, read(), write(obj), acquire(user, force),
 *                                  heartbeat(user), peekLock(), release() } }
 */
(function (root) {
  'use strict';
  const supported = typeof root.showDirectoryPicker === 'function';
  const STALE_MS = 120000, session = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let dir = null;

  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('kit-database', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function idbSet(v) { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, 'folder'); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { /* not kept */ } }
  async function idbGet() { try { const db = await idb(); return await new Promise(res => { const t = db.transaction('h').objectStore('h').get('folder'); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); } catch (e) { return null; } }

  async function hasDir(h, name) { try { await h.getDirectoryHandle(name); return true; } catch (e) { return false; } }
  /* pick the folder: the tool kit folder (→ its "database" sub-folder), a folder named "database", or another folder */
  async function connect(confirmOther) {
    const h = await root.showDirectoryPicker({ id: 'kit-database', mode: 'readwrite' });
    let d = h;
    if (h.name.toLowerCase() !== 'database') {
      if (await hasDir(h, 'shared')) d = await h.getDirectoryHandle('database', { create: true });
      else if (h.name.toLowerCase() === 'shared') throw new Error('This is the "shared" folder (program files). Choose the tool kit folder – the one that contains "shared" – and the "database" folder is created next to "shared".');
      else if (await hasDir(h, 'database')) d = await h.getDirectoryHandle('database');
      else if (confirmOther && !(await confirmOther(h.name))) { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; }
    }
    dir = d; await idbSet(d); return d;
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

  root.KitDB = { supported, STALE_MS, session, connect, restore, permit, handle: () => dir, name: () => dir ? dir.name : '', useDir: h => { dir = h; }, user, setUser, store };
})(window);
