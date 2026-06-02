import { timingSafeEqual } from 'node:crypto';
import { consumeHandoffJti, type ConsumeJtiReason, type Db } from '@wtc/db';
import type { AuditWriter } from '@wtc/audit';

type JtiConsumeEnv = {
  AXIOMA_ROUTE_SKELETON_ENABLED?: string;
  AXIOMA_BRIDGE_API_TOKEN?: string;
  NODE_ENV?: string;
};

export interface AxiomaJtiConsumeOptions {
  db: Db | null;
  audit: AuditWriter;
  env?: JtiConsumeEnv;
  now?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noStore(body: unknown, init: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) },
  });
}

function bearerToken(req: Request): string | null {
  const value = req.headers.get('authorization') ?? '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function configured(opts: AxiomaJtiConsumeOptions, env: JtiConsumeEnv): boolean {
  return env.AXIOMA_ROUTE_SKELETON_ENABLED === 'true' && !!env.AXIOMA_BRIDGE_API_TOKEN?.trim() && !!opts.db;
}

function responseForFailure(reason: ConsumeJtiReason | undefined): { body: Record<string, string>; status: number } {
  if (reason === 'already_used') return { body: { error: 'already_consumed' }, status: 409 };
  if (reason === 'expired') return { body: { error: 'expired' }, status: 410 };
  if (reason === 'revoked') return { body: { error: 'revoked' }, status: 410 };
  return { body: { error: 'not_found' }, status: 404 };
}

async function auditConsume(
  audit: AuditWriter,
  input: { jti: string; sub?: string | null; consumed: boolean; reason?: ConsumeJtiReason },
): Promise<void> {
  await audit.write({
    actorUserId: input.sub ?? null,
    actorRole: 'system',
    action: input.consumed ? 'axioma.handoff_jti_consume' : 'axioma.handoff_jti_replay',
    targetType: 'axioma_handoff_jti',
    targetId: input.jti,
    result: input.consumed ? 'success' : 'failure',
    after: input.consumed ? { consumed: true } : { reason: input.reason ?? 'not_found' },
  });
}

export async function handleAxiomaJtiConsumeRequest(
  req: Request,
  opts: AxiomaJtiConsumeOptions,
): Promise<Response> {
  if (req.method !== 'POST') {
    return noStore({ error: 'method_not_allowed', detail: 'Axioma jti consume is POST only.' }, { status: 405 });
  }

  const env = opts.env ?? process.env;
  if (!configured(opts, env)) {
    return noStore({ error: 'not_configured' }, { status: 503 });
  }

  const expectedToken = env.AXIOMA_BRIDGE_API_TOKEN!.trim();
  const submittedToken = bearerToken(req);
  if (!submittedToken || !secureEqual(submittedToken, expectedToken)) {
    return noStore({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return noStore({ error: 'bad_request' }, { status: 400 });
  }
  const jti = typeof (body as { jti?: unknown }).jti === 'string' ? (body as { jti: string }).jti : '';
  if (!UUID_RE.test(jti)) {
    return noStore({ error: 'bad_request' }, { status: 400 });
  }

  const result = await consumeHandoffJti(opts.db!, jti, opts.now ?? Date.now());
  await auditConsume(opts.audit, { jti, sub: result.sub, consumed: result.consumed, reason: result.reason });
  if (result.consumed) {
    return noStore({ consumed: true }, { status: 200 });
  }
  const failure = responseForFailure(result.reason);
  return noStore(failure.body, { status: failure.status });
}
