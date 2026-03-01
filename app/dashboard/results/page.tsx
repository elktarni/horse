'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface ResultRow {
  race_id: string;
  title?: string;
  arrival?: number[];
  _id?: string;
}

interface CasaSyncResponse {
  created: string[];
  updated: string[];
  notFound: string[];
  message: string;
}

export default function ResultsPage() {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncDate, setSyncDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [syncVenue, setSyncVenue] = useState('SOREC');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchResults = useCallback(() => {
    setLoading(true);
    api
      .get<ResultRow[]>('/api/v1/results')
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setResults(r.data);
      })
      .catch(() => toast.error('Failed to load results'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Refetch when user returns to this tab (e.g. after editing a result)
  useEffect(() => {
    const onFocus = () => fetchResults();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchResults]);

  const handleDelete = async (raceId: string) => {
    if (!confirm('Delete this result?')) return;
    try {
      await api.delete(`/api/v1/results/${raceId}`);
      setResults((prev) => prev.filter((r) => r.race_id !== raceId));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(raceId); return s; });
      toast.success('Result deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(results.map((r) => r.race_id)));
  };
  const toggleSelect = (raceId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(raceId)) next.delete(raceId);
      else next.add(raceId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected result(s)?`)) return;
    setBulkDeleting(true);
    let ok = 0;
    let fail = 0;
    for (const raceId of ids) {
      try {
        await api.delete(`/api/v1/results/${raceId}`);
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    fetchResults();
    if (fail) toast.error(`Deleted ${ok}, failed ${fail}`);
    else toast.success(`Deleted ${ok} result(s)`);
  };

  const handleSyncFromCasa = async () => {
    setSyncLoading(true);
    try {
      const params = new URLSearchParams({ date: syncDate });
      if (syncVenue.trim()) params.set('venue', syncVenue.trim());
      const r = await api.get<CasaSyncResponse>(`/api/v1/sync/casa-programme?${params}`);
      if (!r.success || !r.data) throw new Error(r.message);
      const d = r.data;
      const total = d.created.length + d.updated.length;
      if (total > 0) {
        toast.success(d.message ?? 'Sync done.');
        fetchResults();
      } else if (d.notFound?.length) {
        toast(`${d.notFound.length} race(s) not in DB. Add races from the Races tab first.`, { icon: 'ℹ️' });
      } else {
        toast('No finished races for this date/venue in Casa programme.', { icon: 'ℹ️' });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncLoading(false);
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
        <h1 className="text-2xl font-bold text-white">Results</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-sm transition"
            >
              {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size} selected`}
            </button>
          )}
          <Link
            href="/dashboard/results/new"
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-dark-900 font-medium transition"
          >
            Add Result
          </Link>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-2">Sync from Casa Courses</h2>
        <p className="text-sm text-gray-500 mb-3">
          Fetch programme and create/update results for finished races that match your existing races (SOREC Maroc only).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Date
            <input
              type="date"
              value={syncDate}
              onChange={(e) => setSyncDate(e.target.value)}
              className="rounded-lg bg-dark-700 border border-dark-600 px-3 py-2 text-white text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            Venue
            <input
              type="text"
              value={syncVenue}
              onChange={(e) => setSyncVenue(e.target.value)}
              placeholder="SOREC"
              className="rounded-lg bg-dark-700 border border-dark-600 px-3 py-2 text-white text-sm w-28"
            />
          </label>
          <button
            type="button"
            onClick={handleSyncFromCasa}
            disabled={syncLoading}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-dark-900 font-medium text-sm transition"
          >
            {syncLoading ? 'Syncing…' : 'Sync results'}
          </button>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 overflow-hidden">
        {results.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No results yet. <Link href="/dashboard/results/new" className="text-accent hover:underline">Add one</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-600 text-left text-sm text-gray-400">
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={results.length > 0 && selectedIds.size === results.length}
                      onChange={toggleSelectAll}
                      className="rounded border-dark-500 bg-dark-700 text-accent focus:ring-accent"
                    />
                  </th>
                  <th className="p-4">Race ID</th>
                  <th className="p-4">Title</th>
                  <th className="p-4">Arrival</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.race_id} className="border-b border-dark-600/50 hover:bg-dark-700/50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.race_id)}
                        onChange={() => toggleSelect(r.race_id)}
                        className="rounded border-dark-500 bg-dark-700 text-accent focus:ring-accent"
                      />
                    </td>
                    <td className="p-4 font-mono text-sm">{r.race_id}</td>
                    <td className="p-4 max-w-[200px] truncate" title={r.title}>{r.title || '—'}</td>
                    <td className="p-4">
                      {Array.isArray(r.arrival) && r.arrival.length > 0
                        ? r.arrival.map((n) => Number(n)).join(' → ')
                        : '—'}
                    </td>
                    <td className="p-4 flex gap-2">
                      <Link
                        href={`/dashboard/results/${encodeURIComponent(r.race_id)}/edit`}
                        className="text-accent hover:underline text-sm"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(r.race_id)}
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
