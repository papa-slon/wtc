# bot-browser-settings-security-auditor handoff
## Scope
Read-only Phase 4.18 security audit of local bot settings/setup browser acceptance boundaries. Focus was whether setup/settings acceptance remains WTC-side, read-only/mock-safe, free of live bot start/stop/apply behavior, free of exchange/provider calls, and free of plaintext secret exposure.

## Files inspected
- `AGENTS.md` task instructions provided in prompt
- `docs/SESSION_PROTOCOL.md`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/bots/config-action-handler.ts`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/backend.ts`
- `packages/db/src/repositories.ts`
- `packages/shared/src/schemas.ts`
- `tests/integration/cabinet-pg9.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-action-handler.test.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md`

## Files changed
None - read-only audit. Only this required handoff file was added: `docs/handoffs/20260604-1354-bot-browser-settings-security-auditor.md`.

## Findings
1. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:171`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:183`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:184`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:185`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:147`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:148`, `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md:37` - recommendation: align settings metadata checks with setup by changing denied access from `redirect(...keyCheck=missing)` to a silent no-op before `recordExchangeKeyMetadataCheck`, then add a static assertion that both setup and settings metadata actions do not redirect denied access to a key result; target part: settings exchange-key metadata readiness. The current settings path is still no-write, but it can misrepresent denied entitlement as missing key metadata.
2. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:113`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:115`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:121`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:122`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:135`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:137`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:147`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:148`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:153`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:161`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:169`, `tests/integration/cabinet-pg9.test.ts:104`, `tests/integration/cabinet-pg9.test.ts:117` - recommendation: preserve CSRF-first setup actions and centralized entitlement checks; target part: setup wizard server actions. Direct exchange-key actions re-check entitlement before parsing/persisting, and delegated config actions go through `resolveActionContext`.
3. Severity P1 - evidence `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:60`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:73`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:80`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:97`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:109`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:122`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:123`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:126`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:127`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:148`, `packages/db/src/repositories.ts:449`, `packages/db/src/repositories.ts:478`, `packages/db/src/repositories.ts:479`, `tests/integration/bot-read-safety-static.test.ts:496`, `tests/integration/bot-read-safety-static.test.ts:519` - recommendation: keep the only enabled readiness action as `Check WTC vault readiness`; add/keep static assertions that the future ping button is `type="button"` and `disabled`, not a submit; target part: exchange readiness browser acceptance. The inspected component and repo path are metadata-only and do not call adapters, exchanges, providers, or live bot control.
4. Severity P1 - evidence `apps/web/src/features/bots/config-action-handler.ts:51`, `apps/web/src/features/bots/config-action-handler.ts:75`, `apps/web/src/features/bots/config-action-handler.ts:76`, `apps/web/src/features/bots/config-action-handler.ts:77`, `apps/web/src/features/bots/config-action-handler.ts:92`, `apps/web/src/features/bots/config-action-handler.ts:165`, `apps/web/src/features/bots/config-action-handler.ts:167`, `apps/web/src/features/bots/config-action-handler.ts:196`, `apps/web/src/features/bots/config-action-handler.ts:198`, `apps/web/src/features/bots/config-action-handler.ts:224`, `apps/web/src/features/bots/config-action-handler.ts:226`, `tests/integration/bot-config-action-handler.test.ts:154`, `tests/integration/bot-config-action-handler.test.ts:155`, `tests/integration/bot-config-action-handler.test.ts:306`, `tests/integration/bot-config-action-handler.test.ts:317`, `tests/integration/bot-config-action-handler.test.ts:322` - recommendation: keep forbidden FormData keys rejected before parsing/preset lookup/persist/select; extend the forbidden-field loop to include `apiKey` as well as `apiSecret`; target part: config save/apply/system-default form safety. This is the main guard against hidden live-control or secret-shaped fields being smuggled through setup/settings config forms.
5. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:432`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:433`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:101`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:102`, `apps/web/src/lib/demo.ts:363`, `apps/web/src/lib/demo.ts:366`, `apps/web/src/lib/demo.ts:368`, `apps/web/src/lib/demo.ts:372`, `packages/db/src/repositories.ts:404`, `packages/db/src/repositories.ts:406`, `packages/db/src/repositories.ts:407`, `packages/db/src/repositories.ts:456`, `packages/db/src/repositories.ts:467`, `packages/db/src/repositories.ts:478`, `tests/integration/cabinet-pg9.test.ts:119`, `tests/integration/bot-read-safety-static.test.ts:513` - recommendation: preserve password inputs, key-mask-only rendering, no `exchange_api_key_secrets.sealed` selection, and audit/event payloads that contain only metadata; target part: secret exposure boundary. No inspected browser component renders plaintext `apiKey`, `apiSecret`, sealed blobs, raw provider payloads, or raw env values.
6. Severity P2 - evidence `tests/e2e/bot-settings.spec.ts:65`, `tests/e2e/bot-settings.spec.ts:67`, `tests/e2e/bot-settings.spec.ts:100`, `tests/e2e/bot-settings.spec.ts:194`, `tests/e2e/bot-settings.spec.ts:209`, `tests/e2e/bot-settings.spec.ts:289`, `tests/e2e/cabinet-pg9-mobile.spec.ts:36`, `tests/e2e/cabinet-pg9-mobile.spec.ts:39`, `tests/e2e/cabinet-pg9-mobile.spec.ts:50`, `tests/e2e/cabinet-pg9-mobile.spec.ts:52` - recommendation: add browser assertions for the disabled future exchange-ping button when a saved-key fixture is available, and keep checking absence of `Connection verified`, `applyConfig`, `startBot`, and `stopBot`; target part: local browser acceptance. Existing browser specs cover safe copy, readiness labels, and absence of live-control strings, but they do not yet prove the future ping control is disabled in rendered browser state.

