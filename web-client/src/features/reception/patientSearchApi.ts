import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { httpFetch } from '../../libs/http/httpClient';
import { generateRunId, getObservabilityMeta, updateObservabilityMeta } from '../../libs/observability/observability';
import type { DataSourceTransition } from '../../libs/observability/types';

export type PatientMasterSearchParams = {
  name?: string;
  kana?: string;
  birthStartDate?: string;
  birthEndDate?: string;
  sex?: string;
  inOut?: string;
};

export type PatientMasterRecord = {
  patientId?: string;
  name?: string;
  kana?: string;
  birthDate?: string;
  sex?: string;
  zip?: string;
  address?: string;
  outpatientClass?: string;
  insuranceCount?: number;
  publicInsuranceCount?: number;
};

export type PatientMasterSearchResponse = {
  ok: boolean;
  patients: PatientMasterRecord[];
  runId?: string;
  traceId?: string;
  requestId?: string;
  apiResult?: string;
  apiResultMessage?: string;
  cacheHit?: boolean;
  missingMaster?: boolean;
  dataSourceTransition?: DataSourceTransition;
  fallbackUsed?: boolean;
  fetchedAt?: string;
  recordsReturned?: number;
  sourcePath?: string;
  status?: number;
  error?: string;
  raw?: Record<string, unknown>;
};

const normalizeApiString = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return undefined;
};

const normalizeDataSourceTransition = (value: unknown): DataSourceTransition | undefined => {
  return typeof value === 'string' ? (value as DataSourceTransition) : undefined;
};

const resolveNameSearchBody = (json: Record<string, unknown>): Record<string, unknown> => {
  const candidates = [
    json.patientlst3res,
    json.patientlst2res,
    json.Patientlst3res,
    json.Patientlst2res,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate as Record<string, unknown>;
    }
  }
  return json;
};

const isPatientLike = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Boolean(
    record.Patient_ID ??
      record.patientId ??
      record.Patient_Name ??
      record.WholeName ??
      record.wholeName ??
      record.WholeName_inKana ??
      record.wholeNameKana,
  );
};

const findPatientListDeep = (value: unknown): Record<string, unknown>[] => {
  const visited = new Set<unknown>();
  const stack: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 0 }];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const { node, depth } = current;
    if (visited.has(node)) continue;
    visited.add(node);
    if (Array.isArray(node)) {
      if (node.some((entry) => isPatientLike(entry))) {
        return node.filter((entry) => entry && typeof entry === 'object') as Record<string, unknown>[];
      }
      if (depth < 6) {
        for (const entry of node) {
          if (entry && typeof entry === 'object') stack.push({ node: entry, depth: depth + 1 });
        }
      }
      continue;
    }
    if (node && typeof node === 'object' && depth < 6) {
      for (const entry of Object.values(node as Record<string, unknown>)) {
        if (entry && typeof entry === 'object') stack.push({ node: entry, depth: depth + 1 });
      }
    }
  }
  return [];
};

const normalizePatientList = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === 'object') return [value as Record<string, unknown>];
  return [];
};

const resolveNestedPatientList = (value: unknown): Record<string, unknown>[] => {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const nested =
    record.patients ??
    record.patientInformation ??
    record.Patient_Information ??
    record.PatientInformation ??
    record.Patient_Information_child ??
    record.patient_information_child ??
    record.patient_information;
  if (nested !== undefined) return normalizePatientList(nested);
  return [];
};

const resolvePatientsRaw = (json: Record<string, unknown>): Record<string, unknown>[] => {
  const direct = json.patients ?? json.patientInformation ?? json.Patient_Information ?? json.PatientInformation;
  if (direct !== undefined) {
    const nested = resolveNestedPatientList(direct);
    if (nested.length > 0) return nested;
    const normalized = normalizePatientList(direct);
    if (normalized.length > 0) return normalized;
  }
  const container = json.patientList ?? json.PatientList ?? json.patient_information;
  if (container !== undefined) {
    const nested = resolveNestedPatientList(container);
    if (nested.length > 0) return nested;
    const normalized = normalizePatientList(container);
    if (normalized.length > 0) return normalized;
  }
  const deep = findPatientListDeep(json);
  if (deep.length > 0) return deep;
  return [];
};

