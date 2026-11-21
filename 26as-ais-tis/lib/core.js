/* 26AS / AIS / TIS Consolidator – core logic (runs fully offline, in browser or Node) */
(function (root) {
'use strict';

/* ---------------- text extraction ---------------- */
async function extractLines(pdf) {
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim())
      .map(i => ({ x: i.transform[4], y: i.transform[5], w: i.width, str: i.str.trim() }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let cur = null;
    for (const it of items) {
      if (cur && Math.abs(cur.y - it.y) <= 2.5) cur.items.push(it);
      else { cur = { page: p, y: it.y, items: [it] }; out.push(cur); }
    }
  }
  for (const l of out) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map(i => i.str).join(' ').replace(/\s+/g, ' ')
      .replace(/(\b\d{1,2})- ([A-Za-z]{3}-\d{4})/g, '$1-$2')
      .replace(/^PART- /, 'PART-').trim();
  }
  return out;
}

/* ---------------- helpers ---------------- */
const AMT = '\\(?-?[\\d,]+\\.\\d{2}\\)?';
const DATE = '\\d{2}-[A-Za-z]{3}-\\d{4}';
const TANRE = /^[A-Z]{4}\d{5}[A-Z]$/;
function num(s) {
  if (s == null) return 0;
  s = String(s).trim(); let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const v = parseFloat(s.replace(/,/g, '')) || 0;
  return neg ? -v : v;
}
const round2 = v => Math.round(v * 100) / 100;
const inr = v => '₹' + (Math.round((v || 0) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: (v % 1) ? 2 : 0, maximumFractionDigits: 2 });
const normSec = s => (s || '').replace(/\s+/g, '').toUpperCase();
function secFamily(s) {
  s = normSec(s);
  if (/^194J/.test(s)) return '194J';
  return s.replace(/\(.*?\)/g, '');
}
function bankKey(name) {
  const n = (name || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const i = n.indexOf(' BANK');
  if (i > 0) return n.slice(0, i).replace(/^THE /, '').trim();
  if (n.startsWith('BANK ')) return n.split(' ').slice(0, 3).join(' ');
  return null;
}
const isBank = name => /\bBANK\b|\bBANKING\b/i.test(name || '');
function detectType(lines) {
  const head = lines.slice(0, 25).map(l => l.text).join(' ');
  if (/Annual Tax Statement/i.test(head)) return '26AS';
  if (/Annual Information Statement/i.test(head)) return 'AIS';
  if (/Taxpayer Information Summary/i.test(head)) return 'TIS';
  return null;
}

/* ---------------- nature mapping ---------------- */
const NATURES = {
  SAL: 'Salary', INT_SB: 'Savings Bank Interest', INT_TD: 'Term / Other Deposit Interest (Bank)',
  INT_OTH: 'Other Interest', DIV: 'Dividend', CON: 'Contract Payments', PRO: 'Professional Fees',
  FTS: 'Fees for Technical Services', RENT: 'Rent', COMM: 'Commission / Brokerage',
  BUS: 'Business Receipts (E-commerce / Sale of Goods)', PART: "Partner's Remuneration / Interest",
  WIN: 'Winnings', OTH: 'Other Receipts',
  SALE: 'Sale Consideration (Property / VDA)', CASH: 'Cash Withdrawals (Sec. 194N)', TCS: 'Tax Collected at Source'
};
function natureOf(sec, name) {
  const s = normSec(sec);
  if (/^392/.test(s)) return { n: 'SAL', note: 'Income-tax Act, 2025 section ' + sec };
  if (/^39[34]/.test(s)) return { n: 'OTH', flag: 'Section ' + sec + ' (Income-tax Act, 2025) – nature to be verified manually from the 26AS/AIS description' };
  if (s === '192') return { n: 'SAL' };
  if (s === '192A') return { n: 'OTH', flag: 'Sec. 192A – PF withdrawal: taxability depends on period of service; verify' };
  if (s === '193') return { n: 'INT_OTH' };
  if (s === '194') return { n: 'DIV' };
  if (s === '194A') return { n: isBank(name) ? 'INT_TD' : 'INT_OTH' };
  if (/^194B/.test(s)) return { n: 'WIN' };
  if (s === '194C') return { n: 'CON' };
  if (s === '194DA') return { n: 'OTH', flag: 'Sec. 194DA – life insurance policy payout: only the income component is taxable; verify Sec. 10(10D)' };
  if (s === '194D' || s === '194G' || s === '194H') return { n: 'COMM' };
  if (s === '194EE') return { n: 'OTH' };
  if (s === '194IA') return { n: 'SALE' };
  if (s === '194IC') return { n: 'OTH', flag: 'Sec. 194IC – payment under joint development agreement; consider capital gains u/s 45(5A)' };
  if (s === '194I' || s === '194I(A)' || s === '194I(B)' || s === '194IB') return { n: 'RENT' };
  if (s === '194JA' || s === '194J(A)') return { n: 'FTS' };
  if (/^194J/.test(s)) return { n: 'PRO' };
  if (s === '194K') return { n: 'DIV', note: 'Income from MF units (194K)' };
  if (s === '194LA') return { n: 'OTH', flag: 'Sec. 194LA – compensation on compulsory acquisition; consider capital gains / Sec. 10(37)' };
  if (/^194LB[ABC]/.test(s)) return { n: 'OTH', flag: 'Sec. ' + sec + ' – income from business trust / investment fund / securitisation trust; split by character of income' };
  if (/^194L[BCD]/.test(s)) return { n: 'INT_OTH' };
  if (s === '194M') return { n: 'OTH', flag: 'Sec. 194M – payment by individual/HUF for contract/professional work/commission; classify by actual nature' };
  if (/^194N/.test(s)) return { n: 'CASH' };
  if (s === '194O' || s === '194Q') return { n: 'BUS' };
  if (s === '194P') return { n: 'OTH', flag: 'Sec. 194P – specified senior citizen (pension + interest from specified bank); verify components' };
  if (/^194R/.test(s)) return { n: 'OTH', flag: 'Sec. 194R – business perquisite/benefit; taxable u/s 28(iv)' };
  if (/^194S/.test(s)) return { n: 'SALE' };
  if (s === '194T') return { n: 'PART' };
  if (/^19[56]/.test(s)) return { n: 'OTH', flag: 'Sec. ' + sec + ' – non-resident provision; verify residential status and nature' };
  if (/^206C/.test(s)) return { n: 'TCS' };
  return { n: 'OTH', flag: 'Section ' + sec + ' not mapped – verify nature manually' };
}

/* ---------------- Form 26AS ---------------- */
const PARTS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const PART_TITLES = {
  I: 'Details of Tax Deducted at Source', II: 'TDS for Form 15G / 15H',
  III: 'Transactions under proviso to 194B / 194R(1) / 194S(1) / 194BA(2)',
  IV: 'TDS u/s 194IA/194IB/194M/194S (as seller / landlord / contractor / professional)',
  V: 'Proviso to 194S(1) – Form 26QE (seller of VDA)', VI: 'Tax Collected at Source', VII: 'Paid refund',
  VIII: 'TDS u/s 194IA/194IB/194M/194S (as buyer / tenant / payer)', IX: 'Proviso to 194S(1) – Form 26QE (buyer of VDA)',
  X: 'TDS/TCS defaults (processing of statements)'
};
function parse26AS(lines) {
  const r = { type: '26AS', parts: {}, warnings: [] };
  const all = lines.map(l => l.text);
  const head = all.slice(0, 20).join(' \n ');
  let m;
  if ((m = head.match(/\(PAN\)\s+([A-Z]{5}\d{4}[A-Z])/))) r.pan = m[1];
  if ((m = head.match(/Financial Year\s+(\d{4}-\d{2})/))) r.fy = m[1];
  if ((m = head.match(/(Assessment Year|Tax Year)\s+(\d{4}-\d{2})/))) { r.ayLabel = m[1]; r.ay = m[2]; }
  if ((m = head.match(/Data updated till\s+(\S+)/))) r.dataDate = m[1];
  const ni = all.findIndex(t => /^Name of Assessee/.test(t));
  if (ni >= 0) r.name = all[ni].replace(/^Name of Assessee\s*/, '').trim();
  const ai = all.findIndex(t => /^Address of Assessee/.test(t));
  if (ai >= 0) {
    const a = [all[ai].replace(/^Address of Assessee\s*/, '')];
    for (let k = ai + 1; k < ai + 4 && k < all.length; k++) { if (/^Above data|^\W*Above data/.test(all[k])) break; a.push(all[k]); }
    r.address = a.join(' ').replace(/\s+/g, ' ').trim();
  }
  // locate parts
  const partRe = /^PART[- ]?\s*(X|IX|VIII|VII|VI|V|IV|III|II|I)\s*-/;
  const idx = [];
  lines.forEach((l, i) => { const mm = l.text.match(partRe); if (mm) idx.push({ p: mm[1], i }); });
  let endIdx = lines.findIndex(l => /^\*?Notes:|^Contact Information/.test(l.text));
  if (endIdx < 0) endIdx = lines.length;
  for (const P of PARTS) if (!idx.find(o => o.p === P)) r.warnings.push('Form 26AS: Part ' + P + ' heading not found – verify this part manually.');
  idx.forEach((o, k) => {
    const end = k + 1 < idx.length ? idx[k + 1].i : endIdx;
    const body = lines.slice(o.i + 1, end).filter(l => !/^Assessee PAN:/.test(l.text));
    const part = { noTx: body.some(l => /No Transactions Present/i.test(l.text)), deductors: [], raw: [] };
    r.parts[o.p] = part;
    if (part.noTx) return;
    if (o.p === 'I' || o.p === 'II' || o.p === 'VI') parseDeductorPart(body, part, 3);
    else if (o.p === 'III') parseDeductorPart(body, part, 1);
    else part.raw = body.map(l => l.text).filter(t => !/^(Sr\.?|No\.|Number|Credited|Deposited|Debited|Booking\*?|than TDS|###|Gross Total)/i.test(t));
    if ((o.p === 'I' || o.p === 'II' || o.p === 'VI' || o.p === 'III') && !part.deductors.length)
      r.warnings.push('Form 26AS Part ' + o.p + ': transactions present but could not be read – verify manually.');
  });
  return r;
}
function parseDeductorPart(body, part, nAmt) {
  const amts = Array(nAmt).fill('(' + AMT + ')').join('\\s+');
  const sumRe = new RegExp('^(\\d+)\\s+(.+?)\\s+([A-Z]{4}\\d{5}[A-Z])\\s+' + amts + '$');
  const txRe = new RegExp('^(\\d+)\\s+(.+?)\\s+(' + DATE + ')\\s*(.*?)\\s*' + amts + '$');
  let cur = null, tanX = 300;
  for (const l of body) {
    const t = l.text; let m;
    if ((m = t.match(sumRe))) {
      cur = { sr: +m[1], name: m[2].trim(), tan: m[3], total: num(m[4]), tds: nAmt > 1 ? num(m[5]) : 0, dep: nAmt > 2 ? num(m[6]) : 0, txns: [] };
      const ti = l.items.find(i => i.str === m[3]); if (ti) tanX = ti.x;
      part.deductors.push(cur); continue;
    }
    if (cur && (m = t.match(txRe))) {
      const mid = (m[4] || '').split(' ').filter(Boolean);
      cur.txns.push({ sr: +m[1], section: m[2].trim(), date: m[3], status: (mid[0] && /^[UMPFOZ]$/.test(mid[0])) ? mid[0] : (nAmt === 3 && part === null ? '' : ''),
        statusRaw: mid.join(' '), amount: num(m[5]), tds: nAmt > 1 ? num(m[6]) : 0, dep: nAmt > 2 ? num(m[7]) : 0 });
      const st = mid[0] && /^[UMPFOZ]$/.test(mid[0]) ? mid[0] : '';
      cur.txns[cur.txns.length - 1].status = st;
      continue;
    }
    if (cur && !cur.txns.length && !/^\d/.test(t) && l.items.every(i => i.x < tanX - 2) && l.items[0].x > 40
        && !/^(Sr\.|Name of|Section)/.test(t)) cur.name += ' ' + t;
  }
}

/* ---------------- AIS ---------------- */
function parseAIS(lines) {
  const r = { type: 'AIS', records: [], taxPayments: [], refunds: [], warnings: [], rawOther: [] };
  const all = lines.map(l => l.text); let m;
  const fyl = all.slice(0, 5).join(' ');
  if ((m = fyl.match(/Financial Year\s+(\d{4}-\d{2})/))) r.fy = m[1];
  const pi = all.findIndex(t => /^Permanent Account Number \(PAN\)/.test(t));
  if (pi >= 0) {
    const t = all[pi + 1] || '';
    if ((m = t.match(/([A-Z]{5}\d{4}[A-Z])/))) r.pan = m[1];
    r.name = t.replace(/^[A-Z]{5}\d{4}[A-Z]\s*/, '').replace(/^X{4}\s+X{4}\s+\d{4}\s*/, '').trim();
    if (pi + 2 < all.length && /^[A-Z .]+$/.test(all[pi + 2]) && !/^Date of Birth/.test(all[pi + 2])) r.name += ' ' + all[pi + 2];
  }
  const di = all.findIndex(t => /^Date of Birth/.test(t));
  if (di >= 0 && (m = (all[di + 1] || '').match(/(\d{2}\/\d{2}\/\d{4})/))) r.dob = m[1];
  const adi = all.findIndex(t => /^Address$/.test(t));
  if (adi >= 0) {
    const a = [];
    for (let k = adi + 1; k < adi + 4; k++) { if (!all[k] || /-{5,}|Annual Information Statement \(Part B\)|Taxpayer Information Summary/.test(all[k])) break; a.push(all[k]); }
    r.address = a.join(' ');
  }
  const gd = all.find(t => /^Generation Date/.test(t));
  if (gd && (m = gd.match(/(\d{2}\/\d{2}\/\d{4})/))) r.genDate = m[1];

  let partNo = null, category = null, cols = null, last = null, inTax = false, lastTax = null, inRefund = false;
  const skipCat = /^(Part |Note|SR\.|Download|Generation|PAN |Refund$|Demand$|\(All|-{5,}|information displayed|between the|However|Annual Information|[A-Z]{5}\d{4}[A-Z])/;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], t = l.text;
    if ((m = t.match(/^Part\s+B(\d+)\s*-?/))) { partNo = 'B' + m[1]; category = null; last = null; inTax = partNo === 'B3'; inRefund = partNo === 'B4'; lastTax = null; continue; }
    if (!partNo) continue;
    if (/^Download ID|^Generation Date|^PAN Name Financial Year|^[A-Z]{5}\d{4}[A-Z] /.test(t)) continue;
    if (/^Note -|^information displayed|^between the tax|^However, from/.test(t)) { last = null; continue; }
    if (/No Transactions Present/.test(t)) continue;
    if (/^SR\.?\s*NO\.?\s+INFORMATION CODE/.test(t)) {
      const it = l.items, f = s => (it.find(x => x.str.toUpperCase().startsWith(s)) || {}).x;
      const infos = it.filter(x => /^INFORMATION/.test(x.str));
      cols = { code: infos[0] ? infos[0].x : 54, desc: infos[1] ? infos[1].x : 253, src: infos[2] ? infos[2].x : 462, count: f('COUNT') || 795, amt: f('AMOUNT') || 901 };
      last = null; continue;
    }
    if (/^SR\.?\s*NO\.?/.test(t)) { if (!inTax) last = last; continue; }
    if (inTax) {
      if ((m = t.match(/^(\d+)\s+(\d{4}-\d{2})\s+(.*?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\S+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(\S+)$/))) {
        lastTax = { fy: m[2], head: m[3], tax: num(m[4]), surcharge: num(m[5]), cess: num(m[6]), others: num(m[7]), total: num(m[8]), bsr: m[9], date: m[10], challan: m[11], cin: m[12] };
        r.taxPayments.push(lastTax);
      } else if (lastTax && !/^\d/.test(t)) lastTax.head += ' ' + t;
      else if (/^\d/.test(t)) r.warnings.push('AIS Part B3: could not read a tax payment line – verify manually: ' + t);
      continue;
    }
    if (inRefund) {
      if (/^\d/.test(t)) r.refunds.push(t);
      continue;
    }
    // category heading
    if (l.items[0].x < 14 && l.items.length <= 8 && !/^\d/.test(t) && !skipCat.test(t)) { category = t; last = null; continue; }
    if (!cols) continue;
    const first = l.items[0];
    const codeItems = l.items.filter(x => x.x >= cols.code - 3 && x.x < cols.desc - 3);
    const codeTxt = codeItems.map(x => x.str).join(' ').replace(/- /g, '-');
    if (/^\d+$/.test(first.str) && first.x < cols.code - 3 && /^[A-Z]{2,6}-/.test(codeTxt)) {
      const pick = (a, b) => l.items.filter(x => x.x >= a && x.x < b).map(x => x.str).join(' ');
      const mid = (cols.count + cols.amt) / 2;
      last = { part: partNo, category, sr: +first.str, code: codeTxt,
        desc: pick(cols.desc - 3, cols.src - 3), source: pick(cols.src - 3, cols.count - 20),
        count: num(pick(cols.count - 20, mid)), amount: num(pick(mid, 2000)), details: [] };
      r.records.push(last); continue;
    }
    if (last && !/^\d/.test(t) && first.x >= cols.desc - 3 && first.x < cols.count - 20 && !last.details.length) {
      for (const it of l.items) {
        if (it.x >= cols.src - 3 && it.x < cols.count - 20) last.source += ' ' + it.str;
        else if (it.x >= cols.desc - 3 && it.x < cols.src - 3) last.desc += ' ' + it.str;
      }
      continue;
    }
    if (last && /^\d+$/.test(first.str)) {
      let d;
      if ((d = t.match(/^(\d+)\s+(Q\d\s*\(\S*\s*\S*?\))\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\S+)/)) || (d = t.match(/^(\d+)\s+(Q\d\S*\s*\S*)\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\S+)/)))
        last.details.push({ kind: 'tds', date: d[3], amount: num(d[4]), tds: num(d[5]), dep: num(d[6]), status: d[7] });
      else if ((d = t.match(/^(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+(\S+)/)))
        last.details.push({ kind: 'sal', from: d[2], to: d[3], gross171: num(d[4]), perq: num(d[5]), profits: num(d[6]), gross: num(d[7]), status: d[8] });
      else if ((d = t.match(/^(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(.+?)\s+([\d,]+)\s+(\S+)$/)))
        last.details.push({ kind: 'sft', reported: d[2], account: d[3], acType: d[4], amount: num(d[5]), status: d[6] });
      else last.details.push({ kind: 'raw', text: t });
    }
  }
  for (const rec of r.records) {
    rec.source = rec.source.replace(/\s+/g, ' ').trim(); rec.desc = rec.desc.replace(/\s+/g, ' ').trim();
    const mm = rec.source.match(/^(.*?)\s*\(([A-Z0-9.]+)\)\s*$/);
    rec.srcName = mm ? mm[1].trim() : rec.source; rec.srcId = mm ? mm[2] : '';
    rec.tan = TANRE.test(rec.srcId) ? rec.srcId : '';
    rec.status = rec.details.map(d => d.status).filter(Boolean);
  }
  return r;
}

/* ---------------- TIS ---------------- */
function parseTIS(lines) {
  const r = { type: 'TIS', categories: [], warnings: [] };
  const all = lines.map(l => l.text); let m;
  if ((m = all.slice(0, 5).join(' ').match(/Financial Year\s+(\d{4}-\d{2})/))) r.fy = m[1];
  const pi = all.findIndex(t => /^Permanent Account Number \(PAN\)/.test(t));
  if (pi >= 0 && (m = (all[pi + 1] || '').match(/([A-Z]{5}\d{4}[A-Z])/))) r.pan = m[1];
  const gd = all.find(t => /^Generation Date/.test(t));
  if (gd && (m = gd.match(/(\d{2}\/\d{2}\/\d{4})/))) r.genDate = m[1];
  const end = all.findIndex(t => /^The information details/.test(t) || /Annexure to Taxpayer/.test(t));
  const start = all.findIndex(t => /Taxpayer Information Summary \(TIS\)\s*-/.test(t) || /^-+ Taxpayer Information Summary/.test(t));
  for (let i = Math.max(start, 0); i < (end > 0 ? end : all.length); i++) {
    if ((m = all[i].match(/^(\d+)\s+(.+?)\s+([\d,]+|-)\s+([\d,]+|-)$/))) r.categories.push({ sr: +m[1], name: m[2].trim(), processed: num(m[3]), accepted: num(m[4]) });
  }
  return r;
}

/* ---------------- AIS record → nature ---------------- */
function aisNature(rec) {
  const code = rec.code.toUpperCase(), cat = (rec.category || '').toLowerCase();
  if (rec.part === 'B7') return null;                                      // Annexure-II salary etc. – cross-check only
  if (/^TDS-/.test(code)) {
    const sec = code.replace(/^TDS-/, '');
    const nt = natureOf(sec, rec.srcName);
    if (nt.n === 'INT_TD' && !/deposit/.test(cat) && /others/.test(cat)) nt.n = 'INT_OTH';
    return Object.assign({ sec }, nt);
  }
  if (/^TCS-/.test(code)) return { n: 'TCS', sec: code };
  if (/savings bank/.test(cat) || /SFT-016\(SB\)/.test(code)) return { n: 'INT_SB', sec: code };
  if (/interest from deposit/.test(cat) || /SFT-016\((TD|RD)\)/.test(code)) return { n: isBank(rec.srcName) ? 'INT_TD' : 'INT_OTH', sec: code };
  if (/interest/.test(cat)) return { n: 'INT_OTH', sec: code };
  if (/dividend/.test(cat)) return { n: 'DIV', sec: code };
  if (/^rent/.test(cat)) return { n: 'RENT', sec: code };
  if (/^salary/.test(cat)) return { n: 'SAL', sec: code };
  return { n: 'INFO', sec: code };                                         // not income per se – listed for review
}

/* ---------------- consolidation ---------------- */
function soiOf(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return b; if (b == null) return a;
  return a === b ? a : Math.max(a, b);
}
function parseDMY(s) { const m = s && s.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; }
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function consolidate(docs) {
  const A = docs['26AS'], I = docs.AIS, T = docs.TIS;
  const res = { lines: [], tdsRows: [], flags: [], checks: [], aisInfo: [], errors: [], warnings: [] };
  const flag = (point, details) => res.flags.push({ point, details });
  [A, I, T].forEach(d => d && d.warnings && res.warnings.push(...d.warnings));

  // identity
  res.pan = (A && A.pan) || (I && I.pan) || (T && T.pan) || '';
  res.name = (A && A.name) || (I && I.name) || '';
  res.fy = (A && A.fy) || (I && I.fy) || (T && T.fy) || '';
  res.ay = (A && A.ay) || (res.fy ? (+res.fy.slice(0, 4) + 1) + '-' + String(+res.fy.slice(5, 7) + 1).padStart(2, '0') : '');
  res.ayLabel = (A && A.ayLabel) || 'Assessment Year';
  const pans = [A, I, T].filter(Boolean).map(d => d.pan).filter(Boolean);
  if (new Set(pans).size > 1) res.errors.push('PAN differs across the uploaded files (' + [...new Set(pans)].join(', ') + '). Upload files of the same assessee.');
  const fys = [A, I, T].filter(Boolean).map(d => d.fy).filter(Boolean);
  if (new Set(fys).size > 1) res.errors.push('Financial Year differs across the uploaded files (' + [...new Set(fys)].join(', ') + ').');

  const L = res.lines;
  const add = o => { const x = Object.assign({ a26: null, ais: null, notes: [], aisNotes: [] }, o); L.push(x); return x; };

  // ---- 26AS Part I / II lines (grouped by deductor + section)
  const deductorRows = [];
  if (A) {
    for (const P of ['I', 'II']) {
      const part = A.parts[P]; if (!part) continue;
      for (const d of part.deductors) {
        const bySec = {};
        for (const t of d.txns) { const s = normSec(t.section); (bySec[s] = bySec[s] || { amt: 0, tds: 0, dep: 0, txns: [] }); bySec[s].amt += t.amount; bySec[s].tds += t.tds; bySec[s].dep += t.dep; bySec[s].txns.push(t); }
        const txSum = round2(d.txns.reduce((s, t) => s + t.amount, 0));
        if (!d.txns.length) flag('26AS Part ' + P + ' – ' + d.name, 'Transaction-level section details could not be read for this deductor (TAN ' + d.tan + '). Total ' + inr(d.total) + ' classified as "Other Receipts" – verify the section.');
        else if (Math.abs(txSum - d.total) > 1) flag('26AS Part ' + P + ' – total mismatch', d.name + ' (' + d.tan + '): deductor total ' + inr(d.total) + ' but transactions add to ' + inr(txSum) + '. Verify.');
        const secs = Object.keys(bySec).length ? Object.keys(bySec) : ['?'];
        for (const s of secs) {
          const g = bySec[s] || { amt: d.total, tds: d.tds, dep: d.dep, txns: [] };
          const nt = natureOf(s, d.name);
          const ln = add({ src26: P, tan: d.tan, sec: s, fam: secFamily(s), nature: nt.n, dname: d.name,
            name: d.name + ' (' + d.tan + ') – 26AS Part ' + P + ' Sr.' + d.sr + ', Sec. ' + s + (P === 'II' ? ' [15G/15H]' : ''),
            a26: round2(g.amt), tds: round2(g.tds), txns: g.txns });
          if (nt.note) ln.notes.push(nt.note);
          if (nt.flag) flag('Section ' + s + ' – ' + d.name, nt.flag);
        }
        const st = [...new Set(d.txns.map(t => t.status).filter(Boolean))];
        deductorRows.push({ part: P, sr: d.sr, name: d.name, tan: d.tan, secs: Object.keys(bySec).join(', '),
          nature: [...new Set(secs.map(s => NATURES[natureOf(s, d.name).n]))].join(' / '), total: d.total, tds: d.tds, dep: d.dep, status: st.join(', ') });
        const bad = st.filter(s => s !== 'F');
        if (bad.length) flag('TDS booking status – ' + d.name, 'Status of booking "' + bad.join(', ') + '" (not Final) for deductor ' + d.tan + '. Credit may not be fully available until the deductor corrects the statement (U = Unmatched, Z = Mismatch, O = Overbooked, P = Provisional).');
      }
    }
    const p6 = A.parts.VI;
    if (p6 && p6.deductors.length) for (const d of p6.deductors) {
      add({ src26: 'VI', tan: d.tan, sec: [...new Set(d.txns.map(t => normSec(t.section)))].join(', '), nature: 'TCS', name: d.name + ' (' + d.tan + ') – TCS', a26: d.total, tds: d.tds });
      deductorRows.push({ part: 'VI', sr: d.sr, name: d.name, tan: d.tan, secs: [...new Set(d.txns.map(t => t.section))].join(', '), nature: 'TCS', total: d.total, tds: d.tds, dep: d.dep, status: [...new Set(d.txns.map(t => t.status).filter(Boolean))].join(', ') });
    }
    if (A.parts.III && A.parts.III.deductors.length) for (const d of A.parts.III.deductors) {
      const s = d.txns[0] ? normSec(d.txns[0].section) : 'Part III';
      add({ src26: 'III', tan: d.tan, sec: s, nature: 'OTH', name: d.name + ' (' + d.tan + ') – 26AS Part III (benefit/winnings in kind, Sec. ' + s + ')', a26: d.total });
      flag('26AS Part III – ' + d.name, 'Benefit / winnings in kind or VDA exchange (₹' + d.total + ') – tax was paid by the payer before release. Include the value as income under the appropriate head.');
    }
  }
  res.tdsRows = deductorRows;

  // ---- AIS records
  if (I) {
    const aisItems = [];
    for (const rec of I.records) {
      const nt = aisNature(rec);
      if (!nt) continue;
      const acct = rec.details.filter(d => d.kind === 'sft').map(d => d.acType + ' A/c ' + d.account).join('; ');
      if (nt.n === 'INFO') { res.aisInfo.push({ part: rec.part, category: rec.category, code: rec.code, desc: rec.desc, source: rec.source, count: rec.count, amount: rec.amount }); continue; }
      aisItems.push({ rec, nature: nt.n, sec: nt.sec, fam: rec.tan ? secFamily(nt.sec) : null, amount: rec.amount, tan: rec.tan, name: rec.srcName, acct, isSFT: /^SFT/i.test(rec.code), cat: rec.category, notes: [] });
      const inactive = rec.details.filter(d => d.status && !/^Active$/i.test(d.status));
      if (inactive.length) flag('AIS status – ' + rec.srcName, 'AIS entry (' + rec.code + ') has status "' + [...new Set(inactive.map(d => d.status))].join(', ') + '" – check AIS feedback / modifications.');
    }
    // 1) TDS-based AIS items: match to 26AS by TAN + section family
    const fmtAcct = x => x.acct ? ' (' + x.acct + ')' : '';
    for (const x of aisItems.filter(y => !y.isSFT)) {
      let ln = x.tan ? L.find(l => l.src26 && l.tan === x.tan && l.fam === x.fam && l.ais == null) : null;
      if (ln) { ln.ais = x.amount; ln.aisCat = x.cat; ln.aisCode = x.rec.code; }
      else {
        const nm = x.name + (x.tan ? ' (' + x.tan + ')' : '') + ' [AIS ' + x.rec.code + ']';
        add({ nature: x.nature, name: nm, dname: x.name, ais: x.amount, aisCat: x.cat, tan: x.tan, sec: x.sec, fam: x.fam, aisOnly: true, aisCode: x.rec.code });
      }
    }
    // 2) SFT items (no TAN): de-duplicate against lines already built (TIS also de-duplicates these)
    const nameKey = n => {
      const bk = bankKey(n); if (bk) return 'B:' + bk;
      const w = (n || '').toUpperCase().replace(/&/g, ' ').replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/)
        .filter(t => t && !['THE', 'AND', 'LIMITED', 'LTD', 'PVT', 'PRIVATE', 'CO', 'COMPANY', 'OF'].includes(t));
      return w.slice(0, 2).join(' ');
    };
    const group = n => (n === 'INT_TD' || n === 'INT_OTH') ? 'INTDEP' : n;
    for (const x of aisItems.filter(y => y.isSFT)) {
      let ln = null;
      if (x.nature !== 'INT_SB') {
        const k = nameKey(x.name);
        const cands = L.filter(l => !l.sftMerged && group(l.nature) === group(x.nature) && l.dname && nameKey(l.dname) === k);
        ln = cands.find(l => (l.ais != null ? l.ais : l.a26) === x.amount) || (cands.length === 1 ? cands[0] : null);
      }
      if (ln) {
        ln.sftMerged = true;
        if (ln.ais == null) { ln.ais = x.amount; ln.aisCat = x.cat; ln.notes.push('AIS ' + x.rec.code + fmtAcct(x) + ' matched by name'); }
        else if (ln.ais === x.amount) ln.notes.push('Also in AIS ' + x.rec.code + fmtAcct(x) + ' – same amount, taken once');
        else { ln.notes.push('AIS ' + x.rec.code + fmtAcct(x) + ' reports ' + inr(x.amount) + ' vs ' + inr(ln.ais) + ' under TDS – higher taken for AIS'); ln.ais = Math.max(ln.ais, x.amount); }
      } else {
        const nm = x.name + (x.rec.srcId ? ' (' + x.rec.srcId.split('.')[0] + ')' : '') + (x.acct ? ' – ' + x.acct : '') + ' [AIS ' + x.rec.code + ']';
        add({ nature: x.nature, name: nm, dname: x.name, ais: x.amount, aisCat: x.cat, aisOnly: true, aisCode: x.rec.code });
      }
    }
    // B7 Annexure II salary cross-check
    for (const rec of I.records.filter(r0 => r0.part === 'B7' && /SAL/i.test(r0.code))) {
      const sal = L.filter(l => l.nature === 'SAL' && l.tan && l.tan === rec.tan);
      const tot = sal.reduce((s, l) => s + (l.ais != null ? l.ais : l.a26 || 0), 0);
      const det = rec.details.find(d => d.kind === 'sal');
      res.checks.push(['AIS Part B7', 'Salary (TDS Annexure II) – ' + rec.source + ': ₹' + rec.amount.toLocaleString('en-IN') + (det ? ' (period ' + det.from + ' to ' + det.to + '; perquisites ₹' + det.perq + ', profits in lieu ₹' + det.profits + ')' : ''), Math.abs(tot - rec.amount) < 1 ? 'Agrees with salary taken' : 'Differs from salary taken (₹' + tot.toLocaleString('en-IN') + ') – verify Form 16']);
      if (det && (det.perq || det.profits)) flag('Salary – perquisites / profits in lieu', 'Annexure II shows perquisites u/s 17(2) ₹' + det.perq + ' and profits in lieu u/s 17(3) ₹' + det.profits + ' for ' + rec.srcName + '. Include in computation.');
    }
  }

  // SOI
  for (const l of L) l.soi = soiOf(l.a26, l.ais);

  /* ---- flags ---- */
  if (A) {
    const p1 = A.parts.I;
    if (p1 && p1.noTx) flag('Form 26AS – Part I Nil', 'No TDS is reported in Part I. No TDS credit is available for this year unless reflected later.');
    // 194J(a) at professional rate
    for (const l of L.filter(x => x.nature === 'FTS' && x.a26)) {
      const rate = l.a26 ? l.tds / l.a26 : 0;
      if (rate >= 0.09) flag('194J(a) at 10% – ' + l.dname, '26AS shows Sec. ' + l.sec + ' (fees for technical services, 2% rate) but TDS is ' + inr(l.tds) + ' on ' + inr(l.a26) + ' (≈' + (rate * 100).toFixed(1) + '%), i.e. the 194J(b) rate. Likely professional fees in substance – consider including in gross professional receipts.');
    }
    // salary pattern
    const salTx = L.filter(x => x.nature === 'SAL' && x.txns).flatMap(x => x.txns.map(t => Object.assign({ who: x.dname }, t)));
    if (salTx.length) {
      const fy0 = +res.fy.slice(0, 4);
      const months = {};
      salTx.forEach(t => { const [dd, mm, yy] = t.date.split('-'); const k = yy + '-' + String(MON[mm] + 1).padStart(2, '0'); (months[k] = months[k] || []).push(t); });
      const multi = Object.entries(months).filter(([, v]) => v.length > 1).map(([k, v]) => k + ' (' + v.length + ' credits: ' + v.map(t => '₹' + t.amount.toLocaleString('en-IN')).join(', ') + ')');
      const missing = []; for (let k = 0; k < 12; k++) { const d = new Date(fy0, 3 + k, 1); const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); if (!months[key]) missing.push(d.toLocaleString('en-GB', { month: 'short', year: 'numeric' })); }
      const nil = salTx.filter(t => t.tds === 0).map(t => t.date + ' ₹' + t.amount.toLocaleString('en-IN'));
      const parts = [];
      parts.push(salTx.length + ' salary credit(s) in 26AS.');
      if (multi.length) parts.push('More than one credit in: ' + multi.join('; ') + '.');
      if (missing.length) parts.push('No credit dated in: ' + missing.join(', ') + '.');
      if (nil.length) parts.push('Credits with Nil TDS: ' + nil.join('; ') + '.');
      if (multi.length || missing.length || nil.length) parts.push('Reconcile with Form 16: salary is taxable on due or receipt basis, whichever is earlier (Sec. 15); check for arrears and relief u/s 89 (Form 10E before filing the return).');
      if (multi.length || missing.length || nil.length) flag('Salary – pattern of credits', parts.join(' '));
      const emps = [...new Set(salTx.map(t => t.who))];
      if (emps.length > 1) flag('Salary – more than one employer', 'Salary from ' + emps.join(', ') + '. Check standard deduction / exemptions are not claimed twice and that the combined tax liability is computed (Form 12B).');
    }
    if (L.some(l => l.src26 && l.sec === '194A' && l.nature === 'INT_TD'))
      flag('Bank interest u/s 194A in 26AS', 'Interest from banks reported u/s 194A has been placed under "Term / Other Deposit Interest". If any part relates to a savings account, reclassify. Obtain interest certificates to verify accrued interest on deposits.');
    if (L.some(l => l.nature === 'CASH')) flag('Cash withdrawals – Sec. 194N', 'TDS u/s 194N on cash withdrawals is not income; it is shown for information only and excluded from the grand total. The TDS is creditable.');
    for (const P of ['IV', 'V', 'VIII', 'IX', 'VII', 'X']) {
      const part = A.parts[P]; if (part && !part.noTx)
        flag('26AS Part ' + P + ' – transactions present', PART_TITLES[P] + ': entries are present and must be reviewed manually (raw lines are listed in the "26AS & AIS Check" sheet).' + (P === 'IV' ? ' Part IV usually indicates sale of immovable property / VDA or rent/contract receipts with TDS under 194IA/194IB/194M/194S – consider capital gains or the relevant head.' : P === 'VII' ? ' Interest on income-tax refund is taxable as "Other Interest".' : P === 'X' ? ' These are defaults of the assessee as deductor.' : ''));
    }
  }
  const incNat = ['PRO', 'FTS', 'CON', 'COMM', 'BUS', 'PART'];
  const hasBiz = L.some(l => incNat.includes(l.nature) && l.soi > 0);
  if (I) {
    const fy = res.fy;
    const tp = I.taxPayments;
    const cur = tp.filter(t => t.fy === fy), oth = tp.filter(t => t.fy !== fy);
    const headOf = t => /self/i.test(t.head) ? 'Self-Assessment Tax' : /advance/i.test(t.head) ? 'Advance Tax' : /regular/i.test(t.head) ? 'Tax on Regular Assessment' : t.head.replace(/\s+/g, ' ');
    const desc = t => headOf(t) + ' ₹' + t.total.toLocaleString('en-IN') + ' paid on ' + t.date + ' (BSR ' + t.bsr + ', Challan ' + t.challan + ')';
    if (cur.length) flag('Tax payments for FY ' + fy, 'Challans in AIS Part B3 for FY ' + fy + ': ' + cur.map(desc).join('; ') + '. Claim as advance / self-assessment tax as applicable.');
    if (oth.length) flag('Tax payments relating to other years', 'AIS Part B3: ' + oth.map(t => 'FY ' + t.fy + ' – ' + desc(t)).join('; ') + '. These are NOT credits for ' + res.ayLabel + ' ' + res.ay + '.');
    if (!cur.some(t => /advance/i.test(t.head))) flag('Advance tax', 'No advance tax challan for FY ' + fy + ' appears in AIS Part B3.' + (hasBiz ? ' With business/professional receipts, interest u/s 234B and 234C is likely if tax payable after TDS is ₹10,000 or more.' : '') + ' Confirm with the assessee whether any challan is not yet reflected.');
    if (I.refunds.length) flag('Refunds – AIS Part B4', 'Refund entries: ' + I.refunds.join('; ') + '. Interest on refund received during the year is taxable as "Other Interest".');
    // DOB
    const dob = parseDMY(I.dob);
    if (dob && res.fy) {
      const fyEnd = new Date(+res.fy.slice(0, 4) + 1, 2, 31);
      let age = fyEnd.getFullYear() - dob.getFullYear(); if (fyEnd < new Date(fyEnd.getFullYear(), dob.getMonth(), dob.getDate())) age--;
      res.age = age;
      const sb = L.filter(l => l.nature === 'INT_SB').reduce((s, l) => s + l.soi, 0);
      const anyInt = L.filter(l => /^INT/.test(l.nature)).reduce((s, l) => s + l.soi, 0);
      if (age >= 60) flag('Senior citizen', 'DOB ' + I.dob + ' – age ' + age + ' at the end of FY ' + res.fy + (age >= 80 ? ' (very senior citizen)' : '') + '. Deduction u/s 80TTB (interest on deposits, up to ₹50,000) is available under the old regime; 80TTA does not apply. Total bank/other interest considered: ₹' + anyInt.toLocaleString('en-IN') + '.');
      else if (sb > 0) flag('Deduction on savings bank interest', 'SB interest ₹' + sb.toLocaleString('en-IN') + '. Under the old regime, deduction u/s 80TTA up to ₹10,000 is available; not available under the default regime u/s 115BAC. DOB ' + I.dob + ' – not a senior citizen, so 80TTB does not apply.');
    }
    if (res.aisInfo.length) flag('Other AIS information (not taken as income)', res.aisInfo.length + ' AIS entr' + (res.aisInfo.length > 1 ? 'ies' : 'y') + ' (e.g. purchases, sale of securities, deposits, GST turnover) are listed in the "26AS & AIS Check" sheet. Review for capital gains, business turnover or source-of-funds questions.');
    // address
    const pin = s => { const m = (s || '').match(/\b(\d{6})\b/g); return m ? m[m.length - 1] : null; };
    if (A && A.address && I.address) {
      const p1 = pin(A.address), p2 = pin(I.address);
      if (p1 && p2 && p1 !== p2) flag('Address mismatch', 'Form 26AS (PAN database): ' + A.address + '. AIS/TIS: ' + I.address + '. PIN codes differ – confirm the current address for the return and consider updating PAN records.');
      else res.checks.push(['Address', '26AS: ' + A.address + ' | AIS: ' + I.address, 'Same PIN code – no material mismatch']);
    }
  }
  // AIS-only and mismatches summary
  const aisOnly = L.filter(l => l.a26 == null && l.ais != null && !['TCS', 'CASH', 'SALE'].includes(l.nature));
  if (aisOnly.length) flag('Items only in AIS/TIS', aisOnly.length + ' item(s) appear only in AIS/TIS and are taken at the AIS figure: ' + aisOnly.map(l => l.name.split(' – ')[0].split(' [')[0] + ' ₹' + l.ais.toLocaleString('en-IN')).join('; ') + '.');
  const mism = L.filter(l => l.a26 != null && l.ais != null && Math.abs(l.a26 - l.ais) >= 1);
  if (mism.length) flag('26AS vs AIS differences', mism.map(l => l.dname + ': 26AS ₹' + l.a26.toLocaleString('en-IN') + ' vs AIS ₹' + l.ais.toLocaleString('en-IN') + ' – higher taken').join('; ') + '. Verify with the deductor / books before filing.');
  const only26 = L.filter(l => l.src26 && l.ais == null && I && !['TCS'].includes(l.nature));
  if (only26.length && I) flag('Items only in 26AS', only26.map(l => l.dname + ' (Sec. ' + l.sec + ') ₹' + (l.a26 || 0).toLocaleString('en-IN')).join('; ') + ' – not found in AIS; taken at the 26AS figure.');
  // TIS comparison
  if (T) {
    for (const c of T.categories) {
      const ours = L.filter(l => (l.aisCat || '').toLowerCase() === c.name.toLowerCase()).reduce((s, l) => s + (l.ais || 0), 0);
      const st = Math.abs(ours - c.processed) < 1 ? 'Agrees with AIS lines taken' : 'AIS lines taken total ₹' + ours.toLocaleString('en-IN') + ' – verify';
      res.checks.push(['TIS', c.name + ': Processed ₹' + c.processed.toLocaleString('en-IN') + ' / Accepted ₹' + c.accepted.toLocaleString('en-IN'), st]);
      if (c.processed !== c.accepted) flag('TIS feedback – ' + c.name, 'TIS "Processed by System" ₹' + c.processed.toLocaleString('en-IN') + ' differs from "Accepted by Taxpayer / Confirmed by Source" ₹' + c.accepted.toLocaleString('en-IN') + ' – feedback has been given in AIS. Consider the accepted value after verification.');
      if (Math.abs(ours - c.processed) >= 1 && I) flag('TIS vs AIS – ' + c.name, 'TIS processed value ₹' + c.processed.toLocaleString('en-IN') + ' vs AIS line items taken ₹' + ours.toLocaleString('en-IN') + '. Verify for duplicates or missed entries.');
    }
  }
  if (hasBiz) {
    const g = L.filter(l => ['PRO', 'FTS'].includes(l.nature)).reduce((s, l) => s + l.soi, 0);
    if (g) flag('Professional receipts', 'Gross professional / technical fee receipts considered: ₹' + g.toLocaleString('en-IN') + '. Decide between Sec. 44ADA (presumptive, subject to the receipt limits) and regular computation with books u/s 44AA; also capture receipts not subject to TDS.');
  }
  if (I && T && I.genDate && T.genDate) { /* informational */ }
  flag('Data dates', [A && A.dataDate ? 'Form 26AS data updated till ' + A.dataDate : null, I && I.genDate ? 'AIS generated on ' + I.genDate : null, T && T.genDate ? 'TIS generated on ' + T.genDate : null].filter(Boolean).join('; ') + '. Re-download before finalising, as deductors/banks may file corrections later.');
  if (!I) flag('AIS not uploaded', 'Only Form 26AS figures are considered. Upload AIS to capture savings bank interest, dividends and other SFT information.');
  if (!A) flag('Form 26AS not uploaded', 'TDS details and the 26AS column are not available. Upload Form 26AS for TDS credit and the 26AS comparison.');
  if (T && !I) flag('TIS without AIS', 'TIS gives only category totals; upload AIS for line-level details.');
  const ay0 = +((res.ay || '').slice(0, 4));
  flag('Governing law', ay0 && ay0 <= 2026 ? res.ayLabel + ' ' + res.ay + ' (FY ' + res.fy + ') is governed by the Income-tax Act, 1961; section references are to that Act. The Income-tax Act, 2025 applies from tax year 2026-27.' : 'Tax year ' + res.ay + ' is governed by the Income-tax Act, 2025. Section codes in 26AS under the 2025 Act have been mapped only where certain; review the flagged items.');

  // 26AS part-wise checks
  const partChecks = [];
  if (A) for (const P of PARTS) {
    const part = A.parts[P];
    let st, ds = PART_TITLES[P];
    if (!part) st = 'Heading not found – verify manually';
    else if (part.noTx) st = 'No Transactions Present';
    else if (part.deductors.length) { const tot = part.deductors.reduce((s, d) => s + d.total, 0), tds = part.deductors.reduce((s, d) => s + d.tds, 0); ds += ' – ' + part.deductors.length + ' deductor(s); total ₹' + tot.toLocaleString('en-IN') + (tds ? '; tax ' + inr(tds) : ''); st = 'Taken to Income Summary / TDS sheet'; }
    else st = 'Transactions present – review manually';
    partChecks.push(['26AS Part ' + P, ds, st]);
    if (part && part.raw && part.raw.length) part.raw.forEach(t => partChecks.push(['26AS Part ' + P + ' (raw)', t, 'Manual review']));
  }
  res.checks.unshift(...partChecks);
  if (I) {
    const byPart = {};
    I.records.forEach(r0 => { (byPart[r0.part] = byPart[r0.part] || []).push(r0); });
    const order = Object.keys(byPart).sort();
    res.checks.push(...order.filter(p => p !== 'B7').map(p => ['AIS Part ' + p, byPart[p].map(r0 => (r0.category ? r0.category + ': ' : '') + r0.srcName + ' ₹' + r0.amount.toLocaleString('en-IN')).join('; '), 'Taken / matched as shown in Income Summary']));
    res.checks.push(['AIS Part B3', I.taxPayments.length ? I.taxPayments.map(t => 'FY ' + t.fy + ' ' + (/self/i.test(t.head) ? 'Self-Assessment Tax' : /advance/i.test(t.head) ? 'Advance Tax' : t.head) + ' ₹' + t.total.toLocaleString('en-IN') + ' on ' + t.date).join('; ') : 'Payment of taxes', I.taxPayments.length ? 'See Additional Information' : 'No Transactions Present']);
    res.checks.push(['AIS Part B4', I.refunds.length ? I.refunds.join('; ') : 'Demand and refund', I.refunds.length ? 'See Additional Information' : 'No Transactions Present']);
    res.aisInfo.forEach(x => res.checks.push(['AIS ' + x.part + ' (info)', (x.category ? x.category + ' – ' : '') + x.code + ' ' + x.desc + ' – ' + x.source + ' (count ' + x.count + ')', '₹' + x.amount.toLocaleString('en-IN') + ' – not income; review']));
  }
  return res;
}

/* ---------------- Excel workbook (ExcelJS) ---------------- */
async function buildWorkbook(ExcelJS, res) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '26AS-AIS-TIS Consolidator (offline)';
  const F = 'Arial';
  const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + c } });
  const HDR = fill('1F4E78'), SUB = fill('DDEBF7'), TOT = fill('FFF2CC'), GT = fill('F8CBAD');
  const thin = { style: 'thin', color: { argb: 'FF999999' } }, B = { top: thin, left: thin, bottom: thin, right: thin };
  const NUM = '#,##0;(#,##0);"-"', NUM2 = '#,##0.00;(#,##0.00);"-"';
  const ws = wb.addWorksheet('Income Summary', { views: [{ state: 'frozen', ySplit: 5, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 8 }, { width: 70 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 50 }];
  function put(sh, r, c, v, o = {}) {
    const cell = sh.getCell(r, c); cell.value = v;
    cell.font = { name: F, size: o.size || 10, bold: !!o.bold, color: o.color ? { argb: 'FF' + o.color } : undefined };
    if (o.fill) cell.fill = o.fill;
    if (o.num) { cell.numFmt = o.fmt || NUM; cell.alignment = { horizontal: 'right' }; }
    if (o.wrap) cell.alignment = { wrapText: true, vertical: 'middle' };
    if (o.border !== false) cell.border = B;
    return cell;
  }
  const f = (formula, result) => ({ formula, result });
  ws.mergeCells('A1:F1'); put(ws, 1, 1, 'STATEMENT OF INCOME – CONSOLIDATION FROM FORM 26AS AND AIS/TIS', { bold: true, size: 12, border: false });
  ws.mergeCells('A2:F2'); put(ws, 2, 1, 'Name of the Assessee: ' + (res.name || '') + '   |   PAN: ' + (res.pan || ''), { bold: true, border: false });
  ws.mergeCells('A3:F3'); put(ws, 3, 1, res.ayLabel + ': ' + (res.ay || '') + '   |   Financial Year: ' + (res.fy || ''), { bold: true, border: false });
  ws.mergeCells('A4:F4'); put(ws, 4, 1, "All amounts in ₹. 'Consider for SOI' = 26AS if only in 26AS; AIS/TIS if only in AIS/TIS; 26AS if both match; higher of the two if they differ.", { size: 9, color: '555555', border: false });
  let r = 6;
  const header = row => {
    ['Sl. No', 'Name of the Deductor / Source', 'Amount Paid/Credited as per 26AS', 'As per TIS/AIS', 'Consider for SOI', 'Remarks'].forEach((h, i) => {
      const c = put(ws, row, i + 1, h, { bold: true, fill: HDR, color: 'FFFFFF' }); c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(row).height = 30;
  };
  const soiF = row => `IF(AND(C${row}="",D${row}=""),0,IF(C${row}="",D${row},IF(D${row}="",C${row},IF(C${row}=D${row},C${row},MAX(C${row},D${row})))))`;
  const sum = (arr, k) => arr.reduce((s, x) => s + (x[k] || 0), 0);
  function block(title, items, totLabel) {
    ws.mergeCells(r, 1, r, 6); put(ws, r, 1, title, { bold: true, fill: SUB }); r++;
    const s = r;
    if (!items.length) {
      put(ws, r, 1, ''); put(ws, r, 2, 'Nil – no transaction reported', { color: '777777' });
      put(ws, r, 3, null, { num: true }); put(ws, r, 4, null, { num: true }); put(ws, r, 5, f(soiF(r), 0), { num: true }); put(ws, r, 6, ''); r++;
    } else items.forEach((it, i) => {
      put(ws, r, 1, i + 1); put(ws, r, 2, it.name, { wrap: true });
      put(ws, r, 3, it.a26, { num: true, color: '0000FF' }); put(ws, r, 4, it.ais, { num: true, color: '0000FF' });
      put(ws, r, 5, f(soiF(r), it.soi), { num: true }); put(ws, r, 6, [...new Set(it.notes)].join('; '), { wrap: true, size: 9 }); r++;
    });
    put(ws, r, 1, '', { fill: TOT }); put(ws, r, 2, totLabel, { bold: true, fill: TOT }); put(ws, r, 6, '', { fill: TOT });
    [['C', 'a26'], ['D', 'ais'], ['E', 'soi']].forEach(([C, k], j) => put(ws, r, 3 + j, f(`SUM(${C}${s}:${C}${r - 1})`, sum(items, k)), { bold: true, fill: TOT, num: true }));
    const tr = r; r += 2; return { row: tr, a26: sum(items, 'a26'), ais: sum(items, 'ais'), soi: sum(items, 'soi') };
  }
  const big = t => { ws.mergeCells(r, 1, r, 6); put(ws, r, 1, t, { bold: true, fill: HDR, color: 'FFFFFF' }); header(r + 1); r += 2; };
  const totRow = (label, parts) => {
    put(ws, r, 1, '', { fill: TOT }); put(ws, r, 2, label, { bold: true, fill: TOT }); put(ws, r, 6, '', { fill: TOT });
    [['C', 'a26'], ['D', 'ais'], ['E', 'soi']].forEach(([C, k], j) => put(ws, r, 3 + j, f(parts.map(p => C + p.row).join('+'), parts.reduce((s, p) => s + p[k], 0)), { bold: true, fill: TOT, num: true }));
    const o = { row: r, a26: parts.reduce((s, p) => s + p.a26, 0), ais: parts.reduce((s, p) => s + p.ais, 0), soi: parts.reduce((s, p) => s + p.soi, 0) }; return o;
  };
  const of = n => res.lines.filter(l => l.nature === n);
  const totals = []; let n = 1;
  big((n++) + '. SALARY (Sec. 192)'); totals.push(block('Salary', of('SAL'), 'Total – Salary'));
  big((n++) + '. INTEREST (Sec. 193 / 194A / 194LD etc.)');
  ws.mergeCells(r, 1, r, 6); put(ws, r, 1, 'A. BANK INTEREST', { bold: true, border: false }); r++;
  const t1 = block('(i) Savings Bank Interest', of('INT_SB'), 'Sub-total – Savings Bank Interest');
  const t2 = block('(ii) Term / Other Deposit Interest', of('INT_TD'), 'Sub-total – Term/Other Deposit Interest');
  const tA = totRow('Total – Bank Interest (A)', [t1, t2]); r += 2;
  ws.mergeCells(r, 1, r, 6); put(ws, r, 1, 'B. OTHER INTEREST', { bold: true, border: false }); r++;
  const tB = block('Other Interest (non-bank, securities, IT refund interest etc.)', of('INT_OTH'), 'Total – Other Interest (B)');
  totals.push(totRow('TOTAL – INTEREST (A + B)', [tA, tB])); r += 3;
  const tables = [['DIV', 'DIVIDEND (Sec. 194 / 194K)', 'Dividend'], ['CON', 'CONTRACT PAYMENTS (Sec. 194C)', 'Contract Payments'],
    ['PRO', 'PROFESSIONAL FEES (Sec. 194J(b))', 'Professional Fees'], ['FTS', 'FEES FOR TECHNICAL SERVICES (Sec. 194J(a))', 'Fees for Technical Services'],
    ['RENT', 'RENT (Sec. 194I / 194IB)', 'Rent'], ['COMM', 'COMMISSION / BROKERAGE (Sec. 194D / 194G / 194H)', 'Commission / Brokerage'],
    ['BUS', 'BUSINESS RECEIPTS – E-COMMERCE / SALE OF GOODS (Sec. 194O / 194Q)', 'Business Receipts'],
    ['PART', "PARTNER'S REMUNERATION / INTEREST (Sec. 194T)", "Partner's Remuneration"], ['WIN', 'WINNINGS (Sec. 194B / 194BA / 194BB)', 'Winnings'],
    ['OTH', 'OTHER RECEIPTS (other sections – see Remarks / Additional Information)', 'Other Receipts']];
  for (const [k, t, s] of tables) { big((n++) + '. ' + t); totals.push(block(s, of(k), 'Total – ' + s)); }
  ws.mergeCells(r, 1, r, 2); put(ws, r, 1, 'GRAND TOTAL', { bold: true, fill: GT }); put(ws, r, 6, '', { fill: GT });
  [['C', 'a26'], ['D', 'ais'], ['E', 'soi']].forEach(([C, k], j) => put(ws, r, 3 + j, f(totals.map(p => C + p.row).join('+'), totals.reduce((s, p) => s + p[k], 0)), { bold: true, fill: GT, num: true }));
  r += 3;
  big((n++) + '. FOR INFORMATION – NOT INCOME (excluded from Grand Total)');
  block('Sale consideration – Property / VDA (Sec. 194IA / 194S): compute capital gains separately', of('SALE'), 'Total – Sale Consideration');
  block('Cash withdrawals (Sec. 194N) – TDS creditable', of('CASH'), 'Total – Cash Withdrawals');
  block('Tax Collected at Source – amount paid/debited', of('TCS'), 'Total – TCS transactions');
  put(ws, r, 1, 'Blue figures are read from Form 26AS / AIS; black figures are formulas. Generated offline by the 26AS-AIS-TIS Consolidator – review before use.', { size: 9, color: '555555', border: false });

  // TDS sheet
  const w4 = wb.addWorksheet('TDS Credit (26AS)', { views: [{ state: 'frozen', ySplit: 3, showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  w4.columns = [{ width: 7 }, { width: 8 }, { width: 50 }, { width: 13 }, { width: 14 }, { width: 30 }, { width: 17 }, { width: 15 }, { width: 15 }, { width: 10 }];
  put(w4, 1, 1, 'TDS / TCS CREDIT AS PER FORM 26AS – ' + res.ayLabel + ' ' + res.ay + ' – ' + res.name + ' (' + res.pan + ')', { bold: true, size: 12, border: false });
  ['26AS Part', 'Sr. No', 'Name of the Deductor / Collector', 'TAN', 'Section(s)', 'Nature of Income', 'Total Amount Paid/Credited', 'Total Tax Deducted / Collected', 'Total Deposited', 'Booking Status'].forEach((h, i) => {
    const c = put(w4, 3, i + 1, h, { bold: true, fill: HDR, color: 'FFFFFF' }); c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
  });
  w4.getRow(3).height = 32;
  let rr = 4;
  const tdsRows = res.tdsRows;
  if (!tdsRows.length) { put(w4, rr, 3, 'Nil – no TDS / TCS reported in Form 26AS', { color: '777777' }); rr++; }
  for (const d of tdsRows) {
    [d.part, d.sr, d.name, d.tan, d.secs, d.nature].forEach((v, j) => put(w4, rr, j + 1, v, { wrap: j === 2 || j === 5 }));
    put(w4, rr, 7, d.total, { num: true, fmt: NUM2, color: '0000FF' }); put(w4, rr, 8, d.tds, { num: true, fmt: NUM2, color: '0000FF' }); put(w4, rr, 9, d.dep, { num: true, fmt: NUM2, color: '0000FF' }); put(w4, rr, 10, d.status); rr++;
  }
  const e = rr - 1;
  for (let c = 1; c <= 10; c++) put(w4, rr, c, c === 3 ? 'TOTAL' : '', { bold: true, fill: TOT });
  [['G', 'total'], ['H', 'tds'], ['I', 'dep']].forEach(([C, k], j) => put(w4, rr, 7 + j, f(`SUM(${C}4:${C}${e})`, round2(sum(tdsRows, k))), { bold: true, fill: TOT, num: true, fmt: NUM2 }));
  rr += 2;
  put(w4, rr, 3, 'Summary by nature of income', { bold: true, fill: SUB }); put(w4, rr, 7, 'Amount', { bold: true, fill: SUB }); put(w4, rr, 8, 'Tax', { bold: true, fill: SUB }); rr++;
  const s0 = rr;
  const natList = [...new Set(tdsRows.map(d => d.nature))];
  for (const nat of natList) {
    put(w4, rr, 3, nat);
    put(w4, rr, 7, f(`SUMIF($F$4:$F$${e},C${rr},$G$4:$G$${e})`, round2(sum(tdsRows.filter(d => d.nature === nat), 'total'))), { num: true, fmt: NUM2 });
    put(w4, rr, 8, f(`SUMIF($F$4:$F$${e},C${rr},$H$4:$H$${e})`, round2(sum(tdsRows.filter(d => d.nature === nat), 'tds'))), { num: true, fmt: NUM2 }); rr++;
  }
  put(w4, rr, 3, 'Total', { bold: true, fill: TOT });
  if (natList.length) {
    put(w4, rr, 7, f(`SUM(G${s0}:G${rr - 1})`, round2(sum(tdsRows, 'total'))), { bold: true, fill: TOT, num: true, fmt: NUM2 });
    put(w4, rr, 8, f(`SUM(H${s0}:H${rr - 1})`, round2(sum(tdsRows, 'tds'))), { bold: true, fill: TOT, num: true, fmt: NUM2 });
  } else { put(w4, rr, 7, 0, { bold: true, fill: TOT, num: true, fmt: NUM2 }); put(w4, rr, 8, 0, { bold: true, fill: TOT, num: true, fmt: NUM2 }); }

  // Additional Information
  const w2 = wb.addWorksheet('Additional Information', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  w2.columns = [{ width: 6 }, { width: 34 }, { width: 110 }];
  put(w2, 1, 1, 'ADDITIONAL INFORMATION TO BE CONSIDERED – ' + res.ayLabel + ' ' + res.ay + ' – ' + res.name + ' (PAN ' + res.pan + ')', { bold: true, size: 12, border: false });
  put(w2, 2, 1, 'Rule-based observations generated from the statements. These are prompts for review, not conclusions.', { size: 9, color: '555555', border: false });
  ['Sl. No', 'Point', 'Details / Action'].forEach((h, i) => put(w2, 4, i + 1, h, { bold: true, fill: HDR, color: 'FFFFFF' }));
  const allFlags = res.errors.map(x => ({ point: 'ERROR', details: x })).concat(res.warnings.map(x => ({ point: 'Reading warning', details: x })), res.flags);
  allFlags.forEach((fl, i) => {
    [i + 1, fl.point, fl.details].forEach((v, j) => { const c = put(w2, 5 + i, j + 1, v, { bold: j === 1, color: fl.point === 'ERROR' ? 'C00000' : undefined }); c.alignment = { wrapText: true, vertical: 'top' }; });
  });

  // Checks
  const w3 = wb.addWorksheet('26AS & AIS Check', { views: [{ showGridLines: false }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  w3.columns = [{ width: 20 }, { width: 100 }, { width: 36 }];
  put(w3, 1, 1, 'PART-WISE REVIEW – FORM 26AS AND AIS / TIS – ' + res.name + ' (' + res.pan + ')', { bold: true, size: 12, border: false });
  ['Part', 'Description', 'Status'].forEach((h, i) => put(w3, 3, i + 1, h, { bold: true, fill: HDR, color: 'FFFFFF' }));
  res.checks.forEach((row, i) => row.forEach((v, j) => { const c = put(w3, 4 + i, j + 1, v); c.alignment = { wrapText: true, vertical: 'top' }; }));
  return wb;
}

const api = { extractLines, detectType, parse26AS, parseAIS, parseTIS, consolidate, buildWorkbook, NATURES, natureOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Consolidator = api;
})(typeof window !== 'undefined' ? window : globalThis);
