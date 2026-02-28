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

1. Create a Web Service, connect repo.
2. Build: `npm install && npm run build`
3. Start: `npm start`
4. Set env vars: `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL` (Vercel URL), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT` (optional).

### Frontend (Vercel)

1. Import project, root directory = repo root.
2. Build: `npm run build`, output = Next.js.
3. Set `NEXT_PUBLIC_API_URL` to the Render backend URL (e.g. `https://your-api.onrender.com`).

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
