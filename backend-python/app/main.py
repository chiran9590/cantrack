import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymysql import MySQLError
from starlette.exceptions import HTTPException as StarletteHTTPException

load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
if not os.environ.get("DATABASE_URL") or len(os.environ.get("JWT_SECRET", "")) < 32:
    raise RuntimeError("Set DATABASE_URL and a JWT_SECRET of at least 32 characters in backend/.env")

from .routers import admin, auth, dbadmin, facility, plants, reports  # noqa: E402


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


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


@app.exception_handler(MySQLError)
async def mysql_err(_, e):
    error_code = e.args[0] if e.args else 0
    if error_code == 1062:  # Duplicate entry
        return JSONResponse({"error": "Already exists, or that position was just taken"}, status_code=409)
    elif error_code in (1452, 1451):  # Foreign key constraint
        return JSONResponse({"error": "The database rejected this change (constraint violation)"}, status_code=409)
    else:
        return JSONResponse({"error": str(e) or "The database rejected this change"}, status_code=400)


@app.exception_handler(Exception)
async def any_err(_, e):
    print("ERROR:", repr(e))
    return JSONResponse({"error": "Server error"}, status_code=500)
