"""Offline tests: python -m unittest discover -s tests"""
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tracker  # noqa: E402

ALLOWED = ["gov.in", "nic.in", "rbi.org.in"]

PAGE_V1 = """<html><head><title>Circulars</title></head><body>
<ul class="menu"><li><a href="/">Home</a></li><li><a href="/contact">Contact Us</a></li>
<li><a href="https://twitter.com/x">Follow us on Twitter today</a></li></ul>
<table>
<tr><td>Circular No. 15/2025</td><td>Extension of due date for audit report</td><td>29-10-2025</td>
    <td><a href="/docs/c15.pdf">Download</a></td></tr>
<tr><td>Circular No. 14/2025</td><td>Condonation of delay under section 119</td><td>01/10/2025</td>
    <td><a href="docs/c14.pdf">English</a></td></tr>
</table>
<script>var x = '<a href="/hidden">Not a real link in script</a>';</script>
</body></html>"""

PAGE_V2 = PAGE_V1.replace("<table>", """<table>
<tr><td>Circular No. 16/2025</td><td>Guidelines for compounding of offences</td><td>04-11-2025</td>
    <td><a href="/docs/c16.pdf">Download</a></td></tr>""")

RSS = """<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>RBI Notifications</title>
<item><title>Foreign Exchange Management (Overseas Investment) Directions - amendment</title>
<link>https://rbi.org.in/Scripts/NotificationUser.aspx?Id=1</link><pubDate>Tue, 03 Nov 2026 10:00:00</pubDate></item>
<item><title>Interest rate on deposits</title><link>https://rbi.org.in/Scripts/NotificationUser.aspx?Id=2</link></item>
<item><title>Phishing link</title><link>https://example.com/x</link></item>
</channel></rss>"""


class ParseTests(unittest.TestCase):
    def test_host_allowed(self):
        self.assertTrue(tracker.host_allowed("https://incometaxindia.gov.in/a", ALLOWED))
        self.assertTrue(tracker.host_allowed("https://www.rbi.org.in/x", ALLOWED))
        self.assertFalse(tracker.host_allowed("https://taxguru.in/x", ALLOWED))
        self.assertFalse(tracker.host_allowed("https://gov.in.example.com/x", ALLOWED))
        self.assertFalse(tracker.host_allowed("https://fakegov.in/x", ALLOWED))
        self.assertFalse(tracker.host_allowed("ftp://esic.gov.in/x", ALLOWED))

    def test_html_items_use_row_text_and_skip_menus(self):
        items, _, title = tracker.parse_html(PAGE_V1, "https://incometaxindia.gov.in/Pages/c.aspx", ALLOWED)
        self.assertEqual(title, "Circulars")
        urls = [i["url"] for i in items]
        self.assertEqual(urls, ["https://incometaxindia.gov.in/docs/c15.pdf",
                                "https://incometaxindia.gov.in/Pages/docs/c14.pdf"])
        self.assertIn("Extension of due date", items[0]["title"])
        self.assertEqual(items[0]["date"], "29-10-2025")
        self.assertEqual(items[1]["date"], "01/10/2025")

    def test_feed(self):
        items, _, title = tracker.parse_feed(RSS, "https://rbi.org.in/notifications_rss.xml", ALLOWED)
        self.assertEqual(title, "RBI Notifications")
        self.assertEqual(len(items), 2)  # example.com dropped
        self.assertTrue(tracker.looks_like_feed(RSS, "text/xml"))
        self.assertFalse(tracker.looks_like_feed(PAGE_V1, "text/html"))

    def test_validate(self):
        cfg = {"allowed_domains": ["gov.in"], "statutes": [
            {"name": "GST", "sources": [{"name": "A", "url": "https://cbic-gst.gov.in/a.html"},
                                        {"name": "A", "url": "https://cbic-gst.gov.in/b.html"}]},
            {"name": "GST", "sources": []}]}
        clean, errs = tracker.validate_config(cfg)
        self.assertEqual(errs, [])
        self.assertEqual(len({s["id"] for s in clean["statutes"][0]["sources"]}), 2)
        self.assertNotEqual(clean["statutes"][0]["id"], clean["statutes"][1]["id"])
        _, errs = tracker.validate_config({"allowed_domains": ["gov.in"], "statutes": [
            {"name": "X", "sources": [{"name": "Blog", "url": "https://taxguru.in/"}]}]})
        self.assertTrue(errs)


class RunTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.saved = {k: getattr(tracker, k) for k in
                      ("CONFIG_PATH", "DATA_DIR", "REPORTS_DIR", "STATE_PATH", "UPDATES_PATH",
                       "LAST_RUN_PATH", "EMAIL_PATH", "LOCK_PATH", "fetch")}
        tracker.CONFIG_PATH = os.path.join(self.tmp, "config.json")
        tracker.DATA_DIR = os.path.join(self.tmp, "data")
        tracker.REPORTS_DIR = os.path.join(self.tmp, "reports")
        for k, f in (("STATE_PATH", "state.json"), ("UPDATES_PATH", "updates.json"),
                     ("LAST_RUN_PATH", "last_run.json"), ("EMAIL_PATH", "email.json"),
                     ("LOCK_PATH", "check.lock")):
            setattr(tracker, k, os.path.join(tracker.DATA_DIR, f))
        self.pages = {"https://incometaxindia.gov.in/c.aspx": PAGE_V1,
                      "https://rbi.org.in/notifications_rss.xml": RSS}

        def fake_fetch(url, allowed, legacy_tls=False):
            if url not in self.pages:
                raise tracker.urllib.error.URLError("no route")
            return url, self.pages[url], "text/xml" if url.endswith(".xml") else "text/html"
        tracker.fetch = fake_fetch
        cfg = {"allowed_domains": ALLOWED, "statutes": [
            {"name": "Income-tax", "sources": [
                {"name": "CBDT circulars", "url": "https://incometaxindia.gov.in/c.aspx"},
                {"name": "Broken", "url": "https://esic.gov.in/none"}]},
            {"name": "FEMA", "sources": [
                {"name": "RBI FEMA", "url": "https://rbi.org.in/notifications_rss.xml",
                 "keywords": "Foreign Exchange, FEMA"}]}]}
        _, errs = tracker.save_config(cfg)
        self.assertEqual(errs, [])

    def tearDown(self):
        for k, v in self.saved.items():
            setattr(tracker, k, v)
        shutil.rmtree(self.tmp)

    def test_baseline_then_new(self):
        s1 = tracker.run_check()
        st = {r["source"]: r for r in s1["results"]}
        self.assertEqual(st["CBDT circulars"]["status"], "baseline")
        self.assertEqual(st["RBI FEMA"]["total_items"], 1)
        self.assertEqual(st["Broken"]["status"], "error")
        self.assertEqual(tracker.count_new(s1), 0)

        self.pages["https://incometaxindia.gov.in/c.aspx"] = PAGE_V2
        s2 = tracker.run_check()
        self.assertEqual(tracker.count_new(s2), 1)
        new = [it for r in s2["results"] for it in r["new_items"]][0]
        self.assertIn("compounding", new["title"])
        self.assertEqual(new["date"], "04-11-2025")

        s3 = tracker.run_check()
        self.assertEqual(tracker.count_new(s3), 0)
        ups = tracker.read_json(tracker.UPDATES_PATH, [])
        self.assertEqual(len(ups), 1)
        with open(os.path.join(tracker.REPORTS_DIR, "latest.html"), encoding="utf-8") as f:
            self.assertIn("could not be checked", f.read())

    def test_editing_url_restarts_baseline(self):
        tracker.run_check()
        cfg = tracker.load_config()
        cfg["statutes"][1]["sources"][0]["keywords"] = ""
        tracker.save_config(cfg)
        s = tracker.run_check()
        r = [r for r in s["results"] if r["source"] == "RBI FEMA"][0]
        self.assertEqual(r["status"], "baseline")
        self.assertEqual(r["new_items"], [])


if __name__ == "__main__":
    unittest.main()
