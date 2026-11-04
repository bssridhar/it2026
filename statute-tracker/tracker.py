#!/usr/bin/env python3
"""Statute Update Tracker - core engine.

Checks the official government web pages listed in config.json, finds items
(notifications, circulars, advisories, press releases ...) that were not on the
page at the previous check, and writes a report.

Only Python 3.8+ standard library is used, so nothing needs to be installed.

Command line:
    python tracker.py check            check all enabled websites now
    python tracker.py check --email    check, then e-mail the report (if set up)
    python tracker.py test URL         show what the tool reads from one page
    python tracker.py list             list statutes and websites
"""

import datetime as _dt
import hashlib
import html
import http.cookiejar
import json
import os
import re
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
DATA_DIR = os.path.join(BASE_DIR, "data")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
STATE_PATH = os.path.join(DATA_DIR, "state.json")
UPDATES_PATH = os.path.join(DATA_DIR, "updates.json")
LAST_RUN_PATH = os.path.join(DATA_DIR, "last_run.json")
EMAIL_PATH = os.path.join(DATA_DIR, "email_settings.json")
LOCK_PATH = os.path.join(DATA_DIR, "check.lock")

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 StatuteUpdateTracker/1.0")
TIMEOUT = 45
MAX_BYTES = 15 * 1024 * 1024
MAX_SEEN_PER_SOURCE = 6000
MAX_UPDATES_KEPT = 5000
DOC_EXT = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".rtf", ".odt")
GENERIC_TEXT = {
    "", "click here", "here", "download", "view", "pdf", "english", "hindi", "more",
    "read more", "view more", "details", "open", "link", "new", "file", "view pdf",
    "download pdf", "click", "attachment", "see more", "know more", "view details",
    "english version", "hindi version", "eng", "hin",
}
DEFAULT_ALLOWED = ["gov.in", "nic.in", "rbi.org.in"]

_io_lock = threading.RLock()


# --------------------------------------------------------------------- files
def _ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)


def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default
    except (ValueError, OSError):
        # keep a copy of an unreadable file instead of silently losing it
        try:
            os.replace(path, path + ".broken")
        except OSError:
            pass
        return default


def write_json(path, obj):
    _ensure_dirs()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def now_ist():
    return _dt.datetime.now(_dt.timezone(_dt.timedelta(hours=5, minutes=30)))


def fmt_dt(iso):
    try:
        d = _dt.datetime.fromisoformat(iso)
        return d.strftime("%d-%m-%Y %I:%M %p")
    except (TypeError, ValueError):
        return iso or ""


# -------------------------------------------------------------------- config
def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return s[:40] or "item"


def load_config():
    cfg = read_json(CONFIG_PATH, None)
    if not cfg:
        cfg = {"allowed_domains": list(DEFAULT_ALLOWED), "check_on_open": True, "statutes": []}
    cfg.setdefault("allowed_domains", list(DEFAULT_ALLOWED))
    cfg.setdefault("check_on_open", True)
    cfg.setdefault("statutes", [])
    return cfg


def host_allowed(url, allowed_domains):
    try:
        p = urllib.parse.urlsplit(url)
    except ValueError:
        return False
    if p.scheme not in ("http", "https") or not p.hostname:
        return False
    host = p.hostname.lower().rstrip(".")
    for d in allowed_domains:
        d = d.lower().strip().lstrip(".")
        if d and (host == d or host.endswith("." + d)):
            return True
    return False


