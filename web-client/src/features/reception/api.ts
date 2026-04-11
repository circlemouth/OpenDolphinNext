import type { QueryFunctionContext } from '@tanstack/react-query';

import { logAuditEvent, logUiState } from '../../libs/audit/auditLogger';
import { readMockRuntimeState, resolveMockGateDecision } from '../../libs/devtools/mockGate';
import { httpFetch } from '../../libs/http/httpClient';
import { updateObservabilityMeta } from '../../libs/observability/observability';
import type { DataSourceTransition, ResolveMasterSource } from '../../libs/observability/types';
import { recordOutpatientFunnel } from '../../libs/telemetry/telemetryClient';
import {
  isAcceptmodInsuranceMismatch,
  isAcceptmodNoAcceptance,
  resolveAcceptmodFallbackMessage,
} from './acceptmodv2Result';
import { fetchWithResolver } from '../outpatient/fetchWithResolver';
import { attachAppointmentMeta, mergeOutpatientMeta, parseAppointmentEntries } from '../outpatient/transformers';
import type {
  AppointmentPayload,
  ClaimOutpatientPayload,
  ReceptionEntry,
  OutpatientMeta,
} from '../outpatient/types';
export type { ReceptionEntry, ReceptionStatus, OutpatientFlagResponse, AppointmentPayload } from '../outpatient/types';

export type AppointmentQueryParams = {
  date: string;
  keyword?: string;
  departmentCode?: string;
  physicianCode?: string;
  page?: number;
  size?: number;
};

export type VisitMutationParams = {
  patientId: string;
  acceptanceDate: string;
  acceptanceTime?: string;
  departmentCode?: string;
  physicianCode?: string;
  medicalInformation?: string;
  /**
   * 01: 登録 / 02: 取消 / 03: 更新 / 00: 照会
   */
  requestNumber: '00' | '01' | '02' | '03';
  /**
   * ORCA の保険/自費区分。保険=1, 自費=9 を送る。
   */
  paymentMode?: 'insurance' | 'self';
  /**
   * 受付区分。仕様上 1:通常,2:時間外,3:救急 など。必須扱い。
   */
  acceptancePush?: string;
  acceptanceId?: string;
};

export type VisitMutationPayload = OutpatientMeta & {
  requestNumber?: string;
  acceptanceId?: string;
  acceptanceDate?: string;
  acceptanceTime?: string;
  departmentCode?: string;
  departmentName?: string;
  physicianCode?: string;
  physicianName?: string;
  medicalInformation?: string;
  appointmentDate?: string;
  visitNumber?: string;
  scheduleKey?: string;
  encounterKey?: string;
  patient?: {
    patientId?: string;
    name?: string;
    kana?: string;
    birthDate?: string;
    sex?: string;
  };
  warnings?: string[];
  apiResult?: string;
  apiResultMessage?: string;
};

export type MedicalInformationOption = {
  code: string;
  name: string;
};

const isMswRuntimeEnabled = () => {
  const gate = resolveMockGateDecision();
  if (!gate.allowed) return false;
  return readMockRuntimeState()?.mswStarted === true;
};

const buildAppointmentCandidates = (): Array<{ path: string; source: ResolveMasterSource }> => [
  { path: '/api/orca/official/appointments/list', source: 'server' as ResolveMasterSource },
];

const buildVisitCandidates = (): Array<{ path: string; source: ResolveMasterSource }> => [
  { path: '/api/orca/official/visits/list', source: 'server' as ResolveMasterSource },
];

const buildVisitMutationCandidates = (): Array<{ path: string; source: ResolveMasterSource }> => [
  { path: '/api/orca/official/visits/mutation', source: 'server' as ResolveMasterSource },
];

const preferredSource = (mswEnabled: boolean): ResolveMasterSource | undefined => (mswEnabled ? 'mock' : 'server');

// CLAIM 廃止方針により常時 OFF（旧 claim outpatient surface は撤去済み）
export const isClaimOutpatientEnabled = () => false;

const CLAIM_OUTPATIENT_DISABLED_PAYLOAD: ClaimOutpatientPayload = {
  bundles: [],
  queueEntries: [],
  claimStatusText: '廃止',
  sourcePath: 'claim_outpatient_removed',
  outcome: 'disabled',
};

