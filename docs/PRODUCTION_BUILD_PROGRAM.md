# PRODUCTION_BUILD_PROGRAM.md — autonomous, governed path to Production-B

> **What this is:** the single backbone an autonomous session reads to drive the WTC ecosystem from
> "strong canary" to **Production-B**. It sequences the work so a fresh session runs **hands-off**,
> building phase after phase in the background, **stubbing anything that needs an operator input/secret
> and continuing** — never blocking — and collecting everything the operator must supply into a single
> **punch-list** at the end.
>
> **Read with:** [`SESSION_PROTOCOL.md`](SESSION_PROTOCOL.md) (process Rules 1–8 — binding),
> [`../AGENTS.md`](../AGENTS.md), [`handoffs/0000-orchestrator-seed.md`](handoffs/0000-orchestrator-seed.md),
> [`STATUS.md`](STATUS.md), [`BUILD_PROGRESS.md`](BUILD_PROGRESS.md) (the cross-session baton),
> [`MVP_SCOPE.md`](MVP_SCOPE.md), [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md), [`SITEMAP.md`](SITEMAP.md).
> **Source of this plan:** the 2026-06-13 read-only production-gap audit (11 area agents + synthesis).

---

## 1. Production-B vision (operator-confirmed)

A **premium, native, low-clutter ecosystem** — not a pile of tabs/fake buttons.

- **End-user:** registers/logs in; **buys education** (paid courses, student cabinet); **views** bots
  read-only (a user can **never** turn a bot on); sees **aggregate / marketing performance** that proves
  the bots make money **without exposing any secret or per-user data**; subscribes to **each product
  separately** **or** one **all-access bundle**; can **preview** Axioma (separate brand: terminal+journal,
  not finished → clean teaser/stub).
- **Admin (operator):** sees per-user stats; **removes/bans/soft-deletes** users; **assigns roles**
  (incl. teacher); manages product access; **wires Telegram links**; **embeds YouTube/Instagram**;
  uploads education; reaches every necessary control — powerful but clean.
- **UX bar:** premium, native, intuitive; rules/docs present; unfinished areas show **prepared
  placeholders/teasers, never broken junk**.
- **Hard invariant:** `FEATURE_LIVE_BOT_CONTROL=false` forever for users. Exchange API keys are
  **per-user, entered by the user and stored encrypted** in the vault (already built); the site never
  controls live money. Per-account bot config is a WTC-versioned DRAFT.

---

## 2. Build policy — **STUB-AND-CONTINUE** (operator-chosen 2026-06-14)

The autonomous session **builds + commits freely** across the whole surface and **never pauses for an
operator input or secret.** When a step needs something only the operator can provide (Stripe keys,
domain, S3 creds, KMS decision, Axioma integration shape, real content), it:

1. builds the **prepared form / clean stub** (disabled CTA + premium "coming/contact" copy, or a
   feature-flagged-off path), so the surface is finished and not broken;
2. adds a line to the **PUNCH-LIST** in [`BUILD_PROGRESS.md`](BUILD_PROGRESS.md) (`needs: <input>`); and
3. **continues to the next phase.**

At the end of the run it outputs the consolidated **punch-list** ("to go to real prod I need: …").

### The only true hard stops (never autonomous)
- **Live deploy to any server** — the operator deploys (or approves it) as a separate end-step.
- **Anything touching real money / the live bot / real user-data deletion / sending anything external** —
  these do not arise during a stub build (payments are stubbed, there are no real users yet, live control
  is off), and must never be performed autonomously if they ever could.

Everything else runs without the operator. Building a gated feature is autonomous; only *using it live*
is the operator's action — which lands on the punch-list, not a mid-run pause.

---

## 3. Operator decisions & answers (2026-06-14)

- **Payments:** do **not** create Stripe yet → ship a clean **payments stub** (prices shown as honest
  "coming soon / contact", or a disabled checkout) everywhere; still fix the billing bugs + build the
  price-display plumbing so it's a one-env-flip later. Punch-list: Stripe product/price setup + keys.
- **Domain:** none yet → build **domain-agnostic** (no hard-coded host; cookie/CORS/HSTS read from env).
  Punch-list: final domain + DNS + cert.
