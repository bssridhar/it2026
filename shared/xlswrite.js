/*
 * Minimal writer for Excel 97-2003 workbooks (.xls, BIFF8 in an OLE compound file) – written for this tool kit.
 * Enough for portal upload templates: one or more sheets of text and number cells, no formatting.
 *
 *   XlsWrite.build([{ name: 'Sheet1', rows: [['IP Number', 'IP Name'], ['1234567890', 'NAME']] }], { allText: true })
 *     -> Uint8Array (save with type 'application/vnd.ms-excel')
 *
 * Strings are written as LABEL records (UTF-16), numbers as NUMBER records unless allText is set.
 */
(function (root) {
  "use strict";
  class Buf {
    constructor() { this.a = []; }
    u8(v) { this.a.push(v & 255); return this; }
    u16(v) { this.a.push(v & 255, (v >> 8) & 255); return this; }
    u32(v) { this.a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); return this; }
    f64(v) { const b = new Uint8Array(new Float64Array([v]).buffer); for (const x of b) this.a.push(x); return this; }
    bytes(arr) { for (const x of arr) this.a.push(x); return this; }
    utf16(s) { for (let i = 0; i < s.length; i++) this.u16(s.charCodeAt(i)); return this; }
    get length() { return this.a.length; }
  }
  const rec = (out, type, body) => { out.u16(type).u16(body.length).bytes(body.a); };
  const b = () => new Buf();

  function bof(dt) { return b().u16(0x0600).u16(dt).u16(0x0DBB).u16(0x07CC).u32(0).u32(0x00000006); }
  function font(name) { const x = b().u16(200).u16(0).u16(0x7FFF).u16(400).u16(0).u8(0).u8(0).u8(0).u8(0).u8(name.length).u8(1); x.utf16(name); return x; }
  function xf(style) {
    // ifnt, ifmt, type/protection/parent, alignment, rotation, indent, used-attributes, borders, pattern
    return b().u16(0).u16(0).u16(style ? 0xFFF5 : 0x0001).u8(0x20).u8(0).u8(0).u8(style ? 0 : 0xF8).u32(0).u32(0).u16(0x20C0);
  }
  function str16(s, cchBytes) { const x = b(); if (cchBytes === 1) x.u8(s.length); else x.u16(s.length); x.u8(1).utf16(s); return x; }

  function workbookStream(sheets, opt) {
    const subs = sheets.map(sh => {
      const s = b();
      const rows = sh.rows || [];
      const ncol = Math.max(1, ...rows.map(r => r.length));
      rec(s, 0x0809, bof(0x0010));
      rec(s, 0x0200, b().u32(0).u32(rows.length).u16(0).u16(ncol).u16(0));
      rows.forEach((r, ri) => r.forEach((v, ci) => {
        if (v === null || v === undefined || v === '') return;
        if (typeof v === 'number' && !opt.allText && isFinite(v)) rec(s, 0x0203, b().u16(ri).u16(ci).u16(15).f64(v));
        else { const t = String(v).slice(0, 255); const body = b().u16(ri).u16(ci).u16(15); const st = str16(t, 2); body.bytes(st.a); rec(s, 0x0204, body); }
      }));
      rec(s, 0x023E, b().u16(0x06B6).u16(0).u16(0).u32(0x40).u16(0).u16(0).u32(0));
      rec(s, 0x000A, b());
      return s;
    });
    const g = b();
    rec(g, 0x0809, bof(0x0005));
    rec(g, 0x0042, b().u16(0x04B0));
    rec(g, 0x003D, b().u16(0).u16(0).u16(0x4000).u16(0x2000).u16(0x0038).u16(0).u16(0).u16(1).u16(0x0258));
    for (let i = 0; i < 5; i++) rec(g, 0x0031, font('Arial'));
    for (let i = 0; i < 15; i++) rec(g, 0x00E0, xf(true));
    rec(g, 0x00E0, xf(false));
    rec(g, 0x0293, b().u16(0x8000).u8(0).u8(0xFF));
    // BOUNDSHEET records need the stream offset of each sheet: compute sizes first
    const bsLen = sheets.map(sh => 4 + 6 + 2 + 2 * Math.min(31, (sh.name || 'Sheet1').length));
    const globalsLen = g.length + bsLen.reduce((a, x) => a + x, 0) + 4;
    let off = globalsLen;
    sheets.forEach((sh, i) => { const nm = (sh.name || 'Sheet' + (i + 1)).slice(0, 31); rec(g, 0x0085, b().u32(off).u8(0).u8(0).bytes(str16(nm, 1).a)); off += subs[i].length; });
    rec(g, 0x000A, b());
    const out = new Uint8Array(off);
    out.set(g.a, 0); let p = g.length;
    subs.forEach(s => { out.set(s.a, p); p += s.length; });
    return out;
  }

  /* ---------- OLE compound file (version 3, 512-byte sectors) ---------- */
  const SEC = 512, ENDC = 0xFFFFFFFE, FREE = 0xFFFFFFFF, FATS = 0xFFFFFFFD, NOS = 0xFFFFFFFF;
  function cfb(stream) {
    const useMini = stream.length < 4096;
    const sectors = []; // array of Uint8Array(512)
    const fat = [];
    const chain = (n) => { const start = sectors.length; for (let i = 0; i < n; i++) { sectors.push(new Uint8Array(SEC)); fat.push(i < n - 1 ? start + i + 1 : ENDC); } return start; };
    let rootStart = ENDC, rootSize = 0, wbStart, miniFatStart = ENDC, nMiniFat = 0;
    if (useMini) {
      const nMini = Math.ceil(stream.length / 64);
      const nMs = Math.ceil(nMini * 64 / SEC);
      rootStart = chain(nMs); rootSize = nMini * 64;
      for (let i = 0; i < stream.length; i++) sectors[rootStart + Math.floor(i / SEC)][i % SEC] = stream[i];
      nMiniFat = Math.ceil(nMini * 4 / SEC);
      miniFatStart = chain(nMiniFat);
      const mf = new DataView(new ArrayBuffer(nMiniFat * SEC));
      for (let i = 0; i < nMiniFat * SEC / 4; i++) mf.setUint32(i * 4, i < nMini ? (i < nMini - 1 ? i + 1 : ENDC) : FREE, true);
      const mfb = new Uint8Array(mf.buffer); for (let i = 0; i < nMiniFat; i++) sectors[miniFatStart + i].set(mfb.subarray(i * SEC, (i + 1) * SEC));
      wbStart = 0;
    } else {
      const n = Math.ceil(stream.length / SEC);
      wbStart = chain(n);
      for (let i = 0; i < stream.length; i++) sectors[wbStart + Math.floor(i / SEC)][i % SEC] = stream[i];
    }
    const dirStart = chain(1);
    // directory: Root Entry + Workbook
    const dir = new DataView(sectors[dirStart].buffer);
    const entry = (idx, name, type, child, start, size) => {
      const o = idx * 128;
      for (let i = 0; i < name.length; i++) dir.setUint16(o + i * 2, name.charCodeAt(i), true);
      dir.setUint16(o + 64, (name.length + 1) * 2, true);
      dir.setUint8(o + 66, type); dir.setUint8(o + 67, 1);
      dir.setUint32(o + 68, NOS, true); dir.setUint32(o + 72, NOS, true); dir.setUint32(o + 76, child, true);
      dir.setUint32(o + 116, start, true); dir.setUint32(o + 120, size, true);
    };
    entry(0, 'Root Entry', 5, 1, rootStart, rootSize);
    entry(1, 'Workbook', 2, NOS, wbStart, stream.length);
    for (let k = 2; k < 4; k++) { dir.setUint32(k * 128 + 68, NOS, true); dir.setUint32(k * 128 + 72, NOS, true); dir.setUint32(k * 128 + 76, NOS, true); }
    // FAT sectors
    let nFat = 1; while (sectors.length + nFat > nFat * (SEC / 4)) nFat++;
    const fatStart = sectors.length;
    for (let i = 0; i < nFat; i++) { sectors.push(new Uint8Array(SEC)); fat.push(FATS); }
    if (nFat > 109) throw new Error('File too large');
    const fd = new DataView(new ArrayBuffer(nFat * SEC));
    for (let i = 0; i < nFat * SEC / 4; i++) fd.setUint32(i * 4, i < fat.length ? fat[i] : FREE, true);
    const fdb = new Uint8Array(fd.buffer); for (let i = 0; i < nFat; i++) sectors[fatStart + i].set(fdb.subarray(i * SEC, (i + 1) * SEC));
    // header
    const h = new DataView(new ArrayBuffer(SEC));
    [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1].forEach((x, i) => h.setUint8(i, x));
    h.setUint16(24, 0x003E, true); h.setUint16(26, 0x0003, true); h.setUint16(28, 0xFFFE, true); h.setUint16(30, 9, true); h.setUint16(32, 6, true);
    h.setUint32(44, nFat, true); h.setUint32(48, dirStart, true); h.setUint32(56, 4096, true);
    h.setUint32(60, useMini ? miniFatStart : ENDC, true); h.setUint32(64, nMiniFat, true); h.setUint32(68, ENDC, true); h.setUint32(72, 0, true);
    for (let i = 0; i < 109; i++) h.setUint32(76 + i * 4, i < nFat ? fatStart + i : FREE, true);
    const out = new Uint8Array(SEC * (1 + sectors.length));
    out.set(new Uint8Array(h.buffer), 0);
    sectors.forEach((s, i) => out.set(s, SEC * (i + 1)));
    return out;
  }

  root.XlsWrite = { build: (sheets, opt) => cfb(workbookStream(sheets, opt || {})) };
})(typeof window !== 'undefined' ? window : globalThis);
