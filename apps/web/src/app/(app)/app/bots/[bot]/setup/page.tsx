import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { addExchangeKey, listExchangeKeys, recordExchangeKeyMetadataCheck } from '@/lib/backend';
import { exchangeKeyInputSchema, exchangeKeyMetadataCheckSchema } from '@wtc/shared';
import { BOT_CAPS, botMeta, type BotProductCode } from '@/features/bots/meta';
import {
  handleApplyBotPresetAction,
  handleSaveBotConfigAction,
  handleUseSystemDefaultBotConfigAction,
  type BotConfigActionDependencies,
  type BotConfigActionOutcome,
  type BotConfigActionRoutes,
  type BotConfigParseResult,
} from '@/features/bots/config-action-handler';
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
  legacyStageConfigsFromConfig,
  legacySymbolConfigsFromConfig,
  loadBotConfig,
  persistBotConfig,
  selectSystemDefaultBotConfig,
  tortilaSymbolConfigsFromConfig,
} from '@/features/bots/config';
import { TortilaSymbolConfigTable } from '@/features/bots/TortilaSymbolConfigTable';
import { LegacyAveragingConfigTable } from '@/features/bots/LegacyAveragingConfigTable';
import { ExchangeKeyReadinessPanel } from '@/features/bots/ExchangeKeyReadiness';
import { BotReadinessMap } from '@/features/bots/BotReadinessMap';
import { loadBotReadinessForUser } from '@/features/bots/readiness-loader';
import { BotConfigReviewPanel } from '@/features/bots/BotConfigReviewPanel';
import { BotOperationMapPanel } from '@/features/bots/BotOperationMapPanel';
import { BotSetupControlCenter } from '@/features/bots/BotSetupControlCenter';
import { BotContinuityPanel } from '@/features/bots/BotContinuityPanel';
import { uncheckedBotContinuityHealth } from '@/features/bots/continuity';
import { buildBotConfigReview, firstLegacyStageCapacityIssue } from '@/features/bots/config-review';
import { botConfigErrorCopy, botConfigErrorRedirect } from '@/features/bots/config-error-copy';
import { Card, SectionHeader, StatusPill, RiskWarningBanner, EmptyState, MetricCard, buttonClasses } from '@wtc/ui';
import { loadBotReadModelForUser } from '@/features/bots/data';

export const dynamic = 'force-dynamic';

const STEPS = [
  { id: 'key', label: 'Exchange key' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'review', label: 'Review' },
] as const;
type StepId = (typeof STEPS)[number]['id'];
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

function isStep(s: string | undefined): s is StepId {
  return s === 'key' || s === 'strategy' || s === 'review';
}

function keyCheckResult(value: string | undefined): KeyCheckResult | undefined {
  return value === 'vault-present' || value === 'missing' || value === 'invalid' ? value : undefined;
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
  persistConfig: (userId, productCode, config, note, _accountId) => persistBotConfig(userId, productCode, config, note, undefined),
  selectSystemDefault: (userId, productCode, _accountId) => selectSystemDefaultBotConfig(userId, productCode, undefined),
};

function setupActionRoutes(bot: string): BotConfigActionRoutes {
  return {
    configError: `/app/bots/${bot}/setup?step=strategy&err=config`,
    configErrorFor: (error) => botConfigErrorRedirect(`/app/bots/${bot}/setup?step=strategy&err=config`, error),
    lockedError: `/app/bots/${bot}/setup?step=strategy&err=locked`,
    systemDefaultError: `/app/bots/${bot}/setup?step=strategy&err=system-default`,
    successRedirect: `/app/bots/${bot}/setup?step=review`,
    invalidPreset: 'config-error',
  };
}

function finishBotConfigActionOutcome(outcome: BotConfigActionOutcome): void {
  if (outcome.redirectTo) redirect(outcome.redirectTo);
}

async function wizardAddKey(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const bot = String(formData.get('bot') ?? '');
  const meta = botMeta(bot);
  if (!meta) return;
  if (BOT_CAPS[meta.code].liveAdapterBlocked || meta.code === 'legacy_bot') redirect(`/app/bots/${bot}/setup?step=strategy`);
  const access = await botAccessForUser(user, meta.code);
  if (!access.allowed) return;
  const parsed = exchangeKeyInputSchema.safeParse({
    exchange: formData.get('exchange'),
    label: formData.get('label'),
    apiKey: formData.get('apiKey'),
    apiSecret: formData.get('apiSecret'),
    mode: formData.get('mode'),
  });
  if (!parsed.success) redirect(`/app/bots/${bot}/setup?step=key&err=key`);
  await addExchangeKey(user.id, parsed.data);
  redirect(`/app/bots/${bot}/setup?step=strategy`);
}

