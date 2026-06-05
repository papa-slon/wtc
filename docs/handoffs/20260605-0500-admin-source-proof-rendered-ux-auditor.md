# admin-source-proof-rendered-ux-auditor handoff
## Scope
Read-only UX/rendered acceptance audit for Phase 4.50. Scope was to inspect the admin selected-user DB Playwright fixture/spec and the current Phase 4.49 selected-user Legacy source-proof UI, then recommend exact rendered assertions and markers for the Legacy Source-proof gate without adding controls.

This audit did not read env or secret files, did not start live services, did not mutate a database, did not run server/bot control, and did not edit code, tests, or docs beyond this required handoff. This was one requested auditor lane; no background agent fan-out or N-agent claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md`
- `docs/handoffs/20260605-0490-admin-selected-user-source-proof-ux-auditor.md`
- `package.json`
- `playwright.admin-user-bots-db.config.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - The DB fixture already seeds the exact source-proof acceptance data, but the rendered DB spec does not assert the source-proof row or its provenance. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:360`-`scripts/prepare-admin-user-bot-detail-e2e.ts:396` seeds a newer unscoped Legacy proof plus an older scoped worker proof; `apps/web/src/features/admin/user-bot-detail-loader.ts:1203`-`apps/web/src/features/admin/user-bot-detail-loader.ts:1212` skips unscoped Legacy metric rows before selecting the latest proof; `tests/e2e/admin-user-bot-detail-db.spec.ts:109`-`tests/e2e/admin-user-bot-detail-db.spec.ts:146` lists common visible markers but does not include `Source-proof gate`, `mapper-ready proof`, `scoped worker metric`, or `build audited mapper/importer`. Recommendation: add those markers to the DB Playwright assertion path. Target part: `tests/e2e/admin-user-bot-detail-db.spec.ts`.
2. Severity P1 - The current fixture contains secret-shaped and raw source-proof fields that should be explicitly negative-asserted in rendered body text, but the e2e hidden marker list does not include them. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:367`-`scripts/prepare-admin-user-bot-detail-e2e.ts:393` seeds `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER`, `SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER`, raw payload, blocker, evidence ref, raw provider id, and raw API key markers; `tests/e2e/admin-user-bot-detail-db.spec.ts:148`-`tests/e2e/admin-user-bot-detail-db.spec.ts:199` omits these source-proof-specific hidden markers; the sanitizer keeps only safe status/provenance fields in `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:156`-`packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:176`. Recommendation: extend `HIDDEN_MARKERS` with every seeded source-proof raw marker plus `rawPayloadAllowlist`, `unsafeRawPayloadFields`, `evidenceRef`, and `liveConfig`. Target part: rendered leakage proof.
3. Severity P1 - The rendered acceptance should prove the Source-proof gate is Legacy-only. Evidence: the UI conditionally adds the row only for `legacy_bot` in `apps/web/src/app/admin/users/[userId]/bots/page.tsx:217`-`apps/web/src/app/admin/users/[userId]/bots/page.tsx:227`, and each coverage table has an aria label at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:877`. Recommendation: assert one `Source-proof gate` inside `Legacy Bot statistics coverage matrix` and zero inside `Tortila Bot statistics coverage matrix`. Target part: Playwright row-level assertions.
4. Severity P2 - The exact current DB fixture should assert the scoped ready path, not the global blocked fallback. Evidence: the scoped metric raw proof is `ready_for_mapper` and `canImportClosedTrades: true` in `scripts/prepare-admin-user-bot-detail-e2e.ts:382`-`scripts/prepare-admin-user-bot-detail-e2e.ts:385`; the admin page labels that as `mapper-ready proof` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:63`-`apps/web/src/app/admin/users/[userId]/bots/page.tsx:69`, says `scoped worker metric` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:91`-`apps/web/src/app/admin/users/[userId]/bots/page.tsx:94`, and renders `build audited mapper/importer` when `canImportClosedTrades` is true at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:220`-`apps/web/src/app/admin/users/[userId]/bots/page.tsx:224`. Recommendation: do not assert `source proof blocked` in this DB fixture unless a separate fallback/no-scoped-proof fixture is added. Target part: marker expectation design.
5. Severity P2 - The source-proof row should remain informational and control-free. Evidence: the page renders coverage rows as table cells only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:883`-`apps/web/src/app/admin/users/[userId]/bots/page.tsx:888`, and the current DB spec already checks no forms, hidden CSRF inputs, or start/stop/apply/test buttons at `tests/e2e/admin-user-bot-detail-db.spec.ts:274`-`tests/e2e/admin-user-bot-detail-db.spec.ts:276`. Recommendation: add row-scoped checks that the source-proof row has no buttons or links, while retaining the page-level no-form/no-live-control assertions. Target part: no-control rendered acceptance.

## Decisions
1. Recommended no new card, CTA, button, form, modal, or settings control. The acceptance target is the existing Legacy statistics coverage matrix and closed-trade metric sublabel.
2. Recommended adding rendered assertions to the existing guarded DB Playwright spec rather than adding a new runner.
3. Recommended keeping source-proof rendered markers scenario-independent because the managed runtime matrix changes health/worker rows, not the seeded Legacy source-proof fixture.
4. Recommended treating the current DB fixture as scoped-worker proof selection acceptance; global-preflight fallback remains covered by static/loader tests unless a later rendered fixture adds a no-scoped-proof case.

## Risks
1. If the DB spec asserts only generic body markers, a regression could remove the rendered `Source-proof gate` while loader/static tests still pass.
2. If source-proof raw markers stay outside `HIDDEN_MARKERS`, screenshots/body text could leak future raw proof payload fields without the selected-user DB gate catching it.
3. If the DB fixture asserts `source proof blocked` instead of the seeded `mapper-ready proof`, the test will either fail incorrectly or encourage changing the fixture away from its current scoped-worker selection purpose.
4. If row-scoped assertions are not used, duplicate text elsewhere on the page could hide a missing coverage-table row.

## Verification/tests
RUN:
1. Static inspection only with `Get-Content`, `rg`, and line-number snippets on the files listed above.
2. Checked git state with `git status --short --branch`; the tree was already heavily dirty before this audit.
3. Confirmed the requested handoff path did not exist before writing.
4. Confirmed no env/secret files were read, no server was started, no DB command was run, no live service was called, and no bot-control action was invoked.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; this audit is read-only and the managed DB env was not supplied in scope.
2. `npm run e2e:admin-user-bots:db` - not run; it requires an explicit throwaway Postgres DB URL and would start the guarded Playwright web server.
3. Playwright/browser checks - not run; no live services per scope.
4. Vitest/typecheck/lint/build/secret scan/governance - not run; this was a read-only UX/rendered acceptance audit.
5. Live Legacy DB/provider/exchange probes, live exchange ping, live bot start/stop/apply-config - not run and not permitted.
6. Production deploy, canary switch, GitHub CI, and monitoring - outside scope.

## Next actions
1. In `tests/e2e/admin-user-bot-detail-db.spec.ts`, add these visible markers for the current DB fixture:
   - `Source-proof gate`
   - `mapper-ready proof`
   - `scoped worker metric`
   - `Source contract is mapper-ready; importer replay still needs its own gate.`
   - `build audited mapper/importer`
   - `mapper-ready proof - realized PnL pending import`
2. Add row-scoped assertions similar to:

```ts
const legacyCoverage = page.getByLabel('Legacy Bot statistics coverage matrix');
const tortilaCoverage = page.getByLabel('Tortila Bot statistics coverage matrix');
const sourceProofRow = legacyCoverage.locator('tbody tr').filter({ hasText: 'Source-proof gate' });

