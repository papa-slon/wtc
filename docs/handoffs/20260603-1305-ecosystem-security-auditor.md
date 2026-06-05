# ecosystem-security-auditor handoff

## Scope
Phase 3.68 Legacy Live production-slice security audit. Scope was read-only for WTC product/runtime code and the local legacy bot source at `C:\Users\maxib\GTE BOT\bot`. No live server, bot process, DB, exchange, tmux, systemd, Docker, nginx, or environment mutation was performed.

Question answered: what minimum security gates must pass before enabling Legacy live-read, and what extra gates are required before any future live-control path.

Verdict: Legacy live-read is NOT safe to enable today. WTC currently does the correct thing by keeping the non-mock Legacy path blocked. A read-only Legacy live adapter may be enabled only after the upstream active runtime is proven key-free, service-account scoped, network-restricted, redaction-tested, worker/DB-snapshot based, and no-control gated. Secret redaction and disabled control are necessary but not sufficient by themselves while B3 is unresolved. Future live-control remains a separate blocked path.

## Files inspected
- `AGENTS.md`
- `.env.example`
- `package.json`
- `scripts/gates.mjs`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/SECURITY_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-runtime-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md`
- `docs/handoffs/20260603-1225-ecosystem-security-auditor.md`
- `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `packages/config/src/env.ts`
- `packages/audit/src/redact.ts`
- `packages/audit/src/audit.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/crypto/src/vault.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/lib/access.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `C:\Users\maxib\GTE BOT\bot\app.py`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\auth.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\auth.py`
- `C:\Users\maxib\GTE BOT\bot\seed_data.json` (field names only; values not copied into this handoff)

## Files changed
`docs/handoffs/20260603-1305-ecosystem-security-auditor.md` only.

## Findings
1. Severity: High. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:12`-`14` says Legacy live adapter remains blocked on upstream plaintext exchange-key risk and live-control safety gates; `docs/PRODUCTION_BLOCKERS.md:38`-`52` keeps B3 open until the upstream plaintext-key fix and security gates clear; `packages/bot-adapters/src/factory.ts:32`-`38` routes non-mock Legacy to `createLegacyBlockedAdapter`; `packages/bot-adapters/src/legacy/legacy-blocked.ts:1`-`16` states no code path can reach the Legacy plaintext-key endpoint in any `BOT_ADAPTER_MODE`. Recommendation: keep Legacy non-mock blocked until a new acceptance phase proves all live-read gates below. Target part: WTC adapter activation.

2. Severity: High. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:365`-`382` documents `/api_management/{api_id}` plaintext `api_key` and `secret_key` exposure and requires remediation before production `BOT_ADAPTER_MODE=read-only`; `docs/CONTRACTS/legacy-bot-adapter.md:388`-`401` says staging/production non-mock Legacy still uses `createLegacyBlockedAdapter`; local source now has response schemas that appear to omit key fields (`C:\Users\maxib\GTE BOT\bot\client_server\schemas\auth.py:36`-`52`) while the WTC contract still treats the active runtime as unsafe. Recommendation: treat this as blocker evidence drift, not clearance. Before enabling live-read, run an authenticated active-runtime response proof that redacted captures for every allowed GET endpoint contain no `api_key`, `secret_key`, `apiSecret`, `Authorization`, token, cookie, password, ciphertext, or secret-like value, then update the contract/blocker docs. Target part: source-of-truth and provider response safety.

3. Severity: High. Evidence: local legacy bot stores exchange credential fields on the ORM model (`C:\Users\maxib\GTE BOT\bot\models.py:91`-`104`) and `add_api_key()` writes `api_key` and `secret_key` into the row (`C:\Users\maxib\GTE BOT\bot\models.py:497`-`506`); local seed data contains secret-shaped `api_key` and `secret_key` fields (`C:\Users\maxib\GTE BOT\bot\seed_data.json:3`-`4`, values omitted here). This conflicts with the WTC non-negotiable "no plaintext exchange secrets anywhere" rule and the vault design, where WTC stores only sealed vault records (`packages/db/src/schema.ts:128`-`134`, `packages/crypto/src/vault.ts:1`-`12`). Recommendation: require upstream encryption-at-rest or explicit operator security acceptance with compensating controls before production live-read; remove or quarantine secret-bearing fixtures and rotate credentials if any value is real or has ever touched an exchange. Target part: upstream Legacy secret storage and fixture hygiene.

