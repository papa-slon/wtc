import Link from 'next/link';
import { Card, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import type { BotProductCode } from './meta';
import type { LegacyStageConfig, LegacySymbolConfig, TortilaSymbolConfig } from './config-types';

type BotConfigSource = 'user_override' | 'system_default' | 'built_in';

interface TortilaPortfolioCapsView {
  maxOpenSymbols?: string | number;
  maxTotalUnits?: string | number;
  maxUnitsPerDirection?: string | number;
}

interface QuickPathRow {
  layer: string;
  state: string;
  detail: string;
  tone: Tone;
  href?: string;
  actionLabel?: string;
  disabledActionLabel?: string;
}

export interface BotSettingsQuickPathProps {
  productCode: BotProductCode;
  bot: string;
  source: BotConfigSource;
  sourceLabel: string;
  canCustomize: boolean;
  hasSystemDefault: boolean;
  customVersionCount: number;
  tortilaRows: readonly TortilaSymbolConfig[];
  tortilaPortfolioCaps?: TortilaPortfolioCapsView;
  legacyRows: readonly LegacySymbolConfig[];
  legacyStages: readonly LegacyStageConfig[];
  exchangeKeyCount: number;
  legacyProviderAccountCount: number;
  exportBlockedByProviderMapping: boolean;
}

function valueLabel(value: string | number | undefined, fallback: string): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function sourceState(source: BotConfigSource, sourceLabel: string): { state: string; detail: string; tone: Tone } {
  if (source === 'user_override') {
    return {
      state: 'Custom profile active',
      detail: `${sourceLabel}; user-owned settings stay separate from admin system defaults.`,
      tone: 'ok',
    };
  }
  if (source === 'system_default') {
    return {
      state: 'System default active',
      detail: `${sourceLabel}; saving creates a personal version when overrides are open.`,
      tone: 'gold',
    };
  }
  return {
    state: 'Built-in fallback',
    detail: `${sourceLabel}; publish a WTC default or save a personal profile before treating settings as configured.`,
    tone: 'warn',
  };
}

function legacySignal(row: LegacySymbolConfig | undefined): string {
  if (!row) return 'RSI/CCI';
  return row.useCci && !row.useRsi ? `CCI ${row.cciLength} <= ${row.cciThreshold}` : `RSI ${row.rsiLength} <= ${row.rsiThreshold}`;
}

function legacyStageSummary(row: LegacySymbolConfig | undefined, stages: readonly LegacyStageConfig[]): string {
  const stageNumber = row?.stage ?? stages[0]?.stage ?? 1;
  const stage = stages.find((item) => item.stage === stageNumber) ?? stages[0];
  if (!stage) return `Stage ${stageNumber}; RSI/CCI slots not saved yet`;
  return `Stage ${stage.stage}; ${stage.rsiSlots} RSI slots / ${stage.cciSlots} CCI slots`;
}

function buildRows(props: BotSettingsQuickPathProps): QuickPathRow[] {
  const source = sourceState(props.source, props.sourceLabel);
  const isLegacy = props.productCode === 'legacy_bot';
  const sourceAction = props.canCustomize
    ? props.source === 'user_override' ? 'Continue custom' : 'Customize'
    : 'Review';
  const rows: QuickPathRow[] = [
    {
      layer: '1. Source',
      state: source.state,
      detail: props.hasSystemDefault
        ? `${source.detail} ${props.customVersionCount} saved custom version${props.customVersionCount === 1 ? '' : 's'} in history.`
        : source.detail,
      tone: source.tone,
      href: '#custom-settings',
      actionLabel: sourceAction,
    },
  ];

  if (isLegacy) {
    const firstLegacy = props.legacyRows.find((row) => row.symbol && row.active !== false) ?? props.legacyRows[0];
    const coinLabel = firstLegacy?.symbol || 'No coin selected';
    rows.push(
      {
        layer: '2. Coin trigger',
        state: coinLabel,
        detail: `${legacySignal(firstLegacy)} on ${firstLegacy?.timeframe ?? '3m'}; each active coin consumes one trigger slot.`,
        tone: firstLegacy?.symbol ? 'ok' : 'warn',
        href: '#legacy-symbol-1',
        actionLabel: 'Open coin row',
      },
      {
        layer: '3. Stage slots',
        state: legacyStageSummary(firstLegacy, props.legacyStages),
        detail: 'Multiple RSI or CCI coins in the same stage remain independent candidates; capacity decides whether the stage has room.',
        tone: props.legacyStages.length > 0 ? 'ok' : 'warn',
        href: '#legacy-stage-1',
        actionLabel: 'Open stages',
      },
      {
        layer: '4. Provider link',
        state: props.legacyProviderAccountCount === 1 ? '1 mapped pub_id' : `${props.legacyProviderAccountCount} mapped pub_ids`,
        detail: 'Provider facts stay read-only evidence. User settings do not expose or edit provider identity.',
        tone: props.legacyProviderAccountCount === 1 ? 'ok' : 'warn',
        href: `/app/bots/${props.bot}/setup?step=strategy`,
        actionLabel: 'Open setup',
      },
    );
  } else {
    const firstTortila = props.tortilaRows.find((row) => row.symbol) ?? props.tortilaRows[0];
    const coinLabel = firstTortila?.symbol || 'No coin selected';
    rows.push(
      {
        layer: '2. Coin strategy',
        state: coinLabel,
        detail: `${firstTortila?.timeframe ?? '4h'}; System ${firstTortila?.system ?? 2}; risk ${firstTortila?.riskPercent ?? 0.3}%; max ${firstTortila?.maxUnits ?? 4} units.`,
        tone: firstTortila?.symbol ? 'ok' : 'warn',
        href: '#tortila-symbol-1',
        actionLabel: 'Open coin row',
      },
      {
        layer: '3. Portfolio caps',
        state: `${valueLabel(props.tortilaPortfolioCaps?.maxOpenSymbols, 'open')} open / ${valueLabel(props.tortilaPortfolioCaps?.maxTotalUnits, 'total')} units`,
        detail: `Directional cap ${valueLabel(props.tortilaPortfolioCaps?.maxUnitsPerDirection, 'not set')}; caps are saved with the strategy profile.`,
        tone: props.tortilaPortfolioCaps ? 'ok' : 'warn',
        href: '#tortila-portfolio-caps',
        actionLabel: 'Open caps',
      },
      {
        layer: '4. Exchange key',
        state: props.exchangeKeyCount === 1 ? '1 encrypted key row' : `${props.exchangeKeyCount} encrypted key rows`,
        detail: 'Settings can check WTC vault metadata only; live exchange ping is not run here.',
        tone: props.exchangeKeyCount > 0 ? 'ok' : 'warn',
        href: `/app/bots/${props.bot}/setup?step=key`,
        actionLabel: props.exchangeKeyCount > 0 ? 'Review key' : 'Add key',
      },
    );
  }

  rows.push(
    {
      layer: '5. Statistics',
      state: isLegacy ? 'Scoped snapshots' : 'Journal snapshots',
      detail: isLegacy
        ? 'User sees own provider-scoped data after mapping; admin selects a user and sees read-only settings plus statistics.'
        : 'User sees own journal-derived positions, trades, equity, and warnings; admin views are read-only per user.',
      tone: 'neutral',
      href: `/app/bots/statistics?bot=${props.bot}`,
      actionLabel: 'Open statistics',
    },
    {
      layer: '6. Save and export',
      state: props.exportBlockedByProviderMapping ? 'Export blocked' : 'Reference export ready',
      detail: props.exportBlockedByProviderMapping
        ? 'Legacy export needs exactly one mapped provider pub_id. Saving still writes a WTC reference version only.'
        : 'Save custom settings writes a WTC version; export downloads the last saved reference config with no secrets.',
      tone: props.exportBlockedByProviderMapping ? 'warn' : 'ok',
      href: props.exportBlockedByProviderMapping ? '#custom-settings' : `/api/bots/${props.bot}/config-export`,
      actionLabel: props.exportBlockedByProviderMapping ? 'Open form' : 'Download export',
    },
    {
      layer: '7. Live boundary',
      state: 'Start/stop absent',
      detail: 'No live apply, start, stop, exchange mutation, or provider mutation is available from this settings surface.',
      tone: 'bad',
      disabledActionLabel: 'Live control disabled',
    },
  );

  return rows;
}

export function BotSettingsQuickPath(props: BotSettingsQuickPathProps) {
  const rows = buildRows(props);
  const isLegacy = props.productCode === 'legacy_bot';
  const exportReady = !props.exportBlockedByProviderMapping;

  return (
    <Card
      title="Basic settings path"
      action={<StatusPill tone={props.source === 'built_in' ? 'warn' : 'ok'}>{props.sourceLabel}</StatusPill>}
    >
      <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone={isLegacy ? 'gold' : 'neutral'}>{isLegacy ? 'Legacy RSI/CCI' : 'Tortila Turtle'}</StatusPill>
          <StatusPill tone={props.canCustomize ? 'ok' : 'bad'}>{props.canCustomize ? 'custom allowed' : 'custom locked'}</StatusPill>
          <StatusPill tone="bad">live control disabled</StatusPill>
        </div>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Link href="#custom-settings" className={buttonClasses(props.canCustomize ? 'primary' : 'ghost')}>
            {props.canCustomize ? 'Open settings editor' : 'Review settings'}
          </Link>
          {exportReady ? (
            <Link href={`/api/bots/${props.bot}/config-export`} className={buttonClasses('secondary')}>Download saved export</Link>
          ) : (
            <button className={buttonClasses('ghost')} type="button" disabled>Export locked</button>
          )}
          <Link href={`/app/bots/statistics?bot=${props.bot}`} className={buttonClasses('ghost')}>Open statistics</Link>
        </div>
      </div>

      <div className="wtc-table-wrap" aria-label="Basic bot settings path">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Status</th>
              <th>What it means</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.layer}>
                <td data-label="Layer">{row.layer}</td>
                <td data-label="Status"><StatusPill tone={row.tone}>{row.state}</StatusPill></td>
                <td data-label="What it means" className="wtc-dim">{row.detail}</td>
                <td data-label="Action" className="wtc-td-action">
                  {row.href && row.actionLabel ? (
                    <Link href={row.href} className={buttonClasses('ghost')}>{row.actionLabel}</Link>
                  ) : (
                    <button className={buttonClasses('ghost')} type="button" disabled>{row.disabledActionLabel ?? 'Unavailable'}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
