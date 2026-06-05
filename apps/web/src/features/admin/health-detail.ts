import { redact } from '@wtc/audit';
import { warningCodesFromDetail } from '@wtc/bot-adapters';

const SAFE_HEALTH_DETAIL_KEYS = new Set([
  'adapterMode',
  'botContinuityStatus',
  'coreWorkerStatus',
  'entitlementsChanged',
  'error',
  'handoffJtisPurged',
  'liveControlDisabled',
  'lmsMaterialsPurged',
  'lmsObjectCleanupFailed',
  'lmsObjectDeleteAttempted',
  'lmsObjectDeleteConfirmed',
  'lmsObjectMaterialsPurged',
  'lmsObjectMaterialsScanned',
  'lmsObjectMetadataOnlyPurged',
  'lmsPendingObjectCleanupCompleted',
  'lmsPendingObjectCleanupDeadLettered',
  'lmsPendingObjectCleanupFailed',
  'lmsPendingObjectCleanupScanned',
  'lmsPendingObjectDeleteAttempted',
  'lmsPendingObjectDeleteConfirmed',
  'message',
  'metricsAvailable',
  'positionsSnapshotted',
  'processAlive',
  'providerAccountMappingErrors',
  'providerAccountMappingsSeen',
  'providerAccountMappingsSnapshotted',
  'readState',
  'readStateDetail',
  'status',
  'tortilaHealthStatus',
  'tortilaLastError',
  'tortilaMetricsAvailable',
  'tortilaPositionsSnapshotted',
  'tortilaReadState',
  'tortilaReadStateDetail',
  'tortilaSnapshot',
  'tortilaTradesImported',
  'tortilaTradesSeen',
  'tradesImported',
  'tradesSeen',
  'tvAutomationDisabled',
  'tvExpired',
  'tvExpiringSoon',
  'tvTasksQueued',
  'tvTasksRepaired',
  'warningCodes',
  'warnings',
  'legacyAccountsSeen',
  'legacyHealthStatus',
  'legacyLastError',
  'legacyPositionsSeen',
  'legacyProviderAccountsScoped',
  'legacyReadState',
  'legacySettingsSeen',
  'legacySnapshot',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|secret|token|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 200);
}

function safeValue(value: unknown): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return safeString(value);
  if (Array.isArray(value)) {
    const out = value
      .filter((item) => item === null || typeof item === 'boolean' || typeof item === 'number' || typeof item === 'string')
      .slice(0, 20)
      .map((item) => (typeof item === 'string' ? safeString(item).slice(0, 80) : item));
    return out;
  }
  return undefined;
}

export function projectHealthDetail(detail: unknown): Record<string, unknown> | null {
  const redacted = redact(detail);
  if (!isPlainRecord(redacted)) return null;

  const warnings = warningCodesFromDetail(redacted).slice(0, 20);
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(redacted)) {
    if (!SAFE_HEALTH_DETAIL_KEYS.has(key)) continue;
    const next = safeValue(value);
    if (next !== undefined) safe[key] = next;
  }

  if (warnings.length > 0) safe.warnings = warnings;
  delete safe.warningCodes;

  return Object.keys(safe).length > 0 ? safe : null;
}
