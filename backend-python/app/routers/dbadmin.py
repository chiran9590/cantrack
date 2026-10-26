"""Admin database editor: browse and edit tables from the website.

Safety rules (enforced here, not in the browser):
  * admin role only; table and column names come from the whitelist below, never from the request
  * history, status history and audit tables are read-only (the database also refuses changes to them)
  * a plant's position and status can only change through scans, corrections and removals
  * password hashes are never sent to the browser
  * every edit, insert and delete is written to the audit log with before/after values"""
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth import require
from ..db import audit, q, q1, tx

router = APIRouter(prefix="/admin/db", tags=["admin-db"])

CONFIG: dict[str, dict] = {
    "users": {"pk": ["id"], "edit": ["name", "email", "role", "active"], "hide": ["password_hash"]},
    "glasshouses": {"pk": ["code"], "edit": ["name", "description", "active"]},
    "platforms": {"pk": ["glasshouse_code", "platform_no"], "edit": ["status"]},
    "positions": {"pk": ["position_id"], "edit": ["status"]},
    "genotypes": {"pk": ["gid"], "edit": ["phenomeone_id", "info", "status"], "insert": ["gid", "phenomeone_id", "info", "status"], "delete": True},
    "plants": {"pk": ["uuid"], "edit": ["sown_date"]},
    "scan_sessions": {"pk": ["id"]},
    "scan_rejections": {"pk": ["id"], "delete": True},
    "plant_location_history": {"pk": ["id"]},
    "plant_status_history": {"pk": ["id"]},
    "audit_log": {"pk": ["id"]},
}


class Update(BaseModel):
    key: dict[str, str]
    values: dict[str, str | None]


class Insert(BaseModel):
    values: dict[str, str | None]


class Key(BaseModel):
    key: dict[str, str]


def _cfg(table: str):
    base = CONFIG.get(table)
    if not base:
        raise HTTPException(404, "Unknown table")
    cfg = {"edit": [], "insert": [], "delete": False, "hide": [], **base}
    cols = []
    for r in q("select column_name, udt_name, is_nullable from information_schema.columns "
               "where table_schema = current_schema() and table_name = %s order by ordinal_position", (table,)):
        if r["column_name"] in cfg["hide"] or not re.fullmatch(r"[a-z0-9_]+", r["udt_name"]):
            continue
        cols.append({"name": r["column_name"], "udt": r["udt_name"], "nullable": r["is_nullable"] == "YES",
                     "pk": r["column_name"] in cfg["pk"], "editable": r["column_name"] in cfg["edit"]})
    return cfg, cols


def _where(cfg, key: dict):
    if set(key) != set(cfg["pk"]):
        raise HTTPException(400, "Bad row key")
    parts, params = [], {}
    for i, k in enumerate(cfg["pk"]):
        parts.append(f'"{k}" = %(k{i})s')
        params[f"k{i}"] = key[k]
    return " and ".join(parts), params


def _sel(cols):
    return ", ".join(f'"{c["name"]}"' for c in cols)


def _val(col, v):
    return None if v is None or (v == "" and col["nullable"]) else v


def _target(table, key):
    return f"{table}:" + ",".join(key.values())


@router.get("")
def list_tables(_=Depends(require("admin"))):
    out = []
    for t, base in CONFIG.items():
        cfg = {"edit": [], "insert": [], "delete": False, **base}
        n = q1(f'select count(*) as row_count from "{t}"')["row_count"]
        out.append({"table": t, "rows": n, "read_only": not (cfg["edit"] or cfg["insert"] or cfg["delete"]),
                    "can_insert": bool(cfg["insert"]), "can_delete": cfg["delete"]})
    return out


@router.get("/_structure")
def structure(_=Depends(require("admin"))):
    """The whole database layout: every table, column, key and relationship."""
    cols = q("""select table_name, column_name, udt_name, is_nullable, column_default from information_schema.columns
                where table_schema = current_schema() and table_name in (select table_name from information_schema.tables
                      where table_schema = current_schema() and table_type = 'BASE TABLE')
                order by table_name, ordinal_position""")
    keys = q("""select tc.table_name, kcu.column_name, tc.constraint_type from information_schema.table_constraints tc
                join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
                     and kcu.constraint_schema = tc.constraint_schema and kcu.table_name = tc.table_name
                where tc.table_schema = current_schema() and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')""")
    fks = q("""select kcu.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_column
               from information_schema.table_constraints tc
               join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.constraint_schema = tc.constraint_schema
               join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
               where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = current_schema()""")
    sizes = {r["table_name"]: r["size"] for r in q(
        """select table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
           from information_schema.tables where table_schema = current_schema() and table_type = 'BASE TABLE'""")}
    pk = {(k["table_name"], k["column_name"]) for k in keys if k["constraint_type"] == "PRIMARY KEY"}
    uq = {(k["table_name"], k["column_name"]) for k in keys if k["constraint_type"] == "UNIQUE"}
    fk = {(f["table_name"], f["column_name"]): f"{f['ref_table']}.{f['ref_column']}" for f in fks}
    out: dict[str, dict] = {}
    for c in cols:
        t = c["table_name"]
        out.setdefault(t, {"table": t, "rows": None, "size": sizes.get(t), "columns": []})
        out[t]["columns"].append({"name": c["column_name"], "type": c["udt_name"], "nullable": c["is_nullable"] == "YES",
                                  "default": c["column_default"], "pk": (t, c["column_name"]) in pk,
                                  "unique": (t, c["column_name"]) in uq, "references": fk.get((t, c["column_name"]))})
    for t in out:  # t comes from the database's own table list, quoted below
        out[t]["rows"] = q1('select count(*) as row_count from "%s"' % t.replace('"', '""'))["row_count"]
    return list(out.values())


