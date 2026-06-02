# Handoff: ecosystem-axioma-bridge-auditor

**Agent:** ecosystem-axioma-bridge-auditor  
**Phase:** 0 — Documentation and architecture  
**Date:** 2026-05-29  
**Status:** Complete

---

## Scope

Read-only audit of:
- `C:/Users/maxib/TV_GREENFIELD_TERMINAL/journal_server/` (complete Python source, migrations, tests, schemas, models, services)
- All four canonical read docs (0000-orchestrator-seed, ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT, WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT, WTC_ECOSYSTEM_DISCOVERY_MAP)

Produce:
- `docs/CONTRACTS/axioma-bridge.md` — the WTC ↔ Axioma bridge contract

---

## Files inspected (read-only)

### Canonical inputs
- `docs/handoffs/0000-orchestrator-seed.md`
- `C:/Users/maxib/GTE BOT/bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md`
- `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md`
- `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md`

### journal_server (all read-only)
- `app/main.py` — router registration, lifespan, CORS, middleware chain
- `app/config.py` — all settings with defaults and feature flags
- `app/api/deps.py` — auth chain: JWT Bearer → X-API-Key → session cookie
- `app/api/v1/auth.py` — login, register, /me, auto-issue entitlement policy (phases 7, 7.2)
- `app/api/v1/entitlements.py` — enroll, /me, check, revoke; feature-flag guard
- `app/api/v1/releases.py` — `/api/v1/releases/terminal/latest`; requires auth since Phase 4
- `app/api/v1/trades.py` — full CRUD with ownership checks; non-admin scoped to own rows
- `app/api/v1/stats_v2.py` — 6 analytics endpoints (premises, timeframes, setup-premises, combinations, exchanges, premise-outcomes)
- `app/api/v1/feedback.py` — bug/proposal CRUD; admin can triage
- `app/api/v1/user_settings.py` — whitelist-filtered settings sync; forbidden-credential scan
- `app/api/v1/users.py` — user CRUD (admin-only list)
- `app/api/v1/health.py` — `/health` DB-ping check
- `app/models/user.py` — UserRole enum: admin/tester/viewer
- `app/models/entitlement.py` — Entitlement table; plan/tier/valid_until/device_id/revoked_at
- `app/models/feedback.py` — FeedbackItem; types/categories/severities/statuses
- `app/schemas/entitlement.py` — EntitlementStatus literals; EntitlementCheckResponse
- `app/schemas/user.py` — UserRead + optional entitlement sub-object
- `app/schemas/user_settings.py` — UserSettingsRead/Write; client_updated_at stale guard
- `app/schemas/feedback.py` — FeedbackCreate/Update/Response
- `app/schemas/trade.py` (inferred from API surface)
- `app/services/entitlement_service.py` — _classify() state machine; grace window logic
- `app/services/terminal_release_service.py` — manifest loader; changelog parser; build_public_terminal_release_metadata()
- `app/services/user_settings_service.py` — ALLOWED_PAYLOAD_KEYS whitelist; FORBIDDEN_PAYLOAD_KEYS; _scan_for_forbidden_keys() normalized substring match
- `app/middleware/rate_limit.py` — slowapi Limiter; key=remote_address
- `app/web/downloads.py` — /web/downloads page + /web/downloads/terminal/windows-x64 FileResponse route (session-cookie auth)
- `app/web/changelog.py` — /web/changelog page
- `alembic/versions/0007_add_user_model.py` — users table creation

### Files changed
- `docs/CONTRACTS/axioma-bridge.md` — **created** (new file)
- `docs/handoffs/20260529-phase0-axioma-bridge-auditor.md` — **created** (this file)

---

## Findings

