import type { TortilaActivityItem } from '@wtc/bot-adapters';
import { Card, RiskWarningBanner } from '@wtc/ui';
import { AutoRefresh } from '../tortila-overview/auto-refresh';
import { Sparkline } from '../tortila-overview/sparkline';
import { EquityPanel } from '../tortila-overview/equity-panel';
import { SymbolContribution } from '../tortila-overview/symbol-bars';
import { ActivityFeed } from '../tortila-overview/activity-feed';
import {
  fmtMoneyOrDash,
  fmtNumberOrDash,
  fmtSignedOrDash,
  fmtShortTs,
  signClass,
} from '../tortila-overview/format';
import { DepthGauge } from './depth-gauge';
import { SignalMix } from './signal-mix';
import { StuckBagCard } from './stuck-bag-card';
import { reasonLabel } from './dca-format';
import type { LegacyLiveOverview } from '../legacy-overview-data';

/**
 * Capabilities that drive what an overview renders. Encoding the honesty rules
 * in TYPES (not scattered `if`s) makes fabrication structurally hard to reach:
 * a section gated on `hasLiveMark`/`hasStopLoss` simply cannot render a mark or
 * a stop it does not have. The legacy DCA bot sets almost everything false.
 */
export interface BotOverviewCapabilities {
  reconstructed: boolean;        // money is modelled from the order ladder, not exchange-confirmed
  hasLiveMark: boolean;          // false → no Mark/Unrealised rows
  hasStopLoss: boolean;          // false → no stop row / price ladder
  hasWinLossStats: boolean;      // false → no win-rate / avg-win / streaks / PF
  hasRiskRatios: boolean;        // false → no Sharpe/Sortino/Calmar risk panel
  hasPnlDistribution: boolean;   // false → no per-trade PnL histogram
  hasCalendarHeatmap: boolean;   // false → no daily P&L heatmap
  hasMonthlyPnl: boolean;        // false → no monthly signed-PnL bars
  hasTradeHistory: boolean;      // false → no paged trade table
  hasFunding: boolean;           // false → costs band drops the Funding cell
  equityIsWallet: boolean;       // false → equity is relative reconstructed PnL (baseline 0), not a balance
  showDcaSnapshot: boolean;      // DCA "stuck bag" positions
  showDepthGauge: boolean;       // averaging-depth distribution
  showSignalMix: boolean;        // RED(CCI)/YELLOW(RSI) mix
}

export const LEGACY_DCA_CAPS: BotOverviewCapabilities = {
  reconstructed: true,
  hasLiveMark: false,
  hasStopLoss: false,
  hasWinLossStats: false,
  hasRiskRatios: false,
  hasPnlDistribution: false,
  hasCalendarHeatmap: false,
  hasMonthlyPnl: false,
  hasTradeHistory: false,
  hasFunding: false,
  equityIsWallet: false,
  showDcaSnapshot: true,
  showDepthGauge: true,
  showSignalMix: true,
};

export interface LegacyOverviewProps {
  overview: LegacyLiveOverview;
  caps: BotOverviewCapabilities;
}

/** Small gold "recon" tag rendered beside reconstructed money figures. */
function ReconTag() {
  return <span className="tov-recon-tag">recon</span>;
}

function KpiCell({ label, value, tone = 'neutral', tip }: { label: string; value: React.ReactNode; tone?: 'up' | 'down' | 'neutral'; tip?: string }) {
  return (
    <div className="tov-kpi" data-tip={tip} tabIndex={tip ? 0 : undefined} title={tip}>
      <div className="tov-kpi-label">{label}</div>
      <div className={`tov-kpi-val ${tone === 'up' ? 'up' : tone === 'down' ? 'down' : ''}`}>{value}</div>
    </div>
  );
}

function sectionUnavailable(msg: string | null) {
  return msg ? <RiskWarningBanner severity="info" title="Section unavailable" detail={msg} /> : null;
}

/** Map a shim activity row (kind open|close) to the ActivityFeed item shape.
 *  open → decision (no amount), close → trade (carries reconstructed net PnL). */
