# ecosystem-security-auditor + ecosystem-billing-access-auditor handoff
## Scope
Read-only source audit for bot settings security/access: auth/RBAC, CSRF, entitlements, exchange API key storage, user vs admin visibility, admin global bot config, read-only admin drilldown, fail-closed access, audit logging, billing access, and live bot control safety.

No application code, database state, live server, live bot, Stripe, or provider systems were mutated. No secrets were printed or written. Background agent tooling was not exposed in this Codex session, so this is the assigned combined-auditor handoff only, not an N-agent audit claim.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/app/admin/entitlements/review/page.tsx`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `apps/web/src/features/billing/checkout.ts`
- `packages/auth/src/rbac.ts`
- `packages/auth/src/csrf.ts`
- `packages/entitlements/src/engine.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `apps/worker/src/legacy-live.ts`
- `tests/integration/legacy-live-worker-static.test.ts`

## Files changed
- `docs/handoffs/20260603-bot-settings-security-access.md` only

## Findings
1. Severity: HIGH - Legacy user settings/export reads are entitlement-gated, but the live Legacy read model is product-scoped, not user-scoped or provider-account-scoped.
   Evidence: settings page gates by session, CSRF, and `botAccessForUser` before saving at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:67`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:69`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:74`, then loads Legacy live config with `loadBotReadModel(meta.code, ['config'])` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:106` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:109`. The export route gates by user and entitlement at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:14`, then calls the same product-only read at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:16` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:24`. The loader signature has only `productCode` and `parts` at `apps/web/src/features/bots/data.tsx:241`, filters latest snapshots by `bot_instances.product_code` only at `apps/web/src/features/bots/data.tsx:267` to `apps/web/src/features/bots/data.tsx:268`, `apps/web/src/features/bots/data.tsx:279` to `apps/web/src/features/bots/data.tsx:280`, and `apps/web/src/features/bots/data.tsx:291` to `apps/web/src/features/bots/data.tsx:292`, then exposes `raw: liveConfig` at `apps/web/src/features/bots/data.tsx:395` to `apps/web/src/features/bots/data.tsx:411`. The DB model has `bot_instances.user_id`, `product_code`, and optional `exchange_account_id`, but no normalized Legacy provider-account/pub_id ownership dimension at `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:143`.
   Recommendation: before production use by multiple Legacy customers, add a normalized provider-account mapping, for example `bot_provider_accounts(user_id, bot_instance_id, provider_pub_id, status)`, and replace product-only reads with `loadBotReadModelForUser(user.id, productCode, providerAccountId, parts)`. Fail closed when no mapping exists, and never export a global latest Legacy snapshot to a non-admin user.
   Target part: `apps/web/src/features/bots/data.tsx`, bot settings page, config export route, DB schema/repositories.

2. Severity: HIGH - Admin Legacy `pub_id` drilldown is admin-gated and read-only, but full provider IDs and active-order details are rendered without an audit event for the drilldown.
   Evidence: `/admin/bots` requires user and admin role at `apps/web/src/app/admin/bots/page.tsx:44` to `apps/web/src/app/admin/bots/page.tsx:48`, and source comments state read-only/no live control at `apps/web/src/app/admin/bots/page.tsx:41` to `apps/web/src/app/admin/bots/page.tsx:42`. The query reads the latest global Legacy snapshot for `legacy_bot` only at `apps/web/src/features/admin/queries.ts:426` to `apps/web/src/features/admin/queries.ts:435`, maps full `pubId` from `legacyLiveConfig.providerAccounts` at `apps/web/src/features/admin/queries.ts:448` to `apps/web/src/features/admin/queries.ts:459`, and the UI renders full `pub_id` values plus balance/slots/orders at `apps/web/src/app/admin/bots/page.tsx:219` to `apps/web/src/app/admin/bots/page.tsx:245`, active slots at `apps/web/src/app/admin/bots/page.tsx:254` to `apps/web/src/app/admin/bots/page.tsx:267`, and active orders at `apps/web/src/app/admin/bots/page.tsx:276` to `apps/web/src/app/admin/bots/page.tsx:288`. Registered audit actions include `admin.user_view` but no `admin.bot_account.inspect` or equivalent at `packages/audit/src/audit.ts:120` to `packages/audit/src/audit.ts:128`, and no admin bot audit call was found in `apps/web/src/app/admin/bots/page.tsx`, `apps/web/src/features/admin/queries.ts`, or `packages/audit/src/audit.ts`.
   Recommendation: mask `pub_id` by default, add an explicit audited inspect action/route for full `pub_id` reveal or per-account drilldown, register a new audit action, and record actor, target account, reason, and result. Tie the drilldown to the normalized provider-account model from finding 1.
   Target part: admin bot page/query, audit action registry, audit repository path.

