/*
 * Builds the net worth certificate as a PDF with jsPDF + autoTable.
 * window.NWPdf.build(model, opts) -> jsPDF document
 *   model: prepared certificate data (see networth/index.html, certModel())
 *   opts:  { draft, letterhead, firm (letterhead settings), logo (data URL), screenshot (data URL or null) }
 */
(function (root) {
  "use strict";
  const PW = 210, PH = 297, ML = 18, MR = 18, CW = PW - ML - MR;
  const BLUE = [31, 73, 145], RED = [192, 0, 0];

  function build(m, o) {
    const { jsPDF } = root.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const TOP = o.letterhead ? 46 : 50, BOTTOM = PH - 18;
    let y = TOP;
    doc.setFont('times', 'normal');
    const need = h => { if (y + h > BOTTOM) { doc.addPage(); y = TOP; } };
    const text = (t, x, opts) => doc.text(String(t), x, y, opts || {});

    // ---- rich paragraph: [{t, b}] wrapped to width, left aligned
    function rich(parts, size, lineH) {
      doc.setFontSize(size);
      const words = [];
      parts.forEach(p => String(p.t).split(/(\s+)/).forEach(w => { if (w) words.push({ w, b: p.b }); }));
      let line = [], lw = 0;
      const flush = (last) => {
        need(lineH);
        // justify all but the last line
        const gaps = line.filter(x => /^\s+$/.test(x.w)).length;
        let trim = line.slice();
        while (trim.length && /^\s+$/.test(trim[trim.length - 1].w)) trim.pop();
        const natural = trim.reduce((a, x) => a + width(x), 0);
        const extra = !last && gaps ? (CW - natural) / trim.filter(x => /^\s+$/.test(x.w)).length : 0;
        let x = ML;
        trim.forEach(t => { doc.setFont('times', t.b ? 'bold' : 'normal'); if (!/^\s+$/.test(t.w)) doc.text(t.w, x, y); x += width(t) + (/^\s+$/.test(t.w) ? extra : 0); });
        y += lineH; line = []; lw = 0;
      };
      const width = t => { doc.setFont('times', t.b ? 'bold' : 'normal'); return doc.getTextWidth(t.w); };
      words.forEach(t => {
        const w = width(t);
        if (!/^\s+$/.test(t.w) && lw + w > CW && line.length) flush(false);
        if (!line.length && /^\s+$/.test(t.w)) return;
        line.push(t); lw += w;
      });
      if (line.length) flush(true);
      doc.setFont('times', 'normal');
    }
    function title(t) {
      doc.setFont('times', 'bold'); doc.setFontSize(12);
      const w = doc.getTextWidth(t); text(t, PW / 2, { align: 'center' });
      doc.setLineWidth(0.3); doc.line(PW / 2 - w / 2, y + 0.8, PW / 2 + w / 2, y + 0.8);
      y += 6;
    }
    const tableBase = { theme: 'plain', margin: { left: ML, right: MR, top: TOP, bottom: 20 }, styles: { font: 'times', fontSize: 10.5, cellPadding: { top: 1.2, bottom: 1.2, left: 1.5, right: 1.5 }, textColor: 20, overflow: 'linebreak' } };

    function signature() {
      need(62);
      doc.setFont('times', 'normal'); doc.setFontSize(10.5);
      text(`Conversion Rate assumed 1 ${m.cur} = ${m.rate} INR${m.rateNote ? ' ' + m.rateNote : ''}`, ML); y += 8;
      const cx = ML + CW * 0.72;
      const lines = [['As per Information and Documents', 0], ['Produced before us.', 0], [`For ${m.firm_name}`, 1], [m.firm_tag, 1]];
      lines.forEach(([t, b]) => { doc.setFont('times', b ? 'bold' : 'normal'); text(t, cx, { align: 'center' }); y += 4.6; });
      y += 12;
      const y0 = y;
      doc.setFont('times', 'normal'); text(m.place, ML); y += 4.6; text(m.date, ML);
      y = y0;
      [[`(${m.signatory_upper})`, 1], [m.designation, 1], [`Membership No: ${m.membership_no}`, 1], [`UDIN: ${m.udin}`, 0]].forEach(([t, b]) => {
        doc.setFont('times', b ? 'bold' : 'normal'); text(t, cx, { align: 'center' }); y += 4.6;
      });
      y += 4;
    }

    // ================= page 1: certificate
    title('CHARTERED ACCOUNTANT’S CERTIFICATE');
    title('TO WHOMSOEVER IT MAY CONCERN');
    y += 3;
    rich([{ t: 'I, ' }, { t: `${m.signatory_title} ${m.signatory_upper}`, b: 1 }, { t: `, ${m.member_text}, certify that I have reviewed the financial condition of ` },
          { t: m.persons_text, b: 1 }, { t: ', residing at ' }, { t: m.address_inline, b: 1 },
          { t: ` with a view of establishing their ability to meet ${m.purpose}${m.cost_text || ''}.` }], 10.5, 5);
    y += 4;
    doc.autoTable(Object.assign({}, tableBase, {
      startY: y,
      head: [['Source of Funds', m.cur, 'INR']],
      body: m.summary.map(s => [`${s.n}.  ${s.title}`, s.fc, s.inr]),
      foot: [['TOTAL', `${m.total_fc} ${m.cur}`, m.total_inr]],
      columnStyles: { 0: { cellWidth: CW * 0.56 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
      headStyles: { fontStyle: 'bold', lineWidth: { top: 0.3, bottom: 0.3 }, lineColor: 0 },
      footStyles: { fontStyle: 'bold', lineWidth: { top: 0.3, bottom: 0.3 }, lineColor: 0 },
      didParseCell: d => { if (d.section !== 'body' && d.column.index > 0) d.cell.styles.halign = 'right'; },
    }));
    y = doc.lastAutoTable.finalY + 6;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5);
    need(10);
    doc.text(doc.splitTextToSize(`(In Words Rupees ${m.total_inr_words} only)`, CW), ML, y); y += 4.8 * doc.splitTextToSize(`(In Words Rupees ${m.total_inr_words} only)`, CW).length;
    doc.text(doc.splitTextToSize(`(In words ${m.cur} ${m.total_fc_words} only)`, CW), ML, y); y += 4.8 * doc.splitTextToSize(`(In words ${m.cur} ${m.total_fc_words} only)`, CW).length + 4;
    signature();

    // ================= annexure
    doc.addPage(); y = TOP;
    doc.setFont('times', 'normal'); doc.setFontSize(10.5);
    text('The following documents were reviewed to support the above statement:-', ML); y += 8;
    m.sections.forEach(s => {
      need(20);
      doc.setFont('times', 'bold'); doc.setFontSize(10.5);
      const h = `${s.annex_title} (Amt. in Rs.)`;
      doc.setLineWidth(0.3); doc.rect(ML, y - 4.2, CW, 6.2); text(h, ML + 1.5); y += 8;
      s.groups.forEach(g => {
        if (g.sub) { y += 4; need(12); doc.setFont('times', 'bold'); doc.setFontSize(10.5); text(g.sub, ML); y += 2; }
        doc.autoTable(Object.assign({}, tableBase, {
          startY: y, body: g.items.map(it => m.has_ref ? [it.desc, it.ref, it.amount] : [it.desc, it.amount]),
          columnStyles: m.has_ref ? { 0: { cellWidth: CW * 0.56 }, 1: { cellWidth: CW * 0.24 }, 2: { halign: 'right', valign: 'bottom' } }
                                  : { 0: { cellWidth: CW * 0.78 }, 1: { halign: 'right', valign: 'bottom' } },
          bodyStyles: { cellPadding: { top: 1.6, bottom: 1.6, left: 0, right: 1.5 } },
        }));
        y = doc.lastAutoTable.finalY + 2;
      });
      doc.autoTable(Object.assign({}, tableBase, {
        startY: y, body: [['Total', `${s.fc} ${m.cur}`, s.inr]],
        columnStyles: { 0: { cellWidth: CW * 0.56, halign: 'center' }, 1: { halign: 'right' }, 2: { halign: 'right' } },
        bodyStyles: { fontStyle: 'bold', lineWidth: { top: 0.3, bottom: 0.3 }, lineColor: 0 },
      }));
      y = doc.lastAutoTable.finalY + 8;
    });
    signature();

    // ================= rate source (optional page)
    if (o.screenshot) {
      doc.addPage(); y = TOP;
      doc.setFont('times', 'bold'); doc.setFontSize(11);
      text(`Source of the conversion rate – 1 ${m.cur} = ${m.rate} INR${m.rate_date ? ' as on ' + m.rate_date : ''}`, ML); y += 5;
      if (m.rate_source) { doc.setFont('times', 'normal'); text(m.rate_source, ML); y += 4; }
      try {
        const p = doc.getImageProperties(o.screenshot);
        const maxW = CW, maxH = BOTTOM - y - 4;
        const k = Math.min(maxW / p.width, maxH / p.height);
        doc.addImage(o.screenshot, ML, y + 2, p.width * k, p.height * k);
      } catch (e) { doc.setFont('times', 'normal'); text('(The screenshot could not be added.)', ML); }
    }

    // ================= letterhead, page numbers, watermark on every page
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      if (o.letterhead) letterhead(doc, o.firm || {}, o.logo);
      doc.setFont('times', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90);
      doc.text(`Page ${i} of ${n}`, PW / 2, PH - 10, { align: 'center' });
      if (o.draft) doc.text('DRAFT FOR CONFIRMATION – not to be relied upon', ML, PH - 10);
      doc.setTextColor(0);
      if (o.draft) watermark(doc, o.watermarkAngle || 0);
    }
    return doc;
  }

  function letterhead(doc, f, logo) {
    doc.setTextColor(...BLUE); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(f.name || '', ML, 15);
    doc.setTextColor(...RED); doc.setFontSize(8.5);
    doc.text(f.tag || '', ML, 19.5);
    doc.setTextColor(...BLUE); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    if (f.email) { doc.text(f.email, ML, 30); doc.setDrawColor(...BLUE); doc.setLineWidth(0.15); doc.line(ML, 30.6, ML + doc.getTextWidth(f.email), 30.6); }
    doc.setTextColor(30);
    if (f.mobile) doc.text(f.mobile, ML, 34);
    if (logo) { try { doc.addImage(logo, 'PNG', PW / 2 - 10.5, 9, 21, 18.3); } catch (e) {} }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30);
    (f.address || '').split(/\n/).forEach((l, i) => doc.text(l, PW - MR, 12 + i * 3.8, { align: 'right' }));
    doc.setDrawColor(0); doc.setLineWidth(0.9); doc.line(ML - 4, 38.5, PW - MR + 4, 38.5);
    doc.setTextColor(0); doc.setDrawColor(0);
  }

  function watermark(doc, angle) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.13 }));
    doc.setFont('helvetica', 'bold');
    // largest size that keeps "DRAFT" inside the page width (horizontal) or diagonal
    const span = angle ? Math.hypot(PW, PH) * 0.75 : PW * 0.88;
    let size = 200; doc.setFontSize(size);
    size = size * span / doc.getTextWidth('DRAFT'); doc.setFontSize(size);
    doc.setTextColor(120);
    const w = doc.getTextWidth('DRAFT'), hgt = size * 0.3528 * 0.7;
    if (!angle) doc.text('DRAFT', PW / 2 - w / 2, PH / 2 + hgt / 2);
    else {
      const a = angle * Math.PI / 180;
      doc.text('DRAFT', PW / 2 - Math.cos(a) * w / 2 - Math.sin(a) * hgt / 2, PH / 2 + Math.sin(a) * w / 2 - Math.cos(a) * hgt / 2 + hgt, { angle });
    }
    doc.restoreGraphicsState();
    doc.setTextColor(0);
  }

  /* Self declaration by the client for gold jewellery (working paper).
     d: { name, pan, address, date, place, purpose, firm, items: [{desc, purity, weight, rate_gm, value}], total_weight, total_value, rate_date, rate_source, words } */
  function goldDeclaration(d) {
    const { jsPDF } = root.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    let y = 30;
    doc.setFont('times', 'bold'); doc.setFontSize(13);
    doc.text('SELF DECLARATION – GOLD JEWELLERY', PW / 2, y, { align: 'center' });
    const tw = doc.getTextWidth('SELF DECLARATION – GOLD JEWELLERY'); doc.setLineWidth(0.3); doc.line(PW / 2 - tw / 2, y + 0.8, PW / 2 + tw / 2, y + 0.8);
    y += 14;
    doc.setFont('times', 'normal'); doc.setFontSize(11);
    const para = t => { const ls = doc.splitTextToSize(t, CW); doc.text(ls, ML, y, { align: 'justify', maxWidth: CW }); y += ls.length * 5.4 + 4; };
    para(`I, ${d.name}${d.pan ? ` (PAN: ${d.pan})` : ''}, residing at ${d.address}, hereby declare that the gold jewellery described below is owned by me / my family and is in my possession as on ${d.date}.`);
    doc.autoTable({
      startY: y, theme: 'grid', margin: { left: ML, right: MR },
      styles: { font: 'times', fontSize: 10.5, textColor: 20, lineColor: 120, lineWidth: 0.2, cellPadding: 1.8 },
      headStyles: { fillColor: [235, 235, 235], fontStyle: 'bold', halign: 'center' },
      head: [['S.No.', 'Description of the jewellery', 'Purity', 'Weight (grams)', 'Rate per gram (Rs.)', 'Value (Rs.)']],
      body: d.items.map((it, i) => [i + 1, it.desc, it.purity, it.weight, it.rate_gm, it.value]),
      foot: [['', 'Total', '', d.total_weight, '', d.total_value]],
      footStyles: { fillColor: [235, 235, 235], fontStyle: 'bold', textColor: 20 },
      columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 62 }, 2: { cellWidth: 20 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      didParseCell: c => { if (c.section === 'foot' && c.column.index >= 3) c.cell.styles.halign = 'right'; },
    });
    y = doc.lastAutoTable.finalY + 8;
    para(`(Total value: Rupees ${d.words} only)`);
    para(`The value is arrived at by applying the rate per gram stated above${d.rate_date ? `, being the rate as on ${d.rate_date}` : ''}${d.rate_source ? ` (source: ${d.rate_source})` : ''}.`);
    para(`I furnish this declaration to ${d.firm} for the purpose of the net worth certificate being issued${d.purpose ? ` in connection with ${d.purpose}` : ''}. I declare that the above particulars are true and correct to the best of my knowledge and belief.`);
    y += 14;
    doc.text(`Place: ${d.place}`, ML, y); doc.text('Signature', PW - MR, y, { align: 'right' }); y += 6;
    doc.text(`Date: ${d.date}`, ML, y); doc.setFont('times', 'bold'); doc.text(`(${d.name})`, PW - MR, y + 8, { align: 'right' });
    return doc;
  }

  root.NWPdf = { build, goldDeclaration };
})(window);
