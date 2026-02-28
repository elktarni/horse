# Horse Racing Admin Dashboard

Production-ready full-stack admin dashboard for managing horse racing data.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS (dark theme)
- **Backend:** Node.js + Express + TypeScript
- **Database:** MongoDB Atlas
- **Auth:** JWT (admin only), bcrypt password hashing
- **Deployment:** Render (backend) + Vercel (frontend) compatible

## Project Structure

```
├── backend/          # Express API
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── scripts/
│   │   └── server.ts
│   └── package.json
├── app/              # Next.js App Router
├── components/
├── lib/
└── package.json      # Frontend
```

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, FRONTEND_URL
npm install
npm run dev
```

Backend runs at `http://localhost:4000`. On first run, an admin user is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` if none exists.

### 2. Frontend

```bash
# From project root
cp .env.example .env.local
# Optional: set NEXT_PUBLIC_API_URL=http://localhost:4000 for direct API calls (default uses same-origin proxy)
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`. Log in with the admin credentials from `.env`.

### 3. MongoDB Atlas

Create a cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), get the connection string, and set `MONGODB_URI` in `backend/.env`.

## API (v1)

Base path: `/api/v1`

### Auth

- `POST /auth/login` — Body: `{ email, password }` → `{ token, email }`

### Races

- `GET /races?date=YYYY-MM-DD` — List races (optional date filter)
- `GET /races/:id` — Get one race
- `POST /races` — Create race (body: date, hippodrome, race_number, time, distance, title, participants)
- `PUT /races/:id` — Update race
- `DELETE /races/:id` — Delete race

### Results

- `GET /results` — List all result race_ids
- `GET /results/:race_id` — Get result for a race
- `POST /results` — Create result (body: race_id, arrival, rapports, simple, couple, trio)
- `PUT /results/:race_id` — Update result
- `DELETE /results/:race_id` — Delete result

### Upload

- `POST /upload/race-json` — Body: `{ data: <race object> }` — Import one race from JSON

All routes except `/auth/login` require header: `Authorization: Bearer <token>`.

Responses: `{ success: boolean, data: any, message: string }`

## Security

- Helmet, CORS, rate limiting (100 req/15 min)
- JWT with configurable expiry
- bcrypt password hashing
- Input validation (express-validator)
- Duplicate `race_id` prevented

## Deployment

### Backend (Render)

**Important:** The backend lives in the `backend/` folder. Render must use that as the root, not the repo root.

1. In [Render](https://render.com): **New → Web Service**, connect your GitHub repo.
2. Set **Root Directory** to `backend` (required — otherwise Render builds the Next.js app and fails with "next: not found").
3. **Build Command:** `npm install --include=dev && npm run build` (dev deps needed for TypeScript compile)
4. **Start Command:** `npm start`
5. **Environment variables** (Dashboard → Environment):
   - `MONGODB_URI` — MongoDB Atlas connection string
   - `JWT_SECRET` — secret for JWT signing
   - `FRONTEND_URL` — your Vercel app URL (e.g. `https://horse-opal.vercel.app`)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` — admin login
   - `JWT_EXPIRES_IN` — optional, default `7d`

Optional: use the repo’s `render.yaml` (Blueprint) to create the service with `rootDir: backend` and env vars.

### Frontend (Vercel)

1. Import project; root = repo root. Build: `npm run build`.
2. Set **Environment Variable:** `NEXT_PUBLIC_API_URL` = your Render backend URL (e.g. `https://horse-racing-api-xxxx.onrender.com`).
3. Redeploy so the frontend calls the live API.

## JSON Upload (Bonus)

From **Upload JSON** in the dashboard you can paste or drop a JSON file with one race. Required shape:

```json
{
  "date": "2025-02-28",
  "hippodrome": "Longchamp",
  "race_number": 1,
  "time": "14:30",
  "distance": 1600,
  "title": "Prix Example",
  "participants": [
    { "number": 1, "horse": "Horse A", "jockey": "Jockey A", "weight": 58 }
  ]
}
```

Race `_id` is auto-generated as `YYYY-MM-DD-race_number`.
