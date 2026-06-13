import type { AccessDecision } from '@wtc/entitlements';
import { botMeta, type BotProductCode } from './meta';

export interface BotConfigActionUser {
  id: string;
  roles: readonly string[];
}

export interface BotConfigActionPreset {
  id: string;
  config: Record<string, unknown>;
}

export type BotConfigParseResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false };

export interface BotConfigActionConfigError {
  code: string;
  row?: number;
}

export interface BotConfigActionRoutes {
  configError: string;
  configErrorFor?: (error: BotConfigActionConfigError) => string;
  lockedError: string;
  systemDefaultError: string;
  successRedirect?: string;
  revalidatePath?: string;
  invalidPreset: 'noop' | 'config-error';
}

export interface BotConfigActionOutcome {
  kind: 'noop' | 'success' | 'redirect';
  redirectTo?: string;
  revalidatePaths: readonly string[];
}

export interface BotConfigActionDependencies {
  requireUser: () => Promise<BotConfigActionUser>;
  botAccessForUser: (user: BotConfigActionUser, productCode: BotProductCode) => Promise<AccessDecision>;
  formIssues: (productCode: BotProductCode, formData: FormData) => readonly string[];
  firstFormIssue?: (productCode: BotProductCode, formData: FormData) => BotConfigActionConfigError | null;
  configFromForm: (productCode: BotProductCode, formData: FormData) => Record<string, unknown>;
  parseConfig: (productCode: BotProductCode, config: Record<string, unknown>) => BotConfigParseResult;
  findPreset: (productCode: BotProductCode, presetId: string) => BotConfigActionPreset | undefined;
  persistConfig: (userId: string, productCode: BotProductCode, config: Record<string, unknown>, note: string, accountId?: string | null) => Promise<unknown>;
  selectSystemDefault: (userId: string, productCode: BotProductCode, accountId?: string | null) => Promise<'saved' | 'unavailable'>;
}

const FORBIDDEN_BOT_CONFIG_ACTION_FORM_KEYS = new Set([
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
  'headers',
  'applyconfig',
  'startbot',
  'stopbot',
  'start',
  'stop',
  'restart',
  'retest',
  'testexchange',
  'exchangeapply',
  'exchangeorder',
  'livecontrol',
]);

function normalizedConfigKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

export function forbiddenBotConfigActionFormKey(formData: FormData): string | null {
  for (const key of formData.keys()) {
    if (FORBIDDEN_BOT_CONFIG_ACTION_FORM_KEYS.has(normalizedConfigKey(key))) return key;
  }
  return null;
}

function noop(): BotConfigActionOutcome {
  return { kind: 'noop', revalidatePaths: [] };
}

function redirectOutcome(redirectTo: string): BotConfigActionOutcome {
  return { kind: 'redirect', redirectTo, revalidatePaths: [] };
}

function configErrorOutcome(routes: BotConfigActionRoutes, error: BotConfigActionConfigError): BotConfigActionOutcome {
  return redirectOutcome(routes.configErrorFor?.(error) ?? routes.configError);
}

function successOutcome(routes: BotConfigActionRoutes): BotConfigActionOutcome {
  const revalidatePaths = routes.revalidatePath ? [routes.revalidatePath] : [];
  if (routes.successRedirect) return { kind: 'redirect', redirectTo: routes.successRedirect, revalidatePaths };
  return { kind: 'success', revalidatePaths };
}

interface ReadyActionContext {
  slug: string;
  user: BotConfigActionUser;
  productCode: BotProductCode;
  accountId?: string;
}

async function resolveActionContext(
  formData: FormData,
  deps: BotConfigActionDependencies,
): Promise<ReadyActionContext | null> {
  const slug = String(formData.get('bot') ?? '');
  const meta = botMeta(slug);
  if (!meta) return null;
  const user = await deps.requireUser();
  const access = await deps.botAccessForUser(user, meta.code);
  if (!access.allowed) return null;
  const requestedAccount = String(formData.get('account') ?? '') || undefined;
  const accountId = (requestedAccount && user.roles.includes('admin')) ? requestedAccount : undefined;
  return { slug, user, productCode: meta.code, accountId };
}

