import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { verifyCsrf } from '@wtc/auth';
import {
  consumeAxiomaAccountLinkNonceWithAudit,
  getAxiomaAccountLinkByNonceHash,
  getLinkedAxiomaAccountForUser,
  issueAxiomaAccountLinkNonceWithAudit,
  recordAxiomaAccountLinkCompleteFailureWithAudit,
  revokeAxiomaAccountLinksForUserWithAudit,
  type AxiomaAccountLinkRow,
  type ConsumeAxiomaAccountLinkNonceReason,
  type Db,
} from '@wtc/db';
import type { AccessDecision, AccessReason } from '@wtc/entitlements';
import { z } from 'zod';
import { axiomaRouteReadiness } from './axioma-route-core';

type AxiomaAccountLinkEnv = {
  [key: string]: string | undefined;
  AXIOMA_ROUTE_SKELETON_ENABLED?: string;
  AXIOMA_BRIDGE_API_TOKEN?: string;
  AXIOMA_HANDOFF_SIGNING_KEY?: string;
  AXIOMA_HANDOFF_KEY_ID?: string;
  AXIOMA_JOURNAL_BASE_URL?: string;
};

export interface AxiomaAccountLinkUser {
  id: string;
  roles: string[];
}

export interface AxiomaAccountLinkOptions {
  db: Db | null;
  env?: AxiomaAccountLinkEnv;
  now?: number;
  getCsrfToken: () => Promise<string | null>;
  requireUser: () => Promise<AxiomaAccountLinkUser>;
  accessFor: (userId: string, productCode: 'axioma_terminal') => Promise<AccessDecision>;
  reasonLabel: (reason: AccessReason) => string;
  generateCode?: () => string;
  hashCode?: (code: string) => string;
  issueNonce?: typeof issueAxiomaAccountLinkNonceWithAudit;
  getLinkByNonceHash?: typeof getAxiomaAccountLinkByNonceHash;
  getLinkedAccount?: typeof getLinkedAxiomaAccountForUser;
  recordCompleteFailure?: typeof recordAxiomaAccountLinkCompleteFailureWithAudit;
  consumeNonce?: typeof consumeAxiomaAccountLinkNonceWithAudit;
  revokeLinks?: typeof revokeAxiomaAccountLinksForUserWithAudit;
  tokenTtlMs?: number;
}

const DEFAULT_TOKEN_TTL_MS = 5 * 60 * 1000;

const completeBodySchema = z.object({
  code: z.string().min(32).max(256),
  axiomaUserId: z.string().trim().min(1).max(256).optional(),
  axioma_user_id: z.string().trim().min(1).max(256).optional(),
}).strict()
  .refine((body) => !!(body.axiomaUserId ?? body.axioma_user_id), { message: 'axiomaUserId required' })
  .transform((body) => ({ code: body.code, axiomaUserId: body.axiomaUserId ?? body.axioma_user_id! }));

function noStore(body: unknown, init: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) },
  });
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateAccountLinkCode(): string {
  return randomBytes(32).toString('base64url');
}

async function assertPostCsrf(req: Request, getCsrfToken: () => Promise<string | null>): Promise<boolean> {
  const expected = await getCsrfToken();
  const submitted = req.headers.get('x-csrf-token') ?? '';
  return !!expected && verifyCsrf(expected, submitted);
}

async function requireRequestUser(opts: AxiomaAccountLinkOptions): Promise<AxiomaAccountLinkUser | Response> {
  try {
    return await opts.requireUser();
  } catch {
    return noStore({ error: 'unauthenticated' }, { status: 401 });
  }
}

async function requireAccess(user: AxiomaAccountLinkUser, opts: AxiomaAccountLinkOptions): Promise<AccessDecision | Response> {
  const access = await opts.accessFor(user.id, 'axioma_terminal');
  if (!access.allowed) {
    return noStore({ error: 'entitlement_denied', reason: opts.reasonLabel(access.reason) }, { status: 403 });
  }
  return access;
}

