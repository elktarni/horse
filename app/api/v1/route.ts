import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      version: 'v1',
      message: 'Horse Racing API',
      endpoints: {
        health: '/api/v1/health',
        auth: '/api/v1/auth/login (POST)',
        races: '/api/v1/races',
        results: '/api/v1/results',
        weather: '/api/v1/weather?location=... (GET)',
        upload: '/api/v1/upload/race-json, /api/v1/upload/event-json (POST)',
      },
    },
    message: 'API v1 base',
  });
}
