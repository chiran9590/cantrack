# CanTrack

```
mobile/    Flutter app (Android + iOS)  ─┐
frontend/  React + TypeScript + Tailwind ├─►  backend/ FastAPI  ─►  MySQL
                                         ┘
```

## 1. Database + backend  (needs Python 3.10 or newer: check with `python3 --version`; on a Mac `brew install python@3.12` if older)
```
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cantrack;"
cd backend-python
python -m venv .venv && .venv\Scripts\activate      # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                    # edit DATABASE_URL and JWT_SECRET (Mac/Linux: cp)
python -m app.init_db                     # creates / upgrades all 11 tables (safe to re-run)
python -m app.seed                        # demo users, L1/B2/B3 positions, sample plants
uvicorn app.main:app --reload --port 4000 --host 0.0.0.0
```
API docs: http://localhost:4000/docs

## 2. Website
```
cd frontend && npm install && npm run dev      # http://localhost:5173
```

## 3. Phone app
See `mobile/README.md`.

Demo logins (change before real use): admin@cantrack.local / ChangeMe123!, manager@ / Manager123!, breeder@ / Breeder123!, gardener@ / Gardener123!

## Website pages
`/` home (company details) · `/careers` · `/contact` · `/privacy` · `/legal` · `/login` · `/register` · `/app/...` dashboard (sign-in required)
Company text lives in `frontend/src/company.ts`: replace the placeholders with your real details.

## Registration
Anyone can register at `/register` (no email verification). New accounts get the read-only `member` role; an admin promotes them
in the Database tab. Settings in `backend/.env`: `OPEN_REGISTRATION=true|false`, `REGISTRATION_ROLE=member|gardener|...`
After updating, run `python3 -m app.init_db` once (adds the member role to an existing database).
