# ecosystem-db-architect handoff — Phase 2 / Migration 0002 Design

_Epoch 20260530-0126. Design-only wave. No schema.ts / repositories.ts / seed.ts / migrations edited
this wave — all edits are to `docs/DATA_MODEL.md`, `docs/DOMAIN_MODEL.md`, and this handoff only.
Per SESSION_PROTOCOL.md §8 and the prompt hard boundary: Wave-2 serial implementer will write
the actual Drizzle schema + SQL migration from this design._

---

## Scope

Design migration 0002 (additive only — never touch 0000/0001). Cover:

- Part 5 bot-config persistence: `bot_config_versions`, `bot_metric_snapshots`,
  `bot_position_snapshots`, `bot_trade_imports`, `bot_safety_events`
- Part 8 full LMS: `teacher_profiles`, `enrollments`, `lesson_progress`, `pinned_links`
- Part 7 TradingView: `tradingview_profiles`, `tradingview_access_grants`,
  additive columns `revoked_at`/`revoked_by` on `tradingview_access_requests`
- Part 9: `product_access_events`
- Part 6 terminal: `terminal_release_cache`, `terminal_download_events`, `terminal_license_events`
- Ops: `notifications`, `support_tickets`
- Backtester recommendation: stay in packages/backtester only vs land in 0002

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DOMAIN_MODEL.md`
- `docs/DATA_MODEL.md`
- `packages/db/src/schema.ts` (21 tables, confirmed)
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0001_early_toad_men.sql` (entitlements UNIQUE only)
- `docs/handoffs/20260529-phase0-ecosystem-backtester-architect.md`
- `docs/handoffs/20260529-2352-phase-1-7-part-e-tv-lms-persistence.md`
- `docs/handoffs/20260529-2352-lms-schema-gap-auditor.md`
- `docs/handoffs/20260529-2352-tradingview-persistence-auditor.md`

---

## Files changed