4. Severity: High. Evidence: the local legacy management router exposes mutation/control-adjacent endpoints: `POST /api_management/` starts API infrastructure (`C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:19`-`30`), `DELETE /api_management/{api_id}` cleans up API infrastructure (`C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:33`-`43`), `PATCH /api_management/{api_id}` can rotate credentials and start/stop infrastructure (`C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:60`-`90`), `POST /api_management/{api_id}/stage_config` mutates stage slots (`C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:93`-`101`), `POST /api_management/{api_id}/settings` mutates settings (`C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:104`-`126`), and `POST /api_management/{api_id}/retest` can unquarantine and start infrastructure (`C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:129`-`166`). Recommendation: a WTC Legacy read adapter must hard-code an allowlist of `POST /auth/login` plus GET-only read endpoints and must never expose, proxy, discover, or route POST/PATCH/DELETE/register/retest/settings/stage mutations. Target part: adapter endpoint allowlist.

5. Severity: High. Evidence: the Legacy source binds the API on configured host default `0.0.0.0` and port `8000` (`C:\Users\maxib\GTE BOT\bot\app.py:105`-`108`); prior runtime audit says the active Legacy process listens on server-local port `8000` and public access depends on firewall posture (`docs/handoffs/20260603-1147-ecosystem-bot-runtime-auditor.md:17`-`21`); Phase 3.67 proved external bot ports stayed closed while server-local ports remained open (`docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md:55`-`60`, `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md:104`-`107`). Recommendation: require port `8000` to be loopback/private-bound or firewall-restricted and monitored before any live-read; external `8000` denial, server-local reachability, and `wtc-bot-api-firewall.service` active state must be recorded with redacted evidence in the same enabling phase. Target part: network boundary.

6. Severity: High. Evidence: the Legacy contract says a dedicated read-only service account must be created, stored in WTC vault, and never logged or exposed (`docs/CONTRACTS/legacy-bot-adapter.md:29`-`49`); local auth returns JWT access/refresh tokens (`C:\Users\maxib\GTE BOT\bot\client_server\routes\auth.py:35`-`49`) and validates bearer tokens for all user-dependent routes (`C:\Users\maxib\GTE BOT\bot\client_server\routes\auth.py:52`-`76`). Recommendation: do not put Legacy service-account credentials or JWTs in general logs, retained artifacts, screenshots, config exports, or browser responses. Store service-account credentials in the WTC encrypted vault, keep JWTs memory-only in the worker, redact token-bearing errors, and prove no-token denial plus valid-token GET success against the active runtime. Target part: authentication and token handling.

7. Severity: High. Evidence: current WTC web/read surfaces only treat Tortila production non-mock as DB-snapshot backed (`apps/web/src/features/bots/data.tsx:148`-`150`, `apps/web/src/features/bots/data.tsx:412`-`435`); Phase 3.65 accepted Tortila real read-only specifically as `journal -> worker -> WTC Postgres -> web/admin UI` and warned against web request live probing (`docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:3`-`8`, `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:65`-`89`); integration audit says Legacy has no equivalent safe WTC import path yet (`docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md:18`-`22`). Recommendation: first Legacy live-read must be worker-scoped into WTC DB health/snapshot tables with stale labels, not a web-global adapter-mode flip. User pages should read WTC DB snapshots and fail closed when stale/unavailable. Target part: live-read data path.

8. Severity: High. Evidence: live controls are disabled by code (`packages/bot-adapters/src/control.ts:1`-`18`, `packages/bot-adapters/src/legacy/legacy-blocked.ts:89`-`100`), `.env.example` keeps `FEATURE_LIVE_BOT_CONTROL=false` (`.env.example:74`-`82`), and `docs/BOT_CONTROL_SAFETY_MODEL.md:93`-`151` marks required control gates not started/in progress/not started. The control model doc names `BOT_CONTROL_ENABLED` (`docs/BOT_CONTROL_SAFETY_MODEL.md:17`-`21`) while current code/env use `FEATURE_LIVE_BOT_CONTROL` (`packages/config/src/env.ts:33`, `packages/bot-adapters/src/control.ts:8`-`10`). Recommendation: keep live control disabled, align the flag naming in docs/code before any control phase, and require a separate audited control adapter rather than widening the read adapter. Target part: live-control safety.

