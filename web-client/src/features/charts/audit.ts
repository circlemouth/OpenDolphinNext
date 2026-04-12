import { logAuditEvent, type AuditEventRecord } from '../../libs/audit/auditLogger';
import { getObservabilityMeta } from '../../libs/observability/observability';
import type { DataSourceTransition } from './authService';

export type ChartsAuditAction =
  | 'CHARTS_PATIENT_SWITCH'
  | 'CHARTS_PATIENT_EDIT_GUARD'
  | 'CHARTS_NAVIGATE_RECEPTION'
  | 'CHARTS_EDIT_LOCK'
  | 'CHARTS_CONFLICT'
  | 'ORCA_QUEUE_STATUS'
  | 'ENCOUNTER_START'
  | 'ENCOUNTER_PAUSE'
  | 'ORCA_SEND'
  | 'ENCOUNTER_CLOSE'
  | 'DRAFT_SAVE'
  | 'DRAFT_CANCEL'
  | 'CHARTS_DOCUMENT_CREATE'
  | 'CHARTS_DOCUMENT_CANCEL'
  | 'chart_image_attach'
  | 'document_template_reuse'
  | 'PRINT_OUTPATIENT'
  | 'PRINT_DOCUMENT'
  | 'SOAP_TEMPLATE_APPLY'
  | 'SOAP_NOTE_SAVE'
  | 'SOAP_NOTE_UPDATE'
  | 'CHARTS_ACTION_FAILURE'
  | 'LOCAL_DISEASE_DIRECT_SEND'
  | 'ORCA_OFFICIAL_MEDICAL_DIRECT_SEND'
  | 'LOCAL_CHART_SUBJECTIVES_LIST'
  | 'LOCAL_CHART_SUBJECTIVES_MUTATION'
  | 'ORCA_OFFICIAL_CONTRAINDICATION_CHECK'
  | 'ORCA_REPORT_PRINT'
  | 'prescription_print';

export type ChartsAuditOutcome =
  | 'success'
  | 'warning'
  | 'error'
  | 'blocked'
  | 'started'
  | 'acquired'
  | 'renewed'
  | 'stolen'
  | 'conflict'
  | 'released'
  | 'expired'
  | 'discarded'
  | 'resolved';

export type ChartsOperationPhase = 'approval' | 'lock' | 'do' | 'save' | 'expand' | 'expand_continue';

export const CRITICAL_CHARTS_ACTIONS: ChartsAuditAction[] = [
  'CHARTS_PATIENT_SWITCH',
  'ORCA_SEND',
  'ENCOUNTER_CLOSE',
  'PRINT_OUTPATIENT',
  'PRINT_DOCUMENT',
  'ORCA_REPORT_PRINT',
  'prescription_print',
  'CHARTS_ACTION_FAILURE',
];

type AuditContext = {
  runId?: string;
  traceId?: string;
  requestId?: string;
  dataSourceTransition?: DataSourceTransition;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
};

type ChartsAuditParams = AuditContext & {
  action: ChartsAuditAction;
  outcome: ChartsAuditOutcome;
  subject?: string;
  actor?: string;
  patientId?: string;
  appointmentId?: string;
  note?: string;
  durationMs?: number;
  error?: string;
  details?: Record<string, unknown>;
};

const ALLOWED_DETAIL_KEYS = new Set([
  'runId',
  'traceId',
  'requestId',
  'encounterKey',
  'idempotencyKey',
  'actor',
  'facilityId',
  'userId',
  'dataSource',
  'dataSourceTransition',
  'cacheHit',
  'missingMaster',
  'fallbackUsed',
  'patientId',
  'appointmentId',
  'claimId',
  'receptionId',
  'note',
  'durationMs',
  'error',
  'subject',
  'lockRequestId',
  'documentVersion',
  'lockOwnerUserId',
  'lockOwnerName',
  'lockOwnerRunId',
  'lockExpiresAt',
  'trigger',
  'resolution',
  'tabSessionId',
  'queueSource',
  'queueEntries',
  'fetchedAt',
  'counts',
  'selectedSendStatus',
  'operationPhase',
  'approvalState',
  'lockStatus',
  'blockedReasons',
  'fallbackPatientId',
  'fallbackAppointmentId',
  'fallbackReceptionId',
  'soapSection',
  'templateId',
  'authoredAt',
  'authorRole',
  'authorName',
  'soapLength',
  'documentType',
  'documentTitle',
  'documentIssuedAt',
  'documentId',
  'attachmentId',
  'attachmentIds',
  'missingFields',
  'missingTags',
  'stampSource',
  'stampId',
  'stampName',
  'entity',
  'endpoint',
  'httpStatus',
  'apiResult',
  'apiResultMessage',
  'outcome',
  'outputMode',
  'visitDate',
  'inputSource',
  'hasRawXml',
  'performMonth',
  'reportType',
  'reportLabel',
  'dataId',
  'invoiceNumber',
  'insuranceCombinationNumber',
  'detailRecord',
  'departmentCode',
  'checkTerm',
  'requestNumber',
  'doCopy',
  'section',
  'sourceAuthoredAt',
  'sourceAuthorRole',
]);