def validate_config(cfg):
    """Return (clean_config, list_of_errors). Fills in missing ids."""
    errors = []
    allowed = [d.strip().lower().lstrip(".") for d in cfg.get("allowed_domains", []) if d and d.strip()]
    allowed = [d for d in allowed if re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", d)]
    if not allowed:
        errors.append("At least one allowed government domain is needed.")
    out = {
        "allowed_domains": allowed,
        "check_on_open": bool(cfg.get("check_on_open", True)),
        "statutes": [],
    }
    st_ids, src_ids = set(), set()
    for st in cfg.get("statutes", []):
        name = (st.get("name") or "").strip()
        if not name:
            errors.append("A statute has no name.")
            continue
        sid = st.get("id") or slugify(name)
        base, n = sid, 2
        while sid in st_ids:
            sid, n = "%s-%d" % (base, n), n + 1
        st_ids.add(sid)
        clean_st = {"id": sid, "name": name, "sources": []}
        for src in st.get("sources", []):
            sname = (src.get("name") or "").strip()
            url = (src.get("url") or "").strip()
            if not sname or not url:
                errors.append("%s: every website needs a name and a URL." % name)
                continue
            if not host_allowed(url, allowed):
                errors.append("%s - %s: %s is not on the list of allowed government domains."
                              % (name, sname, url))
                continue
            rid = src.get("id") or slugify(sid + "-" + sname)
            base, n = rid, 2
            while rid in src_ids:
                rid, n = "%s-%d" % (base, n), n + 1
            src_ids.add(rid)
            typ = src.get("type") or "auto"
            if typ not in ("auto", "html", "rss"):
                typ = "auto"
            clean_st["sources"].append({
                "id": rid, "name": sname, "url": url, "type": typ,
                "keywords": (src.get("keywords") or "").strip(),
                "exclude": (src.get("exclude") or "").strip(),
                "legacy_tls": bool(src.get("legacy_tls", False)),
                "enabled": bool(src.get("enabled", True)),
                "note": (src.get("note") or "").strip(),
            })
        out["statutes"].append(clean_st)
    return out, errors


def save_config(cfg):
    clean, errors = validate_config(cfg)
    if errors:
        return None, errors
    with _io_lock:
        write_json(CONFIG_PATH, clean)
    return clean, []


# --------------------------------------------------------------------- fetch
class GovOnlyRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed):
        super().__init__()
        self.allowed = allowed

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        newurl = urllib.parse.urljoin(req.full_url, newurl)
        if not host_allowed(newurl, self.allowed):
            raise urllib.error.URLError(
                "The page redirected to %s, which is not an allowed government domain." % newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url, allowed, legacy_tls=False):
    """Return (final_url, text, content_type). Raises on failure."""
    if not host_allowed(url, allowed):
        raise ValueError("%s is not an allowed government domain." % url)
    ctx = ssl.create_default_context()
    if legacy_tls:
        # Some government servers use old TLS settings. Certificates are still verified.
        ctx.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
        try:
            ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
        except ssl.SSLError:
            pass
    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ctx),
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),
        GovOnlyRedirect(allowed),
    )
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
    })
    last_err = None
    for attempt in range(3):
        try:
            with opener.open(req, timeout=TIMEOUT) as resp:
                final_url = resp.geturl()
                if not host_allowed(final_url, allowed):
                    raise ValueError("Ended at %s, not an allowed government domain." % final_url)
                raw = resp.read(MAX_BYTES + 1)[:MAX_BYTES]
                ctype = resp.headers.get("Content-Type", "")
                charset = resp.headers.get_content_charset()
            break
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code in (400, 401, 403, 404, 410):
                raise
        except (urllib.error.URLError, OSError, ValueError) as e:
            last_err = e
            if isinstance(e, ValueError):
                raise
        time.sleep(2 * (attempt + 1))
    else:
        raise last_err
    if not charset:
        m = re.search(rb'charset=["\']?([A-Za-z0-9_-]+)', raw[:4000])
        charset = m.group(1).decode("ascii") if m else "utf-8"
    try:
        text = raw.decode(charset, errors="replace")
    except LookupError:
        text = raw.decode("utf-8", errors="replace")
    return final_url, text, ctype


def describe_error(e):
    if isinstance(e, urllib.error.HTTPError):
        hints = {403: "the website refused the request (it may block automated access or "
                      "access from outside India)",
                 404: "page not found - the website may have moved this page; edit the URL"}
        return "HTTP %s: %s" % (e.code, hints.get(e.code, e.reason))
    if isinstance(e, urllib.error.URLError):
        r = e.reason
        if isinstance(r, ssl.SSLError):
            return ("Secure connection failed (%s). Try ticking 'Old TLS settings' for this "
                    "website." % r)
        return "Could not connect: %s" % r
    if isinstance(e, (TimeoutError, OSError)) and "timed out" in str(e):
        return "The website did not respond in time."
    return str(e) or e.__class__.__name__