9. Severity: Medium. Evidence: WTC audit redacts secret-like keys and values (`packages/audit/src/redact.ts:12`-`79`) and event construction redacts before/after before persistence (`packages/audit/src/audit.ts:166`-`183`); exchange-key DB writes audit only non-secret metadata (`packages/db/src/repositories.ts:384`-`407`); bot config save is WTC DB-only, versioned, and audited (`packages/db/src/repositories.ts:1677`-`1690`). Recommendation: future Legacy live-read must keep audit/log payloads metadata-only: product code, bot instance id, read state, endpoint class, counts, timestamps, and generic failure categories only. Never audit raw provider bodies, URL query secrets, JWTs, exchange keys, sealed blobs, stack traces, or response samples. Target part: audit/log redaction.

10. Severity: Medium. Evidence: current Legacy UI is reference/export only: setup blocks exchange-key collection when `BOT_CAPS.liveAdapterBlocked` is true (`apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:47`-`59`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:123`-`128`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:173`-`197`), settings copy says config is stored in WTC only and never sent live (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:97`-`107`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:149`-`190`), and config export says no exchange keys or live-apply token (`apps/web/src/features/bots/config.ts:539`-`571`). Recommendation: keep all Legacy config UI/export surfaces as reference-only until a separate live-apply workflow has passed live-control gates and safe update semantics. Target part: UI and config export boundary.

## Decisions
- Do not enable Legacy `BOT_ADAPTER_MODE=read-only` in this phase.
- Do not introduce or call a real Legacy HTTP adapter from WTC web pages.
- Do not use `LEGACY_BOT_BASE_URL`, `/auth/login`, or `/api_management/*` in this read-only auditor lane.
- A future read-only adapter is acceptable only as a new worker-scoped, GET-only, DB-snapshot import path after the live-read gates below pass.
- Redaction/no-control gates alone are insufficient while upstream active-runtime key-free proof and secret-storage/fixture hygiene are unresolved.
- Live-control is a separate future phase and remains blocked even if live-read becomes safe.
- This was a single requested read-only `ecosystem-security-auditor` lane. No background agents were launched by this lane and none were left running.

## Risks
- The active Legacy runtime may differ from the local source and docs; a live authenticated response proof is required before trusting either.
- A service-account JWT that can call mutation routes could become a live-control bypass unless server-side role/scope restrictions and WTC endpoint allowlists are both enforced.
- A web-container `BOT_ADAPTER_MODE=read-only` flip could make user page renders probe the Legacy bot directly, increasing secret and availability risk.
- Secret-shaped fixture values in the local legacy source create retention and rotation risk if any value is real or reused.
- Firewall drift could expose `:8000` externally because the source default is broad binding.
- Legacy has no closed-trade/equity endpoint today; performance analytics must remain unavailable/null rather than fabricated.

## Verification/tests
Gates RUN in this auditor lane:
1. Static WTC source/doc inspection with `rg`, `Get-Content`, and line-numbered reads.
2. Static local legacy bot source inspection with no env dump and no live server calls.
3. Git status inspected before writing; pre-existing untracked `docs/handoffs/20260603-1305-ecosystem-bot-integration-auditor.md` was present and was not touched.

Gates NOT RUN in this auditor lane:
1. `npm test`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, Playwright, build, lint, typecheck, `secret:scan`, and `evidence:visual` were not run because this lane was scoped to read-only security inspection and one handoff write.
2. Authenticated Legacy API calls, `/auth/login`, `/api_management/*`, response captures, network captures, and provider-side service-account checks were not run.
3. Server SSH, Docker, systemd, tmux, nginx, DB queries/migrations/seeds, firewall mutation, deploy actions, bot process control, exchange calls, and env reads were not run.

