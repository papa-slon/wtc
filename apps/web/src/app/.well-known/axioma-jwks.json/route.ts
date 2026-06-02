export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { resolveAxiomaJwksReadiness } from '../../../features/terminal/axioma-jwks-readiness';

function json(body: unknown, init: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: {
      'cache-control': init.status && init.status >= 400 ? 'no-store' : 'public, max-age=300',
      ...(init.headers ?? {}),
    },
  });
}

export async function GET(): Promise<Response> {
  const readiness = resolveAxiomaJwksReadiness();
  if (!readiness.configured || !readiness.jwks) {
    return json({ error: 'jwks_not_configured' }, { status: 503 });
  }
  return json(readiness.jwks, { status: 200 });
}
