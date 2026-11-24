/*
 * Office notices, holidays and team birthdays – kept in the database folder (or by the tool kit server):
 *   office_notices.json  { kind: 'office-notices', notices: [{ id, text, from, until }], holidays: [{ id, date, name }] }
 *   team_birthdays.json  { kind: 'team-birthdays', people: [{ id, name, day, month }] }   (day and month only – no year)
 * window.KitNotices = { SEED, blankNotices(), blankBirthdays(), important(n, today), birthdaysOn(b, today), upcoming(b, today, days), dmy, todayIso }
 */
(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dmy = iso => iso ? iso.split('-').reverse().join('-') : '';
  const dayNo = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; };
  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekday = iso => WD[new Date(iso + 'T00:00:00Z').getUTCDay()];

  /* the notices to start with (shown until their dates) */
  const SEED = [
    { id: 'seed-roc', text: 'ROC filing is due on 30th Dec 2026. Let’s complete it before the due date.', from: '', until: '2026-12-30' },
    { id: 'seed-gst9', text: 'GST Form 9 & 9C – Annual return due date 31st Dec 2026. Let’s complete it before the due date.', from: '', until: '2026-12-31' }
  ];
  const blankNotices = () => ({ kind: 'office-notices', notices: SEED.map(x => Object.assign({}, x)), holidays: [] });
  const blankBirthdays = () => ({ kind: 'team-birthdays', people: [] });

  /* lines for the "Important" strip today: notices in their dates, and holidays today / in the next 10 days */
  function important(n, today) {
    today = today || todayIso(); const t = dayNo(today), out = [];
    ((n && n.notices) || []).forEach(x => { if (!String(x.text || '').trim()) return; if (x.from && x.from > today) return; if (x.until && x.until < today) return; out.push(x.text.trim()); });
    ((n && n.holidays) || []).filter(h => h.date && dayNo(h.date) !== null).sort((a, b) => a.date < b.date ? -1 : 1).forEach(h => {
      const d = dayNo(h.date) - t;
      if (d === 0) out.push(`Today is a holiday – ${h.name || 'holiday'}.`);
      else if (d === 1) out.push(`Tomorrow (${weekday(h.date)}, ${dmy(h.date)}) is a holiday – ${h.name || 'holiday'}.`);
      else if (d > 1 && d <= 10) out.push(`Holiday on ${weekday(h.date)}, ${dmy(h.date)} – ${h.name || 'holiday'}.`);
    });
    return out;
  }
  /* team members whose birthday is on this date */
  function birthdaysOn(b, today) {
    today = today || todayIso(); const [, m, d] = today.split('-').map(Number);
    return ((b && b.people) || []).filter(p => +p.day === d && +p.month === m && String(p.name || '').trim()).map(p => p.name.trim());
  }
  /* birthdays in the next <days> days (for the editing page) */
  function upcoming(b, today, days) {
    today = today || todayIso(); const t = dayNo(today), y = +today.slice(0, 4), out = [];
    ((b && b.people) || []).forEach(p => {
      if (!p.day || !p.month) return;
      for (const yy of [y, y + 1]) { const iso = `${yy}-${pad(p.month)}-${pad(p.day)}`, d = dayNo(iso) - t; if (d >= 0 && d <= days) { out.push({ name: p.name, date: iso, inDays: d }); break; } }
    });
    return out.sort((a, b) => a.inDays - b.inDays);
  }
  root.KitNotices = { SEED, blankNotices, blankBirthdays, important, birthdaysOn, upcoming, dmy, todayIso, weekday };
})(typeof window !== 'undefined' ? window : globalThis);
