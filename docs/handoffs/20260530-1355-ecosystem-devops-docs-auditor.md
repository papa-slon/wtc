# Phase 2.4 — Docs-Governance-Truth Audit (Workstream A)

_Epoch 20260530-1355. Read-only audit — zero code edits. Written by `ecosystem-devops-docs-auditor`._
_Governed by [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md). All evidence is file:line._

---

## Scope

Enumerate every documentation drift item that exists after Phase 2.3 landed
(`docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md`), with exact
corrected wording, ordered by file for the devops implementer. Covers:
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` residual drift
- `docs/CONTRACTS/billing-webhooks.md` and `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` TARGET/wrong-table drift
- `docs/TRADINGVIEW_ACCESS_PLAN.md` and `docs/CONTRACTS/tradingview-access.md` grant/profile drift
- `docs/DATA_MODEL.md` migration-count / label drift
- `docs/ARCHITECTURE.md` "not built today" residual
- Items that MUST remain TARGET/NOT RUN/BLOCKED

---

## Files inspected

- `docs/STATUS.md` (full)
- `docs/NEXT_ACTIONS.md` (full)
- `docs/IMPLEMENTED_FILES.md` (full)
- `docs/CONTRACTS/billing-webhooks.md` (full)
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` (full, especially §3 / §10)
- `docs/TRADINGVIEW_ACCESS_PLAN.md` (full)
- `docs/CONTRACTS/tradingview-access.md` (full)
- `docs/DATA_MODEL.md` (§0 conventions / §13 migration summary / all REAL-in-0002 labels)
- `docs/ARCHITECTURE.md` (§4 API namespaces, lines 177 and 235)
- `docs/BILLING_PROVIDER_PLAN.md` (§1 IdempotencyStore interface, §7 sync path diagram)
- `docs/INTEGRATION_MAP.md` (partial — no drift found in phase-independent sections)
- `docs/DEPLOYMENT.md` (full — no drift found; already reflects Phase 2 state)
- `apps/web/src/features/tv/actions.ts` (confirm Phase 2.3 landing state)
- `packages/db/src/repositories.ts` (confirm `createTvGrant`, `revokeTvGrant`, `revokeTv` signatures)
- `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md` (ground truth)

---

## Files changed

None — read-only audit

---

## Findings

Each finding lists: severity, file:line (evidence), the precise stale text that must change, and the corrected replacement.

---

### Finding 1 — HIGH — TRADINGVIEW_ACCESS_PLAN.md: `tradingview_profiles` and `tradingview_access_grants` labelled TARGET when both landed in migration 0002

**Evidence:** `docs/TRADINGVIEW_ACCESS_PLAN.md:57-58`

```
| `tradingview_profiles` | TARGET — not implemented; no Drizzle table, no migration |
| `tradingview_access_grants` | TARGET — not implemented; no Drizzle table, no migration |
```

**Counter-evidence (Phase 2.1 / 2.3):**
- `packages/db/src/repositories.ts:777` — `createTvGrant` exists and writes to `s.tradingviewAccessGrants`
- `packages/db/src/repositories.ts:790` — `revokeTvGrant` exists and reads/writes `s.tradingviewAccessGrants` and `s.tradingviewProfiles`
- `apps/web/src/features/tv/actions.ts:105` — `enhancedGrantAction` calls `createTvGrant`
- `docs/CONTRACTS/tradingview-access.md:28-29` correctly states both tables CURRENT (migration 0002)
- Phase 2.3 aggregate `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md:76` confirms grant table wired

**Recommended correction for `docs/TRADINGVIEW_ACCESS_PLAN.md:57-58`:**

Replace:
```
| `tradingview_profiles` | TARGET — not implemented; no Drizzle table, no migration |
| `tradingview_access_grants` | TARGET — not implemented; no Drizzle table, no migration |
```
With:
```
| `tradingview_profiles` | CURRENT — table exists, migration 0002 Phase 2.1; columns: id, userId, tvUsername, verifiedAt, currentGrantId, createdAt, updatedAt; `currentGrantId` is set by `createTvGrant` and cleared by `revokeTvGrant` |
| `tradingview_access_grants` | CURRENT — table exists, migration 0002 Phase 2.1; columns: id, requestId, userId, tvUsername, grantedAt, expiresAt, grantedBy, grantedByType, revokedAt, revokedBy, revokeReason, createdAt; written by `createTvGrant` in `enhancedGrantAction` |
```

**Workstream:** A

---

### Finding 2 — HIGH — TRADINGVIEW_ACCESS_PLAN.md §Database Tables: `tradingview_profiles` and `tradingview_access_grants` blocks repeat the TARGET claim and wrong schema

**Evidence:** `docs/TRADINGVIEW_ACCESS_PLAN.md:270-300`

The "Database Tables" section shows both tables under "TARGET — not implemented" headings and provides minimal schema without the `currentGrantId` column on `tradingview_profiles` or the `revokeReason` column on `tradingview_access_grants`.

**Recommended correction:**

Replace the two TARGET schema blocks (`tradingview_profiles` at line 270 and `tradingview_access_grants` at line 284) with blocks labeled **CURRENT** and include the actual landed columns per `repositories.ts`:

For `tradingview_profiles` (line 270 heading):
Change `### `tradingview_profiles` (TARGET — not implemented)` to `### `tradingview_profiles` (CURRENT — migration 0002)`

For `tradingview_access_grants` (line 284 heading):
Change `### `tradingview_access_grants` (TARGET — not implemented)` to `### `tradingview_access_grants` (CURRENT — migration 0002)`

Add to the `tradingview_access_grants` schema block the `revokeReason text` column and note it is set by `revokeTvGrant(db, grantId, adminId, reason?)`.

Add to the `tradingview_profiles` schema block the `currentGrantId uuid nullable FK tradingview_access_grants.id` column and note it is set by `createTvGrant` and cleared by `revokeTvGrant`.

**Workstream:** A

---

### Finding 3 — HIGH — TRADINGVIEW_ACCESS_PLAN.md §Phase 1.7 Persistence Reality: `tradingview_profiles` and `tradingview_access_grants` still listed as TARGET, contradicting Phase 2.1/2.3 reality

**Evidence:** `docs/TRADINGVIEW_ACCESS_PLAN.md:57-58` (already cited above), and also the data retention block at `docs/TRADINGVIEW_ACCESS_PLAN.md:367-370`:

```
- `tradingview_access_grants` (TARGET) — append-only; never updated or deleted.
- ...
- `tradingview_profiles` (TARGET) — follows user account lifecycle; deleted on user deletion.
```

**Recommended correction for data retention block (line 367 and 369):**

Replace `(TARGET)` with `(CURRENT — migration 0002)` for both lines.

**Workstream:** A

---

### Finding 4 — HIGH — TRADINGVIEW_ACCESS_PLAN.md: Admin grant "Missing (TARGET)" block still lists `tradingview_access_grants insert` and `state guard` as absent

**Evidence:** `docs/TRADINGVIEW_ACCESS_PLAN.md:208-215` (under "Grant action (CURRENT — manual, hardcoded 90d)"):

```
Missing from current UI (TARGET):
...
- `tradingview_access_grants` insert.
- State guard: only `pending`/`expiring_soon` → `granted`; currently no guard.
```

**Counter-evidence:** `apps/web/src/features/tv/actions.ts:50-113` — `enhancedGrantAction` has:
- `GRANTABLE_STATES = new Set(['pending', 'expiring_soon'])` state guard at line 50/93-96
- Calls `createTvGrant` at line 105 (grant table insert)
- Variable duration via `DURATION_OPTIONS` record (30/90/180/365 days) — hardcoded-90d claim also wrong
- `reason` field validated via `grantSchema` at line 36-42 (required, min 3 max 200)

Also the revoke Missing block at `docs/TRADINGVIEW_ACCESS_PLAN.md:230-234` lists:
```
- Reason field
- State guard
- `tradingview_access_grants` insert.
```
`enhancedRevokeAction` (line 123-149) validates a `reason` field via `revokeSchema`; the validated `_reason` is not yet threaded into `revokeTv` (the as-built follow-up noted in `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md:92`). The state guard is not present on revoke (still an open item per Phase 2.4 blockers).

**Recommended corrections for the grant Missing block (line 208-215):**

Replace with a "Phase 2.3 follow-ups (Phase 2.4)" block:
```
Phase 2.3 LANDED: state guard (pending/expiring_soon only), reason field (required, min 3),
variable duration (30/90/180/365d), `tradingview_access_grants` insert via `createTvGrant`.

Remaining follow-up (Phase 2.4):
- Two-step atomicity: `grantTv` (request status) and `createTvGrant` (grant row) are two separate
  transactions; if `createTvGrant` throws the request is already `granted` with no grant row.
  Target: combine both into a single repo-level transaction.
```

For revoke Missing block (line 230-234), replace with:
```
Phase 2.3 LANDED: reason field validated (required, min 3), revokedAt/revokedBy stamped on request row.

Remaining follow-up (Phase 2.4):
- Reason not threaded into `revokeTv` — validated `reason` is discarded; `revokeTv` writes a fixed
  audit payload. Target: add optional `reason` param to `revokeTv` in `repositories.ts`.
- `revokeTvGrant` not called from `enhancedRevokeAction` — requires grantId lookup.
  `revokeTvGrant` exists in `repositories.ts:790` and stamps the grant row + clears profile.currentGrantId.
- State guard on revoke not enforced (any state may be revoked today).
```

**Workstream:** A

---

### Finding 5 — HIGH — CONTRACTS/tradingview-access.md: `TvRequestDTO` comment says `revokedAt`/`revokedBy` "Not yet surfaced in TvRequestDTO"

**Evidence:** `docs/CONTRACTS/tradingview-access.md:100-102`:

```typescript
  // revokedAt / revokedBy: DB columns exist on tradingview_access_requests (migration 0002, additive
  // nullable). Not yet surfaced in TvRequestDTO — add to DTO when the admin queue UI renders them.
  // Revoke actor also recorded in audit_logs (action 'tradingview.revoke').
```

**Counter-evidence:** `packages/db/src/repositories.ts:256-267` — `TvRequestDTO` now includes `revokedAt?: number` and `revokedBy?: string`, populated in `rowToTvDto` at line 280-281.

**Recommended correction for `docs/CONTRACTS/tradingview-access.md:100-102`:**

