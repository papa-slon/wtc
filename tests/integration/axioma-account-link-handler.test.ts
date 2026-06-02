import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createUser,
  issueAxiomaAccountLinkNonceWithAudit,
  seedDatabase,
  schema,
  type Db,
  type DbUser,
} from '@wtc/db';
import type { AccessDecision, AccessReason } from '@wtc/entitlements';
import {
  handleAxiomaAccountLinkCompleteRequest,
  handleAxiomaAccountLinkDeleteRequest,
  handleAxiomaAccountLinkInitRequest,
} from '../../apps/web/src/features/terminal/axioma-account-link.ts';

const CSRF = 'csrf-token-for-axioma-account-link';
const TOKEN = 'axioma-account-link-service-token';
const NOW = 1_900_000_000_000;
const RAW_CODE = 'raw-account-link-code-000000000000001';
const RAW_CODE_2 = 'raw-account-link-code-000000000000002';
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

let db: Db;
let user: DbUser;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

beforeEach(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  user = await createUser(db, {
    email: `axioma-account-link-${randomUUID()}@wtc.local`,
    passwordHash: 'h',
    displayName: 'Axioma Account Link',
  });
});

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    AXIOMA_ROUTE_SKELETON_ENABLED: 'true',
    AXIOMA_BRIDGE_API_TOKEN: TOKEN,
    AXIOMA_HANDOFF_SIGNING_KEY: PRIVATE_KEY_PEM,
    AXIOMA_HANDOFF_KEY_ID: 'kid-account-link-route',
    AXIOMA_JOURNAL_BASE_URL: 'https://axi-o.ma',
    ...overrides,
  };
}

