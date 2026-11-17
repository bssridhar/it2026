/*
 * GSTR-2B analysis – Excel workbook (ExcelJS), in the layout of the firm's "GSTR-2B Working" sheet.
 * window.G2BBook = { build(ExcelJS, ctx), totals(rows), checks(ctx), threeB(ctx) }
 * ctx = { info, rows (classified records), summary (2B summary rows), settings: { home, claimReverse } }
 */
(function (root) {
  "use strict";
  const G = root.G2B, CAT = G.CAT;
  const r2 = n => Math.round((n || 0) * 100) / 100;
  const NUM = '#,##0.00;[Red]-#,##0.00';
  const BLUE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FAE' } }, LIGHT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F2' } },
    YEL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }, GREY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }, RED = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECEC' } };
  const thin = { style: 'thin', color: { argb: 'FFB7BEC9' } }, BOX = { top: thin, left: thin, bottom: thin, right: thin };
  const HEADS = ['igst', 'cgst', 'sgst', 'cess'];
  const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // block order in the working sheet; [cat, title, always shown]
  const BLOCKS = [
    ['elig', 'Eligible ITC – to be claimed in GSTR-3B Table 4A(5)', true],
    ['blocked', 'Blocked credit – section 17(5)', true],
    ['insmot', 'Insurance / motor vehicle related – review (section 17(5)(a), (ab), (b)(i))', true],
    ['pos', 'Ineligible – place of supply outside the State of registration', true],
    ['notavl', 'ITC not available as per GSTR-2B', false],
    ['inelig', 'Ineligible – others (marked)', true],
    ['rcm', 'RCM – supplies attracting reverse charge', true],
    ['imp', 'Import of goods (4A(1))', false],
    ['isd', 'Inward supplies from ISD (4A(4))', false],
    ['rev37a', 'ITC reversal shown in GSTR-2B (rule 37A) – 4B(2)', false],
    ['hold', 'Held – not claimed in this month', false],
    ['rejected', 'Rejected on the IMS dashboard – not in GSTR-3B', false],
  ];

  function totals(rows) { const t = {}; rows.forEach(r => { const k = r.cat; t[k] = t[k] || { n: 0, txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }; t[k].n++; ['txval', ...HEADS].forEach(h => t[k][h] += r[h]); }); return t; }

  /* GSTR-3B figures (JS – used on screen; the workbook uses formulas) */
  function threeB(ctx) {
    const T = totals(ctx.rows), z = () => ({ txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }), add = (o, k) => { const x = T[k]; if (x) ['txval', ...HEADS].forEach(h => o[h] += x[h]); return o; };
    const rev = ['blocked', 'insmot', 'inelig'];
    const o = {
      d31: add(z(), 'rcm'), a1: add(z(), 'imp'), a3: add(z(), 'rcm'), a4: add(z(), 'isd'),
      a5: (ctx.settings.claimReverse ? rev : []).reduce(add, add(z(), 'elig')),
      b1: (ctx.settings.claimReverse ? rev : []).reduce(add, z()), b2: add(z(), 'rev37a'), d2: add(add(z(), 'pos'), 'notavl'),
      notClaimed: ['hold', 'rejected'].concat(ctx.settings.claimReverse ? [] : rev).reduce(add, z()),
    };
    o.c = z(); HEADS.forEach(h => o.c[h] = o.a1[h] + o.a3[h] + o.a4[h] + o.a5[h] - o.b1[h] - o.b2[h]);
    return o;
  }

  /* 2B summary figures for comparison */
  function summaryFig(ctx) {
    const S = ctx.summary || [], f = (sheet, part, no) => S.find(x => x.sheet === sheet && x.part === part && x.no === no) || { igst: 0, cgst: 0, sgst: 0, cess: 0 };
    const sub = (a, b) => Object.fromEntries(HEADS.map(h => [h, (a[h] || 0) - (b[h] || 0)])), sum = (...l) => Object.fromEntries(HEADS.map(h => [h, l.reduce((s, x) => s + (x[h] || 0), 0)]));
    return { a5: sub(f('ITC Available', 'Part A', 'I'), f('ITC Available', 'Part B', 'I')), a4: f('ITC Available', 'Part A', 'II'), a3: f('ITC Available', 'Part A', 'III'), a1: f('ITC Available', 'Part A', 'IV'),
      d2: sum(f('ITC not available', 'Part A', 'I'), f('ITC not available', 'Part A', 'II'), f('ITC not available', 'Part A', 'III')), b2: f('ITC Reversal', 'Part A', 'I'), has: S.length > 0 };
  }

  function checks(ctx) {
    const out = [], add = (k, t) => out.push([k, t]), per = ctx.info.period || '', fy = ctx.info.fy || '';
    const MON = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
    const pm = MON[String(per).toLowerCase()], fy0 = +String(fy).slice(0, 4);
    const pY = pm ? (pm >= 4 ? fy0 : fy0 + 1) : null;
    ctx.rows.forEach(r => {
      const who = `${r.name || r.gstin} ${r.docno}`.trim();
      r.flags.forEach(f => add('warn', `${who}: ${f}.`));
      if (r.amend) add('warn', `${who}: amendment (${r.sheet}) – enter the ITC claimed on the original document in the Amendments block; only the difference is claimed.`);
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.date || '');
      if (m && pm && r.cat !== 'rejected') {
        const dm = +m[2], dy = +m[3], dFy = dm >= 4 ? dy : dy - 1;
        if (fy0 && dFy < fy0) add('err', `${who}: dated ${r.date}, of FY ${dFy}-${String(dFy + 1).slice(2)} – check the time limit u/s 16(4) (30th November following the end of that financial year).`);
        else if (dy < pY || (dy === pY && dm < pm)) add('info', `${who}: dated ${r.date}, before ${per} – check whether it was accounted / claimed in an earlier month.`);
      }
      if (r.src === 'user' && r.cat !== r.auto.cat && !['elig'].includes(r.cat) && !r.reason) add('warn', `${who}: marked as "${CAT[r.cat][1]}" without a reason.`);
    });
    const sf = summaryFig(ctx), tb = threeB(ctx);
    if (sf.has) {
      const cmp = (lbl, a, b) => { const d = HEADS.reduce((s, h) => s + Math.abs((a[h] || 0) - (b[h] || 0)), 0); if (d > 1) add('info', `${lbl}: as per this working ${fmt(HEADS.reduce((s, h) => s + a[h], 0))} vs GSTR-2B summary ${fmt(HEADS.reduce((s, h) => s + b[h], 0))} – difference arises from rows held / reclassified / amendments.`); };
      const all5 = Object.fromEntries(HEADS.map(h => [h, tb.a5[h] + (ctx.settings.claimReverse ? 0 : ['blocked', 'insmot', 'inelig'].reduce((s, k) => s + ((totals(ctx.rows)[k] || {})[h] || 0), 0)) + ((totals(ctx.rows).hold || {})[h] || 0) + ((totals(ctx.rows).pos || {})[h] || 0)]));
      cmp('4A(5)', all5, sf.a5); cmp('4A(3)', tb.a3, sf.a3); cmp('4A(4)', tb.a4, sf.a4); cmp('4A(1)', tb.a1, sf.a1);
    }
    if (!out.length) add('ok', 'No exceptions.');
    return out;
  }

  function build(ExcelJS, ctx) {
    const wb = new ExcelJS.Workbook(); wb.creator = 'Practice tool kit'; wb.created = new Date();
    const info = ctx.info, name = info.trade || info.legal || '';
    const head = (ws, ref, text, fill) => { const c = ws.getCell(ref); c.value = text; c.font = { bold: true, color: { argb: fill === LIGHT ? 'FF1D2330' : 'FFFFFFFF' } }; c.fill = fill || BLUE; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; c.border = BOX; };
    const put = (ws, ref, v, o = {}) => { const c = ws.getCell(ref); c.value = typeof v === 'string' && v.startsWith('=') ? { formula: v.slice(1) } : (typeof v === 'number' ? r2(v) : v); if (typeof v === 'number' || (typeof v === 'string' && v.startsWith('=')) || o.numFmt) c.numFmt = NUM; if (o.fill) c.fill = o.fill; if (o.bold) c.font = { bold: true }; c.border = BOX; return c; };
    const title = (ws, sub) => { ws.getCell('A1').value = name; ws.getCell('A1').font = { bold: true, size: 14 }; ws.getCell('A2').value = `GSTIN ${info.gstin || ''} · GSTR-2B for ${info.period || ''} ${info.fy || ''}${sub ? ' · ' + sub : ''}`; ws.getCell('A2').font = { italic: true, color: { argb: 'FF5B6475' } }; };

    /* ===== GSTR-2B Working ===== */
    const W = wb.addWorksheet('Gstr-2B Working', { views: [{ state: 'frozen', xSplit: 2 }] });
    title(W, `State of registration: ${ctx.settings.home}`);
    [17, 34, 20, 12, 12, 13, 14, 10, 14, 13, 13, 13, 10, 11, 12, 10, 16, 10, 8, 10, 10, 55, 16].forEach((w, i) => W.getColumn(i + 1).width = w);
    let r = 4; const blockTot = {};
    const TOP = ['GSTIN of supplier', 'Trade/Legal name', 'Invoice Details', null, null, null, 'Place of supply', 'Supply Attract Reverse Charge', 'Taxable Value (₹)', 'Tax Amount', null, null, null, 'GSTR-1/IFF/GSTR-5 Period', 'GSTR-1/IFF/GSTR-5 Filing Date', 'ITC Availability', 'Reason', 'Applicable % of Tax Rate', 'Source', 'IRN', 'IRN Date'];
    const SUB = [null, null, 'Invoice / note number', 'Invoice / note type', 'Invoice / note date', 'Invoice / note value (₹)', null, null, null, 'Integrated Tax(₹)', 'Central Tax(₹)', 'State/UT Tax(₹)', 'Cess(₹)'];
    function header(reasonLabel) {
      const L = i => String.fromCharCode(65 + i);
      TOP.forEach((t, i) => { if (t !== null && !['Invoice Details', 'Tax Amount'].includes(t)) { W.mergeCells(`${L(i)}${r}:${L(i)}${r + 1}`); head(W, L(i) + r, t); } });
      W.mergeCells(`C${r}:F${r}`); head(W, 'C' + r, 'Invoice / note details'); W.mergeCells(`J${r}:M${r}`); head(W, 'J' + r, 'Tax Amount');
      SUB.forEach((t, i) => { if (t) head(W, L(i) + (r + 1), t); });
      W.mergeCells(`V${r}:V${r + 1}`); head(W, 'V' + r, reasonLabel); W.mergeCells(`W${r}:W${r + 1}`); head(W, 'W' + r, 'GSTR-2B section');
      W.getRow(r).height = 30; r += 2;
    }
    const recRow = (x, fill) => {
      const v = [x.gstin, x.name, x.docno, x.doctype + (x.notetype && x.notetype !== 'Regular' ? ` (${x.notetype})` : ''), x.date, x.value, x.pos, x.rcm, x.txval, x.igst, x.cgst, x.sgst, x.cess, x.period, x.fdate, x.avail, x.reason2bOrig || '', x.pct, x.source, x.irn, x.irndate];
      v.forEach((val, i) => { const c = put(W, String.fromCharCode(65 + i) + r, val === '' ? null : val); if ([5, 8, 9, 10, 11, 12].includes(i)) c.numFmt = NUM; });
      const c = put(W, 'V' + r, x.reason || null); c.alignment = { wrapText: true }; if (fill) c.fill = fill;
      put(W, 'W' + r, x.sheet + (x.src === 'user' ? ' · marked' : x.src === 'supplier' ? ' · supplier rule' : ''));
      r++;
    };
    const recoOf = {};
    if (ctx.reco) { ctx.reco.pairs.forEach(p => { recoOf[p.a.id] = p; }); }
    const subBlock = (ttl, list, fill) => {
      const tc = W.getCell('B' + r); tc.value = ttl; tc.font = { bold: true, size: 11, color: { argb: 'FF1F5FAE' } }; r += 1;
      header('Remarks / books'); const from = r;
      list.forEach(x => { recRow(x, fill); const p = recoOf[x.id]; if (p) { const c = W.getCell('V' + (r - 1)); c.value = [x.reason, `Books: ${p.b.invno} ${p.b.vno ? '(vch ' + p.b.vno + ')' : ''}${Math.abs(p.d.tax) >= 0.01 ? ' – tax difference ' + fmt(p.d.tax) : ''}`].filter(Boolean).join('; '); } });
      if (!list.length) { W.getCell('B' + r).value = 'Nil'; W.getCell('B' + r).font = { italic: true, color: { argb: 'FF5B6475' } }; r++; }
      const to = r - 1; put(W, 'B' + r, 'Total', { bold: true }); ['F', 'I', 'J', 'K', 'L', 'M'].forEach(c => put(W, c + r, `=SUM(${c}${from}:${c}${to})`, { bold: true, fill: GREY })); const t = r; r += 2; return t;
    };
    BLOCKS.forEach(([cat, ttl, always]) => {
      const list = ctx.rows.filter(x => x.cat === cat && !x.amend);
      if (!list.length && !always) return;
      if (cat === 'elig' && ctx.reco) {
        const tc = W.getCell('B' + r); tc.value = `${ttl}  (${CAT[cat][2]})`; tc.font = { bold: true, size: 12, color: { argb: 'FF1F5FAE' } }; r += 1;
        const t1 = subBlock('Purchase reflected in GSTR-2B and accounted in books', list.filter(x => recoOf[x.id]), null);
        const t2 = subBlock('Additional input – in GSTR-2B, not accounted in books', list.filter(x => !recoOf[x.id]), null);
        put(W, 'B' + r, 'Total eligible ITC', { bold: true }); ['F', 'I', 'J', 'K', 'L', 'M'].forEach(c => put(W, c + r, `=${c}${t1}+${c}${t2}`, { bold: true, fill: GREY }));
        blockTot[cat] = r; r += 3; return;
      }
      const tc = W.getCell('B' + r); tc.value = `${ttl}  (${CAT[cat][2]})`; tc.font = { bold: true, size: 12, color: { argb: 'FF1F5FAE' } }; r += 1;
      header(cat === 'elig' || cat === 'rcm' || cat === 'imp' || cat === 'isd' ? 'Remarks' : 'Reason for ineligible');
      const from = r;
      list.forEach(x => recRow(x, cat === 'elig' || cat === 'rcm' || cat === 'imp' || cat === 'isd' || cat === 'hold' ? null : (x.reason ? null : YEL)));
      if (!list.length) { W.getCell('B' + r).value = 'Nil'; W.getCell('B' + r).font = { italic: true, color: { argb: 'FF5B6475' } }; r++; }
      const to = r - 1;
      put(W, 'B' + r, 'Total', { bold: true }); ['F', 'I', 'J', 'K', 'L', 'M'].forEach(c => put(W, c + r, `=SUM(${c}${from}:${c}${to})`, { bold: true, fill: GREY }));
      blockTot[cat] = r; r += 3;
    });
    // amendments
    const am = ctx.rows.filter(x => x.amend);
    let amFrom = null, amTo = null;
    if (am.length) {
      const tc = W.getCell('B' + r); tc.value = 'Amendments (B2BA / CDNRA / ECOA / ISDA / IMPGA) – only the difference over the ITC claimed on the original is claimed'; tc.font = { bold: true, size: 12, color: { argb: 'FF1F5FAE' } }; r++;
      const AH = ['Original number', 'Original date', 'GSTIN of supplier', 'Trade/Legal name', 'Revised number', 'Type', 'Revised date', 'Value (₹)', 'Place of supply', 'Reverse charge', 'Taxable Value (₹)', 'Integrated Tax(₹)', 'Central Tax(₹)', 'State/UT Tax(₹)', 'Cess(₹)', 'Category', 'GSTR-3B table',
        'Claimed earlier – IGST', 'Claimed earlier – CGST', 'Claimed earlier – SGST', 'Claimed earlier – Cess', 'Difference – IGST', 'Difference – CGST', 'Difference – SGST', 'Difference – Cess', 'Reason / remarks'];
      AH.forEach((t, i) => head(W, W.getCell(r, i + 1).address, t)); W.getRow(r).height = 42; r++;
      amFrom = r;
      am.forEach(x => {
        [x.orig.no, x.orig.date, x.gstin, x.name, x.docno, x.doctype, x.date, x.value, x.pos, x.rcm, x.txval, x.igst, x.cgst, x.sgst, x.cess, CAT[x.cat][1], CAT[x.cat][2]].forEach((v, i) => { const c = put(W, W.getCell(r, i + 1).address, v === '' ? null : v); if ([7, 10, 11, 12, 13, 14].includes(i)) c.numFmt = NUM; });
        for (let k = 0; k < 4; k++) { const c = put(W, W.getCell(r, 18 + k).address, null); c.fill = YEL; c.numFmt = NUM; }
        ['L', 'M', 'N', 'O'].forEach((s, k) => put(W, W.getCell(r, 22 + k).address, `=${s}${r}-${String.fromCharCode(82 + k)}${r}`));
        put(W, W.getCell(r, 26).address, x.reason || null); r++;
      });
      amTo = r - 1;
      put(W, 'D' + r, 'Total', { bold: true }); ['H', 'K', 'L', 'M', 'N', 'O', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y'].forEach(c => put(W, c + r, `=SUM(${c}${amFrom}:${c}${amTo})`, { bold: true, fill: GREY }));
      r += 3;
    }
    // summary of blocks (as in the firm's sheet)
    const sumStart = r;
    const stc = W.getCell('G' + r); stc.value = 'Summary'; stc.font = { bold: true, size: 12 }; r++;
    ['', '', 'Taxable value', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', '', 'GSTR-3B'].forEach((t, i) => { if (t) head(W, String.fromCharCode(71 + i) + r, t); }); r++;
    const sFrom = r;
    BLOCKS.forEach(([cat]) => { if (!blockTot[cat]) return; put(W, 'G' + r, CAT[cat][1]); W.mergeCells(`G${r}:H${r}`); ['I', 'J', 'K', 'L', 'M'].forEach(c => put(W, c + r, `=${c}${blockTot[cat]}`)); put(W, 'O' + r, CAT[cat][2]); r++; });
    put(W, 'G' + r, 'Total (other than amendments)', { bold: true }); W.mergeCells(`G${r}:H${r}`); ['I', 'J', 'K', 'L', 'M'].forEach(c => put(W, c + r, `=SUM(${c}${sFrom}:${c}${r - 1})`, { bold: true, fill: GREY })); const sTot = r; r++;
    const orig = ctx.rows.filter(x => !x.amend);
    put(W, 'G' + r, 'As per GSTR-2B (all records read, other than amendments)'); W.mergeCells(`G${r}:H${r}`); ['txval', ...HEADS].forEach((h, i) => put(W, String.fromCharCode(73 + i) + r, orig.reduce((s, x) => s + x[h], 0))); const s2b = r; r++;
    put(W, 'G' + r, 'Difference', { bold: true }); W.mergeCells(`G${r}:H${r}`); ['I', 'J', 'K', 'L', 'M'].forEach(c => put(W, c + r, `=${c}${sTot}-${c}${s2b}`, { bold: true })); r += 3;

    // proposed GSTR-3B
    const p3 = W.getCell('G' + r); p3.value = 'Proposed GSTR-3B (from this working)'; p3.font = { bold: true, size: 12 }; r++;
    ['GSTR-3B table', '', 'Taxable value', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', '', 'As per GSTR-2B summary – IGST', 'CGST', 'SGST', 'Cess'].forEach((t, i) => { if (t) head(W, String.fromCharCode(71 + i) + r, t); }); W.getRow(r).height = 30; r++;
    const amSum = (cats, col) => amFrom && cats.length ? cats.map(c => `SUMIF($P$${amFrom}:$P$${amTo},"${CAT[c][1]}",${col}$${amFrom}:${col}$${amTo})`).join('+') : '0';
    const AMCOL = { I: null, J: 'V', K: 'W', L: 'X', M: 'Y' };
    const blk = (cats, c) => cats.filter(k => blockTot[k]).map(k => `${c}${blockTot[k]}`).join('+') || '0';
    const rev = ctx.settings.claimReverse ? ['blocked', 'insmot', 'inelig'] : [];
    const sf = summaryFig(ctx);
    const line = (lbl, cats, cmp, o = {}) => { put(W, 'G' + r, lbl, { bold: o.bold }); W.mergeCells(`G${r}:H${r}`);
      ['I', 'J', 'K', 'L', 'M'].forEach(c => { if (o.formula) put(W, c + r, o.formula(c), { bold: o.bold, fill: o.bold ? GREY : undefined }); else if (c === 'I' && !o.tx) put(W, c + r, null); else put(W, c + r, `=${blk(cats, c)}${AMCOL[c] ? '+' + amSum(cats, AMCOL[c]) : ''}`); });
      if (cmp) HEADS.forEach((h, i) => put(W, String.fromCharCode(79 + i) + r, cmp[h] || 0)); const rr = r; r++; return rr; };
    const L31 = line('3.1(d) Inward supplies liable to reverse charge', ['rcm'], null, { tx: true });
    const A1 = line('4A(1) Import of goods', ['imp'], sf.a1);
    const A3 = line('4A(3) Inward supplies liable to reverse charge', ['rcm'], sf.a3);
    const A4 = line('4A(4) Inward supplies from ISD', ['isd'], sf.a4);
    const A5 = line(`4A(5) All other ITC${rev.length ? ' (including ITC reversed in 4B(1))' : ''}`, ['elig'].concat(rev), sf.a5);
    const B1 = line('4B(1) Reversed – rules 38, 42, 43 and section 17(5)', rev, null);
    const B2 = line('4B(2) Reversed – others (rule 37A)', ['rev37a'], sf.b2);
    line('4C Net ITC available (A − B)', [], null, { bold: true, formula: c => c === 'I' ? '' : `=${c}${A1}+${c}${A3}+${c}${A4}+${c}${A5}-${c}${B1}-${c}${B2}` });
    W.getCell('I' + (r - 1)).value = null;
    line('4D(2) Ineligible ITC – section 16(4) and place of supply', ['pos', 'notavl'], sf.d2);
    line('Not claimed in this month (held / rejected' + (rev.length ? '' : ' / blocked credit') + ')', ['hold', 'rejected'].concat(ctx.settings.claimReverse ? [] : ['blocked', 'insmot', 'inelig']), null);
    r++;
    const nt = W.getCell('G' + r); nt.value = (ctx.settings.claimReverse ? 'Blocked / ineligible credit u/s 17(5) is shown in 4A(5) and reversed in 4B(1); ITC not available due to place of supply is shown in 4D(2) – as clarified in CBIC Circular No. 170/02/2022-GST. ' : 'Blocked / ineligible credit is not claimed at all (option chosen in the tool). ') + 'The 3.1(d) liability is paid in cash; its ITC is claimed in 4A(3). Amendments: only the difference over the ITC claimed earlier (yellow cells) is included. The comparison with the GSTR-2B summary will differ where rows were held or reclassified.';
    nt.alignment = { wrapText: true, vertical: 'top' }; nt.font = { italic: true, size: 9 }; W.mergeCells(`G${r}:R${r + 3}`);

    /* ===== 2B data ===== */
    const D = wb.addWorksheet('2B data', { views: [{ state: 'frozen', ySplit: 4 }] });
    title(D, 'every record read, with the category given');
    const DH = ['Section', 'GSTIN', 'Name', 'Number', 'Type', 'Date', 'Value', 'Place of supply', 'Reverse charge', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Cess', 'Period', 'Filing date', 'ITC availability', '2B reason', 'Original no.', 'Original date', 'Category', 'GSTR-3B', 'Reason for ineligible / remarks', 'Set by', 'Flags', 'File'];
    DH.forEach((t, i) => head(D, D.getCell(4, i + 1).address, t)); [14, 17, 32, 18, 12, 11, 12, 13, 8, 13, 11, 11, 11, 9, 9, 11, 9, 14, 14, 11, 26, 18, 50, 12, 40].forEach((w, i) => D.getColumn(i + 1).width = w);
    ctx.rows.forEach((x, i) => { const rr = 5 + i;
      [x.sheet, x.gstin, x.name, x.docno, x.doctype, x.date, x.value, x.pos, x.rcm, x.txval, x.igst, x.cgst, x.sgst, x.cess, x.period, x.fdate, x.avail, x.reason2bOrig || '', x.orig.no, x.orig.date, CAT[x.cat][1], CAT[x.cat][2], x.reason, x.src === 'user' ? 'Marked' : x.src === 'supplier' ? 'Supplier rule' : 'Auto', x.flags.join('; '), x.part || '']
        .forEach((v, k) => { const c = put(D, D.getCell(rr, k + 1).address, v === '' ? null : v); if ([6, 9, 10, 11, 12, 13].includes(k)) c.numFmt = NUM; }); });
    const dl = 5 + ctx.rows.length; put(D, 'C' + dl, 'Total', { bold: true }); ['G', 'J', 'K', 'L', 'M', 'N'].forEach(c => put(D, c + dl, `=SUBTOTAL(9,${c}5:${c}${dl - 1})`, { bold: true, fill: GREY }));
    D.autoFilter = { from: 'A4', to: `Z${Math.max(5, dl - 1)}` };

    /* ===== Supplier-wise ===== */
    const SW = wb.addWorksheet('Supplier-wise'); title(SW, 'supplier-wise totals');
    ['GSTIN', 'Name', 'Documents', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Cess', 'Total tax', 'Categories'].forEach((t, i) => head(SW, SW.getCell(4, i + 1).address, t)); [17, 36, 10, 14, 12, 12, 12, 10, 13, 50].forEach((w, i) => SW.getColumn(i + 1).width = w);
    const by = {}; ctx.rows.filter(x => x.cat !== 'rejected').forEach(x => { const k = x.gstin || x.name; const o = by[k] = by[k] || { gstin: x.gstin, name: x.name, n: 0, txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, cats: new Set() }; o.n++; ['txval', ...HEADS].forEach(h => o[h] += x[h]); o.cats.add(CAT[x.cat][1]); });
    Object.values(by).sort((a, b) => (b.igst + b.cgst + b.sgst) - (a.igst + a.cgst + a.sgst)).forEach((o, i) => { const rr = 5 + i;
      [o.gstin, o.name, o.n, o.txval, o.igst, o.cgst, o.sgst, o.cess].forEach((v, k) => put(SW, SW.getCell(rr, k + 1).address, v)); SW.getCell(rr, 3).numFmt = '0'; put(SW, 'I' + rr, `=SUM(E${rr}:H${rr})`); put(SW, 'J' + rr, [...o.cats].join(', ')); });

    /* ===== Reconciliation with the purchase register ===== */
    if (ctx.reco) {
      const RC = ctx.reco, RT = root.G2BReco, STL = Object.fromEntries(RT.STATUS.map(x => [x[0], x])), o = RC.opts, sm = RT.summary(RC);
      const RS = wb.addWorksheet('Reco summary'); title(RS, 'GSTR-2B vs purchase register (books)');
      [44, 12, 16, 16, 16, 16, 16, 70].forEach((w, i) => RS.getColumn(i + 1).width = w);
      ['Status', 'Documents', '2B taxable', '2B tax', 'Books taxable', 'Books tax', 'Difference in tax', 'Meaning'].forEach((t, i) => head(RS, RS.getCell(4, i + 1).address, t));
      RT.STATUS.forEach(([k, l, m], i) => { const rr = 5 + i, x = sm[k]; [l, x.n, x.aTx, x.aTax, x.bTx, x.bTax].forEach((v, j) => put(RS, RS.getCell(rr, j + 1).address, v)); RS.getCell(rr, 2).numFmt = '0'; put(RS, 'G' + rr, `=D${rr}-F${rr}`); const c = put(RS, 'H' + rr, m); c.alignment = { wrapText: true }; });
      const tr = 5 + RT.STATUS.length; put(RS, 'A' + tr, 'Total', { bold: true }); ['B', 'C', 'D', 'E', 'F', 'G'].forEach(c => put(RS, c + tr, `=SUM(${c}5:${c}${tr - 1})`, { bold: true, fill: GREY })); RS.getCell('B' + tr).numFmt = '0';
      const nt = RS.getCell('A' + (tr + 2)); nt.value = `Matching: GSTIN + supplier invoice number${o.ignoreFY ? ' (financial-year part ignored)' : ''}${o.ignoreZeros ? ', leading zeros ignored' : ''}; amount tolerance Rs.${o.tolAbs}${o.tolPct ? ' or ' + o.tolPct + '%' : ''} on the taxable value and each tax; invoice number may differ by ${o.maxEdit} character(s)${o.useDigits ? ' or only in non-digits' : ''}; date window ${o.dateDays || 'any'} day(s) for similar / probable matches. Books: ${ctx.booksFile || ''}.`;
      nt.alignment = { wrapText: true }; nt.font = { italic: true, size: 9 }; RS.mergeCells(`A${tr + 2}:H${tr + 4}`);
      // details
      const RD = wb.addWorksheet('Reco details', { views: [{ state: 'frozen', ySplit: 4, xSplit: 2 }] }); title(RD, 'document-wise – filter on Status');
      const H = ['Status', 'GSTIN', 'Supplier (2B)', '2B section', '2B number', '2B date', '2B taxable', '2B IGST', '2B CGST', '2B SGST', '2B cess', '2B category', 'Supplier (books)', 'Books invoice no.', 'Books invoice date', 'Voucher no.', 'Voucher date', 'Books taxable', 'Books IGST', 'Books CGST', 'Books SGST', 'Books cess', 'Diff. taxable', 'Diff. IGST', 'Diff. CGST', 'Diff. SGST', 'Diff. cess', 'Diff. total tax', 'Notes'];
      H.forEach((t, i) => head(RD, RD.getCell(4, i + 1).address, t)); RD.getRow(4).height = 30;
      [26, 17, 30, 10, 18, 11, 13, 11, 11, 11, 9, 20, 30, 18, 11, 12, 11, 13, 11, 11, 11, 9, 12, 11, 11, 11, 9, 12, 60].forEach((w, i) => RD.getColumn(i + 1).width = w);
      const dmy = iso => iso ? iso.split('-').reverse().join('/') : '';
      const lines = RC.pairs.map(p => ({ s: p.status, a: p.a, b: p.b, f: p.flags })).concat(RC.only2b.map(a => ({ s: 'only2b', a, f: [] })), RC.onlyBooks.map(b => ({ s: 'onlybooks', b, f: b.gFill ? [b.gFill] : [] })));
      const order = Object.fromEntries(RT.STATUS.map((x, i) => [x[0], i])); lines.sort((p, q) => order[p.s] - order[q.s] || String((p.a || p.b).name).localeCompare(String((q.a || q.b).name)));
      lines.forEach((x, i) => { const rr = 5 + i, a = x.a, b = x.b;
        const v = [STL[x.s][1], (a || b).gstin || (b && b.gstinRaw) || '', a ? a.name : '', a ? a.sheet : '', a ? a.docno : '', a ? a.date : '', a ? a.txval : null, a ? a.igst : null, a ? a.cgst : null, a ? a.sgst : null, a ? a.cess : null, a ? CAT[a.cat][1] : '',
          b ? b.name : '', b ? b.invno : '', b ? dmy(b.invdate) : '', b ? b.vno : '', b ? dmy(b.vdate) : '', b ? b.txval : null, b ? b.igst : null, b ? b.cgst : null, b ? b.sgst : null, b ? b.cess : null];
        v.forEach((val, j) => { const c = put(RD, RD.getCell(rr, j + 1).address, val === '' ? null : val); if ([6, 7, 8, 9, 10, 17, 18, 19, 20, 21].includes(j)) c.numFmt = NUM; });
        ['G', 'H', 'I', 'J', 'K'].forEach((c, k) => put(RD, ['W', 'X', 'Y', 'Z', 'AA'][k] + rr, `=N(${c}${rr})-N(${['R', 'S', 'T', 'U', 'V'][k]}${rr})`));
        put(RD, 'AB' + rr, `=SUM(X${rr}:AA${rr})`); const c = put(RD, 'AC' + rr, x.f.join('; ') || null); c.alignment = { wrapText: false };
        if (['mismatch', 'onlybooks'].includes(x.s)) RD.getCell('A' + rr).fill = RED; else if (['probable', 'only2b'].includes(x.s)) RD.getCell('A' + rr).fill = YEL; });
      const lr = 5 + lines.length; put(RD, 'C' + lr, 'Total of the rows shown', { bold: true });
      ['G', 'H', 'I', 'J', 'K', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB'].forEach(c => put(RD, c + lr, `=SUBTOTAL(9,${c}5:${c}${lr - 1})`, { bold: true, fill: GREY }));
      RD.autoFilter = { from: 'A4', to: `AC${Math.max(5, lr - 1)}` };
      // supplier-wise
      const RSu = wb.addWorksheet('Reco supplier-wise'); title(RSu, 'GSTR-2B vs books, supplier-wise');
      ['GSTIN', 'Supplier', '2B documents', '2B taxable', '2B tax', 'Books invoices', 'Books taxable', 'Books tax', 'Difference – taxable', 'Difference – tax', 'Only in 2B', 'Only in books'].forEach((t, i) => head(RSu, RSu.getCell(4, i + 1).address, t));
      [17, 36, 10, 15, 14, 10, 15, 14, 15, 14, 10, 10].forEach((w, i) => RSu.getColumn(i + 1).width = w);
      RC.suppliers.slice().sort((p, q) => Math.abs((q.a.tax - q.b.tax)) - Math.abs((p.a.tax - p.b.tax))).forEach((x, i) => { const rr = 5 + i;
        [x.gstin || '', x.name, x.a.n, x.a.txval, x.a.tax, x.b.n, x.b.txval, x.b.tax].forEach((v, j) => put(RSu, RSu.getCell(rr, j + 1).address, v === '' ? null : v)); RSu.getCell(rr, 3).numFmt = '0'; RSu.getCell(rr, 6).numFmt = '0';
        put(RSu, 'I' + rr, `=D${rr}-G${rr}`); put(RSu, 'J' + rr, `=E${rr}-H${rr}`); put(RSu, 'K' + rr, x.open2b || null); put(RSu, 'L' + rr, x.openBooks || null); });
      const sr = 5 + RC.suppliers.length; put(RSu, 'B' + sr, 'Total', { bold: true }); ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach(c => put(RSu, c + sr, `=SUBTOTAL(9,${c}5:${c}${sr - 1})`, { bold: true, fill: GREY }));
      RSu.autoFilter = { from: 'A4', to: `L${Math.max(5, sr - 1)}` };
    }

    /* ===== IMS actions ===== */
    if (ctx.ims && ctx.ims.length) {
      const IM = wb.addWorksheet('IMS actions', { views: [{ state: 'frozen', ySplit: 4, xSplit: 2 }] }); title(IM, 'suggested action for each IMS record – take the action on the GST portal');
      const IH = ['GSTIN', 'Supplier', 'Section', 'Number', 'Type', 'Date', 'Value', 'Place of supply', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Cess', 'Supplier filing', 'IMS status (in the file)', 'Category', 'Books', 'Suggested IMS action', 'Why', 'Status differs?'];
      IH.forEach((t, i) => head(IM, IM.getCell(4, i + 1).address, t)); IM.getRow(4).height = 30;
      [17, 32, 10, 18, 10, 11, 12, 13, 13, 11, 11, 11, 8, 18, 14, 26, 22, 12, 70, 10].forEach((w, i) => IM.getColumn(i + 1).width = w);
      const RT = root.G2BReco, STL = RT ? Object.fromEntries(RT.STATUS.map(x => [x[0], x[1]])) : {};
      const ord = { Pending: 0, Reject: 1, Accept: 2 };
      ctx.ims.slice().sort((p, q) => ord[p.act] - ord[q.act] || String(p.r.name).localeCompare(q.r.name)).forEach((x, i) => { const r = x.r, rr = 5 + i;
        [r.gstin, r.name, r.sheet, r.docno, r.doctype, r.date, r.value, r.pos, r.txval, r.igst, r.cgst, r.sgst, r.cess, [r.period, r.fdate].filter(Boolean).join(' · '), x.cur, CAT[r.cat][1], x.books ? STL[x.books] || x.books : (ctx.reco ? '' : 'not checked'), x.act, x.why, x.differs ? 'Yes' : '']
          .forEach((v, k) => { const c = put(IM, IM.getCell(rr, k + 1).address, v === '' ? null : v); if ([6, 8, 9, 10, 11, 12].includes(k)) c.numFmt = NUM; });
        IM.getCell('R' + rr).font = { bold: true, color: { argb: x.act === 'Accept' ? 'FF1D6B34' : x.act === 'Pending' ? 'FF8A5A00' : 'FFA32020' } };
        if (x.differs) IM.getCell('T' + rr).fill = YEL; });
      const lr = 5 + ctx.ims.length; put(IM, 'B' + lr, 'Total of the rows shown', { bold: true }); ['G', 'I', 'J', 'K', 'L', 'M'].forEach(c => put(IM, c + lr, `=SUBTOTAL(9,${c}5:${c}${lr - 1})`, { bold: true, fill: GREY }));
      IM.autoFilter = { from: 'A4', to: `T${Math.max(5, lr - 1)}` };
    }

    /* ===== Checks ===== */
    const C = wb.addWorksheet('Checks'); title(C, 'points for review'); C.getColumn(1).width = 12; C.getColumn(2).width = 150;
    head(C, 'A4', 'Type'); head(C, 'B4', 'Point');
    checks(ctx).forEach(([k, t], i) => { put(C, 'A' + (5 + i), { err: 'Attention', warn: 'Review', info: 'Note', ok: 'OK' }[k]); const c = put(C, 'B' + (5 + i), t); c.alignment = { wrapText: true }; if (k === 'err') C.getCell('A' + (5 + i)).fill = RED; });
    return wb;
  }

  root.G2BBook = { build, totals, checks, threeB, summaryFig, BLOCKS };
})(typeof window !== 'undefined' ? window : globalThis);