- **DB backup (operator delegated the choice):** decision = **nightly `pg_dump` → AWS S3** (matches the
  storage choice; one provider), 7 daily + 4 weekly retention, restore documented. Build the script now;
  punch-list: S3 bucket + creds. *(If we move off VPS later, switch to managed snapshots.)*
- **LMS file storage:** **AWS S3** (adapter already built). Wire `LMS_FILE_STORAGE_PROVIDER=s3` as the
  intended prod setting; keep the existing fallback until creds exist. Punch-list: S3 bucket + creds + the
  external malware-scanner endpoint.
- **Exchange keys / KEK:** exchange keys stay **per-user, user-entered, encrypted** (already the model).
  **Stay on the VPS**; KEK remains an env secret for now (KMS/Vault is a *future scale* item, not this
  program). No action beyond keeping the vault model; punch-list (future): KEK→KMS when user keys scale.
- **Axioma:** not ready; integration shape unclear; it's a **separate project/brand/site + a desktop app**.
  On THIS web it's a **stub now** — premium preview/teaser + disabled CTAs. **Proposed integration (to
  confirm later):** WTC = the storefront + entitlement gate + signed handoff; Axioma publishes terminal
  **release artifacts** (installer) that WTC's `GET /api/axioma/download` proxies for entitled users, and
  the **journal** is Axioma's cloud journal that WTC opens via the already-scaffolded ES256 signed-handoff
  token (JWKS + JTI). So "the web hosts the journal/download" = WTC proxies a signed download + a
  signed journal-open, while the terminal app itself stays Axioma's. Punch-list: Axioma team confirms the
  `/wtc-handoff` shape + JTI model + where release artifacts live; package rename.

---

## 4. Foundation already shipped (do **not** rebuild)

Entitlement engine (9-state fail-closed, bundles) · Argon2id auth + sessions + CSRF + rate-limit ·
exchange-key vault (AES-256-GCM envelope) · append-only audit log + redaction · billing **webhook** infra
(verify/idempotency/manual-review) · **Tortila premium** + **Legacy reconstructed** dashboards (read-only) ·
**per-account settings** (release `97209c4`, migration 0022) · admin console · TradingView workflow ·
**LMS engine** · Axioma bridge scaffold (ES256/JWKS/JTI) · public marketing pages · design system · CI ·
HTTPS canary · worker. The gap is **revenue + acquisition surfaces**, not the skeleton.

---

## 5. Autonomous execution order (Group A — runs hands-off, each ends in a commit)

Phases keep the audit's `P*` numbers. The build halves run back-to-back; operator-input items are stubbed
+ punch-listed (§2). Run order:

1. **P1-build — billing correctness + payments stub:** fix partial-refund over-revoke; fix
   `indicators_quarterly` billing type; add `billing_customers` table + reuse `cus_…`; wire webhook
   signature-error → audit; build `priceDisplay` plumbing; **ship the payments-stub** (no Stripe).
2. **P3 — public proof-of-performance** *(biggest commercial gap)*: typed public-safe metric allowlist
   (%/win-rate/dd/PF/trades/7-30-90-day % — **never $**, never per-user); server aggregate loader +
   60s cache + rate-limit; `/performance` (or `/products/tortila` "Track record"); honest DEMO badge;
   Legacy limited to bag/breadth. Privacy review + quant-honesty review BLOCK ship.
3. **P4 — user self-service:** password-reset (operator-delivered link MVP; email = punch-list);
   `/app/settings`; BingX-only key form; post-registration onboarding empty-state; cancel/portal link
   (stub until Stripe); `pending_payment` 24h cleanup worker; bundle-upgrade CTA.
4. **P5 — Axioma premium teaser (stub):** expand `/products/terminal` to the full premium spec;
   `/app/terminal` reads the **real** account-link row; resolve `bridgeActionsImplemented` from the real
   signal (stays false → CTAs disabled with premium "coming" copy, not dead buttons).
5. **P7 — LMS video + progress:** in-page player → debounced progress; course-level %; resume; **fix
   product-specific course access** (`accessFor(course.productCode)`); per-state student-wall messaging
   (grace = soft banner); prev/next; teacher card; real public course teasers.
6. **P8 — UX polish:** Toast/success system; SVG equity chart on `/equity`; mobile `/trades`; homepage
   hero mobile; `/app` cross-product risk banner + portfolio summary; entitlement-aware SideNav locks.