3. Severity: MEDIUM - Legacy config export asserts it is safe, but it spreads raw live config into the export instead of rebuilding from an allowlist; invalid form rows are also silently dropped back to defaults.
   Evidence: the export card tells users the file contains no exchange keys and applies nothing live at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:184` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:189`. The export route prefers `legacyRead.config.data.raw` when present at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:20` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:24`. `exportBotConfig` creates `safeConfig = { ...defaults, ...(config ?? {}) }` and serializes `{ ...safeConfig, ... }` at `apps/web/src/features/bots/config.ts:563` to `apps/web/src/features/bots/config.ts:576`. Current worker input is safer because it selects allowlisted Legacy DB columns at `apps/worker/src/legacy-live.ts:317` to `apps/worker/src/legacy-live.ts:365` and asserts no secret field names at `apps/worker/src/legacy-live.ts:367` to `apps/worker/src/legacy-live.ts:370`, but the export function itself does not enforce that boundary. Separately, `legacySymbolConfigsFromForm` drops invalid rows and returns defaults when none parse at `apps/web/src/features/bots/config.ts:383` to `apps/web/src/features/bots/config.ts:415`, while the save action returns silently on schema parse failure at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:76` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:78`.
   Recommendation: make export construction schema/allowlist based and never spread raw snapshot JSON. Return user-visible validation errors instead of silently replacing invalid Legacy rows with defaults. Consider auditing rejected bot config saves as validation-denied events if they affect access or safety controls.
   Target part: Legacy config export, form parser, bot settings server action.

4. Severity: MEDIUM - Source-level Legacy DB secret filtering is strong, but the deployment gate for a column-restricted Legacy DB role is still open.
   Evidence: the worker redacts DB URLs and secret-like tokens in operation messages at `apps/worker/src/legacy-live.ts:93` to `apps/worker/src/legacy-live.ts:107`, checks selected row keys with `assertNoSecretFields` at `apps/worker/src/legacy-live.ts:127` to `apps/worker/src/legacy-live.ts:134`, and selects only whitelisted columns from Legacy provider tables at `apps/worker/src/legacy-live.ts:317` to `apps/worker/src/legacy-live.ts:365`. Static tests assert serialized payloads exclude `api_key`, `secret_key`, `authorization`, and `access_token`, and assert the source does not select `*`, `api_key`, or `secret_key` at `tests/integration/legacy-live-worker-static.test.ts:164` to `tests/integration/legacy-live-worker-static.test.ts:180`. However the latest phase handoff explicitly marks `Column-restricted Legacy DB role proof` as not run at `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md:92` to `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md:97`.
   Recommendation: add a deploy-safe preflight using the production `LEGACY_DATABASE_URL` role that proves allowed reads work and direct credential-column reads fail, without printing any values. Treat this as a release gate before enabling broader admin/user Legacy visibility.
   Target part: deployment runbook, worker preflight, DB grant model.