const parsePatientDetail = (raw: Record<string, unknown>): PatientMasterRecord => {
  const normalizedRaw =
    (raw.Patient_Information ??
      raw.patientInformation ??
      raw.PatientInformation ??
      raw.patient_information ??
      raw.Patient_Information_child ??
      raw.patient_information_child ??
      raw.patient ??
      raw.Patient) as Record<string, unknown> | undefined;
  const base = Array.isArray(normalizedRaw)
    ? (normalizedRaw[0] as Record<string, unknown> | undefined) ?? raw
    : normalizedRaw ?? raw;
  const summary = (base.summary ?? base.Summary ?? base.patientSummary ?? base.PatientSummary) as
    | Record<string, unknown>
    | undefined;
  const patientId =
    normalizeApiString(summary?.patientId) ??
    normalizeApiString(summary?.Patient_ID) ??
    normalizeApiString(summary?.PatientId) ??
    normalizeApiString(summary?.PatientID) ??
    normalizeApiString(summary?.Patient_No) ??
    normalizeApiString(summary?.Patient_Number) ??
    normalizeApiString(summary?.patientNo) ??
    normalizeApiString(summary?.patientNumber) ??
    normalizeApiString(base.patientId) ??
    normalizeApiString(base.Patient_ID) ??
    normalizeApiString(base.PatientId) ??
    normalizeApiString(base.PatientID) ??
    normalizeApiString(base.Patient_No) ??
    normalizeApiString(base.Patient_Number) ??
    normalizeApiString(base.patientNo) ??
    normalizeApiString(base.patientNumber);
  const name =
    normalizeApiString(summary?.wholeName) ??
    normalizeApiString(summary?.name) ??
    normalizeApiString(summary?.Patient_Name) ??
    normalizeApiString(base.wholeName) ??
    normalizeApiString(base.WholeName) ??
    normalizeApiString(base.Patient_Name);
  const kana =
    normalizeApiString(summary?.wholeNameKana) ??
    normalizeApiString(summary?.kana) ??
    normalizeApiString(summary?.Patient_Kana) ??
    normalizeApiString(base.wholeNameKana) ??
    normalizeApiString(base.WholeName_inKana) ??
    normalizeApiString(base.Patient_Kana);
  const birthDate =
    normalizeApiString(summary?.birthDate) ??
    normalizeApiString(summary?.BirthDate) ??
    normalizeApiString(base.birthDate) ??
    normalizeApiString(base.BirthDate);
  const sex =
    normalizeApiString(summary?.sex) ??
    normalizeApiString(summary?.Sex) ??
    normalizeApiString(base.sex) ??
    normalizeApiString(base.Sex);
  const zip = normalizeApiString(base.zipCode ?? base.ZipCode ?? base.zip ?? base.postal);
  const address = normalizeApiString(base.address ?? base.Address);
  const outpatientClass = normalizeApiString(base.outpatientClass ?? base.Outpatient_Class);
  const insurances = Array.isArray(base.insurances)
    ? base.insurances
    : Array.isArray(base.insurance)
      ? base.insurance
      : Array.isArray(base.HealthInsurance_Information)
        ? base.HealthInsurance_Information
        : [];
  const publicInsurances = Array.isArray(base.publicInsurances)
    ? base.publicInsurances
    : Array.isArray(base.PublicInsurance_Information)
      ? base.PublicInsurance_Information
      : [];
  return {
    patientId,
    name,
    kana,
    birthDate,
    sex,
    zip,
    address,
    outpatientClass,
    insuranceCount: insurances.length,
    publicInsuranceCount: publicInsurances.length,
  };
};

