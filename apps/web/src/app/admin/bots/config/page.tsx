import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { getServerDb } from '@/lib/backend';
import { CsrfField } from '@/lib/csrf';
import { Card, EmptyState, MetricCard, RiskWarningBanner, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import { fmtDateTime } from '@/lib/format';
import { adminSaveBotGlobalConfigAction } from '@/features/admin/actions';
import { BOT_LIST, type BotMeta } from '@/features/bots/meta';
import {
  BOT_OPERATION_MODES,
  botConfigDefaultsFor,
  botConfigFieldsFor,
  botConfigPresetsFor,
  botConfigSchemaFor,
  legacyStageConfigsFromConfig,
  legacySymbolConfigsFromConfig,
  tortilaSymbolConfigsFromConfig,
} from '@/features/bots/config';
import { LegacyAveragingConfigTable } from '@/features/bots/LegacyAveragingConfigTable';
import { TortilaSymbolConfigTable } from '@/features/bots/TortilaSymbolConfigTable';
import { BotConfigReviewPanel } from '@/features/bots/BotConfigReviewPanel';
import { buildBotConfigReview } from '@/features/bots/config-review';
import {
  listBotGlobalConfigVersions,
  listBotGlobalConfigs,
  type BotGlobalConfigRow,
  type BotGlobalConfigVersionRow,
} from '@wtc/db';

function statusTone(status: string | null | undefined): Tone {
  if (status === 'published') return 'ok';
  if (status === 'archived') return 'neutral';
  return 'warn';
}

function safeEditableConfig(meta: BotMeta, current: BotGlobalConfigRow | null): { config: Record<string, unknown>; source: string; invalidCurrent: boolean } {
  const schema = botConfigSchemaFor(meta.code);
  const parsedCurrent = current ? schema.safeParse(current.config) : null;
  if (current && parsedCurrent?.success) {
    return { config: parsedCurrent.data as unknown as Record<string, unknown>, source: `System default v${current.version}`, invalidCurrent: false };
  }

  const fallbackPreset = botConfigPresetsFor(meta.code)[0]!;
  const parsedFallback = schema.safeParse(fallbackPreset.config);
  return {
    config: (parsedFallback.success ? parsedFallback.data : fallbackPreset.config) as unknown as Record<string, unknown>,
    source: fallbackPreset.name,
    invalidCurrent: !!current,
  };
}

function ProductDefaultsEditor({
  meta,
  current,
  versions,
  dbReady,
}: {
  meta: BotMeta;
  current: BotGlobalConfigRow | null;
  versions: BotGlobalConfigVersionRow[];
  dbReady: boolean;
}) {
  const { config, source, invalidCurrent } = safeEditableConfig(meta, current);
  const defaults = botConfigDefaultsFor(meta.code);
  const fields = botConfigFieldsFor(meta.code).filter((f) => meta.code !== 'tortila_bot' || f.name !== 'symbols');
  const presets = botConfigPresetsFor(meta.code);
  const modeValue = config.operationMode != null ? String(config.operationMode) : defaults.operationMode;
  const modeMeta = BOT_OPERATION_MODES.find((m) => m.value === modeValue) ?? BOT_OPERATION_MODES[0]!;
  const tortilaRows = meta.code === 'tortila_bot' ? tortilaSymbolConfigsFromConfig(config) : [];
  const legacyRows = meta.code === 'legacy_bot' ? legacySymbolConfigsFromConfig(config) : [];
  const legacyStages = meta.code === 'legacy_bot' ? legacyStageConfigsFromConfig(config) : [];
  const stageCapacity = legacyStages.reduce((sum, row) => sum + row.rsiSlots + row.cciSlots, 0);
  const configReview = buildBotConfigReview({
    productCode: meta.code,
    sourceLabel: source,
    config,
    tortilaRows,
    legacyRows,
    legacyStages,
    providerAccountCount: 0,
  });

  return (
    <Card title={`${meta.name} system default`}>
      <div className="wtc-stack" style={{ gap: 14 }}>
        <div className="wtc-grid wtc-grid-4">
          <MetricCard label="Current source" value={source} sub={current ? 'Postgres system profile' : 'built-in fallback'} />
          <MetricCard label="Published version" value={current ? `v${current.version}` : 'none'} sub={current ? fmtDateTime(current.updatedAt.getTime()) : 'Postgres row not created'} />
          <MetricCard label="User impact" value={current?.appliesToNewUsers ? 'new/no-custom users' : 'preview only'} sub="existing custom profiles stay unchanged" />
          <MetricCard label={meta.code === 'legacy_bot' ? 'Legacy scope' : 'Tortila scope'} value={meta.code === 'legacy_bot' ? `${legacyRows.length} coins` : `${tortilaRows.length} coins`} sub={meta.code === 'legacy_bot' ? `${legacyStages.length} stages / ${stageCapacity} slots` : modeMeta.label} />
        </div>

        {invalidCurrent && (
          <RiskWarningBanner
            severity="error"
            title="Stored system default failed validation"
            detail="The editor is showing the built-in fallback instead of the stored row. Save a corrected version before treating this product as configured."
          />
        )}

        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone={statusTone(current?.status)}>{current?.status ?? 'no system row'}</StatusPill>
          <StatusPill tone="neutral">scope: system defaults</StatusPill>
          <StatusPill tone="bad">LIVE CONTROL: DISABLED</StatusPill>
          <StatusPill tone="neutral">user settings unaffected</StatusPill>
          <StatusPill tone={current?.allowUserOverride === false ? 'warn' : 'ok'}>{current?.allowUserOverride === false ? 'override locked' : 'users may customize'}</StatusPill>
        </div>

        <p className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          Saving here changes only the WTC system reference profile. It does not edit existing user profiles, does not push runtime configuration, does not test exchange connectivity, and does not start or stop bots.
        </p>

        <BotConfigReviewPanel review={configReview} framed={false} title="Effective system default review" />

        <details>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Built-in baselines available to copy</summary>
          <div className="wtc-table-wrap" style={{ marginTop: 10 }}>
            <table className="wtc-table">
              <thead><tr><th>Profile</th><th>Mode</th><th>Summary</th></tr></thead>
              <tbody>
                {presets.map((preset) => (
                  <tr key={preset.id}>
                    <td data-label="Profile">{preset.name}</td>
                    <td data-label="Mode"><StatusPill tone={preset.mode === 'auto' ? 'ok' : 'neutral'}>{preset.mode}</StatusPill></td>
                    <td data-label="Summary" className="wtc-dim">{preset.summary.join(' / ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <form action={adminSaveBotGlobalConfigAction} className="wtc-stack" style={{ gap: 14 }}>
          <CsrfField />
          <input type="hidden" name="productCode" value={meta.code} />
          <input type="hidden" name="profileCode" value="system_default" />
          <input type="hidden" name="expectedVersion" value={String(current?.version ?? 0)} />

          <div className="wtc-grid wtc-grid-4">
            <label className="wtc-stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 13 }}>Profile name</span>
              <input className="wtc-input" name="label" defaultValue={current?.label ?? `${meta.name} default`} />
            </label>
            <label className="wtc-stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 13 }}>Status</span>
              <select className="wtc-input" name="status" defaultValue={current?.status ?? 'published'}>
                <option value="published">Published system default</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="wtc-stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 13 }}>New/no-custom users</span>
              <select className="wtc-input" name="appliesToNewUsers" defaultValue={String(current?.appliesToNewUsers ?? true)}>
                <option value="true">Use this default</option>
                <option value="false">Do not inherit yet</option>
              </select>
            </label>
            <label className="wtc-stack" style={{ gap: 4 }}>
              <span style={{ fontSize: 13 }}>User override</span>
              <select className="wtc-input" name="allowUserOverride" defaultValue={String(current?.allowUserOverride ?? true)}>
                <option value="true">Users may customize</option>
                <option value="false">Locked for future review</option>
              </select>
            </label>
          </div>

          <label className="wtc-stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 13 }}>Strategy mode</span>
            <select className="wtc-input" name="operationMode" defaultValue={modeValue}>
              {BOT_OPERATION_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <span className="wtc-dim" style={{ fontSize: 11 }}>{modeMeta.hint}</span>
          </label>

          {meta.code === 'tortila_bot' && (
            <TortilaSymbolConfigTable
              rows={tortilaRows}
              sourceLabel="System default editor"
              sourceDetail="These per-coin settings become the inherited WTC reference only after the profile is saved."
            />
          )}
          {meta.code === 'legacy_bot' && (
            <LegacyAveragingConfigTable
              rows={legacyRows}
              stages={legacyStages}
              providerAccountCount={0}
              sourceLabel="System default editor"
              sourceDetail="Legacy defaults are generic strategy rows. Provider pub_id mappings stay user/admin mapping data, not a system default."
            />
          )}

          <div className="wtc-grid wtc-grid-2">
            {fields.map((field) => (
              <label key={field.name} className="wtc-stack" style={{ gap: 4 }}>
                <span style={{ fontSize: 13 }}>{field.label}</span>
                {field.type === 'select' ? (
                  <select className="wtc-input" name={field.name} defaultValue={config[field.name] != null ? String(config[field.name]) : defaults[field.name]}>
                    {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input
                    className="wtc-input"
                    name={field.name}
                    type={field.type}
                    step={field.step}
                    placeholder={field.placeholder}
                    defaultValue={config[field.name] != null ? String(config[field.name]) : defaults[field.name]}
                  />
                )}
                <span className="wtc-dim" style={{ fontSize: 11 }}>{field.hint}</span>
              </label>
            ))}
          </div>

          <label className="wtc-stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 13 }}>Admin reason</span>
            <textarea
              className="wtc-input"
              name="reason"
              rows={3}
              placeholder="Describe why this system default is being saved."
              defaultValue={current ? `Update ${meta.name} system default after review.` : `Create ${meta.name} system default after review.`}
            />
            <span className="wtc-dim" style={{ fontSize: 11 }}>Minimum 10 characters. Stored in audit metadata; raw strategy JSON is not stored in audit rows.</span>
          </label>

          <div className="wtc-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button className={buttonClasses(dbReady ? 'primary' : 'ghost')} type="submit" disabled={!dbReady}>
              Save system default version
            </button>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              {dbReady ? 'Writes bot_global_configs, appends version history, and audits metadata only.' : 'Postgres is required to save system defaults.'}
            </span>
          </div>
        </form>

        <div>
          <h3 style={{ margin: '4px 0 10px', fontSize: 16 }}>Version history</h3>
          {versions.length === 0 ? (
            <EmptyState title="No system-default versions yet" hint="Each successful save appends immutable version history here." />
          ) : (
            <div className="wtc-table-wrap">
              <table className="wtc-table">
                <thead><tr><th>Version</th><th>Status</th><th>Reason</th><th>Saved</th></tr></thead>
                <tbody>
                  {versions.map((version) => (
                    <tr key={version.id}>
                      <td className="wtc-mono" data-label="Version">v{version.version}</td>
                      <td data-label="Status"><StatusPill tone={statusTone(version.status)}>{version.status}</StatusPill></td>
                      <td className="wtc-dim" data-label="Reason">{version.reason ?? '-'}</td>
                      <td className="wtc-mono" data-label="Saved" style={{ fontSize: 12 }}>{fmtDateTime(version.createdAt.getTime())}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default async function AdminBotConfigPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const db = getServerDb();
  const configs = db ? await listBotGlobalConfigs(db) : [];
  const versionsByConfigId = new Map<string, BotGlobalConfigVersionRow[]>();
  if (db) {
    const pairs = await Promise.all(configs.map(async (config) => [config.id, await listBotGlobalConfigVersions(db, config.id, 8)] as const));
    for (const [id, versions] of pairs) versionsByConfigId.set(id, versions);
  }
  const currentByProduct = new Map(configs.filter((config) => config.profileCode === 'system_default').map((config) => [config.productCode, config]));

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin - bot defaults"
        title="System bot defaults"
        copy="Admin-owned WTC reference profiles for Legacy and Tortila. These defaults define inheritance for new or no-custom users; they do not mutate user overrides or running bots."
      />

      <div className="wtc-row" style={{ marginTop: -4, flexWrap: 'wrap', gap: 8 }}>
        {db ? <StatusPill tone="ok">storage: Postgres</StatusPill> : <StatusPill tone="warn">storage: demo/read-only</StatusPill>}
        <StatusPill tone="neutral">scope: system defaults</StatusPill>
        <StatusPill tone="bad">LIVE CONTROL: DISABLED</StatusPill>
        <StatusPill tone="neutral">entitlements remain source of access</StatusPill>
        <StatusPill tone="neutral">user settings: unaffected</StatusPill>
      </div>

      {!db && (
        <RiskWarningBanner
          severity="warning"
          title="Postgres required to publish system defaults"
          detail="Built-in defaults are shown for review, but admin system defaults require durable DB storage, version history, and audit rows."
        />
      )}

      <Card title="Default ownership model">
        <div className="wtc-grid wtc-grid-4">
          <MetricCard label="Layer 1" value="Built-in fallback" sub="code-shipped baseline when no system row exists" />
          <MetricCard label="Layer 2" value="System default" sub="admin-owned, versioned, audited" />
          <MetricCard label="Layer 3" value="User override" sub="user-owned bot_configs versions" />
          <MetricCard label="Runtime" value="read-only snapshots" sub="not a config source" />
        </div>
      </Card>

      {BOT_LIST.map((meta) => {
        const current = currentByProduct.get(meta.code) ?? null;
        return (
          <ProductDefaultsEditor
            key={meta.code}
            meta={meta}
            current={current}
            versions={current ? versionsByConfigId.get(current.id) ?? [] : []}
            dbReady={!!db}
          />
        );
      })}
    </div>
  );
}
