import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import errors as pgerr
from starlette.exceptions import HTTPException as StarletteHTTPException

load_dotenv()
if not os.environ.get("DATABASE_URL") or len(os.environ.get("JWT_SECRET", "")) < 32:
    raise RuntimeError("Set DATABASE_URL and a JWT_SECRET of at least 32 characters in backend/.env")

from .db import pool  # noqa: E402
from .routers import admin, auth, dbadmin, facility, plants, reports  # noqa: E402


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(title="CanTrack API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGIN", "").split(","), allow_methods=["*"], allow_headers=["*"])
for r in (auth, facility, plants, reports, admin, dbadmin):
    app.include_router(r.router, prefix="/api")


# Every error is {"error": "..."} so the website and the app can show the message directly.
@app.exception_handler(StarletteHTTPException)
async def http_err(_, e):
    return JSONResponse({"error": e.detail}, status_code=e.status_code)


@app.exception_handler(RequestValidationError)
async def val_err(_, e):
    msg = ", ".join(f"{x['loc'][-1]}: {x['msg']}" for x in e.errors())
    return JSONResponse({"error": msg}, status_code=400)


def _pg_msg(e) -> str:
    d = e.diag
    return " ".join(x for x in (d.message_primary, d.message_detail) if x) or "The database rejected this change"


@app.exception_handler(pgerr.UniqueViolation)
async def dup_err(_, e):
    detail = e.diag.message_detail
    return JSONResponse({"error": "Already exists, or that position was just taken" + (f" ({detail})" if detail else "")}, status_code=409)


@app.exception_handler(pgerr.IntegrityError)
async def integrity_err(_, e):
    return JSONResponse({"error": _pg_msg(e)}, status_code=409)


@app.exception_handler(pgerr.DataError)
async def data_err(_, e):
    return JSONResponse({"error": _pg_msg(e)}, status_code=400)


@app.exception_handler(Exception)
async def any_err(_, e):
    print("ERROR:", repr(e))
    return JSONResponse({"error": "Server error"}, status_code=500)
