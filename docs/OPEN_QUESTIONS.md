# WTC Ecosystem Platform — Open Questions

> Version: 2.0 | Owner: ecosystem-product-architect | Date: 2026-05-30
>
> Related: [PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md) · [MVP_SCOPE.md](./MVP_SCOPE.md) · [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md)

Each question has: a **status** (open / decided / blocked), a **chosen default** that applies until the question is formally resolved, and an **owner** responsible for resolving it. Agents must implement the default unless the owner explicitly overrides it and records the decision in `docs/ARCHITECTURE_DECISIONS.md`.

Conflicts between this file and the seed (`0000-orchestrator-seed.md`) → **seed wins**; record the conflict here.

---

## Q-1 — Axioma Package Rename Migration (`com.greenfield.terminal` → Axioma)

**Status**: Open

**Background**: The Axioma desktop terminal's current identity is `com.greenfield.terminal` / "Trading Terminal" (Electron `package.json`, `productName`, installer paths, Windows registry keys, macOS bundle ID, auto-updater feed URL, license vault path, and Electron `safeStorage` key name). The seed explicitly notes this rename is "a DELIBERATE migration, not a blind replace."

**Why this matters for WTC**: WTC's `/products/terminal` and `/app/terminal` pages will display the Axioma brand. If the desktop app and the server (`journal_server`) still identify as "Trading Terminal" / `com.greenfield.terminal`, WTC's product page and any handoff token claim sets must match the identifier the server actually validates. A blind rename at the WTC level without coordinating the server and desktop creates a verification mismatch.

**Scope of the migration (to be decided per-component)**:

| Component | Impact | Risk |
|-----------|--------|------|
| Electron `package.json` `name`, `productName` | Installer filename, shortcuts, Start menu entry | Uninstall of old version; upgrade path |
| macOS bundle ID (`CFBundleIdentifier`) | Code-signing, Keychain, Gatekeeper | Existing signed apps need re-signing under new ID |
| Windows registry key for installed app | Uninstaller cleanup, Windows Defender allowlist | Old entries may persist; dual install risk |
| `safeStorage`-encrypted key names | Exchange keys stored under old app name; re-encryption required | Existing users lose vault access without a migration utility |
| `license.enc` vault path | Hard-coded paths in Electron `main.ts` and `journal_server` download routes | Silent key-not-found on renamed builds |
| Auto-updater feed URL | Points to old GitHub release or S3 path | Updates break if feed URL changes without redirect |
| `journal_server` entitlement/download token claims | `aud`/`sub` fields may reference old identity | Cross-validation fails post-rename |
| `axi-o.ma` download file paths | Release artifacts named with old identity | Download links break |

**Chosen default** (applies until owner explicitly overrides): **Do not rename any existing component**. WTC uses "Axioma Terminal" as the display name in all UI copy. WTC-side bridge contracts reference `axioma_terminal` as the product code. Any token/claim sets in `CONTRACTS/axioma-bridge.md` use `axioma_terminal` as the WTC-side identifier but must specify that the Axioma server currently validates against `com.greenfield.terminal` until the migration is complete. The `AXIOMA_HANDOFF_TOKEN_SPEC.md` must document both sides explicitly.

**Owner**: platform-architect (coordinates with Axioma desktop and `journal_server` maintainer).

**Resolution criteria**: a written migration plan covering each row in the table above, with a rollback procedure and a vault re-encryption utility design, before any rename lands in any component.

---

## Q-2 — Billing Provider Choice

**Status**: Open

**Background**: The platform needs a real payment processor to handle subscriptions (`tortila_monthly`, `axioma_yearly`, etc.), one-time purchases (`education_lifetime`), renewals, cancellations, refunds, and chargebacks. The seed chose a `BillingAdapter` interface + mock; the concrete provider is TBD.

**Candidate options**:

| Provider | Subscription support | Crypto support | Complexity | Legal jurisdiction notes |
|----------|---------------------|----------------|-----------|------------------------|
| Stripe | Excellent (subscriptions, webhooks, customer portal) | Limited (Stripe Crypto — invite only) | Medium | Available in most regions; not available in all |
| LemonSqueezy | Good (simple subscription + digital products) | None | Low | Good for digital goods / SaaS |
| Paddle | Good (subscription + VAT handling) | None | Medium | Handles EU VAT by default |
| Coinbase Commerce | Crypto only | Yes | Medium | No subscription primitives |
| Custom (manual admin grant only) | Via `admin_grant` plan | Yes (offline) | Low (no automation) | Requires human for every activation |

**Chosen default**: **Manual admin grant only** (`admin_grant` plan code) with mock billing adapter. All subscriptions at MVP are activated by admin via `/admin/entitlements`. The `BillingAdapter` interface is fully specified; the `MockBillingAdapter` simulates webhook events for testing. No payment UI at MVP.

**Implication**: the `BILLING_PROVIDER_PLAN.md` and `CONTRACTS/billing-webhooks.md` must specify the interface so that a real adapter (e.g. Stripe) can be dropped in without changing the entitlement layer.

**Owner**: platform-architect / operator (business decision on provider).

**Resolution criteria**: provider selected; `BILLING_PROVIDER_PLAN.md` updated with: provider API version, webhook signature method, subscription lifecycle events handled, refund/chargeback handling, idempotency key strategy, and a test environment config.

---

## Q-3 — TradingView Automation Legality / ToS

**Status**: Open (blocked on ToS review)

**Background**: Granting TradingView indicator access to users requires adding their TradingView username to the indicator's "Invite-only" access list via the TradingView web UI. This is currently a manual step. The question is whether any programmatic/automated path is available and ToS-compliant.