function readinessResponse(db: Db | null, opts: AxiomaAccountLinkOptions): Response | null {
  const readiness = axiomaRouteReadiness({ dbAvailable: !!db, env: opts.env ?? process.env });
  if (!readiness.configured || !db) {
    return noStore({ error: 'not_configured', blockers: readiness.blockers }, { status: 503 });
  }
  return null;
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

function serviceAuthResponse(req: Request, opts: AxiomaAccountLinkOptions): Response | null {
  const token = (opts.env ?? process.env).AXIOMA_BRIDGE_API_TOKEN?.trim();
  if (!token) return noStore({ error: 'not_configured' }, { status: 503 });
  const submitted = bearerToken(req);
  if (!submitted || !secureEqual(submitted, token)) {
    return noStore({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

function failureStatus(reason: ConsumeAxiomaAccountLinkNonceReason): number {
  if (reason === 'not_found') return 404;
  if (reason === 'expired' || reason === 'revoked' || reason === 'already_consumed') return 410;
  if (reason === 'invalid_axioma_user_id') return 400;
  return 409;
}

function requestIp(req: Request): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || undefined;
}

function requestUserAgent(req: Request): string | undefined {
  return req.headers.get('user-agent')?.slice(0, 500) || undefined;
}

function isConsumableCandidate(row: AxiomaAccountLinkRow, now: number): boolean {
  return row.state === 'pending'
    && !row.consumedAt
    && !row.revokedAt
    && !!row.codeExpiresAt
    && row.codeExpiresAt.getTime() > now;
}

export async function handleAxiomaAccountLinkInitRequest(
  req: Request,
  opts: AxiomaAccountLinkOptions,
): Promise<Response> {
  if (req.method !== 'POST') {
    return noStore({ error: 'method_not_allowed', detail: 'Axioma account-link init is POST only.' }, { status: 405 });
  }
  if (!(await assertPostCsrf(req, opts.getCsrfToken))) {
    return noStore({ error: 'csrf_failed' }, { status: 403 });
  }
  const user = await requireRequestUser(opts);
  if (user instanceof Response) return user;
  const access = await requireAccess(user, opts);
  if (access instanceof Response) return access;
  const db = opts.db;
  const readiness = readinessResponse(db, opts);
  if (readiness) return readiness;

  const linked = await (opts.getLinkedAccount ?? getLinkedAxiomaAccountForUser)(db!, user.id);
  if (linked) {
    return noStore({ error: 'already_linked' }, { status: 409 });
  }

  const now = opts.now ?? Date.now();
  const code = (opts.generateCode ?? generateAccountLinkCode)();
  const hash = (opts.hashCode ?? sha256Hex)(code);
  const expiresAt = new Date(now + (opts.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS));
  const row = await (opts.issueNonce ?? issueAxiomaAccountLinkNonceWithAudit)(db!, {
    userId: user.id,
    linkNonceHash: hash,
    codeExpiresAt: expiresAt,
    entitlementVerified: access.allowed,
    ipAddress: requestIp(req),
    userAgent: requestUserAgent(req),
  }, now);

  return noStore({
    code,
    expiresAt: expiresAt.toISOString(),
    state: row.state,
    method: 'manual_entry',
  }, { status: 200 });
}

export async function handleAxiomaAccountLinkCompleteRequest(
  req: Request,
  opts: AxiomaAccountLinkOptions,
): Promise<Response> {
  if (req.method !== 'POST') {
    return noStore({ error: 'method_not_allowed', detail: 'Axioma account-link complete is POST only.' }, { status: 405 });
  }
  if (new URL(req.url).search) {
    return noStore({ error: 'query_token_forbidden' }, { status: 400 });
  }
  const auth = serviceAuthResponse(req, opts);
  if (auth) return auth;

  const db = opts.db;
  const readiness = readinessResponse(db, opts);
  if (readiness) return readiness;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return noStore({ error: 'bad_request' }, { status: 400 });
  }
  const parsed = completeBodySchema.safeParse(body);
  if (!parsed.success) {
    return noStore({ error: 'bad_request' }, { status: 400 });
  }

  const now = opts.now ?? Date.now();
  const linkNonceHash = (opts.hashCode ?? sha256Hex)(parsed.data.code);
  const pending = await (opts.getLinkByNonceHash ?? getAxiomaAccountLinkByNonceHash)(db!, linkNonceHash);
  if (pending && isConsumableCandidate(pending, now)) {
    const access = await opts.accessFor(pending.userId, 'axioma_terminal');
    if (!access.allowed) {
      await (opts.recordCompleteFailure ?? recordAxiomaAccountLinkCompleteFailureWithAudit)(db!, {
        row: pending,
        reason: 'entitlement_denied',
        ipAddress: requestIp(req),
        userAgent: requestUserAgent(req),
      }, now);
      return noStore({ linked: false, error: 'entitlement_denied', reason: opts.reasonLabel(access.reason) }, { status: 403 });
    }
  }

  const result = await (opts.consumeNonce ?? consumeAxiomaAccountLinkNonceWithAudit)(db!, {
    linkNonceHash,
    axiomaUserId: parsed.data.axiomaUserId,
    ipAddress: requestIp(req),
    userAgent: requestUserAgent(req),
  }, now);

  if (!result.consumed) {
    return noStore({ linked: false, error: result.reason }, { status: failureStatus(result.reason) });
  }

  return noStore({
    linked: true,
    state: result.row.state,
    linkedAt: result.row.linkedAt?.toISOString() ?? null,
  }, { status: 200 });
}

export async function handleAxiomaAccountLinkDeleteRequest(
  req: Request,
  opts: AxiomaAccountLinkOptions,
): Promise<Response> {
  if (req.method !== 'DELETE') {
    return noStore({ error: 'method_not_allowed', detail: 'Axioma account unlink is DELETE only.' }, { status: 405 });
  }
  if (!(await assertPostCsrf(req, opts.getCsrfToken))) {
    return noStore({ error: 'csrf_failed' }, { status: 403 });
  }
  const user = await requireRequestUser(opts);
  if (user instanceof Response) return user;
  const access = await requireAccess(user, opts);
  if (access instanceof Response) return access;
  const db = opts.db;
  const readiness = readinessResponse(db, opts);
  if (readiness) return readiness;

  const result = await (opts.revokeLinks ?? revokeAxiomaAccountLinksForUserWithAudit)(db!, {
    userId: user.id,
    actorRole: user.roles[0] ?? 'user',
    reason: 'user_request',
    ipAddress: requestIp(req),
    userAgent: requestUserAgent(req),
  }, opts.now ?? Date.now());
  if (result.revokedCount === 0) {
    return noStore({ revoked: false, error: 'not_linked' }, { status: 404 });
  }
  return noStore({ revoked: true, revokedCount: result.revokedCount }, { status: 200 });
}
