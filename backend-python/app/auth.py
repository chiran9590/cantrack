import os
import time

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import q1

bearer = HTTPBearer(auto_error=False)
ALGO = "HS256"


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt(10)).decode()


def check_pw(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode()[:72], hashed.encode())


def sign(user: dict) -> str:
    return jwt.encode({**user, "exp": int(time.time()) + 8 * 3600}, os.environ["JWT_SECRET"], algorithm=ALGO)  # 8h session timeout


def current_user(cred: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if not cred:
        raise HTTPException(401, "Not signed in")
    try:
        p = jwt.decode(cred.credentials, os.environ["JWT_SECRET"], algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, please sign in again")
    # Re-check the database each request so deactivation and role changes apply immediately.
    u = q1("select id, name, email, role from users where id = %s and active", (p["id"],))
    if not u:
        raise HTTPException(401, "Account disabled or not found")
    return u


def require(*roles: str):
    def dep(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(403, "You do not have permission")
        return user
    return dep
