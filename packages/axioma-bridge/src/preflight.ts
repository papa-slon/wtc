import { generateKeyPairSync } from 'node:crypto';
import { buildHandoffClaims, HANDOFF_TTL_SECONDS } from './handoff.ts';
import { createEs256Signer, verifyEs256HandoffToken } from './es256.ts';
import { buildJwks } from './jwks.ts';

const DEFAULT_NOW_MS = 1_900_000_000_000;
const DEFAULT_AUDIENCE = 'axi-o.ma';
const DEFAULT_KEY_ID = 'wtc-axioma-preflight-generated';

export interface AxiomaHandoffPreflightFixture {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
  audience: string;
  nowMs: number;
}

export interface AxiomaHandoffPreflightSummary {
  version: 1;
  mode: 'dry-run';
  network: 'not-run';
  keyMaterial: 'generated-ephemeral-p256';
  signer: {
    alg: 'ES256';
    keyId: string;
    keyIdPresent: boolean;
  };
  jwks: {
    keyCount: number;
    hasPrivateScalar: boolean;
    algs: string[];
    curves: string[];
  };
  tokenShape: {
    segmentCount: number;
    ttlSeconds: number;
    flow: 'open_journal';
    productCode: 'axioma_terminal';
    entitlementState: 'active';
    linkedAccountClaimPresent: boolean;
    csrfBindingPresent: boolean;
    singleUseMarkerPresent: boolean;
  };
  verification: {
    signature: 'passed';
    wrongAudience: 'rejected';
    replay: 'rejected';
    expired: 'rejected';
  };
  result: 'pass';
}

export interface RunAxiomaHandoffPreflightOptions {
  fixture?: AxiomaHandoffPreflightFixture;
}

export function createAxiomaHandoffPreflightFixture(
  opts: { keyId?: string; audience?: string; nowMs?: number } = {},
): AxiomaHandoffPreflightFixture {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    keyId: opts.keyId ?? DEFAULT_KEY_ID,
    audience: opts.audience ?? DEFAULT_AUDIENCE,
    nowMs: opts.nowMs ?? DEFAULT_NOW_MS,
  };
}

function tokenHeader(token: string): { alg?: string; typ?: string; kid?: string } {
  const [header] = token.split('.');
  if (!header) throw new Error('[axioma-preflight] token header missing');
  return JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string; typ?: string; kid?: string };
}

export function runAxiomaHandoffPreflight(
  opts: RunAxiomaHandoffPreflightOptions = {},
): AxiomaHandoffPreflightSummary {
  const fixture = opts.fixture ?? createAxiomaHandoffPreflightFixture();
  const signer = createEs256Signer(fixture.privateKeyPem, fixture.keyId);
  const jwks = buildJwks([signer]);
  const claims = buildHandoffClaims(
    '00000000-0000-4000-8000-000000000341',
    'axioma_terminal',
    'open_journal',
    fixture.nowMs,
    fixture.audience,
    {
      entitlement: {
        product_code: 'axioma_terminal',
        state: 'active',
        expires_at: new Date(fixture.nowMs + 86_400_000).toISOString(),
      },
      axiomaUserId: 'axioma-preflight-linked-account',
    },
  );
  const token = signer.sign(claims);
  const header = tokenHeader(token);
  const ok = verifyEs256HandoffToken(token, fixture.publicKeyPem, {
    audience: fixture.audience,
    now: fixture.nowMs + 1000,
  });
  const wrongAudience = verifyEs256HandoffToken(token, fixture.publicKeyPem, {
    audience: 'https://invalid-audience.example',
    now: fixture.nowMs + 1000,
  });
  const replay = verifyEs256HandoffToken(token, fixture.publicKeyPem, {
    audience: fixture.audience,
    now: fixture.nowMs + 1000,
    isReplayed: (value) => value === claims.jti,
  });
  const expired = verifyEs256HandoffToken(token, fixture.publicKeyPem, {
    audience: fixture.audience,
    now: (claims.exp + 1) * 1000,
  });
  const key = jwks.keys[0] ?? {};
  const passed =
    header.alg === 'ES256' &&
    header.typ === 'JWT' &&
    header.kid === fixture.keyId &&
    ok.valid &&
    !wrongAudience.valid &&
    !replay.valid &&
    !expired.valid &&
    !('d' in key) &&
    key.alg === 'ES256' &&
    key.crv === 'P-256' &&
    token.split('.').length === 3;
  if (!passed) throw new Error('[axioma-preflight] generated ES256 handoff preflight failed');

  return {
    version: 1,
    mode: 'dry-run',
    network: 'not-run',
    keyMaterial: 'generated-ephemeral-p256',
    signer: {
      alg: 'ES256',
      keyId: fixture.keyId,
      keyIdPresent: true,
    },
    jwks: {
      keyCount: jwks.keys.length,
      hasPrivateScalar: 'd' in key,
      algs: [...new Set(jwks.keys.map((item) => String(item.alg ?? 'unknown')))],
      curves: [...new Set(jwks.keys.map((item) => String(item.crv ?? 'unknown')))],
    },
    tokenShape: {
      segmentCount: token.split('.').length,
      ttlSeconds: HANDOFF_TTL_SECONDS,
      flow: 'open_journal',
      productCode: 'axioma_terminal',
      entitlementState: 'active',
      linkedAccountClaimPresent: !!claims.wtc_axioma_user_id,
      csrfBindingPresent: claims.nonce.length > 0,
      singleUseMarkerPresent: claims.jti.length > 0,
    },
    verification: {
      signature: 'passed',
      wrongAudience: 'rejected',
      replay: 'rejected',
      expired: 'rejected',
    },
    result: 'pass',
  };
}
