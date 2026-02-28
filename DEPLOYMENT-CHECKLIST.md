# Deployment checklist – fix login & Render

## 1. Fix Render (backend) – "failed" state

In **Render Dashboard** → your service (horse-racing-api) → **Logs** tab:

- Check the **latest logs** after deploy. You’ll see either:
  - **Build logs:** errors during `npm run build`.
  - **Runtime logs:** errors when the app starts (e.g. `MongoDB connection error`, `JWT_SECRET`, crash).

**Environment variables** (Render → **Environment** tab) – all must be set:

| Variable         | Example / note |
|------------------|-----------------|
| `MONGODB_URI`    | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` |
| `JWT_SECRET`     | Any long random string (e.g. 32+ chars) |
| `FRONTEND_URL`   | `https://horse-opal.vercel.app` (no trailing slash) |
| `ADMIN_EMAIL`    | Admin login email |
| `ADMIN_PASSWORD`| Admin login password |
| `JWT_EXPIRES_IN` | Optional, e.g. `7d` |

- Fix any typo in `MONGODB_URI` (e.g. use `&` not `?` for extra query params).
- After changing env vars, use **Manual Deploy** → **Deploy latest commit**.

Copy your **Render service URL** (e.g. `https://horse-racing-api-xxxx.onrender.com`). You need it for Vercel.

---

## 2. Fix Vercel (frontend) – so login can reach the API

The app on Vercel talks to the backend **through a proxy**. The proxy must know your **Render URL**.

In **Vercel Dashboard** → your project → **Settings** → **Environment Variables**:

| Name                     | Value                                      | Environment   |
|--------------------------|--------------------------------------------|---------------|
| `NEXT_PUBLIC_API_URL`    | Your Render URL (e.g. `https://horse-racing-api-xxxx.onrender.com`) | Production (and Preview if you use it) |

- **No trailing slash** in the URL.
- Save, then go to **Deployments** → open the **⋯** on the latest deployment → **Redeploy** (so the new env is used).

---

## 3. Quick check

1. **Backend:** Open `https://YOUR-RENDER-URL.onrender.com/api/health` in the browser.  
   You should see something like: `{"success":true,"data":{"status":"ok"},"message":"API healthy"}`.

2. **Frontend:** Go to https://horse-opal.vercel.app/ and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (the same as in Render).

If the health check fails, fix Render first (env vars + logs). If it works but login still fails, confirm `NEXT_PUBLIC_API_URL` on Vercel and redeploy.
