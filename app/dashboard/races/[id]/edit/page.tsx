'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api, type Race } from '@/lib/api';
import toast from 'react-hot-toast';

interface Participant {
  number: number;
  horse: string;
  jockey: string;
  weight: number;
}

export default function EditRacePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: '',
    hippodrome: '',
    race_number: 1,
    time: '',
    distance: 1600,
    title: '',
    purse: 0,
    pursecurrency: 'Dh',
    weather_temp: undefined as number | undefined,
  });
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    api
      .get<Race>(`/api/v1/races/${id}`)
      .then((r) => {
        if (r.success && r.data) {
          const d = r.data;
          setForm({
            date: new Date(d.date).toISOString().slice(0, 10),
            hippodrome: d.hippodrome,
            race_number: d.race_number,
            time: d.time,
            distance: d.distance,
            title: d.title,
            purse: d.purse != null && d.purse > 100000 ? Math.round(d.purse / 100) : (d.purse ?? 0),
            pursecurrency: d.pursecurrency ?? 'Dh',
            weather_temp: d.weather_temp,
          });
          setParticipants(d.participants || []);
        }
      })
      .catch(() => toast.error('Race not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const addParticipant = () => {
    setParticipants((p) => [
      ...p,
      { number: p.length + 1, horse: '', jockey: '', weight: 58 },
    ]);
  };

  const removeParticipant = (i: number) => {
    if (participants.length <= 1) return;
    setParticipants((p) => p.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, number: idx + 1 })));
  };

  const updateParticipant = (i: number, field: keyof Participant, value: string | number) => {
    setParticipants((p) =>
      p.map((x, idx) => (idx === i ? { ...x, [field]: value } : x))
    );
  };

  // Auto-fetch live weather when race is loaded (real-time at hippodrome)
  useEffect(() => {
    const loc = form.hippodrome.trim();
    if (!loc) return;
    api
      .get<{ temp: number; unit: string }>(`/api/v1/weather?location=${encodeURIComponent(loc)}`)
      .then((res) => {
        if (res.success && res.data && typeof res.data.temp === 'number') {
          setForm((f) => ({ ...f, weather_temp: Math.round(res.data!.temp * 10) / 10 }));
        }
      })
      .catch(() => {});
  }, [form.hippodrome]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/api/v1/races/${id}`, { ...form, participants });
      toast.success('Race updated');
      router.push('/dashboard/races');
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
    <div className="animate-in max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/races" className="text-gray-400 hover:text-white">
          ← Races
        </Link>
        <h1 className="text-2xl font-bold text-white">Edit Race</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-dark-800 rounded-xl border border-dark-600 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Race number</label>
            <input
              type="number"
              min={1}
              required
              value={form.race_number}
              onChange={(e) => setForm((f) => ({ ...f, race_number: +e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Hippodrome</label>
          <input
            required
            value={form.hippodrome}
            onChange={(e) => setForm((f) => ({ ...f, hippodrome: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Time</label>
            <input
              required
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Distance (m)</label>
            <input
              type="number"
              min={1}
              required
              value={form.distance}
              onChange={(e) => setForm((f) => ({ ...f, distance: +e.target.value }))}
              className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Purse (amount)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.purse}
              onChange={(e) => setForm((f) => ({ ...f, purse: +e.target.value || 0 }))}
              className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Purse currency</label>
            <input
              value={form.pursecurrency}
              onChange={(e) => setForm((f) => ({ ...f, pursecurrency: e.target.value || 'Dh' }))}
              className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
            />
          </div>
        </div>

        <div className="min-w-[120px]">
          <label className="block text-sm text-gray-400 mb-1">Weather temp (°C) — live at hippodrome</label>
          <input
            type="number"
            step={0.1}
            value={form.weather_temp ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, weather_temp: e.target.value === '' ? undefined : +e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-dark-700 border border-dark-500 text-white"
            placeholder="Updates automatically when you open this page"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Participants</label>
              <span className="text-sm text-white font-medium">({participants.length})</span>
            </div>
            <button type="button" onClick={addParticipant} className="text-sm text-accent hover:underline">
              + Add
            </button>
          </div>
          <div className="space-y-3">
            {participants.map((p, i) => (
              <div key={i} className="flex flex-wrap gap-3 items-end bg-dark-700 rounded-lg p-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-0.5">Number</label>
                  <span className="inline-block px-2 py-1.5 rounded bg-dark-600 text-white text-sm w-10 text-center">{p.number}</span>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs text-gray-400 mb-0.5">Horse</label>
                  <input
                    value={p.horse}
                    onChange={(e) => updateParticipant(i, 'horse', e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-dark-600 border border-dark-500 text-white text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs text-gray-400 mb-0.5">Jockey</label>
                  <input
                    value={p.jockey}
                    onChange={(e) => updateParticipant(i, 'jockey', e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-dark-600 border border-dark-500 text-white text-sm"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs text-gray-400 mb-0.5">Weight</label>
                  <input
                    type="number"
                    value={p.weight || ''}
                    onChange={(e) => updateParticipant(i, 'weight', +e.target.value || 0)}
                    className="w-full px-3 py-1.5 rounded bg-dark-600 border border-dark-500 text-white text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeParticipant(i)}
                  disabled={participants.length <= 1}
                  className="text-red-400 hover:underline text-sm disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-dark-900 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <Link href="/dashboard/races" className="px-6 py-2 rounded-lg border border-dark-500 text-gray-400 hover:bg-dark-600">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