function toActivityItems(
  rows: { ts: string; kind: string; symbol: string; reason?: string; depth?: number; net_pnl?: number; label?: string }[],
  legend: Record<string, string> | undefined,
): TortilaActivityItem[] {
  return rows.map((r) => {
    const isClose = r.kind === 'close';
    const trig = r.reason ? ` · ${reasonLabel(r.reason, legend)}` : '';
    return {
      ts: r.ts,
      kind: isClose ? 'trade' : 'decision',
      symbol: r.symbol,
      side: 'long',
      label: r.label ?? (isClose ? 'take-profit' : 'cycle opened'),
      detail: `depth ${r.depth ?? 0}/3${trig}`,
      net_pnl: isClose && typeof r.net_pnl === 'number' ? r.net_pnl : undefined,
    } satisfies TortilaActivityItem;
  });
}

export function LegacyOverview({ overview, caps }: LegacyOverviewProps) {
  const { payload } = overview;
  const summary = payload.summary.data;
  const equity = payload.equity.data;
  const depth = payload.depthDistribution.data;
  const signals = payload.signals.data;
  const positions = payload.positions.data;
  const symBreakdown = payload.symbolBreakdown.data;
  const activity = payload.activity.data;
  const legend = signals?.legend;

  const realizedNet = summary?.realized_pnl_net ?? 0;
  const spark = equity?.equity ?? [];
  const depthCap = depth ? Math.max(3, ...depth.all.map((b) => b.depth)) : 3;

  const accountsLabel = summary
    ? `${summary.accounts_running}/${summary.accounts_total} accts`
    : 'accounts';

  const reconMethod = payload.reconMethod ?? '';
  const tpPct = summary ? summary.tp_pct * 100 : null;
  const feeRate = summary ? summary.fee_rate : null;

  const activityItems: TortilaActivityItem[] = activity?.rows.length
    ? toActivityItems(activity.rows, legend)
    : [];

  return (
    <div className="wtc-stack" data-testid="legacy-overview">
      <div className="wtc-spread" style={{ flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold2)', fontWeight: 700 }}>
          Legacy Bot — Reconstructed overview
        </span>
        <AutoRefresh
          enabled={payload.configured}
          initialServerTs={payload.assembledAt}
          intervalMs={30_000}
        />
      </div>

      {/* The single honesty anchor — rendered whenever the page is live. */}
      <RiskWarningBanner
        severity="info"
        title="Reconstructed analytics"
        detail={
          `PnL, equity and fees below are RECONSTRUCTED from the closed-cycle order ladder — every cycle exits at ` +
          `+${tpPct !== null ? tpPct.toFixed(2) : '0.45'}% take-profit on the volume-weighted average entry, with both fee legs at ` +
          `${feeRate !== null ? (feeRate * 100).toFixed(3) : '0.050'}% per side. This is NOT a wallet balance. Live unrealized PnL and current marks are not available. ` +
          `Win-rate is ~100% by construction (fixed take-profit, no stop-loss) and is deliberately not shown as a skill metric.` +
          (reconMethod ? ` Method: ${reconMethod}` : '')
        }
      />

      {/* 1. Hero — reconstructed DCA headline */}
      <section className="tov-hero">
        <div className="tov-hero-left">
          <div className="tov-hero-meta">
            <span className="tov-chip ath">RECONSTRUCTED</span>
            <span className={`tov-chip ${overview.mode === 'live' ? 'live' : ''}`}>
              {overview.mode === 'live' ? 'LIVE' : 'MODE N/A'}
            </span>
            <span className="tov-chip">Legacy · BingX</span>
            <span className="tov-chip">{accountsLabel}</span>
          </div>
          <div className="tov-hero-equity">
            <span className="tov-hero-equity-value tov-mono">{fmtSignedOrDash(realizedNet, 2)}</span>
            <span className="tov-hero-equity-unit">USDT</span>
          </div>
          <div className="tov-hero-sub">
            <span>Reconstructed net PnL</span>
            <span className="tov-sep">·</span>
            <span className="tov-dim">relative · baseline 0</span>
            <span className="tov-sep">·</span>
            <span>today <span className={`tov-mono ${signClass(overview.todayPnl)}`}>{fmtSignedOrDash(overview.todayPnl, 2)}</span></span>
          </div>
          <div className="tov-hero-sub">
            <span className="tov-mono">gross {fmtSignedOrDash(summary?.realized_pnl_gross ?? null, 2)}</span>
            <span className="tov-sep">·</span>
            <span className="tov-mono">fees {fmtSignedOrDash(summary ? -Math.abs(summary.fees_total) : null, 2)}</span>
            <span className="tov-sep">·</span>
            <span className="tov-mono">{summary?.closed_cycles ?? 0} closed</span>
            <span className="tov-sep">·</span>
            <span className="tov-mono">{summary?.open_cycles ?? 0} open</span>
            {overview.sinceIso && (
              <>
                <span className="tov-sep">·</span>
                <span className="tov-mono">since {overview.sinceIso.slice(0, 10)}</span>
              </>
            )}
          </div>
          <div className="tov-spark-wrap">
            <Sparkline values={spark} />
          </div>
        </div>
        <div className="tov-hero-right">
          <KpiCell label="Closed cycles" value={fmtNumberOrDash(summary?.closed_cycles ?? null, 0)} tip="Completed averaging cycles that reached take-profit." />
          <KpiCell label="Open bags" value={fmtNumberOrDash(overview.openBags, 0)} tip="Positions still averaging, not yet at take-profit." />
          <KpiCell label="Avg depth" value={fmtNumberOrDash(overview.avgDepth, 2)} tone={overview.avgDepth !== null && overview.avgDepth > 1 ? 'down' : 'neutral'} tip="Mean averaging depth across all cycles — how far bags average down before TP." />
          <KpiCell
            label="Worst open depth"
            value={overview.worstOpenDepth !== null ? `${overview.worstOpenDepth}/${depthCap}` : '—'}
            tone={overview.worstOpenDepth !== null && overview.worstOpenDepth >= depthCap ? 'down' : 'neutral'}
            tip="Deepest currently-open bag. At max depth = a fully-averaged 'stuck' position."
          />
          <KpiCell label="Fees (recon)" value={fmtSignedOrDash(summary ? -Math.abs(summary.fees_total) : null, 2)} tone="down" tip="Reconstructed round-trip taker fees across closed cycles." />
          <KpiCell label="Net / cycle (recon)" value={fmtSignedOrDash(overview.netPerCycle, 2)} tone={overview.netPerCycle !== null && overview.netPerCycle < 0 ? 'down' : 'up'} tip="Reconstructed net PnL per closed cycle." />
        </div>
      </section>

      {/* 2. Reconstructed equity & drawdown */}
      <Card title="Reconstructed cumulative PnL & drawdown">
        {equity && equity.equity.length >= 2 ? (
          <>
            <EquityPanel
              ts={equity.ts}
              equity={equity.equity}
              initialEquity={caps.equityIsWallet ? (equity.equity[0] ?? null) : 0}
              ddTs={equity.dd_ts.length >= 2 ? equity.dd_ts : undefined}
              ddPct={equity.dd_pct.length >= 2 ? equity.dd_pct : undefined}
            />
            <p className="tov-mute-xs" style={{ marginTop: 8 }}>
              Relative to a 0 baseline. Reconstructed realized profit from closed cycles — NOT a wallet balance.
            </p>
          </>
        ) : (
          sectionUnavailable(payload.equity.error) ?? <div className="tov-empty-mini">Not enough reconstructed equity history yet.</div>
        )}
      </Card>

      {/* 3. How stuck — averaging-depth distribution */}
      {caps.showDepthGauge && (
        <Card title="How stuck · averaging-depth distribution">
          {depth ? (
            <DepthGauge all={depth.all} open={depth.open} note={depth.note} />
          ) : (
            sectionUnavailable(payload.depthDistribution.error) ?? <div className="tov-empty-mini">No depth data.</div>
          )}
        </Card>
      )}

      {/* 4. Signal mix — RED (CCI) vs YELLOW (RSI) */}
      {caps.showSignalMix && (
        <Card title="Signal mix · RED (CCI) vs YELLOW (RSI)">
          {signals ? (
            <SignalMix legend={signals.legend} mix={signals.mix} over_time={signals.over_time} />
          ) : (
            sectionUnavailable(payload.signals.error) ?? <div className="tov-empty-mini">No signal data.</div>
          )}
        </Card>
      )}

      {/* 5. Open 'stuck bag' positions */}
      {caps.showDcaSnapshot && (
        <Card title={`Open positions · ${positions?.rows.length ?? 0} bag${(positions?.rows.length ?? 0) === 1 ? '' : 's'} averaging`}>
          {positions && positions.rows.length > 0 ? (
            <>
              <div className="tov-pos-grid">
                {positions.rows.map((row) => (
                  <StuckBagCard key={row.symbol} row={row} maxDepth={depthCap} legend={legend} />
                ))}
              </div>
              {payload.markNote && <div className="tov-mute-xs" style={{ marginTop: 10 }}>{payload.markNote}</div>}
            </>
          ) : positions ? (
            <div className="tov-empty-mini">No open positions — all cycles closed at take-profit.</div>
          ) : (
            sectionUnavailable(payload.positions.error) ?? <div className="tov-empty-mini">No position data.</div>
          )}
        </Card>
      )}

      {/* 6. Per-symbol contribution */}
      <Card title="Symbol contribution · reconstructed net PnL per symbol">
        {symBreakdown ? (
          <SymbolContribution rows={symBreakdown.rows} columns="dca" />
        ) : (
          sectionUnavailable(payload.symbolBreakdown.error) ?? <div className="tov-empty-mini">No data.</div>
        )}
      </Card>

      {/* 7. Activity feed */}
      <Card title="Activity · cycle opens + take-profits (newest first)">
        {activityItems.length > 0 ? (
          <>
            <ActivityFeed items={activityItems.slice(0, 40)} />
            <p className="tov-mute-xs" style={{ marginTop: 8 }}>Close amounts are reconstructed cycle PnL.</p>
          </>
        ) : (
          sectionUnavailable(payload.activity.error) ?? <div className="tov-empty-mini">No recent activity recorded.</div>
        )}
      </Card>

      {/* 8. Costs & tracking footer */}
      <Card>
        <h3 className="tov-section-h">Costs and tracking</h3>
        <div className="tov-costs">
          <div>
            <div className="tov-cost-lbl">Fees paid <ReconTag /></div>
            <div className={`tov-cost-val ${summary && summary.fees_total !== 0 ? 'tov-down' : ''}`}>
              {fmtSignedOrDash(summary ? -Math.abs(summary.fees_total) : null)} <span className="tov-cost-unit">USDT</span>
            </div>
          </div>
          <div>
            <div className="tov-cost-lbl">Gross PnL <ReconTag /></div>
            <div className={`tov-cost-val ${signClass(summary?.realized_pnl_gross ?? null)}`}>
              {fmtSignedOrDash(summary?.realized_pnl_gross ?? null)} <span className="tov-cost-unit">USDT</span>
            </div>
          </div>
          <div>
            <div className="tov-cost-lbl">Net PnL <ReconTag /></div>
            <div className={`tov-cost-val ${signClass(realizedNet)}`}>
              {fmtSignedOrDash(realizedNet)} <span className="tov-cost-unit">USDT</span>
            </div>
          </div>
          <div>
            <div className="tov-cost-lbl">Tracked since</div>
            <div className="tov-cost-val tov-mute">{overview.sinceIso ? overview.sinceIso.slice(0, 10) : '—'}</div>
          </div>
        </div>
        <p className="tov-mute-xs" style={{ marginTop: 12 }}>
          TP +{tpPct !== null ? tpPct.toFixed(2) : '0.45'}% · fee {feeRate !== null ? (feeRate * 100).toFixed(3) : '0.050'}%/leg · {summary?.accounts_total ?? 2} accounts aggregated
        </p>
      </Card>

      {/* footer hint */}
      <p className="tov-mute-xs" style={{ fontSize: 11 }}>
        Read-only reconstructed monitoring · legacy journal at {payload.baseUrl || 'unconfigured'} · assembled {fmtShortTs(payload.assembledAt)} UTC
        {' '}· equity samples {equity?.equity.length ?? 0} · reconstructed figures are not exchange-confirmed PnL · compact net {fmtMoneyOrDash(realizedNet)} USDT.
      </p>
    </div>
  );
}
