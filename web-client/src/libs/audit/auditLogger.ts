import { ensureObservabilityMeta, updateObservabilityMeta } from '../observability/observability';
import { resolveAuditActor } from '../auth/storedAuth';
import type { DataSourceTransition } from '../observability/types';
import { maskSensitiveLog } from '../logging/mask';

export type UiAction =
  | 'tone_change'
  | 'scenario_change'
  | 'scenario_override'
  | 'search'
  | 'navigate'
  | 'deeplink'
  | 'history_jump'
  | 'audit_open'
  | 'memo_edit_toggle'
  | 'diff'
  | 'send'
  | 'claim_send'
  | 'save'
  | 'print'
  | 'start'
  | 'pause'
  | 'config_delivery'
  | 'finish'
  | 'draft'
  | 'cancel'
  | 'lock'
  | 'patient_fetch'
  | 'patient_save'
  | 'patient_search'
  | 'patient_name_search'
  | 'patient_select'
  | 'patient_master_select'
  | 'patient_edit_open'
  | 'open_modal'
  | 'outpatient_fetch'
  | 'orca_queue_retry'
  | 'master_check'
  | 'master_sync'
  | 'system_health'
  | 'medicalset_search'
  | 'orca_xml_proxy'
  | 'orca_original_fetch'
  | 'orca_insurance_list_fetch'
  | 'orca_api_console_send';

export type UiStateLog = {
  action: UiAction;
  screen?: string;
  controlId?: string;
  tone?: string;
  runId?: string;
  traceId?: string;
  facilityId?: string;
  patientId?: string;
  appointmentId?: string;
  claimId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  dataSourceTransition?: DataSourceTransition;
  fallbackUsed?: boolean;
  details?: Record<string, unknown>;
  timestamp: string;
};

const uiStateLog: UiStateLog[] = [];
const isDevRuntime = import.meta.env.DEV;
const isAuditDevConsoleEnabled = isDevRuntime && import.meta.env.VITE_ENABLE_AUDIT_DEV_CONSOLE === '1';
const ALLOWED_DETAIL_KEYS = new Set([
  'action',
  'actor',
  'apiResult',
  'apiResultMessage',
  'authorName',
  'authorRole',
  'authoredAt',
  'binarySize',
  'cacheHit',
  'contentType',
  'controlId',
  'dataSourceTransition',
  'debugFeature',
  'documentId',
  'documentIssuedAt',
  'documentTitle',
  'documentType',
  'durationMs',
  'endpoint',
  'error',
  'errorCategory',
  'facilityId',
  'fallbackUsed',
  'hasRawXml',
  'httpStatus',
  'inputSource',
  'legacy',
  'method',
  'missingMaster',
  'mode',
  'note',
  'ok',
  'operation',
  'outcome',
  'outputMode',
  'reason',
  'requiredRole',
  'resource',
  'role',
  'runId',
  'screen',
  'soapLength',
  'source',
  'status',
  'statusText',
  'subject',
  'templateId',
  'tone',
  'traceId',
]);
const DROPPED_PAYLOAD_KEYS = new Set(['query', 'rawXml', 'xml', 'authorization', 'cookie']);

const normalizeOptionalString = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return value ?? undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizePayloadString = (key: string, value: string) => {
  if (key === 'endpoint' || key === 'path') {
    const questionIndex = value.indexOf('?');
    return questionIndex >= 0 ? value.slice(0, questionIndex) : value;
  }
  return value;
};

const sanitizeDetailValue = (key: string, value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const sanitized = sanitizePayloadString(key, value);
    return sanitized.length > 256 ? `${sanitized.slice(0, 256)}...` : sanitized;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((entry) => sanitizeDetailValue(key, entry));
  }
  if (typeof value === 'object') {
    return sanitizeAuditDetails(value as Record<string, unknown>);
  }
  return undefined;
};

const sanitizeAuditDetails = (details: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(details)
      .filter(([key]) => ALLOWED_DETAIL_KEYS.has(key) && !DROPPED_PAYLOAD_KEYS.has(key))
      .map(([key, value]) => [key, sanitizeDetailValue(key, value)])
      .filter(([, value]) => value !== undefined),
  );

const sanitizeAuditPayload = (payload?: Record<string, unknown>) => {
  if (!payload) return payload;
  const sanitized = { ...payload };
  Object.keys(sanitized).forEach((key) => {
    if (DROPPED_PAYLOAD_KEYS.has(key)) {
      delete sanitized[key];
      return;
    }
    const value = sanitized[key];
    if (key === 'details' && value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditDetails(value as Record<string, unknown>);
      return;
    }
    if (typeof value === 'string') {
      sanitized[key] = sanitizePayloadString(key, value);
    }
  });
  return sanitized;
};

