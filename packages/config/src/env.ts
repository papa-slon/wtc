/**
 * @wtc/config — typed, validated environment. Server-only. Fails fast on misconfiguration.
 */
import { z } from 'zod';
import { isWeakSecret, isBase64Key } from '@wtc/shared';

/** Env booleans: only "true"/"1" are true. ("false" must NOT coerce to true.) */
const boolFromEnv = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1')
  .default(false);

const optionalNonEmpty = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());
const optionalUrl = z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional());
const optionalUuid = z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional());
const optionalPositiveInt = z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(1).max(30000).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Deployment-environment axis, DISTINCT from NODE_ENV (the build-mode axis). Drives the Axioma
  // handoff staging/prod fence: staging|production REQUIRE an ES256 signing key (no HS256 dev stub).
  // Default 'development' is backward-compatible — existing deploys/tests don't set it; a real deploy
  // MUST set APP_ENV=staging|production. See docs/handoffs/20260530-2230-ecosystem-platform-architect.md.
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),

  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be >= 16 chars'),
  SECRET_VAULT_KEK: z.string().min(16, 'SECRET_VAULT_KEK must be a base64 32-byte key'),
  SECRET_VAULT_KEY_ID: z.string().default('kek-dev'),

  FEATURE_LIVE_BOT_CONTROL: boolFromEnv,
  FEATURE_TV_AUTOMATION: boolFromEnv,
  // Single source of truth for bot adapter behaviour: mock (default) | read-only | audited.
  BOT_ADAPTER_MODE: z.enum(['mock', 'read-only', 'audited']).default('mock'),

  TORTILA_JOURNAL_BASE_URL: z.string().url().default('http://127.0.0.1:8080'),
  TORTILA_JOURNAL_URL: optionalUrl,
  SYSTEM_BOT_INSTANCE_ID: optionalUuid,
  SYSTEM_BOT_OWNER_ID: optionalUuid,
  LEGACY_BOT_BASE_URL: z.string().url().default('http://127.0.0.1:8000'),
  // Bearer token for the (auth-gated) Tortila journal. Optional overall; required in a real adapter
  // mode in production (superRefine below). Never logged or returned — see @wtc/audit redact.
  JOURNAL_READ_TOKEN: optionalNonEmpty,

  AXIOMA_JOURNAL_BASE_URL: z.string().url().default('https://axi-o.ma'),
  AXIOMA_BRIDGE_API_TOKEN: z.string().optional(),
  AXIOMA_ROUTE_SKELETON_ENABLED: boolFromEnv,
  AXIOMA_HANDOFF_SIGNING_SECRET: z.string().min(16).optional(),
  AXIOMA_HANDOFF_AUDIENCE: z.string().default('axi-o.ma'),
  // ES256 (production-grade) handoff signer material — EC P-256 PEM private key + its kid. Optional in
  // development; required when Axioma routes are enabled in staging/production. Otherwise Axioma
  // stays fail-closed. NEVER logged / in responses / in JWKS output.
  AXIOMA_HANDOFF_SIGNING_KEY: z.string().optional(),
  AXIOMA_HANDOFF_KEY_ID: z.string().optional(),

  BILLING_PROVIDER: z.enum(['mock', 'stripe', 'crypto']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MAP: z.string().optional(),

  LMS_FILE_STORAGE_PROVIDER: z.enum(['db-local', 'fs-local', 's3-r2']).default('db-local'),
  LMS_FILE_STORAGE_ROOT: optionalNonEmpty,
  LMS_OBJECT_STORAGE_ENDPOINT: optionalUrl,
  LMS_OBJECT_STORAGE_BUCKET: optionalNonEmpty,
  LMS_OBJECT_STORAGE_REGION: optionalNonEmpty,
  LMS_OBJECT_STORAGE_ACCESS_KEY_ID: optionalNonEmpty,
  LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: optionalNonEmpty,
  LMS_FILE_SCANNER_MODE: z.enum(['local-signature', 'external']).default('local-signature'),
  LMS_FILE_SCANNER_ENDPOINT: optionalUrl,
  LMS_FILE_SCANNER_TOKEN: optionalNonEmpty,
  LMS_FILE_SCANNER_TIMEOUT_MS: optionalPositiveInt,
  LMS_PUBLIC_UPLOADS_ENABLED: boolFromEnv,
}).superRefine((data, ctx) => {
  // SECRET_VAULT_KEK must be a base64-encoded 32-byte (256-bit) AES KEK in EVERY environment — fail
  // fast at config load instead of lazily in the vault on first secret access. Matches @wtc/crypto
  // parseKek (base64 → 32 bytes); a hex KEK or any wrong-length key is rejected here, at boot.
  if (!isBase64Key(data.SECRET_VAULT_KEK, 32)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SECRET_VAULT_KEK'], message: 'SECRET_VAULT_KEK must be a base64-encoded 32-byte key' });
  }
  // The mock billing provider must be impossible in production at the config level (not only the UI).
  if (data.NODE_ENV === 'production' && data.BILLING_PROVIDER === 'mock') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['BILLING_PROVIDER'], message: 'BILLING_PROVIDER=mock is not allowed in production' });
  }
  const productionLike = data.NODE_ENV === 'production' || data.APP_ENV === 'staging' || data.APP_ENV === 'production';
  if (productionLike && data.BILLING_PROVIDER === 'stripe') {
    if (!data.STRIPE_SECRET_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['STRIPE_SECRET_KEY'], message: 'STRIPE_SECRET_KEY is required when BILLING_PROVIDER=stripe in production-like environments' });
    }
    if (!data.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['STRIPE_WEBHOOK_SECRET'], message: 'STRIPE_WEBHOOK_SECRET is required when BILLING_PROVIDER=stripe in production-like environments' });
    }
    if (!data.STRIPE_PRICE_MAP) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['STRIPE_PRICE_MAP'], message: 'STRIPE_PRICE_MAP is required when BILLING_PROVIDER=stripe in production-like environments' });
    }
  }
  // Axioma handoff ES256 fence (PG6): Axioma is optional for a production rollout.
  // If enabled in staging/production, require the bridge token and ES256 pair before boot.
  if ((data.APP_ENV === 'staging' || data.APP_ENV === 'production') && data.AXIOMA_ROUTE_SKELETON_ENABLED) {
    if (!data.AXIOMA_BRIDGE_API_TOKEN?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AXIOMA_BRIDGE_API_TOKEN'], message: 'AXIOMA_BRIDGE_API_TOKEN is required when Axioma routes are enabled in staging or production' });
    }
    if (!data.AXIOMA_HANDOFF_SIGNING_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AXIOMA_HANDOFF_SIGNING_KEY'], message: 'AXIOMA_HANDOFF_SIGNING_KEY (EC P-256 PEM) is required when Axioma routes are enabled in staging or production' });
    }
    if (!data.AXIOMA_HANDOFF_KEY_ID) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AXIOMA_HANDOFF_KEY_ID'], message: 'AXIOMA_HANDOFF_KEY_ID is required when Axioma routes are enabled in staging or production' });
    }
  }
  // A real (non-mock) adapter mode in production REQUIRES the journal read token — the journal is
  // auth-gated. Without it the adapter reports readState 'not_configured' and never reads live data.
  if (data.NODE_ENV === 'production' && data.BOT_ADAPTER_MODE !== 'mock' && !data.JOURNAL_READ_TOKEN) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JOURNAL_READ_TOKEN'], message: 'JOURNAL_READ_TOKEN is required when BOT_ADAPTER_MODE is not mock in production' });
  }
  if (data.LMS_FILE_STORAGE_PROVIDER === 'fs-local' && !data.LMS_FILE_STORAGE_ROOT) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LMS_FILE_STORAGE_ROOT'], message: 'LMS_FILE_STORAGE_ROOT is required when LMS_FILE_STORAGE_PROVIDER=fs-local' });
  }
  if (data.LMS_FILE_STORAGE_PROVIDER === 's3-r2') {
    const requiredObjectStorageKeys = [
      'LMS_OBJECT_STORAGE_ENDPOINT',
      'LMS_OBJECT_STORAGE_BUCKET',
      'LMS_OBJECT_STORAGE_REGION',
      'LMS_OBJECT_STORAGE_ACCESS_KEY_ID',
      'LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY',
    ] as const;
    for (const key of requiredObjectStorageKeys) {
      if (!data[key]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} is required when LMS_FILE_STORAGE_PROVIDER=s3-r2` });
      }
    }
    if (data.LMS_OBJECT_STORAGE_ENDPOINT && new URL(data.LMS_OBJECT_STORAGE_ENDPOINT).protocol !== 'https:') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LMS_OBJECT_STORAGE_ENDPOINT'], message: 'LMS_OBJECT_STORAGE_ENDPOINT must be https for LMS_FILE_STORAGE_PROVIDER=s3-r2' });
    }
  }
  if (data.LMS_FILE_SCANNER_MODE === 'external') {
    if (!data.LMS_FILE_SCANNER_ENDPOINT) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LMS_FILE_SCANNER_ENDPOINT'], message: 'LMS_FILE_SCANNER_ENDPOINT is required when LMS_FILE_SCANNER_MODE=external' });
    }
    if (!data.LMS_FILE_SCANNER_TOKEN) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LMS_FILE_SCANNER_TOKEN'], message: 'LMS_FILE_SCANNER_TOKEN is required when LMS_FILE_SCANNER_MODE=external' });
    }
    if (data.LMS_FILE_SCANNER_ENDPOINT) {
      const scannerEndpoint = new URL(data.LMS_FILE_SCANNER_ENDPOINT);
      if (scannerEndpoint.protocol !== 'https:' || scannerEndpoint.username || scannerEndpoint.password || scannerEndpoint.search || scannerEndpoint.hash) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LMS_FILE_SCANNER_ENDPOINT'], message: 'LMS_FILE_SCANNER_ENDPOINT must be an https URL without credentials, query, or fragment when LMS_FILE_SCANNER_MODE=external' });
      }
    }
  }
  if (productionLike) {
    if (data.LMS_PUBLIC_UPLOADS_ENABLED && (data.LMS_FILE_STORAGE_PROVIDER === 'db-local' || data.LMS_FILE_STORAGE_PROVIDER === 'fs-local')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LMS_FILE_STORAGE_PROVIDER'], message: 'LMS_FILE_STORAGE_PROVIDER must use a production object-store adapter before public production uploads' });
    }
    if (data.LMS_PUBLIC_UPLOADS_ENABLED && data.LMS_FILE_SCANNER_MODE !== 'external') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LMS_FILE_SCANNER_MODE'], message: 'LMS_FILE_SCANNER_MODE=external is required before public production uploads' });
    }
    // Secret-quality: reject placeholder / low-entropy crypto secrets at config load (not just min length).
    if (isWeakSecret(data.SESSION_SECRET)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SESSION_SECRET'], message: 'SESSION_SECRET is a placeholder or low-entropy value; not allowed in production' });
    }
    if (isWeakSecret(data.SECRET_VAULT_KEK)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SECRET_VAULT_KEK'], message: 'SECRET_VAULT_KEK is a placeholder or low-entropy value; not allowed in production' });
    }
    // AXIOMA_HANDOFF_SIGNING_SECRET is an optional dev/test HS256 stub. Real deployments use the
    // APP_ENV-driven ES256 key pair above, but reject a weak HS256 value if one is still provided.
    if (data.AXIOMA_HANDOFF_SIGNING_SECRET && isWeakSecret(data.AXIOMA_HANDOFF_SIGNING_SECRET)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AXIOMA_HANDOFF_SIGNING_SECRET'], message: 'AXIOMA_HANDOFF_SIGNING_SECRET is a placeholder or low-entropy value; not allowed in production' });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Load and validate environment once. Throws a redacted error listing invalid keys. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration. Check these keys: ' + fields.join(', '));
  }
  cached = parsed.data;
  return cached;
}

/** Test helper to reset the memoized env. */
export function __resetEnvCache(): void {
  cached = null;
}
