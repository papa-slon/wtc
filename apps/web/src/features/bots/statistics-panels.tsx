import type { AdvancedAnalytics, CanonicalMetrics, CanonicalPosition, CanonicalTrade, EquityPoint } from '@wtc/analytics';
import { computeAdvancedAnalytics, filterZeroEquity } from '@wtc/analytics';
import { Card, EmptyState, MetricCard, MetricValue, RiskWarningBanner, StatusPill } from '@wtc/ui';
import { fmtDateTime, fmtMoney, fmtNum, fmtPf, fmtPct } from '@/lib/format';
import type { BotMeta } from './meta';
import type { LegacyRuntimeSymbolConfig, LegacyStageConfig, LegacySymbolConfig } from './config';

function netTrade(t: CanonicalTrade): number {
  return t.realizedPnl - t.fee + t.funding;
}

function closedTrades(trades: CanonicalTrade[]): CanonicalTrade[] {
  return trades.filter((t) => t.closedAt !== null);
}

function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

function pct(from: number, to: number): number | null {
  if (!Number.isFinite(from) || from <= 0) return null;
  return Math.round(((to / from - 1) * 100) * 100) / 100;
}

interface MonthlyRow {
  month: string;
  start: number;
  end: number;
  pnl: number;
  retPct: number | null;
}

