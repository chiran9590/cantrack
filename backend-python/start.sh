#!/bin/bash
python -m app.init_db
python -m app.seed
uvicorn app.main:app --host 0.0.0.0 --port $PORT
