import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { botAccessForUser } from '@/lib/access';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses, MetricCard } from '@wtc/ui';
import { fmtDate } from '@/lib/format';
import { loadBot, BotAccessRequired } from '@/features/bots/data';
import { BotSubNav } from '@/components/BotSubNav';
import { BOT_CAPS, botMeta } from '@/features/bots/meta';
import {
  BOT_OPERATION_MODES,
  botConfigDefaultsFor,
  botConfigFieldsFor,
  botConfigFormInput,
  botConfigPresetFor,
  botConfigPresetsFor,
  botConfigSchemaFor,
  loadBotConfig,
  persistBotConfig,
  tortilaSymbolConfigsFromConfig,
} from '@/features/bots/config';
import { TortilaSymbolConfigTable } from '@/features/bots/TortilaSymbolConfigTable';

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

  const state = await loadBotConfig((await requireUser()).id, meta.code);
  const cur = state.current ?? {};
  const fields = botConfigFieldsFor(meta.code).filter((f) => meta.code !== 'tortila_bot' || f.name !== 'symbols');
  const defaults = botConfigDefaultsFor(meta.code);
  const presets = botConfigPresetsFor(meta.code);
  const caps = BOT_CAPS[meta.code];
  const sevTone = (s: string) => (s === 'critical' ? 'bad' : 'warn');
  const currentMode = cur.operationMode != null ? String(cur.operationMode) : defaults.operationMode;
  const tortilaRows = meta.code === 'tortila_bot' ? tortilaSymbolConfigsFromConfig(cur) : [];

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

      <RiskWarningBanner
        severity="info"
        title="Config is stored in WTC only - never sent to the live bot"
        detail="This form writes to the WTC database as a versioned, audited reference. Applying config to a running bot and start/stop remain disabled until a separately audited control adapter is approved."
      />
      {caps.liveAdapterBlocked && (
        <RiskWarningBanner
          severity="error"
          title="Live adapter blocked (B3)"
          detail="You can save a WTC-side reference config, but WTC will not request exchange keys or connect to the live Legacy Bot until the upstream plaintext-key issue is fixed."
        />
      )}

      <div className="wtc-grid wtc-grid-3">
        <MetricCard label="Mode" value={currentMode === 'auto' ? 'Automatic' : 'Manual'} sub="saved WTC intent" tone={currentMode === 'auto' ? 'up' : undefined} />
        <MetricCard label="Config version" value={state.version != null ? `v${state.version}` : 'Not saved'} sub={state.mode === 'postgres' ? 'Postgres' : 'in-memory demo'} />
        <MetricCard label="Reference profiles" value={presets.length} sub="one-click baselines" />
      </div>

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
            <span style={{ fontSize: 13 }}>Operation mode</span>
            <select className="wtc-input" name="operationMode" defaultValue={cur.operationMode != null ? String(cur.operationMode) : defaults.operationMode}>
              {BOT_OPERATION_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <span className="wtc-dim" style={{ fontSize: 11 }}>
              WTC-side intent only. This does not start, stop, or apply config to the live bot.
            </span>
          </label>
          {meta.code === 'tortila_bot' && <TortilaSymbolConfigTable rows={tortilaRows} />}
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
            <span className="wtc-dim" style={{ fontSize: 12 }}>Saving appends an immutable version; live application stays disabled.</span>
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
