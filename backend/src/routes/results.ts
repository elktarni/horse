import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import Result from '../models/Result';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const results = await Result.find({}, { race_id: 1 }).lean();
    apiResponse(res, true, results, 'Results list retrieved');
  } catch (err) {
    console.error('GET results error:', err);
    apiResponse(res, false, null, 'Server error', 500);
  }
});

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
      const result = await Result.findOneAndUpdate(
        { race_id: req.params.race_id },
        { $set: req.body },
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