- `docs/DATA_MODEL.md` — updated to mark REAL-in-0002 vs TARGET; added 0002 design sections
- `docs/DOMAIN_MODEL.md` — updated `BotSafetyEvent`, added `ProductAccessEvent` domain concept,
  clarified `TradingViewAccessGrant` design, updated `PinnedLink` concept
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md` — this file (canonical)

---

## Findings

### 1. [INFO] Exact current state: 21 real tables vs DATA_MODEL described

**In schema.ts (real, migrated):** users, roles, user_roles, sessions, products, plans,
entitlements, subscriptions, exchange_accounts, exchange_api_key_secrets, bot_instances,
bot_configs, axioma_account_links, tradingview_access_requests, tradingview_access_tasks,
courses, lessons, materials, audit_logs, job_queue, integration_health_checks.

**In DATA_MODEL.md as TARGET (NOT in schema.ts):**
user_profiles, secret_rotation_events, product_access_events, bot_config_versions,
bot_metric_snapshots, bot_position_snapshots, bot_trade_imports, bot_safety_events,
terminal_release_cache, terminal_download_events, terminal_license_events,
tradingview_profiles, tradingview_access_grants, teacher_profiles, enrollments,
lesson_progress, notifications, support_tickets, backtest_jobs, backtest_results.

### 2. [INFO] Column delta between existing bot_configs and the DATA_MODEL spec

The current `bot_configs` in schema.ts has: `id, bot_instance_id, version, config, updated_at`.
The DATA_MODEL spec wants `current_version` (not `version`) and `config_json` (not `config`).
Migration 0002 cannot rename existing columns (additive only). The Wave-2 implementer must use
the existing column names in Drizzle and map them in the repo layer. The DATA_MODEL spec has been
corrected to match the real column names.

### 3. [INFO] tradingview_access_requests already has revoke semantics — additive columns only needed

The current `tradingview_access_requests` table stores revoke state via `status='revoked'` with
actor only in `audit_logs`. The tradingview-persistence-auditor explicitly flagged
`revoked_at`/`revoked_by` as a TARGET follow-up (not Phase 1.7). Migration 0002 adds these two
columns as NULLable additive columns — safe because all existing rows simply have NULL.

### 4. [DECISION] Backtester stays packages/backtester type-model only — NOT in 0002

The backtester-architect handoff puts `backtest_jobs`/`backtest_results` in the Ops bounded
context. However: (a) there is no runner wired yet; (b) any result stored in DB would be
unreachable without a runner (immediate `failed` state, no results possible); (c) the
backtester-architect correctly noted Phase 6 as the implementation target. Landing these tables
in 0002 would add schema that cannot be tested via PGlite (no runner, no artifact upload path),
and would inflate the 0002 scope for a Wave-2 serial implementer unnecessarily.
Recommendation: `backtest_jobs`/`backtest_results` remain DATA_MODEL TARGET only until Phase 6
when `packages/backtester` is scaffolded. The backtester-architect handoff's §Decisions point 6
is respected (Ops bounded context, alongside `job_queue`).

### 5. [INFO] user_profiles and secret_rotation_events: not in 0002 scope

`user_profiles` was in DATA_MODEL as TARGET. It is not required by any Wave-2 feature (no UI
references it; identity is complete via users table). `secret_rotation_events` likewise needs a
full key-rotation story before it's testable. Both remain TARGET.

### 6. [INFO] LMS migration hazard: courses.owner_teacher_id FK

The lms-schema-gap-auditor identified that Option 2 (full LMS) requires repointing
`courses.owner_teacher_id` FK from `users.id` to `teacher_profiles.id`. This is a data migration
hazard: existing course rows need a `teacher_profiles` row first. Migration 0002 handles this with
a backfill pattern: INSERT INTO teacher_profiles for each distinct owner, then ADD COLUMN
`teacher_profile_id` as nullable FK, UPDATE it from the backfill, then drop the orphan column.
The Wave-2 implementer must run this in a single migration transaction.

---

## Migration 0002 design (additive)

### Scope determination

**REAL-in-0002** (landable + PGlite-testable in one Wave-2 session):

| Table | Context | Rationale |
|---|---|---|
| `bot_config_versions` | Bots | Needed for config history (Part 5); repos already know bot_instances |
| `bot_metric_snapshots` | Bots | Periodic snapshot; worker writes these |
| `bot_position_snapshots` | Bots | Periodic snapshot; worker writes these |
| `bot_trade_imports` | Bots | Import closed trades; unique constraint prevents dup imports |
| `bot_safety_events` | Bots | Risk signal log; surfaced in UI as warnings |
| `teacher_profiles` | Education | Gate for full LMS; backfill from existing courses owners |
| `enrollments` | Education | Student enrollment; unique(user_id, course_id) |
| `lesson_progress` | Education | Per-lesson progress; unique(user_id, lesson_id) |
| `pinned_links` | Education | Community/social links per teacher or course |
| `tradingview_profiles` | TradingView | User's TV username + verification state |
| `tradingview_access_grants` | TradingView | Active grant record separate from request |
| ADD `revoked_at`, `revoked_by` to `tradingview_access_requests` | TradingView | Additive columns |
| `product_access_events` | Products | Entitlement transition event log |
| `terminal_release_cache` | Axioma | Release metadata cache; worker syncs |
| `terminal_download_events` | Axioma | Download audit trail |
| `terminal_license_events` | Axioma | License state changes |
| `notifications` | Ops | User-facing alerts |
| `support_tickets` | Ops | User-support threads |

**Deferred to TARGET** (not in 0002):

| Table | Reason |
|---|---|
| `user_profiles` | No Wave-2 UI requires it; identity complete via users |
| `secret_rotation_events` | Requires full key-rotation story; no Wave-2 consumer |
| `backtest_jobs` | No runner wired; Phase 6 |
| `backtest_results` | Depends on backtest_jobs; Phase 6 |

---

### Table specifications

All tables in 0002 follow the same conventions as 0000/0001:
- PK: `UUID` v4, `gen_random_uuid()`
- Timestamps: `TIMESTAMPTZ` UTC, `created_at` = `NOW()`
- `NOT NULL` unless explicitly nullable
- FKs use `ON DELETE CASCADE` where child row is meaningless without parent;
  `ON DELETE RESTRICT` (default) where audit trail must survive parent deletion

---

#### Table: `bot_config_versions`

Bounded context: Bots. Owned by: `packages/db`.
Purpose: Append-only history of every saved bot config. Never mutated after insert.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `bot_instance_id` | UUID | NO | — | FK → `bot_instances.id` ON DELETE CASCADE |
| `version` | INT | NO | — | Monotonic per-instance (app increments before insert) |
| `config_json` | JSONB | NO | — | Full config snapshot at this version |
| `changed_by` | UUID | YES | — | FK → `users.id` (nullable = system) |
| `note` | TEXT | YES | — | Optional change description |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Immutable after insert |

**PK:** `id`
**Unique:** `(bot_instance_id, version)` — prevents duplicate version numbers per instance
**FK:** `bot_instance_id → bot_instances.id ON DELETE CASCADE`,
       `changed_by → users.id` (no cascade — preserve history if user deleted)
**Index:** `idx_bcv_bot_instance_id` on `(bot_instance_id, version DESC)`

---

#### Table: `bot_metric_snapshots`

Bounded context: Bots. Owned by: `packages/db`.
Purpose: Periodic normalised metrics snapshot per bot instance. Written by worker; never updated.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `bot_instance_id` | UUID | NO | — | FK → `bot_instances.id` ON DELETE CASCADE |
| `snapshot_at` | TIMESTAMPTZ | NO | — | When data was fetched from adapter |
| `wallet_equity_usd` | NUMERIC(18,4) | YES | — | |
| `closed_pnl_usd` | NUMERIC(18,4) | YES | — | All-time |
| `unrealized_pnl_usd` | NUMERIC(18,4) | YES | — | |
| `win_rate` | NUMERIC(6,4) | YES | — | 0–1 |
| `profit_factor` | NUMERIC(8,4) | YES | — | |
| `max_drawdown_pct` | NUMERIC(8,4) | YES | — | |
| `current_drawdown_pct` | NUMERIC(8,4) | YES | — | |
| `total_fees_usd` | NUMERIC(18,4) | YES | — | |
| `total_funding_usd` | NUMERIC(18,4) | YES | — | |
| `open_risk_usd` | NUMERIC(18,4) | YES | — | Estimated max loss on open positions |
| `trade_count` | INT | YES | — | Closed trades counted |
| `source_adapter` | TEXT | NO | — | `tortila` or `legacy` |
| `raw_json` | JSONB | YES | — | Original adapter response (debug only) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**FK:** `bot_instance_id → bot_instances.id ON DELETE CASCADE`
**Index:** `idx_bms_bot_instance_snapshot` on `(bot_instance_id, snapshot_at DESC)`

---

#### Table: `bot_position_snapshots`

Bounded context: Bots. Owned by: `packages/db`.
Purpose: Point-in-time open position snapshot. Written by worker; never updated.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `bot_instance_id` | UUID | NO | — | FK → `bot_instances.id` ON DELETE CASCADE |
| `snapshot_at` | TIMESTAMPTZ | NO | — | |
| `symbol` | TEXT | NO | — | e.g. `BTCUSDT` |
| `side` | TEXT | NO | — | `long` or `short` |
| `size` | NUMERIC(20,8) | NO | — | Position size |
| `entry_price` | NUMERIC(20,8) | NO | — | |
| `mark_price` | NUMERIC(20,8) | YES | — | |
| `unrealized_pnl_usd` | NUMERIC(18,4) | YES | — | |
| `leverage` | INT | YES | — | |
| `tp_price` | NUMERIC(20,8) | YES | — | |
| `sl_price` | NUMERIC(20,8) | YES | — | |
| `liquidation_price` | NUMERIC(20,8) | YES | — | |
| `opened_at` | TIMESTAMPTZ | YES | — | Position open time from exchange |
| `source_adapter` | TEXT | NO | — | `tortila` or `legacy` |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**FK:** `bot_instance_id → bot_instances.id ON DELETE CASCADE`
**Index:** `idx_bps_bot_instance_snapshot` on `(bot_instance_id, snapshot_at DESC)`

---

#### Table: `bot_trade_imports`

Bounded context: Bots. Owned by: `packages/db`.
Purpose: Imported closed trade records. Immutable once written. Both bots normalised to same shape.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `bot_instance_id` | UUID | NO | — | FK → `bot_instances.id` ON DELETE CASCADE |
| `external_trade_id` | TEXT | NO | — | Original trade ID from source system |
| `symbol` | TEXT | NO | — | |
| `side` | TEXT | NO | — | `long` or `short` |
| `entry_price` | NUMERIC(20,8) | NO | — | |
| `exit_price` | NUMERIC(20,8) | NO | — | |
| `size` | NUMERIC(20,8) | NO | — | |
| `realized_pnl_usd` | NUMERIC(18,4) | NO | — | |
| `fees_usd` | NUMERIC(18,4) | NO | 0 | |
| `funding_paid_usd` | NUMERIC(18,4) | NO | 0 | |
| `opened_at` | TIMESTAMPTZ | NO | — | |
| `closed_at` | TIMESTAMPTZ | NO | — | |
| `exit_reason` | TEXT | YES | — | `tp`, `sl`, `manual`, `liquidation`, `unknown` |
| `source_adapter` | TEXT | NO | — | `tortila` or `legacy` |
| `raw_json` | JSONB | YES | — | Original adapter record |
| `imported_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**Unique:** `(bot_instance_id, external_trade_id, source_adapter)` — prevents duplicate imports
**FK:** `bot_instance_id → bot_instances.id ON DELETE CASCADE`
**Index:** `idx_bti_bot_instance_closed` on `(bot_instance_id, closed_at DESC)`,
           `idx_bti_external_id` on `(source_adapter, external_trade_id)`

