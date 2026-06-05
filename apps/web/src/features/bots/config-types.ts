export interface TortilaSymbolConfig {
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

export interface LegacySymbolConfig {
  symbol: string;
  timeframe: '1m' | '3m' | '5m' | '15m' | '1h';
  active: boolean;
  stage: number;
  useRsi: boolean;
  rsiLength: number;
  rsiThreshold: number;
  useCci: boolean;
  cciLength: number;
  cciThreshold: number;
  takeProfitPercent: number;
  initialEntryPercent: number;
  useBalancePercent: number;
  leverage: number;
  averagingLevels: number;
  averagingPercents: string;
  averagingVolumePercents: string;
  useDelayFilter: boolean;
  delayBars: number;
  useDeltaFilter: boolean;
  deltaFilter: number;
}

export interface LegacyRuntimeSymbolConfig extends LegacySymbolConfig {
  providerPubId?: string;
}

export interface LegacyStageConfig {
  stage: number;
  rsiSlots: number;
  cciSlots: number;
}
