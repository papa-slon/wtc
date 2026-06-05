# admin-bot-drilldown-ux-auditor handoff
## Scope
Read-only Phase 3.74 UX audit for the admin user bot drilldown.

Objective checked: admin sees a premium terminal-first list of names, provider pub_id/user ids, clicks one user, and gets that user's bot statistics, settings/source state, and mapping state in a read-only admin view. Admin must not edit the user's settings from the drilldown; user/public settings remain separated. No product code, tests, migrations, live services, worker state, provider databases, SSH, bot controls, exchange probes, or secrets were changed or probed.

This was the assigned `ecosystem-ux-ui-designer` foreground audit lane. No N-agent audit claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md`
- `docs/handoffs/20260603-1840-bot-settings-source-ux-auditor.md`
- `docs/handoffs/20260603-1840-bot-settings-frontend-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-ux-tests-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-security-auditor.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `packages/ui/src/components.tsx`
- `packages/ui/src/theme.css`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit, excluding this required handoff artifact:
- `docs/handoffs/20260603-1918-admin-bot-drilldown-ux-auditor.md`

No product code, tests, migrations, runtime config, live services, or secrets were edited.

## Findings
1. Severity: HIGH. The current drilldown route violates the Phase 3.74 read-only objective by rendering provider-account mutation forms inside the user bot detail view. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:4` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:6` imports `CsrfField` plus map/disable actions; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:170` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:191` renders "Map Legacy pub_id"; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:221` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:229` renders a disable form; the actions mutate DB state and revalidate admin pages at `apps/web/src/features/admin/actions.ts:347` to `apps/web/src/features/admin/actions.ts:418`. Recommendation: remove map/disable forms and action imports from `/admin/users/[userId]/bots`; keep this route as identity, settings-source, statistics, and mapping status only. If mapping remains needed, move it to a separate explicitly audited admin mapping workflow and link to it as a separate action. Target part: admin user bot drilldown route and tests.

