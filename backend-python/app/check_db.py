"""Tests the database connection and explains common problems:  python -m app.check_db"""
import sys

import pymysql

from .db import database_url, describe_url

HINTS = {
    "access denied": "Wrong user or password in DATABASE_URL. With Aiven, copy the connection string again from the dashboard.",
    "unknown database": "The database named in DATABASE_URL does not exist yet.",
    "can't connect": "MySQL is not running or the host/port is wrong. For a cloud database, check the host in DATABASE_URL.",
    "connection refused": "MySQL is not running or the host/port is wrong.",
    "ssl": "The server wants TLS. Add ?ssl-mode=REQUIRED to DATABASE_URL.",
    "timeout": "The server did not answer in time. A sleeping database needs a few seconds: just retry.",
}

try:
    target = describe_url()
    print(f"Connecting to {target} ...")
    from urllib.parse import urlparse
    u = urlparse(database_url())
    
    # Check for SSL mode in query string
    use_ssl = False
    if "?" in u.path:
        path, query = u.path.split("?", 1)
        use_ssl = "ssl-mode=REQUIRED" in query or "ssl=true" in query
    else:
        path = u.path
        query = u.query
    
    ssl = {"ssl": {"check_hostname": False}} if use_ssl else {}
    
    with pymysql.connect(
        host=u.hostname,
        port=u.port or 3306,
        user=u.username,
        password=u.password,
        database=path.lstrip("/") if path else "defaultdb",
        connect_timeout=20,
        **ssl
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("select current_user(), database(), version()")
            user, db, ver = cur.fetchone()
            cur.execute("select count(*) from information_schema.tables where table_schema = database() and table_type = 'BASE TABLE'")
            tables = cur.fetchone()[0]
    print(f"OK: connected as '{user}' to database '{db}' (MySQL {ver}); {tables} table(s) present.")
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
