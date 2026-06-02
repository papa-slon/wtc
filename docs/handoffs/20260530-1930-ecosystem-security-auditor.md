# ecosystem-security-auditor handoff

## Scope

Phase 2.7 / PG2 + PG5 pre-implementation read-only audit. Cross-cutting security for:
(a) JOURNAL_READ_TOKEN secret handling design
(b) sweepTvExpiry → atomicRevokeTv worker-actor / audit_logs FK question
(c) revokeReason surfacing — admin vs user exposure
(d) standing-invariant preservation check for PG2 + PG5 changes

## Files inspected

- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/handoffs/20260530-1815-phase-2-6-middleware-security-spine.md
- docs/ROADMAP_MASTER.md (JOURNAL_READ_TOKEN NEXT/PG2 item)
- docs/RISK_REGISTER_MASTER.md (R1.2, R1.3)
- docs/INTEGRATION_MAP.md (Tortila auth method row)
- docs/CONTRACTS/tortila-adapter.md (auth requirement + token header spec)
- docs/NEXT_ACTIONS.md
- packages/bot-adapters/src/http.ts (getJson ~line 40, disabledControl)
- packages/bot-adapters/src/factory.ts (getBotAdapter)
- packages/bot-adapters/src/control.ts (assertBotControlAllowed)
- packages/bot-adapters/src/index.ts
- packages/bot-adapters/src/mock-legacy.ts
- apps/web/src/lib/server-config.ts (botAdapterMode, botAdapterOptions)
- packages/config/src/env.ts (loadEnv, envSchema, superRefine)
- .env.example (secrets section, placeholder style)
- .secretlintrc.json
- package.json (secret:scan script)
- packages/audit/src/redact.ts (SECRET_HINTS, isSecretValue, redact)
- packages/audit/src/audit.ts (buildEvent, AuditInput, AuditEvent interfaces)
- packages/db/src/schema.ts (auditLogs table ~line 213-236; tradingviewAccessGrants ~line 471-491; tradingviewAccessRequests ~line 157-170)
- packages/db/src/repositories.ts (auditRowValues ~line 217-234; revokeTv ~line 308; sweepTvExpiry ~line 315-327; atomicRevokeTv ~line 1301-1339; atomicGrantTv ~line 1246-1291)
- apps/worker/src/jobs.ts (reconcileEntitlements ~line 23-45)
- apps/worker/src/index.ts (dbTick, sweepTvExpiry call ~line 35)
- apps/web/src/app/admin/tradingview-access/page.tsx (grant-history table ~line 162-194)
- apps/web/src/app/(app)/app/indicators/page.tsx (user-facing TV page — full)
- apps/web/src/features/tv/queries.ts (loadTvAdminData, loadTvUserData)
- apps/web/src/features/tv/actions.ts (enhancedGrantAction, enhancedRevokeAction)

## Files changed

None — read-only audit.

## Findings

### F-01 (HIGH) — getJson sends no Authorization header; JOURNAL_READ_TOKEN not yet wired
Evidence: packages/bot-adapters/src/http.ts:44 — `headers: { accept: 'application/json' }` — no auth header.
The token env var does not exist in env.ts (packages/config/src/env.ts) nor in .env.example, and no token is passed from botAdapterOptions() (apps/web/src/lib/server-config.ts:10-16).

RISK_REGISTER_MASTER.md R1.3 and ROADMAP_MASTER.md explicitly flag this as MEDIUM risk: "do not set BOT_ADAPTER_MODE=read-only in prod until token auth configured journal-side."

The CONTRACTS/tortila-adapter.md line 37 already specifies the exact header: `Authorization: Bearer <token>`.

Recommendation for PG2:
1. Add `JOURNAL_READ_TOKEN` as an optional env var to packages/config/src/env.ts envSchema:
   `JOURNAL_READ_TOKEN: z.string().optional()`
   In the superRefine block, add: if NODE_ENV === 'production' AND BOT_ADAPTER_MODE !== 'mock' AND !data.JOURNAL_READ_TOKEN, issue a custom ZodIssue (CRITICAL config error).
