/*
 * EPF and ESI monthly computation, ECR text and ESIC monthly contribution rows.
 * window.PfEsi = { DEFAULTS, compute(state), ecrText(result), esicRows(result), parseWorkingSheet(sheets), REASONS }
 *
 * Every rate and ceiling is a setting (state.settings) so that a change in the law is a change of settings, not code.
 * The EPF wage ceiling is a dated list; when it changes during a wage month (e.g. Rs.15,000 up to 16-09-2026 and
 * Rs.25,000 from 17-09-2026), wages are split by calendar days, as in the firm's working sheet.
 */
(function (root) {
  "use strict";
  const DEFAULTS = {
    est_name: '', pf_code: '', esi_code: '',
    pf_ee: 12, eps: 8.33, admin: 0.5, admin_min: 500, edli: 0.5, edli_admin: 0,
    pf_ceilings: [{ from: '2014-09-01', ceiling: 15000 }, { from: '2026-09-17', ceiling: 25000 }],
    eps_age: 58,
    esi_ceiling: 21000, esi_ee: 0.75, esi_er: 3.25, esi_low_daily: 176, esi_round: 'up', esi_wage_basis: 'actual',
  };
  const REASONS = [['0', 'Without reason'], ['1', 'On leave'], ['2', 'Left service'], ['3', 'Retired'], ['4', 'Out of coverage'], ['5', 'Expired'], ['6', 'Non-implemented area'],
    ['7', 'Compliance by immediate employer'], ['8', 'Suspension of work'], ['9', 'Strike / lockout'], ['10', 'Retrenchment'], ['11', 'No work'], ['12', 'Does not belong to this employer'], ['13', 'Duplicate IP']];
  const LWD_REASONS = ['2', '3', '4', '5', '6', '10'];

  const pad = n => String(n).padStart(2, '0');
  const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const num = v => { const n = Number(String(v ?? '').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
  const r0 = n => Math.round(n + 1e-9);
  const up = n => Math.ceil(n - 1e-9);
  const digits = s => String(s || '').replace(/\D/g, '');

  /* ceiling segments of a wage month: [{days, ceiling}] */
  function segments(ym, list) {
    const D = daysIn(ym), seg = [];
    const sorted = (list || []).slice().sort((a, b) => a.from.localeCompare(b.from));
    const ceilOn = iso => { let c = sorted.length ? sorted[0].ceiling : 15000; sorted.forEach(x => { if (x.from <= iso) c = Number(x.ceiling); }); return c; };
    for (let d = 1; d <= D; d++) {
      const c = ceilOn(`${ym}-${pad(d)}`);
      if (seg.length && seg[seg.length - 1].ceiling === c) seg[seg.length - 1].days++; else seg.push({ days: 1, ceiling: c });
    }
    return { D, seg };
  }
  function ageOn(dob, iso) { if (!dob) return null; const [y, m, d] = dob.split('-').map(Number), [y2, m2, d2] = iso.split('-').map(Number); let a = y2 - y; if (m2 < m || (m2 === m && d2 < d)) a--; return a; }

  function compute(st) {
    const S = Object.assign({}, DEFAULTS, st.settings || {});
    const ym = st.month;
    const { D, seg } = segments(ym, S.pf_ceilings);
    const first = `${ym}-01`;
    const rows = [], issues = [];
    const seenUan = {}, seenIp = {}, aboveCeil = [];
    const capped = W => seg.reduce((a, s) => a + Math.min(W, s.ceiling) * s.days / D, 0);
    (st.employees || []).forEach((e, i) => {
      const name = String(e.name || '').trim(); if (!name) return;
      const who = `${name}${e.emp_id ? ' (' + e.emp_id + ')' : ''}`;
      const gross = num(e.gross), W = e.pf_wage === '' || e.pf_wage === undefined ? gross : num(e.pf_wage);
      const ncp = Math.min(D, Math.max(0, Math.round(num(e.ncp))));
      const r = { i, emp_id: e.emp_id || '', name, uan: digits(e.uan), ip: digits(e.ip), dept: e.dept || '', desig: e.desig || '', gross: r0(gross), ncp, D };
      /* ---- EPF ---- */
      r.pf = e.pf_applicable !== false;
      if (r.pf) {
        const age = ageOn(e.dob, first);
        const epsOn = e.eps_member !== false && !(age !== null && age >= S.eps_age);
        r.epfW = r0(e.higher_pf ? W : capped(W));
        r.epsW = epsOn ? r0(capped(W)) : 0;
        r.edliW = r0(capped(W));
        r.ee = r0(r.epfW * S.pf_ee / 100);
        r.epsC = r0(r.epsW * S.eps / 100);
        r.erDiff = r0(r.epfW * S.pf_ee / 100) - r.epsC;
        r.refund = r0(num(e.refund));
        if (!r.uan) issues.push(['err', `${who}: UAN missing – register the employee on the EPFO portal (PF is applicable).`]);
        else if (r.uan.length !== 12) issues.push(['err', `${who}: the UAN must have 12 digits (${e.uan}).`]);
        else if (seenUan[r.uan]) issues.push(['err', `${who}: UAN ${r.uan} is repeated (also ${seenUan[r.uan]}).`]); else seenUan[r.uan] = who;
        if (age !== null && age >= S.eps_age && e.eps_member !== false) issues.push(['warn', `${who}: aged ${age} – EPS contribution stopped at ${S.eps_age}; the employer's full share goes to EPF.`]);
        if (W > 0 && r.epfW === 0) issues.push(['warn', `${who}: EPF wages are nil.`]);
      }
      /* ---- ESI ---- */
      const daysKnown = !(e.esi_days === '' || e.esi_days === undefined) || ncp > 0;
      const esiDays = e.esi_days === '' || e.esi_days === undefined ? D - ncp : Math.round(num(e.esi_days));
      let esiOn;
      if (e.esi === 'yes') esiOn = true; else if (e.esi === 'no') esiOn = false; else esiOn = !!r.ip && gross <= S.esi_ceiling;
      r.esi = esiOn; r.esiDays = esiDays;
      const esiCap = esiOn && S.esi_wage_basis === 'ceiling' && gross > S.esi_ceiling;
      const esiWage = esiCap ? S.esi_ceiling : gross;
      r.esiW = esiOn ? r0(esiWage) : 0; r.esiCapped = esiCap;
      if (esiOn) {
        const rnd = S.esi_round === 'up' ? up : r0;
        const low = daysKnown && esiDays > 0 && gross / esiDays <= S.esi_low_daily;
        if (!daysKnown && gross / D <= S.esi_low_daily) issues.push(['warn', `${who}: wages are low for a full month – enter the days paid to check the Rs.${S.esi_low_daily} average daily wage rule (employee's share is nil at or below it).`]);
        r.esiEE = low ? 0 : rnd(esiWage * S.esi_ee / 100);
        r.esiER = rnd(esiWage * S.esi_er / 100);
        r.lowWage = low;
        r.reason = esiDays === 0 ? String(e.reason || '0') : '';
        r.lwd = r.reason && LWD_REASONS.includes(r.reason) ? (e.lwd || '') : '';
        if (!r.ip) issues.push(['err', `${who}: ESI IP number missing – register the employee on the ESIC portal.`]);
        else if (r.ip.length !== 10) issues.push(['err', `${who}: the ESI IP number must have 10 digits (${e.ip}).`]);
        else if (seenIp[r.ip]) issues.push(['err', `${who}: IP number ${r.ip} is repeated (also ${seenIp[r.ip]}).`]); else seenIp[r.ip] = who;
        if (gross > S.esi_ceiling) aboveCeil.push(name);
        if (r.reason && LWD_REASONS.includes(r.reason) && !r.lwd) issues.push(['err', `${who}: enter the last working day (needed for reason code ${r.reason}).`]);
        if (low) issues.push(['info', `${who}: average daily wage is Rs.${S.esi_low_daily} or less – employee's share is nil, employer pays its share.`]);
      } else if (e.esi !== 'no' && gross > 0 && gross <= S.esi_ceiling && !r.ip) issues.push(['err', `${who}: gross is within the ESI ceiling but there is no IP number – register on the ESIC portal, or mark ESI as not applicable.`]);
      else if (e.esi !== 'yes' && r.ip && gross > S.esi_ceiling) issues.push(['info', `${who}: gross above the ESI ceiling – treated as not covered. If the employee was covered at the start of the current contribution period, set ESI to "Yes".`]);
      if (ncp > 0 && ncp >= D) issues.push(['warn', `${who}: NCP days equal the days in the month.`]);
      rows.push(r);
    });
    if (aboveCeil.length && S.esi_wage_basis === 'ceiling') issues.push(['warn', `ESI wages restricted to Rs.${S.esi_ceiling.toLocaleString('en-IN')} (setting chosen) for ${aboveCeil.length} employee(s): ${aboveCeil.join(', ')}. The ESI Act has no wage ceiling for contributions – an employee covered for the contribution period contributes on the actual wages. Use this only where you have a basis for it.`]);
    if (aboveCeil.length) issues.push(['info', `ESI continued for ${aboveCeil.length} employee(s) whose gross is above Rs.${S.esi_ceiling.toLocaleString('en-IN')}: ${aboveCeil.join(', ')}. This is correct only till the end of the contribution period (April–September / October–March) in which they were covered; from the next period they go out of coverage.`]);
    const sum = (k, f) => rows.filter(f || (() => true)).reduce((a, r) => a + (r[k] || 0), 0);
    const pfRows = rows.filter(r => r.pf), esiRows = rows.filter(r => r.esi);
    const epfWT = sum('epfW', r => r.pf), edliWT = sum('edliW', r => r.pf);
    const t = {
      members: pfRows.length, gross: sum('gross', r => r.pf), epfW: epfWT, epsW: sum('epsW', r => r.pf), edliW: edliWT,
      ee: sum('ee', r => r.pf), eps: sum('epsC', r => r.pf), er: sum('erDiff', r => r.pf), refund: sum('refund', r => r.pf),
      admin: pfRows.length ? Math.max(r0(epfWT * S.admin / 100), S.admin_min) : 0, edli: r0(edliWT * S.edli / 100), edliAdmin: r0(edliWT * S.edli_admin / 100),
      esiMembers: esiRows.length, esiW: sum('esiW', r => r.esi), esiEE: sum('esiEE', r => r.esi), esiER: sum('esiER', r => r.esi),
    };
    t.ac1 = t.ee + t.er; t.ac2 = t.admin; t.ac10 = t.eps; t.ac21 = t.edli; t.ac22 = t.edliAdmin;
    t.pfTotal = t.ac1 + t.ac2 + t.ac10 + t.ac21 + t.ac22; t.esiTotal = t.esiEE + t.esiER;
    return { S, ym, D, seg, rows, issues, t };
  }

  /* ECR 2.0: one line per member, 11 fields separated by #~# */
  function ecrText(res) {
    return res.rows.filter(r => r.pf).map(r => [r.uan, r.name.toUpperCase().replace(/#~#/g, ' '), r.gross, r.epfW, r.epsW, r.edliW, r.ee, r.epsC, r.erDiff, r.ncp, r.refund].join('#~#')).join('\n');
  }
  const ECR_HEAD = ['UAN', 'Member Name', 'Gross Wages', 'EPF Wages', 'EPS Wages', 'EDLI Wages', 'EPF Contribution remitted (EE share)', 'EPS Contribution remitted', 'EPF EPS Difference remitted (ER share)', 'NCP Days', 'Refund of Advances'];
  const ESIC_HEAD = ['IP Number', 'IP Name', 'No of Days for which wages paid/payable during the month', 'Total Monthly Wages', 'Reason Code for Zero workings days(numeric only; provide 0 for all other reasons- Click on the link for reference)', 'Last Working Day'];
  function esicRows(res) {
    return [ESIC_HEAD].concat(res.rows.filter(r => r.esi).map(r => [r.ip, r.name.toUpperCase(), String(r.esiDays), String(r.esiW), r.esiDays === 0 ? r.reason || '0' : '', r.lwd ? r.lwd.split('-').reverse().join('/') : '']));
  }

  /* Reads the firm's salary working sheet (headers such as "Employee ID", "Employee Name", "Member ID(ESI)", "UAN No(PF)",
     "Gross Salary", "Master Gross - Basic+DA", "ESI - 0.75% Employee Contribution"). Returns { employees, sheet, warnings }. */
  function parseWorkingSheet(sheets, S) {
    const str = v => v === undefined || v === null ? '' : (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(v)) : String(v).trim());
    const dateIso = v => { if (v === undefined || v === null || v === '') return ''; if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5).toISOString().slice(0, 10);
      const m = String(v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; const m2 = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m2 ? m2[0] : ''; };
    const colOf = ref => ref.replace(/\d+$/, ''), rowOf = ref => +ref.replace(/^[A-Z]+/, '');
    for (const [sheetName, cells] of Object.entries(sheets)) {
      // find a header row with UAN and Name
      const byRow = {};
      Object.keys(cells).forEach(ref => { const r = rowOf(ref); (byRow[r] = byRow[r] || {})[colOf(ref)] = cells[ref]; });
      const hr = Object.keys(byRow).map(Number).sort((a, b) => a - b).find(r => { const v = Object.values(byRow[r]).map(str).join('|'); return /uan/i.test(v) && /name/i.test(v); });
      if (!hr) continue;
      const H = byRow[hr]; const find = (re, not) => { const k = Object.keys(H).find(c => re.test(str(H[c])) && !(not && not.test(str(H[c])))); return k; };
      const col = {
        emp_id: find(/employee\s*id|emp\.?\s*(id|code)/i), name: find(/employee\s*name|^name$/i), ip: find(/member\s*id\s*\(?esi|ip\s*(no|number)|esi\s*(no|number)/i), uan: find(/uan/i),
        dept: find(/department/i), desig: find(/designation/i),
        gross: find(/^\s*gross\s*salary\s*$/i) || find(/gross/i, /goal|ctc/i), pf_wage: find(/basic\s*\+\s*da|basic.*da|pf\s*wage.*master|^\s*basic/i),
        esi_ee: find(/esi.*employee/i), ncp: find(/ncp|lop\s*days|loss of pay/i), days: find(/days\s*(worked|paid|present)/i), dob: find(/date of birth|dob/i),
        esi_app: find(/esi\s*applicable/i), eps: find(/eps\s*member/i), higher: find(/higher\s*wages/i), pf_app: find(/pf\s*applicable/i), reason: find(/reason\s*code/i), lwd: find(/last\s*working/i), refund: find(/refund/i),
      };
      if (!col.name || !col.uan) continue;
      const employees = [], warnings = [];
      Object.keys(byRow).map(Number).filter(r => r > hr).sort((a, b) => a - b).forEach(r => {
        const R = byRow[r]; const name = str(R[col.name]);
        if (!name || /^total/i.test(name)) return;
        if (typeof R[col.gross] !== 'number' && typeof R[col.pf_wage] !== 'number') return;
        const esiEE = col.esi_ee ? R[col.esi_ee] : undefined;
        employees.push({ emp_id: str(R[col.emp_id]), name, ip: digits(str(R[col.ip])), uan: digits(str(R[col.uan])), dept: str(R[col.dept]).trim(), desig: str(R[col.desig]),
          gross: col.gross ? Math.round(Number(R[col.gross]) || 0) : '', pf_wage: col.pf_wage ? Math.round((Number(R[col.pf_wage]) || 0) * 100) / 100 : '',
          ncp: col.ncp ? Math.round(Number(R[col.ncp]) || 0) : 0, esi_days: col.days ? Math.round(Number(R[col.days]) || 0) : '',
          esi: col.esi_app ? (/^y/i.test(str(R[col.esi_app])) ? 'yes' : /^n/i.test(str(R[col.esi_app])) ? 'no' : 'auto') : esiEE === undefined ? 'auto' : (Number(esiEE) > 0 ? 'yes' : 'no'),
          eps_member: col.eps ? !/^n/i.test(str(R[col.eps])) : true, higher_pf: col.higher ? /^y/i.test(str(R[col.higher])) : false, pf_applicable: col.pf_app ? !/^n/i.test(str(R[col.pf_app])) : true,
          refund: col.refund ? Math.round(Number(R[col.refund]) || 0) : 0, reason: col.reason ? str(R[col.reason]) : '', lwd: col.lwd ? dateIso(R[col.lwd]) : '', dob: col.dob ? dateIso(R[col.dob]) : '' });
      });
      if (!col.pf_wage) warnings.push('No "Basic + DA" column found – PF wages are taken as the gross salary. Check the PF wages column.');
      if (!col.esi_ee) warnings.push('No ESI contribution column found – ESI applicability is decided by the IP number and the ESI ceiling.');
      if (!col.ncp) warnings.push('No NCP / LOP days column found – NCP days are taken as 0.');
      return { employees, sheet: sheetName, headerRow: hr, columns: col, warnings };
    }
    return null;
  }

  root.PfEsi = { DEFAULTS, REASONS, LWD_REASONS, compute, ecrText, esicRows, ECR_HEAD, ESIC_HEAD, parseWorkingSheet, segments, daysIn };
})(typeof window !== 'undefined' ? window : globalThis);
