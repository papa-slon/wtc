import type { AccessReason } from '@wtc/entitlements';
import type { BotHealth } from '@wtc/bot-adapters';
import type { BotProductCode } from './meta';

export type BotReadinessStatus = 'ready' | 'attention' | 'blocked' | 'readonly';

export interface BotReadinessItem {
  label: string;
  status: BotReadinessStatus;
  value: string;
  detail: string;
  href?: string;
  actionLabel?: string;
}

export type BotReadinessSurface = 'dashboard' | 'settings' | 'setup-review' | 'cabinet';

export interface BotRuntimeReadinessInput {
  adapterMode: 'mock' | 'real';
  readState: BotHealth['readState'] | null | undefined;
  label: string;
  detail?: string | null;
  processAlive?: boolean | null;
  lastSyncAt?: number | null;
  staleDataSeconds?: number | null;
  staleAfterSeconds?: number;
  workerCheckedAt?: number | null;
  workerAgeSeconds?: number | null;
  workerStaleAfterSeconds?: number;
  workerStatus?: string | null;
  workerCoreStatus?: string | null;
  workerBotContinuityStatus?: string | null;
  workerProductSnapshot?: string | null;
  workerProductReadState?: string | null;
  workerDetail?: string | null;
}

export interface BotStatisticsReadinessInput {
  metricsAvailable: boolean;
  issueKind?: 'blocked' | 'not_ready' | 'error' | null;
}

export interface BuildBotReadinessInput {
  productCode: BotProductCode;
  botSlug: 'tortila' | 'legacy';
  surface: BotReadinessSurface;
  accessAllowed: boolean;
  accessReason: AccessReason;
  exchangeKeyState?: 'not_checked' | 'missing' | 'metadata_saved' | 'vault_metadata_confirmed';
  exchangeKeyCount?: number;
  providerPubIdState?: 'not_checked' | 'missing' | 'runtime_snapshot' | 'db_mapping_confirmed' | 'ambiguous_mapping';
  providerAccountCount?: number;
  configSource: 'user_override' | 'system_default' | 'built_in';
  configSourceLabel: string;
  configSourceDetail?: string | null;
  runtime?: BotRuntimeReadinessInput | null;
  statistics?: BotStatisticsReadinessInput | null;
  includeOperationalRows?: boolean;
}

const ACCESS_LABELS: Record<AccessReason, string> = {
  allowed: 'Active',
  grace: 'Grace period',
  blocked_no_entitlement: 'Not owned',
  pending_payment: 'Pending payment',
  expired: 'Expired',
  revoked: 'Revoked',
  refunded: 'Refunded',
  chargeback: 'Chargeback',
  manual_review: 'Manual review',
  blocked_unknown_state: 'Unknown',
};

function accessStatus(reason: AccessReason): BotReadinessStatus {
  return reason === 'allowed' ? 'ready' : reason === 'grace' ? 'attention' : 'blocked';
}

export function providerPubIdSummary(count: number): string {
  return count === 1 ? '1 provider pub_id mapped' : `${count} provider pub_ids mapped`;
}

export function runtimeReadinessStatus(input: BotRuntimeReadinessInput | null | undefined): BotReadinessStatus {
  if (!input) return 'readonly';
  if (input.processAlive === false) return 'blocked';
  if (input.readState === 'unreachable' || input.readState === 'malformed') return 'blocked';
  if (input.readState === 'stale' || input.readState === 'not_configured' || input.adapterMode === 'mock') return 'attention';
  if (input.readState === 'ok' && (input.lastSyncAt === null || input.lastSyncAt === undefined)) return 'attention';
  if (input.readState === 'ok' && (input.staleDataSeconds ?? 0) > (input.staleAfterSeconds ?? 10 * 60)) return 'attention';
  if (input.readState === 'ok' && workerHeartbeatReadinessStatus(input) !== 'ready') return 'attention';
  return input.readState === 'ok' ? 'ready' : 'attention';
}

function workerHeartbeatReadinessStatus(input: BotRuntimeReadinessInput | null | undefined): BotReadinessStatus {
  if (!input) return 'readonly';
  if (input.workerStatus === 'error' || input.workerBotContinuityStatus === 'error') return 'blocked';
  if (input.workerProductSnapshot === 'error') return 'blocked';
  if (input.workerProductReadState === 'unreachable' || input.workerProductReadState === 'malformed') return 'blocked';
  if (!input.workerCheckedAt) return 'attention';
  if ((input.workerAgeSeconds ?? 0) > (input.workerStaleAfterSeconds ?? 3 * 60)) return 'attention';
  if (input.workerStatus !== 'ok' || input.workerBotContinuityStatus !== 'ok') return 'attention';
  if (input.workerProductSnapshot !== 'ok' || input.workerProductReadState !== 'ok') return 'attention';
  return 'ready';
}

