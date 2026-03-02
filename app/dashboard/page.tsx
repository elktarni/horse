'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

const PING_URL = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/ping`
  : '';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    racesToday: 0,
    totalResults: 0,
    totalRaces: 0,
  });
  const [loading, setLoading] = useState(true);
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      api.get<unknown[]>(`/api/v1/races?date=${today}`).then((r) => (r.success && Array.isArray(r.data) ? r.data.length : 0)),
      api.get<unknown[]>('/api/v1/races').then((r) => (r.success && Array.isArray(r.data) ? r.data.length : 0)),
      api.get<{ race_id: string }[]>('/api/v1/results').then((r) => (r.success && Array.isArray(r.data) ? r.data.length : 0)),
    ])
      .then(([racesToday, totalRaces, totalResults]) => {
        setStats({ racesToday, totalRaces, totalResults });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get<{ pong: boolean }>('/api/v1/ping')
      .then((r) => {
        if (r.success) {
          setApiReachable(true);
          setLastPingAt(new Date().toISOString());
        } else setApiReachable(false);
      })
      .catch(() => setApiReachable(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cards = [
    { label: 'Races today', value: stats.racesToday, href: '/dashboard/races?date=today', color: 'from-accent/20 to-accent/5' },
    { label: 'Total races', value: stats.totalRaces, href: '/dashboard/races', color: 'from-blue-500/20 to-blue-500/5' },
    { label: 'Results added', value: stats.totalResults, href: '/dashboard/results', color: 'from-emerald-500/20 to-emerald-500/5' },
  ];

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold text-white mb-8">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {cards.map((card) => (
          <Link key={card.label} href={card.href}>
            <div className={`bg-gradient-to-br ${card.color} border border-dark-600 rounded-xl p-6 hover:border-dark-500 transition`}>
              <p className="text-gray-400 text-sm font-medium">{card.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
            </div>
          </Link>
        ))}
      </div>
      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick stats</h2>
        <ul className="space-y-2 text-gray-400">
          <li>• Races today: <span className="text-white">{stats.racesToday}</span></li>
          <li>• Total races in database: <span className="text-white">{stats.totalRaces}</span></li>
          <li>• Results added: <span className="text-white">{stats.totalResults}</span></li>
          <li>• Add a new race or result from the sidebar.</li>
        </ul>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-600 p-6 mt-6">
        <h2 className="text-lg font-semibold text-white mb-2">Keep Render awake</h2>
        <p className="text-gray-400 text-sm mb-3">
          On Render free tier, the instance spins down after inactivity. Call the ping URL every 10 minutes to avoid cold starts (50+ s delay).
        </p>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-500">API status:</span>
          {apiReachable === null ? (
            <span className="text-gray-400 text-sm">Checking…</span>
          ) : apiReachable ? (
            <span className="text-emerald-400 text-sm font-medium">Reachable</span>
          ) : (
            <span className="text-amber-400 text-sm">Unreachable</span>
          )}
          {lastPingAt && (
            <span className="text-xs text-gray-500">(last check: {new Date(lastPingAt).toLocaleTimeString()})</span>
          )}
        </div>
        {PING_URL ? (
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Ping this URL every 10 min (e.g. <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">cron-job.org</a>):</p>
            <code className="block bg-dark-700 rounded px-2 py-1.5 text-xs text-gray-300 break-all">{PING_URL}</code>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Set <code className="bg-dark-700 px-1 rounded">NEXT_PUBLIC_API_URL</code> to your Render API URL to see the ping link here.</p>
        )}
      </div>
    </div>
  );
}
