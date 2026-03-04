'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type Race } from '@/lib/api';
import toast from 'react-hot-toast';

type EditableField = 'time' | 'distance' | 'title' | 'purse' | 'reunion';

type WeatherMap = Record<string, { temp: number; unit: string } | null>;

interface CasaSyncResponse {
  racesAdded?: string[];
  created: string[];
  updated: string[];
  notFound: string[];
  meetingsFromApi?: number;
  meetingsMorocco?: number;
  message: string;
}

const VENUE_STORAGE_KEY = 'dashboard-venue';

export default function RacesPage() {
  const [venue, setVenue] = useState<'SOREC' | 'PMU'>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem(VENUE_STORAGE_KEY);
      return v === 'PMU' ? 'PMU' : 'SOREC';
    }
    return 'SOREC';
  });
  const [races, setRaces] = useState<Race[]>([]);
  const [weather, setWeather] = useState<WeatherMap>({});
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncDate, setSyncDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const [viewDate, setViewDate] = useState<string | null>('today');
  const [customDate, setCustomDate] = useState(todayStr);
  const [editingCell, setEditingCell] = useState<{ raceId: string; field: EditableField } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const apiDate = viewDate === 'today' ? todayStr : viewDate === 'yesterday' ? yesterdayStr : viewDate === 'tomorrow' ? tomorrowStr : viewDate === 'custom' ? customDate : null;

  const fetchRaces = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (apiDate) params.set('date', apiDate);
    params.set('venue', venue);
    const url = `/api/v1/races?${params}`;
    api
      .get<Race[]>(url)
      .then((r) => {
        if (r.success && Array.isArray(r.data)) setRaces(r.data);
      })
      .catch(() => toast.error('Failed to load races'))
      .finally(() => setLoading(false));
  }, [apiDate, venue]);

  useEffect(() => {
    fetchRaces();
  }, [fetchRaces]);

  // Weather from Open-Meteo (same as Edit race): GET /api/v1/weather by hippodrome, batch for list
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
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      toast.success('Race deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === races.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(races.map((r) => r._id)));
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDisplayValue = useCallback((race: Race, field: EditableField): string => {
    switch (field) {
      case 'time':
        return race.time ?? '';
      case 'distance':
        return String(race.distance ?? '');
      case 'title':
        return race.title ?? '';
      case 'purse':
        return race.purse != null && race.purse > 0
          ? String(race.purse > 100000 ? Math.round(race.purse / 100) : race.purse)
          : '';
      case 'reunion':
        return race.reunion ?? '';
      default:
        return '';
    }
  }, []);

  const startEditing = useCallback((race: Race, field: EditableField) => {
    setEditingCell({ raceId: race._id, field });
    setEditingValue(getDisplayValue(race, field));
  }, [getDisplayValue]);

  useEffect(() => {
    if (editingCell) inputRef.current?.focus();
  }, [editingCell]);

  const cancelEditing = useCallback(() => {
    setEditingCell(null);
    setEditingValue('');
  }, []);

  const saveEditing = useCallback(async () => {
    if (!editingCell) return;
    const race = races.find((r) => r._id === editingCell.raceId);
    if (!race) return cancelEditing();

    let payload: Partial<Race> = {};
    if (editingCell.field === 'time') {
      const v = editingValue.trim();
      if (!v) return cancelEditing();
      payload.time = v;
    } else if (editingCell.field === 'distance') {
      const n = parseInt(editingValue.trim(), 10);
      if (Number.isNaN(n) || n < 1) return cancelEditing();
      payload.distance = n;
    } else if (editingCell.field === 'title') {
      const v = editingValue.trim();
      if (!v) return cancelEditing();
      payload.title = v;
    } else if (editingCell.field === 'purse') {
      const n = parseFloat(editingValue.replace(/\s/g, '').replace(',', '.'));
      if (Number.isNaN(n) || n < 0) return cancelEditing();
      payload.purse = n;
      payload.pursecurrency = race.pursecurrency ?? 'Dh';
    } else if (editingCell.field === 'reunion') {
      payload.reunion = editingValue.trim() || undefined;
    }
    if (Object.keys(payload).length === 0) return cancelEditing();

    const raceId = String(editingCell.raceId);
    try {
      const res = await api.put<Race>(`/api/v1/races/${raceId}`, payload);
      if (res.success && res.data) {
        setRaces((prev) => prev.map((r) => (String(r._id) === raceId ? { ...r, ...res.data } : r)));
        toast.success('Saved');
        fetchRaces();
      }
    } catch {
      toast.error('Failed to save');
    }
    cancelEditing();
  }, [editingCell, editingValue, races, cancelEditing, fetchRaces]);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected race(s)?`)) return;
    setBulkDeleting(true);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      try {
        await api.delete(`/api/v1/races/${id}`);
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    fetchRaces();
    if (fail) toast.error(`Deleted ${ok}, failed ${fail}`);
    else toast.success(`Deleted ${ok} race(s)`);
  };

  const handleSyncFromCasa = async () => {
    setSyncLoading(true);
    try {
      const params = new URLSearchParams({
        date: syncDate,
        venue,
        add_races: '1',
      });
      const r = await api.get<CasaSyncResponse>(`/api/v1/sync/casa-programme?${params}`);
      if (!r.success || !r.data) throw new Error(r.message);
      const d = r.data;
      const total = (d.racesAdded?.length ?? 0) + d.created.length + d.updated.length;
      if (total > 0) {
        toast.success(d.message ?? 'Sync done.');
        setViewDate('custom');
        setCustomDate(syncDate);
        setLoading(true);
        api.get<Race[]>(`/api/v1/races?date=${syncDate}&venue=${venue}`).then((r) => {
          if (r.success && Array.isArray(r.data)) setRaces(r.data);
        }).catch(() => toast.error('Failed to refresh list')).finally(() => setLoading(false));
      } else {
        const fromApi = d.meetingsFromApi ?? 0;
        const morocco = d.meetingsMorocco ?? 0;
        let hint = '';
        if (fromApi === 0) hint = 'Casa API returned no meetings for this date. Try 2026-03-01 or a date when Marrakech/Settat run.';
        else if (morocco === 0) hint = `${fromApi} meeting(s) from Casa but none are Morocco (we only sync Marrakech, Settat, etc.).`;
        else hint = 'No new races or results. Races for this date may already exist in your list.';
        toast(`${d.message || 'Nothing added.'} ${hint}`, { icon: 'ℹ️', duration: 6000 });
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
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Races</h1>
          <div className="flex rounded-lg overflow-hidden border border-dark-600">
            <button
              type="button"
              onClick={() => { setVenue('SOREC'); localStorage.setItem(VENUE_STORAGE_KEY, 'SOREC'); }}
              className={`px-3 py-1.5 text-sm font-medium transition ${venue === 'SOREC' ? 'bg-accent text-dark-900' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'}`}
            >
              SOREC
            </button>
            <button
              type="button"
              onClick={() => { setVenue('PMU'); localStorage.setItem(VENUE_STORAGE_KEY, 'PMU'); }}
              className={`px-3 py-1.5 text-sm font-medium transition ${venue === 'PMU' ? 'bg-accent text-dark-900' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'}`}
            >
              PMU
            </button>
          </div>
        </div>
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
            href="/dashboard/races/new"
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-dark-900 font-medium transition"
          >
            Add Race
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">View:</span>
        <button
          type="button"
          onClick={() => setViewDate('yesterday')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewDate === 'yesterday' ? 'bg-accent text-dark-900' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'}`}
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => setViewDate('today')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewDate === 'today' ? 'bg-accent text-dark-900' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'}`}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setViewDate('tomorrow')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewDate === 'tomorrow' ? 'bg-accent text-dark-900' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'}`}
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => setViewDate(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewDate === null ? 'bg-accent text-dark-900' : 'bg-dark-700 text-gray-400 hover:bg-dark-600'}`}
        >
          All
        </button>
        <label className={`flex items-center gap-2 text-sm ${viewDate === 'custom' ? 'text-accent' : 'text-gray-400'}`}>
          <span>Date</span>
          <input
            type="date"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value);
              setViewDate('custom');
            }}
            className={`rounded-lg border px-2 py-1.5 text-white text-sm ${viewDate === 'custom' ? 'bg-accent/20 border-accent' : 'bg-dark-700 border-dark-600'}`}
          />
        </label>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-400 mb-2">Sync from Casa Courses ({venue === 'SOREC' ? 'SOREC Maroc' : 'PMU France'})</h2>
        <p className="text-sm text-gray-500 mb-3">
          Import races and results for <strong>Morocco only</strong> (e.g. Marrakech, Casablanca) from the Casa Courses API. Adds missing races and fills results for finished races. The list will refresh for the synced date.
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
          <button
            type="button"
            onClick={handleSyncFromCasa}
            disabled={syncLoading}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-dark-900 font-medium text-sm transition"
          >
            {syncLoading ? 'Syncing…' : 'Sync'}
          </button>
        </div>
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
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={races.length > 0 && selectedIds.size === races.length}
                      onChange={toggleSelectAll}
                      className="rounded border-dark-500 bg-dark-700 text-accent focus:ring-accent"
                    />
                  </th>
                  <th className="p-4">ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Hippodrome</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Reunion</th>
                  <th className="p-4">Race #</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Distance</th>
                  <th className="p-4">Title</th>
                  <th className="p-4">Purse</th>
                  <th className="p-4">Participants</th>
                  <th className="p-4">Weather</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {races.map((race) => (
                  <tr key={race._id} className="border-b border-dark-600/50 hover:bg-dark-700/50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(race._id)}
                        onChange={() => toggleSelect(race._id)}
                        className="rounded border-dark-500 bg-dark-700 text-accent focus:ring-accent"
                      />
                    </td>
                    <td className="p-4 font-mono text-sm">{race._id}</td>
                    <td className="p-4">{new Date(race.date).toLocaleDateString()}</td>
                    <td className="p-4">{race.hippodrome}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300">
                        <span
                          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                            race.status === 'En cours'
                              ? 'bg-emerald-400 animate-pulse'
                              : race.status === 'Terminée'
                                ? 'bg-red-400'
                                : 'bg-gray-400'
                          }`}
                        />
                        {race.status ?? '—'}
                      </span>
                    </td>
                    <td
                      className="p-4 text-sm cursor-text"
                      onDoubleClick={() => startEditing(race, 'reunion')}
                      title="Double-click to edit"
                    >
                      {editingCell?.raceId === race._id && editingCell?.field === 'reunion' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') cancelEditing(); }}
                          className="w-16 rounded border border-dark-500 bg-dark-700 px-2 py-1 text-sm text-white focus:border-accent focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                          placeholder="R9"
                        />
                      ) : (
                        race.reunion ?? '—'
                      )}
                    </td>
                    <td className="p-4">{race.race_number}</td>
                    <td
                      className="p-4 cursor-text"
                      onDoubleClick={() => startEditing(race, 'time')}
                      title="Double-click to edit"
                    >
                      {editingCell?.raceId === race._id && editingCell?.field === 'time' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') cancelEditing(); }}
                          className="w-full min-w-[4rem] rounded border border-dark-500 bg-dark-700 px-2 py-1 text-sm text-white focus:border-accent focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        race.time
                      )}
                    </td>
                    <td
                      className="p-4 cursor-text"
                      onDoubleClick={() => startEditing(race, 'distance')}
                      title="Double-click to edit"
                    >
                      {editingCell?.raceId === race._id && editingCell?.field === 'distance' ? (
                        <input
                          ref={inputRef}
                          type="number"
                          min={1}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') cancelEditing(); }}
                          className="w-20 rounded border border-dark-500 bg-dark-700 px-2 py-1 text-sm text-white focus:border-accent focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        `${race.distance}m`
                      )}
                    </td>
                    <td
                      className="p-4 max-w-[200px] cursor-text"
                      onDoubleClick={() => startEditing(race, 'title')}
                      title="Double-click to edit"
                    >
                      {editingCell?.raceId === race._id && editingCell?.field === 'title' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') cancelEditing(); }}
                          className="w-full min-w-[8rem] rounded border border-dark-500 bg-dark-700 px-2 py-1 text-sm text-white focus:border-accent focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="truncate block">{race.title}</span>
                      )}
                    </td>
                    <td
                      className="p-4 text-sm cursor-text"
                      onDoubleClick={() => startEditing(race, 'purse')}
                      title="Double-click to edit"
                    >
                      {editingCell?.raceId === race._id && editingCell?.field === 'purse' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          inputMode="numeric"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') cancelEditing(); }}
                          className="w-24 rounded border border-dark-500 bg-dark-700 px-2 py-1 text-sm text-white focus:border-accent focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        race.purse != null && race.purse > 0
                          ? `${Number(race.purse > 100000 ? Math.round(race.purse / 100) : race.purse).toLocaleString()} ${race.pursecurrency || 'Dh'}`
                          : '—'
                      )}
                    </td>
                    <td className="p-4 text-sm">
                      {race.participants?.length ? race.participants.length : '—'}
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