Minimum gates that must pass before Legacy live-read enablement:
1. Upstream key-free runtime proof: active Legacy read endpoints return no exchange keys, secrets, tokens, cookies, auth headers, ciphertext, or secret-like values. Capture redacted no-secret evidence for every allowed endpoint.
2. Upstream secret storage and fixture hygiene: exchange keys are encrypted at rest or formally accepted with compensating controls; secret-bearing fixtures/backups are removed/quarantined and credentials rotated if real.
3. Dedicated read-only service account: WTC uses a non-personal Legacy account with server-side GET-only scope; no POST/PATCH/DELETE/register/retest/settings/stage mutation succeeds for that account.
4. WTC vault and token handling: service-account credentials are stored in the WTC encrypted vault; JWTs are memory-only, redacted in all logs/errors/artifacts, refreshed safely, and never exposed to browser/API responses.
5. Endpoint allowlist: WTC adapter permits only `POST /auth/login` and explicitly enumerated GET endpoints; no dynamic proxying, URL passthrough, or mutation route discovery.
6. Worker-only data path: first live-read runs in a scoped worker and persists WTC DB health/snapshots/imports; web/admin pages consume WTC DB snapshots, not the live Legacy API.
7. Network boundary: port `8000` is loopback/private or firewall-restricted; external `8000` denial, local reachability, and firewall monitoring are proven in the same phase.
8. Redaction and schema guards: `LegacyApiSafeBodySchema` or stricter equivalent is applied before mapping; tests prove `api_key`, `secret_key`, tokens, auth headers, and raw provider bodies never reach canonical models, audit rows, logs, exports, screenshots, or retained artifacts.
9. Access control: bot pages/routes remain `requireUser` plus entitlement/RBAC fail-closed; admin overrides are explicit and audited; non-entitled users never trigger live reads.
10. Operational safety: health/read-state/stale labels, worker freshness, firewall state, warning banners, and rollback triggers are monitored; Legacy analytics remain honest about unavailable trade/equity history.
11. Local gates: run `node scripts/gates.mjs full`, focused Legacy adapter/read-safety tests, and any new Legacy worker/import tests.
12. Browser/artifact gates: run the relevant authenticated Playwright checks plus `npm run secret:scan` and `npm run evidence:visual` after retaining artifacts.

Exact commands expected before live-read acceptance, after implementation exists:
1. `node scripts/gates.mjs full`
2. `npx vitest run packages/bot-adapters/src/__tests__/legacy-blocked.test.ts tests/integration/bot-read-safety-static.test.ts`
3. `npx vitest run packages/bot-adapters/src/__tests__/legacy-readonly*.test.ts tests/integration/legacy-readonly*.test.ts tests/integration/worker-legacy-snapshot*.test.ts`
4. `node scripts/gates.mjs e2e`
5. `npm run secret:scan`
6. `npm run evidence:visual`
7. Operator-approved redacted provider proof: no-token denial, valid-token GET success, mutation-route denial, no secret-bearing response/body/log/artifact capture, external `8000` denial, and live bot services still alive.

Minimum gates for any future Legacy live-control path:
1. All live-read gates above are green and burn-in is accepted first.
2. `docs/BOT_CONTROL_SAFETY_MODEL.md:93`-`151` gates pass: security audit, bot-integration audit, exchange safety audit, integration tests, CI/coverage.
3. Feature flag naming is reconciled (`BOT_CONTROL_ENABLED` vs `FEATURE_LIVE_BOT_CONTROL`) and remains false until the final approved control phase.
4. Control adapter has no SSH/tmux/systemd/process-kill/exchange-order path from WTC, consistent with `docs/BOT_CONTROL_SAFETY_MODEL.md:28`-`42`.
5. Server-side RBAC, entitlement, CSRF, rate limiting, replay protection, idempotency, timeout handling, and append-only audit are proven for every control route.
6. UI confirmation flows prove "stop bot" never means close/cancel positions or orders, config apply shows diffs, stale state is labelled, and quarantine warnings are visible.
7. Playwright and integration tests cover disabled state, unauthorized access, config validation failure, timeout, adapter error, stop confirmation, apply confirmation, stale labels, and audit failure rollback.

## Next actions
1. Keep `createLegacyBlockedAdapter()` as the only non-mock Legacy adapter until a new Legacy live-read phase clears the gates above.
2. Ask the Legacy bot owner to provide or implement a key-free read-only summary API and a real read-only service account, then prove it on the active runtime with redacted evidence.
3. Add a WTC worker-scoped Legacy snapshot/import design before any code implementation; do not wire direct web live reads.
4. Add focused Legacy live-read tests and retained-artifact no-secret scans before any production canary attempt.
5. Keep live control disabled and route it as a separate post-read-only phase only after the full bot-control safety model is green.
