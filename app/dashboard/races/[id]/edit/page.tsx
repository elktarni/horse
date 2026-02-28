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

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm text-gray-400">Participants</label>
            <button type="button" onClick={addParticipant} className="text-sm text-accent hover:underline">
              + Add
            </button>
          </div>
          <div className="space-y-3">
            {participants.map((p, i) => (
              <div key={i} className="flex gap-2 items-center flex-wrap bg-dark-700 rounded-lg p-3">
                <span className="text-gray-500 w-6">{p.number}</span>
                <input
                  placeholder="Horse"
                  value={p.horse}
                  onChange={(e) => updateParticipant(i, 'horse', e.target.value)}
                  className="flex-1 min-w-[100px] px-3 py-1.5 rounded bg-dark-600 border border-dark-500 text-white text-sm"
                />
                <input
                  placeholder="Jockey"
                  value={p.jockey}
                  onChange={(e) => updateParticipant(i, 'jockey', e.target.value)}
                  className="flex-1 min-w-[100px] px-3 py-1.5 rounded bg-dark-600 border border-dark-500 text-white text-sm"
                />
                <input
                  type="number"
                  placeholder="Weight"
                  value={p.weight || ''}
                  onChange={(e) => updateParticipant(i, 'weight', +e.target.value || 0)}
                  className="w-20 px-3 py-1.5 rounded bg-dark-600 border border-dark-500 text-white text-sm"
                />
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
