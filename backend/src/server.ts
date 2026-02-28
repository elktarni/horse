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

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/races', racesRoutes);
app.use('/api/v1/results', resultsRoutes);
app.use('/api/v1/upload', uploadRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: 'API healthy' });
});

connectDB()
  .then(() => seedAdmin())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });

export default app;
