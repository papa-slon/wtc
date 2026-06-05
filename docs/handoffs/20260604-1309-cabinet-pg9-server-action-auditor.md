# cabinet-pg9-server-action-auditor handoff
## Scope
Read-only Phase 4.16 audit of the PG9 cabinet/setup wizard static failure. Focused on `tests/integration/cabinet-pg9.test.ts`, the bot setup wizard server actions, delegated bot config action handling, and immediate CSRF/secret-render safety constraints. No live bot control, DB-mutating acceptance, exchange/provider calls, or secret reads were performed.

## Files inspected
- `tests/integration/cabinet-pg9.test.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/bots/config-action-handler.ts`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/app/(app)/app/security/page.tsx`
- `apps/web/src/app/(app)/app/indicators/page.tsx`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`

## Files changed
`docs/handoffs/20260604-1309-cabinet-pg9-server-action-auditor.md` only. Application code: None - read-only audit.

## Findings
1. Severity: P1 gate blocker. Evidence: `tests/integration/cabinet-pg9.test.ts:25` defines `WIZARD = 'app/(app)/app/bots/[bot]/setup/page.tsx'`, `tests/integration/cabinet-pg9.test.ts:104` reads that source into `src`, and `tests/integration/cabinet-pg9.test.ts:111` requires at least two exact `if (!access.allowed) return;` strings. Source inspection found five setup wizard server actions, one exact `if (!access.allowed) return;`, and one redirect-style denial. Recommendation: fix the setup wizard denial shape or the static test heuristic; do not broaden scope beyond this source/test mismatch. Target part: PG9 static gate.

2. Severity: P1 gate blocker, but not a confirmed security bypass. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:113-123` defines `wizardAddKey`, checks CSRF before auth, then returns on denied entitlement. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:135-149` defines `wizardCheckExchangeKeyMetadata`, checks CSRF before auth, then checks entitlement and redirects on denied entitlement instead of using the exact `return;` pattern. Recommendation: minimal preferred source fix is to change line 148 from `if (!access.allowed) redirect(...)` to `if (!access.allowed) return;`. This preserves fail-closed behavior, matches the current PG9 test contract, and avoids leaking any metadata-check result to a denied/stale/crafted submission. If the redirect UX is intentionally required, the alternative is a narrow test change at `tests/integration/cabinet-pg9.test.ts:111` to count both `return;` and `redirect(...)` as fail-closed denials, but that should be an explicit product/security decision. Target part: `wizardCheckExchangeKeyMetadata`.

3. Severity: P2 test precision. Evidence: setup config actions at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:153-175` perform CSRF in the wrapper before calling delegated handlers; the delegated handler resolves user/access in `apps/web/src/features/bots/config-action-handler.ts:123-133` and returns null on denied entitlement, causing noop outcomes at `apps/web/src/features/bots/config-action-handler.ts:165-167`, `apps/web/src/features/bots/config-action-handler.ts:196-198`, and `apps/web/src/features/bots/config-action-handler.ts:224-226`. Recommendation: do not add duplicated inline entitlement checks to `wizardSaveConfig`, `wizardApplyPreset`, or `wizardUseSystemDefault` just to satisfy a source-count test; their central helper is already the safer shared boundary. Target part: delegated setup config actions.

4. Severity: P1 security constraint. Evidence: setup actions keep `await assertCsrf(formData)` before `await requireUser()` in `wizardAddKey` (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:115-116`) and `wizardCheckExchangeKeyMetadata` (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:137-138`); delegated config actions also assert CSRF before entering the handler (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:155-157`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:163-165`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:171-173`). Recommendation: any fix must not move `requireUser` ahead of `assertCsrf`; for delegated actions, keep CSRF in the server-action wrapper before calling the helper. Target part: CSRF ordering.

5. Severity: P1 secret-safety constraint. Evidence: the setup wizard renders `apiKey` and `apiSecret` as password inputs at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:432-433`; the PG9 test rejects `defaultValue` echoing of `apiSecret` at `tests/integration/cabinet-pg9.test.ts:113-117`; the readiness panel renders only `key.keyMask` at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:101-103`; `listExchangeKeys` explicitly never joins secret material at `packages/db/src/repositories.ts:404-407`; metadata checks select account fields plus secret-row id only at `packages/db/src/repositories.ts:455-470` and audit only check metadata/keyMask at `packages/db/src/repositories.ts:490-498`. Recommendation: no fix should render plaintext API keys/secrets, sealed blobs, exchange secret rows, provider payloads, or raw provider outputs. Target part: setup wizard and exchange-key readiness display.

## Decisions
- This audit did not edit application code.
- The minimal preferred application fix is one line in `wizardCheckExchangeKeyMetadata`: make denied entitlement a silent `return;` to match the existing `wizardAddKey` fail-closed pattern and the current PG9 static assertion.
- A test-only adjustment is acceptable only if the team intentionally wants redirect-on-denied semantics for the metadata-check action; otherwise it weakens the current test's simple fail-closed contract.

## Risks
- The current failure is a gate blocker because `npm test` includes the PG9 static assertion.
- Because the worktree is heavily dirty, changing broad files or refactoring shared action helpers would carry unnecessary merge/review risk.
- If a test-only fix broadly accepts any `redirect(` after denied access, it could bless redirects that reveal state through query parameters. Keep any test adjustment narrowly scoped if chosen.

## Verification/tests
- Ran read-only static source inspection only.
- Counted setup wizard source patterns: five `'use server'` occurrences, one exact `if (!access.allowed) return;`, one `if (!access.allowed) redirect(`.
- Did not run `npm test`, `node scripts/gates.mjs core`, DB-mutating acceptance, Playwright, exchange/provider calls, or live bot control.

## Next actions
1. Apply the minimal source fix in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:148`: replace the denied-entitlement redirect in `wizardCheckExchangeKeyMetadata` with `return;`.
2. Rerun `npx vitest run tests/integration/cabinet-pg9.test.ts`.
3. If green, rerun the Phase 4.15 failing gate command `node scripts/gates.mjs core`.
4. Keep final reporting explicit about gates run and not run; do not claim `core` green until observed in the fixing session.