const resolvedDataSource = (transition?: DataSourceTransition, fallback?: ResolveMasterSource): ResolveMasterSource | undefined =>
  (transition as ResolveMasterSource | undefined) ?? fallback;

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export async function fetchAppointmentOutpatients(
  params: AppointmentQueryParams,
  context?: QueryFunctionContext,
  options: { preferredSourceOverride?: ResolveMasterSource; screen?: string } = {},
): Promise<AppointmentPayload> {
  const mswEnabled = isMswRuntimeEnabled();
  const appointmentCandidates = buildAppointmentCandidates();
  const visitCandidates = buildVisitCandidates();
  const page = params.page ?? 1;
  const size = params.size ?? 50;
  const preferred = options.preferredSourceOverride ?? preferredSource(mswEnabled);
  const buildResolverContext = (source?: QueryFunctionContext, stripSignal = false) => {
    if (!source) return undefined;
    if (!stripSignal) return source;
    return { meta: source.meta } as QueryFunctionContext;
  };
  const resolverContext = mswEnabled ? context : buildResolverContext(context, true);
  const isAbortError = (error?: string) => (error ?? '').toLowerCase().includes('abort');
  const fetchAppointments = (queryContext?: QueryFunctionContext) =>
    Promise.all([
      fetchWithResolver({
        candidates: appointmentCandidates,
        body: {
          appointmentDate: params.date,
          medicalInformation: params.keyword,
          departmentCode: params.departmentCode,
          physicianCode: params.physicianCode,
          page,
          size,
        },
        queryContext,
        preferredSource: preferred,
        description: 'appointment_outpatient',
      }),
      fetchWithResolver({
        candidates: visitCandidates,
        body: {
          visitDate: params.date,
          requestNumber: '01',
          departmentCode: params.departmentCode,
        },
        queryContext,
        preferredSource: preferred,
        description: 'visit_outpatient',
      }),
    ]);
  let [appointmentResult, visitResult] = await fetchAppointments(resolverContext);
  const shouldRetryAbort =
    !context?.signal?.aborted &&
    (isAbortError(appointmentResult.error) || isAbortError(visitResult.error));
  const abortRetryReason = shouldRetryAbort
    ? [
        isAbortError(appointmentResult.error) ? `appointment:${appointmentResult.error}` : undefined,
        isAbortError(visitResult.error) ? `visit:${visitResult.error}` : undefined,
      ]
        .filter((entry): entry is string => Boolean(entry))
        .join(' / ')
    : undefined;
  if (shouldRetryAbort) {
    [appointmentResult, visitResult] = await fetchAppointments(buildResolverContext(context, true));
  }
  const abortRetryAttempted =
    Boolean(abortRetryReason) ||
    Boolean(appointmentResult.meta.abortRetryAttempted) ||
    Boolean(visitResult.meta.abortRetryAttempted);
  const abortRetryReasonMerged =
    abortRetryReason ?? appointmentResult.meta.abortRetryReason ?? visitResult.meta.abortRetryReason;

  const combinedRaw = {
    ...appointmentResult.raw,
    ...visitResult.raw,
    slots: Array.isArray((appointmentResult.raw as any)?.slots) ? (appointmentResult.raw as any).slots : [],
    reservations: Array.isArray((appointmentResult.raw as any)?.reservations) ? (appointmentResult.raw as any).reservations : [],
    visits: Array.isArray((visitResult.raw as any)?.visits)
      ? (visitResult.raw as any).visits
      : Array.isArray((appointmentResult.raw as any)?.visits)
        ? (appointmentResult.raw as any).visits
        : [],
  };
  const primaryResult = appointmentResult.ok ? appointmentResult : visitResult;
  const combinedOk = appointmentResult.ok || visitResult.ok;
  const combinedError =
    appointmentResult.ok && visitResult.ok
      ? undefined
      : [appointmentResult.ok ? undefined : `appointment: ${appointmentResult.error ?? 'error'}`,
        visitResult.ok ? undefined : `visit: ${visitResult.error ?? 'error'}`]
          .filter((entry): entry is string => Boolean(entry))
          .join(' / ');

  const entries = parseAppointmentEntries(combinedRaw);
  const mergedMeta = mergeOutpatientMeta(combinedRaw, {
    ...primaryResult.meta,
    recordsReturned: entries.length,
    resolveMasterSource: resolvedDataSource(primaryResult.meta.dataSourceTransition, primaryResult.meta.resolveMasterSource),
    page,
    size,
  });

  const payload: AppointmentPayload = attachAppointmentMeta(
    {
      entries,
      raw: combinedRaw,
      apiResult: (combinedRaw as any).apiResult,
      apiResultMessage: (combinedRaw as any).apiResultMessage,
    },
    mergedMeta,
  );

  recordOutpatientFunnel('charts_orchestration', {
    runId: payload.runId,
    cacheHit: payload.cacheHit ?? primaryResult.meta.fromCache ?? false,
    missingMaster: payload.missingMaster ?? false,
    dataSourceTransition: payload.dataSourceTransition ?? 'snapshot',
    fallbackUsed: payload.fallbackUsed ?? false,
    action: 'appointment_fetch',
    outcome: combinedOk ? 'success' : 'error',
    note: payload.sourcePath,
    reason: combinedOk ? undefined : combinedError ?? payload.apiResultMessage ?? payload.apiResult,
  });

  logUiState({
    action: 'outpatient_fetch',
    screen: options.screen ?? 'reception',
    runId: payload.runId,
    cacheHit: payload.cacheHit ?? primaryResult.meta.fromCache,
    missingMaster: payload.missingMaster,
    dataSourceTransition: payload.dataSourceTransition,
    fallbackUsed: payload.fallbackUsed,
      details: {
        endpoint: payload.sourcePath ?? primaryResult.meta.sourcePath,
        fetchedAt: payload.fetchedAt,
        recordsReturned: payload.recordsReturned,
        resolveMasterSource: payload.resolveMasterSource,
        fromCache: primaryResult.meta.fromCache,
        retryCount: primaryResult.meta.retryCount,
        description: 'appointment_outpatient',
        abortRetryAttempted,
        abortRetryReason: abortRetryReasonMerged,
        appointmentEndpoint: appointmentResult.meta.sourcePath,
        appointmentStatus: appointmentResult.meta.httpStatus,
        appointmentOk: appointmentResult.ok,
        visitEndpoint: visitResult.meta.sourcePath,
        visitStatus: visitResult.meta.httpStatus,
      visitOk: visitResult.ok,
      combinedError,
    },
  });

  logAuditEvent({
    runId: payload.runId,
    cacheHit: payload.cacheHit ?? primaryResult.meta.fromCache,
    missingMaster: payload.missingMaster,
    fallbackUsed: payload.fallbackUsed,
    dataSourceTransition: payload.dataSourceTransition,
    patientId: entries[0]?.patientId,
    appointmentId: entries[0]?.appointmentId,
    payload: {
      action: 'APPOINTMENT_OUTPATIENT_FETCH',
      outcome: combinedOk ? 'success' : 'error',
      details: {
        runId: payload.runId,
        cacheHit: payload.cacheHit ?? primaryResult.meta.fromCache ?? false,
        missingMaster: payload.missingMaster ?? false,
        fallbackUsed: payload.fallbackUsed ?? false,
        dataSourceTransition: payload.dataSourceTransition ?? primaryResult.meta.dataSourceTransition,
        fetchedAt: payload.fetchedAt,
        recordsReturned: payload.recordsReturned ?? entries.length,
        page: payload.page,
        size: payload.size,
        resolveMasterSource: payload.resolveMasterSource,
        sourcePath: payload.sourcePath ?? primaryResult.meta.sourcePath,
        apiResult: payload.apiResult,
        apiResultMessage: payload.apiResultMessage,
        patientId: entries[0]?.patientId,
        appointmentId: entries[0]?.appointmentId,
        appointmentEndpoint: appointmentResult.meta.sourcePath,
        appointmentStatus: appointmentResult.meta.httpStatus,
        appointmentOk: appointmentResult.ok,
        visitEndpoint: visitResult.meta.sourcePath,
        visitStatus: visitResult.meta.httpStatus,
        visitOk: visitResult.ok,
        error: combinedOk ? undefined : combinedError ?? payload.apiResultMessage,
      },
    },
  });

  updateObservabilityMeta({
    runId: payload.runId,
    cacheHit: payload.cacheHit,
    missingMaster: payload.missingMaster,
    dataSourceTransition: payload.dataSourceTransition,
    fallbackUsed: payload.fallbackUsed,
    fetchedAt: payload.fetchedAt,
    recordsReturned: payload.recordsReturned,
  });

  return payload;
}

