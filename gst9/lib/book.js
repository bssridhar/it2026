/*
 * GSTR-9 / 9C working – builds the Excel workbook (ExcelJS) from the parsed GSTR-1 and GSTR-3B returns.
 * window.GstBook = { MONTHS, monthData(st), checks(st), build(ExcelJS, st) }
 *
 * st = { gstin, legal, trade, fy: '2024-25', due1: 11, due3b: 20, months: { April: { r1: parsed, b3: parsed }, ... } }
 */
(function (root) {
  "use strict";
  const P = root.GstParse, MONTHS = P.MONTHS;
  const r2 = n => Math.round((n || 0) * 100) / 100;

  /* ---------- per-month figures ---------- */
  const g = (ret, key, col) => (ret && ret.data && ret.data[key] && typeof ret.data[key][col] === 'number') ? ret.data[key][col] : 0;
  const HEADS = ['igst', 'cgst', 'sgst', 'cess'];
  // GSTR-1 components of "sales" (net of amendments and advances) and of credit notes
  const SALES1 = ['b2b', 'b2cl', 'exp', 'sez', 'de', 'b2cs', 'a_b2b', 'a_b2cl', 'a_exp', 'a_sez', 'a_de', 'a_b2cs', 'adv', 'a_adv'];
  const LESS1 = ['adv_adj', 'a_adv_adj'];
  function monthData(st) {
    return MONTHS.map((m, i) => {
      const M = (st.months || {})[m] || {}, b = M.b3, r = M.r1;
      const o = { month: m, i, has3b: !!b, has1: !!r, b3: b, r1: r };
      // GSTR-3B
      o.b_sales = g(b, 't31a', 'txval'); o.b_igst = g(b, 't31a', 'igst') + g(b, 't31b', 'igst'); o.b_cgst = g(b, 't31a', 'cgst'); o.b_sgst = g(b, 't31a', 'sgst');
      o.b_zero = g(b, 't31b', 'txval'); o.b_rcm = g(b, 't31d', 'txval'); ['igst', 'cgst', 'sgst'].forEach(h => { o['b_rcm_' + h] = g(b, 't31d', h); });
      ['igst', 'cgst', 'sgst'].forEach(h => {
        o['itc_net_' + h] = g(b, 't4c', h);                                     // 4C
        o['itc_lessrcm_' + h] = g(b, 't4c', h) - g(b, 't4a3', h);              // 4C less 4A(3)
        o['itc_gross_' + h] = g(b, 't4a2', h) + g(b, 't4a4', h) + g(b, 't4a5', h);
        o['itc_rcm_' + h] = g(b, 't4a3', h); o['itc_imp_' + h] = g(b, 't4a1', h);
        o['itc_rev1_' + h] = g(b, 't4b1', h); o['itc_rev2_' + h] = g(b, 't4b2', h);
      });
      o.itc_rcm_total = ['igst', 'cgst', 'sgst'].reduce((s, h) => s + g(b, 't4a3', h), 0);
      const blk = ['A', 'B'];
      o.cash = blk.reduce((s, k) => s + HEADS.reduce((t, h) => t + g(b, `t61${k}_${h}`, 'cash'), 0), 0);
      o.fee = blk.reduce((s, k) => s + HEADS.reduce((t, h) => t + g(b, `t61${k}_${h}`, 'fee_cash'), 0), 0);
      o.int = blk.reduce((s, k) => s + HEADS.reduce((t, h) => t + g(b, `t61${k}_${h}`, 'int_cash'), 0), 0);
      // GSTR-1
      const sum1 = (keys, col) => keys.reduce((s, k) => s + g(r, k, col), 0);
      ['txval', 'igst', 'cgst', 'sgst'].forEach(c => {
        o['s_' + c] = sum1(SALES1, c) - sum1(LESS1, c);
        // credit notes shown positive: −(net of debit − credit), reverse-charge notes excluded
        o['cn_' + c] = -(g(r, 'cdnr', c) - g(r, 'cdnr_rc', c) + g(r, 'cdnur', c) + g(r, 'cdnra', c) + g(r, 'cdnura', c));
        o['tl_' + c] = g(r, 'total', c);
      });
      return o;
    });
  }

  /* ---------- checks ---------- */
  function checks(st) {
    const out = [], md = monthData(st), add = (k, t) => out.push([k, t]);
    const miss3 = md.filter(o => !o.has3b).map(o => o.month), miss1 = md.filter(o => !o.has1).map(o => o.month);
    if (miss3.length) add('warn', `GSTR-3B not loaded for: ${miss3.join(', ')}.`);
    if (miss1.length) add('warn', `GSTR-1 not loaded for: ${miss1.join(', ')}${miss1.length < 12 ? ' (for a quarterly GSTR-1 the quarter is shown in the last month of the quarter)' : ''}.`);
    md.forEach(o => {
      [['GSTR-3B', o.b3], ['GSTR-1', o.r1]].forEach(([n, x]) => { if (x && x.missing && x.missing.length) add('warn', `${o.month} ${n}: could not read ${x.missing.join(', ')} – check the PDF and enter these in the data sheet.`); if (x && x.quarter) add('info', `${o.month} ${n}: quarterly return (period "${x.period}") – shown against ${o.month}.`); });
      if (o.has1 && o.r1.data.hsn) { const tv = o.s_txval - o.cn_txval; const h = g(o.r1, 'hsn', 'txval'); if (Math.abs(h - tv) > 1) add('warn', `${o.month} GSTR-1: HSN summary (Table 12) ${fmt(h)} differs from the net taxable value ${fmt(tv)} by ${fmt(h - tv)} – review (Table 12 includes nil / exempt / reverse charge supplies, if any).`); }
      if (o.has1 && o.r1.data.total) { const tv = o.s_txval - o.cn_txval; const t = g(o.r1, 'total', 'txval'); if (Math.abs(t - tv) > 1) add('warn', `${o.month} GSTR-1: total liability ${fmt(t)} vs the tables added up ${fmt(tv)} – difference ${fmt(t - tv)}; check which tables are included in "Sales" (see the GSTR-1 data sheet).`); }
      if (o.has1 && o.has3b) {
        const dv = o.b_sales + o.b_zero - (o.s_txval - o.cn_txval), dt = (o.b_igst + o.b_cgst + o.b_sgst) - (o.s_igst + o.s_cgst + o.s_sgst - o.cn_igst - o.cn_cgst - o.cn_sgst);
        if (Math.abs(dv) > 1 || Math.abs(dt) > 1) add('err', `${o.month}: GSTR-3B vs GSTR-1 – taxable value differs by ${fmt(dv)}, tax by ${fmt(dt)}.`);
      }
      if (o.has3b) {
        const ine = HEADS.reduce((s, h) => s + g(o.b3, 't4d2', h), 0); if (ine) add('info', `${o.month} GSTR-3B: ineligible ITC u/s 16(4) / place of supply ${fmt(ine)} (Table 4D(2)) – consider for GSTR-9 Table 8.`);
        const rec = HEADS.reduce((s, h) => s + g(o.b3, 't4d1', h), 0); if (rec) add('info', `${o.month} GSTR-3B: ITC reclaimed ${fmt(rec)} (Table 4D(1)) – goes to GSTR-9 Table 6H.`);
        const rev = HEADS.reduce((s, h) => s + g(o.b3, 't4b1', h) + g(o.b3, 't4b2', h), 0); if (rev) add('info', `${o.month} GSTR-3B: ITC reversed ${fmt(rev)} (Table 4B) – split in GSTR-9 Table 7.`);
        if (o.fee) add('info', `${o.month} GSTR-3B: late fee of ${fmt(o.fee)} paid.`);
        if (o.int) add('info', `${o.month} GSTR-3B: interest of ${fmt(o.int)} paid.`);
      }
    });
    // filing dates
    filing(st).forEach(f => { if (f.late1 > 0) add('info', `${f.month}: GSTR-1 filed ${f.late1} day(s) after the due date entered.`); if (f.late3 > 0) add('warn', `${f.month}: GSTR-3B filed ${f.late3} day(s) after the due date entered – check interest u/s 50 on tax paid in cash, and late fee.`); });
    if (!out.length) add('ok', 'No exceptions.');
    return out;
  }
  const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fyY = st => +String(st.fy || '').slice(0, 4) || new Date().getFullYear();
  const monthYM = (st, i) => { const y = fyY(st) + (i >= 9 ? 1 : 0), m = (i + 3) % 12; return [y, m]; };        // m 0-based
  const parseDMY = s => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : null; };
  function filing(st) {
    return MONTHS.map((m, i) => { const M = (st.months || {})[m] || {}, [y, mm] = monthYM(st, i);
      const due1 = Date.UTC(y, mm + 1, +st.due1 || 11), due3 = Date.UTC(y, mm + 1, +st.due3b || 20);
      const f1 = M.r1 ? parseDMY(M.r1.arnDate) : null, f3 = M.b3 ? parseDMY(M.b3.arnDate) : null;
      return { month: m, y, mm, due1, due3, f1, f3, arn1: M.r1 ? M.r1.arn : '', arn3: M.b3 ? M.b3.arn : '', late1: f1 ? Math.round((f1 - due1) / 864e5) : 0, late3: f3 ? Math.round((f3 - due3) / 864e5) : 0 };
    });
  }

  /* ---------- workbook ---------- */
  const serial = t => (t - Date.UTC(1899, 11, 30)) / 864e5;
  const NUM = '#,##0.00;[Red]-#,##0.00';
  const BLUE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F5FAE' } }, LIGHT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F2' } },
    YEL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }, GREY = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  const thin = { style: 'thin', color: { argb: 'FFB7BEC9' } }, BOX = { top: thin, left: thin, bottom: thin, right: thin };

  function build(ExcelJS, st) {
    const wb = new ExcelJS.Workbook(); wb.creator = 'Practice tool kit'; wb.created = new Date();
    const md = monthData(st), name = st.trade || st.legal || 'Registered person';
    const head = (ws, ref, text, fill) => { const c = ws.getCell(ref); c.value = text; c.font = { bold: true, color: { argb: fill === LIGHT ? 'FF1D2330' : 'FFFFFFFF' } }; c.fill = fill || BLUE; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; c.border = BOX; };
    const put = (ws, ref, v, opt = {}) => { const c = ws.getCell(ref); c.value = typeof v === 'string' && v.startsWith('=') ? { formula: v.slice(1) } : (typeof v === 'number' ? r2(v) : v); if (opt.num !== false && (typeof v === 'number' || (typeof v === 'string' && v.startsWith('=')))) c.numFmt = NUM; if (opt.input) c.fill = YEL; if (opt.bold) c.font = { bold: true }; if (opt.fill) c.fill = opt.fill; c.border = BOX; return c; };
    const monthCell = (ws, ref, i) => { const [y, m] = monthYM(st, i); const c = ws.getCell(ref); c.value = serial(Date.UTC(y, m, 1)); c.numFmt = 'mmm-yy'; c.border = BOX; c.font = { bold: true }; };
    const title = (ws, sub) => { ws.getCell('A1').value = name; ws.getCell('A1').font = { bold: true, size: 14 }; ws.getCell('A2').value = `GSTIN ${st.gstin || ''} · Financial year ${st.fy || ''}${sub ? ' · ' + sub : ''}`; ws.getCell('A2').font = { italic: true, color: { argb: 'FF5B6475' } }; };

    /* ===== GSTR Recon (layout of the firm's working sheet) ===== */
    const R = wb.addWorksheet('GSTR Recon', { views: [{ state: 'frozen', xSplit: 1 }] });
    title(R); R.mergeCells('A1:H1');
    R.getColumn(1).width = 30; for (let c = 2; c <= 27; c++) R.getColumn(c).width = 15;
    // --- block 1: GSTR-3B
    R.getCell('A4').value = 'As per GSTR 3B'; R.getCell('A4').font = { bold: true, size: 12 };
    R.mergeCells('P4:V4'); head(R, 'P4', 'Total inputs as per monthly tax liability (GSTR-3B)', LIGHT); head(R, 'X4', 'Total to be paid', LIGHT); head(R, 'Y4', 'Tax paid as per GST portal', LIGHT);
    const H1 = { A: 'MONTH', B: 'SALES (3.1(a))', C: 'OUTPUT IGST (3.1(a)+(b))', D: 'OUTPUT CGST', E: 'OUTPUT SGST', F: 'SEZ / ZERO RATED SALE (3.1(b))', G: 'RCM (3.1(d))', H: 'IGST', I: 'CGST', J: 'SGST', K: 'TOTAL Sales', L: 'IGST', M: 'CGST', N: 'SGST' };
    Object.entries(H1).forEach(([c, t]) => { R.mergeCells(`${c}5:${c}6`); head(R, c + '5', t); });
    [['P', 'IGST'], ['Q', 'CGST'], ['R', 'SGST'], ['S', 'Total Inputs'], ['T', 'RCM (4A(3))'], ['U', 'Late fee'], ['V', 'Interest'], ['X', 'Taxable value'], ['Y', 'Paid in cash (6.1)'], ['AA', 'Difference']].forEach(([c, t]) => head(R, c + '6', t));
    head(R, 'P5', '4C less 4A(3)', LIGHT); R.mergeCells('P5:R5');
    md.forEach((o, i) => { const r = 7 + i; monthCell(R, 'A' + r, i);
      put(R, 'B' + r, o.b_sales); put(R, 'C' + r, o.b_igst); put(R, 'D' + r, o.b_cgst); put(R, 'E' + r, o.b_sgst); put(R, 'F' + r, o.b_zero); put(R, 'G' + r, o.b_rcm);
      put(R, 'H' + r, o.b_rcm_igst); put(R, 'I' + r, o.b_rcm_cgst); put(R, 'J' + r, o.b_rcm_sgst);
      put(R, 'K' + r, `=B${r}+F${r}`); put(R, 'L' + r, `=C${r}`); put(R, 'M' + r, `=D${r}`); put(R, 'N' + r, `=E${r}`);
      put(R, 'P' + r, o.itc_lessrcm_igst); put(R, 'Q' + r, o.itc_lessrcm_cgst); put(R, 'R' + r, o.itc_lessrcm_sgst); put(R, 'S' + r, `=SUM(P${r}:R${r})`); put(R, 'T' + r, o.itc_rcm_total);
      put(R, 'U' + r, o.fee); put(R, 'V' + r, o.int); put(R, 'X' + r, `=SUM(L${r}:N${r})-S${r}-U${r}-V${r}`); put(R, 'Y' + r, o.cash); put(R, 'AA' + r, `=X${r}-Y${r}`);
      if (!o.has3b) R.getCell('A' + r).fill = YEL; });
    const tot = (ws, row, from, to, cols, label) => { put(ws, 'A' + row, label || 'Total', { bold: true }); cols.forEach(c => put(ws, c + row, `=SUM(${c}${from}:${c}${to})`, { bold: true, fill: GREY })); };
    tot(R, 19, 7, 18, ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y', 'AA']);
    put(R, 'A20', 'Total as per GSTR-3B Summary'); 'BCDEFGHIJ'.split('').forEach(c => put(R, c + '20', null, { input: true, num: false })); 'BCDEFGHIJ'.split('').forEach(c => R.getCell(c + '20').numFmt = NUM);
    put(R, 'A21', 'Differences'); 'BCDEFGHIJ'.split('').forEach(c => put(R, c + '21', `=${c}19-${c}20`));
    // --- block 2: GSTR-1
    R.getCell('A24').value = 'GSTR-1'; R.getCell('A24').font = { bold: true, size: 12 };
    R.mergeCells('A25:E25'); head(R, 'A25', 'SALE', LIGHT); R.mergeCells('F25:I25'); head(R, 'F25', 'CREDIT NOTE (net of debit notes)', LIGHT); R.mergeCells('J25:M25'); head(R, 'J25', 'TOTAL', LIGHT);
    R.mergeCells('O25:R25'); head(R, 'O25', 'Differences between GSTR-3B VS GSTR-1', LIGHT); R.mergeCells('T25:W25'); head(R, 'T25', 'Check with the GSTR-1 total liability', LIGHT);
    const H2 = { A: 'MONTH', B: 'SALES', C: 'OUTPUT IGST', D: 'OUTPUT CGST', E: 'OUTPUT SGST', F: 'CREDIT NOTE TAXABLE', G: 'CN IGST', H: 'CN CGST', I: 'CN SGST', J: 'TAXABLE SALE', K: 'IGST', L: 'CGST', M: 'SGST', O: 'TAXABLE SALE', P: 'IGST', Q: 'CGST', R: 'SGST', T: 'Taxable value as per GSTR-1', U: 'Difference', V: 'Tax as per GSTR-1', W: 'Difference' };
    Object.entries(H2).forEach(([c, t]) => { R.mergeCells(`${c}26:${c}27`); head(R, c + '26', t); });
    md.forEach((o, i) => { const r = 28 + i, b = 7 + i; monthCell(R, 'A' + r, i);
      put(R, 'B' + r, o.s_txval); put(R, 'C' + r, o.s_igst); put(R, 'D' + r, o.s_cgst); put(R, 'E' + r, o.s_sgst);
      put(R, 'F' + r, o.cn_txval); put(R, 'G' + r, o.cn_igst); put(R, 'H' + r, o.cn_cgst); put(R, 'I' + r, o.cn_sgst);
      put(R, 'J' + r, `=B${r}-F${r}`); put(R, 'K' + r, `=C${r}-G${r}`); put(R, 'L' + r, `=D${r}-H${r}`); put(R, 'M' + r, `=E${r}-I${r}`);
      put(R, 'O' + r, `=K${b}-J${r}`); put(R, 'P' + r, `=L${b}-K${r}`); put(R, 'Q' + r, `=M${b}-L${r}`); put(R, 'R' + r, `=N${b}-M${r}`);
      put(R, 'T' + r, o.tl_txval); put(R, 'U' + r, `=J${r}-T${r}`); put(R, 'V' + r, o.tl_igst + o.tl_cgst + o.tl_sgst); put(R, 'W' + r, `=K${r}+L${r}+M${r}-V${r}`);
      if (!o.has1) R.getCell('A' + r).fill = YEL; });
    tot(R, 40, 28, 39, ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'O', 'P', 'Q', 'R', 'T', 'U', 'V', 'W']);
    put(R, 'A41', 'Total as per GSTR-1 Summary'); 'BCDEFGHI'.split('').forEach(c => { put(R, c + '41', null, { input: true }); R.getCell(c + '41').numFmt = NUM; });
    put(R, 'A42', 'Differences'); 'BCDEFGHI'.split('').forEach(c => put(R, c + '42', `=${c}40-${c}41`));
    R.getCell('A43').value = 'Sales = GSTR-1 Tables 4A, 5, 6A, 6B, 6C, 7, amendments (9A, 10) and advances (11A less 11B). Reverse charge supplies (4B) are not included. Credit notes = net of Tables 9B and 9C (other than reverse charge), shown positive.';
    R.getCell('A43').font = { italic: true, size: 9, color: { argb: 'FF5B6475' } };
    // --- block 3: books (left blank for the user)
    R.getCell('A45').value = 'BOOKS'; R.getCell('A45').font = { bold: true, size: 12 };
    R.mergeCells('A46:E46'); head(R, 'A46', 'SALE', LIGHT); R.mergeCells('F46:I46'); head(R, 'F46', 'CREDIT NOTE', LIGHT); R.mergeCells('J46:M46'); head(R, 'J46', 'TOTAL', LIGHT); R.mergeCells('O46:R46'); head(R, 'O46', 'Differences between Books VS GSTR-1', LIGHT);
    Object.entries(H2).filter(([c]) => !'TUVW'.includes(c)).forEach(([c, t]) => { R.mergeCells(`${c}47:${c}48`); head(R, c + '47', t); });
    md.forEach((o, i) => { const r = 49 + i, g1 = 28 + i; monthCell(R, 'A' + r, i);
      ['B', 'C', 'D', 'F', 'G', 'H'].forEach(c => { put(R, c + r, null, { input: true }); R.getCell(c + r).numFmt = NUM; });
      put(R, 'E' + r, `=D${r}`); put(R, 'I' + r, `=H${r}`);
      put(R, 'J' + r, `=B${r}-F${r}`); put(R, 'K' + r, `=C${r}-G${r}`); put(R, 'L' + r, `=D${r}-H${r}`); put(R, 'M' + r, `=E${r}-I${r}`);
      put(R, 'O' + r, `=J${r}-J${g1}`); put(R, 'P' + r, `=K${r}-K${g1}`); put(R, 'Q' + r, `=L${r}-L${g1}`); put(R, 'R' + r, `=M${r}-M${g1}`); });
    tot(R, 61, 49, 60, ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'O', 'P', 'Q', 'R']);
    put(R, 'A62', 'Total sales as per books (Tally)'); put(R, 'A63', 'As per Financials');
    [62, 63].forEach(r => 'BCDEFGHI'.split('').forEach(c => { put(R, c + r, null, { input: true }); R.getCell(c + r).numFmt = NUM; }));
    R.getCell('A64').value = 'Yellow cells: enter from the books. SGST (E) and CN SGST (I) follow CGST – overwrite if needed.'; R.getCell('A64').font = { italic: true, size: 9, color: { argb: 'FF5B6475' } };
    // --- block 4: input tax credit
    R.getCell('A69').value = 'Input'; R.getCell('A69').font = { bold: true, size: 12 };
    R.mergeCells('A70:A71'); head(R, 'A70', 'Month');
    [['B70:D70', 'As per GSTR-3B (4C less 4A(1))'], ['E70:G70', 'Import Of Goods (4A(1))'], ['H70:J70', 'As per books'], ['K70:M70', 'Difference']].forEach(([rg, t]) => { R.mergeCells(rg); head(R, rg.split(':')[0], t); });
    'BEHK'.split('').forEach(s => { const i0 = s.charCodeAt(0); ['IGST', 'CGST', 'SGST'].forEach((t, k) => head(R, String.fromCharCode(i0 + k) + '71', t)); });
    md.forEach((o, i) => { const r = 72 + i; monthCell(R, 'A' + r, i);
      put(R, 'B' + r, o.itc_net_igst - o.itc_imp_igst); put(R, 'C' + r, o.itc_net_cgst - o.itc_imp_cgst); put(R, 'D' + r, o.itc_net_sgst - o.itc_imp_sgst);
      put(R, 'E' + r, o.itc_imp_igst); put(R, 'F' + r, o.itc_imp_cgst); put(R, 'G' + r, o.itc_imp_sgst);
      put(R, 'H' + r, null, { input: true }); put(R, 'I' + r, null, { input: true }); put(R, 'J' + r, `=I${r}`); ['H', 'I'].forEach(c => R.getCell(c + r).numFmt = NUM);
      put(R, 'K' + r, `=B${r}+E${r}-H${r}`); put(R, 'L' + r, `=C${r}+F${r}-I${r}`); put(R, 'M' + r, `=D${r}+G${r}-J${r}`); });
    tot(R, 84, 72, 83, ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M']);
    put(R, 'A85', 'Total as per GSTR-3B Summary'); 'BCD'.split('').forEach(c => { put(R, c + '85', null, { input: true }); R.getCell(c + '85').numFmt = NUM; });
    put(R, 'A86', 'Differences'); 'BCD'.split('').forEach(c => put(R, c + '86', `=${c}84-${c}85`));
    // --- block 5: ITC break-up
    R.mergeCells('A89:A90'); head(R, 'A89', 'Month');
    [['B89:D89', 'GROSS ITC (4A(2)+(4)+(5))'], ['E89:G89', 'RCM (4A(3))'], ['H89:J89', 'Import of Goods (4A(1))'], ['K89:M89', 'Rules 38/42/43 & 17(5) (4B(1))'], ['N89:P89', 'OTHERS (4B(2))'], ['Q89:S89', 'NET ITC'], ['U89:W89', 'Net ITC as per GSTR-3B (4C)'], ['X89:Z89', 'Difference']].forEach(([rg, t]) => { R.mergeCells(rg); head(R, rg.split(':')[0], t); });
    'BEHKNQUX'.split('').forEach(s => { const i0 = s.charCodeAt(0); ['IGST', 'CGST', 'SGST'].forEach((t, k) => head(R, String.fromCharCode(i0 + k) + '90', t)); });
    md.forEach((o, i) => { const r = 91 + i; monthCell(R, 'A' + r, i);
      const H3 = ['igst', 'cgst', 'sgst'], set = (s, pre) => H3.forEach((h, k) => put(R, String.fromCharCode(s.charCodeAt(0) + k) + r, o[pre + h]));
      set('B', 'itc_gross_'); set('E', 'itc_rcm_'); set('H', 'itc_imp_'); set('K', 'itc_rev1_'); set('N', 'itc_rev2_'); set('U', 'itc_net_');
      put(R, 'Q' + r, `=B${r}+E${r}+H${r}-K${r}-N${r}`); put(R, 'R' + r, `=C${r}+F${r}+I${r}-L${r}-O${r}`); put(R, 'S' + r, `=D${r}+G${r}+J${r}-M${r}-P${r}`);
      put(R, 'X' + r, `=Q${r}-U${r}`); put(R, 'Y' + r, `=R${r}-V${r}`); put(R, 'Z' + r, `=S${r}-W${r}`); });
    tot(R, 103, 91, 102, 'BCDEFGHIJKLMNOPQRSUVWXYZ'.split('').filter(c => c !== 'T'));

    /* ===== data sheets ===== */
    const ref = {};
    function dataSheet(sheetName, type, fields, note) {
      const D = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] });
      title(D, note); D.getColumn(1).width = 62; for (let c = 2; c <= 14; c++) D.getColumn(c).width = 14;
      head(D, 'A4', 'Table / column'); MONTHS.forEach((m, i) => { const c = D.getCell(4, 2 + i); const [y, mm] = monthYM(st, i); c.value = serial(Date.UTC(y, mm, 1)); c.numFmt = 'mmm-yy'; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = BLUE; c.border = BOX; c.alignment = { horizontal: 'center' }; });
      head(D, 'N4', 'Total');
      let r = 5;
      fields.forEach(([key, label, cols]) => {
        const c0 = D.getCell('A' + r); c0.value = label; c0.font = { bold: true }; c0.fill = LIGHT; D.mergeCells(`A${r}:N${r}`); r++;
        cols.forEach(col => {
          put(D, 'A' + r, '   ' + COLNAME[col], { num: false });
          MONTHS.forEach((m, i) => { const ret = ((st.months || {})[m] || {})[type]; const cell = D.getCell(r, 2 + i);
            const has = ret && ret.data && ret.data[key] && typeof ret.data[key][col] === 'number';
            cell.value = has ? r2(ret.data[key][col]) : null; cell.numFmt = NUM; cell.border = BOX; if (!ret) cell.fill = GREY; });
          put(D, 'N' + r, `=SUM(B${r}:M${r})`, { bold: true });
          ref[`${type}|${key}|${col}`] = { sheet: sheetName, row: r }; r++;
        });
      });
      return D;
    }
    const COLNAME = { txval: 'Taxable value', igst: 'Integrated tax', cgst: 'Central tax', sgst: 'State/UT tax', cess: 'Cess', inter: 'Inter-State', intra: 'Intra-State',
      payable: 'Tax payable', adj_neg: 'Adjustment of negative liability', net_payable: 'Net tax payable', itc_igst: 'Paid through ITC – Integrated tax', itc_cgst: 'Paid through ITC – Central tax', itc_sgst: 'Paid through ITC – State/UT tax', itc_cess: 'Paid through ITC – Cess', cash: 'Tax paid in cash', int_cash: 'Interest paid in cash', fee_cash: 'Late fee paid in cash', count: 'Number' };
    const f3 = P.FIELDS3B.map(([k, , cols, label]) => [k, label, cols]);
    ['A', 'B'].forEach(b => [['igst', 'Integrated tax'], ['cgst', 'Central tax'], ['sgst', 'State/UT tax'], ['cess', 'Cess']].forEach(([h, hn]) => f3.push([`t61${b}_${h}`, `6.1 Payment of tax – ${b === 'A' ? '(A) other than reverse charge' : '(B) reverse charge and u/s 9(5)'} – ${hn}`, P.C61])));
    dataSheet('GSTR-3B data', 'b3', f3, 'GSTR-3B month-wise, as read from the returns');
    const f1 = P.FIELDS1.map(([k, , , cols, label]) => [k, label, cols]).concat([['docs', '13 Documents issued – net', ['count']]]);
    dataSheet('GSTR-1 data', 'r1', f1, 'GSTR-1 month-wise, as read from the returns (amendments and notes are net differentials)');
    const T = (type, key, col) => { const x = ref[`${type}|${key}|${col}`]; return x ? `'${x.sheet}'!N${x.row}` : '0'; };

    /* ===== GSTR-9 draft ===== */
    const G = wb.addWorksheet('GSTR-9 draft', { views: [{ state: 'frozen', ySplit: 4 }] });
    title(G, 'GSTR-9 – draft from the returns (check every figure before filing)');
    [10, 70, 16, 15, 15, 15, 12, 60].forEach((w, i) => G.getColumn(i + 1).width = w);
    let gr = 4; const rowOf = {};
    const hdr = cols => { cols.forEach((t, i) => head(G, G.getCell(gr, i + 1).address, t)); gr++; };
    const section = t => { const c = G.getCell('A' + gr); c.value = t; c.font = { bold: true, size: 12 }; G.mergeCells(`A${gr}:H${gr}`); gr++; };
    const COLS = ['txval', 'igst', 'cgst', 'sgst', 'cess'], LET = ['C', 'D', 'E', 'F', 'G'];
    // line(code, desc, perCol (col -> formula string or null), {input, note, bold, cols})
    function line(code, desc, f, o = {}) {
      put(G, 'A' + gr, code, { num: false, bold: o.bold }); put(G, 'B' + gr, desc, { num: false, bold: o.bold }); G.getCell('B' + gr).alignment = { wrapText: true };
      (o.cols || COLS).forEach(col => { const L = LET[COLS.indexOf(col)]; const v = typeof f === 'function' ? f(col, L) : null;
        if (v === null || v === undefined) { put(G, L + gr, null, { input: o.input }); G.getCell(L + gr).numFmt = NUM; } else put(G, L + gr, '=' + v, { bold: o.bold, fill: o.bold ? GREY : undefined }); });
      if (o.note) { const c = G.getCell('H' + gr); c.value = o.note; c.font = { size: 9, color: { argb: 'FF5B6475' } }; c.alignment = { wrapText: true }; }
      rowOf[code] = gr; gr++;
    }
    const sumK = (type, keys) => col => keys.map(k => T(type, ...(Array.isArray(k) ? k : [k, col]))).join('+') || '0';
    const at = (code, L) => `${L}${rowOf[code]}`;
    section('Pt. II – Table 4: Outward supplies, advances and inward supplies on which tax is payable');
    hdr(['Table', 'Nature of supplies', 'Taxable value', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', 'Source / note']);
    line('4A', 'Supplies made to un-registered persons (B2C)', sumK('r1', ['b2cl', 'b2cs', 'a_b2cl', 'a_b2cs', 'cdnur_b2cl']), { note: 'GSTR-1 Tables 5 and 7 with amendments (9A, 10) and B2CL notes (9B CDNUR)' });
    line('4B', 'Supplies made to registered persons (B2B)', sumK('r1', ['b2b']), { note: 'GSTR-1 Table 4A (B2B regular)' });
    line('4C', 'Zero rated supply (Export) on payment of tax (except supplies to SEZs)', sumK('r1', ['expwp']), { note: 'GSTR-1 Table 6A – EXPWP' });
    line('4D', 'Supply to SEZs on payment of tax', sumK('r1', ['sezwp']), { note: 'GSTR-1 Table 6B – SEZWP' });
    line('4E', 'Deemed Exports', sumK('r1', ['de']), { note: 'GSTR-1 Table 6C' });
    line('4F', 'Advances on which tax has been paid but invoice has not been issued (not covered under (A) to (E) above)', col => `${sumK('r1', ['adv', 'a_adv'])(col)}-(${sumK('r1', ['adv_adj', 'a_adv_adj'])(col)})`, { note: 'GSTR-1 Table 11A less 11B (unadjusted advances) – verify' });
    line('4G', 'Inward supplies on which tax is to be paid on reverse charge basis', sumK('b3', ['t31d']), { note: 'GSTR-3B Table 3.1(d)' });
    line('4H', 'Sub-total (A to G above)', (c, L) => `SUM(${L}${rowOf['4A']}:${L}${rowOf['4G']})`, { bold: true });
    const cnNet = col => `${T('r1', 'cdnr', col)}-${T('r1', 'cdnr_rc', col)}+${T('r1', 'cdnur_expwp', col)}`;
    line('4I', 'Credit Notes issued in respect of transactions specified in (B) to (E) above (-)', col => `MAX(0,-(${cnNet(col)}))`, { note: 'GSTR-1 Table 9B – the PDF gives only the net of debit and credit notes; split if both were issued' });
    line('4J', 'Debit Notes issued in respect of transactions specified in (B) to (E) above (+)', col => `MAX(0,${cnNet(col)})`, { note: 'GSTR-1 Table 9B (net)' });
    const amNet = col => sumK('r1', ['a_b2b', 'a_expwp', 'a_sezwp', 'a_de', 'cdnra'])(col);
    line('4K', 'Supplies / tax declared through Amendments (+)', col => `MAX(0,${amNet(col)})`, { note: 'GSTR-1 Tables 9A and 9C – net differential' });
    line('4L', 'Supplies / tax reduced through Amendments (-)', col => `MAX(0,-(${amNet(col)}))`, { note: 'GSTR-1 Tables 9A and 9C – net differential' });
    line('4M', 'Sub-total (I to L above)', (c, L) => `-${at('4I', L)}+${at('4J', L)}+${at('4K', L)}-${at('4L', L)}`, { bold: true });
    line('4N', 'Supplies and advances on which tax is to be paid (H + M) above', (c, L) => `${at('4H', L)}+${at('4M', L)}`, { bold: true });
    gr++;
    section('Pt. II – Table 5: Outward supplies on which tax is not payable');
    hdr(['Table', 'Nature of supplies', 'Taxable value', '', '', '', '', 'Source / note']);
    const V = { cols: ['txval'] };
    line('5A', 'Zero rated supply (Export) without payment of tax', sumK('r1', ['expwop']), Object.assign({ note: 'GSTR-1 Table 6A – EXPWOP' }, V));
    line('5B', 'Supply to SEZs without payment of tax', sumK('r1', ['sezwop']), Object.assign({ note: 'GSTR-1 Table 6B – SEZWOP' }, V));
    line('5C', 'Supplies on which tax is to be paid by the recipient on reverse charge basis', sumK('r1', ['b2brc']), Object.assign({ note: 'GSTR-1 Table 4B' }, V));
    line('5D', 'Exempted', sumK('r1', ['exempt']), Object.assign({ note: 'GSTR-1 Table 8' }, V));
    line('5E', 'Nil Rated', sumK('r1', ['nil']), Object.assign({ note: 'GSTR-1 Table 8' }, V));
    line('5F', 'Non-GST supply', sumK('r1', ['nongst']), Object.assign({ note: 'GSTR-1 Table 8; also check GSTR-3B 3.1(e)' }, V));
    line('5G', 'Sub-total (A to F above)', (c, L) => `SUM(${L}${rowOf['5A']}:${L}${rowOf['5F']})`, Object.assign({ bold: true }, V));
    const cn5 = col => `${T('r1', 'cdnr_rc', col)}+${T('r1', 'cdnur_expwop', col)}`;
    line('5H', 'Credit Notes issued in respect of transactions specified in A to F above (-)', col => `MAX(0,-(${cn5(col)}))`, Object.assign({ note: 'GSTR-1 9B (reverse charge, EXPWOP) – net; SEZWOP notes are inside the SEZ total – check' }, V));
    line('5I', 'Debit Notes issued in respect of transactions specified in A to F above (+)', col => `MAX(0,${cn5(col)})`, V);
    const am5 = col => sumK('r1', ['a_expwop', 'a_sezwop', 'a_b2brc'])(col);
    line('5J', 'Supplies declared through Amendments (+)', col => `MAX(0,${am5(col)})`, V);
    line('5K', 'Supplies reduced through Amendments (-)', col => `MAX(0,-(${am5(col)}))`, V);
    line('5L', 'Sub-Total (H to K above)', (c, L) => `-${at('5H', L)}+${at('5I', L)}+${at('5J', L)}-${at('5K', L)}`, Object.assign({ bold: true }, V));
    line('5M', 'Turnover on which tax is not to be paid (G + L above)', (c, L) => `${at('5G', L)}+${at('5L', L)}`, Object.assign({ bold: true }, V));
    line('5N', 'Total Turnover (including advances) (4N + 5M - 4G above)', (c, L) => `${at('4N', L)}+${at('5M', L)}-${at('4G', L)}`, Object.assign({ bold: true }, V));
    gr++;
    section('Pt. III – Table 6: Input tax credit availed during the financial year');
    hdr(['Table', 'Description', '', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', 'Source / note']);
    const TX = { cols: ['igst', 'cgst', 'sgst', 'cess'] }, Ti = o => Object.assign({}, TX, o);
    line('6A', 'Total amount of input tax credit availed through FORM GSTR-3B (sum total of Table 4A of FORM GSTR-3B)', sumK('b3', ['t4a1', 't4a2', 't4a3', 't4a4', 't4a5']), Ti({ bold: true, note: 'GSTR-3B Table 4A(1) to (5)' }));
    line('6B-I', '6B Inward supplies (other than imports and inward supplies liable to reverse charge but includes services received from SEZs) – Inputs', (c, L) => `${sumK('b3', ['t4a5'])(c)}-${sumK('b3', ['t4d1'])(c)}-${L}${gr + 1}-${L}${gr + 2}`, Ti({ note: 'GSTR-3B 4A(5) less 4D(1); enter capital goods and input services below – inputs is the balance' }));
    line('6B-C', '6B – Capital Goods', null, Ti({ input: true }));
    line('6B-S', '6B – Input Services', null, Ti({ input: true }));
    line('6C-I', '6C Inward supplies received from unregistered persons liable to reverse charge (other than B above) on which tax is paid & ITC availed – Inputs', null, Ti({ input: true, note: 'Enter the part of GSTR-3B 4A(3) from unregistered persons' }));
    line('6C-C', '6C – Capital Goods', null, Ti({ input: true })); line('6C-S', '6C – Input Services', null, Ti({ input: true }));
    line('6D-I', '6D Inward supplies received from registered persons liable to reverse charge (other than B above) on which tax is paid and ITC availed – Inputs', (c, L) => `${sumK('b3', ['t4a3'])(c)}-SUM(${L}${rowOf['6C-I']}:${L}${rowOf['6C-S']})-${L}${gr + 1}-${L}${gr + 2}`, Ti({ note: 'GSTR-3B 4A(3) less 6C; enter capital goods and input services below' }));
    line('6D-C', '6D – Capital Goods', null, Ti({ input: true })); line('6D-S', '6D – Input Services', null, Ti({ input: true }));
    line('6E-I', '6E Import of goods (including supplies from SEZs) – Inputs', (c, L) => `${sumK('b3', ['t4a1'])(c)}-${L}${gr + 1}`, Ti({ note: 'GSTR-3B 4A(1); enter capital goods below' }));
    line('6E-C', '6E – Capital Goods', null, Ti({ input: true }));
    line('6F', 'Import of services (excluding inward supplies from SEZs)', sumK('b3', ['t4a2']), Ti({ note: 'GSTR-3B 4A(2)' }));
    line('6G', 'Input Tax credit received from ISD', sumK('b3', ['t4a4']), Ti({ note: 'GSTR-3B 4A(4)' }));
    line('6H', 'Amount of ITC reclaimed (other than B above) under the provisions of the Act', sumK('b3', ['t4d1']), Ti({ note: 'GSTR-3B 4D(1)' }));
    line('6I', 'Sub-total (B to H above)', (c, L) => `SUM(${L}${rowOf['6B-I']}:${L}${rowOf['6H']})`, Ti({ bold: true }));
    line('6J', 'Difference (I - A above)', (c, L) => `${at('6I', L)}-${at('6A', L)}`, Ti({ bold: true, note: 'Should be nil' }));
    line('6K', 'Transition Credit through TRAN-I (including revisions if any)', null, Ti({ input: true }));
    line('6L', 'Transition Credit through TRAN-II', null, Ti({ input: true }));
    line('6M', 'Any other ITC availed but not specified above', null, Ti({ input: true }));
    line('6N', 'Sub-total (K to M above)', (c, L) => `SUM(${L}${rowOf['6K']}:${L}${rowOf['6M']})`, Ti({ bold: true }));
    line('6O', 'Total ITC availed (I + N above)', (c, L) => `${at('6I', L)}+${at('6N', L)}`, Ti({ bold: true }));
    gr++;
    section('Pt. III – Table 7: ITC reversed and ineligible ITC');
    hdr(['Table', 'Description', '', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', 'Source / note']);
    line('7-4B1', 'GSTR-3B Table 4B(1) for the year – to be split in 7A to 7E', sumK('b3', ['t4b1']), Ti({ note: 'For reference – not part of the total' }));
    line('7A', 'As per Rule 37', null, Ti({ input: true })); line('7B', 'As per Rule 39', null, Ti({ input: true })); line('7C', 'As per Rule 42', null, Ti({ input: true })); line('7D', 'As per Rule 43', null, Ti({ input: true }));
    line('7E', 'As per section 17(5)', (c, L) => `${at('7-4B1', L)}-SUM(${L}${rowOf['7A']}:${L}${rowOf['7D']})`, Ti({ note: 'Balance of GSTR-3B 4B(1) after 7A to 7D' }));
    line('7F', 'Reversal of TRAN-I credit', null, Ti({ input: true })); line('7G', 'Reversal of TRAN-II credit', null, Ti({ input: true }));
    line('7H', 'Other reversals (pl. specify)', sumK('b3', ['t4b2']), Ti({ note: 'GSTR-3B 4B(2)' }));
    line('7I', 'Total ITC Reversed (Sum of A to H above)', (c, L) => `SUM(${L}${rowOf['7A']}:${L}${rowOf['7H']})`, Ti({ bold: true }));
    line('7J', 'Net ITC Available for Utilization (6O - 7I)', (c, L) => `${at('6O', L)}-${at('7I', L)}`, Ti({ bold: true }));
    gr++;
    section('Pt. III – Table 8: Other ITC related information');
    hdr(['Table', 'Description', '', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', 'Source / note']);
    line('8A', 'ITC as per GSTR-2B (as auto-populated in Table 8A)', null, Ti({ input: true, note: 'Enter from the portal' }));
    line('8B', 'ITC as per sum total of 6(B) and 6(H) above', (c, L) => `SUM(${L}${rowOf['6B-I']}:${L}${rowOf['6B-S']})+${at('6H', L)}`, Ti({}));
    line('8C', 'ITC on inward supplies (other than imports and inward supplies liable to reverse charge but includes services received from SEZs) received during the financial year but availed in the next financial year', null, Ti({ input: true }));
    line('8D', 'Difference [A-(B+C)]', (c, L) => `${at('8A', L)}-(${at('8B', L)}+${at('8C', L)})`, Ti({ bold: true }));
    line('8E', 'ITC available but not availed', null, Ti({ input: true })); line('8F', 'ITC available but ineligible', null, Ti({ input: true, note: 'See GSTR-3B 4D(2) in the data sheet' }));
    line('8G', 'IGST paid on import of goods (including supplies from SEZ)', null, Ti({ input: true, note: 'From ICEGATE / bills of entry' }));
    line('8H', 'IGST credit availed on import of goods (as per 6(E) above)', (c, L) => `${at('6E-I', L)}+${at('6E-C', L)}`, Ti({}));
    line('8I', 'Difference (G-H)', (c, L) => `${at('8G', L)}-${at('8H', L)}`, Ti({ bold: true }));
    line('8J', 'ITC available but not availed on import of goods (Equal to I)', null, Ti({ input: true }));
    line('8K', 'Total ITC to be lapsed in current financial year (E + F + J)', (c, L) => `${at('8E', L)}+${at('8F', L)}+${at('8J', L)}`, Ti({ bold: true }));
    gr++;
    section('Pt. IV – Table 9: Details of tax paid as declared in returns filed during the financial year');
    ['Description', 'Tax payable', 'Paid through cash', 'Paid through ITC – Integrated tax', 'Central tax', 'State/UT tax', 'Cess', 'Source / note'].forEach((t, i) => head(G, G.getCell(gr, i + 1).address, t)); gr++;
    const pay = (h, col) => ['A', 'B'].map(b => T('b3', `t61${b}_${h}`, col)).join('+');
    [['Integrated Tax', 'igst'], ['Central Tax', 'cgst'], ['State/UT Tax', 'sgst'], ['Cess', 'cess']].forEach(([n, h]) => {
      put(G, 'A' + gr, n, { num: false });
      put(G, 'B' + gr, '=' + pay(h, 'payable')); put(G, 'C' + gr, '=' + pay(h, 'cash'));
      ['itc_igst', 'itc_cgst', 'itc_sgst', 'itc_cess'].forEach((c, k) => put(G, String.fromCharCode(68 + k) + gr, '=' + T('b3', `t61A_${h}`, c)));
      G.getCell('H' + gr).value = 'GSTR-3B Table 6.1 (A) + (B)'; G.getCell('H' + gr).font = { size: 9, color: { argb: 'FF5B6475' } }; gr++; });
    [['Interest', 'int_cash'], ['Late fee', 'fee_cash']].forEach(([n, c]) => { put(G, 'A' + gr, n, { num: false }); const f = ['igst', 'cgst', 'sgst', 'cess'].map(h => pay(h, c)).join('+'); put(G, 'B' + gr, '=' + f); put(G, 'C' + gr, '=' + f); G.getCell('H' + gr).value = 'Paid in cash as per 6.1 – enter the amount payable if different'; G.getCell('H' + gr).font = { size: 9, color: { argb: 'FF5B6475' } }; gr++; });
    ['Penalty', 'Other'].forEach(n => { put(G, 'A' + gr, n, { num: false }); put(G, 'B' + gr, null, { input: true }); put(G, 'C' + gr, null, { input: true }); gr++; });
    gr++;
    section('Pt. V – Transactions of this year declared in the returns of April to the date specified of the next year');
    hdr(['Table', 'Description', 'Taxable value', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess', 'Source / note']);
    line('10', 'Supplies / tax declared through Amendments (+) (net of debit notes)', null, { input: true, note: 'From GSTR-1 / 3B of the next year' });
    line('11', 'Supplies / tax reduced through Amendments (-) (net of credit notes)', null, { input: true });
    line('12', 'Reversal of ITC availed during previous financial year', null, Ti({ input: true }));
    line('13', 'ITC availed for the previous financial year', null, Ti({ input: true }));
    gr++;
    const nt = G.getCell('A' + gr); nt.value = 'Draft prepared from the GSTR-1 and GSTR-3B PDFs, following the instructions to GSTR-9. Yellow cells are to be entered. Rows and labels follow the form as notified – compare with the form on the portal for the year (rows added for later years, e.g. for e-commerce supplies or rule 37A, are not shown here). HSN summaries (Tables 17, 18) and late fee / demand details (Tables 15, 16) are to be prepared separately.';
    nt.alignment = { wrapText: true }; nt.font = { italic: true, size: 9 }; G.mergeCells(`A${gr}:H${gr + 2}`); G.getRow(gr).height = 30;

    /* ===== Summary (books vs returns) – basis for GSTR-9C ===== */
    const S = wb.addWorksheet('Summary 9C');
    title(S, 'Books vs returns – working for GSTR-9C'); S.getColumn(1).width = 46; [2, 3, 4, 5, 6].forEach(c => S.getColumn(c).width = 16); S.getColumn(8).width = 4; S.getColumn(9).width = 50; [10, 11, 12, 13].forEach(c => S.getColumn(c).width = 16);
    S.mergeCells('A5:F5'); head(S, 'A5', 'OUTPUT', LIGHT); S.mergeCells('I5:M5'); head(S, 'I5', 'INPUT', LIGHT);
    ['', 'Taxable', 'IGST', 'CGST', 'SGST', 'Total Tax'].forEach((t, i) => head(S, String.fromCharCode(65 + i) + '6', t)); ['', 'IGST', 'CGST', 'SGST', 'Total Tax'].forEach((t, i) => head(S, String.fromCharCode(73 + i) + '6', t));
    const srow = (r, label, cells, o = {}) => { put(S, 'A' + r, label, { num: false, bold: o.bold }); ['B', 'C', 'D', 'E'].forEach((c, k) => { const v = cells ? cells[k] : null; if (v === null || v === undefined) { put(S, c + r, null, { input: true }); S.getCell(c + r).numFmt = NUM; } else put(S, c + r, v, { bold: o.bold }); }); put(S, 'F' + r, `=SUM(C${r}:E${r})`, { bold: o.bold }); };
    const irow = (r, label, cells, o = {}) => { put(S, 'I' + r, label, { num: false, bold: o.bold }); ['J', 'K', 'L'].forEach((c, k) => { const v = cells ? cells[k] : null; if (v === null || v === undefined) { put(S, c + r, null, { input: true }); S.getCell(c + r).numFmt = NUM; } else put(S, c + r, v, { bold: o.bold }); }); put(S, 'M' + r, `=SUM(J${r}:L${r})`, { bold: o.bold }); };
    const RC = "'GSTR Recon'!";
    srow(7, 'As per GSTR-3B (3.1(a) and (b))', [`=${RC}K19`, `=${RC}L19`, `=${RC}M19`, `=${RC}N19`]);
    srow(8, 'Exempted / nil rated / non-GST as per GSTR-3B (3.1(c), (e))', [`=${T('b3', 't31c', 'txval')}+${T('b3', 't31e', 'txval')}`, 0, 0, 0]);
    srow(9, 'RCM as per GSTR-3B (3.1(d))', [`=${RC}G19`, `=${RC}H19`, `=${RC}I19`, `=${RC}J19`]);
    srow(10, 'Total GSTR-3B', ['=SUM(B7:B9)', '=SUM(C7:C9)', '=SUM(D7:D9)', '=SUM(E7:E9)'], { bold: true });
    srow(11, 'Sales as per books', [`=${RC}B61`, `=${RC}C61`, `=${RC}D61`, `=${RC}E61`]);
    srow(12, 'Exempted / nil rated as per books', null);
    srow(13, 'Credit notes as per books', [`=${RC}F61`, `=${RC}G61`, `=${RC}H61`, `=${RC}I61`]);
    srow(14, 'RCM as per books', null);
    srow(15, 'GSTR-3B vs Books', ['=B10-B11-B12-B14+B13', '=C10-C11-C12-C14+C13', '=D10-D11-D12-D14+D13', '=E10-E11-E12-E14+E13'], { bold: true });
    srow(17, 'As per GSTR-1 (sales)', [`=${RC}B40`, `=${RC}C40`, `=${RC}D40`, `=${RC}E40`]);
    srow(18, 'As per GSTR-1 – nil / exempted / non-GST (Table 8)', [`=${T('r1', 'nil_total', 'txval')}`, 0, 0, 0]);
    srow(19, 'As per GSTR-1 – credit notes (net)', [`=${RC}F40`, `=${RC}G40`, `=${RC}H40`, `=${RC}I40`]);
    srow(20, 'RCM (3.1(d) of GSTR-3B)', ['=B9', '=C9', '=D9', '=E9']);
    srow(21, 'Total GSTR-1', ['=B18+B17-B19+B20', '=C18+C17-C19+C20', '=D18+D17-D19+D20', '=E18+E17-E19+E20'], { bold: true });
    srow(22, 'GSTR-3B vs GSTR-1', ['=B10-B21', '=C10-C21', '=D10-D21', '=E10-E21'], { bold: true });
    irow(7, 'As per GSTR-3B – net ITC (Table 4C)', [`=${RC}U103`, `=${RC}V103`, `=${RC}W103`]);
    irow(8, 'of which RCM (4A(3))', [`=${RC}E103`, `=${RC}F103`, `=${RC}G103`]);
    irow(10, 'ITC as per books (purchases)', [`=${RC}H84`, `=${RC}I84`, `=${RC}J84`]);
    irow(11, 'RCM ITC as per books', null);
    irow(13, 'GSTR-3B vs books', ['=J7-J10-J11', '=K7-K10-K11', '=L7-L10-L11'], { bold: true });
    irow(15, 'Additional ITC in GSTR-3B not accounted in books', null);
    irow(16, 'RCM ITC not accounted in books', null);
    irow(17, 'Accounted in books but not in GSTR-3B', null);
    irow(18, 'Unexplained difference', ['=J13-J15-J16+J17', '=K13-K15-K16+K17', '=L13-L15-L16+L17'], { bold: true });
    irow(20, 'ITC as per GSTR-2B (Table 8A)', [`='GSTR-9 draft'!D${rowOf['8A']}`, `='GSTR-9 draft'!E${rowOf['8A']}`, `='GSTR-9 draft'!F${rowOf['8A']}`]);
    irow(21, 'GSTR-3B vs GSTR-2B', ['=J7-J20', '=K7-K20', '=L7-L20'], { bold: true });
    S.getCell('A24').value = 'Yellow cells: enter from the books / portal. Figures from the books flow from the BOOKS and Input blocks of the GSTR Recon sheet.'; S.getCell('A24').font = { italic: true, size: 9 };

    /* ===== Filing dates ===== */
    const Fd = wb.addWorksheet('Filing dates');
    title(Fd, `Due dates taken: GSTR-1 – ${st.due1 || 11}th, GSTR-3B – ${st.due3b || 20}th of the next month (change in the tool if a different date applied)`);
    [12, 18, 14, 14, 10, 18, 14, 14, 10, 16].forEach((w, i) => Fd.getColumn(i + 1).width = w);
    ['Month', 'GSTR-1 ARN', 'Filed on', 'Due date', 'Days late', 'GSTR-3B ARN', 'Filed on', 'Due date', 'Days late', 'Tax paid in cash'].forEach((t, i) => head(Fd, String.fromCharCode(65 + i) + '4', t));
    filing(st).forEach((f, i) => { const r = 5 + i; monthCell(Fd, 'A' + r, i);
      put(Fd, 'B' + r, f.arn1 || '', { num: false }); const d = (c, t) => { const x = Fd.getCell(c + r); x.value = t ? serial(t) : null; x.numFmt = 'dd-mm-yyyy'; x.border = BOX; };
      d('C', f.f1); d('D', f.due1); put(Fd, 'E' + r, `=IF(C${r}="","",MAX(0,C${r}-D${r}))`, { num: false });
      put(Fd, 'F' + r, f.arn3 || '', { num: false }); d('G', f.f3); d('H', f.due3); put(Fd, 'I' + r, `=IF(G${r}="","",MAX(0,G${r}-H${r}))`, { num: false });
      put(Fd, 'J' + r, md[i].cash); });
    Fd.getCell('A18').value = 'Due dates are as entered in the tool; check any extension notified for the period. Interest u/s 50 applies on tax paid in cash after the due date.'; Fd.getCell('A18').font = { italic: true, size: 9 };

    /* ===== Checks ===== */
    const C = wb.addWorksheet('Checks'); title(C, 'Points noticed while reading the returns'); C.getColumn(1).width = 10; C.getColumn(2).width = 140;
    head(C, 'A4', 'Type'); head(C, 'B4', 'Point');
    checks(st).forEach(([k, t], i) => { put(C, 'A' + (5 + i), { err: 'Difference', warn: 'Review', info: 'Note', ok: 'OK' }[k], { num: false }); put(C, 'B' + (5 + i), t, { num: false }); C.getCell('B' + (5 + i)).alignment = { wrapText: true }; });

    return wb;
  }

  root.GstBook = { MONTHS, monthData, checks, filing, build };
})(typeof window !== 'undefined' ? window : globalThis);