function monthlyRows(points: EquityPoint[]): MonthlyRow[] {
  const byMonth = new Map<string, { start: number; end: number; startT: number; endT: number }>();
  for (const p of filterZeroEquity(points).sort((a, b) => a.t - b.t)) {
    const key = monthKey(p.t);
    const existing = byMonth.get(key);
    if (!existing) {
      byMonth.set(key, { start: p.equity, end: p.equity, startT: p.t, endT: p.t });
      continue;
    }
    if (p.t < existing.startT) {
      existing.start = p.equity;
      existing.startT = p.t;
    }
    if (p.t >= existing.endT) {
      existing.end = p.equity;
      existing.endT = p.t;
    }
  }
  return [...byMonth.entries()]
    .map(([month, r]) => ({ month, start: r.start, end: r.end, pnl: r.end - r.start, retPct: pct(r.start, r.end) }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);
}

interface ExitRow {
  reason: string;
  count: number;
  net: number;
}

function exitRows(trades: CanonicalTrade[]): ExitRow[] {
  const rows = new Map<string, ExitRow>();
  for (const t of closedTrades(trades)) {
    const reason = (t.exitReason ?? (t.realizedPnl >= 0 ? 'profit_close' : 'loss_close')).replaceAll('_', ' ');
    const row = rows.get(reason) ?? { reason, count: 0, net: 0 };
    row.count += 1;
    row.net += netTrade(t);
    rows.set(reason, row);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || b.net - a.net);
}

function TortilaJournalConfidencePanel({
  positions,
  trades,
  equity,
  markUnavailable,
}: {
  positions: CanonicalPosition[];
  trades: CanonicalTrade[];
  equity: EquityPoint[];
  markUnavailable: boolean;
}) {
  const closed = closedTrades(trades).length;
  const hasJournalEvidence = closed > 0 || equity.length > 0 || positions.length > 0;
  return (
    <Card title="Tortila journal confidence">
      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Journal trades" value={fmtNum(closed)} sub="persisted closed-trade rows" tone={closed > 0 ? 'up' : undefined} />
        <MetricCard label="Equity samples" value={fmtNum(equity.length)} sub="persisted curve points" tone={equity.length > 0 ? 'up' : undefined} />
        <MetricCard label="Open positions" value={fmtNum(positions.length)} sub={markUnavailable ? 'mark price gated in real adapter' : 'journal exposure snapshot'} />
        <MetricCard label="Live source calls" value="disabled" sub="no exchange or /api/marks probe" />
      </div>
      <RiskWarningBanner
        severity={hasJournalEvidence ? 'info' : 'warning'}
        title={hasJournalEvidence ? 'Persisted journal source' : 'Journal evidence pending'}
        detail={hasJournalEvidence
          ? 'Tortila PF, win rate, drawdown, equity, and trade quality are computed only from persisted WTC journal snapshots for this user. This statistics page does not call /api/marks, a live exchange, start/stop, or apply config.'
          : 'Tortila analytics stay incomplete until a read-only worker snapshot writes user-scoped journal trades, positions, or equity rows. Health alone is not treated as performance proof.'}
      />
    </Card>
  );
}

interface DrawdownPoint {
  t: number;
  equity: number;
  peak: number;
  ddPct: number;
}

function drawdownPoints(points: EquityPoint[]): DrawdownPoint[] {
  const curve = filterZeroEquity(points).sort((a, b) => a.t - b.t);
  let peak = curve[0]?.equity ?? 0;
  return curve.map((p) => {
    if (p.equity > peak) peak = p.equity;
    return {
      t: p.t,
      equity: p.equity,
      peak,
      ddPct: peak > 0 ? Math.round(((peak - p.equity) / peak) * 10_000) / 100 : 0,
    };
  });
}

function positionRiskRows(positions: CanonicalPosition[]): Array<CanonicalPosition & { notional: number; stopRiskPct: number | null }> {
  return positions
    .map((p) => {
      const notional = p.qty * p.markPrice;
      const stopRiskPct =
        p.stopPrice != null && p.entryPrice > 0
          ? Math.round((Math.abs(p.entryPrice - p.stopPrice) / p.entryPrice) * 10_000) / 100
          : p.stopDistPct ?? null;
      return { ...p, notional, stopRiskPct };
    })
    .sort((a, b) => b.notional - a.notional);
}

function latestActivity(trades: CanonicalTrade[], positions: CanonicalPosition[]): Array<{ id: string; ts: number; title: string; detail: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> {
  const tradeItems = closedTrades(trades).map((t) => {
    const net = netTrade(t);
    return {
      id: `trade-${t.id}`,
      ts: t.closedAt ?? t.openedAt,
      title: `${t.symbol} ${t.side} closed`,
      detail: `net ${fmtMoney(net)} (${t.exitReason ?? 'exit recorded'})`,
      tone: net >= 0 ? 'ok' as const : 'bad' as const,
    };
  });
  const positionItems = positions.map((p, i) => ({
    id: `position-${p.symbol}-${i}`,
    ts: p.openedAt ?? Date.now(),
    title: `${p.symbol} ${p.side} open`,
    detail: `entry ${fmtNum(p.entryPrice)} / stop ${p.stopPrice != null ? fmtNum(p.stopPrice) : 'not exposed'} / TP ${p.hasTp ? p.tpPrice != null ? fmtNum(p.tpPrice) : 'set' : 'none'}`,
    tone: 'warn' as const,
  }));
  return [...tradeItems, ...positionItems].sort((a, b) => b.ts - a.ts).slice(0, 10);
}

function MonthlyReturnsPanel({ points }: { points: EquityPoint[] }) {
  const rows = monthlyRows(points);
  return (
    <Card title="Monthly returns">
      {rows.length === 0 ? (
        <EmptyState title="No monthly return data" hint="The adapter needs a non-zero equity curve to calculate monthly returns." />
      ) : (
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr><th>Month</th><th>Start</th><th>End</th><th>PnL</th><th>Return</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month}>
                  <td data-label="Month" className="wtc-mono">{r.month}</td>
                  <td data-label="Start">{fmtMoney(r.start)}</td>
                  <td data-label="End">{fmtMoney(r.end)}</td>
                  <td data-label="PnL" className={r.pnl >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtMoney(r.pnl)}</td>
                  <td data-label="Return" className={(r.retPct ?? 0) >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtPct(r.retPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function DrawdownProfilePanel({ metrics, points }: { metrics: CanonicalMetrics | null; points: EquityPoint[] }) {
  const rows = drawdownPoints(points);
  const worst = rows.reduce<DrawdownPoint | null>((acc, row) => (!acc || row.ddPct > acc.ddPct ? row : acc), null);
  const latest = rows.at(-1) ?? null;
  return (
    <Card title="Drawdown profile">
      <div className="wtc-grid wtc-grid-3">
        <MetricCard label="Peak equity" value={fmtMoney(metrics?.peakEquity)} />
        <MetricCard label="Max drawdown" value={<MetricValue value={metrics?.maxDrawdownPct ?? null} suffix="%" />} tone="down" />
        <MetricCard label="Current drawdown" value={<MetricValue value={metrics?.currentDrawdownPct ?? null} suffix="%" />} tone="down" />
      </div>
      {rows.length === 0 ? (
        <div style={{ marginTop: 12 }}>
          <EmptyState title="No drawdown samples" hint="The adapter did not expose a usable equity curve." />
        </div>
      ) : (
        <div className="wtc-grid wtc-grid-2" style={{ marginTop: 12 }}>
          <div className="wtc-metric">
            <div className="label">Worst point</div>
            <div className="value wtc-down">{worst ? fmtPct(worst.ddPct) : '-'}</div>
            <div className="wtc-dim" style={{ fontSize: 11, marginTop: 4 }}>{worst ? fmtDateTime(worst.t) : 'No point'}</div>
          </div>
          <div className="wtc-metric">
            <div className="label">Latest equity vs peak</div>
            <div className="value">{latest ? `${fmtMoney(latest.equity)} / ${fmtMoney(latest.peak)}` : '-'}</div>
            <div className="wtc-dim" style={{ fontSize: 11, marginTop: 4 }}>Drawdown is computed after removing zero-equity artifacts.</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function ExitReasonsPanel({ trades }: { trades: CanonicalTrade[] }) {
  const rows = exitRows(trades);
  return (
    <Card title="Exit reasons">
      {rows.length === 0 ? (
        <EmptyState title="No exit-reason data" hint="Closed trades have not been exposed by this bot." />
      ) : (
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead><tr><th>Reason</th><th>Count</th><th>Net</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reason}>
                  <td data-label="Reason">{r.reason}</td>
                  <td data-label="Count">{r.count}</td>
                  <td data-label="Net" className={r.net >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtMoney(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function OpenRiskPanel({ positions, markUnavailable }: { positions: CanonicalPosition[]; markUnavailable: boolean }) {
  const rows = positionRiskRows(positions);
  const totalMargin = rows.reduce((sum, p) => sum + (p.marginUsed ?? 0), 0);
  const totalNotional = rows.reduce((sum, p) => sum + p.notional, 0);
  return (
    <Card title="Open risk exposure">
      <div className="wtc-grid wtc-grid-3">
        <MetricCard label="Open positions" value={rows.length} />
        <MetricCard label="Known margin" value={fmtMoney(totalMargin)} />
        <MetricCard label="Notional" value={markUnavailable ? 'N/A' : fmtMoney(totalNotional)} />
      </div>
      {rows.length === 0 ? (
        <div style={{ marginTop: 12 }}><EmptyState title="No open risk" /></div>
      ) : (
        <div className="wtc-table-wrap" style={{ marginTop: 12 }}>
          <table className="wtc-table">
            <thead><tr><th>Symbol</th><th>Side</th><th>Margin</th><th>Stop risk</th><th>Units/stage</th></tr></thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={`${p.symbol}-${i}`}>
                  <td data-label="Symbol">{p.symbol}</td>
                  <td data-label="Side">{p.side}</td>
                  <td data-label="Margin">{p.marginUsed != null ? fmtMoney(p.marginUsed) : '-'}</td>
                  <td data-label="Stop risk">{p.stopRiskPct != null ? fmtPct(p.stopRiskPct) : '-'}</td>
                  <td data-label="Units/stage">{p.units != null ? `${p.units} units` : p.stage != null ? `stage ${p.stage}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ActivityPanel({ trades, positions }: { trades: CanonicalTrade[]; positions: CanonicalPosition[] }) {
  const rows = latestActivity(trades, positions);
  return (
    <Card title="Activity feed">
      {rows.length === 0 ? (
        <EmptyState title="No recent activity" hint="Closed trades or open positions are required for the activity feed." />
      ) : (
        <div className="wtc-stack">
          {rows.map((row) => (
            <div key={row.id} className="wtc-spread" style={{ gap: 12, borderBottom: '1px solid var(--stroke)', paddingBottom: 8 }}>
              <div>
                <strong>{row.title}</strong>
                <div className="wtc-dim" style={{ fontSize: 12 }}>{row.detail}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusPill tone={row.tone}>{row.tone}</StatusPill>
                <div className="wtc-dim" style={{ fontSize: 11, marginTop: 4 }}>{fmtDateTime(row.ts)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function fmtHours(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '-';
  return `${n.toFixed(1)}h`;
}

function pnlToneClass(value: number | null): string | undefined {
  if (value === null || !Number.isFinite(value)) return undefined;
  return value >= 0 ? 'wtc-up' : 'wtc-down';
}

function ReturnsMatrixPanel({ advanced }: { advanced: AdvancedAnalytics }) {
  return (
    <Card title="Returns matrix">
      <div className="wtc-grid wtc-grid-3">
        {advanced.returns.map((row) => (
          <MetricCard
            key={row.label}
            label={row.label}
            value={fmtPct(row.returnPct)}
            sub={row.pnl === null ? undefined : fmtMoney(row.pnl)}
            tone={row.returnPct == null ? undefined : row.returnPct >= 0 ? 'up' : 'down'}
          />
        ))}
      </div>
    </Card>
  );
}

function RiskDiagnosticsPanel({ advanced }: { advanced: AdvancedAnalytics }) {
  return (
    <Card title="Risk diagnostics">
      <div className="wtc-grid wtc-grid-3">
        <MetricCard label="Sharpe" value={fmtNum(advanced.risk.sharpe)} />
        <MetricCard label="Sortino" value={fmtNum(advanced.risk.sortino)} />
        <MetricCard label="Calmar" value={fmtNum(advanced.risk.calmar)} />
        <MetricCard label="Recovery" value={fmtNum(advanced.risk.recoveryFactor)} />
        <MetricCard label="Daily volatility" value={fmtPct(advanced.risk.dailyVolatilityPct)} />
        <MetricCard label="Underwater" value={advanced.risk.longestUnderwaterDays == null ? '-' : `${advanced.risk.longestUnderwaterDays}d`} />
      </div>
    </Card>
  );
}

function TradeQualityPanel({ advanced }: { advanced: AdvancedAnalytics }) {
  const q = advanced.tradeQuality;
  return (
    <Card title="Trade quality">
      {q.closedTrades === 0 ? (
        <EmptyState title="No closed-trade quality data" hint="Closed trades are required for streaks, best/worst trade, and hold-time statistics." />
      ) : (
        <div className="wtc-grid wtc-grid-3">
          <MetricCard label="Trades/week" value={fmtNum(q.tradesPerWeek)} />
          <MetricCard label="Avg hold" value={fmtHours(q.avgHoldHours)} />
          <MetricCard label="Scratches" value={q.scratches} />
          <MetricCard label="Best trade" value={fmtMoney(q.bestTradeNet)} tone={q.bestTradeNet != null && q.bestTradeNet >= 0 ? 'up' : undefined} />
          <MetricCard label="Worst trade" value={fmtMoney(q.worstTradeNet)} tone={q.worstTradeNet != null ? 'down' : undefined} />
          <MetricCard label="Streaks" value={`${q.maxConsecutiveWins}W / ${q.maxConsecutiveLosses}L`} />
          <MetricCard label="Best day" value={fmtMoney(q.bestDayNet)} tone={q.bestDayNet != null && q.bestDayNet >= 0 ? 'up' : undefined} />
          <MetricCard label="Worst day" value={fmtMoney(q.worstDayNet)} tone={q.worstDayNet != null ? 'down' : undefined} />
          <MetricCard label="Closed trades" value={q.closedTrades} />
        </div>
      )}
    </Card>
  );
}

function SymbolContributionPanel({ advanced }: { advanced: AdvancedAnalytics }) {
  const rows = advanced.symbols;
  return (
    <Card title="Symbol contribution">
      {rows.length === 0 ? (
        <EmptyState title="No symbol contribution" hint="Closed-trade history is required for per-symbol contribution." />
      ) : (
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr><th>Symbol</th><th>Trades</th><th>Win</th><th>PF</th><th>Net</th><th>Share</th><th>Hold</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol}>
                  <td data-label="Symbol">{r.symbol}</td>
                  <td data-label="Trades">{r.trades}</td>
                  <td data-label="Win">{fmtPct(r.winRatePct)}</td>
                  <td data-label="PF">{fmtPf(r.profitFactor)}</td>
                  <td data-label="Net" className={pnlToneClass(r.net)}>{fmtMoney(r.net)}</td>
                  <td data-label="Share">{fmtPct(r.contributionPct)}</td>
                  <td data-label="Hold">{fmtHours(r.avgHoldHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CalendarHeatmapPanel({ advanced }: { advanced: AdvancedAnalytics }) {
  const rows = advanced.dailyPnl.slice(-35);
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.net)));
  return (
    <Card title="Daily PnL heatmap">
      {rows.length === 0 ? (
        <EmptyState title="No daily PnL data" hint="Closed trades are required for the calendar." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: 8 }}>
          {rows.map((row) => {
            const alpha = 0.08 + Math.min(Math.abs(row.net) / maxAbs, 1) * 0.22;
            const color = row.net >= 0 ? `rgba(84, 214, 161, ${alpha})` : `rgba(255, 107, 116, ${alpha})`;
            return (
              <div key={row.day} style={{ border: '1px solid var(--stroke)', borderRadius: 12, padding: 10, background: color, minHeight: 72 }}>
                <div className="wtc-mono" style={{ fontSize: 11 }}>{row.day.slice(5)}</div>
                <div className={row.net >= 0 ? 'wtc-up' : 'wtc-down'} style={{ fontWeight: 800, marginTop: 6 }}>{fmtMoney(row.net)}</div>
                <div className="wtc-dim" style={{ fontSize: 11, marginTop: 3 }}>{row.trades} trades</div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function DistributionPanel({ advanced }: { advanced: AdvancedAnalytics }) {
  const rows = advanced.distribution;
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  return (
    <Card title="PnL distribution">
      {rows.every((row) => row.count === 0) ? (
        <EmptyState title="No distribution data" hint="Closed trades are required for the PnL histogram." />
      ) : (
        <div className="wtc-stack">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="wtc-spread" style={{ gap: 8, fontSize: 12 }}>
                <span className="wtc-mono">{row.label}</span>
                <span className={pnlToneClass(row.net)}>{row.count} / {fmtMoney(row.net)}</span>
              </div>
              <div style={{ marginTop: 5, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{ width: `${(row.count / maxCount) * 100}%`, height: '100%', background: row.net >= 0 ? 'var(--green)' : 'var(--red)' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function signalLabel(row: LegacySymbolConfig): string {
  return row.useCci ? 'CCI' : 'RSI';
}

function providerShort(value: string | undefined): string {
  return value ? `${value.slice(0, 8)}...${value.slice(-4)}` : '-';
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function percentOrUnavailable(value: number | null): string {
  return value === null ? 'N/A' : fmtPct(value);
}

function slotStage(value: Record<string, unknown>): number | null {
  const stage = numberValue(value.stage);
  return stage > 0 ? stage : null;
}

function slotSignal(value: Record<string, unknown>): 'RSI' | 'CCI' | 'UNKNOWN' {
  const signal = stringValue(value.signal).toUpperCase();
  if (signal.includes('RSI')) return 'RSI';
  if (signal.includes('CCI')) return 'CCI';
  return 'UNKNOWN';
}

function normalizedSymbol(value: Record<string, unknown>): string {
  return stringValue(value.symbol).trim().toUpperCase();
}

interface LegacyStageUtilization {
  stage: number;
  rsiSlots: number;
  cciSlots: number;
  capacity: number;
  activeSlots: number;
  activeRsi: number;
  activeCci: number;
  utilizationPct: number | null;
}

interface LegacyClosedTradeSourceProofView {
  status: 'blocked_no_source' | 'ready_for_mapper' | 'unknown';
  canImportClosedTrades: boolean;
  missingRequirements: string[];
  blockerCount: number;
}

function sourceProofStatusLabel(sourceProof: LegacyClosedTradeSourceProofView | null | undefined): string {
  if (!sourceProof) return 'not evaluated';
  if (sourceProof.status === 'ready_for_mapper' && sourceProof.canImportClosedTrades) return 'mapper ready';
  if (sourceProof.status === 'blocked_no_source') return 'source blocked';
  return 'not evaluated';
}

function sourceProofStatusTone(sourceProof: LegacyClosedTradeSourceProofView | null | undefined): 'ok' | 'warn' | 'neutral' {
  if (sourceProof?.status === 'ready_for_mapper' && sourceProof.canImportClosedTrades) return 'ok';
  if (sourceProof?.status === 'blocked_no_source') return 'warn';
  return 'neutral';
}

function sourceProofMissingSummary(sourceProof: LegacyClosedTradeSourceProofView | null | undefined): string {
  if (!sourceProof) return 'worker proof summary pending';
  if (sourceProof.status === 'ready_for_mapper' && sourceProof.canImportClosedTrades) return 'source proof accepted; mapper tests still required';
  if (sourceProof.missingRequirements.length === 0) return 'source artifact missing';
  const preview = sourceProof.missingRequirements.slice(0, 3).join(', ');
  const rest = sourceProof.missingRequirements.length > 3 ? ` +${sourceProof.missingRequirements.length - 3}` : '';
  return `${preview}${rest}`;
}

function legacyStageUtilizationRows(
  stages: readonly LegacyStageConfig[],
  activeSlots: readonly Record<string, unknown>[],
): LegacyStageUtilization[] {
  const stageNumbers = new Set<number>();
  for (const stage of stages) stageNumbers.add(stage.stage);
  for (const slot of activeSlots) {
    const stage = slotStage(slot);
    if (stage !== null) stageNumbers.add(stage);
  }

  return [...stageNumbers]
    .sort((a, b) => a - b)
    .map((stageNumber) => {
      const stageConfig = stages.find((row) => row.stage === stageNumber);
      const stageSlots = activeSlots.filter((slot) => slotStage(slot) === stageNumber);
      const rsiSlots = stageConfig?.rsiSlots ?? 0;
      const cciSlots = stageConfig?.cciSlots ?? 0;
      const capacity = rsiSlots + cciSlots;
      const activeRsi = stageSlots.filter((slot) => slotSignal(slot) === 'RSI').length;
      const activeCci = stageSlots.filter((slot) => slotSignal(slot) === 'CCI').length;
      return {
        stage: stageNumber,
        rsiSlots,
        cciSlots,
        capacity,
        activeSlots: stageSlots.length,
        activeRsi,
        activeCci,
        utilizationPct: capacity > 0 ? Math.round((stageSlots.length / capacity) * 10_000) / 100 : null,
      };
    });
}

export function LegacyOperationsPanel({
  rows,
  stages,
  liveConfig,
  closedTradeCount = 0,
  closedTradeSourceProof,
}: {
  rows: readonly LegacyRuntimeSymbolConfig[];
  stages: readonly LegacyStageConfig[];
  liveConfig?: Record<string, unknown> | null;
  closedTradeCount?: number;
  closedTradeSourceProof?: LegacyClosedTradeSourceProofView | null;
}) {
  const active = rows.filter((row) => row.active);
  const rsi = rows.filter((row) => row.useRsi && !row.useCci);
  const cci = rows.filter((row) => row.useCci && !row.useRsi);
  const stageCapacity = stages.reduce((sum, row) => sum + row.rsiSlots + row.cciSlots, 0);
  const timeframes = [...new Set(rows.map((row) => row.timeframe))].join(', ');
  const providerCount = new Set(rows.map((row) => row.providerPubId).filter(Boolean)).size;
  const providerAccounts = asObjectArray(liveConfig?.providerAccounts);
  const activeSlots = asObjectArray(liveConfig?.activeSlots);
  const activeOrders = asObjectArray(liveConfig?.activeOrderSummary);
  const hasProviderSnapshot = !!liveConfig && (providerAccounts.length > 0 || rows.length > 0 || activeSlots.length > 0 || activeOrders.length > 0);
  const tpOrders = activeOrders.filter((row) => stringValue(row.note).toUpperCase() === 'TAKE_PROFIT').length;
  const averagingOrders = activeOrders.filter((row) => stringValue(row.note).toUpperCase() === 'AVERAGING').length;
  const entryOrders = activeOrders.filter((row) => {
    const note = stringValue(row.note).toUpperCase();
    return note === 'BUY' || note.includes('ENTRY');
  }).length;
  const stopOrders = activeOrders.filter((row) => {
    const note = stringValue(row.note).toUpperCase();
    return note === 'SL' || note.includes('STOP');
  }).length;
  const activeSlotRsi = activeSlots.filter((slot) => slotSignal(slot) === 'RSI').length;
  const activeSlotCci = activeSlots.filter((slot) => slotSignal(slot) === 'CCI').length;
  const activeSlotUnknown = activeSlots.filter((slot) => slotSignal(slot) === 'UNKNOWN').length;
  const stageUtilization = legacyStageUtilizationRows(stages, activeSlots);
  const stageUtilizationPct = stageCapacity > 0 ? Math.round((activeSlots.length / stageCapacity) * 10_000) / 100 : null;
  const slotSymbols = new Set(activeSlots.map(normalizedSymbol).filter(Boolean));
  const orderSymbols = new Set(activeOrders.map(normalizedSymbol).filter(Boolean));
  const coveredSlotSymbols = [...slotSymbols].filter((symbol) => orderSymbols.has(symbol)).length;
  const orderSymbolCoverage = slotSymbols.size > 0 ? `${coveredSlotSymbols}/${slotSymbols.size}` : activeOrders.length > 0 ? `${activeOrders.length} orders` : 'N/A';
  return (
    <div className="wtc-stack">
      <div>
        <div className="wtc-kicker">Legacy operations</div>
        <h3 style={{ margin: '4px 0 12px', fontSize: 20 }}>Averaging bot configuration coverage</h3>
      </div>
      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Active symbols" value={active.length} sub={hasProviderSnapshot ? `${rows.length} provider snapshot rows` : 'provider snapshot unavailable'} />
        <MetricCard label="Provider pub_id" value={providerAccounts.length || providerCount} sub={hasProviderSnapshot ? 'safe account identity' : 'mapping/snapshot pending'} />
        <MetricCard label="Signal split" value={`${rsi.length} RSI / ${cci.length} CCI`} />
        <MetricCard label="Stage capacity" value={stageCapacity} sub="RSI + CCI slots" />
        <MetricCard label="Active slots" value={activeSlots.length || '-'} sub={`${tpOrders} TP / ${averagingOrders} averaging orders`} />
      </div>
      <Card title="Legacy statistics cockpit">
        <div className="wtc-grid wtc-grid-4">
          <MetricCard
            label="Stage utilization"
            value={percentOrUnavailable(stageUtilizationPct)}
            sub={`${activeSlots.length} active slots / ${stageCapacity} configured`}
          />
          <MetricCard
            label="Active triggers"
            value={`${activeSlotRsi} RSI / ${activeSlotCci} CCI`}
            sub={activeSlotUnknown > 0 ? `${activeSlotUnknown} provider slots without signal label` : 'provider slot signals'}
          />
          <MetricCard
            label="Order-symbol coverage"
            value={orderSymbolCoverage}
            sub={`${entryOrders} entry / ${averagingOrders} averaging / ${tpOrders} TP / ${stopOrders} stop`}
          />
          <MetricCard
            label="Closed-trade history"
            value={closedTradeCount > 0 ? closedTradeCount : 'pending import'}
            sub={closedTradeCount > 0 ? 'closed imports available' : 'PF, win rate, realized PnL pending'}
          />
          <MetricCard
            label="Source-proof gate"
            value={sourceProofStatusLabel(closedTradeSourceProof)}
            sub={sourceProofMissingSummary(closedTradeSourceProof)}
            tone={closedTradeSourceProof?.status === 'ready_for_mapper' && closedTradeSourceProof.canImportClosedTrades ? 'up' : closedTradeSourceProof?.status === 'blocked_no_source' ? 'down' : undefined}
          />
        </div>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <StatusPill tone={hasProviderSnapshot ? 'neutral' : 'warn'}>{hasProviderSnapshot ? 'runtime snapshot scoped' : 'snapshot pending'}</StatusPill>
          <StatusPill tone={stageCapacity > 0 ? 'neutral' : 'warn'}>{stageCapacity > 0 ? 'stage map loaded' : 'stage map pending'}</StatusPill>
          <StatusPill tone={closedTradeCount > 0 ? 'ok' : 'warn'}>{closedTradeCount > 0 ? 'closed trades loaded' : 'closed trades pending'}</StatusPill>
          <StatusPill tone={sourceProofStatusTone(closedTradeSourceProof)}>{sourceProofStatusLabel(closedTradeSourceProof)}</StatusPill>
        </div>
      </Card>
      {!hasProviderSnapshot && (
        <RiskWarningBanner
          severity="warning"
          title="Provider runtime snapshot unavailable"
          detail="Legacy operational statistics require a mapped provider pub_id and a worker snapshot. Built-in defaults and saved WTC reference drafts are not shown as runtime evidence here."
        />
      )}
      {closedTradeCount === 0 && (
        <RiskWarningBanner
          severity="warning"
          title={closedTradeSourceProof?.status === 'blocked_no_source' ? 'Legacy source proof blocked' : 'Legacy closed-trade history pending'}
          detail={
            closedTradeSourceProof?.status === 'blocked_no_source'
              ? `Win rate, profit factor, realized PnL, and attribution stay hidden because no durable Legacy closed-trade source is proven. Missing proof: ${sourceProofMissingSummary(closedTradeSourceProof)}. Open slots, stage utilization, and active order coverage remain visible as runtime evidence.`
              : 'Win rate, profit factor, realized PnL, and attribution stay hidden until WTC imports closed trades for the mapped provider pub_id. Open slots, stage utilization, and active order coverage remain visible as runtime evidence.'
          }
        />
      )}
      {providerAccounts.length > 0 && (
        <Card title="Provider accounts">
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>pub_id</th><th>Market</th><th>Status</th><th>Balance</th><th>Symbols</th><th>Slots</th><th>Orders</th></tr></thead>
              <tbody>
                {providerAccounts.map((row) => {
                  const pubId = stringValue(row.pubId);
                  const running = row.running === true;
                  const quarantined = row.quarantined === true;
                  return (
                    <tr key={pubId}>
                      <td data-label="pub_id" className="wtc-mono">{providerShort(pubId)}</td>
                      <td data-label="Market">{stringValue(row.market) || 'BINGX'}</td>
                      <td data-label="Status">
                        <StatusPill tone={quarantined ? 'bad' : running ? 'ok' : 'warn'}>
                          {quarantined ? 'quarantined' : running ? 'running' : 'paused'}
                        </StatusPill>
                      </td>
                      <td data-label="Balance">{fmtMoney(numberValue(row.balance))}</td>
                      <td data-label="Symbols">{numberValue(row.symbols)}</td>
                      <td data-label="Slots">{numberValue(row.activeSlots)}</td>
                      <td data-label="Orders">{numberValue(row.activeOrders)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {activeSlots.length > 0 && (
        <Card title="Active slots">
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>pub_id</th><th>Symbol</th><th>Signal</th><th>Stage</th><th>Averaging count</th><th>Opened</th></tr></thead>
              <tbody>
                {activeSlots.map((row, i) => (
                  <tr key={`${stringValue(row.providerPubId)}-${stringValue(row.symbol)}-${i}`}>
                    <td data-label="pub_id" className="wtc-mono">{providerShort(stringValue(row.providerPubId))}</td>
                    <td data-label="Symbol">{stringValue(row.symbol)}</td>
                    <td data-label="Signal">{stringValue(row.signal).toUpperCase() || '-'}</td>
                    <td data-label="Stage">{numberValue(row.stage) || '-'}</td>
                    <td data-label="Averaging count">{numberValue(row.averagingCount)}</td>
                    <td data-label="Opened">{numberValue(row.openedAt) > 0 ? fmtDateTime(numberValue(row.openedAt)) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {activeOrders.length > 0 && (
        <Card title="Active order coverage">
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>pub_id</th><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th></tr></thead>
              <tbody>
                {activeOrders.slice(0, 24).map((row, i) => (
                  <tr key={`${stringValue(row.providerPubId)}-${stringValue(row.symbol)}-${stringValue(row.note)}-${i}`}>
                    <td data-label="pub_id" className="wtc-mono">{providerShort(stringValue(row.providerPubId))}</td>
                    <td data-label="Symbol">{stringValue(row.symbol)}</td>
                    <td data-label="Type">{stringValue(row.note) || '-'}</td>
                    <td data-label="Qty">{fmtNum(numberValue(row.qty))}</td>
                    <td data-label="Price">{fmtNum(numberValue(row.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Card title="Coverage matrix">
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <StatusPill tone="neutral">TF {timeframes || '-'}</StatusPill>
          <StatusPill tone={hasProviderSnapshot ? 'neutral' : 'warn'}>{hasProviderSnapshot ? 'DB snapshot evidence' : 'provider snapshot pending'}</StatusPill>
          <StatusPill tone="neutral">{providerAccounts.length || providerCount} pub_id grouped</StatusPill>
        </div>
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead><tr><th>pub_id</th><th>Symbol</th><th>TF</th><th>Signal</th><th>TP</th><th>Entry</th><th>Ladder</th><th>Balance</th><th>Lev</th><th>Stage</th></tr></thead>
            <tbody>
              {rows.slice(0, 16).map((row) => (
                <tr key={`${row.providerPubId ?? 'provider'}-${row.symbol}`}>
                  <td data-label="pub_id" className="wtc-mono">{providerShort(row.providerPubId)}</td>
                  <td data-label="Symbol">{row.symbol}</td>
                  <td data-label="TF">{row.timeframe}</td>
                  <td data-label="Signal">{signalLabel(row)}</td>
                  <td data-label="TP">{fmtPct(row.takeProfitPercent)}</td>
                  <td data-label="Entry">{fmtPct(row.initialEntryPercent)}</td>
                  <td data-label="Ladder">{row.averagingPercents} / {row.averagingVolumePercents}</td>
                  <td data-label="Balance">{fmtPct(row.useBalancePercent)}</td>
                  <td data-label="Lev">{row.leverage}x</td>
                  <td data-label="Stage">{row.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Stage utilization by trigger">
        {stageUtilization.length === 0 ? (
          <EmptyState title="No stage utilization data" hint="Stage capacity and active slot rows appear after a provider pub_id snapshot is mapped and persisted by the worker." />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>Stage</th><th>Capacity</th><th>Active slots</th><th>RSI active</th><th>CCI active</th><th>Utilization</th></tr></thead>
              <tbody>
                {stageUtilization.map((row) => (
                  <tr key={row.stage}>
                    <td data-label="Stage">{row.stage}</td>
                    <td data-label="Capacity">{row.capacity} ({row.rsiSlots} RSI / {row.cciSlots} CCI)</td>
                    <td data-label="Active slots">{row.activeSlots}</td>
                    <td data-label="RSI active">{row.activeRsi}</td>
                    <td data-label="CCI active">{row.activeCci}</td>
                    <td data-label="Utilization">{percentOrUnavailable(row.utilizationPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title="Stage slots">
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead><tr><th>Stage</th><th>RSI slots</th><th>CCI slots</th><th>Total</th></tr></thead>
            <tbody>
              {stages.map((row) => (
                <tr key={row.stage}>
                  <td data-label="Stage">{row.stage}</td>
                  <td data-label="RSI slots">{row.rsiSlots}</td>
                  <td data-label="CCI slots">{row.cciSlots}</td>
                  <td data-label="Total">{row.rsiSlots + row.cciSlots}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function BotJournalPanels({
  meta,
  metrics,
  positions,
  trades,
  equity,
  markUnavailable,
}: {
  meta: BotMeta;
  metrics: CanonicalMetrics | null;
  positions: CanonicalPosition[];
  trades: CanonicalTrade[];
  equity: EquityPoint[];
  markUnavailable: boolean;
}) {
  const advanced = computeAdvancedAnalytics({ trades, positions, equityCurve: equity });
  return (
    <div className="wtc-stack">
      <div>
        <div className="wtc-kicker">{meta.name} journal analytics</div>
        <h3 style={{ margin: '4px 0 12px', fontSize: 20 }}>Performance diagnostics</h3>
      </div>
      <TortilaJournalConfidencePanel positions={positions} trades={trades} equity={equity} markUnavailable={markUnavailable} />
      <div className="wtc-grid wtc-grid-2">
        <ReturnsMatrixPanel advanced={advanced} />
        <RiskDiagnosticsPanel advanced={advanced} />
      </div>
      <TradeQualityPanel advanced={advanced} />
      <div className="wtc-grid wtc-grid-2">
        <DrawdownProfilePanel metrics={metrics} points={equity} />
        <OpenRiskPanel positions={positions} markUnavailable={markUnavailable} />
      </div>
      <div className="wtc-grid wtc-grid-2">
        <MonthlyReturnsPanel points={equity} />
        <SymbolContributionPanel advanced={advanced} />
      </div>
      <div className="wtc-grid wtc-grid-2">
        <CalendarHeatmapPanel advanced={advanced} />
        <DistributionPanel advanced={advanced} />
      </div>
      <div className="wtc-grid wtc-grid-2">
        <ExitReasonsPanel trades={trades} />
        <ActivityPanel trades={trades} positions={positions} />
      </div>
    </div>
  );
}
