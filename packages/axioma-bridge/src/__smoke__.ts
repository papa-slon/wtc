import assert from 'node:assert/strict';
import { buildHandoffClaims, signHandoffToken, verifyHandoffToken, HANDOFF_TTL_MS } from './handoff.ts';
import { createAxiomaHandoffPreflightFixture, runAxiomaHandoffPreflight } from './preflight.ts';

const SECRET = 'dev-handoff-signing-secret-please-rotate';
const AUD = 'axi-o.ma';
const NOW = 1_800_000_000_000;

const claims = buildHandoffClaims('user-1', 'axioma_terminal', 'open_journal', NOW, AUD);
const token = signHandoffToken(claims, SECRET);

// 1. valid token verifies
const ok = verifyHandoffToken(token, SECRET, { audience: AUD, now: NOW + 1000 });
assert.equal(ok.valid, true);
if (ok.valid) assert.equal(ok.claims.sub, 'user-1');

// 2. expired token rejected
const expired = verifyHandoffToken(token, SECRET, { audience: AUD, now: NOW + HANDOFF_TTL_MS + 1 });
assert.equal(expired.valid, false);
if (!expired.valid) assert.equal(expired.reason, 'expired');

// 3. wrong audience rejected
assert.equal(verifyHandoffToken(token, SECRET, { audience: 'evil.com', now: NOW }).valid, false);

// 4. tampered signature rejected
assert.equal(verifyHandoffToken(token.slice(0, -2) + 'AA', SECRET, { audience: AUD, now: NOW }).valid, false);

// 5. wrong secret rejected
assert.equal(verifyHandoffToken(token, 'other-secret', { audience: AUD, now: NOW }).valid, false);

// 6. replay rejected via jti-seen callback
const used = new Set([claims.jti]);
const replayed = verifyHandoffToken(token, SECRET, { audience: AUD, now: NOW, isReplayed: (j) => used.has(j) });
assert.equal(replayed.valid, false);
if (!replayed.valid) assert.equal(replayed.reason, 'replayed');

// 7. token carries no secrets / exchange keys (only declared claims)
assert.ok(!token.toLowerCase().includes('apikey') && !token.toLowerCase().includes('secret='));

// 8-11. generated ES256 + public JWKS dry-run proof (no retained token/key material)
const fixture = createAxiomaHandoffPreflightFixture({ audience: AUD, nowMs: NOW });
const preflight = runAxiomaHandoffPreflight({ fixture });
assert.equal(preflight.signer.alg, 'ES256');
assert.equal(preflight.jwks.keyCount, 1);
assert.equal(preflight.jwks.hasPrivateScalar, false);
assert.equal(preflight.result, 'pass');

console.log('OK  @wtc/axioma-bridge handoff: 11 checks passed (HS256 dev stub + ES256/JWKS preflight)');
