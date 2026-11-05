/*
 * Turns the engine result into statements (title + rows) used for both the screen and the Excel file.
 * Row kinds: head (section heading), num, total, ratio, pct, days, text, blank.
 */
(function (root) {
  "use strict";
  const R = (label, values, kind, opts) => Object.assign({ label, values, kind: kind || 'num' }, opts || {});
  const H = label => ({ label, kind: 'head' });
  const BLANK = { kind: 'blank' };

  function statements(m, inp) {
    const Y = m.years, col = f => Y.map(f);
    const out = [];

    out.push({ key: 'pl', name: 'Profit & Loss', title: 'PROJECTED PROFITABILITY STATEMENT', rows: [
      H('INCOME'),
      R('Gross sales / turnover', col(y => y.sales)),
      R('Growth over previous year (%)', col((y, i) => i ? (y.sales / Y[i - 1].sales - 1) : null), 'pct'),
      R('Other income', col(y => y.otherIncome)),
      R('Total income', col(y => y.sales + y.otherIncome), 'total'),
      BLANK, H('EXPENDITURE'),
      R('Opening stock', col(y => y.openStock)),
      R('Add: Purchases', col(y => y.purchases)),
      R('Add: Direct expenses', col(y => y.directExp)),
      R('Less: Closing stock', col(y => y.closeStock)),
      R('Cost of goods sold', col(y => y.cogs), 'total'),
      R('Gross profit', col(y => y.grossProfit), 'total'),
      R('Salaries and wages', col(y => y.salaries)),
      R('Administrative and selling expenses', col(y => y.admin)),
      R('Rent and other fixed expenses', col(y => y.fixedExp)),
      R('Depreciation', col(y => y.dep)),
      R('Interest on term loans', col(y => y.tlInterest)),
      R('Interest on cash credit', col(y => y.ccInterest)),
      R('Interest on unsecured loans', col(y => y.unsecuredInterest)),
      R('Total expenditure', col(y => y.totalExp), 'total'),
      BLANK,
      R('PROFIT BEFORE TAX', col(y => y.pbt), 'total'),
      R(`Less: Provision for tax @ ${Number(inp.taxRate) || 0}%`, col(y => y.tax)),
      R('PROFIT AFTER TAX', col(y => y.pat), 'total'),
      R('Net cash accruals (PAT + depreciation)', col(y => y.netCashAccruals)),
    ]});

    out.push({ key: 'bs', name: 'Balance Sheet', title: 'PROJECTED BALANCE SHEET', rows: [
      H('LIABILITIES'),
      R('Capital – opening', col(y => y.capitalOpen)),
      R('Add: Capital introduced', col(y => y.capitalIn)),
      R('Add: Profit after tax', col(y => y.pat)),
      R('Less: Drawings / withdrawals', col(y => y.drawings)),
      R('Capital – closing', col(y => y.capital), 'total'),
      R('Term loans from bank', col(y => y.tl)),
      R('Working capital loan (cash credit)', col(y => y.cc)),
      R('Unsecured loans', col(y => y.unsecured)),
      R('Trade creditors', col(y => y.creditors)),
      R('Other current liabilities & provisions', col(y => y.otherCL)),
      R('TOTAL', col(y => y.totalLiab), 'total'),
      BLANK, H('ASSETS'),
      R('Fixed assets (net block)', col(y => y.nfa)),
      R('Investments / other non-current assets', col(y => y.investments)),
      R('Closing stock', col(y => y.closeStock)),
      R('Trade debtors', col(y => y.debtors)),
      R('Loans, advances & other current assets', col(y => y.otherCA)),
      R('Cash & bank balance (balancing figure)', col(y => y.cash), 'num', { bad: col(y => y.cashShort) }),
      R('TOTAL', col(y => y.totalAssets), 'total'),
    ]});

    out.push({ key: 'cf', name: 'Cash Flow', title: 'PROJECTED CASH FLOW STATEMENT', rows: [
      H('SOURCES OF FUNDS'),
      R('Net profit after tax', col(y => y.cf.pat)),
      R('Add: Depreciation', col(y => y.cf.dep)),
      R('Capital introduced', col(y => y.cf.capitalIn)),
      R('Term loans disbursed', col(y => y.cf.tlDisb)),
      R('Increase / (decrease) in cash credit', col(y => y.cf.ccInc)),
      R('Increase / (decrease) in trade creditors', col(y => y.cf.crInc)),
      R('Increase / (decrease) in other current liabilities', col(y => y.cf.oclInc)),
      R('Total sources', col(y => y.cf.sources), 'total'),
      BLANK, H('APPLICATION OF FUNDS'),
      R('Purchase of fixed assets', col(y => y.cf.capex)),
      R('Repayment of term loans', col(y => y.cf.tlRepay)),
      R('Drawings / withdrawals', col(y => y.cf.drawings)),
      R('Increase / (decrease) in stock', col(y => y.cf.stockInc)),
      R('Increase / (decrease) in trade debtors', col(y => y.cf.drInc)),
      R('Increase / (decrease) in other current assets', col(y => y.cf.ocaInc)),
      R('Total application', col(y => y.cf.uses), 'total'),
      BLANK,
      R('Opening cash & bank balance', col(y => y.cf.open)),
      R('Add: Surplus / (deficit)', col(y => y.cf.net)),
      R('Closing cash & bank balance', col(y => y.cf.close), 'total', { bad: col(y => y.cashShort) }),
    ]});

    const faRows = [];
    m.fa.forEach(b => {
      faRows.push(H(`${b.name.toUpperCase()} (WDV @ ${b.rate}%)`));
      faRows.push(R('Opening WDV', b.rows.map(r => r.open)));
      faRows.push(R('Add: Additions', b.rows.map(r => r.add)));
      faRows.push(R('Total', b.rows.map(r => r.gross), 'total'));
      faRows.push(R('Less: Depreciation', b.rows.map(r => r.dep)));
      faRows.push(R('Closing WDV', b.rows.map(r => r.close), 'total'));
      faRows.push(BLANK);
    });
    faRows.push(R('TOTAL DEPRECIATION', col(y => y.dep), 'total'));
    faRows.push(R('TOTAL WDV', col(y => y.nfa), 'total'));
    out.push({ key: 'fa', name: 'Fixed Assets', title: 'PROJECTED FIXED ASSETS AND DEPRECIATION', rows: faRows,
      note: inp.halfOnAdditions ? 'Depreciation on additions is charged at half the rate in the year of addition.' : 'Depreciation is charged at the full rate on additions in the year of addition.' });

    const lnRows = [];
    if (m.hasTL) {
      m.loans.forEach(l => {
        const s = l.sched;
        lnRows.push(H(`${(l.name || 'Term loan').toUpperCase()} – ${l.existing ? 'existing' : 'new'}, interest @ ${l.rate}% p.a.`));
        lnRows.push(R('Opening balance', s.years.map(y => y.open)));
        lnRows.push(R('Add: Disbursement', s.years.map(y => y.disb)));
        lnRows.push(R('Interest', s.years.map(y => y.interest)));
        lnRows.push(R('Repayment of principal', s.years.map(y => y.principal)));
        lnRows.push(R('Total instalments (interest + principal)', s.years.map(y => y.interest + y.principal)));
        lnRows.push(R('Closing balance', s.years.map(y => y.close), 'total'));
        lnRows.push(BLANK);
      });
    }
    if (m.hasCC) {
      lnRows.push(H(`CASH CREDIT (WORKING CAPITAL LOAN), interest @ ${inp.cc.rate}% p.a.`));
      lnRows.push(R('Cash credit limit', col(y => y.ccLimit)));
      lnRows.push(R(`Average utilisation (${inp.cc.util === '' || inp.cc.util === undefined ? 100 : inp.cc.util}%)`, col(y => y.cc)));
      lnRows.push(R('Interest on cash credit', col(y => y.ccInterest), 'total'));
      lnRows.push(BLANK);
    }
    lnRows.push(R('TOTAL INTEREST', col(y => y.interest), 'total'));
    out.push({ key: 'loans', name: 'Loans & Interest', title: 'LOANS AND INTEREST SCHEDULE', rows: lnRows,
      note: m.hasTL ? 'Term loans: interest is calculated monthly on the reducing balance; interest during any moratorium is paid as it falls due. The month-by-month schedule is on the next sheet.' : '' });

    const meth = m.method === 'tandon2';
    out.push({ key: 'wc', name: 'Working Capital & MPBF', title: 'ASSESSMENT OF WORKING CAPITAL AND MPBF', rows: [
      H('CURRENT ASSETS (excluding cash & bank)'),
      R('Stock', col(y => y.closeStock)), R('Trade debtors', col(y => y.debtors)), R('Other current assets', col(y => y.otherCA)),
      R('Total current assets (A)', col(y => y.caExCash), 'total'),
      H('CURRENT LIABILITIES (other than bank borrowings)'),
      R('Trade creditors', col(y => y.creditors)), R('Other current liabilities', col(y => y.otherCL)),
      R('Total (B)', col(y => y.oclExBank), 'total'),
      R('Working capital gap (A – B)', col(y => y.wcGap), 'total'),
      BLANK, H('TURNOVER METHOD'),
      R('Projected turnover', col(y => y.sales)),
      R('Working capital requirement (25% of turnover)', col(y => y.wcReqTurnover)),
      R("Borrower's margin (5% of turnover)", col(y => y.sales * 0.05)),
      R('Bank finance (20% of turnover)', col(y => y.mpbfTurnover)),
      R('MPBF – turnover method (lower of bank finance and working capital gap)', col(y => Math.max(0, Math.min(y.mpbfTurnover, y.wcGap))), meth ? 'num' : 'total'),
      BLANK, H('SECOND METHOD OF LENDING'),
      R("Borrower's margin (25% of A)", col(y => 0.25 * y.caExCash)),
      R('MPBF – second method (75% of A – B)', col(y => Math.max(0, y.mpbfTandon2)), meth ? 'total' : 'num'),
      BLANK,
      R(`MPBF adopted (${meth ? 'second method' : 'turnover method'})`, col(y => y.mpbf), 'total'),
      ...(m.hasCC ? [R('Cash credit limit proposed', col(y => y.ccLimit), 'num', { bad: col(y => !y.mpbfOk) }),
        R('Within MPBF?', col(y => y.mpbfOk ? 'Yes' : 'No'), 'text', { bad: col(y => !y.mpbfOk) })] : []),
      R('Net working capital (incl. cash)', col(y => y.nwc)),
    ]});

    const B = m.bench;
    const rr = (label, key, kind, bench) => R(label, col(y => y.ratios[key]), kind, { bad: col(y => !!y.bad[key]), bench });
    out.push({ key: 'ratios', name: 'Ratios', title: 'RATIO ANALYSIS', benchCol: true, rows: [
      H('LIQUIDITY'),
      rr('Current ratio', 'currentRatio', 'ratio', `≥ ${B.currentRatio}`),
      rr('Net working capital to current assets', 'nwcToCa', 'pct', `≥ ${(B.nwcToCa * 100).toFixed(0)}%`),
      H('LEVERAGE'),
      rr('Debt-equity ratio (term + unsecured loans / net worth)', 'debtEquity', 'ratio', `≤ ${B.debtEquity}`),
      rr('Total outside liabilities / tangible net worth', 'tolTnw', 'ratio', `≤ ${B.tolTnw}`),
      rr('Fixed asset coverage ratio (net block / term loans)', 'facr', 'ratio', `≥ ${B.facr}`),
      H('DEBT SERVICE'),
      rr('Debt service coverage ratio (DSCR)', 'dscr', 'ratio', `≥ ${B.dscrYear} (average ≥ ${B.dscrAvg})`),
      rr('Interest coverage ratio', 'icr', 'ratio', `≥ ${B.icr}`),
      H('PROFITABILITY'),
      rr('Gross profit margin', 'gpMargin', 'pct', '> 0'),
      rr('Net profit margin', 'npMargin', 'pct', '> 0'),
      rr('Return on capital employed', 'roce', 'pct', '> 0'),
      rr('Break-even sales as % of turnover', 'bepPct', 'pct', `≤ ${(B.bepPct * 100).toFixed(0)}%`),
      H('TURNOVER'),
      rr('Debtors collection period (days)', 'debtorDays', 'days', ''),
      rr('Creditors payment period (days)', 'creditorDays', 'days', ''),
      rr('Stock holding period (days of purchases)', 'stockDays', 'days', ''),
      BLANK,
      R('Average DSCR', Y.map((y, i) => i === 0 ? m.avgDscr : null), 'ratio', { bad: Y.map((y, i) => i === 0 && m.avgDscr !== null && m.avgDscr < B.dscrAvg) }),
    ], note: 'Benchmarks are typical lender norms and can be changed in the inputs; highlighted figures fall outside them.' });

    out.push({ key: 'dscr', name: 'DSCR', title: 'DEBT SERVICE COVERAGE RATIO (DSCR)', rows: [
      H('CASH ACCRUALS'),
      R('Net profit after tax', col(y => y.pat)), R('Add: Depreciation', col(y => y.dep)), R('Add: Interest on loans', col(y => y.interest)),
      R('Total (A)', col(y => y.pat + y.dep + y.interest), 'total'),
      H('DEBT SERVICE'),
      R('Interest on loans', col(y => y.interest)), R('Repayment of term loans', col(y => y.tlRepay)),
      R('Total (B)', col(y => y.interest + y.tlRepay), 'total'),
      R('DSCR (A / B)', col(y => y.ratios.dscr), 'ratio', { bad: col(y => !!y.bad.dscr) }),
      R('Average DSCR', Y.map((y, i) => i === 0 ? m.avgDscr : null), 'ratio', { bad: Y.map((y, i) => i === 0 && m.avgDscr !== null && m.avgDscr < B.dscrAvg) }),
    ]});

    out.push({ key: 'bep', name: 'Break-even', title: 'BREAK-EVEN ANALYSIS', rows: [
      R('Sales', col(y => y.sales)),
      R('Variable costs (cost of goods sold + administrative & selling)', col(y => y.cogs + y.admin)),
      R('Contribution', col(y => y.sales + y.otherIncome - y.cogs - y.admin), 'total'),
      R('Fixed costs (salaries, fixed expenses, depreciation, interest)', col(y => y.salaries + y.fixedExp + y.dep + y.interest)),
      R('Break-even sales', col(y => y.bepSales)),
      R('Cash break-even sales (excluding depreciation)', col(y => y.cashBepSales)),
      R('Break-even sales as % of turnover', col(y => y.ratios.bepPct), 'pct', { bad: col(y => !!y.bad.bepPct) }),
    ]});
    return out;
  }

  /** Cost of project and means of finance for Year 1 (as in the firm's template). */
  function costOfProject(m) {
    const y = m.years[0];
    const capex = y.capex;
    const wcMargin = Math.max(0, y.wcGap - y.cc);
    const cost = capex + wcMargin;
    const tl = y.tlDisb;
    const own = Math.max(0, cost - tl);
    return { capex, wcGap: y.wcGap, cc: y.cc, wcMargin, cost, tl, own };
  }

  function assumptions(inp, m, unitLabel) {
    const pct = v => `${Number(v) || 0}%`;
    const g = (inp.growth || []).slice(1, m.N).map(v => Number(v) || 0);
    const sameGrowth = g.every(v => v === g[0]);
    const a = [
      `All amounts are ${unitLabel}.`,
      `Turnover for ${m.years[0].label} is taken at ${inp.sales1} and is expected to grow ${sameGrowth ? `by ${g[0] || 0}% every year` : `year on year by ${g.map(pct).join(', ')}`}.`,
      `Purchases are taken at ${pct(inp.purchasePct)} of turnover${Number(inp.directPct) ? ` and other direct expenses at ${pct(inp.directPct)} of turnover` : ''}.`,
      `Stock in trade equal to ${inp.stockDays} days' purchases is held at the end of each year.`,
      `Debtors are collected in ${inp.debtorDays} days and creditors are paid in ${inp.creditorDays} days.`,
      `Salaries and wages are ${inp.salaries1} in the first year, increasing by ${pct(inp.salaryGrowth)} a year; administrative and selling expenses are ${pct(inp.adminPct)} of turnover; rent and other fixed expenses are ${inp.fixedExp1}, increasing by ${pct(inp.fixedGrowth)} a year.`,
      `Depreciation is provided on the written down value method at: ${(inp.blocks || []).map(b => `${b.name} ${b.rate}%`).join(', ') || 'no fixed assets'}.`,
    ];
    if (m.hasCC) a.push(`Cash credit limit of ${inp.cc.mode === 'mpbf' ? 'the MPBF assessed each year' : inp.cc.limit} at ${pct(inp.cc.rate)} p.a., with average utilisation of ${inp.cc.util === '' || inp.cc.util === undefined ? 100 : inp.cc.util}%. MPBF is assessed by the ${m.method === 'tandon2' ? 'second method of lending' : 'turnover method'}.`);
    if (m.hasTL) m.loans.forEach(l => a.push(`${l.name || 'Term loan'}${l.existing ? ' (existing)' : ''}: ${l.amount} at ${pct(l.rate)} p.a., ${l.existing ? `remaining repayment of ${l.repay} months` : `disbursed at the start of Year ${l.startYear}, moratorium of ${l.morat || 0} months and repayment in ${l.repay} months`} by ${l.method === 'emi' ? 'equated monthly instalments' : 'equal monthly principal instalments'}.`));
    a.push(`Provision for tax is made at ${pct(inp.taxRate)} of the profit before tax; no tax is provided in a year of loss.`);
    a.push('Cash & bank balance in the balance sheet is the balancing figure.');
    return a;
  }

  root.FPReport = { statements, costOfProject, assumptions };
})(typeof window !== 'undefined' ? window : globalThis);
