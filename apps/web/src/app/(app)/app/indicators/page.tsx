import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { accessFor, reasonLabel, reasonTone } from '@/lib/access';
import { tvService, backendMode } from '@/lib/backend';
import { tradingViewUsernameSchema } from '@wtc/shared';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses, type Tone } from '@wtc/ui';
import { fmtDate } from '@/lib/format';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { loadTvUserData } from '@/features/tv/queries';

async function submitTvAction(formData: FormData): Promise<void> {
  'use server';
  const user = await requireUser();
  await assertCsrf(formData);
  const access = await accessFor(user.id, 'tradingview_indicators');
  const parsed = tradingViewUsernameSchema.safeParse({ username: formData.get('username') });
  if (!parsed.success) return;
  try {
    await tvService.submitRequest(user.id, parsed.data.username, access.allowed, Date.now()); // throws (fail-closed) if no entitlement
  } catch {
    /* fail-closed: no entitlement -> ignored */
  }
  revalidatePath('/app/indicators');
}

function requestTone(status: string): Tone {
  return status === 'granted' ? 'ok' : status === 'pending' || status === 'expiring_soon' ? 'warn' : 'bad';
}

export default async function IndicatorsPage() {
  const user = await requireUser();
  const access = await accessFor(user.id, 'tradingview_indicators');
  // Fail-closed data minimisation (security audit F-01, 20260531-0005): only load the user's TV data
  // when they hold an active/grace entitlement. A lapsed user sees the entitlement notice + the
  // (disabled) request form — never a per-user data fetch. This is the canonical pattern the PG9
  // cabinet loader follows (gather signals only when access.allowed).
  const tvData = access.allowed ? await loadTvUserData(user.id) : null;

  const storageMode = tvData?.mode === 'postgres' ? 'postgres' : backendMode;

  // <14-day expiry banner: soonest UPCOMING expiry across active grants + granted requests (only when
  // entitled — tvData is null otherwise). UI-only 14-day horizon, complementary to the server-side
  // 7-day 'expiring_soon' status. Already-expired/revoked access does not fire it.
  const EXPIRY_BANNER_WINDOW_MS = 14 * 86_400_000;
  const now = Date.now();
  const upcomingExpiries = tvData
    ? [
        ...tvData.grants.filter((g) => g.revokedAt == null && g.expiresAt != null).map((g) => g.expiresAt!.getTime()),
        ...tvData.requests
          .filter((r) => (r.status === 'granted' || r.status === 'expiring_soon') && r.expiresAt != null)
          .map((r) => r.expiresAt!),
      ].filter((t) => t > now)
    : [];
  const soonestExpiry = upcomingExpiries.length ? Math.min(...upcomingExpiries) : null;
  const expiringSoon = soonestExpiry != null && soonestExpiry - now <= EXPIRY_BANNER_WINDOW_MS;
  const daysToExpiry = soonestExpiry != null ? Math.ceil((soonestExpiry - now) / 86_400_000) : null;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="TradingView"
        title="Indicator access"
        copy="Access is granted manually by an admin. TradingView has no automation — no credential-stuffing, no brittle browser scripts. Submit your TradingView username; an admin reviews the queue and grants access. Your access expires when your entitlement lapses."
      />

      <div className="wtc-row" style={{ marginTop: -4 }}>
        {storageMode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Dev fallback — requests reset on restart. Set DATABASE_URL to persist to Postgres.
            </span>
          </>
        )}
      </div>

      {!access.allowed && (
        <RiskWarningBanner
          severity="warning"
          title={`Indicator access: ${reasonLabel(access.reason)}`}
          detail="A request requires an active tradingview_indicators entitlement (fail-closed). Renew in billing to submit a new username."
        />
      )}

      {expiringSoon && soonestExpiry != null && (
        <RiskWarningBanner
          severity="warning"
          title={`TradingView access expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}`}
          detail={`Your indicator access expires on ${fmtDate(soonestExpiry)}. Keep your subscription active to avoid losing access — after expiry an admin must re-grant it.`}
        />
      )}

      {/* TradingView profile (declared username + current grant pointer) */}
      {tvData?.profile && (
        <Card title="Your TradingView profile">
          <table className="wtc-table">
            <tbody>
              <tr>
                <td className="wtc-dim" style={{ width: 160 }}>TradingView username</td>
                <td className="wtc-mono">{tvData.profile.tvUsername}</td>
              </tr>
              <tr>
                <td className="wtc-dim">Profile updated</td>
                <td className="wtc-mono">{fmtDate(tvData.profile.updatedAt.getTime())}</td>
              </tr>
              {tvData.profile.currentGrantId && (
                <tr>
                  <td className="wtc-dim">Active grant</td>
                  <td><StatusPill tone="ok">granted</StatusPill></td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tvData && (
        <>
      {/* Access requests list */}
      <Card title="Your access requests">
        {tvData.requests.length === 0 ? (
          <EmptyState title="No requests yet" hint="Submit your TradingView username below to join the access queue." />
        ) : (
          <table className="wtc-table">
            <thead>
              <tr>
                <th>TradingView username</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Granted</th>
                <th>Expires</th>
                <th>Revoked</th>
              </tr>
            </thead>
            <tbody>
              {tvData.requests.map((r) => (
                <tr key={r.id}>
                  <td className="wtc-mono">{r.tradingViewUsername}</td>
                  <td>
                    <StatusPill tone={requestTone(r.status)}>{r.status.replace('_', ' ')}</StatusPill>
                  </td>
                  <td className="wtc-mono">{fmtDate(r.requestedAt)}</td>
                  <td className="wtc-mono">{fmtDate(r.grantedAt ?? null)}</td>
                  <td className="wtc-mono">{fmtDate(r.expiresAt ?? null)}</td>
                  <td className="wtc-mono">{fmtDate(r.revokedAt ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Grant history */}
      {tvData.grants.length > 0 && (
        <Card title="Grant history">
          <table className="wtc-table">
            <thead>
              <tr>
                <th>TradingView username</th>
                <th>Granted</th>
                <th>Expires</th>
                <th>Revoked</th>
              </tr>
            </thead>
            <tbody>
              {tvData.grants.map((g) => (
                <tr key={g.id}>
                  <td className="wtc-mono">{g.tvUsername}</td>
                  <td className="wtc-mono">{fmtDate(g.grantedAt.getTime())}</td>
                  <td className="wtc-mono">{fmtDate(g.expiresAt?.getTime() ?? null)}</td>
                  <td className="wtc-mono">{fmtDate(g.revokedAt?.getTime() ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
        </>
      )}

      {/* Submit form */}
      <Card title="Request access">
        {!access.allowed && (
          <p className="wtc-dim" style={{ fontSize: 13, marginBottom: 10 }}>
            An active <strong>tradingview_indicators</strong> entitlement is required to submit a request.
            Entitlement status: <StatusPill tone={reasonTone(access.reason)}>{reasonLabel(access.reason)}</StatusPill>
          </p>
        )}
        <form action={submitTvAction} className="wtc-row">
          <CsrfField />
          <input
            className="wtc-input"
            name="username"
            placeholder="your_tradingview_username"
            style={{ maxWidth: 320 }}
            disabled={!access.allowed}
          />
          <button className={buttonClasses('primary')} type="submit" disabled={!access.allowed}>
            Submit request
          </button>
        </form>
        <p className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
          Access is granted manually by an admin. TradingView has no automation — no credential-stuffing
          or brittle browser scripts as production default. Any optional compliant adapter is
          feature-flagged and off by default.
        </p>
      </Card>
    </div>
  );
}
