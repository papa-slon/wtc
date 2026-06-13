# PRODUCTION_BUILD_PROGRAM.md — autonomous, governed path to Production-B

> **What this is:** the single backbone an autonomous session reads to drive the WTC ecosystem from
> "strong canary" to **Production-B** (the operator-confirmed vision below). It sequences the work so a
> fresh session can run **hands-off**, building phase after phase in the background, and **stops to ask
> the operator only at a short list of dangerous gates**.
>
> **Read with:** [`SESSION_PROTOCOL.md`](SESSION_PROTOCOL.md) (process Rules 1–8 — binding),
> [`../AGENTS.md`](../AGENTS.md), [`handoffs/0000-orchestrator-seed.md`](handoffs/0000-orchestrator-seed.md)
> (canonical technical decisions), [`STATUS.md`](STATUS.md), [`MVP_SCOPE.md`](MVP_SCOPE.md),
> [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md), [`SITEMAP.md`](SITEMAP.md).
> **Source of this plan:** the 2026-06-13 read-only production-gap audit (11 area agents + synthesis).

---

## 1. Production-B vision (operator-confirmed)

A **premium, native, low-clutter ecosystem** — not a pile of tabs/fake buttons.

- **End-user:** registers/logs in; **buys education** (paid courses, student cabinet); **views** bots
  read-only (a user can **never** turn a bot on); sees **aggregate / marketing performance** that proves
  the bots make money **without exposing any secret or per-user data**; subscribes to **each product
  separately** (bot1, bot2, future bot3, terminal, …) **or** one **all-access bundle**; can **preview**
  Axioma (separate brand: terminal+journal, not finished → clean teaser/stub).
- **Admin (operator):** sees per-user stats; **removes/bans/soft-deletes** users; **assigns roles**
  (incl. teacher); manages product access; **wires Telegram links**; **embeds YouTube/Instagram**;
  uploads education; reaches every necessary control — powerful but clean.
- **UX bar:** premium, native, intuitive; rules/docs present; unfinished areas show **prepared
  placeholders/teasers, never broken junk**.
- **Hard invariant:** `FEATURE_LIVE_BOT_CONTROL=false` forever for users — nothing on the site controls
  live money. Per-account bot config is a WTC-versioned DRAFT.

---

## 2. Autonomy & gate policy — **POLICY A** (operator-chosen 2026-06-13)

The autonomous session **builds freely and commits** across the entire safe surface (code, UI, LMS,
admin, subscription logic, stubs, docs, tests). It **STOPS and asks the operator only** at these
🛑 **gates** (every gate is also written to the run log + STATUS.md):

| 🛑 Gate | Why it pauses |
|---|---|
| **Live deploy** to any server | Outward-facing, affects the live site |
| **Anything touching real money / the live bot** | Irreversible, real funds |
| **Turning on real payments** (live Stripe keys, go-live) | Real money in |
| **Deleting / editing real user data** at runtime | Irreversible user impact |
| **Sending anything external** (email, Telegram, webhooks out) | Outward-facing |
| **A secret/credential the operator must supply** (Stripe, domain, KMS, S3/R2, Axioma keys) | Operator-only input |

Everything else runs **without the operator**. **Building** a gated feature (e.g. the admin
delete-user UI, or the Stripe price plumbing) is **safe and autonomous**; only **using it against live
data / going live** is the gate. Build it, test it against throwaway data, commit it, and **queue the
go-live behind its gate.**

---

## 3. Foundation already shipped (do **not** rebuild)

