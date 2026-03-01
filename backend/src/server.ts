import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db';
import seedAdmin from './scripts/seedAdmin';
import authRoutes from './routes/auth';
import racesRoutes from './routes/races';
import resultsRoutes from './routes/results';
import uploadRoutes from './routes/upload';
import weatherRoutes from './routes/weather';
import syncRoutes, { runCasaProgrammeSync } from './routes/sync';

const app = express();

const AUTO_SYNC_ENABLED = process.env.AUTO_SYNC_ENABLED !== 'false';
const AUTO_SYNC_INTERVAL_MS = Math.max(60_000, parseInt(process.env.AUTO_SYNC_INTERVAL_MS || '600000', 10));
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Required when behind a reverse proxy (e.g. Render): trust X-Forwarded-For so rate-limit sees real IP
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, data: null, message: 'Too many requests' },
});
app.use('/api/', limiter);

// Public: no auth required (so you can check the API is reachable)
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'API healthy' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/races', racesRoutes);
app.use('/api/v1/results', resultsRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/sync', syncRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'API healthy' });
});

function startAutoSync(): void {
  if (!AUTO_SYNC_ENABLED) return;
  const run = () => {
    const today = new Date().toISOString().slice(0, 10);
    runCasaProgrammeSync({ date: today, venue: 'SOREC', addRaces: false })
      .then((r) => {
        const n = r.created.length + r.updated.length;
        if (n > 0) console.log(`[Auto-sync] ${r.message}`);
      })
      .catch((err) => console.error('[Auto-sync]', err));
  };
  run(); // run once on startup
  setInterval(run, AUTO_SYNC_INTERVAL_MS);
  console.log(`Auto-sync enabled: every ${AUTO_SYNC_INTERVAL_MS / 60_000} min`);
}

connectDB()
  .then(() => seedAdmin())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startAutoSync();
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

export default app;
