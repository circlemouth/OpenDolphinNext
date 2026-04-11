import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import type { DataSourceTransition } from '../../libs/observability/types';

export type PatientRecord = {
  patientId?: string;
  name?: string;
  kana?: string;
  birthDate?: string;
  sex?: string;
  phone?: string;
  zip?: string;
  address?: string;
  insurance?: string;
  memo?: string;
  lastVisit?: string;
};

export type PatientSearchParams = {
  keyword?: string;
  searchType?: 'name' | 'kana' | 'patient-id' | 'telephone' | 'zipcode';
  departmentCode?: string;
  physicianCode?: string;
  paymentMode?: 'all' | 'insurance' | 'self';
};

export type PatientListResponse = {
  patients: PatientRecord[];
  runId?: string;
  traceId?: string;
  requestId?: string;
  routeNamespace?: 'official' | 'master' | 'local';
  apiResult?: string;
  apiResultMessage?: string;
  missingTags?: string[];
  cacheHit?: boolean;
  missingMaster?: boolean;
  dataSourceTransition?: DataSourceTransition;
  fallbackUsed?: boolean;
  fetchedAt?: string;
  recordsReturned?: number;
  sourcePath?: string;
  status?: number;
  error?: string;
  auditEvent?: Record<string, unknown>;
  raw?: unknown;
};

export type PatientMutationPayload = {
  patient: PatientRecord;
  operation: 'create' | 'update' | 'delete';
  runId?: string;
  auditMeta?: {
    source?: 'patients' | 'charts';
    section?: 'basic' | 'insurance';
    changedKeys?: string[];
    receptionId?: string;
    appointmentId?: string;
    visitDate?: string;
    actorRole?: string;
  };
};

export type PatientMutationResult = {
  ok: boolean;
  runId?: string;
  traceId?: string;
  requestId?: string;
  routeNamespace?: 'official' | 'master' | 'local';
  cacheHit?: boolean;
  missingMaster?: boolean;
  dataSourceTransition?: DataSourceTransition;
  fallbackUsed?: boolean;
  auditEvent?: Record<string, unknown>;
  message?: string;
  patient?: PatientRecord;
  status?: number;
  sourcePath?: string;
};

const patientInfoCandidates = [
  '/api/local/patients/search',
];
const patientMutationCandidates = [
  '/api/local/patients/mutation',
];

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return undefined;
};

const normalizeApiString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const extractApiResult = (json: Record<string, unknown>): string | undefined => {
  return normalizeApiString(json.apiResult ?? (json as Record<string, unknown>)['Api_Result']);
};

const extractApiResultMessage = (json: Record<string, unknown>): string | undefined => {
  return normalizeApiString(json.apiResultMessage ?? (json as Record<string, unknown>)['Api_Result_Message']);
};

const buildMissingTags = (apiResult?: string, apiResultMessage?: string) => {
  const missing: string[] = [];
  if (!apiResult) missing.push('Api_Result');
  if (!apiResultMessage) missing.push('Api_Result_Message');
  return missing;
};

const normalizeDataSourceTransition = (value: unknown): DataSourceTransition | undefined => {
  return typeof value === 'string' ? (value as DataSourceTransition) : undefined;
};

const inferPatientSearchType = (
  keyword?: string,
): PatientSearchParams['searchType'] | undefined => {
  const normalized = keyword?.trim();
  if (!normalized) return undefined;
  if (/^\d{7}$/.test(normalized)) return 'zipcode';
  if (/^\d[\d-]{8,}$/.test(normalized)) return 'telephone';
  if (/^\d+$/.test(normalized)) return 'patient-id';
  if (/^[ぁ-んァ-ヶー]+$/.test(normalized)) return 'kana';
  return 'name';
};

const stripNullish = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined)) as T;
};

