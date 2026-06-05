import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { combineMetrics } from '@wtc/analytics';
import { botAdapterMode } from '@/lib/server-config';
import { Card, SectionHeader, StatusPill, MetricCard, MetricValue, RiskWarningBanner, buttonClasses, type Tone } from '@wtc/ui';
import { fmtMoney, fmtPf, fmtNum } from '@/lib/format';
import { BOT_LIST, BOT_CAPS } from '@/features/bots/meta';
import { loadBotReadModelForUser } from '@/features/bots/data';
import { loadBotReadinessForUser } from '@/features/bots/readiness-loader';
import type { BotReadinessItem, BotReadinessStatus } from '@/features/bots/readiness';
import { WarningSummaryInline } from '@/features/bots/WarningSummaryPanel';

function healthTone(status: string): Tone {
  return status === 'healthy' ? 'ok' : status === 'degraded' || status === 'stale' ? 'warn' : 'bad';
}

function readinessTone(status: BotReadinessStatus): Tone {
  if (status === 'ready') return 'ok';
  if (status === 'attention') return 'warn';
  if (status === 'blocked') return 'bad';
  return 'neutral';
}

function finishSummary(items: BotReadinessItem[]) {
  const ready = items.filter((item) => item.status === 'ready').length;
  const attention = items.filter((item) => item.status === 'attention').length;
  const blocked = items.filter((item) => item.status === 'blocked').length;
  const label = blocked > 0 ? 'Blocked' : attention > 0 ? 'Needs review' : 'Review ready';
  const tone: Tone = blocked > 0 ? 'bad' : attention > 0 ? 'warn' : 'ok';
  return { ready, attention, blocked, total: items.length, label, tone };
}

function finishPrimaryAction(bot: { slug: string; code: string; access: { allowed: boolean } }) {
  if (!bot.access.allowed) return { href: '/app/billing', label: 'Resolve access', variant: 'ghost' as const };
  if (bot.code === 'legacy_bot') return { href: '/app/bots/legacy/settings', label: 'Configure Legacy averaging', variant: 'primary' as const };
  return { href: '/app/bots/tortila/settings', label: 'Review Tortila Turtle settings', variant: 'primary' as const };
}

function setupHref(bot: { slug: string; code: string }): string {
  return bot.code === 'legacy_bot' ? `/app/bots/${bot.slug}/setup?step=strategy` : `/app/bots/${bot.slug}/setup?step=key`;
}

function readinessItem(items: BotReadinessItem[], label: string): BotReadinessItem | null {
  return items.find((item) => item.label === label) ?? null;
}

