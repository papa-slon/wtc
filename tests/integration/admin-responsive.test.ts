/**
 * Phase 2.11 / PG8 — Admin console mobile-readability regression guard (static source analysis).
 *
 * Vitest excludes apps/web/** from execution (server components / JSX are e2e-covered), so — like
 * csrf-coverage.test.ts and lms-rbac-pipeline.test.ts — these are SOURCE assertions over the admin
 * page/layout files. They fail if a future edit reintroduces an unwrapped table (375px horizontal
 * scroll), drops the admin MobileNav, regresses the education page to a nested <main> / non-canonical
 * RBAC, or removes a page's honest storage/state pill. The behavioural check lives in the 375px
 * Playwright spec (tests/e2e/admin-mobile-pg8.spec.ts); this is the cheap fast-feedback guard.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_DIR = join(process.cwd(), 'apps', 'web', 'src', 'app', 'admin');
const read = (rel: string) => readFileSync(join(ADMIN_DIR, rel), 'utf8');

/** Every admin page in the PG8 acceptance set (8 named) + the two shared-surface pages (overview, audit-log). */
const PAGES = [
  'page.tsx',
  'users/page.tsx',
  'entitlements/page.tsx',
  'entitlements/review/page.tsx',
  'tradingview-access/page.tsx',
  'bots/page.tsx',
  'terminal/page.tsx',
  'products/page.tsx',
  'education/page.tsx',
  'system-health/page.tsx',
  'support/page.tsx',
  'audit-log/page.tsx',
];

const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;
const TABLE_OPEN = /className="wtc-table"/g;   // a table (the closing quote excludes "wtc-table-wrap")
const TABLE_WRAP = /className="wtc-table-wrap"/g;

describe('PG8 — admin MobileNav (no stranded mobile users)', () => {
  const layout = read('layout.tsx');
  it('admin layout renders <MobileNav> with ADMIN_NAV', () => {
    expect(layout).toMatch(/<MobileNav\s+items={ADMIN_NAV}\s*\/>/);
    expect(layout).toContain("from '@/components/MobileNav'");
  });
});

describe('admin products page is a real overview, not a placeholder', () => {
  const products = read('products/page.tsx');
  const queries = readFileSync(join(process.cwd(), 'apps', 'web', 'src', 'features', 'admin', 'queries.ts'), 'utf8');

  it('renders the products registry table with DB catalog and entitlement status columns', () => {
    expect(products).toContain('loadAdminProducts');
    expect(products).toContain('Product registry overview');
    expect(products).toContain('DB catalog');
    expect(products).toContain('Pending/review');
    expect(products).not.toContain('Placeholder');
  });

  it('loader combines registry, product availability, DB catalog rows, plans, and entitlements', () => {
    expect(queries).toContain('loadAdminProducts');
    expect(queries).toContain('PRODUCT_CODES.map');
    expect(queries).toContain('productAvailability');
    expect(queries).toContain('schema.products');
    expect(queries).toContain('schema.plans');
    expect(queries).toContain('schema.entitlements');
  });
});

describe('PG8 — every admin .wtc-table is wrapped in .wtc-table-wrap (no 375px horizontal scroll)', () => {
  for (const rel of PAGES) {
    it(`${rel}: wtc-table-wrap count >= wtc-table count`, () => {
      const src = read(rel);
      const tables = count(src, TABLE_OPEN);
      const wraps = count(src, TABLE_WRAP);
      expect(wraps, `${rel} has ${tables} table(s) but ${wraps} wrapper(s)`).toBeGreaterThanOrEqual(tables);
    });

    it(`${rel}: any table carries data-label cells (card-stack labels)`, () => {
      const src = read(rel);
      if (count(src, TABLE_OPEN) === 0) return; // no table on this page — nothing to label
      expect(src, `${rel} has a table but no data-label attributes`).toContain('data-label=');
    });
  }
});

describe('PG8 — honest state: every admin page surfaces a StatusPill', () => {
  for (const rel of PAGES) {
    it(`${rel} renders <StatusPill>`, () => {
      expect(read(rel)).toContain('StatusPill');
    });
  }
});

describe('PG8 — education page fixes (canonical RBAC + no nested <main>)', () => {
  const edu = read('education/page.tsx');
  it('uses requireUser + assertAdmin (not getCurrentUser + manual redirect)', () => {
    expect(edu).toContain('requireUser');
    expect(edu).toContain('assertAdmin');
    expect(edu).not.toContain('getCurrentUser');
  });
  it('does not render a nested <main> (admin layout already provides one)', () => {
    expect(edu).not.toMatch(/<main\b/);
  });
});

describe('PG8 — overview page per-page RBAC (defence-in-depth) + canonical storage pill', () => {
  const overview = read('page.tsx');
  it('asserts admin on the overview page itself', () => {
    expect(overview).toContain('assertAdmin');
  });
  it('renders the canonical storage pill, not a bare backendMode label', () => {
    expect(overview).toContain('storage: Postgres');
    expect(overview).toContain('storage: in-memory (demo)');
  });
});
