/*
 * GSTR-1 and GSTR-3B (PDF downloaded from the GST portal) – text extraction and parsing.
 * window.GstParse = { pdfTokens(pdf), parse(tokens), MONTHS, FIELDS3B, FIELDS1 }
 *
 * The PDF text is read as one stream of words in reading order. Each figure is found by its row label and the
 * amounts that follow it (amounts always carry two decimals; in GSTR-3B a "-" marks a column that does not apply).
 */
(function (root) {
  "use strict";
  const MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];

  async function pdfTokens(pdf) {
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ x: i.transform[4], y: i.transform[5], str: i.str }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      let cur = null;
      for (const it of items) { if (cur && Math.abs(cur.y - it.y) <= 2.5) cur.items.push(it); else { cur = { y: it.y, items: [it] }; lines.push(cur); } }
    }
    return tokenize(lines.map(l => l.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')).join('\n'));
  }

  /* words; joins amounts broken over two lines in narrow columns ("199924.0" + "0") */
  function tokenize(text) {
    const raw = text.replace(/₹/g, ' ').replace(/([A-Za-z(][\/\-])\s+(?=[A-Za-z(])/g, '$1').split(/\s+/).filter(Boolean), out = [];
    for (let i = 0; i < raw.length; i++) {
      let t = raw[i];
      if (/^-?[\d,]+\.\d$/.test(t) && /^\d$/.test(raw[i + 1] || '')) t += raw[++i];
      else if (/^-?[\d,]+\.$/.test(t) && /^\d{2}$/.test(raw[i + 1] || '')) t += raw[++i];
      else if (/^-?[\d,]+$/.test(t) && /^\.\d{2}$/.test(raw[i + 1] || '')) t += raw[++i];
      out.push(t);
    }
    return out;
  }

  const isAmt = t => /^-?[\d,]*\d\.\d{2}$/.test(t);
  const val = t => t === '-' ? 0 : Number(t.replace(/,/g, ''));

  /* cursor-based finder over the token stream */
  function Finder(tokens) {
    const text = tokens.join(' ');
    const starts = []; let p = 0; tokens.forEach(t => { starts.push(p); p += t.length + 1; });
    const tokAt = pos => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo; };
    let cur = 0;
    return {
      text,
      /* find regex from the cursor; returns true and moves the cursor to the token after the match */
      seek(re, from) { re = new RegExp(re.source, re.flags.replace('g', '') + 'g'); re.lastIndex = from === undefined ? starts[cur] || 0 : from; const m = re.exec(text); if (!m) return false; cur = tokAt(m.index + m[0].length - 1) + 1; return true; },
      /* next n amounts after the cursor (dash allowed as "not applicable" when dash = true) */
      /* 6.1 rows: narrow columns may print "199924.0" with the last digit on the next line ("tax 0 0 0") */
      amounts61(n) { const out = [], part = []; let i = cur;
        while (out.length < n && i < tokens.length && i < cur + 80) { const t = tokens[i];
          if (isAmt(t) || t === '-') out.push(t); else if (/^-?[\d,]+\.\d?$/.test(t)) { part.push(out.length); out.push(t); } i++; }
        if (out.length < n) return null;
        for (const k of part) { while (i < tokens.length && !/^\d{1,2}$/.test(tokens[i])) { if (/^(tax|FILED|[A-Z])$/.test(tokens[i])) i++; else break; } if (/^\d{1,2}$/.test(tokens[i] || '')) out[k] += tokens[i++]; }
        if (out.some(t => !isAmt(t) && t !== '-')) return null; cur = i; return out.map(val); },
      amounts(n, dash) { const out = []; let i = cur; while (out.length < n && i < tokens.length && i < cur + 60 + n * 4) { const t = tokens[i]; if (isAmt(t) || (dash && t === '-')) out.push(val(t)); i++; } if (out.length < n) return null; cur = i; return out; },
      mark() { return cur; }, reset(c) { cur = c; },
    };
  }

  /* --------- GSTR-3B --------- */
  // [key, label regex, number of amounts, column names]
  const C5 = ['txval', 'igst', 'cgst', 'sgst', 'cess'], C4 = ['igst', 'cgst', 'sgst', 'cess'], C2 = ['inter', 'intra'];
  const C61 = ['payable', 'adj_neg', 'net_payable', 'itc_igst', 'itc_cgst', 'itc_sgst', 'itc_cess', 'cash', 'int_cash', 'fee_cash'];
  const FIELDS3B = [
    ['t31a', /\(a\)\s*Outward taxable supplies \(other than zero rated/i, C5, '3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted)'],
    ['t31b', /\(b\)\s*Outward taxable supplies \(zero rated\)/i, C5, '3.1(b) Outward taxable supplies (zero rated)'],
    ['t31c', /\(c\s*\)\s*Other outward supplies \(nil rated, exempted\)/i, C5, '3.1(c) Other outward supplies (nil rated, exempted)'],
    ['t31d', /\(d\)\s*Inward supplies \(liable to reverse charge\)/i, C5, '3.1(d) Inward supplies (liable to reverse charge)'],
    ['t31e', /\(e\)\s*Non-GST outward supplies/i, C5, '3.1(e) Non-GST outward supplies'],
    ['t311i', /\(i\)\s*Taxable supplies on which electronic commerce operator pays tax.*?commerce operator\]/i, C5, '3.1.1(i) Supplies on which the e-commerce operator pays tax u/s 9(5)', true],
    ['t311ii', /\(ii\)\s*Taxable supplies made by registered person through electronic.*?commerce operator\]/i, C5, '3.1.1(ii) Supplies made through an e-commerce operator liable u/s 9(5)', true],
    ['t32unreg', /Supplies made to Unregistered Persons/i, ['txval', 'igst'], '3.2 Inter-state supplies to unregistered persons', true],
    ['t32comp', /Supplies made to Composition Taxable/i, ['txval', 'igst'], '3.2 Inter-state supplies to composition taxable persons', true],
    ['t32uin', /Supplies made to UIN holders/i, ['txval', 'igst'], '3.2 Inter-state supplies to UIN holders', true],
    ['t4a1', /\(1\)\s*Import of goods/i, C4, '4A(1) Import of goods'],
    ['t4a2', /\(2\)\s*Import of services/i, C4, '4A(2) Import of services'],
    ['t4a3', /\(3\)\s*Inward supplies liable to reverse charge \(other than 1 (&|and) 2 above\)/i, C4, '4A(3) Inward supplies liable to reverse charge'],
    ['t4a4', /\(4\)\s*Inward supplies from ISD/i, C4, '4A(4) Inward supplies from ISD'],
    ['t4a5', /\(5\)\s*All other ITC/i, C4, '4A(5) All other ITC'],
    ['t4b1', /\(1\)\s*As per rules? 38,\s*42 (&|and) 43 of CGST Rules and section 17\(5\)/i, C4, '4B(1) Reversed – rules 38, 42 & 43 and section 17(5)'],
    ['t4b2', /\(2\)\s*Others/i, C4, '4B(2) Reversed – others'],
    ['t4c', /C\.\s*Net ITC [Aa]vailable \(A\s*-\s*B\)/i, C4, '4C Net ITC available (A − B)'],
    ['t4d1', /\(1\)\s*ITC reclaimed which was reversed under Table 4/i, C4, '4D(1) ITC reclaimed (reversed in 4B(2) earlier)', true],
    ['t4d2', /\(2\)\s*Ineligible ITC under section 16\(4\) (&|and) ITC restricted due to PoS rules/i, C4, '4D(2) Ineligible – section 16(4) and place of supply', true],
    ['t5comp', /From a supplier under composition scheme, Exempt,? (and )?Nil rated supply/i, C2, '5 Inward – composition, exempt and nil rated'],
    ['t5ngst', /Non GST supply/i, C2, '5 Inward – non-GST supply'],
    ['t51int', /Interest Paid/i, C4, '5.1 Interest paid (previous period)', true],
    ['t51fee', /Late fee(?= [-\d])/i, C4, '5.1 Late fee (previous period)', true],
  ];
  const ROW61 = [['igst', /Integrated\b/i], ['cgst', /Central\b/i], ['sgst', /State\/\s*UT\b/i], ['cess', /Cess\b/i]];

  function parse3B(F) {
    const d = {}, miss = [];
    for (const [k, re, cols, , optional] of FIELDS3B) {
      const m = F.mark();
      if (!F.seek(re)) { F.reset(m); if (!optional) miss.push(k); continue; }
      const a = F.amounts(cols.length, true);
      if (!a) { F.reset(m); if (!optional) miss.push(k); continue; }
      d[k] = Object.fromEntries(cols.map((c, i) => [c, a[i]]));
    }
    // 6.1 payment of tax
    for (const [blk, re] of [['A', /\(A\)\s*Other than reverse charge/i], ['B', /\(B\)\s*Reverse charge/i]]) {
      if (!F.seek(re, 0)) { miss.push('t61' + blk); continue; }
      for (const [h, rr] of ROW61) {
        const m = F.mark();
        if (!F.seek(rr)) { F.reset(m); miss.push(`t61${blk}_${h}`); continue; }
        const a = F.amounts61(10);
        if (!a) { miss.push(`t61${blk}_${h}`); continue; }
        d[`t61${blk}_${h}`] = Object.fromEntries(C61.map((c, i) => [c, a[i]]));
      }
    }
    return { d, miss };
  }

  /* --------- GSTR-1 --------- */
  const V5 = ['txval', 'igst', 'cgst', 'sgst', 'cess'], V3 = ['txval', 'igst', 'cess'], V1 = ['txval'];
  // [key, section regex, row regex (after section), columns, label]
  const FIELDS1 = [
    ['b2b', /4A\s*-\s*Taxable outward supplies made to registered persons \(other than reverse charge/i, /Total/, V5, '4A B2B – regular'],
    ['b2brc', /4B\s*-\s*Taxable outward supplies made to registered persons attracting tax on reverse charge/i, /Total/, V5, '4B B2B – reverse charge'],
    ['b2cl', /5\s*-\s*Taxable outward inter-state supplies made to unregistered persons/i, /Total/, V3, '5 B2CL (large)'],
    ['exp', /6A\s*.\s*Exports/i, /Total/, V3, '6A Exports – total'],
    ['expwp', null, /-\s*EXPWP/, V3, '6A Exports with payment (EXPWP)'],
    ['expwop', null, /-\s*EXPWOP/, V1, '6A Exports without payment (EXPWOP)'],
    ['sez', /6B\s*-\s*Supplies made to SEZ/i, /Total/, V3, '6B SEZ – total'],
    ['sezwp', null, /-\s*SEZWP/, V3, '6B SEZ with payment (SEZWP)'],
    ['sezwop', null, /-\s*SEZWOP/, V1, '6B SEZ without payment (SEZWOP)'],
    ['de', /6C\s*.\s*Deemed Exports/i, /Total/, V5, '6C Deemed exports'],
    ['b2cs', /7\s*-\s*Taxable supplies \(Net of debit and credit notes\) to unregistered persons/i, /Total/, V5, '7 B2CS (others)'],
    ['nil_total', /8\s*-\s*Nil rated, exempted and non GST outward supplies/i, /Total/, V1, '8 Nil / exempted / non-GST – total'],
    ['nil', null, /-\s*Nil/, V1, '8 Nil rated'],
    ['exempt', null, /-\s*Exempted/, V1, '8 Exempted'],
    ['nongst', null, /-\s*Non-GST/, V1, '8 Non-GST'],
    ['a_b2b', /9A\s*-\s*Amendment to taxable outward supplies made to registered person in returns of earlier tax periods in table 4\s*-\s*B2B Regular/i, /Net differential amount/, V5, '9A Amendment B2B regular – net differential'],
    ['a_b2brc', /9A\s*-\s*Amendment to taxable outward supplies made to registered person in returns of earlier tax periods in table 4\s*-\s*B2B Reverse charge/i, /Net differential amount/, V5, '9A Amendment B2B reverse charge – net differential'],
    ['a_b2cl', /9A\s*-\s*Amendment to Inter-State supplies made to unregistered person/i, /Net differential amount/, V3, '9A Amendment B2CL – net differential'],
    ['a_exp', /9A\s*-\s*Amendment to Export supplies/i, /Net differential amount \(Amended - Original\) - Total/, V3, '9A Amendment exports – net differential'],
    ['a_expwp', null, /-\s*EXPWP/, V3, '9A Amendment EXPWP – net differential'],
    ['a_expwop', null, /-\s*EXPWOP/, V1, '9A Amendment EXPWOP – net differential'],
    ['a_sez', /9A\s*-\s*Amendment to supplies made to SEZ/i, /Net differential amount \(Amended - Original\) - Total/, V3, '9A Amendment SEZ – net differential'],
    ['a_sezwp', null, /-\s*SEZWP/, V3, '9A Amendment SEZWP – net differential'],
    ['a_sezwop', null, /-\s*SEZWOP/, V1, '9A Amendment SEZWOP – net differential'],
    ['a_de', /9A\s*-\s*Amendment to Deemed Exports/i, /Net differential amount/, V5, '9A Amendment deemed exports – net differential'],
    ['cdnr', /9B\s*-\s*Credit\/Debit Notes \(Registered\)/i, /Total - Net off debit\/credit notes/, V5, '9B CDNR – net (debit − credit)'],
    ['cdnr_b2b', null, /in table 4 other than table 6\s*-\s*B2B Regular\s*Net Total/, V5, '9B CDNR B2B regular – net'],
    ['cdnr_rc', null, /in table 4 other than table 6\s*-\s*B2B Reverse charge\s*Net Total/, V5, '9B CDNR B2B reverse charge – net'],
    ['cdnr_sez', null, /in table 6B\s*-\s*SEZWP\/SEZWOP\s*Net Total/, V3, '9B CDNR SEZ – net'],
    ['cdnr_de', null, /in table 6C\s*.\s*DE\s*Net Total/, V5, '9B CDNR deemed exports – net'],
    ['cdnur', /9B\s*-\s*Credit\/Debit Notes \(Unregistered\)/i, /Total - Net off debit\/credit notes/, V3, '9B CDNUR – net (debit − credit)'],
    ['cdnur_b2cl', null, /-\s*B2CL/, V3, '9B CDNUR B2CL – net'],
    ['cdnur_expwp', null, /-\s*EXPWP/, V3, '9B CDNUR EXPWP – net'],
    ['cdnur_expwop', null, /-\s*EXPWOP/, V1, '9B CDNUR EXPWOP – net'],
    ['cdnra', /9C\s*-\s*Amended Credit\/Debit Notes \(Registered\)/i, /Net Differential amount .*? - Total/, V5, '9C CDNRA – net differential'],
    ['cdnura', /9C\s*-\s*Amended Credit\/Debit Notes \(Unregistered\)/i, /Net Differential amount .*? - Total/, V3, '9C CDNURA – net differential'],
    ['a_b2cs', /10\s*-\s*Amendment to taxable outward supplies made to unregistered person/i, /Net differential amount/, V5, '10 Amendment B2CS – net differential'],
    ['adv', /11A\(1\),\s*11A\(2\)\s*-\s*Advances received/i, /Total/, V5, '11A Advances received (tax added)'],
    ['adv_adj', /11B\(1\),\s*11B\(2\)\s*-\s*Advance amount received in earlier tax period/i, /Total/, V5, '11B Advances adjusted'],
    ['a_adv', /11A\s*-\s*Amendment to advances received/i, /Amended amount - Total \d+ \S+ \S+ [\d.,]+ [\d.,]+ [\d.,]+ [\d.,]+ [\d.,]+ Total/, V5, '11A Amendment – net'],
    ['a_adv_adj', /11B\s*-\s*Amendment to advances adjusted/i, /Amended amount - Total \d+ \S+ \S+ [\d.,]+ [\d.,]+ [\d.,]+ [\d.,]+ [\d.,]+ Total/, V5, '11B Amendment – net'],
    ['hsn', /12\s*-\s*HSN-wise summary of outward supplies/i, /Total/, V5, '12 HSN summary – total'],
    ['eco', /14\s*-\s*Supplies made through E-Commerce Operators/i, /Total/, V5, '14 Supplies through e-commerce operators'],
    ['s95', /15\s*-\s*Supplies U\/s 9\(5\)/i, /Total/, V5, '15 Supplies u/s 9(5)'],
    ['total', /Total Liability \(Outward supplies other than Reverse charge\)/i, null, V5, 'Total liability (other than reverse charge)'],
  ];

  function parse1(F) {
    const d = {}, miss = [];
    for (const [k, sec, row, cols] of FIELDS1) {
      const m = F.mark();
      if (sec && !F.seek(sec)) { F.reset(m); miss.push(k); continue; }
      if (row && !F.seek(row)) { F.reset(m); miss.push(k); continue; }
      const a = F.amounts(cols.length, false);
      if (!a) { F.reset(m); miss.push(k); continue; }
      d[k] = Object.fromEntries(cols.map((c, i) => [c, a[i]]));
    }
    const docs = F.text.match(/Net issued documents\s+(\d+)/i); if (docs) d.docs = { count: +docs[1] };
    return { d, miss };
  }

  /* --------- detect and parse --------- */
  function parse(tokens) {
    const F = Finder(tokens), T = F.text;
    const type = /Form GSTR-3B/i.test(T.slice(0, 400)) ? '3B' : /FORM GSTR-1\b/i.test(T.slice(0, 400)) ? '1' : null;
    if (!type) return { type: null, error: 'not a GSTR-1 or GSTR-3B downloaded from the GST portal' };
    const fy = (T.match(/(?:Financial\s+)?[Yy]ear\s+(\d{4}-\d{2})/) || [])[1] || '';
    const per = ((T.match(/(?:Tax\s+)?[Pp]eriod\s+([A-Za-z][A-Za-z\- ]*?)\s+(?:1\s+GSTIN|GSTIN)/) || [])[1] || '').trim();
    const named = MONTHS.filter(m => new RegExp('\\b' + m.slice(0, 3), 'i').test(per));
    let month = null, quarter = false;
    if (named.length === 1) month = named[0];
    else if (named.length > 1) { month = named.reduce((a, b) => MONTHS.indexOf(b) > MONTHS.indexOf(a) ? b : a); quarter = true; }
    const gstin = (T.match(/GSTIN(?: of the supplier)?\s+(\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z])/) || [])[1] || '';
    const legal = ((T.match(/Legal name of the registered person\s+(.+?)\s+(?:2\(b\)\.|\(b\))/) || [])[1] || '').trim();
    const trade = ((T.match(/Trade name,? if any\s+(.+?)\s+(?:2\(c\)\.|\(c\))/) || [])[1] || '').trim();
    const arn = (T.match(/\bARN\s+([A-Z]{2}\d{6}[0-9A-Z]{7})/) || [])[1] || '';
    const arnDate = (T.match(/(?:Date of ARN|ARN date)\s+(\d{2}\/\d{2}\/\d{4})/) || [])[1] || '';
    const r = type === '3B' ? parse3B(F) : parse1(F);
    return { type, fy, period: per, month, quarter, gstin, legal, trade, arn, arnDate, data: r.d, missing: r.miss };
  }

  root.GstParse = { pdfTokens, tokenize, parse, MONTHS, FIELDS3B, FIELDS1, C61 };
})(typeof window !== 'undefined' ? window : globalThis);
