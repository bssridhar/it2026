#!/usr/bin/env python3
"""Statute Update Tracker - screen in the web browser.

Run:  python app.py        (opens http://127.0.0.1:8765 in your browser)
The screen is served only to this computer (127.0.0.1); nothing is put on the internet.
"""

import datetime as _dt
import json
import os
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import tracker

HOST = "127.0.0.1"
PORT = int(os.environ.get("STATUTE_TRACKER_PORT", "8765"))
UI_PATH = os.path.join(tracker.BASE_DIR, "ui.html")

_job = {"running": False, "done": 0, "total": 0, "current": "", "message": "", "error": ""}
_job_lock = threading.Lock()


def start_check(only_source=None):
    with _job_lock:
        if _job["running"]:
            return False
        _job.update(running=True, done=0, total=0, current="", message="", error="")

    def progress(i, n, name):
        with _job_lock:
            _job.update(done=i, total=n, current=name)

    def work():
        try:
            summary = tracker.run_check(only_source=only_source, progress=progress)
            n = tracker.count_new(summary)
            msg = "Check finished: %d new item%s." % (n, "" if n == 1 else "s")
            if not only_source:
                try:
                    r = tracker.send_email(summary)
                    if r.startswith("E-mail sent"):
                        msg += " " + r
                except Exception as e:
                    msg += " E-mail not sent: %s" % e
            with _job_lock:
                _job["message"] = msg
        except tracker.CheckBusy as e:
            with _job_lock:
                _job["error"] = str(e)
        except Exception as e:
            with _job_lock:
                _job["error"] = "Check stopped: %s" % e
        finally:
            with _job_lock:
                _job["running"] = False

    threading.Thread(target=work, daemon=True).start()
    return True


def checked_today():
    last = tracker.read_json(tracker.LAST_RUN_PATH, None)
    if not last or last.get("only_source"):
        return False
    return last.get("finished", "")[:10] == tracker.now_ist().date().isoformat()


def source_status():
    """Latest result for each website (from the last full or single check)."""
    state = tracker.read_json(tracker.STATE_PATH, {})
    last = tracker.read_json(tracker.LAST_RUN_PATH, {}) or {}
    by_id = {r["source_id"]: r for r in last.get("results", [])}
    out = {}
    for sid, st in state.items():
        r = by_id.get(sid)
        out[sid] = {
            "last_ok": st.get("last_ok", ""),
            "items_known": len(st.get("seen", {})),
            "last_status": r["status"] if r else "",
            "last_error": (r or {}).get("error") or "",
        }
    for sid, r in by_id.items():
        out.setdefault(sid, {"last_ok": "", "items_known": 0, "last_status": r["status"],
                             "last_error": r.get("error", "")})
    return out


class Handler(BaseHTTPRequestHandler):
    server_version = "StatuteTracker/1.0"

    def log_message(self, fmt, *args):
        pass

    # -- helpers
    def _host_ok(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False)
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 2_000_000:
            raise ValueError("Request too large")
        raw = self.rfile.read(n) if n else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    # -- GET
    def do_GET(self):
        if not self._host_ok():
            return self._send(403, {"error": "forbidden"})
        u = urlsplit(self.path)
        q = parse_qs(u.query)
        if u.path in ("/", "/index.html"):
            with open(UI_PATH, "rb") as f:
                return self._send(200, f.read(), "text/html; charset=utf-8")
        if u.path == "/api/config":
            return self._send(200, tracker.load_config())
        if u.path == "/api/status":
            with _job_lock:
                job = dict(_job)
            last = tracker.read_json(tracker.LAST_RUN_PATH, None)
            return self._send(200, {"job": job, "last_run": last, "sources": source_status()})
        if u.path == "/api/updates":
            days = int((q.get("days") or ["30"])[0])
            ups = tracker.read_json(tracker.UPDATES_PATH, [])
            if days > 0:
                cut = (tracker.now_ist() - _dt.timedelta(days=days)).isoformat()
                ups = [x for x in ups if x.get("detected", "") >= cut]
            return self._send(200, list(reversed(ups)))
        if u.path == "/api/email":
            s = tracker.load_email_settings()
            s["password"] = "********" if s.get("password") else ""
            return self._send(200, s)
        if u.path == "/report":
            p = os.path.join(tracker.REPORTS_DIR, "latest.html")
            if os.path.exists(p):
                with open(p, "rb") as f:
                    return self._send(200, f.read(), "text/html; charset=utf-8")
            return self._send(404, "No report yet. Click 'Check now'.", "text/plain; charset=utf-8")
        return self._send(404, {"error": "not found"})

    # -- POST
    def do_POST(self):
        if not self._host_ok():
            return self._send(403, {"error": "forbidden"})
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            return self._send(415, {"error": "JSON expected"})
        try:
            body = self._body()
        except ValueError as e:
            return self._send(400, {"error": str(e)})
        path = urlsplit(self.path).path
        if path == "/api/config":
            clean, errors = tracker.save_config(body)
            if errors:
                return self._send(400, {"errors": errors})
            return self._send(200, clean)
        if path == "/api/check":
            ok = start_check(body.get("source_id") or None)
            return self._send(200 if ok else 409,
                              {"started": ok} if ok else {"error": "A check is already running."})
        if path == "/api/test":
            src = {"url": (body.get("url") or "").strip(), "type": body.get("type") or "auto",
                   "keywords": body.get("keywords") or "", "exclude": body.get("exclude") or "",
                   "legacy_tls": bool(body.get("legacy_tls"))}
            return self._send(200, tracker.test_source(src))
        if path in ("/api/email", "/api/email/test"):
            cur = tracker.load_email_settings()
            new = {
                "enabled": bool(body.get("enabled")),
                "smtp_host": (body.get("smtp_host") or "").strip(),
                "smtp_port": int(body.get("smtp_port") or 465),
                "username": (body.get("username") or "").strip(),
                "password": cur.get("password", "") if body.get("password") in (None, "", "********")
                else body.get("password"),
                "to": (body.get("to") or "").strip(),
                "send_when_nothing_new": bool(body.get("send_when_nothing_new")),
            }
            if path == "/api/email":
                tracker.write_json(tracker.EMAIL_PATH, new)
                return self._send(200, {"saved": True})
            last = tracker.read_json(tracker.LAST_RUN_PATH, None) or {
                "finished": tracker.now_ist().isoformat(timespec="seconds"), "results": []}
            try:
                return self._send(200, {"message": tracker.send_email(last, new, force=True)})
            except Exception as e:
                return self._send(200, {"error": str(e)})
        return self._send(404, {"error": "not found"})


def main():
    tracker._ensure_dirs()
    try:
        srv = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        url = "http://%s:%d/" % (HOST, PORT)
        print("The tracker seems to be running already. Opening", url)
        webbrowser.open(url)
        return
    url = "http://%s:%d/" % (HOST, PORT)
    print("Statute Update Tracker is running at", url)
    print("Keep this window open while you use it. Close it (or press Ctrl+C) to stop.")
    cfg = tracker.load_config()
    if cfg.get("check_on_open", True) and not checked_today() and "--no-check" not in sys.argv:
        print("Not checked yet today - starting a check now.")
        start_check()
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
