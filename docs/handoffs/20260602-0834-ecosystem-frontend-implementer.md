# ecosystem-frontend-implementer handoff
## Scope
Phase 3.42 read-only frontend/product audit for auth rate limiting. Inspected login/register UI, server-action error redirects, middleware throttling response shape, shared banner styling, and current verification coverage. Focus was user-visible states, account-existence neutrality, no internal leakage, and mobile-safe copy.

No product code edits were allowed. This handoff is the only requested artifact.

## Files inspected
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/middleware.ts`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/errors.ts`
- `packages/ui/src/components.tsx`
- `packages/ui/src/theme.css`
- `tests/e2e/security-headers.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/csrf-coverage.test.ts`
- `apps/web/src/lib/backend.ts`
- `packages/db/src/repositories.ts`
- `docs/SECURITY_MODEL.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260530-1815-ecosystem-tests-runner.md`
- `docs/handoffs/20260530-1815-ecosystem-platform-architect.md`

## Files changed
None - read-only audit. Product code was not edited.

## Findings
1. Severity: High. The implemented 429 throttle response does not currently feed the visible login/register error banner path. Evidence: login and register pages only render visible errors from `searchParams.error` at `apps/web/src/app/(auth)/login/page.tsx:7` and `apps/web/src/app/(auth)/login/page.tsx:18`, plus `apps/web/src/app/(auth)/register/page.tsx:6` and `apps/web/src/app/(auth)/register/page.tsx:15`; the forms post directly to server actions at `apps/web/src/app/(auth)/login/page.tsx:19` and `apps/web/src/app/(auth)/register/page.tsx:16`; middleware blocks before those actions and returns JSON `{ error: 'rate_limited', message: 'Too many requests. Please try again later.' }` with status 429 at `apps/web/src/middleware.ts:89` to `apps/web/src/middleware.ts:99`. Recommendation: add an explicit browser-facing mapping for throttle failures so both `/login` and `/register` show the same generic banner instead of raw JSON, a React action protocol error, or a blank failure. Target part: auth UI/error adapter.

2. Severity: High. Registration failure copy discloses account existence and collapses all creation exceptions into an account-specific message. Evidence: `registerAction` catches every `createUser` error and redirects with `That email is already registered` at `apps/web/src/app/(auth)/actions.ts:46` to `apps/web/src/app/(auth)/actions.ts:50`; the DB repository intentionally maps duplicate races to `email already registered` at `packages/db/src/repositories.ts:81` to `packages/db/src/repositories.ts:96`; the security model says rate-limited auth responses must not disclose whether an account exists at `docs/SECURITY_MODEL.md:178`. Recommendation: use neutral registration failure copy such as "We could not create an account with those details. Check the form or try again shortly." Do not distinguish duplicate email, throttling, database, or production guard failures in the browser. Target part: register action/UI copy.

3. Severity: Medium. The auth pages trust arbitrary `error` query-string text as display copy, which lets any crafted URL display internal-looking or account-specific text even though React escapes it. Evidence: login destructures `error` from `searchParams` and passes it directly to `RiskWarningBanner` at `apps/web/src/app/(auth)/login/page.tsx:7` to `apps/web/src/app/(auth)/login/page.tsx:18`; register does the same at `apps/web/src/app/(auth)/register/page.tsx:6` to `apps/web/src/app/(auth)/register/page.tsx:15`. Recommendation: switch the query parameter to a stable code allowlist, for example `invalid`, `invalid_form`, `rate_limited`, and `temporary`, then map unknown values to a safe generic string. Target part: auth error rendering.

4. Severity: Medium. Register page supporting copy exposes password hashing implementation details on the public form. Evidence: `apps/web/src/app/(auth)/register/page.tsx:14` says "Passwords are hashed with Argon2id." Recommendation: replace implementation detail with product-safe copy, for example "Use one account for every WTC product." Keep password rules visible through the label and validation, but do not mention hashing algorithms on the public auth surface. Target part: register page copy.

