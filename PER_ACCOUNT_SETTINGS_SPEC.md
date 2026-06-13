# PER_ACCOUNT_SETTINGS_SPEC.md

> Status: APPROVED design (Judge verdict). Chosen design: **A — instance-per-account**.
> Scope: legacy_bot first; tortila_bot stays single-instance (NULL bucket) until an exchange-account identity source exists.
> Invariant: `FEATURE_LIVE_BOT_CONTROL=false`. Per-account config is a WTC-versioned DRAFT; nothing is pushed to a live bot/exchange.

## 1. Goal

Today a user has exactly ONE saved config per `(user, bot product)`. We want EACH trading account (identified by `api_keys.pub_id`, the SAME identity the admin stats switcher already uses) to have its OWN settings, version history, and safety stream — without breaking the byte-compatible save contract and with a backward-compatible canary migration where the existing single config maps to a default/aggregate bucket.

## 2. Chosen design: instance-per-account

- Add nullable column `bot_instances.account_id text`. `NULL` = the legacy aggregate/default bucket (every existing row maps here). A non-NULL value is a `pub_id`.
- `ensureBotInstance` is keyed by `(user_id, product_code, account_id)`. One `bot_instances` row per account; the NULL row is the legacy aggregate.
- `bot_configs`, `bot_config_versions`, `bot_safety_events`, `bot_metric_snapshots`, `bot_provider_accounts`, `bot_trade_imports`, `bot_trade_reviews` are **UNCHANGED** — all stay keyed by `bot_instance_id`. Per-account scoping happens entirely at instance resolution.

### Why (real schema, cited)
- `bot_instances` has NO DB uniqueness today (`packages/db/migrations/meta/0021_snapshot.json:1348` `"indexes": {}`, `:1378` `"uniqueConstraints": {}`; `packages/db/src/schema.ts:138-144`). The one-per-(user,product) invariant is app-only in `ensureBotInstance` (`packages/db/src/repositories.ts:1824`). So this is a purely additive change, not a constraint swap.
- The whole config/version/safety machine is already `bot_instance_id`-keyed: `getCurrentBotConfig` (`repositories.ts:2030`), `saveBotConfig` (`repositories.ts:2180`), `listBotConfigVersions` (`repositories.ts:2200`). Zero changes there.
- Proven nullable-account precedent: `bot_trade_imports` split partial unique indexes (`packages/db/migrations/0021_complete_pepper_potts.sql:1-3`); `bot_provider_accounts` partial unique indexes (`schema.ts:165-171`).
- Only ONE consumer assumes one-instance-per-product: `loadBotConfig` at `apps/web/src/features/bots/config.ts:1043` (`instances.find(i => i.productCode === productCode)`). Every other caller uses `ensureBotInstance` directly.

### Do NOT reuse `exchange_account_id`
`bot_instances.exchange_account_id` (`schema.ts:142`) is an orphan (no caller sets it; `ensureBotInstance` always passes `?? null`) and references the user's OWN key vault (`exchange_accounts`) — a different concept from the legacy `pub_id`. Add a distinct `account_id text` column.

## 3. Database changes

### 3.1 Drizzle schema (`packages/db/src/schema.ts`, botInstances block at 138-144)
```ts
export const botInstances = pgTable(
  'bot_instances',
  {
    id: id(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    productCode: text('product_code').notNull(),
    exchangeAccountId: uuid('exchange_account_id').references(() => exchangeAccounts.id),
    accountId: text('account_id'),            // NEW. NULL = legacy aggregate bucket; else api_keys.pub_id.
    createdAt: createdAt(),
  },
  (t) => ({
    // Postgres treats NULLs as distinct in a plain unique index → two partial indexes.
    uniqUserProductAccount: uniqueIndex('bi_user_product_account_idx')
      .on(t.userId, t.productCode, t.accountId)
      .where(sql`"account_id" IS NOT NULL`),
    uniqUserProductDefault: uniqueIndex('bi_user_product_default_idx')
      .on(t.userId, t.productCode)
      .where(sql`"account_id" IS NULL`),
  }),
);
```
`BotInstanceRow = typeof s.botInstances.$inferSelect` (`repositories.ts:1801`) auto-gains `accountId` — no manual type edit.

### 3.2 Migration SQL — see migrationPlan field. New file `packages/db/migrations/0022_*.sql` (next idx 22 per `_journal.json` ending idx 21).

