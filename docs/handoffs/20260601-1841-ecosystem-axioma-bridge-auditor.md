# ecosystem-axioma-bridge-auditor handoff
## Scope
Epoch `20260601-1841` read-only audit and planning lane for remaining local Axioma cleanup after phase 3.8. Scope was limited to: production HS256 secret requirement, JWKS readiness helper, docs/tests drift, and keeping terminal CTAs fail-closed.

No source code was edited. No live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview, or production endpoint was called.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md`
- `docs/handoffs/20260601-1814-ecosystem-axioma-bridge-auditor.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `.env.example`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/index.ts`
- `packages/axioma-bridge/src/__smoke__.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/db-axioma-jti.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Production still requires the unused HS256 dev-stub secret even though the real-deployment signer path is ES256-only.
   Evidence: `packages/config/src/env.ts:64-75` correctly requires `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` for `APP_ENV=staging|production`, but `packages/config/src/env.ts:89-95` still requires `AXIOMA_HANDOFF_SIGNING_SECRET` whenever `NODE_ENV=production`. The active route signer passes `hs256Secret: undefined` at `apps/web/src/features/terminal/axioma-routes.ts:37-45`, and `packages/axioma-bridge/src/signer.ts:57-65` fences HS256 out of staging/production. Tests still assert the old requirement at `packages/config/src/env.test.ts:47-50`. `docs/NEXT_ACTIONS.md:185-188` already tracks deprecating the HS256 prod requirement.
   Recommendation: Remove the production requirement for `AXIOMA_HANDOFF_SIGNING_SECRET`; keep HS256 secret validation only for dev/test code paths that intentionally call `signHandoffToken`. Add a config test proving `NODE_ENV=production + APP_ENV=production + ES256 key/kid + no HS256 secret` passes. Update `.env.example`, `STATUS.md`, and any production-blocker text that still treats HS256 as a production secret.
   Target part: `@wtc/config` production env validation and Axioma deployment docs.

2. HIGH - JWKS readiness is duplicated and presence-only, so the terminal page can report "configured" while the public JWKS route still returns `jwks_not_configured`.
   Evidence: `apps/web/src/features/terminal/loader.ts:97` sets `jwksConfigured` from key and key-id presence only, and the UI renders "configured" from that boolean at `apps/web/src/app/(app)/app/terminal/page.tsx:215-224`. The actual JWKS route also requires a parseable EC P-256 key; it catches signer construction failure and returns 503 at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:22-27`. The current static test checks only source tokens, not key-only/kid-only/invalid-key/valid-key behavior, at `tests/integration/axioma-skeleton-static.test.ts:64-71`.
   Recommendation: Add a shared server-only helper such as `resolveAxiomaJwksReadiness(env)` returning `{ configured, blockers, jwks? }` for missing key, missing kid, invalid key, and configured states. Use it from both the loader and JWKS route. Add unit tests with generated P-256 keys and invalid placeholders.
   Target part: JWKS readiness helper, route, loader, and static/unit coverage.

3. HIGH - Route-level handoff issuance does not pass the actual entitlement snapshot or linked Axioma user id into the signed claims.
   Evidence: `packages/axioma-bridge/src/handoff.ts:57` supports `entitlement` and `axiomaUserId` options, and defaults claims to `state: 'active'`, `expires_at: null`, `wtc_axioma_user_id: null` at `packages/axioma-bridge/src/handoff.ts:70-75`. `apps/web/src/features/terminal/axioma-routes.ts:56` calls `buildHandoffClaims(...)` without those options, and `apps/web/src/app/api/axioma/journal-handoff/route.ts:52-59` records the jti after only checking `access.allowed`. That means a valid `grace` access decision or a linked account can still produce a token claiming active/no-expiry/null-link.
   Recommendation: In the write phase, extend the route/handoff builder to accept the actual entitlement decision snapshot and any `axioma_account_links` mapping available from DB. At minimum, encode `active` vs `grace` honestly and keep `wtc_axioma_user_id: null` only when no link row exists. Add a route-level decode test for active, grace, and no-link cases.
   Target part: journal handoff route, terminal route helper, and token payload tests.

4. MEDIUM - Docs and test comments still describe pre-3.8 state and can mislead the next implementer.
   Evidence: `docs/CONTRACTS/axioma-bridge.md:513` says only the HS256 dev-stub signer is implemented and ES256/JWKS production signer is not; `docs/CONTRACTS/axioma-bridge.md:1008-1034` says the production-ready handoff section is not implemented and references non-existent `handoffToken.ts` env names; `docs/CONTRACTS/axioma-bridge.md:1047-1048` leaves ES256/JWKS signer and JWKS endpoint unchecked. Code now exports `createEs256Signer` and `buildJwks` at `packages/axioma-bridge/src/index.ts:10-12`, and the JWKS route exists at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:16-27`. Stale comments also remain in `packages/axioma-bridge/src/handoff.ts:80-82`, `packages/axioma-bridge/src/handoff.test.ts:64`, and `packages/axioma-bridge/src/es256.ts:9-12`.
   Recommendation: Update the contract/status wording to the current split: ES256/JWKS primitives and fail-closed route skeletons exist; OP key provisioning, EXT endpoint-shape confirmation, consume/download activation, OTC hash migration, and CTA enablement remain open. Update tests/comments to stop saying ES256/JWKS or the jti table are unbuilt.
   Target part: Axioma contract docs, status docs, and stale package comments/tests.

