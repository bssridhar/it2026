/*
 * Desk calculator – a floating, draggable 12-digit calculator for the practice tool kit.
 *   Keys: digits, 00, ., + − × ÷ =, %, √, +/−, → (backspace), CE, AC, M+, M−, MRC, GT
 *   %    : a × b % = a×b/100 · a ÷ b % = a÷b×100 · a + b % = a plus b% of a · a − b % = a less b% of a
 *   =    : pressing again repeats the last operation (e.g. 100 + 5 = = = gives 105, 110, 115)
 *   GT   : every = or % result is added to the grand total; GT shows it, GT twice clears it
 *   MRC  : recalls memory; MRC twice clears memory. M+ / M− complete a pending sum first
 *   Tape : every entry and result, with Copy; "Use" puts the display into the field last used on the page
 * Keyboard (when the calculator has focus): 0-9 . + - * / Enter = % Backspace Delete(CE) Esc(AC)
 * A small "Calculator" box with flashing text sits at the bottom left of every page; clicking it opens the
 * calculator, and closing the calculator brings the box back. Also opens from any element with data-calc-open,
 * or window.PTCalc.toggle(). Add <script src="../shared/calc.js"></script> to every tool page.
 */
(function () {
  "use strict";
  const MAXD = 12;
  const LS = 'pt-calc-v1';
  const store = { get(d) { try { return Object.assign(d, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { return d; } },
                  set(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (e) {} } };
  const pref = store.get({ x: null, y: null, open: false, grouping: 'indian', tape: true, mem: 0, gt: 0 });

  const css = `
#ptc{position:fixed;z-index:50;width:290px;background:#2b2f36;color:#eef0f3;border-radius:14px;box-shadow:0 10px 32px rgba(0,0,0,.35);font:14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;user-select:none;outline:none}
#ptc[hidden]{display:none}
#ptc:focus-within,#ptc:focus{box-shadow:0 0 0 2px #6ea6ec,0 10px 32px rgba(0,0,0,.35)}
#ptc .hd{display:flex;align-items:center;gap:6px;padding:8px 10px;cursor:move;font-weight:600;font-size:.85rem;color:#c9ced8}
#ptc .hd span{flex:1}
#ptc .hd button{background:none;border:none;color:#c9ced8;font-size:.8rem;padding:2px 6px;border-radius:4px;cursor:pointer}
#ptc .hd button:hover{background:#3a404a}
#ptc .scr{margin:0 10px;background:#c9d5bd;color:#1b2414;border-radius:6px;padding:6px 10px 4px;font-variant-numeric:tabular-nums}
#ptc .ind{display:flex;gap:10px;font-size:.7rem;font-weight:700;min-height:14px;letter-spacing:.04em}
#ptc .ind b{opacity:.15}#ptc .ind b.on{opacity:1}
#ptc .num{font:600 1.75rem/1.2 "Consolas","Menlo",monospace;text-align:right;white-space:nowrap;overflow:hidden}
#ptc .keys{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:10px}
#ptc .keys button{height:38px;border:none;border-radius:7px;background:#454c57;color:#fff;font:600 1rem system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 0 #1e2126}
#ptc .keys button:active{transform:translateY(1px);box-shadow:none}
#ptc .keys .fn{background:#5b6472;font-size:.82rem}
#ptc .keys .op{background:#6b5a3a}
#ptc .keys .cl{background:#8a3b3b}
#ptc .keys .eq{background:#2f6f4a;grid-row:span 2;height:auto}
#ptc .ft{display:flex;gap:6px;padding:0 10px 10px;font-size:.78rem}
#ptc .ft button{flex:1;border:none;border-radius:6px;background:#3a404a;color:#dfe3ea;padding:6px;cursor:pointer}
#ptc .tape{margin:0 10px 10px;background:#f7f5ee;color:#222;border-radius:6px;max-height:150px;overflow:auto;padding:6px 10px;font:12.5px/1.45 "Consolas","Menlo",monospace;user-select:text}
#ptc .tape div{display:flex;justify-content:space-between;gap:8px}
#ptc .tape .r{font-weight:700;border-bottom:1px dashed #aaa;margin-bottom:3px}
#ptc .tape:empty::before{content:"Tape is empty";color:#999}
#ptc .note{font-size:.72rem;color:#aeb5c1;padding:0 10px 8px}
#ptcLaunch{position:fixed;left:16px;bottom:16px;z-index:49;display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:10px;border:1px solid #1f5fae;background:#fff;color:#1f5fae;font:700 14px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.18);cursor:pointer}
#ptcLaunch[hidden]{display:none}
@media (max-width:1280px){#ptcLaunch{bottom:76px}}
#ptcLaunch .ico{font-size:17px;line-height:1}
#ptcLaunch .txt{animation:ptcBlink 1.1s steps(1,end) infinite}
#ptcLaunch:hover .txt,#ptcLaunch:focus-visible .txt{animation:none}
@keyframes ptcBlink{0%{opacity:1}50%{opacity:.15}}
@media (prefers-color-scheme:dark){#ptcLaunch{background:#1d2128;color:#6ea6ec;border-color:#6ea6ec}}
@media (prefers-reduced-motion:reduce){#ptcLaunch .txt{animation:ptcPulse 2.4s ease-in-out infinite}@keyframes ptcPulse{50%{opacity:.55}}}
@media print{#ptc,#ptcLaunch{display:none!important}}`;

  let el, numEl, tapeEl, indEl, noteEl, launch;
  // calculator state
  let entry = '0', fresh = true, acc = null, op = null, lastOp = null, lastArg = null, err = false, prevKey = '';
  let mem = Number(pref.mem) || 0, gt = Number(pref.gt) || 0;
  let lastField = null;

  const round = n => { if (!isFinite(n)) return n; const r = Number(n.toPrecision(15)); return Math.abs(r) < 1e-12 ? 0 : r; };
  function toEntry(n) {
    // fit into 12 digits
    if (!isFinite(n)) return null;
    const ip = Math.trunc(Math.abs(n)).toString().length;
    if (ip > MAXD) return null;
    let s = (+n.toFixed(Math.max(0, MAXD - ip))).toString();
    if (/e/.test(s)) s = Number(n).toFixed(Math.max(0, MAXD - ip)).replace(/\.?0+$/, '');
    return s;
  }
  function group(s) {
    if (s === null) return 'E';
    const neg = s.startsWith('-'); if (neg) s = s.slice(1);
    let [i, d] = s.split('.');
    if (pref.grouping === 'indian' && i.length > 3) i = i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + i.slice(-3);
    else if (pref.grouping === 'intl') i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + i + (d !== undefined ? '.' + d : '');
  }
  const cur = () => Number(entry);
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  function apply(a, o, b) {
    switch (o) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b === 0 ? NaN : a / b; }
    return b;
  }
  function tape(left, right, cls) {
    if (!tapeEl) return;
    const d = document.createElement('div'); if (cls) d.className = cls;
    d.innerHTML = '<span></span><span></span>'; d.children[0].textContent = left; d.children[1].textContent = right;
    tapeEl.appendChild(d); tapeEl.scrollTop = tapeEl.scrollHeight;
  }
  function setResult(n) {
    const s = toEntry(round(n));
    if (s === null || isNaN(n)) { err = true; entry = '0'; tape('Error', 'E', 'r'); return false; }
    entry = s; fresh = true; return true;
  }
  function save() { pref.mem = mem; pref.gt = gt; store.set(pref); }
  function show() {
    numEl.textContent = err ? 'E' : group(entry);
    const on = { M: mem !== 0, GT: gt !== 0, E: err, OP: !!op };
    indEl.innerHTML = `<b class="${on.M ? 'on' : ''}">M</b><b class="${on.GT ? 'on' : ''}">GT</b><b class="${on.E ? 'on' : ''}">E</b><b class="${on.OP ? 'on' : ''}">${op ? SYM[op] : '+'}</b><span style="flex:1"></span><span>${pref.grouping === 'indian' ? '12,34,567' : pref.grouping === 'intl' ? '1,234,567' : '1234567'}</span>`;
    save();
  }

  function equals(fromPct) {
    let res;
    if (op) {
      const b = fresh ? (acc !== null ? acc : cur()) : cur();
      tape(group(toEntry(b)), '=');
      res = apply(acc, op, b); lastOp = op; lastArg = b; op = null; acc = null;
    } else if (lastOp && !fromPct) {
      const a = cur(); tape(group(entry), SYM[lastOp]); tape(group(toEntry(lastArg)), '=');
      res = apply(a, lastOp, lastArg);
    } else { return; }
    if (setResult(res)) { gt = round(gt + Number(entry)); tape(group(entry), '*', 'r'); }
  }

  function press(k) {
    if (err && k !== 'AC') { flash('Press AC to clear the error'); return; }
    switch (k) {
      case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9': case '00': case '.':
        if (fresh) { entry = '0'; fresh = false; if (!op) { lastOp = null; } }
        if (k === '.') { if (!entry.includes('.')) entry += '.'; break; }
        if (entry.replace(/[-.]/g, '').length + k.length > MAXD) break;
        entry = entry === '0' ? (k === '00' ? '0' : k) : entry === '-0' ? '-' + k : entry + k;
        break;
      case '+': case '-': case '*': case '/':
        if (op && fresh) { const l = tapeEl && tapeEl.lastChild; if (l && l.children[1]) l.children[1].textContent = SYM[k]; }   // operator changed
        else if (op) { tape(group(entry), SYM[k]); if (!setResult(apply(acc, op, cur()))) break; acc = cur(); }                // chained: 100 + 50 ×
        else { acc = cur(); tape(group(entry), SYM[k]); }
        op = k; fresh = true;
        break;
      case '=': equals(false); break;
      case '%': {
        if (!op) { flash('% works after × ÷ + or −  (e.g. 2,500 × 18 %)'); break; }
        const a = acc, b = cur(); let res;
        if (op === '*') res = a * b / 100; else if (op === '/') res = b === 0 ? NaN : a / b * 100;
        else if (op === '+') res = a + a * b / 100; else res = a - a * b / 100;
        tape(group(entry), '%'); op = null; acc = null; lastOp = null;
        if (setResult(res)) { gt = round(gt + Number(entry)); tape(group(entry), '*', 'r'); }
        break;
      }
      case 'sqrt': if (cur() < 0) { err = true; break; } tape(group(entry), '√'); setResult(Math.sqrt(cur())); break;
      case 'neg': if (entry !== '0') entry = entry.startsWith('-') ? entry.slice(1) : '-' + entry; break;
      case 'back': if (!fresh) { entry = entry.length > 1 && entry !== '-0' ? entry.slice(0, -1) : '0'; if (entry === '-') entry = '0'; } break;
      case 'CE': entry = '0'; fresh = false; break;
      case 'AC': entry = '0'; fresh = true; acc = null; op = null; lastOp = null; lastArg = null; err = false; if (tapeEl && tapeEl.lastChild && !tapeEl.lastChild.classList.contains('r')) tape('', 'C', 'r'); break;
      case 'M+': case 'M-':
        if (op) equals(false);
        if (err) break;
        mem = round(mem + (k === 'M+' ? 1 : -1) * cur()); fresh = true; tape(group(entry), k === 'M+' ? 'M+' : 'M−'); break;
      case 'MRC':
        if (prevKey === 'MRC') { mem = 0; tape('', 'MC'); flash('Memory cleared'); }
        else { setResult(mem); tape(group(entry), 'MR'); }
        break;
      case 'GT':
        if (prevKey === 'GT') { gt = 0; tape('', 'GT clear'); flash('Grand total cleared'); }
        else { setResult(gt); tape(group(entry), 'GT', 'r'); }
        break;
    }
    prevKey = k; show();
  }
  let ft = null;
  function flash(t) { noteEl.textContent = t; clearTimeout(ft); ft = setTimeout(() => { noteEl.textContent = ''; }, 2600); }

  const KEYS = [
    ['GT', 'GT', 'fn'], ['MRC', 'MRC', 'fn'], ['M−', 'M-', 'fn'], ['M+', 'M+', 'fn'], ['√', 'sqrt', 'fn'],
    ['→', 'back', 'fn'], ['+/−', 'neg', 'fn'], ['%', '%', 'fn'], ['CE', 'CE', 'cl'], ['AC', 'AC', 'cl'],
    ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '/', 'op'], ['×', '*', 'op'],
    ['4', '4'], ['5', '5'], ['6', '6'], ['−', '-', 'op'], ['=', '=', 'eq'],
    ['1', '1'], ['2', '2'], ['3', '3'], ['+', '+', 'op'],
    ['0', '0'], ['00', '00'], ['.', '.'],
  ];
  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    el = document.createElement('div'); el.id = 'ptc'; el.tabIndex = 0; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Calculator');
    el.innerHTML = `<div class="hd"><span>Calculator</span><button type="button" data-a="grp" title="Comma style: Indian / international / none">Commas</button><button type="button" data-a="tape" title="Show / hide the tape">Tape</button><button type="button" data-a="close" title="Close" aria-label="Close">✕</button></div>
      <div class="scr"><div class="ind"></div><div class="num">0</div></div>
      <div class="keys"></div><div class="note"></div>
      <div class="ft"><button type="button" data-a="use" title="Put the displayed figure into the field you last used on the page">Use in field</button><button type="button" data-a="copy">Copy</button><button type="button" data-a="copytape">Copy tape</button><button type="button" data-a="cleartape">Clear tape</button></div>
      <div class="tape"></div>`;
    const kb = el.querySelector('.keys');
    // arrange: '=' spans two rows in column 5 of rows 4-5; '+' sits in column 4 of row 5
    KEYS.forEach(([t, k, cls]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.k = k; if (cls) b.className = cls; kb.appendChild(b); });
    const eq = kb.querySelector('[data-k="="]'); eq.style.gridColumn = '5'; eq.style.gridRow = '4 / span 3';
    kb.querySelector('[data-k="+"]').style.gridRow = '5 / span 2'; kb.querySelector('[data-k="+"]').style.height = 'auto'; kb.querySelector('[data-k="+"]').style.gridColumn = '4';
    numEl = el.querySelector('.num'); tapeEl = el.querySelector('.tape'); indEl = el.querySelector('.ind'); noteEl = el.querySelector('.note');
    tapeEl.hidden = !pref.tape;
    kb.addEventListener('mousedown', e => e.preventDefault());
    kb.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { press(b.dataset.k); el.focus(); } });
    el.querySelector('.hd').addEventListener('click', e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'close') toggle(false);
      if (a === 'tape') { pref.tape = tapeEl.hidden; tapeEl.hidden = !pref.tape; store.set(pref); }
      if (a === 'grp') { pref.grouping = { indian: 'intl', intl: 'none', none: 'indian' }[pref.grouping] || 'indian'; show(); }
    });
    el.querySelector('.ft').addEventListener('click', e => {
      const a = e.target.dataset.a; if (!a) return;
      if (a === 'copy') copy(entry, 'Copied ' + entry);
      if (a === 'copytape') copy([...tapeEl.children].map(d => `${d.children[0].textContent.padStart(20)}  ${d.children[1].textContent}`).join('\n'), 'Tape copied');
      if (a === 'cleartape') tapeEl.innerHTML = '';
      if (a === 'use') {
        if (!lastField || !document.contains(lastField) || lastField.disabled || lastField.readOnly) { flash('Click in a field on the page first, then press "Use in field"'); return; }
        lastField.value = lastField.type === 'number' ? String(Number(entry)) : entry;
        lastField.dispatchEvent(new Event('input', { bubbles: true })); lastField.dispatchEvent(new Event('change', { bubbles: true }));
        flash('Entered ' + entry);
      }
    });
    el.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) { if ((e.ctrlKey || e.metaKey) && e.key === 'c') copy(entry, 'Copied ' + entry); return; }
      const map = { Enter: '=', '=': '=', Backspace: 'back', Delete: 'CE', Escape: 'AC', '%': '%', '+': '+', '-': '-', '*': '*', '/': '/', x: '*', X: '*', '.': '.', ',': '.' };
      const k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
      if (!k) return;
      e.preventDefault(); press(k);
    });
    // drag
    const hd = el.querySelector('.hd');
    hd.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'BUTTON') return;
      const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      hd.setPointerCapture(e.pointerId);
      const mv = ev => place(ev.clientX - ox, ev.clientY - oy);
      const up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); const r2 = el.getBoundingClientRect(); pref.x = r2.left; pref.y = r2.top; store.set(pref); };
      hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up);
    });
    document.body.appendChild(el);
    show();
  }
  function place(x, y) {
    const w = el.offsetWidth || 290, h = el.offsetHeight || 420;
    el.style.left = Math.max(0, Math.min(window.innerWidth - w, x)) + 'px';
    el.style.top = Math.max(0, Math.min(window.innerHeight - 40, y)) + 'px';
    el.style.right = el.style.bottom = 'auto';
    void h;
  }
  function copy(t, m) {
    const done = () => flash(m);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallback());
    else fallback();
    function fallback() { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); el.focus(); }
  }
  function toggle(force) {
    if (!el) build();
    const open = force === undefined ? el.hidden : force;
    el.hidden = !open; pref.open = open; store.set(pref);
    if (launch) launch.hidden = open;
    if (open) { if (pref.x === null) place(16, window.innerHeight - el.offsetHeight - 16); else place(pref.x, pref.y); el.focus(); }
  }
  document.addEventListener('focusin', e => {
    const t = e.target;
    if (el && el.contains(t)) return;
    if (t.matches && t.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=date]), textarea')) lastField = t;
  });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-calc-open]'); if (b) { e.preventDefault(); toggle(); } });
  window.addEventListener('resize', () => { if (el && !el.hidden) place(el.getBoundingClientRect().left, el.getBoundingClientRect().top); });
  function init() {
    if (!el) build();
    launch = document.createElement('button');
    launch.type = 'button'; launch.id = 'ptcLaunch'; launch.title = 'Open the calculator';
    launch.innerHTML = '<svg class="ico" aria-hidden="true" width="16" height="18" viewBox="0 0 16 18"><rect x="1" y="1" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="3.5" width="8" height="3" rx=".5" fill="currentColor"/><g fill="currentColor"><circle cx="5" cy="9.5" r="1"/><circle cx="8" cy="9.5" r="1"/><circle cx="11" cy="9.5" r="1"/><circle cx="5" cy="13" r="1"/><circle cx="8" cy="13" r="1"/><circle cx="11" cy="13" r="1"/></g></svg><span class="txt">Calculator</span>';
    launch.addEventListener('click', () => toggle(true));
    document.body.appendChild(launch);
    if (pref.open) toggle(true); else launch.hidden = false;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.PTCalc = { toggle, press };
})();
