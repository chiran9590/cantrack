import os
from pathlib import Path

from dotenv import load_dotenv
from .db import get_connection

load_dotenv()
conn = get_connection()
try:
    with conn.cursor() as cur:
        # Split SQL by semicolon and execute each statement
        sql_content = (Path(__file__).parent / "schema.sql").read_text()
        statements = [s.strip() for s in sql_content.split(';') if s.strip()]
        for statement in statements:
            if statement:
                cur.execute(statement)
    conn.commit()
finally:
    conn.close()
print("Schema ready.")
