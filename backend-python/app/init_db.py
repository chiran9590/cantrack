import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()
with psycopg.connect(os.environ["DATABASE_URL"]) as c:
    c.execute((Path(__file__).parent / "schema.sql").read_text())
print("Schema ready.")
