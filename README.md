# CanTrack

```
cantrack_app/             Flutter app (Android + iOS)  ─┐
frontend/                 React + TypeScript + Tailwind ├─►  backend-python/  FastAPI  ─►  MySQL
                                                        ┘
```
The database is **MySQL**. Free hosting that works: **Aiven** (database) + **Render** (API) + **Vercel** (website). See `DEPLOYMENT.md`.

## 1. Database
Pick ONE:

**A. Cloud database (recommended: nothing to install, no passwords to lose, the same database for development and deployment)**
1. Sign up at https://aiven.com (free tier available), create a MySQL service, and copy the connection string.
2. That string is your `DATABASE_URL`.

**B. Local MySQL**
```
mysql -u root -p
CREATE DATABASE cantrack;
CREATE USER 'cantrack'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT ALL PRIVILEGES ON cantrack.* TO 'cantrack'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
`DATABASE_URL=mysql://cantrack:choose-a-password@localhost:3306/cantrack`

## 2. Backend (Python 3.10+)
```
cd backend-python
python3 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                       # edit DATABASE_URL and JWT_SECRET (Windows: copy)
python -m app.check_db                     # tells you if the connection works, and why not if it doesn't
python -m app.init_db                      # creates all tables (safe to re-run)
python -m app.seed                         # demo users, glasshouses L1/B2/B3, sample plants
uvicorn app.main:app --reload --port 4000 --host 0.0.0.0
```
API docs: http://localhost:4000/docs · health: http://localhost:4000/api/health/db

Make a long random `JWT_SECRET`:  `python -c "import secrets; print(secrets.token_urlsafe(48))"`

## 3. Website
```
cd frontend && npm install && npm run dev      # http://localhost:5173  (forwards /api to localhost:4000)
```

## 4. Phone app
See `cantrack_app/README.md`. In the app's server field enter your backend address, e.g. `https://cantrack-backend.onrender.com`.

Demo logins (change before real use): admin@cantrack.local / ChangeMe123!, manager@ / Manager123!, breeder@ / Breeder123!, gardener@ / Gardener123!
For a real deployment seed only the admin: `python -m app.seed --admin-only`.

## Website pages
`/` home · `/careers` · `/contact` · `/privacy` · `/legal` · `/login` · `/register` · `/app/...` dashboard (sign-in required)
Admin-only: **🗄️ Database** (overview, members, row counts) and **🛠️ Admin** (table editor + structure). Company text lives in `frontend/src/company.ts`.

## Registration
Anyone can register at `/register` (no email verification). New accounts get the read-only `member` role; an admin promotes them in the Database tab.
Settings in `backend-python/.env`: `OPEN_REGISTRATION=true|false`, `REGISTRATION_ROLE=member|gardener|...`

## Tests of the backend
`python -m app.check_db` (connection), and the interactive docs at `/docs`.
