/**
 * DSC Register – Google Apps Script back end.
 * The Google Sheet this script is attached to is the database.
 * Paste this file as Code.gs and Index.html as a file named "Index" (see SETUP.md).
 */

var SHEETS = {
  dscs: { name: 'DSC Register', cols: [
    ['no', 'DSC No', 'int'], ['name', 'Name of holder'], ['company', 'Associated company / firm'], ['designation', 'Designation'],
    ['pan', 'PAN', 'text'], ['mobile', 'Mobile', 'text'], ['email', 'E-mail'], ['cls', 'Class'], ['type', 'Type'], ['issuer', 'Issued by'],
    ['token', 'Token', 'text'], ['issueDate', 'Date of issue', 'date'], ['expiry', 'Date of expiry', 'date'], ['location', 'Kept at'],
    ['status', 'Status'], ['withWhom', 'With whom'], ['remarks', 'Remarks'], ['updatedAt', 'Last updated', 'dt'], ['updatedBy', 'Updated by'],
    ['rev', 'Revision', 'int']] },
  moves: { name: 'Movements', cols: [
    ['id', 'Entry ID', 'text'], ['no', 'DSC No', 'int'], ['at', 'Date & time', 'dt'], ['kindText', 'Movement'], ['person', 'Person'],
    ['purpose', 'Purpose'], ['by', 'Recorded by'], ['remarks', 'Remarks']] },
  renewals: { name: 'Renewals', cols: [
    ['id', 'Entry ID', 'text'], ['no', 'DSC No', 'int'], ['date', 'Date of renewal', 'date'], ['oldExpiry', 'Old expiry', 'date'],
    ['newExpiry', 'New expiry', 'date'], ['validity', 'Validity (years)', 'int'], ['issuer', 'Issued by'], ['cls', 'Class'],
    ['tokenNote', 'Token'], ['fee', 'Fee (Rs.)', 'num'], ['invoice', 'Invoice no.', 'text'], ['paid', 'Payment'], ['remarks', 'Remarks'],
    ['by', 'Recorded by'], ['at', 'Recorded at', 'dt']] },
  reminders: { name: 'Reminders', cols: [
    ['id', 'Entry ID', 'text'], ['no', 'DSC No', 'int'], ['at', 'Date & time', 'dt'], ['channel', 'Sent by'], ['by', 'Sent by (staff)'],
    ['expiry', 'Expiry at the time', 'date']] }
};
var KIND = { OUT_CLIENT: 'Given to client', IN_CLIENT: 'Received from client', OUT_OTHER: 'Given to staff / others', IN_OTHER: 'Returned to office' };
var SETTINGS_SHEET = 'Settings';
var DEFAULT_SETTINGS = {
  days: '15',
  firm: 'B S Sridhar & Co., Chartered Accountants',
  emailSubject: 'Digital signature certificate {status_text} – {name}',
  message: 'Dear {name},\n\nThe digital signature certificate (DSC No. {dsc_no}) issued in your name{company_text} {status_text} on {expiry}.\n\n' +
           'A valid DSC is needed to sign returns and forms filed online. Please let us know whether you would like it renewed, ' +
           'so that the renewal can be completed before the due date.\n\nRegards,\n{firm}',
  digestTo: '',
  outDaysAlert: '7'
};

/* ------------------------------------------------------------------ web app */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('DSC Register')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('DSC Register')
    .addItem('1. Set up the sheets', 'setupSheets')
    .addItem('2. Turn on the daily e-mail', 'installDailyDigest')
    .addItem('Send the daily e-mail now', 'sendDailyDigest')
    .addItem('Turn off the daily e-mail', 'removeDailyDigest')
    .addToUi();
}

/* ------------------------------------------------------------------ setup */
function setupSheets() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (k) {
    var def = SHEETS[k];
    var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    var head = def.cols.map(function (c) { return c[1]; });
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#e3e8f0');
    sh.setFrozenRows(1);
    def.cols.forEach(function (c, i) {
      var fmt = c[2] === 'date' ? 'dd/mm/yyyy' : c[2] === 'dt' ? 'dd/mm/yyyy hh:mm' : c[2] === 'text' ? '@' : null;
      if (fmt) sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat(fmt);
    });
  });
  var st = ss.getSheetByName(SETTINGS_SHEET) || ss.insertSheet(SETTINGS_SHEET);
  if (st.getLastRow() < 1) {
    var rows = [['Setting', 'Value']];
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) { rows.push([k, DEFAULT_SETTINGS[k]]); });
    st.getRange(1, 1, rows.length, 2).setValues(rows);
    st.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  return 'Sheets are ready.';
}

