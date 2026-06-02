# docs-drift-fixer handoff

_2026-05-29. Part B — docs/contract drift remediation. Applied DRIFT-01 … DRIFT-09 from the
docs-contracts-drift audit (`docs/handoffs/20260529-1921-docs-contracts-drift-auditor.md`)._

## Scope

PART B — docs/contract drift only. Edit ONLY the 9 scoped docs + this handoff. Surgical edits:
locate each target by quoted text, change only what each finding requires, preserve surrounding
wording/headings/formatting. Did NOT touch STATUS.md, NEXT_ACTIONS.md, IMPLEMENTED_FILES.md,
AGENTS.md, or any code/persistence/TradingView/CI status wording the auditor confirmed honest.

## Files inspected

Ground truth: `AGENTS.md`; `docs/handoffs/0000-orchestrator-seed.md`;
`docs/handoffs/20260529-1921-docs-contracts-drift-auditor.md` (audit source).
Code/fact confirmations (read-only): `apps/web/src/app/api` → **does not exist**;
`apps/web/src/lib/backend.ts` → exists; `apps/web/src/lib/demo.ts` → exists;
`docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` → exists; `packages/axioma-bridge/src/handoff.ts:4-8,59`
→ HS256 dev stub, production must be ES256/JWKS; `packages/config/src/env.ts:25`
→ `z.enum(['mock','read-only','audited']).default('mock')` (no `real`); `.github/workflows` → absent.

## Files changed

1. `docs/CONTRACTS/tortila-adapter.md`
2. `docs/CONTRACTS/legacy-bot-adapter.md`
3. `docs/ARCHITECTURE.md`
4. `docs/BACKTESTER_DISTRIBUTION_PLAN.md`
5. `README.md`
6. `docs/DEPLOYMENT.md`
7. `docs/CONTRACTS/axioma-bridge.md`
8. `docs/BOT_CONTROL_SAFETY_MODEL.md`
9. `docs/CONTRACTS/billing-webhooks.md`
10. `docs/handoffs/20260529-1921-docs-drift-fixer.md` (this file)

## Findings (what I changed + evidence file:line)

**DRIFT-01 — tortila-adapter.md: replaced every `BOT_ADAPTER_MODE=real` and bare `real` table cell
with the correct enum.** The enum is `mock | read-only | audited` (no `real`). All hits here are
read-live-data contexts (read-only consumer adapter), so all → `read-only`:
- `:6` Status — "Real adapter reads from live journal when `BOT_ADAPTER_MODE=read-only`."
- `:42` network boundary — "before `BOT_ADAPTER_MODE=read-only` is used."
- `:420-421` Mock-vs-Real table — Staging/Production cells `real` → `read-only`.
- `:423` Phase gate — "`BOT_ADAPTER_MODE=read-only` must not be set …".
- `:434` tests gate — "before setting `BOT_ADAPTER_MODE=read-only` …".
Confirmed zero remaining `BOT_ADAPTER_MODE=real` and zero `| \`real\`` table cells. Remaining `real`
substrings are English words only ("realized_pnl", "unrealized", "realistic", "real endpoint shapes"
/"real responses" test names) and the section heading "Mock vs. Real Status" — intentionally left.

**DRIFT-02 — legacy-bot-adapter.md: same substitution.** All read-live-data contexts → `read-only`:
- `:382` — "before WTC enters production with `BOT_ADAPTER_MODE=read-only`."
- `:391-392` Mock-vs-Real table — Staging/Production `real` → `read-only`.
- `:394` Phase gate — "`BOT_ADAPTER_MODE=read-only` for the legacy bot requires:".
- `:409` tests gate — "before setting `BOT_ADAPTER_MODE=read-only`.".
Confirmed zero remaining adapter-mode `real`. Remaining hits are English/heading/test-name only
(`:6` "Real adapter" prose noun, `:247/:278` "unrealizedPnl", `:257` "real-time", `:386` "Mock vs.
Real Status" heading, `:436` "real auth flow" test name).

**DRIFT-03 — ARCHITECTURE.md §4 relabelled TARGET/FUTURE; route table preserved.**
- `:177` lead rewritten: "**TARGET (planned), not current.** There is no `apps/web/src/app/api/`
  directory today; the app currently uses server actions plus the `apps/web/src/lib/backend.ts`
  selector. The table below is the planned REST surface …" + a follow-on sentence reframing the
  route design as planned. The ~50-row endpoint table is intact (verified `POST /api/auth/login`
  row still present).
- `:235` added a matching "**TARGET (planned), not current.**" banner above the billing-webhook
  route note. Note text itself unchanged.

**DRIFT-04 — BACKTESTER_DISTRIBUTION_PLAN.md:552 prefixed.**
"TARGET (not yet implemented): All routes are in `apps/web/src/app/api/bots/[bot]/backtest/`."

**DRIFT-05 — README.md run flow: in-memory default added; docker/db marked OPTIONAL.**
- `:46-50` new note block: "**The app boots on an in-memory demo backend by default (no DB needed)**
  … The `docker compose` / `db:migrate` / `db:seed` lines below are the **OPTIONAL real-Postgres
  path** … Docker is **not installed on this host**; a native **PostgreSQL 17** also works via
  `DATABASE_URL` …".
- Inline-annotated the `docker compose`, `db:migrate`, `db:seed` lines each with
  "OPTIONAL (real-Postgres path)" and the Docker-not-installed / native-PG-17 caveat.

**DRIFT-06 — DEPLOYMENT.md local-dev recipe: in-memory note echoed ABOVE recipe; docker line optional.**
- `:8` new note above the code block (in-memory default; docker/db optional Postgres-only; Docker
  not installed; native PostgreSQL 17 on `127.0.0.1:5432` via `DATABASE_URL`).
- `:19` docker line annotated "OPTIONAL (Postgres path only) … Docker not installed here, native
  PostgreSQL 17 via DATABASE_URL also works".
- Existing in-memory note further down (now `:38`) intentionally retained (it carries the
  `apps/web/src/lib/demo.ts` → `@wtc/db` swap detail); the instruction said "Move/echo", so it is
  echoed above.

**DRIFT-07 — axioma-bridge.md:507 stale "spec not yet written" corrected.**
Row now: "Contract defined; HS256 dev-stub signer implemented | Handoff token spec **is written**
(`AXIOMA_HANDOFF_TOKEN_SPEC.md`, ES256); an **HS256 dev-stub signer is implemented** in
`packages/axioma-bridge/src/handoff.ts`. Only the ES256/JWKS **production** signer is not yet
implemented." Confirmed the stale "not yet written" string is gone.

**DRIFT-08 — axioma-bridge.md:3 Status header amended** to exactly:
"Phase 1 — contract defined; mock bridge + HS256 dev-stub handoff implemented; ES256/JWKS production
signer and real read-only endpoints pending."

**DRIFT-09 — CI claims softened to "(CI pipeline pending; today local gates pass)".**
- `docs/BOT_CONTROL_SAFETY_MODEL.md:148` "All tests green in CI." → "All tests green in CI (CI
  pipeline pending; today local gates pass)." (checklist item under a `Status: NOT STARTED` gate).
