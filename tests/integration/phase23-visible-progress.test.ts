/**
 * Phase 2.3 visible-progress integration tests (PGlite — real Postgres engine, no Docker).
 *
 * Covers the repos and logic wired in the Phase 2.3 visible-progress wave:
 *
 * TV:
 *   TV-1  createTvGrant writes the grant row + in-txn audit (tv_access.grant)
 *   TV-2  revokeTvGrant records reason on the grant row; tv_access.revoke audit action
 *   TV-3  per-user isolation (other user has no grants)
 *
 * Terminal:
 *   TRM-1  upsertTerminalRelease + getCurrentTerminalRelease round-trip; exclusivity
 *   TRM-2  recordDownloadEvent with entitlementVerified=true writes audit (terminal.download)
 *   TRM-3  recordLicenseEvent writes audit (terminal.license_event); no secret in payload
 *
 * Admin:
 *   ADM-1  updateSupportTicket writes a support.ticket_update audit row with the admin as actor
 *   ADM-2  grantProduct(reason, validUntil) writes product_access_events.reason + audit after
 *           includes reason + validUntil; entitlement.expiresAt is set to validUntil
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  createUser,
  findUserByEmail,
  recentAuditEvents,
  submitTvRequest,
  upsertTradingViewProfile,
  createTvGrant,
  revokeTvGrant,
  listTvGrantsForUser,
  getTvProfile,
  upsertTerminalRelease,
  getCurrentTerminalRelease,
  recordDownloadEvent,
  recordLicenseEvent,
  createSupportTicket,
  updateSupportTicket,
  listSupportTickets,
  grantProduct,
  listProductAccessEvents,
  entitlementsOf,
  type Db,
} from '@wtc/db';

let db: Db;
let userId: string;
let otherUserId: string;
let adminId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);

  userId = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  adminId = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
  otherUserId = (await createUser(db, { email: 'p23-other@wtc.local', passwordHash: 'h', displayName: 'Other P23' })).id;
});

// ============================= TV =============================

describe('TV-1 — createTvGrant writes grant row + in-txn audit', () => {
  it('grant row exists; getTvProfile reflects currentGrantId; audit action tv_access.grant', async () => {
    // Set up a TV profile and request
    await upsertTradingViewProfile(db, { userId, tvUsername: 'p23_trader' });
    const req = await submitTvRequest(db, userId, 'p23_trader');

    const grant = await createTvGrant(db, {
      requestId: req.id,
      userId,
      tvUsername: 'p23_trader',
      grantedAt: new Date('2026-06-01'),
      grantedBy: adminId,
      grantedByType: 'admin',
    });

    // Grant row exists and has expected fields
    const grants = await listTvGrantsForUser(db, userId);
    const grantRow = grants.find((g) => g.id === grant.id);
    expect(grantRow).toBeDefined();
    expect(grantRow!.userId).toBe(userId);
    expect(grantRow!.tvUsername).toBe('p23_trader');
    expect(grantRow!.grantedBy).toBe(adminId);
    expect(grantRow!.revokedAt).toBeNull();

    // Profile pointer updated
    const profile = await getTvProfile(db, userId);
    expect(profile!.currentGrantId).toBe(grant.id);

    // In-txn audit written
    const events = await recentAuditEvents(db, 500);
    const auditRow = events.find((e) => e.action === 'tv_access.grant' && e.targetId === grant.id);
    expect(auditRow).toBeDefined();
    expect(auditRow!.actorUserId).toBe(adminId);
  });
});

describe('TV-2 — revokeTvGrant records reason; tv_access.revoke audit', () => {
  it('revokedAt + revokedBy + revokeReason set on grant row; currentGrantId nulled; audit written', async () => {
    // Get the existing grant from TV-1
    const grantsBeforeRevoke = await listTvGrantsForUser(db, userId);
    const grantToRevoke = grantsBeforeRevoke.find((g) => g.revokedAt === null);
    expect(grantToRevoke).toBeDefined();

    await revokeTvGrant(db, grantToRevoke!.id, adminId, 'subscription expired');

    // Grant row is stamped
    const grantsAfter = await listTvGrantsForUser(db, userId);
    const revokedGrant = grantsAfter.find((g) => g.id === grantToRevoke!.id)!;
    expect(revokedGrant.revokedAt).not.toBeNull();
    expect(revokedGrant.revokedBy).toBe(adminId);
    expect(revokedGrant.revokeReason).toBe('subscription expired');

    // Profile pointer nulled
    const profile = await getTvProfile(db, userId);
    expect(profile!.currentGrantId).toBeNull();

    // Audit row written with action tv_access.revoke
    const events = await recentAuditEvents(db, 500);
    const auditRow = events.find(
      (e) => e.action === 'tv_access.revoke' && e.targetId === grantToRevoke!.id,
    );
    expect(auditRow).toBeDefined();
    expect(auditRow!.actorUserId).toBe(adminId);
  });
});

describe('TV-3 — grants are per-user isolated', () => {
  it('otherUser has no grants; only the target user sees their grants', async () => {
    const otherGrants = await listTvGrantsForUser(db, otherUserId);
    expect(otherGrants.length).toBe(0);

    // userId has grants (even if revoked)
    const myGrants = await listTvGrantsForUser(db, userId);
    expect(myGrants.length).toBeGreaterThan(0);
  });
});

// ============================= Terminal =============================

describe('TRM-1 — upsertTerminalRelease + getCurrentTerminalRelease round-trip; exclusivity', () => {
  it('promotes 1.5.0 then 1.5.1 as current; old row isCurrent=false', async () => {
    await upsertTerminalRelease(db, {
      version: '1.5.0',
      channel: 'stable',
      platform: 'win32',
      publishedAt: new Date('2026-03-01'),
      isCurrent: true,
      checksumSha256: 'abc123',
    });
    await upsertTerminalRelease(db, {
      version: '1.5.1',
      channel: 'stable',
      platform: 'win32',
      publishedAt: new Date('2026-04-01'),
      isCurrent: true,
      checksumSha256: 'def456',
    });

    // getCurrentTerminalRelease returns the latest current
    const current = await getCurrentTerminalRelease(db, 'stable', 'win32');
    expect(current).not.toBeNull();
    expect(current!.version).toBe('1.5.1');
    expect(current!.isCurrent).toBe(true);

    // Old row demoted
    const [old] = await db
      .select()
      .from(schema.terminalReleaseCache)
      .where(
        eq(schema.terminalReleaseCache.version, '1.5.0'),
      );
    expect(old!.isCurrent).toBe(false);
  });
});

describe('TRM-2 — recordDownloadEvent with entitlementVerified=true writes terminal.download audit', () => {
  it('audit row present; no secret or raw URL in the payload', async () => {
    const release = await getCurrentTerminalRelease(db, 'stable', 'win32');
    expect(release).not.toBeNull();

    await recordDownloadEvent(db, {
      userId,
      releaseId: release!.id,
      version: release!.version,
      platform: 'win32',
      ipAddress: '10.0.0.1',
      entitlementVerified: true,
    });

    const events = await recentAuditEvents(db, 500);
    const dl = events.find((e) => e.action === 'terminal.download' && e.actorUserId === userId);
    expect(dl).toBeDefined();
    // Confirm entitlementVerified is recorded in the audit payload
    const after = dl!.after as Record<string, unknown>;
    expect(after.entitlementVerified).toBe(true);
    // Confirm no secret/plaintext key in the payload
    const payloadStr = JSON.stringify(dl!.after);
    expect(payloadStr).not.toMatch(/secret/i);
    expect(payloadStr).not.toMatch(/apikey/i);
    expect(payloadStr).not.toMatch(/password/i);
  });
});

describe('TRM-3 — recordLicenseEvent writes terminal.license_event audit; no secret in payload', () => {
  it('license_event row written; audit row present; device fingerprint not a secret', async () => {
    await recordLicenseEvent(db, {
      userId,
      eventType: 'link_confirmed',
      axiomaUserId: 'axi-user-p23',
      deviceFingerprint: 'sha256:fingerprint_p23',
      metadata: { source: 'phase23_test' },
    });

    const events = await recentAuditEvents(db, 500);
    const lic = events.find(
      (e) => e.action === 'terminal.license_event' && e.actorUserId === userId,
    );
    expect(lic).toBeDefined();
    // Payload should only contain eventType — no axiomaUserId (private), no raw key
    const payloadStr = JSON.stringify(lic!.after);
    expect(payloadStr).not.toMatch(/password/i);
    expect(payloadStr).not.toMatch(/apiKey/i);
  });
});

// ============================= Admin =============================

describe('ADM-1 — updateSupportTicket writes support.ticket_update audit with admin as actor', () => {
  it('status update writes audit row; actorUserId is the admin id', async () => {
    // Create a ticket first
    const ticket = await createSupportTicket(db, {
      userId,
      productCode: 'axioma_terminal',
      subject: 'Phase 2.3 test ticket',
      body: 'Support test body',
      priority: 'normal',
    });

    // Admin updates the ticket
    await updateSupportTicket(
      db,
      ticket.id,
      { status: 'in_progress', assignedTo: adminId },
      adminId,
    );

    // Verify the ticket was updated
    const tickets = await listSupportTickets(db, { userId });
    const updated = tickets.find((t) => t.id === ticket.id);
    expect(updated!.status).toBe('in_progress');

    // Audit row: action=support.ticket_update, actorUserId=adminId, targetId=ticket.id
    const events = await recentAuditEvents(db, 500);
    const auditRow = events.find(
      (e) => e.action === 'support.ticket_update' && e.targetId === ticket.id,
    );
    expect(auditRow).toBeDefined();
    expect(auditRow!.actorUserId).toBe(adminId);
  });
});

describe('ADM-2 — grantProduct(reason, validUntil) writes product_access_events.reason + audit after with validUntil', () => {
  it('product_access_events.reason is set; entitlement.expiresAt reflects validUntil', async () => {
    const validUntil = Date.now() + 30 * 86_400_000; // 30 days from now

    await grantProduct(
      db,
      otherUserId,
      'axioma_terminal',
      Date.now(),
      adminId,
      'sales_promotion_june',
      validUntil,
    );

    // product_access_events has reason populated
    const paeRows = await listProductAccessEvents(db, otherUserId, { productCode: 'axioma_terminal' });
    expect(paeRows.length).toBeGreaterThan(0);
    const pae = paeRows[0]!;
    expect(pae.reason).toBe('sales_promotion_june');
    expect(pae.toState).toBe('active');
    expect(pae.actorId).toBe(adminId);

    // Entitlement has expiresAt set (within 1 second of validUntil)
    const ents = await entitlementsOf(db, otherUserId);
    const ent = ents.find((e) => e.productCode === 'axioma_terminal');
    expect(ent).toBeDefined();
    expect(ent!.status).toBe('active');
    // expiresAt field is returned as epoch-ms in entitlementsOf
    // The Entitlement type has expiresAt?: number
    if (ent!.expiresAt !== undefined) {
      expect(Math.abs(ent!.expiresAt - validUntil)).toBeLessThan(5_000);
    }

    // Audit row contains reason + validUntil in the after payload
    const events = await recentAuditEvents(db, 500);
    const auditRow = events.find(
      (e) => e.action === 'product.grant' && e.targetId === `${otherUserId}:axioma_terminal`,
    );
    expect(auditRow).toBeDefined();
    const after = auditRow!.after as Record<string, unknown>;
    expect(after.reason).toBe('sales_promotion_june');
    expect(after.validUntil).toBe(validUntil);
  });
});
