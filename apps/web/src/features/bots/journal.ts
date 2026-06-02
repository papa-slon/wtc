import 'server-only';
import { z } from 'zod';
import type { BotProductCode } from '@wtc/bot-adapters';
import type { CanonicalTrade } from '@wtc/analytics';
import { getServerDb } from '@/lib/backend';
import { loadBotReadModel } from './data';
import {
  ensureBotInstance,
  listBotTradeImports,
  listBotTradeReviews,
  upsertBotTradeReview,
  type BotTradeReviewStatus,
} from '@wtc/db';

export const tradeReviewSchema = z.object({
  bot: z.string().min(1),
  externalTradeId: z.string().min(1).max(160),
  sourceAdapter: z.string().min(1).max(80),
  reviewStatus: z.enum(['unreviewed', 'reviewed', 'flagged', 'ignored']).default('unreviewed'),
  tags: z.string().max(240).optional(),
  setup: z.string().max(120).optional(),
  mistake: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  rMultiple: z.string().max(30).optional(),
  maePct: z.string().max(30).optional(),
  mfePct: z.string().max(30).optional(),
});

export interface TradeReviewView {
  reviewStatus: BotTradeReviewStatus;
  tags: string[];
  setup: string | null;
  mistake: string | null;
  notes: string | null;
  rMultiple: number | null;
  maePct: number | null;
  mfePct: number | null;
  updatedAt: number | null;
}

export interface JournalTradeView {
  externalTradeId: string;
  sourceAdapter: string;
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  entryPrice: number | null;
  exitPrice: number | null;
  realizedPnl: number;
  feesUsd: number;
  fundingUsd: number;
  netPnl: number;
  openedAt: number;
  closedAt: number;
  exitReason: string | null;
  holdHours: number | null;
  retPct: number | null;
  review: TradeReviewView;
}

export interface BotJournalView {
  mode: 'postgres' | 'demo';
  source: 'db_imports' | 'adapter_latest';
  canSaveReviews: boolean;
  botInstanceId: string | null;
  trades: JournalTradeView[];
}

const emptyReview: TradeReviewView = {
  reviewStatus: 'unreviewed',
  tags: [],
  setup: null,
  mistake: null,
  notes: null,
  rMultiple: null,
  maePct: null,
  mfePct: null,
  updatedAt: null,
};

