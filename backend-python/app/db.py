import json
import os
from contextlib import contextmanager

from dotenv import load_dotenv
import pymysql
from pymysql.cursors import DictCursor

load_dotenv()

def get_connection():
    """Get a new MySQL connection."""
    db_url = os.environ.get("DATABASE_URL", "")
    # Parse mysql+pymysql://user:password@host:port/database
    if db_url.startswith("mysql+pymysql://"):
        db_url = db_url.replace("mysql+pymysql://", "mysql://")
    
    # Simple parsing for mysql://user:password@host:port/database
    if db_url.startswith("mysql://"):
        auth_part = db_url[8:]
        if "@" in auth_part:
            user_pass, host_port_db = auth_part.split("@", 1)
            if ":" in user_pass:
                user, password = user_pass.split(":", 1)
            else:
                user, password = user_pass, ""
            
            if "/" in host_port_db:
                host_port, database = host_port_db.split("/", 1)
            else:
                host_port, database = host_port_db, ""
            
            if ":" in host_port:
                host, port = host_port.split(":", 1)
                port = int(port)
            else:
                host, port = host_port, 3306
            
            return pymysql.connect(host=host, user=user, password=password, database=database, port=port, cursorclass=DictCursor)
    
    # Fallback to localhost
    return pymysql.connect(host='localhost', user='root', password='', database='cantrack', cursorclass=DictCursor)


def q(sql, params=None):
    """Run one statement in its own transaction; return rows (or [])."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            conn.commit()
            if cur.description:
                # Convert column names to lowercase for MySQL compatibility
                rows = cur.fetchall()
                if rows:
                    cols = [desc[0].lower() for desc in cur.description]
                    return [dict(zip(cols, row)) for row in rows]
            return []
    finally:
        conn.close()


def q1(sql, params=None):
    rows = q(sql, params)
    return rows[0] if rows else None


@contextmanager
def tx():
    """Several statements in ONE transaction: commits on success, rolls back on any error."""
    conn = get_connection()
    try:
        conn.begin()
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _j(v):
    return json.dumps(v, default=str) if v is not None else None


def audit(c, actor, action, target=None, before=None, after=None):
    with c.cursor() as cur:
        cur.execute("insert into audit_log(actor_id,action,target,before_value,after_value) values (%s,%s,%s,%s,%s)",
                  (actor, action, target, _j(before), _j(after)))


def create_glasshouse(c, h: dict):
    """Creates a glasshouse and generates all its platforms and position IDs (no hardcoding)."""
    with c.cursor() as cur:
        cur.execute("insert into glasshouses(code,name,description,num_platforms,num_columns,num_rows) values (%s,%s,%s,%s,%s,%s)", 
                  (h['code'], h['name'], h['description'], h['platforms'], h['columns'], h['rows']))
        
        # Insert platforms
        for p in range(1, int(h['platforms']) + 1):
            cur.execute("insert into platforms(glasshouse_code,platform_no) values (%s,%s)", (h['code'], p))
        
        # Insert positions
        for p in range(1, int(h['platforms']) + 1):
            for col in range(1, int(h['columns']) + 1):
                for row in range(1, int(h['rows']) + 1):
                    position_id = f"{h['code']}-P{p:02d}-C{col:02d}-R{row:02d}"
                    cur.execute("insert into positions(position_id,glasshouse_code,platform_no,column_no,row_no) values (%s,%s,%s,%s,%s)",
                              (position_id, h['code'], p, col, row))
