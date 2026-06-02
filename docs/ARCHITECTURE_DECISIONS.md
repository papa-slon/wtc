# Architecture Decisions (ADR log)

Append-only. Newest decisions at the bottom of each section.

## ADR-001 — Monorepo tooling: npm workspaces (not pnpm)
**Status:** accepted. **Context:** blueprint recommends pnpm; host has Node 24 + npm 11 but
no pnpm/turbo. **Decision:** use npm workspaces + a single root `tsconfig.json` for typechecking.
**Consequence:** scripts run via `npm -w <pkg> run <script>`; lockfile is `package-lock.json`.
No `turbo.json` is present (it was never scaffolded); Turbo can be added later if build caching is needed.

## ADR-002 — ORM: Drizzle (not Prisma)
**Status:** accepted. **Context:** prompt allows Prisma or Drizzle. **Decision:** Drizzle ORM +
drizzle-kit in `packages/db`. **Rationale:** SQL-first, no engine binary, fits the repository
pattern and analytics queries; easy to mirror existing Postgres/SQLite shapes from the bots.

## ADR-003 — No separate `apps/api` for MVP
**Status:** accepted. **Decision:** use Next.js route handlers + server actions; keep ALL domain
logic in `packages/*`. **Rationale:** avoids a premature service split while honoring the
"no business logic in app/" rule. Revisit if the API must scale independently.

## ADR-004 — Discovery via documented snapshot, no live SSH
**Status:** accepted. **Decision:** treat `WTC_ECOSYSTEM_DISCOVERY_MAP.md` (snapshot 2026-05-29)
as the discovery source; read local repos read-only. Do not SSH the live trading server this
session. **Rationale:** strictest reading of "do not touch the live server"; the snapshot already
captures the API surfaces and risk signals needed to design adapters.

## ADR-005 — Axioma product code = `axioma_terminal`, route slug = `terminal`
**Status:** accepted. **Decision:** the prompt's "terminal" product is Axioma. Canonical product
code `axioma_terminal`; public/app route slug remains `terminal`. Bridge-only integration.

## ADR-006 — Secret vault: AES-256-GCM envelope encryption
**Status:** accepted. **Decision:** KEK from env (`SECRET_VAULT_KEK`, base64 32 bytes) wraps a
per-secret random DEK; ciphertext stored as `{v, keyId, iv, tag, wrappedDek, ciphertext}`.
Plaintext never persisted/logged/returned. Rotation = re-wrap DEKs under a new KEK id.

## ADR-007 — Password hashing: Argon2id
**Status:** accepted. **Decision:** Argon2id via `@node-rs/argon2` (m=65536, t=3, p=2 per
docs/SECURITY_MODEL.md §1). Sessions are opaque random tokens (hex) in httpOnly+SameSite=Lax
cookies (`__Host-` prefix in prod), stored hashed server-side.

## ADR-008 — Bot adapter flag: `BOT_ADAPTER_MODE` (single source of truth)
**Status:** accepted (acceptance-hardening pass). **Context:** code used a boolean
`ENABLE_REAL_ADAPTERS` while every doc used `BOT_ADAPTER_MODE` (`mock|read-only|audited`).
**Decision:** standardize CODE on `BOT_ADAPTER_MODE` (richer; models the `audited` control gate and
the phased rollout). `ENABLE_REAL_ADAPTERS` is removed. Default `mock`; real read-only adapters
require an explicit non-`mock` mode AND a base URL; control methods stay disabled regardless.
A Vitest test (`packages/bot-adapters/src/adapters.test.ts`) asserts real adapters cannot connect
by default and that control throws.

## ADR-009 — Fail-closed secrets + session-bound CSRF
**Status:** accepted (acceptance-hardening pass). **Decision:** `requiredSecret()` (@wtc/shared)
returns a labelled DEV-ONLY fallback only outside production and THROWS in production when a secret
is missing — applied to `SECRET_VAULT_KEK`, the CSRF/`SESSION_SECRET`, and the Axioma handoff signing
secret. Secret-dependent singletons (the vault) are created LAZILY so the guard fires at runtime
(fail closed) without breaking `next build`. CSRF uses a per-session synchronizer token derived via
HMAC(session, SESSION_SECRET) — no extra cookie, no first-render race — verified in every
authenticated mutating server action. Admin server actions call `assertAdmin()` inline (the layout
guard does not protect a directly-POSTed action). The mock-checkout self-grant is fenced by
`assertNotProduction()`.