2. Thread the token from loadEnv() through botAdapterOptions() in apps/web/src/lib/server-config.ts, and add a `journalReadToken` field to AdapterOptions in packages/bot-adapters/src/factory.ts.
3. In packages/bot-adapters/src/http.ts getJson(), accept an optional `token` parameter and pass it as `Authorization: Bearer ${token}` ONLY when non-empty — do NOT log it, do NOT include it in error messages, do NOT store it in rawJson snapshots.
4. In apps/worker/src/index.ts, read the token from process.env.JOURNAL_READ_TOKEN directly (same pattern as TORTILA_JOURNAL_URL).
5. In .env.example, add: `JOURNAL_READ_TOKEN=   # bearer token for Tortila journal :8080 — required before BOT_ADAPTER_MODE=read-only in production`
   The placeholder MUST be empty (or a clearly non-secret comment-only line). A placeholder value like `replace-with-...` that passes the secretlint rule is acceptable; an actual token string is NOT acceptable in .env.example.
6. Secret-safety invariants: the token must never appear in audit payloads, bot_metric_snapshots.rawJson, console.log/warn/error output, AdapterNotReadyError messages, or API responses. The isSecretValue() guard in redact.ts:59 covers it: `HTTP_AUTH_VALUE = /^(Bearer|Basic) /` matches `Bearer <token>` and would redact it if it ever reached an audit payload under any key. For the token itself (without the "Bearer " prefix), if it is a 64+-hex string, the LONG_HEX pattern catches it. Operators SHOULD use base64 tokens (shorter), which rely solely on key-name redaction — ensure the header injection path never logs the raw token value.

Target part: PG2.

---

### F-02 (HIGH) — atomicRevokeTv writes actorUserId: adminId (non-nullable string) hardcoded to 'admin' role; sweepTvExpiry in the worker has no admin — the FK question is definitive
Evidence:
- packages/db/src/schema.ts:218 — `actorUserId: uuid('actor_user_id')` — NO `.notNull()`. The column IS nullable in both the Drizzle schema definition and inferred from the absence of `.notNull()`.
- packages/db/src/schema.ts:219 — `actorRole: text('actor_role')` — also nullable (no `.notNull()`).
- packages/db/src/schema.ts:218 — `actorUserId: uuid('actor_user_id')` — this is a bare `uuid()` column with NO `.references(() => users.id)`. There is NO foreign key to users(id). Confirmed by scanning the full auditLogs table definition (lines 213-236): only three indexes are defined (actorIdx, actionIdx, actionTargetIdx); no FK references on actorUserId.
- packages/db/src/repositories.ts:1332-1336 — atomicRevokeTv writes `actorUserId: adminId, actorRole: 'admin'` unconditionally.
- apps/worker/src/index.ts:35 — `const tv = await sweepTvExpiry(db, now)` — sweepTvExpiry (repositories.ts:315-327) does NOT call atomicRevokeTv at all; it only marks status='expired' and inserts a tradingview_access_tasks row. So the immediate FK/null issue exists only for the PG5 migration path, not the current sweep.
- packages/audit/src/audit.ts:128-129 — AuditInput has `actorUserId?: string | null` and `actorRole?: string | null` — null is already the legal type.

Key findings:
1. audit_logs.actorUserId IS nullable (no .notNull() in schema).
2. audit_logs.actorUserId has NO FK to users(id). Passing null will NOT violate any constraint.
3. Passing a fabricated sentinel user-id string (e.g. 'system' or '00000000-...') would be WORSE than null — it creates a non-existent-UUID value in a uuid column, which Postgres will reject as an invalid UUID format if the string is not UUID-shaped, and more critically it would be misleading in audit history. Since there is no FK constraint, Postgres would accept any valid-format UUID, but a sentinel UUID not in users(id) could confuse admin queries joining audit_logs to users. Avoid sentinels.

Recommendation for PG5:
Option A is the correct minimal backward-compatible fix. Change atomicRevokeTv signature from `adminId: string` to an actor descriptor:

```typescript
export async function atomicRevokeTv(
  db: Db,
  requestId: string,
  actor: { id: string | null; role: 'admin' | 'system' },
  reason?: string,
  now = Date.now(),
): Promise<void>
```

The audit row writes:
```
actorUserId: actor.id,      // null for worker sweep
actorRole: actor.role,      // 'system' for worker sweep, 'admin' for enhancedRevokeAction
```

The tradingviewAccessRequests update of `revokedBy: actor.id` is acceptable — that column is `uuid('revoked_by').references(() => users.id)` (schema.ts:169 for requests, schema.ts:483 for grants), so NULL is safe (no FK violation) but any non-null value must be an actual user UUID. For the worker sweep, pass actor.id = null.