## 4. Repository API changes (`packages/db/src/repositories.ts`)

- **`ensureBotInstance`** (1823-1829): add `accountId?: string | null` to input. NULL-bucket lookup MUST use `isNull(s.botInstances.accountId)` (NOT `eq(col, null)` — SQL `account_id = NULL` is always false and would spawn a duplicate every call → 23505 once the partial unique exists). Branch:
  ```ts
  const where = accountId == null
    ? and(eq(s.botInstances.userId, userId), eq(s.botInstances.productCode, productCode), isNull(s.botInstances.accountId))
    : and(eq(s.botInstances.userId, userId), eq(s.botInstances.productCode, productCode), eq(s.botInstances.accountId, accountId));
  ```
  Set `accountId: input.accountId ?? null` on INSERT. `isNull` is already imported (`repositories.ts:11`); same pattern as `repositories.ts:2263`.
- **NEW `getBotInstanceForUserProductAccount(db, { userId, productCode, accountId })`**: read-only sibling using the same branched `isNull`/`eq` predicate; returns `BotInstanceRow | null` WITHOUT inserting. `loadBotConfig` uses this instead of `instances.find(...)`.
- **`getCurrentBotConfig` / `listBotConfigVersions` / `listBotSafetyEvents` / `saveBotConfig`**: NO change (already `bot_instance_id`-keyed).
- **`listBotInstancesForUser`** (1818): unchanged signature; now MAY return >1 row per product. Its only `.find(productCode===)` consumer (config.ts:1043) is migrated.

## 5. Loader / action changes (`apps/web/src/features/bots/config.ts`)

- **`loadBotConfig(userId, productCode, accountId?)`** (1033): replace the `listBotInstancesForUser` + `instances.find(i => i.productCode === productCode)` block (1038, 1043) with `getBotInstanceForUserProductAccount(db, { userId, productCode, accountId: accountId ?? null })`. Everything downstream (1057-1061) unchanged. `getPublishedBotGlobalConfig` stays account-agnostic (system default is shared). Fold `accountId` into `demoKey` (1012) and `loadDemoBotConfig` (1016) so dev mode mirrors per-account isolation.
- **`persistBotConfig(userId, productCode, config, note?, accountId?)`** (1093): pass `accountId` into `ensureBotInstance` at 1107 (and into `demoKey` on the no-db path at 1097). `saveBotConfig(... botInstanceId: inst.id ...)` (1108) unchanged. The `safeUserBotConfigForProduct` forbidden-key guard (1094) is untouched — accountId is a routing arg, never persisted into the config JSON.
- **`selectSystemDefaultBotConfig(userId, productCode, accountId?)`** (1112): thread `accountId` into its `ensureBotInstance` (1119).

### Action handler (`apps/web/src/features/bots/config-action-handler.ts`)
- Widen `BotConfigActionDependencies.persistConfig` (47) and `selectSystemDefault` (48) to accept a trailing `accountId?: string | null`.
- `resolveActionContext` (123-134): AFTER the existing `requireUser` + `botAccessForUser(...).allowed` check (130-132), read `const requestedAccount = String(formData.get('account') ?? '') || undefined;` then apply the RBAC gate (Section 7) to produce `accountId`, and put it on `ReadyActionContext`.
- `handleSaveBotConfigAction` (159) / `handleApplyBotPresetAction` (191) / `handleUseSystemDefaultBotConfigAction` (219): pass `ctx.accountId` down to `deps.persistConfig` / `deps.selectSystemDefault`.

