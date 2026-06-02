export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { audit, getServerDb } from '@/lib/backend';
import { handleAxiomaJtiConsumeRequest } from '@/features/terminal/axioma-jti-consume';

export async function GET(): Promise<Response> {
  return Response.json(
    { error: 'method_not_allowed', detail: 'Axioma jti consume is POST only.' },
    { status: 405, headers: { 'cache-control': 'no-store' } },
  );
}

export async function POST(req: Request): Promise<Response> {
  return handleAxiomaJtiConsumeRequest(req, { db: getServerDb(), audit, env: process.env });
}