const parsePatients = (json: any): PatientRecord[] => {
  const list: any[] = Array.isArray(json?.patients)
    ? json.patients
    : Array.isArray(json?.patientInformation)
      ? json.patientInformation
      : [];

  const mapOne = (raw: any): PatientRecord => ({
    patientId: raw.patientId ?? raw.Patient_ID ?? raw.patient_id ?? raw.id,
    name: raw.name ?? raw.Patient_Name ?? raw.wholeName,
    kana: raw.kana ?? raw.Patient_Kana ?? raw.wholeNameKana,
    birthDate: raw.birthDate ?? raw.Patient_BirthDate ?? raw.birth,
    sex: raw.sex ?? raw.Patient_Sex ?? raw.gender,
    phone: raw.phone ?? raw.PhoneNumber ?? raw.tel,
    zip: raw.zip ?? raw.postal,
    address: raw.address,
    insurance: raw.insurance ?? raw.insuranceCombinationNumber ?? raw.payCategory,
    memo: raw.memo ?? raw.note ?? raw.comment ?? raw.Patient_Memo ?? raw.patientMemo ?? raw.memoText,
    lastVisit: raw.lastVisit ?? raw.visitDate ?? raw.last_visit,
  });

  return list.map(mapOne).filter((patient) => Object.keys(patient).length > 0);
};

type FetchAttempt =
  | {
      data?: Record<string, unknown>;
      path?: string;
      status?: number;
      error?: undefined;
    }
  | {
      data?: Record<string, unknown>;
      path?: string;
      status?: number;
      error: string;
    };

const tryFetchJson = async (paths: string[], body: Record<string, unknown>): Promise<FetchAttempt | undefined> => {
  let lastFailure: FetchAttempt | undefined;
  for (const path of paths) {
    try {
      const response = await httpFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const status = response.status;
      const data = (await response.json().catch(() => undefined)) as Record<string, unknown> | undefined;
      if (response.ok) {
        return { data, path, status };
      }
      lastFailure = { data, path, status, error: `status ${status}` };
    } catch (error) {
      console.warn('[patients] fetch failed for', path, error);
      lastFailure = { path, error: error instanceof Error ? error.message : String(error) };
    }
  }
  return lastFailure;
};

const tryPostJson = async (paths: string[], body: Record<string, unknown>) => {
  let lastFailure: { json?: Record<string, unknown>; status?: number; path?: string } | undefined;
  for (const path of paths) {
    try {
      const response = await httpFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (response.ok) {
        return { ok: true, json, status: response.status, path };
      }
      lastFailure = { json, status: response.status, path };
    } catch (error) {
      console.warn('[patients] post failed for', path, error);
    }
  }
  return { ok: false, json: lastFailure?.json ?? {}, status: lastFailure?.status, path: lastFailure?.path };
};