## ADR-010 — Postgres 17 standardised (supersedes seed's "PostgreSQL 16")
**Status:** accepted (Phase 1.5). **Context:** `0000-orchestrator-seed.md` locked "PostgreSQL 16",
but this host actually runs **PostgreSQL 17** (`C:\Program Files\PostgreSQL\17`, :5432) and that is the
only Postgres available for the real DB gate. **Decision:** standardise on **17** across
`docker-compose.yml` and `.github/workflows/ci.yml` (both `postgres:17-alpine`) so local dev, CI, and
the host match. **Consequence:** no SQL/Drizzle change (16↔17 are compatible for our schema); the seed's
"16" is a historical note. Reconciled here per the seed's deviation rule.

## ADR-011 — Phase 1.5 persistence-correctness, secret-quality, and cookie hardening
**Status:** accepted (Phase 1.5). **Decisions:**
(a) **Atomicity** — `grantProduct`/`revokeProduct` write the entitlement change **and** the audit row in
one `db.transaction`; `createUser` (user+roles, in-txn dup check) and `addExchangeKey`
(account+sealed-secret) are transactional. The repo audit param was dropped from grant/revoke (audit is
written inside the txn). (b) **Uniqueness** — `entitlements` gains a UNIQUE index on
`(user_id, product_code)` (migration `0001_*`), and `db:seed` entitlement inserts use
`onConflictDoNothing` for idempotent re-seed. (c) **Logout** — `destroySession` is now `async` and is
**awaited** in `logoutAction` so the DB session is revoked before redirect. (d) **Secret quality** —
`@wtc/shared` adds `isLowEntropySecret`/`isWeakSecret`; `requiredSecret` and `@wtc/config`'s
`loadEnv` reject placeholder **and** low-entropy secrets in production, and require
`AXIOMA_HANDOFF_SIGNING_SECRET` in production. (e) **`__Host-` cookie** — `apps/web` now derives the
session cookie name from `sessionCookieName(isProd)` (realises ADR-007's intent: `__Host-wtc_session`
in production). (f) **HS256 stays dev-only** — the Axioma handoff signer throws in production until the
ES256/JWKS signer exists. (g) **`job_queue`** is documented as RESERVED/not-yet-consumed (no fake
durable queue). See `docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md`.

## ADR-012 — Wave-2: no new packages; @wtc/analytics owns all bot metric computation
**Status:** accepted (Phase 2 epoch 20260530-0126). **Context:** Wave-2 adds full LMS, billing, Axioma
ES256/JWKS, and bot analytics dashboard. A question arose whether to introduce new packages (e.g.
`@wtc/notifications`, `@wtc/bot-dashboard`). **Decision:** no new `packages/*` directories for Wave-2.
All 14 existing packages are sufficient. Specifically: `@wtc/analytics` is the exclusive home for
`computeMetrics` and all bot metric normalization logic; React components never import `@wtc/analytics`
directly — they receive `CanonicalMetrics` as typed props from `queries.ts`. `@wtc/bot-adapters` feeds
`BotSnapshot` objects; `queries.ts` is the server-side orchestration layer that calls both.
**Rationale:** avoids premature package proliferation; the analytics logic is already fully typed and
tested; a new "bot-dashboard" package would be a thin wrapper with no meaningful boundary.
**Consequence:** if a future mobile app or separate analytics service needs the compute logic, extracting
`@wtc/analytics` as a standalone package is trivial (it has zero React dependencies and no HTTP calls).

## ADR-013 — Wave-2: feature-dir layout is canonical; page.tsx files are always thin shells
**Status:** accepted (Phase 2 epoch 20260530-0126). **Decision:** `apps/web/src/features/<domain>/`
with `queries.ts` / `actions.ts` / `schemas.ts` / `types.ts` / `components/` is the canonical home for
all Wave-2 UI logic. `page.tsx` files may only: (1) call `queries.ts` functions to fetch server data,
(2) pass the result as props to feature components, (3) enforce authentication/entitlement at the route
level via `requireRole`/`hasAccess`. No data fetching beyond calling a `queries.ts` function, no
business logic, no inline Zod schemas in `page.tsx`. **Rationale:** prevents the god-component pattern;
keeps business logic testable independently of the routing layer; ensures implementers have a clear,
collision-free write scope per feature directory.

