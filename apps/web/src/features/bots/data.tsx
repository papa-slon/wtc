import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CanonicalMetrics, CanonicalPosition, CanonicalTrade, EquityPoint } from '@wtc/analytics';
import type { AccessDecision } from '@wtc/entitlements';
import {
  AdapterNotReadyError,
  getBotAdapter,
  LegacyAdapterBlockedError,
  type BotConfigView,
  type BotHealth,
  type BotProductCode,
  type RiskWarning,
} from '@wtc/bot-adapters';
import { requireUser } from '@/lib/session';
import { accessFor, reasonLabel } from '@/lib/access';
import { botAdapterOptions } from '@/lib/server-config';
import { SectionHeader, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { BotSubNav } from '@/components/BotSubNav';
import { botMeta, type BotMeta } from '@/features/bots/meta';

/** Resolve a bot slug → meta + the current user's access. 404s on an unknown slug. */
export async function loadBot(slug: string): Promise<{ meta: BotMeta; access: AccessDecision }> {
  const meta = botMeta(slug);
  if (!meta) notFound();
  const user = await requireUser();
  const access = await accessFor(user.id, meta.code);
  return { meta, access };
}

/** Shared entitlement gate for a bot sub-page. Keeps the sub-nav visible so the user can orient. */
export function BotAccessRequired({ meta, section }: { meta: BotMeta; section: string }) {
  return (
    <div className="wtc-stack">
      <SectionHeader kicker={`${meta.name} · ${section}`} title="Access required" />
      <BotSubNav bot={meta.slug} active={sectionToSeg(section)} />
      <RiskWarningBanner
        severity="warning"
        title="Entitlement required"
        detail={`Your ${meta.name} entitlement does not currently grant access. Activate or renew in billing to view this section.`}
      />
      <Link href="/app/billing" className={buttonClasses('primary')}>Go to billing</Link>
    </div>
  );
}

function sectionToSeg(section: string): string {
  const s = section.toLowerCase();
  return s === 'overview' ? '' : s;
}

export type BotReadIssueKind = 'blocked' | 'not_ready' | 'error';

export interface BotReadIssue {
  kind: BotReadIssueKind;
  title: string;
  detail: string;
}

export interface SafeBotRead<T> {
  data: T | null;
  issue: BotReadIssue | null;
}

export interface BotReadModel {
  adapterMode: 'mock' | 'real';
  health: BotHealth;
  metrics: SafeBotRead<CanonicalMetrics>;
  positions: SafeBotRead<CanonicalPosition[]>;
  trades: SafeBotRead<CanonicalTrade[]>;
  equityCurve: SafeBotRead<EquityPoint[]>;
  config: SafeBotRead<BotConfigView>;
  warnings: SafeBotRead<RiskWarning[]>;
}

type BotReadPart = 'metrics' | 'positions' | 'trades' | 'equityCurve' | 'config' | 'warnings';

const FALLBACK_HEALTH: Record<BotProductCode, BotHealth> = {
  tortila_bot: {
    productCode: 'tortila_bot',
    processAlive: false,
    status: 'down',
    readState: 'unreachable',
    readStateDetail: 'WTC could not read adapter health.',
    lastSyncAt: null,
    staleDataSeconds: null,
    uptimeSeconds: null,
    warnings: [],
  },
  legacy_bot: {
    productCode: 'legacy_bot',
    processAlive: false,
    status: 'down',
    readState: 'not_configured',
    readStateDetail: 'Legacy live adapter is blocked pending B3.',
    lastSyncAt: null,
    staleDataSeconds: null,
    uptimeSeconds: null,
    warnings: [],
  },
};

export function botReadIssueFromError(err: unknown): BotReadIssue {
  if (err instanceof LegacyAdapterBlockedError) {
    return {
      kind: 'blocked',
      title: 'Live adapter blocked (B3)',
      detail: err.message,
    };
  }
  if (err instanceof AdapterNotReadyError) {
    return {
      kind: 'not_ready',
      title: 'Adapter data unavailable',
      detail: err.message,
    };
  }
  return {
    kind: 'error',
    title: 'Adapter read failed',
    detail: err instanceof Error ? err.message : 'Unknown adapter read failure.',
  };
}

async function safeBotCall<T>(fn: () => Promise<T>): Promise<SafeBotRead<T>> {
  try {
    return { data: await fn(), issue: null };
  } catch (err) {
    return { data: null, issue: botReadIssueFromError(err) };
  }
}

const skipped = <T,>(): SafeBotRead<T> => ({ data: null, issue: null });

/** Read adapter data for UI surfaces without letting blocked/not-ready adapters crash the page. */
export async function loadBotReadModel(
  productCode: BotProductCode,
  parts: readonly BotReadPart[] = ['metrics', 'positions', 'trades', 'equityCurve', 'config', 'warnings'],
): Promise<BotReadModel> {
  const adapter = getBotAdapter(productCode, botAdapterOptions());
  let health: BotHealth;
  try {
    health = await adapter.getHealth();
  } catch (err) {
    const issue = botReadIssueFromError(err);
    health = { ...FALLBACK_HEALTH[productCode], readStateDetail: issue.detail };
  }
  const want = new Set(parts);
  const canReadData = health.readState !== 'not_configured';
  const metrics = want.has('metrics') && canReadData ? await safeBotCall(() => adapter.getMetrics(productCode)) : skipped<CanonicalMetrics>();
  const positions = want.has('positions') && canReadData ? await safeBotCall(() => adapter.getPositions(productCode)) : skipped<CanonicalPosition[]>();
  const trades = want.has('trades') && canReadData ? await safeBotCall(() => adapter.getTrades(productCode)) : skipped<CanonicalTrade[]>();
  const equityCurve = want.has('equityCurve') && canReadData && adapter.getEquityCurve
    ? await safeBotCall(() => adapter.getEquityCurve!(productCode))
    : skipped<EquityPoint[]>();
  const config = want.has('config') && canReadData ? await safeBotCall(() => adapter.getConfig(productCode)) : skipped<BotConfigView>();
  const warnings = want.has('warnings') ? await safeBotCall(() => adapter.getWarnings()) : skipped<RiskWarning[]>();
  return { adapterMode: adapter.mode, health, metrics, positions, trades, equityCurve, config, warnings };
}

export { reasonLabel };
