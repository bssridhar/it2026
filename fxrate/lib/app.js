(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const H = FxRules.helpers, dmy = H.dmy;
  const R = window.SBI_RATES || { data: {}, cur: [], cols: [], asOf: '', from: '' };
  const COL = { tt_buy: 0, tt_sell: 1, bill_buy: 2, bill_sell: 3 };
  const KIND = { tt_buy: 'SBI TT buying rate', tt_sell: 'SBI TT selling rate', customs_export: 'CBIC notified rate (export)', customs_import: 'CBIC notified rate (import)' };
  const fmt = (n, d = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
  const num = v => { const n = Number(String(v ?? '').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } } };
  const K = { cur: 'fxrate-current-v1', reg: 'fxrate-register-v1', my: 'fxrate-myrates-v1' };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const blank = () => ({ purpose: 'gst_svc_exp', ref: '', currency: 'USD', cur_other: '', amount: '', txn_date: '', event_date: '', brought_date: '', inv_date: '', supply_date: '', credit_date: '', pay_date: '', inv_in_time: true,
    override: '', override_why: '', shot: '', shot_name: '', real_date: '', real_inr: '', close_rate: '' });
  let c = Object.assign(blank(), store.get(K.cur, {}));
  let reg = store.get(K.reg, []), my = store.get(K.my, []);
  const save = () => { if (!store.set(K.cur, c)) $('#outMsgs').innerHTML = '<div class="m-warn">The browser could not keep a copy (the screenshot may be large) – use "Save case file".</div>'; };
  const curCode = () => c.currency === 'OTHER' ? (c.cur_other || '').toUpperCase() : c.currency;
  const per = cur => cur === 'JPY' ? 100 : 1;

  /* ---------- rate lookup: your rates for that date, then the archive; else the last published rate before the date ---------- */
  function lookup(cur, date, kind) {
    if (!cur || !date) return null;
    const mine = my.filter(r => r.cur === cur && r.kind === kind);
    if (kind.startsWith('customs')) { const m = mine.filter(r => r.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]; return m ? { rate: m.rate, date: m.date, src: m.src || 'Entered by you', mine: true } : null; }
    const ci = R.cur.indexOf(cur), col = COL[kind];
    let d = date; const gaps = [];
    for (let i = 0; i < 25; i++) {
      const m = mine.find(r => r.date === d); if (m) return { rate: m.rate, date: d, src: m.src || 'Entered by you', mine: true, gaps };
      const row = R.data[d];
      if (row && ci >= 0 && row[ci] && row[ci][col]) return { rate: row[ci][col], date: d, src: R.source, row, gaps };
      const wd = H.D(d).getUTCDay(); if (wd >= 1 && wd <= 5) gaps.push(d);
      if (d < R.from) break;
      if (d > R.asOf && !mine.length) return { beyond: true };
      d = H.addDays(d, -1);
    }
    return null;
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === b)); document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab); if (b.dataset.tab === 'reg') renderReg(); if (b.dataset.tab === 'search') { renderSearch(); renderMonth(); renderMy(); } });

  /* ---------- form ---------- */
  const sel = $('[data-f=purpose]');
  sel.innerHTML = ['IT', 'GST'].map(law => `<optgroup label="${law === 'IT' ? 'Income-tax (Income-tax Act, 2025)' : 'GST (CGST Act / Rules)'}">${FxRules.PURPOSES.filter(p => p.law === law).map(p => `<option value="${p.id}">${esc(p.label)}</option>`).join('')}</optgroup>`).join('');
  function bind() {
    document.querySelectorAll('[data-f]').forEach(el => { const k = el.dataset.f; if (el.type === 'checkbox') el.checked = !!c[k]; else el.value = c[k] ?? '';
      el.oninput = el.onchange = () => { c[k] = el.type === 'checkbox' ? el.checked : el.value; save(); render(); }; });
  }
  function render() {
    const P = FxRules.PURPOSES.find(p => p.id === c.purpose);
    $('#curOtherW').hidden = c.currency !== 'OTHER';
    const f = new Set(P.fields);
    document.querySelectorAll('[data-w]').forEach(w => { const k = w.dataset.w; w.hidden = k === 'inv_date_svc' ? P.id !== 'gst_svc_exp' : k === 'supply_date' ? !(P.id === 'gst_svc_exp' && !c.inv_in_time) : !f.has(k); });
    $('#evLbl').textContent = P.event || 'Date of the event';
    $('#invLbl').textContent = P.id === 'gst_goods_imp' ? 'Date of the bill of entry / time of supply' : P.id === 'gst_svc_imp' ? "Date of the supplier's invoice" : 'Invoice date';
    $('#payLbl').textContent = P.id === 'gst_svc_exp' ? 'Date of receipt of payment (if received before the invoice)' : P.id === 'gst_svc_imp' ? 'Date of payment to the supplier' : 'Date of payment';
    const res = FxRules.resolve(Object.assign({}, c, { currency: curCode() }), lookup);
    window.__res = res;
    if (res.error) { $('#res').hidden = true; $('#icdsCard').hidden = true; $('#errBox').innerHTML = `<div class="m-info">${esc(res.error)}</div>`; return; }
    $('#errBox').innerHTML = ''; $('#res').hidden = false;
    $('#resLaw').textContent = P.law === 'IT' ? 'Income-tax' : 'GST';
    const cur = curCode(), amt = num(c.amount);
    let rate = null, rateDate = res.date, srcLine = '', box = '';
    if (res.source === 'customs') {
      const m = lookup(cur, res.date, res.rateKind);
      if (m) { rate = m.rate; rateDate = m.date; srcLine = `${KIND[res.rateKind]} – ${m.src} (in force from ${dmy(m.date)})`; }
      box = `<div class="m-warn">Customs rates are not in the archive. Enter the CBIC notified ${res.rateKind.split('_')[1]} rate in force on ${dmy(res.date)} below, with the notification number – or add it under "Search rates by date" → "Rates added by you" for re-use.</div>`;
    } else if (res.found && res.found.beyond) {
      box = `<div class="m-warn">The archive in this tool runs up to ${dmy(R.asOf)}. Look up ${dmy(res.date)} on officialforexrates.com and enter the rate below (or add it under "Rates added by you").</div>`;
    } else if (res.found) {
      rate = res.found.rate; rateDate = res.found.date; srcLine = `${KIND[res.rateKind]} as on ${dmy(rateDate)} – ${res.found.src}`;
      if (res.found.row) box = rateTable(rateDate, res.found.row, cur, res.rateKind);
    } else if (R.cur.indexOf(cur) < 0 && res.source === 'sbi') {
      box = `<div class="m-warn">The archive has USD, EUR, GBP and JPY only. Enter the SBI ${res.rateKind === 'tt_sell' ? 'TT selling' : 'TT buying'} rate for ${cur} on ${dmy(res.date)} below.</div>`;
    } else if (res.source === 'sbi') box = `<div class="m-warn">No rate found for ${dmy(res.date)} in the archive (it starts on ${dmy(R.from)}). Enter the rate below.</div>`;
    if (c.override) { rate = num(c.override); srcLine = `Rate entered: ${c.override_why || 'reason not stated'}`; }
    const inr = rate ? amt * rate / per(cur) : 0;
    res.rate = rate; res.rateDate = rateDate; res.srcLine = srcLine; res.inr = inr; res.cur = cur; res.amt = amt;
    $('#kpis').innerHTML = `<div><span>Rate to adopt (${esc(KIND[res.rateKind] || '')})</span><b>${rate ? fmt(rate, 4) : '—'}</b>${cur === 'JPY' ? '<span>per 100 JPY</span>' : ''}</div>
      <div><span>Date of the rate</span><b>${dmy(rateDate) || '—'}</b>${rateDate !== res.date ? `<span>statutory date ${dmy(res.date)}</span>` : ''}</div>
      <div><span>Value in rupees${amt ? ` (${cur} ${fmt(amt)})` : ''}</span><b>${inr ? '₹ ' + fmt(inr) : '—'}</b></div>`;
    $('#basis').innerHTML = `<b>Basis:</b> ${esc(res.basis)}`;
    $('#steps').innerHTML = res.steps.map(s => `<li>${esc(s)}</li>`).join('');
    $('#rateBox').innerHTML = box + `<div class="grid" style="margin-top:8px"><div><label>Enter / override the rate</label><input id="ovr" class="num" value="${esc(c.override)}" placeholder="${rate && !c.override ? fmt(rate, 4) : ''}"></div>
      <div class="full"><label>Source / reason for the rate entered</label><input id="ovrWhy" value="${esc(c.override_why)}" placeholder="e.g. CBIC Notification No. … / bank's rate as per books"></div></div>
      ${srcLine ? `<p class="hint">Source: ${esc(srcLine)}</p>` : ''}`;
    $('#ovr').oninput = e => { c.override = e.target.value; save(); clearTimeout(window.__t); window.__t = setTimeout(render, 500); };
    $('#ovrWhy').oninput = e => { c.override_why = e.target.value; save(); };
    $('#notes').innerHTML = res.notes.map(n => `<div class="${/^Check:/.test(n) && !c.override ? 'm-warn' : 'm-info'}">${esc(n)}</div>`).join('');
    renderShot();
    renderIcds(res);
  }
  function rateTable(date, row, cur, kind) {
    return `<div class="tw"><table class="t"><thead><tr><th>SBI rates on ${dmy(date)}</th><th class="n">TT buying</th><th class="n">TT selling</th><th class="n">Bill buying</th><th class="n">Bill selling</th></tr></thead><tbody>` +
      R.cur.map((k, i) => `<tr class="${k === cur ? 'hi' : ''}"><td>${k}/INR${k === 'JPY' ? ' (per 100)' : ''}</td>${[0, 1, 2, 3].map(j => `<td class="n" style="${k === cur && j === COL[kind] ? 'font-weight:700' : ''}">${row[i] && row[i][j] ? fmt(row[i][j]) : '—'}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>';
  }

  /* ---------- ICDS VI: realisation and year end ---------- */
  function renderIcds(res) {
    const show = ['it_icds', 'gst_svc_exp', 'gst_goods_exp'].includes(c.purpose) && res.inr;
    $('#icdsCard').hidden = !show; if (!show) return;
    const base = c.txn_date || c.inv_date || res.date, ye = H.taxYearEnd(base);
    const cl = lookup(res.cur, ye, 'tt_buy');
    $('#closeHint').textContent = cl && !cl.beyond ? `SBI TT buying on ${dmy(cl.date)}: ${fmt(cl.rate, 2)} – leave blank to use it` : `Closing date ${dmy(ye)} – enter the rate (not yet in the archive)`;
    const closeRate = num(c.close_rate) || (cl && !cl.beyond ? cl.rate : 0);
    const inv = res.inr, rows = [];
    const realised = num(c.real_inr), rd = c.real_date;
    const outstandingAtYE = !rd || rd > ye;
    if (outstandingAtYE && closeRate) { const restated = res.amt * closeRate / per(res.cur); rows.push([`Restated at the closing rate ${fmt(closeRate, 4)} on ${dmy(ye)} (tax year ${ye.slice(0, 4) - 1}-${ye.slice(2, 4)})`, restated, restated - inv]);
      if (realised) rows.push([`Realised on ${dmy(rd)} (tax year of realisation)`, realised, realised - restated]); }
    else if (realised) rows.push([`Realised on ${dmy(rd)} (same tax year)`, realised, realised - inv]);
    $('#icdsOut').innerHTML = rows.length ? `<table class="t"><thead><tr><th></th><th class="n">Rupees</th><th class="n">Exchange gain / (loss)</th></tr></thead><tbody><tr><td>Recorded on initial recognition</td><td class="n">${fmt(inv)}</td><td></td></tr>` +
      rows.map(([a, v, g]) => `<tr><td>${esc(a)}</td><td class="n">${fmt(v)}</td><td class="n" style="color:${g < 0 ? 'var(--err)' : 'var(--ok)'}">${g < 0 ? '(' + fmt(-g) + ')' : fmt(g)}</td></tr>`).join('') + '</tbody></table><p class="hint">The exchange difference is income or expenditure of the year (ICDS VI); for GST the value of supply stays at the time-of-supply rate.</p>' : '<p class="hint">Enter the realisation details or the closing rate to work out the exchange difference.</p>';
  }

  /* ---------- screenshot ---------- */
  $('#shotBtn').onclick = () => $('#shotFile').click();
  $('#shotFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) await takeFile(f); };
  document.addEventListener('paste', async e => { if ($('[data-panel=conv]').hidden) return; const it = [...(e.clipboardData || {}).items || []].find(i => i.type.startsWith('image/')); if (it) { e.preventDefault(); await takeFile(it.getAsFile(), 'Pasted screenshot'); } });
  async function takeFile(f, name) {
    if (f.type === 'application/pdf') { c.shot = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); c.shot_name = f.name; }
    else { c.shot = await shrink(f); c.shot_name = name || f.name; }
    save(); renderShot(); $('#outMsgs').innerHTML = `<div class="m-ok">Attached: ${esc(c.shot_name)}</div>`;
  }
  function shrink(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1800 / img.width); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/jpeg', 0.85)); }; img.onerror = rej; img.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); }); }
  function renderShot() { $('#shotDel').hidden = !c.shot; $('#shotView').innerHTML = !c.shot ? '' : c.shot.startsWith('data:image') ? `<img src="${c.shot}" alt="Screenshot of the rate source">` : `<p class="hint">PDF attached: ${esc(c.shot_name)} – it is saved with the case file and listed in the working paper.</p>`; }
  $('#shotDel').onclick = () => { c.shot = ''; c.shot_name = ''; save(); renderShot(); };
  $('#openSrc').onclick = () => window.open('https://officialforexrates.com/', '_blank', 'noopener');

  /* ---------- working paper PDF ---------- */
  function entryFromCurrent() {
    const r = window.__res; if (!r || r.error) return null;
    return { id: Date.now().toString(36), at: new Date().toISOString(), ref: c.ref, purpose: c.purpose, label: r.P.label, law: r.P.law, cur: r.cur, amt: r.amt, rate: r.rate, rateDate: r.rateDate, statDate: r.date,
      kind: KIND[r.rateKind], inr: r.inr, basis: r.basis, steps: r.steps, notes: r.notes, src: r.srcLine, shot: c.shot, shot_name: c.shot_name, icds: $('#icdsCard').hidden ? '' : [...$('#icdsOut').querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent)) };
  }
  function wpPages(doc, e, first) {
    if (!first) doc.addPage();
    let y = 16;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Exchange rate – working paper', 14, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${e.ref || ''}${e.ref ? '   ·   ' : ''}Prepared on ${new Date(e.at).toLocaleDateString('en-IN')}`, 14, y); y += 4;
    doc.autoTable({ startY: y, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 1.6 }, headStyles: { fillColor: [31, 95, 174] }, columnStyles: { 0: { cellWidth: 55, fontStyle: 'bold' } },
      body: [['Law', e.law === 'IT' ? 'Income-tax Act, 2025 / Income-tax Rules, 2026' : 'CGST Act, 2017 / CGST Rules, 2017'], ['Nature', e.label], ['Amount', `${e.cur} ${fmt(e.amt)}`],
        ['Date as per the law', dmy(e.statDate)], ['Rate adopted', e.rate ? `${fmt(e.rate, 4)}${e.cur === 'JPY' ? ' per 100 JPY' : ''} – ${e.kind} as on ${dmy(e.rateDate)}` : 'Not entered'], ['Value in rupees', e.inr ? 'Rs. ' + fmt(e.inr) : '—'],
        ['Source', e.src || '—'], ['Basis', e.basis], ['Working', e.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')], ['Notes', e.notes.join('\n\n') || '—']] });
    y = doc.lastAutoTable.finalY + 4;
    if (e.icds && e.icds.length) { doc.autoTable({ startY: y, theme: 'grid', styles: { fontSize: 8.5 }, headStyles: { fillColor: [31, 95, 174] }, head: [['ICDS VI', 'Rupees', 'Exchange gain / (loss)']], body: e.icds, columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } } }); y = doc.lastAutoTable.finalY + 4; }
    if (e.shot && e.shot.startsWith('data:image')) {
      try { const p = doc.getImageProperties(e.shot); const w = 182, h = Math.min(275 - y, w * p.height / p.width);
        if (h < 60) { doc.addPage(); y = 16; } doc.setFont('helvetica', 'bold'); doc.text('Screenshot of the rate source', 14, y + 4);
        const ww = Math.min(182, (Math.min(260 - y, 250)) * p.width / p.height); doc.addImage(e.shot, 'JPEG', 14, y + 7, ww, ww * p.height / p.width); } catch (err) {}
    } else if (e.shot) { doc.setFont('helvetica', 'italic'); doc.text(`Source document attached separately: ${e.shot_name}`, 14, y + 4); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(110);
    doc.text('Rates: SBI TT rates as archived by officialforexrates.com (independent archive of SBI "to be used as reference rates"); verify against the attached source.', 14, 290); doc.setTextColor(0);
  }
  $('#wp').onclick = () => { const e = entryFromCurrent(); if (!e) return; if (!e.rate) { $('#outMsgs').innerHTML = '<div class="m-err">Enter the rate first.</div>'; return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' }); wpPages(doc, e, true); doc.save(`FX_working_${(e.ref || e.cur).replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40)}_${e.statDate}.pdf`);
    $('#outMsgs').innerHTML = '<div class="m-ok">Working paper downloaded.</div>'; };
  $('#addReg').onclick = () => { const e = entryFromCurrent(); if (!e || !e.rate) { $('#outMsgs').innerHTML = '<div class="m-err">Enter the rate first.</div>'; return; }
    reg.push(e); if (!store.set(K.reg, reg)) $('#outMsgs').innerHTML = '<div class="m-warn">Register is too large for the browser – save the register file.</div>'; else $('#outMsgs').innerHTML = `<div class="m-ok">Added to the register (${reg.length} entries).</div>`; };

  /* ---------- case file ---------- */
  function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  $('#saveCase').onclick = () => download(`FX_case_${(c.ref || 'case').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 40)}.json`, JSON.stringify(Object.assign({ kind: 'fx-case' }, c), null, 1), 'application/json');
  $('#openCase').onclick = () => $('#caseFile').click();
  $('#caseFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const d = JSON.parse(await f.text()); if (d.kind !== 'fx-case') throw 0; c = Object.assign(blank(), d); save(); bind(); render(); } catch (err) { $('#outMsgs').innerHTML = '<div class="m-err">Not an exchange-rate case file.</div>'; } };

  /* ---------- register ---------- */
  function renderReg() {
    $('#regTable').innerHTML = `<thead><tr><th>#</th><th>Reference</th><th>Law / nature</th><th class="n">Amount</th><th>Rate date</th><th class="n">Rate</th><th class="n">Rupees</th><th></th></tr></thead><tbody>` +
      (reg.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.ref)}</td><td>${e.law} – ${esc(e.label.slice(0, 70))}</td><td class="n">${e.cur} ${fmt(e.amt)}</td><td>${dmy(e.rateDate)}</td><td class="n">${fmt(e.rate, 4)}</td><td class="n">${fmt(e.inr)}</td><td><button type="button" class="sm link danger" data-del="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="hint">No entries yet.</td></tr>') + '</tbody>';
  }
  $('#regTable').onclick = e => { const b = e.target.closest('[data-del]'); if (!b) return; reg.splice(+b.dataset.del, 1); store.set(K.reg, reg); renderReg(); };
  $('#regXls').onclick = () => download('FX_register.xls', XlsWrite.build([{ name: 'Register', rows: [['Reference', 'Law', 'Nature', 'Currency', 'Amount', 'Date as per law', 'Rate date', 'Rate type', 'Rate', 'Rupees', 'Basis', 'Source']].concat(reg.map(e => [e.ref, e.law, e.label, e.cur, e.amt, dmy(e.statDate), dmy(e.rateDate), e.kind, e.rate, Math.round(e.inr * 100) / 100, e.basis, e.src])) }]), 'application/vnd.ms-excel');
  $('#regPdf').onclick = () => { if (!reg.length) return; const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' }); reg.forEach((e, i) => wpPages(doc, e, i === 0)); doc.save('FX_working_papers.pdf'); };
  $('#regSave').onclick = () => download('FX_register.json', JSON.stringify({ kind: 'fx-register', reg, my }, null, 1), 'application/json');
  $('#regOpen').onclick = () => $('#regFile').click();
  $('#regFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const d = JSON.parse(await f.text()); if (d.kind !== 'fx-register') throw 0; reg = d.reg || []; my = d.my || my; store.set(K.reg, reg); store.set(K.my, my); renderReg(); } catch (err) { alert('Not a register file.'); } };

  /* ---------- search ---------- */
  $('#cover').textContent = R.asOf ? `archive ${dmy(R.from)} to ${dmy(R.asOf)} · USD, EUR, GBP, JPY` : 'archive not loaded';
  $('#sDate').value = R.asOf || today();
  function renderSearch() {
    const d = $('#sDate').value; if (!d) return;
    let row = R.data[d], at = d, msg = '';
    const pub = row && row.some(x => x && x[0]);
    if (!pub) {
      msg = d > R.asOf ? `The archive runs up to ${dmy(R.asOf)}.` : d < R.from ? `The archive starts on ${dmy(R.from)}.` : `No rates published by SBI on ${dmy(d)}.`;
      if ($('#sPrev').checked) { let x = d; for (let i = 0; i < 25 && x >= R.from; i++) { x = H.addDays(x, -1); const r = R.data[x]; if (r && r.some(y => y && y[0])) { row = r; at = x; break; } } }
    }
    $('#sOut').innerHTML = (msg ? `<div class="msgs"><div class="m-warn">${esc(msg)}${at !== d && row ? ` Last published rates: ${dmy(at)}.` : ''}</div></div>` : '') + (row && row.some(x => x && x[0]) ? rateTable(at, row, '', 'tt_buy') : '');
  }
  $('#sDate').oninput = renderSearch; $('#sPrev').onchange = renderSearch;
  const years = []; for (let y = +(R.from || '2022').slice(0, 4); y <= +(R.asOf || today()).slice(0, 4); y++) years.push(y);
  $('#mYear').innerHTML = years.reverse().map(y => `<option>${y}</option>`).join('');
  function monthRows() {
    const y = +$('#mYear').value, out = [];
    for (let m = 1; m <= 12; m++) { const last = H.iso(new Date(Date.UTC(y, m, 0))); if (last < R.from) continue; if (last > R.asOf) break;
      const vals = R.cur.map(cu => lookup(cu, last, 'tt_buy')); out.push([last, vals]); }
    return out;
  }
  function renderMonth() { const rows = monthRows();
    $('#mTable').innerHTML = `<thead><tr><th>Month end</th>${R.cur.map(cu => `<th class="n">${cu}${cu === 'JPY' ? ' (100)' : ''}</th>`).join('')}</tr></thead><tbody>` + rows.map(([d, v]) => `<tr><td>${dmy(d)}</td>${v.map(x => `<td class="n">${x && x.rate ? fmt(x.rate) + (x.date !== d ? ` <span class="hint">(${dmy(x.date)})</span>` : '') : '—'}</td>`).join('')}</tr>`).join('') + '</tbody>'; }
  $('#mYear').onchange = renderMonth;
  $('#mXls').onclick = () => download(`SBI_TT_buying_month_end_${$('#mYear').value}.xls`, XlsWrite.build([{ name: 'Month end', rows: [['Month end', 'Rate date', ...R.cur]].concat(monthRows().map(([d, v]) => [dmy(d), dmy((v.find(x => x && x.rate) || {}).date || ''), ...v.map(x => x && x.rate ? x.rate : '')])) }]), 'application/vnd.ms-excel');
  function renderMy() { $('#myTable').innerHTML = my.length ? `<thead><tr><th>Date</th><th>Currency</th><th>Type</th><th class="n">Rate</th><th>Source</th><th></th></tr></thead><tbody>` + my.map((r, i) => `<tr><td>${dmy(r.date)}</td><td>${r.cur}</td><td>${KIND[r.kind]}</td><td class="n">${fmt(r.rate, 4)}</td><td>${esc(r.src)}</td><td><button type="button" class="sm link danger" data-mdel="${i}">✕</button></td></tr>`).join('') + '</tbody>' : '<tbody><tr><td class="hint">None yet.</td></tr></tbody>'; }
  $('#myAdd').onclick = () => { const r = { date: $('#myDate').value, cur: $('#myCur').value.trim().toUpperCase(), kind: $('#myKind').value, rate: num($('#myRate').value), src: $('#mySrc').value.trim() };
    if (!r.date || !/^[A-Z]{3}$/.test(r.cur) || !(r.rate > 0)) { alert('Enter the date, a 3-letter currency code and the rate.'); return; }
    my = my.filter(x => !(x.date === r.date && x.cur === r.cur && x.kind === r.kind)).concat([r]).sort((a, b) => a.date.localeCompare(b.date)); store.set(K.my, my); renderMy(); render(); };
  $('#myTable').onclick = e => { const b = e.target.closest('[data-mdel]'); if (!b) return; my.splice(+b.dataset.mdel, 1); store.set(K.my, my); renderMy(); render(); };

  window.FxTool = { state: () => c, set: d => { c = Object.assign(blank(), d); save(); bind(); render(); }, lookup, result: () => window.__res };
  bind(); render();
})();