function access(status: 'active' | 'grace' = 'active', userId = user.id): AccessDecision {
  return {
    allowed: true,
    reason: status === 'active' ? 'allowed' : 'grace',
    status,
    productCode: 'axioma_terminal',
    entitlement: {
      userId,
      productCode: 'axioma_terminal',
      status,
      source: 'manual_grant',
      currentPeriodEnd: NOW + 600_000,
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

function initRequest(method = 'POST', csrf?: string): Request {
  return new Request('https://wtc.local/api/axioma/account-link/init', {
    method,
    headers: csrf === undefined ? {} : { 'x-csrf-token': csrf, 'user-agent': 'vitest-account-link' },
  });
}

function completeRequest(
  body: unknown,
  opts: { method?: string; token?: string; query?: string } = {},
): Request {
  const method = opts.method ?? 'POST';
  return new Request(`https://wtc.local/api/axioma/account-link/complete${opts.query ?? ''}`, {
    method,
    headers: {
      authorization: `Bearer ${opts.token ?? TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'vitest-account-link-service',
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

function deleteRequest(method = 'DELETE', csrf?: string): Request {
  return new Request('https://wtc.local/api/axioma/account-link', {
    method,
    headers: csrf === undefined ? {} : { 'x-csrf-token': csrf, 'user-agent': 'vitest-account-unlink' },
  });
}

async function handleInit(
  req: Request,
  opts: {
    dbValue?: Db | null;
    userValue?: DbUser | null;
    accessValue?: AccessDecision;
    csrfValue?: string | null;
    envValue?: ReturnType<typeof env>;
    code?: string;
  } = {},
): Promise<Response> {
  return handleAxiomaAccountLinkInitRequest(req, {
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
    generateCode: () => opts.code ?? RAW_CODE,
  });
}

async function handleComplete(
  req: Request,
  opts: {
    dbValue?: Db | null;
    accessValue?: AccessDecision | ((userId: string) => AccessDecision);
    envValue?: ReturnType<typeof env>;
  } = {},
): Promise<Response> {
  return handleAxiomaAccountLinkCompleteRequest(req, {
    db: opts.dbValue === undefined ? db : opts.dbValue,
    env: opts.envValue ?? env(),
    now: NOW + 1_000,
    getCsrfToken: async () => null,
    requireUser: async () => {
      throw new Error('browser session is not used by service completion');
    },
    accessFor: async (userId) => typeof opts.accessValue === 'function'
      ? opts.accessValue(userId)
      : opts.accessValue ?? access('active', userId),
    reasonLabel: (reason) => reason,
  });
}

async function handleDelete(
  req: Request,
  opts: {
    dbValue?: Db | null;
    userValue?: DbUser | null;
    accessValue?: AccessDecision;
    csrfValue?: string | null;
  } = {},
): Promise<Response> {
  return handleAxiomaAccountLinkDeleteRequest(req, {
    db: opts.dbValue === undefined ? db : opts.dbValue,
    env: env(),
    now: NOW + 2_000,
    getCsrfToken: async () => opts.csrfValue ?? CSRF,
    requireUser: async () => {
      if (opts.userValue === null) throw new Error('unauthenticated');
      return opts.userValue ?? user;
    },
    accessFor: async () => opts.accessValue ?? access(),
    reasonLabel: (reason) => reason,
  });
}

async function accountLinkRows() {
  return db.select().from(schema.axiomaAccountLinks);
}

async function completeAudits() {
  return db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.account_link_complete'));
}

describe('Axioma account-link handlers', () => {
  it('is method-gated and checks CSRF before resolving browser users', async () => {
    const getInit = await handleInit(initRequest('GET'), { userValue: null, csrfValue: null });
    expect(getInit.status).toBe(405);
    expect(getInit.headers.get('cache-control')).toBe('no-store');

    let initUserCalled = false;
    const badInitCsrf = await handleAxiomaAccountLinkInitRequest(initRequest('POST', 'bad'), {
      db,
      env: env(),
      now: NOW,
      getCsrfToken: async () => CSRF,
      requireUser: async () => {
        initUserCalled = true;
        return user;
      },
      accessFor: async () => access(),
      reasonLabel: (reason) => reason,
    });
    expect(badInitCsrf.status).toBe(403);
    expect(initUserCalled).toBe(false);

    let deleteUserCalled = false;
    const badDeleteCsrf = await handleAxiomaAccountLinkDeleteRequest(deleteRequest('DELETE', 'bad'), {
      db,
      env: env(),
      now: NOW,
      getCsrfToken: async () => CSRF,
      requireUser: async () => {
        deleteUserCalled = true;
        return user;
      },
      accessFor: async () => access(),
      reasonLabel: (reason) => reason,
    });
    expect(badDeleteCsrf.status).toBe(403);
    expect(deleteUserCalled).toBe(false);
    expect(await accountLinkRows()).toHaveLength(0);
  });

  it('fails closed for init unauthenticated, denied, unconfigured, and already-linked requests', async () => {
    expect((await handleInit(initRequest('POST', CSRF), { userValue: null })).status).toBe(401);

    const noAccess = await handleInit(initRequest('POST', CSRF), { accessValue: denied('revoked') });
    expect(noAccess.status).toBe(403);
    await expect(noAccess.json()).resolves.toEqual({ error: 'entitlement_denied', reason: 'revoked' });

    const noDb = await handleInit(initRequest('POST', CSRF), { dbValue: null });
    expect(noDb.status).toBe(503);
    await expect(noDb.json()).resolves.toMatchObject({ error: 'not_configured' });

    await db.insert(schema.axiomaAccountLinks).values({
      userId: user.id,
      state: 'linked',
      axiomaUserId: 'axioma-already-linked',
      linkedAt: new Date(NOW - 1_000),
    });
    const alreadyLinked = await handleInit(initRequest('POST', CSRF));
    expect(alreadyLinked.status).toBe(409);
    await expect(alreadyLinked.json()).resolves.toEqual({ error: 'already_linked' });

    const rows = await accountLinkRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe('linked');
  });

  it('issues one-time codes as hash-only rows and revokes prior pending codes', async () => {
    const first = await handleInit(initRequest('POST', CSRF), { code: RAW_CODE });
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-store');
    const firstBody = await first.json() as { code: string; expiresAt: string; state: string; method: string };
    expect(firstBody).toEqual({
      code: RAW_CODE,
      expiresAt: new Date(NOW + 300_000).toISOString(),
      state: 'pending',
      method: 'manual_entry',
    });

    const second = await handleInit(initRequest('POST', CSRF), { code: RAW_CODE_2 });
    expect(second.status).toBe(200);
    const secondBody = await second.json() as { code: string };
    expect(secondBody.code).toBe(RAW_CODE_2);

    const rows = await accountLinkRows();
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.state === 'revoked' && row.linkNonceHash === hashCode(RAW_CODE))).toBe(true);
    const pending = rows.find((row) => row.state === 'pending');
    expect(pending?.oneTimeCode).toBeNull();
    expect(pending?.linkNonceHash).toBe(hashCode(RAW_CODE_2));

    const rowsJson = JSON.stringify(rows);
    expect(rowsJson).not.toContain(RAW_CODE);
    expect(rowsJson).not.toContain(RAW_CODE_2);

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.account_link_init'));
    expect(audits).toHaveLength(2);
    const auditsJson = JSON.stringify(audits);
    expect(auditsJson).not.toContain(RAW_CODE);
    expect(auditsJson).not.toContain(RAW_CODE_2);
    expect(auditsJson).not.toContain(hashCode(RAW_CODE_2));
  });

  it('service-authenticates completion and rejects query-string or malformed bodies before mutation', async () => {
    await handleInit(initRequest('POST', CSRF), { code: RAW_CODE });

    const missingAuth = new Request('https://wtc.local/api/axioma/account-link/complete', {
      method: 'POST',
      body: JSON.stringify({ code: RAW_CODE, axiomaUserId: 'axioma-user-1' }),
    });
    expect((await handleComplete(missingAuth)).status).toBe(401);
    expect((await handleComplete(completeRequest({ code: RAW_CODE, axiomaUserId: 'axioma-user-1' }, { token: 'wrong' }))).status).toBe(401);

    const queryToken = await handleComplete(completeRequest({ code: RAW_CODE, axiomaUserId: 'axioma-user-1' }, { query: '?token=raw' }));
    expect(queryToken.status).toBe(400);
    await expect(queryToken.json()).resolves.toEqual({ error: 'query_token_forbidden' });

    const badBody = await handleComplete(completeRequest({ code: 'short', axiomaUserId: 'axioma-user-1' }));
    expect(badBody.status).toBe(400);

    const rows = await accountLinkRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe('pending');
    expect(rows[0]!.consumedAt).toBeNull();
    expect(await completeAudits()).toHaveLength(0);
  });

  it('completes a code once with JSON-body service auth and never leaks raw code or hash', async () => {
    await handleInit(initRequest('POST', CSRF), { code: RAW_CODE });

    const res = await handleComplete(completeRequest({ code: RAW_CODE, axioma_user_id: 'axioma-user-linked' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toMatchObject({
      linked: true,
      state: 'linked',
      linkedAt: new Date(NOW + 1_000).toISOString(),
    });

    const rows = await accountLinkRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!).toMatchObject({
      state: 'linked',
      axiomaUserId: 'axioma-user-linked',
    });
    expect(rows[0]!.consumedAt?.getTime()).toBe(NOW + 1_000);

    const replay = await handleComplete(completeRequest({ code: RAW_CODE, axiomaUserId: 'axioma-user-linked' }));
    expect(replay.status).toBe(410);
    await expect(replay.json()).resolves.toEqual({ linked: false, error: 'already_consumed' });

    const audits = await completeAudits();
    expect(audits).toHaveLength(2);
    expect(audits.some((row) => row.result === 'success')).toBe(true);
    expect(audits.some((row) => row.result === 'failure' && JSON.stringify(row.after).includes('already_consumed'))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(RAW_CODE);
    expect(JSON.stringify(audits)).not.toContain(RAW_CODE);
    expect(JSON.stringify(audits)).not.toContain(hashCode(RAW_CODE));
  });

  it('re-checks the pending row owner entitlement before consuming a service completion', async () => {
    await handleInit(initRequest('POST', CSRF), { code: RAW_CODE });
    const seenUserIds: string[] = [];

    const res = await handleComplete(completeRequest({ code: RAW_CODE, axiomaUserId: 'axioma-user-denied' }), {
      accessValue: (userId) => {
        seenUserIds.push(userId);
        return denied('revoked');
      },
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ linked: false, error: 'entitlement_denied', reason: 'revoked' });
    expect(seenUserIds).toEqual([user.id]);

    const rows = await accountLinkRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.state).toBe('pending');
    expect(rows[0]!.consumedAt).toBeNull();

    const audits = await completeAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]!).toMatchObject({ result: 'failure', after: { reason: 'entitlement_denied' } });
    expect(JSON.stringify(audits)).not.toContain(RAW_CODE);
    expect(JSON.stringify(audits)).not.toContain(hashCode(RAW_CODE));
  });

  it('maps expired, revoked, and duplicate active-link completion failures deterministically', async () => {
    const expiredHash = hashCode('raw-account-link-code-expired-000000');
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: expiredHash,
      codeExpiresAt: new Date(NOW - 1_000),
      entitlementVerified: true,
    }, NOW);
    const expired = await handleComplete(completeRequest({
      code: 'raw-account-link-code-expired-000000',
      axiomaUserId: 'axioma-expired',
    }));
    expect(expired.status).toBe(410);
    await expect(expired.json()).resolves.toEqual({ linked: false, error: 'expired' });

    const revokedCode = 'raw-account-link-code-revoked-000000';
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: hashCode(revokedCode),
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW);
    await handleDelete(deleteRequest('DELETE', CSRF));
    const revoked = await handleComplete(completeRequest({ code: revokedCode, axiomaUserId: 'axioma-revoked' }));
    expect(revoked.status).toBe(410);
    await expect(revoked.json()).resolves.toEqual({ linked: false, error: 'revoked' });

    const other = await createUser(db, {
      email: `axioma-account-link-other-${randomUUID()}@wtc.local`,
      passwordHash: 'h',
      displayName: 'Other Axioma Account',
    });
    await db.insert(schema.axiomaAccountLinks).values({
      userId: other.id,
      state: 'linked',
      axiomaUserId: 'axioma-duplicate-user',
      linkedAt: new Date(NOW - 10_000),
    });

    const duplicateCode = 'raw-account-link-code-duplicate-0000';
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: hashCode(duplicateCode),
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW);
    const duplicate = await handleComplete(completeRequest({
      code: duplicateCode,
      axiomaUserId: 'axioma-duplicate-user',
    }));
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toEqual({ linked: false, error: 'axioma_user_already_linked' });
  });

  it('revokes pending and linked rows through DELETE and audits empty-repeat failures', async () => {
    await issueAxiomaAccountLinkNonceWithAudit(db, {
      userId: user.id,
      linkNonceHash: hashCode(RAW_CODE),
      codeExpiresAt: new Date(NOW + 300_000),
      entitlementVerified: true,
    }, NOW);
    await db.insert(schema.axiomaAccountLinks).values({
      userId: user.id,
      state: 'linked',
      axiomaUserId: 'axioma-user-to-unlink',
      linkedAt: new Date(NOW - 1_000),
    });

    const deniedUnlink = await handleDelete(deleteRequest('DELETE', CSRF), { accessValue: denied() });
    expect(deniedUnlink.status).toBe(403);
    expect((await accountLinkRows()).filter((row) => row.state === 'revoked')).toHaveLength(0);

    const res = await handleDelete(deleteRequest('DELETE', CSRF));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ revoked: true, revokedCount: 2 });

    const rows = await accountLinkRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.state === 'revoked' && row.revokedAt)).toBe(true);

    const repeat = await handleDelete(deleteRequest('DELETE', CSRF));
    expect(repeat.status).toBe(404);
    await expect(repeat.json()).resolves.toEqual({ revoked: false, error: 'not_linked' });

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.account_link_revoke'));
    expect(audits).toHaveLength(2);
    expect(audits.some((row) => row.result === 'success' && JSON.stringify(row.after).includes('"revokedCount":2'))).toBe(true);
    expect(audits.some((row) => row.result === 'failure' && JSON.stringify(row.after).includes('"revokedCount":0'))).toBe(true);
    expect(JSON.stringify(audits)).not.toContain(RAW_CODE);
    expect(JSON.stringify(audits)).not.toContain(hashCode(RAW_CODE));
  });
});
