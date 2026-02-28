'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, type Race } from '@/lib/api';
import toast from 'react-hot-toast';

type WeatherMap = Record<string, { temp: number; unit: string } | null>;

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [weather, setWeather] = useState<WeatherMap>({});
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const dateFilter = searchParams.get('date');

  useEffect(() => {
    const url = dateFilter === 'today'
      ? `/api/v1/races?date=${new Date().toISOString().slice(0, 10)}`
      : '/api/v1/races';
    api
      .get<Race[]>(url)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setRaces(r.data);
      })
      .catch(() => toast.error('Failed to load races'))
      .finally(() => setLoading(false));
  }, [dateFilter]);

  useEffect(() => {
    const hippodromes = Array.from(new Set(races.map((r) => r.hippodrome).filter(Boolean)));
    if (hippodromes.length === 0) return;
    api
      .post<WeatherMap>('/api/v1/weather/batch', { locations: hippodromes })
      .then((r) => {
        if (r.success && r.data) setWeather(r.data);
      })
      .catch(() => {});
  }, [races]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this race?')) return;
    try {
      await api.delete(`/api/v1/races/${id}`);
      setRaces((prev) => prev.filter((r) => r._id !== id));
      toast.success('Race deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Races</h1>
        <Link
          href="/dashboard/races/new"
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-dark-900 font-medium transition"
        >
          Add Race
        </Link>
      </div>
      <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
        {races.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No races found. <Link href="/dashboard/races/new" className="text-accent hover:underline">Add one</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600 text-left text-sm text-gray-400">
                  <th className="p-4">ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Hippodrome</th>
                  <th className="p-4">Race #</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Distance</th>
                  <th className="p-4">Title</th>
                  <th className="p-4">Purse</th>
                  <th className="p-4">Weather</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {races.map((race) => (
                  <tr key={race._id} className="border-b border-dark-600/50 hover:bg-dark-700/50">
                    <td className="p-4 font-mono text-sm">{race._id}</td>
                    <td className="p-4">{new Date(race.date).toLocaleDateString()}</td>
                    <td className="p-4">{race.hippodrome}</td>
                    <td className="p-4">{race.race_number}</td>
                    <td className="p-4">{race.time}</td>
                    <td className="p-4">{race.distance}m</td>
                    <td className="p-4 max-w-[200px] truncate">{race.title}</td>
                    <td className="p-4 text-sm">
                      {race.purse != null && race.purse > 0
                        ? `${Number(race.purse).toLocaleString()} ${race.pursecurrency || 'Dh'}`
                        : '—'}
                    </td>
                    <td className="p-4 text-sm">
                      {weather[race.hippodrome] === undefined
                        ? '…'
                        : weather[race.hippodrome]
                          ? `${weather[race.hippodrome]!.temp} °C`
                          : '—'}
                    </td>
                    <td className="p-4 flex gap-2">
                      <Link
                        href={`/dashboard/races/${race._id}/edit`}
                        className="text-accent hover:underline text-sm"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(race._id)}
                        className="text-red-400 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
