/*
 * Minimal reader for the LLP data template (.xlsx), using PizZip (already loaded).
 * Returns { sheetName: { "A1": value, ... } } with numbers as numbers and text as text.
 */
window.LLPXlsx = (function () {
  "use strict";
  const RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const parse = s => new DOMParser().parseFromString(s, "application/xml");
  const all = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));
  const textOf = node => all(node, "t").map(t => t.textContent).join("");

  function readWorkbook(bytes) {
    let zip;
    try { zip = new PizZip(bytes); } catch (e) { throw new Error("The file is not an Excel (.xlsx) workbook. If it is an old .xls file, save it as .xlsx first."); }
    const txt = p => { const f = zip.file(p); return f ? f.asText() : null; };
    const wbXml = txt("xl/workbook.xml");
    if (!wbXml) throw new Error("The file is not an Excel (.xlsx) workbook.");
    const wb = parse(wbXml);
    const rels = {};
    all(parse(txt("xl/_rels/workbook.xml.rels") || "<r/>"), "Relationship").forEach(r => rels[r.getAttribute("Id")] = r.getAttribute("Target"));
    const shared = [];
    const ss = txt("xl/sharedStrings.xml");
    if (ss) all(parse(ss), "si").forEach(si => shared.push(textOf(si)));
    const sheets = {};
    for (const s of all(wb, "sheet")) {
      const rid = s.getAttributeNS(RNS, "id") || s.getAttribute("r:id");
      let target = rels[rid];
      if (!target) continue;
      target = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
      const xml = txt(target);
      if (!xml) continue;
      const cells = {};
      for (const c of all(parse(xml), "c")) {
        const ref = c.getAttribute("r"), t = c.getAttribute("t");
        let v;
        if (t === "inlineStr") v = textOf(c);
        else {
          const ve = all(c, "v")[0];
          if (!ve) continue;
          v = ve.textContent;
          if (t === "s") v = shared[+v];
          else if (t === "b") v = v === "1";
          else if (t !== "str" && t !== "e") v = Number(v);
        }
        if (v !== "" && v !== undefined && v !== null) cells[ref] = v;
      }
      sheets[s.getAttribute("name")] = cells;
    }
    return sheets;
  }

  const colName = n => { let s = ""; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  /** Text value of a cell (numbers such as mobile / PIN come back without decimals). */
  function str(v) {
    if (v === undefined || v === null) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v).trim();
  }

  /** Date cell -> "YYYY-MM-DD" ("" if blank, null if not a valid date). */
  function date(v) {
    if (v === undefined || v === null || v === "") return "";
    if (typeof v === "number") {
      if (v < 1 || v > 80000) return null;
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return d.toISOString().slice(0, 10);
    }
    const m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
      const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
      if (d.getUTCDate() === +m[1] && d.getUTCMonth() === +m[2] - 1) return d.toISOString().slice(0, 10);
      return null;
    }
    const f = window.LLPExtract && window.LLPExtract.datesIn(String(v))[0];
    return f ? window.LLPExtract.iso(f.date) : null;
  }

  return { readWorkbook, colName, str, date };
})();
