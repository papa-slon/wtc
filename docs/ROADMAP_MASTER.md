# ROADMAP_MASTER — WTC Ecosystem Platform

_Master product roadmap from current state (post Phase 2.4) to production-ready. Created 2026-05-30,
epoch `20260530-1625`, from the read-only planning fan-out (6 agents). Companion docs:
[`EXECUTION_PLAN_MASTER.md`](EXECUTION_PLAN_MASTER.md), [`ACCEPTANCE_MATRIX_MASTER.md`](ACCEPTANCE_MATRIX_MASTER.md),
[`RISK_REGISTER_MASTER.md`](RISK_REGISTER_MASTER.md), [`PRODUCTION_BLOCKERS.md`](PRODUCTION_BLOCKERS.md)._

**Status legend:** `DONE` (built + gate-verified) · `CURRENT` (this phase) · `NEXT` (queued, unblocked) ·
`BLOCKED` (external/credential/decision blocker) · `TARGET` (designed, needs a prerequisite) · `NOT RUN` (gate not executed).

> Honest baseline: as of Phase 2.4 the platform is **NOT production-ready**. The data spine, security primitives,
> billing webhook reception, TV access, LMS, and read-only Tortila adapter are real and gate-green on
> PGlite/build/e2e. Real Postgres, self-serve checkout, the live Axioma CTAs, and the legacy bot are not.

## Source handoffs (read-only fan-out, epoch 20260530-1625)
- [task-router](handoffs/20260530-1625-ecosystem-task-router.md) · [product-architect](handoffs/20260530-1625-ecosystem-product-architect.md) · [platform-architect](handoffs/20260530-1625-ecosystem-platform-architect.md) · [db-architect](handoffs/20260530-1625-ecosystem-db-architect.md) · [security-auditor](handoffs/20260530-1625-ecosystem-security-auditor.md) · [devops-docs-auditor](handoffs/20260530-1625-ecosystem-devops-docs-auditor.md)

---

## 1. Foundation / Real-DB / Truth — **CURRENT** (Phase Group 1 / Phase 2.5)
| Item | Status | Notes |
|---|---|---|
| Doc truth: current schema/proof wording reconciled to 43 tables through `0016_colorful_lyja` | DONE_LOCAL | Phase 3.46; no migration |
| Doc truth: 8→11 Tortila fixtures (STATUS/NEXT_ACTIONS/IMPLEMENTED_FILES) | CURRENT | 11 JSON files on disk (8 core + 3 edge) |
| Doc truth: billing-webhooks §1 `webhook_idempotency_keys`→`billing_webhook_events` | CURRENT | dead table name; HIGH (could trigger spurious migration) |
| Doc truth: DATA_MODEL §13 0003 column lists; §5.3 ip_address INET→TEXT | CURRENT | doc column lists materially wrong vs DDL |
| Real-PG harness: DB-name guard (`^wtc_test(_…)?$`) + unit tests | CURRENT | guard logic testable without DB |
| Real-PG harness: current schema table-set proof + cross-connection auth/account/webhook race tests | DONE_LOCAL | DB-mutating block skipped without creds |
| Real-PG **run** (`npm test -- tests/integration/db-real-postgres.test.ts` against fresh `wtc_test*`) | NOT RUN | needs `REAL_POSTGRES_DATABASE_URL`; PGlite/skipped Vitest is not a substitute |

