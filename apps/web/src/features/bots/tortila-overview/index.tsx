import 'server-only';
import type {
  TortilaAdvancedMetrics,
  TortilaCalendar,
  TortilaDistribution,
  TortilaDrawdownSeries,
  TortilaMarks,
  TortilaMonthly,
  TortilaSymbolBreakdown,
  TortilaActivity,
  TortilaActivityItem,
} from '@wtc/bot-adapters';
import type { CanonicalMetrics, CanonicalPosition, CanonicalTrade, EquityPoint } from '@wtc/analytics';
import { Card, RiskWarningBanner } from '@wtc/ui';
import { AutoRefresh } from './auto-refresh';
import { Sparkline } from './sparkline';
import { EquityChart, DrawdownChart } from './equity-chart';
import { CalendarHeatmap } from './calendar-heatmap';
import { MonthlyBars } from './monthly-bars';
import { DistributionChart } from './distribution-chart';
import { SymbolContribution } from './symbol-bars';
import { PositionCard } from './position-card';
import { ActivityFeed } from './activity-feed';
import {
  fmtMoneyOrDash,
  fmtMoneyCompact,
  fmtNumberOrDash,
  fmtPctOrDash,
  fmtPf,
  fmtSignedOrDash,
  signClass,
  shortSymbol,
  fmtShortTs,
} from './format';
import type { TortilaOverviewPayload } from '../tortila-overview-data';

/** Inputs the page passes down from its server-side reads. */
export interface TortilaOverviewProps {
  /** WTC canonical metric snapshot (from the existing BotReadModel). */
  metrics: CanonicalMetrics | null;
  /** Open positions, canonicalized. */
  positions: CanonicalPosition[];
  /** Closed trades. */
  trades: CanonicalTrade[];
  /** Equity curve. */
  equityCurve: EquityPoint[];
  /** Journal extended payload (per-slice null/error). */
  payload: TortilaOverviewPayload;
  /** Mode label from /api/summary -> demo|live. */
  mode: 'demo' | 'live' | 'unknown';
  /** Whether the bot is currently at an all-time-high equity. */
  atAth: boolean;
  /** ISO timestamp of the start of the equity curve (first non-zero sample). */
  startDateIso: string | null;
  /** Today's net P&L from closed trades (UTC day). */
  todayPnl: number;
  /** Net combined P&L since start, percent. */
  pnlPctSinceStart: number;
  /** Summary fees + funding totals. */
  feesTotal: number;
  fundingTotal: number;
  /** Net P&L gross of fees (realized + funding). Used by the costs band. */
  netPnl: number;
}

/** Hero strip: equity number, mode pill, sparkline, headline KPIs. */
function Hero({
  mode,
  atAth,
  walletEquity,
  pnlPctSinceStart,
  firstEquity,
  todayPnl,
  spark,
  adv,
  pf,
}: {
  mode: 'demo' | 'live' | 'unknown';
  atAth: boolean;
  walletEquity: number;
  pnlPctSinceStart: number;
  firstEquity: number | null;
  todayPnl: number;
  spark: number[];
  adv: TortilaAdvancedMetrics | null;
  pf: number | null;
}) {
  const sharpe = adv?.performance.sharpe ?? null;
  const sortino = adv?.performance.sortino ?? null;
  const maxDd = adv?.drawdown.max_dd_pct ?? null;
  const tim = adv?.performance.time_in_market_pct ?? null;
  const expectancy = adv?.trades.expectancy ?? null;
  return (
    <section className="tov-hero">
      <div className="tov-hero-left">
        <div className="tov-hero-meta">
          <span className={`tov-chip ${mode === 'live' ? 'live' : 'demo'}`}>{(mode === 'unknown' ? 'DEMO' : mode).toUpperCase()}</span>
          <span className="tov-chip">Tortila . BingX{mode === 'demo' ? ' . VST' : ''}</span>
          {atAth && <span className="tov-chip ath">+ ATH</span>}
        </div>
        <div className="tov-hero-equity">
          <span className="tov-hero-equity-value tov-mono">{fmtMoneyOrDash(walletEquity, 2)}</span>
          <span className="tov-hero-equity-unit">USDT</span>
        </div>
        <div className="tov-hero-sub">
          <span className={`tov-mono ${signClass(pnlPctSinceStart)}`}>{fmtPctOrDash(pnlPctSinceStart, 2, true)}</span>
          <span>since start</span>
          <span className="tov-sep">.</span>
          <span className="tov-mono">init {firstEquity !== null ? Math.round(firstEquity).toLocaleString() : '—'}</span>
          <span className="tov-sep">.</span>
          <span>today <span className={`tov-mono ${signClass(todayPnl)}`}>{fmtSignedOrDash(todayPnl, 2)}</span></span>
        </div>
        <div className="tov-spark-wrap">
          <Sparkline values={spark} />
        </div>
      </div>
      <div className="tov-hero-right">
        <KpiCell label="Sharpe"        value={fmtNumberOrDash(sharpe, 2)} />
        <KpiCell label="Sortino"       value={fmtNumberOrDash(sortino, 2)} />
        <KpiCell label="Profit factor" value={fmtPf(pf)} />
        <KpiCell label="Max DD"        value={maxDd !== null ? `${maxDd.toFixed(2)}%` : 'n/a'} tone={maxDd && maxDd > 0 ? 'down' : 'neutral'} />
        <KpiCell label="Time in mkt"   value={tim !== null ? `${tim.toFixed(0)}%` : 'n/a'} />
        <KpiCell label="Expect/trade"  value={fmtSignedOrDash(expectancy ?? null, 2)} tone={expectancy !== null && expectancy < 0 ? 'down' : expectancy !== null && expectancy > 0 ? 'up' : 'neutral'} />
      </div>
    </section>
  );
}

