'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const requiredFields = ['date', 'hippodrome', 'race_number', 'time', 'distance', 'title', 'participants'];

function validateRaceJson(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return 'Invalid JSON';
  const o = obj as Record<string, unknown>;
  for (const f of requiredFields) {
    if (!(f in o)) return `Missing field: ${f}`;
  }
  if (typeof o.date !== 'string' || typeof o.hippodrome !== 'string' || typeof o.race_number !== 'number') return 'Invalid types for date/hippodrome/race_number';
  if (typeof o.time !== 'string' || typeof o.distance !== 'number' || typeof o.title !== 'string') return 'Invalid types for time/distance/title';
  if (!Array.isArray(o.participants)) return 'participants must be an array';
  for (let i = 0; i < o.participants.length; i++) {
    const p = o.participants[i];
    if (!p || typeof p !== 'object') return `participants[${i}] must be an object`;
    const part = p as Record<string, unknown>;
    if (typeof part.number !== 'number' || typeof part.horse !== 'string' || typeof part.jockey !== 'string' || typeof part.weight !== 'number') {
      return `participants[${i}] must have number, horse, jockey, weight`;
    }
  }
  return null;
}

function isEventFormat(obj: unknown): obj is { event_date: string; hippodrome: string; races: unknown[] } {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return typeof o.event_date === 'string' && typeof o.hippodrome === 'string' && Array.isArray(o.races);
}

async function submitData(data: unknown): Promise<{ message: string }> {
  if (isEventFormat(data)) {
    const res = await api.post<{ created: string[]; skipped: string[] }>('/api/v1/upload/event-json', { data });
    if (!res.success) throw new Error(res.message);
    return { message: res.message };
  }
  const err = validateRaceJson(data);
  if (err) throw new Error(err);
  const res = await api.post('/api/v1/upload/race-json', { data });
  if (!res.success) throw new Error(res.message);
  return { message: 'Race imported successfully' };
}

export default function UploadPage() {
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processAndSubmit = async (raw: string) => {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      toast.error('Invalid JSON');
      return;
    }
    setLoading(true);
    try {
      const { message } = await submitData(data);
      toast.success(message);
      setPasteText('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteSubmit = () => {
    const trimmed = pasteText.trim();
    if (!trimmed) {
      toast.error('Paste JSON first');
      return;
    }
    processAndSubmit(trimmed);
  };

  const handleFile = async (f: File) => {
    setLoading(true);
    try {
      const text = await f.text();
      await processAndSubmit(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid file or upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-white">Upload JSON</h1>
      </div>
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 space-y-6">
        <p className="text-gray-400 text-sm">
          Paste JSON below or upload a file. Supports:
        </p>
        <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
          <li><strong className="text-gray-300">Event format:</strong> event_date, hippodrome, races[] (all races imported at once)</li>
          <li><strong className="text-gray-300">Single race:</strong> date, hippodrome, race_number, time, distance, title, participants[]</li>
        </ul>

        {/* Paste */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Paste JSON</label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder='{"event_date": "2026-02-28", "hippodrome": "Settat", "races": [...]}'
            rows={12}
            className="w-full px-4 py-3 rounded-lg bg-dark-700 border border-dark-500 text-white placeholder-gray-500 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={handlePasteSubmit}
            disabled={loading || !pasteText.trim()}
            className="mt-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-dark-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Importing…' : 'Import from paste'}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-dark-600" />
          <span className="text-gray-500 text-sm">or</span>
          <div className="flex-1 h-px bg-dark-600" />
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Upload file</label>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              drag ? 'border-accent bg-accent/10' : 'border-dark-500 hover:border-dark-400'
            } ${loading ? 'pointer-events-none opacity-70' : ''}`}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400">Importing…</span>
              </div>
            ) : (
              <p className="text-gray-400">Drop a .json file here or click to browse</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
