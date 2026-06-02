import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { schema, recordHandoffJti, revokeHandoffJtisByUser, type Db } from '@wtc/db';
import { createMemoryAuditWriter, type AuditEvent } from '@wtc/audit';
import { handleAxiomaJtiConsumeRequest } from '../../apps/web/src/features/terminal/axioma-jti-consume.ts';

const TOKEN = 'axioma-bridge-token-local-test';
const NOW = 1_900_000_000_000;
const TTL = 5 * 60 * 1000;

let db: Db;
let auditEvents: AuditEvent[];

beforeEach(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  auditEvents = [];
});

async function recordJti(opts?: { sub?: string; expiresAt?: number }): Promise<{ jti: string; sub: string }> {
  const jti = randomUUID();
  const sub = opts?.sub ?? randomUUID();
  await recordHandoffJti(db, {
    jti,
    sub,
    issuedAt: new Date(NOW),
    expiresAt: new Date(opts?.expiresAt ?? NOW + TTL),
  });
  return { jti, sub };
}

function request(body: unknown, token = TOKEN, method = 'POST'): Request {
  return new Request('https://wtc.local/api/axioma/jti/consume', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

function handle(req: Request, opts?: { configured?: boolean; token?: string }): Promise<Response> {
  const { writer, events } = createMemoryAuditWriter();
  auditEvents = events;
  return handleAxiomaJtiConsumeRequest(req, {
    db: opts?.configured === false ? null : db,
    audit: writer,
    env: {
      AXIOMA_ROUTE_SKELETON_ENABLED: opts?.configured === false ? 'false' : 'true',
      AXIOMA_BRIDGE_API_TOKEN: opts?.token ?? TOKEN,
      NODE_ENV: 'test',
    },
    now: NOW + 1000,
  });
}

describe('Axioma JTI consume handler', () => {
  it('returns 405 no-store for non-POST requests', async () => {
    const res = await handle(request({}, TOKEN, 'GET'));
    expect(res.status).toBe(405);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('fails closed when the route is not configured', async () => {
    const res = await handle(request({ jti: randomUUID() }), { configured: false });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'not_configured' });

    const whitespaceToken = await handle(request({ jti: randomUUID() }), { token: '   ' });
    expect(whitespaceToken.status).toBe(503);
  });

  it('rejects missing or wrong bearer tokens before consuming', async () => {
    const { jti } = await recordJti();
    const missing = new Request('https://wtc.local/api/axioma/jti/consume', {
      method: 'POST',
      body: JSON.stringify({ jti }),
    });
    expect((await handle(missing)).status).toBe(401);
    expect((await handle(request({ jti }, 'wrong-token'))).status).toBe(401);
  });

  it('rejects malformed JSON and malformed jti values', async () => {
    const badJson = new Request('https://wtc.local/api/axioma/jti/consume', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN}` },
      body: '{',
    });
    expect((await handle(badJson)).status).toBe(400);
    expect((await handle(request({ jti: 'not-a-uuid' }))).status).toBe(400);
  });

  it('consumes a live jti once and writes a success audit event', async () => {
    const { jti, sub } = await recordJti();

    const res = await handle(request({ jti }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ consumed: true });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]!).toMatchObject({
      actorUserId: sub,
      actorRole: 'system',
      action: 'axioma.handoff_jti_consume',
      targetType: 'axioma_handoff_jti',
      targetId: jti,
      result: 'success',
    });
  });

  it('returns 409 for replay and writes a failure audit event', async () => {
    const { jti, sub } = await recordJti();
    expect((await handle(request({ jti }))).status).toBe(200);

    const replay = await handle(request({ jti }));

    expect(replay.status).toBe(409);
    await expect(replay.json()).resolves.toEqual({ error: 'already_consumed' });
    expect(auditEvents[0]!).toMatchObject({
      actorUserId: sub,
      action: 'axioma.handoff_jti_replay',
      result: 'failure',
      after: { reason: 'already_used' },
    });
  });

  it('returns 404 for unknown jti and 410 for expired or revoked jtis', async () => {
    const unknown = await handle(request({ jti: randomUUID() }));
    expect(unknown.status).toBe(404);

    const expired = await recordJti({ expiresAt: NOW - 1000 });
    const expiredRes = await handle(request({ jti: expired.jti }));
    expect(expiredRes.status).toBe(410);
    await expect(expiredRes.json()).resolves.toEqual({ error: 'expired' });

    const revoked = await recordJti();
    await revokeHandoffJtisByUser(db, revoked.sub, 'entitlement_revoked', NOW);
    const revokedRes = await handle(request({ jti: revoked.jti }));
    expect(revokedRes.status).toBe(410);
    await expect(revokedRes.json()).resolves.toEqual({ error: 'revoked' });
  });
});