function KpiCell({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="tov-kpi">
      <div className="tov-kpi-label">{label}</div>
      <div className={`tov-kpi-val ${tone === 'up' ? 'up' : tone === 'down' ? 'down' : ''}`}>{value}</div>
    </div>
  );
}

function PerformanceOverview({ adv, agg, pnlPctSinceStart, bestDay, worstDay }: {
  adv: TortilaAdvancedMetrics | null;
  agg: TortilaAdvancedMetrics['trades'] | null;
  pnlPctSinceStart: number;
  bestDay: { date: string | null; pnl: number } | null;
  worstDay: { date: string | null; pnl: number } | null;
}) {
  const per = adv?.performance.period_returns ?? null;
  return (
    <section className="tov-grid-3">
      <Card>
        <h3 className="tov-section-h">Returns</h3>
        <table className="tov-tbl-mini">
          <tbody>
            <ReturnRow label="Today"   v={per?.today_pct ?? null} />
            <ReturnRow label="7-day"   v={per?.d7_pct ?? null} />
            <ReturnRow label="30-day"  v={per?.d30_pct ?? null} />
            <ReturnRow label="90-day"  v={per?.d90_pct ?? null} />
            <ReturnRow label="YTD"     v={per?.ytd_pct ?? null} />
            <ReturnRow label="All time" v={pnlPctSinceStart} />
            <ReturnRow label="CAGR"    v={adv?.performance.cagr_pct ?? null} />
          </tbody>
        </table>
      </Card>
      <Card>
        <h3 className="tov-section-h">Trade stats</h3>
        <div className="tov-stat-grid">
          <Stat label="Trades" val={agg?.count ?? null} />
          <Stat label="Wins / Losses" valNode={(
            <>
              <span className="tov-up">{agg?.wins ?? 0}</span>
              {' / '}
              <span className="tov-down">{agg?.losses ?? 0}</span>
            </>
          )} />
          <Stat label="Win rate"   val={agg ? `${agg.win_rate_pct.toFixed(1)}%` : null} />
          <Stat label="Avg win"    val={agg ? <span className="tov-up">{fmtSignedOrDash(agg.avg_win)}</span> : null} />
          <Stat label="Avg loss"   val={agg ? <span className="tov-down">{fmtSignedOrDash(agg.avg_loss)}</span> : null} />
          <Stat label="Avg hold"   val={agg ? `${agg.avg_hold_hours.toFixed(1)}h` : null} />
          <Stat label="Trades/wk"  val={adv ? adv.performance.trades_per_week.toFixed(1) : null} />
          <Stat label="Max streak W/L" valNode={(
            <>
              <span className="tov-up">{agg?.max_consec_wins ?? 0}</span>
              {' / '}
              <span className="tov-down">{agg?.max_consec_losses ?? 0}</span>
            </>
          )} />
        </div>
      </Card>
      <Card>
        <h3 className="tov-section-h">Extremes</h3>
        <ExtrRow label="Best trade"  vClass="tov-up"   val={fmtSignedOrDash(agg?.largest_win ?? null)} />
        <ExtrRow label="Worst trade" vClass="tov-down" val={fmtSignedOrDash(agg?.largest_loss ?? null)} />
        <ExtrRow
          label={
            <>
              Best day {bestDay?.date && <span className="tov-mute-xs"> {bestDay.date}</span>}
            </>
          }
          vClass="tov-up"
          val={fmtSignedOrDash(bestDay?.pnl ?? null)}
        />
        <ExtrRow
          label={
            <>
              Worst day {worstDay?.date && <span className="tov-mute-xs"> {worstDay.date}</span>}
            </>
          }
          vClass="tov-down"
          val={fmtSignedOrDash(worstDay?.pnl ?? null)}
        />
        <ExtrRow label="Vol (daily)" val={adv?.performance.vol_daily_pct !== null && adv?.performance.vol_daily_pct !== undefined ? `${adv.performance.vol_daily_pct.toFixed(2)}%` : 'n/a'} />
        <ExtrRow
          label="Gross P / L"
          val={agg ? (
            <>
              <span className="tov-up">{fmtSignedOrDash(agg.gross_profit, 0)}</span>
              {' / '}
              <span className="tov-down">{fmtSignedOrDash(-Math.abs(agg.gross_loss), 0)}</span>
            </>
          ) : '—'}
        />
      </Card>
    </section>
  );
}

