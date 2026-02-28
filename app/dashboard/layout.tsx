'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

const nav = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/races', label: 'Races' },
  { href: '/dashboard/races/new', label: 'Add Race' },
  { href: '/dashboard/results', label: 'Results' },
  { href: '/dashboard/results/new', label: 'Add Result' },
  { href: '/dashboard/upload', label: 'Upload JSON' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, email, logout, isReady } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !token) router.replace('/');
  }, [isReady, token, router]);

  if (!isReady || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-dark-900">
      <aside className="w-64 bg-dark-800 border-r border-dark-600 flex flex-col fixed h-full">
        <div className="p-6 border-b border-dark-600">
          <Link href="/dashboard" className="text-xl font-bold text-white">
            🐎 Racing Admin
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-3 rounded-lg text-sm font-medium transition ${
                pathname === item.href
                  ? 'bg-accent/20 text-accent'
                  : 'text-gray-400 hover:bg-dark-600 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-dark-600">
          <p className="text-xs text-gray-500 truncate px-2">{email}</p>
          <button
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="mt-2 w-full px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-dark-600 hover:text-white transition"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