## 2. Tortila Bot — read-only monitored product
| Item | Status | Notes |
|---|---|---|
| Real read-only journal adapter (Zod + 11 fixtures + getMetrics/Positions/Trades/EquityCurve) | DONE | Phase 2.4; fixtures-only tests; no live HTTP |
| Worker `tortila-journal` health collector (env-guarded) | DONE | Phase 2.4; records `not_configured` honestly |
| Bot sub-tabs (settings/positions/trades/equity/safety) backed by real adapter data | NEXT | PG2; UIs real, data still mock (`BOT_ADAPTER_MODE=mock` default) |
| All 4 health states surfaced (not_configured/unreachable/malformed/stale) | **DONE** | **Phase 2.7/PG2** — `BotHealth.readState` (never-throw 4-state machine), worker `integration_health_checks` mapping, `botHealthPill` |
| `JOURNAL_READ_TOKEN` auth + `.env.example` before read-only in prod | **DONE** | **Phase 2.7/PG2** — bearer in `getJson` (never logged), `env.ts` prod+non-mock guard, `.env.example` placeholder |
| `getWarnings()` surface for known Tortila risk signals (TP/margin/101211/100410/109421) | **DONE** | **Phase 2.7/PG2** — `getWarnings()` on the adapter; `getHealth().warnings` delegates; safety dashboard calls it first-class |
| Live bot control (start/stop/apply) | BLOCKED | never without BOT_CONTROL_SAFETY_MODEL approval + adapter audit |

## 3. Legacy / Second Bot — honest boundary
| Item | Status | Notes |
|---|---|---|
| Honest "live adapter unavailable" UI (replace mock "simulated data" banner) | NEXT | PG3; current banner implies live data possible |
| `LegacyBlockedAdapter` hard code gate + regression test (cannot activate) | NEXT | PG3; tiny isolated change |
| Zod exclusion schema blocking plaintext-key body capture from `/api_management/` | BLOCKED | PG3; getHealth() hits an endpoint returning plaintext keys |
| Real read-only legacy adapter | BLOCKED | upstream plaintext-key fix; 5 security gates NOT STARTED |

## 4. Billing / Stripe / Entitlements
| Item | Status | Notes |
|---|---|---|
| Webhook reception (signature-verified, durable `billing_webhook_events` idempotency, manual_review, admin approve/reject) | DONE | Phase 2.3/2.4; never auto-grants |
| Stripe test-mode checkout creation (behind `STRIPE_SECRET_KEY` + price-map flag) | DONE_LOCAL | PG4; no live charge; real Stripe test checkout/replay acceptance still NOT RUN |
| Billing feature dir (actions/schemas/PlanCard/CheckoutButton/SubscriptionStatus) | NEXT | PG4; only timeline.ts exists |
| Self-serve subscription purchase for all plan codes | NEXT/BLOCKED | PG4; blocked on Q-2; manual admin grant is the launch default |
| Pricing page honest CTA (test checkout OR explicit "contact us") | NEXT | PG4; no fake purchase button |

## 5. TradingView Indicators access
| Item | Status | Notes |
|---|---|---|
| DB-backed username submission + admin queue + atomic grant/revoke + reason persisted | DONE | Phases 1.7/2.3/2.4 |
| `sweepTvExpiry` → `atomicRevokeTv` (currently non-atomic `revokeTv`) | **DONE** | **Phase 2.7/PG5** — delegates to `atomicRevokeTv` (system actor `{id:null,role:'system'}`, reason `expired_by_worker`); grant+profile+audit stamped |
| `listUsersWithEmailByIds` (kill admin queue N+1) | **DONE** | **Phase 2.7/PG5** — single `inArray`, empty-ids short-circuit; consumed in `loadTvAdminData` |
| Surface `revokeReason` in admin TV UI | **DONE** | **Phase 2.7/PG5** — admin-only grant-history column (never on `/app/indicators`) |
| Expiry warning banner (<14 days) on `/app/indicators` | **DONE** | **Phase 2.7/PG5** — UI 14-day horizon over active grants/granted requests |
| TradingView automation | BLOCKED-by-policy | manual-first; no credential-stuffing as default |

