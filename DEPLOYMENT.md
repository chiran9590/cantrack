# Free deployment: Neon (database) + Render (API) + Vercel (website)

| Part | Service | Free-tier facts (checked Oct 2026: re-check the pricing pages) |
|---|---|---|
| Database | **Neon** Postgres | permanent free plan, no card, 0.5 GB, scale-to-zero after 5 min idle (first query then takes a couple of seconds) |
| API | **Render** web service (Free) | sleeps after 15 min without traffic; wakes in about a minute; 750 free hours/month |
| Website | **Vercel** (Hobby) | free for personal projects |

Do **not** use Render's free PostgreSQL: it expires. Render's free web service has no Shell, so the commands below run on your laptop against Neon.

Use the same region family for speed, e.g. Neon `AWS Asia Pacific (Singapore)` + Render `Singapore`.

## 1. Push to GitHub
```
cd CanTrack-261012_cantrack
git init && git add . && git commit -m "CanTrack" && git branch -M main
git remote add origin https://github.com/YOUR_USER/cantrack.git && git push -u origin main
```
`.env` is git-ignored: never commit it.

## 2. Neon database
1. neon.com → New project → copy the connection string from **Connect**. It looks like `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
2. On your laptop, put it in `backend-python/.env` as `DATABASE_URL` and run once:
```
cd backend-python && source .venv/bin/activate
python -m app.check_db            # must say OK
python -m app.init_db             # creates the tables
python -m app.seed --admin-only   # creates admin@cantrack.local with SEED_ADMIN_PASSWORD (use python -m app.seed for demo data)
```
To bring your local MySQL data to Neon instead of seeding: skip the seed line and run `python -m app.migrate_from_mysql --user root --database cantrack` (see README).

## 3. Render API
1. Render → New → **Web Service** → pick the repo.
2. Settings: Root Directory `backend-python` · Runtime Python 3 · Build `pip install -r requirements.txt` · Start `bash start.sh` · Instance type **Free** · Health check path `/api/health`.
   (Or use the `render.yaml` in the repo root: New → Blueprint.)
3. Environment variables:
```
DATABASE_URL=<the Neon string>
JWT_SECRET=<python -c "import secrets; print(secrets.token_urlsafe(48))">
CORS_ORIGIN=https://YOUR-SITE.vercel.app        (fill in after step 4, no trailing slash)
SEED_ADMIN_PASSWORD=<strong password>
OPEN_REGISTRATION=true
REGISTRATION_ROLE=member
PYTHON_VERSION=3.12.7
```
4. Deploy. Open `https://YOUR-API.onrender.com/api/health/db`: it should say `reachable`. `start.sh` runs `init_db` on every start (idempotent, never touches data).

## 4. Vercel website
1. Vercel → Add New → Project → import the repo → **Root Directory: `frontend`**.
2. Environment variable: `VITE_API_URL=https://YOUR-API.onrender.com` (no trailing slash).
3. Deploy, then go back to Render and set `CORS_ORIGIN` to the Vercel URL (comma-separate several). For Vercel preview URLs also set `CORS_ORIGIN_REGEX=https://cantrack-.*\.vercel\.app`.

## 5. Check
Sign in as admin → **🗄️ Database** shows PostgreSQL version, size and row counts → **🛠️ Admin** lists the tables, and Structure shows all relationships.

## Free-tier behaviour to expect
- First visit after idle: the site loads at once (the page pings the API as it opens) but the first login may take up to a minute while Render wakes up. A monitor such as UptimeRobot hitting `/api/health` every 5 minutes keeps it awake and fits inside 750 hours for one service (about 744 h in a 31-day month); Render calls free instances unsuitable for production.
- Neon pauses after 5 idle minutes; the first query after that is slower by a second or two. The app reconnects by itself.
- 0.5 GB storage: roughly millions of small rows: fine for this app; watch `audit_log` and `plant_location_history`.

## Hardening before real users
Change every demo password · use a new `JWT_SECRET` (32+ random chars) · set `OPEN_REGISTRATION=false` if the public should not sign up · keep `CORS_ORIGIN` to your real site.
