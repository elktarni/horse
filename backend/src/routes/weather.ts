import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';
import { fetchWeatherForLocation, getWeatherForLocations } from '../utils/weather';

const router = Router();
router.use(authMiddleware);

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
      const data = await getWeatherForLocations(locations);
      apiResponse(res, true, data, 'OK');
    } catch (err) {
      console.error('Weather batch error:', err);
      apiResponse(res, false, null, 'Failed to fetch weather', 500);
    }
  }
);

export default router;
