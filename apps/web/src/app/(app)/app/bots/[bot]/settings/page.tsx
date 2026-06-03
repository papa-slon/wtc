import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { botAccessForUser } from '@/lib/access';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses, MetricCard } from '@wtc/ui';
import { fmtDate, fmtMoney } from '@/lib/format';
import { loadBot, BotAccessRequired, loadBotReadModel } from '@/features/bots/data';
import { BotSubNav } from '@/components/BotSubNav';
import { botMeta } from '@/features/bots/meta';
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

async function saveBotConfigAction(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const slug = String(formData.get('bot') ?? '');
  const meta = botMeta(slug);
  if (!meta) return;
  const access = await botAccessForUser(user, meta.code);
  if (!access.allowed) return;
  const parsed = botConfigSchemaFor(meta.code).safeParse(botConfigFormInput(meta.code, formData));
  if (!parsed.success) return;
  await persistBotConfig(user.id, meta.code, parsed.data as unknown as Record<string, unknown>, 'manual edit');
  revalidatePath(`/app/bots/${slug}/settings`);
}

async function applyBotPresetAction(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const slug = String(formData.get('bot') ?? '');
  const presetId = String(formData.get('presetId') ?? '');
  const meta = botMeta(slug);
  if (!meta) return;
  const access = await botAccessForUser(user, meta.code);
  if (!access.allowed) return;
  const preset = botConfigPresetFor(meta.code, presetId);
  if (!preset) return;
  const parsed = botConfigSchemaFor(meta.code).safeParse(preset.config);
  if (!parsed.success) return;
  await persistBotConfig(user.id, meta.code, parsed.data as unknown as Record<string, unknown>, `preset:${preset.id}`);
  revalidatePath(`/app/bots/${slug}/settings`);
}

export default async function Page({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const { meta, access } = await loadBot(bot);
  if (!access.allowed) return <BotAccessRequired meta={meta} section="Settings" />;

  const user = await requireUser();
  const [state, legacyRead] = await Promise.all([
    loadBotConfig(user.id, meta.code),
    meta.code === 'legacy_bot' ? loadBotReadModel(meta.code, ['config']) : Promise.resolve(null),
  ]);
  const legacyLiveConfig =
    meta.code === 'legacy_bot' && legacyRead?.config.data?.raw && typeof legacyRead.config.data.raw === 'object'
      ? legacyRead.config.data.raw as Record<string, unknown>
      : null;
  const cur = legacyLiveConfig ?? state.current ?? {};
  const fields = botConfigFieldsFor(meta.code).filter((f) => meta.code !== 'tortila_bot' || f.name !== 'symbols');
  const defaults = botConfigDefaultsFor(meta.code);
  const presets = botConfigPresetsFor(meta.code);
  const sevTone = (s: string) => (s === 'critical' ? 'bad' : 'warn');
  const currentMode = cur.operationMode != null ? String(cur.operationMode) : defaults.operationMode;
  const tortilaRows = meta.code === 'tortila_bot' ? tortilaSymbolConfigsFromConfig(cur) : [];
  const legacyRows = meta.code === 'legacy_bot' ? legacySymbolConfigsFromConfig(cur) : [];
  const legacyStages = meta.code === 'legacy_bot' ? legacyStageConfigsFromConfig(cur) : [];
  const legacyAccounts = meta.code === 'legacy_bot' ? legacyProviderAccounts(legacyLiveConfig) : [];
  const modeMeta = BOT_OPERATION_MODES.find((m) => m.value === currentMode) ?? BOT_OPERATION_MODES[0]!;

  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader kicker={`${meta.name} - Settings`} title="Configuration" />
        {state.version != null ? <StatusPill tone="ok">v{state.version}</StatusPill> : <StatusPill tone="warn">unconfigured</StatusPill>}
      </div>
      <BotSubNav bot={bot} active="settings" />

      <div className="wtc-row" style={{ marginTop: -4 }}>
        {state.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (dev)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>Demo mode - saves are not persisted. Set DATABASE_URL to store config + version history in Postgres.</span>
          </>
        )}
      </div>

      <div className="wtc-grid wtc-grid-3">
        <MetricCard label="Strategy mode" value={modeMeta.label} sub={modeMeta.hint} tone={currentMode === 'auto' ? 'up' : undefined} />
        <MetricCard label="Config version" value={state.version != null ? `v${state.version}` : 'Not saved'} sub={state.mode === 'postgres' ? 'Postgres' : 'in-memory demo'} />
        <MetricCard
          label={meta.code === 'legacy_bot' ? 'Provider pub_id' : 'Reference profiles'}
          value={meta.code === 'legacy_bot' ? legacyAccounts.length || 'Not linked' : presets.length}
          sub={meta.code === 'legacy_bot' ? `${legacyRows.length} symbol rows` : 'one-click baselines'}
        />
      </div>

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

      <Card title="Export current reference config">
        <div className="wtc-spread" style={{ flexWrap: 'wrap' }}>
          <p className="wtc-muted" style={{ margin: 0, maxWidth: 720 }}>
            Download the saved WTC reference settings in a bot-native format. This export contains no exchange keys and does not apply anything to a live bot.
          </p>
          <Link href={`/api/bots/${bot}/config-export`} className={buttonClasses('secondary')}>Download config export</Link>
        </div>
      </Card>

      <Card title="Reference profiles">
        <p className="wtc-muted" style={{ fontSize: 13, marginTop: 0 }}>
          Use these to switch quickly between manual review and automatic reference intent. Applying a profile only saves a WTC-side config version; it does not touch a live bot.
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
              <button className={buttonClasses(preset.mode === 'auto' ? 'primary' : 'secondary')} type="submit">Apply profile</button>
            </form>
          ))}
        </div>
      </Card>

      <Card title={`${meta.name} configuration`}>
        <form action={saveBotConfigAction} className="wtc-stack" style={{ gap: 14 }}>
          <CsrfField />
          <input type="hidden" name="bot" value={bot} />
          <label className="wtc-stack" style={{ gap: 4 }}>
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
          <div className="wtc-row">
            <button className={buttonClasses('primary')} type="submit">Save configuration</button>
            <span className="wtc-dim" style={{ fontSize: 12 }}>Saving appends a versioned strategy profile.</span>
          </div>
        </form>
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
