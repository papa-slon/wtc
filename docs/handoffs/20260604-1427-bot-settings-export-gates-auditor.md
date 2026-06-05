# bot-settings-export-gates-auditor handoff
## Scope
Phase 4.19 read-only gates/test audit for the safest focused local mock acceptance commands around bot settings export/download copy and generated Tortila `SYMBOL_CONFIGS`.

Constraints honored:
- Do not edit code.
- Write only this handoff artifact.
- Do not run Playwright, DB mutation, migrate/seed, live provider, or raw-env commands.
- Determine commands to RUN later and commands to leave NOT RUN.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `package.json`
- `playwright.config.ts`
- `scripts/gates.mjs`
- `tests/e2e/bot-settings.spec.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`

Targeted export/copy wiring search also touched:
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`

## Files changed
None -- read-only audit. Handoff artifact written: `docs/handoffs/20260604-1427-bot-settings-export-gates-auditor.md`.

## Findings
1. Severity: Medium. Evidence: `package.json:14`, `tests/integration/bot-config-export-static.test.ts:14`, `tests/integration/bot-config-export-static.test.ts:17`, `tests/integration/bot-config-export-static.test.ts:20`, `tests/integration/bot-config-export-static.test.ts:24`, `tests/integration/bot-config-export-static.test.ts:30`, `tests/integration/bot-config-export-static.test.ts:39`, `tests/integration/bot-config-export-static.test.ts:45`, `tests/integration/bot-config-export-static.test.ts:49`. Recommendation: run the focused Vitest command first because it is the narrowest non-browser gate for export surface, native filenames, no-key guarantees, session/entitlement gating, and route surfacing. Target part: static export and route wiring.

2. Severity: Medium. Evidence: `tests/integration/bot-config-export-route-handler.test.ts:90`, `tests/integration/bot-config-export-route-handler.test.ts:98`, `tests/integration/bot-config-export-route-handler.test.ts:121`, `tests/integration/bot-config-export-route-handler.test.ts:139`, `tests/integration/bot-config-export-route-handler.test.ts:172`, `tests/integration/bot-config-export-route-handler.test.ts:193`, `tests/integration/bot-config-export-route-handler.test.ts:196`, `tests/integration/bot-config-export-route-handler.test.ts:198`, `tests/integration/bot-config-export-route-handler.test.ts:203`, `tests/integration/bot-config-export-route-handler.test.ts:230`, `tests/integration/bot-config-export-route-handler.test.ts:234`, `tests/integration/bot-config-export-route-handler.test.ts:237`. Recommendation: include the extracted route-handler Vitest in the focused command because it exercises mocked unauthenticated, denied-entitlement, Tortila env export, and Legacy JSON export behavior without live DB/provider access. Target part: config-export response safety and `SYMBOL_CONFIGS` payload.

3. Severity: Medium. Evidence: `playwright.config.ts:4`, `playwright.config.ts:8`, `playwright.config.ts:24`, `playwright.config.ts:25`, `playwright.config.ts:27`, `playwright.config.ts:28`, `playwright.config.ts:33`, `playwright.config.ts:36`, `playwright.config.ts:37`, `playwright.config.ts:38`, `tests/e2e/bot-settings.spec.ts:99`, `tests/e2e/bot-settings.spec.ts:100`, `tests/e2e/bot-settings.spec.ts:101`, `tests/e2e/bot-settings.spec.ts:103`, `tests/e2e/bot-settings.spec.ts:104`, `tests/e2e/bot-settings.spec.ts:106`, `tests/e2e/bot-settings.spec.ts:155`, `tests/e2e/bot-settings.spec.ts:156`, `tests/e2e/bot-settings.spec.ts:158`. Recommendation: if browser proof is authorized after static tests, run only the single settings workbench test with `--grep` and an explicit project first; it starts a dedicated mock dev server with live control disabled and checks generated Tortila `SYMBOL_CONFIGS` plus Tortila/Legacy export links/copy. Target part: local mock browser acceptance.

4. Severity: Low. Evidence: `tests/e2e/bot-settings.spec.ts:103`, `tests/e2e/bot-settings.spec.ts:104`, `tests/e2e/bot-settings.spec.ts:155`, `tests/e2e/bot-settings.spec.ts:156`, `tests/integration/bot-config-export-static.test.ts:45`, `tests/integration/bot-config-export-static.test.ts:49`; targeted copy search found no scoped clipboard/copy-button assertion. Recommendation: do not claim clipboard-copy acceptance from the current scoped tests. The focused browser command proves export link/copy text and generated `SYMBOL_CONFIGS`, while route-handler Vitest proves downloadable payload safety. Target part: acceptance wording.

5. Severity: High. Evidence: `AGENTS.md:74`, `AGENTS.md:76`, `AGENTS.md:77`, `AGENTS.md:81`, `AGENTS.md:82`, `docs/SESSION_PROTOCOL.md:52`, `docs/SESSION_PROTOCOL.md:54`, `docs/SESSION_PROTOCOL.md:57`, `docs/SESSION_PROTOCOL.md:81`, `docs/SESSION_PROTOCOL.md:83`, `docs/SESSION_PROTOCOL.md:84`, `package.json:25`, `package.json:26`, `package.json:37`, `package.json:38`, `package.json:39`, `package.json:40`, `package.json:41`, `package.json:42`, `package.json:43`, `package.json:44`. Recommendation: leave DB mutation, migrate/seed, managed real-Postgres, live provider preflights, and bot control/smoke commands NOT RUN for this focused slice. Target part: safety gates and non-negotiables.

6. Severity: Medium. Evidence: `scripts/gates.mjs:13`, `scripts/gates.mjs:15`, `scripts/gates.mjs:16`, `scripts/gates.mjs:17`, `scripts/gates.mjs:20`, `scripts/gates.mjs:44`, `scripts/gates.mjs:47`, `scripts/gates.mjs:50`, `scripts/gates.mjs:51`, `scripts/gates.mjs:53`, `scripts/gates.mjs:107`, `scripts/gates.mjs:116`. Recommendation: do not run `node scripts/gates.mjs *` inside this read-only audit because the runner writes `logs/gates/*`, and its plans are broader than the export/settings slice. If an implementation session needs aggregate confidence later, run it only after focused commands and with artifact writes allowed. Target part: gate runner selection.

7. Severity: Medium. Evidence: `tests/integration/bot-read-safety-static.test.ts:91`, `tests/integration/bot-read-safety-static.test.ts:95`, `tests/integration/bot-read-safety-static.test.ts:115`, `tests/integration/bot-read-safety-static.test.ts:118`, `tests/integration/bot-read-safety-static.test.ts:123`, `tests/integration/bot-read-safety-static.test.ts:124`, `tests/integration/bot-read-safety-static.test.ts:238`, `tests/integration/bot-read-safety-static.test.ts:242`, `tests/integration/bot-read-safety-static.test.ts:253`, `tests/integration/bot-read-safety-static.test.ts:254`, `tests/integration/bot-read-safety-static.test.ts:463`, `tests/integration/bot-read-safety-static.test.ts:485`, `tests/integration/bot-read-safety-static.test.ts:489`, `tests/integration/bot-read-safety-static.test.ts:496`, `tests/integration/bot-read-safety-static.test.ts:531`, `tests/integration/bot-read-safety-static.test.ts:535`. Recommendation: include this static safety test in the first focused command because it checks the settings/readiness/export-adjacent surfaces stay server-only where needed, entitlement-gated, mock/demo-honest, and free of live-control/exchange-secret semantics. Target part: read safety around settings acceptance.

## Decisions
Recommended commands to RUN in the next acceptance session:

1. Focused static/export/read-safety gate:
   `npm test -- tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-read-safety-static.test.ts`

2. Safest first browser proof, desktop only, mock server, single test:
   `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --grep "bot settings workbench renders safe coin configuration"`

3. Optional responsive browser proof after desktop passes:
   `npx playwright test tests/e2e/bot-settings.spec.ts --project=mobile --grep "bot settings workbench renders safe coin configuration"`

Commands/gates to leave NOT RUN for this focused audit/slice:

- `npm run db:migrate` -- DB mutation, explicitly outside scope.
- `npm run db:seed` -- DB mutation/seed, explicitly outside scope.
- `npm run accept:real-pg:managed` -- managed real Postgres, raw-env/secrets sensitive, outside local mock slice.
- `npm run accept:audit:append-only-role` and `npm run accept:audit:append-only-role:managed` -- DB/audit preflight, unrelated and outside local mock slice.
- `npm run accept:lms:object-storage`, `npm run accept:lms:external-scanner`, `npm run accept:billing:stripe-webhook`, `npm run accept:billing:stripe-checkout`, `npm run accept:axioma:handoff-preflight` -- live/external/provider style acceptance, unrelated to bot settings export.
- `npm run worker:tick`, `npm run worker:smoke`, `npm run accept:worker:continuity` -- worker/runtime proof, not needed for settings export/copy acceptance and may touch DB/runtime paths.
- `npm run e2e`, `npx playwright test`, `node scripts/gates.mjs e2e` -- too broad for the slice; run many specs and/or write retained logs/artifacts.
- `node scripts/gates.mjs quick`, `node scripts/gates.mjs core`, `node scripts/gates.mjs full`, `node scripts/gates.mjs build` -- broad aggregate gates and `logs/gates/*` writes; defer to aggregate/implementation session.
- Full `tests/e2e/bot-settings.spec.ts` without `--grep` -- includes additional local save/key-readiness flows beyond export/generated-SYMBOL_CONFIGS proof.

## Risks
- The recommended Playwright commands are safe with respect to live provider control because `playwright.config.ts` forces `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`, but they still start a local Next dev server and write screenshot/test artifacts. They were therefore not run in this one-handoff-only audit.
- The single grepped Playwright test does not click the download link or validate the downloaded body. Payload/body safety is covered by the route-handler Vitest instead.
- No scoped test currently proves a clipboard-copy button or clipboard API behavior. Treat "copy" coverage as product copy/export-link text unless a future phase adds an explicit copy control and test.
- `scripts/gates.mjs` is useful for aggregate confidence but intentionally writes retained logs; it conflicts with the audit's "only one handoff file" write constraint.

## Verification/tests
Gates RUN this session:
- None. This session performed read-only inspection and command selection only.

Inspection commands RUN this session:
- `git status --short --branch`
- `Get-ChildItem -Force`
- `Get-Content` line-number inspections of the scoped protocol/config/test files
- `rg` targeted searches for export, `SYMBOL_CONFIGS`, copy/clipboard, and gate wiring

Gates NOT RUN this session:
- `npm test -- tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-read-safety-static.test.ts` -- recommended for next acceptance session, but not executed because this audit was command-wiring only.
- `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --grep "bot settings workbench renders safe coin configuration"` -- recommended for next acceptance session, but not executed because Playwright/artifact writes were excluded.
- `npx playwright test tests/e2e/bot-settings.spec.ts --project=mobile --grep "bot settings workbench renders safe coin configuration"` -- optional after desktop, not executed.
- All DB mutation/migrate/seed/live provider/raw-env/worker/runtime/full e2e/aggregate gates listed in Decisions -- outside scope or unsafe for this read-only audit.

## Next actions
1. In the acceptance session, run the focused Vitest command first.
2. If it passes and browser artifacts are allowed, run the single grepped Playwright desktop command.
3. Run the optional mobile grepped command only if responsive screenshot/browser proof is required.
4. Do not claim clipboard-copy acceptance until a copy/clipboard control is explicitly tested.
5. Keep aggregate `scripts/gates.mjs`, full e2e, DB, worker, and live/external acceptance commands for a separate broader gate phase.
