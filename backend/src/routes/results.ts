import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import Result from '../models/Result';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

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
      const date = req.query.date as string | undefined;
      const pipeline: Record<string, unknown>[] = [
        { $lookup: { from: 'races', localField: 'race_id', foreignField: '_id', as: 'race' } },
        { $unwind: { path: '$race', preserveNullAndEmptyArrays: true } },
        { $addFields: { title: '$race.title' } },
      ];
      if (date) {
        const dateStart = new Date(date + 'T00:00:00.000Z');
        const dateEnd = new Date(date + 'T23:59:59.999Z');
        pipeline.push({ $match: { 'race.date': { $gte: dateStart, $lte: dateEnd } } });
      }
      pipeline.push({ $project: { race: 0 } });
      const results = await Result.aggregate(pipeline as never[]);
      apiResponse(res, true, results, 'Results list retrieved');
    } catch (err) {
      console.error('GET results error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

router.get(
  '/:race_id',
  [param('race_id').notEmpty().withMessage('race_id required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await Result.findOne({ race_id: req.params.race_id });
      if (!result) {
        apiResponse(res, false, null, 'Result not found', 404);
        return;
      }
      apiResponse(res, true, result, 'Result retrieved');
    } catch (err) {
      console.error('GET result error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

router.post(
  '/',
  [
    body('race_id').notEmpty().trim().withMessage('race_id required'),
    body('arrival').isArray().withMessage('arrival must be an array of numbers'),
    body('arrival.*').isInt({ min: 1 }),
    body('rapports').optional().isObject(),
    body('simple').optional().isObject(),
    body('couple').optional().isObject(),
    body('trio').optional().isObject(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const { race_id, arrival, rapports = {}, simple = {}, couple = {}, trio = {} } = req.body;
      const existing = await Result.findOne({ race_id });
      if (existing) {
        apiResponse(res, false, null, 'Result for this race already exists', 409);
        return;
      }
      const result = await Result.create({
        race_id,
        arrival,
        rapports,
        simple,
        couple,
        trio,
      });
      apiResponse(res, true, result, 'Result created', 201);
    } catch (err) {
      console.error('POST result error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

router.put(
  '/:race_id',
  [
    param('race_id').notEmpty().withMessage('race_id required'),
    body('arrival').optional().isArray(),
    body('rapports').optional().isObject(),
    body('simple').optional().isObject(),
    body('couple').optional().isObject(),
    body('trio').optional().isObject(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const update: Record<string, unknown> = {};
      if (Array.isArray(req.body.arrival)) update.arrival = req.body.arrival.map(Number);
      if (req.body.rapports != null && typeof req.body.rapports === 'object') update.rapports = req.body.rapports;
      if (req.body.simple != null && typeof req.body.simple === 'object') update.simple = req.body.simple;
      if (req.body.couple != null && typeof req.body.couple === 'object') update.couple = req.body.couple;
      if (req.body.trio != null && typeof req.body.trio === 'object') update.trio = req.body.trio;

      const result = await Result.findOneAndUpdate(
        { race_id: req.params.race_id },
        { $set: update },
        { new: true }
      );
      if (!result) {
        apiResponse(res, false, null, 'Result not found', 404);
        return;
      }
      apiResponse(res, true, result, 'Result updated');
    } catch (err) {
      console.error('PUT result error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

router.delete(
  '/:race_id',
  [param('race_id').notEmpty().withMessage('race_id required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await Result.findOneAndDelete({ race_id: req.params.race_id });
      if (!result) {
        apiResponse(res, false, null, 'Result not found', 404);
        return;
      }
      apiResponse(res, true, { race_id: req.params.race_id }, 'Result deleted');
    } catch (err) {
      console.error('DELETE result error:', err);
      apiResponse(res, false, null, 'Server error', 500);
    }
  }
);

export default router;
