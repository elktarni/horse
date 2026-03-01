/**
 * Shared Open-Meteo weather fetch with in-memory cache.
 * Used by /api/v1/weather routes and by races/results APIs to attach live weather.
 */
const CACHE_MS = 10 * 60 * 1000; // 10 min
const weatherCache = new Map<string, { temp: number; unit: string; ts: number }>();

export async function fetchWeatherForLocation(location: string): Promise<{ temp: number; unit: string } | null> {
  const cached = weatherCache.get(location);
  if (cached && Date.now() - cached.ts < CACHE_MS) return { temp: cached.temp, unit: cached.unit };

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
    );
    const geoData = await geoRes.json().catch(() => ({}));
    const results = (geoData as { results?: Array<{ latitude: number; longitude: number }> }).results;
    if (!results || results.length === 0) return null;
    const { latitude, longitude } = results[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`
    );
    const weatherData = await weatherRes.json().catch(() => ({}));
    const current = (weatherData as { current?: { temperature_2m: number } }).current;
    if (!current || typeof current.temperature_2m !== 'number') return null;

    const result = { temp: current.temperature_2m, unit: '°C' as const };
    weatherCache.set(location, { ...result, ts: Date.now() });
    return result;
  } catch {
    return null;
  }
}

export type WeatherByLocation = Record<string, { temp: number; unit: string } | null>;

/** Fetch weather for multiple locations (cached). Returns map of location -> { temp, unit } or null. */
export async function getWeatherForLocations(locations: string[]): Promise<WeatherByLocation> {
  const unique = [...new Set(locations.map((l) => String(l).trim()).filter(Boolean))];
  const data: WeatherByLocation = {};
  await Promise.all(
    unique.map(async (loc) => {
      data[loc] = await fetchWeatherForLocation(loc);
    })
  );
  return data;
}
