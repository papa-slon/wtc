import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { botAccessForUser } from '@/lib/access';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { listExchangeKeys, recordExchangeKeyMetadataCheck } from '@/lib/backend';
import { exchangeKeyMetadataCheckSchema } from '@wtc/shared';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses, MetricCard, RiskWarningBanner } from '@wtc/ui';
import { fmtDate, fmtMoney } from '@/lib/format';
import { loadBot, BotAccessRequired, loadBotReadModelForUser } from '@/features/bots/data';
import { BotSubNav } from '@/components/BotSubNav';
import { botMeta, type BotProductCode } from '@/features/bots/meta';
import {
  handleApplyBotPresetAction,
  handleSaveBotConfigAction,
  handleUseSystemDefaultBotConfigAction,
  type BotConfigActionDependencies,
  type BotConfigActionOutcome,
  type BotConfigActionRoutes,
  type BotConfigParseResult,
} from '@/features/bots/config-action-handler';
import { ExchangeKeyReadinessPanel } from '@/features/bots/ExchangeKeyReadiness';
import {
  BOT_OPERATION_MODES,
  botConfigDefaultsFor,
  botConfigFieldsFor,
  botConfigFirstFormIssue,
  botConfigFormIssues,
  botConfigFormInput,
  botConfigPresetFor,
  botConfigPresetsFor,
  botConfigSchemaFor,
  legacyRuntimeStageSourceExists,
  legacyRuntimeSymbolSourceExists,
  legacyStageConfigsFromConfig,
  legacyRuntimeSymbolConfigsFromConfig,
  legacySymbolConfigsFromConfig,
  loadBotConfig,
  persistBotConfig,
  selectSystemDefaultBotConfig,
  tortilaSymbolConfigsFromConfig,
} from '@/features/bots/config';
import { TortilaCoinConfigEditor } from '@/features/bots/TortilaCoinConfigEditor';
import { LegacyAveragingConfigTable } from '@/features/bots/LegacyAveragingConfigTable';
import { botConfigErrorCopy, botConfigErrorRedirect } from '@/features/bots/config-error-copy';

interface LegacyProviderAccountView {
  pubId: string;
  market: string;
  running: boolean;
  balance: number;
  quarantined: boolean;
  quarantineReason: string | null;
  symbols: number;
  activeSlots: number;
  activeOrders: number;
}

type KeyCheckResult = 'vault-present' | 'missing' | 'invalid';
const TORTILA_EMBEDDED_FIELD_NAMES = new Set([
  'symbols',
  'maxOpenSymbols',
  'maxTotalUnits',
  'maxUnitsPerDirection',
  'haltDrawdownPercent',
  'dailyMaxLossPercent',
  'maxNewEntriesPerTick',
]);

function keyCheckResult(value: string | undefined): KeyCheckResult | undefined {
  return value === 'vault-present' || value === 'missing' || value === 'invalid' ? value : undefined;
}

