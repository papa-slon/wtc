import type { BotConfigView, BotProductCode } from '@wtc/bot-adapters';

const FORBIDDEN_RUNTIME_CONFIG_KEYS = new Set([
  'apikey',
  'apisecret',
  'secret',
  'password',
  'passwordhash',
  'token',
  'authorization',
  'cookie',
  'sealed',
  'keyid',
  'wrappeddek',
  'vaultrecord',
  'credentials',
  'providerpubid',
  'provideraccountid',
  'pubid',
  'provideraccounts',
  'liveconfig',
  'rawjson',
  'legacydatabaseurl',
  'tortilajournalbaseurl',
  'tortilajournalurl',
  'exchangeurl',
  'baseurl',
  'headers',
  'applyconfig',
  'startbot',
  'stopbot',
  'start',
  'stop',
  'restart',
  'retest',
  'testexchange',
]);

function normalizedRuntimeConfigKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function maskProviderIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

function lastNamedPathSegment(path: readonly string[]): string | null {
  for (let i = path.length - 1; i >= 0; i -= 1) {
    if (!/^\d+$/.test(path[i]!)) return path[i]!;
  }
  return null;
}

function isLegacyProviderIdentityContainer(productCode: BotProductCode, path: readonly string[], key: string): boolean {
  return productCode === 'legacy_bot' && path.length === 0 && normalizedRuntimeConfigKey(key) === 'provideraccounts';
}

function isLegacyProviderIdentityValue(productCode: BotProductCode, path: readonly string[], key: string): boolean {
  if (productCode !== 'legacy_bot') return false;
  const normalizedKey = normalizedRuntimeConfigKey(key);
  const parent = lastNamedPathSegment(path);
  return (
    (normalizedKey === 'pubid' && parent === 'provideraccounts')
    || (normalizedKey === 'providerpubid' && (parent === 'symbolconfigs' || parent === 'activeslots' || parent === 'activeordersummary'))
  );
}

function sanitizeRuntimeConfigValue(productCode: BotProductCode, value: unknown, path: readonly string[] = []): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item, index) => sanitizeRuntimeConfigValue(productCode, item, [...path, String(index)]));
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isLegacyProviderIdentityValue(productCode, path, key)) {
      const masked = maskProviderIdentity(nested);
      if (masked) out[key] = masked;
      continue;
    }
    if (isLegacyProviderIdentityContainer(productCode, path, key)) {
      out[key] = sanitizeRuntimeConfigValue(productCode, nested, [...path, normalizedRuntimeConfigKey(key)]);
      continue;
    }
    if (FORBIDDEN_RUNTIME_CONFIG_KEYS.has(normalizedRuntimeConfigKey(key))) continue;
    out[key] = sanitizeRuntimeConfigValue(productCode, nested, [...path, normalizedRuntimeConfigKey(key)]);
  }
  return out;
}

export function sanitizeBotRuntimeConfig(productCode: BotProductCode, value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return sanitizeRuntimeConfigValue(productCode, value) as Record<string, unknown>;
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function buildSafeRuntimeConfigView(input: {
  productCode: BotProductCode;
  instanceId: string;
  liveConfig: Record<string, unknown> | null;
}): BotConfigView | null {
  const safeRaw = sanitizeBotRuntimeConfig(input.productCode, input.liveConfig);
  if (!safeRaw) return null;
  const symbols = typeof safeRaw.symbols === 'string'
    ? safeRaw.symbols.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    productCode: input.productCode,
    instanceId: input.instanceId,
    symbols,
    leverage: num(safeRaw.defaultLeverage),
    takeProfitPercent: num(safeRaw.defaultTakeProfitPercent),
    mode: 'unknown',
    raw: safeRaw,
  };
}