- `docs/CONTRACTS/billing-webhooks.md:318` (checklist `- [ ]` item) "All required tests below
  passing in CI" → "… in CI (CI pipeline pending; today local gates pass)".
- `docs/CONTRACTS/billing-webhooks.md:351` (directly related prose) "must pass in CI before any
  production wiring." → "must pass in CI (CI pipeline pending; today local gates pass) before any
  production wiring."

## Decisions

- **DRIFT-01/02 mode choice:** every adapter-mode hit in both contracts is a context about reading
  live data via a read-only consumer adapter, so all → `read-only` (the audit reserved `audited`
  for live-control/mutation contexts; none of these hits are control/mutation, so `audited` was not
  needed in these two files). Section heading "Mock vs. Real Status" left intact (heading, not a
  mode value) per the "preserve headings" rule.
- **DRIFT-09 / billing-webhooks.md exact-string note:** the literal phrase "All tests green in CI"
  does **not** occur in billing-webhooks.md. The file's nearest equivalents are the checklist item
  at `:318` and the prose at `:351`. Since billing-webhooks.md is explicitly in DRIFT-09 scope and
  the auditor's Finding 9 names both lines, I softened both with the same parenthetical rather than
  fabricating the missing exact string. (Honesty note: target string absent → softened the real
  equivalents instead.)
- **DEPLOYMENT.md "Move/echo":** chose to *echo* (duplicate) the in-memory note above the recipe and
  keep the original below, because the original also documents the `demo.ts`→`@wtc/db` swap that
  belongs after the recipe. No information lost.

## Risks

- Low. All changes are documentation-only; no code touched. Labels now match the `mock|read-only|
  audited` enum, removing the deploy-time risk of an operator setting the invalid `=real` value.
- The auditor's handoff file still contains `BOT_ADAPTER_MODE=real` strings — that is correct (it is
  quoting the drift it found) and out of my scope; I did not and must not edit it.
- DEPLOYMENT.md now has the in-memory note twice (intentional echo). If a future editor wants a
  single source, they can drop the lower copy — but that copy still holds the demo.ts swap detail.

## Verification/tests

Re-grep after edits (all in-scope files):
- `grep -rn "BOT_ADAPTER_MODE=real" docs/CONTRACTS/tortila-adapter.md docs/CONTRACTS/legacy-bot-adapter.md`
  → **no matches** (exit 1). `grep '| \`real\`'` on both → no matches. `BOT_ADAPTER_MODE=read-only`
  count = 4 (tortila) + 3 (legacy).
- ARCHITECTURE.md: two "TARGET (planned), not current" banners at `:177` and `:235`; route table
  preserved (`POST /api/auth/login` row present).
- BACKTESTER:552 prefix present.
- README: "in-memory demo backend by default" present; 3× "OPTIONAL (real-Postgres path)";
  Docker-not-installed note present.
- DEPLOYMENT: in-memory note at `:8` (echoed) + `:38` (original); "OPTIONAL (Postgres path only)"
  on the docker line at `:19`.
- axioma-bridge: `:3` new Status header; `:507` rewritten; stale "not yet written" → **gone** (exit 1).
- CI softening string present at BOT_CONTROL_SAFETY_MODEL.md:148 and billing-webhooks.md:318,351.
- Whole-tree sweep `grep -rn "BOT_ADAPTER_MODE=real" docs/ README.md` → only hits are inside the
  read-only auditor handoff (expected; out of scope).
No build/test run (docs-only change).

## Next actions

- None required for this Part-B fix set. Optional future cleanup: collapse the two DEPLOYMENT.md
  in-memory notes into one if a single source is preferred.
- When the ES256/JWKS production handoff signer lands, update axioma-bridge.md `:3` and `:507` again
  to drop "pending".
- When `.github/workflows` is added, the DRIFT-09 "(CI pipeline pending; today local gates pass)"
  parentheticals can be removed.
