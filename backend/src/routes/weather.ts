import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const CACHE_MS = 10 * 60 * 1000; // 10 min
const weatherCache = new Map<string, { temp: number; unit: string; ts: number }>();

async function fetchWeatherForLocation(location: string): Promise<{ temp: number; unit: string } | null> {
  const cached = weatherCache.get(location);
  if (cached && Date.now() - cached.ts < CACHE_MS) return { temp: cached.temp, unit: cached.unit };

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
    );
    const geoData = await geoRes.json().catch(() => ({}));
    const results = (geoData as { results?: Array<{ latitude: number; longitude: number }> }).results;
    if (!results || results.length === 0) return null;
    const { latitude, longitude } = results[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`
    );
    const weatherData = await weatherRes.json().catch(() => ({}));
    const current = (weatherData as { current?: { temperature_2m: number } }).current;
    if (!current || typeof current.temperature_2m !== 'number') return null;

    const result = { temp: current.temperature_2m, unit: '°C' as const };
    weatherCache.set(location, { ...result, ts: Date.now() });
    return result;
  } catch {
    return null;
  }
}

// Single location: GET /api/v1/weather?location=Settat
router.get(
  '/',
  [query('location').notEmpty().trim().withMessage('location required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const location = (req.query.location as string).trim();
      const result = await fetchWeatherForLocation(location);
      if (!result) {
        apiResponse(res, false, null, `Location "${location}" not found or weather unavailable`, 404);
        return;
      }
      apiResponse(res, true, result, 'OK');
    } catch (err) {
      console.error('Weather fetch error:', err);
      apiResponse(res, false, null, 'Failed to fetch weather', 500);
    }
  }
);

// Batch: POST /api/v1/weather/batch body { locations: string[] }
router.post(
  '/batch',
  [body('locations').isArray().withMessage('locations array required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const locations = [...new Set((req.body.locations as string[]).map((l: string) => String(l).trim()).filter(Boolean))];
      const data: Record<string, { temp: number; unit: string } | null> = {};
      await Promise.all(
        locations.map(async (loc) => {
          data[loc] = await fetchWeatherForLocation(loc);
        })
      );
      apiResponse(res, true, data, 'OK');
    } catch (err) {
      console.error('Weather batch error:', err);
      apiResponse(res, false, null, 'Failed to fetch weather', 500);
    }
  }
);

export default router;
