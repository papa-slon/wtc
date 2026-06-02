## Scope
Phase 3.3 landed a broad product-surface pass across the two bot rooms and education rooms. Seven read-only audit inputs were used and persisted as handoffs at this epoch:
- [`20260531-1310-bot-rooms-auditor-initial.md`](20260531-1310-bot-rooms-auditor-initial.md)
- [`20260531-1310-education-rooms-auditor-initial.md`](20260531-1310-education-rooms-auditor-initial.md)
- [`20260531-1310-tv-terminal-admin-auditor.md`](20260531-1310-tv-terminal-admin-auditor.md)
- [`20260531-1310-browser-ip-readiness-auditor.md`](20260531-1310-browser-ip-readiness-auditor.md)
- [`20260531-1310-education-regression-auditor.md`](20260531-1310-education-regression-auditor.md)
- [`20260531-1310-bot-entitlement-auditor.md`](20260531-1310-bot-entitlement-auditor.md)
- [`20260531-1310-governance-docs-auditor.md`](20260531-1310-governance-docs-auditor.md)

No live server, live bot, exchange, worker, Stripe, Axioma production bridge, or real Postgres was touched.

## Files changed
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/teacher/layout.tsx`
- `apps/web/src/app/teacher/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/community/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/lib/nav.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/lms-rbac-pipeline.test.ts`
- `tests/integration/lms-community-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`

## Findings
- Bot setup/settings needed product-specific Tortila vs Legacy schemas, reference profiles, manual/auto intent, and demo persistence.
- `/app/bots` leaked read-adapter health attempts before entitlement gating.
- Teacher materials and community were still incomplete UI surfaces despite DB/repos/actions existing.
- Student education still used hardcoded community "soon" placeholders.
- Course-level pinned links were loaded but not rendered/managed.
- LMS RBAC static test was stale after the three new community actions.
- The local browser demo works in mock mode, but production readiness is still blocked by real-PG, Stripe, Axioma, CI/git, and live-bot gates.

## Decisions
- Product-specific bot config is WTC-side only; live apply remains disabled.
- `/app/bots` now runs adapter reads only after entitlement allows the product.
- Teacher community now has profile/social-link management and teacher-profile pinned links.
- Teacher course editor now has course pinned links and per-lesson material listing/deletion.
- Student education now renders community links from `loadStudentCatalogue`; no hardcoded Telegram/Instagram "soon" links remain.
- Demo teacher workspace again shows the seeded course so browser preview stays useful while clearly labelled `storage: in-memory`.

## Risks
- Real Postgres was not run; PGlite and static tests are not a substitute for a throwaway real-PG migrate/seed/harness.
- Existing e2e Server Action login race still appears as retry flakes under Next dev; final e2e exit code was 0.
- Legacy bot live adapter remains blocked by B3.
- Stripe checkout and Axioma production bridge remain blocked.

## Verification/tests
- `npm run check:core` - PASS.
- `npm run lint -- --quiet` - PASS.
- `npm run typecheck -- --pretty false` - PASS.
- `npm run typecheck -w @wtc/web -- --pretty false` - PASS.
- `npm test` - PASS, 550 passed / 8 skipped (558), 50 files.
- `npm run secret:scan` - PASS.
- `npm run coverage` - PASS, 24.74% statements / 75.98% branch.
- `npm run db:generate -w @wtc/db` - PASS, 41 tables, no schema changes.
- `npm run build -w @wtc/web` - PASS, 48 routes.
- `npx playwright test --reporter=list` with `CI=1` - PASS, 41 passed / 3 flaky-green / 6 skipped / 0 failed.
- `db:migrate`, `db:seed`, and `tests/integration/db-real-postgres.test.ts` against real Postgres - NOT RUN; no throwaway `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`.
- `npm ci` - NOT RUN; node_modules already present and this is not a git-backed workspace.

## Next actions
- Run real Postgres acceptance on a throwaway `wtc_test` database.
- Wire Stripe test-mode checkout and checkout UI.
- Continue Axioma production bridge/download/open-journal work behind B4.
- Finish remaining LMS epics: global pinned links, object-storage/file upload review, embed sanitizer, slug routing.
- Add CI/git only after the workspace is intentionally initialized or moved into a repository.