Entitlement engine (9-state fail-closed, bundles) · Argon2id auth + sessions + CSRF + rate-limit +
login-lockout · exchange-key vault (AES-256-GCM envelope, KEK-wrapped DEK) · append-only audit log +
secret redaction · billing **webhook** infra (HMAC verify, idempotency ledger, manual-review queue,
Stripe test-mode checkout path) · **Tortila premium dashboard** + **Legacy reconstructed dashboard**
(read-only, journal-token server-side) · **per-account settings** (release `97209c4`, migration 0022) ·
admin console (entitlements / TradingView / user-bots drilldown / fleet health / audit / system-health /
support / terminal) · TradingView access workflow · **LMS engine** (courses/lessons/materials/
enrolments/progress, teacher cabinet, sanitized embed, upload boundary with MIME+SHA256+EICAR) · Axioma
bridge scaffold (ES256, JWKS, JTI revocation, fail-closed routes) · public marketing pages · design
system (`packages/ui`) · CI (gates + e2e) · HTTPS canary · worker (snapshots, sweeps, reconciler).

The gap is **revenue + acquisition surfaces**, not the skeleton.

---

## 4. Autonomous execution order

Phases keep the audit's `P1…P12` numbers, but the **build halves run first** (Group A, no operator),
and the **gate halves are batched** for the operator (Group B). The conductor advances Group-A phases
back-to-back; it only pauses for a Group-B gate.

### Group A — runs hands-off, in this order (each ends in a commit on green gates)
1. **P1-build** — billing correctness (no keys needed): fix partial-refund over-revoke; fix
   `indicators_quarterly` (`one_time`→subscription); add `billing_customers` table + reuse `cus_…`;
   wire webhook signature-error → audit; populate `priceDisplay` plumbing (values filled at the gate).
2. **P3 — public proof-of-performance** *(biggest commercial gap)*: typed **public-safe metric
   allowlist** (`pnl_pct`, win-rate, max-dd, profit-factor, trades, 7/30/90-day % — **never $**, never
   per-user/account); server aggregate loader (strips all per-user data) + 60s cache + rate-limit;
   `/performance` (or `/products/tortila` "Track record"); honest DEMO badge; Legacy limited to bag/
   breadth indicators (closed-trade source blocked). Privacy review + quant-honesty review BLOCK ship.
3. **P4 — user self-service**: password-reset flow (operator-delivered link at MVP, email at the gate);
   `/app/settings` (display name, email-change w/ password confirm + audit); BingX-only key form;
   post-registration onboarding empty-state; Stripe customer-portal cancel link; `pending_payment` 24h
   cleanup worker; bundle-upgrade CTA.
4. **P5 — Axioma premium teaser**: expand `/products/terminal` to the full `TERMINAL_PRODUCT_AREA.md`
   §2.2 spec (3-panel, feature grid, screenshots-coming, hard-boundary callout, account-link explainer,
   stable version badge); `/app/terminal` reads the **real** `axioma_account_links` row; resolve
   `bridgeActionsImplemented` from the real readiness signal (stays false until P10). No live CTAs.
5. **P7 — LMS video + progress**: in-page player (YouTube/Vimeo/`<video>`) → debounced
   `POST /api/education/progress`; course-level progress; resume-from-last; **fix product-specific
   course access** (`accessFor(course.productCode)` not hardcoded `'education'`); per-state student-wall
   messaging (grace = soft banner, not a wall); prev/next; teacher card; real public course teasers.
6. **P8 — UX polish**: Toast/success system in `packages/ui`; SVG equity chart on `/equity`; mobile
   `wtc-table-wrap` on `/trades`; homepage hero mobile collapse; `/app` cross-product risk banner +
   portfolio summary; entitlement-aware SideNav lock icons.
7. **P6-build — admin user management**: migration `deleted_at`/`disabled_at`/`banned_at`;
   `softDeleteUser`/`banUser`/`disableUser` (in-txn session revoke + audit); role-assign repo+UI
   (teacher/admin/support); per-user admin profile page; confirmation **Drawer** in `packages/ui`;
   force-password-reset action. *(Building is autonomous; **using delete/ban on a real user is a 🛑
   gate** at runtime.)*
