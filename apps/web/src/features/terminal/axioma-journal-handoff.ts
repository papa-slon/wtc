import { verifyCsrf } from '@wtc/auth';
import {
  getLinkedAxiomaAccountForUser,
  issueHandoffJtiWithAudit,
  type Db,
} from '@wtc/db';
import type { AccessDecision, AccessReason } from '@wtc/entitlements';
import type { HandoffEntitlementSnapshot } from '@wtc/axioma-bridge';
import { axiomaRouteReadiness, buildAxiomaHandoff } from './axioma-route-core';

type AxiomaJournalEnv = {
  [key: string]: string | undefined;
  APP_ENV?: string;
  AXIOMA_ROUTE_SKELETON_ENABLED?: string;
  AXIOMA_BRIDGE_API_TOKEN?: string;
  AXIOMA_HANDOFF_SIGNING_KEY?: string;
  AXIOMA_HANDOFF_KEY_ID?: string;
  AXIOMA_HANDOFF_AUDIENCE?: string;
  AXIOMA_JOURNAL_BASE_URL?: string;
};

export interface AxiomaJournalUser {
  id: string;
  roles: string[];
}

export interface AxiomaJournalHandoffOptions {
  db: Db | null;
  env?: AxiomaJournalEnv;
  now?: number;
  getCsrfToken: () => Promise<string | null>;
  requireUser: () => Promise<AxiomaJournalUser>;
  accessFor: (userId: string, productCode: 'axioma_terminal') => Promise<AccessDecision>;
  reasonLabel: (reason: AccessReason) => string;
  issueHandoffJti?: typeof issueHandoffJtiWithAudit;
}

function noStore(body: unknown, init: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) },
  });
}

function buildHandoffEntitlementSnapshot(access: AccessDecision): HandoffEntitlementSnapshot {
  const entitlement = access.entitlement;
  const activeEnds = [entitlement?.currentPeriodEnd, entitlement?.expiresAt]
    .filter((value): value is number => typeof value === 'number');
  const expiresAtValue = access.status === 'grace' && typeof entitlement?.graceUntil === 'number'
    ? entitlement.graceUntil
    : activeEnds.length > 0
      ? Math.min(...activeEnds)
      : null;
  const expiresAt = expiresAtValue === null ? null : new Date(expiresAtValue).toISOString();
  return {
    product_code: 'axioma_terminal',
    state: access.status === 'pending_payment' ? 'none' : access.status,
    expires_at: expiresAt,
  };
}

async function assertPostCsrf(req: Request, getCsrfToken: () => Promise<string | null>): Promise<boolean> {
  const expected = await getCsrfToken();
  const submitted = req.headers.get('x-csrf-token') ?? '';
  return !!expected && verifyCsrf(expected, submitted);
}

export async function handleAxiomaJournalHandoffRequest(
  req: Request,
  opts: AxiomaJournalHandoffOptions,
): Promise<Response> {
  if (req.method !== 'POST') {
    return noStore({ error: 'method_not_allowed', detail: 'Axioma handoff tokens are issued by POST only.' }, { status: 405 });
  }

  if (!(await assertPostCsrf(req, opts.getCsrfToken))) {
    return noStore({ error: 'csrf_failed' }, { status: 403 });
  }

  let user: AxiomaJournalUser;
  try {
    user = await opts.requireUser();
  } catch {
    return noStore({ error: 'unauthenticated' }, { status: 401 });
  }

  const access = await opts.accessFor(user.id, 'axioma_terminal');
  if (!access.allowed) {
    return noStore({ error: 'entitlement_denied', reason: opts.reasonLabel(access.reason) }, { status: 403 });
  }

  const env = opts.env ?? process.env;
  const db = opts.db;
  const readiness = axiomaRouteReadiness({ dbAvailable: !!db, env });
  if (!readiness.configured || !db) {
    return noStore({ error: 'not_configured', blockers: readiness.blockers }, { status: 503 });
  }

  try {
    const axiomaLink = await getLinkedAxiomaAccountForUser(db, user.id);
    const axiomaUserId = axiomaLink?.axiomaUserId?.trim();
    if (!axiomaUserId) {
      return noStore({ error: 'account_link_required' }, { status: 409 });
    }
    const handoff = buildAxiomaHandoff({
      userId: user.id,
      purpose: 'open_journal',
      env,
      now: opts.now,
      entitlement: buildHandoffEntitlementSnapshot(access),
      axiomaUserId,
    });
    await (opts.issueHandoffJti ?? issueHandoffJtiWithAudit)(db, {
      jti: handoff.jti,
      sub: user.id,
      issuedAt: handoff.issuedAt,
      expiresAt: handoff.expiresAt,
      actorUserId: user.id,
      actorRole: user.roles[0] ?? 'user',
      purpose: 'open_journal',
      productCode: 'axioma_terminal',
      signerAlg: handoff.signerAlg,
    }, opts.now);
    return noStore(
      {
        postUrl: handoff.postUrl,
        token: handoff.token,
        expiresAt: handoff.expiresAt.toISOString(),
        method: 'POST',
      },
      { status: 200 },
    );
  } catch {
    return noStore({ error: 'not_configured' }, { status: 503 });
  }
}
