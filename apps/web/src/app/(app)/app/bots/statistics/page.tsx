import Link from 'next/link';
import { Card, EmptyState, RiskWarningBanner, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { requireUser } from '@/lib/session';
import { BOT_CAPS, BOT_LIST, type BotMeta } from '@/features/bots/meta';
import { TortilaOverview } from '@/features/bots/tortila-overview';
import { loadTortilaLiveOverview, type TortilaLiveStatus } from '@/features/bots/tortila-overview-data';
import { LegacyOverview, LEGACY_DCA_CAPS } from '@/features/bots/legacy-overview';
import { loadLegacyLiveOverview } from '@/features/bots/legacy-overview-data';

export const dynamic = 'force-dynamic';

function selectedBotSlug(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return BOT_LIST.some((b) => b.slug === value) ? value! : BOT_LIST[0]!.slug;
}

/** Single health chip derived from the live read status — no evidence ladders. */
function liveHealthChip(status: TortilaLiveStatus): { tone: Tone; label: string } {
  switch (status) {
    case 'live':
      return { tone: 'ok', label: 'Live' };
    case 'empty':
      return { tone: 'warn', label: 'No data' };
    case 'not-configured':
      return { tone: 'neutral', label: 'Setup needed' };
    case 'error':
      return { tone: 'bad', label: 'Unreachable' };
  }
}

/** Tortila premium panel: one mode chip, one health chip, then the dashboard. */
async function TortilaPanel() {
  const live = await loadTortilaLiveOverview();
  const health = liveHealthChip(live.status);
  // G6: the mode label is truthful — sourced from /api/summary `mode` (demo|live).
  // When the journal has not reported a mode yet, show a neutral 'mode n/a' chip
  // rather than fabricating DEMO.
  const modeLabel = live.mode === 'unknown' ? 'mode n/a' : live.mode.toUpperCase();
  const feesTotal = live.metrics?.feesTotal ?? 0;
  const fundingTotal = live.metrics?.fundingTotal ?? 0;

  const startMs = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const todayPnl = live.trades
    .filter((t) => t.closedAt !== null && t.closedAt >= startMs)
    .reduce((sum, t) => sum + (t.realizedPnl + t.funding - t.fee), 0);
  const startDateIso = live.equityCurve[0]?.t ? new Date(live.equityCurve[0].t).toISOString() : null;

  return (
    <div className="wtc-stack">
      <div className="wtc-spread" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone={live.mode === 'live' ? 'ok' : 'neutral'}>{modeLabel}</StatusPill>
          <StatusPill tone={health.tone}>{health.label}</StatusPill>
        </div>
        {live.status === 'live' && (
          <span className="wtc-dim" style={{ fontSize: 12 }}>Live read · journal {live.baseUrl}</span>
        )}
      </div>

      {live.status === 'live' ? (
        <TortilaOverview
          metrics={live.metrics}
          positions={live.positions}
          trades={live.trades}
          equityCurve={live.equityCurve}
          payload={live.payload}
          mode={live.mode}
          atAth={live.atAth}
          startDateIso={live.payload.advanced.data?.drawdown.max_dd_start ?? startDateIso}
          todayPnl={todayPnl}
          pnlPctSinceStart={live.metrics?.roiPctSinceStart ?? 0}
          feesTotal={feesTotal}
          fundingTotal={fundingTotal}
          netPnl={live.metrics?.netPnlWithFees ?? 0}
        />
      ) : (
        <Card title="Live data unavailable">
          <RiskWarningBanner
            severity={live.status === 'error' ? 'error' : 'warning'}
            title={
              live.status === 'empty'
                ? 'Journal returned no data'
                : live.status === 'error'
                  ? 'Journal unreachable'
                  : 'Live data source not configured'
            }
            detail={live.statusDetail ?? 'The Tortila journal is not configured for this environment.'}
          />
          <EmptyState
            title="No live numbers to show"
            hint="The dashboard never fabricates a $0 account or stale positions. Configure the journal data source to see live equity, positions, and trades."
          />
        </Card>
      )}
    </div>
  );
}

/** Legacy DCA premium panel: one mode chip, one health chip, then the
 *  reconstructed DCA dashboard. Reads the SAFE read-only journal shim — money
 *  figures are reconstructed from the closed-cycle order ladder, never faked. */
async function LegacyPanel({ meta }: { meta: BotMeta }) {
  const live = await loadLegacyLiveOverview();
  const health = liveHealthChip(live.status);
  const modeLabel = live.mode === 'live' ? 'RECON · LIVE' : 'RECON · mode n/a';

  return (
    <div className="wtc-stack">
      <div className="wtc-spread" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone="gold">{modeLabel}</StatusPill>
          <StatusPill tone={health.tone}>{health.label}</StatusPill>
        </div>
        {live.status === 'live' && (
          <span className="wtc-dim" style={{ fontSize: 12 }}>Read-only · reconstructed · journal {live.baseUrl}</span>
        )}
      </div>

      {live.status === 'live' ? (
        <LegacyOverview overview={live} caps={LEGACY_DCA_CAPS} />
      ) : (
        <Card title={`${meta.name} reconstructed view`}>
          <RiskWarningBanner
            severity={live.status === 'error' ? 'error' : live.status === 'empty' ? 'warning' : 'info'}
            title={
              live.status === 'empty'
                ? 'Journal shim returned no data'
                : live.status === 'error'
                  ? 'Journal shim unreachable'
                  : 'Reconstructed data source not configured'
            }
            detail={live.statusDetail ?? `${meta.name} (RSI/CCI averaging engine) reads a read-only journal shim that reconstructs PnL from closed cycles. The premium DCA dashboard — averaging depth, signal mix, per-symbol contribution and reconstructed PnL — renders here once that shim is reachable.`}
          />
          <EmptyState
            title="No reconstructed numbers to show"
            hint="The dashboard never fabricates a $0 account or placeholder positions. It intentionally shows nothing rather than fake metrics until the read-only shim is wired."
          />
        </Card>
      )}
    </div>
  );
}

export default async function BotStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string | string[] }>;
}) {
  const params = await searchParams;
  const selected = selectedBotSlug(params.bot);
  const user = await requireUser();
  const active = BOT_LIST.find((b) => b.slug === selected) ?? BOT_LIST[0]!;
  const access = await botAccessForUser(user, active.code);
  const caps = BOT_CAPS[active.code];

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Bot statistics"
        title="Trading bot performance"
        copy="A live, read-only trading terminal. Pick a bot above. Each strategy keeps its own equity, drawdown, and trade analytics — nothing is blended into a fake combined number."
      />

      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {BOT_LIST.map((bot) => {
          const isActive = bot.slug === active.slug;
          return (
            <Link
              key={bot.slug}
              href={`/app/bots/statistics?bot=${bot.slug}`}
              aria-current={isActive ? 'page' : undefined}
              className={buttonClasses(isActive ? 'secondary' : 'ghost')}
            >
              {bot.name}
            </Link>
          );
        })}
      </div>

      {!access.allowed ? (
        <Card title="Access required">
          <EmptyState title={`${active.name} is locked`} hint={`Access ${reasonLabel(access.reason)}. Activate or renew in billing to view this bot's statistics.`} />
          <div style={{ marginTop: 14 }}>
            <Link href="/app/billing" className={buttonClasses('primary')}>Go to billing</Link>
          </div>
        </Card>
      ) : active.code === 'tortila_bot' ? (
        <TortilaPanel />
      ) : (
        <LegacyPanel meta={active} />
      )}

      {access.allowed && (
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
          <Link href={`/app/bots/${active.slug}/settings`} className="wtc-link">Settings</Link>
          {caps.hasBacktester && <Link href={`/app/bots/${active.slug}/backtester`} className="wtc-link">Backtester</Link>}
          <Link href={`/app/bots/${active.slug}`} className="wtc-link">Bot room</Link>
        </div>
      )}
    </div>
  );
}