---

#### Table: `bot_safety_events`

Bounded context: Bots. Owned by: `packages/db`.
Purpose: Risk signal log from adapter (TP mismatch, margin issues, rate limits). Surfaced as UI warnings.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `bot_instance_id` | UUID | NO | — | FK → `bot_instances.id` ON DELETE CASCADE |
| `event_code` | TEXT | NO | — | `TP_RECONCILIATION_PENDING`, `MARGIN_PREFLIGHT_MISSING`, `TP_REJECTION_101211`, `RATE_LIMIT_100410`, `FILL_LOOKUP_109421`, `EXCHANGE_FLAT_MISMATCH`, or custom |
| `severity` | TEXT | NO | — | `info`, `warning`, `critical` |
| `symbol` | TEXT | YES | — | Affected symbol if applicable |
| `description` | TEXT | NO | — | Human-readable detail |
| `metadata` | JSONB | YES | — | Structured context (no plaintext keys) |
| `observed_at` | TIMESTAMPTZ | NO | — | When detected by adapter or worker |
| `acknowledged_at` | TIMESTAMPTZ | YES | — | Admin acknowledgement timestamp |
| `acknowledged_by` | UUID | YES | — | FK → `users.id` (admin who acknowledged) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**FK:** `bot_instance_id → bot_instances.id ON DELETE CASCADE`,
       `acknowledged_by → users.id`
**Index:** `idx_bse_bot_instance_observed` on `(bot_instance_id, observed_at DESC)`,
           `idx_bse_severity` on `severity`

---

#### Table: `teacher_profiles`

Bounded context: Education. Owned by: `packages/db`.
Purpose: Teacher-specific extension of user. One-to-one with users. Required before full LMS is usable.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | — | FK → `users.id` ON DELETE CASCADE; UNIQUE |
| `display_name` | TEXT | NO | — | |
| `bio` | TEXT | YES | — | |
| `avatar_url` | TEXT | YES | — | |
| `social_links` | JSONB | NO | '{}' | `{telegram?, instagram?, youtube?, twitter?, website?}` |
| `is_active` | BOOLEAN | NO | true | Admin can deactivate without deleting |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | Updated by application before UPDATE |

**PK:** `id`
**Unique:** `user_id`
**FK:** `user_id → users.id ON DELETE CASCADE`
**Index:** (unique index on `user_id` serves as lookup index)

**Migration backfill note:** After creating this table, migration 0002 must also:
1. INSERT INTO `teacher_profiles(user_id, display_name)` for every distinct `owner_teacher_id` in
   `courses`, using `SELECT DISTINCT owner_teacher_id FROM courses` and a JOIN to `users.display_name`.
2. ADD COLUMN `teacher_profile_id UUID` (nullable) to `courses`.
3. UPDATE `courses SET teacher_profile_id = tp.id FROM teacher_profiles tp WHERE courses.owner_teacher_id = tp.user_id`.
4. This makes `teacher_profile_id` populated for all existing rows before any NOT NULL enforcement.
   The Wave-2 implementer MUST NOT drop `owner_teacher_id` in 0002 — additive only.

---

#### Table: `enrollments`

