/**
 * Axioma bridge — WTC-side product experience over the Axioma journal_server (:8123 / axi-o.ma).
 * See docs/CONTRACTS/axioma-bridge.md. WTC owns the product surface (license/release/download/
 * journal/account-link/support); it never copies the Axioma runtime and never executes orders.
 */
import { buildHandoffClaims, HANDOFF_TTL_MS } from './handoff.ts';
import { resolveHandoffSigner, type HandoffSigner } from './signer.ts';

/**
 * LicenseStatus values.
 * 'active'   — valid, entitled
 * 'grace'    — grace period (warn tone)
 * 'inactive' — plan exists but not currently active
 * 'expired'  — was active, now past valid-until
 * 'revoked'  — admin revoke or chargeback (bad tone, same as expired)
 * 'unknown'  — bridge returned an unrecognised state (fail-closed; treat as not entitled)
 * 'none'     — no entitlement found
 *
 * Tone mapping for UI:
 *   active  → ok
 *   grace   → warn
 *   inactive / expired / revoked / unknown → bad
 *   none    → neutral
 */
export type LicenseStatus = 'active' | 'grace' | 'inactive' | 'expired' | 'revoked' | 'unknown' | 'none';
export type AccountLinkState = 'linked' | 'pending' | 'not_linked';

export interface TerminalRelease {
  version: string;
  channel: 'stable' | 'beta';
  publishedAt: number;
  minSupportedVersion: string;
  notes: string[];
}

export interface AxiomaProductState {
  license: { status: LicenseStatus; planCode?: string; validUntil: number | null };
  accountLink: { state: AccountLinkState; axiomaUserId?: string };
  release: TerminalRelease;
  download: { eligible: boolean; requiresAuth: true; url?: string };
  journal: { reachable: boolean };
  support: { faqUrl: string; contactUrl: string };
}

export interface AxiomaBridge {
  getProductState(userId: string, hasEntitlement: boolean): Promise<AxiomaProductState>;
  /** create a short-lived POST-body handoff to open the Axioma journal (gates server features only) */
  createJournalHandoff(userId: string, hasEntitlement: boolean): Promise<{ postUrl: string; token: string; expiresAt: number; method: 'POST' }>;
  /** begin device/account link: a one-time code Axioma exchanges server-side; WTC stores only link state */
  beginAccountLink(userId: string): Promise<{ code: string; expiresAt: number }>;
}

/**
 * Options for the real bridge factory. The signer is RESOLVED + INJECTED by the web/server layer
 * (resolveHandoffSigner in signer.ts, fed from @wtc/config) so this package stays env-free and pure.
 * `recordJti`, when provided, persists the issued token's jti to the durable replay store (PG6) at
 * issuance — so a later server-side consume (the B4 route) can detect replay. Optional: pure-signing
 * tests omit it. WTC NEVER consumes the jti here; consumption is server-side (Axioma / the B4 route).
 */
export interface AxiomaBridgeOptions {
  baseUrl: string;
  signer: HandoffSigner;
  audience: string;
  now?: () => number;
  recordJti?: (jti: string, sub: string, issuedAt: number, expiresAt: number) => Promise<void>;
}

export interface MockBridgeOptions {
  baseUrl: string;
  signingSecret: string;
  audience: string;
  now?: () => number;
}

const SAMPLE_RELEASE: TerminalRelease = {
  version: '0.1.0',
  channel: 'beta',
  publishedAt: Date.parse('2026-05-20T00:00:00Z'),
  minSupportedVersion: '0.1.0',
  notes: [
    'Lightweight Charts v5 upgrade',
    'Local exchange keys encrypted with OS safeStorage',
    'Journal bridge: trades, stats v2, feedback',
  ],
};

/**
 * The Axioma bridge over the journal_server. createJournalHandoff signs with the INJECTED signer
 * (ES256 in staging/production, the HS256 dev stub in development) and records the issued jti to the
 * durable replay store when one is wired. getProductState/beginAccountLink still return the honest
 * placeholder state — the real journal_server endpoints + the OTC account-link exchange are B4
 * (blocked on confirmed endpoint shapes + a provisioned P-256 key). This factory does NOT enable any
 * disabled CTA; it only makes the ES256 signing path reachable.
 */
export function createAxiomaBridge(opts: AxiomaBridgeOptions): AxiomaBridge {
  const now = opts.now ?? (() => Date.now());
  const base = opts.baseUrl.replace(/\/$/, '');
  return {
    async getProductState(_userId, hasEntitlement): Promise<AxiomaProductState> {
      return {
        license: hasEntitlement
          ? { status: 'active', planCode: 'axioma_yearly', validUntil: now() + 300 * 86_400_000 }
          : { status: 'none', validUntil: null },
        accountLink: { state: 'not_linked' },
        release: SAMPLE_RELEASE,
        download: { eligible: hasEntitlement, requiresAuth: true, url: hasEntitlement ? `${base}/releases/axioma-setup-${SAMPLE_RELEASE.version}.exe` : undefined },
        journal: { reachable: true },
        support: { faqUrl: `${base}/faq`, contactUrl: `${base}/support` },
      };
    },
    async createJournalHandoff(userId, hasEntitlement) {
      if (!hasEntitlement) throw new Error('No active Axioma entitlement — cannot open journal');
      const claims = buildHandoffClaims(userId, 'axioma_terminal', 'open_journal', now(), opts.audience);
      // Persist the jti to the durable replay store BEFORE handing the token out (when wired).
      if (opts.recordJti) await opts.recordJti(claims.jti, claims.sub, claims.iat * 1000, claims.exp * 1000);
      const token = opts.signer.sign(claims);
      return { postUrl: `${base}/wtc-handoff`, token, expiresAt: claims.exp * 1000, method: 'POST' };
    },
    async beginAccountLink(_userId) {
      // WTC issues a short-lived one-time code; Axioma exchanges it server-side for {serverUrl, jwt}.
      // WTC never receives exchange keys. (Production OTC: randomBytes(32).base64url, stored only as its
      // hash — TARGET/B4 with the axioma_account_links refactor; the UUID here is a dev-only placeholder.)
      const code = globalThis.crypto.randomUUID();
      return { code, expiresAt: now() + HANDOFF_TTL_MS * 2 };
    },
  };
}

/**
 * Dev/mock convenience: an Axioma bridge backed by the HS256 dev-stub signer. Thin wrapper over
 * createAxiomaBridge with a development-env signer. NOT for staging/production — there, the web layer
 * resolves an ES256 signer (resolveHandoffSigner) and calls createAxiomaBridge directly.
 */
export function createMockAxiomaBridge(opts: MockBridgeOptions): AxiomaBridge {
  const signer = resolveHandoffSigner({ deploymentEnv: 'development', hs256Secret: opts.signingSecret });
  return createAxiomaBridge({ baseUrl: opts.baseUrl, signer, audience: opts.audience, now: opts.now });
}
