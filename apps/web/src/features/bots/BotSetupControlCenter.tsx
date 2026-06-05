'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, MetricCard, StatusPill, buttonClasses } from '@wtc/ui';
import type { BotProductCode } from './meta';
import {
  LEGACY_STAGE_CAPACITY_DRAFT_EVENT,
  type BotConfigReviewMetric,
  type LegacyStageCapacityDraftEventDetail,
  type LegacyStageCapacityIssue,
} from './config-review';
import type { BotConfigErrorCopy } from './config-error-copy';

type CenterTone = 'ok' | 'warn' | 'bad' | 'neutral' | 'gold';

export type BotSetupControlMode = 'settings' | 'setup';
type ExchangeKeyState = 'not_checked' | 'missing' | 'metadata_saved' | 'vault_metadata_confirmed';
type ProviderPubIdState = 'not_checked' | 'missing' | 'runtime_snapshot' | 'db_mapping_confirmed' | 'ambiguous_mapping';

interface ControlStep {
  label: string;
  state: string;
  detail: string;
  tone: CenterTone;
  href?: string;
  actionLabel?: string;
}

export interface BotSetupControlCenterProps {
  productCode: BotProductCode;
  bot: string;
  mode: BotSetupControlMode;
  sourceLabel: string;
  source: 'user_override' | 'system_default' | 'built_in';
  canCustomize: boolean;
  hasSystemDefault: boolean;
  configMetrics: readonly BotConfigReviewMetric[];
  exchangeKeyState?: ExchangeKeyState;
  exchangeKeyCount?: number;
  legacyProviderState?: ProviderPubIdState;
  providerAccountCount?: number;
  hasConfig: boolean;
  activeIssue?: BotConfigErrorCopy;
  legacyStageCapacityIssue?: LegacyStageCapacityIssue;
}

interface LegacyStageCapacityDraftPreview {
  active: boolean;
  issue?: LegacyStageCapacityIssue;
}

type BuildStepsInput = BotSetupControlCenterProps & {
  draftStageCapacityPreview?: LegacyStageCapacityDraftPreview;
};

function metricValue(metrics: readonly BotConfigReviewMetric[], label: string): string | undefined {
  return metrics.find((metric) => metric.label === label)?.value;
}

function sourceStateLabel(source: BotSetupControlCenterProps['source'], sourceLabel: string): string {
  if (source === 'user_override') return sourceLabel;
  if (source === 'system_default') return sourceLabel;
  return 'Built-in fallback';
}

function sourceTone(source: BotSetupControlCenterProps['source']): CenterTone {
  if (source === 'user_override') return 'ok';
  if (source === 'system_default') return 'gold';
  return 'warn';
}

function plural(value: number, one: string, many: string): string {
  return value === 1 ? `${value} ${one}` : `${value} ${many}`;
}

function exchangeStateLabel(state: ExchangeKeyState, count: number): string {
  if (state === 'vault_metadata_confirmed') return 'WTC vault metadata confirmed';
  if (state === 'metadata_saved') return 'Exchange metadata saved';
  if (state === 'not_checked') return 'Not checked here';
  return count > 0 ? 'Vault metadata missing' : 'No key saved';
}

function exchangeStateDetail(state: ExchangeKeyState, count: number): string {
  if (state === 'vault_metadata_confirmed') {
    return `${plural(count, 'encrypted key record', 'encrypted key records')}; metadata-only vault readiness passed. Live exchange ping is still not run.`;
  }
  if (state === 'metadata_saved') {
    return `${plural(count, 'encrypted key record', 'encrypted key records')}; WTC has saved metadata, but vault confirmation or live ping is not green.`;
  }
  if (state === 'not_checked') return 'Open setup or settings to review WTC key metadata. This control center does not contact an exchange.';
  return 'Add an encrypted key before any future audited exchange ping can be discussed.';
}

function exchangeStateTone(state: ExchangeKeyState): CenterTone {
  if (state === 'vault_metadata_confirmed') return 'ok';
  if (state === 'metadata_saved' || state === 'not_checked') return 'warn';
  return 'warn';
}

function providerStateLabel(state: ProviderPubIdState, count: number): string {
  if (state === 'db_mapping_confirmed') return 'DB mapping confirmed';
  if (state === 'runtime_snapshot') return 'Snapshot evidence only';
  if (state === 'ambiguous_mapping') return 'Mapping conflict';
  if (state === 'not_checked') return 'Not checked here';
  return count > 0 ? 'Provider mapping pending' : 'No pub_id mapping';
}

