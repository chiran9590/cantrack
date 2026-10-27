import os

from fastapi import APIRouter, Depends, HTTPException

from ..auth import check_pw, current_user, hash_pw, sign
from ..db import audit, q1, tx
from ..limits import rate_limit
from ..schemas import ChangePassword, Login, Register

router = APIRouter(prefix="/auth", tags=["auth"])


def registration_open() -> bool:
    return os.environ.get("OPEN_REGISTRATION", "true").lower() in ("1", "true", "yes")


@router.get("/config")
def public_config():
    """Public: lets the website know whether to show the register form."""
    return {"registration_open": registration_open()}


@router.post("/login", dependencies=[Depends(rate_limit("login", 20, 60))])
def login(b: Login):
    u = q1("select * from users where lower(email)=lower(%s) and active", (b.email,))
    if not u or not check_pw(b.password, u["password_hash"]):
        raise HTTPException(401, "Wrong email or password")
    user = {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"]}
    with tx() as c:
        c.execute("update users set last_login_at = now() where id = %s", (u["id"],))
        audit(c, u["id"], "login", f"user:{u['id']}")
    return {"token": sign(user), "user": user}


@router.post("/register", status_code=201, dependencies=[Depends(rate_limit("register", 10, 3600))])
def register(b: Register):
    """Open sign-up with no e-mail verification (switch off with OPEN_REGISTRATION=false).
    New accounts get REGISTRATION_ROLE (default: read-only 'member'); an admin can promote them."""
    if not registration_open():
        raise HTTPException(403, "Registration is closed")
    if q1("select 1 from users where lower(email)=lower(%s)", (b.email,)):
        raise HTTPException(409, "An account with this email already exists")
    role = os.environ.get("REGISTRATION_ROLE", "member")
    if role not in ("member", "gardener", "breeder", "manager"):
        role = "member"
    with tx() as c:
        # MySQL has no "INSERT ... RETURNING": insert, then read the new id from c.lastrowid.
        c.execute("insert into users(name,email,password_hash,role,last_login_at) values (%s,%s,%s,%s,now())",
                  (b.name.strip(), b.email.strip(), hash_pw(b.password), role))
        u = {"id": c.lastrowid, "name": b.name.strip(), "email": b.email.strip(), "role": role}
        audit(c, u["id"], "user.register", f"user:{u['id']}", None, {"email": u["email"], "role": role})
    return {"token": sign(u), "user": u}


@router.get("/me")
def me(user=Depends(current_user)):
    return user


@router.post("/change-password")
def change_password(b: ChangePassword, user=Depends(current_user)):
    u = q1("select password_hash from users where id=%s", (user["id"],))
    if not check_pw(b.current_password, u["password_hash"]):
        raise HTTPException(400, "Current password is wrong")
    with tx() as c:
        c.execute("update users set password_hash=%s where id=%s", (hash_pw(b.new_password), user["id"]))
        audit(c, user["id"], "user.password_change", f"user:{user['id']}")
    return {"ok": True}