# --------------------------------------------------------------------- parse
class PageParser(HTMLParser):
    CONTAINERS = {"tr", "li", "p", "dd", "dt", "h1", "h2", "h3", "h4", "h5", "h6", "td"}
    SKIP = {"script", "style", "noscript", "template", "svg", "head"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.cur = None
        self.skip = 0
        self.stack = []
        self.text = []
        self.title_parts = []
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self.in_title = True
        if tag in self.SKIP:
            self.skip += 1
            return
        if tag in self.CONTAINERS:
            if self.stack and self.stack[-1]["tag"] == tag and tag in ("tr", "li", "p", "td"):
                self._pop(len(self.stack) - 1)
            self.stack.append({"tag": tag, "parts": [], "links": []})
        if tag == "a":
            a = dict(attrs)
            href = (a.get("href") or "").strip()
            if self.cur is not None:
                self._end_link()
            if href:
                self.cur = {"href": href, "parts": [], "title": (a.get("title") or "").strip(),
                            "stack": [c for c in self.stack]}

    def handle_startendtag(self, tag, attrs):
        if tag in ("br", "img"):
            return
        self.handle_starttag(tag, attrs)
        if tag not in self.CONTAINERS and tag != "a":
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag in self.SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if tag == "a" and self.cur is not None:
            self._end_link()
        if tag in self.CONTAINERS:
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i]["tag"] == tag:
                    self._pop(i)
                    break

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)
        if self.skip:
            return
        s = " ".join(data.split())
        if not s:
            return
        self.text.append(s)
        for c in self.stack:
            if sum(len(p) for p in c["parts"]) < 600:
                c["parts"].append(s)
        if self.cur is not None:
            self.cur["parts"].append(s)

    def _end_link(self):
        link = self.cur
        self.cur = None
        link["text"] = " ".join(" ".join(link.pop("parts")).split())
        stack = link.pop("stack")
        link["context"] = ""
        self.links.append(link)
        # remember the innermost row / list item so we can add its text later
        for c in reversed(stack):
            if c["tag"] in ("tr", "li", "p", "dd", "dt"):
                c["links"].append(link)
                break
        else:
            if stack:
                stack[-1]["links"].append(link)

    def _pop(self, index):
        while len(self.stack) > index:
            c = self.stack.pop()
            ctx = " ".join(" ".join(c["parts"]).split())[:400]
            for link in c["links"]:
                if not link["context"]:
                    link["context"] = ctx

    def close(self):
        super().close()
        if self.cur is not None:
            self._end_link()
        self._pop(0)


DATE_PATTERNS = [
    r"\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b",
    r"\b(?:19|20)\d{2}-\d{2}-\d{2}\b",
    r"\b\d{1,2}(?:st|nd|rd|th)?[ -](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[ ,.-]+(?:19|20)\d{2}\b",
    r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2},? (?:19|20)\d{2}\b",
]
_DATE_RE = re.compile("|".join(DATE_PATTERNS), re.I)


def find_date(*texts):
    for t in texts:
        if t:
            m = _DATE_RE.search(t)
            if m:
                return m.group(0)
    return ""


def _is_doc(url):
    path = urllib.parse.urlsplit(url).path.lower()
    return path.endswith(DOC_EXT)


def _split_terms(s):
    return [t.strip().lower() for t in re.split(r"[,;|\n]", s or "") if t.strip()]


def _strip_fragment(url):
    return urllib.parse.urldefrag(url)[0]


def parse_html(text, base_url, allowed):
    p = PageParser()
    try:
        p.feed(text)
        p.close()
    except Exception:  # very broken HTML - use what was read
        pass
    page_url = _strip_fragment(base_url)
    items = []
    for link in p.links:
        href = link["href"]
        if href.lower().startswith(("javascript:", "mailto:", "tel:", "#", "data:")):
            continue
        try:
            url = _strip_fragment(urllib.parse.urljoin(base_url, href))
        except ValueError:
            continue
        if url == page_url or not host_allowed(url, allowed):
            continue
        t = link["text"]
        if len(t) < 12 or t.lower().strip(" .:>»") in GENERIC_TEXT:
            better = link["context"] or link["title"]
            if better and len(better) > len(t):
                t = better
        if len(t) < 12 and link["title"] and len(link["title"]) > len(t):
            t = link["title"]
        if len(t) < 12 and not _is_doc(url):
            continue  # menus, icons and short navigation links
        if not t:
            t = urllib.parse.unquote(os.path.basename(urllib.parse.urlsplit(url).path))
        items.append({"title": t[:400], "url": url,
                      "date": find_date(link["text"], link["context"])})
    visible = " ".join(p.text)
    page_title = " ".join(" ".join(p.title_parts).split())
    return items, visible, page_title


