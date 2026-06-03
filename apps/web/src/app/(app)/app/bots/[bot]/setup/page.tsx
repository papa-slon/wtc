import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { addExchangeKey, listExchangeKeys } from '@/lib/backend';
import { exchangeKeyInputSchema } from '@wtc/shared';
import { BOT_CAPS, botMeta } from '@/features/bots/meta';
import {
  BOT_OPERATION_MODES,
  botConfigDefaultsFor,
  botConfigFieldsFor,
  botConfigFormInput,
  botConfigPresetFor,
  botConfigPresetsFor,
  botConfigSchemaFor,
  legacyStageConfigsFromConfig,
  legacySymbolConfigsFromConfig,
  loadBotConfig,
  persistBotConfig,
  tortilaSymbolConfigsFromConfig,
} from '@/features/bots/config';
import { TortilaSymbolConfigTable } from '@/features/bots/TortilaSymbolConfigTable';
import { LegacyAveragingConfigTable } from '@/features/bots/LegacyAveragingConfigTable';
import { Card, SectionHeader, StatusPill, RiskWarningBanner, EmptyState, buttonClasses } from '@wtc/ui';
import { loadBotReadModel } from '@/features/bots/data';

export const dynamic = 'force-dynamic';

const STEPS = [
  { id: 'key', label: 'Exchange key' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'review', label: 'Review' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

function isStep(s: string | undefined): s is StepId {
  return s === 'key' || s === 'strategy' || s === 'review';
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

async function wizardSaveConfig(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const bot = String(formData.get('bot') ?? '');
  const meta = botMeta(bot);
  if (!meta) return;
  const access = await botAccessForUser(user, meta.code);
  if (!access.allowed) return;
  const parsed = botConfigSchemaFor(meta.code).safeParse(botConfigFormInput(meta.code, formData));
  if (!parsed.success) redirect(`/app/bots/${bot}/setup?step=strategy&err=config`);
  await persistBotConfig(user.id, meta.code, parsed.data as unknown as Record<string, unknown>, 'wizard manual edit');
  redirect(`/app/bots/${bot}/setup?step=review`);
}

async function wizardApplyPreset(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const bot = String(formData.get('bot') ?? '');
  const presetId = String(formData.get('presetId') ?? '');
  const meta = botMeta(bot);
  if (!meta) return;
  const access = await botAccessForUser(user, meta.code);
  if (!access.allowed) return;
  const preset = botConfigPresetFor(meta.code, presetId);
  if (!preset) redirect(`/app/bots/${bot}/setup?step=strategy&err=config`);
  const parsed = botConfigSchemaFor(meta.code).safeParse(preset.config);
  if (!parsed.success) redirect(`/app/bots/${bot}/setup?step=strategy&err=config`);
  await persistBotConfig(user.id, meta.code, parsed.data as unknown as Record<string, unknown>, `preset:${preset.id}`);
  redirect(`/app/bots/${bot}/setup?step=review`);
}

export default async function BotSetupWizard({
  params,
  searchParams,
}: {
  params: Promise<{ bot: string }>;
  searchParams: Promise<{ step?: string; err?: string }>;
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
  const [keys, cfg, legacyRead] = await Promise.all([
    exchangeKeySetupDisabled ? Promise.resolve([]) : listExchangeKeys(user.id),
    loadBotConfig(user.id, meta.code),
    meta.code === 'legacy_bot' ? loadBotReadModel(meta.code, ['config']) : Promise.resolve(null),
  ]);
  const legacyLiveConfig =
    meta.code === 'legacy_bot' && legacyRead?.config.data?.raw && typeof legacyRead.config.data.raw === 'object'
      ? legacyRead.config.data.raw as Record<string, unknown>
      : null;
  const hasKeys = keys.length > 0;
  const hasConfig = cfg.version != null || legacyLiveConfig != null;
  const cur = legacyLiveConfig ?? cfg.current ?? {};
  const fields = botConfigFieldsFor(meta.code).filter((f) => meta.code !== 'tortila_bot' || f.name !== 'symbols');
  const defaults = botConfigDefaultsFor(meta.code);
  const presets = botConfigPresetsFor(meta.code);
  const tortilaRows = meta.code === 'tortila_bot' ? tortilaSymbolConfigsFromConfig(cur) : [];
  const legacyRows = meta.code === 'legacy_bot' ? legacySymbolConfigsFromConfig(cur) : [];
  const legacyStages = meta.code === 'legacy_bot' ? legacyStageConfigsFromConfig(cur) : [];

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
          const locked = s.id === 'review' && (exchangeKeySetupDisabled ? !hasConfig : !hasKeys);
          const cls = ['wtc-step', active ? 'active' : '', done && !active ? 'done' : '', locked ? 'locked' : ''].filter(Boolean).join(' ');
          const inner = (
            <>
              <span className="wtc-step-circle">{done && !active ? '✓' : i + 1}</span>
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

      {caps.liveAdapterBlocked ? (
        <RiskWarningBanner
          severity="error"
          title="Legacy HTTP setup blocked"
          detail="The old direct HTTP/control path stays blocked. Use the worker DB live-read path to view current Legacy settings and save WTC reference versions."
        />
      ) : meta.code === 'legacy_bot' ? (
        <RiskWarningBanner
          severity="info"
          title="Connected through existing Legacy pub_id"
          detail={legacyLiveConfig ? 'Current Legacy settings are loaded from the provider runtime by pub_id through WTC worker snapshots. WTC does not collect new exchange keys for this bot.' : 'Legacy onboarding uses the existing bot runtime and WTC worker snapshots. WTC does not collect new exchange keys for this bot; strategy settings are saved as WTC-side reference versions.'}
        />
      ) : (
        <RiskWarningBanner
          severity="info"
          title="Stored in WTC only - never sent to the live bot"
          detail="Exchange keys are encrypted at rest; strategy config is versioned and audited. Applying config to a running bot and start/stop stay disabled until a separately audited control adapter is approved."
        />
      )}

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
                <p className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
                  {keys.length} key{keys.length === 1 ? '' : 's'} already saved. <Link className="wtc-link" href={`/app/bots/${bot}/setup?step=strategy`}>Continue</Link>
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {step === 'strategy' && (
        <div className="wtc-stack">
          <Card title="Reference profiles">
            <p className="wtc-muted" style={{ fontSize: 13, marginTop: 0 }}>
              Pick a WTC reference profile for fast setup, or edit the manual fields below. Profiles only save WTC-side intent.
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
                  <button className={buttonClasses(preset.mode === 'auto' ? 'primary' : 'secondary')} type="submit">Use this profile</button>
                </form>
              ))}
            </div>
          </Card>

          <Card title="Step 2 - Strategy configuration">
            {sp.err === 'config' && <RiskWarningBanner severity="error" title="Check your inputs" detail="The configuration is out of range - review the hints and try again." />}
            <form action={wizardSaveConfig} className="wtc-stack" style={{ gap: 14 }}>
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
              {meta.code === 'tortila_bot' && <TortilaSymbolConfigTable rows={tortilaRows} />}
              {meta.code === 'legacy_bot' && <LegacyAveragingConfigTable rows={legacyRows} stages={legacyStages} />}
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
              <div className="wtc-row"><button className={buttonClasses('primary')} type="submit">Save configuration</button></div>
            </form>
          </Card>
        </div>
      )}

      {step === 'review' && (
        <Card title="Step 3 - Review & finish">
          {!exchangeKeySetupDisabled && !hasKeys ? (
            <EmptyState title="Add an exchange key first" hint="Step 1 is required before you can review your setup." />
          ) : exchangeKeySetupDisabled && !hasConfig ? (
            <EmptyState title="Save reference settings first" hint="Legacy exchange-key setup is skipped; this review is based on your WTC-side configuration version and worker live snapshots." />
          ) : (
            <div className="wtc-stack">
              <div className="wtc-card-row">
                <span className="k">Exchange keys</span>
                <span className="v">{exchangeKeySetupDisabled ? 'not collected by WTC - legacy uses provider pub_id' : `${keys.length} saved (encrypted)`}</span>
              </div>
              <div className="wtc-card-row"><span className="k">Strategy config</span><span className="v">{cfg.version != null ? `v${cfg.version} saved` : legacyLiveConfig ? 'live snapshot loaded' : 'not yet saved'}</span></div>
              <RiskWarningBanner severity="warning" title="Live control stays disabled" detail="Start/stop and applying config to a running bot are disabled by safety policy. Stop never closes positions." />
              <div className="wtc-row">
                <Link href={`/app/bots/${bot}`} className={buttonClasses('primary')}>Open the dashboard</Link>
                <Link href={`/app/bots/${bot}/settings`} className={buttonClasses('ghost')}>Edit configuration</Link>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
