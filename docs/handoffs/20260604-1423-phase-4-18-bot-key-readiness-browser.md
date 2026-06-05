# phase-4-18-bot-key-readiness-browser handoff
## Scope
Phase 4.18 foreground implementation and acceptance for the local Legacy/Tortila bot settings/setup browser slice. The main objective was to prove the Tortila exchange-key setup path is understandable and safe: saving a dummy key remains WTC-side metadata/vault readiness only, never claims live exchange connectivity, never starts/stops/applies bot config, and never renders plaintext key material. This phase also fixed the settings metadata-check denied-access result so it fails closed as a no-op instead of redirecting to a misleading missing-key state.

Read-only background agents were launched before edits, per `AGENTS.md` / `docs/SESSION_PROTOCOL.md`.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md`
- `docs/handoffs/20260604-1349-phase-4-17-admin-runtimehealth-scenario-matrix.md`
- `docs/handoffs/20260604-1354-bot-browser-settings-ux-auditor.md`
- `docs/handoffs/20260604-1354-bot-browser-settings-security-auditor.md`
- `docs/handoffs/20260604-1354-bot-browser-settings-gates-auditor.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/config-action-handler.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-action-handler.test.ts`
- `tests/integration/cabinet-pg9.test.ts`
- `playwright.config.ts`
- `package.json`

## Files changed
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` - changed `checkExchangeKeyMetadataAction` denied access from misleading `keyCheck=missing` redirect to silent no-op, matching setup behavior.
- `tests/e2e/bot-settings.spec.ts` - added a Tortila setup key-readiness browser scenario that saves a dummy key, checks WTC vault readiness, asserts disabled future exchange ping, asserts no live-control or connection-verified claims, asserts no plaintext/base64 key material, and captures desktop/mobile screenshots.
- `tests/integration/bot-read-safety-static.test.ts` - locked metadata-only readiness boundaries: future ping button must be disabled `type="button"`, metadata actions must no-op denied access rather than redirect to missing key, no exchange/provider/live-control/secret reads are allowed in those actions.
- `tests/integration/bot-config-action-handler.test.ts` - added `apiKey` to the forbidden FormData smuggling loop alongside `apiSecret` and live-control fields.
- `docs/handoffs/20260604-1423-phase-4-18-bot-key-readiness-browser.md` - this aggregate handoff.

Retained screenshots reviewed:
- `tests/e2e/screenshots/bot-tortila-key-readiness-desktop.png`
- `tests/e2e/screenshots/bot-tortila-key-readiness-mobile.png`

## Agent handoffs
- UX/browser audit: `docs/handoffs/20260604-1354-bot-browser-settings-ux-auditor.md`
- Security audit: `docs/handoffs/20260604-1354-bot-browser-settings-security-auditor.md`
- Gates audit: `docs/handoffs/20260604-1354-bot-browser-settings-gates-auditor.md`

## Findings
1. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`, `docs/handoffs/20260604-1354-bot-browser-settings-security-auditor.md` - settings metadata check was no-write but could misrepresent denied entitlement as missing exchange-key metadata. Recommendation implemented: denied access now returns without redirecting or recording a metadata check. Target part: Tortila settings exchange-key readiness.
2. Severity P1 - evidence `tests/e2e/bot-settings.spec.ts`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx` - browser acceptance now proves the user can save a dummy exchange key and see exact WTC-side readiness language: `WTC metadata`, `Format check`, `Exchange ping not run`, `Live bot control disabled`, disabled future ping button, and `No live exchange ping was run`. Target part: user setup clarity.
3. Severity P1 - evidence `tests/integration/bot-read-safety-static.test.ts`, `tests/integration/bot-config-action-handler.test.ts` - static gates now prevent future regressions where metadata readiness calls adapters/network/live controls or where config forms smuggle `apiKey`/`apiSecret`/live-control fields. Target part: secret and live-control boundary.
4. Severity P2 - evidence `npx playwright test tests/e2e/bot-settings.spec.ts` - combined desktop+mobile full spec exceeded the 184s tool timeout without a failure report. Recommendation: use split per-project commands for this heavy screenshot spec in this Windows workspace. Target part: browser gate execution ergonomics.

