# Credential Acceptance Blockers Current

Last updated: 2026-06-06, Phase 4.71 Tortila strict managed proof.

This packet is the current operator-facing blocker list after Phase 4.62. The LMS DB browser managed gate, active managed
real-Postgres proof, local managed throwaway audit-role proof, local site-readiness proof, and local auth DB-backed
production-profile browser proof are now **RUN/PASS** with
operator-approved local sources where needed. Remaining live or credentialed gates are still **NOT RUN** unless explicitly
marked otherwise below. Do not treat local dry-runs, PGlite tests, visual inventory, or `node scripts/gates.mjs full` as
substitutes for the remaining gates.

## Current Evidence

Observed in this session:

- Phase 4.61 git/CI release proof -> **RUN/PASS** for the WTC repo: PR #1 merged at
  `ed31aaaf89ebc4920a13887542fa3bb0bbd99545`; pre-merge PR CI run `27015532545` and post-merge `main` CI run
  `27016644974` both passed `gates` and `e2e`.
- Phase 4.62 deploy/source discovery -> **RUN/PASS in read-only scope**: deploy target packet absent, canonical git-backed
  Tortila source absent, and Legacy closed-trade source absent. These remain external input gates, not local-code gates.
- `C:\Users\maxib\GTE BOT\bot\.env` had Postgres connection fields; the connection and `CREATE DATABASE` permission were
  checked without printing values.
- `LMS_E2E_ADMIN_DATABASE_URL` was built only in-process for the managed runner and removed from the shell after the run.
- Final `npm run e2e:lms:db:managed` -> **PASS**: created `wtc_test_lms_20260602101117_cc7889`, applied 17 migrations plus
  seed data, ran LMS DB Playwright desktop/mobile (`2 passed`), ran LMS DB artifact scanner PASS, and dropped the throwaway DB.
- Retained screenshot review -> **PASS** with
  `logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json` for
  `tests/e2e/screenshots/lms-db-material-lesson-lms-db-mobile.png`.
- Root `npm run typecheck`, `npm run lint`, `npm run secret:scan`, and `npm run governance:check` -> **PASS**.
- `REAL_POSTGRES_ADMIN_DATABASE_URL` was built only in-process from the same existing-bot source for
  `npm run accept:real-pg:managed`; the value was not printed or persisted.
- Final `npm run accept:real-pg:managed` -> **PASS**: created `wtc_test_realpg20260602105824d18bef`, ran active real-PG
  tests (`14 passed`), and dropped the throwaway DB.
- Focused safety/helper Vitest, root typecheck, web typecheck, lint, secret scan, and governance check -> **PASS** after
  Phase 3.60 docs/code updates.
- `AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL` was built only in-process from the same existing-bot source for
  `npm run accept:audit:append-only-role:managed`; the value was not printed or persisted.
- Final `npm run accept:audit:append-only-role:managed` -> **PASS**: created `wtc_test_audit_20260602113142_0aa15f`,
  applied `17` migrations, created temporary role `wtc_app_role_20260602113142_97bf21`, proved
  `select=true insert=true update=false delete=false truncate=false probe=inserted`, and dropped both the DB and role.
- Phase 3.62 local site-readiness -> **PASS**: root `npm test` (`921` passed, `10` skipped), web build, default e2e
  (`44` passed, `8` skipped), local preview HTTP smoke at `http://127.0.0.1:3000`, core smoke, DB generate, and visual
  inventory all passed in their stated scopes.
- Phase 3.63 production-readiness gap closure -> **PASS in local scope**: no-network Stripe webhook/checkout dry-runs,
  no-network Axioma dry-run, no-network LMS object-store/scanner dry-runs, retained preflight evidence scan, root `npm test`
  (`934` passed, `10` skipped), web build, core smoke, root/web typecheck, lint, secret scan, default e2e (`44` passed,
  `6` skipped), auth production-profile e2e (`2` passed), and managed auth DB e2e against existing-bot Postgres source
  (`wtc_test_auth_20260602130742_099899` created/dropped, 17 migrations plus seed, Playwright `2` passed).