## ADR-014 — Wave-2: parallel implementation gated on disjoint file ownership; serial spine for shared files
**Status:** accepted (Phase 2 epoch 20260530-0126). **Decision:** because the repository is NOT a git
repo (no worktree isolation), concurrent edits to the same file are forbidden. The Wave-2 plan is
structured as: (a) a SERIAL SPINE for all shared-file edits (schema → repositories → backend selectors
→ service wiring → actions), and (b) DISJOINT PARALLEL GROUPS for per-page feature work once the spine
is stable. Groups are defined by exclusive file ownership: the LMS feature group owns
`apps/web/src/features/lms/**`; the billing group owns `apps/web/src/features/billing/**`; the bot
analytics group owns `apps/web/src/features/bots/**`. No group touches another group's files.
**Consequence:** the spine must reach a green typecheck/test gate before any parallel group starts.
See `docs/handoffs/20260530-0126-ecosystem-platform-architect.md` for the full sequenced plan.

## ADR-015 — `apps/web/src/middleware.ts` must be created on the serial spine before any API route groups
**Status:** accepted (Phase 2.4 epoch 20260530-1625). **Context:** As of Phase 2.4, no
`apps/web/src/middleware.ts` exists. The billing webhook contract (`billing-webhooks.md §3`) already
requires that the webhook path be excluded from CSRF middleware. Phase Group 11 (security/rate-limiting)
requires IP-keyed rate-limiting on the auth endpoints. Multiple product groups (4, 5, 6) will add new
API route handlers that depend on per-request authentication and CSRF behavior.
**Decision:** `apps/web/src/middleware.ts` is a shared serial-spine file. It must be created as part of
Phase Group 11 (security), which must complete before any group that adds API route handlers dependent on
middleware behavior. The current file must: (1) apply IP-keyed rate-limiting to the real auth server-action
POST paths `/login` and `/register`; (2) explicitly exclude `/api/billing/webhook` from middleware mutation
so the provider raw body remains intact; (3) pass through all other routes unless document security headers
are being applied. Future `/api/auth/*` routes, if added, need their own explicit middleware review.
**Consequence:** Phase Group 11 is a prerequisite for Phase Groups 2, 4, 5, and 6 if those groups add
API route handlers (server actions are unaffected). The middleware file is owned exclusively by the
security-auditor agent; no other agent edits it.
See `docs/handoffs/20260530-1625-ecosystem-platform-architect.md` (F-04, Risks).

## ADR-016 — PG6: `APP_ENV` as deployment-env discriminator; `@wtc/axioma-bridge` stays pure
**Status:** accepted (PG6 audit epoch 20260530-2230). **Context:** The HS256 dev-stub guard in
`packages/axioma-bridge/src/handoff.ts` fences only on `NODE_ENV==='production'`. There is no
`staging` value in `NODE_ENV` (constrained by Next.js to `development|test|production`), and the
bridge package must not import `@wtc/config` or read `process.env` (pure-package constraint).
**Decision:**
(a) Add `APP_ENV: z.enum(['development','test','staging','production']).default('development')` to
`packages/config/src/env.ts`. `NODE_ENV` is unchanged.
(b) The staging+production fence for ES256 is `APP_ENV === 'staging' || APP_ENV === 'production'`.
(c) `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` are formalized in `envSchema` as
optional strings; a `superRefine` requires both when `APP_ENV` is staging or production.
(d) Signer resolution lives in `apps/web/src/lib/server-config.ts` as `getAxiomaSignerOrNull()`:
it calls `loadEnv()`, builds an `Es256Signer | null`, and passes it into the bridge factory. The
bridge factory accepts the signer as a parameter. The package never reads env directly.
(e) `signHandoffToken` in `handoff.ts` replaces its `process.env.NODE_ENV` guard with a caller-passed
`isProductionLike: boolean` parameter — removing the last `process.env` access from the pure package.
**Consequence:** `@wtc/axioma-bridge` remains zero-dependency-at-runtime. The APP_ENV → signer
resolution path is: `loadEnv()` → `getAxiomaSignerOrNull()` → bridge factory parameter. No bridge
code reads env directly. CTAs stay disabled until B4 (EXT+OP) is cleared.
See `docs/handoffs/20260530-2230-ecosystem-platform-architect.md`.