def _local(tag):
    return tag.rsplit("}", 1)[-1].lower()


def parse_feed(text, base_url, allowed):
    t = text.lstrip("﻿ \r\n\t")
    t = re.sub(r"^<\?xml[^>]*\?>", "", t).strip()
    root = ET.fromstring(t)
    items = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        title = link = date = desc = ""
        for ch in el:
            name = _local(ch.tag)
            if name == "title":
                title = "".join(ch.itertext())
            elif name == "link":
                link = ch.get("href") or (ch.text or "")
            elif name in ("pubdate", "updated", "published", "date"):
                date = (ch.text or "").strip()
            elif name in ("description", "summary"):
                desc = "".join(ch.itertext())
        title = " ".join(html.unescape(title).split())
        link = link.strip()
        if not link:
            continue
        url = urllib.parse.urljoin(base_url, link)
        if not host_allowed(url, allowed):
            continue
        if not title:
            title = " ".join(re.sub(r"<[^>]+>", " ", html.unescape(desc)).split())[:200] or url
        items.append({"title": title[:400], "url": url, "date": date[:40]})
    ch_title = ""
    for el in root.iter():
        if _local(el.tag) == "title":
            ch_title = " ".join("".join(el.itertext()).split())
            break
    return items, "", ch_title


def looks_like_feed(text, ctype):
    head = text.lstrip("﻿ \r\n\t")[:600].lower()
    if "<html" in head:
        return False
    return ("xml" in (ctype or "").lower() or head.startswith("<?xml")
            or "<rss" in head or "<feed" in head)


def extract_items(source, allowed):
    """Fetch one website and return a dict with items (after filters)."""
    final_url, text, ctype = fetch(source["url"], allowed, source.get("legacy_tls", False))
    typ = source.get("type", "auto")
    if typ == "rss" or (typ == "auto" and looks_like_feed(text, ctype)):
        try:
            items, visible, title = parse_feed(text, final_url, allowed)
        except ET.ParseError:
            if typ == "rss":
                raise ValueError("This page is not a valid RSS/Atom feed.")
            items, visible, title = parse_html(text, final_url, allowed)
    else:
        items, visible, title = parse_html(text, final_url, allowed)
    found = len(items)
    kw = _split_terms(source.get("keywords"))
    ex = _split_terms(source.get("exclude"))
    out, seen = [], set()
    for it in items:
        hay = (it["title"] + " " + it["url"]).lower()
        if kw and not any(k in hay for k in kw):
            continue
        if ex and any(k in hay for k in ex):
            continue
        key = item_key(it)
        if key in seen:
            continue
        seen.add(key)
        it["key"] = key
        out.append(it)
    page_hash = hashlib.sha256(visible.encode("utf-8", "replace")).hexdigest() if visible else ""
    return {"final_url": final_url, "items": out, "found_before_filter": found,
            "page_title": title, "page_hash": page_hash}


def item_key(it):
    norm = re.sub(r"\s+", " ", it["title"].lower()).strip()
    return hashlib.sha1((it["url"] + "|" + norm).encode("utf-8")).hexdigest()[:20]


# --------------------------------------------------------------------- check
def _check_source(statute, source, allowed, src_state, today):
    res = {"statute_id": statute["id"], "statute": statute["name"],
           "source_id": source["id"], "source": source["name"], "url": source["url"],
           "status": "ok", "new_items": [], "total_items": 0, "error": "",
           "note": source.get("note", "")}
    try:
        data = extract_items(source, allowed)
    except Exception as e:  # report the problem, carry on with other websites
        res["status"] = "error"
        res["error"] = describe_error(e)
        return res, src_state
    items = data["items"]
    res["total_items"] = len(items)
    fingerprint = "|".join([source["url"], source.get("type", "auto"),
                            source.get("keywords", ""), source.get("exclude", "")])
    first_time = not src_state or src_state.get("fingerprint") != fingerprint
    seen = {} if first_time else dict(src_state.get("seen", {}))
    new = []
    for it in items:
        if it["key"] not in seen:
            seen[it["key"]] = today
            if not first_time:
                new.append(it)
    if len(seen) > MAX_SEEN_PER_SOURCE:
        ordered = sorted(seen.items(), key=lambda kv: kv[1], reverse=True)
        seen = dict(ordered[:MAX_SEEN_PER_SOURCE])
    if first_time:
        res["status"] = "baseline"
    elif not items:
        old_hash = src_state.get("page_hash", "")
        if data["page_hash"] and old_hash and data["page_hash"] != old_hash:
            res["status"] = "changed"
        else:
            res["status"] = "no-items"
    res["new_items"] = new
    new_state = {"fingerprint": fingerprint, "seen": seen, "page_hash": data["page_hash"],
                 "last_ok": now_ist().isoformat(timespec="seconds")}
    return res, new_state


