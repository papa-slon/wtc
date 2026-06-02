import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import {
  createUser,
  issueHandoffJtiWithAudit,
  seedDatabase,
  schema,
  type Db,
  type DbUser,
} from '@wtc/db';
import { verifyEs256HandoffToken } from '@wtc/axioma-bridge';
import type { AccessDecision, AccessReason } from '@wtc/entitlements';
import { handleAxiomaJournalHandoffRequest } from '../../apps/web/src/features/terminal/axioma-journal-handoff.ts';

const CSRF = 'csrf-token-for-axioma-journal';
const NOW = 1_900_000_000_000;
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }) as string;

let db: Db;
let user: DbUser;

beforeEach(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  user = await createUser(db, {
    email: `axioma-journal-${randomUUID()}@wtc.local`,
    passwordHash: 'h',
    displayName: 'Axioma Journal',
  });
});

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    APP_ENV: 'test',
    AXIOMA_ROUTE_SKELETON_ENABLED: 'true',
    AXIOMA_BRIDGE_API_TOKEN: 'axioma-bridge-token',
    AXIOMA_HANDOFF_SIGNING_KEY: PRIVATE_KEY_PEM,
    AXIOMA_HANDOFF_KEY_ID: 'kid-journal-route',
    AXIOMA_HANDOFF_AUDIENCE: 'axioma-journal',
    AXIOMA_JOURNAL_BASE_URL: 'https://axi-o.ma',
    ...overrides,
  };
}

function request(opts: { csrf?: string; method?: string } = {}): Request {
  const method = opts.method ?? 'POST';
  return new Request('https://wtc.local/api/axioma/journal-handoff', {
    method,
    headers: opts.csrf === undefined ? {} : { 'x-csrf-token': opts.csrf },
  });
}

function access(
  status: 'active' | 'grace' = 'active',
  opts: { expiresAt?: number; currentPeriodEnd?: number; graceUntil?: number } = {},
): AccessDecision {
  const expiresAt = opts.expiresAt ?? NOW + 600_000;
  const currentPeriodEnd = opts.currentPeriodEnd ?? expiresAt + 50_000;
  return {
    allowed: true,
    reason: status === 'active' ? 'allowed' : 'grace',
    status,
    productCode: 'axioma_terminal',
    entitlement: {
      userId: user.id,
      productCode: 'axioma_terminal',
      status,
      source: 'manual_grant',
      currentPeriodEnd,
      expiresAt,
      ...(typeof opts.graceUntil === 'number' ? { graceUntil: opts.graceUntil } : {}),
      updatedAt: NOW,
    },
  };
}

function denied(reason: AccessReason = 'blocked_no_entitlement'): AccessDecision {
  return {
    allowed: false,
    reason,
    status: 'none',
    productCode: 'axioma_terminal',
  };
}

async function handle(
  req: Request,
  opts: {
    dbValue?: Db | null;
    envValue?: ReturnType<typeof env>;
    userValue?: DbUser | null;
    accessValue?: AccessDecision;
    csrfValue?: string | null;
    issue?: typeof issueHandoffJtiWithAudit;
  } = {},
): Promise<Response> {
  return handleAxiomaJournalHandoffRequest(req, {
    db: opts.dbValue === undefined ? db : opts.dbValue,
    env: opts.envValue ?? env(),
    now: NOW,
    getCsrfToken: async () => opts.csrfValue ?? CSRF,
    requireUser: async () => {
      if (opts.userValue === null) throw new Error('unauthenticated');
      return opts.userValue ?? user;
    },
    accessFor: async () => opts.accessValue ?? access(),
    reasonLabel: (reason) => reason,
    issueHandoffJti: opts.issue,
  });
}

async function linkAxiomaUser(axiomaUserId = 'axioma-user-123'): Promise<void> {
  await db.insert(schema.axiomaAccountLinks).values({
    userId: user.id,
    state: 'linked',
    axiomaUserId,
  });
}

