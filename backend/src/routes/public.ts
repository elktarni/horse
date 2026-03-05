import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import Race from '../models/Race';
import Result from '../models/Result';
import { apiResponse } from '../middleware/response';
import { publicApiKeyMiddleware } from '../middleware/apiKey';
import { getRaceStatus } from '../utils/raceStatus';
import { getWeatherForLocations } from '../utils/weather';

const router = Router();
router.use(publicApiKeyMiddleware);

/** GET /api/v1/public/health */
router.get('/health', (_req: Request, res: Response): void => {
  apiResponse(res, true, { status: 'ok' }, 'API healthy');
});

/** GET /api/v1/public/races?date=YYYY-MM-DD&venue=SOREC|PMU */
router.get(
  '/races',
  [
    query('date').optional().isISO8601().withMessage('date must be YYYY-MM-DD'),
    query('venue').optional().isIn(['SOREC', 'PMU']).withMessage('venue must be SOREC or PMU'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const { date, venue } = req.query;
      const filter: Record<string, unknown> = {};
      if (date && typeof date === 'string') {
        const dateStr = String(date).trim();
        const dateStart = new Date(dateStr + 'T00:00:00.000Z');
        const dateEnd = new Date(dateStr + 'T23:59:59.999Z');
        filter.date = { $gte: dateStart, $lte: dateEnd };
      }
      if (venue && typeof venue === 'string') {
        filter.$or = venue === 'SOREC'
          ? [{ venue: 'SOREC' }, { venue: { $exists: false } }, { venue: null }]
          : [{ venue: 'PMU' }];
      }
      const races = await Race.find(filter).sort({ date: -1, race_number: 1 }).lean();
      const hippodromes = [...new Set(races.map((r) => r.hippodrome).filter(Boolean))] as string[];
      const weatherMap = hippodromes.length ? await getWeatherForLocations(hippodromes) : {};
      const withStatus = races.map((r) => ({
        ...r,
        status: getRaceStatus(r),
        weather: r.hippodrome && weatherMap[r.hippodrome] ? weatherMap[r.hippodrome]!.temp : null,
      }));
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
      const weatherMap = race.hippodrome ? await getWeatherForLocations([race.hippodrome]) : {};
      const liveWeather = race.hippodrome && weatherMap[race.hippodrome] ? weatherMap[race.hippodrome]!.temp : null;
      apiResponse(res, true, { ...race, status: getRaceStatus(race), weather: liveWeather }, 'Race retrieved');
    } catch (err) {
      console.error('GET public race error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

/** GET /api/v1/public/results?date=YYYY-MM-DD&venue=SOREC|PMU */
router.get(
  '/results',
  [
    query('date').optional().isISO8601().withMessage('date must be YYYY-MM-DD'),
    query('venue').optional().isIn(['SOREC', 'PMU']).withMessage('venue must be SOREC or PMU'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const date = req.query.date as string | undefined;
      const venue = req.query.venue as string | undefined;
      const pipeline: Record<string, unknown>[] = [
        { $lookup: { from: 'races', localField: 'race_id', foreignField: '_id', as: 'race' } },
        { $unwind: { path: '$race', preserveNullAndEmptyArrays: true } },
        { $addFields: { title: '$race.title', hippodrome: '$race.hippodrome', time: '$race.time', reunion: '$race.reunion' } },
      ];
      const matchStage: Record<string, unknown> = {};
      if (date) {
        const dateStart = new Date(date + 'T00:00:00.000Z');
        const dateEnd = new Date(date + 'T23:59:59.999Z');
        matchStage['race.date'] = { $gte: dateStart, $lte: dateEnd };
      }
      if (venue) matchStage['race.venue'] = venue;
      if (Object.keys(matchStage).length) pipeline.push({ $match: matchStage });
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
      const race = await Race.findById(result.race_id).select('hippodrome').lean();
      const weatherMap = race?.hippodrome ? await getWeatherForLocations([race.hippodrome]) : {};
      const liveWeather = race?.hippodrome && weatherMap[race.hippodrome] ? weatherMap[race.hippodrome]!.temp : null;
      const payload = { ...result, weather: liveWeather };
      apiResponse(res, true, payload, 'Result retrieved');
    } catch (err) {
      console.error('GET public result error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

export default router;
