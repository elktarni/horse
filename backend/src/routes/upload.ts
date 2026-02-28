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
        purse,
        pursecurrency,
        participants,
      } = data as {
        date?: string;
        hippodrome?: string;
        race_number?: number;
        time?: string;
        distance?: number;
        title?: string;
        purse?: number;
        pursecurrency?: string;
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
        purse: purse != null ? Number(purse) : 0,
        pursecurrency: pursecurrency && String(pursecurrency).trim() ? String(pursecurrency).trim() : 'Dh',
        participants: Array.isArray(participants) ? participants : [],
      });
      apiResponse(res, true, race, 'Race imported from JSON', 201);
    } catch (err) {
      console.error('Upload race JSON error:', err);
      apiResponse(res, false, null, 'Invalid JSON structure or server error', 500);
    }
  }
);

// Event format: { event_date, hippodrome, races: [{ race_number, time, distance, title, participants: [{ number, horse, jockey, weight, ... }] }] }
function parseDistance(d: unknown): number {
  if (typeof d === 'number' && !isNaN(d)) return d;
  if (typeof d === 'string') return parseInt(d.replace(/\D/g, ''), 10) || 0;
  return 0;
}

router.post(
  '/event-json',
  [body('data').isObject().withMessage('JSON data required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const data = req.body.data as Record<string, unknown>;
      const eventDate = data.event_date as string | undefined;
      const hippodrome = data.hippodrome as string | undefined;
      const races = data.races as Array<Record<string, unknown>> | undefined;

      if (!eventDate || !hippodrome || !Array.isArray(races) || races.length === 0) {
        apiResponse(
          res,
          false,
          null,
          'Invalid structure: event_date, hippodrome, and non-empty races array required',
          400
        );
        return;
      }

      const created: string[] = [];
      const skipped: string[] = [];

      for (const r of races) {
        const raceNumber = r.race_number as number | undefined;
        const time = (r.time as string) || '';
        const distance = parseDistance(r.distance);
        const title = (r.title as string) || '';
        const rawParticipants = (r.participants as Array<Record<string, unknown>>) || [];
        const participants = rawParticipants
          .filter((p) => p && typeof p.number === 'number' && p.horse && p.jockey != null)
          .map((p) => ({
            number: Number(p.number),
            horse: String(p.horse),
            jockey: String(p.jockey),
            weight: typeof p.weight === 'number' ? p.weight : 58,
          }));

        if (!raceNumber || !time || !title || distance <= 0) {
          skipped.push(`Race ${raceNumber ?? '?'}`);
          continue;
        }

        const _id = formatId(eventDate, raceNumber);
        const existing = await Race.findById(_id);
        if (existing) {
          skipped.push(_id);
          continue;
        }

        await Race.create({
          _id,
          date: new Date(eventDate),
          hippodrome,
          race_number: raceNumber,
          time,
          distance,
          title,
          participants,
        });
        created.push(_id);
      }

      apiResponse(
        res,
        true,
        { created, skipped },
        `Imported ${created.length} race(s)${skipped.length ? `, skipped ${skipped.length}` : ''}`,
        201
      );
    } catch (err) {
      console.error('Upload event JSON error:', err);
      apiResponse(res, false, null, 'Invalid JSON structure or server error', 500);
    }
  }
);

export default router;
