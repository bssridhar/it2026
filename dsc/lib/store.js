/*
 * DSC register – keeping the register in a folder chosen by the user (File System Access API: Chrome / Edge),
 * with a lock file so that two people do not edit it at the same time.
 *
 * Folder contents:  dsc_register.json      – the register
 *                   dsc_register.lock      – { user, session, since, beat }  (who has it open; refreshed every 30 s)
 *                   backup/dsc_register_YYYY-MM-DD.json – first save of each day keeps the previous version
 * window.DscStore = { supported, FILE, LOCK, STALE_MS, connect(), restore(), permit(), useDir(h), dirName(),
 *                     read(), write(obj), acquire(user, force), heartbeat(), release(), session }
 */
(function (root) {
  "use strict";
  const FILE = 'dsc_register.json', LOCK = 'dsc_register.lock', STALE_MS = 120000;
  const session = Math.random().toString(36).slice(2) + Date.now().toString(36);
  let dir = null, known = null;            // known: lastModified of the file as last read / written by this session
  const supported = typeof root.showDirectoryPicker === 'function';

  /* remember the folder (handle) between visits */
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('dsc-register', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function idbSet(v) { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, 'folder'); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch (e) { /* not kept */ } }
  async function idbGet() { try { const db = await idb(); return await new Promise((res, rej) => { const t = db.transaction('h').objectStore('h').get('folder'); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); } catch (e) { return null; } }

  async function connect() { const h = await root.showDirectoryPicker({ id: 'dsc-register', mode: 'readwrite' }); dir = h; known = null; await idbSet(h); return h; }
  /* folder chosen earlier: 'granted' | 'prompt' (needs a click – permit()) | null */
  async function restore() { const h = await idbGet(); if (!h) return null; dir = h; try { return await h.queryPermission({ mode: 'readwrite' }); } catch (e) { return 'prompt'; } }
  async function permit() { if (!dir) return 'denied'; return dir.requestPermission({ mode: 'readwrite' }); }
  function useDir(h) { dir = h; known = null; }
  const dirName = () => dir ? dir.name : '';

  async function fileOf(name, create) { try { return await dir.getFileHandle(name, { create: !!create }); } catch (e) { if (e && e.name === 'NotFoundError') return null; throw e; } }
  async function readJson(name) { const fh = await fileOf(name); if (!fh) return null; const f = await fh.getFile(); const t = await f.text(); return { data: t.trim() ? JSON.parse(t) : null, modified: f.lastModified }; }
  async function writeText(name, text, sub) {
    const d = sub ? await dir.getDirectoryHandle(sub, { create: true }) : dir;
    const fh = await d.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close();
    return (await fh.getFile()).lastModified;
  }

  /* the register */
  async function read() { const r = await readJson(FILE); known = r ? r.modified : null; return r; }
  /* write; refuses (conflict) if the file was changed by someone else after this session read / wrote it */
  async function write(obj) {
    const cur = await fileOf(FILE);
    if (cur) {
      const f = await cur.getFile();
      if (known !== null && f.lastModified !== known) { let other = null; try { other = JSON.parse(await f.text()); } catch (e) { /* unreadable */ } return { conflict: true, other }; }
      // first save of the day keeps a copy of the previous version
      const day = new Date().toISOString().slice(0, 10), bn = `dsc_register_${day}.json`;
      try { const bd = await dir.getDirectoryHandle('backup', { create: true }); let has = true; try { await bd.getFileHandle(bn); } catch (e) { has = false; } if (!has) await writeText(bn, await f.text(), 'backup'); } catch (e) { /* backup not made */ }
    }
    known = await writeText(FILE, JSON.stringify(obj, null, 1));
    return { ok: true, modified: known };
  }

  /* lock */
  async function acquire(user, force) {
    const r = await readJson(LOCK).catch(() => null), l = r && r.data;
    const now = Date.now();
    if (l && l.session !== session && !force && now - (l.beat || 0) < STALE_MS) return { busy: true, lock: l };
    const mine = { user, session, since: l && l.session === session ? l.since : now, beat: now };
    await writeText(LOCK, JSON.stringify(mine));
    return { ok: true, lock: mine, tookOver: !!(l && l.session !== session && now - (l.beat || 0) < STALE_MS), stale: l && l.session !== session && now - (l.beat || 0) >= STALE_MS ? l : null };
  }
  /* refresh our lock; reports if someone else has taken it over */
  async function heartbeat(user) {
    const r = await readJson(LOCK).catch(() => null), l = r && r.data;
    if (l && l.session !== session) return { lost: true, lock: l };
    await writeText(LOCK, JSON.stringify({ user, session, since: l ? l.since : Date.now(), beat: Date.now() }));
    return { ok: true };
  }
  async function peekLock() { const r = await readJson(LOCK).catch(() => null); return r && r.data; }
  async function release() { try { const r = await readJson(LOCK); if (r && r.data && r.data.session === session) await dir.removeEntry(LOCK); } catch (e) { /* stale lock expires by itself */ } }

  root.DscStore = { supported, FILE, LOCK, STALE_MS, session, connect, restore, permit, useDir, dirName, read, write, acquire, heartbeat, peekLock, release, hasDir: () => !!dir };
})(window);
