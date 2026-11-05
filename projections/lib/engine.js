/*
 * Financial projections engine.
 * All amounts are in the unit the user chose (Rs. '000s or Rs. lakhs); the engine does not convert units.
 * Cash & bank balance in the balance sheet is the balancing figure.
 */
(function (root) {
  "use strict";

  const sum = a => a.reduce((x, y) => x + (Number(y) || 0), 0);
  const num = v => Number(v) || 0;

  /**
   * Term loan schedule, month by month from the first month of Year 1.
   * L: { name, existing, amount, startYear, rate, morat, repay, method: 'epi'|'emi' }
   *  existing: amount is the outstanding at the start of Year 1 and repay is the remaining months.
   *  new: amount is disbursed in the first month of startYear; interest is paid during the moratorium.
   */
  function loanSchedule(L, N) {
    const r = num(L.rate) / 1200;
    const n = Math.max(1, Math.round(num(L.repay)));
    const amt = num(L.amount);
    const start = L.existing ? 1 : (Math.max(1, Math.round(num(L.startYear))) - 1) * 12 + 1;
    const mor = L.existing ? 0 : Math.max(0, Math.round(num(L.morat)));
    const emi = r ? amt * r / (1 - Math.pow(1 + r, -n)) : amt / n;
    const epi = amt / n;
    let bal = L.existing ? amt : 0;
    const years = Array.from({ length: N }, () => ({ open: 0, disb: 0, interest: 0, principal: 0, close: 0 }));
    const months = [];
    for (let m = 1; m <= N * 12; m++) {
      const y = Math.ceil(m / 12) - 1;
      const open = bal;
      const disb = (!L.existing && m === start) ? amt : 0;
      bal = open + disb;
      if ((m - 1) % 12 === 0) years[y].open = open;
      let interest = 0, principal = 0;
      if (m >= start && bal > 1e-9) {
        interest = bal * r;
        if (m >= start + mor) {
          principal = L.method === 'emi' ? Math.min(Math.max(emi - interest, 0), bal) : Math.min(epi, bal);
        }
      }
      bal -= principal;
      if (bal < 1e-9) bal = 0;
      years[y].disb += disb; years[y].interest += interest; years[y].principal += principal; years[y].close = bal;
      if (open > 1e-9 || disb > 0) months.push({ m, year: y + 1, open, disb, interest, principal, instalment: interest + principal, close: bal });
    }
    return { years, months, emi: L.method === 'emi' ? emi : null, epi: L.method === 'emi' ? null : epi };
  }

  /** Fixed asset blocks on the written down value method. */
  function fixedAssets(blocks, N, halfOnAdditions) {
    return blocks.map(b => {
      let wdv = num(b.open);
      const rows = [];
      for (let t = 0; t < N; t++) {
        const add = num((b.add || [])[t]);
        const gross = wdv + add;
        const rate = num(b.rate) / 100;
        const dep = halfOnAdditions ? (wdv * rate + add * rate / 2) : gross * rate;
        rows.push({ open: wdv, add, gross, dep, close: gross - dep });
        wdv = gross - dep;
      }
      return { name: b.name, rate: num(b.rate), rows };
    });
  }

  const MPBF_METHODS = {
    turnover: 'Turnover method (20% of projected turnover)',
    tandon2: 'Second method of lending (75% of current assets less other current liabilities)',
  };

  function compute(inp) {
    const N = Math.max(1, Math.min(10, Math.round(num(inp.N) || 5)));
    const errors = [], warnings = [];
    const op = inp.opening || {};
    const loanType = inp.loanType || 'none';
    const hasCC = loanType === 'cc' || loanType === 'both';
    const hasTL = loanType === 'tl' || loanType === 'both';

    const fa = fixedAssets(inp.blocks || [], N, !!inp.halfOnAdditions);
    const loans = hasTL ? (inp.loans || []).filter(l => num(l.amount) > 0).map(l => Object.assign({ sched: loanSchedule(l, N) }, l)) : [];
    const existingLoansOpen = loans.filter(l => l.existing).reduce((a, l) => a + num(l.amount), 0);

    // opening balance sheet - cash is the balancing figure
    const faOpen = sum((inp.blocks || []).map(b => b.open));
    const ccOpen = hasCC ? num(inp.cc && inp.cc.openBal) : 0;
    const openLiab = num(op.capital) + existingLoansOpen + ccOpen + num(op.unsecured) + num(op.creditors) + num(op.otherCL);
    const openAssetsExCash = faOpen + num(op.investments) + num(op.stock) + num(op.debtors) + num(op.otherCA);
    const openCash = openLiab - openAssetsExCash;
    if (openCash < -0.005) errors.push({ code: 'opening', text: `The opening balance sheet does not balance: cash & bank would be negative (${openCash.toFixed(2)}). Check the opening figures.` });

    const years = [];
    let prev = {
      sales: 0, stock: num(op.stock), debtors: num(op.debtors), creditors: num(op.creditors), otherCA: num(op.otherCA),
      otherCL: num(op.otherCL), cc: ccOpen, capital: num(op.capital), cash: openCash, tl: existingLoansOpen,
      unsecured: num(op.unsecured), nfa: faOpen, investments: num(op.investments)
    };
    const growth = inp.growth || [];
    for (let t = 0; t < N; t++) {
      const Y = { t, label: (inp.yearLabels || [])[t] || `Year ${t + 1}` };
      Y.sales = t === 0 ? num(inp.sales1) : prev.sales * (1 + num(growth[t]) / 100);
      Y.otherIncome = Y.sales * num(inp.otherIncomePct) / 100;
      Y.purchases = Y.sales * num(inp.purchasePct) / 100;
      Y.directExp = Y.sales * num(inp.directPct) / 100;
      Y.openStock = prev.stock;
      Y.closeStock = Y.purchases * num(inp.stockDays) / 365;
      Y.cogs = Y.openStock + Y.purchases + Y.directExp - Y.closeStock;
      Y.grossProfit = Y.sales - Y.cogs;
      Y.salaries = num(inp.salaries1) * Math.pow(1 + num(inp.salaryGrowth) / 100, t);
      Y.admin = Y.sales * num(inp.adminPct) / 100;
      Y.fixedExp = num(inp.fixedExp1) * Math.pow(1 + num(inp.fixedGrowth) / 100, t);
      Y.dep = sum(fa.map(b => b.rows[t].dep));
      Y.capex = sum(fa.map(b => b.rows[t].add));
      Y.nfa = sum(fa.map(b => b.rows[t].close));

      // working capital items
      Y.debtors = Y.sales * num(inp.debtorDays) / 365;
      Y.creditors = Y.purchases * num(inp.creditorDays) / 365;
      Y.otherCA = num(inp.otherCA);
      Y.otherCL = num(inp.otherCL);
      Y.caExCash = Y.closeStock + Y.debtors + Y.otherCA;
      Y.oclExBank = Y.creditors + Y.otherCL;

      // MPBF
      Y.mpbfTurnover = Y.sales * 0.20;
      Y.wcReqTurnover = Y.sales * 0.25;
      Y.mpbfTandon2 = 0.75 * Y.caExCash - Y.oclExBank;
      Y.wcGap = Y.caExCash - Y.oclExBank;
      const method = (inp.cc && inp.cc.method) || 'turnover';
      Y.mpbf = Math.max(0, method === 'tandon2' ? Y.mpbfTandon2 : Math.min(Y.mpbfTurnover, Y.wcGap));

      // cash credit
      if (hasCC) {
        const c = inp.cc || {};
        Y.ccLimit = c.mode === 'mpbf' ? Y.mpbf : num(c.limit);
        Y.cc = Y.ccLimit * (c.util === undefined || c.util === '' ? 100 : num(c.util)) / 100;
        Y.ccInterest = Y.cc * num(c.rate) / 100;
      } else { Y.ccLimit = 0; Y.cc = 0; Y.ccInterest = 0; }

      // term loans
      Y.tlOpen = sum(loans.map(l => l.sched.years[t].open));
      Y.tlDisb = sum(loans.map(l => l.sched.years[t].disb));
      Y.tlInterest = sum(loans.map(l => l.sched.years[t].interest));
      Y.tlRepay = sum(loans.map(l => l.sched.years[t].principal));
      Y.tl = sum(loans.map(l => l.sched.years[t].close));

      Y.unsecuredInterest = num(op.unsecured) * num(inp.unsecuredRate) / 100;
      Y.interest = Y.ccInterest + Y.tlInterest + Y.unsecuredInterest;
      Y.totalExp = Y.cogs + Y.salaries + Y.admin + Y.fixedExp + Y.dep + Y.interest;
      Y.pbt = Y.sales + Y.otherIncome - Y.totalExp;
      Y.tax = Math.max(Y.pbt, 0) * num(inp.taxRate) / 100;
      Y.pat = Y.pbt - Y.tax;

      Y.capitalIn = num((inp.capitalIn || [])[t]);
      Y.drawings = num((inp.drawings || [])[t]);
      Y.capitalOpen = prev.capital;
      Y.capital = prev.capital + Y.capitalIn + Y.pat - Y.drawings;
      Y.unsecured = num(op.unsecured);
      Y.investments = num(op.investments);

      Y.totalLiab = Y.capital + Y.tl + Y.cc + Y.unsecured + Y.creditors + Y.otherCL;
      Y.assetsExCash = Y.nfa + Y.investments + Y.closeStock + Y.debtors + Y.otherCA;
      Y.cash = Y.totalLiab - Y.assetsExCash;   // balancing figure
      Y.totalAssets = Y.assetsExCash + Y.cash;

      // cash flow (sources and applications), reconciled with the change in cash
      Y.cf = {
        pat: Y.pat, dep: Y.dep, capitalIn: Y.capitalIn, tlDisb: Y.tlDisb, ccInc: Y.cc - prev.cc,
        crInc: Y.creditors - prev.creditors, oclInc: Y.otherCL - prev.otherCL,
        capex: Y.capex, tlRepay: Y.tlRepay, drawings: Y.drawings, stockInc: Y.closeStock - prev.stock,
        drInc: Y.debtors - prev.debtors, ocaInc: Y.otherCA - prev.otherCA,
      };
      Y.cf.sources = Y.cf.pat + Y.cf.dep + Y.cf.capitalIn + Y.cf.tlDisb + Y.cf.ccInc + Y.cf.crInc + Y.cf.oclInc;
      Y.cf.uses = Y.cf.capex + Y.cf.tlRepay + Y.cf.drawings + Y.cf.stockInc + Y.cf.drInc + Y.cf.ocaInc;
      Y.cf.net = Y.cf.sources - Y.cf.uses;
      Y.cf.open = prev.cash; Y.cf.close = prev.cash + Y.cf.net;
      Y.cf.diff = Y.cf.close - Y.cash;

      // ratios
      const R = {};
      Y.ca = Y.caExCash + Y.cash;
      Y.cl = Y.creditors + Y.otherCL + Y.cc;
      Y.nwc = Y.ca - Y.cl;
      Y.tnw = Y.capital;
      Y.tol = Y.tl + Y.cc + Y.unsecured + Y.creditors + Y.otherCL;
      const div = (a, b) => (Math.abs(b) < 1e-9 ? null : a / b);
      R.currentRatio = div(Y.ca, Y.cl);
      R.nwcToCa = div(Y.nwc, Y.ca);
      R.debtEquity = div(Y.tl + Y.unsecured, Y.tnw);
      R.tolTnw = div(Y.tol, Y.tnw);
      const debtService = Y.interest + Y.tlRepay;
      R.dscr = debtService > 1e-9 ? (Y.pat + Y.dep + Y.interest) / debtService : null;
      R.icr = div(Y.pbt + Y.interest, Y.interest);
      R.gpMargin = div(Y.grossProfit, Y.sales);
      R.npMargin = div(Y.pat, Y.sales);
      R.roce = div(Y.pbt + Y.interest, Y.tnw + Y.tl + Y.unsecured + Y.cc);
      R.facr = Y.tl > 1e-9 ? Y.nfa / Y.tl : null;
      const variable = Y.cogs + Y.admin;
      const fixed = Y.salaries + Y.fixedExp + Y.dep + Y.interest;
      const cmRatio = div(Y.sales + Y.otherIncome - variable, Y.sales + Y.otherIncome);
      Y.bepSales = cmRatio && cmRatio > 0 ? fixed / cmRatio : null;
      Y.cashBepSales = cmRatio && cmRatio > 0 ? (fixed - Y.dep) / cmRatio : null;
      R.bepPct = Y.bepSales !== null ? div(Y.bepSales, Y.sales) : null;
      R.debtorDays = div(Y.debtors * 365, Y.sales);
      R.creditorDays = div(Y.creditors * 365, Y.purchases);
      R.stockDays = div(Y.closeStock * 365, Y.purchases);
      Y.ratios = R;
      Y.netCashAccruals = Y.pat + Y.dep;

      years.push(Y);
      prev = Object.assign({}, Y, { stock: Y.closeStock });
    }

    // checks
    const B = Object.assign({ currentRatio: 1.33, nwcToCa: 0.25, debtEquity: 2, tolTnw: 3, dscrYear: 1.25, dscrAvg: 1.5, icr: 2, facr: 1.25, bepPct: 0.8 }, inp.bench || {});
    const minCash = num(inp.minCash);
    years.forEach(Y => {
      const R = Y.ratios, bad = {};
      if (R.currentRatio !== null && R.currentRatio < B.currentRatio) bad.currentRatio = true;
      if (R.nwcToCa !== null && R.nwcToCa < B.nwcToCa) bad.nwcToCa = true;
      if (Y.tnw <= 0 || (R.debtEquity !== null && R.debtEquity > B.debtEquity)) bad.debtEquity = true;
      if (Y.tnw <= 0 || (R.tolTnw !== null && R.tolTnw > B.tolTnw)) bad.tolTnw = true;
      if (R.dscr !== null && R.dscr < B.dscrYear) bad.dscr = true;
      if (R.icr !== null && R.icr < B.icr) bad.icr = true;
      if (R.npMargin !== null && R.npMargin < 0) bad.npMargin = true;
      if (R.gpMargin !== null && R.gpMargin < 0) bad.gpMargin = true;
      if (R.roce !== null && R.roce < 0) bad.roce = true;
      if (R.facr !== null && R.facr < B.facr) bad.facr = true;
      if (R.bepPct === null || R.bepPct > B.bepPct) bad.bepPct = true;
      Y.bad = bad;
      Y.cashShort = Y.cash < minCash - 0.005;
      Y.mpbfOk = !hasCC || Y.ccLimit <= Y.mpbf + 0.005;
      Y.marginOk = !hasCC || (inp.cc && inp.cc.method === 'tandon2' ? Y.nwc >= 0.25 * Y.ca - 0.005 : true);
      if (Math.abs(Y.cf.diff) > 0.01) errors.push({ code: 'cf', text: `${Y.label}: the cash flow statement does not reconcile with the balance sheet (difference ${Y.cf.diff.toFixed(2)}).` });
    });
    const dscrs = years.map(Y => Y.ratios.dscr).filter(v => v !== null);
    const avgDscr = dscrs.length ? dscrs.reduce((a, b) => a + b, 0) / dscrs.length : null;
    const short = years.filter(Y => Y.cashShort);
    if (short.length) errors.push({ code: 'cash', text: `Cash & bank balance is ${minCash ? 'below the minimum of ' + minCash.toFixed(2) : 'negative'} in ${short.map(Y => `${Y.label} (${Y.cash.toFixed(2)})`).join(', ')}.` });
    const mp = years.filter(Y => !Y.mpbfOk);
    if (mp.length) errors.push({ code: 'mpbf', text: `The cash credit limit is more than the MPBF in ${mp.map(Y => `${Y.label} (limit ${Y.ccLimit.toFixed(2)}, MPBF ${Y.mpbf.toFixed(2)})`).join(', ')}.` });
    const mg = years.filter(Y => !Y.marginOk);
    if (mg.length) warnings.push({ code: 'margin', text: `Net working capital is below 25% of current assets in ${mg.map(Y => Y.label).join(', ')} (borrower's margin under the second method of lending).` });
    if (avgDscr !== null && avgDscr < B.dscrAvg) warnings.push({ code: 'dscr', text: `Average DSCR is ${avgDscr.toFixed(2)}, below the benchmark of ${B.dscrAvg}.` });
    const neg = years.filter(Y => Y.tnw <= 0);
    if (neg.length) warnings.push({ code: 'tnw', text: `Net worth is nil or negative in ${neg.map(Y => Y.label).join(', ')}.` });

    return { N, years, fa, loans, openCash, avgDscr, bench: B, hasCC, hasTL, errors, warnings, method: (inp.cc && inp.cc.method) || 'turnover' };
  }

  /** Smallest capital introductions (by year) that keep cash at or above the minimum. */
  function capitalNeeded(inp) {
    const x = JSON.parse(JSON.stringify(inp));
    const N = Math.max(1, Math.min(10, Math.round(num(x.N) || 5)));
    x.capitalIn = Array.from({ length: N }, (_, i) => num((x.capitalIn || [])[i]));
    const added = Array(N).fill(0);
    for (let guard = 0; guard < 4 * N; guard++) {
      const r = compute(x);
      const Y = r.years.find(y => y.cashShort);
      if (!Y) break;
      const need = Math.ceil((num(x.minCash) - Y.cash) * 100 + 1e-6) / 100;
      x.capitalIn[Y.t] += need; added[Y.t] += need;
    }
    return { capitalIn: x.capitalIn, added };
  }

  root.FPEngine = { compute, loanSchedule, fixedAssets, capitalNeeded, MPBF_METHODS };
})(typeof window !== 'undefined' ? window : globalThis);