const extractWarnings = (raw: Record<string, unknown>): string[] => {
  if (Array.isArray(raw.warnings)) return raw.warnings as string[];
  if (Array.isArray((raw as any).warningMessages)) return (raw as any).warningMessages as string[];
  const message = (raw as any).warningMessage ?? (raw as any).apiWarningMessage;
  return message ? [String(message)] : [];
};

const parsePatientSummary = (raw: any) => {
  const patient =
    raw?.patient ??
    raw?.Patient ??
    raw?.patientInformation ??
    raw?.patient_information ??
    raw?.Patient_Information;
  if (!patient) return undefined;
  return {
    patientId: normalizeOptionalString(patient.patientId ?? patient.Patient_ID),
    name: normalizeOptionalString(patient.name ?? patient.wholeName ?? patient.WholeName),
    kana: normalizeOptionalString(patient.kana ?? patient.wholeNameKana ?? patient.WholeName_inKana),
    birthDate: normalizeOptionalString(patient.birthDate ?? patient.BirthDate),
    sex: normalizeOptionalString(patient.sex ?? patient.Sex),
  };
};

export const buildVisitEntryFromMutation = (
  payload: VisitMutationPayload,
  options: { paymentMode?: 'insurance' | 'self' } = {},
): ReceptionEntry | null => {
  if (payload.requestNumber === '02' || payload.requestNumber === '00') return null;
  const patientId = payload.patient?.patientId;
  if (!patientId && !payload.acceptanceId) return null;
  const paymentLabel = options.paymentMode === 'self' ? '自費' : options.paymentMode === 'insurance' ? '保険' : undefined;
  return {
    id: payload.acceptanceId ?? payload.visitNumber ?? patientId ?? `visit-${Date.now()}`,
    appointmentId: payload.visitNumber ?? payload.appointmentDate,
    receptionId: payload.acceptanceId,
    scheduleKey: payload.scheduleKey,
    encounterKey: payload.encounterKey,
    patientId: patientId ?? undefined,
    departmentCode: payload.departmentCode,
    physicianCode: payload.physicianCode,
    name: payload.patient?.name,
    kana: payload.patient?.kana,
    birthDate: payload.patient?.birthDate,
    sex: payload.patient?.sex,
    department: payload.departmentName ?? payload.departmentCode,
    physician: payload.physicianName ?? payload.physicianCode,
    appointmentTime: payload.acceptanceTime,
    acceptanceTime: payload.acceptanceTime,
    visitDate: payload.acceptanceDate ?? payload.appointmentDate,
    status: '受付中',
    insurance: paymentLabel,
    note: payload.medicalInformation,
    source: 'visits',
  };
};

