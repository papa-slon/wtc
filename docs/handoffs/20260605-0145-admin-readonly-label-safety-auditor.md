# admin-readonly-label-safety-auditor handoff
## Scope
Read-only Phase 4.43 audit of admin action labels and safety/test boundaries. Verified that explicit read-only admin language does not imply admin can edit user settings, exchange keys, provider mappings, start/stop/apply config, or live bot state. No product code or tests were edited; live/provider/deploy commands were not run.

## Files inspected
- apps/web/src/app/admin/users/page.tsx
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx
- apps/web/src/features/admin/actions.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/e2e/admin-mobile-pg8.spec.ts
- docs/BOT_CONTROL_SAFETY_MODEL.md
- docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md

## Files changed
docs/handoffs/20260605-0145-admin-readonly-label-safety-auditor.md

## Findings
1. Severity P1 - Current admin user-directory labels are explicit read-only navigation labels and do not imply mutation authority. Evidence: `apps/web/src/app/admin/users/page.tsx:66`, `apps/web/src/app/admin/users/page.tsx:82`, `apps/web/src/app/admin/users/page.tsx:103`, and `apps/web/src/app/admin/users/page.tsx:306`; matching static assertions are present at `tests/integration/bot-read-safety-static.test.ts:428`, `tests/integration/bot-read-safety-static.test.ts:429`, `tests/integration/admin-user-bot-detail-static.test.ts:301`, and `tests/integration/admin-user-bot-detail-static.test.ts:317`. Recommendation: keep these labels as navigation-only strings and preserve the paired negative assertions for secrets/control tokens. Target part: admin user directory and bot owner selector.
2. Severity P2 - `/admin/bots` still has one generic mapped-user link label, `Open details`, in the Legacy/Tortila mapped user summary. Evidence: `apps/web/src/app/admin/bots/page.tsx:197`, `apps/web/src/app/admin/bots/page.tsx:198`, with usage at `apps/web/src/app/admin/bots/page.tsx:774`, `apps/web/src/app/admin/bots/page.tsx:831`, `apps/web/src/app/admin/bots/page.tsx:860`, and `apps/web/src/app/admin/bots/page.tsx:883`. Recommendation: rename this helper link to explicit read-only language such as `Open read-only user view`, then add static assertions that `Open details` no longer appears on admin bot surfaces. Target part: admin fleet Legacy inspector and mapped-user summary rows.
3. Severity P2 - Rendered/mobile acceptance does not assert the new read-only action labels or selected-user boundary pills outside `/admin/bots`. Evidence: `tests/e2e/admin-mobile-pg8.spec.ts:20` through `tests/e2e/admin-mobile-pg8.spec.ts:29` includes `/admin/users` and `/admin/users/demo-user/bots`, but the only read-only evidence assertion is scoped to `/admin/bots` at `tests/e2e/admin-mobile-pg8.spec.ts:52` through `tests/e2e/admin-mobile-pg8.spec.ts:55`. Recommendation: add path-specific rendered assertions for `Read-only bot view`, `Selected-user read-only drilldown`, `LIVE CONTROL: DISABLED`, `user settings: read-only`, and `provider mappings: read-only`. Target part: PG8 admin mobile/readability contract.
4. Severity P2 - The safety model still says WTC UI shows a read-only `Stop Bot` button, while the current admin pages intentionally expose no runtime control buttons. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:70`, `docs/BOT_CONTROL_SAFETY_MODEL.md:71`, `apps/web/src/app/admin/bots/page.tsx:412`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:633`. Recommendation: clarify the doc so admin read-only surfaces show no control buttons; any future disabled control affordance must be separately scoped and audited. Target part: bot control safety model and future UI contract.
5. Severity P3 - The selected-user Legacy missing-mapping copy can be read as general admin mapping authority without naming that mapping is outside this read-only page. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:661` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:663`, balanced by stronger boundary copy at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:653` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:957` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:958`. Recommendation: adjust the copy to say mappings happen only in a separate audited provider-mapping workflow, and assert that this page still does not import mapping actions or forms. Target part: selected-user Legacy provider mapping warning copy.

## Decisions
- Treated the current dirty worktree as active operator/agent work and made no product-code or test edits.
- Considered explicit read-only labels safe when paired with no forms, no action imports, no secret material, and clear no-live-control copy.
- Treated static tests as the right near-term boundary for label semantics, with rendered/mobile checks needed for visible acceptance.

## Risks
- Active dirty work may continue changing the audited files after this handoff; re-check labels before closing the phase.
- Generic `Open details` in mapped-user summaries is low-risk but inconsistent with the Phase 4.41 recommendation to make admin entry labels explicitly read-only.
- The safety-model doc can accidentally reintroduce disabled runtime buttons into admin surfaces if not clarified.

## Verification/tests
- Static inspection only: used `rg` and line-numbered `Get-Content` reads over the focused admin pages, static tests, e2e spec, safety model, and Phase 4.41 handoff.
- Not run: Vitest, Playwright, typecheck, live/provider probes, deploy commands, worker commands, exchange ping, start/stop/apply config, close-position, or live config mutation.

## Next actions
1. Rename `Open details` in `mappedUserSummary` to explicit read-only language and add negative static assertions against generic detail/action labels on admin bot surfaces.
2. Add PG8 rendered checks for `/admin/users` and `/admin/users/demo-user/bots` read-only labels and boundary pills.
3. Update `docs/BOT_CONTROL_SAFETY_MODEL.md` to distinguish admin read-only evidence pages from any future separately audited disabled-control affordance.
4. Tighten selected-user Legacy missing-mapping copy to name the separate audited provider-mapping workflow and keep this page read-only.
