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

export type LocalPatientSearchParams = {
  keyword?: string;
  searchType?: 'name' | 'kana' | 'patient-id' | 'telephone' | 'zipcode';
};

type PatientAuditMeta = {
  source?: 'patients' | 'charts';
  section?: 'basic' | 'insurance';
  changedKeys?: string[];
  receptionId?: string;
  appointmentId?: string;
  visitDate?: string;
  actorRole?: string;
};

export type OfficialPatientCreatePayload = {
  patient: PatientRecord;
  runId?: string;
  auditMeta?: PatientAuditMeta;
};

export type OfficialPatientUpdatePayload = {
  patient: PatientRecord;
  runId?: string;
  auditMeta?: PatientAuditMeta;
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

export type PatientMutationResult = {
  ok: boolean;
  writeAccepted?: boolean;
  errorCategory?: string;
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
  canonicalPatient?: PatientRecord;
  canonicalRefetch?: {
    source: 'patientlst2v2';
    ok: boolean;
    status?: number;
    apiResult?: string;
    apiResultMessage?: string;
    expectedPatientIds?: string[];
    matchedPatientIds?: string[];
    missingPatientIds?: string[];
  };
};

const LOCAL_PATIENT_SEARCH_ENDPOINTS = ['/api/local/patients/search'];
const PATIENT_CREATE_OFFICIAL_ENDPOINT = '/api/orca/official/patientmodv2/outpatient/create';
const PATIENT_UPDATE_OFFICIAL_ENDPOINT = '/api/orca/official/patientmodv2/outpatient/update';
const PATIENT_BATCH_OFFICIAL_ENDPOINT = '/api/orca/official/patients/batch';
const PATIENT_INSURANCE_COMBINATION_OFFICIAL_ENDPOINT = '/api/orca/official/insurance/combinations';
const REDACTED_COMBINATION_ID = '<<redacted>>';
type OfficialPatientMutationOperation = 'create' | 'update';

export type OfficialPatientExactExistenceResult = {
  ok: boolean;
  patientId: string;
  status?: number;
  apiResult?: string;
  apiResultMessage?: string;
  exactMatchedPatientIds: string[];
  missingPatientIds: string[];
  sourcePath?: string;
  error?: string;
};

export type OfficialInsuranceReadinessResult = {
  ok: boolean;
  patientId: string;
  count: number;
  effectiveCount: number;
  selectedCombinationId?: '<<redacted>>';
  status?: number;
  apiResult?: string;
  sourcePath?: string;
  error?: string;
};

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return undefined;
};

const normalizeApiString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const extractApiResult = (json: Record<string, unknown>): string | undefined => {
  return normalizeApiString(json.apiResult);
};

const extractApiResultMessage = (json: Record<string, unknown>): string | undefined => {
  return normalizeApiString(json.apiResultMessage);
};

const isAllZeroApiResult = (apiResult?: string) => Boolean(apiResult && /^[0]+$/.test(apiResult));

const buildMissingTags = (apiResult?: string, apiResultMessage?: string) => {
  const missing: string[] = [];
  if (!apiResult) missing.push('apiResult');
  if (!apiResultMessage) missing.push('apiResultMessage');
  return missing;
};

const normalizeDataSourceTransition = (value: unknown): DataSourceTransition | undefined => {
  return typeof value === 'string' ? (value as DataSourceTransition) : undefined;
};

const inferPatientSearchType = (
  keyword?: string,
): LocalPatientSearchParams['searchType'] | undefined => {
  const normalized = keyword?.trim();
  if (!normalized) return undefined;
  if (/^\d{3}-\d{4}$/.test(normalized)) return 'zipcode';
  if (/^\d[\d-]{8,}$/.test(normalized)) return 'telephone';
  if (/^\d+$/.test(normalized)) return 'patient-id';
  if (/^[ぁ-んァ-ヶー]+$/.test(normalized)) return 'kana';
  return 'name';
};

const stripNullish = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined)) as T;
};

const asObjectRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
};

const normalizeDateDigits = (value: unknown): string | undefined => {
  const normalized = normalizeApiString(value)?.replace(/\D/g, '');
  return normalized && normalized.length >= 8 ? normalized.slice(0, 8) : undefined;
};

