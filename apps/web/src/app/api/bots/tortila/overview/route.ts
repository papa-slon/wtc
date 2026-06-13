import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { botAccessForUser } from '@/lib/access';
import { loadTortilaOverviewPayload } from '@/features/bots/tortila-overview-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Session-gated proxy over the Tortila journal extended endpoints used by the
 * overview dashboard auto-refresh client. The JOURNAL_READ_TOKEN never leaves
 * the server: the route fans out to `loadTortilaOverviewPayload()` which
 * carries the token in its bearer header, and we only ship the parsed JSON.
 *
 * Auth: the request must carry a valid session cookie AND the user must hold
 * an active Tortila Bot entitlement (the same gate the page itself enforces).
 * Returns 401 when unauthenticated, 403 when the entitlement is missing or
 * suspended, and 200 with the payload otherwise.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  const access = await botAccessForUser(user, 'tortila_bot');
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden', reason: access.reason }, { status: 403, headers: { 'cache-control': 'no-store' } });
  }
  const payload = await loadTortilaOverviewPayload();
  return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
}
