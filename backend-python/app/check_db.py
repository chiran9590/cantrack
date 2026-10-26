"""Tests the database connection and explains common problems:  python -m app.check_db"""
import sys

import psycopg

from .db import database_url, describe_url

HINTS = {
    "password authentication failed": "Wrong user or password in DATABASE_URL. With Neon, copy the connection string again from the dashboard (Connect button).",
    "does not exist": "The database or role named in DATABASE_URL does not exist yet. On local Postgres run:  createdb cantrack",
    "could not connect": "Postgres is not running or the host/port is wrong. For a cloud database, check the host in DATABASE_URL.",
    "connection refused": "Postgres is not running or the host/port is wrong.",
    "ssl": "The server wants TLS. Add ?sslmode=require to DATABASE_URL (done automatically for non-local hosts).",
    "timeout": "The server did not answer in time. A sleeping Neon database needs a few seconds: just retry.",
}

try:
    target = describe_url()
    print(f"Connecting to {target} ...")
    with psycopg.connect(database_url(), connect_timeout=20) as conn:
        user, db, ver = conn.execute("select current_user, current_database(), current_setting('server_version')").fetchone()
        tables = conn.execute("select count(*) from information_schema.tables where table_schema = current_schema() and table_type = 'BASE TABLE'").fetchone()[0]
    print(f"OK: connected as '{user}' to database '{db}' (PostgreSQL {ver}); {tables} table(s) present.")
    if tables == 0:
        print("Next: python -m app.init_db   then   python -m app.seed")
except Exception as e:  # noqa: BLE001
    msg = str(e)
    print(f"FAILED: {msg.strip()}")
    for key, hint in HINTS.items():
        if key in msg.lower():
            print("Hint:", hint)
            break
    sys.exit(1)
