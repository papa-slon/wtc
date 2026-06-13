# BUILD_PROGRESS.md — cross-session baton for the autonomous Production-B build

> The autonomous loop reads this **first** to know what's done + what's next, and updates it at the end of
> every phase. This is the hand-off state between **fresh sessions** so no single session dies from the
> context limit. Full plan + STUB-AND-CONTINUE policy: [`PRODUCTION_BUILD_PROGRAM.md`](PRODUCTION_BUILD_PROGRAM.md).

**Build branch:** `feat/production-buildout` (off `97209c4`).  **Status:** not started.

## Group-A phase queue — tick `[x]` only when gates were OBSERVED green + committed
- [ ] **P1-build** — billing correctness + payments STUB (no Stripe)
- [ ] **P3** — public proof-of-performance  *(BLOCK: security/privacy + quant-honesty)*
- [ ] **P4** — user self-service (password-reset, /app/settings, onboarding, BingX-only)
- [ ] **P5** — Axioma premium teaser (STUB; CTAs disabled with premium "coming" copy)
- [ ] **P7** — LMS video + progress + product-course access fix
- [ ] **P8** — UX polish (toast, equity SVG, /trades mobile, dashboard risk banner, nav locks)
- [ ] **P6-build** — admin user mgmt (soft-delete/ban/roles/drawer)  *(build only; live use = operator)*
- [ ] **P9** — admin community/content (Telegram, YT/IG embeds, teacher CRUD, slug routing)
- [ ] **P11-build** — security hardening (CSP nonce, structured logger, soft-delete migration, worker jobs)
- [ ] **P12-content** — product-page depth + nightly pg_dump→S3 script + S3 LMS provider wiring

## Session log (append one line per session)
<!-- e.g. 2026-06-14 18:00 start @P1-build · 18:40 stop @P3, reason=batch-done · resume below -->

## RESUME — one-line command for the next fresh session
<!-- the conductor overwrites this each time it stops; paste it into a new session to continue -->
(not started — use the Launch prompt in AUTONOMOUS_BUILD_LAUNCH.md)

## PUNCH-LIST — operator inputs needed for real prod
*(the loop appends here; nothing here blocks the autonomous build — it's the end-of-run "to go live I need…")*
- [ ] **Stripe** — create products + prices; supply `BILLING_PROVIDER`/`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_MAP`; register webhook at the prod domain; go live. *(payments are stubbed until then)*
- [ ] **Domain** — final production domain + DNS + Let's Encrypt cert + nginx vhost approval.
- [ ] **AWS S3** — bucket + creds for (a) LMS uploads and (b) nightly DB backups; + external malware-scanner endpoint/token.
- [ ] **Email provider** — for password-reset + notifications (MVP uses operator-delivered links).
- [ ] **Axioma** — team confirms `/wtc-handoff` shape + JTI model + where release artifacts live; package rename; then enable CTAs.
- [ ] **Deploy** — review the build branch + deploy to canary/prod (operator-triggered).
- [ ] **(future, at scale)** KEK → KMS/Vault migration.
