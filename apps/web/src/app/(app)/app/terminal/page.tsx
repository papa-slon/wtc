import { requireUser } from '@/lib/session';
import { accessFor, reasonLabel, reasonTone } from '@/lib/access';
import { axiomaBridgeIsDev } from '@/lib/server-config';
import { loadTerminalRelease } from '@/features/terminal/loader';
import { Card, SectionHeader, StatusPill, RiskWarningBanner, buttonClasses, type Tone } from '@wtc/ui';
import { fmtDate } from '@/lib/format';
import type { LicenseStatus } from '@wtc/axioma-bridge';

/**
 * Map LicenseStatus → UI Tone.
 * Backward-compatible with the pre-existing 'active' | 'inactive' | 'expired' | 'none' set.
 * New statuses 'grace' | 'revoked' | 'unknown' also handled.
 */
function licenseTone(status: LicenseStatus): Tone {
  if (status === 'active') return 'ok';
  if (status === 'grace') return 'warn';
  if (status === 'none') return 'neutral';
  // inactive | expired | revoked | unknown → bad (fail-closed)
  return 'bad';
}

export default async function TerminalPage() {
  const user = await requireUser();
  const access = await accessFor(user.id, 'axioma_terminal');
  const isDev = axiomaBridgeIsDev();

  // DB-backed release loader — null db → honest demo mode; prod → real Postgres.
  const terminalData = await loadTerminalRelease('stable', 'windows-x64');
  const release = terminalData.release;
  const bridgeActionsEnabled =
    access.allowed && terminalData.routeSkeletonConfigured && terminalData.bridgeActionsImplemented;
  const bridgeBlockerCopy = terminalData.routeSkeletonConfigured
    ? 'Bridge routes are configured, but download streaming and journal handoff actions are still fail-closed until implementation gates pass.'
    : `Bridge routes are fail-closed: ${terminalData.routeBlockers.join(', ') || 'not configured'}.`;

  // Derive license status from the entitlement decision (fail-closed).
  // We do NOT use the mock bridge license — entitlement is the only source of truth.
  const licStatus: LicenseStatus = access.allowed
    ? 'active'
    : access.reason === 'grace'
    ? 'grace'
    : access.reason === 'revoked' || access.reason === 'chargeback' || access.reason === 'refunded'
    ? 'revoked'
    : access.reason === 'blocked_no_entitlement'
    ? 'none'
    : 'inactive';

  return (
    <div className="wtc-stack">
      {/* ===== Hard boundary callout — always visible, non-dismissible ===== */}
      <div
        className="wtc-warning info"
        role="status"
        aria-label="Local order execution boundary"
        style={{ fontStyle: 'italic' }}
      >
        <span aria-hidden style={{ fontWeight: 800 }}>i</span>
        <div>
          <div className="w-title">WTC never gates your local Axioma order execution</div>
          <div className="w-detail">
            Only server-backed features — downloads, cloud journal access — require a WTC Axioma license.
            Local trading in your Axioma desktop terminal is never blocked by this platform.
          </div>
        </div>
      </div>

      <div className="wtc-spread">
        <SectionHeader
          kicker="Product"
          title="Axioma Terminal"
          copy="A first-class WTC product module. WTC owns the product experience — license, account-link, release metadata, download, journal — and never copies the Axioma runtime or touches local order execution."
        />
        <StatusPill tone={reasonTone(access.reason)}>{reasonLabel(access.reason)}</StatusPill>
      </div>

      {/* Dev bridge banner — non-dismissible */}
      {(isDev || !terminalData.bridgeActionsImplemented) && (
        <RiskWarningBanner
          severity="info"
          title="Axioma bridge actions are fail-closed"
          detail={bridgeBlockerCopy}
        />
      )}

      {/* Storage mode indicator */}
      <div className="wtc-row">
        {terminalData.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Demo mode — release data is illustrative. Set DATABASE_URL to load real release records from Postgres.
            </span>
          </>
        )}
      </div>

      {/* Entitlement gate warning */}
      {!access.allowed && (
        <RiskWarningBanner
          severity="warning"
          title={`License — ${reasonLabel(access.reason)}`}
          detail="Activate an Axioma plan in billing to unlock downloads, the cloud journal, and premium server features. Local terminal trading is never gated by WTC."
        />
      )}

      <div className="wtc-grid wtc-grid-2">
        {/* License & account-link card */}
        <Card title="License & account">
          <div className="wtc-stack">
            <div className="wtc-spread">
              <span className="wtc-muted">License status</span>
              <StatusPill tone={licenseTone(licStatus)}>{licStatus}</StatusPill>
            </div>
            <div className="wtc-spread">
              <span className="wtc-muted">Account link</span>
              <StatusPill tone="warn">not_linked</StatusPill>
            </div>
            <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 8px' }}>
              The Axioma account-link flow is not yet implemented. When built, a one-time code will be
              exchanged server-side by Axioma. WTC never receives exchange keys or your Axioma JWT.
            </p>
            <button
              className={buttonClasses('secondary')}
              disabled
              title="Connect Axioma account flow is not yet implemented (dev placeholder)"
            >
              Connect Axioma account (dev placeholder)
            </button>
          </div>
        </Card>

        {/* Release metadata card — DB-backed or demo */}
        <Card title="Latest release">
          {release ? (
            <>
              <div className="wtc-spread">
                <strong>v{release.version}</strong>
                <StatusPill tone="gold">{release.channel}</StatusPill>
              </div>
              <p className="wtc-dim" style={{ fontSize: 12, margin: '6px 0 10px' }}>
                Published {fmtDate(release.publishedAt)}
                {release.minSupportedVersion ? ` · min supported v${release.minSupportedVersion}` : ''}
              </p>
              {release.installerName && (
                <div className="wtc-row" style={{ marginBottom: 6 }}>
                  <span className="wtc-dim" style={{ fontSize: 12 }}>Installer:</span>
                  <code className="wtc-mono" style={{ fontSize: 12 }}>{release.installerName}</code>
                </div>
              )}
              {release.checksumSha256 && (
                <div className="wtc-row" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                  <span className="wtc-dim" style={{ fontSize: 12 }}>SHA-256:</span>
                  <code className="wtc-mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{release.checksumSha256}</code>
                </div>
              )}
              {release.releaseNotesMarkdown && (
                <ul className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.7, margin: '8px 0 0', paddingLeft: 18 }}>
                  {release.releaseNotesMarkdown
                    .split('\n')
                    .filter((l) => l.trim().startsWith('-'))
                    .map((l, i) => <li key={i}>{l.replace(/^-\s*/, '')}</li>)}
                </ul>
              )}
              <div className="wtc-row" style={{ marginTop: 16 }}>
                {access.allowed ? (
                  <button
                    className={buttonClasses(bridgeActionsEnabled ? 'primary' : 'ghost')}
                    disabled={!bridgeActionsEnabled}
                    title={!bridgeActionsEnabled ? bridgeBlockerCopy : undefined}
                  >
                    {bridgeActionsEnabled ? 'Download terminal' : 'Download terminal (not configured)'}
                  </button>
                ) : (
                  <button className={buttonClasses('ghost')} disabled>
                    Download (needs license)
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="wtc-muted" style={{ margin: 0 }}>
              No current release found for the stable/windows-x64 channel in Postgres.
              Seed a release row via the admin terminal interface.
            </p>
          )}
        </Card>
      </div>

      {/* Journal & JWKS readiness */}
      <Card title="Journal & support">
        <div className="wtc-row">
          <button
            className={buttonClasses(bridgeActionsEnabled ? 'primary' : 'ghost')}
            disabled={!bridgeActionsEnabled}
            title={!bridgeActionsEnabled ? bridgeBlockerCopy : undefined}
          >
            {access.allowed
              ? !bridgeActionsEnabled
                ? 'Open Axioma Journal (not configured)'
                : 'Open Axioma Journal'
              : 'Open Axioma Journal (needs license)'}
          </button>
        </div>
        <p className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
          In production, "Open Journal" POSTs a short-lived, single-use, audience-bound ES256 handoff
          token to Axioma — never a long-lived GET token placed in browser history. Server features only;
          local order execution is never gated.
        </p>

        {/* ES256/JWKS readiness — shows config state only, never the key value */}
        <div className="wtc-spread" style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--stroke)' }}>
          <span className="wtc-muted" style={{ fontSize: 13 }}>ES256 / JWKS signer</span>
          {terminalData.jwksConfigured ? (
            <StatusPill tone="ok">configured</StatusPill>
          ) : (
            <StatusPill tone="warn">not configured</StatusPill>
          )}
        </div>
        <p className="wtc-dim" style={{ fontSize: 12, marginTop: 6 }}>
          {terminalData.jwksConfigured
            ? 'AXIOMA_HANDOFF_SIGNING_KEY and AXIOMA_HANDOFF_KEY_ID are set. The /.well-known/axioma-jwks.json endpoint will serve the public JWK only; the private key is never exposed.'
            : 'AXIOMA_HANDOFF_SIGNING_KEY or AXIOMA_HANDOFF_KEY_ID is missing. Production requires an ES256 P-256 key plus key id. See docs/AXIOMA_HANDOFF_TOKEN_SPEC.md.'}
        </p>
        <div className="wtc-spread" style={{ marginTop: 10 }}>
          <span className="wtc-muted" style={{ fontSize: 13 }}>Axioma route skeletons</span>
          {terminalData.routeSkeletonConfigured ? (
            <StatusPill tone="ok">configured</StatusPill>
          ) : (
            <StatusPill tone="warn">fail-closed</StatusPill>
          )}
        </div>
        {!terminalData.routeSkeletonConfigured && (
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 6 }}>
            Download and journal handoff routes return fail-closed errors until AXIOMA_ROUTE_SKELETON_ENABLED,
            DATABASE_URL, AXIOMA_BRIDGE_API_TOKEN, and the ES256 signer are configured.
          </p>
        )}
      </Card>
    </div>
  );
}