function providerStateDetail(state: ProviderPubIdState, count: number): string {
  if (state === 'db_mapping_confirmed') {
    return `${plural(count, 'active pub_id mapping', 'active pub_id mappings')}; Legacy runtime facts are scoped to this user's bot instance.`;
  }
  if (state === 'ambiguous_mapping') {
    return `${plural(count, 'active pub_id mapping', 'active pub_id mappings')}; admin must reduce this to one scoped mapping before readiness can be green.`;
  }
  if (state === 'runtime_snapshot') {
    return `${plural(count, 'runtime pub_id snapshot', 'runtime pub_id snapshots')}; visible as read-only evidence, not a user-editable setting.`;
  }
  if (state === 'not_checked') return 'Open the dashboard or admin drilldown for scoped Legacy provider evidence.';
  return 'Admin mapping is required before runtime/provider facts can be attributed to this user.';
}

function providerStateTone(state: ProviderPubIdState): CenterTone {
  if (state === 'db_mapping_confirmed') return 'ok';
  if (state === 'ambiguous_mapping') return 'bad';
  return 'warn';
}

function issueAnchor(issue: BotConfigErrorCopy): string | undefined {
  if (!issue.row) return undefined;
  if (issue.target === 'tortila-row') return `tortila-symbol-${issue.row}`;
  if (issue.target === 'legacy-row') return `legacy-symbol-${issue.row}`;
  if (issue.target === 'legacy-stage') return `legacy-stage-${issue.row}`;
  return undefined;
}

function issueHref(issue: BotConfigErrorCopy, mode: BotSetupControlMode): string {
  if (issue.target === 'tortila-cap') return '#tortila-portfolio-caps';
  const anchor = issueAnchor(issue);
  if (anchor) return `#${anchor}`;
  return mode === 'setup' ? '#wizard-custom-settings' : '#custom-settings';
}

function issueActionLabel(issue: BotConfigErrorCopy): string {
  if (issue.target === 'tortila-cap') return 'Fix caps';
  if (issue.target === 'legacy-stage') return 'Fix stage';
  if (issue.target === 'legacy-row' || issue.target === 'tortila-row') return 'Fix row';
  return 'Review form';
}

function issueDetail(issue: BotConfigErrorCopy): string {
  if (issue.target === 'global') return 'Open the configuration form below; the failed draft was not saved or applied.';
  return issue.inlineHint ?? issue.detail;
}

function legacyCapacityHref(issue: LegacyStageCapacityIssue, mode: BotSetupControlMode, bot: string): string {
  const anchor = `legacy-stage-${issue.stageRow}`;
  return mode === 'setup' ? `/app/bots/${bot}/setup?step=strategy#${anchor}` : `#${anchor}`;
}

function legacyCapacityDetail(issue: LegacyStageCapacityIssue, draft: boolean): string {
  const prefix = draft ? 'Unsaved draft preview: ' : '';
  const suffix = draft
    ? 'Saving stores a WTC reference version only; it does not apply changes or run live diagnostics on the Legacy bot.'
    : 'Raise capacity, move coins, or pause extras before treating this profile as ready.';
  return `${prefix}Stage ${issue.stage} uses ${issue.rsiUsed}/${issue.rsiSlots} RSI slots and ${issue.cciUsed}/${issue.cciSlots} CCI slots across ${plural(issue.activeCoins, 'active coin', 'active coins')}. ${suffix}`;
}

