# bot-browser-settings-gates-auditor handoff
## Scope
Read-only Phase 4.18 audit of local gates for the frontend/browser bot acceptance slice. Focus was exact commands to run, likely blockers, Playwright/local dev-server safety, retained screenshot review, and gates that must stay NOT RUN. No code, docs, live bot controls, exchange/provider calls, raw env reads, raw secret reads, db migrate/seed, or DB mutation were run.

## Files inspected
- `package.json`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `docs/SESSION_PROTOCOL.md`
- `AGENTS.md`
- Supporting gate/auth files: `scripts/check-retained-visual-artifacts.mjs`, `tests/e2e/helpers/auth.ts`
- Static test search: no exact `tests/integration/bot-settings-static*` file was found via `rg` under `tests/integration`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `scripts/gates.mjs:39`, `scripts/gates.mjs:50`, `scripts/gates.mjs:51`, `package.json:24`. The compact `core` and `full` gate plans include `db:generate`, so they are not the cleanest commands for a frontend/browser-only acceptance pass when the phase should avoid DB/schema writes. Recommendation: for this slice, run individual non-DB gates or `node scripts/gates.mjs quick` plus explicit build/secret scan; leave `db:generate` NOT RUN unless the operator intentionally approves schema-generation verification. Target part: local gate command selection.

2. Severity: Medium. Evidence: `playwright.config.ts:4`, `playwright.config.ts:5`, `playwright.config.ts:27`, `playwright.config.ts:31`, `playwright.config.ts:33`, `playwright.config.ts:36`, `playwright.config.ts:37`, `playwright.config.ts:38`, `tests/e2e/helpers/auth.ts:7`. The default Playwright harness is locally safe for browser acceptance: it starts `@wtc/web` on a dedicated localhost port, refuses stale server reuse, enables e2e auth bypass, forces `BOT_ADAPTER_MODE=mock`, and disables live bot control plus TV automation. Recommendation: use the default config and do not override these env values toward live adapters. Target part: Playwright/local dev server safety.

3. Severity: High. Evidence: `tests/e2e/bot-settings.spec.ts:102`, `tests/e2e/bot-settings.spec.ts:150`, `tests/e2e/bot-settings.spec.ts:314`, `tests/e2e/bot-settings.spec.ts:352`, `tests/e2e/bot-settings.spec.ts:367`, `tests/e2e/bot-readiness-map.spec.ts:32`, `tests/e2e/bot-readiness-map.spec.ts:46`, `tests/e2e/warning-summary-visual.spec.ts:66`, `tests/e2e/warning-summary-visual.spec.ts:99`, `tests/e2e/cabinet-pg9-mobile.spec.ts:28`, `tests/e2e/cabinet-pg9-mobile.spec.ts:57`. The targeted browser specs intentionally write retained PNG evidence to `tests/e2e/screenshots`. Recommendation: after running them, perform manual visual review and record a manifest, then run `npm run evidence:visual -- --manifest <workspace-local-review-manifest.json>`. `npm run evidence:visual -- --inventory` is useful inventory only and is not a review pass. Target part: retained visual evidence gate.

4. Severity: High. Evidence: `scripts/check-retained-visual-artifacts.mjs:11`, `scripts/check-retained-visual-artifacts.mjs:323`, `scripts/check-retained-visual-artifacts.mjs:324`. The visual artifact checker requires a review manifest whenever image files exist under the default screenshot root. Current metadata-only inventory observed 101 image files, 0 blocked binary/container artifacts, and no manifest file found by `rg`, so a plain `npm run evidence:visual` is a likely blocker until a manifest is created/updated. Recommendation: do not mark visual evidence green from screenshot existence alone. Target part: screenshot acceptance proof.

5. Severity: Medium. Evidence: `tests/e2e/bot-settings.spec.ts:194`, `tests/e2e/bot-settings.spec.ts:209`, `tests/e2e/bot-settings.spec.ts:223`, `tests/e2e/bot-settings.spec.ts:246`, `tests/e2e/bot-settings.spec.ts:268`, `tests/e2e/bot-settings.spec.ts:289`, `tests/e2e/bot-settings.spec.ts:394`, `tests/e2e/bot-readiness-map.spec.ts:29`, `tests/e2e/bot-readiness-map.spec.ts:43`, `tests/e2e/warning-summary-visual.spec.ts:53`, `tests/e2e/warning-summary-visual.spec.ts:55`. The browser tests assert no live-control/status claims such as `Connection verified`, `applyConfig`, `startBot`, or `stopBot`, and they require disabled live-control/readiness copy. Recommendation: treat failures in these assertions as safety regressions, not just copy/test churn. Target part: bot acceptance safety UX.

