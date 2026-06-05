import type { BotConfigActionConfigError } from './config-action-handler';
import type { BotProductCode } from './meta';

export type BotConfigErrorTarget = 'tortila-row' | 'tortila-cap' | 'legacy-row' | 'legacy-stage' | 'global';

export interface BotConfigErrorCopy {
  code: string;
  title: string;
  detail: string;
  target: BotConfigErrorTarget;
  row?: number;
  inlineHint?: string;
}

interface BotConfigErrorSearchParams {
  err?: string;
  issue?: string;
  row?: string;
}

const SAFE_ERROR_CODES = new Set([
  'forbidden-field',
  'form-invalid',
  'schema-invalid',
  'preset-invalid',
  'operation-mode',
  'tortila-row-symbol',
  'tortila-row-timeframe',
  'tortila-row-system',
  'tortila-row-risk',
  'tortila-row-stop',
  'tortila-row-add',
  'tortila-row-units',
  'tortila-row-atr',
  'tortila-row-tp',
  'tortila-row-invalid',
  'tortila-duplicate-symbol',
  'tortila-portfolio-limit',
  'tortila-risk-limit',
  'tortila-entry-throttle',
  'tortila-config-invalid',
  'legacy-row-symbol',
  'legacy-row-timeframe',
  'legacy-row-status',
  'legacy-row-signal',
  'legacy-row-rsi',
  'legacy-row-cci',
  'legacy-row-tp',
  'legacy-row-entry',
  'legacy-row-balance',
  'legacy-row-leverage',
  'legacy-row-levels',
  'legacy-row-ladder',
  'legacy-row-stage',
  'legacy-row-delay',
  'legacy-row-delta',
  'legacy-row-invalid',
  'legacy-duplicate-symbol',
  'legacy-stage-number',
  'legacy-stage-capacity',
  'legacy-stage-duplicate',
  'legacy-api-profile',
  'legacy-max-symbols',
  'legacy-default-timeframe',
  'legacy-default-tp',
  'legacy-default-entry',
  'legacy-default-balance',
  'legacy-default-leverage',
  'legacy-config-invalid',
]);
const ROW_SCOPED_ERROR_CODES = new Set([
  'tortila-row-symbol',
  'tortila-row-timeframe',
  'tortila-row-system',
  'tortila-row-risk',
  'tortila-row-stop',
  'tortila-row-add',
  'tortila-row-units',
  'tortila-row-atr',
  'tortila-row-tp',
  'tortila-row-invalid',
  'legacy-row-symbol',
  'legacy-row-timeframe',
  'legacy-row-status',
  'legacy-row-signal',
  'legacy-row-rsi',
  'legacy-row-cci',
  'legacy-row-tp',
  'legacy-row-entry',
  'legacy-row-balance',
  'legacy-row-leverage',
  'legacy-row-levels',
  'legacy-row-ladder',
  'legacy-row-stage',
  'legacy-row-delay',
  'legacy-row-delta',
  'legacy-row-invalid',
  'legacy-stage-number',
  'legacy-stage-capacity',
]);

function safeIssueCode(code: string | undefined): string {
  return code && SAFE_ERROR_CODES.has(code) ? code : 'form-invalid';
}

function safeRow(value: number | string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 30 ? n : undefined;
}

function rowLabel(target: BotConfigErrorTarget, row: number | undefined): string {
  if (!row) return target === 'legacy-stage' ? 'stage row' : 'coin row';
  if (target === 'legacy-stage') return `stage row ${row}`;
  return `coin slot ${row}`;
}