function shortPubId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function numberFrom(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function legacyProviderAccounts(config: Record<string, unknown> | null): LegacyProviderAccountView[] {
  const rows = Array.isArray(config?.providerAccounts) ? config.providerAccounts : [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .map((row) => ({
      pubId: typeof row.pubId === 'string' ? row.pubId : '',
      market: typeof row.market === 'string' ? row.market : 'BINGX',
      running: row.running === true,
      balance: numberFrom(row.balance),
      quarantined: row.quarantined === true,
      quarantineReason: typeof row.quarantineReason === 'string' ? row.quarantineReason : null,
      symbols: numberFrom(row.symbols),
      activeSlots: numberFrom(row.activeSlots),
      activeOrders: numberFrom(row.activeOrders),
    }))
    .filter((row) => row.pubId);
}

function pubIdSummary(count: number): string {
  return count === 1 ? '1 pub_id mapped' : `${count} pub_ids mapped`;
}

function parseBotConfigActionConfig(productCode: BotProductCode, config: Record<string, unknown>): BotConfigParseResult {
  const parsed = botConfigSchemaFor(productCode).safeParse(config);
  return parsed.success ? { success: true, data: parsed.data as unknown as Record<string, unknown> } : { success: false };
}

const botConfigActionDependencies: BotConfigActionDependencies = {
  requireUser,
  botAccessForUser,
  formIssues: botConfigFormIssues,
  firstFormIssue: botConfigFirstFormIssue,
  configFromForm: botConfigFormInput,
  parseConfig: parseBotConfigActionConfig,
  findPreset: botConfigPresetFor,
  persistConfig: (userId, productCode, config, note) => persistBotConfig(userId, productCode, config, note),
  selectSystemDefault: (userId, productCode) => selectSystemDefaultBotConfig(userId, productCode),
};

function settingsActionRoutes(slug: string): BotConfigActionRoutes {
  return {
    configError: `/app/bots/${slug}/settings?err=config`,
    configErrorFor: (error) => botConfigErrorRedirect(`/app/bots/${slug}/settings?err=config`, error),
    lockedError: `/app/bots/${slug}/settings?err=locked`,
    systemDefaultError: `/app/bots/${slug}/settings?err=system-default`,
    revalidatePath: `/app/bots/${slug}/settings`,
    invalidPreset: 'noop',
  };
}

function finishBotConfigActionOutcome(outcome: BotConfigActionOutcome): void {
  for (const path of outcome.revalidatePaths) revalidatePath(path);
  if (outcome.redirectTo) redirect(outcome.redirectTo);
}

async function saveBotConfigAction(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const slug = String(formData.get('bot') ?? '');
  const outcome = await handleSaveBotConfigAction(formData, settingsActionRoutes(slug), botConfigActionDependencies, 'manual edit');
  finishBotConfigActionOutcome(outcome);
}

async function applyBotPresetAction(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const slug = String(formData.get('bot') ?? '');
  const outcome = await handleApplyBotPresetAction(formData, settingsActionRoutes(slug), botConfigActionDependencies);
  finishBotConfigActionOutcome(outcome);
}

async function useSystemDefaultAction(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const slug = String(formData.get('bot') ?? '');
  const outcome = await handleUseSystemDefaultBotConfigAction(formData, settingsActionRoutes(slug), botConfigActionDependencies);
  finishBotConfigActionOutcome(outcome);
}

async function checkExchangeKeyMetadataAction(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const parsed = exchangeKeyMetadataCheckSchema.safeParse({
    bot: formData.get('bot'),
    exchangeAccountId: formData.get('exchangeAccountId'),
  });
  const slug = parsed.success ? parsed.data.bot : String(formData.get('bot') ?? 'tortila');
  if (!parsed.success) redirect(`/app/bots/${slug}/settings?keyCheck=invalid`);
  const meta = botMeta(parsed.data.bot);
  if (!meta || meta.code !== 'tortila_bot') redirect(`/app/bots/${parsed.data.bot}/settings?keyCheck=invalid`);
  const access = await botAccessForUser(user, meta.code);
  if (!access.allowed) return;
  const result = await recordExchangeKeyMetadataCheck(user.id, parsed.data.exchangeAccountId);
  redirect(`/app/bots/${parsed.data.bot}/settings?keyCheck=${result.outcome === 'vault_present' ? 'vault-present' : 'missing'}`);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ bot: string }>;
  searchParams: Promise<{ err?: string; keyCheck?: string; issue?: string; row?: string }>;
}) {
  const { bot } = await params;
  const sp = await searchParams;
  const { meta, access } = await loadBot(bot);
  if (!access.allowed) return <BotAccessRequired meta={meta} section="Settings" />;

  const user = await requireUser();
  const [state, legacyRead, exchangeKeys] = await Promise.all([
    loadBotConfig(user.id, meta.code),
    meta.code === 'legacy_bot' ? loadBotReadModelForUser(user.id, meta.code, ['config']) : Promise.resolve(null),
    meta.code === 'tortila_bot' ? listExchangeKeys(user.id) : Promise.resolve([]),
  ]);
  const legacyLiveConfig =
    meta.code === 'legacy_bot' && legacyRead?.config.data?.raw && typeof legacyRead.config.data.raw === 'object'
      ? legacyRead.config.data.raw as Record<string, unknown>
      : null;
  const cur = state.current ?? {};
  const defaults = botConfigDefaultsFor(meta.code);
  const fields = botConfigFieldsFor(meta.code).filter((f) => meta.code !== 'tortila_bot' || !TORTILA_EMBEDDED_FIELD_NAMES.has(f.name));
  const presets = botConfigPresetsFor(meta.code);
  const sevTone = (s: string) => (s === 'critical' ? 'bad' : 'warn');
  const currentMode = cur.operationMode != null ? String(cur.operationMode) : defaults.operationMode;
  const tortilaRows = meta.code === 'tortila_bot' ? tortilaSymbolConfigsFromConfig(cur) : [];
  const tortilaPortfolioCaps = meta.code === 'tortila_bot' ? {
    maxOpenSymbols: cur.maxOpenSymbols != null ? String(cur.maxOpenSymbols) : defaults.maxOpenSymbols,
    maxTotalUnits: cur.maxTotalUnits != null ? String(cur.maxTotalUnits) : defaults.maxTotalUnits,
    maxUnitsPerDirection: cur.maxUnitsPerDirection != null ? String(cur.maxUnitsPerDirection) : defaults.maxUnitsPerDirection,
    haltDrawdownPercent: cur.haltDrawdownPercent != null ? String(cur.haltDrawdownPercent) : defaults.haltDrawdownPercent,
    dailyMaxLossPercent: cur.dailyMaxLossPercent != null ? String(cur.dailyMaxLossPercent) : defaults.dailyMaxLossPercent,
    maxNewEntriesPerTick: cur.maxNewEntriesPerTick != null ? String(cur.maxNewEntriesPerTick) : defaults.maxNewEntriesPerTick,
  } : undefined;
  const legacyRows = meta.code === 'legacy_bot' ? legacySymbolConfigsFromConfig(cur) : [];
  const legacyStages = meta.code === 'legacy_bot' ? legacyStageConfigsFromConfig(cur) : [];
  const hasLegacySnapshotRows = meta.code === 'legacy_bot' && legacyRuntimeSymbolSourceExists(legacyLiveConfig);
  const hasLegacySnapshotStages = meta.code === 'legacy_bot' && legacyRuntimeStageSourceExists(legacyLiveConfig);
  const legacySnapshotRows = hasLegacySnapshotRows ? legacyRuntimeSymbolConfigsFromConfig(legacyLiveConfig) : [];
  const legacySnapshotStages = hasLegacySnapshotStages ? legacyStageConfigsFromConfig(legacyLiveConfig) : [];
  const legacyAccounts = meta.code === 'legacy_bot' ? legacyProviderAccounts(legacyLiveConfig) : [];
  const sourceLabel = state.sourceLabel;
  const sourceDetail = state.sourceDetail;
  const modeMeta = BOT_OPERATION_MODES.find((m) => m.value === currentMode) ?? BOT_OPERATION_MODES[0]!;
  const hasSystemDefault = state.systemDefault !== null;
  const canCustomize = state.systemDefault?.allowUserOverride !== false;
  const legacySnapshotStageCapacity = legacySnapshotStages.reduce((sum, row) => sum + row.rsiSlots + row.cciSlots, 0);
  const checkResult = keyCheckResult(sp.keyCheck);
  const configError = botConfigErrorCopy(meta.code, sp);
  const legacyExportProviderCount = meta.code === 'legacy_bot' ? legacyAccounts.length : 0;
  const exportBlockedByProviderMapping = meta.code === 'legacy_bot' && legacyExportProviderCount !== 1;
  const legacyExportBlockDetail = legacyExportProviderCount === 0
    ? 'Admin must map one active Legacy provider pub_id before this page offers the native JSON export. The blocked state is intentional so the user does not download an unscoped provider-reference file.'
    : `Admin must reduce Legacy provider mapping to exactly one active pub_id before this page offers the native JSON export. Current mapped pub_id count: ${legacyExportProviderCount}.`;
  const effectiveStatus = state.source === 'system_default' && state.systemDefault
    ? { tone: 'gold' as const, label: `system v${state.systemDefault.version}` }
    : state.source === 'user_override' && state.version != null
      ? { tone: 'ok' as const, label: `custom v${state.version}` }
      : { tone: 'warn' as const, label: 'default settings' };
  // A single quiet "use system default" affordance is offered only when a system
  // default exists and is not already the active source (replaces the deleted
  // provenance ladder cards).
  const offerSystemDefault = hasSystemDefault && state.source !== 'system_default';

  return (
    <div className="wtc-stack tset-page">
      <div className="wtc-spread">
        <SectionHeader kicker={`${meta.name} - Settings`} title="Configuration" />
        <StatusPill tone={effectiveStatus.tone}>{effectiveStatus.label}</StatusPill>
      </div>
      <BotSubNav bot={bot} active="settings" />

      {/* One quiet storage line. The "nothing is pushed to a live exchange"
          disclaimer lives ONLY on the save bar now (it was repeated 5+ times). */}
      {state.mode === 'postgres' ? (
        <div className="wtc-spread" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <p className="tset-source-note">
            Settings in use: {sourceLabel}. Saved to your account — each save appends an immutable, versioned profile.
          </p>
          {offerSystemDefault && (
            <form action={useSystemDefaultAction}>
              <CsrfField />
              <input type="hidden" name="bot" value={bot} />
              <button className={buttonClasses('ghost')} type="submit" style={{ fontSize: 13 }}>Use system default</button>
            </form>
          )}
        </div>
      ) : (
        <RiskWarningBanner
          severity="warning"
          title="In-memory storage (dev)"
          detail="Demo mode - saves are not persisted. Set DATABASE_URL to store config + version history in Postgres."
        />
      )}

      {/* Real source risk signal is never hidden behind a healthy card. */}
      {state.sourceIssue && (
        <RiskWarningBanner
          severity={state.sourceIssue.kind}
          title={state.sourceIssue.title}
          detail={state.sourceIssue.detail}
        />
      )}

      {configError && (
        <RiskWarningBanner
          severity="error"
          title={configError.title}
          detail={`${configError.detail} Settings in use remain ${effectiveStatus.label}; this failed draft was not saved.`}
        />
      )}
      {sp.err === 'locked' && (
        <RiskWarningBanner
          severity="error"
          title="Customization is locked"
          detail="The current WTC system default does not allow user overrides. Use the default settings until WTC reopens customization."
        />
      )}
      {sp.err === 'system-default' && (
        <RiskWarningBanner
          severity="error"
          title="System default is unavailable"
          detail="No published system default is available for this bot yet, so WTC keeps showing the default settings or your custom profile."
        />
      )}

      {/* THE EDITOR — first thing the user sees. Save contract unchanged:
          <form id="custom-settings" action={saveBotConfigAction}> with CsrfField,
          hidden bot, and the exact same input name attributes. */}
      <Card title={`${meta.name} configuration`}>
        {!canCustomize && (
          <RiskWarningBanner
            severity="warning"
            title="Custom settings are locked"
            detail="You can inspect the resolved WTC default, but custom saves and reference profiles are disabled while this system default is locked."
          />
        )}
        <form id="custom-settings" action={saveBotConfigAction} className="wtc-stack" style={{ gap: 16 }}>
          <CsrfField />
          <input type="hidden" name="bot" value={bot} />
          <label className="wtc-stack" style={{ gap: 4, maxWidth: 360 }}>
            <span style={{ fontSize: 13 }}>Strategy mode</span>
            <select className="wtc-input" name="operationMode" defaultValue={cur.operationMode != null ? String(cur.operationMode) : defaults.operationMode}>
              {BOT_OPERATION_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <span className="wtc-dim" style={{ fontSize: 11 }}>
              {modeMeta.hint}
            </span>
          </label>
          {meta.code === 'tortila_bot' && (
            <TortilaCoinConfigEditor
              rows={tortilaRows}
              portfolioCaps={tortilaPortfolioCaps}
              canCustomize={canCustomize}
              saveIssue={configError ?? undefined}
            />
          )}
          {meta.code === 'legacy_bot' && (
            <LegacyAveragingConfigTable
              rows={legacyRows}
              stages={legacyStages}
              providerAccountCount={legacyAccounts.length}
              sourceLabel={sourceLabel}
              sourceDetail={sourceDetail}
              saveIssue={configError?.target === 'legacy-row' || configError?.target === 'legacy-stage' ? configError : undefined}
            />
          )}
          {fields.length > 0 && (
            <details className="tset-caps">
              <summary className="tset-caps-summary">
                <span>Advanced</span>
                <span className="tset-caps-hint">leverage and compatibility fields</span>
              </summary>
              <div className="tset-caps-body">
                <div className="wtc-grid wtc-grid-2">
                  {fields.map((f) => (
                    <label key={f.name} className="wtc-stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 13 }}>{f.label}</span>
                      {f.type === 'select' ? (
                        <select className="wtc-input" name={f.name} defaultValue={cur[f.name] != null ? String(cur[f.name]) : defaults[f.name]}>
                          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          className="wtc-input"
                          name={f.name}
                          type={f.type}
                          step={f.step}
                          placeholder={f.placeholder}
                          defaultValue={cur[f.name] != null ? String(cur[f.name]) : defaults[f.name]}
                        />
                      )}
                      <span className="wtc-dim" style={{ fontSize: 11 }}>{f.hint}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>
          )}
          <div className="tset-savebar">
            <p className="tset-savebar-note">
              Saving appends a versioned profile to your account. Nothing is pushed to a live exchange or bot.
            </p>
            <button className={buttonClasses('primary')} type="submit" disabled={!canCustomize}>Save custom settings</button>
          </div>
        </form>
      </Card>

      {meta.code === 'legacy_bot' && legacyAccounts.length === 0 && (
        <RiskWarningBanner
          severity="warning"
          title="No provider pub_id mapped"
          detail="Runtime balances, slots, and provider statistics must stay treated as unavailable until one active Legacy pub_id is mapped to this WTC bot instance."
        />
      )}
      {meta.code === 'legacy_bot' && legacyRead?.config.issue && (
        <RiskWarningBanner
          severity={legacyRead.config.issue.kind === 'blocked' ? 'error' : 'warning'}
          title={legacyRead.config.issue.title}
          detail={legacyRead.config.issue.detail}
        />
      )}

      {meta.code === 'legacy_bot' && legacyLiveConfig && (legacyAccounts.length > 0 || hasLegacySnapshotRows || hasLegacySnapshotStages) && (
        <Card title="Provider runtime snapshot">
          <div className="wtc-grid wtc-grid-4">
            <MetricCard label="Runtime source" value="read-only snapshot" sub={pubIdSummary(legacyAccounts.length)} />
            <MetricCard label="Runtime symbols" value={legacySnapshotRows.length} sub="not your saved WTC draft" />
            <MetricCard label="Runtime stage capacity" value={legacySnapshotStageCapacity} sub={`${legacySnapshotStages.length} stages`} />
            <MetricCard label="Save behavior" value="copy not automatic" sub="editing starts from WTC reference/defaults" />
          </div>
          <p className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '12px 0 0' }}>
            This block is evidence from worker snapshots. The editable form below is intentionally based on your saved WTC reference version or built-in defaults so a provider runtime snapshot is not silently rewritten as your custom config.
          </p>
        </Card>
      )}

      {meta.code === 'legacy_bot' && legacyAccounts.length > 0 && (
        <Card title="Legacy provider accounts">
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr><th>pub_id</th><th>Market</th><th>Status</th><th>Balance</th><th>Symbols</th><th>Slots</th><th>Orders</th></tr>
              </thead>
              <tbody>
                {legacyAccounts.map((account) => (
                  <tr key={account.pubId}>
                    <td className="wtc-mono" data-label="pub_id">{shortPubId(account.pubId)}</td>
                    <td data-label="Market">{account.market}</td>
                    <td data-label="Status">
                      <StatusPill tone={account.quarantined ? 'bad' : account.running ? 'ok' : 'warn'}>
                        {account.quarantined ? 'quarantined' : account.running ? 'running' : 'paused'}
                      </StatusPill>
                    </td>
                    <td data-label="Balance">{fmtMoney(account.balance)}</td>
                    <td data-label="Symbols">{account.symbols}</td>
                    <td data-label="Slots">{account.activeSlots}</td>
                    <td data-label="Orders">{account.activeOrders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {meta.code === 'legacy_bot' && legacyAccounts.length === 0 && (
        <Card title="Legacy provider accounts">
          <EmptyState
            title="0 provider pub_id mapped"
            hint="Admin mapping is required before this user view can claim a specific provider account, runtime balance, or live slot count."
          />
        </Card>
      )}

      {meta.code === 'tortila_bot' && (
        <Card title="Private exchange connection">
          <ExchangeKeyReadinessPanel
            keys={exchangeKeys}
            emptyAction={<Link href={`/app/bots/${bot}/setup?step=key`} className={buttonClasses('primary')}>Add exchange key</Link>}
            bot={bot}
            checkAction={checkExchangeKeyMetadataAction}
            checkResult={checkResult}
          />
        </Card>
      )}

      <Card title="Reference profiles">
        <p className="wtc-muted" style={{ fontSize: 13, marginTop: 0 }}>
          One-click baselines. Applying a profile saves it as a new custom version you can then edit above.
        </p>
        <div className="wtc-grid wtc-grid-3">
          {presets.map((preset) => (
            <form key={preset.id} action={applyBotPresetAction} className="wtc-card wtc-stack" style={{ gap: 10 }}>
              <CsrfField />
              <input type="hidden" name="bot" value={bot} />
              <input type="hidden" name="presetId" value={preset.id} />
              <div className="wtc-spread">
                <h3 style={{ margin: 0, fontSize: 16 }}>{preset.name}</h3>
                <StatusPill tone={preset.mode === 'auto' ? 'ok' : 'neutral'}>{preset.mode}</StatusPill>
              </div>
              <p className="wtc-dim" style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>{preset.description}</p>
              <ul className="wtc-dim" style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
                {preset.summary.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <button className={buttonClasses(preset.mode === 'auto' ? 'primary' : 'secondary')} type="submit" disabled={!canCustomize}>Save as custom profile</button>
            </form>
          ))}
        </div>
      </Card>

      <Card title="Export current reference config">
        <div className="wtc-spread" style={{ flexWrap: 'wrap' }}>
          <p className="wtc-muted" style={{ margin: 0, maxWidth: 720 }}>
            Download the saved WTC reference settings in a bot-native format. This export contains no exchange keys and does not apply anything to a live bot.
          </p>
          {exportBlockedByProviderMapping ? (
            <button className={buttonClasses('ghost')} type="button" disabled title="Legacy export requires exactly one active mapped pub_id">
              Export requires mapped pub_id
            </button>
          ) : (
            <Link href={`/api/bots/${bot}/config-export`} className={buttonClasses('secondary')}>Download last saved reference export</Link>
          )}
        </div>
        {exportBlockedByProviderMapping && (
          <div style={{ marginTop: 12 }}>
            <RiskWarningBanner
              severity="warning"
              title="Legacy export needs exactly one mapped pub_id"
              detail={legacyExportBlockDetail}
            />
          </div>
        )}
      </Card>

      <Card title="Version history">
        {state.versions.length === 0 ? (
          <EmptyState title="No saved versions yet" hint="Each save appends an immutable, audited version here." />
        ) : (
          <table className="wtc-table">
            <thead><tr><th>Version</th><th>Saved</th><th>Note</th></tr></thead>
            <tbody>
              {state.versions.map((v) => (
                <tr key={v.version}>
                  <td className="wtc-mono">v{v.version}</td>
                  <td className="wtc-mono">{fmtDate(v.createdAt)}</td>
                  <td className="wtc-dim">{v.note ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Safety events">
        {state.safety.length === 0 ? (
          <EmptyState title="No safety events recorded" hint="Risk signals are surfaced here as warnings - never hidden behind a healthy card." />
        ) : (
          <table className="wtc-table">
            <thead><tr><th>Severity</th><th>Code</th><th>Detail</th><th>Observed</th></tr></thead>
            <tbody>
              {state.safety.map((e, i) => (
                <tr key={i}>
                  <td><StatusPill tone={sevTone(e.severity)}>{e.severity}</StatusPill></td>
                  <td className="wtc-mono">{e.code}</td>
                  <td className="wtc-dim">{e.description}</td>
                  <td className="wtc-mono">{fmtDate(e.observedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