class CheckBusy(Exception):
    pass


def _acquire_lock():
    _ensure_dirs()
    try:
        fd = os.open(LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(time.time()).encode())
        os.close(fd)
        return True
    except FileExistsError:
        try:
            if time.time() - os.path.getmtime(LOCK_PATH) > 30 * 60:
                os.remove(LOCK_PATH)
                return _acquire_lock()
        except OSError:
            pass
        return False


def _release_lock():
    try:
        os.remove(LOCK_PATH)
    except OSError:
        pass


def run_check(only_source=None, progress=None):
    """Check all enabled websites (or one). Returns the run summary dict."""
    if not _acquire_lock():
        raise CheckBusy("A check is already running.")
    try:
        cfg = load_config()
        allowed = cfg["allowed_domains"]
        state = read_json(STATE_PATH, {})
        started = now_ist()
        today = started.date().isoformat()
        jobs = []
        for st in cfg["statutes"]:
            for src in st["sources"]:
                if only_source and src["id"] != only_source:
                    continue
                if not only_source and not src.get("enabled", True):
                    continue
                jobs.append((st, src))
        results = []
        done = [0]

        def work(job):
            st, src = job
            r, s = _check_source(st, src, allowed, state.get(src["id"]), today)
            with _io_lock:
                done[0] += 1
                if progress:
                    progress(done[0], len(jobs), src["name"])
            return r, s

        with ThreadPoolExecutor(max_workers=6) as pool:
            for (st, src), (r, s) in zip(jobs, pool.map(work, jobs)):
                results.append(r)
                if r["status"] != "error":
                    state[src["id"]] = s
                else:
                    prev = state.get(src["id"]) or {}
                    prev["last_error"] = r["error"]
                    state[src["id"]] = prev
        # forget state of websites that were deleted
        live_ids = {s["id"] for st in cfg["statutes"] for s in st["sources"]}
        state = {k: v for k, v in state.items() if k in live_ids}
        finished = now_ist()
        summary = {"started": started.isoformat(timespec="seconds"),
                   "finished": finished.isoformat(timespec="seconds"),
                   "only_source": only_source or "",
                   "results": results}
        with _io_lock:
            write_json(STATE_PATH, state)
            updates = read_json(UPDATES_PATH, [])
            stamp = finished.isoformat(timespec="seconds")
            for r in results:
                for it in r["new_items"]:
                    updates.append({"detected": stamp, "statute_id": r["statute_id"],
                                    "statute": r["statute"], "source_id": r["source_id"],
                                    "source": r["source"], "title": it["title"],
                                    "url": it["url"], "date": it.get("date", "")})
            write_json(UPDATES_PATH, updates[-MAX_UPDATES_KEPT:])
            write_json(LAST_RUN_PATH, summary)
            write_report(summary, cfg)
        return summary
    finally:
        _release_lock()


def test_source(source):
    """Read one page without changing anything. Used by the Test button."""
    cfg = load_config()
    allowed = cfg["allowed_domains"]
    try:
        data = extract_items(source, allowed)
    except Exception as e:
        return {"ok": False, "error": describe_error(e)}
    return {"ok": True, "final_url": data["final_url"], "page_title": data["page_title"],
            "count": len(data["items"]), "found_before_filter": data["found_before_filter"],
            "sample": data["items"][:25]}


# -------------------------------------------------------------------- report
DISCLAIMER = ("Items are listed as they appear on the official websites named. Read the "
              "notification, circular or order itself (and the Gazette, where applicable) "
              "before relying on it.")