The tradingviewAccessGrants.revokedBy column (schema.ts:483) is `uuid('revoked_by').references(() => users.id)` with no onDelete — also nullable. Passing null is safe.

enhancedRevokeAction (actions.ts:149) currently calls `atomicRevokeTv(db, requestId, actor.id, reason, Date.now())`. With the new signature it becomes:
```typescript
await atomicRevokeTv(db, requestId, { id: actor.id, role: 'admin' }, reason, Date.now());
```

The worker sweep call (to be added in PG5) becomes:
```typescript
await atomicRevokeTv(db, requestId, { id: null, role: 'system' }, 'expired_by_worker', now);
```

The currently-existing sweepTvExpiry (repositories.ts:315-327) does NOT call atomicRevokeTv; PG5 adds a new function (e.g. `sweepAndRevokeTv`) that calls atomicRevokeTv per expired grant, OR it upgrades sweepTvExpiry to atomically revoke rather than only marking expired + queuing tasks. Either way, the actor descriptor pattern above applies.

Option B (keep adminId and add optional actorRole param) is inferior because it keeps the misleading parameter name `adminId` for a value that can be null/system. Option A is cleaner and forward-safe.

Target part: PG5.

---

### F-03 (MEDIUM) — sweepTvExpiry does NOT call atomicRevokeTv today; the migration to atomic revoke is a PG5 implementation gap
Evidence: packages/db/src/repositories.ts:315-327 — sweepTvExpiry sets status='expired' and inserts tradingview_access_tasks rows but does NOT call atomicRevokeTv. The worker (index.ts:35) calls sweepTvExpiry directly. The tradingview_access_tasks table records are described as "informational and unconsumed (no automation adapter active by default)" in the admin UI (admin/tradingview-access/page.tsx:26).

This is a known planned gap, not a regression, but it means that expired grants are NOT atomically revoked today — the grant row's revokedAt remains null, and the profile pointer is not cleared. This creates inconsistency between tradingviewAccessRequests.status='expired' and tradingviewAccessGrants.revokedAt=null.

Recommendation for PG5: Create a new repository function `sweepAndRevokeTvExpired` (or refactor sweepTvExpiry) that, for each expired tradingviewAccessRequest, calls atomicRevokeTv(db, request.id, { id: null, role: 'system' }, 'expired_by_worker', now). The task queue insertion can remain for operational observability. Confirm reason='expired_by_worker' is an acceptable audit value — it is a plain string in the after JSON payload (schema.ts revokeReason is `text('revoke_reason')` with no CHECK constraint), so any printable string is valid. The value 'expired_by_worker' is precise and traceable.

The audit row for this path MUST include: action='tv_access.revoke', targetType='tradingview_access_request', targetId=requestId, after={ status: 'revoked', reason: 'expired_by_worker', grantId: grant?.id ?? null }. This is exactly what the current atomicRevokeTv writes (repositories.ts:1332-1336) — only the actorUserId/actorRole fields change.

Target part: PG5.

---

### F-04 (MEDIUM) — revokeReason exposed in grant-history admin table correctly; NOT present on user-facing /app/indicators page — both confirmed correct
Evidence:
- apps/web/src/app/admin/tradingview-access/page.tsx:172-193 — grant history table renders: tvUsername, grantedAt, expiresAt, grantedByType, revokedAt. Column headers at line 174-179. `revokeReason` is NOT rendered in this table — only revokedAt is shown.
- apps/web/src/features/tv/queries.ts:36-45 — loadTvUserData() returns TvGrantRow[] from listTvGrantsForUser(). TvGrantRow is `typeof s.tradingviewAccessGrants.$inferSelect` (repositories.ts:759), which includes revokeReason as a field.
- apps/web/src/app/(app)/app/indicators/page.tsx:131-148 — the user-facing Grant history table renders: tvUsername, grantedAt, expiresAt, revokedAt. Column at line 130-134. `revokeReason` is NOT rendered — confirmed absent from the user-facing table.

CURRENT STATE: revokeReason is present in the TvGrantRow type passed to both admin and user views, but is NOT rendered anywhere in either view today. The admin grant-history table does NOT yet surface revokeReason. The user page does NOT render it, which is correct.

