import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { ok: true, status: 'ok', service: 'wtc-web' },
    { headers: { 'cache-control': 'no-store' } },
  );
}

export async function HEAD() {
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
