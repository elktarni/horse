import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import Race from '../models/Race';
import Result from '../models/Result';
import { apiResponse } from '../middleware/response';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const PMU_BASE = 'https://online.turfinfo.api.pmu.fr/rest/client/1/programme';

/** Convert YYYY-MM-DD to DDMMYYYY for PMU API */
function toPmuDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}${m}${y}`;
}

/** Format timestamp (ms) to HH:mm */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Slug for track name */
function slugTrack(track: string): string {
  return track
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Unique race id for PMU-imported races */
function pmuRaceId(dateStr: string, raceNumber: number, track: string): string {
  return `${dateStr}-${slugTrack(track)}-${raceNumber}`;
}

interface PmuParticipant {
  numPmu?: number;
  nom?: string;
  driver?: string;
  handicapPoids?: number;
  sexe?: string;
  age?: number;
}

interface PmuCourse {
  numOrdre?: number;
  numExterne?: number;
  libelle?: string;
  distance?: number;
  heureDepart?: number;
  montantPrix?: number;
  ordreArrivee?: number[][];
  statut?: string;
  hippodrome?: { libelleCourt?: string; libelleLong?: string };
}

interface PmuReunion {
  numExterne?: number;
  hippodrome?: { code?: string; libelleCourt?: string; libelleLong?: string };
  pays?: { code?: string };
  courses?: PmuCourse[];
}

interface PmuProgrammeResponse {
  programme?: {
    reunions?: PmuReunion[];
  };
}

export interface PmuSyncResult {
  racesAdded: string[];
  created: string[];
  updated: string[];
  skipped: string[];
  notFound: string[];
  reunionsFromApi?: number;
  reunionsFrance?: number;
  message: string;
}

/** Map PMU sexe to short code: MALES→M, FEMELLES→F, HONGRES→H */
function pmuSexeCode(sexe: string | undefined): string {
  if (!sexe) return '';
  const u = sexe.toUpperCase();
  if (u === 'MALES') return 'M';
  if (u === 'FEMELLES') return 'F';
  if (u === 'HONGRES') return 'H';
  return u.charAt(0);
}

/** Build Sexe/Âge string e.g. "H/4" */
function pmuSexeAge(sexe: string | undefined, age: number | undefined): string {
  const code = pmuSexeCode(sexe);
  const a = age != null && age >= 1 ? String(age) : '';
  if (!code && !a) return '';
  if (!code) return a;
  if (!a) return code;
  return `${code}/${a}`;
}

/** Fetch participants from PMU API. handicapPoids is in decagrams (÷10 = kg). */
async function fetchPmuParticipants(
  datePmu: string,
  reunionNum: number,
  courseNum: number
): Promise<{ number: number; horse: string; jockey: string; weight: number; sexeAge?: string }[]> {
  try {
    const url = `${PMU_BASE}/${datePmu}/R${reunionNum}/C${courseNum}/participants`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { participants?: PmuParticipant[] };
    const list = data.participants ?? [];
    return list
      .filter((p) => p && (p.numPmu ?? 0) >= 1)
      .map((p) => {
        const weight = p.handicapPoids != null ? Math.round(p.handicapPoids) / 10 : 58;
        const sexeAge = pmuSexeAge(p.sexe, p.age);
        return {
          number: Number(p.numPmu) || 0,
          horse: String(p.nom ?? '').trim() || '—',
          jockey: String(p.driver ?? '').trim() || '—',
          weight,
          ...(sexeAge ? { sexeAge } : {}),
        };
      })
      .filter((x) => x.number >= 1);
  } catch {
    return [];
  }
}

/** Flatten ordreArrivee [[12],[15],[6],...] to [12,15,6,...] */
function flattenArrival(arr: number[][] | undefined): number[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .flatMap((a) => (Array.isArray(a) ? a : [a]))
    .map(Number)
    .filter((n) => !isNaN(n) && n >= 1);
}

/** Run PMU programme sync */
export async function runPmuProgrammeSync(options: {
  date: string;
  addRaces?: boolean;
}): Promise<PmuSyncResult> {
  const { date, addRaces = false } = options;
  const datePmu = toPmuDate(date);
  const url = `${PMU_BASE}/${datePmu}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`PMU API error: ${response.status}`);
  const data = (await response.json()) as PmuProgrammeResponse;
  const reunions = data.programme?.reunions ?? [];
  const reunionsFromApi = reunions.length;
  const reunionsFrance = reunions.filter((r) => (r.pays?.code ?? '').toUpperCase() === 'FRA').length;

  const dateStart = new Date(date + 'T00:00:00.000Z');
  const dateEnd = new Date(date + 'T23:59:59.999Z');

  const racesAdded: string[] = [];
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const notFound: string[] = [];

  for (const reunion of reunions) {
    if ((reunion.pays?.code ?? '').toUpperCase() !== 'FRA') continue;

    const reunionNum = reunion.numExterne ?? 0;
    if (reunionNum < 1) continue;

    const hippodrome = reunion.hippodrome?.libelleCourt?.trim() || reunion.hippodrome?.libelleLong?.trim() || '';
    if (!hippodrome) continue;

    const track = hippodrome;
    const reunionCode = `R${reunionNum}`;

    // Fetch reunion detail for full course data (ordreArrivee)
    let courses: PmuCourse[] = reunion.courses ?? [];
    if (courses.length === 0) {
      try {
        const reunionUrl = `${PMU_BASE}/${datePmu}/R${reunionNum}`;
        const reunionRes = await fetch(reunionUrl);
        if (reunionRes.ok) {
          const reunionData = (await reunionRes.json()) as PmuReunion;
          courses = reunionData.courses ?? [];
        }
      } catch {
        // keep empty
      }
    }

    for (const course of courses) {
      const raceNumber = course.numExterne ?? course.numOrdre ?? 0;
      if (raceNumber < 1) continue;

      const _id = pmuRaceId(date, raceNumber, track);
      const time = course.heureDepart != null ? formatTime(course.heureDepart) : '00:00';
      const distance = Number(course.distance) || 0;
      const title = (course.libelle ?? '').trim() || `Race ${raceNumber}`;
      const purse = course.montantPrix != null ? course.montantPrix : 0;

      if (addRaces) {
        const existing = await Race.findOne({
          date: { $gte: dateStart, $lte: dateEnd },
          hippodrome: new RegExp(`^${track.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          race_number: raceNumber,
        });
        if (!existing && !(await Race.findById(_id))) {
          const participants = await fetchPmuParticipants(datePmu, reunionNum, raceNumber);
          await Race.create({
            _id,
            date: dateStart,
            hippodrome: track,
            race_number: raceNumber,
            time,
            distance,
            title,
            purse,
            pursecurrency: 'EUR',
            reunion: reunionCode,
            venue: 'PMU',
            participants: participants.length ? participants : [],
          });
          racesAdded.push(_id);
        }
      }

      const arrival = flattenArrival(course.ordreArrivee);
      const finished = (course.statut ?? '').includes('ARRIVEE') || arrival.length > 0;

      if (!finished || arrival.length === 0) continue;

      const ourRace = await Race.findOne({
        date: { $gte: dateStart, $lte: dateEnd },
        hippodrome: new RegExp(`^${track.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        race_number: raceNumber,
      }).lean();

      if (!ourRace) {
        notFound.push(`${track} R${reunionNum}C${raceNumber} (${title})`);
        continue;
      }

      const participants = await fetchPmuParticipants(datePmu, reunionNum, raceNumber);
      if (participants.length) {
        await Race.findByIdAndUpdate(ourRace._id, {
          $set: {
            participants,
            reunion: reunionCode,
            venue: 'PMU',
          },
        });
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
  parts.push(`PMU: ${reunionsFromApi} reunion(s), ${reunionsFrance} France`);
  const message = parts.join('; ') + '.';
  return { racesAdded, created, updated, skipped, notFound, reunionsFromApi, reunionsFrance, message };
}

/** GET /api/v1/sync/pmu-programme?date=YYYY-MM-DD&add_races=1 */
router.get(
  '/pmu-programme',
  [
    query('date').isISO8601().withMessage('date must be YYYY-MM-DD'),
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
      const addRaces = ['1', 'true', 'yes'].includes(String(req.query.add_races || '').toLowerCase());
      const result = await runPmuProgrammeSync({ date, addRaces });
      apiResponse(res, true, result, result.message);
    } catch (err) {
      console.error('Sync pmu-programme error:', err);
      apiResponse(res, false, null, err instanceof Error ? err.message : 'Sync failed', 500);
    }
  }
);

export default router;
