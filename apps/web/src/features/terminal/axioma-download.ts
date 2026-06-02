import { verifyCsrf } from '@wtc/auth';
import {
  consumeTerminalDownloadTokenWithAudit,
  getCurrentTerminalRelease,
  getTerminalReleaseById,
  issueTerminalDownloadTokenWithAudit,
  type ConsumeTerminalDownloadTokenResult,
  type Db,
  type TerminalReleaseRow,
} from '@wtc/db';
import type { AccessDecision, AccessReason } from '@wtc/entitlements';
import { createHash, randomBytes } from 'node:crypto';
import { axiomaRouteReadiness } from './axioma-route-core';

type AxiomaDownloadEnv = {
  [key: string]: string | undefined;
  AXIOMA_ROUTE_SKELETON_ENABLED?: string;
  AXIOMA_BRIDGE_API_TOKEN?: string;
  AXIOMA_HANDOFF_SIGNING_KEY?: string;
  AXIOMA_HANDOFF_KEY_ID?: string;
  AXIOMA_JOURNAL_BASE_URL?: string;
};

export interface AxiomaDownloadUser {
  id: string;
  roles: string[];
}

export interface InstallerFetchInput {
  url: string;
  release: TerminalReleaseRow;
}

export interface AxiomaDownloadOptions {
  db: Db | null;
  env?: AxiomaDownloadEnv;
  now?: number;
  getCsrfToken: () => Promise<string | null>;
  requireUser: () => Promise<AxiomaDownloadUser>;
  accessFor: (userId: string, productCode: 'axioma_terminal') => Promise<AccessDecision>;
  reasonLabel: (reason: AccessReason) => string;
  issueToken?: typeof issueTerminalDownloadTokenWithAudit;
  consumeToken?: typeof consumeTerminalDownloadTokenWithAudit;
  generateToken?: () => string;
  hashToken?: (token: string) => string;
  fetchInstaller?: (input: InstallerFetchInput) => Promise<Response>;
  channel?: string;
  platform?: string;
  tokenTtlMs?: number;
}

const DEFAULT_TOKEN_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CHANNEL = 'stable';
const DEFAULT_PLATFORM = 'windows-x64';

function noStore(body: unknown, init: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) },
  });
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateDownloadToken(): string {
  return randomBytes(32).toString('base64url');
}

async function assertPostCsrf(req: Request, getCsrfToken: () => Promise<string | null>): Promise<boolean> {
  const expected = await getCsrfToken();
  const submitted = req.headers.get('x-csrf-token') ?? '';
  return !!expected && verifyCsrf(expected, submitted);
}

async function requireRequestUser(opts: AxiomaDownloadOptions): Promise<AxiomaDownloadUser | Response> {
  try {
    return await opts.requireUser();
  } catch {
    return noStore({ error: 'unauthenticated' }, { status: 401 });
  }
}

async function requireAccess(user: AxiomaDownloadUser, opts: AxiomaDownloadOptions): Promise<AccessDecision | Response> {
  const access = await opts.accessFor(user.id, 'axioma_terminal');
  if (!access.allowed) {
    return noStore({ error: 'entitlement_denied', reason: opts.reasonLabel(access.reason) }, { status: 403 });
  }
  return access;
}

function readinessResponse(db: Db | null, opts: AxiomaDownloadOptions): Response | null {
  const readiness = axiomaRouteReadiness({ dbAvailable: !!db, env: opts.env ?? process.env });
  if (!readiness.configured || !db) {
    return noStore({ error: 'not_configured', blockers: readiness.blockers }, { status: 503 });
  }
  return null;
}

function currentReleaseQuery(opts: AxiomaDownloadOptions): { channel: string; platform: string } {
  return {
    channel: opts.channel ?? DEFAULT_CHANNEL,
    platform: opts.platform ?? DEFAULT_PLATFORM,
  };
}

async function resolveCurrentRelease(db: Db, opts: AxiomaDownloadOptions): Promise<TerminalReleaseRow | Response> {
  const query = currentReleaseQuery(opts);
  let release = await getCurrentTerminalRelease(db, query.channel, query.platform);
  if (!release && query.channel === DEFAULT_CHANNEL) {
    release = await getCurrentTerminalRelease(db, 'beta', query.platform);
  }
  if (!release) {
    return noStore({ error: 'release_not_available' }, { status: 503 });
  }
  if (!resolveInstallerUrl(release)) {
    return noStore({ error: 'download_not_configured' }, { status: 503 });
  }
  return release;
}

function resolveInstallerUrl(release: TerminalReleaseRow): string | null {
  const template = release.downloadUrlTemplate?.trim();
  if (!template) return null;
  const raw = template
    .replaceAll('{version}', encodeURIComponent(release.version))
    .replaceAll('{platform}', encodeURIComponent(release.platform));
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function installerName(release: Pick<TerminalReleaseRow, 'version' | 'platform'>): string {
  const ext = release.platform === 'windows-x64' || release.platform === 'win32' ? '.exe' : '.zip';
  const platform = release.platform.replace('windows-x64', 'win').replace('darwin', 'mac');
  const safeVersion = release.version.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 60);
  const safePlatform = platform.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 40);
  return `axioma-setup-${safeVersion}-${safePlatform}${ext}`;
}

