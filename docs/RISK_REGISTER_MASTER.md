# RISK_REGISTER_MASTER — WTC Ecosystem Platform

_Consolidated risk register from the planning fan-out (6 agents, epoch `20260530-1625`). Severity:
CRITICAL / HIGH / MEDIUM / LOW. Each row: risk · severity · mitigation · owning phase group. Mitigations
in force this session are marked. Source handoffs cited in [`ROADMAP_MASTER.md`](ROADMAP_MASTER.md)._

## R1 — Live bot / exchange risk
| # | Risk | Sev | Mitigation | PG |
|---|---|---|---|---|
| R1.1 | Accidental live bot control (start/stop/apply) | HIGH | Control methods always throw; `BOT_ADAPTER_MODE=mock` default; no start/stop/apply path until BOT_CONTROL_SAFETY_MODEL approved + adapter audited. **In force.** | 2 |
| R1.2 | Legacy adapter accidentally activated | HIGH | `LegacyBlockedAdapter` compile-time gate; factory returns it unconditionally for `legacy_bot`; regression test asserts it throws. | 3 |
| R1.3 | Tortila journal `:8080` has no auth token; open port | MEDIUM | Add `JOURNAL_READ_TOKEN`; do not set `BOT_ADAPTER_MODE=read-only` in prod until token auth configured journal-side. | 2 |
| R1.4 | "Stop bot" misread as "close positions" | HIGH | Hard rule: WTC never the order-execution path; copy + safety model explicit. **In force.** | 2 |

## R2 — Exchange-key / secret-leakage risk
| # | Risk | Sev | Mitigation | PG |
|---|---|---|---|---|
| R2.1 | Legacy `/api_management/` returns plaintext keys; `getHealth()` could capture them | HIGH | Adapter stays BLOCKED; add Zod exclusion schema rejecting any SECRET_HINTS field; unit test the exclusion. | 3 |
| R2.2 | KEK env-var custody = single point of total compromise at scale | MEDIUM | Q-11 KMS/Vault migration is the Phase-3 hard gate; interim: inject at deploy only, logger blocklist, no printenv endpoints. **Partly in force.** | 11/12 |
| R2.3 | Value-pattern leaks (PHC hashes, Bearer tokens, 64-hex) pass `redact()` (field-name blocklist only) | MEDIUM | Add `isSecretValue()` value-pattern check in `redact.ts`. | 11 |
| R2.4 | No structured logger with redaction; raw `console.log` in dev paths | HIGH | Implement `packages/auth/src/logger.ts` applying SECRET_HINTS. | 11 |
| R2.5 | `secret:scan` preset misses WTC high-entropy values (KEK/SESSION/EC keys) | LOW | Add custom secretlint/gitleaks rules before CI activation. | 12 |
| R2.6 | Secrets in fixtures/screenshots | MEDIUM | `secret:scan` covers text/config/source artifacts; retained screenshots/images require `npm run evidence:visual -- --manifest <visual-review.json> <artifact-roots>`. Current screenshots are inventoried, not OCR/review accepted. **Partly in force.** | all |

## R3 — Billing risk
| # | Risk | Sev | Mitigation | PG |
|---|---|---|---|---|
| R3.1 | Concurrent duplicate webhook double-processed | HIGH→mitigated | `billing_webhook_events` UNIQUE(provider,event_id) + INSERT-on-conflict; **cross-connection real-PG test added (PG1)**; PGlite-tested. | 1/4 |
| R3.2 | Missing/ambiguous webhook data silently grants or drops | HIGH→mitigated | Fail-closed `manual_review` + admin notify; **never auto-grants**. **In force.** | 4 |
| R3.3 | No self-serve checkout; users cannot subscribe | MEDIUM | If provider unselected by launch: pricing shows explicit "contact us / open ticket", not a dead button. | 4 |
| R3.4 | Live charge before audit | HIGH | No `createCheckout` live-charge path exists; checkout is TARGET behind a test-mode flag only. **In force.** | 4 |
| R3.5 | New `/api/billing/checkout` route bypasses CSRF/RBAC pipeline | MEDIUM | Route built only after PG11 middleware; must pass CSRF+Zod+RBAC+entitlement+audit; security review before DONE. | 4/11 |

