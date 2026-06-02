import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGE = join(process.cwd(), 'apps', 'web', 'src', 'app', '(app)', 'app', 'products', 'page.tsx');
const NAV = join(process.cwd(), 'apps', 'web', 'src', 'lib', 'nav.ts');

describe('app products directory', () => {
  const src = readFileSync(PAGE, 'utf8');

  it('is a real cabinet surface, not a placeholder', () => {
    expect(src).toContain('loadCabinet(');
    expect(src).toContain('CabinetProductCard');
    expect(src).toContain('Product directory');
    expect(src).not.toContain('Placeholder');
  });

  it('keeps storage truth and blocker counts visible', () => {
    expect(src).toContain('storage: Postgres');
    expect(src).toContain('storage: in-memory (demo)');
    expect(src).toContain('Hard blockers');
    expect(src).toContain("b.ref !== 'demo'");
  });

  it('does not mark real app product/support routes as soon in navigation', () => {
    const nav = readFileSync(NAV, 'utf8');
    expect(nav).toContain("{ href: '/app/products', label: 'Products' }");
    expect(nav).toContain("{ href: '/app/support', label: 'Support' }");
    expect(nav).not.toContain("{ href: '/app/products', label: 'Products', soon: true }");
    expect(nav).not.toContain("{ href: '/app/support', label: 'Support', soon: true }");
  });
});
