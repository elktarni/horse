import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import Race from '../models/Race';
import Result from '../models/Result';
import { apiResponse } from '../middleware/response';
import { publicApiKeyMiddleware } from '../middleware/apiKey';
import { getRaceStatus } from '../utils/raceStatus';

const router = Router();
router.use(publicApiKeyMiddleware);

/** GET /api/v1/public/health */
router.get('/health', (_req: Request, res: Response): void => {
  apiResponse(res, true, { status: 'ok' }, 'API healthy');
});

/** GET /api/v1/public/races?date=YYYY-MM-DD */
router.get(
  '/races',
  [query('date').optional().isISO8601().withMessage('date must be YYYY-MM-DD')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const { date } = req.query;
      const filter: Record<string, unknown> = {};
      if (date && typeof date === 'string') {
        const dateStr = String(date).trim();
        const dateStart = new Date(dateStr + 'T00:00:00.000Z');
        const dateEnd = new Date(dateStr + 'T23:59:59.999Z');
        filter.date = { $gte: dateStart, $lte: dateEnd };
      }
      const races = await Race.find(filter).sort({ date: -1, race_number: 1 }).lean();
      const withStatus = races.map((r) => ({ ...r, status: getRaceStatus(r), weather: r.weather_temp ?? null }));
      apiResponse(res, true, withStatus, 'Races retrieved');
    } catch (err) {
      console.error('GET public races error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

/** GET /api/v1/public/races/:id */
router.get(
  '/races/:id',
  [param('id').notEmpty().withMessage('Race ID required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const race = await Race.findById(req.params.id).lean();
      if (!race) {
        apiResponse(res, false, null, 'Race not found', 404);
        return;
      }
      apiResponse(res, true, { ...race, status: getRaceStatus(race), weather: race.weather_temp ?? null }, 'Race retrieved');
    } catch (err) {
      console.error('GET public race error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

/** GET /api/v1/public/results?date=YYYY-MM-DD */
router.get(
  '/results',
  [query('date').optional().isISO8601().withMessage('date must be YYYY-MM-DD')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const date = req.query.date as string | undefined;
      const pipeline: Record<string, unknown>[] = [
        { $lookup: { from: 'races', localField: 'race_id', foreignField: '_id', as: 'race' } },
        { $unwind: { path: '$race', preserveNullAndEmptyArrays: true } },
        { $addFields: { title: '$race.title', weather: '$race.weather_temp' } },
      ];
      if (date) {
        const dateStart = new Date(date + 'T00:00:00.000Z');
        const dateEnd = new Date(date + 'T23:59:59.999Z');
        pipeline.push({ $match: { 'race.date': { $gte: dateStart, $lte: dateEnd } } });
      }
      pipeline.push({ $project: { race: 0 } });
      const results = await Result.aggregate(pipeline as never[]);
      apiResponse(res, true, results, 'Results retrieved');
    } catch (err) {
      console.error('GET public results error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

/** GET /api/v1/public/results/:race_id */
router.get(
  '/results/:race_id',
  [param('race_id').notEmpty().withMessage('race_id required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await Result.findOne({ race_id: req.params.race_id }).lean();
      if (!result) {
        apiResponse(res, false, null, 'Result not found', 404);
        return;
      }
      const race = await Race.findById(result.race_id).select('weather_temp').lean();
      const payload = { ...result, weather: race?.weather_temp ?? null };
      apiResponse(res, true, payload, 'Result retrieved');
    } catch (err) {
      console.error('GET public result error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

export default router;