function ReturnRow({ label, v }: { label: string; v: number | null }) {
  return (
    <tr>
      <td className="tov-lbl">{label}</td>
      <td className={`tov-num tov-mono ${signClass(v)}`}>{fmtPctOrDash(v, 2, true)}</td>
    </tr>
  );
}

function Stat({ label, val, valNode }: { label: string; val?: number | string | null | React.ReactNode; valNode?: React.ReactNode }) {
  return (
    <div className="tov-stat">
      <div className="tov-lbl">{label}</div>
      <div className="tov-val tov-mono">{valNode ?? (val === null || val === undefined ? '—' : val)}</div>
    </div>
  );
}

function ExtrRow({ label, val, vClass = '' }: { label: React.ReactNode; val: React.ReactNode; vClass?: string }) {
  return (
    <div className="tov-extr-row">
      <span className="tov-lbl">{label}</span>
      <span className={`tov-val tov-mono ${vClass}`}>{val}</span>
    </div>
  );
}

function RiskPanel({ adv }: { adv: TortilaAdvancedMetrics | null }) {
  const p = adv?.performance;
  const dd = adv?.drawdown;
  const ddStats = (label: string, value: React.ReactNode, sub?: string) => (
    <div className="tov-mini-card">
      <div className="tov-mini-lbl">{label}</div>
      <div className="tov-mini-val tov-mono">{value}</div>
      {sub && <div className="tov-mini-sub">{sub}</div>}
    </div>
  );
  return (
    <section>
      <h3 className="tov-section-h-outer">Risk panel</h3>
      <div className="tov-mini-grid">
        {ddStats('Sharpe',   fmtNumberOrDash(p?.sharpe ?? null, 2),   'annualised')}
        {ddStats('Sortino',  fmtNumberOrDash(p?.sortino ?? null, 2),  'downside-only')}
        {ddStats('Calmar',   fmtNumberOrDash(p?.calmar ?? null, 2),   'CAGR / MaxDD')}
        {ddStats('Recovery', fmtNumberOrDash(p?.recovery_factor ?? null, 2), 'return / DD')}
        {ddStats('Max DD %', <span className="tov-down">{dd ? `${dd.max_dd_pct.toFixed(2)}%` : 'n/a'}</span>,  dd ? `${(-Math.abs(dd.max_dd_usd)).toFixed(2)} USDT` : undefined)}
        {ddStats('Current DD',
          <span className={dd && dd.current_dd_pct > 0 ? 'tov-down' : 'tov-up'}>
            {dd ? `${dd.current_dd_pct.toFixed(2)}%` : 'n/a'}
          </span>,
          dd && dd.current_dd_pct === 0 ? 'at ATH' : 'underwater')}
        {ddStats('DD duration', dd ? `${dd.max_dd_duration_days.toFixed(0)}d` : 'n/a', dd ? `longest UW ${dd.longest_underwater_days.toFixed(0)}d` : undefined)}
        {ddStats('Vol (daily)', p?.vol_daily_pct !== null && p?.vol_daily_pct !== undefined ? `${p.vol_daily_pct.toFixed(2)}%` : 'n/a', 'stdev of daily ret')}
      </div>
    </section>
  );
}