Bounded context: Education. Owned by: `packages/db`.
Purpose: Student's enrollment in a course. Created on entitlement grant or explicit student action.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | — | FK → `users.id` ON DELETE CASCADE |
| `course_id` | UUID | NO | — | FK → `courses.id` ON DELETE CASCADE |
| `entitlement_id` | UUID | YES | — | FK → `entitlements.id` (null = manual/admin enrollment) |
| `enrolled_at` | TIMESTAMPTZ | NO | NOW() | |
| `completed_at` | TIMESTAMPTZ | YES | — | NULL until all lessons marked complete |

**PK:** `id`
**Unique:** `(user_id, course_id)` — one enrollment record per student per course
**FK:** `user_id → users.id ON DELETE CASCADE`,
       `course_id → courses.id ON DELETE CASCADE`,
       `entitlement_id → entitlements.id` (no cascade — preserve enrollment if entitlement transitions)
**Index:** `idx_enrollments_user_id` on `user_id`,
           `idx_enrollments_course_id` on `course_id`

---

#### Table: `lesson_progress`

Bounded context: Education. Owned by: `packages/db`.
Purpose: Per-user, per-lesson progress record. UPSERTed on each progress POST.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | — | FK → `users.id` ON DELETE CASCADE |
| `lesson_id` | UUID | NO | — | FK → `lessons.id` ON DELETE CASCADE |
| `percent_complete` | NUMERIC(5,2) | NO | 0 | 0.00 – 100.00 |
| `completed` | BOOLEAN | NO | false | Set true when percent_complete reaches 100 |
| `last_accessed_at` | TIMESTAMPTZ | NO | NOW() | Updated on every UPSERT |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**Unique:** `(user_id, lesson_id)` — one progress record per student per lesson
**FK:** `user_id → users.id ON DELETE CASCADE`,
       `lesson_id → lessons.id ON DELETE CASCADE`
**Index:** `idx_lesson_progress_user_id` on `user_id`

---

#### Table: `pinned_links`

Bounded context: Education. Owned by: `packages/db`.
Purpose: Community and social links pinned by a teacher (to their profile) or by admin (to a course).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `owner_type` | TEXT | NO | — | `teacher_profile` or `course` |
| `owner_id` | UUID | NO | — | FK to `teacher_profiles.id` OR `courses.id` (polymorphic by owner_type) |
| `label` | TEXT | NO | — | Display label, e.g. "Telegram Channel" |
| `url` | TEXT | NO | — | The link URL |
| `icon_type` | TEXT | YES | — | `telegram`, `instagram`, `youtube`, `twitter`, `link` |
| `sort_order` | INT | NO | 0 | Lower = first |
| `is_active` | BOOLEAN | NO | true | Soft toggle |
| `created_by` | UUID | YES | — | FK → `users.id` (teacher or admin who created) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**FK:** `created_by → users.id` (nullable; no cascade — preserve link if creator deleted)
**Index:** `idx_pinned_links_owner` on `(owner_type, owner_id, sort_order)`

Note: polymorphic `owner_id` is intentional; the application enforces the FK integrity by
`owner_type` at write time. A strict FK would require two separate nullable columns; the polymorphic
pattern matches the education-implementer's plan and is widely used for this shape.

---

#### Table: `tradingview_profiles`

Bounded context: TradingView. Owned by: `packages/db`.
Purpose: Stores a user's declared TradingView username and admin-verified state.
One row per user; updated when user changes their TV username.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | — | FK → `users.id` ON DELETE CASCADE; UNIQUE |
| `tv_username` | TEXT | NO | — | The TradingView public handle |
| `verified_at` | TIMESTAMPTZ | YES | — | NULL until admin confirms the username matches the grant |
| `current_grant_id` | UUID | YES | — | FK → `tradingview_access_grants.id` (nullable FK, no cascade) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**Unique:** `user_id`
**FK:** `user_id → users.id ON DELETE CASCADE`,
       `current_grant_id → tradingview_access_grants.id` (deferrable; set after grant created)

---

#### Table: `tradingview_access_grants`

Bounded context: TradingView. Owned by: `packages/db`.
Purpose: Records that a specific TV username was granted access. Created by admin action.
Separate from `tradingview_access_requests` so the request lifecycle and the grant record are
distinct (a request can exist with no grant, and a grant can be revoked while the request is archived).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `request_id` | UUID | NO | — | FK → `tradingview_access_requests.id` |
| `user_id` | UUID | NO | — | FK → `users.id` ON DELETE CASCADE |
| `tv_username` | TEXT | NO | — | Denormalised from request; safe (public handle) |
| `granted_at` | TIMESTAMPTZ | NO | — | |
| `expires_at` | TIMESTAMPTZ | YES | — | Derived from entitlement expires_at at time of grant |
| `granted_by` | UUID | YES | — | FK → `users.id` (admin user ID) |
| `granted_by_type` | TEXT | NO | `'admin'` | `admin` or `automation_adapter` |
| `revoked_at` | TIMESTAMPTZ | YES | — | NULL = not revoked |
| `revoked_by` | UUID | YES | — | FK → `users.id` (admin who revoked) |
| `revoke_reason` | TEXT | YES | — | |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**FK:** `request_id → tradingview_access_requests.id`,
       `user_id → users.id ON DELETE CASCADE`,
       `granted_by → users.id`,
       `revoked_by → users.id`
**Index:** `idx_tvag_user_id` on `user_id`,
           `idx_tvag_expires_at` on `expires_at` (for expiry worker sweep)

---

#### Additive columns on `tradingview_access_requests`

Migration 0002 adds two columns to the existing `tradingview_access_requests` table:

```sql
ALTER TABLE tradingview_access_requests
  ADD COLUMN revoked_at TIMESTAMPTZ,
  ADD COLUMN revoked_by UUID REFERENCES users(id);
```

