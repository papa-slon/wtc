import type { ReactNode } from 'react';
import { EmptyState, RiskWarningBanner, StatusPill, buttonClasses } from '@wtc/ui';
import { CsrfField } from '@/lib/csrf';

export interface ExchangeKeyReadinessKey {
  id: string;
  exchange: string;
  label: string;
  mode: 'demo' | 'live';
  keyMask: string;
}

export type ExchangeKeyReadinessResult = 'vault-present' | 'missing' | 'invalid';

const exchangeNotes: Record<string, string> = {
  bingx: 'BingX key metadata is stored for a future read-only adapter test. Withdrawals must stay disabled.',
  binance: 'Binance key metadata is stored for a future read-only adapter test. Withdrawals must stay disabled.',
  bybit: 'Bybit key metadata is stored for a future read-only adapter test. Withdrawals must stay disabled.',
  okx: 'OKX key metadata is stored for a future read-only adapter test. Withdrawals must stay disabled.',
};

function exchangeNote(exchange: string): string {
  return exchangeNotes[exchange] ?? 'Exchange key metadata is stored for a future read-only adapter test. Withdrawals must stay disabled.';
}

function ReadinessStep({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'neutral' }) {
  return (
    <div className="wtc-card-row">
      <span className="k">{label}</span>
      <span className="v"><StatusPill tone={tone}>{value}</StatusPill></span>
    </div>
  );
}

export function ExchangeKeyReadinessPanel({
  keys,
  emptyAction,
  bot,
  checkAction,
  checkResult,
  compact = false,
}: {
  keys: ExchangeKeyReadinessKey[];
  emptyAction?: ReactNode;
  bot?: string;
  checkAction?: (formData: FormData) => void | Promise<void>;
  checkResult?: ExchangeKeyReadinessResult;
  compact?: boolean;
}) {
  if (keys.length === 0) {
    return (
      <div className="wtc-stack" style={{ gap: 10 }}>
        <EmptyState
          title="No encrypted exchange key saved"
          hint="Add a key before any future audited live adapter can run a real read-only exchange test."
        />
        {emptyAction}
        <RiskWarningBanner
          severity="info"
          title="No live exchange ping is claimed"
          detail="The current page can validate inputs and save sealed key material only. Real connectivity remains blocked until the exchange adapter passes security and bot-integration audit."
        />
      </div>
    );
  }

  return (
    <div className="wtc-stack" style={{ gap: 12 }}>
      {checkResult === 'vault-present' && (
        <RiskWarningBanner
          severity="info"
          title="WTC readiness check passed"
          detail="Vault metadata was found for your saved key. No live exchange ping was run, and no bot was started, stopped, or reconfigured."
        />
      )}
      {checkResult === 'missing' && (
        <RiskWarningBanner
          severity="error"
          title="WTC readiness check could not confirm this key"
          detail="The owned exchange-key metadata or vault marker was not found. No exchange network call was attempted."
        />
      )}
      {checkResult === 'invalid' && (
        <RiskWarningBanner
          severity="error"
          title="WTC readiness check was not accepted"
          detail="The request did not pass validation. No exchange network call was attempted."
        />
      )}
      <div className="wtc-grid wtc-grid-3">
        {keys.map((key) => (
          <div key={key.id} className="wtc-card wtc-stack" style={{ gap: 10 }}>
            <div className="wtc-spread" style={{ gap: 8, flexWrap: 'wrap' }}>
              <strong>{key.label}</strong>
              <div className="wtc-row" style={{ gap: 6 }}>
                <StatusPill tone={key.mode === 'live' ? 'warn' : 'neutral'}>{key.mode}</StatusPill>
                <StatusPill tone="warn">ping not run</StatusPill>
              </div>
            </div>

            <div className="wtc-card-row"><span className="k">Exchange</span><span className="v">{key.exchange}</span></div>
            <div className="wtc-card-row"><span className="k">Key</span><span className="v wtc-mono">{key.keyMask}</span></div>
            <div className="wtc-card-row"><span className="k">Vault</span><span className="v">saved in WTC vault</span></div>

            {!compact && (
              <div className="wtc-stack" style={{ gap: 0 }}>
                <ReadinessStep label="WTC metadata" value="saved" tone="ok" />
                <ReadinessStep label="Format check" value="passed" tone="ok" />
                <ReadinessStep label="Exchange ping" value="not run" tone="warn" />
                <ReadinessStep label="Live bot control" value="disabled" tone="neutral" />
              </div>
            )}

            <p className="wtc-dim" style={{ fontSize: 12, lineHeight: 1.55, margin: 0 }}>
              {exchangeNote(key.exchange)}
            </p>
            {checkAction && bot ? (
              <form action={checkAction} className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <CsrfField />
                <input type="hidden" name="bot" value={bot} />
                <input type="hidden" name="exchangeAccountId" value={key.id} />
                <button className={buttonClasses('secondary')} type="submit">Check WTC vault readiness</button>
                <button
                  className={buttonClasses('ghost')}
                  type="button"
                  disabled
                  title="Disabled until a read-only exchange ping adapter passes security and bot-integration audit"
                >
                  Run read-only exchange ping (future)
                </button>
              </form>
            ) : (
              <button
                className={buttonClasses('ghost')}
                type="button"
                disabled
                title="Disabled until a read-only exchange ping adapter passes security and bot-integration audit"
              >
                Run read-only exchange ping (future)
              </button>
            )}
          </div>
        ))}
      </div>
      <RiskWarningBanner
        severity="warning"
        title="Exchange ping unavailable"
        detail="This readiness check proves only the WTC-side save path: input validation, ownership, encrypted vault storage, and redacted audit metadata. It does not contact the exchange and cannot start, stop, or reconfigure a live bot."
      />
    </div>
  );
}
