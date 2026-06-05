import Link from 'next/link';
import { StatusPill, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import type { CabinetCardView } from '@wtc/cabinet';

function readinessTone(status: CabinetCardView['readiness']['items'][number]['status']) {
  if (status === 'ready') return 'ok';
  if (status === 'attention') return 'warn';
  if (status === 'blocked') return 'bad';
  return 'neutral';
}

function readinessLabel(status: CabinetCardView['readiness']['items'][number]['status']) {
  if (status === 'ready') return 'ready';
  if (status === 'attention') return 'review';
  if (status === 'blocked') return 'blocked';
  return 'read-only';
}

/**
 * Presentational cabinet product card (RSC). Pure render of a @wtc/cabinet view-model — all decisions
 * (entitlement tone, setup state, next action, blockers) are made by the pure deriver, so this file
 * holds NO business logic. Lives in features/cabinet (not packages/ui) to avoid a @wtc/ui → @wtc/cabinet
 * circular dependency; it composes the low-level @wtc/ui primitives instead.
 *
 * Five honest zones: entitlement pill · setup checklist · recent activity · blockers/warnings · next action.
 */
export function CabinetProductCard({ card }: { card: CabinetCardView }) {
  const { entitlement, setup, readiness, activity, nextAction, blockers, warnings } = card;
  const warnSeverity = warnings.maxSeverity === 'error' ? 'error' : 'warning';
  const blockerRef = blockers.find((b) => b.ref !== 'demo');
  const showRenew = card.reason === 'allowed' && entitlement.expiresInDays != null && entitlement.expiresInDays >= 0 && entitlement.expiresInDays <= 14;

  return (
    <div className="wtc-card wtc-stack" style={{ gap: 12 }}>
      <div className="wtc-spread">
        <h3 style={{ margin: 0, fontSize: 18 }}>{card.name}</h3>
        <StatusPill tone={entitlement.tone}>{entitlement.label}</StatusPill>
      </div>
      <p className="wtc-muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{card.description}</p>

      {(card.availability === 'planned' || card.isDemo || showRenew) && (
        <div className="wtc-row" style={{ gap: 8 }}>
          {card.availability === 'planned' && <StatusPill tone="neutral">planned</StatusPill>}
          {card.isDemo && <StatusPill tone="warn">demo data</StatusPill>}
          {showRenew && <StatusPill tone="warn">renews in {entitlement.expiresInDays}d</StatusPill>}
        </div>
      )}

      {setup.items.length > 0 && (
        <div className="wtc-stack" style={{ gap: 6 }}>
          <div className="wtc-card-row">
            <span className="k">Setup</span>
            <span className="v">{setup.label}</span>
          </div>
          <ul className="wtc-stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 4, fontSize: 13 }}>
            {setup.items.map((it, idx) => (
              <li key={idx} className="wtc-row" style={{ gap: 8 }}>
                <span aria-hidden style={{ color: it.done ? 'var(--green)' : 'var(--dim)' }}>{it.done ? '✓' : '○'}</span>
                <span className={it.done ? undefined : 'wtc-muted'}>{it.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {readiness.items.length > 0 && (
        <div className="wtc-stack" style={{ gap: 6 }}>
          <div className="wtc-card-row">
            <span className="k">Readiness</span>
            <span className="v">{readiness.items.length} layers</span>
          </div>
          <div className="wtc-stack" style={{ gap: 6 }}>
            {readiness.items.map((item) => (
              <div key={item.label} className="wtc-spread" style={{ gap: 8, alignItems: 'flex-start' }}>
                <span className="wtc-dim" style={{ fontSize: 12 }}>{item.label}: {item.value}</span>
                <StatusPill tone={readinessTone(item.status)}>{readinessLabel(item.status)}</StatusPill>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="wtc-card-row">
        <span className="k">Activity</span>
        <span className="v wtc-dim">{activity.line ?? '—'}</span>
      </div>

      {warnings.count > 0 && (
        <RiskWarningBanner
          severity={warnSeverity}
          title={`${warnings.count} operational notice${warnings.count === 1 ? '' : 's'}`}
          detail="Unresolved risk signals are shown on the product dashboard — never hidden behind a healthy card."
        />
      )}

      {blockerRef && <RiskWarningBanner severity="warning" title={`Blocked (${blockerRef.ref})`} detail={blockerRef.text} />}

      <div style={{ marginTop: 4 }}>
        {nextAction.href && !nextAction.disabled ? (
          <Link href={nextAction.href} className={buttonClasses(nextAction.variant)}>{nextAction.label}</Link>
        ) : (
          <button className={buttonClasses(nextAction.variant)} disabled type="button">{nextAction.label}</button>
        )}
      </div>
    </div>
  );
}
