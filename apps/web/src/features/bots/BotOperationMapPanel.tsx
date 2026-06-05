import Link from 'next/link';
import { Card, MetricCard, StatusPill, buttonClasses } from '@wtc/ui';
import type { BotProductCode } from './meta';
import type { BotConfigReviewMetric } from './config-review';

type OperationMapAudience = 'user' | 'admin';

interface OperationRow {
  step: string;
  state: string;
  meaning: string;
  guardrail: string;
}

export interface BotOperationMapPanelProps {
  productCode: BotProductCode;
  sourceLabel: string;
  configMetrics?: readonly BotConfigReviewMetric[];
  symbolSummary?: string;
  signalSummary?: string;
  riskSummary?: string;
  runtimeSummary?: string;
  statisticsSummary?: string;
  adminSummary?: string;
  settingsHref?: string;
  statisticsHref?: string;
  dashboardHref?: string;
  audience?: OperationMapAudience;
  framed?: boolean;
  title?: string;
}

function metricValue(metrics: readonly BotConfigReviewMetric[] | undefined, label: string): string | undefined {
  return metrics?.find((metric) => metric.label === label)?.value;
}

function withSub(value: string | undefined, sub: string | undefined): string | undefined {
  if (!value) return undefined;
  return sub ? `${value} - ${sub}` : value;
}

function metricSummary(metrics: readonly BotConfigReviewMetric[] | undefined, label: string): string | undefined {
  const metric = metrics?.find((candidate) => candidate.label === label);
  return withSub(metric?.value, metric?.sub);
}

function buildOperationRows({
  productCode,
  sourceLabel,
  configMetrics,
  symbolSummary,
  signalSummary,
  riskSummary,
  runtimeSummary,
  statisticsSummary,
  adminSummary,
  audience,
}: Required<Pick<BotOperationMapPanelProps, 'productCode' | 'sourceLabel' | 'audience'>> &
  Pick<
    BotOperationMapPanelProps,
    'configMetrics' | 'symbolSummary' | 'signalSummary' | 'riskSummary' | 'runtimeSummary' | 'statisticsSummary' | 'adminSummary'
  >): OperationRow[] {
  const isLegacy = productCode === 'legacy_bot';
  const symbols = symbolSummary
    ?? metricSummary(configMetrics, isLegacy ? 'Active coins' : 'Coins configured')
    ?? 'No configured coins';
  const signal = signalSummary
    ?? metricSummary(configMetrics, isLegacy ? 'Signal split' : 'System mix')
    ?? (isLegacy ? 'RSI or CCI trigger per coin' : 'Turtle system per coin');
  const risk = riskSummary
    ?? metricSummary(configMetrics, isLegacy ? 'Stage capacity' : 'Risk profile')
    ?? (isLegacy ? 'Stage slot budget' : 'Portfolio and unit caps');
  const runtime = runtimeSummary
    ?? (isLegacy
      ? 'Provider pub_id mapping plus worker snapshots'
      : 'Encrypted key metadata plus journal snapshots');
  const statistics = statisticsSummary
    ?? (isLegacy
      ? 'Wallet balance, active slots, orders, positions, and imported trades where scoped'
      : 'Equity, drawdown, PF, win rate, positions, trades, and journal panels');
  const admin = adminSummary
    ?? (audience === 'admin'
      ? 'Selected user facts only; user settings and provider mappings stay read-only here'
      : 'Admins can inspect scoped settings and statistics without editing user-owned profiles');

  return [
    {
      step: '1. Settings source',
      state: sourceLabel,
      meaning: 'The bot resolves either the WTC system default, a user custom version, or the built-in fallback.',
      guardrail: 'Saving creates a WTC config version only; no live apply, start, or stop.',
    },
    {
      step: isLegacy ? '2. Coin trigger map' : '2. Coin strategy map',
      state: symbols,
      meaning: isLegacy
        ? `Each active coin chooses one trigger bucket. Current shape: ${signal}.`
        : `Each active coin chooses a Turtle system, timeframe, and risk profile. Current shape: ${signal}.`,
      guardrail: isLegacy
        ? 'A coin consumes one slot in its selected stage and RSI/CCI bucket.'
        : 'Exchange connection and strategy intent stay separate until an audited control adapter exists.',
    },
    {
      step: isLegacy ? '3. Stages, slots, averaging' : '3. Risk and position engine',
      state: risk,
      meaning: isLegacy
        ? 'Stages define capacity; coin rows define timeframe, trigger threshold, leverage, TP, and averaging ladder.'
        : 'The profile defines stop N, add step, max units, ATR period, TP, and portfolio caps.',
      guardrail: 'Invalid rows are rejected before saving and the previous active source remains unchanged.',
    },
    {
      step: '4. Runtime evidence',
      state: runtime,
      meaning: isLegacy
        ? 'Runtime facts come from already persisted provider-scoped snapshots, not from copying provider config into the form.'
        : 'Runtime facts come from saved metadata and read-only journal snapshots, not direct exchange control.',
      guardrail: 'Secrets and raw provider payloads are not rendered in the operation map.',
    },
    {
      step: '5. Statistics',
      state: statistics,
      meaning: 'The statistics view shows only mathematically safe rollups and keeps bot-specific metrics separate.',
      guardrail: 'Unavailable data stays empty or blocked; the UI does not fabricate zeros or green all-clear copy.',
    },
    {
      step: '6. Admin visibility',
      state: admin,
      meaning: 'Admins can audit access, selected-user settings source, scoped snapshots, warnings, and storage state.',
      guardrail: 'Global system defaults are separate from user-owned settings; this map does not add edit controls.',
    },
  ];
}

