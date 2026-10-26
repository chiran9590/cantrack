"""One-off copy of your old local MySQL data into the PostgreSQL database named in DATABASE_URL.

    pip install pymysql cryptography                       # only needed for this script
    python -m app.init_db                                  # create the empty tables first (do NOT run app.seed)
    python -m app.migrate_from_mysql --user root --database cantrack      # asks for the MySQL password

Safe by design: everything happens in ONE transaction (any error = nothing is copied), your MySQL data is only read,
and it refuses to run if the Postgres tables already contain rows unless you add --wipe.
Password hashes are copied as they are, so every existing login keeps working.
"""
import argparse
import getpass
import json
import sys
from decimal import Decimal

from .db import describe_url, get_connection

ORDER = ["users", "glasshouses", "platforms", "positions", "genotypes", "plants", "scan_sessions",
         "plant_location_history", "scan_rejections", "plant_status_history", "audit_log"]
SERIAL = {"users": "id", "plant_location_history": "id", "scan_rejections": "id", "plant_status_history": "id", "audit_log": "id"}
BATCH = 500


def convert(v, pg_type: str):
    """MySQL value -> value Postgres accepts for a column of type pg_type."""
    if v is None:
        return None
    if isinstance(v, (bytes, bytearray)):
        v = v.decode("utf-8")
    if pg_type == "boolean":
        return bool(int(v)) if not isinstance(v, bool) else v
    if pg_type in ("json", "jsonb"):
        return v if isinstance(v, str) else json.dumps(v, default=str)
    if pg_type == "uuid":
        return str(v).strip()
    if isinstance(v, Decimal):
        return v
    return v


def read_source(mysql, table):
    """Returns (column_names, rows) or None when the table does not exist in MySQL."""
    import pymysql
    try:
        with mysql.cursor() as cur:
            cur.execute(f"select * from `{table}`")
            return [d[0] for d in cur.description], cur.fetchall()
    except pymysql.err.ProgrammingError as e:
        if e.args and e.args[0] == 1146:
            return None
        raise


def copy_all(mysql, pg, wipe: bool, tz: str, log=print) -> dict:
    counts = {}
    pg.execute("select set_config('TimeZone', %s, true)", (tz,))  # naive MySQL timestamps are read in this zone
    existing = {t: pg.execute(f'select count(*) as n from "{t}"').fetchone()["n"] for t in ORDER}
    if any(existing.values()):
        if not wipe:
            busy = ", ".join(f"{t}={n}" for t, n in existing.items() if n)
            raise SystemExit(f"The PostgreSQL tables already contain data ({busy}).\n"
                             "Run again with --wipe to replace it, or point DATABASE_URL at an empty database.")
        pg.execute("truncate " + ", ".join(f'"{t}"' for t in ORDER) + " restart identity cascade")
        log("Existing PostgreSQL data wiped.")

    for t in ORDER:
        src = read_source(mysql, t)
        if src is None:
            log(f"  {t:24s} not in MySQL, skipped")
            continue
        names, rows = src
        types = {r["column_name"]: r["data_type"] for r in pg.execute(
            "select column_name, data_type from information_schema.columns where table_schema = current_schema() and table_name = %s", (t,)).fetchall()}
        cols = [c for c in names if c in types]
        dropped = [c for c in names if c not in types]
        if dropped:
            log(f"  {t:24s} MySQL-only columns ignored: {', '.join(dropped)}")
        if not rows:
            counts[t] = 0
            log(f"  {t:24s} 0 rows")
            continue
        idx = [names.index(c) for c in cols]
        col_sql = ", ".join(f'"{c}"' for c in cols)
        one = "(" + ", ".join(["%s"] * len(cols)) + ")"
        for i in range(0, len(rows), BATCH):
            chunk = rows[i:i + BATCH]
            params = []
            for r in chunk:
                vals = list(r.values()) if isinstance(r, dict) else list(r)
                params.extend(convert(vals[j], types[names[j]]) for j in idx)
            try:
                pg.execute(f'insert into "{t}" ({col_sql}) values ' + ", ".join([one] * len(chunk)), params)
            except Exception as e:
                raise SystemExit(f"Copy failed in table '{t}' (rows {i + 1}-{i + len(chunk)}): {e}\nNothing was changed in PostgreSQL.")
        counts[t] = len(rows)
        log(f"  {t:24s} {len(rows)} rows")

    for t, col in SERIAL.items():
        pg.execute(f"""select setval(pg_get_serial_sequence('{t}', '{col}'), coalesce(max("{col}"), 1), max("{col}") is not null) from "{t}" """)
    return counts


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=3306)
    ap.add_argument("--user", default="root")
    ap.add_argument("--database", default="cantrack")
    ap.add_argument("--password", help="omit this: you will be asked, which keeps it out of your shell history")
    ap.add_argument("--tz", default="Asia/Kolkata", help="time zone your MySQL server ran in (default Asia/Kolkata)")
    ap.add_argument("--wipe", action="store_true", help="replace any data already in PostgreSQL")
    a = ap.parse_args()
    try:
        import pymysql
        from pymysql.cursors import DictCursor
    except ImportError:
        sys.exit("Run first:  pip install pymysql cryptography")
    pw = a.password if a.password is not None else getpass.getpass(f"MySQL password for {a.user}@{a.host} (Enter if empty): ")
    try:
        mysql = pymysql.connect(host=a.host, port=a.port, user=a.user, password=pw, database=a.database, charset="utf8mb4", cursorclass=DictCursor)
    except pymysql.err.OperationalError as e:
        sys.exit(f"Could not connect to MySQL: {e}\nIs it running? (brew services start mysql)  Is the password right?")
    print(f"Copying MySQL '{a.database}' -> PostgreSQL {describe_url()}")
    try:
        with get_connection() as pg:           # one transaction for everything
            counts = copy_all(mysql, pg, a.wipe, a.tz)
    finally:
        mysql.close()
    print(f"\nDone: {sum(counts.values())} rows copied. Sign in with your existing accounts.")


if __name__ == "__main__":
    main()
