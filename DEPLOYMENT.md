# Deployment Guide

## Backend (Render) + Frontend (Vercel)

### Prerequisites
- GitHub account with repository
- Render account (https://render.com)
- Vercel account (https://vercel.com)

---

## 1. Push Code to GitHub

```bash
cd /Users/chiran/Downloads/CanTrack-261012_cantrack
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cantrack.git
git push -u origin main
```

---

## 2. Deploy Backend to Render

### Step 1: Create Render Project
1. Go to https://dashboard.render.com/web/new
2. Click "Connect" to link your GitHub account
3. Select `chiran9590/cantrack` repository
4. Set "Root Directory" to `backend-python`
5. Configure:
   - **Name**: `cantrack-backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Step 2: Add PostgreSQL Database
1. In your Render dashboard, click "New" → "PostgreSQL"
2. Name it `cantrack-db`
3. Select a region close to you
4. Click "Create Database"

### Step 3: Configure Environment Variables
Go to your backend service → Environment and add:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=your-long-random-secret-at-least-32-characters
CORS_ORIGIN=https://your-frontend.vercel.app
SEED_ADMIN_PASSWORD=ChangeMe123!
OPEN_REGISTRATION=true
REGISTRATION_ROLE=member
PHENOMEONE_BASE_URL=
PHENOMEONE_USER=
PHENOMEONE_PASSWORD=
```

**Get PostgreSQL credentials:**
- Click on your PostgreSQL service in Render
- Go to "Connections" tab
- Copy the "Internal Database URL"
- Use it as `DATABASE_URL`

### Step 4: Initialize Database
Since Render doesn't run startup scripts automatically, you need to initialize the database manually:

1. After deployment, go to Render → your service → "Shell"
2. Run:
```bash
python -m app.init_db
python -m app.seed
```

### Step 5: Deploy
- Click "Create Web Service"
- Render will build and deploy
- Get your backend URL (e.g., `https://cantrack-backend.onrender.com`)

---

## 3. Deploy Frontend to Vercel

### Step 1: Create Vercel Project
1. Go to https://vercel.com and sign in
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Set "Root Directory" to `frontend`

### Step 2: Configure Environment Variables
In Vercel project settings → Environment Variables:

```
VITE_API_URL=https://your-backend.railway.app
```

### Step 3: Deploy
- Click "Deploy"
- Vercel will build and deploy your React app
- Get your frontend URL (e.g., `https://cantrack.vercel.app`)

### Step 4: Update CORS
Go back to Railway backend service → Variables:
- Update `CORS_ORIGIN` to your Vercel frontend URL

---

## 4. Post-Deployment Setup

### Secure MySQL
1. In Railway MySQL service, set a strong password
2. Update `DATABASE_URL` in Railway variables

### Secure JWT
Generate a strong JWT_SECRET:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Change Demo Passwords
After first login, change all demo user passwords.

---

## 5. Testing

1. Visit your Vercel frontend URL
2. Login with: `admin@cantrack.local` / `ChangeMe123!`
3. Verify dashboard loads
4. Test plant management features

---

## Cost Estimates

**Railway (Free Tier):**
- $5/month free credit
- MySQL: ~$5/month after free tier
- Backend: ~$5/month after free tier

**Vercel (Free Tier):**
- Free for personal projects
- Unlimited deployments
- SSL included

**Total:** ~$10/month after free tiers expire

---

## Troubleshooting

### Backend won't start
- Check Railway logs
- Verify DATABASE_URL format
- Ensure MySQL service is running

### Frontend can't connect to backend
- Verify VITE_API_URL is correct
- Check CORS_ORIGIN in Railway matches Vercel domain
- Check Railway backend is running

### Database errors
- Re-run initialization: Railway console → `python -m app.init_db`
- Check MySQL service is healthy in Railway
