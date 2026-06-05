# phase-3-81 exchange-key readiness handoff
## Scope
Phase 3.81 implemented the smallest safe user-visible exchange-key "test" step for Tortila settings/setup: a WTC vault metadata readiness check. It does not claim live exchange connectivity.

Per-agent read-only handoffs launched before edits:
1. `docs/handoffs/20260603-2212-exchange-key-test-platform-security-auditor.md`
2. `docs/handoffs/20260603-2212-exchange-key-test-ux-auditor.md`
3. `docs/handoffs/20260603-2212-exchange-key-test-tests-auditor.md`

All three background agents were closed before this aggregate handoff/final report.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md`
5. `docs/STATUS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/NEXT_ACTIONS.md`
8. The three per-agent handoffs listed above
9. Exchange-key storage/audit paths in `packages/db/src/repositories.ts`, `apps/web/src/lib/db-store.ts`, `apps/web/src/lib/demo.ts`, `apps/web/src/lib/backend.ts`, `packages/shared/src/schemas.ts`
10. User key UX in `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`, `apps/web/src/app/(app)/app/security/page.tsx`
11. Safety tests in `tests/integration/bot-read-safety-static.test.ts`, `tests/integration/db-persistence.test.ts`, `tests/e2e/bot-settings.spec.ts`

## Files changed
1. `packages/shared/src/schemas.ts`
2. `packages/shared/src/index.ts`
3. `packages/db/src/repositories.ts`
4. `apps/web/src/lib/db-store.ts`
5. `apps/web/src/lib/demo.ts`
6. `apps/web/src/lib/backend.ts`
7. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
8. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
10. `apps/web/src/app/(app)/app/security/page.tsx`
11. `tests/integration/db-persistence.test.ts`
12. `tests/integration/bot-read-safety-static.test.ts`
13. `tests/e2e/bot-settings.spec.ts`
14. `docs/handoffs/20260603-2236-phase-3-81-exchange-key-readiness.md`

## Findings
1. High: a saved exchange key is not a live exchange connection proof. The UI now separates WTC metadata/vault readiness from the future read-only exchange ping.
2. High: the implemented check writes `exchange_key.test` with `checkKind: 'sealed_metadata_only'`, `livePing: false`, safe outcome/reason, exchange/mode/keyMask, and timestamp only.
3. High: the DB check selects owned `exchange_accounts` metadata and only the `exchange_api_key_secrets.id` marker. It does not select `sealed`, decrypt, open the vault, call adapters, call `fetch`, or touch live bots.
4. Medium: admin pages remain read-only; this phase adds no admin-side key test/edit/start/stop/apply controls.

## Decisions
1. User-facing button label is `Check WTC vault readiness`, not `Connection verified`.
2. Future action remains visible but disabled as `Run read-only exchange ping (future)`.
3. `/app/security` stays display-only for this slice; the active action is only on user-owned Tortila bot setup/settings pages with bot entitlement gating.
4. No schema migration was added; persistent live-ping state is deferred until an audited read-only exchange adapter contract exists.

## Risks
1. This is not a real exchange ping; users still need a future audited adapter before WTC can prove exchange reachability, permission scope, IP allowlist, or account-read access.
2. Demo/in-memory mode can show the readiness UX, but it is not production persistence.
3. Any future live ping must introduce rate limits, safe error taxonomy, no plaintext/log/screenshot leakage, and security plus bot-integration sign-off before enabling.

## Verification/tests
RUN:
1. `npm run test -- tests/integration/bot-read-safety-static.test.ts tests/integration/db-persistence.test.ts` - PASS, 40 tests.
2. `git diff --check` - PASS.
3. `npm run typecheck` - PASS.
4. `npm run typecheck -w @wtc/web` - PASS.
5. `npm run lint` - PASS.
6. `npm run secret:scan` - PASS.
7. `npm run e2e -- tests/e2e/bot-settings.spec.ts` - PASS, desktop/mobile 2 tests.
8. `npm run build -w @wtc/web` - PASS.
9. `npm run typecheck -w @wtc/worker` - PASS.
10. `npm run test -- tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/cabinet-pg9.test.ts` - PASS, 28 tests.
11. `npm run check:core` - PASS.
12. Static forbidden-string scan over the new readiness/action paths for `Connection verified`, old pending-audit label, `vault.open`, adapters, `fetch`, start/stop/apply, provider env names, and sealed projections - PASS/no matches.
13. `npm run governance:check` - PASS with one known historical warning for `20260529-1921-integration-risk-auditor.md`.
14. Final `git diff --check` - PASS.
15. Local web dev server started on `http://localhost:3300`; `Invoke-WebRequest http://localhost:3300/app/bots/tortila/settings` returned 200.

NOT RUN:
1. Live exchange ping/test - not run by policy; this phase is metadata-only.
2. Live bot start/stop/restart/apply-config/retest - not run by policy.
3. Worker tick/restart, SSH, tmux, systemd, provider DB live read/write, `.env` read/write - not run by policy.
4. Browser Plugin manual open - not run because the Browser tool did not become callable through tool discovery; Playwright and HTTP checks were used instead.

## Next actions
1. Design the future read-only exchange ping adapter contract separately: transient vault open only inside adapter boundary, safe result model, stale window, rate limits, safe errors, no raw provider output, and `exchange_key.test` audit semantics.
2. Extend cabinet setup signals to distinguish "exchange metadata saved" from "live ping verified".
3. Later admin read-only views may show metadata/live-ping status once a safe DTO exists, but must not add admin-side ping/edit/control actions.