Both are nullable (existing rows get NULL, which is the correct default — not revoked).
No existing index needs changing. The `revokeTv` repo function in Wave-2 should be updated to
populate these columns and move the in-txn audit insert into the repo (matching `revokeProduct`).

---

#### Table: `product_access_events`

Bounded context: Products. Owned by: `packages/db`.
Purpose: Immutable event log of entitlement state transitions. Feeds audit trail and analytics.
Every `grantProduct`/`revokeProduct`/`applyBillingEvent` must write one row alongside the audit_log entry.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `entitlement_id` | UUID | NO | — | FK → `entitlements.id` (no cascade — preserve event if entitlement changes) |
| `user_id` | UUID | NO | — | FK → `users.id` (denormalised for fast user-scoped queries) |
| `product_code` | TEXT | NO | — | Denormalised from entitlement |
| `from_state` | TEXT | NO | — | State before transition |
| `to_state` | TEXT | NO | — | State after transition |
| `reason` | TEXT | YES | — | Human-readable reason |
| `actor_id` | UUID | YES | — | FK → `users.id` (null = system/webhook) |
| `actor_type` | TEXT | NO | — | `user`, `admin`, `system`, `billing_webhook` |
| `created_at` | TIMESTAMPTZ | NO | NOW() | Immutable |

**PK:** `id`
**FK:** `entitlement_id → entitlements.id`,
       `user_id → users.id`,
       `actor_id → users.id`
**Index:** `idx_pae_entitlement_id` on `entitlement_id`,
           `idx_pae_user_id` on `user_id`

---

#### Table: `terminal_release_cache`

Bounded context: Axioma. Owned by: `packages/db`.
Purpose: Cached Axioma terminal release metadata. Written by background worker. UI shows stale warning if cache is old.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `version` | TEXT | NO | — | Semver, e.g. `1.4.2` |
| `channel` | TEXT | NO | — | `stable` or `beta` |
| `platform` | TEXT | NO | — | `win32`, `darwin`, or `linux` |
| `published_at` | TIMESTAMPTZ | NO | — | Published date from Axioma |
| `release_notes_markdown` | TEXT | YES | — | |
| `download_url_template` | TEXT | YES | — | Template; actual signed URL generated at request time |
| `checksum_sha256` | TEXT | YES | — | |
| `min_supported_version` | TEXT | YES | — | Semver of minimum supported client |
| `is_current` | BOOLEAN | NO | false | Latest in this channel × platform combination |
| `fetched_at` | TIMESTAMPTZ | NO | NOW() | When worker cached this entry |

**PK:** `id`
**Unique:** `(version, channel, platform)` — one cache row per release per channel per platform
**Index:** `idx_trc_channel_platform_current` on `(channel, platform, is_current)`

---

#### Table: `terminal_download_events`

Bounded context: Axioma. Owned by: `packages/db`.
Purpose: Audit trail for download CTA clicks and signed URL generation.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | — | FK → `users.id` |
| `release_id` | UUID | NO | — | FK → `terminal_release_cache.id` |
| `version` | TEXT | NO | — | Denormalised from release |
| `platform` | TEXT | NO | — | |
| `ip_address` | TEXT | YES | — | For audit; stored as TEXT (not INET) to avoid pg dialect differences |
| `user_agent` | TEXT | YES | — | |
| `entitlement_verified` | BOOLEAN | NO | — | Was entitlement active at download time |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**FK:** `user_id → users.id`,
       `release_id → terminal_release_cache.id`
**Index:** `idx_tde_user_id` on `user_id`

---

#### Table: `terminal_license_events`

Bounded context: Axioma. Owned by: `packages/db`.
Purpose: Records Axioma license state changes visible to WTC (device-link, revoke, entitlement sync).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | — | FK → `users.id` |
| `event_type` | TEXT | NO | — | `link_initiated`, `link_confirmed`, `link_revoked`, `entitlement_synced` |
| `axioma_user_id` | TEXT | YES | — | Axioma-side user identifier |
| `device_fingerprint` | TEXT | YES | — | Opaque hashed device ID from Axioma. Never plaintext. |
| `metadata` | JSONB | YES | — | Additional context. No plaintext keys. |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**FK:** `user_id → users.id`
**Index:** `idx_tle_user_id` on `user_id`

---

#### Table: `notifications`

Bounded context: Ops. Owned by: `packages/db`.
Purpose: Platform-generated user-facing alerts. Read by user, marked read by user action.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | — | FK → `users.id` ON DELETE CASCADE |
| `type` | TEXT | NO | — | `entitlement_expiring`, `entitlement_expired`, `tv_access_granted`, `tv_access_expiring`, `support_reply`, `bot_warning`, `billing_action_needed` |
| `title` | TEXT | NO | — | Short display title |
| `body` | TEXT | NO | — | Notification body text |
| `link_url` | TEXT | YES | — | Optional deep-link into the platform |
| `read_at` | TIMESTAMPTZ | YES | — | NULL = unread |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |

**PK:** `id`
**FK:** `user_id → users.id ON DELETE CASCADE`
**Index:** `idx_notifications_user_unread` on `(user_id, read_at)` WHERE `read_at IS NULL` (partial index — fast unread count)

---

#### Table: `support_tickets`

Bounded context: Ops. Owned by: `packages/db`.
Purpose: User-submitted support threads read by `support` and `admin` roles.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `user_id` | UUID | NO | — | FK → `users.id` |
| `product_code` | TEXT | YES | — | Optional: which product the ticket relates to |
| `subject` | TEXT | NO | — | Short subject line |
| `body` | TEXT | NO | — | Initial message body |
| `status` | TEXT | NO | `'open'` | `open`, `in_progress`, `resolved`, `closed` |
| `priority` | TEXT | NO | `'normal'` | `low`, `normal`, `high`, `urgent` |
| `assigned_to` | UUID | YES | — | FK → `users.id` (support agent) |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | |
| `resolved_at` | TIMESTAMPTZ | YES | — | |