const isCombinationEffectiveOn = (combination: Record<string, unknown>, baseDate: string) => {
  const base = normalizeDateDigits(baseDate);
  if (!base) return false;
  const start = normalizeDateDigits(combination.certificateStartDate);
  const end = normalizeDateDigits(combination.certificateExpiredDate);
  return (!start || start <= base) && (!end || end >= base || /^9+$/.test(end));
};

const mapLocalPatient = (raw: any): PatientRecord => ({
  patientId: normalizeApiString(raw?.patientId),
  name: normalizeApiString(raw?.name),
  kana: normalizeApiString(raw?.kana),
  birthDate: normalizeApiString(raw?.birthDate),
  sex: normalizeApiString(raw?.sex),
  phone: normalizeApiString(raw?.phone),
  zip: normalizeApiString(raw?.zip),
  address: normalizeApiString(raw?.address),
  insurance: normalizeApiString(raw?.insurance),
  memo: normalizeApiString(raw?.memo),
  lastVisit: normalizeApiString(raw?.lastVisit),
});

const mapCanonicalPatient = (raw: any): PatientRecord => {
  const summary = raw?.summary ?? {};
  return {
    patientId: normalizeApiString(summary?.patientId),
    name: normalizeApiString(summary?.wholeName),
    kana: normalizeApiString(summary?.wholeNameKana),
    birthDate: normalizeApiString(summary?.birthDate),
    sex: normalizeApiString(summary?.sex) === '1' ? 'M' : normalizeApiString(summary?.sex) === '2' ? 'F' : normalizeApiString(summary?.sex),
    phone: normalizeApiString(raw?.phoneNumber1 ?? raw?.phoneNumber2),
    zip: normalizeApiString(raw?.zipCode),
    address: normalizeApiString(raw?.address),
  };
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

const tryPostJson = async (path: string, body: Record<string, unknown>) => {
  try {
    const response = await httpFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, json, status: response.status, path };
  } catch (error) {
    console.warn('[patients] post failed for', path, error);
    return { ok: false, json: {}, status: undefined, path };
  }
};

const resolveOfficialPatientId = (
  operation: OfficialPatientMutationOperation,
  patientId: string | undefined,
) => {
  const normalized = normalizeApiString(patientId);
  if (operation === 'create') {
    return normalized ?? '*';
  }
  return normalized;
};

const buildOfficialPatientBody = (
  payload: OfficialPatientCreatePayload | OfficialPatientUpdatePayload,
  runId: string,
  operation: OfficialPatientMutationOperation,
) => {
  return stripNullish({
    runId,
    patient: stripNullish({
      patientId: resolveOfficialPatientId(operation, payload.patient.patientId),
      wholeName: payload.patient.name?.trim() || undefined,
      wholeNameKana: payload.patient.kana?.trim() || undefined,
      birthDate: payload.patient.birthDate?.trim() || undefined,
      sex: payload.patient.sex?.trim() || undefined,
      telephone: payload.patient.phone?.trim() || undefined,
      zipCode: payload.patient.zip?.trim() || undefined,
      addressLine: payload.patient.address?.trim() || undefined,
    }),
    auditMeta: payload.auditMeta
      ? stripNullish({
          source: payload.auditMeta.source,
          section: payload.auditMeta.section,
          changedKeys: payload.auditMeta.changedKeys,
          receptionId: payload.auditMeta.receptionId,
          appointmentId: payload.auditMeta.appointmentId,
          visitDate: payload.auditMeta.visitDate,
          actorRole: payload.auditMeta.actorRole,
        })
      : undefined,
  });
};

