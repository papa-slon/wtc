/**
 * Background jobs. Pure functions over injected services so they are testable and DB-agnostic.
 * See docs/ARCHITECTURE.md (Background Jobs). The current worker is a cron-style setInterval scheduler
 * (apps/worker/src/index.ts) that makes direct repository calls (reconcileAllEntitlements /
 * sweepTvExpiry / recordHealthCheck); these pure helpers back the in-memory demo path. The `job_queue`
 * table is RESERVED / not yet consumed — nothing enqueues or dequeues it; a durable queue is a
 * future/TARGET design, not the current mechanism.
 *
 * SAFETY: snapshotTortilaJournal is READ-ONLY.
 *   - No live bot control (startBot/stopBot/applyConfig always throw BotControlDisabledError).
 *   - /api/marks is NEVER called (bot owns the exchange connection).
 *   - Adapter mode defaults to mock; real HTTP only when BOT_ADAPTER_MODE=read-only AND TORTILA_JOURNAL_URL set.
 *   - AdapterNotReadyError from getMetrics/getTrades is caught and does NOT crash the tick.
 *   - All failures write integration_health_checks with status='error' and return without throwing.
 */
import { reconcileExpiry, type Entitlement } from '@wtc/entitlements';
import type { TvAccessService } from '@wtc/tradingview-access';
import type { AuditWriter } from '@wtc/audit';
import type { BotAdapter } from '@wtc/bot-adapters';
import { AdapterNotReadyError } from '@wtc/bot-adapters';

function operationalMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|secret|token|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 200);
}

/** Reconcile entitlement time-drift (active → grace → expired) and audit any change. */
export async function reconcileEntitlements(
  entitlements: Entitlement[],
  now: number,
  audit?: AuditWriter,
): Promise<{ changed: Entitlement[] }> {
  const changed: Entitlement[] = [];
  for (const ent of entitlements) {
    const next = reconcileExpiry(ent, now);
    if (next.status !== ent.status) {
      changed.push(next);
      await audit?.write({
        actorUserId: null,
        actorRole: 'system',
        action: 'product.revoke',
        targetType: 'entitlement',
        targetId: `${ent.userId}:${ent.productCode}`,
        before: { status: ent.status },
        after: { status: next.status },
      });
    }
  }
  return { changed };
}

/** Sweep TradingView grants for expiry; queues revoke tasks. */
export function sweepTradingViewAccess(tv: TvAccessService, now: number) {
  return tv.sweep(now);
}

/**
 * Map a real adapter's BotHealth.readState to the integration_health_checks `status` string so the
 * ops surface is honest and specific (a missing config must NOT look like an outage):
 *   not_configured → 'not_configured' · unreachable → 'down' · malformed → 'error' · stale/ok → 'ok'.
 * When readState is absent (mock / older adapters) fall back to processAlive.
 */
export function healthCheckStatusFor(readState: string | undefined, processAlive: boolean): string {
  switch (readState) {
    case 'not_configured':
      return 'not_configured';
    case 'unreachable':
      return 'down';
    case 'malformed':
      return 'error';
    case 'stale':
    case 'ok':
      return 'ok';
    default:
      return processAlive ? 'ok' : 'down';
  }
}

/**
 * Read-only Tortila journal snapshot/health collector.
 *
 * Called every tick from dbTick() in index.ts when:
 *   - TORTILA_JOURNAL_URL env is set AND BOT_ADAPTER_MODE is 'read-only' or 'audited' → real HTTP
 *   - Otherwise → mock adapter (always runs; writes mock/demo data to DB with sourceAdapter='tortila-mock')
 *
 * Writes to:
 *   - integration_health_checks (target='tortila-journal', status='ok'|'down'|'error')
 *   - bot_metric_snapshots (partial if getMetrics throws AdapterNotReadyError)
 *
 * SAFETY:
 *   - Never calls startBot/stopBot/applyConfig (always throw BotControlDisabledError)
 *   - Never calls /api/marks (bot owns the exchange connection)
 *   - AdapterNotReadyError from data methods is caught — writes health-only snapshot, no crash
 *   - Network or DB errors write status='error' and return without crashing the tick
 *   - botInstanceId comes from ensureBotInstance — the system-owned tortila_bot instance
 *
 * @param db          Live Drizzle DB handle (or PGlite for tests)
 * @param adapter     BotAdapter for tortila_bot (mock or real HTTP)
 * @param botInstanceId  System-owned bot instance ID (from ensureBotInstance or env)
 * @param now         Current epoch-ms timestamp (pass Date.now() from the tick; use new Date(now) for snapshotAt)
 */