**PK:** `id`
**FK:** `user_id → users.id`,
       `assigned_to → users.id`
**Index:** `idx_support_tickets_user_id` on `user_id`,
           `idx_support_tickets_status` on `status`

---

## Repo functions for Wave-2

All mutation repos follow the canonical `grantProduct` pattern:
**mutation + in-txn audit row in a single transaction; audit action name listed below.**
Read functions do not require a transaction but must enforce per-user isolation
(always WHERE user_id = $userId; never return rows for a different user).

### Bots

| Function | Signature | Audit action | Notes |
|---|---|---|---|
| `insertBotConfigVersion` | `(db, input: {botInstanceId, version, configJson, changedBy?, note?}) → Promise<void>` | `bot.config_version_created` | Append-only; called inside existing `saveBotConfig` txn |
| `listBotConfigVersions` | `(db, botInstanceId: string) → Promise<BotConfigVersion[]>` | — | Ordered DESC by version |
| `insertBotMetricSnapshot` | `(db, input: {botInstanceId, snapshotAt, ...metrics, sourceAdapter}) → Promise<void>` | `bot.metric_snapshot` (INFO level, not audited in audit_logs — too high frequency; use integration_health_checks pattern instead) | Worker only |
| `listBotMetricSnapshots` | `(db, botInstanceId: string, limit?: number) → Promise<BotMetricSnapshot[]>` | — | DESC by snapshot_at; default limit 50 |
| `insertBotPositionSnapshot` | `(db, input: {botInstanceId, snapshotAt, positions: PositionRow[]}) → Promise<void>` | none | Batch insert per snapshot epoch; worker only |
| `listBotPositionSnapshots` | `(db, botInstanceId: string, limit?: number) → Promise<BotPositionSnapshot[]>` | — | DESC by snapshot_at |
| `importBotTrade` | `(db, input: BotTradeImportInput) → Promise<{inserted: boolean}>` | `bot.trade_imported` | UPSERT on unique(botInstanceId, externalTradeId, sourceAdapter); returns inserted=false if duplicate |
| `listBotTradeImports` | `(db, botInstanceId: string, opts?: {limit, fromDate, toDate}) → Promise<BotTradeImport[]>` | — | DESC by closed_at |
| `insertBotSafetyEvent` | `(db, input: {botInstanceId, eventCode, severity, symbol?, description, metadata?}) → Promise<void>` | `bot.safety_event` | Audit in-txn at severity=critical; info/warning write audit row optionally |
| `listBotSafetyEvents` | `(db, botInstanceId: string, opts?: {unacknowledgedOnly}) → Promise<BotSafetyEvent[]>` | — | |
| `acknowledgeBotSafetyEvent` | `(db, eventId: string, adminId: string) → Promise<void>` | `bot.safety_event_ack` | Admin action; txn + audit |

### Education

| Function | Signature | Audit action | Notes |
|---|---|---|---|
| `createTeacherProfile` | `(db, input: {userId, displayName, bio?, avatarUrl?, socialLinks?}) → Promise<TeacherProfile>` | `education.teacher_profile_create` | Admin or self-registration; txn + audit |
| `getTeacherProfile` | `(db, userId: string) → Promise<TeacherProfile \| null>` | — | |
| `updateTeacherProfile` | `(db, teacherProfileId: string, input: Partial<...>, actorId: string) → Promise<void>` | `education.teacher_profile_update` | Ownership enforced by caller route; txn + audit |
| `upsertEnrollment` | `(db, input: {userId, courseId, entitlementId?}) → Promise<Enrollment>` | `education.enrolled` | ON CONFLICT DO NOTHING; idempotent |
| `markEnrollmentComplete` | `(db, userId: string, courseId: string) → Promise<void>` | `education.course_completed` | txn + audit |
| `listEnrollments` | `(db, userId: string) → Promise<Enrollment[]>` | — | Per-user only |
| `upsertLessonProgress` | `(db, input: {userId, lessonId, percentComplete, completed}) → Promise<void>` | none (high-frequency; no audit per update) | UPSERT on unique(user_id, lesson_id) |
| `getLessonProgress` | `(db, userId: string, lessonId: string) → Promise<LessonProgress \| null>` | — | |
| `listCourseProgress` | `(db, userId: string, courseId: string) → Promise<LessonProgress[]>` | — | All lessons in course for this user |
| `createPinnedLink` | `(db, input: {ownerType, ownerId, label, url, iconType?, sortOrder?, createdBy?}) → Promise<PinnedLink>` | `education.pinned_link_create` | txn + audit |
| `listPinnedLinks` | `(db, ownerType: string, ownerId: string) → Promise<PinnedLink[]>` | — | Ordered by sort_order |
| `deletePinnedLink` | `(db, linkId: string, actorId: string) → Promise<void>` | `education.pinned_link_delete` | Soft-deactivate (set is_active=false) + txn + audit; do not hard-delete |

### TradingView