export async function refetchOfficialCanonicalPatients(params: {
  patientIds: string[];
  runId?: string;
}): Promise<{
  ok: boolean;
  patients: PatientRecord[];
  status?: number;
  apiResult?: string;
  apiResultMessage?: string;
  matchedPatientIds: string[];
  missingPatientIds: string[];
}> {
  const patientIds = params.patientIds.map((value) => value.trim()).filter(Boolean);
  if (patientIds.length === 0) {
    return { ok: false, patients: [], status: 0, matchedPatientIds: [], missingPatientIds: [] };
  }
  const runId = params.runId ?? getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const result = await tryPostJson(PATIENT_BATCH_OFFICIAL_ENDPOINT, {
    patientIds,
    includeInsurance: false,
  });
  const json = asObjectRecord(result.json);
  const apiResult = extractApiResult(json);
  const apiResultMessage = extractApiResultMessage(json);
  const list = Array.isArray(json.patients) ? (json.patients as any[]) : [];
  const patients = list.map(mapCanonicalPatient).filter((patient) => Object.values(patient).some(Boolean));
  const requestedPatientIds = new Set(patientIds);
  const matchedPatientIds = Array.from(new Set(patients
    .map((patient) => normalizeApiString(patient.patientId))
    .filter((patientId): patientId is string => {
      return typeof patientId === 'string' && requestedPatientIds.has(patientId);
    })));
  const missingPatientIds = patientIds.filter((patientId) => !matchedPatientIds.includes(patientId));
  return {
    ok: result.ok && isAllZeroApiResult(apiResult) && missingPatientIds.length === 0,
    patients,
    status: result.status,
    apiResult,
    apiResultMessage,
    matchedPatientIds,
    missingPatientIds,
  };
}

export async function verifyOfficialPatientExactExistence(params: {
  patientId: string;
  runId?: string;
}): Promise<OfficialPatientExactExistenceResult> {
  const patientId = params.patientId.trim();
  if (!patientId) {
    return {
      ok: false,
      patientId,
      exactMatchedPatientIds: [],
      missingPatientIds: [],
      error: 'patientId is required',
    };
  }
  const result = await refetchOfficialCanonicalPatients({
    patientIds: [patientId],
    runId: params.runId,
  });
  const exactMatchedPatientIds = result.matchedPatientIds.filter((matchedPatientId) => matchedPatientId === patientId);
  const missingPatientIds = exactMatchedPatientIds.length === 1 ? [] : [patientId];
  return {
    ok: result.ok && exactMatchedPatientIds.length === 1,
    patientId,
    status: result.status,
    apiResult: result.apiResult,
    apiResultMessage: result.apiResultMessage,
    exactMatchedPatientIds,
    missingPatientIds,
  };
}

export async function fetchOfficialInsuranceReadiness(params: {
  patientId: string;
  baseDate: string;
  runId?: string;
}): Promise<OfficialInsuranceReadinessResult> {
  const patientId = params.patientId.trim();
  if (!patientId) {
    return {
      ok: false,
      patientId,
      count: 0,
      effectiveCount: 0,
      error: 'patientId is required',
    };
  }
  const runId = params.runId ?? getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const result = await tryPostJson(PATIENT_INSURANCE_COMBINATION_OFFICIAL_ENDPOINT, {
    patientId,
    baseDate: params.baseDate,
  });
  const json = asObjectRecord(result.json);
  const apiResult = extractApiResult(json);
  const combinations = Array.isArray(json.combinations) ? (json.combinations as Array<Record<string, unknown>>) : [];
  const effectiveCount = combinations.filter((combination) => isCombinationEffectiveOn(combination, params.baseDate)).length;
  return {
    ok: result.ok && isAllZeroApiResult(apiResult) && effectiveCount > 0,
    patientId,
    count: combinations.length,
    effectiveCount,
    selectedCombinationId: effectiveCount > 0 ? REDACTED_COMBINATION_ID : undefined,
    status: result.status,
    apiResult,
    sourcePath: result.path,
  };
}

