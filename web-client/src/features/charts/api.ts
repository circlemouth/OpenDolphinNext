import type { QueryFunctionContext } from '@tanstack/react-query';

import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { httpFetch } from '../../libs/http/httpClient';
import { ensureObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import type { DataSourceTransition, ResolveMasterSource } from '../../libs/observability/types';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import { parseOrcaApiResponse } from '../shared/orcaApiResponse';
import type { OrcaOutpatientSummary } from '../outpatient/types';
export type { OrcaOutpatientSummary } from '../outpatient/types';

const MEDICAL_SUMMARY_DESCRIPTION = 'charts_medical_summary';
const MEDICAL_SUMMARY_SOURCE_PATH = '/api/local-summary/encounters/{encounterKey}/medical-summary';
const KEY_UNAVAILABLE_SOURCE_PATH = 'key_unavailable';
const LOCAL_SUMMARY_ERROR_CODES = new Set([
  'LOCAL_SUMMARY_TARGET_NOT_FOUND',
  'LOCAL_SUMMARY_PROJECTION_CONFLICT',
  'LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE',
  'LOCAL_SUMMARY_INTERNAL_ERROR',
]);

type LocalMedicalSummarySuccess = {
  requestId?: string;
  traceId?: string;
  runId?: string;
  fetchedAt?: string;
  recordsReturned?: number;
  outcome?: string;
  sourcePath?: string;
  payload?: Record<string, unknown>;
};

type FetchChartsMedicalSummaryOptions = {
  encounterKey?: string;
  preferredSourceOverride?: ResolveMasterSource;
};

const preferredSource = (): ResolveMasterSource | undefined =>
  import.meta.env.VITE_DISABLE_MSW === '1' ? 'server' : undefined;

const resolvedDataSource = (transition?: DataSourceTransition, fallback?: ResolveMasterSource): ResolveMasterSource | undefined =>
  (transition as ResolveMasterSource | undefined) ?? fallback;

const buildBaseSummary = (
  observability = ensureObservabilityMeta(),
  transition: ResolveMasterSource | undefined = preferredSource() ?? 'snapshot',
): OrcaOutpatientSummary => ({
  runId: observability.runId,
  traceId: observability.traceId,
  cacheHit: false,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: transition,
  resolveMasterSource: resolvedDataSource(transition, transition),
  fetchedAt: new Date().toISOString(),
  recordsReturned: 0,
  outcome: 'MISSING',
  payload: { outpatientList: [] as unknown[] },
});

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

const normalizeOutcome = (value: unknown): OrcaOutpatientSummary['outcome'] | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'SUCCESS' || normalized === 'PARTIAL' || normalized === 'MISSING' || normalized === 'ERROR') {
    return normalized;
  }
  return undefined;
};

const normalizePayload = (payload: unknown): Record<string, unknown> => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const asRecord = payload as Record<string, unknown>;
    const outpatientList = Array.isArray(asRecord.outpatientList) ? asRecord.outpatientList : [];
    return { ...asRecord, outpatientList };
  }
  return { outpatientList: [] };
};

const buildRenderableErrorSummary = (
  status: number,
  code: string | undefined,
  message: string | undefined,
  observability = ensureObservabilityMeta(),
  options: FetchChartsMedicalSummaryOptions = {},
): OrcaOutpatientSummary => {
  const transition = options.preferredSourceOverride ?? preferredSource() ?? 'server';
  const summary = buildBaseSummary(observability, transition);
  summary.httpStatus = status;
  summary.outcome = 'ERROR';
  summary.sourcePath = MEDICAL_SUMMARY_SOURCE_PATH;
  summary.note = message ?? code ?? 'medical summary fetch failed';
  summary.apiResult = code;
  summary.apiResultMessage = message;
  summary.auditEvent = {
    errorCode: code,
    message,
  };
  return summary;
};

export function buildUnavailableMedicalSummary(
  _context?: QueryFunctionContext,
  options: FetchChartsMedicalSummaryOptions = {},
): OrcaOutpatientSummary {
  const transition = options.preferredSourceOverride ?? preferredSource() ?? 'snapshot';
  const summary = buildBaseSummary(ensureObservabilityMeta(), transition);
  summary.sourcePath = options.encounterKey ? MEDICAL_SUMMARY_SOURCE_PATH : KEY_UNAVAILABLE_SOURCE_PATH;
  summary.note = options.encounterKey ? 'medical summary unavailable' : 'encounterKey unavailable';
  summary.resolveMasterSource = resolvedDataSource(transition, options.preferredSourceOverride);
  return summary;
}