| Function | Signature | Audit action | Notes |
|---|---|---|---|
| `upsertTradingViewProfile` | `(db, input: {userId, tvUsername}) → Promise<TvProfile>` | `tv_access.profile_update` | Creates or updates; txn + audit |
| `getTvProfile` | `(db, userId: string) → Promise<TvProfile \| null>` | — | |
| `createTvGrant` | `(db, input: {requestId, userId, tvUsername, grantedAt, expiresAt?, grantedBy?, grantedByType}) → Promise<TvGrant>` | `tv_access.grant` | txn + audit; also updates tradingview_profiles.current_grant_id |
| `revokeTvGrant` | `(db, grantId: string, adminId: string, reason?: string, now?: number) → Promise<void>` | `tv_access.revoke` | txn + audit; also nulls tradingview_profiles.current_grant_id; updates tradingview_access_requests.revoked_at/revoked_by |
| `listTvGrantsForUser` | `(db, userId: string) → Promise<TvGrant[]>` | — | Per-user isolation |
| `listAllTvGrants` | `(db, opts?: {activeOnly}) → Promise<TvGrant[]>` | — | Admin only; activeOnly filters out revoked |

### Products

| Function | Signature | Audit action | Notes |
|---|---|---|---|
| `recordProductAccessEvent` | `(db, input: {entitlementId, userId, productCode, fromState, toState, reason?, actorId?, actorType}) → Promise<void>` | none (this IS the event; also written alongside audit_logs in grantProduct/revokeProduct) | Called inside existing grant/revoke txns |
| `listProductAccessEvents` | `(db, userId: string, opts?: {productCode, limit}) → Promise<ProductAccessEvent[]>` | — | Per-user isolation |

### Axioma / Terminal

| Function | Signature | Audit action | Notes |
|---|---|---|---|
| `upsertTerminalRelease` | `(db, input: TerminalReleaseInput) → Promise<TerminalRelease>` | none (worker maintenance; logged via integration_health_checks) | ON CONFLICT (version, channel, platform) DO UPDATE; set is_current=false on prior rows in same channel/platform before insert |
| `getCurrentTerminalRelease` | `(db, channel: string, platform: string) → Promise<TerminalRelease \| null>` | — | WHERE is_current=true |
| `recordDownloadEvent` | `(db, input: {userId, releaseId, version, platform, ipAddress?, userAgent?, entitlementVerified}) → Promise<void>` | `terminal.download` | txn + audit |
| `recordLicenseEvent` | `(db, input: {userId, eventType, axiomaUserId?, deviceFingerprint?, metadata?}) → Promise<void>` | `terminal.license_event` | txn + audit; no plaintext keys in metadata |

### Ops

| Function | Signature | Audit action | Notes |
|---|---|---|---|
| `createNotification` | `(db, input: {userId, type, title, body, linkUrl?}) → Promise<Notification>` | none (notifications are not themselves audited) | Simple insert |
| `listNotifications` | `(db, userId: string, opts?: {unreadOnly, limit}) → Promise<Notification[]>` | — | Per-user isolation; unreadOnly uses partial index |
| `markNotificationRead` | `(db, notificationId: string, userId: string) → Promise<void>` | none | Verifies userId matches row before UPDATE (per-user isolation) |
| `createSupportTicket` | `(db, input: {userId, productCode?, subject, body, priority?}) → Promise<SupportTicket>` | `support.ticket_create` | txn + audit |
| `listSupportTickets` | `(db, opts: {userId?: string, status?: string, assignedTo?: string}) → Promise<SupportTicket[]>` | — | User sees only own tickets; support/admin see all |
| `updateSupportTicket` | `(db, ticketId: string, input: {status?, priority?, assignedTo?}, actorId: string) → Promise<void>` | `support.ticket_update` | txn + audit |

---

## Recommended 0002 scope vs defer-to-TARGET

### REAL-in-0002 (18 table additions / 1 ALTER)

These tables are all needed by at least one Wave-2 UI flow, can be PGlite-tested without
external dependencies, and together form a coherent migration unit:

- Bots (5 new): `bot_config_versions`, `bot_metric_snapshots`, `bot_position_snapshots`,
  `bot_trade_imports`, `bot_safety_events`
- Education (4 new + backfill): `teacher_profiles` (with courses backfill), `enrollments`,
  `lesson_progress`, `pinned_links`
- TradingView (2 new + 1 ALTER): `tradingview_profiles`, `tradingview_access_grants`,
  + `revoked_at`/`revoked_by` on `tradingview_access_requests`
- Products (1 new): `product_access_events`
- Axioma (3 new): `terminal_release_cache`, `terminal_download_events`, `terminal_license_events`
- Ops (2 new): `notifications`, `support_tickets`

### Deferred to TARGET (not in 0002)

- `user_profiles`: no Wave-2 UI depends on it; identity complete with current `users` table
- `secret_rotation_events`: needs full key-rotation story first
- `backtest_jobs` + `backtest_results`: Phase 6 per backtester-architect handoff; no runner wired

### Landable-scope recommendation for Wave-2 serial implementer

A single session can realistically land 0002 if split into three Drizzle table-group chunks:

1. **Bots group** (5 tables): these have no cross-table dependencies beyond `bot_instances`
   which already exists. PGlite test: insertBotMetricSnapshot → listBotMetricSnapshots; importBotTrade
   idempotency (duplicate returns inserted=false).

2. **Products + TradingView + Axioma group** (1 + 2 + 1 ALTER + 3 tables): product_access_events
   integrates with existing grantProduct txn; TV tables and terminal tables are independent of each other.
   PGlite test: createTvGrant → listTvGrantsForUser; upsertTerminalRelease current=true exclusivity.