5. Severity: MEDIUM - Admin bot health detail rendering trusts raw diagnostic blobs more than the billing manual-review path does.
   Evidence: billing admin snapshots are narrowed with `pickSafeSnapshot` at `apps/web/src/features/admin/queries.ts:45` to `apps/web/src/features/admin/queries.ts:50`. In contrast, admin bot health maps `detail: r.detail` directly at `apps/web/src/features/admin/queries.ts:476` to `apps/web/src/features/admin/queries.ts:492`, and renders `JSON.stringify(hc.detail).slice(0, 120)` at `apps/web/src/app/admin/bots/page.tsx:297` to `apps/web/src/app/admin/bots/page.tsx:332`. The current Legacy worker redaction reduces immediate risk, but the admin UI should not depend on every future health writer being perfect.
   Recommendation: add a bot-health-safe detail allowlist/redactor before returning or rendering admin health checks, matching the billing review snapshot pattern.
   Target part: `loadAdminBotHealth`, admin bot health UI, worker health-check contracts.

6. Severity: LOW/PASS - Entitlement and billing access paths are mostly fail-closed in inspected source.
   Evidence: the entitlement engine declares itself the only source of truth and fail-closed at `packages/entitlements/src/engine.ts:1` to `packages/entitlements/src/engine.ts:4`; unknown entitlement states resolve to manual review at `packages/entitlements/src/engine.ts:63` to `packages/entitlements/src/engine.ts:86`; access is granted only for active/grace decisions at `packages/entitlements/src/engine.ts:113` to `packages/entitlements/src/engine.ts:155`. Stripe checkout requires CSRF, session, DB, provider checkout, then creates a pending payment at `apps/web/src/app/(app)/app/billing/page.tsx:27` to `apps/web/src/app/(app)/app/billing/page.tsx:45`; mock self-grant is disabled in production at `apps/web/src/app/(app)/app/billing/page.tsx:16` to `apps/web/src/app/(app)/app/billing/page.tsx:23` and explained at `apps/web/src/app/(app)/app/billing/page.tsx:126` to `apps/web/src/app/(app)/app/billing/page.tsx:131`. The webhook verifies raw Stripe signature before DB mutation at `apps/web/src/features/billing/webhook-handler.ts:128` to `apps/web/src/features/billing/webhook-handler.ts:150`, deduplicates events at `apps/web/src/features/billing/webhook-handler.ts:170` to `apps/web/src/features/billing/webhook-handler.ts:195`, sends missing users or unknown plans to manual review at `apps/web/src/features/billing/webhook-handler.ts:198` to `apps/web/src/features/billing/webhook-handler.ts:243`, and manual review creation/resolution writes audit at `packages/db/src/repositories.ts:2964` to `packages/db/src/repositories.ts:2999` and `packages/db/src/repositories.ts:3017` to `packages/db/src/repositories.ts:3082`. Production without `DATABASE_URL` is fail-closed at `apps/web/src/lib/backend.ts:20` to `apps/web/src/lib/backend.ts:31` and `apps/web/src/lib/backend.ts:44` to `apps/web/src/lib/backend.ts:47`.
   Recommendation: keep this path as the access source of truth; add regression tests around the Legacy scoping changes so bot pages never bypass entitlement decisions.
   Target part: entitlements, billing webhook/checkout, bot page access guards.

7. Severity: LOW/PASS - Exchange API key handling and audit redaction are aligned with the no-plaintext-secret gate in inspected source.
   Evidence: exchange account metadata and sealed secret storage are separate at `packages/db/src/schema.ts:117` to `packages/db/src/schema.ts:135`; API key material is sealed before repository insertion at `apps/web/src/lib/db-store.ts:108` to `apps/web/src/lib/db-store.ts:121`; repository insert stores the account plus sealed secret in one transaction and audits only non-secret metadata at `packages/db/src/repositories.ts:384` to `packages/db/src/repositories.ts:400`; listing keys never joins `exchange_api_key_secrets` at `packages/db/src/repositories.ts:404` to `packages/db/src/repositories.ts:407`; audit event construction redacts `before` and `after` payloads at `packages/audit/src/audit.ts:166` to `packages/audit/src/audit.ts:183`.
   Recommendation: keep sealed material out of API responses, audit logs, fixtures, and screenshots; add focused tests for admin bot health redaction from finding 5.
   Target part: exchange key repositories, audit package, admin diagnostics.