function freshnessLabel(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'age unknown';
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.round(minutes / 60)}h old`;
}

function workerHeartbeatItem(input: BuildBotReadinessInput): BotReadinessItem {
  const runtime = input.runtime ?? null;
  const status = workerHeartbeatReadinessStatus(runtime);
  const staleAfterSeconds = runtime?.workerStaleAfterSeconds ?? 3 * 60;
  const freshEnough =
    status === 'ready';

  return {
    label: 'Worker heartbeat',
    status,
    value: runtime?.workerCheckedAt
      ? freshEnough
        ? `Fresh aggregate - ${freshnessLabel(runtime.workerAgeSeconds)}`
        : `Aggregate needs review - ${freshnessLabel(runtime.workerAgeSeconds)}`
      : 'No aggregate worker row',
    detail: runtime
      ? freshEnough
        ? `Latest target='worker' heartbeat is fresh and reports botContinuityStatus=ok, ${input.botSlug} snapshot=ok, and ${input.botSlug} readState=ok. This is still not permission to start, stop, or apply live config.`
        : runtime.workerDetail ?? `Readiness stays non-green until the aggregate worker heartbeat is fresher than ${Math.round(staleAfterSeconds / 60)}m and both bot snapshot jobs report ok.`
      : 'Open the dashboard for aggregate worker heartbeat evidence. This surface does not run the worker or call a live provider.',
    href: `/app/bots/${input.botSlug}`,
    actionLabel: input.surface === 'dashboard' ? undefined : 'Open dashboard',
  };
}

export function statisticsReadinessStatus(input: BotStatisticsReadinessInput | null | undefined): BotReadinessStatus {
  if (!input) return 'readonly';
  if (!input.metricsAvailable && input.issueKind === 'blocked') return 'blocked';
  if (!input.metricsAvailable || input.issueKind) return 'attention';
  return 'ready';
}

function connectionItem(input: BuildBotReadinessInput): BotReadinessItem {
  if (input.productCode === 'tortila_bot') {
    const count = input.exchangeKeyCount ?? 0;
    const state = input.exchangeKeyState ?? (count > 0 ? 'metadata_saved' : 'missing');
    if (state === 'not_checked') {
      return {
        label: 'Exchange key',
        status: 'readonly',
        value: 'Not checked here',
        detail: 'Open setup or settings for exchange-key metadata status. This surface does not ping a live exchange.',
        href: `/app/bots/${input.botSlug}/setup?step=key`,
        actionLabel: 'Review key',
      };
    }
    return {
      label: 'Exchange key',
      status: state === 'vault_metadata_confirmed' ? 'ready' : 'attention',
      value: state === 'missing'
        ? 'No key saved'
        : state === 'vault_metadata_confirmed'
          ? 'WTC vault metadata confirmed'
          : 'Exchange metadata saved',
      detail: state === 'missing'
        ? 'Add a key before any future audited exchange ping can run.'
        : state === 'vault_metadata_confirmed'
          ? 'A metadata-only WTC vault check confirmed an owned account row and encrypted secret metadata row. Live exchange ping is still not run.'
          : 'Exchange account metadata exists. A live exchange ping is not run yet, and count-only metadata is not treated as live connectivity.',
      href: state === 'missing' ? `/app/bots/${input.botSlug}/setup?step=key` : `/app/bots/${input.botSlug}/settings`,
      actionLabel: state === 'missing' ? 'Add key' : 'View keys',
    };
  }

  const state = input.providerPubIdState ?? (input.providerAccountCount == null ? 'not_checked' : input.providerAccountCount > 0 ? 'runtime_snapshot' : 'missing');
  if (state === 'not_checked') {
    return {
      label: 'Provider pub_id',
      status: 'readonly',
      value: 'Not checked here',
      detail: 'Open the bot room for user-scoped Legacy provider pub_id snapshot evidence.',
      href: `/app/bots/${input.botSlug}`,
      actionLabel: 'Open dashboard',
    };
  }

  const count = input.providerAccountCount ?? 0;
  return {
    label: 'Provider pub_id',
    status: state === 'db_mapping_confirmed' ? 'ready' : state === 'ambiguous_mapping' ? 'blocked' : 'attention',
    value: state === 'missing' ? providerPubIdSummary(0) : providerPubIdSummary(count),
    detail: state === 'db_mapping_confirmed'
      ? 'A user-scoped active DB provider mapping exists for this Legacy bot instance.'
      : state === 'ambiguous_mapping'
        ? 'More than one active DB provider mapping exists for this Legacy bot instance; admin must resolve this before readiness can be green.'
      : state === 'runtime_snapshot'
        ? 'Provider pub_id evidence is visible from a read-only runtime snapshot. A narrow DB mapping summary should be used before this becomes a green readiness proof.'
        : 'Admin mapping is required before runtime/provider facts can be attributed to this user.',
    href: `/app/bots/${input.botSlug}/settings`,
    actionLabel: 'View mapping',
  };
}

function runtimeItem(input: BuildBotReadinessInput): BotReadinessItem {
  const runtime = input.runtime ?? null;
  return {
    label: 'Runtime snapshot',
    status: runtimeReadinessStatus(runtime),
    value: runtime?.label ?? 'Not checked here',
    detail: runtime?.detail
      ?? 'Open the dashboard for read-only runtime evidence. This surface does not call a live bot or provider.',
    href: `/app/bots/${input.botSlug}`,
    actionLabel: input.surface === 'dashboard' ? undefined : 'Open dashboard',
  };
}

function statisticsItem(input: BuildBotReadinessInput): BotReadinessItem {
  const statistics = input.statistics ?? null;
  return {
    label: 'Statistics',
    status: statisticsReadinessStatus(statistics),
    value: statistics ? (statistics.metricsAvailable ? 'Metrics available' : 'Metrics unavailable') : 'Not checked here',
    detail: statistics
      ? statistics.metricsAvailable
        ? input.productCode === 'legacy_bot'
          ? 'Legacy statistics are snapshot/projection based until closed-trade history is available.'
          : 'Dashboard statistics are rendered from read-only adapter data.'
        : 'The page shows an honest unavailable state instead of fabricating zeros.'
      : 'Open statistics for the portfolio-style read-only analytics view.',
    href: `/app/bots/statistics?bot=${input.botSlug}`,
    actionLabel: 'Open statistics',
  };
}

export function buildBotReadinessItems(input: BuildBotReadinessInput): BotReadinessItem[] {
  const operationalRows = input.includeOperationalRows ?? input.surface !== 'settings';
  const settingsRowLabel = input.surface === 'settings' ? 'Settings source' : 'Strategy source';
  const liveRowLabel = input.surface === 'settings' ? 'Live apply' : 'Live control';

  const accessItem: BotReadinessItem = {
    label: 'Access',
    status: input.accessAllowed ? accessStatus(input.accessReason) : 'blocked',
    value: ACCESS_LABELS[input.accessReason] ?? 'Unknown',
    detail: input.accessReason === 'grace'
      ? 'Grace access is allowed temporarily; renew to avoid interruption.'
      : input.accessAllowed
        ? 'This surface is loaded only after the server-side entitlement check passes.'
        : 'Entitlement is not active; bot readiness data must stay hidden.',
  };

  if (!input.accessAllowed) return [accessItem];

  const items: BotReadinessItem[] = [
    accessItem,
    connectionItem(input),
    {
      label: settingsRowLabel,
      status: input.configSource === 'built_in' ? 'attention' : 'ready',
      value: input.configSourceLabel,
      detail: input.configSource === 'built_in'
        ? 'Built-in fallback is visible, but no system default or user custom version is active.'
        : input.configSourceDetail ?? 'The active WTC-side source is explicit: system default or user-owned custom version.',
      href: `/app/bots/${input.botSlug}/settings`,
      actionLabel: input.surface === 'settings' ? undefined : 'Open settings',
    },
  ];

  if (operationalRows) {
    items.push(workerHeartbeatItem(input), runtimeItem(input), statisticsItem(input));
  }

  items.push({
    label: liveRowLabel,
    status: 'readonly',
    value: input.surface === 'settings' ? 'Disabled' : 'Start/stop/apply disabled',
    detail: input.surface === 'settings'
      ? 'Saving here appends a WTC-side version only. It never starts, stops, or applies config to a running bot.'
      : 'No bot control is available until a separately audited adapter is approved. Stop never closes positions.',
  });

  return items;
}
