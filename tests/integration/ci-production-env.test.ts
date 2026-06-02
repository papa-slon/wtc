import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = () => readFileSync('.github/workflows/ci.yml', 'utf8');

describe('CI production-like env guard', () => {
  it('generates the ES256 Axioma key pair required by staging/production config', () => {
    const ci = workflow();
    expect(ci).toContain('AXIOMA_HANDOFF_SIGNING_KEY<<EOF');
    expect(ci).toContain('openssl ecparam -name prime256v1 -genkey -noout');
    expect(ci).toContain('AXIOMA_HANDOFF_KEY_ID=ci-axioma-es256');
    expect(ci).toContain('STRIPE_SECRET_KEY=sk_${stripe_mode}_ci_');
    expect(ci).toContain('STRIPE_WEBHOOK_SECRET=whsec_ci_');
    expect(ci).toContain('STRIPE_PRICE_MAP=tortila_monthly=price_ci_tortila');
    expect(ci).toContain('Validate production-like env fences');
    expect(ci).toContain('APP_ENV: staging');
    expect(ci).toContain('NODE_ENV: production');
    expect(ci).toContain('BILLING_PROVIDER: stripe');
  });

  it('does not rely on the old HS256 dev-stub secret for CI deployment fences', () => {
    expect(workflow()).not.toContain('AXIOMA_HANDOFF_SIGNING_SECRET=$(openssl');
  });
});