export async function searchLocalPatients(params: LocalPatientSearchParams): Promise<PatientListResponse> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  const searchType = params.searchType ?? inferPatientSearchType(params.keyword);
  const payload: Record<string, unknown> = {
    keyword: params.keyword,
    searchType,
    runId,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  updateObservabilityMeta({ runId });

  const result = await tryFetchJson(LOCAL_PATIENT_SEARCH_ENDPOINTS, payload);
  const json = (result?.data as Record<string, unknown>) ?? {};
  const traceId = typeof json.traceId === 'string' ? (json.traceId as string) : getObservabilityMeta().traceId;
  const requestId = typeof json.requestId === 'string' ? (json.requestId as string) : undefined;
  const apiResult = extractApiResult(json);
  const apiResultMessage = extractApiResultMessage(json);
  const missingTags = buildMissingTags(apiResult, apiResultMessage);
  const dataSourceTransition = normalizeDataSourceTransition(json.dataSourceTransition);
  const patients = Array.isArray(json.patients) ? (json.patients as any[]).map(mapLocalPatient) : [];
  const recordsReturned =
    typeof json.recordsReturned === 'number'
      ? (json.recordsReturned as number)
      : typeof patients.length === 'number'
        ? patients.length
        : undefined;

  const meta: PatientListResponse = {
    patients,
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
    action: 'patient_search',
    outcome: meta.error ? 'error' : 'success',
    note: meta.error ?? meta.sourcePath,
    reason: meta.error ?? undefined,
  });

  logAuditEvent({
    runId: meta.runId,
    source: 'patient-local-search',
    cacheHit: meta.cacheHit,
    missingMaster: meta.missingMaster,
    dataSourceTransition: meta.dataSourceTransition,
    fallbackUsed: meta.fallbackUsed,
    payload: meta.auditEvent as Record<string, unknown> | undefined,
  });

  logUiState({
    action: 'patient_search',
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

const performOfficialPatientMutation = async (
  endpoint: string,
  payload: OfficialPatientCreatePayload | OfficialPatientUpdatePayload,
  operation: 'create' | 'update',
): Promise<PatientMutationResult> => {
  const runId = payload.runId ?? getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });

  const postResult = await tryPostJson(endpoint, buildOfficialPatientBody(payload, runId, operation));
  const json = asObjectRecord(postResult.json);
  const serverAuditEvent = asObjectRecord(json.auditEvent);
  const traceId = typeof json.traceId === 'string' ? (json.traceId as string) : getObservabilityMeta().traceId;
  const requestId = typeof json.requestId === 'string' ? (json.requestId as string) : undefined;
  const dataSourceTransition = normalizeDataSourceTransition(json.dataSourceTransition);
  const writeAccepted = postResult.ok;
  const result: PatientMutationResult = {
    ok: false,
    writeAccepted,
    runId: (json.runId as string | undefined) ?? runId,
    traceId,
    requestId,
    routeNamespace: typeof json.routeNamespace === 'string' ? (json.routeNamespace as PatientMutationResult['routeNamespace']) : undefined,
    cacheHit: normalizeBoolean(json.cacheHit),
    missingMaster: normalizeBoolean(json.missingMaster),
    dataSourceTransition,
    fallbackUsed: normalizeBoolean(json.fallbackUsed),
    auditEvent: Object.keys(serverAuditEvent).length > 0 ? serverAuditEvent : undefined,
    message: undefined,
    patient: json.patient ? mapLocalPatient(json.patient) : undefined,
    status: postResult.status,
    sourcePath: postResult.path,
  };

  const patientIdForCanonical = normalizeApiString(result.patient?.patientId ?? payload.patient.patientId);
  if (writeAccepted && patientIdForCanonical) {
    const canonicalRefetch = await refetchOfficialCanonicalPatients({
      patientIds: [patientIdForCanonical],
      runId: result.runId,
    });
    result.canonicalPatient =
      canonicalRefetch.patients.find((patient) => normalizeApiString(patient.patientId) === patientIdForCanonical)
      ?? canonicalRefetch.patients[0];
    result.canonicalRefetch = {
      source: 'patientlst2v2',
      ok: canonicalRefetch.ok && canonicalRefetch.matchedPatientIds.includes(patientIdForCanonical),
      status: canonicalRefetch.status,
      apiResult: canonicalRefetch.apiResult,
      apiResultMessage: canonicalRefetch.apiResultMessage,
      expectedPatientIds: [patientIdForCanonical],
      matchedPatientIds: canonicalRefetch.matchedPatientIds,
      missingPatientIds: canonicalRefetch.missingPatientIds,
    };
  } else if (writeAccepted) {
    result.canonicalRefetch = {
      source: 'patientlst2v2',
      ok: false,
      expectedPatientIds: patientIdForCanonical ? [patientIdForCanonical] : [],
      matchedPatientIds: [],
      missingPatientIds: patientIdForCanonical ? [patientIdForCanonical] : [],
    };
  }
  result.ok = writeAccepted && Boolean(result.canonicalRefetch?.ok);
  result.message =
    writeAccepted
      ? result.ok
        ? (operation === 'create'
          ? '新患登録と canonical 再取得が完了しました。'
          : '既存患者更新と canonical 再取得が完了しました。')
        : (operation === 'create'
          ? '新患登録は受け付けられましたが、canonical 再取得に失敗したため完了扱いにできません。'
          : '既存患者更新は受け付けられましたが、canonical 再取得に失敗したため完了扱いにできません。')
      : ((json.apiResultMessage as string | undefined)
        ?? (operation === 'create' ? '新患登録に失敗しました。' : '既存患者更新に失敗しました。'));
  result.errorCategory =
    writeAccepted && !result.ok
      ? 'canonical_refetch_failed'
      : undefined;

  const serverDetails =
    serverAuditEvent && typeof serverAuditEvent.details === 'object' && serverAuditEvent.details !== null
      ? (serverAuditEvent.details as Record<string, unknown>)
      : {};

  const normalizedDetails = stripNullish({
    ...serverDetails,
    operation,
    source: payload.auditMeta?.source ?? 'patients',
    section: payload.auditMeta?.section,
    changedKeys: payload.auditMeta?.changedKeys,
    patientId: result.patient?.patientId ?? payload.patient.patientId,
    receptionId: payload.auditMeta?.receptionId,
    appointmentId: payload.auditMeta?.appointmentId,
    visitDate: payload.auditMeta?.visitDate,
    actorRole: payload.auditMeta?.actorRole,
    traceId: result.traceId,
    requestId: result.requestId,
    status: result.status,
    sourcePath: result.sourcePath,
    dataSourceTransition: result.dataSourceTransition,
    writeAccepted: result.writeAccepted,
    outcome: result.ok ? 'success' : result.writeAccepted ? 'warning' : 'error',
    message: result.message,
    canonicalRefetchSource: result.canonicalRefetch?.source,
    canonicalRefetchOk: result.canonicalRefetch?.ok,
    canonicalRefetchStatus: result.canonicalRefetch?.status,
    canonicalRefetchApiResult: result.canonicalRefetch?.apiResult,
    canonicalRefetchApiResultMessage: result.canonicalRefetch?.apiResultMessage,
    canonicalRefetchExpectedPatientIds: result.canonicalRefetch?.expectedPatientIds,
    canonicalRefetchMatchedPatientIds: result.canonicalRefetch?.matchedPatientIds,
    canonicalRefetchMissingPatientIds: result.canonicalRefetch?.missingPatientIds,
  }) as Record<string, unknown>;

  result.auditEvent = {
    action: (serverAuditEvent?.action as string | undefined) ?? `ORCA_OFFICIAL_${operation.toUpperCase()}_PATIENT`,
    outcome: result.ok ? 'success' : result.writeAccepted ? 'warning' : 'error',
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
    dataSourceTransition: result.dataSourceTransition ?? 'server',
    fallbackUsed: result.fallbackUsed ?? false,
    action: `official_patient_${operation}`,
    outcome: result.ok ? 'success' : 'error',
    note: result.ok
      ? (result.sourcePath ?? '')
      : `${result.sourcePath ?? ''} status=${result.status ?? 'unknown'} writeAccepted=${result.writeAccepted ? 'true' : 'false'}`,
    reason: result.message ?? result.sourcePath,
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
    controlId: `official_patient_${operation}`,
    runId: result.runId,
    cacheHit: result.cacheHit,
    missingMaster: result.missingMaster,
    fallbackUsed: result.fallbackUsed,
    dataSourceTransition: result.dataSourceTransition,
    details: normalizedDetails,
  });

  return result;
};

export async function createOfficialPatient(payload: OfficialPatientCreatePayload): Promise<PatientMutationResult> {
  return performOfficialPatientMutation(PATIENT_CREATE_OFFICIAL_ENDPOINT, payload, 'create');
}

export async function updateOfficialPatient(payload: OfficialPatientUpdatePayload): Promise<PatientMutationResult> {
  return performOfficialPatientMutation(PATIENT_UPDATE_OFFICIAL_ENDPOINT, payload, 'update');
}