5. MEDIUM - Audit action naming drift remains documented but unresolved.
   Evidence: `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:11-16` states shipped audit codes use underscore names while the audit-events table still lists multi-dot actions at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:286-289`. `packages/audit/src/audit.ts:78-80` contains `axioma.handoff_jti_consume`, `axioma.handoff_jti_replay`, and `axioma.handoff_jti_revoke`; `docs/AUDIT_LOG_SCHEMA.md:200-202` still lists the older account-link actions but not the jti lifecycle codes in the implemented table.
   Recommendation: Pick the repo-wide audit naming convention for Axioma jti lifecycle before building the consume route. Prefer preserving shipped underscore codes unless a migration/backfill plan exists, then update `AXIOMA_HANDOFF_TOKEN_SPEC.md` and `AUDIT_LOG_SCHEMA.md` to match.
   Target part: Axioma audit schema docs and future consume/replay/revoke route implementation.

6. INFO - Terminal CTAs are currently fail-closed and should stay that way until action handlers are fully implemented and tested.
   Evidence: `apps/web/src/features/terminal/loader.ts:107` and `apps/web/src/features/terminal/loader.ts:121` hard-code `bridgeActionsImplemented: false`. `apps/web/src/app/(app)/app/terminal/page.tsx:30-34` requires that flag before enabling actions, and the Download/Open Journal buttons are disabled when `bridgeActionsEnabled` is false at `apps/web/src/app/(app)/app/terminal/page.tsx:168-174` and `apps/web/src/app/(app)/app/terminal/page.tsx:194-204`. Static coverage asserts the same invariant at `tests/integration/axioma-skeleton-static.test.ts:54-61`.
   Recommendation: Keep `bridgeActionsImplemented: false` until download streaming, journal handoff browser action, consume/replay handling, and e2e coverage are all present. Activation should be a separate live/throwaway-DB phase, not a docs cleanup.
   Target part: `/app/terminal` CTA enablement gate and route activation checklist.

## Decisions
- This lane remains read-only. The only allowed write is this handoff.
- Axioma B4 is still not cleared locally. The next write phase can remove local drift, but real activation still requires OP key provisioning and EXT endpoint-shape confirmation.
- ES256/JWKS primitives are present; the production deploy model should no longer require a production HS256 shared secret.
- CTAs must remain disabled until the real browser actions, route behavior, and tests exist.

Suggested write-phase order:
1. Remove the production HS256 secret requirement and update config tests/docs.
2. Add shared JWKS readiness helper and tests; use it in loader and route.
3. Pass real entitlement/link snapshots into the handoff payload and add decode tests.
4. Reconcile contract/spec/status/test-comment drift to current phase 3.8 reality.
5. Reconcile Axioma jti audit action naming before adding the consume route.
6. Keep `bridgeActionsImplemented: false` throughout the cleanup.

## Risks
- Production operators may provision and rotate an unnecessary HS256 shared secret while ES256 is the only acceptable real-deployment handoff signer.
- Invalid ES256 key material can produce a misleading terminal "configured" badge while `/.well-known/axioma-jwks.json` returns 503.
- If activated as-is, a grace user or linked Axioma account can receive a token whose entitlement/link claims are less precise than WTC state.
- Stale contract text can cause duplicated work or accidental reintroduction of query-token / HS256 assumptions.
- Enabling CTAs before the route and browser-action work is complete would create inert or fail-closed production buttons.

## Verification/tests
RUN:
- Static/read-only inspection of the files listed above.
- Confirmed `docs/handoffs/20260601-1841-ecosystem-axioma-bridge-auditor.md` did not exist before writing.

NOT RUN:
- `npm test` - not run because this lane is a read-only planning audit and must not create extra generated/cache changes.
- `node scripts/gates.mjs full` - not run; no source/docs implementation was performed beyond this handoff.
- Playwright/e2e - not run; no app server was started and no UI implementation changed.
- Real JWKS HTTP request - not run; no local or live server was started.
- Live Axioma endpoint-shape confirmation, real download streaming, consume route, Stripe, TradingView, bot, SSH, tmux, systemd, preview, or production checks - not run by scope.

## Next actions
1. Assign a write phase to fix Findings 1-5 with no live Axioma calls and with `bridgeActionsImplemented` kept false.
2. After the write phase, run focused local tests: `npm test -- packages/config/src/env.test.ts packages/axioma-bridge/src/handoff.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/db-axioma-jti.test.ts`.
3. Run `node scripts/gates.mjs full` after the focused tests pass and after the aggregate phase handoff cites this per-agent handoff.
4. Treat real OP key provisioning, live Axioma endpoint confirmation, and CTA enablement as a separate scoped phase.