describe('Axioma journal handoff handler', () => {
  it('is POST-only and checks CSRF before resolving the user', async () => {
    const get = await handle(request({ method: 'GET' }), {
      userValue: null,
      csrfValue: null,
    });
    expect(get.status).toBe(405);
    expect(get.headers.get('cache-control')).toBe('no-store');

    let userCalled = false;
    const badCsrf = await handleAxiomaJournalHandoffRequest(request({ csrf: 'bad' }), {
      db,
      env: env(),
      now: NOW,
      getCsrfToken: async () => CSRF,
      requireUser: async () => {
        userCalled = true;
        return user;
      },
      accessFor: async () => access(),
      reasonLabel: (reason) => reason,
    });

    expect(badCsrf.status).toBe(403);
    expect(userCalled).toBe(false);
  });

  it('fails closed for unauthenticated, denied, and unconfigured requests', async () => {
    expect((await handle(request({ csrf: CSRF }), { userValue: null })).status).toBe(401);

    const noEntitlement = await handle(request({ csrf: CSRF }), { accessValue: denied() });
    expect(noEntitlement.status).toBe(403);
    await expect(noEntitlement.json()).resolves.toEqual({ error: 'entitlement_denied', reason: 'blocked_no_entitlement' });

    const noDb = await handle(request({ csrf: CSRF }), { dbValue: null });
    expect(noDb.status).toBe(503);
    await expect(noDb.json()).resolves.toMatchObject({ error: 'not_configured', blockers: expect.arrayContaining(['database_not_configured']) });

    const noKey = await handle(request({ csrf: CSRF }), { envValue: env({ AXIOMA_HANDOFF_SIGNING_KEY: undefined }) });
    expect(noKey.status).toBe(503);
    await expect(noKey.json()).resolves.toMatchObject({ error: 'not_configured' });

    await linkAxiomaUser('axioma-invalid-key-user');
    const invalidKey = await handle(request({ csrf: CSRF }), { envValue: env({ AXIOMA_HANDOFF_SIGNING_KEY: 'not-a-pem' }) });
    expect(invalidKey.status).toBe(503);
    await expect(invalidKey.json()).resolves.toMatchObject({ error: 'not_configured', blockers: ['es256_key_invalid'] });

    const jtiRows = await db.select().from(schema.axiomaHandoffJtiRevocations);
    const auditRows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.account_link_init'));
    expect(jtiRows).toHaveLength(0);
    expect(auditRows).toHaveLength(0);
  });

  it('requires a linked Axioma account before signing or recording jti state', async () => {
    const res = await handle(request({ csrf: CSRF }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'account_link_required' });

    const jtiRows = await db.select().from(schema.axiomaHandoffJtiRevocations);
    const auditRows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.account_link_init'));
    expect(jtiRows).toHaveLength(0);
    expect(auditRows).toHaveLength(0);
  });

  it('issues a POST-body ES256 handoff for active linked users and records jti plus audit atomically', async () => {
    await linkAxiomaUser();

    const res = await handle(request({ csrf: CSRF }));

    expect(res.status).toBe(200);
    const body = await res.json() as { postUrl: string; token: string; expiresAt: string; method: string };
    expect(body).toMatchObject({ postUrl: 'https://axi-o.ma/wtc-handoff', method: 'POST' });
    expect(body.postUrl).not.toContain('?token=');
    expect(body.token).not.toContain('?token=');

    const verified = verifyEs256HandoffToken(body.token, PUBLIC_KEY_PEM, { audience: 'axioma-journal', now: NOW });
    expect(verified.valid).toBe(true);
    if (!verified.valid) throw new Error(verified.reason);
    expect(verified.claims.sub).toBe(user.id);
    expect(verified.claims.wtc_flow).toBe('open_journal');
    expect(verified.claims.wtc_entitlement).toMatchObject({
      product_code: 'axioma_terminal',
      state: 'active',
      expires_at: new Date(NOW + 600_000).toISOString(),
    });
    expect(verified.claims.wtc_axioma_user_id).toBe('axioma-user-123');
    expect(new Date(body.expiresAt).getTime()).toBe(verified.claims.exp * 1000);

    const rows = await db
      .select()
      .from(schema.axiomaHandoffJtiRevocations)
      .where(eq(schema.axiomaHandoffJtiRevocations.jti, verified.claims.jti));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sub).toBe(user.id);

    const auditRows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.targetId, verified.claims.jti));
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]!).toMatchObject({
      actorUserId: user.id,
      action: 'axioma.account_link_init',
      targetType: 'axioma_handoff_jti',
      result: 'success',
    });
    expect(JSON.stringify(auditRows[0]!.after)).not.toContain(body.token);
  });

  it('preserves grace entitlement snapshots using the grace window for linked users', async () => {
    await linkAxiomaUser('axioma-grace-user');

    const res = await handle(request({ csrf: CSRF }), {
      accessValue: access('grace', {
        currentPeriodEnd: NOW - 60_000,
        expiresAt: NOW - 30_000,
        graceUntil: NOW + 123_000,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string };
    const verified = verifyEs256HandoffToken(body.token, PUBLIC_KEY_PEM, { audience: 'axioma-journal', now: NOW });
    expect(verified.valid).toBe(true);
    if (!verified.valid) throw new Error(verified.reason);
    expect(verified.claims.wtc_entitlement).toMatchObject({
      product_code: 'axioma_terminal',
      state: 'grace',
      expires_at: new Date(NOW + 123_000).toISOString(),
    });
    expect(verified.claims.wtc_axioma_user_id).toBe('axioma-grace-user');
  });

  it('does not leave an orphan jti row when the in-transaction audit insert fails', async () => {
    const jti = randomUUID();
    await expect(
      issueHandoffJtiWithAudit(db, {
        jti,
        sub: user.id,
        issuedAt: new Date(NOW),
        expiresAt: new Date(NOW + 300_000),
        actorUserId: 'not-a-uuid',
        actorRole: 'user',
        purpose: 'open_journal',
        productCode: 'axioma_terminal',
        signerAlg: 'ES256',
      }, NOW),
    ).rejects.toThrow();

    const rows = await db
      .select()
      .from(schema.axiomaHandoffJtiRevocations)
      .where(eq(schema.axiomaHandoffJtiRevocations.jti, jti));
    expect(rows).toHaveLength(0);
  });
});