def _e(s):
    return html.escape(s or "", quote=True)


def write_report(summary, cfg=None):
    _ensure_dirs()
    doc = report_html(summary)
    day = summary["finished"][:10]
    for name in ("report-%s.html" % day, "latest.html"):
        with open(os.path.join(REPORTS_DIR, name), "w", encoding="utf-8") as f:
            f.write(doc)
    # keep only the last 90 daily reports
    files = sorted(f for f in os.listdir(REPORTS_DIR) if re.fullmatch(r"report-\d{4}-\d{2}-\d{2}\.html", f))
    for old in files[:-90]:
        try:
            os.remove(os.path.join(REPORTS_DIR, old))
        except OSError:
            pass


def count_new(summary):
    return sum(len(r["new_items"]) for r in summary["results"])


def report_html(summary):
    results = summary["results"]
    n_new = count_new(summary)
    by_statute = {}
    for r in results:
        by_statute.setdefault(r["statute"], []).append(r)
    rows = []
    for statute, rs in by_statute.items():
        new_here = sum(len(r["new_items"]) for r in rs)
        rows.append('<h2>%s <span class="n">%s</span></h2>' % (
            _e(statute), "%d new" % new_here if new_here else "no new items"))
        for r in rs:
            if not r["new_items"]:
                continue
            rows.append('<h3>%s <a class="src" href="%s">%s</a></h3><ul>' % (
                _e(r["source"]), _e(r["url"]), _e(urllib.parse.urlsplit(r["url"]).hostname or "")))
            for it in r["new_items"]:
                d = ' <span class="d">%s</span>' % _e(it["date"]) if it.get("date") else ""
                rows.append('<li><a href="%s">%s</a>%s</li>' % (_e(it["url"]), _e(it["title"]), d))
            rows.append("</ul>")
    notes = []
    for r in results:
        if r["status"] == "error":
            notes.append("<li><b>%s - %s</b>: could not be checked. %s</li>"
                         % (_e(r["statute"]), _e(r["source"]), _e(r["error"])))
        elif r["status"] == "changed":
            notes.append('<li><b>%s - %s</b>: the page has changed but no items could be read '
                         'from it. <a href="%s">Open the page</a> to look.</li>'
                         % (_e(r["statute"]), _e(r["source"]), _e(r["url"])))
        elif r["status"] == "baseline":
            notes.append("<li><b>%s - %s</b>: first check; %d items now on the page were "
                         "recorded. New items will be reported from the next check.</li>"
                         % (_e(r["statute"]), _e(r["source"]), r["total_items"]))
        elif r["status"] == "no-items":
            notes.append('<li><b>%s - %s</b>: no items could be read from this page (it may '
                         'load its list with JavaScript). <a href="%s">Open the page</a>.</li>'
                         % (_e(r["statute"]), _e(r["source"]), _e(r["url"])))
    return """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Statute updates %(day)s</title>
<style>
body{font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:16px;color:#1d2433;background:#fff;line-height:1.45}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:26px 0 6px;border-bottom:2px solid #dde3ee;padding-bottom:4px}
h3{font-size:15px;margin:14px 0 4px}.n{font-size:13px;font-weight:normal;color:#5a6478}
.src{font-size:12px;font-weight:normal;color:#5a6478}ul{margin:4px 0 10px 18px;padding:0}li{margin:5px 0}
a{color:#0b57d0}.d{color:#5a6478;font-size:13px;white-space:nowrap}.meta{color:#5a6478;font-size:13px}
.box{background:#f5f7fb;border:1px solid #dde3ee;border-radius:8px;padding:10px 14px;margin-top:24px;font-size:14px}
.disc{font-size:12px;color:#5a6478;margin-top:24px}
</style></head><body>
<h1>Statute updates - %(n)s</h1>
<div class="meta">Checked on %(when)s (IST) &middot; %(sites)d websites</div>
%(rows)s
%(notes)s
<p class="disc">%(disc)s</p>
</body></html>""" % {
        "day": _e(summary["finished"][:10]),
        "n": "%d new item%s" % (n_new, "" if n_new == 1 else "s"),
        "when": _e(fmt_dt(summary["finished"])),
        "sites": len(results),
        "rows": "\n".join(rows),
        "notes": ('<div class="box"><b>Notes on this check</b><ul>%s</ul></div>' % "".join(notes))
                 if notes else "",
        "disc": _e(DISCLAIMER),
    }