export async function snapshotTortilaJournal(
  db: import('@wtc/db').Db,
  adapter: BotAdapter,
  botInstanceId: string,
  now: number,
): Promise<{ ok: boolean; lastError: string | null }> {
  const { insertBotMetricSnapshot, insertBotPositionSnapshot, importBotTrade, recordHealthCheck } = await import('@wtc/db');
  const sourceAdapter = adapter.mode === 'real' ? 'tortila' : 'tortila-mock';

  try {
    // getHealth never throws — fail-closed to processAlive=false on any error.
    const health = await adapter.getHealth();
    if (health.readState === 'not_configured') {
      await recordHealthCheck(db, 'tortila-journal', 'not_configured', {
        status: health.status,
        readState: health.readState,
        readStateDetail: health.readStateDetail ?? null,
        processAlive: health.processAlive,
        warnings: health.warnings.map((w) => w.code),
        adapterMode: adapter.mode,
        metricsAvailable: false,
        positionsSnapshotted: 0,
        tradesSeen: 0,
        tradesImported: 0,
      });
      return { ok: true, lastError: null };
    }

    // getMetrics may throw AdapterNotReadyError (not yet mapped) or network errors.
    // Catch and proceed with a health-only snapshot — never crash the tick.
    let metrics: import('@wtc/analytics').CanonicalMetrics | null = null;
    let positions: import('@wtc/analytics').CanonicalPosition[] = [];
    let trades: import('@wtc/analytics').CanonicalTrade[] = [];
    try {
      metrics = await adapter.getMetrics(botInstanceId);
    } catch (err) {
      if (err instanceof AdapterNotReadyError) {
        // Expected while schema files are being confirmed — write health-only snapshot.
      } else {
        // Unexpected (network, timeout) — log but do not crash.
        console.warn(`[worker:tortila-snapshot] getMetrics error (non-fatal): ${operationalMessage(err)}`);
      }
    }
    try {
      positions = await adapter.getPositions(botInstanceId);
    } catch (err) {
      if (!(err instanceof AdapterNotReadyError)) {
        console.warn(`[worker:tortila-snapshot] getPositions error (non-fatal): ${operationalMessage(err)}`);
      }
    }
    try {
      trades = await adapter.getTrades(botInstanceId);
    } catch (err) {
      if (!(err instanceof AdapterNotReadyError)) {
        console.warn(`[worker:tortila-snapshot] getTrades error (non-fatal): ${operationalMessage(err)}`);
      }
    }

    // Write metric snapshot. snapshotAt must be a Date, not epoch-ms (Finding 6).
    await insertBotMetricSnapshot(db, {
      botInstanceId,
      snapshotAt: new Date(now),
      sourceAdapter,
      walletEquityUsd: metrics ? String(metrics.walletEquity) : undefined,
      closedPnlUsd: metrics ? String(metrics.closedPnl) : undefined,
      unrealizedPnlUsd: metrics ? String(metrics.unrealizedPnl) : undefined,
      winRate: metrics?.winRatePct != null ? String(metrics.winRatePct) : undefined,
      profitFactor: metrics?.profitFactor != null ? String(metrics.profitFactor) : undefined,
      maxDrawdownPct: metrics?.maxDrawdownPct != null ? String(metrics.maxDrawdownPct) : undefined,
      currentDrawdownPct: metrics?.currentDrawdownPct != null ? String(metrics.currentDrawdownPct) : undefined,
      totalFeesUsd: metrics ? String(metrics.feesTotal) : undefined,
      totalFundingUsd: metrics ? String(metrics.fundingTotal) : undefined,
      openRiskUsd: metrics ? String(metrics.openRisk) : undefined,
      tradeCount: metrics?.tradeCount,
      rawJson: {
        adapterMode: adapter.mode,
        sourceAdapter,
        healthStatus: health.status,
        readState: health.readState ?? null,
        processAlive: health.processAlive,
        warningCodes: health.warnings.map((w) => w.code),
      },
    });

    await insertBotPositionSnapshot(db, {
      botInstanceId,
      snapshotAt: new Date(now),
      sourceAdapter,
      positions: positions.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        size: String(p.qty),
        entryPrice: String(p.entryPrice),
        ...(Number.isFinite(p.markPrice) ? { markPrice: String(p.markPrice) } : {}),
        ...(Number.isFinite(p.unrealizedPnl) ? { unrealizedPnlUsd: String(p.unrealizedPnl) } : {}),
        ...(p.tpPrice != null ? { tpPrice: String(p.tpPrice) } : {}),
        ...(p.stopPrice != null ? { slPrice: String(p.stopPrice) } : {}),
        ...(p.openedAt ? { openedAt: new Date(p.openedAt) } : {}),
      })),
    });

    const closedTrades = trades.filter((t) => t.closedAt !== null && t.entryPrice != null && t.exitPrice != null);
    let tradesImported = 0;
    for (const t of closedTrades) {
      const result = await importBotTrade(db, {
        botInstanceId,
        externalTradeId: t.id,
        symbol: t.symbol,
        side: t.side,
        entryPrice: String(t.entryPrice),
        exitPrice: String(t.exitPrice),
        size: String(t.qty),
        realizedPnlUsd: String(t.realizedPnl),
        feesUsd: String(t.fee),
        fundingPaidUsd: String(t.funding),
        openedAt: new Date(t.openedAt),
        closedAt: new Date(t.closedAt!),
        sourceAdapter,
        ...(t.exitReason ? { exitReason: t.exitReason } : {}),
        rawJson: {
          holdHours: t.holdHours ?? null,
          retPct: t.retPct ?? null,
        },
      });
      if (result.inserted) tradesImported += 1;
    }

    // Record health check. The DB status string is derived from the adapter readState so the ops
    // surface distinguishes not_configured / unreachable / malformed / stale (never a generic 'down').
    const healthStatus = healthCheckStatusFor(health.readState, health.processAlive);
    await recordHealthCheck(db, 'tortila-journal', healthStatus, {
      status: health.status,
      readState: health.readState ?? null,
      readStateDetail: health.readStateDetail ?? null,
      processAlive: health.processAlive,
      warnings: health.warnings.map((w) => w.code),
      adapterMode: adapter.mode,
      metricsAvailable: metrics !== null,
      positionsSnapshotted: positions.length,
      tradesSeen: closedTrades.length,
      tradesImported,
    });

    return { ok: true, lastError: null };
  } catch (err) {
    // Catch-all: DB errors, unexpected adapter failures.
    const msg = operationalMessage(err);
    console.error(`[worker:tortila-snapshot] fatal error: ${msg}`);
    try {
      await recordHealthCheck(db, 'tortila-journal', 'error', { error: msg, adapterMode: adapter.mode });
    } catch {
      // If even the health check write fails, swallow so the tick continues.
    }
    return { ok: false, lastError: msg };
  }
}