function isLockedDefaultError(err: unknown): boolean {
  return err instanceof Error && err.message === 'bot_config_override_disabled';
}

async function persistWithLockedDefaultRedirect(
  input: {
    userId: string;
    productCode: BotProductCode;
    config: Record<string, unknown>;
    note: string;
    routes: BotConfigActionRoutes;
    deps: BotConfigActionDependencies;
    accountId?: string;
  },
): Promise<BotConfigActionOutcome | null> {
  try {
    await input.deps.persistConfig(input.userId, input.productCode, input.config, input.note, input.accountId);
    return null;
  } catch (err) {
    if (isLockedDefaultError(err)) return redirectOutcome(input.routes.lockedError);
    throw err;
  }
}

export async function handleSaveBotConfigAction(
  formData: FormData,
  routes: BotConfigActionRoutes,
  deps: BotConfigActionDependencies,
  note: string,
): Promise<BotConfigActionOutcome> {
  const ctx = await resolveActionContext(formData, deps);
  if (!ctx) return noop();
  if (forbiddenBotConfigActionFormKey(formData)) return configErrorOutcome(routes, { code: 'forbidden-field' });

  const issues = deps.formIssues(ctx.productCode, formData);
  if (issues.length > 0) {
    return configErrorOutcome(routes, deps.firstFormIssue?.(ctx.productCode, formData) ?? { code: 'form-invalid' });
  }

  const parsed = deps.parseConfig(ctx.productCode, deps.configFromForm(ctx.productCode, formData));
  if (!parsed.success) {
    return configErrorOutcome(routes, deps.firstFormIssue?.(ctx.productCode, formData) ?? { code: 'schema-invalid' });
  }

  const locked = await persistWithLockedDefaultRedirect({
    userId: ctx.user.id,
    productCode: ctx.productCode,
    config: parsed.data,
    note,
    routes,
    deps,
    accountId: ctx.accountId,
  });
  if (locked) return locked;
  return successOutcome(routes);
}

export async function handleApplyBotPresetAction(
  formData: FormData,
  routes: BotConfigActionRoutes,
  deps: BotConfigActionDependencies,
): Promise<BotConfigActionOutcome> {
  const ctx = await resolveActionContext(formData, deps);
  if (!ctx) return noop();
  if (forbiddenBotConfigActionFormKey(formData)) return configErrorOutcome(routes, { code: 'forbidden-field' });

  const presetId = String(formData.get('presetId') ?? '');
  const preset = deps.findPreset(ctx.productCode, presetId);
  if (!preset) return routes.invalidPreset === 'config-error' ? configErrorOutcome(routes, { code: 'preset-invalid' }) : noop();

  const parsed = deps.parseConfig(ctx.productCode, preset.config);
  if (!parsed.success) return routes.invalidPreset === 'config-error' ? configErrorOutcome(routes, { code: 'preset-invalid' }) : noop();

  const locked = await persistWithLockedDefaultRedirect({
    userId: ctx.user.id,
    productCode: ctx.productCode,
    config: parsed.data,
    note: `preset:${preset.id}`,
    routes,
    deps,
    accountId: ctx.accountId,
  });
  if (locked) return locked;
  return successOutcome(routes);
}

export async function handleUseSystemDefaultBotConfigAction(
  formData: FormData,
  routes: BotConfigActionRoutes,
  deps: BotConfigActionDependencies,
): Promise<BotConfigActionOutcome> {
  const ctx = await resolveActionContext(formData, deps);
  if (!ctx) return noop();
  if (forbiddenBotConfigActionFormKey(formData)) return configErrorOutcome(routes, { code: 'forbidden-field' });

  const result = await deps.selectSystemDefault(ctx.user.id, ctx.productCode, ctx.accountId);
  if (result !== 'saved') return redirectOutcome(routes.systemDefaultError);
  return successOutcome(routes);
}