/* ------------------------------------------------------------------ helpers */
function tz_() { return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'Asia/Kolkata'; }
function now_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd'T'HH:mm:ss"); }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function who_() {
  var e = '';
  try { e = Session.getActiveUser().getEmail(); } catch (err) {}
  return e || 'unknown user';
}
function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 14); }
function sheet_(k) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS[k].name);
  if (!sh) throw new Error('The sheet "' + SHEETS[k].name + '" is missing. Use the menu DSC Register > Set up the sheets.');
  return sh;
}
/** Sheet cell -> plain value used by the page (dates as yyyy-mm-dd, date-times as yyyy-mm-ddThh:mm:ss). */
function fromCell_(v, t) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, tz_(), t === 'dt' ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
  }
  if (t === 'int' || t === 'num') return Number(String(v).replace(/,/g, '')) || 0;
  if (t === 'date' || t === 'dt') {
    var s = String(v).trim(), m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      var p = function (n) { return ('0' + n).slice(-2); };
      var d = m[3] + '-' + p(m[2]) + '-' + p(m[1]);
      return t === 'dt' ? d + 'T' + p(m[4] || 0) + ':' + (m[5] || '00') + ':' + (m[6] || '00') : d;
    }
    return s;
  }
  return String(v);
}
/** Page value -> cell value (dates become real dates so the sheet shows and sorts them properly). */
function toCell_(v, t) {
  if (v === '' || v === null || v === undefined) return '';
  if (t === 'date' || t === 'dt') {
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return String(v);
  }
  if (t === 'int' || t === 'num') return Number(v) || 0;
  return String(v);
}
function readAll_(k) {
  var def = SHEETS[k], sh = sheet_(k), last = sh.getLastRow();
  var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var idx = def.cols.map(function (c) { return head.indexOf(c[1].toLowerCase()); });
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, head.length).getValues();
  var out = [];
  vals.forEach(function (row, r) {
    var o = { _row: r + 2 }, any = false;
    def.cols.forEach(function (c, i) {
      if (idx[i] < 0) return;
      var v = fromCell_(row[idx[i]], c[2]);
      if (v !== '' && v !== 0) any = true;
      o[c[0]] = v;
    });
    if (any) out.push(o);
  });
  return out;
}
function rowFor_(k, o) {
  var sh = sheet_(k);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var row = head.map(function () { return ''; });
  SHEETS[k].cols.forEach(function (c) {
    var i = head.indexOf(c[1].toLowerCase());
    if (i >= 0) row[i] = toCell_(o[c[0]], c[2]);
  });
  return row;
}
function append_(k, o) { var sh = sheet_(k); var row = rowFor_(k, o); sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]); }
function write_(k, rowNo, o) { var row = rowFor_(k, o); sheet_(k).getRange(rowNo, 1, 1, row.length).setValues([row]); }
function settings_() {
  var s = {}; Object.keys(DEFAULT_SETTINGS).forEach(function (k) { s[k] = DEFAULT_SETTINGS[k]; });
  var sh = SpreadsheetApp.getActive().getSheetByName(SETTINGS_SHEET);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { if (r[0]) s[String(r[0])] = String(r[1]); });
  return s;
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function findDsc_(no) {
  var list = readAll_('dscs');
  for (var i = 0; i < list.length; i++) if (Number(list[i].no) === Number(no)) return list[i];
  return null;
}
function strip_(list) { return list.map(function (o) { var c = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') c[k] = o[k]; }); return c; }); }

/* ------------------------------------------------------------------ API used by the page */
function getAll() {
  var moves = readAll_('moves').map(function (m) {
    var kind = 'IN_OTHER';
    Object.keys(KIND).forEach(function (k) { if (KIND[k].toLowerCase() === String(m.kindText).toLowerCase()) kind = k; });
    m.kind = kind; return m;
  });
  return { dscs: strip_(readAll_('dscs')), moves: strip_(moves), renewals: strip_(readAll_('renewals')), reminders: strip_(readAll_('reminders')),
           settings: settings_(), user: who_(), today: today_(), sheetUrl: SpreadsheetApp.getActive().getUrl() };
}

/** Add or edit a DSC. originalNo is null for a new DSC. expectRev (the revision the user opened) guards against overwriting someone else's change. */
function saveDsc(d, originalNo, expectRev) {
  return withLock_(function () {
    d.no = Number(d.no);
    if (!d.no || d.no < 1) throw new Error('Enter a DSC number of 1 or more.');
    if (!d.name) throw new Error('Enter the name of the holder.');
    if (!d.expiry) throw new Error('Enter the date of expiry.');
    var list = readAll_('dscs');
    var current = originalNo ? list.filter(function (x) { return Number(x.no) === Number(originalNo); })[0] : null;
    if (originalNo && !current) throw new Error('DSC No. ' + originalNo + ' is no longer in the register. Refresh the page.');
    if (current && Number(current.rev || 0) !== Number(expectRev || 0))
      throw new Error('Someone else changed DSC No. ' + originalNo + ' (' + (current.updatedBy || '') + ', ' + current.updatedAt + ') after you opened it. The page has been refreshed – please make your change again.');
    var clash = list.filter(function (x) { return Number(x.no) === d.no && x !== current; })[0];
    if (clash) throw new Error('DSC No. ' + d.no + ' is already used by ' + clash.name + '.');
    d.updatedAt = now_(); d.updatedBy = who_(); d.rev = current ? Number(current.rev || 0) + 1 : 1;
    if (current) {
      write_('dscs', current._row, d);
      if (Number(originalNo) !== d.no) renumberLogs_(Number(originalNo), d.no);
    } else append_('dscs', d);
    return getAll();
  });
}
function renumberLogs_(from, to) {
  ['moves', 'renewals', 'reminders'].forEach(function (k) {
    var sh = sheet_(k), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).toLowerCase(); });
    var col = head.indexOf('dsc no') + 1;
    if (col < 1 || sh.getLastRow() < 2) return;
    var rng = sh.getRange(2, col, sh.getLastRow() - 1, 1), v = rng.getValues();
    v.forEach(function (r) { if (Number(r[0]) === from) r[0] = to; });
    rng.setValues(v);
  });
}
function addMove(m) {
  return withLock_(function () {
    var d = findDsc_(m.no);
    if (!d) throw new Error('DSC No. ' + m.no + ' not found. Refresh the page.');
    m.id = uid_(); m.by = who_(); m.kindText = KIND[m.kind] || m.kind; if (!m.at) m.at = now_();
    append_('moves', m);
    d.status = m.kind === 'OUT_CLIENT' ? 'With client' : m.kind === 'OUT_OTHER' ? 'With staff / others' : 'In office';
    d.withWhom = String(m.kind).indexOf('OUT') === 0 ? (m.person || '') : '';
    d.updatedAt = now_(); d.updatedBy = who_(); d.rev = Number(d.rev || 0) + 1;
    write_('dscs', d._row, d);
    var all = getAll(); all.lastMoveId = m.id; return all;
  });
}
function addRenewal(r) {
  return withLock_(function () {
    var d = findDsc_(r.no);
    if (!d) throw new Error('DSC No. ' + r.no + ' not found. Refresh the page.');
    if (!r.date || !r.newExpiry) throw new Error('Enter the date of renewal and the new date of expiry.');
    r.id = uid_(); r.by = who_(); r.at = now_(); r.oldExpiry = d.expiry || '';
    append_('renewals', r);
    d.expiry = r.newExpiry; d.issueDate = r.date; if (r.issuer) d.issuer = r.issuer; if (r.cls) d.cls = r.cls;
    d.updatedAt = now_(); d.updatedBy = who_(); d.rev = Number(d.rev || 0) + 1;
    write_('dscs', d._row, d);
    return getAll();
  });
}
function addReminder(r) {
  return withLock_(function () {
    var d = findDsc_(r.no);
    r.id = uid_(); r.by = who_(); r.at = now_(); r.expiry = d ? d.expiry : '';
    append_('reminders', r);
    return getAll();
  });
}
function markPaid(id) {
  return withLock_(function () {
    var list = readAll_('renewals'), r = list.filter(function (x) { return x.id === id; })[0];
    if (!r) throw new Error('Renewal entry not found. Refresh the page.');
    r.paid = 'Received'; write_('renewals', r._row, r);
    return getAll();
  });
}
function saveSettings(s) {
  return withLock_(function () {
    var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(SETTINGS_SHEET) || ss.insertSheet(SETTINGS_SHEET);
    var cur = settings_();
    Object.keys(s).forEach(function (k) { if (k in DEFAULT_SETTINGS) cur[k] = String(s[k]); });
    var rows = [['Setting', 'Value']];
    Object.keys(cur).forEach(function (k) { rows.push([k, cur[k]]); });
    sh.clearContents();
    sh.getRange(1, 1, rows.length, 2).setValues(rows);
    return getAll();
  });
}

