# Handoff — ecosystem-security-auditor — Phase 0

Date: 2026-05-29
Agent: ecosystem-security-auditor
Phase: 0 — Documentation and Architecture

---

## Scope

Produce the complete Phase 0 security documentation set for the WTC Ecosystem Platform. All five documents are designed to be implementation-ready: specific enough that a backend implementer can write `packages/auth`, `packages/crypto`, and `packages/audit` without further design decisions on security primitives.

---

## Files Inspected (Read-Only)

- `docs/handoffs/0000-orchestrator-seed.md` — canonical stack, roles, schema groups, hard rules
- `C:/Users/maxib/GTE BOT/bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` — full product requirements and security requirements section
- `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` — module boundaries, API namespaces, axioma bridge design
- `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` — live server topology, existing services, current nginx config

---

## Files Written

| File | Description |
|------|-------------|
| `docs/SECURITY_MODEL.md` | Password hashing (Argon2id params), session model (opaque token, httpOnly+Secure+SameSite=Lax, stored hashed, rotation/expiry), CSRF double-submit, auth rate-limiting (IP + account lockout), RBAC enforcement architecture, transport/headers (CSP nonce, HSTS preload), Zod validation rules, full STRIDE threat table |
| `docs/RBAC_MATRIX.md` | Role x resource x action table across every API namespace; teacher object-ownership rules; student non-enumeration rules; admin override audit requirement; "never" rules for bot control, exchange keys, credential stuffing |
| `docs/SECRET_VAULT_DESIGN.md` | AES-256-GCM envelope encryption (KEK from env wraps per-secret random DEK); stored VaultRecord shape `{v, keyId, iv, tag, wrappedDek, ciphertext}`; scoped decrypt permission; KEK rotation procedure (re-wrap); delete/revoke story; masking rules; plaintext prohibition rules |
| `docs/AUDIT_LOG_SCHEMA.md` | Append-only schema with all columns; full list of required audited events across 8 domains; redaction rules (field-name blocklist + value-pattern blocklist); sample rows; retention classes; access control |
| `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` | ES256 signed JWT for Open-Axioma-Journal / Account-Link; issuer, audience, subject, entitlement claim, 5-min expiry, jti nonce, replay prevention (jti revocation table + consume endpoint), CSRF nonce binding, key rotation via JWKS, Axioma validation checklist, audit events, hard rule on WTC never gating local order execution |
| `docs/handoffs/20260529-phase0-ecosystem-security-auditor.md` | This handoff |

---

## Findings

### Existing services (from discovery map)
- Axioma journal server at `axi-o.ma` already has JWT/rate-limiting per discovery map, but uses its own auth — the handoff token spec is additive, not replacing Axioma's internal auth.
- Old bot (`:8000`) and Tortila journal (`:8080`) are bound to `0.0.0.0` with no confirmed nginx reverse proxy — WTC must not assume these are protected. Bot adapter connections from the worker must go through the WTC server-side (not client-side) using internal network only.
- Axioma terminal uses Electron `safeStorage` for local exchange keys — WTC's vault design is for WTC-held keys only and does not interact with the Axioma local vault.

### Design choices made
1. **Opaque session token over JWT** for browser sessions — eliminates token content inspection, simplifies instant revocation, avoids algorithm confusion attacks.
2. **ES256 for handoff tokens** — asymmetric so Axioma does not need a shared secret; JWKS endpoint enables key rotation without out-of-band key distribution for every rotation.
3. **Argon2id at m=65536, t=3, p=2** — OWASP recommended minimum; deliberately not Bcrypt (GPU-resistant Argon2id is stronger).
4. **JTI revocation table in Postgres** (not Redis) for Phase 0 — simpler deployment; can be moved to Redis when scale requires it. 5-minute TTL means the table stays small.
5. **`__Host-` cookie prefix** — enforces `Secure`, no `Domain`, `Path=/` at the browser level, not just server configuration.
6. **Append-only audit log at DB permission level** — `wtc_app` role has only `INSERT + SELECT`; no application-level abstraction can accidentally DELETE or UPDATE audit rows.

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| SameSite=Lax (not Strict) | Strict breaks OAuth callback redirects and email magic link flows; Lax is correct for platforms with external auth touchpoints |
| Double-submit CSRF (not synchronizer token) | Avoids server-side CSRF state per session; works with Next.js server actions; SameSite=Lax covers most attack vectors; double-submit adds defense-in-depth |
| style-src 'unsafe-inline' in CSP at MVP | Tailwind CSS v4 generates inline styles in dev/SSR mode; to be tightened to nonce-only in Phase 3 |
| KEK stored in env var, not a KMS | Correct for self-hosted Phase 0; migration to AWS KMS / HashiCorp Vault is a Phase 3 hardening item (see Open Questions) |
| JWKS auto-discovery for Axioma public key | Eliminates manual key distribution on every rotation; Axioma can cache with 1h TTL |
| Retention classes (standard/security/financial) | Different regulatory retention requirements: financial events need 7yr for tax/compliance; security events 5yr; standard 2yr |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| KEK in env var — if env is leaked, all DEKs are exposed | HIGH | KMS migration planned for Phase 3; env access is OS/deployment level, not app level; no logging of env vars |
| Axioma journal server cannot yet validate WTC handoff tokens — bridge is not wired | MEDIUM | Spec is complete; implementation depends on Axioma team cooperation; `axioma_handoff_jti_revocations` table ready; fallback: show "Connect Axioma account" status without redirect |
| 5-minute token TTL window allows entitlement-revoked user to open journal briefly | LOW | Acceptable; for immediate revocation, admin can mark JTI `revoked_at` via admin endpoint |
| `style-src 'unsafe-inline'` in MVP CSP | LOW | Documented; scoped to MVP; Phase 3 tightening required |
| Old bot `:8000` and Tortila `:8080` bound to `0.0.0.0` | HIGH (existing, not WTC) | WTC must not add those ports to bot adapter config without confirming firewall/security group protection; document in BOT_INTEGRATION_PLAN.md |
| Playwright screenshots may capture masked key fields | MEDIUM | Masking rules documented; blur/exclude in CI screenshot artifacts; secretlint in CI |

