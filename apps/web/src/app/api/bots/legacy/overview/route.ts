import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { botAccessForUser } from '@/lib/access';
import { loadLegacyOverviewPayload } from '@/features/bots/legacy-overview-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Session-gated proxy over the legacy DCA bot's READ-ONLY journal shim, used by
 * the overview dashboard auto-refresh client. The LEGACY_JOURNAL_TOKEN never
 * leaves the server: this route fans out to `loadLegacyOverviewPayload()` which
 * carries the token in its bearer header, and we only ship the parsed JSON.
 *
 * This is the SAFE read-only path — it has nothing to do with the hard-blocked
 * legacy /api_management control adapter.
 *
 * Auth: the request must carry a valid session cookie AND the user must hold an
 * active Legacy Bot entitlement (the same gate the page itself enforces).
 * Returns 401 when unauthenticated, 403 when the entitlement is missing or
 * suspended, and 200 with the payload otherwise.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  const access = await botAccessForUser(user, 'legacy_bot');
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden', reason: access.reason }, { status: 403, headers: { 'cache-control': 'no-store' } });
  }
  const payload = await loadLegacyOverviewPayload();
  return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } });
}
