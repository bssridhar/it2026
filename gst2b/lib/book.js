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
    BLOCKS.forEach(([cat, ttl, always]) => {
      const list = ctx.rows.filter(x => x.cat === cat && !x.amend);
      if (!list.length && !always) return;
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
    const DH = ['Section', 'GSTIN', 'Name', 'Number', 'Type', 'Date', 'Value', 'Place of supply', 'Reverse charge', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Cess', 'Period', 'Filing date', 'ITC availability', '2B reason', 'Original no.', 'Original date', 'Category', 'GSTR-3B', 'Reason for ineligible / remarks', 'Set by', 'Flags'];
    DH.forEach((t, i) => head(D, D.getCell(4, i + 1).address, t)); [14, 17, 32, 18, 12, 11, 12, 13, 8, 13, 11, 11, 11, 9, 9, 11, 9, 14, 14, 11, 26, 18, 50, 12, 40].forEach((w, i) => D.getColumn(i + 1).width = w);
    ctx.rows.forEach((x, i) => { const rr = 5 + i;
      [x.sheet, x.gstin, x.name, x.docno, x.doctype, x.date, x.value, x.pos, x.rcm, x.txval, x.igst, x.cgst, x.sgst, x.cess, x.period, x.fdate, x.avail, x.reason2bOrig || '', x.orig.no, x.orig.date, CAT[x.cat][1], CAT[x.cat][2], x.reason, x.src === 'user' ? 'Marked' : x.src === 'supplier' ? 'Supplier rule' : 'Auto', x.flags.join('; ')]
        .forEach((v, k) => { const c = put(D, D.getCell(rr, k + 1).address, v === '' ? null : v); if ([6, 9, 10, 11, 12, 13].includes(k)) c.numFmt = NUM; }); });
    const dl = 5 + ctx.rows.length; put(D, 'C' + dl, 'Total', { bold: true }); ['G', 'J', 'K', 'L', 'M', 'N'].forEach(c => put(D, c + dl, `=SUBTOTAL(9,${c}5:${c}${dl - 1})`, { bold: true, fill: GREY }));
    D.autoFilter = { from: 'A4', to: `Y${Math.max(5, dl - 1)}` };

    /* ===== Supplier-wise ===== */
    const SW = wb.addWorksheet('Supplier-wise'); title(SW, 'supplier-wise totals');
    ['GSTIN', 'Name', 'Documents', 'Taxable value', 'IGST', 'CGST', 'SGST', 'Cess', 'Total tax', 'Categories'].forEach((t, i) => head(SW, SW.getCell(4, i + 1).address, t)); [17, 36, 10, 14, 12, 12, 12, 10, 13, 50].forEach((w, i) => SW.getColumn(i + 1).width = w);
    const by = {}; ctx.rows.filter(x => x.cat !== 'rejected').forEach(x => { const k = x.gstin || x.name; const o = by[k] = by[k] || { gstin: x.gstin, name: x.name, n: 0, txval: 0, igst: 0, cgst: 0, sgst: 0, cess: 0, cats: new Set() }; o.n++; ['txval', ...HEADS].forEach(h => o[h] += x[h]); o.cats.add(CAT[x.cat][1]); });
    Object.values(by).sort((a, b) => (b.igst + b.cgst + b.sgst) - (a.igst + a.cgst + a.sgst)).forEach((o, i) => { const rr = 5 + i;
      [o.gstin, o.name, o.n, o.txval, o.igst, o.cgst, o.sgst, o.cess].forEach((v, k) => put(SW, SW.getCell(rr, k + 1).address, v)); SW.getCell(rr, 3).numFmt = '0'; put(SW, 'I' + rr, `=SUM(E${rr}:H${rr})`); put(SW, 'J' + rr, [...o.cats].join(', ')); });

    /* ===== Checks ===== */
    const C = wb.addWorksheet('Checks'); title(C, 'points for review'); C.getColumn(1).width = 12; C.getColumn(2).width = 150;
    head(C, 'A4', 'Type'); head(C, 'B4', 'Point');
    checks(ctx).forEach(([k, t], i) => { put(C, 'A' + (5 + i), { err: 'Attention', warn: 'Review', info: 'Note', ok: 'OK' }[k]); const c = put(C, 'B' + (5 + i), t); c.alignment = { wrapText: true }; if (k === 'err') C.getCell('A' + (5 + i)).fill = RED; });
    return wb;
  }

  root.G2BBook = { build, totals, checks, threeB, summaryFig, BLOCKS };
})(typeof window !== 'undefined' ? window : globalThis);
