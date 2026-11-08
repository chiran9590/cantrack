"""Create / upgrade all tables. Safe to re-run:  python -m app.init_db"""
import pymysql
from pathlib import Path

from .db import describe_url, get_connection

sql = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")

# Split SQL into individual statements by semicolon
statements = [s.strip() for s in sql.split(';') if s.strip()]

with get_connection() as conn:
    with conn.cursor() as cur:
        for statement in statements:
            try:
                cur.execute(statement)
            except pymysql.err.OperationalError as e:
                # Ignore index already exists errors
                if e.args[0] != 1061:
                    raise
print(f"Schema ready on {describe_url()}")
