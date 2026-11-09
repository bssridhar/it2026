/*
 * Composes the documents of the Trust tool from the case data.
 * window.TrustCompose = { deed, noc, resolution, activities, pan, form104, checklist, checks, helpers }
 * Wording of the deed follows the firm's format; statutory references follow the Income-tax Act, 2025 unless the
 * case is set to the 1961 wording.
 */
(function (root) {
  "use strict";
  const pad = n => String(n).padStart(2, '0');
  const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dmy = iso => iso ? iso.split('-').reverse().join('/') : '';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ORD = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  /* words */
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? ' ' + ONES[x % 10] : '');
  const three = x => x >= 100 ? ONES[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' and ' + two(x % 100) : '') : two(x);
  function words(n) { n = Math.round(n); if (!n) return 'Zero'; const o = []; const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
    if (cr) o.push((cr >= 100 ? words(cr) : two(cr)) + (cr === 1 ? ' Crore' : ' Crores')); if (lk) o.push(two(lk) + (lk === 1 ? ' Lakh' : ' Lakhs')); if (th) o.push(two(th) + ' Thousand'); if (n) o.push(three(n)); return o.join(' '); }
  const inr = n => Math.round(n).toLocaleString('en-IN');

  /* Aadhaar / PAN */
  const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
  const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
  const digits = a => String(a || '').replace(/\D/g, '');
  const aadhaarOk = a => { const d = digits(a); if (d.length !== 12) return false; let ch = 0; d.split('').reverse().forEach((x, i) => { ch = VD[ch][VP[i % 8][+x]]; }); return ch === 0; };
  const aadhaarFmt = (a, mask) => { const d = digits(a); if (d.length !== 12) return String(a || '').trim(); return mask ? `XXXX XXXX ${d.slice(8)}` : `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}`; };
  const panOk = p => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(String(p || '').trim().toUpperCase());
  function ageOn(dob, on) { if (!dob) return ''; const [y, m, d] = dob.split('-').map(Number), [y2, m2, d2] = on.split('-').map(Number); let a = y2 - y; if (m2 < m || (m2 === m && d2 < d)) a--; return a; }

  const offLines = c => { const l = [c.off_flat, c.off_building, c.off_road, c.off_area, c.off_city].map(s => String(s || '').trim()).filter(Boolean); const st = [c.off_state, c.off_pin].map(s => String(s || '').trim()).filter(Boolean).join(' - '); if (st) l.push(st); return l; };
  const offInline = c => offLines(c).join(', ');
  const execIso = c => (!c.date_blank && c.exec_date) ? c.exec_date : isoToday();
  const founders = c => c.persons.filter(p => p.name.trim() && p.founder);
  const trustees = c => c.persons.filter(p => p.name.trim() && p.trustee);
  const signers = c => c.persons.filter(p => p.name.trim() && (p.founder || p.trustee));
  const position = p => (p.position || '').trim() || (p.trustee ? 'Trustee' : 'Founder');
  const hasPos = (c, re) => trustees(c).some(p => re.test(position(p)));
  const ACT = c => c.act === '1961' ? 'Income-tax Act, 1961' : 'Income-tax Act, 2025';
  const roman = n => ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'][n - 1] || String(n);
  const letter = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(97 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  /* ================================================================ bank operation clause */
  const joinList = (arr, conj) => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ` ${conj} ` + arr[arr.length - 1];
  const NUMW = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  /* Returns the sentences that describe how the bank account is operated (used in the deed and the resolution). */
  function bankText(c) {
    const who = (c.bank_who || []).filter(Boolean);
    const W = who.length ? who : ['President', 'Secretary'];
    const nj = Math.max(2, Number(c.bank_n) || 2), njw = NUMW[nj] || String(nj);
    const lim = Number(String(c.bank_limit || '').replace(/[^\d]/g, '')) || 0;
    let t;
    switch (c.bank_mode) {
      case 'ob_single': t = `The bank account of the Trust shall be operated by any one of the ${joinList(W, 'or')} of the Trust individually.`; break;
      case 'ob_joint': t = W.length <= nj ? `The bank account of the Trust shall be operated jointly by the ${joinList(W, 'and')} of the Trust.` : `The bank account of the Trust shall be operated jointly by any ${njw} of the ${joinList(W, 'and')} of the Trust.`; break;
      case 'ob_with': t = `The bank account of the Trust shall be operated jointly by either of the ${joinList(W, 'or')} and the ${c.bank_with || 'Treasurer'} of the Trust.`; break;
      case 'tr_single': t = 'The bank account of the Trust shall be operated by any one of the trustees individually.'; break;
      case 'tr_joint': t = `The bank account of the Trust shall be operated jointly by any ${njw} of the trustees.`; break;
      case 'tr_all': t = 'The bank account of the Trust shall be operated jointly by all the trustees.'; break;
      case 'custom': t = String(c.bank_custom || '').trim(); break;
      default: t = `The ${joinList(W, 'and')} of the Trust shall operate the bank account either jointly or individually as decided by the Board of Trustees from time to time, borrow money for the trust and carry out the objects of the trust.`;
    }
    if (lim && ['ob_single', 'tr_single', 'ob_either'].includes(c.bank_mode || 'ob_either'))
      t += ` Payments up to Rs.${inr(lim)}/- may be made under the signature of any one of them; payments exceeding Rs.${inr(lim)}/- shall be made under the joint signatures of any two of them.`;
    if (c.bank_board !== false) t += ' The bank account shall be operated by any of the trustees, either individually or jointly, if decided so by the Board of Trustees to that effect.';
    return t.trim();
  }

  /* ================================================================ deed (firm's format) */
  function deed(c) {
    const F = founders(c), many = F.length > 1, Fw = many ? 'Founders' : 'Founder';
    const corpus = Number(String(c.corpus).replace(/[^\d]/g, '')) || 0;
    const rs = `Rs.${inr(corpus)}/- (Rupees ${words(corpus)} Only)`;
    const on = execIso(c);
    let intro;
    if (!c.date_blank && c.exec_date) { const [y, m, d] = c.exec_date.split('-').map(Number); intro = `This Deed of Trust executed this ${ORD(d).toUpperCase()} Day of ${MONTHS[m - 1]} ${y}, at ${c.exec_place.trim()} :-`; }
    else intro = `This Deed of Trust executed this ____ Day of ${(c.exec_month || '').trim() || '______________ 20__'}, at ${c.exec_place.trim()} :-`;
    const addr = p => p.address.trim().replace(/\s*\n\s*/g, ', ').replace(/[;,.]+$/, '');
    const fl = F.map((p, i) => ({ n: i + 1, text: `${p.title ? p.title + ' ' : ''}${p.name.trim()}, ${p.rel} ${p.father.trim()} (Aadhaar No ${aadhaarFmt(p.aadhaar, c.mask)}), aged about ${ageOn(p.dob, on)} years, residing at ${addr(p)}` }));
    const B = [];
    const add = (type, num, text) => { const b = { num, text }; b[type] = true; B.push(b); };
    const settled = c.settle_date ? ` on ${dmy(c.settle_date).replace(/\//g, '-')}` : (c.settle_blank ? ' on ____________' : '');
    add('l0', '', `WHEREAS the ${Fw} herein ${many ? 'together have' : 'has'} set apart a sum of ${rs} and ${many ? 'are' : 'is'} desirous of forming trust thereof for the intents and purpose herein after mentioned.`);
    add('l0', '', `AND WHEREAS to the said intent the ${Fw} of the trust ${many ? 'have' : 'has'} settled ${rs} on the trust${settled} to hold the same upon trust and to utilize the income there from for its intents and purposes thereinafter mentioned.`);
    add('l0b', '', 'THIS DEED OF TRUST WITNESSETH:-');
    let n = 0; const N = () => `${++n}.`;
    add('l1', N(), `The ${Fw} ${many ? 'do' : 'does'} hereby settle upon trust on the trustees hereinafter mentioned the said ${rs} and the trustees shall stand possessed of the said amount and shall utilize the said amount and the income therefrom and all accumulations and accretions thereto by way of contributions, donations, subscriptions or otherwise forming the Trust Fund for the intents and purposes hereinafter mentioned.${c.other_contribute ? ' Apart from the above, all the other trustees shall contribute amount as decided between them from time to time towards the Corpus of the Trust at the time as decided.' : ''}`);
    add('l1', N(), `The name of the Trust shall be ${c.trust_name.trim().toUpperCase()} and the principal place of the Trust shall be at ${offInline(c)} and such other place or places as the trustees herein may decide from time to time.`);
    add('l1', N(), 'The intents and purposes of the Trust are:-');
    // objects in the order chosen; consecutive objects with the same heading form a group
    let k = 0; const objs = orderedObjects(c);
    const L = () => `${letter(k++)})`;
    for (let i = 0; i < objs.length;) {
      const h = String(objs[i].head || '').trim();
      if (h) { add('l2b', L(), h); let j = 0; while (i < objs.length && String(objs[i].head || '').trim() === h) { add('l3', `(${roman(++j)})`, objs[i].text.trim()); i++; } }
      else { add('l2', L(), objs[i].text.trim()); i++; }
    }
    if (c.obj_takeover) add('l2', L(), 'To take over any other Charitable Trust having similar objects of this trust in case necessity arises with the consent of the trustees and subject to approval of the Commissioner of Income-tax.');
    add('l2', L(), 'The Trust will not carry out any activities with the intention of earning profit and will perform with service motive only.');
    if (c.no_outside_india) add('l2', L(), 'No activities of the Trust will be carried out outside India.');
    add('l0', '', 'For removal of doubts, it is hereby declared that all the objects of the Trust will be carried without any motive for profit and no part of the funds of the trust shall be utilized for payments to trustees by way of profit, interest, dividends, salary, etc.');
    add('l1', N(), 'The First Trustees of the trust shall be:-');
    trustees(c).forEach((p, i) => add('l2l', `${i + 1}.`, `${p.title ? p.title + ' ' : ''}${p.name.trim()} - ${position(p).toUpperCase()}\n${p.rel} ${p.father.trim()}\n${addr(p)}.`));
    add('l1', N(), c.adm_heading ? 'ADMINISTRATION' : '');
    const sup = ['President', 'Secretary', 'Managing Trustee'].filter(o => trustees(c).some(p => position(p).toLowerCase().split(/\s*[&,\/]\s*|\s+and\s+/).some(x => x.trim().startsWith(o.toLowerCase()))));
    const offices = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Managing Trustee'].filter(o => trustees(c).some(p => position(p).toLowerCase().split(/\s*[&,\/]\s*|\s+and\s+/).some(x => x.trim().startsWith(o.toLowerCase()))));
    const offTxt = joinList(offices.length ? offices : ['President', 'Secretary'], '&');
    let a = 0; const A = () => `${letter(a++)})`;
    const mn = Number(c.min_trustees) || 2, mx = Number(c.max_trustees) || 10;
    add('l2', A(), `The Trust shall be governed by a Board of Trustees. The Board of Trustees shall consist of all the trustees, the number of which shall always be not less than ${words(mn).toLowerCase()} and not more than ${words(mx).toLowerCase()}.`);
    add('l2', A(), `The office of the ${offTxt} as mentioned above shall be held by the respective trustees for a period of ${c.term_years} years and after the expiry of the term or during resignation/vacancy, the trustees herein shall elect amongst themselves for the posts as mentioned above for a term of ${c.term_years} years.`);
    add('l2', A(), 'All the trustees named herein shall hold office for the life time or until they resign.');
    add('l2', A(), 'The other Trustee or Trustees shall be chosen by the Trust Board if so desired with the consent of at least two-thirds of Trustees including President. Fraction of two-thirds will be ignored.');
    add('l2', A(), `The ${joinList(sup.length ? sup : ['President', 'Secretary'], '&')} shall have overall power of superintendence over affairs of the trust.${(c.bank_mode || 'ob_either') === 'ob_either' ? '' : ' They shall have power to borrow money for the trust and to carry out the objects of the trust.'} ${bankText(c)}`);
    if (c.meetings) {
      add('l2', A(), `The meeting of the trustees shall be conducted as and when necessary to transact business. The President of the Trust or the Chairman of the meeting, as the case may be, shall have a casting vote in case of equality of votes. The meeting of all trustees shall be held once in ${c.tr_meet_months} months. The quorum for the meeting of the Trustees is ${c.tr_quorum} trustees. In case the quorum is not present at the designated time, the meeting shall be adjourned by 1 hour and the adjourned meeting shall be conducted with the trustees present at the meeting.`);
      add('l2', A(), `${words(Number(c.notice_days) || 0)} days notice of all meetings of the Trustees shall be given to all trustees either by Registered post or in any other manner as decided by the Trustees. The meetings may be conducted either physically or online.`);
    }
    add('l2', A(), 'In case of any vacancy in the Trust Board arising by death, resignation or otherwise the remaining trustees will have full power to represent the Trust Board.');
    const inv = c.act === '1961' ? 'Section 11 of the Income-tax act, 1961' : 'section 350 of the Income-tax Act, 2025';
    add('l1', N(), `The Trustees shall have power to receive and accept contribution in money or property of any kind either by way of addition to the trust fund generally or for one or more specific objects and such contribution shall be dealt with either as capital or as income according to the direction of the donor. However no investment shall be made contrary to ${inv}.`);
    add('l1', N(), 'Out of the Income of the Trust property the Trustees shall be entitled to spend or incur the following expenses namely:-');
    a = 0;
    ['All rates, taxes, cess, assessment, dues and duties if any payable to the Government or to any other Municipal or other public body in respect thereof or any part thereof.',
     'Wages and salaries of any manager, supervisor, accountant, clerk, housekeepers or other employees employed by the Trustees in the carrying out of this Trust.',
     'Costs and expenses for installing and renewing the electrical and other installation in the buildings for the time being forming part of the Trust Property.',
     'The legal charges and fees payable to other professionals engaged in the course of the administration of the Trust.',
     'All other costs, charges and expenses incidental to management and administration of the Trust Property in accordance with the objects and purposes thereof or which may be incidental thereto.'].forEach(t => add('l2', A(), t));
    add('l2', A(), c.property.trim() ? `As on formation of the Trust, the trust holds the following immovable property: ${c.property.trim().replace(/\.$/, '')}. The Trust can purchase property in its name as per provisions of the ${ACT(c)} in the future.`
      : `As on formation of the Trust, the trust does not have any immovable Property. The Trust can purchase property in its name as per provisions of the ${ACT(c)} in the future.`);
    add('l1', N(), 'Without prejudice to the generality of their power, the Board of Trustees or such Trustees named by the Board shall have powers:-');
    a = 0;
    const modes = c.act === '1961' ? 'as specified by section 13(1)(d) read with section 11(5) of the Income-tax Act, 1961' : 'as specified in section 350 read with Schedule XVI of the Income-tax Act, 2025';
    ['To employ clerks and other employees, agents, bankers, lawyers, accountants and others and at such remuneration as they may think fit.',
     'To delegate any powers to one or more of their body.',
     'To delegate any power as they can lawfully delegate to any person and to execute such power of attorney as they may think fit for the purposes.',
     'To withdraw any power or revoke any appointment of any employee or attorney.',
     'To let any portions of any immovable property forming part of the trust fund at such rent and for such period and on such terms and conditions as they may think fit and to accept surrender of any lease.',
     'To borrow money with or without security or pledges, mortgage or otherwise charge any of the properties belonging to the Trust for the purpose of raising loan.',
     `To lend or keep invested the trust fund in short or long term securities or in form of Fixed Deposits with banks and Securities and forms ${modes}.`,
     `To establish an office or offices of the trust hereby created in any part of India${c.no_outside_india ? '' : ' or out of India'} as they may deem fit from time to time.`,
     'To open, deposit account of any type with any bank in the name of trust which shall be operated by Trustees either individually or jointly as decided by the Trustees from time to time.'].forEach(t => add('l2', A(), t));
    add('l1', N(), 'The accounts of the trust shall be closed every year on 31st of March and Income & Expenditure account and Balance Sheet as on the date shall be prepared and the Accounts shall be audited by a Qualified Chartered Accountant. The surplus fund if not applied within the year of account shall be accumulated for any specific object of the Trust and invested in any manner authorized under the Income-tax Act for the time being in force.');
    add('l1', N(), 'The trust shall be irrevocable.');
    add('l1', N(), 'Any amendment to the Trust Deed shall be carried out only with the approval of the Commissioner of Income Tax.');
    add('l1', N(), 'The benefits of the Trust are open to all, irrespective of caste, religion, sex, etc.');
    add('l1', N(), 'The income of the trust shall be applied solely for the charitable purposes and no portion of the funds of the Trust shall be utilized for payment to Trustees/Members by way of Profit, Interest, Dividends, etc.');
    if (c.no_outside_india) add('l1', N(), 'No activities of the trust shall be carried out outside India.');
    add('l1', N(), `Application of Income for religious purposes, if any, will be restricted to the limits prescribed under the ${ACT(c)} as amended from time to time.`);
    const recog = c.act === '1961' ? 'enjoys recognition u/s 80G of the Income Tax Act, 1961' : 'enjoys approval under section 354 of the Income-tax Act, 2025';
    add('l1', N(), `In the event of dissolution or winding up of the Trust, the assets remaining as on the date of dissolution shall under no circumstances be distributed among the Trustees/Members of the Managing Committee/Members of Governing Body, but the same shall be transferred to another Charitable Trust whose objects are similar to those of this Trust and which ${recog}.`);
    String(c.extra || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(t => add('l1', N(), /[.:;]$/.test(t) ? t : t + '.'));
    if (c.jur_clause && c.jurisdiction.trim()) add('l1', N(), `It is hereby agreed by and between parties hereto that the Civil Courts in ${c.jurisdiction.trim().toUpperCase()} shall have the exclusive jurisdiction in respect of any matter, claim or dispute arising out of or in any way related to this Trust deed.`);
    if (c.arbitration) add('l1', N(), 'Any dispute or difference whatsoever arising between the parties out of or relating to the trust or the breach thereof shall be settled by arbitration in accordance with the Rules of Arbitration of the Indian Council of Arbitration and the award made in pursuance thereof shall be binding on the parties.');
    const W = c.witnesses.map((w, i) => ({ n: i + 1, text: w.name.trim() ? [w.name.trim(), w.rel.trim(), w.address.trim()].filter(Boolean).join(', ') : '________________________________________' }));
    return {
      trust_name_upper: c.trust_name.trim().toUpperCase(), intro, founders: fl.map(f => ({ ...f, text: f.text + '.' })), founders_called: many ? 'THE FOUNDERS' : 'THE FOUNDER', founder_word: many ? 'FOUNDERS' : 'FOUNDER',
      blocks: B, signs: signers(c).map((p, i) => ({ n: i + 1, name_upper: p.name.trim().toUpperCase(), position: c.sign_pos ? position(p) : '' })), witnesses: W,
    };
  }
  /* objects in the chosen order: by order number, then by position in the list */
  function orderedObjects(c) {
    return c.objects.map((o, i) => ({ o, i })).filter(x => x.o.use && String(x.o.text || '').trim())
      .sort((p, q) => ((Number(p.o.order) || 1e6) - (Number(q.o.order) || 1e6)) || (p.i - q.i)).map(x => x.o);
  }

  /* ================================================================ letters */
  function noc(c) {
    const owner = (c.off_owner || '').trim() || '________________';
    return { head: 'NO OBJECTION CERTIFICATE', date_line: 'Date: ____________', to: `The Board of Trustees,\n${c.trust_name.trim().toUpperCase()},\n${offLines(c).join(',\n')}.`, subject: 'No objection for use of premises as the principal office of the Trust',
      salutation: 'Dear Sirs,', paras: [
        `I, ${owner}${c.off_owner_rel ? ', ' + c.off_owner_rel.trim() : ''}, am the owner of the premises situated at ${offInline(c)}.`,
        `I have no objection to the said premises being used as the principal office of ${c.trust_name.trim().toUpperCase()} and to the said address being used for the registration of the Trust Deed, the PAN application, the bank account and the registration of the Trust under the Income-tax Act and other statutory purposes.`],
      closing: 'Yours faithfully,', sign: `(${owner})\nOwner of the premises`, place_date: `Place: ${c.off_city || ''}`,
      hasEncl: true, encl: [{ n: 1, text: 'Copy of the latest electricity bill / property tax receipt of the premises' }, { n: 2, text: "Copy of the owner's PAN / Aadhaar" }] };
  }
  function resolution(c) {
    const T = trustees(c), sig = T.filter(p => p.signatory);
    const name = c.trust_name.trim().toUpperCase();
    const chair = T.find(p => /^president/i.test(position(p))) || T[0] || { name: '', position: '' };
    const cl = bankText(c).replace(/\s*The bank account shall be operated by any of the trustees, either individually or jointly, if decided so by the Board of Trustees to that effect\./, '').replace(/, borrow money for the trust and carry out the objects of the trust\./, '.');
    const how = cl.replace(/^The bank account of the Trust shall be operated/, 'the account shall be operated').replace(/^The (.*) of the Trust shall operate the bank account/, 'the account shall be operated by the $1 of the Trust');
    const deedRef = `${c.deed_date ? 'the Trust Deed dated ' + dmy(c.deed_date) : 'the Trust Deed'}${c.deed_regno ? ' registered as Document No. ' + c.deed_regno.trim() + (c.sro ? ' in the office of the Sub-Registrar, ' + c.sro.trim() : '') : ''}`;
    const bank = (c.bank_name || '________________').trim() + (c.bank_branch ? ', ' + c.bank_branch.trim() + ' Branch' : '');
    const signNames = sig.length ? joinList(sig.map(p => `${p.title ? p.title + ' ' : ''}${p.name.trim()}, ${position(p)}`), 'and') : 'the trustees authorised under the Trust Deed';
    return {
      head: `CERTIFIED TRUE COPY OF THE RESOLUTION PASSED AT THE MEETING OF THE BOARD OF TRUSTEES OF ${name} HELD ON ${c.res_date ? dmy(c.res_date) : '____________'} AT ${(c.res_place || offInline(c)).toUpperCase()}`,
      paras: [`Present: ${T.map(p => `${p.name.trim()} (${position(p)})`).join(', ')}.`, `In the Chair: ${chair.name.trim()}${chair.position || T.length ? ' (' + position(chair) + ')' : ''}.`, 'Opening and operation of the bank account of the Trust'],
      resolved: [
        `RESOLVED THAT a ${(c.acc_type || 'Savings').toLowerCase()} bank account be opened in the name of "${name}" with ${bank}, and that the bank be requested to open the account on the basis of ${deedRef}, the PAN of the Trust${c.trust_pan ? ' (' + c.trust_pan.toUpperCase() + ')' : ''} and this resolution.`,
        `RESOLVED FURTHER THAT, in accordance with the provisions of ${deedRef} relating to the operation of the bank account, ${how.replace(/\.$/, '')}.`,
        `RESOLVED FURTHER THAT ${signNames} be and ${sig.length > 1 ? 'are' : 'is'} hereby authorised to sign the account opening form, the KYC documents and other papers, to request cheque books, and to avail internet banking, UPI and other facilities, which shall be operated in the same manner as above.`,
        'RESOLVED FURTHER THAT the bank be informed of any change in the authorised signatories or the mode of operation by a resolution of the Board of Trustees, and that until such intimation is received the bank may act on this resolution.',
        `RESOLVED FURTHER THAT a copy of this resolution certified by the ${joinList(T.filter(p => /^(president|secretary|managing)/i.test(position(p))).slice(0, 2).map(p => position(p)), 'and') || 'President and the Secretary'} be furnished to the bank.`],
      after_head: sig.length ? 'Specimen signatures of the authorised signatories' : '',
      after: sig.map(p => `${p.name.trim()} (${position(p)})          Signature: ______________________`),
      sign: `Certified true copy\nFor ${name}\n\n\n${T.filter(p => /^(president|secretary|managing)/i.test(position(p))).slice(0, 2).map(p => `${p.name.trim()} (${position(p)})`).join('          ') || 'Trustee          Trustee'}`,
      place_date: `Place: ${c.off_city || ''}\nDate: ${c.res_date ? dmy(c.res_date) : '____________'}` };
  }
  function activitiesNote(c) {
    const heads = []; orderedObjects(c).forEach(o => { const h = String(o.head || '').trim(); if (h && !heads.includes(h)) heads.push(h); });
    const paras = (c.activities || '').trim() ? c.activities.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) : [
      `${c.trust_name.trim().toUpperCase()} is a public charitable trust created by the Trust Deed${c.deed_date ? ' dated ' + dmy(c.deed_date) : ''}${c.deed_regno ? ', registered as Document No. ' + c.deed_regno.trim() + (c.sro ? ' at the office of the Sub-Registrar, ' + c.sro.trim() : '') : ''}, with its principal office at ${offInline(c)}.`,
      `The Trust has not commenced its activities as on the date of this note. On commencement, the Trust proposes to carry out the following activities in accordance with its objects set out in clause 3 of the Trust Deed${heads.length ? ': ' + heads.join('; ') + '.' : ':'}`,
      ...(heads.length ? [] : orderedObjects(c).map((o, i) => `(${letter(i)}) ${o.text.trim()}`)),
      'The activities will be carried out in India, without any motive of profit, and the benefits will be open to all irrespective of caste, religion or sex. The funds of the Trust will be applied only for its objects and will be invested only in the modes permitted under the Income-tax Act, 2025.'];
    return { head: 'NOTE ON THE PROPOSED ACTIVITIES OF THE TRUST', subject: '', paras, sign: `For ${c.trust_name.trim().toUpperCase()}\n\n\n(Authorised Trustee)`, place_date: `Place: ${c.off_city || ''}\nDate: ____________` };
  }

  /* ================================================================ data sheets */
  const kvSec = (heading, rows, note) => ({ heading, note: note || '', hasKv: true, kv: rows.map(([k, v]) => ({ k, v: String(v ?? '').trim() || '—' })) });
  const lead = c => trustees(c).find(p => /Managing/i.test(position(p))) || trustees(c).find(p => /^President/i.test(position(p))) || trustees(c)[0];
  const deedLine = c => `Trust Deed${c.deed_date ? ' dated ' + dmy(c.deed_date) : ''}${c.deed_regno ? ', Document No. ' + c.deed_regno.trim() : ''}${c.sro ? ', Sub-Registrar Office: ' + c.sro.trim() : ''}`;
  const personGrid = (c, withPan) => ({ heading: 'Trustees and founders', grid: { h1: 'No.', h2: 'Name', h3: 'Position', h4: withPan ? 'PAN' : 'Date of birth', h5: 'Aadhaar / address',
    rows: signers(c).map((p, i) => ({ c1: String(i + 1), c2: `${p.name.trim()}\n${p.rel} ${p.father.trim()}`, c3: position(p) + (p.founder && p.trustee ? ' (Founder)' : ''), c4: withPan ? (p.pan || '—').toUpperCase() : dmy(p.dob), c5: `${aadhaarFmt(p.aadhaar, c.mask)}\n${p.address.trim()}` })) } });
  function pan(c) {
    const L = lead(c) || { name: '', father: '', rel: '', pan: '', address: '' };
    return { title: 'PAN APPLICATION – DATA SHEET', subtitle: c.trust_name.trim().toUpperCase(), meta: `Trust · prepared on ${dmy(isoToday())}${c.ref ? ' · ' + c.ref : ''}`, secs: [
      kvSec('Applicant', [['Category of applicant', 'Trust'], ['Full name of the trust', c.trust_name.trim().toUpperCase()], ['Name to be printed on the PAN card', c.trust_name.trim().toUpperCase()],
        ['Date of creation (date of the trust deed)', dmy(c.deed_date) || 'Date of execution of the deed'], ['Registration number', c.deed_regno ? `${c.deed_regno.trim()} (Sub-Registrar, ${c.sro || ''})` : 'Document No. of the registered deed'], ['Source of income', 'No income']]),
      kvSec('Address for communication (principal office)', [['Flat / Door / Block No.', c.off_flat], ['Premises / Building', c.off_building], ['Road / Street', c.off_road], ['Area / Locality', c.off_area], ['Town / City / District', c.off_city], ['State', c.off_state], ['PIN code', c.off_pin], ['Country', 'India'], ['Mobile', c.mobile], ['E-mail', c.email]]),
      kvSec('Trustee signing the application', [['Name', L.name], [L.rel === 'W/o' ? "Husband's name" : "Father's name", L.father], ['Position', position(L)], ['PAN', (L.pan || '').toUpperCase()], ['Address', L.address]]),
      personGrid(c, true),
      { heading: 'Documents to attach', items: ['Copy of the registered Trust Deed (or the certificate of registration, where issued)', 'Proof of identity and address of the trustee signing the application', 'Application signed by the authorised trustee'] },
      { heading: 'Points to check', bullets: ['The name and address must match the registered Trust Deed exactly.', 'Use the date of the Trust Deed as the date of creation.', 'Check the AO code for the address on the PAN application site.', 'Verify every field against the original documents before submission.'] }] };
  }
  function form104(c) {
    const objs = orderedObjects(c);
    return { title: 'FORM No. 104 – DATA SHEET', subtitle: c.trust_name.trim().toUpperCase(), meta: `Provisional registration under section 332(3) / provisional approval under section 354(2), Income-tax Act, 2025 · prepared on ${dmy(isoToday())}`, secs: [
      kvSec('Application', [['Form', 'Form No. 104 (filed online on the e-filing portal: e-File → Income Tax Forms → File Income Tax Forms → Forms as per Income Tax Act, 2025)'],
        ['Registration sought', 'Provisional registration under section 332(3) (Table: Sl. No. 1)'], ['Approval sought', c.want354 ? 'Provisional approval under section 354(2), so that donations qualify for deduction under section 133(1)(b)(ii)' : 'Not sought now'],
        ['Activities commenced?', 'No (declared in the Undertaking section of the form)'], ['Previously registered or approved?', 'No']],
        'Form 104 is only for an applicant that has not commenced its activities and has never been registered under section 12A, 12AA, 12AB or 10(23C) of the Income-tax Act, 1961, or under section 332.'),
      kvSec('Applicant', [['Name', c.trust_name.trim().toUpperCase()], ['PAN of the trust', (c.trust_pan || '').toUpperCase() || 'To be obtained before filing'], ['Address', offInline(c)], ['E-mail', c.email], ['Mobile', c.mobile],
        ['Instrument of creation', deedLine(c)], ['Date of creation', dmy(c.deed_date)], ['Registration under FCRA, 2010', c.fcra ? c.fcra : 'Not registered'], ['Registration with Registrar of Public Trusts', c.rpt || 'Not applicable']]),
      personGrid(c, true),
      { heading: 'Objects (as in the Trust Deed)', bullets: objs.map(o => (o.head ? o.head.trim() + ' – ' : '') + o.text.trim()) },
      { heading: 'Documents (as listed in the e-filing portal FAQ on Form No. 104)', items: [
        'Self-certified copy of the trust deed',
        'Self-certified copy of registration with the Registrar of Public Trusts, as the case may be (if registered)',
        'Self-certified copy of registration under the Foreign Contribution (Regulation) Act, 2010 (if registered)',
        'Note on the proposed activities of the applicant',
        'Self-certified copies of annual accounts of earlier years (not more than three), only if the trust existed in earlier years – or a NIL declaration for each year'] },
      { heading: 'Points to note', bullets: [
        'Form 104 can be filed at any time during the tax year from which registration is sought. It cannot be edited after submission; it can be withdrawn within 7 days.',
        'The order granting provisional registration / approval (Form No. 106) is generated automatically 7 days after filing.',
        'Provisional registration / approval is valid for three tax years, or up to six months from the commencement of activities, whichever is earlier. Regular registration is then applied for in Form No. 105.',
        'Source: Form No. 104 FAQs, Income Tax e-filing portal (incometax.gov.in).'] }] };
  }
  const STEPS = [
    ['kyc', 'Collect KYC of founders and trustees', ['PAN card', 'Aadhaar', 'Passport size photograph', 'Address proof (if different from Aadhaar)', 'Mobile number and e-mail']],
    ['office', 'Principal office – NOC and proof', ['NOC from the owner (generated by this tool)', 'Latest electricity bill / property tax receipt', 'Rent agreement, if rented']],
    ['deed', 'Finalise the Trust Deed', ['Name, corpus, objects and trustees approved by the founders', 'Draft deed checked against the KYC documents']],
    ['stamp', 'Stamp paper / e-stamp for the deed', ['Stamp duty as applicable in the State', 'Stamp paper / e-stamp in the name of the founder']],
    ['register', 'Execute and register the deed with the Sub-Registrar', ['Founders and trustees present with original ID', 'Two witnesses with ID', 'Corpus amount / cheque', 'Registration fee', 'Record the Document No. and date in this tool']],
    ['pan', 'Apply for the PAN of the Trust', ['PAN data sheet (generated by this tool)', 'Copy of the registered Trust Deed', 'ID and address proof of the signing trustee']],
    ['bank', 'Open the bank account of the Trust', ['Resolution of the trustees (generated by this tool)', 'Copy of the Trust Deed and PAN', 'KYC of the authorised signatories', 'Corpus deposited in the account']],
    ['f104', 'File Form No. 104 – provisional registration u/s 332(3) and approval u/s 354(2)', ['Self-certified copy of the trust deed', 'Note on proposed activities (generated by this tool)', 'PAN of the Trust', 'Form No. 106 received (generated 7 days after filing)']],
    ['f105', 'After activities commence – Form No. 105 for regular registration', ['Provisional registration is valid for three tax years or up to six months from commencement, whichever is earlier', 'Record the date of commencement in this tool']],
    ['other', 'Other registrations, if applicable', ['NGO Darpan (NITI Aayog), if grants from Government are sought', 'Form CSR-1 (MCA), if CSR funds are to be received', 'FCRA registration, if foreign contributions are to be received', 'Registration with the State Registrar of Public Trusts, where required by State law']],
  ];
  function checklist(c) {
    return { title: 'TRUST FORMATION – CHECKLIST', subtitle: c.trust_name.trim().toUpperCase(), meta: `Prepared on ${dmy(isoToday())}${c.ref ? ' · ' + c.ref : ''}`,
      secs: STEPS.map(([key, h, items], i) => { const t = (c.tracker || {})[key] || {}; return { heading: `${i + 1}. ${h}${t.done ? `  –  DONE${t.date ? ' on ' + dmy(t.date) : ''}` : ''}`, note: t.note || '', items }; })
        .concat([personGrid(c, true)]) };
  }

  /* ================================================================ checks */
  function checks(c) {
    const e = [], w = [], on = execIso(c), T = trustees(c), Fd = founders(c);
    if (!c.trust_name.trim()) e.push('Enter the name of the trust.');
    else if (!/\bTRUST\b|\bFOUNDATION\b/i.test(c.trust_name)) w.push('The name usually contains "Trust" or "Foundation".');
    if (!(Number(String(c.corpus).replace(/[^\d]/g, '')) > 0)) e.push('Enter the corpus settled.');
    if (!offLines(c).length || !c.off_city.trim()) e.push('Enter the address of the principal office.');
    if (c.off_pin && !/^\d{6}$/.test(c.off_pin.trim())) w.push('The PIN code of the office should have 6 digits.');
    if (!c.exec_place.trim()) e.push('Enter the place of execution.');
    if (c.jur_clause && !c.jurisdiction.trim()) e.push('Enter the city whose courts have jurisdiction.');
    if (!Fd.length) e.push('Mark at least one person as Founder.');
    const mn = Number(c.min_trustees) || 0, mx = Number(c.max_trustees) || 0;
    if (mn > mx) e.push('The minimum number of trustees is more than the maximum.');
    if (T.length < mn) e.push(`There are ${T.length} trustee(s); the deed requires at least ${mn}.`);
    if (mx && T.length > mx) e.push(`There are ${T.length} trustees; the deed allows at most ${mx}.`);
    if (c.meetings && (Number(c.tr_quorum) || 0) > T.length) e.push(`The quorum for trustees' meetings (${c.tr_quorum}) is more than the number of trustees (${T.length}).`);
    const has = o => T.some(p => position(p).toLowerCase().split(/\s*[&,\/]\s*|\s+and\s+/).some(x => x.trim().startsWith(o.toLowerCase())));
    const mode = c.bank_mode || 'ob_either';
    if (mode.startsWith('ob_')) { (c.bank_who || []).forEach(o => { if (!has(o)) w.push(`The bank clause refers to the ${o}, but no trustee holds that position.`); }); if (!(c.bank_who || []).length) w.push('Choose the office bearers who operate the bank account.'); }
    if (mode === 'ob_with' && !has(c.bank_with || 'Treasurer')) w.push(`The bank clause refers to the ${c.bank_with || 'Treasurer'}, but no trustee holds that position.`);
    if ((mode === 'ob_joint' || mode === 'tr_joint') && (Number(c.bank_n) || 2) > (mode === 'tr_joint' ? T.length : (c.bank_who || []).length)) w.push('The number of joint signatories is more than the persons who can sign.');
    if (mode === 'custom' && !String(c.bank_custom || '').trim()) e.push('Enter the wording of the bank operation clause.');
    if (!T.some(p => p.signatory)) w.push('No trustee is marked as a bank signatory – the resolution will not name the signatories.');
    ['President', 'Secretary'].forEach(o => { const k = T.filter(p => position(p).split(/\s*[&,\/]\s*|\s+and\s+/i).some(x => x.trim().toLowerCase().startsWith(o.toLowerCase()))).length; if (!k) w.push(`No trustee is marked as ${o} – the administration clauses refer to the ${o}.`); if (k > 1) w.push(`More than one trustee is marked as ${o}.`); });
    c.persons.forEach((p, i) => {
      if (!p.name.trim()) { if (p.father || p.aadhaar) e.push(`Person ${i + 1}: enter the name.`); return; }
      const nm = p.name.trim();
      if (!p.founder && !p.trustee) w.push(`${nm} is neither a founder nor a trustee and will not appear in the deed.`);
      if (!p.father.trim()) e.push(`${nm}: enter the father's / husband's name.`);
      if (!p.address.trim()) e.push(`${nm}: enter the address.`);
      if (!p.dob) e.push(`${nm}: enter the date of birth (the age is printed in the deed).`);
      else if (ageOn(p.dob, on) < 18) w.push(`${nm} is below 18 years on the date of execution.`);
      if (!aadhaarOk(p.aadhaar)) w.push(`${nm}: the Aadhaar number does not look valid (12 digits with a check digit).`);
      if (p.pan && !panOk(p.pan)) w.push(`${nm}: the PAN format looks wrong.`);
      if (!p.pan && p.trustee) w.push(`${nm}: PAN not entered (needed for the trust's PAN and Form 104 details).`);
      if (p.signatory && !p.trustee) w.push(`${nm} is marked as a bank signatory but is not a trustee.`);
    });
    if (!c.objects.some(o => o.use && o.text.trim())) e.push('Select at least one object.');
    const ords = c.objects.filter(o => o.use && String(o.order || '').trim()).map(o => Number(o.order)); if (new Set(ords).size !== ords.length) w.push('Two objects have the same order number – they will keep their list order.');
    return { e, w };
  }

  root.TrustCompose = { deed, bankText, orderedObjects, noc, resolution, activitiesNote, pan, form104, checklist, checks, STEPS,
    helpers: { dmy, isoToday, words, inr, aadhaarFmt, aadhaarOk, panOk, ageOn, offLines, offInline, position, trustees, founders, signers } };
})(window);