# --------------------------------------------------------------------- email
def load_email_settings():
    s = read_json(EMAIL_PATH, {})
    s.setdefault("enabled", False)
    s.setdefault("smtp_host", "smtp.gmail.com")
    s.setdefault("smtp_port", 465)
    s.setdefault("username", "")
    s.setdefault("password", "")
    s.setdefault("to", "")
    s.setdefault("send_when_nothing_new", False)
    return s


def send_email(summary, settings=None, force=False):
    import smtplib
    from email.message import EmailMessage
    s = settings or load_email_settings()
    if not force and not s.get("enabled"):
        return "E-mail is not switched on."
    n = count_new(summary)
    if not force and n == 0 and not s.get("send_when_nothing_new"):
        return "Nothing new, so no e-mail was sent."
    to = [t.strip() for t in re.split(r"[,;]", s.get("to", "")) if t.strip()]
    if not (s.get("smtp_host") and s.get("username") and s.get("password") and to):
        raise ValueError("Fill in the mail server, user name, password and 'send to'.")
    msg = EmailMessage()
    msg["Subject"] = "Statute updates %s: %d new item%s" % (
        fmt_dt(summary["finished"])[:10], n, "" if n == 1 else "s")
    msg["From"] = s["username"]
    msg["To"] = ", ".join(to)
    lines = []
    for r in summary["results"]:
        for it in r["new_items"]:
            lines.append("[%s] %s - %s\n  %s" % (r["statute"], r["source"], it["title"], it["url"]))
    errs = [r for r in summary["results"] if r["status"] == "error"]
    if errs:
        lines.append("\nCould not be checked: " + ", ".join(
            "%s - %s" % (r["statute"], r["source"]) for r in errs))
    msg.set_content(("\n".join(lines) or "No new items.") + "\n\n" + DISCLAIMER)
    msg.add_alternative(report_html(summary), subtype="html")
    port = int(s.get("smtp_port") or 465)
    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(s["smtp_host"], port, context=ctx, timeout=60) as srv:
            srv.login(s["username"], s["password"])
            srv.send_message(msg)
    else:
        with smtplib.SMTP(s["smtp_host"], port, timeout=60) as srv:
            srv.starttls(context=ctx)
            srv.login(s["username"], s["password"])
            srv.send_message(msg)
    return "E-mail sent to %s." % ", ".join(to)


# ----------------------------------------------------------------------- cli
def _cli(argv):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")  # Hindi titles on an English console
        except (AttributeError, ValueError):
            pass
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return 0
    cmd = argv[0]
    if cmd == "check":
        def prog(i, n, name):
            print("  [%d/%d] %s" % (i, n, name))
        try:
            summary = run_check(progress=prog)
        except CheckBusy as e:
            print(e)
            return 1
        print("\n%d new item(s). Report: %s" % (count_new(summary),
                                                os.path.join(REPORTS_DIR, "latest.html")))
        for r in summary["results"]:
            for it in r["new_items"]:
                print("  [%s] %s: %s\n      %s" % (r["statute"], r["source"], it["title"], it["url"]))
            if r["status"] == "error":
                print("  ! %s - %s: %s" % (r["statute"], r["source"], r["error"]))
        if "--email" in argv:
            try:
                print(send_email(summary))
            except Exception as e:
                print("E-mail not sent: %s" % e)
        return 0
    if cmd == "test" and len(argv) > 1:
        res = test_source({"url": argv[1], "type": "auto", "keywords": "", "exclude": "",
                           "legacy_tls": "--old-tls" in argv})
        if not res["ok"]:
            print("Error:", res["error"])
            return 1
        print("%s\n%d items read" % (res["page_title"], res["count"]))
        for it in res["sample"]:
            print(" -", it["title"][:120], "|", it["date"], "\n   ", it["url"])
        return 0
    if cmd == "list":
        for st in load_config()["statutes"]:
            print(st["name"])
            for s in st["sources"]:
                print("   %s %s\n      %s" % ("[on] " if s["enabled"] else "[off]", s["name"], s["url"]))
        return 0
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(_cli(sys.argv[1:]))