export function BotOperationMapPanel({
  productCode,
  sourceLabel,
  configMetrics,
  symbolSummary,
  signalSummary,
  riskSummary,
  runtimeSummary,
  statisticsSummary,
  adminSummary,
  settingsHref,
  statisticsHref,
  dashboardHref,
  audience = 'user',
  framed = true,
  title = 'Bot operation map',
}: BotOperationMapPanelProps) {
  const isLegacy = productCode === 'legacy_bot';
  const rows = buildOperationRows({
    productCode,
    sourceLabel,
    configMetrics,
    symbolSummary,
    signalSummary,
    riskSummary,
    runtimeSummary,
    statisticsSummary,
    adminSummary,
    audience,
  });
  const profileMetric = metricValue(configMetrics, isLegacy ? 'Active coins' : 'Coins configured') ?? symbolSummary ?? '-';
  const decisionMetric = metricValue(configMetrics, isLegacy ? 'Signal split' : 'System mix') ?? signalSummary ?? '-';
  const capacityMetric = metricValue(configMetrics, isLegacy ? 'Stage capacity' : 'Risk profile') ?? riskSummary ?? '-';

  const content = (
    <>
      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatusPill tone="neutral">{isLegacy ? 'RSI/CCI averaging' : 'Turtle trend engine'}</StatusPill>
        <StatusPill tone={audience === 'admin' ? 'warn' : 'neutral'}>{audience === 'admin' ? 'admin read-only' : 'user-owned config'}</StatusPill>
        <StatusPill tone="bad">live control disabled</StatusPill>
      </div>

      <div className="wtc-grid wtc-grid-4" style={{ marginBottom: 14 }}>
        <MetricCard label="Active source" value={sourceLabel} sub="resolved WTC settings" />
        <MetricCard label={isLegacy ? 'Coins / triggers' : 'Coins / systems'} value={profileMetric} sub={decisionMetric} />
        <MetricCard label={isLegacy ? 'Stage capacity' : 'Risk shape'} value={capacityMetric} />
        <MetricCard label="Runtime scope" value={isLegacy ? 'snapshot' : 'journal'} sub={audience === 'admin' ? 'selected user only' : 'read-only evidence'} />
      </div>

      <p className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>
        Read this left to right before saving or reviewing the bot: the map connects the visible settings to the runtime evidence and statistics without implying live control.
      </p>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Visible state</th>
              <th>How the bot uses it</th>
              <th>Safety boundary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.step}>
                <td data-label="Layer">{row.step}</td>
                <td data-label="Visible state">{row.state}</td>
                <td data-label="How the bot uses it" className="wtc-dim">{row.meaning}</td>
                <td data-label="Safety boundary" className="wtc-dim">{row.guardrail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(settingsHref || statisticsHref || dashboardHref) && (
        <div className="wtc-row" style={{ marginTop: 14 }}>
          {dashboardHref && <Link href={dashboardHref} className={buttonClasses('ghost')}>Open dashboard</Link>}
          {settingsHref && <Link href={settingsHref} className={buttonClasses('secondary')}>Open settings</Link>}
          {statisticsHref && <Link href={statisticsHref} className={buttonClasses('ghost')}>Open statistics</Link>}
        </div>
      )}
    </>
  );

  if (!framed) {
    return (
      <section className="wtc-stack" style={{ gap: 12, marginTop: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <p className="wtc-dim" style={{ margin: '4px 0 0', fontSize: 12 }}>
            Read-only map of source, strategy, runtime evidence, statistics, and admin visibility.
          </p>
        </div>
        {content}
      </section>
    );
  }

  return (
    <Card title={title}>
      {content}
    </Card>
  );
}
