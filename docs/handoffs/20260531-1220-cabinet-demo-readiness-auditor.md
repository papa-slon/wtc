## Scope
Read-only audit of browser-visible ecosystem rooms and demo completeness.

## Files inspected
- apps/web/src/app/(app)/app/page.tsx
- apps/web/src/app/(app)/app/products/page.tsx
- apps/web/src/features/cabinet/loader.ts
- apps/web/src/features/cabinet/CabinetProductCard.tsx
- apps/web/src/app/(app)/app/terminal/page.tsx
- apps/web/src/app/(app)/app/education/page.tsx

## Files changed
None by this auditor.

## Findings
- The app overview already has real cabinet cards.
- The dedicated /app/products route was still a placeholder and weakened the browser demo.
- Demo labels should remain visible until real integrations are wired.

## Decisions
- Replace /app/products with the same entitlement-aware cabinet model.
- Keep storage truth and blocker counts visible on the product directory.

## Risks
- This improves the browser product surface but does not remove production blockers.
- Demo storage remains in-memory without DATABASE_URL.

## Verification/tests
- Auditor was read-only. Operator must add a static regression test that forbids returning to Placeholder.

## Next actions
- Implement /app/products as a real product directory and test it.
