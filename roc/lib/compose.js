/*
 * ROC compliance – content of the documents (Companies Act, 2013).
 * window.RocCompose = { EVENTS, FIELDS, blank(), docs(st), reqText(st), steps(st), checks(st), dates(st) }
 *
 * Event 1: Appointment of a Director in a Private Limited Company
 *   (a) as Additional Director by the Board – s.161(1), regularised at the next general meeting – s.152(2);  or
 *   (b) directly at a general meeting – s.152(2).
 * Every document is a list of blocks for templates/roc_doc.docx (title, sub, h, p, pl, pb, res, n, n2, note, kv, t3, t4, t5, sign, space, brk).
 * The wording follows the Act and the Companies (Appointment and Qualification of Directors) Rules, 2014 / Companies
 * (Meetings of Board and its Powers) Rules, 2014; the user is asked to check it against the current text and the forms on the MCA portal.
 */
(function (root) {
  "use strict";
  const EVENTS = [
    { id: 'appoint-director', label: 'Appointment of a Director – Private Limited Company', ready: true },
    { id: 'resign-director', label: 'Resignation of a Director (coming)', ready: false },
    { id: 'change-ro', label: 'Change of registered office (coming)', ready: false },
    { id: 'allotment', label: 'Allotment of shares (coming)', ready: false },
    { id: 'auditor', label: 'Appointment of auditor (coming)', ready: false },
  ];

  /* fields of the case: [key, label, section, type, options] – used by the form on screen and the Excel template */
  const FIELDS = [
    ['co.name', 'Name of the company', 'Company', 'text'], ['co.cin', 'CIN', 'Company', 'text'], ['co.regd', 'Registered office address', 'Company', 'textarea'],
    ['co.email', 'E-mail of the company', 'Company', 'text'], ['co.phone', 'Phone', 'Company', 'text'], ['co.roc', 'Registrar of Companies (e.g. RoC Chennai)', 'Company', 'text'],
    ['co.fyEnd', 'Financial year ends on (DD-MM)', 'Company', 'text'],
    ['mode', 'Manner of appointment', 'Appointment', 'select', [['additional', 'Additional Director by the Board – s.161(1), regularised at the next general meeting'], ['general', 'Director appointed at a general meeting – s.152(2)']]],
    ['dir.designation', 'Category', 'Appointment', 'select', [['Non-Executive', 'Non-Executive Director'], ['Executive', 'Executive Director']]],
    ['dir.capacity', 'Capacity', 'Appointment', 'select', [['Professional', 'Professional'], ['Promoter', 'Promoter'], ['Nominee', 'Nominee']]],
    ['dir.appointDate', 'Date of appointment (DD-MM-YYYY)', 'Appointment', 'date'],
    ['bm.date', 'Board meeting – date (DD-MM-YYYY)', 'Board meeting', 'date'], ['bm.time', 'Board meeting – time (e.g. 11.00 a.m.)', 'Board meeting', 'text'],
    ['bm.venue', 'Board meeting – venue', 'Board meeting', 'textarea'], ['bm.noticeDate', 'Date of notice of the Board meeting (DD-MM-YYYY)', 'Board meeting', 'date'],
    ['bm.chair', 'Chairman of the meeting', 'Board meeting', 'text'], ['bm.present', 'Directors present (separate by commas)', 'Board meeting', 'text'],
    ['gm.type', 'General meeting', 'General meeting', 'select', [['AGM', 'Annual General Meeting'], ['EGM', 'Extra-ordinary General Meeting']]],
    ['gm.no', 'Number of the AGM (e.g. 5th)', 'General meeting', 'text'], ['gm.date', 'General meeting – date (DD-MM-YYYY)', 'General meeting', 'date'],
    ['gm.time', 'General meeting – time', 'General meeting', 'text'], ['gm.venue', 'General meeting – venue', 'General meeting', 'textarea'],
    ['gm.noticeDate', 'Date of notice of the general meeting (DD-MM-YYYY)', 'General meeting', 'date'], ['gm.item', 'Item number in the notice', 'General meeting', 'text'],
    ['dir.salutation', 'Mr / Ms / Mrs / Dr', 'Director', 'select', [['Mr.', 'Mr.'], ['Ms.', 'Ms.'], ['Mrs.', 'Mrs.'], ['Dr.', 'Dr.']]],
    ['dir.name', 'Full name of the director', 'Director', 'text'], ['dir.hasDin', 'Has a DIN?', 'Director', 'select', [['yes', 'Yes'], ['no', 'No – DIN to be applied for (DIR-3)']]],
    ['dir.din', 'DIN', 'Director', 'text'], ['dir.father', "Father's name", 'Director', 'text'], ['dir.dob', 'Date of birth (DD-MM-YYYY)', 'Director', 'date'],
    ['dir.nationality', 'Nationality', 'Director', 'text'], ['dir.pan', 'PAN', 'Director', 'text'], ['dir.address', 'Residential address', 'Director', 'textarea'],
    ['dir.email', 'E-mail', 'Director', 'text'], ['dir.mobile', 'Mobile', 'Director', 'text'], ['dir.occupation', 'Occupation', 'Director', 'text'],
    ['dir.qualification', 'Educational qualification', 'Director', 'text'], ['dir.membership', 'Membership / certificate of practice no. (if a member of a professional institute)', 'Director', 'text'],
    ['dir.otherCount', 'Number of companies in which already a director', 'Director', 'text'], ['dir.otherKey', 'Of these, companies where MD / CEO / WTD / CS / CFO / Manager', 'Director', 'text'],
    ['sign.name', 'Director signing the certified copies and filing DIR-12 – name', 'Signatory', 'text'], ['sign.din', 'Signing director – DIN', 'Signatory', 'text'],
    ['sign.place', 'Place (for signatures)', 'Signatory', 'text'],
  ];

  function blank() {
    return { kind: 'roc-case', event: 'appoint-director', mode: 'additional', letterhead: true,
      co: { name: '', cin: '', regd: '', email: '', phone: '', roc: '', fyEnd: '31-03' },
      bm: { date: '', time: '', venue: '', noticeDate: '', chair: '', present: '' },
      gm: { type: 'AGM', no: '', date: '', time: '', venue: '', noticeDate: '', item: '' },
      dir: { salutation: 'Mr.', name: '', hasDin: 'yes', din: '', father: '', dob: '', nationality: 'Indian', pan: '', address: '', email: '', mobile: '', occupation: '', qualification: '', membership: '', otherCount: '', otherKey: '', designation: 'Non-Executive', capacity: 'Professional', appointDate: '', interests: [] },
      sign: { name: '', din: '', place: '' } };
  }

  /* ---------- helpers ---------- */
  const v = x => (x === undefined || x === null) ? '' : String(x).trim();
  const or = (x, d) => v(x) || d;
  const blankLine = '____________';
  const isoOf = s => { const m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(v(s)); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (/^\d{4}-\d{2}-\d{2}$/.test(v(s)) ? v(s) : ''); };
  const dmy = s => { const i = isoOf(s); return i ? i.split('-').reverse().join('-') : (v(s) || blankLine); };
  const addDays = (s, n) => { const i = isoOf(s); if (!i) return ''; const d = new Date(i + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10).split('-').reverse().join('-'); };
  const longDate = s => { const i = isoOf(s); if (!i) return v(s) || blankLine; const d = new Date(i + 'T00:00:00Z'); const day = d.getUTCDate(), sfx = (day % 10 === 1 && day !== 11) ? 'st' : (day % 10 === 2 && day !== 12) ? 'nd' : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
    return `${day}${sfx} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()]}, ${d.getUTCFullYear()}`; };
  const he = st => /^(Ms|Mrs)/i.test(st.dir.salutation) ? ['she', 'her', 'her'] : /^(Mr)/i.test(st.dir.salutation) ? ['he', 'his', 'him'] : ['he/she', 'his/her', 'him/her'];
  const dname = st => `${v(st.dir.salutation)} ${or(st.dir.name, '[Name of the director]')}`.trim();
  const din = st => st.dir.hasDin === 'no' ? 'DIN applied for' : or(st.dir.din, '[DIN]');
  const coName = st => or(st.co.name, '[Name of the company]');
  const coU = st => coName(st).toUpperCase();
  const isAdd = st => st.mode !== 'general';
  const desig = st => isAdd(st) ? `Additional Director (${st.dir.designation})` : `Director (${st.dir.designation})`;
  const signer = st => ({ name: or(st.sign.name, '[Name of the signing director]').toUpperCase(), din: or(st.sign.din, '[DIN]') });

  /* the next AGM due date: within six months from the close of the financial year (s.96(1)) – first one on or after the appointment */
  function agmDue(st) {
    const i = isoOf(st.dir.appointDate) || isoOf(st.bm.date); if (!i) return '';
    const [dd, mm] = (v(st.co.fyEnd) || '31-03').split(/[-\/]/).map(Number);
    let y = +i.slice(0, 4);
    for (let k = 0; k < 3; k++) { const fy = y - 1 + k, m0 = (mm || 3) - 1 + 6, last = new Date(Date.UTC(fy, m0 + 1, 0)).getUTCDate(); const due = new Date(Date.UTC(fy, m0, Math.min(dd || 31, last)));
      const dIso = due.toISOString().slice(0, 10); if (dIso >= i) return dIso.split('-').reverse().join('-'); }
    return '';
  }
  function dates(st) {
    const appt = isoOf(st.dir.appointDate) || isoOf(isAdd(st) ? st.bm.date : st.gm.date);
    return { appt: appt ? appt.split('-').reverse().join('-') : '', dir12: appt ? addDays(appt, 30) : '', agm: agmDue(st), bmNoticeBy: isoOf(st.bm.date) ? addDays(st.bm.date, -7) : '',
      gmNoticeBy: isoOf(st.gm.date) ? addDays(st.gm.date, -22) : '', regDir12: isoOf(st.gm.date) ? addDays(st.gm.date, 30) : '' };
  }

  /* letter-head line */
  const lh = st => ({ lh_name: coU(st), lh_line: `CIN: ${or(st.co.cin, '[CIN]')}  |  Registered office: ${or(st.co.regd, '[Registered office]').replace(/\s*\n\s*/g, ', ')}`, lh_line2: [v(st.co.email) && `E-mail: ${v(st.co.email)}`, v(st.co.phone) && `Phone: ${v(st.co.phone)}`].filter(Boolean).join('  |  ') || ' ' });
  const T = t => ({ title: [{ text: t }] }), S = t => ({ sub: [{ text: t }] }), H = t => ({ h: [{ text: t }] }), P = t => ({ p: [{ text: t }] }), PL = t => ({ pl: [{ text: t }] }), PB = t => ({ pb: [{ text: t }] }),
    R = t => ({ res: [{ text: t }] }), N = (num, t) => ({ n: [{ num, text: t }] }), N2 = (num, t) => ({ n2: [{ num, text: t }] }), NOTE = t => ({ note: [{ text: t }] }), SP = () => ({ space: [{}] }),
    KV = rows => ({ kv: [{ rows: rows.map(([k, val]) => ({ k, v: val === '' || val === undefined ? '—' : String(val) })) }] }),
    T3 = (h, rows) => ({ t3: [{ h1: h[0], h2: h[1], h3: h[2], rows: rows.map(r => ({ c1: r[0], c2: r[1], c3: r[2] })) }] }),
    T4 = (h, rows) => ({ t4: [{ h1: h[0], h2: h[1], h3: h[2], h4: h[3], rows: rows.map(r => ({ c1: r[0], c2: r[1], c3: r[2], c4: r[3] })) }] }),
    T5 = (h, rows) => ({ t5: [{ h1: h[0], h2: h[1], h3: h[2], h4: h[3], h5: h[4], rows: rows.map(r => ({ c1: r[0], c2: r[1], c3: r[2], c4: r[3], c5: r[4] })) }] }),
    SIGN = (for_line, name, line1, line2) => ({ sign: [{ for_line, name, line1: line1 || '', line2: line2 || '' }] });
  const placeDate = (st, d) => [PL(`Place: ${or(st.sign.place, blankLine)}`), PL(`Date: ${d ? dmy(d) : blankLine}`)];
  const forCo = (st, label) => { const s = signer(st); return SIGN(`For ${coU(st)}`, s.name, label || 'Director', `DIN: ${s.din}`); };
  const dirRows = st => { const L = (st.dir.interests || []).filter(x => v(x.name) && /director/i.test(v(x.nature)));
    return L.length ? L.map((x, i) => [String(i + 1), v(x.name), or(x.cin, '—'), x.date ? dmy(x.date) : '—', or(x.ceased, '—')]) : [['1', 'NIL', '—', '—', '—']]; };
  const interestsRows = st => { const L = (st.dir.interests || []).filter(x => v(x.name)); return L.length ? L.map((x, i) => [String(i + 1), `${v(x.name)}${v(x.cin) ? ' (' + v(x.cin) + ')' : ''}`, or(x.nature, '—'), or(x.share, '—'), x.date ? dmy(x.date) : '—']) : [['1', 'NIL', '—', '—', '—']]; };

  /* ================= the documents ================= */
  function docs(st) {
    const D = dates(st), [hs, his, him] = he(st), s = signer(st), out = [];
    const add = (id, title, file, blocks, opts = {}) => out.push(Object.assign({ id, title, file, blocks, lh: false }, opts));

    // 1. information and documents required from the client
    add('reqlist', 'Information and documents required (for the client)', 'Requirements_list', reqBlocks(st), { group: 'Client' });

    // 2. procedure and timeline
    add('procedure', 'Procedure and timeline (office checklist)', 'Procedure_and_checklist', [T('APPOINTMENT OF A DIRECTOR – PROCEDURE AND CHECKLIST'), S(`${coName(st)} · ${dname(st)} · ${isAdd(st) ? 'Additional Director appointed by the Board' : 'Appointment at a general meeting'}`),
      T5(['No.', 'Step', 'Provision', 'Due by', 'Done on'], steps(st).map((x, i) => [String(i + 1), x.step, x.law, x.due || '', ''])),
      NOTE('Prepared from the Companies Act, 2013 and the rules under it as understood by the office; check against the current text of the Act, the Rules, the Articles of the company and the e-forms on the MCA portal before filing.')], { group: 'Office' });

    if (st.dir.hasDin === 'no') add('dir3', 'DIN application (DIR-3) – data sheet', 'DIR-3_data_sheet', [T('APPLICATION FOR DIN – DATA FOR FORM DIR-3'), S('[Section 153 of the Companies Act, 2013 and rule 9 of the Companies (Appointment and Qualification of Directors) Rules, 2014]'),
      KV([['Name of the applicant', or(st.dir.name, '')], ["Father's name", st.dir.father], ['Date of birth', dmy(st.dir.dob)], ['Nationality', st.dir.nationality], ['Income-tax PAN', st.dir.pan], ['Residential address', st.dir.address], ['E-mail', st.dir.email], ['Mobile', st.dir.mobile], ['Occupation', st.dir.occupation], ['Educational qualification', st.dir.qualification], ['Company in which to be appointed', `${coName(st)} (${or(st.co.cin, 'CIN')})`]]),
      H('Attachments'), N('1.', 'Photograph of the applicant.'), N('2.', 'Proof of identity (PAN card; for a foreign national, passport).'), N('3.', 'Proof of residential address (not older than two months for documents such as bank statements / utility bills).'),
      N('4.', 'Digital signature certificate of the applicant; verification by a director / company secretary of the company in which the applicant is to be appointed, as required in the form.'),
      NOTE('The applicant is to be appointed only after the DIN is allotted (s.152(3)). Check the attachments and verification required in DIR-3 on the MCA portal.')], { group: 'Office' });

    if (isAdd(st)) {
      // 3. notice of the Board meeting
      add('bm_notice', 'Notice of the Board meeting with agenda', 'Board_meeting_notice', [T('NOTICE OF MEETING OF THE BOARD OF DIRECTORS'), PL(`Date: ${dmy(st.bm.noticeDate)}`), PL('To'), PL('The Directors of the Company'), SP(),
        P(`Notice is hereby given that a meeting of the Board of Directors of ${coU(st)} will be held on ${longDate(st.bm.date)} at ${or(st.bm.time, blankLine)} at ${or(st.bm.venue, v(st.co.regd) || blankLine).replace(/\s*\n\s*/g, ', ')} to transact the business set out in the agenda below.`),
        H('AGENDA'), N('1.', 'To elect the Chairman of the meeting.'), N('2.', 'To grant leave of absence, if any.'), N('3.', 'To confirm the minutes of the previous meeting of the Board.'),
        N('4.', `To appoint ${dname(st)} (DIN: ${din(st)}) as an Additional Director of the Company.`), N('5.', `To take note of the disclosure of interest (Form MBP-1) and the declaration of non-disqualification (Form DIR-8) of ${dname(st)}.`),
        N('6.', 'To authorise a Director to file the return in Form DIR-12 with the Registrar of Companies and to make entries in the statutory registers.'), N('7.', 'Any other business with the permission of the Chair.'),
        SP(), forCo(st), NOTE('Notice of not less than seven days to every director (s.173(3)); a meeting at shorter notice is subject to the conditions of the proviso to s.173(3).')], { lh: true, group: 'Board meeting' });
    }
    // 4. DIR-2 consent
    add('dir2', 'Consent to act as a director – Form DIR-2', 'DIR-2_consent', [T('FORM No. DIR-2'), S('[Pursuant to section 152(5) and rule 8 of the Companies (Appointment and Qualification of Directors) Rules, 2014]'), T('CONSENT TO ACT AS A DIRECTOR OF A COMPANY'), SP(),
      PL('To'), PL('The Board of Directors'), PL(coU(st)), PL(or(st.co.regd, '[Registered office]')), SP(),
      PL(`Subject: Consent to act as a Director`), P(`I, ${or(st.dir.name, blankLine)}, hereby give my consent to act as a Director of ${coU(st)} pursuant to sub-section (5) of section 152 of the Companies Act, 2013 and certify that I am not disqualified to become a director under the Companies Act, 2013.`),
      P('I hereby furnish the following particulars:'),
      T3(['S. No.', 'Particulars', 'Details'], [['1', 'Director Identification Number (DIN)', din(st)], ['2', 'Name (in full)', or(st.dir.name, '')], ["3", "Father's name (in full)", or(st.dir.father, '')], ['4', 'Address', or(st.dir.address, '')], ['5', 'E-mail id', or(st.dir.email, '')],
        ['6', 'Mobile no.', or(st.dir.mobile, '')], ['7', 'Income-tax PAN', or(st.dir.pan, '').toUpperCase()], ['8', 'Occupation', or(st.dir.occupation, '')], ['9', 'Date of birth', dmy(st.dir.dob)], ['10', 'Nationality', or(st.dir.nationality, '')],
        ['11', 'No. of companies in which I am already a Director, and of them the companies in which I am Managing Director, CEO, Whole-time Director, Secretary, CFO or Manager', `${or(st.dir.otherCount, '0')}${v(st.dir.otherKey) ? ' – ' + v(st.dir.otherKey) : ''}`],
        ['12', 'Particulars of membership No. and Certificate of practice No., if a member of a professional institute', or(st.dir.membership, 'Not applicable')]]),
      PL('Attachments: (1) proof of identity; (2) proof of residence.'), SP(), SIGN('', (or(st.dir.name, '[Name]')).toUpperCase(), `DIN: ${din(st)}`, ''), ...placeDate(st, isAdd(st) ? st.bm.date : st.gm.date),
      NOTE('Check the layout against Form DIR-2 as notified. The consent is filed with the Registrar in Form DIR-12 within thirty days of the appointment (rule 8).')], { group: 'Director' });
    // 5. DIR-8 declaration
    add('dir8', 'Declaration of non-disqualification – Form DIR-8', 'DIR-8_declaration', [T('FORM No. DIR-8'), S('[Pursuant to section 164(2) and rule 14(1) of the Companies (Appointment and Qualification of Directors) Rules, 2014]'), T('INTIMATION BY DIRECTOR'), SP(),
      PL('To'), PL('The Board of Directors'), PL(coU(st)), PL(or(st.co.regd, '[Registered office]')), SP(),
      P(`I, ${or(st.dir.name, blankLine)}, son/daughter/spouse of ${or(st.dir.father, blankLine)}, resident of ${or(st.dir.address, blankLine).replace(/\s*\n\s*/g, ', ')}, ${isAdd(st) ? 'proposed to be appointed as' : 'proposed to be appointed as'} a Director of ${coU(st)} (the Company), hereby give notice that I am/was a director in the following companies during the last three years:`),
      T5(['S. No.', 'Name of the company', 'CIN', 'Date of appointment', 'Date of cessation'], dirRows(st)),
      P('I further confirm that I have not incurred any disqualification under section 164(2) of the Companies Act, 2013, being a director of a company which has not filed its financial statements or annual returns for any continuous period of three financial years, or which has failed to repay its deposits or interest, redeem its debentures or pay interest or dividend declared for one year or more.'),
      P(`I also confirm that I am not otherwise disqualified under section 164(1) of the Companies Act, 2013 from being appointed as a director.`),
      SP(), SIGN('', (or(st.dir.name, '[Name]')).toUpperCase(), `DIN: ${din(st)}`, ''), ...placeDate(st, isAdd(st) ? st.bm.date : st.gm.date), NOTE('Check the wording against Form DIR-8 as notified.')], { group: 'Director' });
    // 6. MBP-1
    add('mbp1', 'Disclosure of interest – Form MBP-1', 'MBP-1_disclosure', [T('FORM No. MBP-1'), S('[Pursuant to section 184(1) and rule 9(1) of the Companies (Meetings of Board and its Powers) Rules, 2014]'), T('NOTICE OF INTEREST BY DIRECTOR'), SP(),
      PL('To'), PL('The Board of Directors'), PL(coU(st)), PL(or(st.co.regd, '[Registered office]')), SP(),
      P(`Dear Sirs, I, ${or(st.dir.name, blankLine)}, son/daughter/spouse of ${or(st.dir.father, blankLine)}, resident of ${or(st.dir.address, blankLine).replace(/\s*\n\s*/g, ', ')}, being a director in the Company, hereby give notice of my interest or concern in the following company or companies, bodies corporate, firms or other association of individuals:`),
      T5(['S. No.', 'Names of the companies / bodies corporate / firms / association of individuals', 'Nature of interest or concern', 'Shareholding', 'Date on which interest or concern arose'], interestsRows(st)),
      SP(), SIGN('', (or(st.dir.name, '[Name]')).toUpperCase(), `DIN: ${din(st)}`, ''), ...placeDate(st, isAdd(st) ? st.bm.date : st.gm.date),
      NOTE('Given at the first meeting of the Board in which the director participates, at the first Board meeting of every financial year and whenever there is a change (s.184(1)).')], { group: 'Director' });

    if (isAdd(st)) {
      // 7. certified true copy of the Board resolution
      add('bm_res', 'Certified true copy of the Board resolution', 'Board_resolution_CTC', [T('CERTIFIED TRUE COPY OF THE RESOLUTIONS PASSED AT THE MEETING OF THE BOARD OF DIRECTORS'),
        S(`of ${coU(st)} held on ${longDate(st.bm.date)} at ${or(st.bm.time, blankLine)} at ${or(st.bm.venue, v(st.co.regd) || blankLine).replace(/\s*\n\s*/g, ', ')}`),
        PB(`Appointment of ${dname(st)} as an Additional Director`),
        R(`"RESOLVED THAT pursuant to the provisions of section 161(1) and other applicable provisions, if any, of the Companies Act, 2013 read with the Companies (Appointment and Qualification of Directors) Rules, 2014 (including any statutory modification or re-enactment thereof for the time being in force) and the Articles of Association of the Company, ${dname(st)} (DIN: ${din(st)}), who has given ${his} consent to act as a Director in Form DIR-2 and a declaration in Form DIR-8 that ${hs} is not disqualified from being appointed as a Director, be and is hereby appointed as an Additional Director (${st.dir.designation}) of the Company with effect from ${longDate(st.dir.appointDate || st.bm.date)}, to hold office up to the date of the next Annual General Meeting of the Company or the last date on which the Annual General Meeting should have been held, whichever is earlier."`),
        R(`"RESOLVED FURTHER THAT the Board takes note of the disclosure of interest in Form MBP-1 and the intimation in Form DIR-8 received from ${dname(st)}."`),
        R(`"RESOLVED FURTHER THAT ${or(st.sign.name, 'any Director')}${v(st.sign.din) ? ` (DIN: ${v(st.sign.din)})` : ''}, Director of the Company, be and is hereby authorised to sign and file the return in Form DIR-12 with the Registrar of Companies, ${or(st.co.roc, blankLine)}, to make the necessary entries in the Register of Directors and Key Managerial Personnel, to issue certified copies of this resolution and to do all such acts, deeds and things as may be necessary to give effect to this resolution."`),
        SP(), PB('Certified true copy'), forCo(st), NOTE('To be printed on the letter-head of the company.')], { lh: true, group: 'Board meeting' });
      // 8. draft minutes (extract)
      add('bm_minutes', 'Draft minutes – item of appointment', 'Board_minutes_extract', [T('EXTRACT OF THE MINUTES OF THE MEETING OF THE BOARD OF DIRECTORS'), S(`of ${coU(st)} held on ${longDate(st.bm.date)} at ${or(st.bm.time, blankLine)}`),
        KV([['Present', or(st.bm.present, blankLine)], ['Chairman', or(st.bm.chair, blankLine)]]),
        PB(`Appointment of ${dname(st)} as an Additional Director`),
        P(`The Chairman informed the Board that ${dname(st)} (DIN: ${din(st)}) has given ${his} consent in Form DIR-2 to act as a Director of the Company and an intimation in Form DIR-8 that ${hs} is not disqualified under section 164 of the Companies Act, 2013, and that the Articles of Association of the Company empower the Board to appoint an Additional Director. After discussion, the Board passed the following resolutions:`),
        R(`"RESOLVED THAT pursuant to section 161(1) of the Companies Act, 2013 and the Articles of Association of the Company, ${dname(st)} (DIN: ${din(st)}) be and is hereby appointed as an Additional Director (${st.dir.designation}) of the Company with effect from ${longDate(st.dir.appointDate || st.bm.date)}, to hold office up to the date of the next Annual General Meeting."`),
        R(`"RESOLVED FURTHER THAT ${or(st.sign.name, 'any Director')} be and is hereby authorised to file Form DIR-12 with the Registrar of Companies and to make the entries in the statutory registers."`),
        P(`${dname(st)} joined the meeting thereafter and gave ${his} disclosure of interest in Form MBP-1, which was taken on record.`), SP(), PL('Chairman'), NOTE('Adapt to the actual proceedings; minutes are to be prepared and signed within the time in s.118 and the Secretarial Standard on Meetings of the Board.')], { group: 'Board meeting' });
    }
    // 9. letter of appointment
    add('appt_letter', 'Letter of appointment to the director', 'Letter_of_appointment', [PL(`Date: ${dmy(D.appt)}`), SP(), PL('To'), PL(dname(st)), PL(or(st.dir.address, '[Address]')), SP(), PB(`Subject: Appointment as ${isAdd(st) ? 'an Additional Director' : 'a Director'} of ${coU(st)}`),
      P(`We are pleased to inform you that ${isAdd(st) ? `the Board of Directors of the Company, at its meeting held on ${longDate(st.bm.date)}, has appointed you as an Additional Director (${st.dir.designation}) of the Company with effect from ${longDate(st.dir.appointDate || st.bm.date)} under section 161(1) of the Companies Act, 2013. You will hold office up to the date of the next Annual General Meeting of the Company, at which your appointment as a Director is proposed to be considered by the members.` : `the members of the Company, at the ${or(st.gm.type, 'general meeting')} held on ${longDate(st.gm.date)}, have appointed you as a Director (${st.dir.designation}) of the Company under section 152 of the Companies Act, 2013.`}`),
      P('We request you to give your disclosure of interest in Form MBP-1 whenever there is a change in your interests, and at the first meeting of the Board in every financial year, and to keep your DIN particulars and KYC up to date.'),
      P('Kindly sign and return the duplicate of this letter in token of your acceptance.'), SP(), forCo(st), SP(), PB('Accepted'), SIGN('', (or(st.dir.name, '[Name]')).toUpperCase(), `DIN: ${din(st)}`, '')], { lh: true, group: 'Director' });

    // 10. general meeting – notice with explanatory statement, and CTC of the resolution
    const gmTitle = `${v(st.gm.no) ? v(st.gm.no) + ' ' : ''}${st.gm.type === 'EGM' ? 'EXTRA-ORDINARY GENERAL MEETING' : 'ANNUAL GENERAL MEETING'}`;
    const gmResText = isAdd(st)
      ? `"RESOLVED THAT pursuant to the provisions of section 152 and other applicable provisions, if any, of the Companies Act, 2013 and the rules made thereunder (including any statutory modification or re-enactment thereof for the time being in force), ${dname(st)} (DIN: ${din(st)}), who was appointed as an Additional Director of the Company by the Board of Directors with effect from ${longDate(st.dir.appointDate || st.bm.date)} under section 161(1) of the Act and who holds office up to the date of this meeting, and who has given ${his} consent in Form DIR-2 to act as a Director, be and is hereby appointed as a Director (${st.dir.designation}) of the Company."`
      : `"RESOLVED THAT pursuant to the provisions of section 152 and other applicable provisions, if any, of the Companies Act, 2013 and the rules made thereunder (including any statutory modification or re-enactment thereof for the time being in force), ${dname(st)} (DIN: ${din(st)}), who has given ${his} consent in Form DIR-2 to act as a Director and an intimation in Form DIR-8 that ${hs} is not disqualified, be and is hereby appointed as a Director (${st.dir.designation}) of the Company with effect from ${longDate(st.dir.appointDate || st.gm.date)}."`;
    const gmResFurther = `"RESOLVED FURTHER THAT ${or(st.sign.name, 'any Director')} of the Company be and is hereby authorised to file the necessary forms with the Registrar of Companies, ${or(st.co.roc, blankLine)}, and to do all such acts, deeds and things as may be necessary to give effect to this resolution."`;
    add('gm_notice', `Notice of the ${st.gm.type === 'EGM' ? 'EGM' : 'AGM'} – item with explanatory statement`, `${st.gm.type || 'AGM'}_notice_item`, [T(`NOTICE OF THE ${gmTitle}`), PL(`Date: ${dmy(st.gm.noticeDate)}`), SP(),
      P(`NOTICE is hereby given that the ${gmTitle.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())} of the members of ${coU(st)} will be held on ${longDate(st.gm.date)} at ${or(st.gm.time, blankLine)} at ${or(st.gm.venue, v(st.co.regd) || blankLine).replace(/\s*\n\s*/g, ', ')} to transact the following business:`),
      PB('SPECIAL BUSINESS'), PB(`Item No. ${or(st.gm.item, blankLine)}: Appointment of ${dname(st)} as a Director`), P('To consider and, if thought fit, to pass, with or without modification(s), the following resolution as an Ordinary Resolution:'), R(gmResText), R(gmResFurther),
      SP(), PL('By order of the Board'), forCo(st),
      H('NOTES'), N('1.', 'A member entitled to attend and vote at the meeting is entitled to appoint a proxy to attend and vote instead of himself / herself, and the proxy need not be a member of the Company. The instrument appointing a proxy should be deposited at the registered office not less than 48 hours before the meeting (s.105).'),
      N('2.', 'The explanatory statement under section 102 of the Companies Act, 2013 in respect of the special business is annexed.'),
      H('EXPLANATORY STATEMENT UNDER SECTION 102 OF THE COMPANIES ACT, 2013'), PB(`Item No. ${or(st.gm.item, blankLine)}`),
      P(isAdd(st) ? `${dname(st)} (DIN: ${din(st)}) was appointed as an Additional Director of the Company by the Board of Directors with effect from ${longDate(st.dir.appointDate || st.bm.date)} under section 161(1) of the Companies Act, 2013 and the Articles of Association of the Company, and holds office up to the date of this meeting. ${hs.replace(/^./, c => c.toUpperCase())} has given ${his} consent to act as a Director in Form DIR-2 and an intimation in Form DIR-8 that ${hs} is not disqualified from being appointed as a Director. The Board considers that ${his} association will be of benefit to the Company and recommends the Ordinary Resolution set out at Item No. ${or(st.gm.item, blankLine)} for the approval of the members.`
        : `The Board of Directors proposes the appointment of ${dname(st)} (DIN: ${din(st)}) as a Director of the Company. ${hs.replace(/^./, c => c.toUpperCase())} has given ${his} consent to act as a Director in Form DIR-2 and an intimation in Form DIR-8 that ${hs} is not disqualified from being appointed as a Director. The Board recommends the Ordinary Resolution set out at Item No. ${or(st.gm.item, blankLine)} for the approval of the members.`),
      P(`Brief profile: ${dname(st)}, aged ${age(st.dir.dob) || blankLine} years, ${or(st.dir.qualification, '[qualification]')}, ${or(st.dir.occupation, '[occupation]')}.`),
      P(`None of the Directors or Key Managerial Personnel of the Company or their relatives, other than ${dname(st)}, is concerned or interested, financially or otherwise, in the resolution.`),
      NOTE('Notice of at least twenty-one clear days (s.101(1)), or shorter notice with the consent of the members as provided in the proviso. Section 160 does not apply to a private company (exemption notification for private companies dated 05-06-2015) – check the Articles.')], { lh: true, group: 'General meeting' });
    add('gm_res', `Certified true copy of the ${st.gm.type === 'EGM' ? 'EGM' : 'AGM'} resolution`, `${st.gm.type || 'AGM'}_resolution_CTC`, [T(`CERTIFIED TRUE COPY OF THE ORDINARY RESOLUTION PASSED AT THE ${gmTitle}`), S(`of the members of ${coU(st)} held on ${longDate(st.gm.date)} at ${or(st.gm.time, blankLine)} at ${or(st.gm.venue, v(st.co.regd) || blankLine).replace(/\s*\n\s*/g, ', ')}`),
      PB(`Appointment of ${dname(st)} as a Director`), R(gmResText), R(gmResFurther), SP(), PB('Certified true copy'), forCo(st)], { lh: true, group: 'General meeting' });

    // 11. DIR-12 data sheet
    const dir12 = (label, desigNow, dateChange, attach) => [H(label),
      KV([['CIN', st.co.cin], ['Name of the company', coName(st)], ['Registered office', st.co.regd], ['E-mail of the company', st.co.email], ['Purpose', 'Appointment / change in designation of a director'],
        ['DIN', din(st)], ['Name', st.dir.name], ["Father's name", st.dir.father], ['Date of birth', dmy(st.dir.dob)], ['Nationality', st.dir.nationality], ['PAN', v(st.dir.pan).toUpperCase()], ['Residential address', st.dir.address], ['E-mail / mobile', [v(st.dir.email), v(st.dir.mobile)].filter(Boolean).join(' / ')],
        ['Designation', desigNow], ['Category', `${st.dir.designation}; ${st.dir.capacity}`], ['Date of appointment / change in designation', dmy(dateChange)], ['Appointed / regularised by', label.includes('regularisation') ? `Members – ${st.gm.type} on ${dmy(st.gm.date)}` : (isAdd(st) ? `Board of Directors – meeting on ${dmy(st.bm.date)}` : `Members – ${st.gm.type} on ${dmy(st.gm.date)}`)],
        ['Occupation / qualification', [v(st.dir.occupation), v(st.dir.qualification)].filter(Boolean).join(' / ')], ['Membership no. (if any)', st.dir.membership],
        ['Due date of filing (30 days)', addDays(dateChange, 30)], ['Signed by', `${s.name} (DIN: ${s.din}), authorised by the Board resolution dated ${dmy(st.bm.date || st.gm.date)}`]]),
      H('Attachments'), ...attach.map((a, i) => N(`${i + 1}.`, a))];
    add('dir12', 'DIR-12 – data sheet for the e-form', 'DIR-12_data_sheet', [T('FORM DIR-12 – PARTICULARS OF APPOINTMENT OF DIRECTOR'), S('[Section 170(2) of the Companies Act, 2013 and rule 18 of the Companies (Appointment and Qualification of Directors) Rules, 2014] – data sheet for filling the e-form on the MCA portal'),
      ...dir12(isAdd(st) ? 'A. On appointment as Additional Director' : 'A. On appointment as Director', desig(st), st.dir.appointDate || (isAdd(st) ? st.bm.date : st.gm.date),
        ['Consent of the director in Form DIR-2 (signed).', isAdd(st) ? 'Letter of appointment / certified true copy of the Board resolution.' : 'Certified true copy of the resolution of the members, with the notice and explanatory statement.', 'Interest in other entities – Form MBP-1.', 'Any other document (optional).']),
      ...(isAdd(st) ? [SP(), ...dir12('B. On regularisation at the general meeting (change in designation)', `Director (${st.dir.designation})`, st.gm.date, ['Certified true copy of the resolution of the members, with the notice and explanatory statement.', 'Any other document (optional).'])] : []),
      NOTE('The e-form is filed on the MCA portal; field names there may differ – use this sheet to fill it. Fees as per the Companies (Registration Offices and Fees) Rules, 2014 based on the nominal share capital. Check on the portal before filing.')], { group: 'Filing' });

    // 12. register of directors and KMP
    add('register', 'Register of Directors and KMP – entry', 'Register_of_directors_entry', [T('REGISTER OF DIRECTORS AND KEY MANAGERIAL PERSONNEL – PARTICULARS'), S('[Section 170(1) of the Companies Act, 2013 and rule 17 of the Companies (Appointment and Qualification of Directors) Rules, 2014]'),
      KV([['DIN', din(st)], ['Present name and former name, if any', st.dir.name], ["Father's / mother's / spouse's name", st.dir.father], ['Date of birth', dmy(st.dir.dob)], ['Residential address (present and permanent)', st.dir.address], ['Nationality', st.dir.nationality], ['Occupation', st.dir.occupation],
        ['Date of the Board resolution / members\' resolution of appointment', dmy(isAdd(st) ? st.bm.date : st.gm.date)], ['Date of appointment', dmy(st.dir.appointDate || (isAdd(st) ? st.bm.date : st.gm.date))], ['Designation', desig(st)], ['Date of regularisation / change in designation', isAdd(st) ? dmy(st.gm.date) : '—'],
        ['Date of cessation and reasons', '—'], ['Office of director / KMP held in other companies', (st.dir.interests || []).filter(x => v(x.name)).map(x => `${v(x.name)} – ${or(x.nature, '')}`).join('; ') || 'NIL'], ['PAN', v(st.dir.pan).toUpperCase()], ['E-mail', st.dir.email]]),
      NOTE('Enter in the register kept at the registered office; check the particulars against rule 17 for the full list.')], { group: 'Filing' });
    return out;
  }

  const age = dob => { const i = isoOf(dob); if (!i) return ''; const b = new Date(i + 'T00:00:00Z'), n = new Date(); let a = n.getUTCFullYear() - b.getUTCFullYear(); if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--; return a > 0 ? String(a) : ''; };

  /* ---------- procedure, with due dates ---------- */
  function steps(st) {
    const D = dates(st), L = [];
    const p = (step, law, due) => L.push({ step, law, due });
    p('Check that the Articles of Association permit the Board to appoint an additional director' + (isAdd(st) ? '' : ' / the appointment at the general meeting'), isAdd(st) ? 's.161(1)' : 's.152(2); Articles', '');
    p('Check that the proposed director is not disqualified and is within the limit of directorships (20 companies)', 's.164, s.165', '');
    if (st.dir.hasDin === 'no') p('Apply for DIN in Form DIR-3 (the person is appointed only after the DIN is allotted)', 's.152(3), s.153, rule 9', '');
    else p('Check the DIN status on the MCA portal (active; KYC of the director up to date)', 's.154; rule 12A', '');
    p('Obtain the consent in Form DIR-2 and the intimation in Form DIR-8 from the proposed director before the appointment', 's.152(5), rule 8; s.164(2), rule 14(1)', isAdd(st) ? dmy(st.bm.date) : dmy(st.gm.date));
    if (isAdd(st)) {
      p('Send the notice of the Board meeting with the agenda to every director (at least 7 days)', 's.173(3)', D.bmNoticeBy);
      p('Hold the Board meeting – resolution appointing the Additional Director; authority to file DIR-12', 's.161(1), s.179', dmy(st.bm.date));
      p('Disclosure of interest in Form MBP-1 at the first Board meeting in which the director participates', 's.184(1), rule 9(1)', dmy(st.bm.date));
      p('Prepare and sign the minutes of the Board meeting', 's.118', st.bm.date ? addDays(st.bm.date, 30) : '');
    }
    p('File Form DIR-12 with the Registrar, with DIR-2, the resolution / appointment letter and MBP-1', 's.170(2), rule 18; rule 8', D.dir12);
    p('Enter the particulars in the Register of Directors and KMP', 's.170(1), rule 17', D.dir12);
    p('Issue the letter of appointment to the director', 'Good practice', D.appt);
    if (isAdd(st)) {
      p('Regularise the appointment at the next Annual General Meeting (or earlier at an EGM) by an Ordinary Resolution; notice of 21 clear days with explanatory statement', 's.161(1), s.152(2), s.101, s.102', D.agm ? `AGM due by ${D.agm}` : '');
      p('File Form DIR-12 for the change in designation (Additional Director to Director) within 30 days of the general meeting', 's.170(2), rule 18', D.regDir12);
    } else {
      p('Send the notice of the general meeting with the explanatory statement (21 clear days, or shorter notice with consent)', 's.101, s.102', D.gmNoticeBy);
      p('Hold the general meeting – Ordinary Resolution for the appointment', 's.152(2)', dmy(st.gm.date));
    }
    p('Disclose the appointment in the Board\'s report for the year', 's.134(3); rule 8(5)(iii) of the Companies (Accounts) Rules, 2014', '');
    return L;
  }

  /* ---------- information and documents required from the client ---------- */
  function reqItems(st) {
    const A = [], add = (sec, items) => A.push({ sec, items });
    add('About the company', ['Certified copy / soft copy of the Articles of Association (to check the power to appoint directors)', 'CIN, registered office address and e-mail id of the company', 'List of present directors with DIN', 'Date of the last Annual General Meeting and of the last Board meeting']);
    add('About the meeting', isAdd(st) ? ['Proposed date, time and venue of the Board meeting', 'Name of the director who will chair the meeting and of the directors who will attend', 'Name and DIN of the director who will sign the certified copies and file the form (with an active DSC)']
      : ['Proposed date, time and venue of the general meeting (AGM / EGM)', 'Name and DIN of the director who will sign the notice and file the form (with an active DSC)']);
    add('About the proposed director', [st.dir.hasDin === 'no' ? 'The person does not have a DIN – for the DIN application: PAN card, proof of address (not older than two months for bills / statements), passport-size photograph, mobile number and e-mail id (for OTP verification), and a Class 3 DSC – check the current DIR-3 requirements' : 'DIN of the proposed director (and confirmation that the DIN KYC is up to date)',
      "Full name, father's name, date of birth, nationality, occupation and educational qualification", 'Residential address, e-mail id and mobile number', 'Copy of PAN card (proof of identity) and proof of residence',
      'Membership / certificate of practice number, if a member of a professional institute', 'List of other companies, LLPs, firms and bodies in which the person is a director, partner or member, with the nature of interest, shareholding and date (for Form MBP-1 and DIR-8)',
      'Category: executive / non-executive; promoter / professional / nominee']);
    add('Documents we will send for signature', ['Form DIR-2 – consent to act as a director (signed by the proposed director)', 'Form DIR-8 – intimation of non-disqualification (signed by the proposed director)', 'Form MBP-1 – disclosure of interest (signed by the director at the Board meeting)',
      isAdd(st) ? 'Notice of the Board meeting and the certified true copy of the resolution (signed by a director)' : 'Notice of the general meeting with the explanatory statement and the certified true copy of the resolution (signed by a director)', 'Letter of appointment (signed for the company and accepted by the director)']);
    return A;
  }
  function reqBlocks(st) {
    const items = reqItems(st), out = [T('INFORMATION AND DOCUMENTS REQUIRED'), S(`Appointment of a Director – ${coName(st)}`), P(`For the appointment of ${v(st.dir.name) ? dname(st) : 'the proposed director'} as ${isAdd(st) ? 'an Additional Director by the Board of Directors' : 'a Director at the general meeting'}, kindly provide the following:`)];
    let k = 0;
    items.forEach(s => { out.push(H(s.sec)); s.items.forEach(t => out.push(N(`${++k}.`, t))); });
    out.push(P('Scanned copies may be sent by e-mail; the signed forms are to be returned in original or as signed scans, as advised.'));
    return out;
  }
  function reqText(st) {
    const items = reqItems(st); let k = 0;
    return [`Information and documents required – Appointment of a Director – ${coName(st)}`, '',
      `For the appointment of ${v(st.dir.name) ? dname(st) : 'the proposed director'} as ${isAdd(st) ? 'an Additional Director by the Board of Directors' : 'a Director at the general meeting'}, kindly provide the following:`, '',
      ...items.flatMap(s => [s.sec.toUpperCase(), ...s.items.map(t => `${++k}. ${t}`), '']), 'Scanned copies may be sent by e-mail; the signed forms are to be returned in original or as signed scans, as advised.'].join('\n');
  }

  /* ---------- checks ---------- */
  function checks(st) {
    const out = [], w = (k, t) => out.push([k, t]), D = dates(st);
    if (!v(st.co.name)) w('err', 'Enter the name of the company.');
    if (v(st.co.cin) && !/^[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/i.test(v(st.co.cin))) w('warn', `CIN "${v(st.co.cin)}" does not look like a 21-character CIN.`);
    if (!v(st.dir.name)) w('err', 'Enter the name of the proposed director.');
    if (st.dir.hasDin !== 'no' && v(st.dir.din) && !/^\d{8}$/.test(v(st.dir.din))) w('warn', 'DIN should have 8 digits.');
    if (st.dir.hasDin !== 'no' && !v(st.dir.din)) w('warn', 'Enter the DIN of the proposed director, or choose "No – DIN to be applied for".');
    if (st.dir.hasDin === 'no') w('info', 'The person can be appointed only after the DIN is allotted (s.152(3)) – the DIR-3 data sheet is included.');
    if (v(st.dir.pan) && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(v(st.dir.pan))) w('warn', 'PAN does not look right (5 letters, 4 digits, 1 letter).');
    if (isAdd(st) && !isoOf(st.bm.date)) w('warn', 'Enter the date of the Board meeting.');
    if (!isAdd(st) && !isoOf(st.gm.date)) w('warn', 'Enter the date of the general meeting.');
    if (isAdd(st) && isoOf(st.bm.date) && isoOf(st.bm.noticeDate)) { const gap = (new Date(isoOf(st.bm.date)) - new Date(isoOf(st.bm.noticeDate))) / 864e5; if (gap < 7) w('warn', `The notice of the Board meeting is only ${gap} day(s) before the meeting – s.173(3) requires not less than seven days (or the shorter-notice conditions).`); }
    if (isoOf(st.gm.date) && isoOf(st.gm.noticeDate)) { const gap = (new Date(isoOf(st.gm.date)) - new Date(isoOf(st.gm.noticeDate))) / 864e5 - 1; if (gap < 21) w('warn', `The notice of the general meeting gives ${gap} clear day(s) – s.101 requires twenty-one clear days, unless shorter notice is consented to.`); }
    if (isAdd(st) && isoOf(st.dir.appointDate) && isoOf(st.bm.date) && isoOf(st.dir.appointDate) < isoOf(st.bm.date)) w('err', 'The date of appointment is before the Board meeting.');
    if (D.dir12) { const left = Math.round((new Date(isoOf(D.dir12)) - new Date(new Date().toISOString().slice(0, 10))) / 864e5); if (left < 0) w('err', `DIR-12 was due by ${D.dir12} (30 days from the appointment) – ${-left} day(s) ago; additional fees apply.`); else w('info', `DIR-12 is due by ${D.dir12} (${left} day(s) left).`); }
    if (isAdd(st) && D.agm) w('info', `The Additional Director holds office up to the next AGM – due by ${D.agm} (six months from the close of the financial year, s.96(1)); regularise by then.`);
    if (+v(st.dir.otherCount) >= 20) w('err', 'The person is already a director in 20 or more companies – limit under s.165(1).');
    if (!v(st.sign.name)) w('warn', 'Enter the director who will sign the certified copies and file DIR-12.');
    if (/^Executive$/.test(st.dir.designation)) w('info', 'For a Managing Director / Whole-time Director, the requirements of sections 196, 197 and 203 and Schedule V also apply – not covered by these documents.');
    if (!out.length) w('ok', 'No points to check.');
    return out;
  }

  root.RocCompose = { EVENTS, FIELDS, blank, docs, reqText, reqItems, steps, checks, dates, isoOf, dmy, lh };
})(typeof window !== 'undefined' ? window : globalThis);