function buildSteps({
  productCode,
  bot,
  mode,
  source,
  sourceLabel,
  canCustomize,
  hasSystemDefault,
  configMetrics,
  exchangeKeyState,
  exchangeKeyCount = 0,
  legacyProviderState,
  providerAccountCount = 0,
  hasConfig,
  activeIssue,
  legacyStageCapacityIssue,
  draftStageCapacityPreview,
}: BuildStepsInput): ControlStep[] {
  const isLegacy = productCode === 'legacy_bot';
  const settingsHref = `/app/bots/${bot}/settings#custom-settings`;
  const setupStrategyHref = `/app/bots/${bot}/setup?step=strategy#wizard-custom-settings`;
  const editHref = mode === 'setup' ? setupStrategyHref : settingsHref;
  const sourceDetail = source === 'user_override'
    ? 'Personal version is active. Admin system defaults cannot rewrite it.'
    : source === 'system_default'
      ? canCustomize
        ? 'WTC default is active; saving creates your own version.'
        : 'WTC default is active and user overrides are locked.'
      : hasSystemDefault
        ? 'A WTC default exists; choose it or save a custom version.'
        : 'No published default yet; save a personal version before treating this as configured.';

  const coinMetric = metricValue(configMetrics, isLegacy ? 'Active coins' : 'Coins configured') ?? (isLegacy ? 'No active coins' : 'No configured coins');
  const signalMetric = metricValue(configMetrics, isLegacy ? 'Signal split' : 'System mix') ?? (isLegacy ? 'RSI/CCI not reviewed' : 'Systems not reviewed');
  const capacityMetric = metricValue(configMetrics, isLegacy ? 'Stage capacity' : 'Risk profile') ?? (isLegacy ? 'No stage capacity' : 'Risk not reviewed');
  const resolvedExchangeState = exchangeKeyState ?? (exchangeKeyCount > 0 ? 'metadata_saved' : 'missing');
  const resolvedProviderState = legacyProviderState ?? (providerAccountCount > 0 ? 'runtime_snapshot' : 'missing');

  const steps: ControlStep[] = [
    {
      label: 'Default or custom',
      state: sourceStateLabel(source, sourceLabel),
      detail: sourceDetail,
      tone: sourceTone(source),
      href: editHref,
      actionLabel: canCustomize ? 'Edit profile' : 'Review profile',
    },
    {
      label: isLegacy ? 'Provider pub_id' : 'Exchange key',
      state: isLegacy ? providerStateLabel(resolvedProviderState, providerAccountCount) : exchangeStateLabel(resolvedExchangeState, exchangeKeyCount),
      detail: isLegacy
        ? providerStateDetail(resolvedProviderState, providerAccountCount)
        : exchangeStateDetail(resolvedExchangeState, exchangeKeyCount),
      tone: isLegacy ? providerStateTone(resolvedProviderState) : exchangeStateTone(resolvedExchangeState),
      href: isLegacy ? `/app/bots/${bot}/setup?step=strategy` : `/app/bots/${bot}/setup?step=key`,
      actionLabel: isLegacy ? 'Open strategy' : 'Open key step',
    },
    {
      label: isLegacy ? 'Coin and stage map' : 'Coin strategy map',
      state: coinMetric,
      detail: isLegacy
        ? `${signalMetric}; ${capacityMetric}. Each coin consumes one RSI or CCI slot in its stage.`
        : `${signalMetric}; ${capacityMetric}. Each coin keeps its own timeframe, system, risk, stop, add, and TP settings.`,
      tone: hasConfig ? 'ok' : 'warn',
      href: editHref,
      actionLabel: 'Open editor',
    },
    {
      label: 'Review and statistics',
      state: hasConfig ? 'Review available' : 'Save settings first',
      detail: isLegacy
        ? 'Dashboard and statistics use WTC config plus scoped provider snapshots when available.'
        : 'Dashboard and statistics use WTC config plus read-only journal snapshots when available.',
      tone: hasConfig ? 'ok' : 'warn',
      href: hasConfig ? `/app/bots/statistics?bot=${bot}` : editHref,
      actionLabel: hasConfig ? 'Open statistics' : 'Save first',
    },
    {
      label: 'User/admin boundary',
      state: 'Separated',
      detail: isLegacy
        ? 'Users save their own WTC profile. Admins publish system defaults and map Legacy pub_id; this page cannot edit another user or provider account.'
        : 'Users save their own WTC profile and key metadata. Admins publish system defaults; this page cannot operate the bot or expose secrets.',
      tone: 'neutral',
      href: `/app/bots/${bot}/settings`,
      actionLabel: 'Review source',
    },
    {
      label: 'Live control boundary',
      state: 'Disabled',
      detail: 'Start, stop, live diagnostics, live apply, and position-closing actions are not available from this setup flow.',
      tone: 'bad',
    },
  ];

  if (activeIssue) {
    steps.unshift({
      label: 'Validation issue',
      state: 'Needs fix',
      detail: issueDetail(activeIssue),
      tone: 'bad',
      href: issueHref(activeIssue, mode),
      actionLabel: issueActionLabel(activeIssue),
    });
  }

  const activeCapacityIssue = draftStageCapacityPreview?.active ? draftStageCapacityPreview.issue : legacyStageCapacityIssue;
  const isDraftCapacityIssue = !!draftStageCapacityPreview?.active && !!draftStageCapacityPreview.issue;
  if (isLegacy && activeCapacityIssue) {
    steps.splice(activeIssue ? 1 : 0, 0, {
      label: isDraftCapacityIssue ? 'Draft stage capacity warning' : 'Stage capacity warning',
      state: isDraftCapacityIssue ? 'Unsaved over capacity' : 'Over capacity',
      detail: legacyCapacityDetail(activeCapacityIssue, isDraftCapacityIssue),
      tone: 'warn',
      href: legacyCapacityHref(activeCapacityIssue, mode, bot),
      actionLabel: 'Review stage',
    });
  }

  return steps;
}