function requestIp(req: Request): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || undefined;
}

function requestUserAgent(req: Request): string | undefined {
  return req.headers.get('user-agent')?.slice(0, 500) || undefined;
}

function consumeFailureStatus(result: Extract<ConsumeTerminalDownloadTokenResult, { consumed: false }>): number {
  if (result.reason === 'wrong_user') return 403;
  if (result.reason === 'not_found') return 404;
  return 410;
}

function attachmentHeaders(release: TerminalReleaseRow, upstream: Response): Headers {
  const headers = new Headers();
  headers.set('cache-control', 'no-store, private');
  headers.set('content-disposition', `attachment; filename="${installerName(release)}"`);
  headers.set('content-type', 'application/octet-stream');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  const length = upstream.headers.get('content-length');
  if (length && /^\d+$/.test(length)) headers.set('content-length', length);
  if (release.checksumSha256) headers.set('x-axioma-sha256', release.checksumSha256);
  return headers;
}

async function issueDownloadToken(req: Request, opts: AxiomaDownloadOptions): Promise<Response> {
  if (!(await assertPostCsrf(req, opts.getCsrfToken))) {
    return noStore({ error: 'csrf_failed' }, { status: 403 });
  }
  const user = await requireRequestUser(opts);
  if (user instanceof Response) return user;
  const access = await requireAccess(user, opts);
  if (access instanceof Response) return access;

  const db = opts.db;
  const notReady = readinessResponse(db, opts);
  if (notReady) return notReady;
  if (!db) return noStore({ error: 'not_configured', blockers: ['database_not_configured'] }, { status: 503 });

  const release = await resolveCurrentRelease(db, opts);
  if (release instanceof Response) return release;

  const token = (opts.generateToken ?? generateDownloadToken)();
  const tokenHash = (opts.hashToken ?? sha256Hex)(token);
  const now = opts.now ?? Date.now();
  const expiresAt = new Date(now + (opts.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS));
  await (opts.issueToken ?? issueTerminalDownloadTokenWithAudit)(db, {
    userId: user.id,
    releaseId: release.id,
    version: release.version,
    platform: release.platform,
    tokenHash,
    expiresAt,
    ipAddress: requestIp(req),
    userAgent: requestUserAgent(req),
    entitlementVerified: true,
  }, now);

  const downloadUrl = new URL('/api/axioma/download/terminal', req.url);
  downloadUrl.searchParams.set('token', token);
  return noStore({
    downloadUrl: downloadUrl.toString(),
    expiresAt: expiresAt.toISOString(),
    method: 'GET',
    installerName: installerName(release),
    version: release.version,
    platform: release.platform,
    sha256: release.checksumSha256 ?? null,
  }, { status: 200 });
}

async function consumeDownloadToken(req: Request, opts: AxiomaDownloadOptions): Promise<Response> {
  const user = await requireRequestUser(opts);
  if (user instanceof Response) return user;
  const access = await requireAccess(user, opts);
  if (access instanceof Response) return access;

  const db = opts.db;
  const notReady = readinessResponse(db, opts);
  if (notReady) return notReady;
  if (!db) return noStore({ error: 'not_configured', blockers: ['database_not_configured'] }, { status: 503 });
  if (!opts.fetchInstaller) {
    return noStore({
      error: 'bridge_not_implemented',
      detail: 'Axioma download proxy is configured locally but has no installer stream provider in this runtime.',
    }, { status: 501 });
  }

  const token = new URL(req.url).searchParams.get('token')?.trim();
  if (!token) return noStore({ error: 'download_token_required' }, { status: 400 });

  const now = opts.now ?? Date.now();
  const tokenHash = (opts.hashToken ?? sha256Hex)(token);
  const consumed = await (opts.consumeToken ?? consumeTerminalDownloadTokenWithAudit)(db, {
    tokenHash,
    userId: user.id,
    ipAddress: requestIp(req),
    userAgent: requestUserAgent(req),
  }, now);
  if (!consumed.consumed) {
    return noStore({ error: consumed.reason }, { status: consumeFailureStatus(consumed) });
  }

  const release = await getTerminalReleaseById(db, consumed.row.releaseId);
  if (!release) return noStore({ error: 'release_not_available' }, { status: 503 });
  const installerUrl = resolveInstallerUrl(release);
  if (!installerUrl) return noStore({ error: 'download_not_configured' }, { status: 503 });

  const upstream = await opts.fetchInstaller({ url: installerUrl, release });
  if (!upstream.ok) {
    return noStore({ error: 'installer_unavailable' }, { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 });
  }
  return new Response(upstream.body ?? await upstream.arrayBuffer(), {
    status: 200,
    headers: attachmentHeaders(release, upstream),
  });
}

export async function handleAxiomaDownloadRequest(req: Request, opts: AxiomaDownloadOptions): Promise<Response> {
  if (req.method === 'POST') return issueDownloadToken(req, opts);
  if (req.method === 'GET') return consumeDownloadToken(req, opts);
  return noStore({ error: 'method_not_allowed', detail: 'Axioma download tokens are issued by POST and consumed by GET only.' }, { status: 405 });
}