async function wizardCheckExchangeKeyMetadata(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const parsed = exchangeKeyMetadataCheckSchema.safeParse({
    bot: formData.get('bot'),
    exchangeAccountId: formData.get('exchangeAccountId'),
  });
  const bot = parsed.success ? parsed.data.bot : String(formData.get('bot') ?? 'tortila');
  if (!parsed.success) redirect(`/app/bots/${bot}/setup?step=key&keyCheck=invalid`);
  const meta = botMeta(parsed.data.bot);
  if (!meta || meta.code !== 'tortila_bot') redirect(`/app/bots/${parsed.data.bot}/setup?step=key&keyCheck=invalid`);
  const access = await botAccessForUser(user, meta.code);
  if (!access.allowed) return;
  const result = await recordExchangeKeyMetadataCheck(user.id, parsed.data.exchangeAccountId);
  redirect(`/app/bots/${parsed.data.bot}/setup?step=key&keyCheck=${result.outcome === 'vault_present' ? 'vault-present' : 'missing'}`);
}

async function wizardSaveConfig(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const bot = String(formData.get('bot') ?? '');
  const outcome = await handleSaveBotConfigAction(formData, setupActionRoutes(bot), botConfigActionDependencies, 'wizard manual edit');
  finishBotConfigActionOutcome(outcome);
}

async function wizardApplyPreset(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const bot = String(formData.get('bot') ?? '');
  const outcome = await handleApplyBotPresetAction(formData, setupActionRoutes(bot), botConfigActionDependencies);
  finishBotConfigActionOutcome(outcome);
}

async function wizardUseSystemDefault(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const bot = String(formData.get('bot') ?? '');
  const outcome = await handleUseSystemDefaultBotConfigAction(formData, setupActionRoutes(bot), botConfigActionDependencies);
  finishBotConfigActionOutcome(outcome);
}

