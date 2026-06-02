import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createUser,
  seedDatabase,
  schema,
  upsertTerminalRelease,
  type Db,
  type DbUser,
  type TerminalReleaseRow,
} from '@wtc/db';
import type { AccessDecision, AccessReason } from '@wtc/entitlements';
import { handleAxiomaDownloadRequest } from '../../apps/web/src/features/terminal/axioma-download.ts';

const CSRF = 'csrf-token-for-axioma-download';
const NOW = 1_900_000_000_000;
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

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
    email: `axioma-download-${randomUUID()}@wtc.local`,
    passwordHash: 'h',
    displayName: 'Axioma Download',
  });
  vi.unstubAllGlobals();
});

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    AXIOMA_ROUTE_SKELETON_ENABLED: 'true',
    AXIOMA_BRIDGE_API_TOKEN: 'axioma-bridge-token',
    AXIOMA_HANDOFF_SIGNING_KEY: PRIVATE_KEY_PEM,
    AXIOMA_HANDOFF_KEY_ID: 'kid-download-route',
    AXIOMA_JOURNAL_BASE_URL: 'https://axi-o.ma',
    ...overrides,
  };
}

function request(method: 'GET' | 'POST', opts: { csrf?: string; token?: string } = {}): Request {
  const url = new URL(method === 'GET'
    ? 'https://wtc.local/api/axioma/download/terminal'
    : 'https://wtc.local/api/axioma/download');
  if (opts.token) url.searchParams.set('token', opts.token);
  return new Request(url, {
    method,
    headers: opts.csrf === undefined ? {} : { 'x-csrf-token': opts.csrf },
  });
}

