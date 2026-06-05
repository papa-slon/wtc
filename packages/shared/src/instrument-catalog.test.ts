import { describe, expect, it } from 'vitest';
import {
  instrumentOptionsForBot,
  instrumentSymbolsForBot,
  LEGACY_BINGX_LINEAR_SYMBOLS,
  TORTILA_BINGX_SWAP_SYMBOLS,
} from './instrument-catalog.ts';

describe('instrument catalog', () => {
  it('serves Legacy dash-format averaging symbols plus unique runtime rows', () => {
    const options = instrumentOptionsForBot('legacy_bot', ['atom-usdt', 'DOGE-USDT', '']);

    expect(options.some((option) => option.symbol === LEGACY_BINGX_LINEAR_SYMBOLS[0])).toBe(true);
    expect(options.find((option) => option.symbol === 'DOGE-USDT')).toMatchObject({
      label: 'DOGE-USDT (runtime)',
      source: 'runtime',
      format: 'LEGACY DASH SYMBOL',
    });
    expect(options.filter((option) => option.symbol === 'ATOM-USDT')).toHaveLength(1);
  });

  it('serves Tortila CCXT swap symbols without leaking Legacy formatting', () => {
    const symbols = instrumentSymbolsForBot('tortila_bot', ['doge/usdt:usdt']);

    expect(symbols).toContain(TORTILA_BINGX_SWAP_SYMBOLS[0]);
    expect(symbols).toContain('DOGE/USDT:USDT');
    expect(symbols).not.toContain('DOGE-USDT');
  });
});