export default async function BotsPage() {
  const user = await requireUser();
  const rows = await Promise.all(
    BOT_LIST.map(async (b) => {
      const access = await botAccessForUser(user, b.code);
      const read = access.allowed ? await loadBotReadModelForUser(user.id, b.code, ['metrics', 'warnings']) : null;
      const readiness = await loadBotReadinessForUser(user, b.code, 'cabinet', {
        access,
        read,
        includeOperationalRows: true,
      });
      return { ...b, access, read, readiness };
    }),
  );

  const tortila = rows.find((r) => r.code === 'tortila_bot');
  const legacy = rows.find((r) => r.code === 'legacy_bot');
  const combined = combineMetrics(
    tortila?.access.allowed ? tortila.read?.metrics.data ?? null : null,
    legacy?.access.allowed ? legacy.read?.metrics.data ?? null : null,
  );
  const entitledCount = rows.filter((r) => r.access.allowed).length;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Trading bots"
        title="Bots"
        copy={`Read-only monitoring through adapters. Live controls stay disabled until a dedicated audited adapter is approved. BOT_ADAPTER_MODE=${botAdapterMode()}.`}
      />
      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href="/app/bots/statistics?bot=tortila" className={buttonClasses('secondary')}>Open statistics</Link>
        <span className="wtc-dim" style={{ fontSize: 12 }}>Bot-level stats use the same dashboard style; strategy metrics are not blended.</span>
      </div>
      {botAdapterMode() === 'mock' && (
        <RiskWarningBanner
          severity="warning"
          title="Simulated data - not a live account"
          detail="Bot dashboards use the mock adapter (BOT_ADAPTER_MODE=mock). No live exchange or bot account is connected; every figure below is illustrative."
        />
      )}

      <Card title="Two-bot finish board">
        <div className="wtc-grid wtc-grid-2">
          {rows.map((b) => {
            const summary = finishSummary(b.readiness.items);
            const primary = finishPrimaryAction(b);
            const connection = readinessItem(b.readiness.items, b.code === 'legacy_bot' ? 'Provider pub_id' : 'Exchange key');
            const settingsSource = readinessItem(b.readiness.items, 'Strategy source') ?? readinessItem(b.readiness.items, 'Settings source');
            const worker = readinessItem(b.readiness.items, 'Worker heartbeat');
            const statistics = readinessItem(b.readiness.items, 'Statistics');
            const liveBoundary = readinessItem(b.readiness.items, 'Live control');
            const boardRows = [connection, settingsSource, worker, statistics, liveBoundary].filter((item): item is BotReadinessItem => item !== null);

            return (
              <section
                key={`finish-${b.slug}`}
                style={{ border: '1px solid var(--wtc-border)', borderRadius: 8, padding: 14, background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="wtc-spread" style={{ gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <p className="wtc-dim" style={{ margin: 0, fontSize: 11, textTransform: 'uppercase' }}>
                      {b.code === 'legacy_bot' ? 'Legacy finish path' : 'Tortila finish path'}
                    </p>
                    <h3 style={{ margin: '3px 0 0', fontSize: 19 }}>{b.name}</h3>
                    <p className="wtc-dim" style={{ margin: '6px 0 0', fontSize: 12 }}>{b.tagline}</p>
                  </div>
                  <StatusPill tone={summary.tone}>{summary.label}</StatusPill>
                </div>

                <div className="wtc-grid wtc-grid-3" style={{ marginTop: 12 }}>
                  <MetricCard label="Ready rows" value={`${summary.ready}/${summary.total}`} />
                  <MetricCard label="Needs review" value={summary.attention} tone={summary.attention > 0 ? 'down' : undefined} />
                  <MetricCard label="Blocked rows" value={summary.blocked} tone={summary.blocked > 0 ? 'down' : undefined} />
                </div>

                <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <Link href={primary.href} className={buttonClasses(primary.variant)}>{primary.label}</Link>
                  <Link href={setupHref(b)} className={buttonClasses('secondary')}>Open setup review</Link>
                  <Link href={`/app/bots/statistics?bot=${b.slug}`} className={buttonClasses('secondary')}>Open {b.name} statistics</Link>
                  <Link href={`/app/bots/${b.slug}`} className={buttonClasses('ghost')}>Open dashboard</Link>
                </div>

                <div className="wtc-table-wrap" style={{ marginTop: 12 }}>
                  <table className="wtc-table">
                    <thead>
                      <tr>
                        <th>Layer</th>
                        <th>Status</th>
                        <th>Evidence</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boardRows.map((item) => (
                        <tr key={`${b.slug}-${item.label}`}>
                          <td data-label="Layer">{item.label}</td>
                          <td data-label="Status"><StatusPill tone={readinessTone(item.status)}>{item.status}</StatusPill></td>
                          <td data-label="Evidence">
                            <strong>{item.value}</strong>
                            <br />
                            <span className="wtc-dim" style={{ fontSize: 12 }}>{item.detail}</span>
                          </td>
                          <td data-label="Action">
                            {item.href && item.actionLabel ? (
                              <Link href={item.href} className="wtc-link">{item.actionLabel}</Link>
                            ) : (
                              <span className="wtc-dim">read-only</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
        <p className="wtc-dim" style={{ fontSize: 12, lineHeight: 1.6, margin: '12px 0 0' }}>
          This board is a navigation and evidence map only. It does not run a worker tick, ping an exchange, call a provider,
          start or stop a bot, apply live config, close positions, print secrets, or expose admin-only user data.
          Live controls disabled; use the default profile, create a custom profile, open the settings editor, inspect the
          readiness dashboard, and review the statistics cockpit before any future live-control audit.
        </p>
      </Card>

      {entitledCount > 0 && (
        <Card title="Combined portfolio (entitled bots)">
          <div className="wtc-grid wtc-grid-4">
            <MetricCard label="Total wallet equity" value={fmtMoney(combined.totalWalletEquity)} />
            <MetricCard label="Open positions" value={fmtNum(combined.totalOpenPositions)} />
            <MetricCard
              label="Tortila net PnL (after fees)"
              value={fmtMoney(combined.netPnlWithFeesTortila)}
              tone={(combined.netPnlWithFeesTortila ?? 0) >= 0 ? 'up' : 'down'}
            />
            <MetricCard label="Bots entitled" value={fmtNum(entitledCount)} sub={`of ${rows.length}`} />
          </div>
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
            Win rate and profit factor are shown per bot below - never averaged across different strategies.
          </p>
        </Card>
      )}

      <div className="wtc-grid wtc-grid-2">
        {rows.map((b) => (
          <Card key={b.slug}>
            <div className="wtc-spread">
              <h3 style={{ margin: 0, fontSize: 19 }}>{b.name}</h3>
              <StatusPill tone={b.access.allowed && b.read ? healthTone(b.read.health.status) : 'bad'}>
                {b.access.allowed && b.read ? b.read.health.status : 'locked'}
              </StatusPill>
            </div>
            <p className="wtc-dim" style={{ fontSize: 12, margin: '6px 0 0' }}>{b.tagline}</p>
            <div className="wtc-row" style={{ marginTop: 10 }}>
              <StatusPill tone={b.access.allowed ? 'ok' : 'bad'}>{reasonLabel(b.access.reason)}</StatusPill>
              {b.access.allowed && b.read ? (
                <WarningSummaryInline summary={b.read.warningSummary} />
              ) : (
                <span className="wtc-dim" style={{ fontSize: 12 }}>adapter status hidden until entitlement is active</span>
              )}
            </div>
            {b.access.allowed && b.read?.metrics.issue && (
              <div style={{ marginTop: 10 }}>
                <RiskWarningBanner
                  severity={b.read.metrics.issue.kind === 'blocked' ? 'error' : 'warning'}
                  title={b.read.metrics.issue.title}
                  detail={b.read.metrics.issue.detail}
                />
              </div>
            )}
            {b.access.allowed && b.read?.metrics.data && (
              <div className="wtc-grid wtc-grid-2" style={{ marginTop: 14 }}>
                <MetricCard label="Wallet equity" value={fmtMoney(b.read.metrics.data.walletEquity)} />
                <MetricCard
                  label="Win rate"
                  value={<MetricValue value={b.read.metrics.data.winRatePct} suffix="%" />}
                  sub={`PF ${fmtPf(b.read.metrics.data.profitFactor)}`}
                />
              </div>
            )}
            {BOT_CAPS[b.code].liveAdapterBlocked && (
              <div style={{ marginTop: 10 }}>
                <RiskWarningBanner
                  severity="error"
                  title="Legacy HTTP adapter unavailable"
                  detail={BOT_CAPS[b.code].liveAdapterBlockedReason ?? 'The direct HTTP/control adapter for this bot is blocked. Use worker DB snapshots for production live-read data.'}
                />
              </div>
            )}
            {!BOT_CAPS[b.code].hasTradeHistory && (
              <p className="wtc-dim" style={{ fontSize: 12, margin: '10px 0 0' }}>
                Limited data - trade history and equity curve are not available for this bot.
              </p>
            )}
            <div style={{ marginTop: 16 }}>
              <Link href={`/app/bots/${b.slug}`} className={buttonClasses(b.access.allowed ? 'primary' : 'ghost')}>
                {b.access.allowed ? 'Open dashboard' : 'View status'}
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <p className="wtc-dim" style={{ fontSize: 12 }}>
        Read-only monitoring through adapters. "Stop" never closes positions. Live controls remain disabled until a separately audited adapter is approved.
        See docs/BOT_CONTROL_SAFETY_MODEL.md.
      </p>
    </div>
  );
}
