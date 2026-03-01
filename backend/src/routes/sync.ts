import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import Race from '../models/Race';
import Result from '../models/Result';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const CASA_PROGRAMME_URL = 'https://pro.casacourses.com/api/programme';

/** Known SOREC Morocco tracks – only these are allowed (country code can be missing/wrong in API). */
const MOROCCO_TRACKS = new Set([
  'settat', 'marrakech', 'casablanca', 'rabat', 'meknès', 'meknes', 'tanger', 'tangier',
  'fès', 'fes', 'fez', 'oujda', 'agadir', 'kenitra', 'tétouan', 'tetouan', 'el jadida',
  'safi', 'mohammedia',
]);
function isMoroccoMeeting(meeting: CasaMeeting): boolean {
  const country = String(meeting.country ?? '').trim().toUpperCase();
  if (country === 'MA') return true;
  const track = (meeting.track ?? '').trim().toLowerCase();
  return track.length > 0 && MOROCCO_TRACKS.has(track);
}

/** Casa API finish_order item: object with position + runner number (string or number) */
interface CasaFinishOrderItem {
  position?: number;
  number?: string | number;
  horse_name?: string;
}

interface CasaRace {
  id: number;
  code: string;
  name: string;
  time_hm: string;
  distance: number;
  starters: number;
  finished?: boolean;
  pursecurrency?: string;
  /** API returns array of objects { position, number, horse_name }, not plain numbers */
  finish_order?: (number | CasaFinishOrderItem)[];
}

interface CasaMeeting {
  id?: string;
  track: string;
  country?: string;
  races: CasaRace[];
}

interface CasaProgrammeResponse {
  date?: string;
  meetings?: CasaMeeting[];
}

/**
 * Normalize Casa finish_order to our arrival array (runner numbers in order of finish).
 * API can return: [ { position: 1, number: "1" }, { position: 2, number: "5" }, ... ] or legacy [ 1, 5, 4 ].
 */
function arrivalFromFinishOrder(finishOrder: (number | CasaFinishOrderItem)[]): number[] {
  const result: number[] = [];
  for (const item of finishOrder) {
    if (typeof item === 'number' && item >= 1) {
      result.push(item);
    } else if (item && typeof item === 'object' && item !== null) {
      const n = typeof item.number === 'number' ? item.number : parseInt(String(item.number), 10);
      if (!isNaN(n) && n >= 1) result.push(n);
    }
  }
  return result;
}

/**
 * Map Casa API "code" (e.g. "C8", "C12") to our race_number (8, 12).
 * API uses "C1", "C2", "C8" etc.; we store and match on numeric race_number only.
 */
function raceNumberFromCode(code: string | undefined): number {
  if (code == null || typeof code !== 'string') return 0;
  const trimmed = code.trim();
  const match = trimmed.match(/^C(\d+)$/i);
  if (match) return parseInt(match[1], 10);
  const num = parseInt(trimmed.replace(/\D/g, ''), 10);
  return isNaN(num) ? 0 : num;
}

/** Slug for track name so we can build unique _id when multiple tracks per day (e.g. "Settat" -> "settat"). */
function slugTrack(track: string): string {
  return track
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Unique race id for Casa-imported races (allows multiple tracks same day). */
function casaRaceId(dateStr: string, raceNumber: number, track: string): string {
  return `${dateStr}-${slugTrack(track)}-${raceNumber}`;
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
    query('add_races').optional().isIn(['1', 'true', 'yes']),
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
      const addRaces = ['1', 'true', 'yes'].includes(String(req.query.add_races || '').toLowerCase());
      const url = `${CASA_PROGRAMME_URL}?date=${encodeURIComponent(date)}&venue=${encodeURIComponent(venue)}`;

      const response = await fetch(url);
      if (!response.ok) {
        apiResponse(res, false, null, `Casa API error: ${response.status}`, 502);
        return;
      }
      const data = (await response.json()) as CasaProgrammeResponse;
      // Only SOREC Maroc (Morocco): by country code MA or by known Morocco track name
      const meetings = (data.meetings || []).filter((m) => isMoroccoMeeting(m));
      const dateStart = new Date(date + 'T00:00:00.000Z');
      const dateEnd = new Date(date + 'T23:59:59.999Z');

      const racesAdded: string[] = [];
      const created: string[] = [];
      const updated: string[] = [];
      const skipped: string[] = [];
      const notFound: string[] = [];

      if (addRaces) {
        for (const meeting of meetings) {
          const track = meeting.track?.trim() || '';
          if (!track) continue;
          for (const race of meeting.races || []) {
            const raceNumber = raceNumberFromCode(race.code);
            if (raceNumber <= 0) continue;
            const existingRace = await Race.findOne({
              date: { $gte: dateStart, $lte: dateEnd },
              hippodrome: new RegExp(`^${track.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
              race_number: raceNumber,
            });
            if (existingRace) continue;
            const _id = casaRaceId(date, raceNumber, track);
            if (await Race.findById(_id)) continue;
            const time = (race.time_hm && String(race.time_hm).trim()) || '00:00';
            const purseCurrency = (race.pursecurrency && String(race.pursecurrency).trim()) || 'Dh';
            await Race.create({
              _id,
              date: dateStart,
              hippodrome: track,
              race_number: raceNumber,
              time,
              distance: Number(race.distance) || 0,
              title: (race.name && String(race.name).trim()) || `Race ${raceNumber}`,
              purse: 0,
              pursecurrency: purseCurrency,
              participants: [],
            });
            racesAdded.push(_id);
          }
        }
      }

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

          const arrival = arrivalFromFinishOrder(finishOrder);
          if (arrival.length === 0) {
            skipped.push(`${track} ${race.code} (empty finish_order)`);
            continue;
          }

          const ourRace = await Race.findOne({
            date: { $gte: dateStart, $lte: dateEnd },
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

      const parts: string[] = [];
      if (racesAdded.length) parts.push(`${racesAdded.length} race(s) added`);
      parts.push(`${created.length} result(s) created`);
      parts.push(`${updated.length} result(s) updated`);
      if (notFound.length) parts.push(`${notFound.length} not found in DB`);
      const message = parts.join('; ') + '.';
      apiResponse(res, true, { racesAdded, created, updated, skipped, notFound, message }, message);
    } catch (err) {
      console.error('Sync casa-programme error:', err);
      apiResponse(res, false, null, err instanceof Error ? err.message : 'Sync failed', 500);
    }
  }
);

export default router;