6. Severity: Medium. Evidence: `AGENTS.md:76`, `AGENTS.md:77`, `AGENTS.md:81`, `docs/SESSION_PROTOCOL.md:83`, `docs/SESSION_PROTOCOL.md:84`, `package.json:20`, `package.json:21`, `package.json:23`, `package.json:25`, `package.json:26`, `package.json:29`, `package.json:30`, `package.json:31`, `package.json:37`, `package.json:44`. This frontend/browser slice should not run worker, db, production-profile, managed DB, or external acceptance commands. Recommendation: final report must list those as NOT RUN with reasons instead of implying full platform coverage. Target part: NOT RUN gate honesty.

## Decisions
- Preferred browser acceptance command for this slice:
  `npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts`
- Preferred non-DB local gates before/around that browser run:
  `npm run lint`
  `npm run typecheck`
  `npm run typecheck -w @wtc/web`
  `npm run secret:scan`
  `npm test`
  `npm run build -w @wtc/web`
- Optional compact substitute for lint/typecheck/test only:
  `node scripts/gates.mjs quick`
- Visual evidence commands:
  `npm run evidence:visual -- --inventory`
  `npm run evidence:visual -- --manifest <workspace-local-review-manifest.json>`
- Avoid `node scripts/gates.mjs core` and `node scripts/gates.mjs full` for this browser-only slice unless the operator explicitly wants the `db:generate` gate included.

## Risks
- The checkout was already very dirty before this handoff, including modified app/package/test files and many untracked Phase 4 handoffs/specs. Do not attribute those changes to this read-only auditor.
- Targeted Playwright will write/update `tests/e2e/screenshots/*.png`; this is acceptable as test evidence only if the operator is ready to review and manifest those screenshots.
- Existing screenshot inventory means the visual evidence gate may fail because of old images as well as new ones unless the manifest covers all scanned images or a narrower explicit artifact root is used.
- `npm run ci:local` does not include Playwright and does not run the retained visual manifest gate, so it is not sufficient by itself for this browser acceptance slice.

## Verification/tests
- RUN: `git status --short --branch` for checkout state.
- RUN: read-only inspection of requested files and supporting auth/visual gate files.
- RUN: `rg` search for `tests/integration/bot-settings-static*`; no exact match found.
- RUN: `npm run evidence:visual -- --inventory`; observed `101 image file(s), 0 blocked binary/container artifact(s), 0 missing root(s), 102 total artifact file(s), 0 dynamic marker(s)`.
- NOT RUN: targeted Playwright browser command, because this agent was asked to inspect gates and only write the handoff.
- NOT RUN: `node scripts/gates.mjs quick`, `core`, `full`, `e2e`; they execute substantial gates, and `core/full` include `db:generate`.
- NOT RUN: `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`; DB/schema generation or mutation is outside this read-only browser-gates audit.
- NOT RUN: `npm run dev:worker`, `npm run worker:tick`, `npm run worker:smoke`, `npm run accept:worker:continuity`; worker/runtime continuity is outside this frontend/browser acceptance slice.
- NOT RUN: `npm run e2e:auth:production-profile`, `npm run e2e:auth:db`, `npm run e2e:auth:db:managed`, DB-managed e2e variants, and external `accept:*` provider/preflight commands; they are outside this local mock browser slice and may require live credentials/providers/DB state.
- NOT RUN: live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, db migrate/seed, or DB mutation.

## Next actions
1. Operator/implementer runs non-DB local gates: `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run secret:scan`, `npm test`, `npm run build -w @wtc/web`.
2. Operator/implementer runs targeted Playwright: `npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts`.
3. Manually review retained screenshots for layout, overflow, and secret-like text, then create/update a workspace-local visual review manifest covering the scanned PNGs.
4. Run `npm run evidence:visual -- --manifest <workspace-local-review-manifest.json>` and record exact RUN/NOT RUN gate results in the Phase 4.18 aggregate handoff.
