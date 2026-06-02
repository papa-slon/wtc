import type { CanonicalMetrics, CanonicalPosition, CanonicalTrade, EquityPoint } from '@wtc/analytics';
import { filterZeroEquity } from '@wtc/analytics';
import { Card, EmptyState, MetricCard, MetricValue, StatusPill } from '@wtc/ui';
import { fmtDateTime, fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import type { BotMeta } from './meta';

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

interface SymbolRow {
  symbol: string;
  trades: number;
  wins: number;
  losses: number;
  gross: number;
  fees: number;
  funding: number;
  net: number;
}

function symbolRows(trades: CanonicalTrade[]): SymbolRow[] {
  const rows = new Map<string, SymbolRow>();
  for (const t of closedTrades(trades)) {
    const row = rows.get(t.symbol) ?? { symbol: t.symbol, trades: 0, wins: 0, losses: 0, gross: 0, fees: 0, funding: 0, net: 0 };
    row.trades += 1;
    row.wins += t.realizedPnl > 0 ? 1 : 0;
    row.losses += t.realizedPnl < 0 ? 1 : 0;
    row.gross += t.realizedPnl;
    row.fees += t.fee;
    row.funding += t.funding;
    row.net += netTrade(t);
    rows.set(t.symbol, row);
  }
  return [...rows.values()].sort((a, b) => b.net - a.net);
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

function SymbolPerformancePanel({ trades }: { trades: CanonicalTrade[] }) {
  const rows = symbolRows(trades);
  return (
    <Card title="Symbol performance">
      {rows.length === 0 ? (
        <EmptyState title="No symbol breakdown" hint="Closed-trade history is required for per-symbol performance." />
      ) : (
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr><th>Symbol</th><th>Trades</th><th>Win rate</th><th>Gross</th><th>Fees</th><th>Net</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const winRate = r.trades > 0 ? Math.round((r.wins / r.trades) * 10_000) / 100 : null;
                return (
                  <tr key={r.symbol}>
                    <td data-label="Symbol">{r.symbol}</td>
                    <td data-label="Trades">{r.trades}</td>
                    <td data-label="Win rate">{fmtPct(winRate)}</td>
                    <td data-label="Gross" className={r.gross >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtMoney(r.gross)}</td>
                    <td data-label="Fees">{fmtMoney(r.fees)}</td>
                    <td data-label="Net" className={r.net >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtMoney(r.net)}</td>
                  </tr>
                );
              })}
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
  return (
    <div className="wtc-stack">
      <div>
        <div className="wtc-kicker">{meta.name} journal analytics</div>
        <h3 style={{ margin: '4px 0 12px', fontSize: 20 }}>Performance diagnostics</h3>
      </div>
      <div className="wtc-grid wtc-grid-2">
        <DrawdownProfilePanel metrics={metrics} points={equity} />
        <OpenRiskPanel positions={positions} markUnavailable={markUnavailable} />
      </div>
      <div className="wtc-grid wtc-grid-2">
        <MonthlyReturnsPanel points={equity} />
        <SymbolPerformancePanel trades={trades} />
      </div>
      <div className="wtc-grid wtc-grid-2">
        <ExitReasonsPanel trades={trades} />
        <ActivityPanel trades={trades} positions={positions} />
      </div>
    </div>
  );
}
