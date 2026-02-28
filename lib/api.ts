// In browser: always use same origin so Next.js API route proxies to backend (avoids CORS / "Failed to fetch")
// On server: use backend URL for server-side calls
const API_BASE =
  typeof window !== 'undefined'
    ? ''
    : (process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:4000');

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      (json && typeof json === 'object' && 'message' in json && typeof json.message === 'string')
        ? json.message
        : res.status === 503
          ? 'Backend unavailable. Start it with: cd backend && npm run dev'
          : `Request failed (${res.status})`;
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('email');
      window.location.href = '/';
    }
    throw new Error(message);
  }
  return json as ApiResponse<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export interface Race {
  _id: string;
  date: string;
  hippodrome: string;
  race_number: number;
  time: string;
  distance: number;
  title: string;
  purse?: number;
  pursecurrency?: string;
  participants: { number: number; horse: string; jockey: string; weight: number }[];
}

export interface Result {
  _id: string;
  race_id: string;
  arrival: number[];
  rapports: Record<string, number>;
  simple: Record<string, number>;
  couple: Record<string, number>;
  trio: Record<string, number>;
}
