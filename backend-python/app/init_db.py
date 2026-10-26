"""Create / upgrade all tables. Safe to re-run:  python -m app.init_db"""
import pymysql
from pathlib import Path

from .db import describe_url, get_connection

sql = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
with get_connection() as conn:       # commits on success, rolls everything back on error
    with conn.cursor() as cur:
        for statement in sql.split(';'):
            statement = statement.strip()
            if not statement:
                continue
            try:
                cur.execute(statement)
            except pymysql.err.OperationalError as e:
                if e.args[0] != 1061:  # 1061 = index already exists
                    raise
print(f"Schema ready on {describe_url()}")
