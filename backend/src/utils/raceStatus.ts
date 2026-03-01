/**
 * Dynamic race status (not stored in DB).
 * duration_seconds = distance / 16.5
 */

export type RaceStatus = 'Non commencée' | 'En cours' | 'Terminée';

export interface RaceForStatus {
  date: Date | string;
  time: string;
  distance: number;
}

const SECONDS_PER_METER = 1 / 16.5;

/**
 * Builds race start as ISO datetime (UTC) from date + time.
 * time expected as "HH:mm" or "H:mm".
 */
function getRaceStart(race: RaceForStatus): Date {
  const d = typeof race.date === 'string' ? new Date(race.date) : race.date;
  const dateStr = d.toISOString().slice(0, 10);
  const timeStr = (race.time || '00:00').trim();
  const normalized = /^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(timeStr)
    ? timeStr.length <= 5
      ? `${timeStr}:00`
      : timeStr
    : '00:00:00';
  return new Date(`${dateStr}T${normalized}.000Z`);
}

/**
 * Returns dynamic race status based on current time vs race start + calculated end.
 * duration_seconds = distance / 16.5
 */
export function getRaceStatus(race: RaceForStatus): RaceStatus {
  const start = getRaceStart(race);
  const distance = Number(race.distance) || 0;
  const durationSeconds = distance * SECONDS_PER_METER;
  const end = new Date(start.getTime() + durationSeconds * 1000);
  const now = new Date();

  if (now < start) return 'Non commencée';
  if (now > end) return 'Terminée';
  return 'En cours';
}