2. Severity: HIGH. The focused static test currently locks in the non-read-only behavior while naming the page read-only. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:38` to `tests/integration/admin-user-bot-detail-static.test.ts:55` expects `admin view: read-only` and also expects `adminMapLegacyProviderAccountAction`, `adminDisableLegacyProviderAccountAction`, `Map Legacy pub_id`, and `CsrfField`; `tests/integration/admin-user-bot-detail-static.test.ts:63` to `tests/integration/admin-user-bot-detail-static.test.ts:88` places mapping/disable action coverage in the same drilldown guardrail file. Recommendation: invert the drilldown assertions so the page forbids mapping/disable action imports, forms, and CSRF fields; move mutation-action coverage to a separate admin provider-account mapping workflow test if that workflow is approved. Target part: `tests/integration/admin-user-bot-detail-static.test.ts`.

3. Severity: HIGH. The admin user directory does not yet satisfy the "list of names/pub_id/user ids" objective. Evidence: `apps/web/src/app/admin/users/page.tsx:78` to `apps/web/src/app/admin/users/page.tsx:83` defines table columns for Email, Display name, Roles, Account state, Registered, and Actions only; `apps/web/src/app/admin/users/page.tsx:89` to `apps/web/src/app/admin/users/page.tsx:90` renders email/display name; the user id appears only inside the hidden link href at `apps/web/src/app/admin/users/page.tsx:117`. No provider pub_id or mapping state is visible on the list. Recommendation: add a compact identity/access column or card row with visible user id, display name/email, and Legacy provider pub_id/mapping summary (`mapped`, `not mapped`, `disabled`, `needs review`); keep full mutation controls out of the list. Target part: `/admin/users` directory UX.

4. Severity: HIGH. The detail route shows some statistics and mapping state but does not yet show the user's bot settings/source state. Evidence: bot cards show config version only as a pill at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:87` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:89`, show `Config updated` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:126` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:130`, and show metrics at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:149` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:159`; the loader selects only `botConfigs.version` and `updatedAt` at `apps/web/src/features/admin/user-bot-detail-loader.ts:219` to `apps/web/src/features/admin/user-bot-detail-loader.ts:227`. By contrast, user settings already have source-boundary copy for saved WTC reference/default/provider snapshot states at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:202` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208` and Legacy runtime evidence at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:236` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:242`. Recommendation: add an admin-only read-only settings/source summary DTO with config version, source kind, saved/default/provider snapshot availability, operation mode/profile/symbol counts, and export/source warnings; do not reuse user editable forms or server actions. Target part: admin loader DTO and `/admin/users/[userId]/bots` bot cards.

5. Severity: MEDIUM. Provider-account UX state is still collapsed, so disabled or needs-review mappings can read as generic pending/not mapped. Evidence: `apps/web/src/features/admin/types.ts:75` allows only `user_scoped`, `provider_account_mapped`, and `provider_account_pending`; `apps/web/src/features/admin/user-bot-detail-loader.ts:271` to `apps/web/src/features/admin/user-bot-detail-loader.ts:275` promotes only the first active provider row; `apps/web/src/features/admin/user-bot-detail-loader.ts:312` to `apps/web/src/features/admin/user-bot-detail-loader.ts:315` collapses all non-active/non-present Legacy cases into pending; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:18` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:21` renders one fallback label; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:114` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:123` says "Provider account not mapped." Prior UX state guidance already specified `mapped_active`, `unmapped`, `mapped_disabled`, and `needs_review/ambiguous` at `docs/handoffs/20260603-legacy-provider-account-ux-tests-auditor.md:63` to `docs/handoffs/20260603-legacy-provider-account-ux-tests-auditor.md:67`. Recommendation: split the bot-level provider state taxonomy and render one status band per state; disabled/needs-review must fail closed for runtime facts and must not be phrased as simply unmapped. Target part: admin DTO, page copy, loader tests.

6. Severity: MEDIUM. Identifier presentation is inconsistent and not yet a premium terminal-first identity model. Evidence: the user card shows Email, Roles, Registered, and Exchange keys at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:72` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:76` but no visible WTC user id; mapped provider identity is embedded in prose at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:107` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:110` and in the table at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:215` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:217`; the DTO exposes `providerAccountId` directly at `apps/web/src/features/admin/types.ts:51` to `apps/web/src/features/admin/types.ts:58`. Recommendation: create a compact read-only "Identity" strip/table with display name, email, visible user id, product, provider, pub_id, and state/source; decide explicitly whether full pub_id is intentionally visible to admins or should be shortened by default. Keep this identifier model separate from mutation controls and user-facing settings pages. Target part: admin list and detail identity UX.

7. Severity: PASS WITH RESIDUAL RISK. The loader and route are a good base for a separated admin read model, provided mutation controls are removed. Evidence: the route uses `requireUser()` and `assertAdmin()` before loading detail at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:24` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:29`; `apps/web/src/features/admin/queries.ts:171` to `apps/web/src/features/admin/queries.ts:176` delegates to the dedicated loader; the loader selects the target user without `passwordHash` at `apps/web/src/features/admin/user-bot-detail-loader.ts:140` to `apps/web/src/features/admin/user-bot-detail-loader.ts:154`, filters entitlements/instances/exchange/provider rows by target `userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:160` to `apps/web/src/features/admin/user-bot-detail-loader.ts:214`, and skips Legacy metrics unless the metric is tied to the active provider mapping at `apps/web/src/features/admin/user-bot-detail-loader.ts:280` to `apps/web/src/features/admin/user-bot-detail-loader.ts:285`. The PGlite loader test asserts no row-count mutation and no cross-user/raw secret leakage at `tests/integration/admin-user-bot-detail-loader.test.ts:236` to `tests/integration/admin-user-bot-detail-loader.test.ts:328`. Recommendation: preserve this dedicated admin loader path and do not fall back to product-scoped user bot read models for the drilldown. Target part: admin loader and route architecture.

## Decisions
1. Treat Phase 3.74 acceptance target as stricter than the current pre-existing implementation: `/admin/users/[userId]/bots` must be read-only, even if separate audited mapping actions exist elsewhere.
2. Do not recommend using user-facing settings forms/components in admin detail. Admin may reuse language/source concepts, but the admin route should render read-only summaries only.
3. Treat provider pub_id visibility as an explicit product/security decision: the objective wants admins to see pub_id, but the UI must keep full identity display separate from mutation and from public/user pages.
4. Preserve the dedicated target-user admin loader design; the main UX blockers are route controls, identifier presentation, source summary depth, state taxonomy, and tests.
5. No background agents were launched by this assigned single-auditor task; no background agents are running from this lane.

## Risks
1. If map/disable forms remain on the drilldown, the route cannot honestly be called a read-only bot statistics/settings/source/mapping view.
2. If tests continue expecting mapping actions on the drilldown, future patches may preserve the wrong UX contract.
3. Without visible user id and pub_id/mapping status on `/admin/users`, admins still have to click blindly by email/name and cannot scan the intended operational identifiers.
4. Without settings/source summaries, the admin detail answers "latest metric" and "mapping exists" but not "what settings/source does this user currently have."
5. Collapsed pending state can hide disabled or needs-review provider mappings, which is risky for operational triage and entitlement/fail-closed copy.
6. Full provider pub_id display may be acceptable for admins, but it needs a deliberate display policy and should not be mixed into prose beside mutation controls.

## Verification/tests
RUN in this audit:
1. Read binding docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, and `docs/handoffs/0000-orchestrator-seed.md`.
2. Read current status/implementation docs and latest relevant Phase 3.70-3.73/admin drilldown/provider-account handoffs.
3. `git status --short --branch` - observed pre-existing dirty/untracked files on `codex/bot-analytics-settings-canary-20260603`; no reverts performed.
4. Read-only source inspection with `rg`, line-numbered `Get-Content`, and file listing over the scoped admin pages, admin loader/actions/types/schemas, UI primitives, bot settings/statistics components, and focused tests.
5. No background agents were launched by this assigned audit lane, and no N-agent claim is made.

NOT RUN in this audit:
1. Product code/test edits - forbidden by user scope.
2. Vitest, typecheck, lint, build, Playwright, `check:core`, `secret:scan`, governance, and full/e2e gates - not run because this was an audit-only handoff with no product/test implementation change.
3. Dev server/browser visual QA - not run because the requested lane was source audit only and no live/prod probes were allowed.
4. Live bot start/stop/restart/apply-config/retest, worker ticks, live exchange ping, provider DB reads/mutations, SSH/tmux/systemd, `.env` reads/mutations, migrations, seeds, or managed real-DB gates - forbidden by scope and not run.

## Next actions
1. Remove mapping/disable forms and action imports from `/admin/users/[userId]/bots`; leave only read-only provider mapping status/table and links to separate admin workflows if approved.
2. Update `tests/integration/admin-user-bot-detail-static.test.ts` to forbid drilldown mutation controls and keep action tests in a separate provider-account admin workflow spec.
3. Extend `/admin/users` with visible user id and provider pub_id/mapping summary so the list supports admin scanning before click-through.
4. Extend `loadAdminUserBotDetailFromDb()` DTO with read-only settings/source summaries: config version, source kind, source warnings, operation/profile/symbol counts, and provider snapshot availability without raw config JSON.
5. Split provider state into `mapped_active`, `unmapped`, `mapped_disabled`, and `needs_review/ambiguous`; update page copy and PGlite/static tests for each state.
6. Run focused acceptance after implementation: `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-responsive.test.ts`, then web typecheck/lint/build and scoped admin Playwright desktop/mobile if UI changes.
