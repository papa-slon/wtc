# ecosystem-backtester-architect handoff

**Epoch:** 20260530-0126  
**Agent:** ecosystem-backtester-architect  
**Phase:** 2 — Backtester design (Part 2: distribution model, 0002 recommendation, page content model)

---

## Scope

Own and update the backtester design in response to Phase 2 requirements:

(a) Local runner download + launch distribution model — how a user gets and runs the Tortila backtester locally; WTC provides the package and instructions; no execution in WTC.  
(b) Job/result schema + DB migration recommendation — whether `backtest_jobs`/`backtest_results` land in db-architect's migration `0002` or remain a `packages/backtester` type-model only this session.  
(c) Artifact storage approach — no real object storage yet; interface/stub design.  
(d) Page content model — clearly-labelled disabled download/launch, "not available for Legacy" treatment, and what real results WOULD show.

WAVE-1 RULES applied: DESIGN ONLY — edits only to `BACKTESTER_DISTRIBUTION_PLAN.md`, `CONTRACTS/backtester-runner.md`, and this handoff. No code or shared files edited.

---

## Files inspected

| File | Notes |
|------|-------|
| `docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions, table groups, hard rules |
| `docs/SESSION_PROTOCOL.md` | Process governance |
| `docs/BACKTESTER_DISTRIBUTION_PLAN.md` | Existing Phase 0 design (full read) |
| `docs/CONTRACTS/backtester-runner.md` | Existing Phase 0 contract (full read) |
| `docs/handoffs/20260529-phase0-ecosystem-backtester-architect.md` | Phase 0 handoff |
| `docs/handoffs/20260529-phase0-ecosystem-db-architect.md` | DB migration history and decisions |
| `docs/handoffs/20260529-2352-phase-1-7-part-e-tv-lms-persistence.md` | Phase 1.7 state (migrations 0000, 0001 exist; 0002 not yet created) |
| `packages/backtester/src/index.ts` | Current type-model only package |
| `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` | Existing backtester page |
| `packages/db/src/schema.ts` | Full schema; confirms no `backtest_jobs`/`backtest_artifacts` tables |
| `packages/db/migrations/0000_broken_jack_murdock.sql` | Migration 0000 exists |
| `packages/db/migrations/0001_early_toad_men.sql` | Migration 0001 exists (entitlements unique index) |
| `docs/ARCHITECTURE_DECISIONS.md` | ADR log |
| `C:\Users\maxib\GTE BOT\bot_tortila\backtest\engine.py` | Tortila engine shape (BacktestConfig, Fill, etc.) — read-only |
| `C:\Users\maxib\GTE BOT\bot_tortila\old_bot_backtest\dca_engine.py` | Legacy DCA engine shape — read-only |

---

## Files changed

| File | Change |
|------|--------|
| `docs/BACKTESTER_DISTRIBUTION_PLAN.md` | Updated status line and §1 scope (Tortila-only explicit; Legacy = no backtester); added §16 Phase 2 distribution model (runner ZIP design, artifact store stub, disabled-button rule); added §17 Page content model (state matrix A–F, Legacy card wording, empty state rules, entitlement-locked state) |
| `docs/CONTRACTS/backtester-runner.md` | Bumped contract version 1.0.0 → 1.1.0; updated status line; updated mock/real table (runner-download returns 404 `NO_RUNNER_AVAILABLE`, Legacy route row added); resolved Phase 0 open question #6 (token placement — `Authorization: Bearer` is already correct; Phase 0 handoff warning was residual); added open question #6 as closed item; artifact storage open question #3 updated to reflect local-fs stub decision |

---

## Findings

1. **Severity: observation.** The existing `packages/backtester/src/index.ts` defines a `BacktestParams` type with a `system: string` field (`'turtle'`). The full design in `BACKTESTER_DISTRIBUTION_PLAN.md` §5.1 uses `system: 1 | 2` (integer) matching the Python engine's `BacktestConfig.system`. These are inconsistent. When the package is scaffolded in Phase 6, the Zod-validated schemas in `BACKTESTER_DISTRIBUTION_PLAN.md §5` are authoritative; the stub types in `index.ts` will be replaced. No code change needed in this session (WAVE-1 design only). Noted for Phase 6 implementer.

2. **Severity: observation.** The existing page `page.tsx` has a "System" select with value `"turtle"` (a string label). When the real form is built, `system` must be `1` or `2` (integer), matching the `TortilaJobParamsSchema`. The page is a stub — no fix needed this session.

3. **Severity: observation.** The Phase 0 handoff listed "Upload token theft (URL logged by proxy)" as a P1 risk, which implied the token might be in the URL. The contract already specifies `Authorization: Bearer` header throughout (§3.1, §11). This contradiction is now explicitly closed in contract open question #6. The spec is correct.

4. **Severity: design gap resolved.** The existing documents were silent on what happens to `/app/bots/legacy/backtester`. The existing page code already handles `bot === 'legacy'` with a locked card, but used "coming soon" language implying future availability. Phase 2 design (§17.2) replaces this with a permanent "not available for this bot" wording, consistent with the hard boundary that `legacy_bot` has no backtester.

5. **Severity: observation.** No `backtest_jobs` or `backtest_artifacts` tables exist in `packages/db/src/schema.ts` or in migrations 0000/0001. This is consistent with the TARGET label in the plan. See 0002 recommendation below.

---

## Distribution model

The local runner is a **ZIP archive** served via a platform-generated signed URL (local filesystem in MVP, S3-compatible interface stub available for production). Users require Python 3.11+.

Distribution steps:
1. User creates a job in the browser (POST to platform API → returns `job_id` + `upload_token`).
2. User requests a signed runner download URL (GET runner-download → 15-min signed URL).
3. User downloads the ZIP, installs dependencies (`pip install -r requirements.txt`).
4. User runs `download_ohlcv.py` (public BingX endpoints, no exchange keys).
5. User runs `run.py --job <id> --token <token>` → produces `result.json`.
6. User runs `upload.py` or passes `--auto-upload` flag.
7. Platform validates artifact schema, stores it, sets `status=done`.
8. Browser polls, fetches signed artifact URL, renders charts.

**Download is DISABLED** in the current UI. The button exists in the DOM in `disabled` state with a descriptive `title`. No endpoint is called on click. This will remain until a real runner ZIP is produced and the `GET /runner-download` endpoint returns a real URL.

The runner ZIP ships:
- `run.py` + `upload.py` + `download_ohlcv.py`
- `engine/tortila_engine.py` — vendored copy of `backtest/engine.py` with all live `turtle_bot.*` imports removed; indicator functions inlined
- `requirements.txt` (numpy, pandas, ccxt, requests)
- `LICENSE` + `CHECKSUMS.sha256`

No exchange authentication code is in the runner. The `download_ohlcv.py` helper uses public OHLCV endpoints only.

---

## Job/result schema + 0002 recommendation

**Recommendation: DO NOT add `backtest_jobs`/`backtest_artifacts` to migration 0002 this session.**

Rationale:

1. **No consumer exists yet.** The `packages/backtester` package is a type-model stub (`index.ts` has 70 lines of in-memory types). There is no repository layer, no Drizzle table definition, and no route handler that queries these tables. Adding the migration without the consumer creates a schema/code gap that is worse than deferring.

2. **Migration 0002 has not been created yet.** Migrations 0000 and 0001 exist on disk. Migration 0002 would need to be authored by db-architect in the context of their full `packages/db/src/schema.ts` work. Backtester-architect should not create a partial migration that the db-architect must then reconcile.

3. **Type-model-only is sufficient for this session.** The job model (`BacktestJob`, `BacktestJobStatus`, `BacktestArtifact`) and the full Zod schemas are fully specified in `BACKTESTER_DISTRIBUTION_PLAN.md §9` and `CONTRACTS/backtester-runner.md §5`. These can be implemented in `packages/backtester` without any DB tables existing, using the `createMemoryBacktestStore()` pattern already present in `index.ts`.

4. **When to add 0002:** When Phase 6 scaffolds `packages/backtester` with real CRUD functions that query Postgres, db-architect should add `backtest_jobs` and `backtest_artifacts` to `packages/db/src/schema.ts` and run `drizzle-kit generate` to produce migration 0002 (or append to a combined 0002 if other tables are being added at the same time). The table DDL is fully specified in `BACKTESTER_DISTRIBUTION_PLAN.md §8` and is ready to be copied into the schema file.

5. **Bounded context:** The tables belong in the `Ops` group alongside `job_queue` and `audit_logs`, per the seed and the Phase 0 db-architect decision. They are NOT in the `Bots` group (which holds live trading state). This separation must be preserved when migration 0002 is authored.

**Coordination signal to db-architect (via this handoff):** When you create migration 0002, please include `backtest_jobs` and `backtest_artifacts` as defined in `BACKTESTER_DISTRIBUTION_PLAN.md §8`. The schema is stable and will not change before Phase 6.

---

## Page content model

Summarized from `BACKTESTER_DISTRIBUTION_PLAN.md §17`:

**Route behaviour:**
- `/app/bots/tortila/backtester` — full Tortila backtester (entitlement-gated).
- `/app/bots/legacy/backtester` — permanent "not available for this bot" card; no form, no job, no runner download, no "coming soon" language.
- Any other `[bot]` slug — `notFound()`.

**Tortila states:**
- Entitlement denied → warning banner + upgrade CTA only.
- No jobs → parameters form (enabled) + disabled download button + empty results.
- Job queued → status card + runner instructions (with disabled download button) + cancel link + empty results.
- Job running → status card (amber badge) + empty results.
- Job failed → status card (red badge) + error message + "Try again" link + empty results.
- Job done → status card (green badge) + full results: MetricsGrid, EquityCurveChart (gold, log-scale toggle), MonthlyPnLGrid, TradeScatterChart, PerSymbolTable, TradeListTable.
- Done but artifact still loading → spinner only (no partial content).

**Hard rules (non-negotiable):**
- No chart or metric renders without a validated artifact on disk.
- No interpolated, estimated, or placeholder numbers at any point.
- `num_trades === 0` → explicit "no signals generated" message; no equity curve.
- The "Download local runner" button remains `disabled` (DOM attribute, no click handler) until a real runner ZIP exists and the endpoint returns a real URL.

---

## Decisions

1. **Tortila-only scope confirmed.** The backtester is for `tortila_bot` only. `legacy_bot` renders a permanent "not available" card. The `legacy_dca` artifact schema and engine definitions remain in the codebase for potential future use but are not exposed to users.

2. **Download button: permanently disabled until runner ZIP exists.** Not a loading state, not a 404 — the button is `disabled` with a descriptive title. This prevents a user from clicking and receiving a confusing error.

3. **Artifact store: local filesystem stub behind `ArtifactStorage` interface.** `LocalFsStorage` is the default. `S3Storage` stub exists but throws `NotImplementedError`. Selected by `ARTIFACT_STORE` env var.

4. **DB migration: deferred to Phase 6.** `backtest_jobs` and `backtest_artifacts` do not go into any migration this session. The full DDL is specified and stable; db-architect should include it in migration 0002 when Phase 6 scaffolds the package.

5. **Token placement: `Authorization: Bearer` header confirmed.** The Phase 0 handoff's residual "query param" risk note is closed. `§3.1` of the contract is authoritative and was always correct.

6. **Legacy "not available" wording.** The existing page used "coming soon" language. Phase 2 design removes that implication. The card states a product boundary, not a roadmap promise.

---

## Risks

| Risk | Severity | Status |
|------|----------|--------|
| Runner not yet built — users cannot complete the flow end-to-end | P0 | Mitigated by disabling the download button and showing clear instructions for when the runner is available; users are not silently blocked with a 404 |
| Artifact store local filesystem not suitable for multi-server production | P1 | Mitigated by `ArtifactStorage` interface — S3Storage can be wired without changing call sites |
| `packages/backtester/index.ts` stub types conflict with full schema (system: string vs int) | Low | Noted; Phase 6 implementer must replace stub types with Zod-generated TypeScript. No impact until Phase 6 |
| db-architect not aware that backtester tables need to land in migration 0002 | P1 | This handoff is the coordination signal; see "0002 recommendation" section |
| DCA open-at-end positions (misleading metrics) | P0 (DCA-only) | DCA not user-accessible; mandatory warning documented for if/when it is enabled |

---

## Verification / tests

No tests are produced this session (WAVE-1 design only). Required tests before production wiring are specified in `CONTRACTS/backtester-runner.md §12` (9 unit, 9 integration, 5 E2E, 5 runner CLI pytest tests). No test execution is claimed.

Gates: NOT RUN (design-only session; no code scaffolded; no DB; no runner).

---

## Next actions

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | Phase 6: scaffold `packages/backtester` with Zod schemas, job CRUD, token generation, artifact validation, `ArtifactStorage` interface + `LocalFsStorage` implementation | backtester-implementer |
| P0 | Phase 6: implement all route handlers under `apps/web/src/app/api/bots/[bot]/backtest/` | backtester-implementer |
| P0 | Phase 6: update `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` to match Phase 2 page content model (§17) — replace stub form/buttons with real state machine rendering | frontend-implementer |
| P0 | db-architect: when creating migration 0002, include `backtest_jobs` and `backtest_artifacts` tables per `BACKTESTER_DISTRIBUTION_PLAN.md §8` in the `Ops` context | db-architect |
| P1 | Build runner ZIP (`wtc-backtester-1.0.0.zip`): vendor `tortila_engine.py`, write `run.py`/`upload.py`/`download_ohlcv.py`, test on Windows + macOS + Linux | backtester-implementer / devops-implementer |
| P1 | Enable download button in UI once a real runner ZIP URL is available (flip disabled → enabled; wire `GET /runner-download` endpoint) | frontend-implementer |
| P1 | devops-implementer: decide artifact storage backend for production (local filesystem vs S3-compatible); wire `ARTIFACT_STORE` env var | devops-implementer |
| P2 | product-architect: decide OHLCV pre-caching vs user-run download step (OPEN_QUESTIONS item) | product-architect |
| P2 | Phase 7: build and sign runner ZIP; set up runner release pipeline | devops-implementer |