**Known facts**:
- TradingView does not publish a public API for indicator access management.
- Any browser automation (Playwright/Puppeteer clicking TradingView's web UI) risks account suspension and violates ToS if TradingView's terms prohibit automated access.
- TradingView has historically terminated accounts for bot/automation activity on their platform.
- The prompt explicitly states: "Do not implement credential-stuffing or brittle browser automation as production default."

**Chosen default**: **Manual-only admin queue**. The WTC platform creates a `TradingViewAccessRequest`; the admin manually performs the grant in the TradingView web UI and marks it done in `/admin/tradingview-access`. The `TradingViewAutomationAdapter` interface is defined in `CONTRACTS/tradingview-access.md` with stub implementation, but no real automation code ships. Any future automation adapter is feature-flagged (`FEATURE_TRADINGVIEW_AUTOMATION=false` by default) and must pass a separate legal/ToS review before enabling.

**Owner**: operator (legal / ToS review); platform-architect (technical adapter design).

**Resolution criteria**: written confirmation from legal/TradingView that an automation path is ToS-compliant, OR a formal decision to remain manual-only permanently. Either outcome must be recorded in `ARCHITECTURE_DECISIONS.md`.

---

## Q-4 — Production Domain Topology

**Status**: Open

**Background**: The blueprint suggests `wtc.example.com` / `worldtraderclub.com` and `app.wtc.example.com`, but the actual domain(s) are not confirmed. The platform needs to know its domain to configure:
- CORS origin policies
- CSRF `SameSite` cookie configuration (`Strict` vs `Lax` depending on cross-subdomain needs)
- Axioma bridge CORS allow-list
- Next.js `NEXTAUTH_URL` equivalent
- Signed handoff token `aud` (audience) claims
- nginx virtual host config

**Chosen default**: All development configuration uses `localhost:3000`. The `config` package exposes `APP_URL` from env with a hard-fail if not set in production. CORS uses strict allow-list from env. The domain question is documented in `.env.example` as a required field with no default.

**Owner**: operator (domain registration / DNS); devops-implementer (nginx config).

**Resolution criteria**: final domain(s) confirmed; `nginx` config template in `docs/DEPLOYMENT.md` updated; CORS and cookie domain parameters locked.

---

## Q-5 — Cross-Domain WTC ↔ Axioma Auth

**Status**: Open

**Background**: WTC (`app.wtc.example.com`) and Axioma (`axi-o.ma`) are on different domains. Users may have:
- A WTC account only (new users)
- An Axioma (`axi-o.ma`) account only (existing Axioma users)
- Both accounts with no link
- Both accounts linked

The platform needs to handle all four states in the `/app/terminal` account-link flow.

**Open sub-questions**:
1. Does `journal_server` expose an account-link endpoint that accepts a WTC-signed token?
2. If not, is account-link purely informational at MVP (user enters their Axioma email, WTC stores it, no server-to-server validation)?
3. What is the trust model for the handoff token? (WTC signs → Axioma validates vs Axioma signs → WTC validates)
4. Which account is "primary" for identity purposes? (WTC is the master account by design, but Axioma has pre-existing accounts)
5. For existing Axioma users migrating to WTC: how do they prove their Axioma account ownership to WTC?

**Chosen default**: 
- **Account link is informational at MVP**: the user enters their Axioma account email in WTC; WTC stores it in `axioma_account_links.axioma_email` (unverified); no server-to-server validation yet.
- The "Open Axioma Journal" button generates a redirect to `axi-o.ma` without a signed token at MVP — the user logs into Axioma separately.
- The `AXIOMA_HANDOFF_TOKEN_SPEC.md` must specify the full verified-link design for post-MVP.
- The `/app/terminal` UI shows "Axioma account: unverified link" with a note that SSO is "coming soon."

**Owner**: axioma-bridge-auditor + security-auditor (token spec); operator (coordinates with Axioma server).

**Resolution criteria**: `AXIOMA_HANDOFF_TOKEN_SPEC.md` finalized; `journal_server` team confirms the account-link and token-validation endpoints; migration path for existing Axioma users documented.

---

## Q-6 — Is Club Bundled with Education?

**Status**: Open

**Background**: The seed lists `education` and `club` as separate product codes and separate plan codes (`education_lifetime`, `club_monthly`). The prompt does not explicitly state whether purchasing education automatically grants club access or whether they are always separate.

**Arguments for bundling**:
- Club is the social/community layer that makes education valuable.
- Separating them creates friction and reduces perceived value.
- `bundle_starter` includes `tortila_bot + education` — if club is the community layer, it arguably belongs in the starter bundle too.

**Arguments against bundling**:
- Club may have different revenue potential as a standalone recurring subscription.
- Club access includes premium signals; not all education users should receive signals.
- Separate product codes allow independent pricing and individual revocation.

**Chosen default**: **Club and education are separate products** with separate entitlements. Purchasing `education_lifetime` does NOT grant `club`. Bundles (`bundle_pro`, `bundle_starter`) explicitly list their member products and do not silently include club unless the bundle definition says so. The operator may choose to add `club` to `bundle_starter` via a migration — this must be an explicit decision.

**Owner**: operator (business decision on product packaging).

**Resolution criteria**: operator confirms the final bundle definitions; `ENTITLEMENT_STATE_MACHINE.md` updated with bundle expansion rules; plan registry migration updated if any bundle changes.

---

## Q-7 — Bot Journal Network Path in Production

**Status**: Open

**Background**: Tortila Journal (`:8080`) and Legacy Bot (`:8000`) are currently bound to `0.0.0.0` with no discovered nginx reverse proxy protecting them. The discovery map explicitly notes: "do not assume protected proxy."

When the WTC adapter layer eventually calls these services (post-MVP), it needs a secure network path. Options:

| Option | Security | Complexity |
|--------|----------|-----------|
| Direct HTTP from WTC worker to `localhost:8080` (if co-located) | Medium (same host only) | Low |
| Internal VPC/private network call | High | Medium |
| nginx auth-protected reverse proxy | Medium-High | Low-Medium |
| mTLS between WTC worker and bot services | High | High |
| VPN tunnel | High | Medium |

**Chosen default**: **No network connection at MVP** (mock adapters). The `CONTRACTS/tortila-adapter.md` and `CONTRACTS/legacy-bot-adapter.md` must specify the auth method, base URL env config, timeout, retry policy, and health-check endpoint before any real adapter is enabled.

**Owner**: platform-architect + devops-implementer.

**Resolution criteria**: network topology approved; nginx/firewall config reviewed; bot ports restricted to internal access only before any WTC-to-bot adapter goes live.

---

## Q-8 — Axioma Desktop Download Auth Model

**Status**: Open

**Background**: The Axioma desktop terminal needs to be downloadable from the WTC `/app/terminal` page. Current download path is `axi-o.ma/releases` (or similar). The download must be:
- Entitlement-gated (only active `axioma_terminal` holders)
- Non-forgeable (no guess-the-URL attack)
- Served without exposing unauthenticated file URLs

**Options**:
- Signed S3 pre-signed URLs generated by the bridge
- `axi-o.ma` download endpoint with WTC bridge auth header
- WTC streams the binary (not recommended — bandwidth + complexity)

**Chosen default**: **Static placeholder at MVP**. The download button links to a `TODO: signed download URL` message and the page copy says "Download available — contact support to receive your download link." Real signed URL requires `CONTRACTS/axioma-bridge.md` to specify the auth flow.

**Owner**: axioma-bridge-auditor.

**Resolution criteria**: download auth mechanism agreed with `axi-o.ma` operator; signed URL generation implemented in the bridge; no unauthenticated binary URLs in production.

---

## Q-9 — Exchange Platform Support (Beyond BingX)

**Status**: Open

**Background**: Tortila Bot is BingX-specific (`bingx_client`). The Legacy Bot configuration appears to support API key + secret but exchange is not confirmed to multi-exchange. The exchange vault (`exchange_accounts`, `exchange_api_key_secrets`) is designed generically. The question is whether WTC should support Binance, Bybit, or others at MVP.

**Chosen default**: **BingX only at MVP**. The `ExchangeAccount` table has an `exchange` enum field; BingX is the only value at launch. The exchange API key form in the setup wizard shows "BingX" as the only option. Adding exchanges requires a new adapter and a migration to the enum — it is a deliberate, audited change.

**Owner**: bot-integration-auditor + operator.

**Resolution criteria**: explicit operator decision on exchange roadmap; enum values added to migration; bot adapters updated.

---

## Q-10 — Hosting Environment: Single Server vs Separate

**Status**: Open

**Background**: Currently all services (old bot, Tortila, Axioma journal server) run on the same operator-managed VPS (`ubuntu@<shared-vps-ip>`). The WTC platform is planned for `/home/ubuntu/apps/wtc_ecosystem_platform` on the same server. This raises:
- Resource contention (Node.js + Postgres on same VM as Python bots)
- Networking: WTC worker calling bot journals on localhost (co-located) vs cross-server
- Security: process isolation between trading bots and web platform
- Deployment coupling: a bad WTC deploy could affect bot uptime

**Chosen default**: **Same server for MVP** (co-located). WTC runs on `127.0.0.1:8300`; nginx proxies WTC domain to it. Bot services remain on their current ports/systemd units. WTC does NOT call bot journal ports until adapters are audited. If resource contention becomes an issue, this is revisited post-MVP.

**Owner**: devops-implementer + operator.

**Resolution criteria**: nginx config reviewed; systemd unit for WTC platform defined; resource limits set (RAM, CPU cgroup if needed); process isolation design documented in `docs/DEPLOYMENT.md`.

---

## Q-11 — Secret Vault KEK Custody: Env Var → Managed KMS

**Status**: Open

**Background**: The secret vault ([SECRET_VAULT_DESIGN.md](./SECRET_VAULT_DESIGN.md)) uses AES-256-GCM envelope encryption: a per-row **DEK** encrypts each exchange API key, and a **KEK** wraps each DEK. In the Phase 0 design the KEK lives **only in environment variables** (`WTC_VAULT_KEK_<keyId>`, with `WTC_VAULT_ACTIVE_KEY_ID` selecting the active key; **implemented today as the single `SECRET_VAULT_KEK` + `SECRET_VAULT_KEY_ID`** — the per-keyId multi-version naming is the design's rotation TARGET, not yet built) — by design it "never touches the DB." This is acceptable for local development and early phases, but env-var KEK custody is a single point of total compromise at production scale.

**Risk**: The KEK is the root of trust for every stored secret. Any exposure of the WTC process environment — a crash/error trace that serializes `process.env`, a misconfigured logger or debug/`printenv` endpoint, `/proc/<pid>/environ` read by a co-located process, a leaked CI/CD secret store, or a backup of an `.env` file — leaks **all** KEK versions at once. With the KEKs, every `wrappedDek` can be unwrapped → every DEK recovered → **every user's exchange API key decryptable**. On the shared VPS (see Q-10 — same host as the trading bots), any process or operator able to read the WTC process environment gains the same total access. There is no hardware boundary and no per-decrypt audit trail.

**Candidate options**:

| Option | KEK custody | Hosting fit | Cost | Ops complexity |
|--------|-------------|-------------|------|----------------|
| **AWS KMS** | Key material stays inside AWS HSM; WTC calls `Encrypt`/`Decrypt` (or `GenerateDataKey`) to wrap/unwrap DEKs — KEK never enters app memory or env | Natural only if WTC runs on AWS; cross-cloud calls from the current VPS add egress cost + latency | Per-request + per-key/month | Low (fully managed; CloudTrail audit + automatic rotation) |
| **HashiCorp Vault (Transit engine)** | Encryption-as-a-service; KEK stays in Vault, wrap/unwrap over API | Cloud-agnostic; self-hostable on the same infra / private network (fits the single-server model) or HCP-managed | Self-host = compute + ops time; HCP = subscription | High (stateful service: unseal, HA, backup, upgrades) |
| **Self-hosted SOPS (age/PGP)** | Encrypts the env/secret file at rest; the age/PGP private key is still needed at runtime | Portable; no extra running service | Near-zero | Low infra, but manual key handling |

> SOPS reduces *plaintext-env-in-git/CI* exposure but does **not** remove the runtime "key available to the process" problem — it is better viewed as interim hardening than as the production end state. AWS KMS and HashiCorp Vault both move the KEK behind a boundary the WTC process never holds, which is the actual goal.

**Decision criteria**:
- **Hosting model** — are we committed to AWS, another cloud, or the self-managed VPS? (Coupled to Q-10.) AWS KMS is only natural on AWS; Vault/SOPS are portable.
- **Cost** — KMS per-request + per-key/month vs Vault self-host compute/ops vs HCP subscription vs ~free SOPS.
- **Ops complexity** — managed KMS (lowest) vs running a stateful HA Vault (highest) vs minimal-infra SOPS.
- **Hot-path latency** — `vault.decrypt()` runs on the bot key-test / live path; a network round-trip per unwrap must fit the adapter timeout budget (or use a short-lived cached data-key pattern).
- **Auditability** — KMS CloudTrail / Vault audit device must feed [AUDIT_LOG_SCHEMA.md](./AUDIT_LOG_SCHEMA.md).
- **Blast radius & rotation** — hardware-backed keys + automatic rotation reduce blast radius versus env vars.

**Chosen default** (applies until owner resolves): **Keep the env-var KEK** (`WTC_VAULT_KEK_<keyId>`) per [SECRET_VAULT_DESIGN.md](./SECRET_VAULT_DESIGN.md) for Phase 0–2, with interim hardening — KEK injected only at deploy time from the host secret store (never committed; no real value in `.env.example`), env readable only by the WTC process user, structured-logger blocklist redacts `key`/`dek`/`wrappedDek`/etc., no debug/`printenv` endpoints, and crash handlers must not serialize `process.env`. **Do not** run a production deployment that stores real user exchange keys at scale on env-only KEK custody.

**Migration is low-risk by design**: the envelope scheme already isolates KEK custody behind the `wrappedDek` column, so switching providers does not touch any exchange-key ciphertext. Introduce a `KeyProvider` abstraction in `packages/crypto/src/vault.ts` (env-var provider today; KMS/Vault provider later); the migration is then a `vault.rewrap()` pass — decrypt each DEK under the old env KEK and re-wrap it under the KMS-held KEK — identical in shape to the documented KEK rotation, writing a `secret_rotation_events` row per record.

**Owner**: security-auditor (owns the vault design) + devops-implementer (KMS/Vault provisioning, IAM, network path) + operator (cost and hosting-model decision, coupled to Q-10).

**Resolution criteria**: hosting model decided (depends on Q-10); KMS provider selected; `packages/crypto/src/vault.ts` `KeyProvider` interface specified with env-var and chosen-KMS implementations; migration runbook (rewrap pass + rollback to env KEK) written and dry-run on staging; KMS/Vault audit stream wired into `AUDIT_LOG_SCHEMA.md`; hot-path latency budget validated; decision recorded in `ARCHITECTURE_DECISIONS.md`. **Target: resolve and implement in Phase 3**, as a hard gate before any production deployment handling real user exchange keys at scale.

---

## Q-12 — Phase 2 Route Architecture: Static vs Dynamic for Product/Bot Pages

**Status**: Decided (this session)

**Background**: The Phase 2 prompt requested explicit static paths for product pages (`/products/tortila-bot`, `/products/legacy-bot`, `/products/axioma-terminal`, `/products/tradingview-indicators`, `/products/education`) and explicit bot sub-paths (`/app/bots/tortila/{overview,setup,exchange-keys,symbols,risk,...}` and `/app/bots/legacy/{...}`). The existing codebase uses dynamic routes (`/products/[slug]` and `/app/bots/[bot]`) that already handle per-product content branching.

**Decision**: **Keep dynamic routes only; no static route duplicates.** The slugs from `packages/entitlements/src/registry.ts` are the canonical URL identifiers. `generateStaticParams()` on the dynamic routes provides equivalent SEO behavior. Wizard steps within `/app/bots/[bot]/settings` (setup, exchange-keys, symbols, risk) are UI implementation detail — not separate top-level product routes. Bot navigation stays flat with 7 sub-tabs.

**Rationale**: DRY over two code paths, canonical slug registry already maps product codes to URLs, no SEO difference, reduces maintenance surface.

**Owner**: product-architect (decided) + frontend-implementer (implement Phase 2 sub-tab content).

**Resolution criteria**: this question is decided. Record in `ARCHITECTURE_DECISIONS.md` if any deviation is required.

---

## Q-13 — Phase 2 Education Route: Individual Lesson Pages

**Status**: Open

**Background**: Phase 1.7 implements the course list at `/app/education` with a flat course → lessons view (all lessons listed under the course card). Phase 2 requires individual lesson pages with video embed, progress marking, and material download. The route structure is not yet defined.

**Options**:
1. `/app/education/[courseId]/[lessonId]` — deeply nested dynamic route; clean URL, separate page per lesson.
2. `/app/education?course=[courseId]&lesson=[lessonId]` — query-params approach; same page component switches content.
3. `/app/education/[courseId]` — course page lists lessons inline; no separate lesson route.

**Chosen default**: Option 1 (`/app/education/[courseId]/[lessonId]`) — clean URLs for SEO (logged-out users cannot see these pages but URL structure matters for bookmarking and breadcrumbs), and consistent with the App Router dynamic segment pattern already used for bots and products.

**Owner**: frontend-implementer (Phase 2); education-implementer (LMS plan).

**Resolution criteria**: individual lesson route implemented and wired to `lmsService.listLessonsForStudent()` with fail-closed entitlement check; `lesson_progress` tracking requires Phase 1.8 table migration (`enrollments`, `lesson_progress`) to land first.

---

## Q-14 — SECRET_HINTS ↔ LEGACY_SECRET_FIELD_NAMES coordination

**Status**: Open (standing coordination item; introduced Phase 2.8 / PG3)

**Background**: The legacy-bot plaintext-key exclusion schema (`packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`, `LEGACY_SECRET_FIELD_NAMES`) maintains its OWN secret-field-name list rather than importing from `@wtc/audit` redact.ts (`SECRET_HINTS`). This was a deliberate package-boundary decision: `@wtc/bot-adapters` depends only on `@wtc/analytics`, and coupling an adapter package to the audit package's redaction internals is a layering smell. Both the bot-integration auditor (D-05/F-07) and the security auditor (F-01) flagged the resulting drift risk.

**Why this matters**: If a future redact.ts `SECRET_HINTS` addition (e.g. a new credential field name) is NOT mirrored into `LEGACY_SECRET_FIELD_NAMES`, a plaintext field under that new name could survive the Zod exclusion if the legacy adapter is ever un-blocked (B3). The exclusion list must remain a **superset** of `SECRET_HINTS`.

**Chosen default**: `LEGACY_SECRET_FIELD_NAMES` is a manually-maintained **superset** of `SECRET_HINTS` with an in-file comment pointing at redact.ts. Any change to `packages/audit/src/redact.ts` `SECRET_HINTS` MUST be mirrored into `LEGACY_SECRET_FIELD_NAMES` in the same change (the security-auditor owns the addition path).

**Owner**: security-auditor (owns redact.ts) + bot-integration-auditor (owns the exclusion schema).

**Resolution criteria**: either (a) a single shared zero-dependency secret-hint module both packages import, or (b) a CI test asserting `LEGACY_SECRET_FIELD_NAMES ⊇ SECRET_HINTS`. Until then, the mirror is by review discipline. Note: `passphrase` is currently in `LEGACY_SECRET_FIELD_NAMES` but not in redact.ts `SECRET_HINTS` — consider adding it to redact.ts.

## Q-15 — Axioma handoff jti replay check: Option A (WTC consume endpoint) vs Option B (Axioma local cache)

**Status**: Open (decision needed before B4 clearance; introduced Phase 2.9 / PG6)

**Background**: `AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention` offers two ways for Axioma to detect a replayed handoff token. **Option A** — Axioma calls `POST /api/axioma/jti/consume` back to WTC (two-party trust; WTC is the source of truth; requires an Axioma-to-WTC service-token auth scheme). **Option B** — Axioma keeps a local Redis/bloom set of consumed jtis with TTL = token-exp + buffer (Axioma standalone; trusts WTC's signature + exp). The WTC-side Option A route exists locally as of Phase 3.10 and is fail-closed behind DB availability, `AXIOMA_ROUTE_SKELETON_ENABLED=true`, and a non-empty `AXIOMA_BRIDGE_API_TOKEN`.

**Why this matters**: It decides whether live Axioma will call WTC's consume route (Option A) or whether `consumeHandoffJti` remains a WTC-side primitive while Axioma tracks consumed JTIs locally (Option B). The PG6 jti store (`recordHandoffJti`/`consumeHandoffJti`) supports **both**; the local route is not the same as live endpoint-shape acceptance.

**Owner**: security-auditor + axioma-bridge-auditor, coordinated with the axi-o.ma maintainer (EXT).

**Resolution criteria**: the Axioma team confirms which model they will run and the exact endpoint/auth envelope. Until then the consume route is local-only/fail-closed evidence; live B4 activation stays blocked.

## Q-16 — Deprecate the HS256 `AXIOMA_HANDOFF_SIGNING_SECRET` production requirement once `APP_ENV` is the deploy axis

**Status**: Resolved in Phase 3.9

**Background**: PG6 added `APP_ENV` + the ES256-key staging/prod superRefine, but kept the existing `env.ts` requirement that `AXIOMA_HANDOFF_SIGNING_SECRET` (the HS256 dev-stub secret) be present + strong in `NODE_ENV=production`. Phase 3.9 removed that unused production requirement; ES256 key/kid are now the production/staging signing gate.

**Why this matters**: the staging/prod fence now rests on `APP_ENV` + the ES256 key pair. The HS256 dev-stub remains available only for dev/test and still throws in production.

**Owner**: security-auditor (owns env.ts secret guards).

**Resolution criteria**: met in Phase 3.9 (`packages/config/src/env.ts` and `packages/config/src/env.test.ts`). Keep this question closed unless a deployment runbook regression reintroduces HS256 as a production requirement.
