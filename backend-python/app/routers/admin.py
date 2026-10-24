import os
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException

from ..auth import hash_pw, require
from ..db import audit, q, q1, tx
from ..schemas import NewUser, UserPatch

router = APIRouter(tags=["admin"])
TABLES = ["users", "glasshouses", "platforms", "positions", "genotypes", "plants", "plant_location_history",
          "plant_status_history", "scan_sessions", "scan_rejections", "audit_log"]
USER_COLS = "id, name, email, role, active, created_at, last_login_at"


@router.get("/users")
def list_users(_=Depends(require("admin"))):
    return q(f"select {USER_COLS} from users order by id")


@router.post("/users", status_code=201)
def add_user(b: NewUser, admin=Depends(require("admin"))):
    with tx() as c:
        with c.cursor() as cur:
            cur.execute("insert into users(name,email,password_hash,role) values (%s,%s,%s,%s)",
                      (b.name, b.email, hash_pw(b.password), b.role))
            cur.execute(f"select {USER_COLS} from users where email=%s", (b.email,))
            r = cur.fetchone()
        audit(c, admin["id"], "user.create", f"user:{r['id']}", None, {"email": b.email, "role": b.role})
    return r


@router.patch("/users/{uid}")
def edit_user(uid: int, body: UserPatch, admin=Depends(require("admin"))):
    b = body.model_dump(exclude_unset=True)
    if uid == admin["id"] and (b.get("active") is False or ("role" in b and b["role"] != "admin")):
        raise HTTPException(400, "You cannot disable or demote your own account")
    before = q1("select id, name, role, active from users where id=%s", (uid,))
    if not before:
        raise HTTPException(404, "User not found")
    sets, params = [], {"id": uid}
    for k in ("name", "role", "active"):  # fixed whitelist: safe to put in SQL
        if k in b:
            sets.append(f"{k} = %({k})s")
            params[k] = b[k]
    if "password" in b:
        sets.append("password_hash = %(ph)s")
        params["ph"] = hash_pw(b["password"])
    if not sets:
        raise HTTPException(400, "Nothing to change")
    with tx() as c:
        with c.cursor() as cur:
            cur.execute(f"update users set {', '.join(sets)} where id = %(id)s", params)
        audit(c, admin["id"], "user.update", f"user:{uid}", before, {k: v for k, v in b.items() if k != "password"} | ({"password": "changed"} if "password" in b else {}))
    return q1(f"select {USER_COLS} from users where id=%s", (uid,))


@router.get("/admin/overview")
def overview(_=Depends(require("admin"))):
    u = urlparse(os.environ["DATABASE_URL"])
    info = q1("select database() as name, 'N/A' as size, version() as version")
    try:
        data_dir = None  # MySQL doesn't expose data directory in the same way
    except Exception:
        data_dir = None  # needs superuser or the pg_read_all_settings role
    users = q(f"select {USER_COLS} from users order by id")
    by_role: dict[str, int] = {}
    for x in users:
        if x["active"]:
            by_role[x["role"]] = by_role.get(x["role"], 0) + 1
    tables = [q1(f"select '{t}' as \"table\", count(*) as rows, 'N/A' as size from {t}") for t in TABLES]
    act = q1("select count(*) as total, sum(case when moved_at >= current_date then 1 else 0 end) as today, max(moved_at) as last_scan from plant_location_history")
    return {
        "database": {**info, "host": u.hostname, "port": u.port or 3306, "data_directory": data_dir},
        "members": {"total": len([x for x in users if x["active"]]), "by_role": by_role},
        "users": users, "tables": tables, "scans": act,
    }