FOR PG5 IMPLEMENTATION: When surfacing revokeReason in the admin-only grant history table, it is acceptable to render it as a standard React table cell — admin users already have full access to user emails (queries.ts:87), grantedBy UUIDs, and detailed access history. Admins seeing their own revoke reason text is expected.

The value MUST NOT be added to the user-facing indicators page (app/indicators/page.tsx). The TvGrantRow type includes revokeReason but the indicators page does not render it — this is correct and must not be changed for PG5.

XSS: React text interpolation in a table cell (e.g. `{g.revokeReason}`) is safe — React escapes string values by default. No dangerouslySetInnerHTML is used anywhere in either TV page. The revokeReason column is a plain TEXT type, validated via Zod in actions.ts:47 (revokeSchema: `z.string().min(3).max(200)`), so it cannot be a URL or script injection even before React escaping. No additional sanitization needed.

If the admin UI renders the reason in a column marked "Reason", add the column ONLY to the admin grant-history table (admin/tradingview-access/page.tsx ~line 174 thead section), NOT to the user page. The admin table currently shows 5 columns; add revokeReason as a 6th: `<th>Revoke reason</th>` / `<td>{g.revokeReason ?? '—'}</td>`.

Target part: PG5.

---

### F-05 (LOW) — .env.example uses appropriate non-secret placeholders; secret:scan should remain clean after adding JOURNAL_READ_TOKEN
Evidence: .env.example:16 `SESSION_SECRET=replace-with-random-48-bytes-base64`; .env.example:20 `SECRET_VAULT_KEK=replace-with-random-32-bytes-base64`. These match the isWeakSecret() production check pattern in env.ts. The Stripe test key placeholder `STRIPE_SECRET_KEY=sk_test_replace_with_your_stripe_test_key` (line 53) is a synthetic placeholder that should not trigger secretlint's pattern for real sk_test_ keys (secretlint-rule-preset-recommend scans for patterns like `sk_live_` and similar high-confidence strings; `sk_test_replace_with` is borderline).

The new JOURNAL_READ_TOKEN entry in .env.example MUST be an empty assignment or a clear non-secret comment-only placeholder. Do NOT use a value like `replace-with-bearer-token-here` if it accidentally matches secretlint's bearer token detection patterns. The safest form is:
```
JOURNAL_READ_TOKEN=   # bearer token for Tortila journal; set when BOT_ADAPTER_MODE=read-only
```
(empty value after =, rest is comment). Validate with `npm run secret:scan` after adding.

Target part: PG2.

---

### F-06 (LOW) — Legacy bot adapter: LegacyBlockedAdapter not yet implemented; risk R1.2 open
Evidence: packages/bot-adapters/src/factory.ts:28 — `return useReal && opts.legacyBaseUrl ? createHttpLegacyAdapter(opts.legacyBaseUrl) : createMockLegacyAdapter()`. The factory CAN return the real HTTP legacy adapter if legacyBaseUrl is provided and mode is read-only/audited. ROADMAP_MASTER.md:46 flags `LegacyBlockedAdapter hard code gate + regression test` as NEXT/PG3. RISK_REGISTER_MASTER.md R1.2 registers this as HIGH risk.

This is a pre-existing gap, not introduced by PG2/PG5, and is correctly assigned to PG3. However: PG2 should NOT introduce any code path that could inadvertently activate the legacy adapter in read-only mode. The current PG2 scope (JOURNAL_READ_TOKEN, health states, getWarnings) touches only the Tortila adapter path. Confirm PG2 implementation does not touch factory.ts or the legacyBaseUrl flow.

Target part: PG2 (observation; PG3 is the fix phase).

---

### F-07 (INFO) — isSecretValue() in redact.ts correctly covers Bearer token values in audit payloads
Evidence: packages/audit/src/redact.ts:55 — `const HTTP_AUTH_VALUE = /^(Bearer|Basic) /`. If a Bearer token ever reaches an audit payload as a string value under any key name, it will be matched by isSecretValue() and redacted to '[REDACTED]' at line 72: `return isSecretValue(value) ? REDACTED : value`. This provides a defense-in-depth layer beyond key-name matching.

