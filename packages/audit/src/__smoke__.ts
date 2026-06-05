import assert from 'node:assert/strict';
import { redact } from './redact.ts';
import { buildEvent, createMemoryAuditWriter } from './audit.ts';

// 1. redaction removes secret-looking keys at any depth, keeps safe keys
const input = {
  email: 'a@b.com',
  apiKey: 'AK_should_vanish',
  nested: { apiSecret: 'shh', label: 'my-key', auth: { Authorization: 'Bearer xyz' } },
  list: [{ password: 'p' }, { ok: 1 }],
};
const red = redact(input) as any;
const serialized = JSON.stringify(red);
assert.ok(!serialized.includes('AK_should_vanish'), 'apiKey must be redacted');
assert.ok(!serialized.includes('shh'), 'apiSecret must be redacted');
assert.ok(!serialized.includes('Bearer xyz'), 'Authorization must be redacted');
assert.ok(!serialized.includes('"p"'), 'password must be redacted');
assert.equal(red.email, 'a@b.com', 'non-secret kept');
assert.equal(red.nested.label, 'my-key', 'non-secret kept');

// 2. buildEvent redacts before/after and fills id/ts/result
const e = buildEvent({
  actorUserId: 'u1', actorRole: 'user', action: 'auth.register', targetType: 'user',
  after: { exchange: 'bingx', apiKey: 'LEAK', apiSecret: 'LEAK2' }, result: 'success',
});
assert.ok(e.id && e.ts > 0, 'event has id and ts');
assert.ok(!JSON.stringify(e.after).includes('LEAK'), 'event payload is redacted');

// 3. memory writer captures redacted events
const { writer, events } = createMemoryAuditWriter();
await writer.write({ actorUserId: 'u1', actorRole: 'admin', action: 'product.grant', targetType: 'entitlement', after: { token: 'SEKRIT' } });
assert.equal(events.length, 1);
assert.ok(!JSON.stringify(events[0]).includes('SEKRIT'), 'written event has no secrets');

// 4. provider-account mapping audit codes are registered and redacted.
await writer.write({
  actorUserId: 'admin',
  actorRole: 'admin',
  action: 'bot.provider_account.map',
  targetType: 'bot_provider_account',
  after: { providerAccountId: 'pub_demo', apiSecret: 'SHOULD_NOT_LEAK' },
});
assert.equal(events.length, 2);
assert.ok(!JSON.stringify(events[1]).includes('SHOULD_NOT_LEAK'), 'provider mapping audit redacts secret-looking fields');

console.log('OK  @wtc/audit: redaction + buildEvent + memory writer verified (no secrets leak)');