## 6. Axioma / Terminal / Journal
| Item | Status | Notes |
|---|---|---|
| ES256/JWKS signer built + tested; `/app/terminal` product page (all sections) | DONE | Phases 2.1/1.7/2.3; CTAs disabled dev-placeholders |
| ES256 signer wired into bridge + staging-fenced (not only prod-fenced) | TARGET | PG6; needs provisioned P-256 key |
| `axioma_handoff_jti_revocations` table + `consumeJti` replay store | TARGET | PG6; specified, never migrated |
| Download proxy / Open-Journal handoff / OTC account-link | BLOCKED | PG6; needs confirmed `journal_server` endpoint shapes + raw-OTC→hash migration |
| Hard boundary: WTC never gates local Axioma order execution | DONE | invariant; callout visible |

## 7. Education / LMS
| Item | Status | Notes |
|---|---|---|
| Full teacher/student/admin vertical on lean 40-table schema (enrol/progress/ownership) | DONE | Phases 2.1/2.2 |
| Rich LMS columns migration (slug/level/tags/content_type/embed/file-meta/global-pinned/progress state) + rich UI | **Phase-3 plan** | **PG7 audit unanimous (5/5): no consumer this phase; dead-code-avoidance; `pinned_links 'global'` non-additive; embed_html needs a sanitizer; file-meta BLOCKED on upload review.** DDL spec in `EDUCATION_LMS_PLAN.md` + the `20260530-2330` db/education handoffs |
| LMS RBAC/ownership/entitlement failure → audit + throw (was silent return) + CSRF-first ordering | **DONE** | **Phase 2.10/PG7** — `features/lms/guard.ts` (`requireTeacher`/`requireAdmin`/`requireCourseOwnership`/`requireEducationAccess`; audit `result:'failure'` then throw `AppError`); `assertCsrf` first in all 10 actions; codes `education.rbac_denied`/`education.entitlement_denied` |
| Material file upload (object storage) | BLOCKED | needs upload security review (gates the file-meta columns) |
| Club `pinned_links` admin UI + community links + teacher-profile web surface | NEXT (Phase-3) | repos ready; no web surface yet; `'global'` owner_type needs Q-6 + a hand-edited CHECK migration |

## 8. Admin / Operator Console
| Item | Status | Notes |
|---|---|---|
| Overview/users/entitlements/review-queue/TV/bots/education/system-health/support | DONE | through Phase 2.4 |
| Mobile-readable cards (no 375px horizontal scroll) | **DONE** | **Phase 2.11/PG8** — `.wtc-table-wrap` CSS card-stack (data-label) on all 10 admin tables; `<MobileNav items={ADMIN_NAV}>` added to the admin layout; 375px Playwright spec + static wrap guard. ADR-018 / DESIGN_SYSTEM §14 |
| `listUsersWithEmailByIds` N+1 fix consumed in TV queue | **DONE** | **Phase 2.7/PG5** — batched in `loadTvAdminData` |
| Honest empty/demo/postgres/blocked state pills everywhere | **DONE** | **Phase 2.11/PG8** — canonical pill taxonomy (§14.3) on all admin pages incl. overview/audit-log; derived PG2 journal read-state pill on `/admin/bots`; PG5 expiring-soon banner on the TV queue; per-page `requireUser`+`assertAdmin` defence-in-depth |

## 9. User Cabinet / Product UX
| Item | Status | Notes |
|---|---|---|
| `/app` overview + per-product routes exist | DONE | through Phase 2.3 |
| Per-product cards: entitlement/setup/activity/next-action/blockers | **DONE** | **Phase 2.12/PG9** — `ProductCabinetCard` (5 honest zones) driven by the pure `@wtc/cabinet` `deriveProductCard` (26 unit tests, 5 fail-closed invariants); server-only `features/cabinet/loader.ts` gathers signals only when `access.allowed`; honest B2/B3/B4/demo blockers + CTAs. ADR-019 |
| Setup wizards (bot exchange-key onboarding), mobile-first | **DONE** | **Phase 2.12/PG9** — `/app/bots/[bot]/setup?step=key\|strategy\|review` (single route, GET-link nav, 2 CSRF-first fail-closed actions); `.wtc-wizard-steps`/`.wtc-step` CSS (DESIGN_SYSTEM §15); 375px e2e |

