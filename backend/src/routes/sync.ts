import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import Race from '../models/Race';
import Result from '../models/Result';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const CASA_PROGRAMME_URL = 'https://pro.casacourses.com/api/programme';
const CASA_RACE_URL = 'https://pro.casacourses.com/api/race';

/** Runner from Casa race detail API */
interface CasaRunner {
  number?: string | number;
  horse_name?: string;
  jockey_name?: string;
  weight?: number;
}

/** Response from GET /api/race/{id} */
interface CasaRaceDetailResponse {
  id?: number;
  prize?: string;
  runners?: CasaRunner[];
  weather_temp?: number;
}

/** Parse prize string e.g. "1500000 DH" or "15000 EUR" into amount and currency */
function parsePrize(prize: string | undefined): { purse: number; pursecurrency: string } | null {
  if (!prize || typeof prize !== 'string') return null;
  const trimmed = prize.trim();
  const match = trimmed.match(/^([\d\s.,]+)\s*(\S*)$/);
  if (!match) return null;
  const amountStr = match[1].replace(/\s/g, '').replace(',', '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount < 0) return null;
  const currency = (match[2] || 'Dh').trim() || 'Dh';
  return { purse: Math.round(amount), pursecurrency: currency };
}

/** Map Casa runners to our participants format */
function mapRunnersToParticipants(runners: CasaRunner[] | undefined): { number: number; horse: string; jockey: string; weight: number }[] {
  if (!Array.isArray(runners) || runners.length === 0) return [];
  return runners
    .filter((r) => r != null)
    .map((r) => {
      const number = typeof r.number === 'number' ? r.number : parseInt(String(r.number ?? 0), 10);
      const weight = typeof r.weight === 'number' ? r.weight : parseFloat(String(r.weight ?? 58)) || 58;
      return {
        number: isNaN(number) || number < 1 ? 0 : number,
        horse: String(r.horse_name ?? '').trim() || '—',
        jockey: String(r.jockey_name ?? '').trim() || '—',
        weight: Number.isFinite(weight) ? weight : 58,
      };
    })
    .filter((p) => p.number >= 1);
}

/** Fetch race detail from Casa (purse + participants + weather) for a given Casa race id */
async function fetchCasaRaceDetails(casaRaceId: number): Promise<{ purse?: number; pursecurrency?: string; weather_temp?: number; participants: { number: number; horse: string; jockey: string; weight: number }[] } | null> {
  try {
    const res = await fetch(`${CASA_RACE_URL}/${casaRaceId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as CasaRaceDetailResponse;
    const prize = parsePrize(data.prize);
    const participants = mapRunnersToParticipants(data.runners);
    const weather_temp = typeof data.weather_temp === 'number' && Number.isFinite(data.weather_temp) ? data.weather_temp : undefined;
    return {
      ...(prize ?? {}),
      ...(weather_temp != null ? { weather_temp } : {}),
      participants: participants.length ? participants : [],
    };
  } catch {
    return null;
  }
}

/** Official Morocco hippodromes only (country code can be missing/wrong in API). */
const MOROCCO_TRACKS = new Set([
  'casablanca', 'anfa', 'casablanca anfa', 'anfa casablanca',  // Hippodrome de Casablanca – Anfa
  'rabat',                        // Hippodrome de Rabat
  'el jadida', 'eljadida',        // Hippodrome d'El Jadida
  'settat',                       // Hippodrome de Settat
  'meknès', 'meknes',             // Hippodrome de Meknès
  'khemisset',                    // Hippodrome de Khemisset
  'marrakech',                    // Hippodrome de Marrakech
]);
/** Only allow meetings whose track is in the official Morocco list (ignore API country – it can be wrong e.g. Fontainebleau). */
function isMoroccoMeeting(meeting: CasaMeeting): boolean {
  const track = (meeting.track ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!track) return false;
  return MOROCCO_TRACKS.has(track) || MOROCCO_TRACKS.has(track.replace(/\s/g, ''));
}

/** Anfa and Casablanca are the same venue – always use one canonical name so we get a single set of races. */
const CASABLANCA_ANFA_ALIASES = new Set(['anfa', 'casablanca', 'casablanca anfa', 'anfa casablanca']);
function getCanonicalTrack(apiTrack: string): string {
  const t = (apiTrack ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return apiTrack?.trim() || '';
  if (CASABLANCA_ANFA_ALIASES.has(t) || CASABLANCA_ANFA_ALIASES.has(t.replace(/\s/g, ''))) return 'Casablanca';
  return apiTrack.trim();
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

export interface CasaSyncResult {
  racesAdded: string[];
  created: string[];
  updated: string[];
  skipped: string[];
  notFound: string[];
  meetingsFromApi?: number;
  meetingsMorocco?: number;
  message: string;
}

/** Run Casa programme sync (used by GET route and by server auto-sync). */
export async function runCasaProgrammeSync(options: {
  date: string;
  venue?: string;
  addRaces?: boolean;
}): Promise<CasaSyncResult> {
  const { date, venue = 'SOREC', addRaces = false } = options;
  const url = `${CASA_PROGRAMME_URL}?date=${encodeURIComponent(date)}&venue=${encodeURIComponent(venue)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Casa API error: ${response.status}`);
  const data = (await response.json()) as CasaProgrammeResponse;
  const allMeetings = data.meetings || [];
  const meetingsFromApi = allMeetings.length;
  const meetings = allMeetings.filter((m) => isMoroccoMeeting(m));
  const meetingsMorocco = meetings.length;
  const dateStart = new Date(date + 'T00:00:00.000Z');
  const dateEnd = new Date(date + 'T23:59:59.999Z');

  const racesAdded: string[] = [];
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const notFound: string[] = [];

  if (addRaces) {
    for (const meeting of meetings) {
      const apiTrack = meeting.track?.trim() || '';
      if (!apiTrack) continue;
      const track = getCanonicalTrack(apiTrack);
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
        const details = await fetchCasaRaceDetails(race.id);
        if (details && (details.purse != null || details.weather_temp != null || details.participants?.length)) {
          const update: Record<string, unknown> = {};
          if (details.purse != null) update.purse = details.purse;
          if (details.pursecurrency) update.pursecurrency = details.pursecurrency;
          if (details.weather_temp != null) update.weather_temp = details.weather_temp;
          if (details.participants?.length) update.participants = details.participants;
          if (Object.keys(update).length) await Race.findByIdAndUpdate(_id, { $set: update });
        }
      }
    }
  }

  for (const meeting of meetings) {
    const apiTrack = meeting.track?.trim() || '';
    if (!apiTrack) continue;
    const track = getCanonicalTrack(apiTrack);
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
      // Enrich race with purse, participants, weather from Casa race detail API (for both new and existing races)
      const details = await fetchCasaRaceDetails(race.id);
      if (details && (details.purse != null || details.weather_temp != null || (details.participants && details.participants.length > 0))) {
        const update: Record<string, unknown> = {};
        if (details.purse != null) update.purse = details.purse;
        if (details.pursecurrency) update.pursecurrency = details.pursecurrency;
        if (details.weather_temp != null) update.weather_temp = details.weather_temp;
        if (details.participants && details.participants.length) update.participants = details.participants;
        if (Object.keys(update).length) await Race.findByIdAndUpdate(ourRace._id, { $set: update });
      }
      const existing = await Result.findOne({ race_id: ourRace._id });
      if (existing) {
        await Result.updateOne({ race_id: ourRace._id }, { $set: { arrival } });
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
  if (meetingsFromApi !== undefined) parts.push(`Casa: ${meetingsFromApi} meeting(s), ${meetingsMorocco} Morocco`);
  const message = parts.join('; ') + '.';
  return { racesAdded, created, updated, skipped, notFound, meetingsFromApi, meetingsMorocco, message };
}

/**
 * GET /api/v1/sync/casa-programme?date=YYYY-MM-DD&venue=SOREC
 * Fetches programme from Casa API and creates/updates Results for finished races.
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
      const result = await runCasaProgrammeSync({ date, venue, addRaces });
      apiResponse(res, true, result, result.message);
    } catch (err) {
      console.error('Sync casa-programme error:', err);
      apiResponse(res, false, null, err instanceof Error ? err.message : 'Sync failed', 500);
    }
  }
);

export default router;
