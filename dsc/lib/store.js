/*
 * DSC register – kept in the tool kit's database folder (shared/db.js: <tool kit>/database), with a lock file so that
 * two people do not edit it at the same time.
 *
 * Folder contents:  dsc_register.json      – the register
 *                   dsc_register.lock      – { user, session, since, beat }  (who has it open; refreshed every 30 s)
 *                   backup/dsc_register_YYYY-MM-DD.json – first save of each day keeps the previous version
 * A folder chosen in an earlier version of this tool (before the common database folder) is still used until the
 * database folder is connected.
 * window.DscStore = { supported, FILE, LOCK, STALE_MS, connect(), restore(), permit(), dirName(),
 *                     read(), write(obj), acquire(user, force), heartbeat(), peekLock(), release(), session }
 */
(function (root) {
  "use strict";
  const K = root.KitDB, st = K.store('dsc_register');
  let legacy = false;

  /* folder chosen in the earlier version of the tool */
  const oldIdb = () => new Promise((res, rej) => { const r = indexedDB.open('dsc-register', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function oldHandle() { try { const db = await oldIdb(); return await new Promise(res => { const t = db.transaction('h').objectStore('h').get('folder'); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); } catch (e) { return null; } }

  async function connect() {
    legacy = false;
    return K.connect(async name => root.confirm(`"${name}" is not the tool kit folder (it has no "shared" folder).\n\nOK – create the "database" folder inside "${name}" and use it.\nCancel – choose again (recommended: the tool kit folder).`));
  }
  async function restore() {
    const p = await K.restore(); if (p) return p;
    const h = await oldHandle(); if (!h) return null;
    legacy = true; K.useDir(h);
    try { return await h.queryPermission({ mode: 'readwrite' }); } catch (e) { return 'prompt'; }
  }
  root.DscStore = { supported: K.supported, FILE: st.FILE, LOCK: st.LOCK, STALE_MS: st.STALE_MS, session: st.session, connect, restore, permit: K.permit,
    dirName: K.name, read: st.read, write: st.write, acquire: st.acquire, heartbeat: st.heartbeat, peekLock: st.peekLock, release: st.release,
    hasDir: () => !!K.handle(), legacy: () => legacy };
})(window);