The LONG_HEX pattern (redact.ts:56: `/^[0-9a-f]{64,}$/i`) catches 64+-character hex tokens (e.g. SHA-256 digests used as raw session tokens). Base64-encoded tokens of typical length (32-48 bytes = 43-64 base64 chars) do NOT match this pattern unless they happen to be all-hex characters — this is a known limitation noted in the previous PG11 handoff. For PG2, the JOURNAL_READ_TOKEN should be documented as a randomly generated base64 value; operators must not put it in any audit payload directly.

The 'bearer' hint in SECRET_HINTS (redact.ts:32) covers key names containing 'bearer'; the HTTP_AUTH_VALUE value-guard covers the concatenated header value `Bearer <token>`. Together these catch the most likely accidental leakage vectors.

Target part: PG2 (confirmation).

---

### F-08 (INFO) — Standing invariants all preserved; no regression risk from PG2/PG5 as designed
Evidence (confirmed by inspection):
1. BOT_ADAPTER_MODE=mock default: env.ts:26 `.default('mock')`; server-config.ts:7 `return m === 'read-only' || m === 'audited' ? m : 'mock'`; factory.ts:24 `const useReal = opts.mode === 'read-only' || opts.mode === 'audited'`. All fail-closed to mock. JOURNAL_READ_TOKEN addition must NOT change the default mode.
2. Live bot control BLOCKED: control.ts:16-18 — assertBotControlAllowed throws unconditionally when flagEnabled=false or auditApproved=false. disabledControl() in http.ts:52-68 passes both as false. mock-legacy.ts:73-84 same. No PG2/PG5 change touches startBot/stopBot/applyConfig.
3. Legacy adapter BLOCKED (partially): factory.ts can return createHttpLegacyAdapter if legacyBaseUrl AND useReal — this is not yet a hard block. JOURNAL_READ_TOKEN wiring in PG2 must not add a legacyBaseUrl path. PG3 implements LegacyBlockedAdapter.
4. Fail-closed entitlements: enhancedGrantAction (actions.ts:82-87) re-checks `accessFor(targetUserId, 'tradingview_indicators')` at grant time. This is the only access source. No PG5 change may bypass this.
5. No plaintext secrets: audit_logs has no plaintext column; redact.ts filters key names + value patterns; exchange_api_key_secrets stores only sealed JSONB; getJson() (http.ts:44) does not log headers. The JOURNAL_READ_TOKEN wiring must maintain this — never log the token value.

Target part: PG2 + PG5.

## Decisions

1. JOURNAL_READ_TOKEN env var name: confirmed. The contract already specifies it (CONTRACTS/tortila-adapter.md:36-37). Use this exact name.
2. Header format: `Authorization: Bearer <token>`. Already specified in CONTRACTS/tortila-adapter.md:37. Do not use X-Journal-Token — the Bearer standard is already codified.
3. Required vs optional in env.ts: OPTIONAL in mock mode (the token does not exist yet on the journal server), REQUIRED (production-failure) when NODE_ENV=production AND BOT_ADAPTER_MODE!='mock'. Matches pattern of AXIOMA_HANDOFF_SIGNING_SECRET (optional overall, required in production with checks in superRefine).
4. Worker reads JOURNAL_READ_TOKEN from process.env directly (same as TORTILA_JOURNAL_URL) — not from @wtc/config loadEnv, which is web-only.
5. atomicRevokeTv actor: Option A (actor descriptor {id: string|null, role: 'admin'|'system'}). Nullable actorUserId is confirmed safe — audit_logs.actorUserId has no FK constraint and the column is nullable in the Drizzle schema. Sentinel UUIDs must NOT be used.
6. Sweep reason: 'expired_by_worker' is an acceptable audit value — TEXT column, no CHECK constraint, passes the Zod revokeSchema.min(3).max(200) if the sweep were to use the same validator (it does not need to — the worker writes directly).
7. revokeReason in admin grant-history: add as 6th column in admin/tradingview-access/page.tsx grant-history table ONLY. Do NOT add to user-facing indicators page. React text interpolation is sufficient (no dangerouslySetInnerHTML).

## Risks