export async function mutateVisit(
  params: VisitMutationParams,
  context?: QueryFunctionContext,
  options: { preferredSourceOverride?: ResolveMasterSource } = {},
): Promise<VisitMutationPayload> {
  const mswEnabled = isMswRuntimeEnabled();
  const insurances =
    params.paymentMode === 'self'
      ? [
          {
            insuranceProviderClass: '9',
          },
        ]
      : undefined;
  const body = {
    requestNumber: params.requestNumber,
    patientId: params.patientId,
    acceptanceDate: params.acceptanceDate,
    acceptanceTime: params.acceptanceTime,
    acceptancePush: params.acceptancePush,
    acceptanceId: params.acceptanceId,
    departmentCode: params.departmentCode,
    physicianCode: params.physicianCode,
    medicalInformation: params.medicalInformation,
    insurances,
  };

  const result = await fetchWithResolver({
    candidates: buildVisitMutationCandidates(),
    body,
    queryContext: context,
    preferredSource: options.preferredSourceOverride ?? preferredSource(mswEnabled),
    description: 'visit_mutation',
  });

  const raw = result.raw ?? {};
  const meta = mergeOutpatientMeta(raw, {
    ...result.meta,
    recordsReturned: 1,
    resolveMasterSource: resolvedDataSource(result.meta.dataSourceTransition, result.meta.resolveMasterSource),
  });

  const patientSummary = parsePatientSummary(raw);
  const patient = patientSummary?.patientId ? patientSummary : { patientId: params.patientId };
  const acceptanceIdRaw = (raw as any).acceptanceId ?? (raw as any).Acceptance_Id ?? (raw as any).acceptance_id;
  const acceptanceDateRaw = (raw as any).acceptanceDate ?? (raw as any).Acceptance_Date ?? (raw as any).acceptance_date;
  const acceptanceTimeRaw = (raw as any).acceptanceTime ?? (raw as any).Acceptance_Time ?? (raw as any).acceptance_time;
  const departmentCodeRaw = (raw as any).departmentCode ?? (raw as any).Department_Code ?? (raw as any).department_code;
  const departmentNameRaw =
    (raw as any).departmentName ?? (raw as any).Department_WholeName ?? (raw as any).department_name;
  const physicianCodeRaw = (raw as any).physicianCode ?? (raw as any).Physician_Code ?? (raw as any).physician_code;
  const physicianNameRaw =
    (raw as any).physicianName ?? (raw as any).Physician_WholeName ?? (raw as any).physician_name;
  const scheduleKeyRaw = (raw as any).scheduleKey ?? (raw as any).Schedule_Key ?? (raw as any).schedule_key;
  const encounterKeyRaw = (raw as any).encounterKey ?? (raw as any).Encounter_Key ?? (raw as any).encounter_key;
  const fallbackAcceptanceDate = normalizeOptionalString(params.acceptanceDate);
  const fallbackAcceptanceTime = normalizeOptionalString(params.acceptanceTime);
  const fallbackDepartmentCode = normalizeOptionalString(params.departmentCode);
  const fallbackPhysicianCode = normalizeOptionalString(params.physicianCode);
  const fallbackMedicalInformation =
    typeof params.medicalInformation === 'string' ? params.medicalInformation : undefined;
  const apiResult = normalizeOptionalString(
    (raw as any).apiResult ?? (raw as any).Api_Result ?? (raw as any).result ?? (raw as any).Result,
  );
  const apiResultMessage = normalizeOptionalString(
    (raw as any).apiResultMessage ??
      (raw as any).Api_Result_Message ??
      (raw as any).message ??
      (raw as any).Result_Message,
  );
  const hasInsuranceMismatch = isAcceptmodInsuranceMismatch(apiResult);
  const hasNoAcceptance = isAcceptmodNoAcceptance(apiResult);
  const shouldUseRequestFallback = !hasInsuranceMismatch && !hasNoAcceptance;

  const payload: VisitMutationPayload = {
    ...meta,
    requestNumber: params.requestNumber,
    acceptanceId: hasInsuranceMismatch || hasNoAcceptance ? undefined : normalizeOptionalString(acceptanceIdRaw),
    acceptanceDate: normalizeOptionalString(acceptanceDateRaw) ?? (shouldUseRequestFallback ? fallbackAcceptanceDate : undefined),
    acceptanceTime: normalizeOptionalString(acceptanceTimeRaw) ?? (shouldUseRequestFallback ? fallbackAcceptanceTime : undefined),
    departmentCode: normalizeOptionalString(departmentCodeRaw) ?? (shouldUseRequestFallback ? fallbackDepartmentCode : undefined),
    departmentName: normalizeOptionalString(departmentNameRaw),
    physicianCode: normalizeOptionalString(physicianCodeRaw) ?? (shouldUseRequestFallback ? fallbackPhysicianCode : undefined),
    physicianName: normalizeOptionalString(physicianNameRaw),
    scheduleKey: normalizeOptionalString(scheduleKeyRaw),
    encounterKey: normalizeOptionalString(encounterKeyRaw),
    medicalInformation:
      (raw as any).medicalInformation ??
      (raw as any).Medical_Information ??
      (raw as any).medical_information ??
      (shouldUseRequestFallback ? fallbackMedicalInformation : undefined),
    appointmentDate: (raw as any).appointmentDate ?? (raw as any).Appointment_Date ?? (raw as any).appointment_date,
    visitNumber: (raw as any).visitNumber ?? (raw as any).Visit_Number ?? (raw as any).visit_number,
    warnings: extractWarnings(raw),
    apiResult,
    apiResultMessage: apiResultMessage ?? resolveAcceptmodFallbackMessage(apiResult),
    patient,
  };

  recordOutpatientFunnel('reception_accept', {
    runId: payload.runId,
    cacheHit: payload.cacheHit ?? result.meta.fromCache ?? false,
    missingMaster: payload.missingMaster ?? false,
    dataSourceTransition: payload.dataSourceTransition ?? 'server',
    fallbackUsed: payload.fallbackUsed ?? false,
    action: params.requestNumber === '02' ? 'cancel' : 'create',
    outcome: result.ok ? 'success' : 'error',
    note: payload.sourcePath,
    reason: result.ok ? undefined : result.error ?? payload.apiResultMessage ?? payload.apiResult,
  });

  logUiState({
    action: params.requestNumber === '02' ? 'cancel' : 'send',
    screen: 'reception/acceptmodv2',
    controlId: params.requestNumber,
    runId: payload.runId,
    traceId: payload.traceId,
    cacheHit: payload.cacheHit,
    missingMaster: payload.missingMaster,
    dataSourceTransition: payload.dataSourceTransition,
    details: {
      requestNumber: params.requestNumber,
      apiResult: payload.apiResult,
      apiResultMessage: payload.apiResultMessage,
      acceptanceId: payload.acceptanceId,
      acceptanceDate: payload.acceptanceDate,
      acceptanceTime: payload.acceptanceTime,
      paymentMode: params.paymentMode,
      acceptancePush: params.acceptancePush,
      warnings: payload.warnings,
      traceId: payload.traceId,
    },
  });

  logAuditEvent({
    runId: payload.runId,
    traceId: payload.traceId,
    source: 'reception',
    patientId: payload.patient?.patientId ?? params.patientId,
    payload: {
      action: 'reception_accept',
      requestNumber: params.requestNumber,
      apiResult: payload.apiResult,
      apiResultMessage: payload.apiResultMessage,
      acceptanceId: payload.acceptanceId,
      acceptanceDate: payload.acceptanceDate,
      acceptanceTime: payload.acceptanceTime,
      paymentMode: params.paymentMode,
      acceptancePush: params.acceptancePush,
      warnings: payload.warnings,
      traceId: payload.traceId,
    },
  });

  updateObservabilityMeta({
    runId: payload.runId,
    cacheHit: payload.cacheHit,
    missingMaster: payload.missingMaster,
    dataSourceTransition: payload.dataSourceTransition,
    fallbackUsed: payload.fallbackUsed,
    fetchedAt: payload.fetchedAt,
    recordsReturned: payload.recordsReturned,
  });

  return payload;
}

export async function fetchMedicalInformationOptions(): Promise<MedicalInformationOption[]> {
  const response = await httpFetch('/api/orca/official/appointments/medical-information', {
    method: 'GET',
    notifySessionExpired: false,
  });
  const body = (await response.json().catch(() => ({}))) as {
    items?: Array<{ code?: unknown; name?: unknown }>;
  };
  const items = Array.isArray(body.items) ? body.items : [];
  return items
    .map((item) => ({
      code: normalizeOptionalString(item.code) ?? '',
      name: normalizeOptionalString(item.name) ?? '',
    }))
    .filter((item) => item.code.length > 0)
    .map((item) => ({
      code: item.code,
      name: item.name || item.code,
    }));
}

export async function fetchClaimFlags(
  context?: QueryFunctionContext,
  options: { screen?: 'reception' | 'charts'; preferredSourceOverride?: ResolveMasterSource } = {},
): Promise<ClaimOutpatientPayload> {
  void context;
  void options;
  return {
    ...CLAIM_OUTPATIENT_DISABLED_PAYLOAD,
    fetchedAt: new Date().toISOString(),
  };
}