export function BotSetupControlCenter(props: BotSetupControlCenterProps) {
  const isLegacy = props.productCode === 'legacy_bot';
  const [draftStageCapacityPreview, setDraftStageCapacityPreview] = useState<LegacyStageCapacityDraftPreview>({ active: false });
  useEffect(() => {
    if (!isLegacy) return undefined;
    const handleDraftPreview = (event: Event) => {
      const detail = (event as CustomEvent<LegacyStageCapacityDraftEventDetail>).detail;
      setDraftStageCapacityPreview({ active: detail?.active === true, issue: detail?.issue });
    };
    window.addEventListener(LEGACY_STAGE_CAPACITY_DRAFT_EVENT, handleDraftPreview);
    return () => window.removeEventListener(LEGACY_STAGE_CAPACITY_DRAFT_EVENT, handleDraftPreview);
  }, [isLegacy]);

  const steps = buildSteps({ ...props, draftStageCapacityPreview });
  const connectionCount = isLegacy ? (props.providerAccountCount ?? 0) : (props.exchangeKeyCount ?? 0);
  const connectionState = isLegacy
    ? providerStateLabel(props.legacyProviderState ?? (connectionCount > 0 ? 'runtime_snapshot' : 'missing'), connectionCount)
    : exchangeStateLabel(props.exchangeKeyState ?? (connectionCount > 0 ? 'metadata_saved' : 'missing'), connectionCount);
  const readyCount = steps.filter((step) => step.tone === 'ok' || step.tone === 'gold').length;
  const attentionCount = steps.filter((step) => step.tone === 'warn' || step.tone === 'bad').length;

  return (
    <Card title="Bot setup control center">
      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatusPill tone={isLegacy ? 'gold' : 'neutral'}>{isLegacy ? 'Legacy averaging' : 'Tortila turtle'}</StatusPill>
        <StatusPill tone={props.source === 'user_override' ? 'ok' : props.source === 'system_default' ? 'gold' : 'warn'}>
          {sourceStateLabel(props.source, props.sourceLabel)}
        </StatusPill>
        <StatusPill tone="bad">live control disabled</StatusPill>
      </div>

      <div className="wtc-grid wtc-grid-4" style={{ marginBottom: 14 }}>
        <MetricCard label="Ready layers" value={readyCount} sub="safe to review" />
        <MetricCard label="Needs attention" value={attentionCount} sub="before live-control discussion" tone={attentionCount > 0 ? 'down' : undefined} />
        <MetricCard label={isLegacy ? 'pub_id mapping state' : 'vault metadata state'} value={connectionState} sub={plural(connectionCount, isLegacy ? 'record' : 'key record', isLegacy ? 'records' : 'key records')} />
        <MetricCard label={isLegacy ? 'Stage model' : 'Coin model'} value={isLegacy ? 'RSI/CCI slots' : 'per-coin systems'} sub="user-readable config" />
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Setup layer</th>
              <th>Status</th>
              <th>Visible state</th>
              <th>What it means</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.label}>
                <td data-label="Setup layer">{step.label}</td>
                <td data-label="Status"><StatusPill tone={step.tone}>{step.state}</StatusPill></td>
                <td data-label="Visible state">{step.state}</td>
                <td data-label="What it means" className="wtc-dim">{step.detail}</td>
                <td data-label="Action" className="wtc-td-action">
                  {step.href && step.actionLabel ? (
                    <Link href={step.href} className={buttonClasses('ghost')}>{step.actionLabel}</Link>
                  ) : (
                    <span className="wtc-dim">Read-only</span>
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