5. Severity: Medium. Current verification proves the pure limiter, but not the actual user-visible throttle state. Evidence: the limiter tests cover max-plus-one blocking and retry timing at `packages/auth/src/rate-limit.test.ts:24` to `packages/auth/src/rate-limit.test.ts:47`; the e2e spec explicitly does not exercise the 429 path at `tests/e2e/security-headers.spec.ts:30` to `tests/e2e/security-headers.spec.ts:34`; the acceptance matrix still lists "e2e 429" as a PG11 gate at `docs/ACCEPTANCE_MATRIX_MASTER.md:205` to `docs/ACCEPTANCE_MATRIX_MASTER.md:209`. Recommendation: before claiming "auth rate-limit live" from a product perspective, add a controlled browser or integration proof that the user sees the safe banner on both auth pages. Use isolated client IPs or a dedicated server lifetime so the test does not poison normal e2e login state. Target part: auth throttle acceptance.

6. Severity: Low. The existing banner primitive is acceptable for mobile if the detail copy is short and code-mapped. Evidence: `RiskWarningBanner` uses `role="alert"` for errors at `packages/ui/src/components.tsx:56` to `packages/ui/src/components.tsx:64`; banner detail is 13px with 1.5 line height at `packages/ui/src/theme.css:96` to `packages/ui/src/theme.css:102`; auth form containers cap width at 460px with 22px side padding at `apps/web/src/app/(auth)/login/page.tsx:14` and `apps/web/src/app/(auth)/register/page.tsx:11`; buttons have 44px minimum touch height at `packages/ui/src/theme.css:88` to `packages/ui/src/theme.css:90`. Recommendation: keep the rate-limit message to one or two short lines: title "Try again shortly"; detail "Too many attempts. Wait a minute and try again." Avoid displaying `429`, `rate_limited`, `Retry-After`, IP values, request IDs, or provider/internal names. Target part: auth banner copy.

## Decisions
- The frontend should present the same throttle message on login and register. It must not say whether the submitted email exists.
- Auth UI should render safe messages from stable codes, not arbitrary query-string text.
- Rate-limit copy should stay short, mobile-safe, and action-neutral: "Too many attempts. Wait a minute and try again."
- Do not show transport or implementation details in the browser: no `429`, `rate_limited`, `Retry-After`, IP, bucket, request ID, database message, Argon2id, or stack/internal text.
- Keep `RiskWarningBanner` as the visible component. The issue is routing/mapping of errors into the banner, not the banner component itself.

## Risks
- A user who triggers middleware throttling today may see a raw JSON response or a server-action protocol failure instead of a styled page-level banner.
- Any direct `/login?error=...` or `/register?error=...` URL can display misleading text in the trusted auth card until the error parameter is allowlisted.
- Changing middleware from JSON to redirect, or changing server-action response handling, can break Next server-action protocol unless it is tested with both hydrated and pre-hydration/native form submissions.
- Keeping "That email is already registered" makes registration an enumeration surface and conflicts with the requested no-account-existence-leak requirement.

## Verification/tests
- Run this session: read-only static inspection with `rg` over the files listed above.
- Not run: product code edits, dev server, Playwright, `npm test`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, database migrate/seed, live server mutation.
- Recommended focused tests after implementation:
  1. Add a pure auth error-copy mapper test covering `invalid`, `invalid_form`, `rate_limited`, `temporary`, duplicate/unknown, and hostile query text.
  2. Add mobile-safe render assertions for `/login?error=rate_limited` and `/register?error=rate_limited` at 375px.
  3. Add a controlled throttle acceptance test that triggers the middleware 429 path with a unique `x-forwarded-for` value and asserts the user-visible generic copy, without contaminating normal e2e login state.
  4. Run `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` separately after implementation, per current repo gate practice.

## Next actions
1. Implement a stable auth error-code mapping used by both auth pages.
2. Replace duplicate-email register copy with neutral copy that does not confirm or deny account existence.
3. Route middleware/action throttle failures into the same safe banner on both login and register.
4. Remove public Argon2id wording from the register page.
5. Add the focused UI/throttle tests before claiming the auth rate-limit product surface is accepted.
