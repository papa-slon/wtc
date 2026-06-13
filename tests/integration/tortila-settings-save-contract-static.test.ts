/**
 * Save-contract guard for the premium Tortila settings page.
 *
 * The settings page is a pure render swap: TortilaSymbolConfigTable's cluttered
 * body is replaced by the clean TortilaCoinConfigEditor, but the POSTed form
 * MUST stay byte-compatible with the unchanged server action
 * (saveBotConfigAction -> handleSaveBotConfigAction -> persistBotConfig), which
 * parses input `name` attributes via config.ts.
 *
 * This test asserts the rendered editor still emits EVERY `name` attribute the
 * action reads (per-coin indexed fields + portfolio caps), and that the page
 * keeps the form/action wiring + the operationMode + compatibility fields. If
 * any name drifts, the silent-data-loss risk this guards against is caught here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const editor = read('apps/web/src/features/bots/TortilaCoinConfigEditor.tsx');
const settings = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');
const config = read('apps/web/src/features/bots/config.ts');

// The exact per-coin field name templates the action reads in config.ts
// (tortilaSymbolConfigsFromForm + botConfigFirstFormIssue), looped i = 0..7.
const PER_COIN_NAME_TEMPLATES = [
  'symbol_${i}',
  'symbol_custom_${i}',
  'tf_${i}',
  'system_${i}',
  'risk_${i}',
  'stop_${i}',
  'add_${i}',
  'maxUnits_${i}',
  'atr_${i}',
  'tp_${i}',
] as const;

// Portfolio caps are top-level names (no index).
const CAP_NAMES = [
  'maxOpenSymbols',
  'maxTotalUnits',
  'maxUnitsPerDirection',
  'haltDrawdownPercent',
  'dailyMaxLossPercent',
  'maxNewEntriesPerTick',
] as const;

describe('Tortila settings: save contract is intact after the premium redesign', () => {
  it('the coin editor emits every per-coin `name` attribute the server action parses', () => {
    for (const template of PER_COIN_NAME_TEMPLATES) {
      // Rendered as `name={`<template>`}` in the editor.
      expect(editor, `missing per-coin field name template: ${template}`).toContain(`name={\`${template}\``);
    }
  });

  it('the coin editor emits every portfolio cap `name` attribute', () => {
    for (const cap of CAP_NAMES) {
      expect(editor, `missing cap name: ${cap}`).toContain(cap);
      // Each cap is a real <input name="..."> bound to the cap draft.
      expect(editor).toContain(`name={cap.name}`);
    }
  });

  it('folds the manual-override field into one coin field without dropping symbol_custom_{i}', () => {
    // The single visible coin combobox posts symbol_${i}; symbol_custom_${i} is a
    // hidden empty input so the server's `effectiveSymbol = custom || selected`
    // resolves to the typed symbol — contract unchanged, one field for the user.
    expect(editor).toContain('name={`symbol_${i}`}');
    expect(editor).toContain('type="hidden" name={`symbol_custom_${i}`} value=""');
  });

  it('keeps the index scheme bounded to the server row limit (0..7)', () => {
    expect(editor).toContain('TORTILA_SYMBOL_ROW_LIMIT = 8');
    // config.ts loops i < TORTILA_SYMBOL_ROW_LIMIT for both parse + validation.
    expect(config).toContain('export const TORTILA_SYMBOL_ROW_LIMIT = 8');
    expect(config).toContain('for (let i = 0; i < TORTILA_SYMBOL_ROW_LIMIT; i += 1)');
  });

  it('wires the editor inside the unchanged save form + action', () => {
    expect(settings).toContain('<form id="custom-settings" action={saveBotConfigAction}');
    expect(settings).toContain('<TortilaCoinConfigEditor');
    // The CSRF field + hidden bot field that the action requires.
    expect(settings).toContain('<CsrfField />');
    expect(settings).toContain('name="bot"');
    // operationMode select stays in the form (a real saved field).
    expect(settings).toContain('name="operationMode"');
    // The action chain itself is untouched.
    expect(settings).toContain('handleSaveBotConfigAction');
    expect(settings).toContain('persistConfig: (userId, productCode, config, note, accountId) => persistBotConfig');
  });

  it('still renders the compatibility / advanced top-level fields (symbols, leverage, timeframe, ...)', () => {
    // These come from TORTILA_FIELDS via fields.map; the embedded cap/symbols
    // names are filtered out and instead owned by the editor. leverage + the
    // base strategy fields must still post.
    expect(settings).toContain('fields.map');
    expect(settings).toContain('name={f.name}');
    expect(config).toContain("name: 'leverage'");
  });

  it('does NOT resurrect the deleted constructor/noise widgets on the settings render', () => {
    for (const noise of [
      'Tortila strategy map',
      'Copy draft SYMBOL_CONFIGS',
      'Runtime export preview',
      'draft over reference cap',
      'BotSetupControlCenter',
      'BotContinuityPanel',
      'BotOperationMapPanel',
      'BotSettingsQuickPath',
      'BotConfigReviewPanel',
      'BotReadinessMap',
    ]) {
      expect(settings, `settings page must not render: ${noise}`).not.toContain(noise);
      expect(editor, `coin editor must not render: ${noise}`).not.toContain(noise);
    }
  });

  it('declutters the settings SHELL: the status/provenance cards above the editor are gone', () => {
    // The wall of cards the audit flagged as the #1 "this is a constructor" smell
    // is deleted. None of these card titles / engineer-speak strings may survive.
    for (const deleted of [
      'Configuration source',
      'Settings source',
      'Resolved source',
      'WTC version only', // the deleted tortila "Save behavior" MetricCard value
      'no live-control adapter actions', // its engineer-speak sub
      'Customize my settings',
      'Customize from this default',
      'Continue editing custom settings',
      'fallback active',
      'user stream v',
    ]) {
      expect(settings, `decluttered settings shell must not contain: ${deleted}`).not.toContain(deleted);
    }
    // The form keeps its plain "Strategy mode" <label> — it was not deleted.
    expect(settings).toContain('>Strategy mode</span>');
  });

  it('puts the coin editor first (above the legacy/exchange/reference/version cards)', () => {
    const editorIdx = settings.indexOf('<TortilaCoinConfigEditor');
    const referenceIdx = settings.indexOf('Reference profiles');
    const exportIdx = settings.indexOf('Export current reference config');
    const versionIdx = settings.indexOf('Version history');
    const exchangeIdx = settings.indexOf('Private exchange connection');
    expect(editorIdx).toBeGreaterThan(0);
    // Everything secondary now sits BELOW the editor form.
    for (const below of [referenceIdx, exportIdx, versionIdx, exchangeIdx]) {
      expect(below).toBeGreaterThan(editorIdx);
    }
  });

  it('keeps the no-live-exchange disclaimer to a single quiet save-bar instance', () => {
    // The audit found this disclaimer repeated 5+ times. The canonical copy now
    // lives only on the save bar. Count its occurrences on the settings page.
    const matches = settings.match(/Nothing is pushed to a live exchange/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