3. **Education + Ops group** (4 + 2 tables): teacher_profiles backfill is the trickiest step.
   PGlite test: createTeacherProfile + upsertEnrollment + upsertLessonProgress per-user isolation
   (user A cannot read user B's progress); createNotification + listNotifications unread filter.

If time budget runs tight, the Wave-2 implementer should prioritise the Bots group (Part 5)
and Education group (Part 8) as these have the most UI surface in the current app. TradingView
and Ops are also valuable but have existing partial coverage via `tradingview_access_requests`.

---

## Decisions

1. `backtest_jobs`/`backtest_results` stay in `packages/backtester` as type models only until Phase 6.
   Rationale: no runner, no testable path, over-scopes 0002. Backtester-architect handoff is authoritative.
2. `user_profiles` and `secret_rotation_events` remain TARGET; not in 0002.
3. The `bot_configs` table retains its existing column names (`version`, `config`) from migration 0000;
   DATA_MODEL.md is updated to reflect the real names. No rename in 0002 (additive only).
4. `pinned_links` uses a polymorphic `(owner_type, owner_id)` pattern rather than two separate nullable
   FK columns. This matches the education-implementer plan and is simpler to extend.
5. `teacher_profiles` backfill runs inside the 0002 migration transaction before the FK column is added
   to `courses`. The old `owner_teacher_id` column is NOT dropped in 0002 (additive only).
6. `revoked_at`/`revoked_by` added to `tradingview_access_requests` as NULLable additive columns.
   The `revokeTv` repo function is updated in Wave-2 to populate these AND write an in-txn audit row
   (matching `revokeProduct` — the current version discards the actor, which is the tracked debt from
   the tradingview-persistence-auditor handoff Finding 3/6).
7. `product_access_events` is written inside the same transaction as `grantProduct`/`revokeProduct`
   alongside the existing `audit_logs` insert, not as a separate call.
8. `terminal_download_events.ip_address` is TEXT (not PG INET) to avoid dialect differences between
   PGlite test harness and production Postgres 17.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `teacher_profiles` backfill race: concurrent inserts between migration and first app write | P1 | Migration runs in a single transaction; app startup waits for migration to complete (drizzle-kit migrate is sequential) |
| `courses.owner_teacher_id` not dropped in 0002 — both columns present in schema | P2 | The Wave-2 implementer must NOT reference `owner_teacher_id` in new LMS repos; document the drop as Phase 3 cleanup after full cutover |
| `tradingview_profiles.current_grant_id` circular FK (profile → grant; grant → request; request → user) | P1 | Set `current_grant_id` AFTER grant is inserted, not during; use a second UPDATE in the same txn |
| 0002 scope is large (18 tables + 1 ALTER) — context window risk in Wave-2 | P1 | Three-chunk sequencing above; Rule-7 STOP applies if quality degrades |
| `pinned_links` polymorphic owner_id — no DB-level FK enforcement | P2 | Application enforces at write; add a CHECK constraint `owner_type IN ('teacher_profile','course')` |
| `bot_metric_snapshots` volume — no partition strategy yet | P2 | Deferred; note in DATA_MODEL open items |

---

## Verification/tests (for Wave-2 implementer)

Each table group should have a PGlite integration test in `tests/integration/db-persistence.test.ts`
(the existing pattern from Phase 1.7). Required coverage:

- **Bots:** importBotTrade — duplicate import returns `inserted: false`; `listBotMetricSnapshots` returns DESC order; `insertBotSafetyEvent` with `severity=critical` writes an audit row; `acknowledgeBotSafetyEvent` sets acknowledged_at and acknowledged_by.
- **Education:** `createTeacherProfile` + `upsertEnrollment` per-user isolation (user A's progress is invisible to user B; `listCourseProgress(userB_id, courseId)` returns [] when userA has progress); `markEnrollmentComplete` sets completed_at.
- **TradingView:** `createTvGrant` updates `tradingview_profiles.current_grant_id`; `revokeTvGrant` populates `revoked_at`/`revoked_by` and nulls `current_grant_id`; `listTvGrantsForUser` returns only this user's grants.
- **Ops:** `createNotification` + `listNotifications(userId, {unreadOnly:true})` returns 1 unread; `markNotificationRead` removes it from unread list; `createSupportTicket` writes an audit row.
- **Products:** `recordProductAccessEvent` written alongside `grantProduct` txn; `listProductAccessEvents` scoped to userId.

Gates RUN vs NOT RUN (same rules as all previous phases):

| Gate | Expected |
|---|---|
| `npm run typecheck` | PASS after Wave-2 schema edits |
| `npm test` | PASS — new PGlite integration tests green |
| `npm run lint` | PASS |
| `npm run build -w @wtc/web` | PASS |
| `db:migrate` / `db:seed` | NOT RUN (no `DATABASE_URL`) |

---

## Next actions

1. **Wave-2 serial implementer:** Write `packages/db/src/schema.ts` additions for all 18 REAL-in-0002
   tables using the column specs above. Generate migration SQL as `0002_ecosystem_expansion.sql` with
   `npx drizzle-kit generate` once DATABASE_URL is available, or hand-write from the specs here.
2. **Wave-2 serial implementer:** Add repo functions listed in "Repo functions for Wave-2" section to
   `packages/db/src/repositories.ts`, following the canonical `grantProduct` txn+audit pattern.
3. **Wave-2 serial implementer:** Update `revokeTv` to populate `revoked_at`/`revoked_by` and move
   audit insert into the txn body (debt from tradingview-persistence-auditor Finding 3/6).
4. **Wave-2 serial implementer:** Run PGlite integration tests per the coverage list above.
5. **Education route implementer (Phase 2 Part 8):** Once `teacher_profiles`/`enrollments`/
   `lesson_progress` exist, implement the full LMS route tree per `docs/EDUCATION_LMS_PLAN.md` §20
   Phase 1.8 prompt.
6. **backtester-architect (Phase 6):** Scaffold `packages/backtester` TypeScript package and at that
   point add `backtest_jobs`/`backtest_results` as migration 0003 per the backtester-architect handoff.
7. **Phase 3 cleanup (deferred):** Drop `courses.owner_teacher_id` column after full cutover to
   `teacher_profile_id`; this requires a separate additive-then-drop migration pair.
