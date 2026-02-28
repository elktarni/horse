'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type Race } from '@/lib/api';
import toast from 'react-hot-toast';

export default function NewResultPage() {
  const router = useRouter();
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [raceId, setRaceId] = useState('');
  const [arrival, setArrival] = useState('');
  const [rapports, setRapports] = useState('');
  const [simple, setSimple] = useState('');
  const [couple, setCouple] = useState('');
  const [trio, setTrio] = useState('');

  useEffect(() => {
    api
      .get<Race[]>('/api/v1/races')
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setRaces(r.data);
        if (r.success && Array.isArray(r.data) && r.data.length) setRaceId(r.data[0]._id);
      })
      .catch(() => toast.error('Failed to load races'))
      .finally(() => setLoading(false));
  }, []);

  const parseKeyValue = (s: string): Record<string, number> => {
    const out: Record<string, number> = {};
    s.split('\n').forEach((line) => {
      const [key, val] = line.split(/[:\s=]+/).map((x) => x.trim()).filter(Boolean);
      if (key && val && !isNaN(Number(val))) out[key] = Number(val);
    });
    return out;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const arrivalNums = arrival.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n) && n > 0);
    if (!raceId || arrivalNums.length === 0) {
      toast.error('Select a race and enter arrival order');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/results', {
        race_id: raceId,
        arrival: arrivalNums,
        rapports: parseKeyValue(rapports),
        simple: parseKeyValue(simple),
        couple: parseKeyValue(couple),
        trio: parseKeyValue(trio),
      });
      toast.success('Result added');
      router.push('/dashboard/results');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add result');
    } finally {
      setSaving(false);
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
    <div className="animate-in max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/results" className="text-gray-400 hover:text-white">
          ← Results
        </Link>
        <h1 className="text-2xl font-bold text-white">Add Result</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-dark-800 rounded-xl border border-dark-600 p-6 space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Race</label>
          <select
            required
            value={raceId}
            onChange={(e) => setRaceId(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
          >
            <option value="">Select race</option>
            {races.map((r) => (
              <option key={r._id} value={r._id}>
                {r._id} — {r.hippodrome} - {r.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Arrival order (comma or space separated)</label>
          <input
            required
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            placeholder="1, 3, 2, 5, 4"
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Rapports (one per line: key value)</label>
          <textarea
            value={rapports}
            onChange={(e) => setRapports(e.target.value)}
            rows={3}
            placeholder="1 4.5&#10;2 12.3"
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Simple (key value)</label>
          <textarea
            value={simple}
            onChange={(e) => setSimple(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Couple</label>
          <textarea
            value={couple}
            onChange={(e) => setCouple(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Trio</label>
          <textarea
            value={trio}
            onChange={(e) => setTrio(e.target.value)}
            rows={2}
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-dark-900 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Add Result'}
          </button>
          <Link href="/dashboard/results" className="px-6 py-2 rounded-lg border border-dark-500 text-gray-400 hover:bg-dark-600">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
