export type BotInstrumentProduct = 'legacy_bot' | 'tortila_bot';
export type InstrumentCatalogSource = 'catalog' | 'runtime';

export interface InstrumentOption {
  symbol: string;
  label: string;
  venue: string;
  format: string;
  source: InstrumentCatalogSource;
}

export const LEGACY_BINGX_LINEAR_SYMBOLS = [
  'AAVE-USDT',
  'ATOM-USDT',
  'AVAX-USDT',
  'BCH-USDT',
  'FARTCOIN-USDT',
  'KSM-USDT',
  'LINK-USDT',
  'SOL-USDT',
  'SUI-USDT',
  'TAO-USDT',
  'UNI-USDT',
  'XLM-USDT',
] as const;

export const TORTILA_BINGX_SWAP_SYMBOLS = [
  'XRP/USDT:USDT',
  'TRX/USDT:USDT',
  'NEAR/USDT:USDT',
  'HBAR/USDT:USDT',
  'LINK/USDT:USDT',
  'BTC/USDT:USDT',
  'ETH/USDT:USDT',
  'SOL/USDT:USDT',
  'BNB/USDT:USDT',
  'AVAX/USDT:USDT',
  'SUI/USDT:USDT',
  'ATOM/USDT:USDT',
] as const;

function normalizeInstrumentSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function catalogForProduct(product: BotInstrumentProduct): {
  symbols: readonly string[];
  venue: string;
  format: string;
} {
  return product === 'legacy_bot'
    ? {
      symbols: LEGACY_BINGX_LINEAR_SYMBOLS,
      venue: 'BingX linear futures',
      format: 'LEGACY DASH SYMBOL',
    }
    : {
      symbols: TORTILA_BINGX_SWAP_SYMBOLS,
      venue: 'BingX swap via CCXT',
      format: 'CCXT swap symbol',
    };
}

export function instrumentOptionsForBot(
  product: BotInstrumentProduct,
  runtimeSymbols: readonly string[] = [],
): InstrumentOption[] {
  const catalog = catalogForProduct(product);
  const options = new Map<string, InstrumentOption>();

  for (const symbol of catalog.symbols) {
    const normalized = normalizeInstrumentSymbol(symbol);
    if (!normalized) continue;
    options.set(normalized, {
      symbol: normalized,
      label: normalized,
      venue: catalog.venue,
      format: catalog.format,
      source: 'catalog',
    });
  }

  for (const symbol of runtimeSymbols) {
    const normalized = normalizeInstrumentSymbol(symbol);
    if (!normalized || options.has(normalized)) continue;
    options.set(normalized, {
      symbol: normalized,
      label: `${normalized} (runtime)`,
      venue: catalog.venue,
      format: catalog.format,
      source: 'runtime',
    });
  }

  return [...options.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function instrumentSymbolsForBot(product: BotInstrumentProduct, runtimeSymbols: readonly string[] = []): string[] {
  return instrumentOptionsForBot(product, runtimeSymbols).map((option) => option.symbol);
}
