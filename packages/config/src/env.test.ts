import { describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { loadEnv, __resetEnvCache } from './env.ts';

// A real base64-encoded 32-byte KEK, generated at runtime so (a) it always satisfies the strict
// base64-32 config check and (b) no secret-shaped literal trips secret:scan.
const VALID_KEK_B64 = randomBytes(32).toString('base64');
const STRIPE_SECRET_KEY = ['sk', '_test_', 'configsecret'].join('');
const STRIPE_WEBHOOK_SECRET = ['whsec', '_configsecret'].join('');

// Production-valid secrets: each is high-entropy (>=6 distinct chars) and >=16 chars long.
const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@h:5432/db',
  SESSION_SECRET: 'S7k9Qw2ZpL4mB8xR1tV6yN3a',
  SECRET_VAULT_KEK: VALID_KEK_B64,
  AXIOMA_HANDOFF_SIGNING_SECRET: 'Zx9V1eXR8MS3kQ7pW2tJ5yB4nC6dH0j',
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_MAP: 'tortila_monthly=price_config_tortila',
} as unknown as NodeJS.ProcessEnv;

describe('env: BILLING_PROVIDER=mock is forbidden in production at config level', () => {
  beforeEach(() => __resetEnvCache());

  it('throws when production + mock (the default provider)', () => {
    expect(() => loadEnv({ ...base })).toThrow();
  });

  it('allows production + stripe (with strong secrets)', () => {
    const env = loadEnv({ ...base, BILLING_PROVIDER: 'stripe' } as unknown as NodeJS.ProcessEnv);
    expect(env.BILLING_PROVIDER).toBe('stripe');
  });

  it('requires Stripe checkout and webhook config when production uses stripe', () => {
    const missing = { ...base } as Record<string, unknown>;
    delete missing.STRIPE_SECRET_KEY;
    delete missing.STRIPE_WEBHOOK_SECRET;
    delete missing.STRIPE_PRICE_MAP;
    expect(() => loadEnv({ ...missing, BILLING_PROVIDER: 'stripe' } as unknown as NodeJS.ProcessEnv)).toThrow(
      /STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MAP/,
    );
  });

  it('allows development + mock', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv);
    expect(env.BILLING_PROVIDER).toBe('mock');
  });
});