### Settings page (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`)
- Read `account` from `searchParams`; compute `effectiveAccount` via the admin gate (Section 7).
- `loadBotConfig(user.id, meta.code, effectiveAccount)` (195).
- Update both `persistConfig` and `selectSystemDefault` closures (119-120) to forward `accountId`. **NOTE:** the existing static test asserts the exact string `persistConfig: (userId, productCode, config, note) => persistBotConfig` (`tests/integration/tortila-settings-save-contract-static.test.ts:92`) — this test MUST be updated in the same change or it goes red.
- Mirror the SAME closure update at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:94` (second `persistConfig` closure) — but setup keeps `accountId` undefined (setup wizard is the user's own aggregate).

## 6. Settings UX (mirror the stats switcher verbatim)

Source pattern: `apps/web/src/app/(app)/app/bots/statistics/page.tsx` LegacyPanel (112-162).

- On `[bot]/settings/page.tsx`, for `meta.code === 'legacy_bot'` only: render ONE selector row above the editor Card (312).
- `const effectiveAccount = isAdmin(user) ? account : undefined;` (identical to statistics:116). A non-admin's `account` param is ignored.
- Account list: admin → `loadLegacyAccounts()` (admin-gated, SAFE pub_id/market/status columns — `apps/web/src/features/bots/legacy-overview-data.ts:305`); non-admin → no selector.
- Render: an "All / aggregate" chip linking to `/app/bots/legacy/settings` (no account param) + one masked chip per account linking to `?account=<encodeURIComponent(pub_id)>`. pub_id masked via `maskPubId` (statistics:104-107 — or reuse `shortPubId` at settings page:75). `aria-current` on the active chip; `buttonClasses('secondary' | 'ghost')`.
- Add a neutral `StatusPill` showing `account <masked>` or `all accounts` (mirror statistics:131-133).
- Add `<input type="hidden" name="account" value={effectiveAccount ?? ''} />` next to the hidden `name="bot"` field in ALL three forms: the save form (`id="custom-settings"`, page:320-322), each preset form (page:476-479), and the use-system-default form (page:263-266).
- Field name MUST be `account`. `pubId`/`providerAccountId`/`providerAccounts`/`pubid` are in `FORBIDDEN_BOT_CONFIG_ACTION_FORM_KEYS` (config-action-handler.ts:65-68) and would trip the forbidden-field guard. `account` normalizes to `account`, which is NOT forbidden.
- Keep ONE selector + the existing clean cards. Version-history (page:518) and safety (page:537) now correctly show the selected account's instance.
- tortila_bot: render NO selector (no pub_id source today; it uses exchange keys).

## 7. RBAC (server-side, enforced twice) — see rbacModel field.

## 8. Back-compat (nothing lost)

- `account_id` added NULLABLE, no default → every existing `bot_instances` row becomes the NULL (aggregate) bucket. The current `bot_configs` row, its `bot_config_versions` history, and `bot_safety_events` stay attached to the same unchanged `instance.id`.
- Every current caller that passes no accountId resolves `account_id IS NULL` → the same pre-existing row: `loadBotConfig`/`persistBotConfig` settings path; the bot-room, setup, config-export, readiness loaders; worker (index.ts:309, legacy-live.ts:641); admin mapping (actions.ts:376); journal (journal.ts:162,218). Prod behavior is byte-identical until a user/admin picks a specific account.
- SAVE contract unchanged: `legacy_*`/`tortila_*` field names untouched; `account` is a NEW additive hidden routing field; accountId never enters the persisted config JSON, so the forbidden-key guards (`assertNoForbiddenUserBotConfigKeys`) and `exportBotConfig` are unaffected.
- Demo mode keyed by `userId:productCode` defaults unchanged when accountId is absent.

## 9. Tests

- Update `tests/integration/tortila-settings-save-contract-static.test.ts:92` for the new `persistConfig` closure signature (keep all `legacy_*`/`tortila_*` name assertions green — `account` is additive).
- New static assertions on the settings page (sibling of `tests/integration/bot-statistics-static.test.ts`): contains `isAdmin`, an `admin ? account : undefined` gate, a `name="account"` hidden field on the save + preset + use-default forms, and that `loadBotConfig(... effectiveAccount)` threads the account.
- New handler test in `tests/integration/bot-config-action-handler.test.ts` style (user `{ id:'user-1', roles:['user'] }`, line 28): assert a non-admin POST with a non-empty `account` does NOT persist to a non-NULL instance (coerced to NULL).
- New DB test: `ensureBotInstance` called twice with no accountId returns the SAME instance id (guards the `isNull` footgun); called with two distinct pub_ids returns two distinct ids; the partial unique throws 23505 on a duplicate non-NULL `(user, product, account)`.

## 10. Non-goals / explicitly out of scope

- No live bot writes (`FEATURE_LIVE_BOT_CONTROL=false`).
- Read-model/runtime path (`apps/web/src/features/bots/data.ts` resolves instance by `(userId, productCode) LIMIT 1`) and worker snapshots still target the aggregate instance — documented; per-account config is a DRAFT, not yet per-account live runtime.
- tortila per-account selector (no pub_id source yet).