# Admin Terminal Deploy Auditor

## Scope
Read-only audit of admin operations, terminal/Axioma readiness, and deploy-preview readiness for the platform package.

## Files inspected
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/products/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `scripts/safe-preview.mjs`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/STATUS.md`

## Files changed
- None by this auditor; the Phase 3.6 operator pass added the missing admin terminal room and hardened preview startup.

## Findings
The admin console was broad but still missing an admin terminal release room. Safe preview existed but needed an explicit IP-safe hostname and shell-free Windows process launch. Axioma remains a fail-closed skeleton: no real download proxy, no production handoff activation, and no local terminal execution gating.

## Decisions
Add a DB-only admin terminal release room, keep Axioma CTAs disabled until bridge prerequisites are present, and make the preview script bind `0.0.0.0` without shell indirection.

## Risks
Do not confuse "release metadata room exists" with "installer delivery is production-ready". Actual installer bytes, checksums, download URL security, and Axioma endpoint shapes remain separate gates.

## Verification/tests
Preview script source guard must assert `--hostname 0.0.0.0`, `--port 3000`, and `shell:false`. Admin mobile e2e must include `/admin/terminal`.

## Next actions
Run safe preview locally and verify browser access through `127.0.0.1` and the local adapter IP. Production deployment remains blocked until real Postgres and secrets are provisioned.
