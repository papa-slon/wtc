# Handoff: ecosystem-product-architect (read-only audit)

_Epoch: 20260530-1625. Read-only audit of the WTC product operating model across all product areas. Feeds ROADMAP_MASTER.md + ACCEPTANCE_MATRIX_MASTER.md. No code or docs changed._

## Scope

Read-only audit of all product areas (Tortila bot, Legacy bot, Axioma terminal, TradingView indicators, Billing, Education/LMS, Admin console, User cabinet, Backtester, Club). Produce honest DONE/CURRENT/NEXT/BLOCKED/TARGET status per area; define MVP boundary and Definition of Done per product; identify open product decisions for the operator; note known doc drift to fix in Phase Group 1.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/MVP_SCOPE.md`
- `docs/SITEMAP.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md`
- `docs/BACKTESTER_DISTRIBUTION_PLAN.md`
- `docs/BOT_INTEGRATION_PLAN.md` (partial)
- `docs/EDUCATION_LMS_PLAN.md` (partial)
- `docs/TRADINGVIEW_ACCESS_PLAN.md` (partial)
- `docs/CONTRACTS/axioma-bridge.md` (partial)
- `docs/CONTRACTS/billing-webhooks.md` (idempotency section)
- `packages/bot-adapters/src/__fixtures__/tortila/` (fixture file count)

## Files changed

None — read-only audit.

## Findings

**1. [MEDIUM] IMPLEMENTED_FILES.md Persistence table still says "38 tables" — now 40.**
Evidence: `docs/IMPLEMENTED_FILES.md:107-108` — the Persistence table's row for `packages/db/src/schema.ts` reads "38 tables" and the Migration SQL row reads "3 migrations, 38 tables". Migration 0003 added 2 tables (`billing_webhook_events`, `billing_manual_review_items`). The aggregate handoff at `20260530-1355` explicitly confirmed 40 tables and `db:generate` returned 40. The Phase 2.4 block in the same file (line 8) correctly states 38→40, so both counts coexist in the same document; the Persistence table section has not been updated.
Recommendation: In Phase Group 1 (Foundation/Truth), update the Persistence table row to "40 tables" and the Migration SQL row to "4 migrations (0000–0003), 40 tables".
Target phase group: 1.

**2. [LOW] IMPLEMENTED_FILES.md documents "8 fixtures" for the Tortila adapter; 11 fixture files exist.**
Evidence: `docs/IMPLEMENTED_FILES.md:15` — "8 new" fixtures. Actual count in `packages/bot-adapters/src/__fixtures__/tortila/`: 11 JSON files (health.valid, health.down, health.malformed, summary.valid, summary.no_trades, summary.missing_field, equity.valid, equity.empty, equity.length_mismatch, trades_list.valid, trades_list.missing_fees). The aggregate Phase 2.4 handoff also says "8 fixtures" — the 3 error/edge-case files were added but not counted in the narrative.
Recommendation: Correct the count to 11 in IMPLEMENTED_FILES.md and in any STATUS.md narrative that repeats "8 fixtures". This is a truth/honesty issue, not a bug, but matters when the test-count claims in the aggregate cite a fixture count.
Target phase group: 1.

**3. [LOW] billing-webhooks.md section 1 summary table still names the dead table `webhook_idempotency_keys`.**
Evidence: `docs/CONTRACTS/billing-webhooks.md:21` — row "Idempotency store | WTC Platform — `webhook_idempotency_keys` table". A later section in the same doc (line 213) correctly states: "The `webhook_idempotency_keys` table name was an earlier design; the landed table is `billing_webhook_events`." The section-1 summary table was not updated when the design was superseded by migration 0003.
Recommendation: Update the section-1 row to "`billing_webhook_events` (migration 0003, UNIQUE provider+event_id)".
Target phase group: 1.

**4. [HIGH] Axioma terminal product area has no production path for ES256 signer, download proxy, or OTC account-link — all surface buttons are permanently disabled dev-placeholders.**
Evidence: `docs/STATUS.md` line 11 — "Axioma ES256 prod signer = TARGET"; `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` production blockers item 4; `docs/CONTRACTS/axioma-bridge.md` — real bridge endpoints not confirmed. The `/app/terminal` page renders all sections correctly but "Download", "Open Axioma Journal", and "Connect Axioma Account" are disabled with dev-placeholder labels. A commercial launch with this product area active would surface no actionable CTA.
Recommendation: Resolve in Phase Group 6. Requires operator to: (a) confirm `journal_server` endpoint shapes with the Axioma server operator, (b) provision a P-256 key for the ES256 signer, (c) confirm or implement the OTC link flow. These are external dependencies; block Phase Group 6 launch on them.
Target phase group: 6.

**5. [HIGH] Legacy bot adapter is BLOCKED with no resolution path currently in-scope — the product is visible to entitled users but shows no real data.**
Evidence: `docs/STATUS.md` — "legacy adapter BLOCKED (plaintext exchange keys upstream)"; `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` production blockers item 3 — "5 security gates NOT STARTED". The `/app/bots/legacy` dashboard renders with mock/simulated data and the "Simulated data" banner. An entitled user gets no real position/trade/equity data.
Recommendation: Phase Group 3 must produce an honest placeholder surface (not fake mock data) with a clear "service configuration in progress" state. The real adapter unblock requires: upstream plaintext-key fix by the legacy bot operator, service account design, and the 5 BOT_CONTROL_SAFETY_MODEL security gates. No timeline can be given until the upstream fix lands. Document this as a BLOCKED gate in the product status.
Target phase group: 3.

**6. [MEDIUM] Backtester product area is fully designed (BACKTESTER_DISTRIBUTION_PLAN.md complete) but the DB tables (`backtest_jobs`, `backtest_artifacts`) do not exist in any migration, and the local runner ZIP does not exist.**
Evidence: `docs/BACKTESTER_DISTRIBUTION_PLAN.md:§8` — "TARGET — NOT implemented. The backtest tables do not exist in `packages/db/src/schema.ts` yet." The `/app/bots/tortila/backtester` UI renders with the download button permanently disabled and the form stub present. No job creation is possible.
Recommendation: Phase Group 10 must make a hard explicit choice (real local-runner OR locked out-of-scope state). If the runner distribution decision is deferred beyond MVP, the UI must show a permanent "coming in a future release" card — not a form that implies the feature is one step away. The current partial state (form stub + disabled button) risks misleading users.
Target phase group: 10.

**7. [MEDIUM] TradingView access has two known post-Phase-2.4 items not yet resolved: `sweepTvExpiry` calls the non-atomic `revokeTv` (not `atomicRevokeTv`), and the admin queue N+1 for user emails (`listUsersWithEmailByIds`) is not yet added.**
Evidence: `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` Risks section — "`sweepTvExpiry` still calls the older `revokeTv`" and "TV admin queue has an N+1 enriching user emails (`listUsersWithEmailByIds` not yet added)". The `revokeReason` is persisted in the DB but not surfaced in the UI.
Recommendation: Phase Group 5 must close these three items (sweep atomicity, N+1 fix, revokeReason UI) as acceptance criteria for the TradingView area.
Target phase group: 5.

**8. [MEDIUM] Billing/Stripe checkout creation is TARGET — real subscription purchases are not possible. All entitlements are admin-granted.**
Evidence: `docs/STATUS.md` line 11 — "Stripe checkout = TARGET"; `docs/OPEN_QUESTIONS.md` Q-2 — billing provider not yet selected. The billing webhook reception is real (Stripe-Signature verified); the checkout creation path does not exist. No user can self-serve subscribe.
Recommendation: Phase Group 4 requires an operator decision on billing provider (Q-2) before implementation can begin. The chosen default (manual admin grant only) is a valid commercial launch state for a controlled rollout, but must be documented as such on the pricing and billing pages.
Target phase group: 4.

**9. [LOW] Education/LMS is functionally complete for MVP-core (courses/lessons/materials CRUD + enrollment/progress tracking — Phase 2.2 delivered full vertical). The remaining gap is the "rich LMS" columns (slug/level/tags/content_type/embed/file-meta/global-pinned/progress state-machine) planned for migration 0003-rich, which is still unstaged.**
Evidence: `docs/NEXT_ACTIONS.md` Phase 3 entry — "LMS migration 0003-rich (slug/level/tags/content_type/embed/file-meta/global-pinned/progress state-machine)". The current `enrollments`/`lesson_progress` schema is lean (no slug, no content_type enum, no file-meta). Teachers can create courses and lessons; students can access and mark progress. The gap is presentation-level richness (embed players, file-upload handling, slug URLs), not the access model.
Recommendation: Phase Group 7 implements the 0003-rich migration (bounded — no Phase-3 column is required for access control). File upload requires a separate security review before enabling. Club integration (Q-6) requires an operator decision before building pinned-links community surfaces.
Target phase group: 7.

**10. [MEDIUM] Real Postgres `db:migrate`/`db:seed` has never been run — the platform is not production-deployable and the migration 0003 tables have only been PGlite-tested, not proven against PostgreSQL 17.**
Evidence: `docs/STATUS.md` — "NOT RUN: db:migrate/db:seed/real-PG (no DATABASE_URL/Docker)"; `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` production blockers item 1. PGlite is not a substitute for real-PG acceptance; the concurrent-duplicate test for `billing_webhook_events` unique index has only been exercised in PGlite.
Recommendation: Phase Group 1 (Foundation/Real-DB) must provide a `DATABASE_URL` for a throwaway `wtc_test` DB (DB-name guard enforced) and run `db:migrate`/`db:seed`/real-PG harness as its primary gate.
Target phase group: 1.

**11. [LOW] Auth rate-limiting middleware is still pending — login/register endpoints have no IP-keyed rate limit enforced at the middleware layer (only the older in-app counter).**
Evidence: `docs/STATUS.md` "Still NOT deployable" section — "auth rate-limiting middleware"; `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` production blockers item 6. The rate-limit design is documented (F-AUTH-08) but the `apps/web/src/middleware.ts` implementation is not built.
Recommendation: Phase Group 11 (Security/rate-limiting) must build the IP-keyed middleware before the platform handles real traffic.
Target phase group: 11.

**12. [LOW] Club product area has no dedicated admin-managed pinned-links surface yet — the `/app/education` community links section shows static placeholder copy.**
Evidence: `docs/PRODUCT_BRIEF.md:§4.6` — "Telegram deep-link, social areas, and exclusive materials" are pinned_links; `docs/IMPLEMENTED_FILES.md` — `pinned_links` table exists (Phase 2.1) but the admin UI to manage them is not built. Club is upsold within the dashboard but no CTA has real targets.
Recommendation: Phase Group 7 or 8 (Education/Admin) must wire the `pinned_links` repos to the admin panel and to the club-entitled `/app/products` club card. Operator needs to decide Q-6 (club+education bundling) before building the entitlement flow.
Target phase group: 7.

## Decisions

1. **Backtester distribution model (Phase Group 10): operator must choose ONE of:** (a) ship the real local runner ZIP (requires Python packaging, code-signing, and artifact storage path), or (b) permanently lock the backtester UI to a "coming in a future release" card with no form stub. The current half-state (form stub + disabled button) is not a valid commercial launch state.

2. **Billing provider (Phase Group 4, Q-2): operator must select a provider** before real checkout can be built. Manual admin grant (`admin_grant`) is the valid default for controlled launch; the pricing page must make the purchase flow explicit (e.g., "contact us to subscribe" with a support ticket CTA) rather than rendering a checkout button that does nothing.

3. **Club + Education bundling (Q-6): operator decision required** before the `pinned_links` community surface is built and before the `/app/products` club card has meaningful CTAs.

4. **Axioma endpoint shapes (Phase Group 6): operator must coordinate with the Axioma/journal_server maintainer** to confirm endpoint shapes (health, entitlements, terminal downloads, OTC link) before any real bridge code can be written. The WTC ES256 signer (`@wtc/axioma-bridge`) is built and tested; the server-side consumer is not confirmed.

5. **Legacy bot upstream fix (Phase Group 3):** the legacy bot plaintext-key issue is an upstream blocker outside the WTC codebase. The operator must coordinate with the legacy bot operator to implement a service-account credential or key-rotation fix before the WTC adapter can go read-only real. WTC will never expose plaintext exchange keys as a workaround.

6. **Backtester artifact storage (Phase Group 10):** the `LocalFsStorage` design is in `BACKTESTER_DISTRIBUTION_PLAN.md`. For production the operator must decide local-fs vs S3-compatible before the tables are built (the storage adapter interface is already designed).

## Risks

1. **[HIGH] Axioma product area has no real CTAs at launch.** If the ES256/download/OTC dependencies are not resolved, the `/app/terminal` page is effectively a landing page with disabled buttons. Users with `axioma_terminal` entitlements get no operational value from WTC. Risk: churn and refund requests. Mitigation: surface an honest "Setup in progress — contact support for your download link" banner rather than silently-disabled buttons.

2. **[HIGH] Legacy bot BLOCKED indefinitely.** With 5 security gates unstarted and an upstream plaintext-key dependency, the legacy bot adapter has no near-term unblock path. Risk: entitled `legacy_bot` users see only mock/simulated data. Mitigation: render an honest "data not yet available — live adapter pending" state rather than the mock simulated-data banner, which implies live data is possible soon.

3. **[MEDIUM] Real-PG has never run against migration 0003.** The `billing_webhook_events` concurrent-duplicate constraint is only PGlite-tested. A real-PG deployment could surface migration errors or constraint behaviour differences. Mitigation: Phase Group 1 must run `db:migrate` against a `wtc_test` DB before any production deployment.

4. **[MEDIUM] Backtester form stub creates false expectation.** A user with `tortila_bot` entitlement who clicks through to the backtester sees a populated config form with a disabled "Download local runner" button and no explanation of when it will be available. This is misleading. Mitigation: Phase Group 10 decision (real runner or locked card) and update the UI accordingly.

5. **[MEDIUM] Billing is admin-grant-only.** No self-serve purchase path exists. This is acceptable for a controlled launch but requires the pricing page and billing page to make the purchase process explicit. Mitigation: Phase Group 4 — ensure `/pricing` has a clear "how to subscribe" CTA (support ticket or contact form) and not a checkout button stub.

6. **[LOW] KEK env-var custody.** The `SECRET_VAULT_KEK` is in env vars. Acceptable for pre-production but Q-11 must be resolved (KMS/Vault migration) before the platform stores real user exchange keys at scale. Mitigation: Phase Group 11 and the Phase 3 hard gate documented in OPEN_QUESTIONS.md Q-11.

## Verification/tests

This is a read-only audit. No tests were run. Gate status as inherited from Phase 2.4 (last verified run):
- governance:check PASS (18 cited handoffs)
- test 238/5 PASS, e2e 34/34 PASS, build 53 routes PASS
- coverage 24.94% stmts / 70.77% branch
- db:migrate / db:seed / real-PG — NOT RUN (no DATABASE_URL)

## Next actions

1. **Phase Group 1 (Foundation/Truth)** — fix the three known doc drifts (Findings 1, 2, 3): IMPLEMENTED_FILES.md "38 tables" → "40 tables" + "8 fixtures" → "11 fixtures"; billing-webhooks.md section-1 row `webhook_idempotency_keys` → `billing_webhook_events`. Run `db:migrate`/`db:seed`/real-PG harness against `wtc_test` DB (Finding 10).

2. **Phase Group 4 (Billing)** — operator must select billing provider (Q-2) and update pricing/billing page CTAs to be honest about the purchase path (manual admin grant = "contact us" CTA, not a checkout stub).

3. **Phase Group 5 (TradingView)** — close the three Phase 2.4 tracked items: `sweepTvExpiry` → `atomicRevokeTv`; `listUsersWithEmailByIds` N+1 fix; `revokeReason` surfaced in admin TV queue UI.

4. **Phase Group 6 (Axioma)** — operator coordinates with Axioma/journal_server maintainer to confirm endpoint shapes and provision ES256 key. Block this phase group's "real CTAs" gate on those confirmations. In the interim, replace the silently-disabled Download/Open-Journal buttons with an honest "contact support for access" message.

5. **Phase Group 3 (Legacy bot)** — build an honest disabled state (not mock data) for the legacy bot dashboard. Document the upstream plaintext-key blocker explicitly in the UI. Track the 5 BOT_CONTROL_SAFETY_MODEL gates as a prerequisite.

6. **Phase Group 10 (Backtester)** — operator decides: real local runner OR permanently locked card. Either outcome: update the `/app/bots/tortila/backtester` UI to match the decision; do not leave the form-stub + disabled-button half-state as the shipped state.

7. **Phase Group 7 (Education/LMS)** — stage the 0003-rich migration (slug/level/tags/content_type/embed). Wire `pinned_links` admin UI for club surface. Operator decides Q-6 (club bundling) first.

8. **Phase Group 11 (Security)** — auth rate-limiting middleware (`apps/web/src/middleware.ts`, IP-keyed, login/register). Plan Q-11 KMS/Vault migration as a Phase 3 hard gate before real user exchange keys at scale.