await expect(sourceProofRow).toHaveCount(1);
await expect(sourceProofRow).toContainText('mapper-ready proof');
await expect(sourceProofRow).toContainText('Legacy closed-trade source proof is evaluated before importer work from scoped worker metric.');
await expect(sourceProofRow).toContainText('Source contract is mapper-ready; importer replay still needs its own gate.');
await expect(sourceProofRow).toContainText('build audited mapper/importer');
await expect(sourceProofRow.getByRole('button')).toHaveCount(0);
await expect(sourceProofRow.getByRole('link')).toHaveCount(0);
await expect(tortilaCoverage.getByText('Source-proof gate')).toHaveCount(0);
await expect(page.getByText('mapper-ready proof - realized PnL pending import')).toBeVisible();
```

3. Extend `HIDDEN_MARKERS` with:
   - `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER`
   - `SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER`
   - `SOURCE_PROOF_PAYLOAD_ALLOWLIST_SHOULD_NOT_RENDER`
   - `SOURCE_PROOF_BLOCKER_SHOULD_NOT_RENDER`
   - `SOURCE_PROOF_EVIDENCE_REF_SHOULD_NOT_RENDER`
   - `SOURCE_PROOF_RAW_PROVIDER_ID_SHOULD_NOT_RENDER`
   - `SOURCE_PROOF_RAW_API_KEY_SHOULD_NOT_RENDER`
   - `rawPayloadAllowlist`
   - `unsafeRawPayloadFields`
   - `evidenceRef`
   - `liveConfig`
4. When the managed DB env is intentionally supplied, run `npm run e2e:admin-user-bots:db:managed:matrix` and retain only redacted stdout plus reviewed/scanner-clean screenshots/artifacts.