1. JOURNAL_READ_TOKEN not present on the live Tortila journal side today. PG2 can add the WTC client side (env var, header injection), but BOT_ADAPTER_MODE=read-only in production must remain blocked until the journal server is also configured to require and verify the token. This risk is R1.3 in RISK_REGISTER_MASTER.md. The production config guard in env.ts is the enforcement mechanism.
2. atomicRevokeTv signature change (Option A) breaks all existing callers. Currently there is ONE caller: enhancedRevokeAction (actions.ts:149). This must be updated atomically with the signature change. If tests call atomicRevokeTv directly they must also be updated. This is a small, contained breaking change.
3. sweepTvExpiry does not yet call atomicRevokeTv — when PG5 adds this path, care is needed to avoid double-processing: if a request was already set to 'expired' by sweepTvExpiry and atomicRevokeTv is then called on it, the request update will change it from 'expired' to 'revoked'. This semantic change (expired vs revoked) should be intentional: an expired + worker-revoked grant should land on status='revoked' with reason='expired_by_worker', not remain 'expired'. This is the correct behavior for full audit trail.
4. rawJson in bot_metric_snapshots (schema.ts:313) is a free JSONB field. If a caller accidentally serializes the full adapter options object (including journalReadToken), it would bypass key-name redaction. The rawJson written by snapshotTortilaJournal (jobs.ts:118-125) explicitly enumerates only safe fields (adapterMode, sourceAdapter, healthStatus, processAlive, warningCodes). Implementers must maintain this pattern and never spread the full opts object into rawJson.
5. Legacy adapter remains activatable (no LegacyBlockedAdapter yet). This pre-existing R1.2 risk is not introduced by PG2/PG5 but remains open until PG3.

## Verification/tests

Required tests to add in PG2:
- Unit test: getJson() with a token passes `Authorization: Bearer <token>` header; getJson() without a token sends no Authorization header. Mock fetch and assert request headers.
- Unit test: env.ts production + BOT_ADAPTER_MODE=read-only + no JOURNAL_READ_TOKEN → loadEnv throws listing 'JOURNAL_READ_TOKEN'. Production + mock → no error. Non-production + no token → no error.
- Unit test: botAdapterOptions() returns journalReadToken from process.env.JOURNAL_READ_TOKEN when set, undefined otherwise.

Required tests to add in PG5:
- Unit test: atomicRevokeTv with actor { id: null, role: 'system' } writes actorUserId=null, actorRole='system' in the audit row. Use PGlite.
- Unit test: atomicRevokeTv with actor { id: 'some-uuid', role: 'admin' } writes actorUserId='some-uuid', actorRole='admin'. Regression against the current behavior.
- Unit test: enhancedRevokeAction still compiles and passes the actor descriptor correctly (type check is sufficient if PGlite integration test exists).
- Unit test: sweepAndRevokeTvExpired (new function) calls atomicRevokeTv with reason='expired_by_worker' and actor.role='system' per expired grant.

Gates that MUST remain green (must be re-run after implementation):
- npm run check:core
- npm run secret:scan (confirm JOURNAL_READ_TOKEN placeholder does not trigger secretlint)
- npm run lint
- npm run typecheck && npm run typecheck -w @wtc/web
- npm test

## Next actions

PG2 implementation (by ecosystem-backend-implementer or ecosystem-bot-integration-auditor as implementer):
1. Add JOURNAL_READ_TOKEN to packages/config/src/env.ts as optional field with production guard.
2. Add journalReadToken to AdapterOptions in packages/bot-adapters/src/factory.ts and thread through botAdapterOptions() in apps/web/src/lib/server-config.ts.
3. Update getJson() in http.ts to accept and send the Authorization: Bearer header (never log it).
4. Update apps/worker/src/index.ts to read process.env.JOURNAL_READ_TOKEN and pass it to getBotAdapter options.
5. Add JOURNAL_READ_TOKEN= placeholder to .env.example; validate with npm run secret:scan.
6. Add tests (per Verification/tests above).

PG5 implementation:
1. Change atomicRevokeTv signature to accept { id: string | null; role: 'admin' | 'system' } actor descriptor.
2. Update enhancedRevokeAction to pass { id: actor.id, role: 'admin' }.
3. Create sweepAndRevokeTvExpired (or refactor sweepTvExpiry) to call atomicRevokeTv with { id: null, role: 'system' } and reason='expired_by_worker'.
4. Update apps/worker/src/index.ts dbTick to call sweepAndRevokeTvExpired instead of (or in addition to) sweepTvExpiry.
5. Add revokeReason column to admin grant-history table in admin/tradingview-access/page.tsx ONLY — not the user indicators page.
6. Add tests (per Verification/tests above).
