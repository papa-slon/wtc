import { describe, it, expect } from 'vitest';
import { redact, isSecretValue, REDACTED } from './redact.ts';

const PHC = '$argon2id$v=19$m=65536,t=3,p=2$c29tZXNhbHQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNo';
const BCRYPT = '$2b$12$abcdefghijklmnopqrstuv0123456789ABCDEFGHIJKLMNOPQRSTU';
const BEARER = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig';
const HEX64 = 'a'.repeat(64);
const HEX63 = 'a'.repeat(63);

describe('isSecretValue — value-pattern blocklist', () => {
  it('matches PHC argon2 hashes', () => expect(isSecretValue(PHC)).toBe(true));
  it('matches bcrypt $2b$ hashes', () => expect(isSecretValue(BCRYPT)).toBe(true));
  it('matches Bearer auth values', () => expect(isSecretValue(BEARER)).toBe(true));
  it('matches Basic auth values', () => expect(isSecretValue('Basic dXNlcjpwYXNz')).toBe(true));
  it('matches 64+ char hex strings', () => expect(isSecretValue(HEX64)).toBe(true));
  it('does NOT match a 63-char hex string (boundary)', () => expect(isSecretValue(HEX63)).toBe(false));
  it('does NOT match normal short strings', () => expect(isSecretValue('Hello world')).toBe(false));
  it('does NOT match a UUID (has dashes, not pure hex)', () =>
    expect(isSecretValue('550e8400-e29b-41d4-a716-446655440000')).toBe(false));
  it('does NOT match an email', () => expect(isSecretValue('user@wtc.local')).toBe(false));
  it('ignores non-string scalars', () => {
    expect(isSecretValue(123)).toBe(false);
    expect(isSecretValue(null)).toBe(false);
    expect(isSecretValue(true)).toBe(false);
  });
});

describe('redact — value-pattern guard applies regardless of key name', () => {
  it('redacts a PHC hash under an innocuous key', () => {
    const out = redact({ message: PHC }) as Record<string, unknown>;
    expect(out.message).toBe(REDACTED);
  });

  it('redacts a Bearer token under an innocuous key', () => {
    const out = redact({ info: BEARER }) as Record<string, unknown>;
    expect(out.info).toBe(REDACTED);
  });

  it('redacts a 64-hex value under an innocuous key (e.g. a session token)', () => {
    const out = redact({ data: HEX64 }) as Record<string, unknown>;
    expect(out.data).toBe(REDACTED);
  });

  it('redacts at depth > 0 (nested object)', () => {
    const out = redact({ a: { b: { token_value: PHC } } }) as any;
    expect(out.a.b.token_value).toBe(REDACTED); // (also key-redacted via 'token', but value-guard alone suffices)
  });

  it('redacts secret-looking elements inside arrays', () => {
    const out = redact({ items: ['ok', BEARER, HEX64, 'fine'] }) as any;
    expect(out.items).toEqual(['ok', REDACTED, REDACTED, 'fine']);
  });

  it('leaves ordinary string values untouched', () => {
    const out = redact({ title: 'Quarterly report', note: 'all good', count: 7 }) as any;
    expect(out.title).toBe('Quarterly report');
    expect(out.note).toBe('all good');
    expect(out.count).toBe(7);
  });

  it('still redacts by secret KEY name (regression guard)', () => {
    const out = redact({ password: 'hunter2', apiKey: 'plainshortvalue' }) as any;
    expect(out.password).toBe(REDACTED);
    expect(out.apiKey).toBe(REDACTED);
  });

  it('redacts a bare top-level secret string', () => {
    expect(redact(HEX64)).toBe(REDACTED);
    expect(redact('just text')).toBe('just text');
  });
});
