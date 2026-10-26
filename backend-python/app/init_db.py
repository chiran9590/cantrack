"""Create / upgrade all tables. Safe to re-run:  python -m app.init_db"""
import pymysql
from pathlib import Path

from .db import describe_url, get_connection

sql = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")

# Split SQL into individual statements, handling triggers with BEGIN...END blocks
statements = []
current = []
in_trigger = False
for line in sql.split('\n'):
    stripped = line.strip()
    if stripped.startswith('--'):
        continue
    if stripped.upper().startswith('CREATE TRIGGER') or stripped.upper().startswith('DROP TRIGGER'):
        in_trigger = True
    current.append(line)
    if stripped.endswith(';') and not in_trigger:
        statements.append('\n'.join(current))
        current = []
    elif in_trigger and stripped.upper().startswith('END;'):
        current.append(line)
        statements.append('\n'.join(current))
        current = []
        in_trigger = False

if current:
    statements.append('\n'.join(current))

with get_connection() as conn:
    with conn.cursor() as cur:
        for statement in statements:
            statement = statement.strip()
            if not statement:
                continue
            try:
                cur.execute(statement)
            except pymysql.err.OperationalError as e:
                # Ignore index already exists errors
                if e.args[0] != 1061:
                    raise
            except pymysql.err.ProgrammingError as e:
                # Ignore "trigger already exists" errors
                if e.args[0] != 1359:
                    raise
print(f"Schema ready on {describe_url()}")
