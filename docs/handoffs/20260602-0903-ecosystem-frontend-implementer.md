# ecosystem-frontend-implementer handoff
## Scope
Read-only frontend audit for Phase 3.43 / epoch 20260602-0903: user-visible login lockout behavior and copy before implementation. Focused on whether lockout has distinct user-visible code/copy, whether existing copy avoids account enumeration, mobile safety of the banner copy, current user-visible test scope, and information that must not be exposed.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md`
- `apps/web/src/features/auth/error-copy.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/middleware.ts`
- `packages/ui/src/components.tsx`
- `packages/ui/src/theme.css`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/security-headers.spec.ts` (located by search as auth/rate-limit e2e context)
## Files changed
None — read-only audit
## Findings
1. High - Account-specific login lockout does not yet have a frontend-visible distinct code because it is not implemented; Phase 3.42 explicitly deferred DB-backed account-specific login lockout, while the current auth action only redirects login failures to `invalid_form` or `invalid_credentials`. Evidence: `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:6`, `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:90`, `apps/web/src/app/(auth)/actions.ts:23`, `apps/web/src/app/(auth)/actions.ts:29`. Recommendation: if Phase 3.43 implements account lockout, add a stable code only if product/security choose to distinguish "temporarily locked" from generic invalid credentials; otherwise route lockout to `invalid_credentials` or `temporary` intentionally and document that choice. Target part: login lockout user-visible contract.
2. Medium - The current browser copy mapper already has a distinct `rate_limited` code for IP/server-action throttling, but this is not the same as account lockout. Evidence: `apps/web/src/features/auth/error-copy.ts:1`, `apps/web/src/features/auth/error-copy.ts:11`, `apps/web/src/middleware.ts:77`, `apps/web/src/middleware.ts:93`. Recommendation: keep `rate_limited` scoped to generic throttling unless implementation explicitly aliases account lockout to it; do not let UI copy imply the email account is locked. Target part: auth error taxonomy.
3. Medium - Existing public copy is account-neutral for invalid credentials and duplicate registration, and hostile query-string text is mapped to generic temporary copy. Evidence: `apps/web/src/features/auth/error-copy.ts:9`, `apps/web/src/features/auth/error-copy.ts:12`, `apps/web/src/features/auth/error-copy.ts:24`, `tests/integration/auth-error-copy.test.ts:25`, `tests/integration/auth-error-copy.test.ts:47`, `apps/web/src/app/(auth)/actions.ts:48`. Recommendation: preserve this pattern for lockout: no "this account", "email exists", "user locked", "remaining attempts", or unlock-state language in browser copy. Target part: no account enumeration.
4. Medium - Current user-visible tests prove the copy mapper and static page/action wiring, but they do not prove the real browser path for a throttled/locked login attempt. Phase 3.42 also noted that a user-visible throttle navigation proof was not added. Evidence: `tests/integration/auth-error-copy.test.ts:10`, `tests/integration/auth-error-copy.test.ts:37`, `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:96`, `tests/e2e/helpers/auth.ts:7`. Recommendation: add focused user-visible coverage for `/login?error=rate_limited` and any new lockout code/copy, preferably as render/static integration first; only add Playwright burst/lockout flow if tests-runner approves a deterministic setup that avoids shared dev-server instability. Target part: user-visible test scope.
5. Low - The current warning banner uses short title/detail text, `role="alert"` for errors, 13-14px detail/title sizes, and normal line-height, which is acceptable for mobile if future lockout copy stays similarly short. Evidence: `apps/web/src/app/(auth)/login/page.tsx:16`, `apps/web/src/app/(auth)/login/page.tsx:20`, `packages/ui/src/components.tsx:56`, `packages/ui/src/components.tsx:59`, `packages/ui/src/theme.css:97`, `packages/ui/src/theme.css:102`. Recommendation: keep lockout copy to one short sentence and avoid timestamps, long policy explanations, support instructions, or dynamic diagnostic text in the banner. Target part: mobile-safe copy.
## Decisions
- No product code edits were made in this lane.
- Treat current `rate_limited` as IP/server-action throttling copy, not proof that account-specific lockout has a browser-visible contract.
- Recommended default for account lockout copy is neutral and non-enumerating: either reuse generic invalid/temporary copy, or use a distinct stable code with generic wording that does not confirm account existence.
## Risks
- If the backend implements account lockout with a distinct redirect code and the frontend maps it to "account locked", login can disclose account existence to attackers.
- If account lockout reuses `rate_limited` without documentation, operators and tests may confuse per-IP throttle behavior with per-account lockout behavior.
- If the first user-visible proof is a Playwright burst test, it may recreate the shared-dev-server instability already documented in Phase 3.42.
## Verification/tests
- Read-only inspection and static search only.
- Gates not run: lint, typecheck, Vitest, Playwright, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e` - skipped because this lane was requested as a read-only frontend audit before implementation.
## Next actions
1. Before implementation, choose and document one lockout copy contract: generic invalid/temporary copy, or a distinct stable code with neutral language.
2. Add/update integration coverage for the selected user-visible code path and hostile query-string fallback.
3. Keep lockout response/copy free of account existence, remaining-attempt count, unlock timestamp, internal limiter bucket, IP, headers, audit target IDs, or support-only diagnostic values.
