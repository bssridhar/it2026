/*
 * Joins several generated .docx files into one Word document, each starting on a new page
 * with its own page setup (portrait / landscape), styles, numbering and footer.
 * Uses PizZip (already loaded). Written for the templates in this tool.
 */
window.LLPMerge = (function () {
  "use strict";
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const PR = "http://schemas.openxmlformats.org/package/2006/relationships";
  const CT = "http://schemas.openxmlformats.org/package/2006/content-types";
  const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
  const FOOTER_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml";
  const HEADER_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml";
  const NUM_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml";
  const NUM_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering";
  const FOOTER_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer";
  const HEADER_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header";

  const ORDER = {
    pPr: ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr", "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap", "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd", "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"],
    rPr: ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline", "shadow", "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing", "w", "kern", "position", "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath"],
    sectPr: ["headerReference", "footerReference", "footnotePr", "endnotePr", "type", "pgSz", "pgMar", "paperSrc", "pgBorders", "lnNumType", "pgNumType", "cols", "formProt", "vAlign", "noEndnote", "titlePg", "textDirection", "bidi", "rtlGutter", "docGrid", "printerSettings", "sectPrChange"],
    style: ["name", "aliases", "basedOn", "next", "link", "autoRedefine", "hidden", "uiPriority", "semiHidden", "unhideWhenUsed", "qFormat", "locked", "personal", "personalCompose", "personalReply", "rsid", "pPr", "rPr", "tblPr", "trPr", "tcPr", "tblStylePr"],
  };

  const parse = s => new DOMParser().parseFromString(s, "application/xml");
  const ser = d => new XMLSerializer().serializeToString(d);
  const kids = (el, name) => Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.namespaceURI === W && n.localName === name);
  const kid = (el, name) => kids(el, name)[0] || null;
  const all = (el, name) => Array.from(el.getElementsByTagNameNS(W, name));
  const wv = el => el.getAttributeNS(W, "val");

  /** Insert `el` into `parent` respecting the schema order list for that parent. */
  function insertOrdered(parent, el, order) {
    const pos = order.indexOf(el.localName);
    for (const c of Array.from(parent.childNodes)) {
      if (c.nodeType !== 1) continue;
      const cp = order.indexOf(c.localName);
      if (cp > pos) { parent.insertBefore(el, c); return el; }
    }
    parent.appendChild(el);
    return el;
  }
  function wEl(doc, name, val) {
    const e = doc.createElementNS(W, "w:" + name);
    if (val !== undefined) e.setAttributeNS(W, "w:val", val);
    return e;
  }
  /** Copy children of `from` that `to` lacks (by local name), in schema order. */
  function fillMissing(to, from, order) {
    for (const c of Array.from(from.childNodes)) {
      if (c.nodeType !== 1) continue;
      if (!kid(to, c.localName)) insertOrdered(to, to.ownerDocument.importNode(c, true), order);
    }
  }

  function merge(parts) {
    const base = new PizZip(parts[0].bytes);
    const txt = (zip, p) => { const f = zip.file(p); return f ? f.asText() : null; };

    const ctDoc = parse(txt(base, "[Content_Types].xml"));
    const addOverride = (partName, type) => {
      const o = ctDoc.createElementNS(CT, "Override");
      o.setAttribute("PartName", partName); o.setAttribute("ContentType", type);
      ctDoc.documentElement.appendChild(o);
    };
    const relsDoc = parse(txt(base, "word/_rels/document.xml.rels"));
    let relN = 1000;
    const addRel = (type, target) => {
      const id = "rIdM" + (relN++);
      const r = relsDoc.createElementNS(PR, "Relationship");
      r.setAttribute("Id", id); r.setAttribute("Type", type); r.setAttribute("Target", target);
      relsDoc.documentElement.appendChild(r);
      return id;
    };

    const doc = parse(txt(base, "word/document.xml"));
    const root = doc.documentElement;
    const body = kid(root, "body");
    const styles = parse(txt(base, "word/styles.xml"));
    const stylesRoot = styles.documentElement;
    const baseStyleXml = {};
    kids(stylesRoot, "style").forEach(s => baseStyleXml[s.getAttributeNS(W, "styleId")] = ser(s));

    let numbering = txt(base, "word/numbering.xml");
    let numDoc;
    if (numbering) numDoc = parse(numbering);
    else {
      numDoc = parse(`<w:numbering xmlns:w="${W}"/>`);
      addOverride("/word/numbering.xml", NUM_CT);
      addRel(NUM_REL, "numbering.xml");
    }
    const numRoot = numDoc.documentElement;
    let maxAbs = 0, maxNum = 0;
    kids(numRoot, "abstractNum").forEach(a => maxAbs = Math.max(maxAbs, +a.getAttributeNS(W, "abstractNumId")));
    kids(numRoot, "num").forEach(n => maxNum = Math.max(maxNum, +n.getAttributeNS(W, "numId")));

    let partN = 1;
    let emptyFooterId = null;
    const ensureEmptyFooter = () => {
      if (emptyFooterId) return emptyFooterId;
      base.file("word/footerM0.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${W}"><w:p/></w:ftr>`);
      addOverride("/word/footerM0.xml", FOOTER_CT);
      emptyFooterId = addRel(FOOTER_REL, "footerM0.xml");
      return emptyFooterId;
    };

    /** Copy header/footer parts referenced by a section of `zip` into the base package. */
    function carryHeadersFooters(zip, sect, isBase) {
      const rels = parse(txt(zip, "word/_rels/document.xml.rels") || `<Relationships xmlns="${PR}"/>`);
      const relById = {};
      Array.from(rels.documentElement.getElementsByTagNameNS(PR, "Relationship")).forEach(r => relById[r.getAttribute("Id")] = r.getAttribute("Target"));
      let hasFooter = false;
      for (const ref of kids(sect, "headerReference").concat(kids(sect, "footerReference"))) {
        const isFooter = ref.localName === "footerReference";
        if (isFooter && ref.getAttributeNS(W, "type") === "default") hasFooter = true;
        const target = relById[ref.getAttributeNS(R, "id")];
        if (!target) { ref.parentNode.removeChild(ref); continue; }
        let xml = txt(zip, "word/" + target.replace(/^\//, "").replace(/^word\//, ""));
        if (!xml) { ref.parentNode.removeChild(ref); continue; }
        // page x of y should count this document only
        xml = xml.replace(/NUMPAGES/g, "SECTIONPAGES");
        if (isBase) { base.file("word/" + target, xml); continue; }
        const name = (isFooter ? "footerM" : "headerM") + (partN++) + ".xml";
        base.file("word/" + name, xml);
        addOverride("/word/" + name, isFooter ? FOOTER_CT : HEADER_CT);
        const id = addRel(isFooter ? FOOTER_REL : HEADER_REL, name);
        ref.setAttributeNS(R, "r:id", id);
      }
      if (hasFooter) {
        const sd = sect.ownerDocument;
        let pn = kid(sect, "pgNumType");
        if (!pn) pn = insertOrdered(sect, sd.createElementNS(W, "w:pgNumType"), ORDER.sectPr);
        pn.setAttributeNS(W, "w:start", "1");
      }
      return hasFooter;
    }

    function prepSect(sect) {
      kids(sect, "type").forEach(t => sect.removeChild(t)); // default = new page
      return sect;
    }

    let prevSect = kid(body, "sectPr");
    body.removeChild(prevSect);
    let anyFooter = carryHeadersFooters(base, prevSect, true);
    prepSect(prevSect);
    stripIds(body);

    const added = new Set();
    for (let k = 1; k < parts.length; k++) {
      const zip = new PizZip(parts[k].bytes);
      const suffix = "_" + String(parts[k].key || k).replace(/[^A-Za-z0-9]/g, "");
      const d = parse(txt(zip, "word/document.xml"));
      const b = kid(d.documentElement, "body");
      const sect = kid(b, "sectPr");
      b.removeChild(sect);

      // namespaces used by this document
      for (const a of Array.from(d.documentElement.attributes)) {
        if (a.name.startsWith("xmlns:") && !root.hasAttribute(a.name)) root.setAttribute(a.name, a.value);
      }
      const ign = d.documentElement.getAttributeNS(MC, "Ignorable");
      if (ign) {
        const cur = (root.getAttributeNS(MC, "Ignorable") || "").split(/\s+/).filter(Boolean);
        ign.split(/\s+/).forEach(p => { if (p && !cur.includes(p) && root.hasAttribute("xmlns:" + p)) cur.push(p); });
        if (cur.length) root.setAttributeNS(MC, "mc:Ignorable", cur.join(" "));
      }

      // ---- styles: copy this document's styles under new ids (once per template)
      const sd = parse(txt(zip, "word/styles.xml"));
      const map = {};
      let defPara = null;
      const sStyles = kids(sd.documentElement, "style");
      for (const s of sStyles) {
        const id = s.getAttributeNS(W, "styleId");
        const isDefPara = s.getAttributeNS(W, "type") === "paragraph" && /^(1|true)$/.test(s.getAttributeNS(W, "default") || "");
        if (isDefPara) defPara = id;
        if (!isDefPara && baseStyleXml[id] === ser(s)) continue; // identical: share
        map[id] = id + suffix;
      }
      const ddefs = kid(sd.documentElement, "docDefaults");
      for (const s of sStyles) {
        const id = s.getAttributeNS(W, "styleId");
        if (!map[id] || added.has(map[id])) continue;
        const c = styles.importNode(s, true);
        c.setAttributeNS(W, "w:styleId", map[id]);
        c.removeAttributeNS(W, "default");
        const nm = kid(c, "name");
        if (nm) nm.setAttributeNS(W, "w:val", wv(nm) + suffix);
        for (const tag of ["basedOn", "next", "link"]) { const e = kid(c, tag); if (e && map[wv(e)]) e.setAttributeNS(W, "w:val", map[wv(e)]); }
        if (id === defPara && ddefs) {
          // bake this document's defaults into its normal style
          const dr = ddefs.getElementsByTagNameNS(W, "rPrDefault")[0], dp = ddefs.getElementsByTagNameNS(W, "pPrDefault")[0];
          const drp = dr && kid(dr, "rPr"), dpp = dp && kid(dp, "pPr");
          if (dpp) { let pp = kid(c, "pPr"); if (!pp) pp = insertOrdered(c, styles.createElementNS(W, "w:pPr"), ORDER.style); fillMissing(pp, dpp, ORDER.pPr); }
          if (drp) { let rp = kid(c, "rPr"); if (!rp) rp = insertOrdered(c, styles.createElementNS(W, "w:rPr"), ORDER.style); fillMissing(rp, drp, ORDER.rPr); }
        }
        stylesRoot.appendChild(c);
        added.add(map[id]);
      }

      // ---- numbering: new ids for every copy so lists restart
      const numMap = {};
      const nx = txt(zip, "word/numbering.xml");
      if (nx) {
        const nd = parse(nx);
        const absMap = {};
        const firstNum = kid(numRoot, "num");
        for (const a of kids(nd.documentElement, "abstractNum")) {
          const c = numDoc.importNode(a, true);
          const nid = ++maxAbs;
          absMap[a.getAttributeNS(W, "abstractNumId")] = nid;
          c.setAttributeNS(W, "w:abstractNumId", String(nid));
          ["nsid", "tmpl"].forEach(t => kids(c, t).forEach(e => c.removeChild(e)));
          for (const tag of ["styleLink", "numStyleLink"]) kids(c, tag).forEach(e => { if (map[wv(e)]) e.setAttributeNS(W, "w:val", map[wv(e)]); });
          all(c, "pStyle").forEach(e => { if (map[wv(e)]) e.setAttributeNS(W, "w:val", map[wv(e)]); });
          firstNum ? numRoot.insertBefore(c, firstNum) : numRoot.appendChild(c);
        }
        for (const n of kids(nd.documentElement, "num")) {
          const c = numDoc.importNode(n, true);
          const nid = ++maxNum;
          numMap[n.getAttributeNS(W, "numId")] = nid;
          c.setAttributeNS(W, "w:numId", String(nid));
          const an = kid(c, "abstractNumId");
          if (an) an.setAttributeNS(W, "w:val", String(absMap[wv(an)]));
          numRoot.appendChild(c);
        }
        // styles copied above may point at numbering
        for (const id of Object.values(map)) {
          const st = kids(stylesRoot, "style").find(s => s.getAttributeNS(W, "styleId") === id);
          if (st) all(st, "numId").forEach(e => { if (numMap[wv(e)] !== undefined) e.setAttributeNS(W, "w:val", String(numMap[wv(e)])); });
        }
      }

      // ---- body: point at renamed styles / numbering
      for (const p of all(b, "p")) {
        let pPr = kid(p, "pPr");
        if (!pPr) { pPr = d.createElementNS(W, "w:pPr"); p.insertBefore(pPr, p.firstChild); }
        if (!kid(pPr, "pStyle") && defPara && map[defPara]) insertOrdered(pPr, wEl(d, "pStyle", defPara), ORDER.pPr);
      }
      for (const tag of ["pStyle", "rStyle", "tblStyle"]) all(b, tag).forEach(e => { if (map[wv(e)]) e.setAttributeNS(W, "w:val", map[wv(e)]); });
      all(b, "numId").forEach(e => { if (numMap[wv(e)] !== undefined) e.setAttributeNS(W, "w:val", String(numMap[wv(e)])); });
      stripIds(b);

      // ---- close the previous section and append this document
      const hasFooter = carryHeadersFooters(zip, sect, false);
      if (!hasFooter && anyFooter && !kids(sect, "footerReference").length) {
        const ref = d.createElementNS(W, "w:footerReference");
        ref.setAttributeNS(W, "w:type", "default");
        ref.setAttributeNS(R, "r:id", ensureEmptyFooter());
        insertOrdered(sect, ref, ORDER.sectPr);
      }
      anyFooter = anyFooter || hasFooter;
      prepSect(sect);
      const brk = doc.createElementNS(W, "w:p");
      const bpPr = doc.createElementNS(W, "w:pPr");
      bpPr.appendChild(doc.importNode(prevSect, true));
      brk.appendChild(bpPr);
      body.appendChild(brk);
      for (const n of Array.from(b.childNodes)) body.appendChild(doc.importNode(n, true));
      prevSect = sect;
    }
    body.appendChild(doc.importNode(prevSect, true));

    base.file("word/document.xml", ser(doc));
    base.file("word/styles.xml", ser(styles));
    base.file("word/numbering.xml", ser(numDoc));
    base.file("word/_rels/document.xml.rels", ser(relsDoc));
    base.file("[Content_Types].xml", ser(ctDoc));
    return base.generate({ type: "uint8array", compression: "DEFLATE" });
  }

  /** Bookmark ids and paragraph ids must be unique in a document; the copies don't need them. */
  function stripIds(el) {
    for (const t of ["bookmarkStart", "bookmarkEnd"]) all(el, t).forEach(e => e.parentNode.removeChild(e));
    const W14 = "http://schemas.microsoft.com/office/word/2010/wordml";
    for (const p of Array.from(el.getElementsByTagNameNS(W, "p")).concat(Array.from(el.getElementsByTagNameNS(W, "tr")))) {
      p.removeAttributeNS(W14, "paraId"); p.removeAttributeNS(W14, "textId");
    }
  }

  return { merge };
})();
