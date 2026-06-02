import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  findUserByEmail,
  ensureBotInstance,
  importBotTrade,
  listBotTradeImports,
  listBotTradeReviews,
  upsertBotTradeReview,
  recentAuditEvents,
  type Db,
} from '@wtc/db';

let db: Db;
let userId: string;
let botInstanceId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  userId = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  botInstanceId = (await ensureBotInstance(db, { userId, productCode: 'tortila_bot' })).id;
}, 30_000);

describe('bot trade journal review overlay', () => {
  it('keeps imported trades immutable and stores editable review metadata separately', async () => {
    await importBotTrade(db, {
      botInstanceId,
      externalTradeId: 'journal-1',
      symbol: 'XRP-USDT',
      side: 'long',
      entryPrice: '1.20',
      exitPrice: '1.32',
      size: '1000',
      realizedPnlUsd: '120',
      feesUsd: '1.25',
      fundingPaidUsd: '0.15',
      openedAt: new Date('2026-01-01T00:00:00Z'),
      closedAt: new Date('2026-01-02T00:00:00Z'),
      exitReason: 'take_profit',
      sourceAdapter: 'tortila',
      rawJson: { holdHours: 24, retPct: 10 },
    });

    const review = await upsertBotTradeReview(db, {
      botInstanceId,
      externalTradeId: 'journal-1',
      sourceAdapter: 'tortila',
      reviewStatus: 'flagged',
      tags: ['trend', 'late-entry'],
      setup: 'breakout',
      mistake: 'late add',
      notes: 'Good direction, poor add timing.',
      rMultiple: '2.4',
      maePct: '1.1',
      mfePct: '7.8',
      actorUserId: userId,
    });

    expect(review.reviewStatus).toBe('flagged');
    expect(review.tags).toEqual(['trend', 'late-entry']);
    expect(review.rMultiple).toBe('2.4000');

    const trades = await listBotTradeImports(db, botInstanceId, { limit: 10 });
    expect(trades).toHaveLength(1);
    expect(trades[0]!.realizedPnlUsd).toBe('120.0000');

    await upsertBotTradeReview(db, {
      botInstanceId,
      externalTradeId: 'journal-1',
      sourceAdapter: 'tortila',
      reviewStatus: 'reviewed',
      tags: ['trend'],
      setup: 'breakout',
      notes: 'Reviewed after replay.',
      rMultiple: '2.8',
      actorUserId: userId,
    });

    const reviews = await listBotTradeReviews(db, botInstanceId);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]!.reviewStatus).toBe('reviewed');
    expect(reviews[0]!.notes).toBe('Reviewed after replay.');

    const audit = await recentAuditEvents(db, 1000);
    const reviewEvents = audit.filter((e) => e.action === 'bot.trade_review.save');
    expect(reviewEvents).toHaveLength(2);
    expect(reviewEvents[0]!.targetId).toContain('journal-1');
  });
});