export function TortilaOverview({
  metrics,
  positions,
  trades,
  equityCurve,
  payload,
  mode,
  atAth,
  startDateIso,
  todayPnl,
  pnlPctSinceStart,
  feesTotal,
  fundingTotal,
  netPnl,
}: TortilaOverviewProps) {
  const adv = payload.advanced.data;
  const symBreakdown: TortilaSymbolBreakdown | null = payload.symbolBreakdown.data;
  const monthly: TortilaMonthly | null = payload.monthly.data;
  const calendar: TortilaCalendar | null = payload.calendar.data;
  const distribution: TortilaDistribution | null = payload.distribution.data;
  const ddSeries: TortilaDrawdownSeries | null = payload.drawdownSeries.data;
  const marks: TortilaMarks | null = payload.marks.data;
  const activity: TortilaActivity | null = payload.activity.data;

  // Hero data from CanonicalMetrics (which uses equityCurve as its source of truth).
  const walletEquity = metrics?.walletEquity ?? equityCurve.at(-1)?.equity ?? 0;
  const firstEquity = metrics?.firstEquity ?? equityCurve[0]?.equity ?? null;
  const spark = equityCurve.slice(-200).map((p) => p.equity);

  // Open positions enriched with live marks (the only place we touch /api/marks).
  const nowMs = Date.now();
  const positionCards = positions.map((p) => {
    const symbol = p.symbol;
    const mark = marks?.marks[symbol] ?? null;
    const lastEntry = (p as CanonicalPosition & { lastEntryPrice?: number }).entryPrice ?? p.entryPrice;
    return (
      <PositionCard
        key={symbol}
        symbol={symbol}
        side={p.side}
        units={p.units ?? 1}
        system={1}
        totalQty={p.qty}
        avgEntry={p.entryPrice}
        lastEntry={lastEntry}
        stop={p.stopPrice ?? null}
        hasTp={Boolean(p.hasTp)}
        openedAtMs={p.openedAt ?? null}
        mark={mark}
        nowMs={nowMs}
      />
    );
  });

  // Trade table: most recent 30 closed trades.
  const recentTrades = trades.filter((t) => t.closedAt !== null).slice(0, 30);

  const sectionUnavailable = (msg: string | null) => (msg ? (
    <RiskWarningBanner severity="info" title="Section unavailable" detail={msg} />
  ) : null);

  // Mixed activity: prefer the journal feed, but fall back to a compact built-from-trades stream
  // when /api/activity is unavailable (or no items).
  const activityItems: TortilaActivityItem[] = activity?.rows.length
    ? activity.rows
    : recentTrades.slice(0, 15).map((t): TortilaActivityItem => ({
        ts: new Date(t.closedAt!).toISOString(),
        kind: 'trade',
        symbol: t.symbol,
        side: t.side,
        label: t.exitReason ?? 'closed',
        detail: `${t.side.toUpperCase()} qty=${t.qty.toFixed(4)} ret=${(t.retPct ?? 0).toFixed(2)}%`,
        net_pnl: t.realizedPnl + t.funding - t.fee,
      }));

  return (
    <div className="wtc-stack" data-testid="tortila-overview">
      <div className="wtc-spread" style={{ flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold2)', fontWeight: 700 }}>
            Tortila Bot - Live overview
          </span>
        </div>
        <AutoRefresh
          enabled={payload.configured}
          initialServerTs={payload.assembledAt}
          intervalMs={30_000}
        />
      </div>

      <Hero
        mode={mode}
        atAth={atAth}
        walletEquity={walletEquity}
        pnlPctSinceStart={pnlPctSinceStart}
        firstEquity={firstEquity}
        todayPnl={todayPnl}
        spark={spark}
        adv={adv}
        pf={metrics?.profitFactor ?? null}
      />

      {!payload.configured && (
        <RiskWarningBanner
          severity="warning"
          title="Live data not configured"
          detail={payload.advanced.error ?? 'The page is rendering only the data the WTC worker has persisted. Set BOT_ADAPTER_MODE=read-only, TORTILA_JOURNAL_URL, and JOURNAL_READ_TOKEN to fetch the extended Tortila journal data set.'}
        />
      )}

      <PerformanceOverview
        adv={adv}
        agg={adv?.trades ?? null}
        pnlPctSinceStart={pnlPctSinceStart}
        bestDay={adv?.best_day ?? null}
        worstDay={adv?.worst_day ?? null}
      />

      <Card title="Equity curve & drawdown">
        {equityCurve.length >= 2 ? (
          <>
            <EquityChart
              ts={equityCurve.map((p) => new Date(p.t).toISOString())}
              equity={equityCurve.map((p) => p.equity)}
              initialEquity={firstEquity}
              height={260}
            />
            {ddSeries && ddSeries.dd_pct.length >= 2 && (
              <DrawdownChart ts={ddSeries.ts} ddPct={ddSeries.dd_pct} height={120} />
            )}
          </>
        ) : (
          <div className="tov-empty-mini">Equity history will appear once the bot snapshots equity (typically every 15 min).</div>
        )}
        {ddSeries === null && payload.drawdownSeries.error && (
          <div className="tov-mute-xs" style={{ marginTop: 8 }}>Drawdown series: {payload.drawdownSeries.error}</div>
        )}
      </Card>

      <RiskPanel adv={adv} />

      <Card title={`Open positions . ${positions.length} active`}>
        {positions.length === 0 ? (
          <div className="tov-empty-mini">No open positions. Bot is waiting for the next breakout signal.</div>
        ) : (
          <>
            <div className="tov-pos-grid">{positionCards}</div>
            {marks && (
              <div className="tov-mute-xs" style={{ marginTop: 10 }}>
                marks {marks.stale ? '(stale)' : '(fresh, 30s cache)'} . refreshed {fmtShortTs(marks.ts)} UTC
              </div>
            )}
            {!marks && payload.marks.error && (
              <div className="tov-mute-xs" style={{ marginTop: 8 }}>marks: {payload.marks.error}</div>
            )}
          </>
        )}
      </Card>

      <Card title="Symbol contribution . net P&L per symbol">
        {symBreakdown ? (
          <SymbolContribution rows={symBreakdown.rows} />
        ) : (
          sectionUnavailable(payload.symbolBreakdown.error) ?? <div className="tov-empty-mini">No data.</div>
        )}
      </Card>

      <section className="tov-grid-2">
        <Card title="Monthly returns">
          {monthly ? (
            <MonthlyBars rows={monthly.rows} />
          ) : (
            sectionUnavailable(payload.monthly.error) ?? <div className="tov-empty-mini">No data.</div>
          )}
        </Card>
        <Card title="Daily P&L heatmap . last 26 weeks">
          {calendar ? (
            <>
              <CalendarHeatmap calendar={calendar} />
              <div className="tov-cal-legend">
                <span>less</span>
                <span className="tov-cal-leg-cell" style={{ background: 'rgba(255,107,116,0.6)' }} />
                <span className="tov-cal-leg-cell" style={{ background: 'rgba(255,107,116,0.32)' }} />
                <span className="tov-cal-leg-cell" style={{ background: 'rgba(255,255,255,0.04)' }} />
                <span className="tov-cal-leg-cell" style={{ background: 'rgba(84,214,161,0.32)' }} />
                <span className="tov-cal-leg-cell" style={{ background: 'rgba(84,214,161,0.6)' }} />
                <span>more</span>
              </div>
            </>
          ) : (
            sectionUnavailable(payload.calendar.error) ?? <div className="tov-empty-mini">No data.</div>
          )}
        </Card>
      </section>

      <Card title="P&L distribution . histogram of trade net P&L">
        {distribution ? (
          <DistributionChart data={distribution} />
        ) : (
          sectionUnavailable(payload.distribution.error) ?? <div className="tov-empty-mini">No closed trades yet.</div>
        )}
      </Card>

      <Card title="Trade history . last 30 closed">
        {recentTrades.length === 0 ? (
          <div className="tov-empty-mini">No closed trades.</div>
        ) : (
          <div className="wtc-table-wrap">
            <table className="tov-trade-table">
              <thead>
                <tr>
                  <th>Closed</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th className="num">U</th>
                  <th className="num">Entry</th>
                  <th className="num">Exit</th>
                  <th className="num">Ret%</th>
                  <th className="num">Hold</th>
                  <th className="num">Gross</th>
                  <th className="num">Fees</th>
                  <th className="num">Fund</th>
                  <th className="num">Net</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t) => {
                  const net = t.realizedPnl - t.fee + t.funding;
                  const upDown = signClass(net);
                  return (
                    <tr key={t.id}>
                      <td data-label="Closed">{fmtShortTs(t.closedAt ? new Date(t.closedAt).toISOString() : null)}</td>
                      <td data-label="Symbol">{shortSymbol(t.symbol)}</td>
                      <td data-label="Side"><span className={`tov-chip ${t.side}`}>{t.side.toUpperCase()}</span></td>
                      <td data-label="U" className="num">—</td>
                      <td data-label="Entry" className="num">{t.entryPrice !== undefined ? t.entryPrice.toFixed(4) : '—'}</td>
                      <td data-label="Exit" className="num">{t.exitPrice !== undefined ? t.exitPrice.toFixed(4) : '—'}</td>
                      <td data-label="Ret%" className={`num ${signClass(t.retPct ?? null)}`}>{t.retPct !== undefined ? `${(t.retPct >= 0 ? '+' : '')}${t.retPct.toFixed(2)}%` : '—'}</td>
                      <td data-label="Hold" className="num">{t.holdHours !== undefined ? `${t.holdHours.toFixed(1)}h` : '—'}</td>
                      <td data-label="Gross" className={`num ${signClass(t.realizedPnl)}`}>{fmtSignedOrDash(t.realizedPnl)}</td>
                      <td data-label="Fees" className="num tov-down">{(-Math.abs(t.fee)).toFixed(2)}</td>
                      <td data-label="Fund" className={`num ${signClass(t.funding)}`}>{fmtSignedOrDash(t.funding)}</td>
                      <td data-label="Net" className={`num ${upDown}`}>{fmtSignedOrDash(net)}</td>
                      <td data-label="Reason">{t.exitReason ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Activity feed . trades + safety + decisions (newest first)">
        <ActivityFeed items={activityItems.slice(0, 30)} />
        {!activity && payload.activity.error && (
          <div className="tov-mute-xs" style={{ marginTop: 8 }}>activity: {payload.activity.error}</div>
        )}
      </Card>

      <Card>
        <h3 className="tov-section-h">Costs and tracking</h3>
        <div className="tov-costs">
          <div>
            <div className="tov-cost-lbl">Fees paid</div>
            <div className={`tov-cost-val ${feesTotal === 0 ? '' : 'tov-down'}`}>
              {fmtSignedOrDash(-Math.abs(feesTotal))} <span className="tov-cost-unit">USDT</span>
            </div>
          </div>
          <div>
            <div className="tov-cost-lbl">Funding (net)</div>
            <div className={`tov-cost-val ${signClass(fundingTotal)}`}>
              {fmtSignedOrDash(fundingTotal)} <span className="tov-cost-unit">USDT</span>
            </div>
          </div>
          <div>
            <div className="tov-cost-lbl">Tracked since</div>
            <div className="tov-cost-val tov-mute">
              {startDateIso ? startDateIso.slice(0, 10) : '—'}
            </div>
          </div>
          <div>
            <div className="tov-cost-lbl">Net combined</div>
            <div className={`tov-cost-val ${signClass(netPnl + fundingTotal)}`}>
              {fmtSignedOrDash(netPnl + fundingTotal)} <span className="tov-cost-unit">USDT</span>
            </div>
          </div>
        </div>
      </Card>

      {/* footer hint */}
      <p className="tov-mute-xs" style={{ fontSize: 11 }}>
        Read-only monitoring . Tortila journal at {payload.baseUrl || 'unconfigured'} . assembled {fmtShortTs(payload.assembledAt)} UTC
        {' '}. equity samples {equityCurve.length} . marks cached {marks?.ttl_sec ? `${marks.ttl_sec}s` : '—'}
        {' '}. compact equity {fmtMoneyCompact(walletEquity)} USDT.
      </p>
    </div>
  );
}