7. **P6-build — admin user management:** migration `deleted_at`/`disabled_at`/`banned_at`; soft-delete/
   ban/disable repo fns (in-txn session revoke + audit); role-assign repo+UI; per-user admin profile;
   confirmation **Drawer** in `packages/ui`; force-password-reset. *(Building is autonomous; deleting a
   real user is the operator's runtime action.)*
8. **P9 — admin community/content:** admin Telegram-link + YouTube/Instagram embed manager (reuse LMS
   pinned-link + sanitized embed); wire teacher CRUD into `/admin/education`; lesson edit/reorder;
   enriched `/admin` overview; course `slug` routing.
9. **P11-build — security hardening (no infra choice needed):** CSP per-request nonce; structured logger
   with redaction; soft-delete migration on `exchange_api_key_secrets`; `audit_logs.retentionClass`;
   worker jobs: prune `billing_webhook_events` (90d), daily Stripe subscription reconciliation (no-op
   until Stripe live). *(KEK→KMS is out of scope per §3.)*
10. **P12-content — sales-quality product pages + backup script:** expand `/products/*` (strategy copy,
    illustrative charts, risk excerpts, real LMS teasers, Telegram placeholders); write the **nightly
    pg_dump→S3 backup script** + restore doc (creds = punch-list); wire S3 as the intended LMS provider.

**Deferred to operator (punch-list, not a mid-run pause):** Stripe go-live · domain + DNS + cert ·
every live deploy · S3 bucket+creds · external scanner · email provider · Axioma team confirmation +
artifacts · (future) KEK→KMS.

---

## 6. Definition of done per phase

Done when: (1) key items implemented (operator-input parts = clean stub + punch-list line); (2)
`node scripts/gates.mjs core` then `full` green **and observed** (never claimed — Rule 8); (3) e2e for
touched surfaces green (isolated); (4) the BLOCK auditors signed off (security/privacy for P3;
`quant-performance-honesty-reviewer` for any public number; billing for payments); (5) per-agent +
aggregate handoffs exist (Rules 2–4); (6) a commit lands on the build branch; (7) `BUILD_PROGRESS.md`
updated (phase ✓ + any punch-list lines).

---

## 7. How the autonomous loop runs (conductor + cross-session baton)

The **`release-gate-conductor`** owns the loop and enforces `SESSION_PROTOCOL` Rules 1–8. To survive the
context limit, the loop is **bounded per session** and chained via the baton:

1. Read ground truth (this file, `BUILD_PROGRESS.md`, STATUS.md, latest handoff) — never from memory.
2. Pick the next pending Group-A phase. **Dispatch read-only auditors BEFORE edits** (Rule 1).
3. Implement via background **workflows** (heavy work in subagents → main-loop context stays lean), split
   by **disjoint write scopes**.
4. Gates **only** via `scripts/gates.mjs`, sequential, e2e isolated; observe green, never claim it.
5. BLOCK auditors where §6 requires.
6. Per-agent + aggregate handoffs; commit; tick the phase + append punch-list lines in `BUILD_PROGRESS.md`.
7. **Never pause for an operator input** — stub it + punch-list it + continue (§2).
8. After **a bounded batch (≈2–3 phases) or when context approaches the limit (Rule 7)**: STOP, ensure
   `BUILD_PROGRESS.md` is current, and emit the **one-line resume command** for a fresh session. Do not
   run the same session until it dies.
9. When the Group-A queue is **drained**: write the final **PUNCH-LIST** report (everything the operator
   must supply for real prod) and stop.

**Hands-off chaining:** each fresh session resumes from `BUILD_PROGRESS.md`. The operator either re-pastes
the one-line resume, or enables the optional scheduled routine (see `AUTONOMOUS_BUILD_LAUNCH.md`) that
fires the resume automatically so the whole queue drains unattended without any single session bloating.

---

## 8. Agent fleet

**Keep (14 existing)** + **6 new** in `.claude/agents/`: `release-gate-conductor` (owns the loop),
`public-proof-of-performance-designer`, `quant-performance-honesty-reviewer` (BLOCK authority on public
numbers), `multi-account-per-account-specialist`, `docs-onboarding-rules-writer`,
`lms-content-structure-curator`. backtester-architect → on-demand; task-router → feeds the conductor.
