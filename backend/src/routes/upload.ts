import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Race from '../models/Race';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

function formatId(date: string, raceNumber: number): string {
  const d = new Date(date);
  const dateStr = d.toISOString().slice(0, 10);
  return `${dateStr}-${raceNumber}`;
}

router.post(
  '/race-json',
  [body('data').isObject().withMessage('JSON data required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const data = req.body.data as Record<string, unknown>;
      const {
        date,
        hippodrome,
        race_number,
        time,
        distance,
        title,
        participants,
      } = data as {
        date?: string;
        hippodrome?: string;
        race_number?: number;
        time?: string;
        distance?: number;
        title?: string;
        participants?: Array<{ number: number; horse: string; jockey: string; weight: number }>;
      };

      if (
        !date ||
        !hippodrome ||
        typeof race_number !== 'number' ||
        !time ||
        typeof distance !== 'number' ||
        !title
      ) {
        apiResponse(
          res,
          false,
          null,
          'Invalid structure: date, hippodrome, race_number, time, distance, title required',
          400
        );
        return;
      }

      const _id = formatId(date, race_number);
      const existing = await Race.findById(_id);
      if (existing) {
        apiResponse(res, false, null, `Race ${_id} already exists`, 409);
        return;
      }

      const race = await Race.create({
        _id,
        date: new Date(date),
        hippodrome,
        race_number,
        time,
        distance,
        title,
        participants: Array.isArray(participants) ? participants : [],
      });
      apiResponse(res, true, race, 'Race imported from JSON', 201);
    } catch (err) {
      console.error('Upload race JSON error:', err);
      apiResponse(res, false, null, 'Invalid JSON structure or server error', 500);
    }
  }
);

export default router;
