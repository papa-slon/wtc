# ecosystem-axioma-bridge-auditor handoff
## Scope
Epoch `20260601-1907` read-only Axioma bridge planning lane. Scope was local B4 progress still possible without live Axioma: consume/replay route shape, JTI lifecycle, entitlement/link claim honesty, JWKS readiness, docs drift, and the terminal CTA fail-closed boundary.

No source code, product docs, tests, servers, live Axioma endpoints, SSH, tmux, systemd, Stripe, TradingView, bot, exchange, preview, or external calls were used. The only write is this canonical handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`
- `docs/handoffs/20260601-1841-ecosystem-axioma-bridge-auditor.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/ARCHITECTURE.md`
- `docs/INTEGRATION_MAP.md`
- `.env.example`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/audit/src/audit.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/worker/src/index.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - The WTC consume/replay HTTP route is still missing even though the durable JTI primitives are ready.
   Evidence: `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:224-232` defines the Option A endpoint as `POST /api/axioma/jti/consume` with 200/409/404 outcomes, but `apps/web/src/app/api/axioma` currently contains only `download/route.ts` and `journal-handoff/route.ts`. The DB layer already supports the needed lifecycle: `recordHandoffJti` inserts issued rows at `packages/db/src/repositories.ts:1160-1173`; `consumeHandoffJti` performs the atomic single-use update at `packages/db/src/repositories.ts:1175-1209`; revoke and purge exist at `packages/db/src/repositories.ts:1211-1247`; the worker purges old JTI rows at `apps/worker/src/index.ts:37-62`. The audit action tuple pre-registers `axioma.handoff_jti_consume`, `_replay`, and `_revoke` at `packages/audit/src/audit.ts:74-80`.
   Recommendation: Add a fail-closed, POST-only local route for the WTC side of Option A before live Axioma activation. The route should require a dedicated Axioma-to-WTC service token, Zod-validate `{ jti: uuid }`, require DB, call `consumeHandoffJti`, emit the existing underscore audit codes, and return generic client errors without leaking whether a token exists beyond the agreed envelope.
   Suggested tests: route handler tests for missing auth, bad auth, malformed body, no DB, first consume success, second consume replay, expired JTI, revoked JTI, and unknown JTI. Add one test proving success/failure audit rows never include token material.
   Target part: B4 WTC consume/replay route and JTI lifecycle.

2. HIGH - Entitlement/link claim honesty is improved, but current evidence is still indirect at the route level.
   Evidence: the journal handoff route now builds a WTC entitlement snapshot from `accessFor` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:32-40`, reads linked `axiomaAccountLinks` at `apps/web/src/app/api/axioma/journal-handoff/route.ts:67-78`, records the JTI before response at `apps/web/src/app/api/axioma/journal-handoff/route.ts:79-84`, and returns POST-body handoff data at `apps/web/src/app/api/axioma/journal-handoff/route.ts:93-100`. Package tests prove `buildHandoffClaims` preserves explicit snapshots at `tests/integration/axioma-handoff-snapshot.test.ts:17-52`, and static tests assert the route source mentions the snapshot/link wiring at `tests/integration/axioma-skeleton-static.test.ts:39-56`; however there is no route-level signed Request/handler harness that decodes the actual token issued by the Next route under active, grace, linked, and unlinked conditions.
   Recommendation: Extract the route issuance core or add a dependency-injected handler so tests can drive the real route behavior without a live server. Decode the actual ES256 output and assert `wtc_entitlement.state`, `expires_at`, `wtc_axioma_user_id`, `jti`, `iat/nbf/exp`, `aud`, and POST-only response shape.
   Suggested tests: generated P-256 key, PGlite DB, seeded active/grace entitlements, seeded linked Axioma account, no-link case, CSRF failure, entitlement denial, missing route readiness blockers, and JTI insert row matching token payload.
   Target part: `/api/axioma/journal-handoff` acceptance and signed claim honesty.

