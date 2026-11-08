# Free deployment: Aiven MySQL + Render (API) + Vercel (website)

| Part | Service | Free-tier facts |
|---|---|---|
| Database | **Aiven** MySQL | free tier with 1GB, 30-day trial (check current pricing) |
| API | **Render** web service (Free) | sleeps after 15 min without traffic; wakes in about a minute; 750 free hours/month |
| Website | **Vercel** (Hobby) | free for personal projects |

Use the same region family for speed, e.g. Aiven `AWS Asia Pacific (Singapore)` + Render `Singapore`.

## 1. Aiven MySQL database
1. aiven.com → Create service → MySQL → Free tier → copy the connection string. It looks like `mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb?ssl-mode=REQUIRED`.
2. On your laptop, put it in `backend-python/.env` as `DATABASE_URL` and run once:
```
cd backend-python
python -m app.check_db            # must say OK
python -m app.init_db             # creates the tables
python -m app.seed --admin-only   # creates admin@cantrack.local with SEED_ADMIN_PASSWORD (use python -m app.seed for demo data)
```

## 2. Render API
1. Render → New → **Web Service** → pick the repo.
2. Settings: Root Directory `backend-python` · Build `pip install -r requirements.txt` · Start `bash start.sh` · Instance type **Free** · Health check path `/api/health`.
3. Environment variables:
```
DATABASE_URL=<the Aiven MySQL string>
JWT_SECRET=<32+ random characters, e.g. from python -c "import secrets; print(secrets.token_urlsafe(48))">
CORS_ORIGIN=https://YOUR-SITE.vercel.app        (fill in after step 3, no trailing slash)
SEED_ADMIN_PASSWORD=<strong password>
OPEN_REGISTRATION=true
REGISTRATION_ROLE=member
```
4. Deploy. Open `https://YOUR-API.onrender.com/api/health/db`: it should say `reachable`. `start.sh` runs `init_db` on every start (idempotent, never touches data), then `seed`, then starts uvicorn.

## 3. Vercel website
1. Vercel → Add New → Project → import the repo → **Root Directory: `frontend`**.
2. Before deploying, edit `frontend/vercel.json` and replace `YOUR-BACKEND.onrender.com` with your actual Render hostname.
3. Deploy. No environment variables needed (the frontend calls `/api` which Vercel forwards to the backend).

## 4. Post-deploy
1. Sign in as `admin@cantrack.local` with the password from `SEED_ADMIN_PASSWORD`.
2. Change or deactivate the demo manager/breeder/gardener accounts in **🛠️ Admin**.

## Free-tier behaviour to expect
- First visit after idle: the site loads at once (the page pings the API as it opens) but the first login may take up to a minute while Render wakes up. The free Render backend sleeps after 15 minutes idle.
- Aiven MySQL requires TLS (the connection string includes `?ssl-mode=REQUIRED`).
