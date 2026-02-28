'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function LoginPage() {
  const { token, login, isReady } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isReady && token) router.replace('/dashboard');
  }, [isReady, token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post<{ token: string; email: string }>('/api/v1/auth/login', {
        email,
        password,
      });
      if (res.success && res.data) {
        login(res.data.token, res.data.email);
        toast.success('Welcome back!');
        router.push('/dashboard');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900 px-4">
      <div className="w-full max-w-md animate-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Horse Racing
          </h1>
          <p className="text-gray-400 mt-1">Admin Dashboard</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-dark-800 rounded-2xl border border-dark-600 p-8 shadow-xl"
        >
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-dark-700 border border-dark-500 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
            placeholder="admin@example.com"
          />
          <label className="block text-sm font-medium text-gray-300 mt-4 mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-dark-700 border border-dark-500 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
            placeholder="••••••••"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 py-3 rounded-lg bg-accent hover:bg-accent-hover text-dark-900 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-dark-900 border-t-transparent rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