const mergeDefined = <T extends Record<string, unknown>>(base: T, next?: Partial<T>): T => {
  if (!next) return base;
  const merged = { ...base };
  (Object.keys(next) as (keyof T)[]).forEach((key) => {
    const value = next[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  });
  return merged;
};

const resolveDataSourceTransition = (
  dataSourceTransition?: DataSourceTransition,
  cacheHit?: boolean,
  fallbackUsed?: boolean,
): DataSourceTransition => {
  if (dataSourceTransition) return dataSourceTransition;
  if (fallbackUsed) return 'fallback';
  if (cacheHit) return 'server';
  return 'server';
};

export function logUiState(entry: Omit<UiStateLog, 'timestamp'>) {
  const meta = ensureObservabilityMeta();
  const actorMeta = resolveAuditActor();
  const merged = mergeDefined({ ...meta } as UiStateLog, entry as Partial<UiStateLog>);
  const details =
    merged.details && typeof merged.details === 'object' && merged.details !== null
      ? (merged.details as Record<string, unknown>)
      : {};
  const resolvedFacilityId =
    normalizeOptionalString(merged.facilityId) ??
    actorMeta.facilityId;
  const resolvedRunId = normalizeOptionalString(merged.runId) ?? meta.runId;
  const resolvedTraceId = normalizeOptionalString(merged.traceId) ?? meta.traceId;
  const resolvedCacheHit = merged.cacheHit ?? meta.cacheHit ?? false;
  const resolvedMissingMaster = merged.missingMaster ?? meta.missingMaster ?? false;
  const resolvedFallbackUsed = merged.fallbackUsed ?? meta.fallbackUsed ?? false;
  const resolvedDataSourceTransition = resolveDataSourceTransition(
    merged.dataSourceTransition,
    resolvedCacheHit,
    resolvedFallbackUsed,
  );
  const normalizedDetails: Record<string, unknown> = sanitizeAuditDetails(details);
  if (normalizedDetails.runId === undefined) normalizedDetails.runId = resolvedRunId;
  if (normalizedDetails.traceId === undefined) normalizedDetails.traceId = resolvedTraceId;
  if (normalizedDetails.cacheHit === undefined) normalizedDetails.cacheHit = resolvedCacheHit;
  if (normalizedDetails.missingMaster === undefined) normalizedDetails.missingMaster = resolvedMissingMaster;
  if (normalizedDetails.fallbackUsed === undefined) normalizedDetails.fallbackUsed = resolvedFallbackUsed;
  if (normalizedDetails.dataSourceTransition === undefined) {
    normalizedDetails.dataSourceTransition = resolvedDataSourceTransition;
  }
  const record: UiStateLog = {
    ...merged,
    facilityId: resolvedFacilityId,
    patientId: undefined,
    appointmentId: undefined,
    claimId: undefined,
    runId: resolvedRunId,
    traceId: resolvedTraceId,
    cacheHit: resolvedCacheHit,
    missingMaster: resolvedMissingMaster,
    fallbackUsed: resolvedFallbackUsed,
    dataSourceTransition: resolvedDataSourceTransition,
    details: normalizedDetails,
    timestamp: new Date().toISOString(),
  };
  const missing: string[] = [];
  if (!record.runId) missing.push('runId');
  if (!record.traceId) missing.push('traceId');
  if (record.dataSourceTransition === undefined) missing.push('dataSourceTransition');
  if (record.cacheHit === undefined) missing.push('cacheHit');
  if (record.missingMaster === undefined) missing.push('missingMaster');
  if (record.fallbackUsed === undefined) missing.push('fallbackUsed');
  if (!record.facilityId) missing.push('facilityId');
  const maskedRecord = maskSensitiveLog(record);
  if (missing.length > 0 && isDevRuntime && typeof console !== 'undefined') {
    console.warn('[audit] UI state schema warning', { missing, record: maskedRecord });
  }
  uiStateLog.push(record);
  if (isAuditDevConsoleEnabled && typeof console !== 'undefined') {
    console.info('[audit] UI state', maskedRecord);
  }
  // tone 変更や runId 更新の副作用が meta に伝播するよう同期する。
  updateObservabilityMeta({
    runId: record.runId,
    traceId: record.traceId,
    cacheHit: record.cacheHit,
    missingMaster: record.missingMaster,
    dataSourceTransition: record.dataSourceTransition,
    fallbackUsed: record.fallbackUsed,
  });
  return record;
}

export function getUiStateLog() {
  return [...uiStateLog];
}

export function clearUiStateLog() {
  uiStateLog.length = 0;
}

export type AuditEventRecord = {
  runId?: string;
  traceId?: string;
  source?: string;
  note?: string;
  facilityId?: string;
  patientId?: string;
  appointmentId?: string;
  claimId?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  dataSourceTransition?: DataSourceTransition;
  payload?: Record<string, unknown>;
  timestamp: string;
};

const auditEventLog: AuditEventRecord[] = [];

export function logAuditEvent(entry: Omit<AuditEventRecord, 'timestamp'>) {
  const meta = ensureObservabilityMeta();
  const actorMeta = resolveAuditActor();
  const base = mergeDefined({ ...meta } as AuditEventRecord, entry as Partial<AuditEventRecord>);
  const payload =
    entry.payload && typeof entry.payload === 'object'
      ? (entry.payload as Record<string, unknown>)
      : undefined;
  const rawDetails =
    payload && typeof payload.details === 'object' && payload.details !== null
      ? (payload.details as Record<string, unknown>)
      : {};
  const resolvedRunId =
    (rawDetails.runId as string | undefined) ?? (payload?.runId as string | undefined) ?? base.runId ?? meta.runId;
  const resolvedTraceId =
    (rawDetails.traceId as string | undefined) ??
    (payload?.traceId as string | undefined) ??
    base.traceId ??
    meta.traceId;
  const resolvedCacheHit =
    (rawDetails.cacheHit as boolean | undefined) ?? base.cacheHit ?? meta.cacheHit ?? false;
  const resolvedMissingMaster =
    (rawDetails.missingMaster as boolean | undefined) ?? base.missingMaster ?? meta.missingMaster ?? false;
  const resolvedFallbackUsed =
    (rawDetails.fallbackUsed as boolean | undefined) ?? base.fallbackUsed ?? meta.fallbackUsed ?? false;
  const resolvedDataSourceTransition =
    (rawDetails.dataSourceTransition as DataSourceTransition | undefined) ??
    base.dataSourceTransition ??
    meta.dataSourceTransition ??
    resolveDataSourceTransition(undefined, resolvedCacheHit, resolvedFallbackUsed);
  const resolvedFacilityId =
    base.facilityId ??
    actorMeta.facilityId;

  const normalizedDetails: Record<string, unknown> = sanitizeAuditDetails(rawDetails);
  if (normalizedDetails.runId === undefined) normalizedDetails.runId = resolvedRunId;
  if (normalizedDetails.traceId === undefined) normalizedDetails.traceId = resolvedTraceId;
  if (normalizedDetails.dataSourceTransition === undefined) {
    normalizedDetails.dataSourceTransition = resolvedDataSourceTransition;
  }
  if (normalizedDetails.cacheHit === undefined) normalizedDetails.cacheHit = resolvedCacheHit;
  if (normalizedDetails.missingMaster === undefined) normalizedDetails.missingMaster = resolvedMissingMaster;
  if (normalizedDetails.fallbackUsed === undefined) normalizedDetails.fallbackUsed = resolvedFallbackUsed;
  const normalizedPayload = payload
    ? sanitizeAuditPayload({
        ...payload,
        runId: (payload.runId as string | undefined) ?? resolvedRunId,
        traceId: (payload.traceId as string | undefined) ?? resolvedTraceId,
        details: normalizedDetails,
      })
    : payload;

  const record: AuditEventRecord = {
    ...base,
    runId: resolvedRunId ?? base.runId,
    traceId: resolvedTraceId ?? base.traceId,
    facilityId: resolvedFacilityId ?? base.facilityId,
    patientId: undefined,
    appointmentId: undefined,
    claimId: undefined,
    cacheHit: resolvedCacheHit,
    missingMaster: resolvedMissingMaster,
    fallbackUsed: resolvedFallbackUsed,
    dataSourceTransition: resolvedDataSourceTransition,
    payload: normalizedPayload,
    timestamp: new Date().toISOString(),
  };
  auditEventLog.push(record);
  const maskedEvent = maskSensitiveLog(record);
  if (isAuditDevConsoleEnabled && typeof console !== 'undefined') {
    console.info('[audit] event', maskedEvent);
  }
  updateObservabilityMeta({
    runId: record.runId,
    traceId: record.traceId,
    cacheHit: record.cacheHit,
    missingMaster: record.missingMaster,
    dataSourceTransition: record.dataSourceTransition,
    fallbackUsed: record.fallbackUsed,
  });
  return record;
}

export function getAuditEventLog() {
  return [...auditEventLog];
}

export function clearAuditEventLog() {
  auditEventLog.length = 0;
}
