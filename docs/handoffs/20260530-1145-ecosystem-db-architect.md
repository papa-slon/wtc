## Scope

Phase 2.3 Part 0 — backward-compatible repository correctness fixes and optional-param extensions
to `packages/db/src/repositories.ts`. No schema change, no migration. Five targeted edits:
createCourse (F-04), upsertEnrollment (F-02), markEnrollmentComplete (F-03), grantProduct (F4/F8),
revokeProduct (F8). Confirmed `applyStripeEvent` + `listProductAccessEvents` semantics (read-only).

## Files inspected

- `packages/db/src/repositories.ts` — the single file this agent owns; read in full
- `packages/db/src/schema.ts` — read to confirm column names on `productAccessEvents` (`reason`, `actorId`, `actorType`), `entitlements` (`expiresAt`), and `courses` (`teacherProfileId`)
- `packages/audit/src/audit.ts` — confirmed all required action codes already exist (`education.enrolled`, `education.course_completed`, `product.grant`, `product.revoke`); no new codes needed
- `packages/entitlements/src/engine.ts` — confirmed `Entitlement` interface uses `expiresAt` (not `validUntil`)
- `docs/handoffs/0000-orchestrator-seed.md` — read as required by the seed

## Files changed

- `packages/db/src/repositories.ts`

## Findings

**F-01 (read-only confirmation): `applyStripeEvent`**
- Signature: `applyStripeEvent(db, { stripeEventId, billingEvent, userId, productCodes, planCode? }, now?)` returning `{ applied: boolean; productsChanged: number }`.
- Idempotency: first thing inside the transaction it SELECTs `audit_logs WHERE action='billing.webhook_received' AND target_id=$stripeEventId`; if found, returns `{applied:false, productsChanged:0}` without any further writes. The audit ledger is the dedupe store (no separate table).
- Product-access events: for each product that transitions, writes `product_access_events` with `actorType='billing_webhook'` and no `actorId` (system event).
- Safety: the event id + billingEvent type are logged; the raw body and signing secret never appear in the DB.

**F-02 (read-only confirmation): `listProductAccessEvents`**
- Signature: `listProductAccessEvents(db, userId, { productCode?, limit? }?)` returning `ProductAccessEventRow[]`.
- Columns returned: `id`, `entitlementId`, `userId`, `productCode`, `fromState`, `toState`, `reason`, `actorId`, `actorType`, `createdAt`.
- `actorId` is a UUID reference to `users` (nullable — null for billing_webhook/system events). `actorType` is a plain text label (`user | admin | system | billing_webhook`).
- Consumer note for the user-facing timeline: `actorId` and `actorType` should be omitted or anonymised in user-facing responses to avoid exposing admin user IDs. The column is present but the display layer controls what it surfaces.

**F-03 (fixed): `markEnrollmentComplete` audit targetId was courseId instead of enrollment.id**
- The audit row set `targetType='enrollment'` but `targetId=courseId`, making it semantically wrong (a course id is not an enrollment id). Fixed by SELECTing the enrollment row (by userId+courseId) INSIDE the same transaction and using `enrollment.id` as targetId. Graceful fallback to courseId if the enrollment row is unexpectedly absent.

**F-04 (fixed): `createCourse` lacked `teacherProfileId` field**
- The `courses` schema already has a nullable `teacher_profile_id` UUID column (migration 0002, additive). `createCourse` was not accepting or setting it. Added optional `teacherProfileId?: string` to the input object; when present it is spread into the insert values. `ownerTeacherId` is unchanged.

**F-05 (schema confirmed): `productAccessEvents.reason` is an existing text column (nullable)**
- No `metadata` column exists. `reason` is the correct target for the human-readable grant/revoke reason string.

## Decisions

1. **`grantProduct` new params `reason?` and `validUntil?`**: both are optional trailing params after `actorUserId?` so all existing call sites compile without change. `reason` defaults to `'manual_grant'` when absent (identical to prior behavior). `validUntil` (epoch-ms) when provided sets `entitlements.expiresAt` on both the INSERT path and the conflict-update `set` object. Both `reason` and `validUntil` are surfaced in the audit `after` payload.

2. **`revokeProduct` new param `reason?`**: optional trailing after `actorUserId?`. Defaults to `'manual_revoke'`. Threaded into `product_access_events.reason` and the audit `after` payload.

3. **`upsertEnrollment` new param `actorUserId?`**: trailing after `now` to keep the existing two-arg call sites (`upsertEnrollment(db, input)` and `upsertEnrollment(db, input, now)`) unchanged. When supplied, the audit row uses that actor id with `actorRole='admin'`; when absent, uses `input.userId` with `actorRole='user'` (identical to prior behavior).

4. **`markEnrollmentComplete` SELECT order**: the UPDATE runs first, then the SELECT reads the now-updated row. This is safe inside a single serialized transaction — the UPDATE and SELECT see the same snapshot. The SELECT post-UPDATE guarantees the `completedAt` is already stamped, and the `enrollment.id` is the correct semantic target for the audit row.

5. **No new audit codes needed**: all required codes (`education.enrolled`, `education.course_completed`, `product.grant`, `product.revoke`) were already registered in `packages/audit/src/audit.ts`.

6. **No schema change, no migration 0003**: all column references (`reason`, `expiresAt`, `teacherProfileId`) already exist in migration 0002.

## Risks

- `markEnrollmentComplete` graceful fallback to `courseId` when enrollment row is absent: this preserves current (wrong) behavior as a last resort rather than throwing. Callers should ensure `upsertEnrollment` is called before `markEnrollmentComplete`.
- `grantProduct` `validUntil` sets `expiresAt`; the entitlement state machine's `reconcileExpiry` will then transition this grant to `expired` at the stated time. Callers must be aware the grant is time-bounded.
- `listProductAccessEvents` returns `actorId` (a UUID). Any user-facing timeline that calls this must strip or anonymise `actorId`/`actorType` before rendering to prevent admin user ID leakage.

## Verification/tests

Self-verify commands and results:

```
npm run typecheck
```
Result: clean exit, no errors, no output (0 errors).

```
npm test
```
Result:
- 20 test files passed, 0 failed
- 154 tests passed, 5 skipped (the 5 skipped are `db-real-postgres.test.ts` real-PG opt-in tests that skip when DATABASE_URL is unset — expected)
- `tests/integration/db-persistence.test.ts`: 19 passed
- `tests/integration/db-0002.test.ts`: 19 passed
- All other suites green

## Next actions

- Part 1 (billing webhook route): the `applyStripeEvent` repo is confirmed idempotent and ready. The webhook route handler needs to call `verifyWebhookSignature` (packages/billing/src/webhook.ts:17) then `parseWebhook` (packages/billing/src/stripe.ts:47) then `applyStripeEvent`. The route handler is CSRF-exempt (Stripe signature is the auth); no `assertCsrf` call.
- Part 4 (admin grant UI): `grantProduct(db, userId, productCode, now, adminId, reason, validUntil)` is now ready for the admin server action. Zod schema should validate `reason` as optional string and `validUntil` as optional positive integer (epoch-ms).
- Admin manual-enroll surface: `upsertEnrollment(db, { userId, courseId }, now, adminId)` now records the admin as audit actor.
- The `CourseDTO` interface does not currently expose `teacherProfileId`; if the LMS UI needs it, extend `CourseDTO` and `rowToCourseDto` in a future task (no behavior break — the DB column is already set correctly).
