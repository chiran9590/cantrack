"""Create / upgrade all tables. Safe to re-run:  python -m app.init_db"""
from pathlib import Path

from .db import describe_url, get_connection

sql = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
with get_connection() as conn:       # commits on success, rolls everything back on error
    conn.execute(sql)
print(f"Schema ready on {describe_url()}")
