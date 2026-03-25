import type { QueryFunctionContext } from '@tanstack/react-query';

import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { ensureObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import type { DataSourceTransition, ResolveMasterSource } from '../../libs/observability/types';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import type { OrcaOutpatientSummary } from '../outpatient/types';
export type { OrcaOutpatientSummary } from '../outpatient/types';

const MEDICAL_SUMMARY_DESCRIPTION = 'charts_medical_summary';
const MEDICAL_SUMMARY_SOURCE_PATH = 'contract_removed';
const MEDICAL_SUMMARY_NOTE = 'server replacement route unavailable';

const preferredSource = (): ResolveMasterSource | undefined =>
  import.meta.env.VITE_DISABLE_MSW === '1' ? 'server' : undefined;

const resolvedDataSource = (transition?: DataSourceTransition, fallback?: ResolveMasterSource): ResolveMasterSource | undefined =>
  (transition as ResolveMasterSource | undefined) ?? fallback;

export function buildUnavailableMedicalSummary(
  _context?: QueryFunctionContext,
  options: { preferredSourceOverride?: ResolveMasterSource } = {},
): OrcaOutpatientSummary {
  const observability = ensureObservabilityMeta();
  const fetchedAt = new Date().toISOString();
  const transition = options.preferredSourceOverride ?? preferredSource() ?? 'snapshot';
  const payload = { outpatientList: [] as unknown[] };
  return {
    runId: observability.runId,
    traceId: observability.traceId,
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: transition,
    resolveMasterSource: resolvedDataSource(transition, options.preferredSourceOverride),
    fetchedAt,
    recordsReturned: 0,
    outcome: 'MISSING',
    sourcePath: MEDICAL_SUMMARY_SOURCE_PATH,
    note: MEDICAL_SUMMARY_NOTE,
    payload,
  };
}

export async function fetchChartsMedicalSummary(
  context?: QueryFunctionContext,
  options: { preferredSourceOverride?: ResolveMasterSource } = {},
): Promise<OrcaOutpatientSummary> {
  const summary = buildUnavailableMedicalSummary(context, options);
  recordOutpatientFunnel('charts_orchestration', {
    runId: summary.runId,
    cacheHit: summary.cacheHit ?? false,
    missingMaster: summary.missingMaster ?? false,
    dataSourceTransition: summary.dataSourceTransition ?? 'snapshot',
    fallbackUsed: summary.fallbackUsed ?? false,
    action: 'medical_fetch',
    outcome: 'success',
    note: summary.sourcePath,
    reason: summary.note,
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
      outcome: 'success',
      details: {
        runId: summary.runId,
        traceId: summary.traceId,
        requestId: summary.requestId,
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