function access(status: 'active' | 'grace' = 'active'): AccessDecision {
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

async function addRelease(overrides: Partial<Parameters<typeof upsertTerminalRelease>[1]> = {}): Promise<TerminalReleaseRow> {
  return upsertTerminalRelease(db, {
    version: '1.2.3',
    channel: 'stable',
    platform: 'windows-x64',
    publishedAt: new Date(NOW - 60_000),
    downloadUrlTemplate: 'https://axioma-fixture.local/releases/{version}/{platform}/installer.exe',
    checksumSha256: 'b'.repeat(64),
    isCurrent: true,
    actorUserId: user.id,
    ...overrides,
  });
}

async function handle(
  req: Request,
  opts: {
    dbValue?: Db | null;
    envValue?: ReturnType<typeof env>;
    userValue?: DbUser | null;
    accessValue?: AccessDecision;
    csrfValue?: string | null;
    token?: string;
    fetchInstaller?: (input: { url: string; release: TerminalReleaseRow }) => Promise<Response>;
  } = {},
): Promise<Response> {
  return handleAxiomaDownloadRequest(req, {
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
    generateToken: () => opts.token ?? 'fixed-download-token',
    fetchInstaller: opts.fetchInstaller,
  });
}

async function downloadRows() {
  return db.select().from(schema.terminalDownloadEvents);
}

describe('Axioma download handler', () => {
  it('checks CSRF before resolving the user on token issue', async () => {
    let userCalled = false;
    const res = await handleAxiomaDownloadRequest(request('POST', { csrf: 'bad' }), {
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

    expect(res.status).toBe(403);
    expect(userCalled).toBe(false);
    expect(await downloadRows()).toHaveLength(0);
  });

  it('fails closed for unauthenticated, denied, unconfigured, and missing release/template requests', async () => {
    expect((await handle(request('POST', { csrf: CSRF }), { userValue: null })).status).toBe(401);

    const noEntitlement = await handle(request('POST', { csrf: CSRF }), { accessValue: denied() });
    expect(noEntitlement.status).toBe(403);
    await expect(noEntitlement.json()).resolves.toEqual({ error: 'entitlement_denied', reason: 'blocked_no_entitlement' });

    const noDb = await handle(request('POST', { csrf: CSRF }), { dbValue: null });
    expect(noDb.status).toBe(503);
    await expect(noDb.json()).resolves.toMatchObject({ error: 'not_configured' });

    const noRelease = await handle(request('POST', { csrf: CSRF }));
    expect(noRelease.status).toBe(503);
    await expect(noRelease.json()).resolves.toEqual({ error: 'release_not_available' });

    await addRelease({ downloadUrlTemplate: undefined });
    const noTemplate = await handle(request('POST', { csrf: CSRF }));
    expect(noTemplate.status).toBe(503);
    await expect(noTemplate.json()).resolves.toEqual({ error: 'download_not_configured' });

    expect(await downloadRows()).toHaveLength(0);
  });

  it('issues a hash-only one-time download token without exposing raw token in audit or DB rows', async () => {
    await addRelease();

    const res = await handle(request('POST', { csrf: CSRF }), { token: 'raw-token-visible-once' });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json() as { downloadUrl: string; expiresAt: string; method: string; installerName: string; sha256: string };
    expect(body).toMatchObject({
      method: 'GET',
      installerName: 'axioma-setup-1.2.3-win.exe',
      sha256: 'b'.repeat(64),
    });
    expect(body.downloadUrl).toContain('/api/axioma/download/terminal?token=raw-token-visible-once');
    expect(new Date(body.expiresAt).getTime()).toBe(NOW + 300_000);

    const rows = await downloadRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rows)).not.toContain('raw-token-visible-once');

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'axioma.download_request'));
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain('raw-token-visible-once');
    expect(JSON.stringify(audits)).not.toContain(rows[0]!.tokenHash!);
  });

  it('streams fixture installer bytes once with strict response headers and records terminal.download audit', async () => {
    await addRelease();
    const issue = await handle(request('POST', { csrf: CSRF }), { token: 'download-once' });
    const issued = await issue.json() as { downloadUrl: string };
    const token = new URL(issued.downloadUrl).searchParams.get('token')!;
    const liveFetch = vi.fn(() => { throw new Error('live fetch forbidden'); });
    vi.stubGlobal('fetch', liveFetch);
    const fixtureBytes = new Uint8Array([1, 2, 3, 4]);
    const fetchInstaller = vi.fn(async ({ url }: { url: string; release: TerminalReleaseRow }) => {
      expect(url).toBe('https://axioma-fixture.local/releases/1.2.3/windows-x64/installer.exe');
      return new Response(fixtureBytes, {
        status: 200,
        headers: {
          'content-type': 'application/x-msdownload',
          'content-length': String(fixtureBytes.byteLength),
          'set-cookie': 'axioma_session=secret',
          location: 'https://internal.local/secret',
        },
      });
    });

    const res = await handle(request('GET', { token }), { fetchInstaller });

    expect(res.status).toBe(200);
    expect(fetchInstaller).toHaveBeenCalledTimes(1);
    expect(liveFetch).not.toHaveBeenCalled();
    expect(res.headers.get('cache-control')).toBe('no-store, private');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="axioma-setup-1.2.3-win.exe"');
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(Array.from(fixtureBytes));

    const rows = await downloadRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.consumedAt?.getTime()).toBe(NOW);

    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, 'terminal.download'));
    expect(audits).toHaveLength(1);
    expect(audits[0]!.result).toBe('success');

    const replay = await handle(request('GET', { token }), { fetchInstaller });
    expect(replay.status).toBe(410);
    await expect(replay.json()).resolves.toEqual({ error: 'already_consumed' });
    expect(fetchInstaller).toHaveBeenCalledTimes(1);
  });

  it('does not consume a valid token when current entitlement is denied', async () => {
    await addRelease();
    const issue = await handle(request('POST', { csrf: CSRF }), { token: 'denied-download-token' });
    const issued = await issue.json() as { downloadUrl: string };
    const token = new URL(issued.downloadUrl).searchParams.get('token')!;

    const res = await handle(request('GET', { token }), {
      accessValue: denied('revoked'),
      fetchInstaller: async () => new Response('nope'),
    });

    expect(res.status).toBe(403);
    const rows = await downloadRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.consumedAt).toBeNull();
  });
});
