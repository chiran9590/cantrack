import json
import os
from contextlib import contextmanager

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

load_dotenv()
pool = ConnectionPool(os.environ.get("DATABASE_URL", ""), min_size=1, max_size=10, kwargs={"row_factory": dict_row}, open=False)


def q(sql, params=None):
    """Run one statement in its own transaction; return rows (or [])."""
    with pool.connection() as c:
        cur = c.execute(sql, params)
        return cur.fetchall() if cur.description else []


def q1(sql, params=None):
    rows = q(sql, params)
    return rows[0] if rows else None


@contextmanager
def tx():
    """Several statements in ONE transaction: commits on success, rolls back on any error."""
    with pool.connection() as c:
        yield c


def _j(v):
    return Jsonb(v, dumps=lambda o: json.dumps(o, default=str)) if v is not None else None


def audit(c, actor, action, target=None, before=None, after=None):
    c.execute("insert into audit_log(actor_id,action,target,before_value,after_value) values (%s,%s,%s,%s,%s)",
              (actor, action, target, _j(before), _j(after)))


def create_glasshouse(c, h: dict):
    """Creates a glasshouse and generates all its platforms and position IDs (no hardcoding)."""
    c.execute("insert into glasshouses(code,name,description,num_platforms,num_columns,num_rows) values (%(code)s,%(name)s,%(description)s,%(platforms)s,%(columns)s,%(rows)s)", h)
    c.execute("insert into platforms(glasshouse_code,platform_no) select %(code)s::text, g from generate_series(1,%(platforms)s::int) g", h)
    c.execute(
        """insert into positions(position_id,glasshouse_code,platform_no,column_no,row_no)
           select %(code)s::text||'-P'||pad2(p)||'-C'||pad2(c)||'-R'||pad2(r), %(code)s::text, p, c, r
           from generate_series(1,%(platforms)s::int) p, generate_series(1,%(columns)s::int) c, generate_series(1,%(rows)s::int) r""",
        h,
    )
