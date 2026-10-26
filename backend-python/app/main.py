import os
from contextlib import asynccontextmanager

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg_pool import PoolTimeout
from starlette.exceptions import HTTPException as StarletteHTTPException

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
if not os.environ.get("DATABASE_URL") or len(os.environ.get("JWT_SECRET", "")) < 32:
    raise RuntimeError("Set DATABASE_URL and a JWT_SECRET of at least 32 characters (backend-python/.env, or the host's environment settings)")

from .db import close_pool, pool, q1  # noqa: E402
from .routers import admin, auth, dbadmin, facility, plants, reports  # noqa: E402


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool()          # open the connection pool
    yield
    close_pool()


app = FastAPI(title="CanTrack API", lifespan=lifespan)
origins = [o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGIN", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX") or None,  # e.g. https://cantrack-.*\.vercel\.app for preview deployments
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (auth, facility, plants, reports, admin, dbadmin):
    app.include_router(r.router, prefix="/api")


@app.get("/api/health")
def health():
    """Cheap check for Render / uptime monitors (does not touch the database)."""
    return {"ok": True}


@app.get("/api/health/db")
def health_db():
    q1("select 1 as ok")
    return {"ok": True, "database": "reachable"}


# Every error is {"error": "..."} so the website and the app can show the message directly.
@app.exception_handler(StarletteHTTPException)
async def http_err(_, e):
    return JSONResponse({"error": e.detail}, status_code=e.status_code)


@app.exception_handler(RequestValidationError)
async def val_err(_, e):
    msg = ", ".join(f"{x['loc'][-1]}: {x['msg']}" for x in e.errors())
    return JSONResponse({"error": msg}, status_code=400)


@app.exception_handler(PoolTimeout)
async def pool_err(_, e):
    return JSONResponse({"error": "The database is not reachable right now. Try again in a few seconds."}, status_code=503)


@app.exception_handler(psycopg.Error)
async def db_err(_, e):
    code = getattr(e, "sqlstate", None) or ""
    if code == "23505":    # unique_violation
        return JSONResponse({"error": "Already exists, or that position was just taken"}, status_code=409)
    if code == "23503":    # foreign_key_violation
        return JSONResponse({"error": "The database rejected this change (it is linked to other records)"}, status_code=409)
    if code in ("23502", "23514"):  # not_null / check violation
        return JSONResponse({"error": "The database rejected this change (a required or allowed-value rule was broken)"}, status_code=400)
    if code.startswith("22"):       # bad value: wrong number / date / uuid / json format
        return JSONResponse({"error": "That value is not valid for this field"}, status_code=400)
    if code == "P0001":    # RAISE EXCEPTION from our read-only triggers
        return JSONResponse({"error": e.diag.message_primary or "Change refused by the database"}, status_code=403)
    if isinstance(e, psycopg.OperationalError):
        print("DB OPERATIONAL ERROR:", repr(e))
        return JSONResponse({"error": "The database is not reachable right now. Try again in a few seconds."}, status_code=503)
    print("DB ERROR:", repr(e))
    return JSONResponse({"error": "The database rejected this request"}, status_code=400)


@app.exception_handler(Exception)
async def any_err(_, e):
    print("ERROR:", repr(e))
    return JSONResponse({"error": "Server error"}, status_code=500)