8. **P9 — admin community/content**: admin Telegram-link + YouTube/Instagram embed manager (reuse LMS
   pinned-link + sanitized-embed); wire teacher CRUD into `/admin/education` (edit any teacher);
   lesson edit/reorder page; enriched `/admin` overview; course `slug` routing.
9. **P11-build — security hardening (no infra choice needed)**: CSP per-request nonce; structured
   logger with redaction; soft-delete migration on `exchange_api_key_secrets`; `audit_logs.retentionClass`;
   worker jobs: prune `billing_webhook_events` (90d TTL), daily Stripe subscription reconciliation.
   *(KEK→KMS migration is the 🛑 part — see P11-gate.)*
10. **P12-content — sales-quality product pages**: expand `/products/{tortila,legacy,indicators,
    education,club}` with strategy copy, illustrative (not live) charts, risk excerpts, real LMS teasers,
    Telegram deep-link placeholders; pricing section anchors.

### Group B — operator gates (the session pauses and asks; see §6 open questions)
- **P1-gate** — operator supplies live Stripe keys + `STRIPE_PRICE_MAP`; register webhook in Stripe
  Dashboard at the branded domain; run `accept:billing:*` preflights; fill real `priceDisplay`; go live.
- **P2** — branded domain + Let's Encrypt + nginx block (operator-approved) + **automated nightly
  pg_dump** + uptime monitoring + append-only audit-role proof in prod + provider firewall audit +
  worker `tsx`/fail-closed/`db:seed` fixes deployed.
- **P6-runtime** — actually deleting/banning a real user (the feature is built in Group A).
- **P10 — Axioma live bridge** *(XL, external)* — blocked on **Q-15** (Axioma team confirms
  `/wtc-handoff` shape + JTI model) and key provisioning; then live adapter, installer streaming,
  feedback bridge, worker sync jobs, 6 e2e specs, package-rename (Q-1).
- **P11-gate** — KEK custody → AWS KMS / Vault (`KeyProvider` abstraction + `rewrap()`), per **Q-11**.
- **P12-gate** — S3/R2 + scanner live preflights with operator creds; `LMS_FILE_STORAGE_PROVIDER=s3-r2`.
- **Every deploy** — each Group-A wave is deployed to canary only at an operator deploy gate (or
  auto-canary if the operator later raises the autonomy mode to B).

---

## 5. Definition of done per phase

A Group-A phase is **done** when: (1) the key items are implemented; (2) `node scripts/gates.mjs core`
is green **and observed** (never claimed — Rule 8); (3) `node scripts/gates.mjs full` (adds build) is
green; (4) e2e for touched surfaces is green (run isolated, per the gate runner rules); (5) the relevant
**auditor(s) signed off** (security/privacy for P3; quant-honesty for any public number; billing for P1);
(6) per-agent + aggregate handoffs exist (Rules 2–4); (7) a commit lands on the build branch with a
clear message. No phase claims completion on an unobserved gate.

---

## 6. Open questions that clear the 🛑 gates (operator inputs)

Answer any time; the session pre-fills what it can and **pauses** at each unanswered gate.

- **Q-2 Payment provider (clears P1 go-live):** Stripe (infra fully built). Needs `BILLING_PROVIDER=stripe`,
  `STRIPE_SECRET_KEY` (`sk_test_` for acceptance → `sk_live_` for prod), `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_MAP` (one price id per plan code). No code change — only env.
- **Q-4 Branded domain (clears P2):** the final production domain (for CORS/HSTS/`__Host-`/handoff
  audience/nginx vhost).
- **Backup (clears P2):** pg_dump→object-storage cron *vs* managed (pgBackRest/Barman) *vs* cloud DB snapshots.
- **Storage (clears P12):** Cloudflare R2 / AWS S3 / DO Spaces for LMS uploads + which malware scanner.
- **Q-11 KEK custody (clears P11-gate):** when to move KEK env→KMS/Vault; staying on VPS or moving to cloud?
- **Q-15 + Q-1 Axioma (clears P10):** Axioma team confirms `/wtc-handoff` shape + JTI model + service
  auth; and the desktop package-rename timeline.