export async function fetchChartsMedicalSummary(
  context?: QueryFunctionContext,
  options: FetchChartsMedicalSummaryOptions = {},
): Promise<OrcaOutpatientSummary> {
  const encounterKey = normalizeString(options.encounterKey);
  const observability = ensureObservabilityMeta();
  const transition = options.preferredSourceOverride ?? preferredSource() ?? (encounterKey ? 'server' : 'snapshot');
  let summary = buildUnavailableMedicalSummary(context, { ...options, encounterKey, preferredSourceOverride: transition });

  if (encounterKey) {
    const endpoint = `/api/local-summary/encounters/${encodeURIComponent(encounterKey)}/medical-summary`;
    try {
      const response = await httpFetch(endpoint, { method: 'GET' });
      const parsed = await parseOrcaApiResponse(response, {
        notFoundCodes: LOCAL_SUMMARY_ERROR_CODES,
        fallbackMessage: '外来医療サマリの取得に失敗しました。',
      });
      if (parsed.ok) {
        const body = parsed.json as LocalMedicalSummarySuccess | null;
        const payload = normalizePayload(body?.payload);
        summary = {
          ...buildBaseSummary(observability, transition),
          runId: normalizeString(body?.runId) ?? observability.runId,
          traceId: normalizeString(body?.traceId) ?? observability.traceId,
          requestId: normalizeString(body?.requestId),
          fetchedAt: normalizeString(body?.fetchedAt) ?? new Date().toISOString(),
          recordsReturned: normalizeNumber(body?.recordsReturned) ?? 0,
          outcome:
            normalizeOutcome(body?.outcome) ??
            ((payload.outpatientList as unknown[]).length > 0 ? 'SUCCESS' : 'MISSING'),
          sourcePath: MEDICAL_SUMMARY_SOURCE_PATH,
          payload,
          cacheHit: false,
          missingMaster: false,
          fallbackUsed: false,
          dataSourceTransition: transition,
          resolveMasterSource: resolvedDataSource(transition, options.preferredSourceOverride),
          httpStatus: parsed.status,
        };
      } else {
        const errorEnvelope = parsed.json?.error;
        const errorCode =
          normalizeString((errorEnvelope as Record<string, unknown> | undefined)?.code) ??
          normalizeString(parsed.errorCode);
        const errorMessage =
          normalizeString((errorEnvelope as Record<string, unknown> | undefined)?.message) ??
          parsed.message;
        summary = buildRenderableErrorSummary(parsed.status, errorCode, errorMessage, observability, options);
        summary.requestId = normalizeString((errorEnvelope as Record<string, unknown> | undefined)?.requestId);
        summary.traceId =
          normalizeString((errorEnvelope as Record<string, unknown> | undefined)?.traceId) ?? summary.traceId;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'network_error';
      summary = buildRenderableErrorSummary(0, 'LOCAL_SUMMARY_INTERNAL_ERROR', message, observability, options);
    }
  }

  recordOutpatientFunnel('charts_orchestration', {
    runId: summary.runId,
    cacheHit: summary.cacheHit ?? false,
    missingMaster: summary.missingMaster ?? false,
    dataSourceTransition: summary.dataSourceTransition ?? 'snapshot',
    fallbackUsed: summary.fallbackUsed ?? false,
    action: 'medical_fetch',
    outcome: summary.httpStatus !== undefined && summary.httpStatus >= 400 ? 'error' : 'success',
    note: summary.sourcePath,
    reason: summary.apiResultMessage ?? summary.note,
  });

  logUiState({
    action: 'outpatient_fetch',
    screen: 'charts',
    runId: summary.runId,
    cacheHit: summary.cacheHit,
    missingMaster: summary.missingMaster,
    dataSourceTransition: summary.dataSourceTransition,
    fallbackUsed: summary.fallbackUsed,
    details: {
      endpoint: summary.sourcePath,
      fetchedAt: summary.fetchedAt,
      recordsReturned: summary.recordsReturned,
      outcome: summary.outcome,
      resolveMasterSource: summary.resolveMasterSource,
      description: MEDICAL_SUMMARY_DESCRIPTION,
      note: summary.note,
      encounterKey: encounterKey ?? null,
      httpStatus: summary.httpStatus,
    },
  });

  logAuditEvent({
    runId: summary.runId,
    cacheHit: summary.cacheHit,
    missingMaster: summary.missingMaster,
    fallbackUsed: summary.fallbackUsed,
    dataSourceTransition: summary.dataSourceTransition,
    payload: {
      action: 'CHARTS_MEDICAL_SUMMARY_FETCH',
      outcome: summary.httpStatus !== undefined && summary.httpStatus >= 400 ? 'error' : 'success',
      details: {
        runId: summary.runId,
        traceId: summary.traceId,
        requestId: summary.requestId,
        apiResult: summary.apiResult,
        apiResultMessage: summary.apiResultMessage,
        dataSourceTransition: summary.dataSourceTransition,
        cacheHit: summary.cacheHit ?? false,
        missingMaster: summary.missingMaster ?? false,
        fallbackUsed: summary.fallbackUsed ?? false,
        fetchedAt: summary.fetchedAt,
        recordsReturned: summary.recordsReturned,
        outcome: summary.outcome,
        resolveMasterSource: summary.resolveMasterSource,
        sourcePath: summary.sourcePath,
        note: summary.note,
        httpStatus: summary.httpStatus,
        encounterKey: encounterKey ?? null,
      },
    },
  });

  updateObservabilityMeta({
    runId: summary.runId,
    cacheHit: summary.cacheHit,
    missingMaster: summary.missingMaster,
    dataSourceTransition: summary.dataSourceTransition,
    fallbackUsed: summary.fallbackUsed,
    fetchedAt: summary.fetchedAt,
    recordsReturned: summary.recordsReturned,
  });

  return summary;
}
