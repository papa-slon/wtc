# acceptance-hardening handoff

## Scope
Bring the WTC skeleton to an honest, verifiable state. No new features. Driven by a single-session
read-only audit pass covering 5 areas (security-hardening, contract-code-parity, routes-ux,
qa-verification, docs-truthfulness) → 25 findings (6 P0). Live server untouched; real bots not
connected; real adapters stay disabled.

> Honesty note (added 2026-05-29, Phase 1.5): per-agent handoff files were **not** retained for the
> 5 areas above. Per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §2–§3, read "5 auditors"
> as **5 review areas in one session**, not 5 archived agent handoffs. Future phases must keep one
> handoff file per agent.

## Findings addressed
- **SEC-01/02 (P0):** vault KEK + Axioma signing secret now fail closed in production via
  `requiredSecret()` (@wtc/shared). Vault is lazy so the guard fires at runtime, not at `next build`.
- **SEC-04 (P0):** admin server actions (`grantAction`/`revokeAction` in entitlements + TV) now call
  `requireUser()` + `assertAdmin(roles)` INSIDE the action (the layout guard does not protect a direct POST).
- **SEC-03/05 (P1):** session-bound CSRF (`@/lib/csrf` + `deriveSessionCsrfToken`) wired into every
  authenticated mutating form/action (security, billing, indicators, admin ×2, teacher). Mock checkout
  fenced by `assertNotProduction()`.
- **AXI-001 (P0):** CONTRACTS/axioma-bridge.md §6 rewritten — WTC never logs in as the user, never
  stores the Axioma password or raw JWT; `axioma_jwt` claim removed. Code already compliant; a test
  asserts the handoff carries only the declared claims.
- **AXI-002/QA-003 (P1):** handoff issuer standardized to `https://app.wtc.example.com`; HS256 signer
  clearly labelled a DEV STUB (prod = ES256); test asserts `alg='HS256'` to keep the divergence visible.
- **ADP-001 (P1):** single flag `BOT_ADAPTER_MODE` (`mock|read-only|audited`) in code+docs+.env.example;
  `ENABLE_REAL_ADAPTERS` removed; test proves real adapters can't connect by default and control throws.
- **WARN-001/002 (P1):** warning codes renamed to the canonical lowercase set (`tp_reconcile_p0`,
  `margin_preflight_p1`, …) in a shared `warnings.ts`; the real HTTP adapter now returns the P0/P1
  warnings too (not dropped on mode switch); test asserts both.
- **RUX-01..04 (P1):** `/products/legacy-bot` slug fixed; 15 guarded skeleton routes added (no fake data);
  mobile bottom-nav added; legacy backtester locked.
- **QA-001 (P0):** ESLint 9 flat config added; `npm run lint` passes.
- **DOC-001..005 / STALE-001:** STATUS no longer claims false "green"; e2e prereq documented; mock
  self-grant + build-skips-lint + secretlint-planned noted; turbo.json / fixtures / "pending" stale refs corrected.

## Tests / verification (observed)
`npm run check:core` 7/7 · `npm run lint` exit 0 · `npm run typecheck` exit 0 ·
`npm test` 37/37 (7 files) · `npm run build -w @wtc/web` 38 routes · e2e 10/10 (desktop+mobile,
incl. `/products/legacy-bot`) after `npx playwright install chromium`.

## Risks / still-not-deployable
HS256 handoff (prod needs ES256); in-memory demo store (needs `@wtc/db`); real adapter mappings +
legacy plaintext-key fix; real billing provider; CI + secretlint. App fails closed without prod secrets.

## Next actions
See docs/NEXT_ACTIONS.md (persistence → billing → Axioma ES256 → adapters → CI → deploy phases).
