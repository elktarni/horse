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

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    if (!f.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }
    setLoading(true);
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      const err = validateRaceJson(data);
      if (err) {
        toast.error(err);
        setLoading(false);
        return;
      }
      const res = await api.post('/api/v1/upload/race-json', { data });
      if (res.success) {
        toast.success('Race imported successfully');
        if (inputRef.current) inputRef.current.value = '';
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid JSON or upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard" className="text-gray-400 hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-white">Upload Race JSON</h1>
      </div>
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
        <p className="text-gray-400 text-sm mb-4">
          Upload a single race JSON file. Required structure: date, hippodrome, race_number, time, distance, title, participants (array of &#123; number, horse, jockey, weight &#125;).
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
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
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
            drag ? 'border-accent bg-accent/10' : 'border-dark-500 hover:border-dark-400'
          } ${loading ? 'pointer-events-none opacity-70' : ''}`}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-400">Uploading...</span>
            </div>
          ) : (
            <p className="text-gray-400">Drop a JSON file here or click to browse</p>
          )}
        </div>
      </div>
    </div>
  );
}
