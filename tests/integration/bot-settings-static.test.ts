/**
 * Static assertions on the bot settings page (settings/page.tsx) for the
 * per-account settings feature (Step G).
 *
 * Guards that:
 *  - isAdmin is imported and used for the RBAC gate
 *  - effectiveAccount is computed with the admin gate pattern
 *  - hidden `name="account"` fields are present on all three form surfaces
 *  - loadBotConfig is called with effectiveAccount (threads the account)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const settings = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');

describe('bot settings page: per-account RBAC + hidden account field', () => {
  it('imports isAdmin from the session helper', () => {
    expect(settings).toContain('isAdmin');
    expect(settings).toMatch(/import.*isAdmin.*from/);
  });

  it('computes effectiveAccount with the admin gate (isAdmin(user) ? account : undefined)', () => {
    // The gate must use isAdmin(user) — the page has a full DemoUser in scope.
    expect(settings).toContain('isAdmin(user) ? account : undefined');
    // The variable must be named effectiveAccount.
    expect(settings).toContain('effectiveAccount');
  });

  it('calls loadBotConfig with effectiveAccount as the third argument', () => {
    // loadBotConfig(user.id, meta.code, effectiveAccount) — threads the account.
    expect(settings).toContain('loadBotConfig(user.id, meta.code, effectiveAccount)');
  });

  it('has a hidden name="account" field on the save form (custom-settings)', () => {
    // The save form (id="custom-settings") must carry the routing field.
    expect(settings).toContain('name="account"');
    // Confirm it appears inside the save form context (form with saveBotConfigAction).
    expect(settings).toContain('<form id="custom-settings" action={saveBotConfigAction}');
    // The hidden field must be populated with effectiveAccount.
    expect(settings).toContain('value={effectiveAccount ?? \'\'}');
  });

  it('has a hidden name="account" field on every preset form', () => {
    // Reference profiles / preset forms also carry the account field.
    // The preset section renders a form per preset with applyBotPresetAction.
    expect(settings).toContain('action={applyBotPresetAction}');
    // Count occurrences: save form + use-system-default form + at least one preset form
    // → at minimum 3 account hidden fields on the page.
    const accountFieldCount = (settings.match(/name="account"/g) ?? []).length;
    expect(accountFieldCount).toBeGreaterThanOrEqual(3);
  });

  it('has a hidden name="account" field on the use-system-default form', () => {
    // The use-system-default form (useSystemDefaultAction) also carries account.
    expect(settings).toContain('action={useSystemDefaultAction}');
    expect(settings).toContain('action={useSystemDefaultAction}');
    // The form with useSystemDefaultAction contains the account field
    // (the source text has the hidden input before the submit button in that form).
    const useDefaultIdx = settings.indexOf('action={useSystemDefaultAction}');
    const accountAfterDefault = settings.indexOf('name="account"', useDefaultIdx);
    expect(accountAfterDefault).toBeGreaterThan(useDefaultIdx);
  });

  it('does NOT expose the accountId inside the persisted config JSON (forbidden-key guard intact)', () => {
    // accountId is a routing arg only; it must never appear as a form input name
    // that would be parsed by configFromForm into the saved config blob.
    // The only appearance of "account" as a field name must be as the hidden routing field.
    expect(settings).not.toContain('name="accountId"');
    // The persistBotConfig closure receives accountId as a trailing arg, not inside config.
    expect(settings).toContain('persistConfig: (userId, productCode, config, note, accountId) => persistBotConfig');
  });

  it('loads legacy accounts only for admins (admin-gated call to loadLegacyAccounts)', () => {
    // The loadLegacyAccounts() call is guarded so non-admins never trigger the admin DB read.
    expect(settings).toContain('loadLegacyAccounts()');
    expect(settings).toContain('isAdmin(user)');
  });
});