---

## Tests / Verification

The following unit tests should be written in `packages/auth` and `packages/crypto` before any production wiring:

- `password.test.ts`: hash round-trip; verify timing-safe comparison; PHC format; reject empty password.
- `session.test.ts`: token generation entropy; SHA-256 storage; expiry check; revocation check; multi-session isolation.
- `csrf.test.ts`: reject missing header; reject mismatched header; accept matching header.
- `rbac.test.ts`: requireAuth throws on no session; requireRole throws on wrong role; requireOwnership passes for owner; requireOwnership passes for admin; requireOwnership throws for non-owner non-admin.
- `vault.test.ts`: encrypt/decrypt round-trip; AAD binding (modifying rowId fails decryption); rewrap produces new keyId; decrypt still works with old key after rewrap; delete zeroes vault_record.
- `handoffToken.test.ts`: issued token passes all Axioma validation steps; expired token rejected; consumed JTI rejected as replay; wrong alg rejected; mismatched nonce rejected; wrong aud rejected; wrong iss rejected; revoked JTI rejected.
- `auditWriter.test.ts`: secret field names are redacted; value patterns are redacted; write is atomic with action transaction; failed write rolls back action.

All tests run with Vitest, no DB or network required (use in-memory mock repositories).

---

## Next Actions

For the **backend-implementer** agent:

1. Create `packages/crypto/src/vault.ts` implementing `VaultRecord`, `encrypt`, `decrypt`, `rewrap` per `SECRET_VAULT_DESIGN.md`.
2. Create `packages/auth/src/password.ts` using `@node-rs/argon2` with params from `SECURITY_MODEL.md §1`.
3. Create `packages/auth/src/session.ts` implementing the opaque token session model.
4. Create `packages/auth/src/csrf.ts` implementing the double-submit CSRF middleware.
5. Create `packages/auth/src/rbac.ts` implementing `requireAuth`, `requireRole`, `requireOwnership`, `requireEntitlement`.
6. Create `packages/audit/src/writer.ts` implementing the append-only audit writer with field-name and value-pattern redaction.
7. Create `packages/axioma-bridge/src/handoffToken.ts` implementing `issueHandoffToken` and `consumeHandoffJti`.
8. Write Drizzle migrations for `sessions`, `exchange_api_key_secrets`, `secret_rotation_events`, `audit_logs`, `axioma_handoff_jti_revocations` tables.
9. Write all unit tests listed above.

For the **devops-implementer** agent:

1. Add `WTC_VAULT_KEK_<kid>`, `WTC_VAULT_ACTIVE_KEY_ID`, `WTC_AXIOMA_SIGN_PRIVATE_KEY_<kid>`, `WTC_AXIOMA_ACTIVE_SIGN_KID` to `.env.example` with placeholder values and comments.
2. Configure nginx `limit_req_zone` for auth endpoints.
3. Add HSTS header to nginx config.
4. Configure `secretlint` in CI.

For the **axioma-bridge-auditor** agent:

1. Confirm with Axioma team which of Option A (consume endpoint) or Option B (local Redis) they will implement for JTI replay prevention.
2. Document the JWKS public key exchange setup procedure in `CONTRACTS/axioma-bridge.md`.
3. Determine whether `axi-o.ma` nginx supports the required CORS headers for JWKS endpoint.