3. HIGH - Account-link OTC storage still has plaintext/partial lifecycle shape, so the link side of B4 cannot be activated honestly yet.
   Evidence: current schema stores `axioma_account_links.one_time_code` directly at `packages/db/src/schema.ts:147-153`; the contract says the account link flow validates an OTC as not expired/not used, marks it consumed, and stores only `link_nonce_hash` with the OTC discarded after use at `docs/CONTRACTS/axioma-bridge.md:376-382` and `docs/CONTRACTS/axioma-bridge.md:401`. No `/api/axioma/link` or account-link init/consume route exists under `apps/web/src/app/api/axioma`.
   Recommendation: Plan a no-live migration that adds a hash-first OTC lifecycle before account-link CTAs are enabled: `link_nonce_hash`, issued/consumed/expired timestamps, status constraints, and a consume path that atomically matches the hash, expiry, user, and unused state. Do not expose raw OTC after initial display.
   Suggested tests: repository tests for hash-only storage, one consume wins, expired OTC rejects, wrong user rejects, replay rejects, raw code not persisted, and route/static tests proving no raw `oneTimeCode` is returned after creation.
   Target part: Axioma account-link B4 storage and route shape.

4. MEDIUM - JWKS readiness is now parse-verified in code, but integration docs still describe older behavior.
   Evidence: the shared helper requires key, key id, and a parseable P-256 private key at `apps/web/src/features/terminal/axioma-jwks-readiness.ts:11-23`; the public route returns 503 `jwks_not_configured` with `no-store` when unconfigured and `public, max-age=300` when configured at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:6-21`; tests cover missing key/kid, invalid key, valid JWKS, 503, and 200 at `tests/integration/axioma-jwks-readiness.test.ts:27-81`. `docs/INTEGRATION_MAP.md:415-417` still says cache `max-age=3600` and says the empty state returns `{keys:[]}`, not 503.
   Recommendation: Update the docs to match the current fail-closed route behavior, or deliberately change the route to the documented empty-JWKS model. Given current safety posture, keep the 503/no-store unconfigured behavior and document it.
   Suggested tests: keep the current readiness tests; add a static docs/source drift test only if the repo already uses that pattern for integration-map invariants.
   Target part: JWKS readiness docs and operator expectations.

5. MEDIUM - Axioma contract/spec audit names and implementation names still diverge enough to mislead the next B4 implementer.
   Evidence: `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:11-16` notes shipped underscore audit codes, but the audit event table still lists multi-dot `axioma.account_link.jti.*` actions at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:286-289`. `docs/AUDIT_LOG_SCHEMA.md:196-204` lists only `axioma.account_link_init`, `complete`, `revoke`, `download_request`, and `release_publish`, while `packages/audit/src/audit.ts:74-80` includes the shipped JTI lifecycle codes. `docs/CONTRACTS/axioma-bridge.md:620-622` uses another set of names: `axioma.handoff.issued`, `.consumed`, and `.rejected`.
   Recommendation: Before implementing the consume route, make the docs canonical to the shipped underscore codes unless there is an explicit migration/backfill plan. Then make the new route emit only those canonical actions.
   Suggested tests: static test that `AUDIT_LOG_SCHEMA.md` contains every implemented `axioma.handoff_jti_*` action, and route tests that success uses consume while already-used/expired/revoked/unknown failures use replay or a documented failure action.
   Target part: Audit schema docs and B4 consume/replay audit behavior.

6. MEDIUM - Several Axioma docs still describe pre-3.9 implementation boundaries.
   Evidence: the bridge contract header is still marked "Phase 3.8" even though Phase 3.9 changed entitlement/link snapshot behavior at `docs/CONTRACTS/axioma-bridge.md:3-8`. The same contract still says the production bridge/SSO section is "TARGET only, not yet implemented", references a non-existent `packages/axioma-bridge/src/handoffToken.ts`, and uses old env names `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>` / `WTC_AXIOMA_ACTIVE_SIGN_KID` at `docs/CONTRACTS/axioma-bridge.md:1008-1034`; current code signs with `createEs256Signer` and route resolution uses `AXIOMA_HANDOFF_SIGNING_KEY` plus `AXIOMA_HANDOFF_KEY_ID` at `packages/axioma-bridge/src/es256.ts:28-50` and `apps/web/src/features/terminal/axioma-routes.ts:38-46`. `docs/ARCHITECTURE.md:641-657` still carries both a retained-HS256 note and a replacement note after Phase 3.9 removed the required production HS256 secret.
   Recommendation: Reconcile the docs into a current-state split: ES256/JWKS primitives, POST-body handoff route, JTI store, production config cleanup, and entitlement/link claim plumbing are implemented; live Axioma endpoint-shape confirmation, service-token consume route, account-link hash migration, download streaming, and CTA enablement remain B4.
   Suggested tests: optional static check for old env names and non-existent `handoffToken.ts` references after the docs cleanup.
   Target part: Axioma contract, architecture, and operator handoff docs.

