import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Uses Open-Meteo (free, no API key): geocoding + current weather
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

      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
      );
      const geoData = await geoRes.json().catch(() => ({}));
      const results = (geoData as { results?: Array<{ latitude: number; longitude: number }> }).results;
      if (!results || results.length === 0) {
        apiResponse(res, false, null, `Location "${location}" not found`, 404);
        return;
      }
      const { latitude, longitude } = results[0];

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`
      );
      const weatherData = await weatherRes.json().catch(() => ({}));
      const current = (weatherData as { current?: { temperature_2m: number } }).current;
      if (!current || typeof current.temperature_2m !== 'number') {
        apiResponse(res, false, null, 'Weather data unavailable', 502);
        return;
      }

      apiResponse(res, true, { temp: current.temperature_2m, unit: '°C' }, 'OK');
    } catch (err) {
      console.error('Weather fetch error:', err);
      apiResponse(res, false, null, 'Failed to fetch weather', 500);
    }
  }
);

export default router;
