/*
 * Exchange rate for tax purposes – which rate, on which date, and why.
 * window.FxRules = { PURPOSES, resolve(input, lookup), helpers }
 *
 * Income-tax Act, 2025 / Income-tax Rules, 2026:
 *   Rule 206 – income accruing / received in foreign currency: SBI TT buying rate on the "specified date" (Table, Sl. 1–6);
 *              Rule 206(2)(b)(ii) – income payable in foreign currency with TDS: date tax was required to be deducted;
 *              Rule 206(3) – Sl. 3 income received / brought into India before the specified date: Rule 206(1) does not apply.
 *   Rule 207 – TDS on income payable in foreign currency (to a person outside India / IFSC unit): SBI TT buying rate on the
 *              date tax is required to be deducted; if not published that day, the last published rate.
 *   ICDS VI  – business income of a person keeping accounts in rupees: rate on the date of the transaction; monetary items
 *              (receivables / payables) restated at the closing rate at the end of the year.
 * CGST Rules, 2017, rule 34:
 *   (1) goods – rate notified by the Board under section 14 of the Customs Act, 1962, for the date of time of supply (section 12);
 *   (2) services – rate determined as per generally accepted accounting principles for the date of time of supply (section 13).
 */
(function (root) {
  "use strict";
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const dmy = s => s ? s.split('-').reverse().join('-') : '';
  const lastDayPrevMonth = s => { const d = D(s); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))); };
  const taxYearEnd = s => { const d = D(s); const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() + 1 : d.getUTCFullYear(); return `${y}-03-31`; };
  const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const earlier = (...xs) => xs.filter(Boolean).sort()[0] || '';
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthOf = s => { const d = D(s); return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

  /* fields: which inputs a purpose needs */
  const PURPOSES = [
    { id: 'it_icds', law: 'IT', label: 'Business / professional income of a resident keeping accounts in rupees (e.g. export of services or goods)', fields: ['txn_date'], side: 'buy' },
    { id: 'it_206_1', law: 'IT', label: 'Salary received in foreign currency – Rule 206, Table Sl. 1', fields: ['event_date'], event: 'Month in which the salary is due / paid in advance / arrears (any date in that month)' },
    { id: 'it_206_2', law: 'IT', label: 'Interest on securities – Rule 206, Table Sl. 2', fields: ['event_date'], event: 'Month in which the income is due (any date in that month)' },
    { id: 'it_206_3', law: 'IT', label: 'House property / business or profession / other sources (not dividends or interest on securities) in foreign currency – Rule 206, Table Sl. 3', fields: ['event_date', 'brought_date'], event: 'Any date in the tax year of the income' },
    { id: 'it_206_4', law: 'IT', label: 'Non-resident engaged in operation of ships – Rule 206, Table Sl. 4', fields: ['event_date'], event: 'Month in which the income is deemed to arise in India (any date in that month)' },
    { id: 'it_206_5', law: 'IT', label: 'Dividends – Rule 206, Table Sl. 5', fields: ['event_date'], event: 'Month in which the dividend is declared, distributed or paid (any date in that month)' },
    { id: 'it_206_6', law: 'IT', label: 'Capital gains – Rule 206, Table Sl. 6', fields: ['event_date'], event: 'Month in which the capital asset is transferred (any date in that month)' },
    { id: 'it_206_tds', law: 'IT', label: 'Income payable in foreign currency from which tax was deducted at source – Rule 206(2)(b)(ii)', fields: ['credit_date', 'pay_date'] },
    { id: 'it_207', law: 'IT', label: 'TDS on income payable in foreign currency (to a person outside India / IFSC unit) – Rule 207', fields: ['credit_date', 'pay_date'] },
    { id: 'gst_svc_exp', law: 'GST', label: 'Export of services (zero-rated) – rule 34(2), time of supply under section 13', fields: ['inv_date', 'supply_date', 'pay_date'], side: 'buy' },
    { id: 'gst_svc_imp', law: 'GST', label: 'Import of services (reverse charge) – rule 34(2), time of supply under section 13(3)', fields: ['inv_date', 'pay_date'], side: 'sell' },
    { id: 'gst_goods_exp', law: 'GST', label: 'Export of goods – rule 34(1): CBIC notified rate (export) for the date of time of supply (section 12)', fields: ['inv_date'], customs: 'export' },
    { id: 'gst_goods_imp', law: 'GST', label: 'Import of goods – rule 34(1): CBIC notified rate (import) for the date of time of supply / bill of entry', fields: ['inv_date'], customs: 'import' },
  ];

  /* lookup(currency, date) -> { rate, date, col } using the archive; finds the last published rate on or before date */
  function resolve(inp, lookup) {
    const P = PURPOSES.find(p => p.id === inp.purpose);
    if (!P) return { error: 'Choose the nature of the transaction.' };
    const steps = [], notes = [];
    let basis = '', date = '', rateKind = 'tt_buy', fallback = 'last', source = 'sbi';
    const need = (k, label) => { if (!inp[k]) throw new Error(`Enter the ${label}.`); return inp[k]; };
    try {
      switch (P.id) {
        case 'it_icds': {
          date = need('txn_date', 'date of the transaction');
          basis = 'ICDS VI (Foreign Currency Transactions): a foreign currency transaction is recorded on initial recognition at the exchange rate at the date of the transaction (an average rate for a week or month may be used if rates do not fluctuate significantly). A receivable / payable outstanding at the end of the tax year is restated at the closing rate, and the difference is income or expenditure of that year.';
          steps.push(`Date of the transaction: ${dmy(date)}.`);
          steps.push(`Year-end restatement (if still outstanding): closing rate as on ${dmy(taxYearEnd(date))} – see "Realisation and year end" below.`);
          notes.push('Rule 206 (SBI TT buying rate on the last day of the tax year) applies where the income itself is expressed in foreign currency (e.g. a foreign branch keeping accounts in foreign currency). For a resident whose accounts are in rupees, income is computed from the accounts under ICDS VI. Choose the Rule 206 option if that is the case.');
          notes.push('ICDS does not prescribe the source of the rate. The SBI TT buying rate is shown as a consistent, verifiable rate; the rate actually adopted in the books may also be used.');
          rateKind = 'tt_buy'; fallback = 'last'; break;
        }
        case 'it_206_1': case 'it_206_2': case 'it_206_4': case 'it_206_5': case 'it_206_6': {
          const ev = need('event_date', 'date (month) of the event');
          date = lastDayPrevMonth(ev);
          const sl = P.id.slice(-1);
          basis = `Rule 206(1) read with Rule 206(2)(b)(i), Table Sl. ${sl}: SBI telegraphic transfer buying rate as on the specified date – the last day of the month immediately preceding the month of the event.`;
          steps.push(`Month of the event: ${monthOf(ev)}.`, `Specified date: last day of the immediately preceding month = ${dmy(date)}.`);
          break;
        }
        case 'it_206_3': {
          const ev = need('event_date', 'date (tax year) of the income');
          date = taxYearEnd(ev);
          basis = 'Rule 206(1) read with Rule 206(2)(b)(i), Table Sl. 3: SBI telegraphic transfer buying rate as on the last day of the tax year of the assessee.';
          steps.push(`Tax year: ${D(date).getUTCFullYear() - 1}-${String(D(date).getUTCFullYear()).slice(2)}.`, `Specified date: last day of the tax year = ${dmy(date)}.`);
          if (inp.brought_date && inp.brought_date < date) {
            steps.push(`Received in / brought into India on ${dmy(inp.brought_date)}, before the specified date.`);
            notes.push('Rule 206(3): Rule 206(1) does not apply to Sl. 3 income received in, or brought into, India before the specified date. The rupee value actually realised is taken; the SBI TT buying rate on the date of receipt is shown for reference. (Rule 206(3) still refers to the Foreign Exchange Regulation Act, 1973.)');
            date = inp.brought_date; basis += ' Rule 206(3) applies – see note.';
          }
          break;
        }
        case 'it_206_tds': case 'it_207': {
          const c = inp.credit_date, p = inp.pay_date;
          if (!c && !p) throw new Error('Enter the date of credit to the payee\'s account and / or the date of payment.');
          date = earlier(c, p);
          steps.push(`Tax is required to be deducted at the time of credit or payment, whichever is earlier: ${c ? 'credit ' + dmy(c) : ''}${c && p ? ', ' : ''}${p ? 'payment ' + dmy(p) : ''} → ${dmy(date)}.`);
          basis = P.id === 'it_207'
            ? 'Rule 207(1): SBI telegraphic transfer buying rate as on the date on which tax is required to be deducted under Chapter XIX-B; where the rate is not published on that date, the last such published rate.'
            : 'Rule 206(2)(b)(ii): for income payable in foreign currency from which tax has been deducted at source under Rule 207, the specified date is the date on which tax was required to be deducted under Chapter XIX-B.';
          if (P.id === 'it_206_tds') notes.push('Rule 206(2)(b)(ii) as notified reads "income referred to in sub-clause (ii)"; it is read here as referring to the income in sub-clause (i).');
          break;
        }
        case 'gst_svc_exp': case 'gst_svc_imp': {
          const inv = inp.inv_date, sup = inp.supply_date, pay = inp.pay_date;
          if (P.id === 'gst_svc_exp') {
            if (!inv && !sup && !pay) throw new Error('Enter the invoice date, and the date of payment if received in advance.');
            const within = inp.inv_in_time !== false;
            if (within) { date = earlier(inv, pay); steps.push(`Invoice issued within the period prescribed under section 31: time of supply is the earlier of the invoice date${inv ? ' (' + dmy(inv) + ')' : ''} and the date of receipt of payment${pay ? ' (' + dmy(pay) + ')' : ''} – section 13(2)(a).`); }
            else { date = earlier(sup, pay); steps.push(`Invoice not issued within the prescribed period: time of supply is the earlier of the date of provision of service${sup ? ' (' + dmy(sup) + ')' : ''} and the date of receipt of payment${pay ? ' (' + dmy(pay) + ')' : ''} – section 13(2)(b).`); }
            notes.push('Date of receipt of payment is the earlier of the date of entry in the books and the date of credit in the bank account (Explanation to section 13(2)).');
            notes.push('The rupee value realised later (bank advice / FIRC) does not change the value of supply; the difference is an exchange gain or loss in the books.');
          } else {
            if (!inv && !pay) throw new Error('Enter the date of the supplier\'s invoice and / or the date of payment.');
            const sixty = inv ? addDays(inv, 60) : '';
            date = earlier(pay, sixty);
            steps.push(`Reverse charge: time of supply is the earlier of the date of payment${pay ? ' (' + dmy(pay) + ')' : ''} and the date immediately after 60 days from the supplier's invoice${sixty ? ' (' + dmy(sixty) + ')' : ''} – section 13(3).`);
            notes.push('Where the supplier is located outside India and the recipient is an associated enterprise, section 13(3) has a further proviso (date of entry in the books / date of payment) – check if applicable.');
          }
          basis = 'CGST Rules, rule 34(2): the rate of exchange determined as per generally accepted accounting principles for the date of time of supply of the services in terms of section 13 of the CGST Act. (The Customs notified rate applies only to goods.)';
          rateKind = P.side === 'sell' ? 'tt_sell' : 'tt_buy';
          notes.push(`GAAP (AS 11 / Ind AS 21) requires the spot rate on the transaction date but does not name a source. The SBI TT ${P.side === 'sell' ? 'selling' : 'buying'} rate is shown; use the rate consistently adopted in the books if different.`);
          break;
        }
        case 'gst_goods_exp': case 'gst_goods_imp': {
          date = need('inv_date', P.id === 'gst_goods_exp' ? 'invoice date (time of supply)' : 'date of the bill of entry / time of supply');
          basis = `CGST Rules, rule 34(1): the rate of exchange notified by the Board under section 14 of the Customs Act, 1962, for the date of time of supply of the goods in terms of section 12 of the CGST Act (CBIC ${P.customs} rate).`;
          steps.push(`Time of supply: ${dmy(date)}.`, `Rate: CBIC notified ${P.customs} rate in force on ${dmy(date)} (notifications are issued periodically and remain in force until superseded).`);
          source = 'customs'; rateKind = 'customs_' + P.customs; fallback = 'none';
          break;
        }
      }
    } catch (e) { return { error: e.message }; }
    let found = null;
    if (source === 'sbi' && lookup && inp.currency) {
      found = lookup(inp.currency, date, rateKind);
      if (found && found.date !== date) {
        const why = P.id === 'it_207' ? 'Rule 207(1): rate not published on that date – the last published rate is taken.'
          : P.law === 'IT' && P.id.startsWith('it_206') ? 'Rate not published on the specified date. Rule 206 is silent; the last published rate before that date is taken, consistent with the proviso in Rule 207(1).'
          : 'Rate not published on that date – the last published rate before it is taken.';
        steps.push(`The archive shows no SBI rate for ${dmy(date)}; the last published rate is of ${dmy(found.date)}. ${why}`);
        if (found.gaps && found.gaps.length) notes.unshift(`Check: the archive has no rate for ${found.gaps.map(dmy).join(', ')} – ${found.gaps.length > 1 ? 'weekdays' : 'a weekday'}. SBI may have published a rate that the archive does not have. Verify with the SBI publication; if a rate was published for ${dmy(date)}${found.gaps[0] !== date ? ' or a later skipped date' : ''}, enter it below (it overrides the fallback).`);
      }
    }
    return { P, basis, date, rateKind, source, steps, notes, found };
  }

  root.FxRules = { PURPOSES, resolve, helpers: { dmy, lastDayPrevMonth, taxYearEnd, addDays, earlier, monthOf, iso, D } };
})(typeof window !== 'undefined' ? window : globalThis);