- Phase 4.68 used the operator-approved SSH target to update only the WTC canary/worker containers to `3aff273`, after PR
  #8 and post-merge `main` CI passed. DB migrate was checked green with no new migration beyond the prior `0021` state. It
  did not restart live bot services, nginx, PostgreSQL, or Docker, and did not run live bot control or exchange probes.
- Phase 4.69 added `npm run verify:tortila:canonical-source` and strict `TORTILA_CANONICAL_SOURCE_REQUIRED=1` support for
  `accept:tortila:real-read:managed`.
- Phase 4.70 created a clean private canonical Tortila source repo (`papa-slon/tortila-canonical-source`, branch `main`,
  commit `f53a774c3bc4c14653906bd2f778a515c565cf12`) and made bot pytest/ruff, export secret scan, and WTC canonical
  verifier pass.
- Phase 4.71 ran strict WTC managed real-read proof against that canonical source with a separate disposable local
  PostgreSQL 17 cluster on loopback. The runner verified token matrix and WTC persisted proof (`sourceAdapter=tortila`,
  `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, `marksRequests=0`), dropped the throwaway DB, and external
  cleanup verified leftover DB count `0`, temp cluster stopped, temp directory removed, and temp port closed.

Previously checked env vars without printing values in Phase 3.58; remaining gates still require these names unless a later
phase supplies them:

```text
LMS_E2E_ADMIN_DATABASE_URL=NOT_SET
LMS_E2E_DATABASE_URL=NOT_SET
AUDIT_APPEND_ONLY_DATABASE_URL=NOT_SET
AUDIT_APPEND_ONLY_EXPECTED_ROLE=NOT_SET
AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=NOT_SET
AUDIT_APPEND_ONLY_PREFLIGHT_NON_THROWAWAY_APPROVED=NOT_SET
LMS_FILE_STORAGE_PROVIDER=NOT_SET
LMS_PUBLIC_UPLOADS_ENABLED=NOT_SET
LMS_OBJECT_STORAGE_ENDPOINT=NOT_SET
LMS_OBJECT_STORAGE_BUCKET=NOT_SET
LMS_OBJECT_STORAGE_REGION=NOT_SET
LMS_OBJECT_STORAGE_ACCESS_KEY_ID=NOT_SET
LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY=NOT_SET
LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE=NOT_SET
LMS_OBJECT_STORAGE_LIVE_THROWAWAY=NOT_SET
LMS_FILE_SCANNER_MODE=NOT_SET
LMS_FILE_SCANNER_ENDPOINT=NOT_SET
LMS_FILE_SCANNER_TOKEN=NOT_SET
LMS_FILE_SCANNER_LIVE_ACCEPTANCE=NOT_SET
LMS_FILE_SCANNER_LIVE_EICAR=NOT_SET
BILLING_PROVIDER=NOT_SET
STRIPE_SECRET_KEY=NOT_SET
STRIPE_WEBHOOK_SECRET=NOT_SET
STRIPE_PRICE_MAP=NOT_SET
AXIOMA_HANDOFF_SIGNING_KEY=NOT_SET
AXIOMA_HANDOFF_KEY_ID=NOT_SET
AXIOMA_BRIDGE_API_TOKEN=NOT_SET
```

## Blocked Gates

| Gate | Command | Required operator input | Current state | Evidence required to clear |
|---|---|---|---|---|
| LMS DB browser acceptance | `npm run e2e:lms:db:managed` | Existing-bot Postgres source approved by operator; in-process `LMS_E2E_ADMIN_DATABASE_URL`, value never printed | **RUN/PASS in Phase 3.59** - final throwaway DB `wtc_test_lms_20260602101117_cc7889` created/dropped, Playwright `2 passed`, artifact scanner PASS, retained screenshot visual review PASS | Cleared for local managed LMS DB browser acceptance; rerun only if code/DB path changes or operator requests fresh proof |
| Active real-Postgres proof | `npm run accept:real-pg:managed` or `npm test -- tests/integration/db-real-postgres.test.ts` | Existing-bot Postgres source approved by operator; in-process `REAL_POSTGRES_ADMIN_DATABASE_URL`, value never printed | **RUN/PASS in Phase 3.60** - final throwaway DB `wtc_test_realpg20260602105824d18bef` created/dropped, active real-PG harness `14 passed` | Cleared for local active managed real-PG proof; rerun only if DB/migration/concurrency path changes or operator requests fresh proof |
| Local managed append-only audit DB-role proof | `npm run accept:audit:append-only-role:managed` | Existing-bot Postgres source approved by operator; in-process `AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL`, value never printed | **RUN/PASS in Phase 3.61** - final throwaway DB `wtc_test_audit_20260602113142_0aa15f` and temporary role `wtc_app_role_20260602113142_97bf21` created/dropped, preflight proved SELECT/INSERT only | Cleared for local generated-role throwaway proof; rerun only if audit role/preflight/migration path changes or operator requests fresh proof |
| Production/preview intended append-only audit DB-role proof | `npm run accept:audit:append-only-role` | Intended restricted app-role `AUDIT_APPEND_ONLY_DATABASE_URL`, expected role, and `AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1`; non-throwaway flag only with explicit approval | **NOT RUN** - intended restricted role URL and consent absent | Command exits 0 against intended restricted role/database, proving SELECT/INSERT allowed and UPDATE/DELETE/TRUNCATE denied |
| LMS object-store live preflight | `npm run accept:lms:object-storage -- --live` | `LMS_FILE_STORAGE_PROVIDER=s3-r2`, private throwaway object-store config, `LMS_PUBLIC_UPLOADS_ENABLED=false`, `LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE=1`, `LMS_OBJECT_STORAGE_LIVE_THROWAWAY=1` | **NOT RUN** - config and consent flags absent | Live PUT/read/DELETE/cleanup observations pass against approved throwaway target, retained summary scans clean |
| LMS external scanner live preflight | `npm run accept:lms:external-scanner -- --live` | `LMS_FILE_SCANNER_MODE=external`, HTTPS endpoint/token, `LMS_PUBLIC_UPLOADS_ENABLED=false`, `LMS_FILE_SCANNER_LIVE_ACCEPTANCE=1`, `LMS_FILE_SCANNER_LIVE_EICAR=1` | **NOT RUN** - config and consent flags absent | Live clean/quarantine/failure/timeout observations pass against approved scanner, retained summary scans clean |
| Stripe test checkout and webhook acceptance | Stripe test checkout plus `npm run accept:billing:stripe-webhook` / `npm run accept:billing:stripe-checkout` as scoped | Billing-provider decision, test `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MAP`, Stripe CLI/Dashboard replay setup | **NOT RUN** - provider and Stripe envs absent | Test-mode checkout reaches `pending_payment` -> `active`, real webhook replay passes, retained evidence scans clean |
| Axioma live bridge / handoff acceptance | `npm run accept:axioma:handoff-preflight` plus live endpoint-shape/account-link/download checks as scoped | Confirmed Axioma endpoint shapes, `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_HANDOFF_KEY_ID`, bridge token where required | **NOT RUN** - ES256 key/kid and bridge token absent | ES256/JWKS/handoff/account-link/download acceptance passes with confirmed endpoint shapes and retained evidence scans clean |
| Local site-readiness / safe-preview smoke | `npm test`; `npm run build -w @wtc/web`; `npm run e2e`; `npm run preview:safe` or scoped preview smoke | Local demo/mock preview scope; no live bot/provider/deploy mutation | **RUN/PASS in Phase 3.62** - root tests `921` passed, web build PASS, default e2e `44` passed / `8` skipped, `http://127.0.0.1:3000` returned `200` with a title containing `WTC Ecosystem` and `World Trader Club` | Cleared for local manual demo/mock website review only; screenshot inventory is not screenshot acceptance |
| Local auth DB-backed browser acceptance | `npm run e2e:auth:db:managed` | Existing-bot Postgres source approved by operator; in-process `AUTH_E2E_ADMIN_DATABASE_URL`, value never printed | **RUN/PASS in Phase 3.63** - throwaway DB `wtc_test_auth_20260602130742_099899` created/dropped, 17 migrations plus seed, real register/login Playwright `2` passed | Cleared for local auth registration/login DB-backed acceptance; not a production DB/server/deploy proof |
| Current WTC canary server smoke | Existing HTTPS canary smoke | Operator-approved SSH target, existing canary domain, rollback release, DB backup | **RUN/PASS in Phase 4.68** - public `/api/health` 200, home/login/products 200, protected bot/admin routes redirect to login, worker/Tortila/Legacy health ok | Cleared for WTC canary release `3aff273`; continue monitoring and rerun after future deploys |
| GitHub CI for current WTC release | GitHub Actions workflow on PR and `main` push | Git-backed repo, PR/push to GitHub | **RUN/PASS in Phase 4.68** - PR #8 and post-merge `main` CI run `27038370453` both passed `gates` and `e2e` | Cleared for merge commit `3aff2738815562c18f5623e9686c4c2f4ba2ef3a`; rerun for every future release commit |
| Current WTC canary deploy/server checks | Approved canary deploy checklist | Operator-approved SSH target, existing server secrets, rollback release, DB backup | **RUN/PASS in Phase 4.68** - new release mounted into `wtc-ecosystem-canary` and `wtc-ecosystem-worker`; bot services stayed active with unchanged PIDs | Cleared for existing WTC canary only; full branded production/live provider rollout remains separate |
| Canonical Tortila source landing | Source-control proof plus bot-side tests | Canonical git repo/path/remote/branch or source bundle | **RUN/PASS in Phase 4.70 for source-control/verifier** - private repo `papa-slon/tortila-canonical-source`, branch `main`, commit `f53a774c3bc4c14653906bd2f778a515c565cf12`; bot pytest/ruff PASS; export secret scan PASS; WTC verifier PASS | Source authority cleared; runtime deploy/auth/firewall remains separate |
| Strict Tortila managed real-read proof | `TORTILA_CANONICAL_SOURCE_REQUIRED=1 ... npm run accept:tortila:real-read:managed` | Disposable local/admin Postgres lane; canonical source checkout | **RUN/PASS in Phase 4.71** - separate local PG17 cluster, throwaway DB created/dropped, token matrix PASS, `sourceAdapter=tortila`, `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, `marksRequests=0`, cleanup verified | Cleared for local pre-deploy managed proof; rerun after relevant adapter/worker/journal/auth/runner changes |
| Legacy closed-trade source proof | Source artifact/API/table contract | Provider/pub_id scope, stable id, economics, timestamps, replay, raw allowlist | **NOT RUN** - no valid upstream Legacy source found | Source-proof preflight reports `ready_for_mapper`; fixture-backed mapper/import tests pass without secret/raw payload leakage |

## Safe Run Order When Credentials Arrive

1. Prefer the exact credentialed gate that matches the supplied credential. Do not broaden the phase.
2. Run one acceptance phase per session and launch read-only agents before edits or mutation.
3. Keep raw credential values out of chat, docs, logs, test fixtures, screenshots, and retained artifacts.
4. Archive only redacted command summaries, relative `logs/.../summary-*.json` paths, scanned text artifacts, and reviewed visual evidence.
5. After any live or credentialed run, record exact gates RUN and NOT RUN in the aggregate handoff and status docs.

## Not Production Ready

The standing production truth is unchanged: WTC is **not production-ready** until the remaining credentialed
DB/provider/server gates above are observed green in their intended environments. Phase 3.59 cleared local managed LMS DB
browser acceptance; Phase 3.60 cleared local active managed real-PG proof; Phase 3.61 cleared local generated-role
append-only audit proof, not the production/preview intended-role proof; Phase 3.62 cleared local demo/mock site-readiness;
Phase 3.63 cleared local production-readiness harness gaps and DB-backed auth browser acceptance; Phase 4.61 cleared
GitHub CI for the merged WTC release commit; Phase 4.62 clarified the missing deploy/source packets; Phase 4.68 clears the
existing WTC canary deploy for `3aff273`; Phase 4.69 adds a fail-closed Tortila canonical-source verifier; Phase 4.70
clears the Tortila canonical source-control/verifier gate; Phase 4.71 clears strict local managed Tortila real-read proof.
None of those clear full branded/live-provider production readiness.
