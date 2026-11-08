"""Tiny in-memory rate limiter (per client IP). Fine for one server process; use a proxy-level limit when deployed behind a load balancer."""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def rate_limit(name: str, max_hits: int, per_seconds: int):
    def dep(request: Request):
        ip = request.client.host if request.client else "?"
        dq, now = _hits[(name, ip)], time.monotonic()
        while dq and now - dq[0] > per_seconds:
            dq.popleft()
        if len(dq) >= max_hits:
            raise HTTPException(429, "Too many attempts. Please wait a few minutes and try again.")
        dq.append(now)
    return dep
