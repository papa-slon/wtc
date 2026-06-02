# ecosystem-frontend-implementer handoff
## Scope
Read-only Phase 3.44 / epoch 20260602-0940 frontend audit before admin account unlock UI implementation. Focused on admin users pages/components/styles and existing form/action conventions for a user-facing admin unlock control, reason field, disabled/empty states, no public auth leakage, no nested cards, and consistency with the current admin console. No product code or docs were edited except this handoff.

## Files inspected
- `AGENTS.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/entitlements/page.tsx`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `apps/web/src/app/admin/support/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/auth/error-copy.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/ui/src/components.tsx`
- `packages/ui/src/theme.css`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/smoke.spec.ts`

## Files changed
None — read-only audit

## Findings
1. HIGH - `/admin/users` is still a read-only directory and has no lockout state or unlock action surface. Evidence: the page header copy says role mutation is unavailable at `apps/web/src/app/admin/users/page.tsx:15`-`apps/web/src/app/admin/users/page.tsx:18`, the notice says account suspension is unavailable and changes require direct DB access at `apps/web/src/app/admin/users/page.tsx:35`-`apps/web/src/app/admin/users/page.tsx:49`, and the table only renders Email, Display name, Roles, and Registered at `apps/web/src/app/admin/users/page.tsx:51`-`apps/web/src/app/admin/users/page.tsx:95`. Recommendation: replace or narrow the read-only notice for account-security operations and add an `Account state` plus `Actions` column on the existing users table. Target part: admin users page unlock UI.

2. HIGH - The admin user DTO cannot currently render lockout eligibility because lockout fields are stripped before the page sees them. Evidence: `AdminUserView` exposes only `id`, `email`, `displayName`, `roles`, and `createdAt` at `apps/web/src/features/admin/types.ts:10`-`apps/web/src/features/admin/types.ts:17`; `mapToAdminUserView` maps the same small shape at `apps/web/src/features/admin/queries.ts:108`-`apps/web/src/features/admin/queries.ts:115`; meanwhile the `users` schema already has failed-login and lockout columns at `packages/db/src/schema.ts:22`-`packages/db/src/schema.ts:29`. Recommendation: extend the admin-only safe projection with a compact `lockout` object, for example `accountLockedUntil`, `accountLockoutReviewRequiredAt`, `lastFailedLoginAt`, `failedLoginTotalCount`, and derived booleans such as `isLocked` / `requiresReview`; keep `passwordHash` excluded. Target part: admin user loader and DTO.

3. HIGH - The unlock form must follow the existing admin mutation pipeline: server action, admin RBAC, CSRF, Zod, repository mutation, audit, revalidate. Evidence: `apps/web/src/features/admin/actions.ts:1`-`apps/web/src/features/admin/actions.ts:5` documents the required sequence, grant/revoke actions enforce `requireUser()`, `assertAdmin`, `assertCsrf`, and Zod at `apps/web/src/features/admin/actions.ts:35`-`apps/web/src/features/admin/actions.ts:65`, and sensitive admin forms already include required reason fields at `apps/web/src/app/admin/entitlements/page.tsx:169`-`apps/web/src/app/admin/entitlements/page.tsx:180` and `apps/web/src/app/admin/entitlements/page.tsx:220`-`apps/web/src/app/admin/entitlements/page.tsx:258`. Recommendation: add `unlockAccountSchema` with `userId` and required `reason` (same 3-500 char convention unless security narrows it), add `adminUnlockAccountAction`, include `<CsrfField />`, and `revalidatePath('/admin/users')` after success. Target part: admin unlock form/action contract.

4. MEDIUM - Public auth leakage boundaries are already correct and should not be disturbed by the admin unlock slice. Evidence: failed login redirects all non-ok attempts to `/login?error=invalid_credentials` at `apps/web/src/app/(auth)/actions.ts:23`-`apps/web/src/app/(auth)/actions.ts:29`; the browser copy maps that to the generic "Invalid email or password." at `apps/web/src/features/auth/error-copy.ts:8`-`apps/web/src/features/auth/error-copy.ts:12`; the login page only renders mapped copy at `apps/web/src/app/(auth)/login/page.tsx:17`-`apps/web/src/app/(auth)/login/page.tsx:21`; regression tests assert stable generic codes at `tests/integration/auth-error-copy.test.ts:37`-`tests/integration/auth-error-copy.test.ts:53`. Recommendation: do not add public strings such as "account locked", "unlock time", "remaining attempts", "contact admin for this account", or any account-existence-specific copy. Admin-only lockout state can appear only under the `/admin` layout gate. Target part: no public auth leakage.

5. MEDIUM - The implementation should use the existing responsive table action-cell pattern, not nested cards or a standalone card inside `Users`. Evidence: the users page already wraps the table in `.wtc-table-wrap` and uses `data-label` cells at `apps/web/src/app/admin/users/page.tsx:62`-`apps/web/src/app/admin/users/page.tsx:87`; the design CSS requires table wrappers/data labels and provides `.wtc-td-action` mobile stacking at `packages/ui/src/theme.css:104`-`packages/ui/src/theme.css:115` and `packages/ui/src/theme.css:118`-`packages/ui/src/theme.css:178`; existing action forms in table cells follow this pattern at `apps/web/src/app/admin/tradingview-access/page.tsx:97`-`apps/web/src/app/admin/tradingview-access/page.tsx:155`. Recommendation: add an `Actions` `<td className="wtc-td-action" data-label="Actions">` with a compact stacked form and no `.wtc-card` inside the users table. Target part: layout consistency and mobile readability.

6. MEDIUM - Disabled and empty states need to be explicit because demo mode has no DB and many users will not be locked. Evidence: the users page already shows a demo-aware empty state at `apps/web/src/app/admin/users/page.tsx:51`-`apps/web/src/app/admin/users/page.tsx:60`; system-health actions use disabled ghost/secondary buttons when the action is not available at `apps/web/src/app/admin/system-health/page.tsx:120`-`apps/web/src/app/admin/system-health/page.tsx:151`; TradingView shows "No actions" for terminal states at `apps/web/src/app/admin/tradingview-access/page.tsx:158`-`apps/web/src/app/admin/tradingview-access/page.tsx:160`; shared button CSS marks disabled controls at `packages/ui/src/theme.css:88`-`packages/ui/src/theme.css:94`. Recommendation: in demo mode show the current empty state if no users exist; for users with no active lockout/review marker show muted "No lockout"; render a disabled ghost button only when there is no unlockable state, and render an enabled secondary/ghost unlock button with a required reason field only when locked or review-required. Target part: admin unlock empty/disabled states.

7. LOW - The current admin layout already gates all admin pages server-side, so frontend work should stay inside that route tree. Evidence: `apps/web/src/app/admin/layout.tsx:12`-`apps/web/src/app/admin/layout.tsx:16` redirects unauthenticated users to `/login` and non-admin users to `/app`; the same layout renders admin navigation and content at `apps/web/src/app/admin/layout.tsx:17`-`apps/web/src/app/admin/layout.tsx:42`. Recommendation: keep unlock controls in `/admin/users` or another admin child route; do not expose a public route, public API response, or client-side-only gate for lockout state. Target part: admin-only routing boundary.

## Decisions
- Prefer a row-level unlock control on `/admin/users` over a separate panel because the current users page is already a table-backed directory and the shared table CSS handles mobile action cells.
- Use existing admin form vocabulary: `StatusPill` for lockout/review state, `wtc-input` for the required reason field, and `buttonClasses('secondary')` or `buttonClasses('ghost')` for the unlock button.
- Keep public login/register copy unchanged; the unlock UI is admin-only diagnostic/control UI, not a public auth-status feature.
- Do not create nested `.wtc-card` elements inside the users table. Use plain row/action-cell layout and small `wtc-stack`/`wtc-row` groups.

## Risks
- If the loader exposes raw DB user rows or `DbUserWithCreatedAt` directly, `passwordHash` can leak into a server component boundary. The existing comments warn against this at `packages/db/src/repositories.ts:3205`-`packages/db/src/repositories.ts:3211`; keep the DTO projection explicit.
- Disabled buttons are only UX. Authorization must remain in the server action and repository; do not trust hidden `userId`, disabled state, or client-rendered lockout flags.
- Inline `minWidth` styles in compact admin forms can stress 375px layouts; the shared CSS mitigates table action cells, but the users page should still be checked with the PG8 mobile gate after adding a form column.
- If the backend implements an explicit route instead of a server action, the frontend still needs the same CSRF/admin/reason behavior and should not duplicate business logic in React.

## Verification/tests
- Read-only audit only; no tests were run.
- Suggested focused gates after implementation:
  - `npm test -- tests/integration/admin-responsive.test.ts tests/integration/auth-error-copy.test.ts`
  - `npm run typecheck -w @wtc/web`
  - `npm run lint`
  - `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile`
  - Add or extend a static/admin test proving `/admin/users` includes `CsrfField`, required `reason`, `adminUnlockAccountAction`, `wtc-td-action`, and no public auth copy changes.

## Next actions
1. Backend/DB owner: expose an audited unlock repository/action that clears lockout counters and writes `auth.account_unlock` in the same transaction.
2. Frontend owner: extend `AdminUserView` and `loadAdminUsers()` with safe admin-only lockout state; keep `passwordHash` excluded.
3. Frontend owner: update `/admin/users` table with `Account state` and `Actions` columns, required reason field, CSRF field, disabled/no-action states, and no nested cards.
4. Tests owner: add static coverage for the admin users unlock form and public auth copy non-leakage, then run the mobile admin Playwright gate.
