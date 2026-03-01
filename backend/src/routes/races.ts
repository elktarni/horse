import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import Race from '../models/Race';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';
import { getRaceStatus } from '../utils/raceStatus';

const router = Router();
router.use(authMiddleware);

const participantValidator = [
  body('participants').isArray().withMessage('participants must be an array'),
  body('participants.*.number').isInt({ min: 1 }).withMessage('Participant number required'),
  body('participants.*.horse').notEmpty().trim().withMessage('Horse name required'),
  body('participants.*.jockey').notEmpty().trim().withMessage('Jockey name required'),
  body('participants.*.weight').isFloat({ min: 0 }).withMessage('Valid weight required'),
];

router.get(
  '/',
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
      const withStatus = races.map((r) => ({ ...r, status: getRaceStatus(r) }));
      apiResponse(res, true, withStatus, 'Races retrieved');
    } catch (err) {
      console.error('GET races error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

router.get(
  '/:id',
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
      apiResponse(res, true, { ...race, status: getRaceStatus(race) }, 'Race retrieved');
    } catch (err) {
      console.error('GET race error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

router.post(
  '/',
  [
    body('date').isISO8601().withMessage('date must be YYYY-MM-DD'),
    body('hippodrome').notEmpty().trim().withMessage('hippodrome required'),
    body('race_number').isInt({ min: 1 }).withMessage('race_number required'),
    body('time').notEmpty().trim().withMessage('time required'),
    body('distance').isInt({ min: 1 }).withMessage('distance required'),
    body('title').notEmpty().trim().withMessage('title required'),
    body('purse').optional().isFloat({ min: 0 }),
    body('pursecurrency').optional().isString().trim(),
    body('weather_temp').optional().isFloat(),
    ...participantValidator,
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const { date, hippodrome, race_number, time, distance, title, purse, pursecurrency, weather_temp, participants } = req.body;
      const d = new Date(date);
      const dateStr = d.toISOString().slice(0, 10);
      const _id = `${dateStr}-${race_number}`;

      const existing = await Race.findById(_id);
      if (existing) {
        apiResponse(res, false, null, 'Race with this ID already exists', 409);
        return;
      }

      const created = await Race.create({
        _id,
        date: d,
        hippodrome,
        race_number,
        time,
        distance,
        title,
        purse: purse != null ? Number(purse) : 0,
        pursecurrency: pursecurrency && String(pursecurrency).trim() ? String(pursecurrency).trim() : 'Dh',
        weather_temp: weather_temp != null ? Number(weather_temp) : undefined,
        participants: participants || [],
      });
      const raceObj = created.toObject();
      apiResponse(res, true, { ...raceObj, status: getRaceStatus(raceObj) }, 'Race created', 201);
    } catch (err) {
      console.error('POST race error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

router.put(
  '/:id',
  [
    param('id').notEmpty().withMessage('Race ID required'),
    body('date').optional().isISO8601(),
    body('hippodrome').optional().notEmpty().trim(),
    body('race_number').optional().isInt({ min: 1 }),
    body('time').optional().notEmpty().trim(),
    body('distance').optional().isInt({ min: 1 }),
    body('title').optional().notEmpty().trim(),
    body('purse').optional().isFloat({ min: 0 }),
    body('pursecurrency').optional().isString().trim(),
    body('weather_temp').optional().isFloat(),
    body('participants').optional().isArray(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const race = await Race.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      ).lean();
      if (!race) {
        apiResponse(res, false, null, 'Race not found', 404);
        return;
      }
      apiResponse(res, true, { ...race, status: getRaceStatus(race) }, 'Race updated');
    } catch (err) {
      console.error('PUT race error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

router.delete(
  '/:id',
  [param('id').notEmpty().withMessage('Race ID required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const race = await Race.findByIdAndDelete(req.params.id);
      if (!race) {
        apiResponse(res, false, null, 'Race not found', 404);
        return;
      }
      apiResponse(res, true, { id: req.params.id }, 'Race deleted');
    } catch (err) {
      console.error('DELETE race error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

export default router;
