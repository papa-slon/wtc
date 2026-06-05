export interface TortilaRuntimeSymbolConfig {
  symbol: string;
  timeframe: '1h' | '4h';
  system: number;
  riskPercent: number;
  stopN: number;
  addStep: number;
  maxUnits: number;
  atrPeriod: number;
  takeProfitRr: number;
}

export function trimTortilaRuntimeNumber(n: number, decimals = 8): string {
  return n.toFixed(decimals).replace(/\.?0+$/, '');
}

export function tortilaRiskPercentToRuntimeFraction(riskPercent: number): string {
  return trimTortilaRuntimeNumber(riskPercent / 100, 6);
}

export function serializeTortilaSymbolConfig(row: TortilaRuntimeSymbolConfig): string {
  return [
    row.symbol,
    row.timeframe,
    String(row.system),
    tortilaRiskPercentToRuntimeFraction(row.riskPercent),
    trimTortilaRuntimeNumber(row.stopN, 3),
    trimTortilaRuntimeNumber(row.addStep, 3),
    String(row.maxUnits),
    String(row.atrPeriod),
    trimTortilaRuntimeNumber(row.takeProfitRr, 3),
  ].join('@');
}

export function serializeTortilaSymbolConfigs(rows: readonly TortilaRuntimeSymbolConfig[]): string {
  return rows.map(serializeTortilaSymbolConfig).join(';');
}