describe('env: production secret-quality guards', () => {
  beforeEach(() => __resetEnvCache());

  it('rejects a low-entropy SESSION_SECRET in production', () => {
    expect(() => loadEnv({ ...base, BILLING_PROVIDER: 'stripe', SESSION_SECRET: 's'.repeat(24) } as unknown as NodeJS.ProcessEnv)).toThrow();
  });

  it('rejects a low-entropy SECRET_VAULT_KEK in production', () => {
    expect(() => loadEnv({ ...base, BILLING_PROVIDER: 'stripe', SECRET_VAULT_KEK: 'k'.repeat(24) } as unknown as NodeJS.ProcessEnv)).toThrow();
  });

  it('does not require the HS256 AXIOMA_HANDOFF_SIGNING_SECRET when production ES256 key material is present', () => {
    const noAxioma = { ...base } as Record<string, unknown>;
    delete noAxioma.AXIOMA_HANDOFF_SIGNING_SECRET;
    const env = loadEnv({
      ...noAxioma,
      BILLING_PROVIDER: 'stripe',
      APP_ENV: 'production',
      AXIOMA_ROUTE_SKELETON_ENABLED: 'true',
      AXIOMA_BRIDGE_API_TOKEN: 'bridge-token-fixture',
      AXIOMA_HANDOFF_SIGNING_KEY: 'ec-p256-pem-test-placeholder',
      AXIOMA_HANDOFF_KEY_ID: 'wtc-axioma-sign-2026-01',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.AXIOMA_HANDOFF_SIGNING_SECRET).toBeUndefined();
    expect(env.AXIOMA_HANDOFF_KEY_ID).toBe('wtc-axioma-sign-2026-01');
  });

  it('rejects a weak HS256 AXIOMA_HANDOFF_SIGNING_SECRET in production if one is provided', () => {
    expect(() =>
      loadEnv({ ...base, BILLING_PROVIDER: 'stripe', AXIOMA_HANDOFF_SIGNING_SECRET: 's'.repeat(24) } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it('accepts strong secrets + stripe in production', () => {
    const env = loadEnv({ ...base, BILLING_PROVIDER: 'stripe' } as unknown as NodeJS.ProcessEnv);
    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(16);
    expect(env.SECRET_VAULT_KEK.length).toBeGreaterThanOrEqual(16);
  });

  it('does not apply the secret-quality guards outside production', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'development', SESSION_SECRET: 's'.repeat(24) } as unknown as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('development');
  });
});

describe('env: LMS public upload production fence', () => {
  beforeEach(() => __resetEnvCache());

  it('allows production boot when LMS public uploads remain disabled', () => {
    const env = loadEnv({ ...base, BILLING_PROVIDER: 'stripe', LMS_PUBLIC_UPLOADS_ENABLED: 'false' } as unknown as NodeJS.ProcessEnv);
    expect(env.LMS_PUBLIC_UPLOADS_ENABLED).toBe(false);
    expect(env.LMS_FILE_STORAGE_PROVIDER).toBe('db-local');
  });

  it('requires a filesystem root for the fs-local LMS storage adapter', () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'development', LMS_FILE_STORAGE_PROVIDER: 'fs-local' } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
    const env = loadEnv({ ...base, NODE_ENV: 'development', LMS_FILE_STORAGE_PROVIDER: 'fs-local', LMS_FILE_STORAGE_ROOT: 'C:\\wtc-lms-files' } as unknown as NodeJS.ProcessEnv);
    expect(env.LMS_FILE_STORAGE_PROVIDER).toBe('fs-local');
  });

  it('rejects public production uploads with local-only LMS storage/scanner settings', () => {
    expect(() =>
      loadEnv({
        ...base,
        BILLING_PROVIDER: 'stripe',
        LMS_PUBLIC_UPLOADS_ENABLED: 'true',
        LMS_FILE_STORAGE_PROVIDER: 'fs-local',
        LMS_FILE_SCANNER_MODE: 'local-signature',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it('requires redacted object-store configuration when s3-r2 storage is selected', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        LMS_FILE_STORAGE_PROVIDER: 's3-r2',
        LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_OBJECT_STORAGE_ENDPOINT/);
    try {
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        LMS_FILE_STORAGE_PROVIDER: 's3-r2',
        LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
      } as unknown as NodeJS.ProcessEnv);
    } catch (err) {
      expect(String(err)).not.toContain('object-storage-test-secret-value');
    }
  });

  it('accepts s3-r2 with complete https object-store settings', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      LMS_FILE_STORAGE_PROVIDER: 's3-r2',
      LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test',
      LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
      LMS_OBJECT_STORAGE_REGION: 'auto',
      LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
      LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.LMS_FILE_STORAGE_PROVIDER).toBe('s3-r2');
    expect(env.LMS_OBJECT_STORAGE_BUCKET).toBe('wtc-lms-test');
  });

  it('requires https for s3-r2 endpoints', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        LMS_FILE_STORAGE_PROVIDER: 's3-r2',
        LMS_OBJECT_STORAGE_ENDPOINT: 'http://objects.example.test',
        LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
        LMS_OBJECT_STORAGE_REGION: 'auto',
        LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
        LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_OBJECT_STORAGE_ENDPOINT/);
  });

  it('requires redacted external scanner configuration when scanner mode is external', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        LMS_FILE_SCANNER_MODE: 'external',
        LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_FILE_SCANNER_ENDPOINT/);
    try {
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        LMS_FILE_SCANNER_MODE: 'external',
        LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
      } as unknown as NodeJS.ProcessEnv);
    } catch (err) {
      expect(String(err)).not.toContain('scanner-local-token-value');
    }
  });

  it('requires https for external scanner endpoints', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        LMS_FILE_SCANNER_MODE: 'external',
        LMS_FILE_SCANNER_ENDPOINT: 'http://scanner.example.test/scan',
        LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_FILE_SCANNER_ENDPOINT/);
  });

  it('rejects scanner endpoint credentials or query strings at config load', () => {
    const scannerEndpoint = new URL('https://scanner.example.test/scan?debug=1');
    scannerEndpoint.username = 'fixture-user';
    scannerEndpoint.password = 'fixture-password';

    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        LMS_FILE_SCANNER_MODE: 'external',
        LMS_FILE_SCANNER_ENDPOINT: scannerEndpoint.toString(),
        LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_FILE_SCANNER_ENDPOINT/);
  });

  it('accepts external scanner settings with an https endpoint and token', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      LMS_FILE_SCANNER_MODE: 'external',
      LMS_FILE_SCANNER_ENDPOINT: 'https://scanner.example.test/scan',
      LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
      LMS_FILE_SCANNER_TIMEOUT_MS: '2500',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.LMS_FILE_SCANNER_MODE).toBe('external');
    expect(env.LMS_FILE_SCANNER_ENDPOINT).toBe('https://scanner.example.test/scan');
    expect(env.LMS_FILE_SCANNER_TIMEOUT_MS).toBe(2500);
  });

  it('rejects external scanner timeout values outside the safe range', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        LMS_FILE_SCANNER_MODE: 'external',
        LMS_FILE_SCANNER_ENDPOINT: 'https://scanner.example.test/scan',
        LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
        LMS_FILE_SCANNER_TIMEOUT_MS: '0',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_FILE_SCANNER_TIMEOUT_MS/);
  });

  it('allows production public uploads only with s3-r2 storage and external scanning config', () => {
    const objectStore = {
      LMS_FILE_STORAGE_PROVIDER: 's3-r2',
      LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test',
      LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
      LMS_OBJECT_STORAGE_REGION: 'auto',
      LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
      LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
    };
    expect(() =>
      loadEnv({
        ...base,
        BILLING_PROVIDER: 'stripe',
        ...objectStore,
        LMS_PUBLIC_UPLOADS_ENABLED: 'true',
        LMS_FILE_SCANNER_MODE: 'local-signature',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_FILE_SCANNER_MODE/);
    expect(() =>
      loadEnv({
        ...base,
        BILLING_PROVIDER: 'stripe',
        ...objectStore,
        LMS_PUBLIC_UPLOADS_ENABLED: 'true',
        LMS_FILE_SCANNER_MODE: 'external',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_FILE_SCANNER_ENDPOINT/);
    const env = loadEnv({
      ...base,
      BILLING_PROVIDER: 'stripe',
      ...objectStore,
      LMS_PUBLIC_UPLOADS_ENABLED: 'true',
      LMS_FILE_SCANNER_MODE: 'external',
      LMS_FILE_SCANNER_ENDPOINT: 'https://scanner.example.test/scan',
      LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.LMS_PUBLIC_UPLOADS_ENABLED).toBe(true);
    expect(env.LMS_FILE_STORAGE_PROVIDER).toBe('s3-r2');
    expect(env.LMS_FILE_SCANNER_MODE).toBe('external');
  });

  it('applies public upload fences to APP_ENV staging and production as deployment environments', () => {
    const appEnvBase = {
      ...base,
      NODE_ENV: 'development',
      APP_ENV: 'staging',
      AXIOMA_HANDOFF_SIGNING_KEY: 'ec-p256-pem-test-placeholder',
      AXIOMA_HANDOFF_KEY_ID: 'wtc-axioma-sign-2026-01',
      LMS_PUBLIC_UPLOADS_ENABLED: 'true',
    };
    expect(() =>
      loadEnv({
        ...appEnvBase,
        LMS_FILE_STORAGE_PROVIDER: 'db-local',
        LMS_FILE_SCANNER_MODE: 'local-signature',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LMS_FILE_STORAGE_PROVIDER/);

    const env = loadEnv({
      ...appEnvBase,
      LMS_FILE_STORAGE_PROVIDER: 's3-r2',
      LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.example.test',
      LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
      LMS_OBJECT_STORAGE_REGION: 'auto',
      LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
      LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
      LMS_FILE_SCANNER_MODE: 'external',
      LMS_FILE_SCANNER_ENDPOINT: 'https://scanner.example.test/scan',
      LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.APP_ENV).toBe('staging');
    expect(env.LMS_PUBLIC_UPLOADS_ENABLED).toBe(true);
  });
});

describe('env: SECRET_VAULT_KEK must be a base64 32-byte key (validated at config load, all environments)', () => {
  beforeEach(() => __resetEnvCache());

  it('rejects a KEK that decodes to the wrong length — even in development', () => {
    // 32 base64 chars decode to 24 bytes (the pre-1.6 fixture shape) — not a 32-byte key.
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'development', SECRET_VAULT_KEK: 'aF3kQ9zW7pX2mR8tV5yB1nC4dH6jL0sE' } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it('rejects a KEK whose base64 decodes to the wrong byte length', () => {
    // e.g. `openssl rand -hex 24` (48 chars) → 36 bytes as base64. Must be base64→32 bytes.
    expect(() =>
      loadEnv({ ...base, NODE_ENV: 'development', SECRET_VAULT_KEK: 'a'.repeat(48) } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it('accepts a base64-encoded 32-byte KEK in development', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'development', SECRET_VAULT_KEK: randomBytes(32).toString('base64') } as unknown as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejects a well-formed but low-entropy KEK in production (valid base64-32, repeated byte)', () => {
    // Buffer.alloc(32, 7) passes the base64-32 SHAPE check but is obviously not random — the
    // production weak-secret guard must still reject it (shape check and entropy check compose).
    expect(() =>
      loadEnv({ ...base, BILLING_PROVIDER: 'stripe', SECRET_VAULT_KEK: Buffer.alloc(32, 7).toString('base64') } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });
});

describe('env: APP_ENV staging/production requires Axioma operator bundle only when Axioma routes are enabled', () => {
  beforeEach(() => __resetEnvCache());
  // NODE_ENV=development isolates the new APP_ENV fence from the NODE_ENV=production guards.
  // The key value is a non-PEM placeholder — env.ts checks PRESENCE only (createEs256Signer validates
  // the actual PEM format at use time); a real PEM literal would trip secret:scan.
  const devBase = { ...base, NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv;
  const KEY = 'ec-p256-pem-test-placeholder';

  it('allows APP_ENV=staging without ES256 material when Axioma routes are disabled', () => {
    const env = loadEnv({ ...devBase, APP_ENV: 'staging' } as unknown as NodeJS.ProcessEnv);
    expect(env.APP_ENV).toBe('staging');
    expect(env.AXIOMA_ROUTE_SKELETON_ENABLED).toBe(false);
  });

  it('throws when APP_ENV=staging and Axioma routes are enabled without the operator bundle', () => {
    expect(() => loadEnv({ ...devBase, APP_ENV: 'staging', AXIOMA_ROUTE_SKELETON_ENABLED: 'true' } as unknown as NodeJS.ProcessEnv)).toThrow(
      /AXIOMA_BRIDGE_API_TOKEN, AXIOMA_HANDOFF_SIGNING_KEY, AXIOMA_HANDOFF_KEY_ID/,
    );
  });

  it('throws when APP_ENV=production and Axioma routes have only the key set (token and kid missing)', () => {
    expect(() =>
      loadEnv({ ...devBase, APP_ENV: 'production', AXIOMA_ROUTE_SKELETON_ENABLED: 'true', AXIOMA_HANDOFF_SIGNING_KEY: KEY } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/AXIOMA_BRIDGE_API_TOKEN, AXIOMA_HANDOFF_KEY_ID/);
  });

  it('accepts APP_ENV=staging with enabled routes and the full Axioma operator bundle', () => {
    const env = loadEnv({
      ...devBase,
      APP_ENV: 'staging',
      AXIOMA_ROUTE_SKELETON_ENABLED: 'true',
      AXIOMA_BRIDGE_API_TOKEN: 'bridge-token-fixture',
      AXIOMA_HANDOFF_SIGNING_KEY: KEY,
      AXIOMA_HANDOFF_KEY_ID: 'wtc-axioma-sign-2026-01',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.APP_ENV).toBe('staging');
    expect(env.AXIOMA_ROUTE_SKELETON_ENABLED).toBe(true);
    expect(env.AXIOMA_HANDOFF_KEY_ID).toBe('wtc-axioma-sign-2026-01');
  });

  it('does not require the ES256 key in development (default APP_ENV)', () => {
    const env = loadEnv({ ...devBase } as unknown as NodeJS.ProcessEnv);
    expect(env.APP_ENV).toBe('development');
  });
});

describe('env: worker Tortila snapshot vars are typed and optional', () => {
  beforeEach(() => __resetEnvCache());

  it('accepts the canonical Tortila URL and system bot ids', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      TORTILA_JOURNAL_URL: 'http://127.0.0.1:8080',
      SYSTEM_BOT_INSTANCE_ID: '11111111-1111-4111-8111-111111111111',
      SYSTEM_BOT_OWNER_ID: '22222222-2222-4222-8222-222222222222',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.TORTILA_JOURNAL_URL).toBe('http://127.0.0.1:8080');
    expect(env.SYSTEM_BOT_INSTANCE_ID).toBe('11111111-1111-4111-8111-111111111111');
    expect(env.SYSTEM_BOT_OWNER_ID).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('normalizes blank optional worker secrets/ids to undefined', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      JOURNAL_READ_TOKEN: '',
      SYSTEM_BOT_INSTANCE_ID: '',
      SYSTEM_BOT_OWNER_ID: '',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.JOURNAL_READ_TOKEN).toBeUndefined();
    expect(env.SYSTEM_BOT_INSTANCE_ID).toBeUndefined();
    expect(env.SYSTEM_BOT_OWNER_ID).toBeUndefined();
  });

  it('requires the journal read token for production-like real adapter modes', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        APP_ENV: 'staging',
        BOT_ADAPTER_MODE: 'read-only',
        TORTILA_JOURNAL_URL: 'http://127.0.0.1:8080',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/JOURNAL_READ_TOKEN/);

    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        APP_ENV: 'production',
        BOT_ADAPTER_MODE: 'audited',
        TORTILA_JOURNAL_URL: 'http://127.0.0.1:8080',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/JOURNAL_READ_TOKEN/);
  });

  it('allows production-like mock mode without a journal read token', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      APP_ENV: 'staging',
      BOT_ADAPTER_MODE: 'mock',
      JOURNAL_READ_TOKEN: '',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.BOT_ADAPTER_MODE).toBe('mock');
    expect(env.JOURNAL_READ_TOKEN).toBeUndefined();
  });

  it('requires an explicit Tortila journal URL for production-like real adapter modes', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        APP_ENV: 'staging',
        BOT_ADAPTER_MODE: 'read-only',
        JOURNAL_READ_TOKEN: 'journal-read-token-fixture',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/TORTILA_JOURNAL_URL/);
  });

  it('accepts production-like read-only mode with a journal read token', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      APP_ENV: 'staging',
      BOT_ADAPTER_MODE: 'read-only',
      TORTILA_JOURNAL_URL: 'http://127.0.0.1:8080',
      JOURNAL_READ_TOKEN: 'journal-read-token-fixture',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.BOT_ADAPTER_MODE).toBe('read-only');
    expect(env.JOURNAL_READ_TOKEN).toBe('journal-read-token-fixture');
  });
});

describe('env: Legacy DB-backed live-read vars are typed and gated', () => {
  beforeEach(() => __resetEnvCache());

  it('keeps legacy live-read disabled by default', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'development' } as unknown as NodeJS.ProcessEnv);
    expect(env.LEGACY_LIVE_READS_ENABLED).toBe(false);
    expect(env.LEGACY_DATABASE_URL).toBeUndefined();
  });

  it('requires a legacy DB URL and owner binding when enabled in staging', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'development',
        APP_ENV: 'staging',
        LEGACY_LIVE_READS_ENABLED: 'true',
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/LEGACY_DATABASE_URL, SYSTEM_LEGACY_BOT_OWNER_ID/);
  });

  it('accepts staging legacy live-read with a provider DB URL and legacy owner id', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      APP_ENV: 'staging',
      LEGACY_LIVE_READS_ENABLED: 'true',
      LEGACY_DATABASE_URL: 'postgres://legacy_user@127.0.0.1:5432/legacy_bot',
      SYSTEM_LEGACY_BOT_OWNER_ID: '33333333-3333-4333-8333-333333333333',
      LEGACY_API_ID: 'legacy-pub-id-fixture',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.LEGACY_LIVE_READS_ENABLED).toBe(true);
    expect(env.LEGACY_API_ID).toBe('legacy-pub-id-fixture');
    expect(env.SYSTEM_LEGACY_BOT_OWNER_ID).toBe('33333333-3333-4333-8333-333333333333');
  });
});