## ADR-017 — PG7: server-action authorization denials must audit-then-throw (no silent return); CSRF-first
**Status:** accepted (PG7 audit epoch 20260530-2330). **Context:** The 10 LMS server actions silently
`return`ed on every RBAC/ownership/entitlement denial — a denied attempt (e.g. Teacher A submitting
Teacher B's `courseId`) produced a 200-with-no-effect and **no audit row**, defeating the append-only
audit trail. Separately, each action ran `requireUser()` before `assertCsrf()`, so a forged cross-site
POST reached the session read before CSRF rejection. **Decision:**
(a) **Fail loud on authorization denial.** Every server-action RBAC/ownership/entitlement check writes
**one audit row with `result:'failure'`** (`after:{reason,attempted}`, no secrets) and **then throws
`AppError`** (`'forbidden'` 403 / `'entitlement_denied'` 402). A silent `return` on an authz denial is
prohibited. Input errors (Zod), not-found/unpublished, and demo mode (`getServerDb()` null) stay
**graceful** — they are not authorization events.
(b) **Two denial audit codes per domain** (`education.rbac_denied` + `education.entitlement_denied`),
not one — so monitoring can separate routine entitlement gating from anomalous authz violations. The
finer reason (`role|ownership|admin_required|<access reason>`) rides in `after.reason`. `AuditResult`
stays `'success'|'failure'` (the action code carries the "denied" semantic; matches `auth.login_failed`).
(c) **CSRF-first.** `assertCsrf(formData)` is the **first awaited statement** of every authenticated
server action, before `requireUser()` (`assertCsrf` reads the session cookie directly, independent of
`requireUser`). Canonical pipeline: assertCsrf → requireUser → RBAC/ownership/entitlement (audit+throw)
→ Zod → repo (in-txn success audit) → revalidate.
(d) **Placement.** The audit+throw orchestration lives in the feature layer (`features/<domain>/guard.ts`),
reusing the pure `@wtc/*` decision guards (e.g. `assertTeacherOwns`); never in React pages.
**Consequence:** Authorization denials are always traceable; CSRF is enforced before any session read or
I/O. Because vitest excludes `apps/web/**`, these invariants are guarded by **static source-analysis
tests** (`tests/integration/lms-rbac-pipeline.test.ts`) plus the `@wtc/audit` building-block tests + e2e.
First applied to LMS (PG7); the convention generalizes to every server-action domain.
See `docs/handoffs/20260530-2330-ecosystem-security-auditor.md` + `…-ecosystem-platform-architect.md`.

## ADR-018 — PG8: admin tables go mobile-readable via a CSS `data-label` card-stack (not a scroll box); admin gets its own MobileNav

**Status:** accepted (PG8 audit epoch 20260530-2345). **Context:** The admin console's `.wtc-table` had no
responsive handling — the 10-column TradingView queue (plus ~7 other tables) overflowed horizontally at
375px with no recovery, and the admin layout never rendered `<MobileNav>` (the sidenav is `display:none`
below 900px), so admins had **no navigation on mobile**. Two responsive options were weighed: (a) an
`overflow-x:auto` scroll box, and (b) a CSS-only card-stack that turns each row into a labelled card
below 640px. **Decision:**
(a) **Card-stack, not a scroll box.** Use `.wtc-table-wrap` + a per-`<td>` `data-label` attribute
(DESIGN_SYSTEM.md §14, owned by `ecosystem-ux-ui-designer`). The scroll-box option is rejected: it still
scrolls, and the criterion is *no* 375px horizontal scroll. A shared `<ResponsiveTable>` component is
**not** introduced for PG8 — the pure-CSS base suffices and adds no component dependency (extract later
if warranted). The CSS lives in `packages/ui/src/theme.css` (the design system owns it, not `apps/web`).
A `min-width:0 !important` mobile rule lets fixed-`minWidth` inline form inputs shrink to fit 375px
without editing each call site.
(b) **Admin MobileNav.** `<MobileNav items={ADMIN_NAV} />` renders **inside** the admin layout, after the
`isAdmin` gate, so ADMIN_NAV links are never exposed to a non-admin.
(c) **Derived read-state pill.** PG2 `readState` is surfaced on `/admin/bots` as a pill **derived** from
the last persisted health check (`tortilaLastOkAt`/`tortilaLastError`/`mode`) — **no live probe in the
render path** (an ops page reflects the last worker cycle, not a synchronous network call).
(d) **Honest pills everywhere + per-page RBAC.** Every admin page surfaces a canonical storage pill and
calls `requireUser()`+`assertAdmin()` itself (defence-in-depth beyond the layout gate); the education
page was migrated off the weaker `getCurrentUser`+`roles.includes` pattern and its nested `<main>` removed.
**Consequence:** Every admin table is wrapped + carries `data-label`; the guard is the static
`tests/integration/admin-responsive.test.ts` (no unwrapped table, MobileNav present, education canonical
RBAC with no nested `<main>`, every page has a storage pill) plus the 375px Playwright spec
`tests/e2e/admin-mobile-pg8.spec.ts`. The convention generalizes to any future data table in the app.
See `docs/handoffs/20260530-2345-ecosystem-ux-ui-designer.md` + `…-ecosystem-frontend-implementer.md`.

## ADR-019 — PG9: cabinet card derivation is a pure `@wtc/cabinet` package; the card lives in `features/cabinet` (no `@wtc/ui`→cabinet cycle); fail-closed signal gathering

**Status:** accepted (PG9 audit epoch 20260531-0005). **Context:** The `/app` cabinet rendered only entitlement
state. PG9 enriches each product card with setup / activity / next-action / blockers. Two auditor splits had to be
resolved: (1) where the pure derivation lives — frontend-implementer proposed `apps/web/features/cabinet/deriver.ts`
(static-guarded only, since vitest excludes `apps/web/**`), tests-runner proposed `packages/cabinet` for real Vitest
coverage; (2) where the card component lives — ux-ui-designer + tests-runner proposed `packages/ui`, frontend-implementer
proposed an app-layer wrapper. **Decision:**
(a) **Pure logic → a new zero-dependency `@wtc/cabinet` package** (`deriveProductCard` + `ACCESS_REASON_COPY`). Fail-closed
access→view-model logic is security-critical and earns **real unit coverage** (26 tests incl. 5 fail-closed invariants);
AGENTS.md mandates "logic in packages, not React files". The frontend objection (extracting server-only input types) is
avoided by making the deriver take **already-resolved primitive inputs** and importing cross-package symbols **type-only**
(erased at build) — the package pulls no runtime dependency, exactly like `@wtc/entitlements`.
(b) **Presentational card → `apps/web/src/features/cabinet/CabinetProductCard.tsx`, NOT `packages/ui`.** Putting it in the
design-system kit would create a **`@wtc/ui` → `@wtc/cabinet` circular dependency** (the card consumes `CabinetCardView`,
and `@wtc/cabinet` type-imports `Tone` from `@wtc/ui`). The kit stays low-level; the feature-specific card composes its
primitives. Reusable CSS (`.wtc-wizard-steps`/`.wtc-step`/`.wtc-card-row`) still lives in `packages/ui/src/theme.css`.
(c) **Fail-closed data minimisation.** The server-only `features/cabinet/loader.ts` gathers per-product setup/activity
signals **only inside the `access.allowed` branch** (also fixing the `indicators/page.tsx` anti-pattern, security F-01).
Static product facts (B3/B4 blockers, availability) are surfaced regardless — they are honest product status, not user data.
(d) **B4 via a static blocker registry, not an env flag** (dead-code-avoidance) — removed in code, with its consumer, when B4 clears.
(e) **Setup wizard = a single `?step=` route** (GET-link navigation) so the e2e stays navigation-only and clear of the
dev-only Server-Action flake; `BotSubNav` is unchanged. **Consequence:** the deriver is unit-tested in `@wtc/cabinet`; the
app-layer cabinet/wizard are static-guarded (`tests/integration/cabinet-pg9.test.ts`) + 375px e2e (`tests/e2e/cabinet-pg9-mobile.spec.ts`).
A future cleanup consolidates the legacy `ProductStatusCard` tone map onto `@wtc/cabinet`.
See `docs/handoffs/20260531-0005-ecosystem-ux-ui-designer.md` + `…-frontend-implementer.md` + `…-security-auditor.md` + `…-tests-runner.md`.

## ADR-020 — PG10: backtester ships as an honest permanently-locked card (option b), NOT the real local-runner pipeline; pure decision logic in `@wtc/backtester`

**Status:** accepted historically (PG10 audit epoch 20260531-0030), partially superseded by Phase 3.2. Tortila now has a real entitlement-gated local-runner ZIP download MVP; server-side job/result/artifact upload remains deferred. Legacy remains permanently "not available".

**Context:** The full backtester design
(`docs/BACKTESTER_DISTRIBUTION_PLAN.md` + `docs/CONTRACTS/backtester-runner.md`) specifies a real local
runner — `backtest_jobs`/`backtest_artifacts` tables, 9 API routes, HMAC upload tokens, artifact storage
+ signed URLs, Zod artifact schemas, chart components, and a vendored Python runner ZIP — a multi-session
epic. What had actually shipped was a HALF-STATE: the Tortila page rendered a dead config form + two
disabled teaser buttons ("Queue run (local runner required)" / "Download local runner (soon)") with
"coming in a future release" copy; the Legacy card said "Coming soon"; and `packages/backtester` was an
orphaned, untested (0% coverage), spec-drifted in-memory `BacktestService` stub imported by nothing. The
operator was asked to choose (a) build the real runner pipeline, or (b) an explicit, permanently-honest
locked card with no half-state.
**Decision (operator): option (b).** PG10 ships a permanently honest "not yet available" backtester — no
tables (41 unchanged), no API routes, no upload tokens, no runner ZIP, no fake results.
(a) **Pure decision logic → `deriveBacktesterView()` in `@wtc/backtester`** (mirrors the @wtc/cabinet
precedent: pure, zero-runtime-dependency via type-only cross-package imports, real Vitest coverage — 10
unit tests incl. fail-closed + no-fake-results invariants). The drifted/unused in-memory
`BacktestService`/`BacktestJob`/`BacktestParams`(`system: string`)/`BacktestStatus`(missing `cancelled`)
were **removed** (dead-code-avoidance — no consumer, and they contradicted the authoritative spec, which
stays the sole source of truth in the contract docs until option (a) is built; this overrides the
auditor's "retain as a TARGET stub" lean). `index.ts` re-exports `derive.ts`.
(b) **The page is a thin shell** over the deriver — 3 honest states: legacy product-boundary / Tortila
access-required / Tortila entitled-but-runner-not-distributed. No config form, no disabled teaser button,
no "coming soon"/"future release"/"(soon)" copy. FAIL CLOSED — the Tortila path checks entitlement before
any content and loads no per-user data.
(c) **Cross-surface honesty:** a shared `backtesterPill(slug)` (single source of truth via
`BACKTESTER_RUNNER_DISTRIBUTED = false`) replaces the bot-overview's green "Available" backtester pill
(which falsely implied a usable feature) — tortila → neutral "Not yet available", legacy → "Not available".
(d) **`@wtc/backtester` is now imported by the page + overview**, justifying its `apps/web` dependency +
`transpilePackages` entry (the orphan finding is resolved by USE, not removal — logic belongs in packages).
The **no-fake-results invariant** (no backtest metric/equity curve without a real uploaded artifact) is
active regardless of when option (a) ships. **Consequence:** option (a) is a future multi-session epic;
when green-lit it reintroduces a DB-backed job/artifact layer from the contract docs (correct `system: 1|2`,
`cancelled` state) and flips `BACKTESTER_RUNNER_DISTRIBUTED`. Guarded by `packages/backtester/src/derive.test.ts`
(unit) + `tests/integration/backtester-pg10.test.ts` (static) + `tests/e2e/backtester-pg10-mobile.spec.ts`
(375px). See the 5 per-agent handoffs at epoch 20260531-0030 + the aggregate
`docs/handoffs/20260531-0030-phase-2-13-backtester-locked-card.md`.

## ADR-021 — Phase 3.1: first bounded slice of the deferred rich LMS — 4 additive columns (level/tags/content_type/external_url), retire `deriveContentType`, defer embed/upload/global/slug/state
**Status:** accepted (2026-05-31, Phase 3.1 audit epoch 20260531-0130). **Context:** PG7 (ADR-017) unanimously
deferred the rich LMS schema to Phase 3 with a ready-to-run per-field DDL spec and per-field blockers. A
5-auditor read-only fan-out (db-architect + education + frontend + security + tests) confirmed which fields
are bounded — i.e. have a real reader **and** writer this session (dead-code-avoidance) and no open
security/decision gate.
**Decision:** migration **0005** (additive, 0 new tables → still 41) adds only **`courses.level`** (text
NOT NULL DEFAULT 'beginner' + CHECK beginner|intermediate|advanced), **`courses.tags`** (text[] NOT NULL
DEFAULT '{}', **display/write only** — no array operators; PGlite can't, and B1 real-PG is NOT RUN),
**`lessons.content_type`** (text NOT NULL DEFAULT 'video' + a hand-appended backfill from `video_url` +
CHECK video|embed|article|link), and **`lessons.external_url`** (nullable). The `deriveContentType(videoUrl)`
heuristic is **retired** (the column is now the single source of truth; all 3 `queries.ts` callsites + the
function + its unit test removed) — co-landed with the migration to prevent dual-truth. Consumers co-land so
no column is dead schema: teacher create/edit forms (level select + tags input + content_type select +
external_url), a **new `updateLessonAction`** (the content_type write path for *existing* lessons — only a
publish toggle existed before), and level/tags/content-type display on catalogue/teacher/admin/student surfaces.
**Security (hard conditions from the security auditor — all met):** `'embed'` is a forward-compat CHECK value
but is **never** offered in the editor and **never** renders raw HTML (no server-side sanitizer exists →
stored-XSS gate; embed shows a safe placeholder). **Every** URL write path now enforces
`z.url().startsWith('https://')` — this also **fixed a pre-existing XSS gap** where `materialSchema.url` and
`lessonSchema.videoUrl` accepted `javascript:`/`data:` schemes that render as a clickable `href`. A
render-time `safeHttpsUrl()` guard (new pure `@wtc/lms/urls`, unit-tested) is defence-in-depth on video,
external-link, and material hrefs. `level` is a Zod enum AND a DB CHECK (client never trusted).
**Consequence:** the migration's backfill UPDATE is hand-appended (drizzle-kit cannot emit UPDATE).
**Deferred, each with a confirmed blocker (each its own future slice):** `lessons.embed_html` (needs a
server-side allowlist HTML sanitizer + security sign-off), `materials` file-meta (upload security review
BLOCKED + no object storage), `pinned_links owner_type='global'` (non-additive DROP+ADD CHECK + Q-6 bundling
undecided), `courses.slug` (no slug-URL routing consumer; routes use `[courseId]` UUID),
`lesson_progress.state` (the `deriveLessonState` derivation works; no video-scrub consumer), and the teacher
community / pinned-link / teacher-profile web surfaces (repos exist; no UI). Guarded by
`tests/integration/db-lms-ph3-1.test.ts` (PGlite round-trip + the 0005 backfill against the real generated
SQL) + `tests/integration/lms-ph3-1-static.test.ts` (deriveContentType retired, https-only, no embed write,
no raw-HTML render) + `tests/e2e/education-ph3-1-mobile.spec.ts` (375px). See the 5 per-agent handoffs at
epoch 20260531-0130 + the aggregate `docs/handoffs/20260531-0130-phase-3-1-lms-rich.md`.
**Revisit if:** the sanitizer lands (unlocks embed), the upload review clears (unlocks file-meta), Q-6 is
decided (unlocks global pins), or slug routing / scrub-position tracking gets built.
