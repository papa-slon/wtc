# bot-ux-settings-auditor handoff
## Scope
Read-only audit of current user/admin bot UX against the product objective: simple premium settings for Legacy averaging and Tortila, defaults vs personal overrides, symbol selection, RSI/CCI/stage clarity, user-owned visibility, and admin read-only drilldown.

## Files inspected
- `apps/web/src/app/(app)/app/bots/**`
- `apps/web/src/features/bots/**`
- `apps/web/src/app/admin/bots/**`
- `apps/web/src/app/admin/users/**`
- `apps/web/src/features/admin/**`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. Admin Tortila system-default editor duplicated portfolio-cap fields, so admin edits could be shadowed by duplicate `name` fields. Evidence: `apps/web/src/app/admin/bots/config/page.tsx` rendered `TortilaSymbolConfigTable` plus generic cap fields; parsing reads `formData.get(name)` in `apps/web/src/features/bots/config.ts`. Recommendation: make the Tortila table the only canonical cap editor on admin defaults. Target part: admin global bot defaults.
2. Severity: Medium. Locked personal overrides still render editable-looking controls while only submit is disabled. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`. Recommendation: later render locked configs as read-only summaries or disable every field consistently. Target part: user settings/setup override UX.
3. Severity: Medium. Setup wizard completion marker used a Unicode glyph that can render as mojibake in this Windows/production path. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`. Recommendation: use ASCII or a stable icon component and add a smoke assertion. Target part: guided onboarding polish.

## Decisions
The current bot product surface already has the correct structure: safe default/custom split, Legacy RSI/CCI stage model, Tortila strategy cards, read-only admin drilldown, and live-control boundaries. The next UX phase should be reconciliation/polish, not a redesign.

## Risks
- Duplicate admin inputs can persist the wrong Tortila portfolio default.
- Editable-looking locked forms can confuse users about whether customization is allowed.
- Encoding artifacts reduce perceived quality on the core onboarding path.

## Verification/tests
Read-only static inspection only. No tests were run by this agent.

## Next actions
1. Remove duplicate admin Tortila cap inputs.
2. Add regression coverage for single canonical cap input names.
3. Replace setup wizard glyph with ASCII/stable icon.
4. Later convert locked override forms to true read-only preview state.
