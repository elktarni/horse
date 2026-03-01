import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import Race from '../models/Race';
import Result from '../models/Result';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const CASA_PROGRAMME_URL = 'https://pro.casacourses.com/api/programme';

interface CasaRace {
  id: number;
  code: string;
  name: string;
  time_hm: string;
  distance: number;
  starters: number;
  finished?: boolean;
  finish_order?: number[];
}

interface CasaMeeting {
  track: string;
  races: CasaRace[];
}

interface CasaProgrammeResponse {
  date?: string;
  meetings?: CasaMeeting[];
}

/** Parse race code (e.g. "C1", "C2") to race number */
function raceNumberFromCode(code: string): number {
  const num = parseInt(code.replace(/\D/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

/**
 * GET /api/v1/sync/casa-programme?date=YYYY-MM-DD&venue=SOREC
 * Fetches programme from Casa API and creates/updates Results for finished races
 * by matching our races on date + hippodrome (track) + race_number.
 */
router.get(
  '/casa-programme',
  [
    query('date').isISO8601().withMessage('date must be YYYY-MM-DD'),
    query('venue').optional().trim(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        apiResponse(res, false, { errors: errors.array() }, 'Validation failed', 400);
        return;
      }
      const date = req.query.date as string;
      const venue = (req.query.venue as string) || 'SOREC';
      const url = `${CASA_PROGRAMME_URL}?date=${encodeURIComponent(date)}&venue=${encodeURIComponent(venue)}`;

      const response = await fetch(url);
      if (!response.ok) {
        apiResponse(res, false, null, `Casa API error: ${response.status}`, 502);
        return;
      }
      const data = (await response.json()) as CasaProgrammeResponse;
      const meetings = data.meetings || [];
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);

      const created: string[] = [];
      const updated: string[] = [];
      const skipped: string[] = [];
      const notFound: string[] = [];

      for (const meeting of meetings) {
        const track = meeting.track?.trim() || '';
        if (!track) continue;

        for (const race of meeting.races || []) {
          const finished = race.finished === true;
          const finishOrder = Array.isArray(race.finish_order) ? race.finish_order : [];
          if (!finished || finishOrder.length === 0) continue;

          const raceNumber = raceNumberFromCode(race.code);
          if (raceNumber <= 0) {
            skipped.push(`${track} ${race.code}`);
            continue;
          }

          const arrival = finishOrder.map((n) => Number(n)).filter((n) => !isNaN(n) && n >= 1);
          if (arrival.length === 0) {
            skipped.push(`${track} ${race.code} (empty finish_order)`);
            continue;
          }

          const ourRace = await Race.findOne({
            date: { $gte: dateObj, $lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000) },
            hippodrome: new RegExp(`^${track.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            race_number: raceNumber,
          });
          if (!ourRace) {
            notFound.push(`${track} C${raceNumber} (${race.name})`);
            continue;
          }

          const existing = await Result.findOne({ race_id: ourRace._id });
          if (existing) {
            await Result.updateOne(
              { race_id: ourRace._id },
              { $set: { arrival } }
            );
            updated.push(ourRace._id);
          } else {
            await Result.create({
              race_id: ourRace._id,
              arrival,
              rapports: {},
              simple: {},
              couple: {},
              trio: {},
            });
            created.push(ourRace._id);
          }
        }
      }

      const message = `Synced: ${created.length} created, ${updated.length} updated; ${notFound.length} races not found in DB.`;
      apiResponse(res, true, { created, updated, skipped, notFound, message }, message);
    } catch (err) {
      console.error('Sync casa-programme error:', err);
      apiResponse(res, false, null, err instanceof Error ? err.message : 'Sync failed', 500);
    }
  }
);

export default router;