## R4 — Axioma / account-link risk
| # | Risk | Sev | Mitigation | PG |
|---|---|---|---|---|
| R4.1 | Axioma CTAs (Download/Open-Journal/OTC) are silently-disabled placeholders → no value for entitled users | HIGH | Replace silent-disabled with honest "setup in progress — contact support" banner; gate real CTAs on confirmed endpoint shapes. | 6 |
| R4.2 | HS256 dev-stub only prod-fenced (not staging) → staging issues tokens a real verifier rejects | HIGH | Add staging guard; wire ES256 signer before any redirect flow. | 6 |
| R4.3 | `axioma_handoff_jti_revocations` table absent → cross-process replay undetected in 5-min TTL | HIGH | Add table in next migration; `consumeJti` atomic UPDATE; wire into ES256 issuance. | 6 |
| R4.4 | OTC raw-OTC→hash is a cross-team Axioma-side migration WTC cannot do | HIGH | Proceed with non-blocked surface only (license/releases/handoff); OTC + download stay disabled with documented blocker. | 6 |
| R4.5 | WTC becomes the local order-execution path | CRITICAL-if-violated | Hard invariant: bridge only, never runtime copy, never execution. **In force.** | 6 |

## R5 — TradingView automation / access risk
| # | Risk | Sev | Mitigation | PG |
|---|---|---|---|---|
| R5.1 | Credential-stuffing / brittle browser automation shipped as default | HIGH | Manual-first admin queue is the default; no automation without an explicitly designed+approved compliant mechanism. **In force.** | 5 |
| R5.2 | `sweepTvExpiry` uses non-atomic `revokeTv` → profile-pointer divergence under concurrent worker+admin revoke | MEDIUM | Switch to `atomicRevokeTv` (reason `expired_by_worker`). | 5 |
| R5.3 | Admin TV queue N+1 on user-email enrichment | LOW | Add `listUsersWithEmailByIds` batch lookup. | 5 |

## R6 — Real-Postgres risk
| # | Risk | Sev | Mitigation | PG |
|---|---|---|---|---|
| R6.1 | Real-PG harness run against a non-throwaway DB | HIGH | **DB-name guard** `^wtc_test(_[a-z0-9]+)?$`, first line in the harness; throws on any other name. **Added PG1.** | 1 |
| R6.2 | Current migration set unproven on active real Postgres in this session | HIGH | Harness now compares `information_schema` base tables to the current Drizzle schema table set (skipped without creds); run against fresh `wtc_test*`. **Harness fixed Phase 3.46; active run still NOT RUN.** | 1 |
| R6.3 | Real-PG auth/account/webhook races unproven on active real PG in this session | HIGH | Two-pool cross-connection tests cover grant, `insertWebhookEventOnce`, failed-login lockout, and duplicate admin unlock when `REAL_POSTGRES_DATABASE_URL` is supplied. **Added locally; active run still NOT RUN.** | 1 |
| R6.4 | `db:seed` not idempotent (teacher course insert duplicates on re-seed) | MEDIUM | Add `onConflictDoNothing`; document in DEPLOYMENT. | 12 |
| R6.5 | Claiming PG12 deploy readiness while real-PG NOT RUN = false gate-green | MEDIUM | Deploy/migrate/seed/rollback claims stay TARGET until real-PG runs. **In force.** | 1/12 |

## R7 — CI / deployment risk
| # | Risk | Sev | Mitigation | PG |
|---|---|---|---|---|
| R7.1 | CI inert (not a git repo) — no automated gate proof | MEDIUM | `npm run ci:local` is the equivalent; activate CI on git init + remote. **In force.** | 12 |
| R7.2 | No commit/branch/PR claims possible | — | Never claim git operations; this is recorded in every handoff. **In force.** | all |
| R7.3 | Deploy docs unvalidated against a real server | MEDIUM | Templates stay proposal/approval-gated; no server touch without explicit operator approval. **In force.** | 12 |

## R8 — Architecture / process risk
| # | Risk | Sev | Mitigation | PG |
|---|---|---|---|---|
| R8.1 | `apps/web/src/middleware.ts` greenfield; billing webhook has no framework-level CSRF exclusion | HIGH | PG11 creates it first on the serial spine; verify billing-webhook test still passes. | 11 |
| R8.2 | Two parallel groups edit a spine file in a non-git repo → silent clobber | HIGH | Single-writer spine; DB wave first; operator-only truth-doc writes. **In force.** | all |
| R8.3 | LMS mutations silently return on RBAC failure → no audit trail of unauthorized attempts | MEDIUM | Replace silent return with thrown `AccessDeniedError` + audit write; CSRF-first ordering. | 7/11 |
| R8.4 | Uncited current-epoch handoff fails `governance:check` | LOW | Cite every per-agent handoff by path in the aggregate. **In force.** | all |
| R8.5 | Coverage statements low (~25%) as new routes inflate denominator | MEDIUM | Branch coverage (~70%) is the reliable gate; add integration tests per group; e2e covers UI. | all |
| R8.6 | Backtester half-state (form stub + disabled button) sets false expectation | MEDIUM | Operator picks real-runner OR locked card; no half-state; no fabricated results. | 10 |
