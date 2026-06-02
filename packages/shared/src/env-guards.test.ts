import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { assertNotProduction, requiredSecret, isBase64Key } from './env-guards.ts';
import { AppError } from './errors.ts';

describe('assertNotProduction', () => {
  it('throws in production, allows non-production', () => {
    expect(() => assertNotProduction('mock checkout', 'production')).toThrow(AppError);
    expect(() => assertNotProduction('mock checkout', 'development')).not.toThrow();
    expect(() => assertNotProduction('mock checkout', 'test')).not.toThrow();
  });
});

describe('requiredSecret (fail-closed)', () => {
  it('returns the value when set', () => {
    expect(requiredSecret('K', 'real', 'dev', 'production')).toBe('real');
  });
  it('returns the dev fallback only outside production', () => {
    expect(requiredSecret('K', undefined, 'dev-fallback', 'development')).toBe('dev-fallback');
    expect(requiredSecret('K', '', 'dev-fallback', 'test')).toBe('dev-fallback');
  });
  it('throws in production when the secret is missing', () => {
    expect(() => requiredSecret('SECRET_VAULT_KEK', undefined, 'dev', 'production')).toThrow(/required in production/);
    expect(() => requiredSecret('SECRET_VAULT_KEK', '', 'dev', 'production')).toThrow(/required in production/);
  });

  it('rejects placeholder/dev values in production even when non-empty', () => {
    for (const v of [
      'replace-with-random-32-bytes-base64',
      'dev-only-csrf-secret-not-for-prod',
      'dev-handoff-secret-please-rotate',
      'changeme',
      'example-secret',
    ]) {
      expect(() => requiredSecret('K', v, 'dev', 'production'), v).toThrow(/placeholder|dev value/);
    }
  });

  it('accepts a real value in production and accepts placeholders outside production', () => {
    expect(requiredSecret('K', 'a-strong-real-secret-value-1234', 'dev', 'production')).toBe('a-strong-real-secret-value-1234');
    expect(requiredSecret('K', 'replace-with-x', 'dev', 'development')).toBe('replace-with-x');
  });
});

describe('isBase64Key (base64 → exact byte length; mirrors @wtc/crypto parseKek)', () => {
  it('accepts a base64-encoded 32-byte key', () => {
    // runtime-generated so no secret-shaped literal trips secret:scan
    expect(isBase64Key(randomBytes(32).toString('base64'), 32)).toBe(true);
  });

  it('rejects a key that decodes to the wrong byte length', () => {
    expect(isBase64Key(randomBytes(24).toString('base64'), 32)).toBe(false); // 24 bytes (32 base64 chars)
    expect(isBase64Key(randomBytes(48).toString('base64'), 32)).toBe(false); // 48 bytes
    expect(isBase64Key('a'.repeat(48), 32)).toBe(false); // 48 base64 chars → 36 bytes (e.g. hex 24)
  });

  it('rejects non-base64 input', () => {
    expect(isBase64Key('!!!', 32)).toBe(false);
    expect(isBase64Key('not valid base64 with spaces', 32)).toBe(false);
    expect(isBase64Key('', 32)).toBe(false);
  });

  it('honours the requested byte length', () => {
    expect(isBase64Key(randomBytes(16).toString('base64'), 16)).toBe(true);
    expect(isBase64Key(randomBytes(32).toString('base64'), 16)).toBe(false); // 32 bytes != 16
  });
});