export async function fetchPatientMasterSearch(params: PatientMasterSearchParams): Promise<PatientMasterSearchResponse> {
  const runId = getObservabilityMeta().runId ?? generateRunId();
  updateObservabilityMeta({ runId });
  const payload: Record<string, unknown> = {
    name: params.name?.trim() || undefined,
    kana: params.kana?.trim() || undefined,
    birthStartDate: params.birthStartDate || undefined,
    birthEndDate: params.birthEndDate || undefined,
    sex: params.sex?.trim() || undefined,
    inOut: params.inOut?.trim() || undefined,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

  let response: Response | null = null;
  let json: Record<string, unknown> = {};
  let error: string | undefined;
  try {
    response = await httpFetch('/api/orca/official/patients/name-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      notifySessionExpired: false,
    });
    json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const body = resolveNameSearchBody(json);
  const apiResult = normalizeApiString(body.apiResult ?? (body as Record<string, unknown>)['Api_Result']);
  const apiResultMessage = normalizeApiString(body.apiResultMessage ?? (body as Record<string, unknown>)['Api_Result_Message']);
  const patientsRaw = resolvePatientsRaw(body);
  const patients = patientsRaw.map(parsePatientDetail);
  const computedRecordsReturned =
    typeof body.recordsReturned === 'number'
      ? (body.recordsReturned as number)
      : typeof body.targetPatientCount === 'number'
        ? (body.targetPatientCount as number)
        : typeof (body as Record<string, unknown>)['Target_Patient_Count'] === 'number'
          ? ((body as Record<string, unknown>)['Target_Patient_Count'] as number)
          : patients.length;
  const resolvedRecordsReturned = computedRecordsReturned === 0 && patients.length > 0 ? patients.length : computedRecordsReturned;
  const meta: PatientMasterSearchResponse = {
    ok: Boolean(response?.ok) && !error,
    patients,
    runId: normalizeApiString(json.runId) ?? runId,
    traceId: normalizeApiString(json.traceId),
    requestId: normalizeApiString(json.requestId),
    apiResult,
    apiResultMessage,
    cacheHit: normalizeBoolean(json.cacheHit),
    missingMaster: normalizeBoolean(json.missingMaster),
    dataSourceTransition: normalizeDataSourceTransition(json.dataSourceTransition),
    fallbackUsed: normalizeBoolean(json.fallbackUsed),
    fetchedAt: normalizeApiString(json.fetchedAt),
    recordsReturned: resolvedRecordsReturned,
    sourcePath: '/api/orca/official/patients/name-search',
    status: response?.status,
    error,
    raw: json,
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

  logAuditEvent({
    runId: meta.runId,
    traceId: meta.traceId,
    source: 'patient-name-search',
    cacheHit: meta.cacheHit,
    missingMaster: meta.missingMaster,
    dataSourceTransition: meta.dataSourceTransition,
    payload: {
      action: 'PATIENT_NAME_SEARCH',
      outcome: meta.ok ? 'success' : 'error',
      details: {
        apiResult: meta.apiResult,
        apiResultMessage: meta.apiResultMessage,
        status: meta.status,
        name: payload.name,
        kana: payload.kana,
        birthStartDate: payload.birthStartDate,
        birthEndDate: payload.birthEndDate,
        sex: payload.sex,
        inOut: payload.inOut,
        recordsReturned: meta.recordsReturned,
      },
    },
  });

  logUiState({
    action: 'patient_name_search',
    screen: 'reception',
    runId: meta.runId,
    cacheHit: meta.cacheHit,
    missingMaster: meta.missingMaster,
    dataSourceTransition: meta.dataSourceTransition,
    fallbackUsed: meta.fallbackUsed,
    details: {
      status: meta.status,
      apiResult: meta.apiResult,
      apiResultMessage: meta.apiResultMessage,
      recordsReturned: meta.recordsReturned,
    },
  });

  return meta;
}