## Decisions
- Kept this phase as a local mock/browser acceptance slice. No live exchange ping, no live bot controls, no provider/exchange calls, and no DB-backed admin matrix were bundled into it.
- Treated `tests/e2e/bot-settings.spec.ts --project=desktop` and `--project=mobile` as the reliable full-file browser acceptance commands after the combined all-project command timed out.
- Used `node scripts/gates.mjs quick` rather than `core` because `core` includes `db:generate`; this phase intentionally avoided DB/schema generation and migration.
- Visual evidence was manually reviewed for the two new key-readiness screenshots and inventoried with `--inventory`; no review manifest was created in this phase.

## Risks
- This does not prove real exchange connectivity. The UI correctly says the future exchange ping is unavailable and disabled.
- This does not prove real worker continuity or production DB persistence for the newly saved key; the browser run uses the default local Playwright mock/demo harness.
- The worktree was heavily dirty before this phase, with many pre-existing modified/untracked files and prior phase handoffs. This phase only claims the changes listed above.
- The combined all-project Playwright command timed out once; split desktop and mobile runs passed and are the recorded evidence.

## Verification/tests
RUN:
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "Tortila setup key readiness"` - passed, 2/2 desktop+mobile.
- `npx vitest run tests/integration/cabinet-pg9.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts` - passed, 3 files / 58 tests.
- `npx eslint "apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx" "tests/e2e/bot-settings.spec.ts" "tests/integration/bot-read-safety-static.test.ts" "tests/integration/bot-config-action-handler.test.ts" --max-warnings 0` - passed.
- `npm run typecheck -w @wtc/web` - passed.
- `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop` - passed, 10/10.
- `npx playwright test tests/e2e/bot-settings.spec.ts --project=mobile` - passed, 10/10.
- `node scripts/gates.mjs quick` - passed, 4/4 gates: lint, typecheck, typecheck-web, test.
- `npm run evidence:visual -- --inventory` - passed inventory: 103 image files, 0 blocked binary/container artifacts, 0 missing roots, 104 total artifact files, 0 dynamic markers.
- Manual visual review of `bot-tortila-key-readiness-desktop.png` and `bot-tortila-key-readiness-mobile.png` - no obvious horizontal breakage, plaintext key, live-control claim, or live exchange verification claim observed.
- `git diff --check` - passed.

RUN WITH NON-GREEN RESULT:
- `npx playwright test tests/e2e/bot-settings.spec.ts` - timed out after 184s without a failure report; not claimed green. Replaced by split desktop/mobile full-file runs above.

NOT RUN:
- `node scripts/gates.mjs core` / `full` - skipped because they include `db:generate`; this phase avoided DB/schema generation.
- `npm run evidence:visual -- --manifest <manifest>` - skipped because no review manifest was created; only inventory plus manual review of the two new screenshots were performed.
- `npm run e2e`, `node scripts/gates.mjs e2e`, and unrelated Playwright suites - skipped to keep this phase scoped to bot settings/setup acceptance.
- `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix` - skipped; require an explicit disposable Postgres target and are covered as a separate admin runtimeHealth phase.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` - skipped by phase safety/scope.
- `npm run dev:worker`, `npm run worker:tick`, `npm run worker:smoke`, `npm run accept:worker:continuity` - skipped; worker continuity is a separate phase.
- Live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, SSH/tmux/systemd/deploy - skipped by non-negotiable gates.

## Next actions
1. Run a separate DB-backed disposable Postgres phase for saved exchange-key persistence and admin/user drilldown if explicit DB credentials are supplied.
2. Add a workspace-local visual review manifest if retained screenshot evidence needs to be promoted from manual review/inventory to a formal manifest gate.
3. Continue with the next narrow acceptance slice: either Tortila settings export/copy exactness or cabinet 375px setup expansion from the UX auditor handoff.