type ChartsAuditDetails = Record<string, unknown> & {
  runId?: string;
  traceId?: string;
  requestId?: string;
  actor?: string;
  dataSource?: DataSourceTransition;
  dataSourceTransition?: DataSourceTransition;
  cacheHit?: boolean;
  missingMaster?: boolean;
  fallbackUsed?: boolean;
  patientId?: string;
  appointmentId?: string;
  note?: string;
  durationMs?: number;
  error?: string;
};

const sanitizeDetails = (details: Record<string, unknown>): ChartsAuditDetails => {
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => ALLOWED_DETAIL_KEYS.has(key)),
  ) as ChartsAuditDetails;
};

const resolveDataSource = ({
  dataSourceTransition,
  cacheHit,
  fallbackUsed,
}: {
  dataSourceTransition?: DataSourceTransition;
  cacheHit?: boolean;
  fallbackUsed?: boolean;
}) => {
  if (dataSourceTransition) return dataSourceTransition;
  if (cacheHit) return 'cache';
  if (fallbackUsed) return 'fallback';
  return undefined;
};

const toBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const isDataSourceTransition = (value: unknown): value is DataSourceTransition =>
  value === 'mock' || value === 'snapshot' || value === 'server' || value === 'fallback';

const buildDetails = (params: ChartsAuditParams) => {
  const meta = getObservabilityMeta();
  const cacheHit = params.cacheHit ?? meta.cacheHit ?? false;
  const missingMaster = params.missingMaster ?? meta.missingMaster ?? false;
  const fallbackUsed = params.fallbackUsed ?? meta.fallbackUsed ?? false;
  const dataSourceTransition = params.dataSourceTransition ?? meta.dataSourceTransition;
  return sanitizeDetails({
    runId: params.runId ?? meta.runId,
    traceId: params.traceId ?? meta.traceId,
    requestId: params.requestId,
    actor: params.actor,
    dataSource: resolveDataSource({ dataSourceTransition, cacheHit, fallbackUsed }),
    dataSourceTransition,
    cacheHit,
    missingMaster,
    fallbackUsed,
    patientId: params.patientId,
    appointmentId: params.appointmentId,
    note: params.note,
    durationMs: params.durationMs,
    error: params.error,
    ...(params.details ?? {}),
  });
};

export function recordChartsAuditEvent(params: ChartsAuditParams) {
  const details = buildDetails(params);
  logAuditEvent({
    runId: details.runId,
    cacheHit: details.cacheHit,
    missingMaster: details.missingMaster,
    dataSourceTransition: details.dataSourceTransition,
    fallbackUsed: details.fallbackUsed,
    payload: {
      action: params.action,
      outcome: params.outcome,
      subject: params.subject,
      details,
    },
  });
}

export function normalizeAuditEventPayload(
  auditEvent: Record<string, unknown> | undefined,
  meta: AuditContext,
): Record<string, unknown> | undefined {
  if (!auditEvent) return undefined;
  const base = { ...auditEvent };
  const rawDetails = typeof base.details === 'object' && base.details !== null ? base.details : {};
  const rawDetailsMap = rawDetails as Record<string, unknown>;
  const cacheHit = toBoolean(rawDetailsMap.cacheHit) ?? toBoolean(rawDetailsMap.cache) ?? meta.cacheHit ?? false;
  const fallbackUsed = toBoolean(rawDetailsMap.fallbackUsed) ?? meta.fallbackUsed ?? false;
  const rawTransition = rawDetailsMap.dataSourceTransition;
  const dataSourceTransition = (isDataSourceTransition(rawTransition) ? rawTransition : undefined) ?? meta.dataSourceTransition;
  const rawDataSource = rawDetailsMap.dataSource;
  const dataSource = isDataSourceTransition(rawDataSource)
    ? rawDataSource
    : resolveDataSource({ dataSourceTransition, cacheHit, fallbackUsed });
  const mergedDetails = {
    runId: (rawDetails as Record<string, unknown>).runId ?? meta.runId,
    traceId: (rawDetails as Record<string, unknown>).traceId ?? meta.traceId,
    requestId: (rawDetails as Record<string, unknown>).requestId ?? meta.requestId,
    dataSource,
    dataSourceTransition,
    cacheHit,
    missingMaster: toBoolean(rawDetailsMap.missingMaster) ?? meta.missingMaster ?? false,
    fallbackUsed,
    ...rawDetails,
  };

  const sanitizedDetails = sanitizeDetails(mergedDetails);
  return { ...base, runId: base.runId ?? sanitizedDetails.runId, details: sanitizedDetails };
}

export function normalizeAuditEventLog(
  record: AuditEventRecord | undefined,
  meta: AuditContext,
): Record<string, unknown> | undefined {
  if (!record) return undefined;
  const payload =
    (record.payload as Record<string, unknown> | undefined) ??
    (record as unknown as Record<string, unknown>);
  return normalizeAuditEventPayload(payload, meta);
}
