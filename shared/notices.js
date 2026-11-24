/*
 * Office notices, holidays and team birthdays – kept in the database folder (or by the tool kit server):
 *   office_notices.json  { kind: 'office-notices', notices: [{ id, text, from, until }] }
 *   office_holidays.json { kind: 'office-holidays', holidays: [{ id, date, name }] }      (Holiday List tool)
 *   team_birthdays.json  { kind: 'team-birthdays', people: [{ id, name, day, month }] }   (day and month only – no year)
 * window.KitNotices = { SEED, HOLIDAY_DAYS, blankNotices(), blankHolidays(), blankBirthdays(), important(n, h, today), birthdaysOn(b, today),
 *                       upcoming(b, today, days), dmy, todayIso, weekday }
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
  const blankNotices = () => ({ kind: 'office-notices', notices: SEED.map(x => Object.assign({}, x)) });
  const blankHolidays = () => ({ kind: 'office-holidays', holidays: [] });
  const HOLIDAY_DAYS = 5;   // a holiday is announced in the Important strip from 5 days before
  const blankBirthdays = () => ({ kind: 'team-birthdays', people: [] });

  /* lines for the "Important" strip today: notices in their dates, and holidays today / in the next 5 days
     (holidays from the Holiday List file; holidays kept in the notices file by version 37 are read as well) */
  function important(n, h, today) {
    today = today || todayIso(); const t = dayNo(today), out = [];
    ((n && n.notices) || []).forEach(x => { if (!String(x.text || '').trim()) return; if (x.from && x.from > today) return; if (x.until && x.until < today) return; out.push(x.text.trim()); });
    const hol = ((h && h.holidays) || []).concat(h && h.holidays && h.holidays.length ? [] : ((n && n.holidays) || []));
    hol.filter(x => x.date && dayNo(x.date) !== null).sort((a, b) => a.date < b.date ? -1 : 1).forEach(x => {
      const d = dayNo(x.date) - t, nm = x.name || 'holiday';
      if (d === 0) out.push(`Today is a holiday \u2013 ${nm}.`);
      else if (d === 1) out.push(`Holiday tomorrow (${weekday(x.date)}, ${dmy(x.date)}) \u2013 ${nm}.`);
      else if (d > 1 && d <= HOLIDAY_DAYS) out.push(`Holiday on ${weekday(x.date)}, ${dmy(x.date)} \u2013 ${nm} (in ${d} days).`);
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
  root.KitNotices = { SEED, HOLIDAY_DAYS, blankNotices, blankHolidays, blankBirthdays, important, birthdaysOn, upcoming, dmy, todayIso, weekday };
})(typeof window !== 'undefined' ? window : globalThis);
