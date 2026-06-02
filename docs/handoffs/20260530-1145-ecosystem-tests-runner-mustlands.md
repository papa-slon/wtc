## Scope

Phase 2.3 must-lands tests-runner: add focused integration tests for billing webhook logic (BW-001 through BW-004) and LMS repo audit-correctness fixes (F-02, F-03, F-04), then run the scoped gate suite and record each result.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md` — entitlement state machine, RBAC, hard rules.
- `packages/billing/src/stripe.ts` — `createStripeProvider`, `parseWebhook` (verify-first, returns null on bad sig).
- `packages/billing/src/webhook.ts` — `signWebhook`, `verifyWebhookSignature`, `mapProviderEvent` (HMAC-SHA256, Stripe t=,v1= scheme, constant-time, timestamp tolerance).
- `packages/billing/src/provider.ts` — `createMockBillingProvider`, `createBillingProvider`.
- `packages/billing/src/index.ts` — public exports confirm `signWebhook`, `createStripeProvider`.
- `packages/db/src/repositories.ts` — `applyStripeEvent` (~line 932): idempotency via `audit_logs` ledger (`billing.webhook_received` + targetId=stripeEventId); `upsertEnrollment` (~line 688): `actorUserId` param threads into audit row; `markEnrollmentComplete` (~line 705): selects enrollment.id inside txn, uses it as audit targetId; `createCourse` (~line 368): optional `teacherProfileId` in INSERT values; `listProductAccessEvents` (~line 810); `grantProduct` (~line 128); `getCourseById` (~line 412) returns raw `CourseRow` with `teacherProfileId`.
- `packages/db/src/schema.ts` — `courses.teacherProfileId` field (~line 177): `uuid('teacher_profile_id').references(() => teacherProfiles.id)` (nullable).
- `packages/db/src/index.ts` — `export * from './repositories.ts'` confirms all needed exports available.
- `tests/integration/db-0002.test.ts` — PGlite harness pattern (migDir, drizzle cast, seedDatabase, createUser).
- `tests/integration/lms-service.test.ts` — LMS PGlite pattern, existing coverage.
- `packages/billing/src/stripe.test.ts` — existing BW-002/003 unit tests at package level (tampered body, wrong secret — confirmed passing).
- `.secretlintrc.json` — `@secretlint/secretlint-rule-preset-recommend` (no custom rules).
- `.secretlintignore` — test files not excluded; checked that `whsec_testfake` passes (short, obviously-fake).

## Files changed

- `tests/integration/billing-webhook.test.ts` — ADDED (new file).
- `tests/integration/lms-fixes.test.ts` — ADDED (new file).
- `docs/STATUS.md` — UPDATED: Phase 2.3 section prepended with gate table + real-vs-mocked tally update.

## Findings

**BW-001**: `applyStripeEvent` with `billingEvent='payment_succeeded'` and `productCodes=['axioma_terminal']` writes an entitlement row (`status=active`) and a `product_access_events` row (`toState='active'`, `actorType='billing_webhook'`). `hasAccess` returns true. All confirmed in PGlite.

**BW-002/003**: `createStripeProvider.parseWebhook` returns `null` for a tampered body (HMAC no longer matches) and for a wrong-secret signature. These cases were already covered by existing `packages/billing/src/stripe.test.ts` at the package level; the integration tests in `tests/integration/billing-webhook.test.ts` re-verify them using the same `signWebhook`/provider path in the integration context.

**BW-004**: Duplicate `stripeEventId` replay: `applyStripeEvent` finds the prior `billing.webhook_received` audit row, returns `{applied:false, productsChanged:0}`, and writes no second `product_access_events` row. Confirmed by counting PAE rows before and after replay.

**F-02**: `upsertEnrollment` with an explicit `actorUserId=adminId` (trailing optional param) results in an `education.enrolled` audit row whose `actorUserId` is the admin id — not the enrolled student. Self-enroll (no actorUserId) retains the student as actor. Both paths confirmed.

**F-03**: `markEnrollmentComplete` selects the enrollment row inside the transaction (repositories.ts:712) and uses its `id` as the audit `targetId`; `targetType` is `'enrollment'`. Confirmed the targetId is the enrollment.id and NOT the courseId.

**F-04**: `createCourse` with `teacherProfileId` set produces a `courses` row where `getCourseById` returns `teacherProfileId` equal to the supplied profile id. Without `teacherProfileId` the column is `null`.

**Secret safety**: Test secret `whsec_testfake` is intentionally short (14 chars after `whsec_`) and obviously synthetic. `secretlint` with the recommend preset did not flag it (confirmed by running `npm run secret:scan` after adding the files). The existing `packages/billing/src/stripe.test.ts` uses `whsec_test_secret_value_1234567890` (also passes secretlint) — the shorter form is equally safe.

**No plaintext secrets in fixtures**: The test events log only `eventId` (e.g. `evt_bw_checkout_001`) and type strings. No raw body, no signing secret, no userId from real users is ever persisted.

## Decisions

- Placed tests in `tests/integration/` (the task's OWNED FILES scope), not in `packages/*` source trees.
- Used the established PGlite harness pattern from `db-0002.test.ts` verbatim (migDir from `process.cwd()`, `drizzle(pg, { schema }) as unknown as Db`, `seedDatabase`, `createUser`).
- Named the billing test file `billing-webhook.test.ts` (not a sub-file of an existing one) to make the four BW cases clearly attributable.
- Named the LMS fixes file `lms-fixes.test.ts` (not extending `lms-service.test.ts`) because the F-02/03/04 correctness assertions are conceptually distinct from the Phase 2.2 LMS surface tests.
- Used `whsec_testfake` as the test HMAC secret — short, obviously-fake, not a real credential shape.
- Did NOT run `npm run e2e` or `npm run coverage` (operator instruction: those run in the final wave only).

## Risks

- `whsec_testfake` passes secretlint today; if the rule preset is upgraded to flag all `whsec_` prefixed strings regardless of length, the test file would need a secretlint-disable comment or a rename.
- The `5 skipped` tests in `db-real-postgres.test.ts` require `REAL_POSTGRES_DATABASE_URL` — not a concern for this wave.
- No e2e run this wave — the billing webhook route handler itself is excluded from Vitest and not e2e-smoked here; that remains for the final wave.

## Verification/tests

All commands observed (no inferred results):

| Gate | Command | Observed Result |
|------|---------|----------------|
| governance:check | `npm run governance:check` | PASS — 0 errors, 1 allowlisted warning (20260529-1921 historical drift) |
| lint | `npm run lint` | PASS — exit 0, no output |
| typecheck | `npm run typecheck` | PASS — exit 0, no output |
| typecheck web | `npm run typecheck -w @wtc/web` | PASS — exit 0, no output |
| secret:scan | `npm run secret:scan` | PASS — no findings |
| test | `npm test` | PASS — 163 passed / 5 skipped (168) across 22 files; prior: 154/5/159 across 20 files |
| build | `npm run build -w @wtc/web` | PASS — all routes compile cleanly |
| e2e | NOT RUN (final wave only) | — |
| coverage | NOT RUN (final wave only) | — |

New test file breakdown:
- `tests/integration/billing-webhook.test.ts`: 4 tests (BW-002 tampered body, BW-003 wrong secret, BW-001 valid event, BW-004 idempotency).
- `tests/integration/lms-fixes.test.ts`: 5 tests (F-02 admin actor, F-02 self-enroll actor, F-03 enrollment targetId, F-04 with teacherProfileId, F-04 without teacherProfileId).

## Next actions

- Operator writes the `20260530-1145` aggregate handoff citing this per-agent handoff (and any other agents in the wave).
- Final wave: run `npm run e2e` (desktop + mobile smoke + screenshots to `tests/e2e/screenshots`) and `npm run coverage`; update STATUS with the e2e count and coverage figures.
- Phase 2.3 must-land Part 0 (billing webhook route handler) and Part 1 (LMS billing integration) are separate implementer agents — this tests-runner confirms the underlying repo + package logic is green before those agents land.