function copyFor(code: string, row: number | undefined): BotConfigErrorCopy {
  const tortilaRow = (detail: string, inlineHint = detail): BotConfigErrorCopy => ({
    code,
    title: `Fix Tortila ${rowLabel('tortila-row', row)}`,
    detail,
    target: 'tortila-row',
    row,
    inlineHint,
  });
  const legacyRow = (detail: string, inlineHint = detail): BotConfigErrorCopy => ({
    code,
    title: `Fix Legacy ${rowLabel('legacy-row', row)}`,
    detail,
    target: 'legacy-row',
    row,
    inlineHint,
  });
  const legacyStage = (detail: string, inlineHint = detail): BotConfigErrorCopy => ({
    code,
    title: `Fix Legacy ${rowLabel('legacy-stage', row)}`,
    detail,
    target: 'legacy-stage',
    row,
    inlineHint,
  });
  const global = (title: string, detail: string): BotConfigErrorCopy => ({
    code,
    title,
    detail,
    target: 'global',
  });
  const tortilaCap = (title: string, detail: string): BotConfigErrorCopy => ({
    code,
    title,
    detail,
    target: 'tortila-cap',
  });

  switch (code) {
    case 'forbidden-field':
      return global('Configuration was not saved', 'This save included a forbidden live-control, provider, or credential field. Remove that field and save settings only.');
    case 'preset-invalid':
      return global('Profile was not saved', 'The selected reference profile is unavailable or failed validation. Choose another profile or save a manual draft.');
    case 'operation-mode':
      return global('Choose a valid operation mode', 'Use Custom draft or WTC automation intent. Live apply still remains disabled.');
    case 'tortila-row-symbol':
      return tortilaRow('Choose a coin from the list or enter one manual symbol. The symbol must be 1-40 characters.');
    case 'tortila-row-timeframe':
      return tortilaRow('Choose 4h or 1h for this coin.');
    case 'tortila-row-system':
      return tortilaRow('Choose Turtle System 1 or System 2 for this coin.');
    case 'tortila-row-risk':
      return tortilaRow('Risk % must be between 0.1 and 3. Enter percent values like 0.3, not runtime fractions like 0.003.');
    case 'tortila-row-stop':
      return tortilaRow('ATR stop N must be between 1 and 4.');
    case 'tortila-row-add':
      return tortilaRow('Add step N must be between 0.25 and 2.');
    case 'tortila-row-units':
      return tortilaRow('Max units must be a whole number from 1 to 4.');
    case 'tortila-row-atr':
      return tortilaRow('ATR period must be a whole number from 10 to 30.');
    case 'tortila-row-tp':
      return tortilaRow('TP R must be between 0 and 50. Use 0 when fixed take profit is off.');
    case 'tortila-duplicate-symbol':
      return global('Remove duplicate Tortila coins', 'Each Tortila coin can appear only once. Keep one row per symbol before saving.');
    case 'tortila-portfolio-limit':
      return tortilaCap('Fix Tortila portfolio limits', 'Max open symbols must be 1-20, max total units 1-50, and units per direction 1-30. Each value must be a whole number.');
    case 'tortila-risk-limit':
      return tortilaCap('Fix Tortila risk limits', 'Drawdown halt must be 1-95% and daily max loss must be 0.5-50%. These are WTC reference profile limits only.');
    case 'tortila-entry-throttle':
      return tortilaCap('Fix Tortila entry throttle', 'Max new entries per tick must be a whole number from 1 to 20.');
    case 'legacy-row-symbol':
      return legacyRow('Choose a coin from the list or enter one manual symbol. The symbol must be 1-40 characters.');
    case 'legacy-row-timeframe':
      return legacyRow('Choose a supported Legacy timeframe: 1m, 3m, 5m, 15m, or 1h.');
    case 'legacy-row-status':
      return legacyRow('Choose Enabled or Paused for this coin.');
    case 'legacy-row-signal':
      return legacyRow('Choose exactly one trigger for this coin: RSI or CCI.');
    case 'legacy-row-rsi':
      return legacyRow('RSI length must be 2-100 and RSI threshold must be 1-100.');
    case 'legacy-row-cci':
      return legacyRow('CCI length must be 2-100 and CCI threshold must be between -500 and 500.');
    case 'legacy-row-tp':
      return legacyRow('Take profit % must be between 0.05 and 20.');
    case 'legacy-row-entry':
      return legacyRow('Initial entry % must be between 0.1 and 100.');
    case 'legacy-row-balance':
      return legacyRow('Balance % must be between 0.1 and 100.');
    case 'legacy-row-leverage':
      return legacyRow('Leverage must be a whole number from 1 to 50.');
    case 'legacy-row-levels':
      return legacyRow('Averaging levels must be a whole number from 1 to 8.');
    case 'legacy-row-ladder':
      return legacyRow('Drop ladder and volume ladder must be comma-separated numbers, and each list count must match Averaging levels.');
    case 'legacy-row-stage':
      return legacyRow('Stage slot group must be a whole number from 1 to 8.');
    case 'legacy-row-delay':
      return legacyRow('Delay bars must be a whole number from 1 to 100.');
    case 'legacy-row-delta':
      return legacyRow('Delta threshold must be between -10000 and 10000.');
    case 'legacy-duplicate-symbol':
      return global('Remove duplicate Legacy coins', 'Each Legacy coin can appear only once. Keep one row per symbol before saving.');
    case 'legacy-stage-number':
      return legacyStage('Stage number must be a whole number from 1 to 8.');
    case 'legacy-stage-capacity':
      return legacyStage('RSI and CCI capacities must be whole numbers from 0 to 50.');
    case 'legacy-stage-duplicate':
      return global('Remove duplicate Legacy stages', 'Each Legacy stage number can appear only once in the stage capacity table.');
    case 'legacy-api-profile':
      return global('Fix Legacy API profile label', 'API profile is a human label only and must be 1-80 characters.');
    case 'legacy-max-symbols':
      return global('Fix Legacy max symbols', 'Max symbols must be a whole number from 1 to 50.');
    case 'legacy-default-timeframe':
      return global('Fix Legacy default timeframe', 'Choose a supported default timeframe: 1m, 3m, 5m, 15m, or 1h.');
    case 'legacy-default-tp':
      return global('Fix Legacy default TP', 'Default TP must be between 0.05 and 20%.');
    case 'legacy-default-entry':
      return global('Fix Legacy default entry', 'Default entry must be between 0.1 and 100%.');
    case 'legacy-default-balance':
      return global('Fix Legacy default balance', 'Default balance must be between 0.1 and 100%.');
    case 'legacy-default-leverage':
      return global('Fix Legacy default leverage', 'Default leverage must be a whole number from 1 to 50.');
    default:
      return global('Configuration was not saved', 'One or more rows are out of range, duplicated, or internally inconsistent. Review the highlighted hint and save again.');
  }
}

export function botConfigErrorRedirect(basePath: string, error: BotConfigActionConfigError): string {
  const code = safeIssueCode(error.code);
  const params = new URLSearchParams({ issue: code });
  const row = safeRow(error.row);
  if (row && ROW_SCOPED_ERROR_CODES.has(code)) params.set('row', String(row));
  return `${basePath}${basePath.includes('?') ? '&' : '?'}${params.toString()}`;
}

export function botConfigErrorCopy(productCode: BotProductCode, searchParams: BotConfigErrorSearchParams): BotConfigErrorCopy | null {
  if (searchParams.err !== 'config') return null;
  const code = safeIssueCode(searchParams.issue);
  const row = safeRow(searchParams.row);
  const copy = copyFor(code, row);
  if (productCode === 'tortila_bot' && copy.target === 'legacy-row') return copyFor('form-invalid', undefined);
  if (productCode === 'tortila_bot' && copy.target === 'legacy-stage') return copyFor('form-invalid', undefined);
  if (productCode === 'legacy_bot' && copy.target === 'tortila-row') return copyFor('form-invalid', undefined);
  if (productCode === 'legacy_bot' && copy.target === 'tortila-cap') return copyFor('form-invalid', undefined);
  return copy;
}