### Architecture / auth
1. **Three-tier auth chain:** JWT Bearer (primary) → X-API-Key (server-to-server) → session cookie (web dashboard). WTC bridge should use JWT Bearer obtained with a dedicated service account. Never session cookie.
2. **Production startup guard (AUDIT R4):** Server refuses to start if `API_KEY` is empty or `JWT_SECRET_KEY` is the literal default `"dev-secret-change-in-production"`, unless `LOCAL_DEV=true`. This is correctly hardened.
3. **Rate limits are IP-based, not token-based.** WTC bridge shares the IP-level bucket with all other callers. If WTC and Axioma web users share the same server IP (nginx proxy), rate limits may be hit faster. Consider the WTC bridge running from the same server as a lower-risk scenario (internal calls don't cross the public IP).
4. **JWT expiry is 24 h** (default 1440 min). The WTC bridge must refresh before expiry; recommend refreshing at 20 h to leave a buffer.

### Entitlement system
5. **Feature flag `ENTITLEMENT_ENABLED` defaults to `False`.** WTC bridge must handle 404 from entitlement endpoints gracefully and display "License system not yet active" rather than an error state. This is a near-term deployment risk if the server hasn't been flipped to `True`.
6. **Grace window is operator-configurable** (`ENTITLEMENT_GRACE_DAYS`, default 7). WTC must display the `grace_days_remaining` field and show a warning, not a hard lock.
7. **Entitlement enroll is not idempotent** — calling it twice for the same user creates two rows. WTC must check existing before enrolling.
8. **Soft revoke** — `revoked_at` is set but the row is kept. Historical audit is preserved. WTC `terminal_license_events` should mirror this.

### Downloads
9. **The download route (`/web/downloads/terminal/windows-x64`) uses session-cookie auth, not JWT Bearer.** This means WTC cannot call it server-to-server with a Bearer token. WTC must either (A) generate a user session with a short-lived JWT and redirect the browser, or (B) implement a WTC-side proxy that carries the service-account X-API-Key and streams the file. Option B is cleaner — documented as default in the contract.
10. **No signed-URL mechanism exists on the server today.** Option B (WTC proxy + one-time token) is the cleanest path to "never raw public file" without modifying the Axioma server.

### User settings
11. **Whitelist is narrow:** `rightPanelOpen`, `tradePanelVisible`, `positionToolSide`. WTC surfaces this as a passthrough — does not need to interpret the values, only cache them.
12. **Stale-client guard (409) requires `client_updated_at`.** WTC bridge must include this when writing; otherwise always overwrites (safe but less useful for multi-device scenarios).
13. **Forbidden-credential scan uses normalized substring match** — e.g. `exchangeApiKey` → matches `apikey`. Server enforces this at write time. WTC does not need to pre-scan, but the redaction pipeline for feedback (§5.8) should apply similar logic.

### Release metadata
14. **`product` field in manifest is operator-set.** Currently likely `"Trading Terminal"` or similar (pre-rename). WTC must not hardcode the product name — read from the `product` field and use it for display.
15. **404 when installer not deployed.** WTC must show "No release available" state, not error.

### Feedback / support
16. **`raw_text` is unstructured.** WTC must redact credential-like patterns before forwarding. The contract specifies regex patterns to check.
17. **`app_version` and `active_module` are present** — WTC should populate these when forwarding feedback from the terminal page (version from release cache, module = "terminal").

### Package rename
18. **`com.greenfield.terminal` → Axioma rename** is a deliberate migration with significant risk:
    - Electron `safeStorage` keys are app-id-scoped. Renaming breaks existing encrypted data.
    - WTC's `terminal_release_cache.product` field will change value; code must not hardcode old string.
    - Deep-link scheme needs agreement before public announcement.
    - Track in `docs/OPEN_QUESTIONS.md`.

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| WTC bridge uses JWT Bearer (service account), not session cookie | Session cookies are browser-only; service-to-service must use Bearer |
| Download mechanism: Option B (WTC proxy + one-time token) | Keeps Axioma internal URL opaque; no browser redirect with credentials |
| Circuit breaker threshold: 5 failures / 60 s, opens for 30 s | Protects both WTC and Axioma from cascading failures |
| Grace window display: warning, not hard lock | Matches journal_server semantics; user has time to renew |
| `ENTITLEMENT_ENABLED=False` → graceful 404 handling | Server may not have the flag flipped yet |
| OTC TTL: 10 min | Short enough to be secure; long enough for user to switch apps |
| Handoff token TTL: 60 s | Single-use, so short TTL is safe |
| WTC never stores Axioma user passwords or raw JWTs | Architecture lock from Axioma's own `MULTI_USER_LOCAL_KEY_DESIGN.md` |
| WTC never gates Axioma local order-execution on WTC entitlement | Non-negotiable architecture lock |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `ENTITLEMENT_ENABLED` not flipped on server | P1 | WTC bridge handles 404 gracefully; document as deployment prerequisite |
| IP-based rate limits shared across WTC bridge + web users | P2 | Monitor; if hit, request Axioma server add per-token rate limit or whitelist WTC server IP |
| Download route requires session cookie, not Bearer | P1 | WTC proxy (Option B) resolves; required before download feature ships |
| Package rename breaks `safeStorage` for existing users | P0 (Axioma side) | Do not rename until migration path is documented and tested |
| Handoff token spec (`AXIOMA_HANDOFF_TOKEN_SPEC.md`) not yet written | P1 | Security-auditor agent must produce this before Open Journal feature ships |
| Entitlement enroll not idempotent | P2 | Pre-check before calling; wrap in `terminal_license_events` audit |
| No WTC-side Axioma server webhook today | P2 | WTC must poll to detect revoke/expiry changes; hourly sync job |
| journal_server CORS origins must include WTC domain | P2 | Must be configured before browser-side deep-link calls |

---

## Tests / verification

Required tests are fully specified in `docs/CONTRACTS/axioma-bridge.md §13`:
- 10 unit tests in `packages/axioma-bridge/`
- 6 integration tests in `tests/integration/`
- 6 Playwright e2e tests

No tests can be run until:
1. `packages/axioma-bridge` is scaffolded (Phase 1+)
2. A test instance of journal_server is available with `ENTITLEMENT_ENABLED=True` and `LOCAL_DEV=True`

---

## Next actions

1. **Security-auditor agent:** Write `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` — handoff token issuer/audience/subject/entitlement/jti/nonce/expiry/replay/revocation/CSRF/audit spec.
2. **DB-architect agent:** Add `axioma_account_links`, `terminal_release_cache`, `terminal_download_events`, `terminal_license_events` tables to `docs/DATA_MODEL.md` and migrations.
3. **Platform-architect agent:** Add Axioma bridge section to `docs/INTEGRATION_MAP.md`; document Option B download proxy.
4. **Frontend-implementer:** Implement `/app/terminal` UI states: none / active / grace / expired / revoked / degraded / no-release / link-pending / linked.
5. **Worker:** Implement `axioma-release-sync` (10 min), `axioma-entitlement-expiry-sync` (hourly), `axioma-health-check` (5 min), `axioma-download-token-cleanup` (hourly).
6. **Deployment prerequisite:** Ensure `ENTITLEMENT_ENABLED=True` is set on the production `journal_server` before the entitlement features are wired.
7. **Open question:** Resolve package rename timeline and migration path; record in `docs/OPEN_QUESTIONS.md`.