8. Severity: LOW/PASS - Live bot control remains hard-disabled in inspected source.
   Evidence: control requires both feature flag and explicit audit approval, and otherwise throws at `packages/bot-adapters/src/control.ts:1` to `packages/bot-adapters/src/control.ts:18`. The adapter factory never exposes real Legacy HTTP control, ignores `legacyBaseUrl`, and returns the blocked adapter in real modes at `packages/bot-adapters/src/factory.ts:26` to `packages/bot-adapters/src/factory.ts:39`. Bot config saves are WTC DB-only and never forwarded to a live bot at `packages/db/src/repositories.ts:1677` to `packages/db/src/repositories.ts:1690`.
   Recommendation: do not add live start/stop/apply-config controls until security, bot-integration, audit, and runbook gates are all green in a separate phase.
   Target part: bot adapters, admin UX, bot config save flow.

## Decisions
1. Legacy user settings/export are not production-acceptable for multiple users until reads are scoped by user-owned provider account, not just product entitlement.
2. Admin `pub_id` visibility can remain read-only, but full reveal/drilldown needs explicit audit logging and masking by default.
3. Billing/entitlements remain the access source of truth; no bot page should derive access from snapshot existence or provider state.
4. Current bot config save/export must continue to be treated as WTC reference config only, not live apply.
5. No live bot control was tested or approved in this audit.

## Risks
1. A non-admin user with `legacy_bot` entitlement could view or export the latest global Legacy snapshot if another account/system owner snapshot is the newest row.
2. Admins can currently view full Legacy `pub_id` values and active-order detail without a dedicated inspect audit trail.
3. Future diagnostic or raw config fields could leak through Legacy export or bot health details if a writer accidentally adds sensitive data.
4. Source-level secret filtering is not a substitute for a column-restricted production DB role proof.
5. This was a static read-only audit; runtime behavior, deployment config, and production DB grants were not observed in this session.

## Verification/tests
RUN:
- `git status --short --branch` before edits; branch was `codex/bot-analytics-settings-canary-20260603` with no dirty entries observed.
- Confirmed `docs/handoffs/20260603-bot-settings-security-access.md` did not exist before writing.
- Static source inspection of auth/RBAC, CSRF/session, entitlements, billing webhook/checkout/manual review, exchange-key storage, audit redaction, bot settings/export, admin bot query/UI, worker Legacy live-read, bot adapters, and prior phase handoffs.
- No live server, bot, Stripe, provider, database mutation, Docker, SSH, systemd, or migration commands were run.

NOT RUN:
- `npm run lint`: not run; read-only audit scope and prior phase already reported lint green.
- `npm run typecheck`: not run; read-only audit scope and prior phase already reported typecheck green.
- `npm run build`: not run; read-only audit scope and prior phase already reported build green.
- Vitest/Playwright/browser checks: not run; this session did static audit only.
- `npm run secret:scan`: not run; prior phase reported it green, but this session did not rerun it.
- Live server deploy or production preview: not run by policy.
- Live bot start/stop/apply-config: not run by policy.
- Stripe webhook replay or live/test checkout: not run by policy.
- DB migrations or production DB reads: not run by policy.
- Column-restricted Legacy DB role proof: not run; remains an open gate from the prior phase.

## Next actions
1. Implement normalized Legacy provider-account ownership and make all user-facing Legacy read/export paths user/pub_id scoped and fail-closed.
2. Add audited admin bot-account inspect with masked default lists and full `pub_id` reveal only after explicit admin action/reason.
3. Change Legacy config export to rebuild from an allowlisted schema instead of spreading raw live config.
4. Add a bot-health detail allowlist/redactor before rendering admin diagnostic JSON.
5. Add tests for cross-user Legacy snapshot isolation, config-export isolation, admin inspect audit creation, bot health redaction, and no-secret export payloads.
6. Run the column-restricted Legacy DB role proof in a deployment-safe session without printing credential values.