function key(sourceAdapter: string, externalTradeId: string): string {
  return `${sourceAdapter}:${externalTradeId}`;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizedNumberString(raw: string | undefined): string | null {
  const n = toNumber(raw);
  return n === null ? null : String(n);
}

function tagsFromString(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function reviewFromRow(row: Awaited<ReturnType<typeof listBotTradeReviews>>[number] | undefined): TradeReviewView {
  if (!row) return emptyReview;
  return {
    reviewStatus: row.reviewStatus as BotTradeReviewStatus,
    tags: row.tags ?? [],
    setup: row.setup,
    mistake: row.mistake,
    notes: row.notes,
    rMultiple: toNumber(row.rMultiple),
    maePct: toNumber(row.maePct),
    mfePct: toNumber(row.mfePct),
    updatedAt: row.updatedAt.getTime(),
  };
}

function adapterSource(productCode: BotProductCode, mode: 'mock' | 'real'): string {
  if (productCode === 'tortila_bot') return mode === 'real' ? 'tortila' : 'tortila-mock';
  return mode === 'real' ? 'legacy' : 'legacy-mock';
}

function fromCanonicalTrade(t: CanonicalTrade, sourceAdapter: string, review: TradeReviewView): JournalTradeView {
  const netPnl = t.realizedPnl - t.fee + t.funding;
  return {
    externalTradeId: t.id,
    sourceAdapter,
    symbol: t.symbol,
    side: t.side,
    qty: t.qty,
    entryPrice: t.entryPrice ?? null,
    exitPrice: t.exitPrice ?? null,
    realizedPnl: t.realizedPnl,
    feesUsd: t.fee,
    fundingUsd: t.funding,
    netPnl,
    openedAt: t.openedAt,
    closedAt: t.closedAt ?? t.openedAt,
    exitReason: t.exitReason ?? null,
    holdHours: t.holdHours ?? null,
    retPct: t.retPct ?? null,
    review,
  };
}

export async function loadBotJournal(productCode: BotProductCode, userId: string): Promise<BotJournalView> {
  const db = getServerDb();

  if (!db) {
    const read = await loadBotReadModel(productCode, ['trades']);
    const sourceAdapter = adapterSource(productCode, read.adapterMode);
    return {
      mode: 'demo',
      source: 'adapter_latest',
      canSaveReviews: false,
      botInstanceId: null,
      trades: (read.trades.data ?? []).filter((t) => t.closedAt !== null).map((t) => fromCanonicalTrade(t, sourceAdapter, emptyReview)),
    };
  }

  const inst = await ensureBotInstance(db, { userId, productCode });
  const [imports, reviews] = await Promise.all([
    listBotTradeImports(db, inst.id, { limit: 200 }),
    listBotTradeReviews(db, inst.id),
  ]);
  const reviewMap = new Map(reviews.map((r) => [key(r.sourceAdapter, r.externalTradeId), r]));

  if (imports.length > 0) {
    return {
      mode: 'postgres',
      source: 'db_imports',
      canSaveReviews: true,
      botInstanceId: inst.id,
      trades: imports.map((t) => {
        const raw = (t.rawJson ?? {}) as Record<string, unknown>;
        const fees = Number(t.feesUsd);
        const funding = Number(t.fundingPaidUsd);
        const pnl = Number(t.realizedPnlUsd);
        return {
          externalTradeId: t.externalTradeId,
          sourceAdapter: t.sourceAdapter,
          symbol: t.symbol,
          side: t.side as 'long' | 'short',
          qty: Number(t.size),
          entryPrice: Number(t.entryPrice),
          exitPrice: Number(t.exitPrice),
          realizedPnl: pnl,
          feesUsd: fees,
          fundingUsd: funding,
          netPnl: pnl - fees + funding,
          openedAt: t.openedAt.getTime(),
          closedAt: t.closedAt.getTime(),
          exitReason: t.exitReason,
          holdHours: toNumber(raw.holdHours),
          retPct: toNumber(raw.retPct),
          review: reviewFromRow(reviewMap.get(key(t.sourceAdapter, t.externalTradeId))),
        };
      }),
    };
  }

  const read = await loadBotReadModel(productCode, ['trades']);
  const sourceAdapter = adapterSource(productCode, read.adapterMode);
  return {
    mode: 'postgres',
    source: 'adapter_latest',
    canSaveReviews: true,
    botInstanceId: inst.id,
    trades: (read.trades.data ?? [])
      .filter((t) => t.closedAt !== null)
      .map((t) => fromCanonicalTrade(t, sourceAdapter, reviewFromRow(reviewMap.get(key(sourceAdapter, t.id))))),
  };
}

export async function saveTradeReviewFromForm(userId: string, productCode: BotProductCode, raw: unknown): Promise<'saved' | 'demo' | 'invalid'> {
  const parsed = tradeReviewSchema.safeParse(raw);
  if (!parsed.success) return 'invalid';
  const db = getServerDb();
  if (!db) return 'demo';
  // Imported trades remain immutable; review saves touch only the editable WTC overlay.
  const inst = await ensureBotInstance(db, { userId, productCode });
  await upsertBotTradeReview(db, {
    botInstanceId: inst.id,
    externalTradeId: parsed.data.externalTradeId,
    sourceAdapter: parsed.data.sourceAdapter,
    reviewStatus: parsed.data.reviewStatus,
    tags: tagsFromString(parsed.data.tags),
    setup: parsed.data.setup?.trim() || null,
    mistake: parsed.data.mistake?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    rMultiple: normalizedNumberString(parsed.data.rMultiple),
    maePct: normalizedNumberString(parsed.data.maePct),
    mfePct: normalizedNumberString(parsed.data.mfePct),
    actorUserId: userId,
  });
  return 'saved';
}
