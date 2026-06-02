import assert from 'node:assert/strict';
import { can, canActOnOwned } from './rbac.ts';
import { generateSessionToken, verifySessionToken, hashToken } from './session.ts';
import { generateCsrfToken, verifyCsrf } from './csrf.ts';
import { EMPTY_LOGIN_LOCKOUT_STATE, nextLoginFailureState } from './login-lockout.ts';

// RBAC role-level
assert.equal(can(['admin'], 'entitlement', 'manage'), true, 'admin manages entitlements');
assert.equal(can(['user'], 'entitlement', 'manage'), false, 'user cannot grant entitlements');
assert.equal(can(['support'], 'audit_log', 'read'), true, 'support reads audit log');
assert.equal(can(['user'], 'audit_log', 'read'), false, 'user cannot read audit log');
assert.equal(can(['teacher'], 'course', 'create'), true, 'teacher creates courses');
assert.equal(can(['user'], 'course', 'create'), false, 'student cannot create courses');

// Ownership: teacher edits OWN course only; admin bypasses ownership
assert.equal(canActOnOwned(['teacher'], 'course', 'update', 't1', 't1'), true, 'teacher edits own course');
assert.equal(canActOnOwned(['teacher'], 'course', 'update', 't1', 't2'), false, 'teacher cannot edit another teacher course');
assert.equal(canActOnOwned(['admin'], 'course', 'update', 'a1', 't2'), true, 'admin bypasses ownership');

// Session tokens: hash stored, constant-time verify, tamper fails
const s = generateSessionToken();
assert.equal(s.tokenHash, hashToken(s.token));
assert.equal(verifySessionToken(s.token, s.tokenHash), true, 'valid token verifies');
assert.equal(verifySessionToken(s.token + 'x', s.tokenHash), false, 'tampered token fails');
assert.ok(s.token.length >= 40 && !s.tokenHash.includes(s.token), 'cookie token != stored hash');

// CSRF helpers
const c = generateCsrfToken();
assert.equal(verifyCsrf(c, c), true, 'matching csrf passes');
assert.equal(verifyCsrf(c, c + '1'), false, 'mismatched csrf fails');
assert.equal(verifyCsrf(undefined, c), false, 'missing cookie fails');

let lockoutState = { ...EMPTY_LOGIN_LOCKOUT_STATE };
for (let i = 0; i < 5; i += 1) lockoutState = nextLoginFailureState(lockoutState, 1_000 + i).state;
assert.equal(lockoutState.accountLockedUntil, 1_004 + 15 * 60_000, 'fifth failure locks account');

console.log('OK  @wtc/auth: RBAC + ownership + session tokens + CSRF + login lockout verified');
