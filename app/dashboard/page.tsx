'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    racesToday: 0,
    totalResults: 0,
    totalRaces: 0,
  });
  const [loading, setLoading] = useState(true);

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
    </div>
  );
}
