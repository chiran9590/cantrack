"""PostgreSQL access layer (psycopg 3).

* One small connection pool, shared by every request (works with Neon, Supabase, Render, local Postgres).
* Client-side parameter binding (ClientCursor): '5' for an integer column, 'true' for a boolean and
  JSON text for a jsonb column all just work, which the admin database editor relies on.
* Rows come back as dicts. q()/q1() run one statement; tx() gives one transaction (commit / rollback).
"""
import json
import os
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

LOCAL_HOSTS = {"", "localhost", "127.0.0.1", "::1"}


def database_url() -> str:
    """DATABASE_URL, normalised: strips '+driver' suffixes and adds sslmode=require for remote hosts."""
    url = os.environ.get("DATABASE_URL", "").strip().strip('"').strip("'")
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Copy backend-python/.env.example to .env and fill it in.")
    if not url.startswith(("postgres://", "postgresql://", "postgresql+")):
        raise RuntimeError("DATABASE_URL must start with postgresql:// (this app now runs on PostgreSQL, not MySQL).")
    scheme, rest = url.split("://", 1)
    url = "postgresql://" + rest if scheme.startswith("postgresql+") else url
    u = urlparse(url)
    query = parse_qs(u.query)
    is_local = (u.hostname or "") in LOCAL_HOSTS or "host" in query
    if not is_local and "sslmode" not in query:
        query["sslmode"] = ["require"]  # Neon, Supabase, Render, ... all require TLS
        u = u._replace(query=urlencode(query, doseq=True))
    return urlunparse(u)


def describe_url() -> str:
    """Connection target without the password, for log messages."""
    u = urlparse(database_url())
    return f"{u.username or '(no user)'}@{u.hostname or 'local socket'}:{u.port or 5432}{u.path}"


_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=database_url(),
            min_size=1,
            max_size=int(os.environ.get("DB_POOL_MAX", "5")),
            kwargs={"row_factory": dict_row, "cursor_factory": psycopg.ClientCursor, "prepare_threshold": None},  # None: safe behind PgBouncer / Neon pooler
            check=ConnectionPool.check_connection,  # drops connections a sleeping serverless DB closed
            max_idle=240,
            max_lifetime=1800,
            timeout=30,
            open=False,
        )
        _pool.open()
    return _pool


def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_connection() -> psycopg.Connection:
    """A standalone connection for scripts (init_db, seed). Use as a context manager: commits on success."""
    return psycopg.connect(database_url(), row_factory=dict_row, cursor_factory=psycopg.ClientCursor, prepare_threshold=None)


def q(sql, params=None):
    """Run one statement in its own transaction; return rows (list of dicts) or []."""
    with pool().connection() as conn:
        cur = conn.execute(sql, params)
        return cur.fetchall() if cur.description else []


def q1(sql, params=None):
    rows = q(sql, params)
    return rows[0] if rows else None


def query(sql, params=None):
    """Like q() but also returns the column names in order: (columns, rows)."""
    with pool().connection() as conn:
        cur = conn.execute(sql, params)
        if not cur.description:
            return [], []
        return [c.name for c in cur.description], cur.fetchall()


@contextmanager
def tx():
    """Several statements in ONE transaction: commits on success, rolls back on any error."""
    with pool().connection() as conn:
        yield conn


def _j(v):
    return json.dumps(v, default=str) if v is not None else None


def audit(c, actor, action, target=None, before=None, after=None):
    c.execute("insert into audit_log(actor_id,action,target,before_value,after_value) values (%s,%s,%s,%s,%s)",
              (actor, action, target, _j(before), _j(after)))


def _pad(x: str) -> str:
    return f"(case when {x} < 10 then '0' || {x}::text else {x}::text end)"


def create_glasshouse(c, h: dict):
    """Creates a glasshouse and generates all its platforms and position IDs (no hardcoding).

    Position IDs look like L1-P01-C03-R27. Done with set-based SQL so a 50 x 50 x 500 house is one statement.
    """
    c.execute("insert into glasshouses(code,name,description,num_platforms,num_columns,num_rows) values (%s,%s,%s,%s,%s,%s)",
              (h["code"], h["name"], h.get("description", ""), int(h["platforms"]), int(h["columns"]), int(h["rows"])))
    p = {"code": h["code"], "np": int(h["platforms"]), "nc": int(h["columns"]), "nr": int(h["rows"])}
    c.execute("insert into platforms(glasshouse_code, platform_no) select %(code)s, p from generate_series(1, %(np)s) p", p)
    c.execute(f"""insert into positions(position_id, glasshouse_code, platform_no, column_no, row_no)
                  select %(code)s || '-P' || {_pad('p')} || '-C' || {_pad('cc')} || '-R' || {_pad('r')}, %(code)s, p, cc, r
                  from generate_series(1, %(np)s) p, generate_series(1, %(nc)s) cc, generate_series(1, %(nr)s) r""", p)