export async function fetchPatients(params: PatientSearchParams): Promise<PatientListResponse> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  const searchType = params.searchType ?? inferPatientSearchType(params.keyword);
  const payload: Record<string, unknown> = {
    keyword: params.keyword,
    searchType,
    departmentCode: params.departmentCode,
    physicianCode: params.physicianCode,
    paymentMode: params.paymentMode,
    runId,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  updateObservabilityMeta({ runId });

  const result = await tryFetchJson(patientInfoCandidates, payload);
  const json = (result?.data as Record<string, unknown>) ?? {};
  const traceId = typeof json.traceId === 'string' ? (json.traceId as string) : getObservabilityMeta().traceId;
  const requestId = typeof json.requestId === 'string' ? (json.requestId as string) : undefined;
  const apiResult = extractApiResult(json);
  const apiResultMessage = extractApiResultMessage(json);
  const missingTags = buildMissingTags(apiResult, apiResultMessage);
  const dataSourceTransition = normalizeDataSourceTransition(json.dataSourceTransition);
  const patients = parsePatients(json);
  // P0: Never show sample patient records on a production-reachable screen.
  // When the API returns an empty list (200 + no error), use a proper empty state in the UI instead.
  const resolvedPatients = patients;
  const recordsReturned =
    typeof json.recordsReturned === 'number'
      ? (json.recordsReturned as number)
      : typeof patients.length === 'number'
        ? patients.length
        : undefined;

  const meta: PatientListResponse = {
    patients: resolvedPatients,
    runId: (json.runId as string | undefined) ?? getObservabilityMeta().runId,
    traceId,
    requestId,
    routeNamespace: typeof json.routeNamespace === 'string' ? (json.routeNamespace as PatientListResponse['routeNamespace']) : undefined,
    apiResult,
    apiResultMessage,
    missingTags,
    cacheHit: normalizeBoolean(json.cacheHit),
    missingMaster: normalizeBoolean(json.missingMaster),
    dataSourceTransition,
    fallbackUsed: normalizeBoolean(json.fallbackUsed),
    fetchedAt: typeof json.fetchedAt === 'string' ? (json.fetchedAt as string) : undefined,
    recordsReturned,
    sourcePath: result?.path,
    status: result?.status,
    error: result?.error,
    auditEvent: (json.auditEvent as Record<string, unknown>) ?? undefined,
    raw: json,
  };

  const auditDetails = stripNullish({
    ...(typeof (meta.auditEvent as Record<string, unknown> | undefined)?.details === 'object'
      ? ((meta.auditEvent as Record<string, unknown>).details as Record<string, unknown>)
      : {}),
    runId: meta.runId,
    traceId: meta.traceId,
    requestId: meta.requestId,
    apiResult: meta.apiResult,
    apiResultMessage: meta.apiResultMessage,
    missingTags: meta.missingTags,
    dataSourceTransition: meta.dataSourceTransition,
    cacheHit: meta.cacheHit,
    missingMaster: meta.missingMaster,
    fallbackUsed: meta.fallbackUsed,
    fetchedAt: meta.fetchedAt,
    recordsReturned: meta.recordsReturned,
    sourcePath: meta.sourcePath,
  });

  meta.auditEvent = {
    action: (meta.auditEvent as Record<string, unknown> | undefined)?.action ?? 'LOCAL_PATIENT_SEARCH',
    ...((meta.auditEvent as Record<string, unknown>) ?? {}),
    traceId: meta.traceId,
    details: auditDetails,
  };

  updateObservabilityMeta({
    runId: meta.runId,
    traceId: meta.traceId,
    cacheHit: meta.cacheHit,
    missingMaster: meta.missingMaster,
    dataSourceTransition: meta.dataSourceTransition,
    fallbackUsed: meta.fallbackUsed,
    fetchedAt: meta.fetchedAt,
    recordsReturned: meta.recordsReturned,
  });

  recordOutpatientFunnel('patient_fetch', {
    runId: meta.runId,
    cacheHit: meta.cacheHit ?? false,
    missingMaster: meta.missingMaster ?? false,
    dataSourceTransition: meta.dataSourceTransition ?? 'local',
    fallbackUsed: meta.fallbackUsed ?? false,
    action: 'patient_fetch',
    outcome: meta.error ? 'error' : 'success',
    note: meta.error ?? meta.sourcePath,
    reason: meta.error ?? undefined,
  });

  logAuditEvent({
    runId: meta.runId,
    source: 'patient-fetch',
    cacheHit: meta.cacheHit,
    missingMaster: meta.missingMaster,
    dataSourceTransition: meta.dataSourceTransition,
    fallbackUsed: meta.fallbackUsed,
    payload: meta.auditEvent as Record<string, unknown> | undefined,
  });

  logUiState({
    action: 'patient_fetch',
    screen: 'patients',
    runId: meta.runId,
    cacheHit: meta.cacheHit,
    missingMaster: meta.missingMaster,
    dataSourceTransition: meta.dataSourceTransition,
    fallbackUsed: meta.fallbackUsed,
    details: {
      fetchedAt: meta.fetchedAt,
      recordsReturned: meta.recordsReturned,
      endpoint: meta.sourcePath,
      status: meta.status,
      error: meta.error,
    },
  });

  return meta;
}

