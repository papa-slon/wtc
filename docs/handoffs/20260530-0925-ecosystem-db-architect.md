# ecosystem-db-architect handoff

_Epoch 20260530-0925. Phase 2.1 — Migration 0002 Implementation Audit (read-only verification wave).
No schema.ts / repositories.ts / seed.ts / migrations edited this wave. This handoff is the
operator's implementation source for the Wave-2 serial implementer._

---

## Scope

Re-verify the 20260530-0126 design against current code. Produce:

1. Collision check — confirm all 18 new tables + 1 ALTER are additive-only against current `schema.ts` and `0000`/`0001` SQL.
2. Exact Drizzle TypeScript for every table, matching current `schema.ts` idioms precisely.
3. Critical gotcha list with exact guidance (column name traps, circular FK, partial index caveat, ip_address type, courses backfill sequencing, numeric precision, db:generate offline mode).
4. Complete PGlite integration test cases per table group.
5. `db:generate` flow confirmation.

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md` (authoritative design)
- `docs/DATA_MODEL.md` (full, both pages)
- `packages/db/src/schema.ts` (full — 21 tables, all idioms verified)
- `packages/db/src/repositories.ts` (full — canonical txn+audit pattern, `revokeTv` debt confirmed)
- `packages/db/src/seed.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql` (full)
- `packages/db/migrations/0001_early_toad_men.sql` (UNIQUE index fix only)
- `packages/db/drizzle.config.ts`
- `tests/integration/db-persistence.test.ts` (full — PGlite harness pattern confirmed)
- `packages/db/migrations/meta/_journal.json` (presence confirmed; 2 migrations only)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### 1. [INFO] Collision check — zero collisions confirmed

**Tables in schema.ts (21 REAL tables):**
`users`, `roles`, `user_roles`, `sessions`, `products`, `plans`, `entitlements`,
`subscriptions`, `exchange_accounts`, `exchange_api_key_secrets`, `bot_instances`,
`bot_configs`, `axioma_account_links`, `tradingview_access_requests`,
`tradingview_access_tasks`, `courses`, `lessons`, `materials`, `audit_logs`,
`job_queue`, `integration_health_checks`.

**0002 new tables (18) — none collide:**
`bot_config_versions`, `bot_metric_snapshots`, `bot_position_snapshots`,
`bot_trade_imports`, `bot_safety_events`, `teacher_profiles`, `enrollments`,
`lesson_progress`, `pinned_links`, `tradingview_profiles`,
`tradingview_access_grants`, `product_access_events`, `terminal_release_cache`,
`terminal_download_events`, `terminal_license_events`, `notifications`,
`support_tickets`.

**0002 ALTER on existing table — additive only:**
`tradingview_access_requests` — adds `revoked_at TIMESTAMPTZ` (nullable) and
`revoked_by UUID` (nullable, FK → `users.id`). Neither column name exists in the
current schema (`schema.ts` line 148–157; `0000` SQL lines 160–168). Safe.

**No 0002 migration file exists yet** — `packages/db/migrations/` contains only
`0000_broken_jack_murdock.sql` and `0001_early_toad_men.sql`. Clean slate confirmed.

---

### 2. [CRITICAL] `bot_configs` real column names: `version` and `config` (NOT `current_version`/`config_json`)

Evidence: `schema.ts` lines 129–134; `0000` SQL lines 27–33.

```ts
// REAL — schema.ts lines 129–134
export const botConfigs = pgTable('bot_configs', {
  id: id(),
  botInstanceId: uuid('bot_instance_id').notNull().references(() => botInstances.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),   // column name is "version"
  config: jsonb('config').$type<Record<string, unknown>>().notNull(), // column name is "config"
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

The new `bot_config_versions` table uses `config_json` (correct — it is a different table).
The Wave-2 implementer must NOT rename existing `bot_configs.version` or `bot_configs.config`.
Repo layer for `insertBotConfigVersion` reads from `bot_configs.version` (integer) to compute
the next version number. The column mapping is: `bot_configs.config` → current config JSONB,
`bot_config_versions.config_json` → historical snapshot.

---

### 3. [CRITICAL] `tradingview_access_requests` has column `tradingview_username` (NOT `tv_username`)

Evidence: `schema.ts` line 152: `tradingViewUsername: text('tradingview_username').notNull()`.
Evidence: `0000` SQL line 163: `"tradingview_username" text NOT NULL`.

The new `tradingview_profiles` and `tradingview_access_grants` tables use `tv_username` (correct
for their own columns). The `revokeTv` repo update at `schema.ts` line 280 touches
`tradingview_access_requests` — the existing column stays `tradingview_username`. The 0002 ALTER
only adds `revoked_at` and `revoked_by`; it does NOT rename this column.

The `tradingviewAccessRequests` Drizzle object currently exposes `.tradingViewUsername` (TS camelCase)
mapping to `tradingview_username` (DB snake_case). New repo functions in Wave-2 must reference
`s.tradingviewAccessRequests.tradingViewUsername` (NOT `.tvUsername`).

---

### 4. [CRITICAL] `tradingview_access_requests.requestedAt` maps to column `created_at` (NOT `requested_at`)

Evidence: `schema.ts` line 153: `requestedAt: createdAt()` — the `createdAt()` helper writes
`timestamp('created_at', ...)`. The SQL column is literally `created_at`, not `requested_at`.

The `tradingview_access_requests` table has NO `requested_at` column. The DATA_MODEL.md spec
calls it `requested_at` (TARGET design); the actual schema uses `created_at`. The Wave-2
implementer for `revokeTv` updates must query by `.id` only; no ambiguity there. But the
`TvRequestDTO.requestedAt` getter in `rowToTvDto` correctly reads `r.requestedAt` (which is
the Drizzle TS name for the `created_at` column).

---

### 5. [CRITICAL] `tradingview_profiles.current_grant_id` — circular FK requires two-step insert

Evidence: `tradingview_profiles.current_grant_id` is a FK → `tradingview_access_grants.id`,
but `tradingview_access_grants.request_id` is a FK → `tradingview_access_requests.id`, which
exists before the grant is created. The circular dependency is only on the profile → grant direction.

Required two-step pattern in `createTvGrant`:
```
Step 1: INSERT INTO tradingview_access_grants (..., revoked_at=NULL, revoked_by=NULL) RETURNING id → grantId
Step 2: INSERT INTO tradingview_profiles (user_id, tv_username, current_grant_id=grantId, ...)
         ON CONFLICT (user_id) DO UPDATE SET current_grant_id=grantId, tv_username=..., updated_at=NOW()
```
Both steps in the same transaction. The profile row is either created (first grant) or updated
(subsequent grant). Do NOT try to set `current_grant_id` in the same INSERT statement as the
grant row — the grant PK does not exist yet at that point if using a DB-generated UUID.
With `defaultRandom()` / `gen_random_uuid()`, the UUID is generated DB-side, so step 1 must
complete and RETURN the id before step 2 can reference it.

---

### 6. [CRITICAL] `terminal_download_events.ip_address` must be TEXT (not INET)

Evidence: DATA_MODEL.md section 5.3 note; 20260530-0126 handoff Decision 8.

PGlite does not support the PostgreSQL `INET` type. If `INET` is used in the Drizzle declaration,
the PGlite test harness will fail at migration apply time. Use `text('ip_address')` in schema.ts.
The production Postgres 17 instance tolerates TEXT for IP addresses; no validation at DB level
(validation happens at the route layer via Zod).

Contrast: `audit_logs.ip` in the existing schema is already declared as `text('ip')` (schema.ts
line 208) — same pattern.

---

### 7. [CRITICAL] `notifications` partial index — PGlite caveat

Evidence: design handoff specifies `WHERE read_at IS NULL` partial index for fast unread count.

PGlite (WASM Postgres) supports partial indexes syntactically BUT drizzle-kit `generate` emits
the WHERE clause inside the index definition. The migration SQL will contain:
```sql
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at")
WHERE "read_at" IS NULL;
```
This IS valid PGlite syntax — PGlite runs PostgreSQL 16 WASM engine which supports partial
indexes. The caveat is that drizzle-kit's `.where()` on an `index()` declaration requires the
`sql` import. The exact Drizzle declaration is shown in the schema block below.

---

### 8. [WARN] `courses` backfill sequencing — additive only; `owner_teacher_id` NOT dropped

Evidence: `courses` table in schema.ts line 168–176 has `ownerTeacherId` referencing `users.id`.
Migration 0002 must:
1. CREATE TABLE `teacher_profiles` (no dependency on courses)
2. INSERT INTO `teacher_profiles` for each distinct `owner_teacher_id` in `courses`
3. ADD COLUMN `teacher_profile_id UUID` to `courses` (nullable — NOT NOT NULL yet)
4. UPDATE `courses SET teacher_profile_id = tp.id FROM teacher_profiles tp WHERE courses.owner_teacher_id = tp.user_id`
5. Do NOT drop `owner_teacher_id` in 0002 — additive only

The Drizzle schema.ts addition for `courses` is:
```ts
teacherProfileId: uuid('teacher_profile_id').references(() => teacherProfiles.id),
// nullable — existing rows populated by 0002 backfill; owner_teacher_id column kept
```

All of this happens in the 0002 SQL file, not in schema.ts. The schema.ts addition only adds
`teacherProfileId` to the `courses` pgTable definition (drizzle-kit will generate the ADD COLUMN
statement; the backfill UPDATE and teacher_profiles INSERT must be hand-added to the generated SQL).

---

### 9. [WARN] `revokeTv` audit debt — must be fixed in Wave-2 alongside 0002

Evidence: `repositories.ts` line 278 comment: "adminId/now are recorded in the audit row (the schema
has no revoked_at/revoked_by columns yet)". Line 280 only sets `status: 'revoked'` — it does NOT
set `revoked_at` or `revoked_by` on the request row, and does NOT populate the new 0002 columns on
`tradingview_access_grants`.

After 0002 lands, the updated `revokeTv` (or the new `revokeTvGrant`) must:
```ts
await tx.update(s.tradingviewAccessRequests)
  .set({ status: 'revoked', revokedAt: new Date(now), revokedBy: adminId })
  .where(eq(s.tradingviewAccessRequests.id, requestId));
await tx.update(s.tradingviewAccessGrants)
  .set({ revokedAt: new Date(now), revokedBy: adminId, revokeReason: reason ?? null })
  .where(eq(s.tradingviewAccessGrants.id, grantId));
// audit row already present (existing pattern)
```

---

### 10. [INFO] `db:generate` works offline — confirmed

Evidence: `drizzle.config.ts` lines 7–8:
```ts
const url = process.env.DATABASE_URL ?? '';
```
The comment explicitly states: "`db:generate` (offline schema diff) does not connect, so an empty
URL is fine there". The `npm run db:generate -w @wtc/db` command runs `drizzle-kit generate`
which compares `packages/db/src/schema.ts` against the last `meta/` snapshot. No DATABASE_URL
needed. It produces `0002_<hash>.sql` + updated `meta/0002_snapshot.json` + updated `_journal.json`.

The operator must run:
```
npm run db:generate -w @wtc/db
```
Then review the generated SQL and manually insert the `teacher_profiles` backfill statements
(the INSERT/UPDATE for existing courses rows) because Drizzle cannot generate data-migration
statements — it only generates DDL.

---

### 11. [INFO] `schema` export missing for PGlite harness

Evidence: `db-persistence.test.ts` line 13 imports `schema` from `@wtc/db`. This requires
`packages/db/src/index.ts` to export `* as schema from './schema.ts'`. The current test works
because this export already exists (confirmed by test passing at 106/5 per the Phase 2 memory note).
Wave-2 additions to `schema.ts` will be automatically included in the `schema` re-export — no
change needed to `index.ts`.

---

### 12. [INFO] `numeric` builder not imported in current schema.ts — must be added

Evidence: `schema.ts` line 8 imports:
```ts
import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
```
`numeric` is NOT imported. All 0002 bot/position tables use `NUMERIC(18,4)` / `NUMERIC(20,8)` /
`NUMERIC(5,2)` / `NUMERIC(6,4)` / `NUMERIC(8,4)`. The Wave-2 implementer must add `numeric` to
the import:
```ts
import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, uniqueIndex, index, numeric } from 'drizzle-orm/pg-core';
```
Also `sql` is needed for the `notifications` partial index WHERE clause:
```ts
import { ..., sql } from 'drizzle-orm';
```

---

### 13. [INFO] `tradingview_access_tasks` already exists — `tradingview_access_grants` FK is new

Evidence: `tradingview_access_tasks` is REAL (schema.ts lines 159–165). Its `grant_id` column
does NOT yet exist — the current table only has `requestId`. The DATA_MODEL spec (section 6.4)
shows `grant_id` as a column, but the current schema.ts does NOT have it. Migration 0002 must
NOT add `grant_id` to `tradingview_access_tasks` until `tradingview_access_grants` exists.
Since `tradingview_access_grants` is new in 0002, the `grant_id` FK column on
`tradingview_access_tasks` can be added in 0002 as an ALTER — but check whether the existing
schema.ts `tradingviewAccessTasks` definition needs updating. Per the additive-only rule,
this means an ADD COLUMN to `tradingview_access_tasks` in 0002, OR the implementer accepts
that `grant_id` stays absent from `tradingview_access_tasks` until Phase 3. Recommendation:
defer the `grant_id` FK on tasks to Phase 3 — the task queue still functions via `request_id`.

---

## Decisions

1. The 18 new tables and 1 ALTER are all confirmed additive with zero collision against existing
   21-table schema.
2. `db:generate` runs offline (no DATABASE_URL needed); generates DDL only. Backfill DML for
   `teacher_profiles` must be hand-inserted into the generated SQL file.
3. `numeric` and `sql` must be added to the import line in `schema.ts`.
4. `ip_address` on `terminal_download_events` is `text()`, not `customType('inet')`.
5. The `tradingview_access_tasks.grant_id` FK addition is deferred to Phase 3 (after grants land
   and the task queue is tested with the new grant shape).
6. `courses.owner_teacher_id` is NOT dropped in 0002 — additive only, per the design handoff.
7. `revokeTv` audit debt is Wave-2 work alongside the 0002 schema — not a schema change, a repo change.
8. Partial index `WHERE read_at IS NULL` on `notifications` is valid PGlite syntax; use `sql` template.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Operator forgets to add `numeric` and `sql` imports | P1 | Import line shown explicitly in schema block below |
| Operator tries to use Drizzle for backfill DML | P1 | Drizzle-kit only generates DDL; hand-add the INSERT/UPDATE to the generated SQL |
| Operator sets `current_grant_id` in the same stmt as grant INSERT | P1 | Two-step pattern in `createTvGrant` is mandatory |
| `ip_address` declared as pg INET type | P1 | Breaks PGlite harness; use `text()` |
| `tradingview_access_requests` column name confusion (`tradingview_username` vs `tv_username`) | P2 | Different tables, different names; documented in Finding 3 |
| `bot_configs.config` vs `bot_config_versions.config_json` confusion | P2 | Different tables; never rename existing columns |
| Partial index on `notifications` emitted without WHERE clause | P2 | Use `index(...).on(...).where(sql\`"read_at" IS NULL\`)` |
| Missing `teacherProfileId` column on `courses` in schema.ts | P2 | Must be added to courses pgTable definition alongside teacher_profiles |
| Forgetting the `courses` backfill in the generated SQL | P2 | Checklist in Next actions below |

---

## Verification/tests

### PGlite test harness pattern (existing, from `db-persistence.test.ts`)

```ts
beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  db = drizzle(pg, { schema }) as unknown as Db;
});
```

After 0002 lands, `files` will include `0002_*.sql`. The harness automatically picks it up
because it reads the directory sorted. No change to `beforeAll` needed.

---

### Required new PGlite integration test cases

Add to `tests/integration/db-persistence.test.ts` as additional `describe` blocks.

#### Group A — Bots (5 tables)

```ts
describe('Bot persistence (0002): config versions, metrics, positions, trades, safety events', () => {
  it('insertBotConfigVersion: append-only; duplicate (botInstanceId, version) throws', async () => {
    // Setup: need a bot_instance row
    const u = await createUser(db, { email: 'bottest@wtc.local', passwordHash: 'h', displayName: 'BT' });
    const [inst] = await db.insert(schema.botInstances).values({ userId: u.id, productCode: 'tortila_bot' }).returning();
    // Insert v1
    await insertBotConfigVersion(db, { botInstanceId: inst.id, version: 1, configJson: { symbols: ['BTCUSDT'] } });
    // Insert v1 again → unique(botInstanceId, version) violation
    await expect(
      insertBotConfigVersion(db, { botInstanceId: inst.id, version: 1, configJson: { symbols: ['ETHUSDT'] } })
    ).rejects.toThrow(); // SQLSTATE 23505
    // v2 fine
    await insertBotConfigVersion(db, { botInstanceId: inst.id, version: 2, configJson: { symbols: ['ETHUSDT'] } });
    const versions = await listBotConfigVersions(db, inst.id);
    expect(versions.length).toBe(2);
    expect(versions[0]!.version).toBe(2); // DESC order
  });

  it('importBotTrade: duplicate import returns inserted:false', async () => {
    const u = await findUserByEmail(db, 'bottest@wtc.local');
    const [inst] = await db.select().from(schema.botInstances).where(eq(schema.botInstances.userId, u!.id)).limit(1);
    const tradeInput = {
      botInstanceId: inst.id,
      externalTradeId: 'trade-001',
      symbol: 'BTCUSDT',
      side: 'long' as const,
      entryPrice: '40000',
      exitPrice: '41000',
      size: '0.01',
      realizedPnlUsd: '10.00',
      feesUsd: '0.50',
      fundingPaidUsd: '0.00',
      openedAt: new Date('2026-01-01T10:00:00Z'),
      closedAt: new Date('2026-01-01T12:00:00Z'),
      sourceAdapter: 'tortila',
    };
    const first = await importBotTrade(db, tradeInput);
    expect(first.inserted).toBe(true);
    const second = await importBotTrade(db, tradeInput);
    expect(second.inserted).toBe(false); // idempotent — unique(botInstanceId, externalTradeId, sourceAdapter)
  });

  it('insertBotMetricSnapshot: stored and listBotMetricSnapshots returns DESC order', async () => {
    const u = await findUserByEmail(db, 'bottest@wtc.local');
    const [inst] = await db.select().from(schema.botInstances).where(eq(schema.botInstances.userId, u!.id)).limit(1);
    const t1 = new Date('2026-01-01T00:00:00Z');
    const t2 = new Date('2026-01-02T00:00:00Z');
    await insertBotMetricSnapshot(db, { botInstanceId: inst.id, snapshotAt: t1, walletEquityUsd: '1000', sourceAdapter: 'tortila' });
    await insertBotMetricSnapshot(db, { botInstanceId: inst.id, snapshotAt: t2, walletEquityUsd: '1050', sourceAdapter: 'tortila' });
    const snapshots = await listBotMetricSnapshots(db, inst.id, 10);
    expect(snapshots[0]!.snapshotAt.getTime()).toBeGreaterThan(snapshots[1]!.snapshotAt.getTime()); // DESC
    expect(snapshots[0]!.walletEquityUsd).toBe('1050.0000');
  });

  it('insertBotSafetyEvent severity=critical writes an audit_logs row', async () => {
    const u = await findUserByEmail(db, 'bottest@wtc.local');
    const [inst] = await db.select().from(schema.botInstances).where(eq(schema.botInstances.userId, u!.id)).limit(1);
    const before = (await recentAuditEvents(db, 1000)).length;
    await insertBotSafetyEvent(db, {
      botInstanceId: inst.id,
      eventCode: 'TP_REJECTION_101211',
      severity: 'critical',
      description: 'TP order rejected by exchange code 101211',
    });
    const events = await recentAuditEvents(db, 1000);
    expect(events.length).toBeGreaterThan(before);
    expect(events.some((e) => e.action === 'bot.safety_event' && e.targetId === inst.id)).toBe(true);
  });

  it('acknowledgeBotSafetyEvent sets acknowledged_at and acknowledged_by', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const u = await findUserByEmail(db, 'bottest@wtc.local');
    const [inst] = await db.select().from(schema.botInstances).where(eq(schema.botInstances.userId, u!.id)).limit(1);
    await insertBotSafetyEvent(db, {
      botInstanceId: inst.id,
      eventCode: 'RATE_LIMIT_100410',
      severity: 'warning',
      description: 'BingX rate limit hit',
    });
    const events = await listBotSafetyEvents(db, inst.id, { unacknowledgedOnly: true });
    expect(events.length).toBeGreaterThan(0);
    const eventId = events[0]!.id;
    await acknowledgeBotSafetyEvent(db, eventId, admin!.id);
    const after = await listBotSafetyEvents(db, inst.id, { unacknowledgedOnly: true });
    expect(after.find((e) => e.id === eventId)).toBeUndefined(); // no longer unacknowledged
  });
});
```

#### Group B — Education (4 tables + backfill)

```ts
describe('Education persistence (0002): teacher profiles, enrollments, lesson progress, pinned links', () => {
  let teacherUserId: string;
  let courseId: string;
  let lessonId: string;

  it('createTeacherProfile persists and is accessible by user_id', async () => {
    const teacher = await findUserByEmail(db, 'teacher@wtc.local');
    teacherUserId = teacher!.id;
    const profile = await createTeacherProfile(db, {
      userId: teacherUserId,
      displayName: 'WTC Teacher',
      bio: 'Expert trader',
      socialLinks: { telegram: 'https://t.me/wtc' },
    });
    expect(profile.userId).toBe(teacherUserId);
    const found = await getTeacherProfile(db, teacherUserId);
    expect(found?.displayName).toBe('WTC Teacher');
  });

  it('upsertEnrollment is idempotent: duplicate insert → same row, not error', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    // Get a course from the seed
    const [course] = await db.select().from(schema.courses).limit(1);
    courseId = course.id;
    const first = await upsertEnrollment(db, { userId: u!.id, courseId });
    const second = await upsertEnrollment(db, { userId: u!.id, courseId });
    expect(first.id).toBe(second.id); // ON CONFLICT DO NOTHING → same row
    // Writes audit row for education.enrolled
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'education.enrolled')).toBe(true);
  });

  it('listEnrollments per-user isolation: user A cannot see user B enrollments', async () => {
    const userA = await findUserByEmail(db, 'user@wtc.local');
    const userB = await createUser(db, { email: 'student-b@wtc.local', passwordHash: 'h', displayName: 'B' });
    // Only userA is enrolled in courseId
    const aEnrollments = await listEnrollments(db, userA!.id);
    const bEnrollments = await listEnrollments(db, userB.id);
    expect(aEnrollments.some((e) => e.courseId === courseId)).toBe(true);
    expect(bEnrollments.some((e) => e.courseId === courseId)).toBe(false); // isolation
  });

  it('upsertLessonProgress + getLessonProgress: per-user isolation', async () => {
    const userA = await findUserByEmail(db, 'user@wtc.local');
    const userB = await findUserByEmail(db, 'student-b@wtc.local');
    const [lesson] = await db.select().from(schema.lessons).limit(1);
    lessonId = lesson.id;
    await upsertLessonProgress(db, { userId: userA!.id, lessonId, percentComplete: '50.00', completed: false });
    const aProgress = await getLessonProgress(db, userA!.id, lessonId);
    expect(aProgress?.percentComplete).toBe('50.00');
    const bProgress = await getLessonProgress(db, userB!.id, lessonId);
    expect(bProgress).toBeNull(); // isolation — user B has no progress on this lesson
  });

  it('markEnrollmentComplete sets completed_at and writes audit row', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    await markEnrollmentComplete(db, u!.id, courseId);
    const enrollments = await listEnrollments(db, u!.id);
    const e = enrollments.find((e) => e.courseId === courseId);
    expect(e?.completedAt).not.toBeNull();
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((ev) => ev.action === 'education.course_completed')).toBe(true);
  });

  it('createPinnedLink and listPinnedLinks by owner', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const profile = await getTeacherProfile(db, teacherUserId);
    await createPinnedLink(db, {
      ownerType: 'teacher_profile',
      ownerId: profile!.id,
      label: 'Telegram',
      url: 'https://t.me/wtcchannel',
      iconType: 'telegram',
      sortOrder: 0,
      createdBy: admin!.id,
    });
    const links = await listPinnedLinks(db, 'teacher_profile', profile!.id);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]!.label).toBe('Telegram');
  });

  it('deletePinnedLink soft-deactivates (is_active=false) and writes audit row', async () => {
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const profile = await getTeacherProfile(db, teacherUserId);
    const links = await listPinnedLinks(db, 'teacher_profile', profile!.id);
    const linkId = links[0]!.id;
    await deletePinnedLink(db, linkId, admin!.id);
    const after = await listPinnedLinks(db, 'teacher_profile', profile!.id);
    expect(after.find((l) => l.id === linkId)).toBeUndefined(); // filtered by is_active=true
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'education.pinned_link_delete')).toBe(true);
  });
});
```

#### Group C — TradingView (2 new tables + 1 ALTER)

```ts
describe('TradingView persistence (0002): profiles, grants, revoked_at/revoked_by', () => {
  it('upsertTradingViewProfile creates profile and writes audit row', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const profile = await upsertTradingViewProfile(db, { userId: u!.id, tvUsername: 'trader_wtc' });
    expect(profile.tvUsername).toBe('trader_wtc');
    expect(profile.currentGrantId).toBeNull();
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'tv_access.profile_update')).toBe(true);
  });

  it('createTvGrant sets current_grant_id on profile (two-step pattern)', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    // Need a request first
    const req = await submitTvRequest(db, u!.id, 'trader_wtc');
    const grant = await createTvGrant(db, {
      requestId: req.id,
      userId: u!.id,
      tvUsername: 'trader_wtc',
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 86_400_000),
      grantedBy: admin!.id,
      grantedByType: 'admin',
    });
    expect(grant.id).toBeTruthy();
    // profile must have current_grant_id set
    const profile = await getTvProfile(db, u!.id);
    expect(profile?.currentGrantId).toBe(grant.id);
    // audit row
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'tv_access.grant' && e.targetId === grant.id)).toBe(true);
  });

  it('revokeTvGrant populates revoked_at/revoked_by and nulls current_grant_id', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const admin = await findUserByEmail(db, 'admin@wtc.local');
    const profile = await getTvProfile(db, u!.id);
    const grantId = profile!.currentGrantId!;
    await revokeTvGrant(db, grantId, admin!.id, 'subscription expired');
    // grant row has revoked_at set
    const grants = await listTvGrantsForUser(db, u!.id);
    const grant = grants.find((g) => g.id === grantId);
    expect(grant?.revokedAt).not.toBeNull();
    expect(grant?.revokedBy).toBe(admin!.id);
    // profile current_grant_id is cleared
    const updatedProfile = await getTvProfile(db, u!.id);
    expect(updatedProfile?.currentGrantId).toBeNull();
    // tradingview_access_requests.revoked_at populated
    // (via the updated revokeTv that now writes revoked_at/revoked_by)
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'tv_access.revoke' && e.targetId === grantId)).toBe(true);
  });

  it('listTvGrantsForUser per-user isolation', async () => {
    const userA = await findUserByEmail(db, 'user@wtc.local');
    const userB = await createUser(db, { email: 'tv-isolation@wtc.local', passwordHash: 'h', displayName: 'TVI' });
    const grantsA = await listTvGrantsForUser(db, userA!.id);
    const grantsB = await listTvGrantsForUser(db, userB.id);
    // User B has no grants
    expect(grantsB.length).toBe(0);
    // User A grants are not visible to B
    expect(grantsA.every((g) => g.userId === userA!.id)).toBe(true);
  });
});
```

#### Group D — Products (1 table)

```ts
describe('Products persistence (0002): product_access_events', () => {
  it('recordProductAccessEvent written alongside grantProduct txn, listProductAccessEvents scoped to userId', async () => {
    const u = await createUser(db, { email: 'pae-test@wtc.local', passwordHash: 'h', displayName: 'PAE' });
    // grantProduct now calls recordProductAccessEvent inside the txn
    await grantProduct(db, u.id, 'club');
    const events = await listProductAccessEvents(db, u.id);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.productCode).toBe('club');
    expect(events[0]!.toState).toBe('active');
    // isolation: events for u only
    expect(events.every((e) => e.userId === u.id)).toBe(true);
  });

  it('listProductAccessEvents not polluted by other users', async () => {
    const u = await findUserByEmail(db, 'pae-test@wtc.local');
    const other = await createUser(db, { email: 'pae-other@wtc.local', passwordHash: 'h', displayName: 'O' });
    await grantProduct(db, other.id, 'club');
    const events = await listProductAccessEvents(db, u!.id);
    expect(events.every((e) => e.userId === u!.id)).toBe(true);
  });
});
```

#### Group E — Axioma / Terminal (3 tables)

```ts
describe('Axioma/Terminal persistence (0002): release cache, download events, license events', () => {
  it('upsertTerminalRelease: ON CONFLICT updates; is_current=true exclusivity per channel+platform', async () => {
    await upsertTerminalRelease(db, {
      version: '1.4.0',
      channel: 'stable',
      platform: 'win32',
      publishedAt: new Date('2026-01-01'),
      isCurrent: true,
    });
    await upsertTerminalRelease(db, {
      version: '1.4.2',
      channel: 'stable',
      platform: 'win32',
      publishedAt: new Date('2026-02-01'),
      isCurrent: true,
    });
    // Only 1.4.2 should be current for stable/win32
    const current = await getCurrentTerminalRelease(db, 'stable', 'win32');
    expect(current?.version).toBe('1.4.2');
    // 1.4.0 should have is_current=false
    const [old] = await db.select().from(schema.terminalReleaseCache)
      .where(and(eq(schema.terminalReleaseCache.version, '1.4.0'),
                 eq(schema.terminalReleaseCache.channel, 'stable')));
    expect(old?.isCurrent).toBe(false);
  });

  it('recordDownloadEvent: ip_address stored as TEXT, entitlement_verified captured', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const release = await getCurrentTerminalRelease(db, 'stable', 'win32');
    await recordDownloadEvent(db, {
      userId: u!.id,
      releaseId: release!.id,
      version: release!.version,
      platform: 'win32',
      ipAddress: '192.168.1.1', // TEXT, not INET
      userAgent: 'Electron/33',
      entitlementVerified: true,
    });
    // audit row
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'terminal.download')).toBe(true);
  });

  it('recordLicenseEvent: no plaintext key in metadata', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    await recordLicenseEvent(db, {
      userId: u!.id,
      eventType: 'link_confirmed',
      axiomaUserId: 'axi-user-123',
      deviceFingerprint: 'sha256:abcdef1234', // hashed opaque ID, not plaintext
      metadata: { source: 'handshake_v2' }, // no api_key, no api_secret
    });
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'terminal.license_event')).toBe(true);
  });
});
```

#### Group F — Ops (2 tables)

```ts
describe('Ops persistence (0002): notifications, support tickets', () => {
  it('createNotification + listNotifications unreadOnly + markNotificationRead', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    await createNotification(db, {
      userId: u!.id,
      type: 'bot_warning',
      title: 'TP Reconciliation Warning',
      body: 'Bot TP order missing from exchange. Manual check required.',
    });
    const unread = await listNotifications(db, u!.id, { unreadOnly: true });
    expect(unread.length).toBeGreaterThan(0);
    expect(unread.every((n) => n.readAt === null)).toBe(true);
    await markNotificationRead(db, unread[0]!.id, u!.id);
    const afterRead = await listNotifications(db, u!.id, { unreadOnly: true });
    expect(afterRead.find((n) => n.id === unread[0]!.id)).toBeUndefined();
  });

  it('listNotifications per-user isolation', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const other = await createUser(db, { email: 'notif-other@wtc.local', passwordHash: 'h', displayName: 'NO' });
    const otherNotifs = await listNotifications(db, other.id, {});
    expect(otherNotifs.length).toBe(0); // isolation
    const myNotifs = await listNotifications(db, u!.id, {});
    expect(myNotifs.every((n) => n.userId === u!.id)).toBe(true);
  });

  it('createSupportTicket writes an audit_logs row', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const before = (await recentAuditEvents(db, 1000)).length;
    await createSupportTicket(db, {
      userId: u!.id,
      productCode: 'tortila_bot',
      subject: 'Bot not connecting',
      body: 'Exchange API returns error 100410.',
      priority: 'high',
    });
    const events = await recentAuditEvents(db, 1000);
    expect(events.length).toBeGreaterThan(before);
    expect(events.some((e) => e.action === 'support.ticket_create')).toBe(true);
  });

  it('listSupportTickets: user sees only own tickets; admin filter sees all', async () => {
    const u = await findUserByEmail(db, 'user@wtc.local');
    const other = await createUser(db, { email: 'tkt-other@wtc.local', passwordHash: 'h', displayName: 'TK' });
    await createSupportTicket(db, { userId: other.id, subject: 'Other issue', body: 'Details.' });
    const myTickets = await listSupportTickets(db, { userId: u!.id });
    expect(myTickets.every((t) => t.userId === u!.id)).toBe(true);
    const allTickets = await listSupportTickets(db, {}); // admin view
    expect(allTickets.some((t) => t.userId === other.id)).toBe(true);
  });
});
```

---

## Exact Drizzle TypeScript for All 0002 Tables

The following code blocks are ready to copy into `packages/db/src/schema.ts`.

### Required import line change (FIRST — before any new tables)

```ts
// Replace the existing import line (schema.ts line 8) with:
import {
  pgTable, text, timestamp, boolean, integer, jsonb, uuid,
  uniqueIndex, index, numeric,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
```

---

### Group 1 — Bots (5 new tables)

```ts
// --- Bot config versions (append-only history) ---
export const botConfigVersions = pgTable(
  'bot_config_versions',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id')
      .notNull()
      .references(() => botInstances.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    configJson: jsonb('config_json').$type<Record<string, unknown>>().notNull(),
    changedBy: uuid('changed_by').references(() => users.id),
    // nullable FK → users.id; no cascade (preserve history if user deleted)
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => ({
    uniqInstanceVersion: uniqueIndex('bcv_instance_version_idx').on(t.botInstanceId, t.version),
    instanceVersionDesc: index('bcv_instance_id_idx').on(t.botInstanceId, t.version),
  }),
);

// --- Bot metric snapshots (worker writes; never updated) ---
export const botMetricSnapshots = pgTable(
  'bot_metric_snapshots',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id')
      .notNull()
      .references(() => botInstances.id, { onDelete: 'cascade' }),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    walletEquityUsd: numeric('wallet_equity_usd', { precision: 18, scale: 4 }),
    closedPnlUsd: numeric('closed_pnl_usd', { precision: 18, scale: 4 }),
    unrealizedPnlUsd: numeric('unrealized_pnl_usd', { precision: 18, scale: 4 }),
    winRate: numeric('win_rate', { precision: 6, scale: 4 }),
    profitFactor: numeric('profit_factor', { precision: 8, scale: 4 }),
    maxDrawdownPct: numeric('max_drawdown_pct', { precision: 8, scale: 4 }),
    currentDrawdownPct: numeric('current_drawdown_pct', { precision: 8, scale: 4 }),
    totalFeesUsd: numeric('total_fees_usd', { precision: 18, scale: 4 }),
    totalFundingUsd: numeric('total_funding_usd', { precision: 18, scale: 4 }),
    openRiskUsd: numeric('open_risk_usd', { precision: 18, scale: 4 }),
    tradeCount: integer('trade_count'),
    sourceAdapter: text('source_adapter').notNull(), // 'tortila' | 'legacy'
    rawJson: jsonb('raw_json'),
    createdAt: createdAt(),
  },
  (t) => ({
    instanceSnapshotIdx: index('bms_instance_snapshot_idx').on(t.botInstanceId, t.snapshotAt),
  }),
);

// --- Bot position snapshots (worker writes; never updated) ---
export const botPositionSnapshots = pgTable(
  'bot_position_snapshots',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id')
      .notNull()
      .references(() => botInstances.id, { onDelete: 'cascade' }),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    symbol: text('symbol').notNull(),
    side: text('side').notNull(), // 'long' | 'short'
    size: numeric('size', { precision: 20, scale: 8 }).notNull(),
    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
    markPrice: numeric('mark_price', { precision: 20, scale: 8 }),
    unrealizedPnlUsd: numeric('unrealized_pnl_usd', { precision: 18, scale: 4 }),
    leverage: integer('leverage'),
    tpPrice: numeric('tp_price', { precision: 20, scale: 8 }),
    slPrice: numeric('sl_price', { precision: 20, scale: 8 }),
    liquidationPrice: numeric('liquidation_price', { precision: 20, scale: 8 }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    sourceAdapter: text('source_adapter').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    instanceSnapshotIdx: index('bps_instance_snapshot_idx').on(t.botInstanceId, t.snapshotAt),
  }),
);

// --- Bot trade imports (closed trades; immutable after insert) ---
export const botTradeImports = pgTable(
  'bot_trade_imports',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id')
      .notNull()
      .references(() => botInstances.id, { onDelete: 'cascade' }),
    externalTradeId: text('external_trade_id').notNull(),
    symbol: text('symbol').notNull(),
    side: text('side').notNull(), // 'long' | 'short'
    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
    exitPrice: numeric('exit_price', { precision: 20, scale: 8 }).notNull(),
    size: numeric('size', { precision: 20, scale: 8 }).notNull(),
    realizedPnlUsd: numeric('realized_pnl_usd', { precision: 18, scale: 4 }).notNull(),
    feesUsd: numeric('fees_usd', { precision: 18, scale: 4 }).notNull().default('0'),
    fundingPaidUsd: numeric('funding_paid_usd', { precision: 18, scale: 4 }).notNull().default('0'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }).notNull(),
    exitReason: text('exit_reason'), // nullable: 'tp' | 'sl' | 'manual' | 'liquidation' | 'unknown'
    sourceAdapter: text('source_adapter').notNull(),
    rawJson: jsonb('raw_json'),
    importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // ON CONFLICT on this unique set → importBotTrade returns inserted:false
    uniqExternalTrade: uniqueIndex('bti_external_trade_idx').on(
      t.botInstanceId,
      t.externalTradeId,
      t.sourceAdapter,
    ),
    instanceClosedIdx: index('bti_instance_closed_idx').on(t.botInstanceId, t.closedAt),
    externalIdIdx: index('bti_external_id_idx').on(t.sourceAdapter, t.externalTradeId),
  }),
);

// --- Bot safety events (risk signal log; surfaced as UI warnings) ---
export const botSafetyEvents = pgTable(
  'bot_safety_events',
  {
    id: id(),
    botInstanceId: uuid('bot_instance_id')
      .notNull()
      .references(() => botInstances.id, { onDelete: 'cascade' }),
    eventCode: text('event_code').notNull(),
    // codes: 'TP_RECONCILIATION_PENDING' | 'MARGIN_PREFLIGHT_MISSING' |
    //        'TP_REJECTION_101211' | 'RATE_LIMIT_100410' | 'FILL_LOOKUP_109421' |
    //        'EXCHANGE_FLAT_MISMATCH' | custom
    severity: text('severity').notNull(), // 'info' | 'warning' | 'critical'
    symbol: text('symbol'), // nullable: affected symbol if applicable
    description: text('description').notNull(),
    metadata: jsonb('metadata'), // nullable; no plaintext keys
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => ({
    instanceObservedIdx: index('bse_instance_observed_idx').on(t.botInstanceId, t.observedAt),
    severityIdx: index('bse_severity_idx').on(t.severity),
  }),
);
```

---

### Group 2 — Education (4 new tables + courses ALTER)

```ts
// --- Teacher profiles (one-to-one with users; gated by teacher role) ---
export const teacherProfiles = pgTable(
  'teacher_profiles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    socialLinks: jsonb('social_links')
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserId: uniqueIndex('teacher_profiles_user_id_idx').on(t.userId),
  }),
);

// ADD to courses pgTable definition (additive — owner_teacher_id NOT removed):
// teacherProfileId: uuid('teacher_profile_id').references(() => teacherProfiles.id),
//
// This produces the ADD COLUMN in the generated SQL. The backfill INSERT/UPDATE
// must be hand-added to 0002_*.sql BEFORE this ADD COLUMN statement:
//
// -- Backfill teacher_profiles from existing courses.owner_teacher_id
// INSERT INTO teacher_profiles (id, user_id, display_name, social_links, is_active, created_at, updated_at)
// SELECT gen_random_uuid(), u.id, COALESCE(u.display_name, u.email), '{}', true, NOW(), NOW()
// FROM (SELECT DISTINCT owner_teacher_id FROM courses) AS c
// JOIN users u ON u.id = c.owner_teacher_id
// ON CONFLICT (user_id) DO NOTHING;
//
// -- Populate teacher_profile_id on courses
// UPDATE courses
// SET teacher_profile_id = tp.id
// FROM teacher_profiles tp
// WHERE courses.owner_teacher_id = tp.user_id;

// --- Enrollments (student enrollment in a course) ---
export const enrollments = pgTable(
  'enrollments',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    entitlementId: uuid('entitlement_id').references(() => entitlements.id),
    // nullable → manual/admin enrollment; no cascade (preserve enrollment if entitlement transitions)
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    uniqUserCourse: uniqueIndex('enrollments_user_course_idx').on(t.userId, t.courseId),
    userIdx: index('enrollments_user_id_idx').on(t.userId),
    courseIdx: index('enrollments_course_id_idx').on(t.courseId),
  }),
);

// --- Lesson progress (per-user, per-lesson; UPSERTed on each progress POST) ---
export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    percentComplete: numeric('percent_complete', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    completed: boolean('completed').notNull().default(false),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserLesson: uniqueIndex('lesson_progress_user_lesson_idx').on(t.userId, t.lessonId),
    userIdx: index('lesson_progress_user_id_idx').on(t.userId),
  }),
);

// --- Pinned links (polymorphic: teacher_profile or course owner) ---
export const pinnedLinks = pgTable(
  'pinned_links',
  {
    id: id(),
    ownerType: text('owner_type').notNull(),
    // 'teacher_profile' | 'course'
    // Application enforces: when ownerType='teacher_profile', ownerId must exist in teacher_profiles;
    // when ownerType='course', ownerId must exist in courses.
    // No DB FK (polymorphic); app validates at write. CHECK constraint added via raw SQL in migration.
    ownerId: uuid('owner_id').notNull(),
    label: text('label').notNull(),
    url: text('url').notNull(),
    iconType: text('icon_type'),
    // nullable: 'telegram' | 'instagram' | 'youtube' | 'twitter' | 'link'
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id),
    // nullable: teacher or admin; no cascade (preserve link if creator deleted)
    createdAt: createdAt(),
  },
  (t) => ({
    ownerSortIdx: index('pinned_links_owner_idx').on(t.ownerType, t.ownerId, t.sortOrder),
  }),
);
// NOTE: Add the following to the raw SQL migration for the CHECK constraint:
// ALTER TABLE pinned_links
//   ADD CONSTRAINT pinned_links_owner_type_check
//   CHECK (owner_type IN ('teacher_profile', 'course'));
```

---

### Group 3 — TradingView (2 new tables + ALTER on existing)

```ts
// --- TradingView profiles (user's declared TV username + verification state) ---
// IMPORTANT: tradingview_access_grants must be declared BEFORE tradingview_profiles
// because tradingview_profiles.current_grant_id references tradingview_access_grants.id.
// In schema.ts, declare tradingviewAccessGrants first, then tradingviewProfiles.

export const tradingviewAccessGrants = pgTable(
  'tradingview_access_grants',
  {
    id: id(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => tradingviewAccessRequests.id),
    // no cascade: request audit trail must survive grant
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tvUsername: text('tv_username').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    grantedBy: uuid('granted_by').references(() => users.id),
    // nullable: admin user ID; no cascade
    grantedByType: text('granted_by_type').notNull(),
    // 'admin' | 'automation_adapter'
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by').references(() => users.id),
    revokeReason: text('revoke_reason'),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index('tvag_user_id_idx').on(t.userId),
    expiresIdx: index('tvag_expires_at_idx').on(t.expiresAt),
  }),
);

export const tradingviewProfiles = pgTable(
  'tradingview_profiles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tvUsername: text('tv_username').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    currentGrantId: uuid('current_grant_id').references(() => tradingviewAccessGrants.id),
    // nullable; set AFTER grant is inserted (two-step pattern in createTvGrant)
    // no cascade: profile stays if grant is deleted
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserId: uniqueIndex('tvp_user_id_idx').on(t.userId),
  }),
);

// ALTER TABLE tradingview_access_requests — additive columns
// These are NOT added via pgTable (the table is already defined above).
// They are emitted in the SQL migration as ALTER TABLE statements.
// In schema.ts, UPDATE the existing tradingviewAccessRequests pgTable to add:
//   revokedAt: timestamp('revoked_at', { withTimezone: true }),
//   revokedBy: uuid('revoked_by').references(() => users.id),
// Both nullable. drizzle-kit generate will emit the ALTER TABLE ADD COLUMN.
//
// UPDATED tradingviewAccessRequests definition:
export const tradingviewAccessRequestsUpdated = pgTable('tradingview_access_requests', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tradingViewUsername: text('tradingview_username').notNull(),
  // column name is tradingview_username (NOT tv_username) — see Finding 3
  status: text('status').notNull(),
  requestedAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // column name is created_at in DB (see Finding 4); Drizzle TS name stays requestedAt
  grantedAt: timestamp('granted_at', { withTimezone: true }),
  grantedBy: uuid('granted_by'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  // 0002 additive columns:
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by').references(() => users.id),
});
// IMPORTANT: this is the REPLACEMENT definition for the existing tradingviewAccessRequests export.
// Do not add a second pgTable('tradingview_access_requests', ...) — replace the existing one.
```

---

### Group 4 — Products (1 new table)

```ts
// --- Product access events (immutable entitlement transition log) ---
export const productAccessEvents = pgTable(
  'product_access_events',
  {
    id: id(),
    entitlementId: uuid('entitlement_id')
      .notNull()
      .references(() => entitlements.id),
    // no cascade: preserve event if entitlement changes state
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    // denormalised for fast user-scoped queries; no cascade (event is append-only)
    productCode: text('product_code').notNull(),
    fromState: text('from_state').notNull(),
    toState: text('to_state').notNull(),
    reason: text('reason'),
    actorId: uuid('actor_id').references(() => users.id),
    // nullable: null = system/webhook
    actorType: text('actor_type').notNull(),
    // 'user' | 'admin' | 'system' | 'billing_webhook'
    createdAt: createdAt(),
  },
  (t) => ({
    entitlementIdx: index('pae_entitlement_id_idx').on(t.entitlementId),
    userIdx: index('pae_user_id_idx').on(t.userId),
  }),
);
```

---

### Group 5 — Axioma / Terminal (3 new tables)

```ts
// --- Terminal release cache (worker syncs; UI shows stale warning if old) ---
export const terminalReleaseCache = pgTable(
  'terminal_release_cache',
  {
    id: id(),
    version: text('version').notNull(),
    channel: text('channel').notNull(), // 'stable' | 'beta'
    platform: text('platform').notNull(), // 'win32' | 'darwin' | 'linux'
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    releaseNotesMarkdown: text('release_notes_markdown'),
    downloadUrlTemplate: text('download_url_template'),
    checksumSha256: text('checksum_sha256'),
    minSupportedVersion: text('min_supported_version'),
    isCurrent: boolean('is_current').notNull().default(false),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqVersionChannelPlatform: uniqueIndex('trc_version_channel_platform_idx').on(
      t.version,
      t.channel,
      t.platform,
    ),
    channelPlatformCurrentIdx: index('trc_channel_platform_current_idx').on(
      t.channel,
      t.platform,
      t.isCurrent,
    ),
  }),
);

// --- Terminal download events (audit trail for download CTA + signed URL generation) ---
export const terminalDownloadEvents = pgTable(
  'terminal_download_events',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id),
    releaseId: uuid('release_id').notNull().references(() => terminalReleaseCache.id),
    version: text('version').notNull(), // denormalised from release
    platform: text('platform').notNull(),
    ipAddress: text('ip_address'), // nullable; TEXT not INET — see Finding 6
    userAgent: text('user_agent'),
    entitlementVerified: boolean('entitlement_verified').notNull(),
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index('tde_user_id_idx').on(t.userId),
  }),
);

// --- Terminal license events (Axioma license state changes visible to WTC) ---
export const terminalLicenseEvents = pgTable(
  'terminal_license_events',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id),
    eventType: text('event_type').notNull(),
    // 'link_initiated' | 'link_confirmed' | 'link_revoked' | 'entitlement_synced'
    axiomaUserId: text('axioma_user_id'),
    deviceFingerprint: text('device_fingerprint'),
    // nullable; opaque hashed device ID from Axioma — NEVER plaintext
    metadata: jsonb('metadata'), // nullable; no plaintext keys allowed
    createdAt: createdAt(),
  },
  (t) => ({
    userIdx: index('tle_user_id_idx').on(t.userId),
  }),
);
```

---

### Group 6 — Ops (2 new tables)

```ts
// --- Notifications (user-facing alerts; marked read by user action) ---
export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    // 'entitlement_expiring' | 'entitlement_expired' | 'tv_access_granted' |
    // 'tv_access_expiring' | 'support_reply' | 'bot_warning' | 'billing_action_needed'
    title: text('title').notNull(),
    body: text('body').notNull(),
    linkUrl: text('link_url'),
    readAt: timestamp('read_at', { withTimezone: true }),
    // NULL = unread; set by markNotificationRead
    createdAt: createdAt(),
  },
  (t) => ({
    // Partial index for fast unread count — valid PGlite syntax; requires sql`` import
    userUnreadIdx: index('notifications_user_unread_idx')
      .on(t.userId, t.readAt)
      .where(sql`"read_at" IS NULL`),
  }),
);

// --- Support tickets (user-submitted; read by support + admin roles) ---
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id),
    productCode: text('product_code'), // nullable: which product the ticket relates to
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    status: text('status').notNull().default('open'),
    // 'open' | 'in_progress' | 'resolved' | 'closed'
    priority: text('priority').notNull().default('normal'),
    // 'low' | 'normal' | 'high' | 'urgent'
    assignedTo: uuid('assigned_to').references(() => users.id),
    // nullable: support agent; no cascade (ticket persists if agent is deleted)
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('support_tickets_user_id_idx').on(t.userId),
    statusIdx: index('support_tickets_status_idx').on(t.status),
  }),
);
```

---

### courses table: add `teacherProfileId` column (additive)

In the existing `courses` pgTable definition, add ONE new field after the existing columns:

```ts
export const courses = pgTable('courses', {
  id: id(),
  ownerTeacherId: uuid('owner_teacher_id').notNull().references(() => users.id),
  // KEEP: NOT dropped in 0002
  teacherProfileId: uuid('teacher_profile_id').references(() => teacherProfiles.id),
  // ADDED in 0002: nullable; backfilled via SQL UPDATE in migration
  title: text('title').notNull(),
  description: text('description'),
  productCode: text('product_code').notNull().default('education'),
  published: boolean('published').default(false).notNull(),
  createdAt: createdAt(),
});
```

---

## db:generate Flow

1. Apply all schema.ts changes (new tables + courses field + updated tradingviewAccessRequests).
2. Run: `npm run db:generate -w @wtc/db`
   This reads `packages/db/drizzle.config.ts` (no DATABASE_URL required) and diffs against
   `packages/db/migrations/meta/0001_snapshot.json`.
   Output: `packages/db/migrations/0002_<auto-name>.sql` + updated meta snapshot + updated `_journal.json`.
3. Open `0002_<auto-name>.sql` and manually insert the backfill block BEFORE the
   `ALTER TABLE "courses" ADD COLUMN "teacher_profile_id"` statement:

```sql
-- Backfill teacher_profiles from existing courses.owner_teacher_id values
INSERT INTO "teacher_profiles" ("id", "user_id", "display_name", "social_links", "is_active", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  u.id,
  COALESCE(u.display_name, u.email),
  '{}',
  true,
  NOW(),
  NOW()
FROM (SELECT DISTINCT owner_teacher_id FROM "courses") AS c
JOIN "users" u ON u.id = c.owner_teacher_id
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint

-- Populate teacher_profile_id on existing course rows
UPDATE "courses"
SET "teacher_profile_id" = tp.id
FROM "teacher_profiles" tp
WHERE "courses"."owner_teacher_id" = tp.user_id;
--> statement-breakpoint
```

4. Also insert the CHECK constraint for pinned_links AFTER the CREATE TABLE statement:

```sql
ALTER TABLE "pinned_links"
  ADD CONSTRAINT "pinned_links_owner_type_check"
  CHECK ("owner_type" IN ('teacher_profile', 'course'));
--> statement-breakpoint
```

5. Run `npm test` → PGlite harness picks up 0002 SQL automatically and exercises all new tables.
6. Run `npm run typecheck` → confirms all new Drizzle exports type-check against TypeScript.

Gates expected:

| Gate | Expected result |
|---|---|
| `npm run db:generate -w @wtc/db` | Produces 0002_*.sql with zero destructive statements |
| `npm run typecheck` | PASS — new exports are typed |
| `npm test` | PASS — all new PGlite test cases green |
| `npm run lint` | PASS |
| `npm run build -w @wtc/web` | PASS |
| `db:migrate` | NOT RUN (no DATABASE_URL in this environment) |
| `db:seed` | NOT RUN (requires live DB) |

---

## Next actions

1. **Wave-2 serial implementer (schema.ts):**
   a. Update import line (add `numeric`; add `sql` from `drizzle-orm`).
   b. Add `tradingviewAccessGrants` BEFORE `tradingviewProfiles` (FK ordering).
   c. Update `tradingviewAccessRequests` to add `revokedAt` and `revokedBy` fields.
   d. Add `teacherProfileId` to `courses` (nullable; references `teacherProfiles.id`).
   e. Paste all new table exports in order: Bots, Education, TradingView, Products, Axioma, Ops.
   f. Export all new tables from `packages/db/src/index.ts`.

2. **Wave-2 serial implementer (db:generate):**
   Run `npm run db:generate -w @wtc/db`. Review the generated SQL. Insert the backfill block and
   CHECK constraint block as described in "db:generate Flow" above.

3. **Wave-2 serial implementer (repositories.ts):**
   Add all 30+ repo functions listed in the 20260530-0126 handoff "Repo functions for Wave-2" section.
   Priority order: Bots group → Education group → TradingView group → Products → Axioma → Ops.
   Follow the `grantProduct` pattern: mutation + in-txn audit insert in one `db.transaction(async (tx) => {...})`.
   Update `revokeTv` to populate `revokedAt`/`revokedBy` on `tradingview_access_requests` AND
   the new `tradingview_access_grants` row.

4. **Wave-2 serial implementer (tests):**
   Add the six describe blocks above to `tests/integration/db-persistence.test.ts`.
   Run `npm test` to confirm all green before declaring the wave complete.

5. **grantProduct integration (repositories.ts):**
   Inside the existing `grantProduct` and `revokeProduct` transaction bodies, add a call to
   `recordProductAccessEvent` (INSERT into `product_access_events`). The `fromState` for
   `grantProduct` is the previous entitlement state (read within the txn before the upsert).

6. **Phase 3 cleanup (deferred):**
   Drop `courses.owner_teacher_id` ONLY after all LMS routes have been fully migrated to use
   `teacher_profile_id`. This is a separate migration (`0003_drop_owner_teacher_id.sql`).
   Do NOT do this in 0002.

7. **tradingview_access_tasks.grant_id (deferred to Phase 3):**
   Once `tradingview_access_grants` is stable and tested, add `grant_id UUID` FK to
   `tradingview_access_tasks` as migration 0003 alongside the `owner_teacher_id` drop.