Replace the comment block with:
```typescript
  revokedAt?: number;           // epoch-ms — CURRENT (Phase 2.1): populated from revoked_at column when set by revokeTv
  revokedBy?: string;           // admin user uuid — CURRENT (Phase 2.1): populated from revoked_by column
```

And update the full `TvRequestDTO` block in the contract to include both fields in the interface definition (they appear in the repos but not in the contract's typescript block).

**Workstream:** A

---

### Finding 6 — HIGH — CONTRACTS/tradingview-access.md: `revoke` postconditions say "no `revoked_at`/`revoked_by` columns"

**Evidence:** `docs/CONTRACTS/tradingview-access.md:226-228`:

```
**Postconditions (CURRENT):**
1. `tradingview_access_requests` updated: `status = 'revoked'` (no `revoked_at`/`revoked_by` columns — actor in audit row).
```

**Counter-evidence:** `packages/db/src/repositories.ts:309` — `revokeTv` explicitly sets `revokedAt: new Date(now), revokedBy: adminId` on the update.

**Recommended correction for line 227:**

Replace `(no `revoked_at`/`revoked_by` columns — actor in audit row)` with `(revokedAt and revokedBy CURRENT — set in-txn on the request row AND in the audit row; landed migration 0002 Phase 2.1)`.

**Workstream:** A

---

### Finding 7 — HIGH — CONTRACTS/tradingview-access.md: `grant` Missing section still lists `tradingview_access_grants insert`, `state guard`, `variable duration`, and `reason field` as absent

**Evidence:** `docs/CONTRACTS/tradingview-access.md:209-215`:

```
**Missing (TARGET):**
- Entitlement re-check at grant time...
- Variable duration (hardcoded 90d today).
- Reason field.
- `tradingview_access_grants` insert.
- State guard: only `pending`/`expiring_soon` → `granted`; currently no guard.
```

**Counter-evidence:** Same as Finding 4 above — all five items landed in Phase 2.3 `enhancedGrantAction`.

**Recommended correction for the Missing block (lines 209-215):**

Replace with:
```
**Phase 2.3 LANDED:** entitlement re-check (`accessFor` fail-closed), variable duration (30/90/180/365d),
reason field (required min-3 Zod), `createTvGrant` call (grant table + profile.currentGrantId upsert),
state guard (GRANTABLE_STATES: pending/expiring_soon only).

**Remaining follow-up (Phase 2.4):**
- Two-step atomicity: `grantTv` and `createTvGrant` are separate transactions (tracked risk).
```

**Workstream:** A

---

### Finding 8 — HIGH — CONTRACTS/tradingview-access.md data retention block at line 367: `tradingview_access_grants` marked TARGET

**Evidence:** `docs/CONTRACTS/tradingview-access.md:367`:
```
- `tradingview_access_grants` (TARGET) — append-only; never updated or deleted.
```

This should read CURRENT (table landed in migration 0002). Note: `revokeTvGrant` does stamp `revokedAt` on the grant row, so the "never updated" assertion is also stale.

**Recommended correction:**
```
- `tradingview_access_grants` (CURRENT — migration 0002) — append-only for inserts; `revokedAt`/`revokedBy`/`revokeReason` are set on revoke (revoke is a soft-delete via stamp, not a row delete).
```

Same for line 369: `tradingview_profiles (TARGET)` → `tradingview_profiles (CURRENT — migration 0002)`.

**Workstream:** A

---

### Finding 9 — HIGH — PAYMENT_WEBHOOK_STATE_MACHINE.md §10: route file still labelled "TARGET, does not exist yet"

**Evidence:** `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md:321-330`:

```
(`apps/web/src/app/api/billing/webhook/route.ts` — TARGET, does not exist yet).

### Route file (TARGET — not yet created)

...

This file does not exist at the time of this writing (confirmed: no `apps/web/src/app/api/`
directory exists). It is a TARGET to be created by the implementation agent, not this
design/audit agent.
```

**Counter-evidence:** Phase 2.3 landed the route; `docs/IMPLEMENTED_FILES.md:8` confirms: "apps/web/src/app/api/billing/webhook/route.ts — **new** `POST /api/billing/webhook` (raw body, Stripe-Signature verify-first...)" and the aggregate `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md:65` lists it as "**NEW** — first real API mutation route".

**Recommended corrections in `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`:**

1. Line 321: change `— TARGET, does not exist yet` to `— EXISTS (landed Phase 2.3)`.
2. Lines 323-331: replace the "Route file (TARGET — not yet created)" sub-section header and body with:

```
### Route file (CURRENT — landed Phase 2.3)

`apps/web/src/app/api/billing/webhook/route.ts` — EXISTS.
Implementation: raw body via `request.arrayBuffer()` → `Buffer`; `Stripe-Signature` header
detected; delegates to `createStripeProvider().parseWebhook`; idempotency via `audit_logs`
ledger (`action='billing.webhook_received'`, `targetId=eventId`) — select-then-insert;
CSRF-exempt (`middleware.ts` excludes `/api/billing/webhook`); fail-closed; no secret/body
logging; no live Stripe calls in dev. First real API mutation route.
```

3. Line 333: change `### Handler contract (TARGET)` to `### Handler contract (CURRENT)` and update the typescript comment from `(TARGET)` to `(CURRENT)`.

**Workstream:** A

---

### Finding 10 — HIGH — ARCHITECTURE.md line 235: "billing webhook route not built today, no apps/web/src/app/api/ directory"

**Evidence:** `docs/ARCHITECTURE.md:235`:

```
> **TARGET (planned), not current.** The billing webhook route below is part of the planned `/api/` surface; it is not built today (no `apps/web/src/app/api/` directory exists).
```

And line 177:
```
> **TARGET (planned), not current.** There is no `apps/web/src/app/api/` directory today...
```

**Counter-evidence:** The `apps/web/src/app/api/` directory now exists (contains `billing/webhook/route.ts` and `.well-known/axioma-jwks.json/route.ts`). The Phase 2.3 aggregate confirms 44 routes including `/api/billing/webhook`.

**Recommended correction for line 177:**

Replace the blockquote with:
```
> **CURRENT (Phase 2.3):** `apps/web/src/app/api/` exists. First real route handler:
> `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` (Phase 2.1, public JWKS).
> First real API mutation route: `POST /api/billing/webhook` (Phase 2.3, signature-verified,
> idempotent, CSRF-exempt). Other `/api/...` namespaces remain planned (TARGET).
```

**Recommended correction for line 235:**

Replace the blockquote with:
```
> **CURRENT (Phase 2.3):** `POST /api/billing/webhook` EXISTS at
> `apps/web/src/app/api/billing/webhook/route.ts`. See `docs/IMPLEMENTED_FILES.md` Phase 2.3 section.
> Signature-verified, idempotent via `audit_logs` ledger, CSRF-exempt. No live Stripe calls in dev.
```

**Workstream:** A

---

### Finding 11 — MEDIUM — CONTRACTS/billing-webhooks.md §3 header still says "TARGET — Phase 2"

**Evidence:** `docs/CONTRACTS/billing-webhooks.md:49`:
```
### Canonical endpoint (TARGET — Phase 2)
```

The endpoint landed in Phase 2.3; the next line already has the correct statement `EXISTS (landed Phase 2.1)` which itself has a minor error (it landed in Phase 2.3, not 2.1 — see Finding 12 below).

**Recommended correction for line 49:**
Change `### Canonical endpoint (TARGET — Phase 2)` to `### Canonical endpoint (CURRENT — landed Phase 2.3)`.

**Workstream:** A

---

### Finding 12 — MEDIUM — CONTRACTS/billing-webhooks.md §3: implementation note says "landed Phase 2.1"

**Evidence:** `docs/CONTRACTS/billing-webhooks.md:64`:
```
**Implementation:** `apps/web/src/app/api/billing/webhook/route.ts` — EXISTS (landed Phase 2.1).
```

**Correction:** Phase 2.1 landed the Stripe adapter in `packages/billing`; the **route** itself landed in Phase 2.3. The Stripe adapter's `parseWebhook` was always the Phase 2.1 work; the route handler was Phase 2.3.

**Recommended correction:**
```
**Implementation:** `apps/web/src/app/api/billing/webhook/route.ts` — EXISTS (landed Phase 2.3; uses `@wtc/billing` `createStripeProvider().parseWebhook` from Phase 2.1).
```

**Workstream:** A

---

### Finding 13 — MEDIUM — CONTRACTS/billing-webhooks.md §14 Gaps 1, 2, and 5: all three were fixed in Phase 2.3

**Evidence:** `docs/CONTRACTS/billing-webhooks.md:407-455`

Gap 1 ("No `reason` field on grant/revoke"), Gap 2 ("No `validUntil` on admin grants"), and Gap 5 ("`product_access_events` write not confirmed") are all listed as open. Phase 2.3 fixed Gaps 1 and 2 via `features/admin/actions.ts` (assertCsrf + Zod + `grantProduct(+reason?, +validUntil?)` + `revokeProduct(+reason?)`). Gap 5 was confirmed fixed in Phase 2.1 when `grantProduct`/`revokeProduct` were wired to write `product_access_events` rows in-txn.

**Recommended correction — update Gap 1 (line 412-419):**

Replace with:
```
**Gap 1 — FIXED (Phase 2.3):** `reason` field now required on both grant and revoke in
`apps/web/src/features/admin/schemas.ts` + `actions.ts`. `grantProduct(+reason?)` and
`revokeProduct(+reason?)` in `repositories.ts` accept and persist the reason. Gap closed.
```

**Recommended correction — update Gap 2 (line 421-429):**

Replace with:
```
**Gap 2 — FIXED (Phase 2.3):** `validUntil` date input added to the admin grant form.
`grantProduct(+validUntil?)` persists the expiry to `entitlements.expires_at` and
`product_access_events.valid_until`. Confirmed by ADM-2 PGlite test. Gap closed.
```

**Recommended correction — update Gap 5 (line 446-455):**

Replace with:
```
**Gap 5 — CONFIRMED FIXED (Phase 2.1):** `grantProduct`/`revokeProduct` in `repositories.ts`
write `product_access_events` rows in-txn alongside `audit_logs`. Confirmed by PGlite integration
tests in `tests/integration/db-0002.test.ts`. Gap closed.
```

Update the summary table rows for Gaps 1, 2, and 5 accordingly, adding a `Status: FIXED` column.

Gap 3 (`manual_review` flag/approve/reject) and Gap 4 (plan_code display) remain open — keep them as-is. Gap 6 (bulk ops) remains a known acceptable MVP gap.

**Workstream:** A

---

### Finding 14 — MEDIUM — DATA_MODEL.md §0: stale table count "(21 tables)" and "REAL-in-0002" label definition

**Evidence:** `docs/DATA_MODEL.md:17-31`

```
- **CURRENT:** the Drizzle schema is a single file `packages/db/src/schema.ts` (21 tables).
...
- **REAL-in-0002** — designed in handoff `20260530-0126-ecosystem-db-architect.md`; will be
  created by migration `0002_ecosystem_expansion.sql` in the Wave-2 serial implementation step.
```

Migration 0002 landed in Phase 2.1. The schema now has 38 tables. "Will be created" is stale.

**Recommended correction for line 17:**

Change `(21 tables)` to `(38 tables — 21 base tables from migrations 0000/0001 + 17 new tables from migration 0002)`.

**Recommended correction for lines 30-31 (REAL-in-0002 definition):**

Replace with:
```
- **REAL-in-0002** — table/column created by migration `0002_sour_paibok.sql` (landed Phase 2.1).
  Present in `packages/db/src/schema.ts` and PGlite-tested.
```

**Workstream:** A

---

### Finding 15 — MEDIUM — DATA_MODEL.md §13: Migration 0002 summary header says "(Wave-2 target)"

**Evidence:** `docs/DATA_MODEL.md:1326`:
```
Migration `0002_ecosystem_expansion.sql` (Wave-2 target) adds the following to the schema:
```

Migration 0002 is named `0002_sour_paibok.sql` (not `0002_ecosystem_expansion.sql`), and it is no longer a target — it landed in Phase 2.1.

**Recommended correction:**
```
Migration `0002_sour_paibok.sql` (CURRENT — landed Phase 2.1; 38 tables, "No schema changes" on re-run) added the following to the schema:
```

**Workstream:** A

---

### Finding 16 — MEDIUM — DATA_MODEL.md §0 migrations file-path list: TARGET split structure lists wrong file names

**Evidence:** `docs/DATA_MODEL.md:1171-1175` (inside the directory tree under "TARGET"):
```
  migrations/
    0001_initial_identity.sql
    0002_products.sql
    0003_secrets.sql
    0004_bots.sql
    0005_axioma.sql
```

These are TARGET split filenames that do not match the actual migration files on disk: `0000_broken_jack_murdock.sql`, `0001_early_toad_men.sql`, `0002_sour_paibok.sql`. The actual migration names are drizzle-generated and must not be confused with these TARGET identifiers.

**Recommended correction — annotate or remove the fictional TARGET names:**

Add a comment above this block: `# TARGET names shown below are illustrative only; actual generated files are 0000_broken_jack_murdock.sql, 0001_early_toad_men.sql, 0002_sour_paibok.sql.`

**Workstream:** A

---

### Finding 17 — MEDIUM — STATUS.md "Still NOT deployable" section: "billing webhook route" listed as future work (line 300)

**Evidence:** `docs/STATUS.md:300`:
```
- Axioma **ES256/JWKS signer + JWKS route landed (Phase 2.1)** — needs a provisioned P-256 key;
  bot adapter real read-only mappings + legacy plaintext-key fix upstream; the **billing webhook
  route** (the Stripe adapter landed in Phase 2.1); auth rate-limiting middleware; CI activated
  (needs git + GitHub remote).
```

The phrase "the **billing webhook route** (the Stripe adapter landed in Phase 2.1)" implies the webhook route is still a remaining blocker. It landed in Phase 2.3.

**Recommended correction:** Remove `the **billing webhook route** (the Stripe adapter landed in Phase 2.1);` from this bullet. The webhook route is no longer a deployment blocker — Stripe secrets and price map configuration are separate blockers. The remaining billing blocker is:

```
- **Stripe secrets not provisioned** — `STRIPE_WEBHOOK_SECRET`/`STRIPE_SECRET_KEY` + price map
  required before real webhooks are processed; webhook route EXISTS (Phase 2.3) but returns 400
  until configured. Crypto provider: interface only, no processor selected.
```

**Workstream:** A

---

### Finding 18 — MEDIUM — NEXT_ACTIONS.md §2.1 STAGED block: items already landed in Phase 2.3 still listed as next work

**Evidence:** `docs/NEXT_ACTIONS.md:29-37`:

```
## Phase 2.1 STAGED (Rule 7 — designed + repo-backed; build next, in order)
...
2. **Billing UI + webhook route (P-B)** — `/pricing` + `/app/billing` + `POST /api/billing/webhook`
   (verify-first via `createStripeProvider`) + `product_access_events` timeline.
3. **TV grants/profiles UI (P-E)** + **admin panels (P-F admin)** + **terminal DB-wiring (P-D)**
   on the landed repos.
4. Throughout: the per-mutation pipelines in `docs/handoffs/20260530-0925-ecosystem-security-auditor.md`.
```

All four items (billing UI, webhook route, TV grants/profiles, admin panels, terminal DB-wiring) were delivered in Phase 2.2 and Phase 2.3. This entire "Phase 2.1 STAGED" section is obsolete.

**Recommended correction:** Replace the entire `## Phase 2.1 STAGED` block with:

```
## Phase 2.1/2.2/2.3 DONE (landed)

All Phase 2.1 STAGED items have shipped:
- Full LMS teacher/student/admin vertical (Phase 2.2).
- Billing UI (`/pricing`, `/app/billing`) + `POST /api/billing/webhook` (Phase 2.3).
- TV grants/profiles UI (`/app/indicators`, `/admin/tradingview-access`) (Phase 2.3).
- Admin console (`/admin/users`, `/admin/system-health`, `/admin/support`, `/admin/entitlements`)
  (Phase 2.3).
- Terminal DB-wiring (`features/terminal/loader.ts`, `/app/terminal`) (Phase 2.3).
```

**Workstream:** A

---

### Finding 19 — MEDIUM — NEXT_ACTIONS.md §Remaining ordered list: items 1-5 are partially stale post-Phase-2.3

**Evidence:** `docs/NEXT_ACTIONS.md:74-91` (the numbered "## Remaining" list):

Item 1 says "Full LMS — SUPERSEDED" correctly.
Item 2 ("Real Postgres") remains valid.
Item 3 ("Billing") says "choose a provider... wire the signature-verified webhook route → entitlements". The webhook route is now built; the remaining billing work is Stripe secrets provisioning, price map, and the checkout flow — not the route itself.
Item 4 ("Axioma") remains valid.
Item 5 ("Bot adapters") remains valid.

**Recommended correction for item 3 (line ~82):**

Replace:
```
3. **Billing:** choose a provider (`docs/OPEN_QUESTIONS.md` #2); implement the Stripe adapter behind
   `@wtc/billing`'s `BillingProvider`; wire the signature-verified webhook route → entitlements.
```
With:
```
3. **Billing:** `POST /api/billing/webhook` DONE (Phase 2.3). Remaining: provision
   `STRIPE_WEBHOOK_SECRET`/`STRIPE_SECRET_KEY` in production vault; populate `STRIPE_PRICE_MAP`
   with live Stripe price IDs; implement real `createCheckout` server action (mock dev path
   exists). Crypto provider: processor selection pending (`docs/OPEN_QUESTIONS.md` #2).
```

**Workstream:** A

---

### Finding 20 — LOW — IMPLEMENTED_FILES.md §Contracts table row for `billing-webhooks.md` still says "no live webhook route yet"

**Evidence:** `docs/IMPLEMENTED_FILES.md:111`:
```
| `billing-webhooks.md` | `packages/billing/src/{webhook,provider}.ts` (verify + mock provider; no live webhook route yet) |
```

**Recommended correction:**
```
| `billing-webhooks.md` | `packages/billing/src/{webhook,provider}.ts` (verify + mock provider); `apps/web/src/app/api/billing/webhook/route.ts` (CURRENT — Phase 2.3, real route; idempotent via audit_logs ledger; CSRF-exempt) |
```

**Workstream:** A

---

### Finding 21 — LOW — BILLING_PROVIDER_PLAN.md §1: `IdempotencyStore` interface says "PostgreSQL table `webhook_idempotency_keys`" but the as-built uses the `audit_logs` ledger

**Evidence:** `docs/BILLING_PROVIDER_PLAN.md:107-111` — the `handleWebhook` method signature accepts an `idempotencyStore: IdempotencyStore` parameter, and the class contract around it implies a dedicated table. The `BILLING_PROVIDER_PLAN.md` does not itself mention `webhook_idempotency_keys` directly, but:

`docs/PAYMENT_WEBHOOK_STATE_MACHINE.md:100-109` (§3 Idempotency / Implementation) says:
```
Storage backend: PostgreSQL table `webhook_idempotency_keys` (not Redis...
```

This section still references the old table as the canonical idempotency store. `CONTRACTS/billing-webhooks.md §7` correctly documents the as-built (`audit_logs` ledger) vs TARGET (`webhook_idempotency_keys`). The `PAYMENT_WEBHOOK_STATE_MACHINE.md` §3 has NOT been updated to match.

**Evidence:** `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md:100-126`
```
Storage backend: PostgreSQL table `webhook_idempotency_keys` (not Redis...
...
```sql
-- Table: webhook_idempotency_keys
-- Group: Ops (bounded context)
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
event_key     TEXT NOT NULL UNIQUE   -- provider:event_id, e.g. stripe:evt_1OXxxx
...
```

**Recommended correction for `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` §3 (lines ~100-126):**

Replace the "### Implementation" block and the SQL DDL with:

```
### Implementation (AS-BUILT)

The idempotency store is the existing `audit_logs` ledger — no additional table needed.

The route handler calls `applyStripeEvent` (in `packages/db/src/repositories.ts`) which:
1. SELECTs `audit_logs` WHERE `action = 'billing.webhook_received'` AND `target_id = <eventId>`.
2. If a row exists → return `{ acknowledged: true, transitions: [] }` (idempotent no-op).
3. If no row → process event → INSERT `audit_logs` row in the same transaction.

This approach is documented as the confirmed deviation in `docs/CONTRACTS/billing-webhooks.md §7`.

### Future store (TARGET — not yet created)

A dedicated `billing_webhook_events` table (NOT `webhook_idempotency_keys`) is the Phase 2.4
TARGET for a durable unique-key store that avoids the concurrent-duplicate weakness of
select-then-insert. Schema design is owned by the db-architect.

```sql
-- Table: billing_webhook_events (TARGET — Phase 2.4+; no migration exists)
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
event_key     TEXT NOT NULL UNIQUE   -- stripe:<eventId>; unique constraint is the idempotency gate
provider      TEXT NOT NULL CHECK (provider IN ('stripe','crypto'))
processed_at  TIMESTAMPTZ DEFAULT NOW()
expires_at    TIMESTAMPTZ NOT NULL
result_status TEXT NOT NULL CHECK (result_status IN ('processed','no_op','error'))
```
```

Note: The target table name in the Phase 2.4 brief is `billing_webhook_events`, NOT `webhook_idempotency_keys`. Update all references accordingly.

**Workstream:** A

---

### Finding 22 — LOW — STATUS.md "Real vs mock/dev (honest)" section is accurate but omits Phase 2.3 additions to the real-verified list

**Evidence:** `docs/STATUS.md:293` — the "Real + verified" sentence ends at Phase 1.7 TV/LMS and does not summarise the Phase 2.3 verified items (TV grant PGlite tests, terminal release PGlite tests, admin PGlite tests, webhook BW-001/BW-004).

The Phase 2.3 gate table at `docs/STATUS.md:26-37` correctly records all numbers, so this is LOW severity — the numbers are there, the prose summary just needs a single append.

**Recommended correction:** Append to the "Real + verified" sentence at `docs/STATUS.md:293`:

After `PGlite-integration-tested + e2e-smoked.` add:
```
**As of Phase 2.3:** TV `createTvGrant`/`revokeTvGrant` + terminal release exclusivity +
admin `grantProduct(reason,validUntil)` + billing webhook BW-001/BW-004 all PGlite-verified;
`POST /api/billing/webhook` e2e-smoked; 44 routes build-verified; 28/28 e2e.
```

**Workstream:** A

---

## Decisions

1. The `billing_webhook_events` table name (TARGET Phase 2.4) is confirmed from the Phase 2.3 aggregate `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md:84` footnote on the concurrent-duplicate weakness. The devops implementer must use this name, NOT `webhook_idempotency_keys`, when Phase 2.4 docs reference the TARGET durable store.

2. `tradingview_profiles` and `tradingview_access_grants`: both are CURRENT (migration 0002 Phase 2.1). All docs that say TARGET for these two tables are wrong. The Phase 2.3 audit file `docs/CONTRACTS/tradingview-access.md` mock-vs-real table (lines 344-345) already has the correct CURRENT claim — the PLAN doc has not been updated to match.

3. The admin reason/validUntil gaps (billing-webhooks.md §14 Gaps 1 and 2) are confirmed FIXED in Phase 2.3. Gap 3 (manual_review flag/approve/reject) remains open and must stay labelled as such — it is a Phase 2.4 target per the aggregate.

4. The two-step TV grant atomicity issue (Finding 4) and revoke-reason threading (Finding 4) remain OPEN blockers documented in Phase 2.4 scope. Docs must not claim them fixed; they must be documented as tracked enhancements with the specific code path (actions.ts:104 comment) as the evidence.

---

## Risks

1. **Data Model drift creates migration confusion (HIGH):** The 18 REAL-in-0002 labels in `DATA_MODEL.md` continue to say "will be created" (future tense). An implementer reading DATA_MODEL.md for Phase 3 migration planning could believe these tables do not exist and attempt to re-add them. The fix is purely a label update (not a schema change).

2. **PAYMENT_WEBHOOK_STATE_MACHINE.md §3 idempotency section references a table that must NOT be created (MEDIUM):** An implementer reading §3 and seeing the `webhook_idempotency_keys` DDL could add a migration to create it. This must be updated to the as-built (`audit_logs` ledger) approach before Phase 2.4 implementation begins.

3. **TRADINGVIEW_ACCESS_PLAN.md TARGET labels for landed tables (HIGH):** The plan doc is the primary reference for the TV workstream. If a Phase 2.4 implementer reads it without reading the contracts doc, they may try to "implement" tables that already exist, potentially adding duplicating code.

4. **Items that must stay TARGET/NOT RUN/BLOCKED (do not update these):**
   - `webhook_idempotency_keys` table: must remain "TARGET-superseded; do not create" (the TARGET is now `billing_webhook_events` per Phase 2.4 scope).
   - Legacy bot adapter (`:8000`): remains BLOCKED (plaintext-key issue unresolved; no Zod schema files).
   - Bot live control (`startBot`/`stopBot`/`applyConfig`): remains DISABLED (always throws; `BOT_ADAPTER_MODE=mock` default).
   - TradingView automation adapter: remains TARGET/FEATURE-FLAGGED (ToS constraint; no implementation).
   - Axioma ES256 production signer: remains TARGET (P-256 key not provisioned).
   - Real Postgres `db:migrate`/`db:seed` run: remains NOT RUN (no `DATABASE_URL` provided).
   - CI activation: remains staged/inert (no git repo / no GitHub remote).
   - Phase 3 nginx server block: remains NOT RUN (awaiting Phase 2 server deployment approval).

---

## Verification/tests

All evidence in this report is file:line-cited. No code was executed. Verification approach:

| Claim | Evidence file:line |
|---|---|
| `createTvGrant` exists and writes grant table | `packages/db/src/repositories.ts:777` |
| `revokeTvGrant` exists and stamps grant row | `packages/db/src/repositories.ts:790` |
| `enhancedGrantAction` calls `createTvGrant` | `apps/web/src/features/tv/actions.ts:105` |
| `enhancedRevokeAction` validates reason, does NOT thread it into `revokeTv` | `apps/web/src/features/tv/actions.ts:138-146` |
| `revokeTv` stamps `revokedAt`/`revokedBy` on request row | `packages/db/src/repositories.ts:309` |
| `TvRequestDTO` includes `revokedAt`/`revokedBy` | `packages/db/src/repositories.ts:256-267` |
| `rowToTvDto` populates `revokedAt`/`revokedBy` | `packages/db/src/repositories.ts:280-281` |
| Webhook route EXISTS (Phase 2.3) | `docs/IMPLEMENTED_FILES.md:8-10` |
| Webhook route referenced as TARGET in PAYMENT_WEBHOOK_STATE_MACHINE | `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md:321-330` |
| 38 tables confirmed by gate run | `docs/STATUS.md:34` |
| DATA_MODEL.md still says 21 tables | `docs/DATA_MODEL.md:17` |
| Gaps 1 and 2 FIXED in Phase 2.3 | `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md:79` |
| Gaps 1 and 2 still listed as open | `docs/CONTRACTS/billing-webhooks.md:412-429` |

Gates RUN: none (read-only audit wave, zero gates required per SESSION_PROTOCOL §6).

---

## Next actions

Ordered edit-list for the devops implementer (apply in one pass, single writer):

1. **`docs/TRADINGVIEW_ACCESS_PLAN.md`** — update table status block (lines 55-58), two `Database Tables` sub-sections (lines 270-300), admin grant/revoke Missing blocks (lines 208-215, 230-234), and data retention block (lines 367-370). All changes: TARGET → CURRENT for `tradingview_profiles` and `tradingview_access_grants`; document Phase 2.3 landed items; list Phase 2.4 follow-ups for two-step atomicity and reason threading.

2. **`docs/CONTRACTS/tradingview-access.md`** — update `TvRequestDTO` block (lines 100-102, add `revokedAt`/`revokedBy` to the interface), revoke postconditions (line 227, remove "no revoked_at/revoked_by" claim), grant Missing block (lines 209-215, Phase 2.3 landed items), data retention block (lines 367-369, TARGET → CURRENT).

3. **`docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`** — update §10 route file block (lines 321-331, TARGET → CURRENT, add as-built note), and §3 idempotency implementation block (lines 100-126, replace `webhook_idempotency_keys` DDL with as-built `audit_logs` approach + TARGET `billing_webhook_events` note).

4. **`docs/CONTRACTS/billing-webhooks.md`** — update §3 canonical endpoint header (line 49, TARGET → CURRENT), §3 implementation note (line 64, "landed Phase 2.1" → "landed Phase 2.3"), §14 Gaps 1, 2, and 5 (mark all three FIXED with evidence).

5. **`docs/ARCHITECTURE.md`** — update API namespace blockquote (line 177, add `apps/web/src/app/api/` EXISTS note) and billing webhook blockquote (line 235, TARGET → CURRENT).

6. **`docs/DATA_MODEL.md`** — update §0 table count (line 17, 21 → 38), REAL-in-0002 label definition (lines 30-31, future tense → past tense), §13 migration summary header (line 1326, "Wave-2 target" → "CURRENT — landed Phase 2.1" + correct file name `0002_sour_paibok.sql`), and TARGET migrations directory listing (add annotation clarifying actual file names).

7. **`docs/STATUS.md`** — remove "billing webhook route" from the "Still NOT deployable" bullet (line 300); add Stripe secrets provisioning as the remaining billing blocker; append Phase 2.3 items to the "Real + verified" prose (line 293).

8. **`docs/NEXT_ACTIONS.md`** — replace the "Phase 2.1 STAGED" block (lines 29-37) with a "Phase 2.1/2.2/2.3 DONE" block; update item 3 in the Remaining list (line ~82) to reflect webhook route as built.

9. **`docs/IMPLEMENTED_FILES.md`** — update the Contracts table row for `billing-webhooks.md` (line 111) to include the real route.

10. **`docs/BILLING_PROVIDER_PLAN.md`** — no changes needed in the main body. The `IdempotencyStore` interface is an abstraction used by the `BillingProvider` contract; the as-built deviation is correctly documented in `billing-webhooks.md §7`. No action required here.

Items that must NOT be changed (keep as-is):
- All BLOCKED/NOT RUN labels on legacy bot adapter, live bot control, TV automation, Axioma ES256 production, real Postgres run, CI activation, nginx server block (per Decisions §4 above).
- Phase 2.4 follow-up entries for TV grant atomicity and revoke-reason threading — these are tracked open items, not documentation errors.