export async function savePatient(payload: PatientMutationPayload): Promise<PatientMutationResult> {
  const runId = payload.runId ?? getObservabilityMeta().runId ?? generateRunId();
  const auditEvent = {
    operation: payload.operation,
    runId,
    patientId: payload.patient.patientId,
    timestamp: new Date().toISOString(),
    source: payload.auditMeta?.source ?? 'patients',
    section: payload.auditMeta?.section,
    changedKeys: payload.auditMeta?.changedKeys,
    receptionId: payload.auditMeta?.receptionId,
    appointmentId: payload.auditMeta?.appointmentId,
    visitDate: payload.auditMeta?.visitDate,
    actorRole: payload.auditMeta?.actorRole,
  };
  const body = {
    operation: payload.operation,
    patient: stripNullish({
      patientId: payload.patient.patientId,
      wholeName: payload.patient.name,
      wholeNameKana: payload.patient.kana,
      birthDate: payload.patient.birthDate,
      sex: payload.patient.sex,
      telephone: payload.patient.phone,
      zipCode: payload.patient.zip,
      addressLine: payload.patient.address,
    }),
    auditEvent,
    runId,
  };
  updateObservabilityMeta({ runId });

  const postResult = await tryPostJson(patientMutationCandidates, body);
  const json = postResult.json ?? {};
  const serverAuditEvent = (json.auditEvent as Record<string, unknown> | undefined) ?? undefined;
  const traceId = typeof json.traceId === 'string' ? (json.traceId as string) : getObservabilityMeta().traceId;
  const requestId = typeof json.requestId === 'string' ? (json.requestId as string) : undefined;
  const dataSourceTransition = normalizeDataSourceTransition(json.dataSourceTransition);
  const result: PatientMutationResult = {
    ok: postResult.ok,
    runId: (json.runId as string | undefined) ?? runId,
    traceId,
    requestId,
    routeNamespace: typeof json.routeNamespace === 'string' ? (json.routeNamespace as PatientMutationResult['routeNamespace']) : undefined,
    cacheHit: normalizeBoolean(json.cacheHit),
    missingMaster: normalizeBoolean(json.missingMaster),
    dataSourceTransition,
    fallbackUsed: normalizeBoolean(json.fallbackUsed),
    auditEvent: serverAuditEvent,
    message: (json.apiResultMessage as string | undefined) ?? (postResult.ok ? '保存しました' : '保存に失敗しました'),
    patient: json.patient as PatientRecord | undefined,
    status: postResult.status,
    sourcePath: postResult.path,
  };

  const serverDetails =
    serverAuditEvent && typeof serverAuditEvent.details === 'object' && serverAuditEvent.details !== null
      ? (serverAuditEvent.details as Record<string, unknown>)
      : {};

  const normalizedDetails = stripNullish({
    ...serverDetails,
    operation: payload.operation,
    source: payload.auditMeta?.source ?? 'patients',
    section: payload.auditMeta?.section,
    changedKeys: payload.auditMeta?.changedKeys,
    patientId: payload.patient.patientId,
    receptionId: payload.auditMeta?.receptionId,
    appointmentId: payload.auditMeta?.appointmentId,
    visitDate: payload.auditMeta?.visitDate,
    actorRole: payload.auditMeta?.actorRole,
    traceId: result.traceId,
    requestId: result.requestId,
    status: result.status,
    sourcePath: result.sourcePath,
    dataSourceTransition: result.dataSourceTransition,
    outcome: result.ok ? 'success' : 'error',
    message: result.message,
  }) as Record<string, unknown>;

  result.auditEvent = {
    action: (serverAuditEvent?.action as string | undefined) ?? 'LOCAL_PATIENT_MUTATION',
    outcome: (serverAuditEvent?.outcome as string | undefined) ?? (result.ok ? 'success' : 'error'),
    subject: (serverAuditEvent?.subject as string | undefined) ?? (payload.auditMeta?.source ?? 'patients'),
    runId: (serverAuditEvent?.runId as string | undefined) ?? result.runId,
    traceId: (serverAuditEvent?.traceId as string | undefined) ?? result.traceId,
    details: normalizedDetails,
  };

  updateObservabilityMeta({
    runId: result.runId,
    traceId: result.traceId,
    cacheHit: result.cacheHit,
    missingMaster: result.missingMaster,
    dataSourceTransition: result.dataSourceTransition,
    fallbackUsed: result.fallbackUsed,
  });

  recordOutpatientFunnel('patient_save', {
    runId: result.runId,
    cacheHit: result.cacheHit ?? false,
    missingMaster: result.missingMaster ?? false,
    dataSourceTransition: result.dataSourceTransition ?? 'local',
    fallbackUsed: result.fallbackUsed ?? false,
    action: `patient_save_${payload.operation}`,
    outcome: result.ok ? 'success' : 'error',
    note: result.ok ? (result.sourcePath ?? '') : `${result.sourcePath ?? ''} status=${result.status ?? 'unknown'}`,
    reason: result.ok ? undefined : result.message ?? result.sourcePath,
  });

  logAuditEvent({
    runId: result.runId,
    source: 'patient-save',
    cacheHit: result.cacheHit,
    missingMaster: result.missingMaster,
    fallbackUsed: result.fallbackUsed,
    dataSourceTransition: result.dataSourceTransition,
    payload: result.auditEvent,
  });

  logUiState({
    action: 'patient_save',
    screen: payload.auditMeta?.source ?? 'patients',
    controlId: `patient_save_${payload.operation}`,
    runId: result.runId,
    cacheHit: result.cacheHit,
    missingMaster: result.missingMaster,
    fallbackUsed: result.fallbackUsed,
    dataSourceTransition: result.dataSourceTransition,
    details: normalizedDetails,
  });

  return result;
}
