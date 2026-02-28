import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:4000';

async function proxy(request: NextRequest, path: string[]) {
  const pathStr = path.join('/');
  const url = `${API_URL}/api/v1/${pathStr}`;
  const headers: HeadersInit = {};
  request.headers.forEach((value, key) => {
    if (
      key.toLowerCase() !== 'host' &&
      key.toLowerCase() !== 'connection' &&
      key.toLowerCase() !== 'content-length'
    ) {
      headers[key] = value;
    }
  });

  let body: string | undefined;
  try {
    body = await request.text();
  } catch {
    // no body
  }

  try {
    const res = await fetch(url, {
      method: request.method,
      headers,
      body: body || undefined,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Proxy error:', err);
    return NextResponse.json(
      {
        success: false,
        data: null,
        message:
          'Cannot reach the backend. Make sure the backend is running (e.g. cd backend && npm run dev).',
      },
      { status: 503 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}