7. INFO - Terminal CTAs are correctly fail-closed and should remain so until route behavior and browser actions are complete.
   Evidence: loader returns `bridgeActionsImplemented: false` in both demo and Postgres modes at `apps/web/src/features/terminal/loader.ts:101-123`; the page requires `access.allowed && routeSkeletonConfigured && bridgeActionsImplemented` before enabling actions at `apps/web/src/app/(app)/app/terminal/page.tsx:30-34`; Download and Open Journal buttons are disabled when `bridgeActionsEnabled` is false at `apps/web/src/app/(app)/app/terminal/page.tsx:166-180` and `apps/web/src/app/(app)/app/terminal/page.tsx:191-204`; static coverage asserts this invariant at `tests/integration/axioma-skeleton-static.test.ts:58-67`.
   Recommendation: Keep `bridgeActionsImplemented` false through the consume-route and docs-drift phase. Flip it only after a separate implementation phase adds the actual browser POST/form action, download streaming/proxy behavior, route-level tests, and e2e coverage.
   Suggested tests: e2e for disabled CTAs in unconfigured, no-entitlement, and route-ready-but-actions-not-implemented states; later, enabled-state e2e only after a local throwaway DB route harness proves the actions.
   Target part: `/app/terminal` CTA boundary and B4 activation gate.

## Decisions
- This lane remains read-only; only this handoff was written.
- B4 is not locally complete. Local progress is still possible without live Axioma by adding the WTC consume/replay route, route-level handoff tests, account-link hash lifecycle, and docs reconciliation.
- Prefer preserving the current POST-body handoff direction. Do not reintroduce token-bearing query URLs.
- Prefer the existing underscore audit actions for new JTI route work unless an explicit audit-action migration is planned.
- Keep `bridgeActionsImplemented: false` until browser actions, route semantics, and tests are complete.

## Risks
- Without a consume route, the JTI store is recorded and purged but not usable by Axioma Option A replay checks.
- Without route-level token tests, entitlement/link claim honesty is implemented but not proven at the actual HTTP boundary.
- Plaintext OTC storage can leak account-link codes through DB snapshots, fixtures, logs, or admin inspection if account-link is activated before the hash migration.
- Docs drift can cause a future implementer to use old env names, old audit actions, or the wrong JWKS empty-state model.
- Enabling CTAs before the consume/download/browser-action work would create a product surface that appears ready but cannot complete safely.

## Verification/tests
RUN:
- Static/read-only inspection of the files listed above.
- Confirmed the target handoff path did not exist before writing.

NOT RUN:
- `npm test` - skipped because this was a read-only planning lane.
- `node scripts/gates.mjs full` - skipped because no implementation change was made beyond this handoff.
- `npm run e2e` / Playwright - skipped; no server was started.
- Live Axioma endpoint-shape confirmation, live JWKS HTTP checks, live download streaming, Stripe, TradingView, bot, SSH, tmux, systemd, preview, or production checks - explicitly out of scope.

Suggested focused gates for the eventual write phase:
- `npm test -- tests/integration/db-axioma-jti.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-skeleton-static.test.ts`
- Add and run a new route-level suite for `/api/axioma/jti/consume` and `/api/axioma/journal-handoff` before running the full gate.
- `node scripts/gates.mjs full` after the aggregate phase handoff cites every per-agent handoff.

## Next actions
1. Implement a local, fail-closed `POST /api/axioma/jti/consume` route with service-token auth, Zod validation, DB-only JTI consume, and audit rows. No live Axioma call is needed for this.
2. Add a route-level handoff issuance harness proving active/grace entitlement snapshots, linked/null Axioma user ids, POST-only response shape, and JTI row/token consistency.
3. Plan the account-link hash migration and route shape before any account-link CTA is enabled.
4. Reconcile Axioma docs around JWKS unconfigured behavior, audit action names, current ES256/JWKS implementation, current env names, and remaining B4 blockers.
5. Keep terminal CTAs fail-closed until the consume route, download route, browser action, and e2e acceptance are all present.
