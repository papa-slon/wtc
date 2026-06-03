/**
 * Phase 2.12 / PG9 — User-cabinet + setup-wizard regression guards (static source analysis).
 *
 * Vitest excludes apps/web/** from execution (server components / JSX are e2e-covered), so — like
 * admin-responsive.test.ts and csrf-coverage.test.ts — these are SOURCE assertions over the cabinet
 * loader/card/page and the setup-wizard files. They fail if a future edit:
 *   • gathers per-product setup/activity signals OUTSIDE the access.allowed branch (data-minimisation
 *     regression — security audit F-01),
 *   • puts business logic back in the cabinet React page (it must consume the loader view-models),
 *   • ships a wizard server action that is NOT CSRF-first, or renders an exchange secret as text,
 *   • regresses the indicators page F-01 fix or the security page F-02 CSRF-first ordering.
 * The pure decision logic is unit-tested directly in packages/cabinet/src/derive.test.ts (real coverage);
 * the behavioural 375px check lives in tests/e2e/cabinet-pg9-mobile.spec.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(process.cwd(), 'apps', 'web', 'src');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const LOADER = 'features/cabinet/loader.ts';
const CARD = 'features/cabinet/CabinetProductCard.tsx';
const PAGE = 'app/(app)/app/page.tsx';
const WIZARD = 'app/(app)/app/bots/[bot]/setup/page.tsx';
const INDICATORS = 'app/(app)/app/indicators/page.tsx';
const SECURITY = 'app/(app)/app/security/page.tsx';

describe('PG9 — pure deriver lives in @wtc/cabinet (real unit coverage)', () => {
  it('deriveProductCard is exported from packages/cabinet (not apps/web)', () => {
    const derive = readFileSync(join(process.cwd(), 'packages', 'cabinet', 'src', 'derive.ts'), 'utf8');
    expect(derive).toMatch(/export function deriveProductCard/);
    // The deriver gates setup/activity/warnings on the access decision (fail-closed).
    expect(derive).toMatch(/input\.allowed \? .*setupItems/s);
    expect(derive).toContain('export const ACCESS_REASON_COPY');
  });
});

describe('PG9 — cabinet loader is fail-closed (gathers signals only when allowed)', () => {
  const src = read(LOADER);
  it('gatherSignals is called only inside the decision.allowed branch (data-minimisation, F-01)', () => {
    expect(src).toMatch(/decision\.allowed\s*\?\s*await gatherSignals/);
    // No unconditional gatherSignals call.
    expect(/[^?]\s*await gatherSignals\(/.test(src.replace(/decision\.allowed\s*\?\s*await gatherSignals/, ''))).toBe(false);
  });
  it('maps each product through the pure @wtc/cabinet deriver', () => {
    expect(src).toContain("from '@wtc/cabinet'");
    expect(src).toContain('deriveProductCard(');
  });
  it('surfaces static B3/B4 blockers regardless of entitlement (honest product status)', () => {
    expect(src).toMatch(/liveAdapterBlocked\)\s*return 'B3'/);
    expect(src).toContain("return 'B4'");
  });
  it('honestly reports demo vs postgres mode (never fabricates persistence)', () => {
    expect(src).toMatch(/backendMode === 'memory'/);
  });
});

describe('PG9 — cabinet page is thin (no business logic in the React page)', () => {
  const src = read(PAGE);
  it('renders CabinetProductCard from the loader output', () => {
    expect(src).toContain("from '@/features/cabinet/loader'");
    expect(src).toContain('CabinetProductCard');
    expect(src).toContain('loadCabinet(');
  });
  it('does NOT compute access inline (logic moved to the loader)', () => {
    expect(src).not.toContain('accessFor(');
    expect(src).not.toContain('explainAccess');
  });
});

describe('PG9 — CabinetProductCard is presentational (no @wtc/ui → @wtc/cabinet cycle)', () => {
  const src = read(CARD);
  it('composes @wtc/ui primitives and consumes the @wtc/cabinet view-model type', () => {
    expect(src).toContain("from '@wtc/ui'");
    expect(src).toMatch(/import type \{ CabinetCardView \} from '@wtc\/cabinet'/);
  });
  it('renders the entitlement pill and a next-action CTA', () => {
    expect(src).toContain('StatusPill');
    expect(src).toContain('nextAction');
    expect(src).toContain('buttonClasses(nextAction.variant)');
  });
});

describe('PG9 — setup wizard server actions are CSRF-first and never render a secret', () => {
  const src = read(WIZARD);
  it('every server action is CSRF-first (assertCsrf before requireUser)', () => {
    const serverActions = (src.match(/'use server'/g) ?? []).length;
    expect(serverActions).toBeGreaterThanOrEqual(2);
    // first awaited statement is assertCsrf, before any requireUser.
    expect(src.indexOf('await assertCsrf(formData)')).toBeLessThan(src.indexOf('await requireUser()'));
    // each action re-checks entitlement (fail-closed) before acting.
    expect((src.match(/if \(!access\.allowed\) return;/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it('exchange key + secret inputs are password type (no plaintext rendered)', () => {
    expect(src).toMatch(/name="apiKey"\s+type="password"/);
    expect(src).toMatch(/name="apiSecret"\s+type="password"/);
    // never echo a submitted secret back as a defaultValue.
    expect(src).not.toMatch(/defaultValue=\{[^}]*apiSecret/);
  });
  it('keeps live control disabled + legacy pub_id note', () => {
    expect(src).toContain('Live control stays disabled');
    expect(src).toContain('liveAdapterBlocked');
    expect(src).toContain('Connected through existing Legacy pub_id');
  });
  it('uses the wizard stepper CSS (mobile-first, no page h-scroll)', () => {
    expect(src).toContain('wtc-wizard-steps');
    expect(src).toContain('wtc-step');
  });
});

describe('PG9 — folded-in security fixes', () => {
  it('F-01: indicators page loads per-user TV data only when access.allowed', () => {
    const src = read(INDICATORS);
    expect(src).toMatch(/access\.allowed \? await loadTvUserData\(user\.id\) : null/);
  });
  it('F-02: security page addKeyAction is CSRF-first', () => {
    const src = read(SECURITY);
    expect(src.indexOf('await assertCsrf(formData)')).toBeLessThan(src.indexOf('await requireUser()'));
  });
});
