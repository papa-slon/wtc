import Link from 'next/link';
import { Card, MetricCard, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import type { BotProductCode } from './meta';

interface CommandLayer {
  layer: string;
  state: string;
  detail: string;
  tone: Tone;
  href?: string;
  actionLabel?: string;
}

export interface BotStatisticsCommandCenterProps {
  productCode: BotProductCode;
  bot: string;
  botName: string;
  adapterMode: string;
  healthLabel: string;
  healthTone: Tone;
  workerHeartbeatLabel: string;
  workerHeartbeatTone: Tone;
  workerHeartbeatDetail: string;
  configSourceLabel: string;
  walletLabel: string;
  pnlLabel: string;
  pnlTone?: 'up' | 'down';
  winRateLabel: string;
  profitFactorLabel: string;
  drawdownLabel: string;
  openPositionsCount: number;
  tradesCount: number;
  equitySamples: number;
  scopedDataRows: number;
  warningCount: number;
  runtimeSummary: string;
  statisticsSummary: string;
  settingsSummary: string;
}

function plural(value: number, one: string, many: string): string {
  return value === 1 ? `${value} ${one}` : `${value} ${many}`;
}

function buildLayers(props: BotStatisticsCommandCenterProps): CommandLayer[] {
  const isLegacy = props.productCode === 'legacy_bot';
  return [
    {
      layer: '0. Worker heartbeat',
      state: props.workerHeartbeatLabel,
      detail: `${props.workerHeartbeatDetail} Statistics are not treated as green unless target='worker' and the product runtime snapshot are fresh.`,
      tone: props.workerHeartbeatTone,
    },
    {
      layer: '1. Data scope',
      state: `${props.adapterMode} / ${props.healthLabel}`,
      detail: `${props.scopedDataRows} evidence rows are loaded only after entitlement and user scope pass. ${props.runtimeSummary}`,
      tone: props.healthTone,
    },
    {
      layer: '2. Performance',
      state: props.walletLabel,
      detail: isLegacy
        ? `${props.statisticsSummary}. Legacy win rate and PF remain unavailable until closed-trade imports exist.`
        : `Net ${props.pnlLabel}; win ${props.winRateLabel}; PF ${props.profitFactorLabel}; ${props.statisticsSummary}.`,
      tone: props.pnlTone === 'down' ? 'bad' : 'ok',
    },
    {
      layer: '3. Risk',
      state: `${plural(props.openPositionsCount, 'open position', 'open positions')} / ${props.drawdownLabel}`,
      detail: `${plural(props.warningCount, 'warning notice', 'warning notices')} active or historical notice rows; risk state is shown without fabricating green status.`,
      tone: props.warningCount > 0 ? 'warn' : 'neutral',
      href: `/app/bots/${props.bot}/safety`,
      actionLabel: 'Open risk',
    },
    {
      layer: '4. Settings link',
      state: props.configSourceLabel,
      detail: props.settingsSummary,
      tone: props.configSourceLabel.toLowerCase().includes('fallback') ? 'warn' : 'ok',
      href: `/app/bots/${props.bot}/settings`,
      actionLabel: 'Open settings',
    },
    {
      layer: '5. Admin mirror',
      state: 'Read-only mirror',
      detail: 'Admins can inspect this user-scoped settings and statistics model in the selected-user drilldown; user-owned settings are not editable there.',
      tone: 'neutral',
    },
    {
      layer: '6. Live boundary',
      state: 'Mutation absent',
      detail: 'This statistics surface does not run exchange pings, provider probes, live config apply, position actions, or runtime start/stop.',
      tone: 'bad',
    },
  ];
}

export function BotStatisticsCommandCenter(props: BotStatisticsCommandCenterProps) {
  const rows = buildLayers(props);

  return (
    <Card
      title="Statistics command center"
      action={<StatusPill tone={props.healthTone}>{props.healthLabel}</StatusPill>}
    >
      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Worker heartbeat" value={props.workerHeartbeatLabel} tone={props.workerHeartbeatTone === 'bad' ? 'down' : props.workerHeartbeatTone === 'ok' ? 'up' : undefined} />
        <MetricCard label="Wallet / balance" value={props.walletLabel} />
        <MetricCard label="Net PnL" value={props.pnlLabel} tone={props.pnlTone} />
        <MetricCard label="Open positions" value={props.openPositionsCount} />
        <MetricCard label="Evidence rows" value={props.scopedDataRows} sub={`${props.tradesCount} trades / ${props.equitySamples} equity`} />
      </div>

      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <StatusPill tone={props.productCode === 'legacy_bot' ? 'gold' : 'neutral'}>
          {props.productCode === 'legacy_bot' ? 'Legacy averaging' : 'Tortila turtle'}
        </StatusPill>
        <StatusPill tone="neutral">{props.configSourceLabel}</StatusPill>
        <StatusPill tone={props.warningCount > 0 ? 'warn' : 'neutral'}>
          {plural(props.warningCount, 'notice', 'notices')}
        </StatusPill>
        <StatusPill tone={props.workerHeartbeatTone}>{props.workerHeartbeatLabel}</StatusPill>
        <StatusPill tone="bad">live control disabled</StatusPill>
      </div>

      <div className="wtc-table-wrap" aria-label={`${props.botName} statistics command center`} style={{ marginTop: 14 }}>
        <table className="wtc-table">
          <thead>
            <tr><th>Layer</th><th>Status</th><th>Meaning</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.layer}>
                <td data-label="Layer">{row.layer}</td>
                <td data-label="Status"><StatusPill tone={row.tone}>{row.state}</StatusPill></td>
                <td data-label="Meaning" className="wtc-dim">{row.detail}</td>
                <td data-label="Action" className="wtc-td-action">
                  {row.href && row.actionLabel ? (
                    <Link href={row.href} className={buttonClasses('ghost')}>{row.actionLabel}</Link>
                  ) : (
                    <button className={buttonClasses('ghost')} type="button" disabled>Inspect only</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
