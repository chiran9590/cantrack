"""PhenomeOne integration layer. Runs ONLY on the server; credentials come from environment
variables and never reach the website or the mobile app.

The URL path and auth style below are placeholders: replace fetch() once IT/security have agreed
how CanTrack may talk to PhenomeOne (API, service account, SSO, ...)."""
import base64
import json
import os
import urllib.parse
import urllib.request


class NotConfigured(Exception):
    pass


def configured() -> bool:
    return bool(os.environ.get("PHENOMEONE_BASE_URL"))


def fetch(gid: str) -> dict:
    base = os.environ.get("PHENOMEONE_BASE_URL")
    if not base:
        raise NotConfigured()
    req = urllib.request.Request(f"{base.rstrip('/')}/genotypes/{urllib.parse.quote(gid)}")
    cred = f"{os.environ.get('PHENOMEONE_USER', '')}:{os.environ.get('PHENOMEONE_PASSWORD', '')}"
    req.add_header("Authorization", "Basic " + base64.b64encode(cred.encode()).decode())
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r)