/* ------------------------------------------------------------------ daily e-mail to the office */
function dueList_(days) {
  var t = today_(), tDate = new Date(t + 'T00:00:00');
  return readAll_('dscs').filter(function (d) { return d.status !== 'Inactive' && d.expiry; }).map(function (d) {
    d.days = Math.round((new Date(d.expiry + 'T00:00:00') - tDate) / 864e5); return d;
  }).filter(function (d) { return d.days <= days; }).sort(function (a, b) { return a.days - b.days; });
}
function sendDailyDigest() {
  var s = settings_();
  var to = String(s.digestTo || '').trim() || Session.getEffectiveUser().getEmail();
  var due = dueList_(Number(s.days) || 15);
  var outDays = Number(s.outDaysAlert) || 7, t = new Date(today_() + 'T00:00:00');
  var moves = getAll().moves;
  var out = readAll_('dscs').filter(function (d) { return d.status === 'With client' || d.status === 'With staff / others'; }).map(function (d) {
    var m = moves.filter(function (x) { return Number(x.no) === Number(d.no); }).sort(function (a, b) { return a.at < b.at ? 1 : -1; })[0];
    d.since = m ? m.at : ''; d.outFor = d.since ? Math.round((t - new Date(d.since.slice(0, 10) + 'T00:00:00')) / 864e5) : 0; return d;
  }).filter(function (d) { return d.outFor >= outDays; });
  if (!due.length && !out.length) return 'Nothing to report today.';
  var esc = function (x) { return String(x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  var fmt = function (iso) { return iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''; };
  var html = '<p>DSC register – ' + fmt(today_()) + '</p>';
  if (due.length) {
    html += '<p><b>Expired or expiring within ' + (Number(s.days) || 15) + ' days</b></p><table border="1" cellpadding="4" cellspacing="0">' +
      '<tr><th>No.</th><th>Name</th><th>Company</th><th>Expiry</th><th>Status</th><th>Mobile</th></tr>' +
      due.map(function (d) { return '<tr><td>' + d.no + '</td><td>' + esc(d.name) + '</td><td>' + esc(d.company) + '</td><td>' + fmt(d.expiry) +
        (d.days < 0 ? ' (expired)' : ' (' + d.days + ' days)') + '</td><td>' + esc(d.status) + '</td><td>' + esc(d.mobile) + '</td></tr>'; }).join('') + '</table>';
  }
  if (out.length) {
    html += '<p><b>Out of the office for ' + outDays + ' days or more</b></p><table border="1" cellpadding="4" cellspacing="0">' +
      '<tr><th>No.</th><th>Name</th><th>With</th><th>Since</th></tr>' +
      out.map(function (d) { return '<tr><td>' + d.no + '</td><td>' + esc(d.name) + '</td><td>' + esc(d.withWhom) + '</td><td>' + fmt(d.since) + ' (' + d.outFor + ' days)</td></tr>'; }).join('') + '</table>';
  }
  html += '<p>Open the DSC Register to send reminders or record renewals.</p>';
  MailApp.sendEmail({ to: to, subject: 'DSC register: ' + due.length + ' expiring / expired, ' + out.length + ' out of office', htmlBody: html });
  return 'E-mail sent to ' + to + '.';
}
function installDailyDigest() {
  removeDailyDigest();
  ScriptApp.newTrigger('sendDailyDigest').timeBased().everyDays(1).atHour(8).create();
  return 'The daily e-mail is on (around 8 am).';
}
function removeDailyDigest() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sendDailyDigest') ScriptApp.deleteTrigger(t); });
  return 'The daily e-mail is off.';
}
