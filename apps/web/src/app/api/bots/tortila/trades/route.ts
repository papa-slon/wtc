import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { botAccessForUser } from '@/lib/access';
import { loadTortilaTradesPage } from '@/features/bots/tortila-overview-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Session-gated proxy over the Tortila journal `/api/trades/list` endpoint used
 * by the premium trade-history table (group I — filterable + paginated). The
 * JOURNAL_READ_TOKEN never leaves the server: the route fans out to
 * `loadTortilaTradesPage()` which carries the token in its bearer header, and we
 * only ship the parsed JSON page.
 *
 * Auth: the request must carry a valid session cookie AND the user must hold an
 * active Tortila Bot entitlement (the same gate the page + overview proxy
 * enforce). Returns 401 when unauthenticated, 403 when the entitlement is
 * missing or suspended, and 200 with the page payload otherwise.
 *
 * Query params (all optional): page, page_size, symbol, side, exit_reason. They
 * are clamped/sanitised inside the journal reader before the upstream request.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'cache-control': 'no-store' } });
  }
  const access = await botAccessForUser(user, 'tortila_bot');
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden', reason: access.reason }, { status: 403, headers: { 'cache-control': 'no-store' } });
  }

  const sp = request.nextUrl.searchParams;
  const pageRaw = Number(sp.get('page'));
  const pageSizeRaw = Number(sp.get('page_size'));
  const result = await loadTortilaTradesPage({
    page: Number.isFinite(pageRaw) ? pageRaw : undefined,
    pageSize: Number.isFinite(pageSizeRaw) ? pageSizeRaw : undefined,
    symbol: sp.get('symbol') ?? undefined,
    side: sp.get('side') ?? undefined,
    exitReason: sp.get('exit_reason') ?? undefined,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
  return NextResponse.json(result.data, { headers: { 'cache-control': 'no-store' } });
}
