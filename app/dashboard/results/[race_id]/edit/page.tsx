'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api, type Result } from '@/lib/api';
import toast from 'react-hot-toast';

function objToText(o: Record<string, number>): string {
  return Object.entries(o)
    .map(([k, v]) => `${k} ${v}`)
    .join('\n');
}

export default function EditResultPage() {
  const router = useRouter();
  const params = useParams();
  const raceId = decodeURIComponent(params.race_id as string);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [arrival, setArrival] = useState('');
  const [rapports, setRapports] = useState('');
  const [simple, setSimple] = useState('');
  const [couple, setCouple] = useState('');
  const [trio, setTrio] = useState('');

  useEffect(() => {
    api
      .get<Result>(`/api/v1/results/${raceId}`)
      .then((r) => {
        if (r.success && r.data) {
          const d = r.data;
          setArrival(d.arrival?.join(', ') || '');
          setRapports(objToText(d.rapports || {}));
          setSimple(objToText(d.simple || {}));
          setCouple(objToText(d.couple || {}));
          setTrio(objToText(d.trio || {}));
        }
      })
      .catch(() => toast.error('Result not found'))
      .finally(() => setLoading(false));
  }, [raceId]);

  const parseKeyValue = (s: string): Record<string, number> => {
    const out: Record<string, number> = {};
    s.split('\n').forEach((line) => {
      const parts = line.split(/[:\s=]+/).map((x) => x.trim()).filter(Boolean);
      if (parts.length >= 2 && !isNaN(Number(parts[1]))) out[parts[0]] = Number(parts[1]);
    });
    return out;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const arrivalNums = arrival.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n) && n > 0);
    if (arrivalNums.length === 0) {
      toast.error('Enter arrival order');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/v1/results/${raceId}`, {
        arrival: arrivalNums,
        rapports: parseKeyValue(rapports),
        simple: parseKeyValue(simple),
        couple: parseKeyValue(couple),
        trio: parseKeyValue(trio),
      });
      toast.success('Result updated');
      router.push('/dashboard/results');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
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
        <h1 className="text-2xl font-bold text-white">Edit Result — {raceId}</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-dark-800 rounded-xl border border-dark-600 p-6 space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Arrival order</label>
          <input
            required
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            placeholder="1, 3, 2, 5, 4"
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Rapports</label>
          <textarea
            value={rapports}
            onChange={(e) => setRapports(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white resize-none"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Simple</label>
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
            {saving ? 'Saving...' : 'Save'}
          </button>
          <Link href="/dashboard/results" className="px-6 py-2 rounded-lg border border-dark-500 text-gray-400 hover:bg-dark-600">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