## Decisions
- No code or product docs were edited.
- Ran only static/source integration gates that do not require live services, exchange/provider calls, raw env reads, migrations, seeding, or DB mutation.
- Did not run Playwright here because the current e2e specs write screenshots and may require a browser server/session; those are better run by the operator/foreground lane after accepting screenshot artifacts.
- Treated existing dirty worktree state as pre-existing and did not revert or normalize it.

## Risks
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` still has the denied-access metadata-check redirect shape that Phase 4.16 removed from setup. It is no-write, but the user-facing result can be misleading.
- Browser acceptance is string/copy-heavy today. Static tests are strong for source boundaries, but rendered coverage should add direct disabled-button assertions once a saved-key fixture exists.
- The worktree was heavily dirty before this audit, so final review should isolate this handoff and the exact cited source lines rather than treating the whole tree as this agent's change.

## Verification/tests
RUN:
- `npx vitest run tests/integration/cabinet-pg9.test.ts tests/integration/bot-read-safety-static.test.ts` - passed, 2 files / 43 tests.

NOT RUN:
- `tests/integration/bot-config-action-handler.test.ts` - not run in this read-only background lane because part of the file exercises an ephemeral migrated DB write path; recommended for the foreground acceptance lane.
- `tests/e2e/bot-settings.spec.ts` and `tests/e2e/cabinet-pg9-mobile.spec.ts` - not run because Playwright writes screenshots and may need app/browser orchestration; recommended after the settings denied-access parity fix.
- `node scripts/gates.mjs core`, full Playwright, production build, deploy, SSH/tmux/systemd, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, `db:migrate`, `db:seed`, and DB-backed acceptance - not run by scope and safety policy.

## Next actions
1. Fix settings metadata denied access to no-op before `recordExchangeKeyMetadataCheck`, matching setup.
2. Add exact static assertions:
   - Extract both `wizardCheckExchangeKeyMetadata` and `checkExchangeKeyMetadataAction`; assert each has `assertCsrf(formData)`, `exchangeKeyMetadataCheckSchema.safeParse`, `botAccessForUser`, and `recordExchangeKeyMetadataCheck`.
   - Assert each action does not match `getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|LEGACY_DATABASE_URL|TORTILA_JOURNAL_URL|apiKey|apiSecret|sealed`.
   - Assert each action does not match `if \(!access\.allowed\) redirect\(.*keyCheck=missing`.
   - Assert the settings action does match `if \(!access\.allowed\) return;` after the fix.
3. Add exact ExchangeKeyReadiness assertions:
   - `expect(exchangeKeyReadiness).toMatch(/type="button"[\s\S]*disabled[\s\S]*Run read-only exchange ping \(future\)/);`
   - `expect(exchangeKeyReadiness).not.toMatch(/type="submit"[\s\S]*Run read-only exchange ping/);`
4. Add `apiKey` to the `tests/integration/bot-config-action-handler.test.ts` forbidden-key loop and keep asserting no parse/persist/select calls after forbidden fields.
5. Recommended foreground gates after the fix: `npx vitest run tests/integration/cabinet-pg9.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts`, then `npx playwright test tests/e2e/bot-settings.spec.ts --project=chromium` and `npx playwright test tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile` if screenshot artifacts are allowed, then `node scripts/gates.mjs core`.
