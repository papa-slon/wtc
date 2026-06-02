import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { Card, EmptyState, MetricCard, RiskWarningBanner, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import { fmtDateTime, fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { loadBot, BotAccessRequired } from '@/features/bots/data';
import { BotSubNav } from '@/components/BotSubNav';
import { loadBotJournal, saveTradeReviewFromForm, type JournalTradeView } from '@/features/bots/journal';

export const dynamic = 'force-dynamic';

async function saveTradeReviewAction(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const bot = String(formData.get('bot') ?? '');
  const { meta, access } = await loadBot(bot);
  if (!access.allowed) return;
  await saveTradeReviewFromForm(user.id, meta.code, Object.fromEntries(formData));
  revalidatePath(`/app/bots/${bot}/journal`);
}

function reviewTone(status: string): Tone {
  if (status === 'reviewed') return 'ok';
  if (status === 'flagged') return 'bad';
  if (status === 'ignored') return 'neutral';
  return 'warn';
}

function summary(trades: JournalTradeView[]) {
  const reviewed = trades.filter((t) => t.review.reviewStatus === 'reviewed').length;
  const flagged = trades.filter((t) => t.review.reviewStatus === 'flagged').length;
  const net = trades.reduce((sum, t) => sum + t.netPnl, 0);
  const rRows = trades.map((t) => t.review.rMultiple).filter((n): n is number => n !== null);
  const avgR = rRows.length ? rRows.reduce((sum, n) => sum + n, 0) / rRows.length : null;
  return { reviewed, flagged, net, avgR };
}

function TradeReviewCard({ bot, trade, canSave }: { bot: string; trade: JournalTradeView; canSave: boolean }) {
  const tone = trade.netPnl >= 0 ? 'up' : 'down';
  return (
    <article style={{ padding: 14, border: '1px solid var(--stroke)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
      <div className="wtc-spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div className="wtc-row" style={{ gap: 8 }}>
            <strong>{trade.symbol}</strong>
            <StatusPill tone={trade.side === 'long' ? 'ok' : 'warn'}>{trade.side}</StatusPill>
            <StatusPill tone={reviewTone(trade.review.reviewStatus)}>{trade.review.reviewStatus}</StatusPill>
          </div>
          <div className="wtc-dim" style={{ fontSize: 12, marginTop: 4 }}>
            {fmtDateTime(trade.openedAt)}{' -> '}{fmtDateTime(trade.closedAt)}{' | '}{trade.exitReason ?? 'exit not classified'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={tone === 'up' ? 'wtc-up' : 'wtc-down'} style={{ fontSize: 20, fontWeight: 800 }}>{fmtMoney(trade.netPnl)}</div>
          <div className="wtc-dim" style={{ fontSize: 12 }}>net after fees/funding</div>
        </div>
      </div>

      <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12 }}>
        <MetricCard label="Entry / exit" value={`${trade.entryPrice != null ? fmtNum(trade.entryPrice) : '-'} / ${trade.exitPrice != null ? fmtNum(trade.exitPrice) : '-'}`} />
        <MetricCard label="Qty" value={fmtNum(trade.qty)} />
        <MetricCard label="Hold" value={trade.holdHours != null ? `${fmtNum(trade.holdHours)}h` : '-'} />
        <MetricCard label="Return" value={fmtPct(trade.retPct)} />
      </div>

      <form action={saveTradeReviewAction} className="wtc-stack" style={{ marginTop: 14, gap: 10 }}>
        <CsrfField />
        <input type="hidden" name="bot" value={bot} />
        <input type="hidden" name="externalTradeId" value={trade.externalTradeId} />
        <input type="hidden" name="sourceAdapter" value={trade.sourceAdapter} />
        <div className="wtc-grid wtc-grid-4">
          <label className="wtc-field" style={{ margin: 0 }}>
            <span>Status</span>
            <select className="wtc-input" name="reviewStatus" defaultValue={trade.review.reviewStatus} disabled={!canSave}>
              <option value="unreviewed">Needs review</option>
              <option value="reviewed">Reviewed</option>
              <option value="flagged">Flagged</option>
              <option value="ignored">Ignored</option>
            </select>
          </label>
          <label className="wtc-field" style={{ margin: 0 }}>
            <span>R multiple</span>
            <input className="wtc-input" name="rMultiple" inputMode="decimal" defaultValue={trade.review.rMultiple ?? ''} disabled={!canSave} />
          </label>
          <label className="wtc-field" style={{ margin: 0 }}>
            <span>MAE %</span>
            <input className="wtc-input" name="maePct" inputMode="decimal" defaultValue={trade.review.maePct ?? ''} disabled={!canSave} />
          </label>
          <label className="wtc-field" style={{ margin: 0 }}>
            <span>MFE %</span>
            <input className="wtc-input" name="mfePct" inputMode="decimal" defaultValue={trade.review.mfePct ?? ''} disabled={!canSave} />
          </label>
        </div>
        <div className="wtc-grid wtc-grid-3">
          <label className="wtc-field" style={{ margin: 0 }}>
            <span>Setup</span>
            <input className="wtc-input" name="setup" placeholder="breakout, pullback..." defaultValue={trade.review.setup ?? ''} disabled={!canSave} />
          </label>
          <label className="wtc-field" style={{ margin: 0 }}>
            <span>Mistake</span>
            <input className="wtc-input" name="mistake" placeholder="late entry, ignored DD..." defaultValue={trade.review.mistake ?? ''} disabled={!canSave} />
          </label>
          <label className="wtc-field" style={{ margin: 0 }}>
            <span>Tags</span>
            <input className="wtc-input" name="tags" placeholder="trend, stop, news" defaultValue={trade.review.tags.join(', ')} disabled={!canSave} />
          </label>
        </div>
        <label className="wtc-field" style={{ margin: 0 }}>
          <span>Notes</span>
          <textarea className="wtc-input" name="notes" rows={3} placeholder="What happened? What should be repeated or avoided?" defaultValue={trade.review.notes ?? ''} disabled={!canSave} />
        </label>
        <div className="wtc-row">
          <button className={buttonClasses('primary')} type="submit" disabled={!canSave}>Save review</button>
          <span className="wtc-dim" style={{ fontSize: 12 }}>
            {trade.review.updatedAt ? `last updated ${fmtDateTime(trade.review.updatedAt)}` : 'no review saved yet'}
          </span>
        </div>
      </form>
    </article>
  );
}

export default async function Page({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const { meta, access } = await loadBot(bot);
  if (!access.allowed) return <BotAccessRequired meta={meta} section="Journal" />;

  const user = await requireUser();
  const journal = await loadBotJournal(meta.code, user.id);
  const s = summary(journal.trades);

  return (
    <div className="wtc-stack">
      <div className="wtc-spread" style={{ flexWrap: 'wrap' }}>
        <SectionHeader
          kicker={`${meta.name} - Journal`}
          title="Trade review journal"
          copy="A WTC-owned review layer over imported or latest adapter trades. Bot trade data stays immutable; notes, tags, R-multiple, and review status live in WTC."
        />
        <StatusPill tone={journal.mode === 'postgres' ? 'ok' : 'warn'}>{journal.mode === 'postgres' ? 'storage: Postgres' : 'storage: in-memory demo'}</StatusPill>
      </div>
      <BotSubNav bot={bot} active="journal" />

      {journal.source === 'adapter_latest' ? (
        <RiskWarningBanner
          severity="warning"
          title="Using latest adapter trades"
          detail="No durable imported trades were found for this bot instance yet. The page falls back to the current read adapter; once the worker imports trades, this journal becomes DB-first."
        />
      ) : (
        <RiskWarningBanner
          severity="info"
          title="DB-first journal"
          detail="Closed trades are loaded from bot_trade_imports. Reviews are stored separately in bot_trade_reviews and can be edited without mutating imported trade facts."
        />
      )}
      {!journal.canSaveReviews && (
        <RiskWarningBanner severity="warning" title="Review saving disabled in demo mode" detail="Set DATABASE_URL to persist trade notes, tags, and review statuses." />
      )}

      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Closed trades" value={journal.trades.length} />
        <MetricCard label="Reviewed" value={`${s.reviewed}/${journal.trades.length}`} />
        <MetricCard label="Flagged" value={s.flagged} tone={s.flagged > 0 ? 'down' : undefined} />
        <MetricCard label="Net PnL" value={fmtMoney(s.net)} tone={s.net >= 0 ? 'up' : 'down'} sub={s.avgR != null ? `avg R ${fmtNum(Number(s.avgR.toFixed(2)))}` : 'R-multiple not reviewed yet'} />
      </div>

      <Card title="Review queue">
        {journal.trades.length === 0 ? (
          <EmptyState title="No closed trades available" hint="Run the worker import or connect a read-only adapter to populate this journal." />
        ) : (
          <div className="wtc-stack">
            {journal.trades.map((trade) => (
              <TradeReviewCard key={`${trade.sourceAdapter}:${trade.externalTradeId}`} bot={bot} trade={trade} canSave={journal.canSaveReviews} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
