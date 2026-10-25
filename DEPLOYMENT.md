# Deployment Guide

## Backend (Railway) + Frontend (Vercel)

### Prerequisites
- GitHub account with repository
- Railway account (https://railway.app)
- Vercel account (https://vercel.com)

---

## 1. Push Code to GitHub

```bash
cd /Users/chiran/Downloads/CanTrack-261012_cantrack
git init
git add .
git commit -m "Initial commit - MySQL migration complete"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cantrack.git
git push -u origin main
```

---

## 2. Deploy Backend to Railway

### Step 1: Create Railway Project
1. Go to https://railway.app and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `cantrack` repository
4. Railway will detect the Python backend

### Step 2: Add MySQL Database
1. In your Railway project, click "New Service"
2. Select "Database" → "MySQL"
3. Railway will create a MySQL instance

### Step 3: Configure Environment Variables
Go to your backend service → Variables and add:

```
DATABASE_URL=mysql+pymysql://root:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=your-long-random-secret-at-least-32-characters
CORS_ORIGIN=https://your-frontend.vercel.app
SEED_ADMIN_PASSWORD=ChangeMe123!
OPEN_REGISTRATION=true
REGISTRATION_ROLE=member
PHENOMEONE_BASE_URL=
PHENOMEONE_USER=
PHENOMEONE_PASSWORD=
```

**Get MySQL credentials:**
- Click on your MySQL service in Railway
- Go to "Variables" tab
- Copy the connection string
- Format it as: `mysql+pymysql://USER:PASSWORD@HOST:PORT/DATABASE`

### Step 4: Initialize Database
Railway will automatically run the startup command. The `start.sh` script will:
1. Initialize the database schema
2. Seed demo data
3. Start the server

### Step 5: Deploy
- Railway will auto-deploy on push
- Get your backend URL from Railway (e.g., `https://cantrack-backend.railway.app`)

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