@router.get("/{table}")
def read_rows(table: str, term: str = Query("", alias="q"), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
              _=Depends(require("admin"))):
    cfg, cols = _cfg(table)
    where, params = "", {"limit": limit, "offset": offset}
    if term.strip():
        where = "where concat_ws(' ', " + ", ".join(f'cast("{c["name"]}" as text)' for c in cols) + ") ilike %(like)s"
        params["like"] = f"%{term.strip()}%"
    order = ", ".join(f'"{k}" desc' for k in cfg["pk"])
    rows = q(f'select {_sel(cols)} from "{table}" {where} order by {order} limit %(limit)s offset %(offset)s', params)
    total = q1(f'select count(*) as n from "{table}" {where}', params)["n"]
    return {"columns": cols, "rows": rows, "total": total, "can_insert": bool(cfg["insert"]), "can_delete": cfg["delete"], "insert_columns": cfg["insert"]}


@router.post("/{table}/update")
def update_row(table: str, b: Update, admin=Depends(require("admin"))):
    cfg, cols = _cfg(table)
    bad = [k for k in b.values if k not in cfg["edit"]]
    if bad:
        raise HTTPException(400, f"Not editable here: {', '.join(bad)}. Protected: history, audit and passwords are locked, and plant position/status only change through scans, corrections and removals.")
    if not b.values:
        raise HTTPException(400, "Nothing to change")
    if table == "users" and b.key.get("id") == str(admin["id"]) and ({"role", "active"} & set(b.values)):
        raise HTTPException(400, "You cannot change your own role or disable your own account")
    by = {c["name"]: c for c in cols}
    where, params = _where(cfg, b.key)
    sets = []
    for i, (k, v) in enumerate(b.values.items()):
        sets.append(f'"{k}" = %(v{i})s')
        params[f"v{i}"] = _val(by[k], v)
    with tx() as c:
        before = c.execute(f'select {_sel(cols)} from "{table}" where {where} for update', params).fetchone()
        if not before:
            raise HTTPException(404, "Row not found")
        c.execute(f'update "{table}" set {", ".join(sets)} where {where}', params)
        after = c.execute(f'select {_sel(cols)} from "{table}" where {where}', params).fetchone()
        audit(c, admin["id"], "db.update", _target(table, b.key), before, after)
    return after


@router.post("/{table}/insert", status_code=201)
def insert_row(table: str, b: Insert, admin=Depends(require("admin"))):
    cfg, cols = _cfg(table)
    if not cfg["insert"]:
        raise HTTPException(403, "Rows cannot be added to this table here")
    vals = {k: v for k, v in b.values.items() if v not in (None, "")}
    bad = [k for k in vals if k not in cfg["insert"]]
    if bad:
        raise HTTPException(400, f"Not allowed: {', '.join(bad)}")
    if not vals:
        raise HTTPException(400, "Nothing to add")
    missing = [k for k in cfg["pk"] if k not in vals]
    if missing:
        raise HTTPException(400, f"Required: {', '.join(missing)}")
    names = list(vals)
    params = {f"v{i}": vals[k] for i, k in enumerate(names)}
    q_cols = ", ".join('"%s"' % k for k in names)
    q_vals = ", ".join("%%(v%d)s" % i for i, _ in enumerate(names))
    where = " and ".join(f'"{k}" = %(k{i})s' for i, k in enumerate(cfg["pk"]))
    with tx() as c:
        c.execute(f'insert into "{table}"({q_cols}) values ({q_vals})', params)
        row = c.execute(f'select {_sel(cols)} from "{table}" where {where}', {f"k{i}": vals[k] for i, k in enumerate(cfg["pk"])}).fetchone()
        audit(c, admin["id"], "db.insert", f"{table}:" + ",".join(str(row[k]) for k in cfg["pk"]), None, row)
    return row


@router.post("/{table}/delete")
def delete_row(table: str, b: Key, admin=Depends(require("admin"))):
    cfg, cols = _cfg(table)
    if not cfg["delete"]:
        raise HTTPException(403, "Rows cannot be deleted from this table")
    where, params = _where(cfg, b.key)
    with tx() as c:
        row = c.execute(f'select {_sel(cols)} from "{table}" where {where}', params).fetchone()
        if not row:
            raise HTTPException(404, "Row not found")
        c.execute(f'delete from "{table}" where {where}', params)
        audit(c, admin["id"], "db.delete", _target(table, b.key), row, None)
    return {"ok": True}