export default async function BotSetupWizard({
  params,
  searchParams,
}: {
  params: Promise<{ bot: string }>;
  searchParams: Promise<{ step?: string; err?: string; keyCheck?: string; issue?: string; row?: string }>;
}) {
  const { bot } = await params;
  const sp = await searchParams;
  const meta = botMeta(bot);
  if (!meta) notFound();
  const user = await requireUser();
  const access = await botAccessForUser(user, meta.code);

  if (!access.allowed) {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker={`${meta.name} - Setup`} title="Access required" />
        <RiskWarningBanner
          severity="warning"
          title={`Access ${reasonLabel(access.reason)}`}
          detail="Your entitlement does not currently grant access to set up this bot. Activate or renew in billing."
        />
        <Link href="/app/billing" className={buttonClasses('primary')}>Go to billing</Link>
      </div>
    );
  }

  const caps = BOT_CAPS[meta.code];
  const exchangeKeySetupDisabled = caps.liveAdapterBlocked || meta.code === 'legacy_bot';
  const step: StepId = isStep(sp.step) ? sp.step : exchangeKeySetupDisabled ? 'strategy' : 'key';
  const checkResult = keyCheckResult(sp.keyCheck);
  const [keys, cfg, legacyRead, readiness] = await Promise.all([
    exchangeKeySetupDisabled ? Promise.resolve([]) : listExchangeKeys(user.id),
    loadBotConfig(user.id, meta.code),
    meta.code === 'legacy_bot' ? loadBotReadModelForUser(user.id, meta.code, ['config']) : Promise.resolve(null),
    loadBotReadinessForUser(user, meta.code, 'setup-review', { includeOperationalRows: false }),
  ]);
  const legacyLiveConfig =
    meta.code === 'legacy_bot' && legacyRead?.config.data?.raw && typeof legacyRead.config.data.raw === 'object'
      ? legacyRead.config.data.raw as Record<string, unknown>
      : null;
  const hasKeys = keys.length > 0;
  const hasConfig = cfg.source !== 'built_in';
  const cur = cfg.current ?? {};
  const defaults = botConfigDefaultsFor(meta.code);
  const fields = botConfigFieldsFor(meta.code).filter((f) => meta.code !== 'tortila_bot' || !TORTILA_EMBEDDED_FIELD_NAMES.has(f.name));
  const presets = botConfigPresetsFor(meta.code);
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
  const legacyStageCapacityIssue = meta.code === 'legacy_bot' ? firstLegacyStageCapacityIssue(legacyRows, legacyStages) : undefined;
  const sourceLabel = cfg.sourceLabel;
  const sourceDetail = cfg.sourceDetail;
  const hasSystemDefault = cfg.systemDefault !== null;
  const canCustomize = cfg.systemDefault?.allowUserOverride !== false;
  const legacyAccountsCount = meta.code === 'legacy_bot' ? readiness.providerAccountCount : 0;
  const configReview = buildBotConfigReview({
    productCode: meta.code,
    sourceLabel,
    config: cur,
    tortilaRows,
    legacyRows,
    legacyStages,
    providerAccountCount: legacyAccountsCount,
  });
  const configError = botConfigErrorCopy(meta.code, sp);
  const setupReadiness = readiness.items;
  const setupContinuityHealth = legacyRead?.health ?? uncheckedBotContinuityHealth(
    meta.code,
    'Runtime proof is not checked on the setup wizard render. Finish setup, then open the dashboard or safety tab for worker-backed continuity proof.',
  );
  const setupContinuityRows = configReview.metrics.length + (meta.code === 'legacy_bot' ? legacyAccountsCount : keys.length);
  const setupConnectionLabel = meta.code === 'legacy_bot'
    ? pubIdSummary(readiness.providerAccountCount)
    : keys.length === 1 ? '1 encrypted key row' : `${keys.length} encrypted key rows`;

  return (
    <div className="wtc-stack">
      <div className="wtc-spread" style={{ flexWrap: 'wrap' }}>
        <SectionHeader kicker={`${meta.name} - Setup`} title="Guided onboarding" />
        <Link href={`/app/bots/${bot}`} className={buttonClasses('ghost')}>Skip to dashboard</Link>
      </div>

      {cfg.mode === 'demo' && (
        <div className="wtc-row">
          <StatusPill tone="warn">demo data</StatusPill>
          <span className="wtc-dim" style={{ fontSize: 12 }}>Demo mode - changes are not persisted. Set DATABASE_URL to store keys + config.</span>
        </div>
      )}

      <nav className="wtc-wizard-steps" aria-label="Setup steps">
        {STEPS.map((s, i) => {
          const done = s.id === 'key' ? (exchangeKeySetupDisabled ? true : hasKeys) : s.id === 'strategy' ? hasConfig : exchangeKeySetupDisabled ? hasConfig : hasKeys && hasConfig;
          const active = s.id === step;
          const locked = s.id === 'review' && (exchangeKeySetupDisabled ? !hasConfig : !hasKeys || !hasConfig);
          const cls = ['wtc-step', active ? 'active' : '', done && !active ? 'done' : '', locked ? 'locked' : ''].filter(Boolean).join(' ');
          const inner = (
            <>
              <span className="wtc-step-circle">{done && !active ? 'OK' : i + 1}</span>
              <span className="wtc-step-label">{s.label}</span>
            </>
          );
          return locked ? (
            <span key={s.id} className={cls} aria-disabled>{inner}</span>
          ) : (
            <Link key={s.id} href={`/app/bots/${bot}/setup?step=${s.id}`} className={cls} aria-current={active ? 'step' : undefined}>{inner}</Link>
          );
        })}
      </nav>

      <BotSetupControlCenter
        productCode={meta.code}
        bot={bot}
        mode="setup"
        sourceLabel={sourceLabel}
        source={cfg.source}
        canCustomize={canCustomize}
        hasSystemDefault={hasSystemDefault}
        configMetrics={configReview.metrics}
        exchangeKeyState={readiness.exchangeKeyState}
        exchangeKeyCount={keys.length}
        legacyProviderState={readiness.providerPubIdState}
        providerAccountCount={legacyAccountsCount}
        hasConfig={hasConfig}
        activeIssue={configError ?? undefined}
        legacyStageCapacityIssue={legacyStageCapacityIssue}
      />

      <BotContinuityPanel
        productCode={meta.code}
        adapterMode={legacyRead?.adapterMode ?? 'real'}
        health={setupContinuityHealth}
        dataRows={setupContinuityRows}
        dataRowsLabel="setup evidence rows"
        dataRowsDetail="Setup evidence rows are WTC-side config review facts plus safe key/pub_id counts. The wizard does not start the bot or run runtime connection checks."
        configSourceLabel={sourceLabel}
        connectionLabel={setupConnectionLabel}
        title="Setup continuity monitor"
      />

      {caps.liveAdapterBlocked ? (
        <RiskWarningBanner
          severity="error"
          title="Legacy HTTP setup blocked"
          detail="The old direct HTTP/control path stays blocked. Use the worker DB live-read path to view current Legacy settings and save WTC reference versions."
        />
      ) : meta.code === 'legacy_bot' ? (
        <RiskWarningBanner
          severity="info"
          title={legacyLiveConfig ? 'Connected through existing Legacy pub_id' : 'Provider mapping pending - WTC reference only'}
          detail={legacyLiveConfig ? 'Current Legacy runtime evidence is loaded by pub_id through WTC worker snapshots. WTC does not collect new exchange keys for this bot.' : 'Legacy onboarding can save WTC-side reference versions now, but runtime evidence stays pending until an admin maps exactly one active provider pub_id.'}
        />
      ) : (
        <RiskWarningBanner
          severity="info"
          title="Stored in WTC only - never sent to the live bot"
          detail="Exchange keys are encrypted at rest; strategy config is versioned and audited. Applying config to a running bot and start/stop stay disabled until a separately audited control adapter is approved."
        />
      )}

      <Card title="Setup source">
        <div className="wtc-grid wtc-grid-3">
          <MetricCard label="Resolved source" value={sourceLabel} sub={cfg.mode === 'postgres' ? 'Postgres-backed' : 'demo/session-backed'} />
          <MetricCard
            label={meta.code === 'legacy_bot' ? 'Provider mapping' : 'Exchange keys'}
            value={meta.code === 'legacy_bot' ? legacyAccountsCount : keys.length}
            sub={meta.code === 'legacy_bot' ? pubIdSummary(legacyAccountsCount) : 'encrypted save only; live ping disabled'}
          />
          <MetricCard label="Finish requirement" value={hasConfig ? sourceLabel : 'Save custom settings first'} sub="no live apply/start/stop" />
        </div>
        <p className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '12px 0 0' }}>
          {sourceDetail}
        </p>
        {cfg.sourceIssue && (
          <div style={{ marginTop: 12 }}>
            <RiskWarningBanner
              severity={cfg.sourceIssue.kind}
              title={cfg.sourceIssue.title}
              detail={cfg.sourceIssue.detail}
            />
          </div>
        )}
        {sp.err === 'locked' && (
          <div style={{ marginTop: 12 }}>
            <RiskWarningBanner
              severity="error"
              title="Customization is locked"
              detail="The current WTC system default does not allow user overrides. Use the inherited default until WTC reopens customization."
            />
          </div>
        )}
        {sp.err === 'system-default' && (
          <div style={{ marginTop: 12 }}>
            <RiskWarningBanner
              severity="error"
              title="System default is unavailable"
              detail="No published system default is available for this bot yet, so WTC keeps showing the built-in fallback or your custom profile."
            />
          </div>
        )}
        {meta.code === 'legacy_bot' && legacyRead?.config.issue && (
          <div style={{ marginTop: 12 }}>
            <RiskWarningBanner
              severity={legacyRead.config.issue.kind === 'blocked' ? 'error' : 'warning'}
              title={legacyRead.config.issue.title}
              detail={legacyRead.config.issue.detail}
            />
          </div>
        )}
      </Card>

      <BotConfigReviewPanel review={configReview} title="Current setup settings review" />

      <BotOperationMapPanel
        productCode={meta.code}
        sourceLabel={sourceLabel}
        configMetrics={configReview.metrics}
        runtimeSummary={meta.code === 'legacy_bot' ? pubIdSummary(legacyAccountsCount) : `${keys.length} encrypted key metadata record${keys.length === 1 ? '' : 's'}`}
        statisticsSummary={meta.code === 'legacy_bot' ? 'wallet balance, slots, orders, positions, and trades after scoped snapshots exist' : 'journal-backed equity, trades, positions, warnings, and risk panels'}
        settingsHref={`/app/bots/${bot}/settings`}
        statisticsHref={`/app/bots/statistics?bot=${bot}`}
        dashboardHref={`/app/bots/${bot}`}
        title="Setup operation map"
      />

      {step === 'key' && (
        <Card title="Step 1 - Add an exchange API key">
          {exchangeKeySetupDisabled ? (
            <>
              <RiskWarningBanner
                severity={caps.liveAdapterBlocked ? 'error' : 'info'}
                title={caps.liveAdapterBlocked ? 'Exchange-key collection disabled for this bot' : 'Exchange-key step is not used for Legacy'}
                detail={caps.liveAdapterBlocked ? 'The Legacy HTTP/control setup path is blocked. You can still configure symbols, manual/auto mode, averaging, TP, slots, and leverage as a WTC-side reference.' : 'The Legacy bot already owns its provider-side API accounts. WTC reads by pub_id through worker snapshots and does not ask for new exchange keys here.'}
              />
              <Link href={`/app/bots/${bot}/setup?step=strategy`} className={buttonClasses('primary')}>Configure reference settings</Link>
            </>
          ) : (
            <>
              {sp.err === 'key' && <RiskWarningBanner severity="error" title="Check your inputs" detail="The key could not be saved - verify the fields and try again." />}
              <form action={wizardAddKey} className="wtc-grid wtc-grid-2">
                <CsrfField />
                <input type="hidden" name="bot" value={bot} />
                <div className="wtc-field"><label htmlFor="exchange">Exchange</label>
                  <select className="wtc-input" id="exchange" name="exchange" defaultValue="bingx"><option>bingx</option><option>binance</option><option>bybit</option><option>okx</option></select>
                </div>
                <div className="wtc-field"><label htmlFor="label">Label</label><input className="wtc-input" id="label" name="label" placeholder="Main account" required /></div>
                <div className="wtc-field"><label htmlFor="apiKey">API key</label><input className="wtc-input" id="apiKey" name="apiKey" type="password" required /></div>
                <div className="wtc-field"><label htmlFor="apiSecret">API secret</label><input className="wtc-input" id="apiSecret" name="apiSecret" type="password" required /></div>
                <div className="wtc-field"><label htmlFor="mode">Mode</label>
                  <select className="wtc-input" id="mode" name="mode" defaultValue="demo"><option value="demo">demo</option><option value="live">live</option></select>
                </div>
                <div style={{ display: 'flex', alignItems: 'end' }}><button className={buttonClasses('primary')} type="submit">Encrypt &amp; save key</button></div>
              </form>
              {hasKeys && (
                <div className="wtc-stack" style={{ gap: 12, marginTop: 14 }}>
                  <ExchangeKeyReadinessPanel keys={keys} bot={bot} checkAction={wizardCheckExchangeKeyMetadata} checkResult={checkResult} />
                  <p className="wtc-dim" style={{ fontSize: 12, margin: 0 }}>
                    {keys.length} key{keys.length === 1 ? '' : 's'} already saved. <Link className="wtc-link" href={`/app/bots/${bot}/setup?step=strategy`}>Continue</Link>
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {step === 'strategy' && (
        <div className="wtc-stack">
          <Card title="Settings source">
            <div className="wtc-grid wtc-grid-2">
              <section className="wtc-stack" style={{ gap: 10, border: '1px solid var(--stroke)', borderRadius: 8, padding: 14, background: 'rgba(255,255,255,0.025)' }}>
                <div className="wtc-spread" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{hasSystemDefault ? 'Use system default' : 'Built-in fallback'}</h3>
                  <StatusPill tone={cfg.source === 'system_default' ? 'ok' : cfg.source === 'built_in' ? 'warn' : 'neutral'}>
                    {cfg.source === 'system_default' ? 'active' : cfg.source === 'built_in' ? 'fallback active' : 'available'}
                  </StatusPill>
                </div>
                <p className="wtc-dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                  {hasSystemDefault
                    ? 'Inherit the latest published WTC system default for this bot. WTC may update this default; your custom versions stay in history but are not the active source while this is selected.'
                    : 'No system default is published yet. WTC is showing safe built-in defaults until an admin publishes a system default.'}
                </p>
                {cfg.systemDefault && (
                  <div className="wtc-card-row"><span className="k">Published default</span><span className="v">{cfg.systemDefault.label} v{cfg.systemDefault.version}</span></div>
                )}
                {hasSystemDefault && cfg.source !== 'system_default' && (
                  <form action={wizardUseSystemDefault}>
                    <CsrfField />
                    <input type="hidden" name="bot" value={bot} />
                    <button className={buttonClasses('secondary')} type="submit">Use system default</button>
                  </form>
                )}
              </section>
              <section className="wtc-stack" style={{ gap: 10, border: '1px solid var(--stroke)', borderRadius: 8, padding: 14, background: 'rgba(255,255,255,0.025)' }}>
                <div className="wtc-spread" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Customize my settings</h3>
                  <StatusPill tone={cfg.source === 'user_override' ? 'ok' : canCustomize ? 'neutral' : 'bad'}>
                    {cfg.source === 'user_override' ? 'active' : canCustomize ? 'ready' : 'locked'}
                  </StatusPill>
                </div>
                <p className="wtc-dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                  Create or continue a user-owned WTC config version. Start from the current resolved default, then save your own profile. It is not pushed to the live bot.
                </p>
                <div className="wtc-card-row"><span className="k">Custom history</span><span className="v">{cfg.versions.length} saved version{cfg.versions.length === 1 ? '' : 's'}</span></div>
                {canCustomize ? (
                  <a href="#wizard-custom-settings" className={buttonClasses(cfg.source === 'user_override' ? 'secondary' : 'primary')}>
                    {cfg.source === 'user_override' ? 'Continue editing custom settings' : 'Customize from this default'}
                  </a>
                ) : (
                  <button className={buttonClasses('ghost')} type="button" disabled title="Customization is locked for WTC review">
                    Customization locked
                  </button>
                )}
              </section>
            </div>
            <p className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.6, margin: '12px 0 0' }}>
              Tortila exchange keys stay separate from settings. Legacy provider pub_id mappings, balances, slots, orders, and runtime snapshots stay read-only evidence.
            </p>
          </Card>

          <Card title="Reference profiles">
            <p className="wtc-muted" style={{ fontSize: 13, marginTop: 0 }}>
              Pick a WTC reference profile for fast setup, or edit the manual fields below. Profiles only save user-owned WTC-side intent.
            </p>
            <div className="wtc-grid wtc-grid-3">
              {presets.map((preset) => (
                <form key={preset.id} action={wizardApplyPreset} className="wtc-card wtc-stack" style={{ gap: 10 }}>
                  <CsrfField />
                  <input type="hidden" name="bot" value={bot} />
                  <input type="hidden" name="presetId" value={preset.id} />
                  <div className="wtc-spread">
                    <h3 style={{ margin: 0, fontSize: 16 }}>{preset.name}</h3>
                    <StatusPill tone={preset.mode === 'auto' ? 'ok' : 'neutral'}>{preset.mode}</StatusPill>
                  </div>
                  <p className="wtc-dim" style={{ fontSize: 12, lineHeight: 1.6, margin: 0 }}>{preset.description}</p>
                  <button className={buttonClasses(preset.mode === 'auto' ? 'primary' : 'secondary')} type="submit" disabled={!canCustomize}>Save as custom profile</button>
                </form>
              ))}
            </div>
          </Card>

          <Card title="Step 2 - Strategy configuration">
            {configError && (
              <RiskWarningBanner
                severity="error"
                title={configError.title}
                detail={`${configError.detail} Active source remains ${sourceLabel}; this failed draft was not saved and was not applied to the live bot.`}
              />
            )}
            {!canCustomize && (
              <RiskWarningBanner
                severity="warning"
                title="Custom settings are locked"
                detail="You can inspect the resolved WTC default, but custom saves and reference profiles are disabled while this system default is locked."
              />
            )}
            <form id="wizard-custom-settings" action={wizardSaveConfig} className="wtc-stack" style={{ gap: 14 }}>
              <CsrfField />
              <input type="hidden" name="bot" value={bot} />
              <label className="wtc-stack" style={{ gap: 4 }}>
                <span style={{ fontSize: 13 }}>Operation mode</span>
                <select className="wtc-input" name="operationMode" defaultValue={cur.operationMode != null ? String(cur.operationMode) : defaults.operationMode}>
                  {BOT_OPERATION_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <span className="wtc-dim" style={{ fontSize: 11 }}>
                  WTC-side intent only. It is saved/versioned here and never applied to the live bot.
                </span>
              </label>
              {meta.code === 'tortila_bot' && (
                <TortilaSymbolConfigTable
                  rows={tortilaRows}
                  portfolioCaps={tortilaPortfolioCaps}
                  sourceLabel={sourceLabel}
                  sourceDetail="The wizard edits a WTC reference profile. Live exchange apply and connection testing stay disabled until the audited adapter exists."
                  saveIssue={configError ?? undefined}
                />
              )}
              {meta.code === 'legacy_bot' && (
                <LegacyAveragingConfigTable
                  rows={legacyRows}
                  stages={legacyStages}
                  providerAccountCount={legacyAccountsCount}
                  sourceLabel={sourceLabel}
                  sourceDetail={sourceDetail}
                  saveIssue={configError?.target === 'legacy-row' || configError?.target === 'legacy-stage' ? configError : undefined}
                />
              )}
              <div className="wtc-grid wtc-grid-2">
                {fields.map((f) => (
                  <label key={f.name} className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 13 }}>{f.label}</span>
                    {f.type === 'select' ? (
                      <select className="wtc-input" name={f.name} defaultValue={cur[f.name] != null ? String(cur[f.name]) : defaults[f.name]}>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input className="wtc-input" name={f.name} type={f.type} step={f.step} placeholder={f.placeholder} defaultValue={cur[f.name] != null ? String(cur[f.name]) : defaults[f.name]} />
                    )}
                    <span className="wtc-dim" style={{ fontSize: 11 }}>{f.hint}</span>
                  </label>
                ))}
              </div>
              <div className="wtc-row"><button className={buttonClasses('primary')} type="submit" disabled={!canCustomize}>Save custom settings</button></div>
            </form>
          </Card>
        </div>
      )}

      {step === 'review' && (
        <div className="wtc-stack">
          <BotReadinessMap
            title="Setup readiness map"
            copy="Review what is configured, what is only metadata or snapshot evidence, and which live actions remain disabled before opening the bot room."
            items={setupReadiness}
          />
          <Card title="Step 3 - Review & finish">
          {!exchangeKeySetupDisabled && !hasKeys ? (
            <EmptyState title="Add an exchange key first" hint="Step 1 is required before you can review your setup." />
          ) : !exchangeKeySetupDisabled && !hasConfig ? (
            <EmptyState title="Save strategy settings first" hint="Step 2 must save a system default or custom WTC-side strategy profile before dashboard review is available." />
          ) : exchangeKeySetupDisabled && !hasConfig ? (
            <EmptyState title="Save reference settings first" hint="Legacy exchange-key setup is skipped; this review is based on your WTC-side configuration version and worker live snapshots." />
          ) : (
            <div className="wtc-stack">
              <BotConfigReviewPanel review={configReview} framed={false} title="Settings to review" />
              <div className="wtc-card-row">
                <span className="k">Exchange keys</span>
                <span className="v">
                  {exchangeKeySetupDisabled
                    ? 'not collected by WTC - legacy uses provider pub_id'
                    : readiness.exchangeKeyState === 'vault_metadata_confirmed'
                      ? `${keys.length} saved; WTC vault metadata confirmed; live exchange ping not run`
                      : readiness.exchangeKeyState === 'metadata_saved'
                        ? `${keys.length} saved; WTC metadata saved; live exchange ping not run`
                        : 'WTC metadata missing; live exchange ping not run'}
                </span>
              </div>
              <div className="wtc-card-row"><span className="k">Strategy config</span><span className="v">{cfg.source === 'system_default' ? sourceLabel : cfg.version != null ? `custom v${cfg.version} saved` : 'not yet saved'}</span></div>
              <RiskWarningBanner severity="warning" title="Live control stays disabled" detail="Start/stop and applying config to a running bot are disabled by safety policy. Stop never closes positions." />
              <div className="wtc-row">
                <Link href={`/app/bots/${bot}`} className={buttonClasses('primary')}>Open the dashboard</Link>
                <Link href={`/app/bots/${bot}/settings`} className={buttonClasses('ghost')}>Edit configuration</Link>
              </div>
            </div>
          )}
          </Card>
        </div>
      )}
    </div>
  );
}
