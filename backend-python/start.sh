#!/bin/bash
# Used by Render. init_db is idempotent: it creates missing tables and never touches your data.
python -m app.init_db
# Seed admin user if database is empty (safe to re-run)
python -m app.seed --admin-only
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-4000}"