## 10. Backtester / Distribution
| Item | Status | Notes |
|---|---|---|
| BACKTESTER_DISTRIBUTION_PLAN fully specified (job/artifact/runner) | DONE | design only; the option-a blueprint (tables/routes/runner ZIP) — a future multi-session epic |
| **Operator decision:** real local-runner ZIP OR explicit locked card (no half-state) | **DONE** | **Phase 2.13/PG10 — operator chose (b): honest permanently-locked card.** No tables/routes/runner ZIP; pure `deriveBacktesterView` in `@wtc/backtester` (10 unit tests); thin page; cross-surface `backtesterPill` replaces the false green "Available". ADR-020 |
| Backtester surface: honest locked card (3 states; no fake results, no half-state) | **DONE** | **Phase 2.13/PG10** — legacy boundary / access-required / not-yet-available; `BACKTESTER_RUNNER_DISTRIBUTED=false` single source of truth; static + 375px e2e guards |
| Real local-runner ZIP pipeline (jobs/artifacts/upload tokens/runner) | TARGET | option (a) — deferred multi-session epic; blueprint in BACKTESTER_DISTRIBUTION_PLAN.md + CONTRACTS/backtester-runner.md |

## 11. Security / Rate-limiting / Observability
| Item | Status | Notes |
|---|---|---|
| `apps/web/src/middleware.ts` (IP-keyed auth rate-limit + security headers) | **DONE** | **Phase 2.6/PG11** — rate-limit `/login`+`/register` server actions; §6 headers on document GETs; webhook excluded; B5 cleared |
| Per-mutation pipeline (CSRF→Zod→RBAC→entitlement→audit) | **DONE** | **Phase 2.10/PG7** cleared the LMS silent-return + CSRF-order exceptions (denial → audit `result:'failure'` + throw; `assertCsrf` first). ADR-017 records the convention |
| `redact.ts` value-pattern guard (PHC/Bearer/64-hex) | **DONE** | **Phase 2.6/PG11** — `isSecretValue()`, 18 unit tests |
| Structured logger with secret blocklist (`packages/auth/src/logger.ts`) | NEXT | **PG12** (deferred from PG11 — no call sites yet = dead code) |
| `audit_logs` DB role append-only | NEXT | PG11 |
| Integration-health surface (worker/adapters/billing/TV/terminal) | NEXT | PG11; depends on PG2 states |

## 12. CI / Deployment Readiness
| Item | Status | Notes |
|---|---|---|
| `.github/workflows/ci.yml` exists | DONE-but-INERT | not a git repo; never executed |
| git init + GitHub remote → CI activation | BLOCKED | operator must init git/remote |
| DEPLOYMENT.md env/migrate/seed/rollback/secrets/nginx/systemd | NEXT (partial) | PG12; structurally current, not validated against a real deploy |
| `db:seed` idempotency fix (teacher course insert duplicates on re-seed) | NEXT | PG12; known bug |
| Production-readiness checklist (all 2.4 blockers cleared) | TARGET | PG12; gated on real-PG + secrets + git |

---

## Operator decisions that gate roadmap items (see PRODUCTION_BLOCKERS.md)
1. **Real Postgres** `DATABASE_URL` for a throwaway `wtc_test` DB → unblocks PG1 real-PG run + honest PG12.
2. **Billing provider (Q-2)** → unblocks PG4 self-serve checkout.
3. **Backtester model** (real runner vs locked card) → unblocks PG10.
4. **Club+education bundling (Q-6)** → unblocks club entitlement flow.
5. **Axioma `journal_server` endpoint shapes + P-256 key** (external) → unblocks PG6 CTAs.
6. **Legacy plaintext-key upstream fix** (external) → unblocks PG3 real adapter.
7. **git init + remote** → unblocks PG12 CI.