- **Legacy closed-trade source (ongoing):** is there any stable realized-trade source for the Legacy bot?
  Until then, Legacy public stats are honestly **N/A** for win-rate/profit-factor.

---

## 7. How the autonomous loop runs (conductor + SESSION_PROTOCOL)

The **`release-gate-conductor`** agent owns the loop and enforces `SESSION_PROTOCOL` Rules 1–8:

1. Read ground truth (this file, STATUS.md, latest handoff, MVP_SCOPE, OPEN_QUESTIONS) — never from memory.
2. Pick the next pending **Group-A** phase. **Dispatch read-only auditors BEFORE any edit** (Rule 1).
3. Build via implementers split by **disjoint write scopes** (parallel only when file sets don't overlap).
4. Run gates **only** via `scripts/gates.mjs` **sequentially** (never parallel gate storms; e2e isolated;
   kill node + wipe `.next` on a corrupted-cache `MODULE_NOT_FOUND`). Observe green — never claim it.
5. Run the **adversarial auditors** (security/privacy/quant-honesty) as BLOCK gates where §5 requires.
6. Write per-agent + aggregate handoffs (Rules 2–4); commit on green; update `STATUS.md`.
7. Advance to the next Group-A phase. On a **🛑 Group-B gate**, STOP: log it, write a handoff, and hand
   the operator a copy-pasteable resume prompt (Rule 7). Do not continue past a gate silently.
8. Final report lists gates **RUN vs NOT-RUN** with reasons; closes all background agents (Rule 5).

**Hands-off continuation:** the launch playbook keeps the loop alive across the session (self-paced
wake-ups) so the operator launches once and walks away; the loop only surfaces at 🛑 gates or when the
Group-A queue is drained.

---

## 8. Agent fleet for this program

**Keep (14 existing):** product-architect, platform-architect, ux-ui-designer, frontend-implementer,
backend-implementer, db-architect, bot-integration-auditor, axioma-bridge-auditor, security-auditor,
billing-access-auditor, education-implementer, tradingview-access-implementer *(on-demand)*,
tests-runner, devops-implementer. *(backtester-architect → on-demand; ADR-020 locked card.)*

**Add (6 new — defined in `.claude/agents/`):**
- **release-gate-conductor** — owns the autonomous loop + Rules 1–8 (above). The single biggest missing capability.
- **public-proof-of-performance-designer** — the public marketing performance surface (safe aggregates, no leaks).
- **quant-performance-honesty-reviewer** — BLOCK authority over every public-facing number (realized vs
  unrealized, fees/funding netting, survivorship, drawdown basis, sample size, demo-vs-live labels).
- **multi-account-per-account-specialist** — owns the per-account/sub-account model end-to-end (Layer A
  built; Layer B = live-key writes stays gated).
- **docs-onboarding-rules-writer** — end-user copy, onboarding, rules/FAQ, and the teaser/placeholder copy
  for every unfinished area (so nothing ships developer-toned or bare).
- **lms-content-structure-curator** — curriculum architecture (tracks, levels, taxonomy) so the paid LMS
  isn't an empty shelf. *(Curriculum **content** is the operator's; this owns the structure.)*

**Improve:** task-router → worklane/queue planner feeding the conductor.

---

## 9. Pre-launch checklist (operator, one-time)

1. Decide the **build branch** base (default: branch off the current canary tip `97209c4`, or merge
   `feat/legacy-premium-statistics` → main first).
2. Optionally pre-answer §6 questions to reduce gate-pauses.
3. Paste the launch prompt from [`AUTONOMOUS_BUILD_LAUNCH.md`](AUTONOMOUS_BUILD_LAUNCH.md) into a fresh
   session. The loop takes over from there.
