import type { DataSourceTransition, ResolveMasterSource } from '../../libs/observability/types';
import type {
  AppointmentPayload,
  ClaimBundle,
  ClaimBundleItem,
  ClaimBundleStatus,
  OutpatientMeta,
  ReceptionEntry,
  ReceptionStatus,
} from './types';

export const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return undefined;
};

const deriveStatus = (payload: {
  visitInformation?: string;
  updateTime?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  scheduledFallback?: boolean;
}): ReceptionStatus => {
  const info = payload.visitInformation ?? '';
  if (info.includes('会計済')) return '会計済み';
  if (info.includes('会計') || info.includes('精算')) return '会計待ち';
  if (info.includes('診察') || info.includes('診療') || info.includes('処置')) return '診療中';
  if (info.includes('予約')) return '予約';
  if (payload.scheduledFallback !== false && payload.appointmentDate && payload.appointmentTime) {
    return '予約';
  }
  return '受付中';
};

const toDisplayTime = (date?: string, time?: string) => {
  if (!time) return '';
  if (time.length === 4) {
    return `${time.slice(0, 2)}:${time.slice(2)}`;
  }
  if (time.length === 6) {
    return `${time.slice(0, 2)}:${time.slice(2, 4)}`;
  }
  if (date && time.includes('T')) {
    const [, t] = time.split('T');
    return t?.slice(0, 5) ?? time;
  }
  return time;
};

const buildEntryId = (candidate?: string, fallback?: string) => candidate?.trim() || fallback || 'unknown';

const sourcePriority: Record<ReceptionEntry['source'], number> = {
  visits: 3,
  slots: 2,
  reservations: 1,
  unknown: 0,
};

const buildDedupKey = (entry: ReceptionEntry) => {
  if (entry.encounterKey) return `encounter:${entry.encounterKey}`;
  if (entry.scheduleKey) return `schedule:${entry.scheduleKey}`;
  if (entry.receptionId) return `reception:${entry.receptionId}`;
  if (entry.appointmentId) return `appointment:${entry.appointmentId}`;
  if (entry.patientId && entry.appointmentTime) return `patientTime:${entry.patientId}:${entry.appointmentTime}`;
  return `id:${entry.id}`;
};

const mergePreferDefined = <T extends Record<string, unknown>>(base: T, override: T): T => {
  const definedOverrides = Object.fromEntries(Object.entries(override).filter(([, value]) => value !== undefined)) as T;
  return { ...base, ...definedOverrides };
};

const dedupeEntries = (entries: ReceptionEntry[]) => {
  const map = new Map<string, ReceptionEntry>();
  for (const entry of entries) {
    const key = buildDedupKey(entry);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, entry);
      continue;
    }
    const next =
      sourcePriority[entry.source] > sourcePriority[existing.source]
        ? entry
        : sourcePriority[entry.source] < sourcePriority[existing.source]
          ? existing
          : (entry.status === '診療中' || entry.status === '会計待ち' || entry.status === '会計済み') && existing.status === '予約'
            ? entry
            : existing;
    map.set(key, mergePreferDefined(existing, next));
  }
  return Array.from(map.values());
};

const pickReceptionId = (value: any): string | undefined =>
  value?.receptionId ??
  value?.reception_id ??
  value?.voucherNumber ??
  value?.acceptanceId ??
  value?.acceptance_id;

const pickScheduleKey = (value: any): string | undefined =>
  value?.scheduleKey ??
  value?.schedule_key ??
  value?.Schedule_Key ??
  value?.linkedScheduleKey ??
  value?.linked_schedule_key;

const pickEncounterKey = (value: any): string | undefined =>
  value?.encounterKey ??
  value?.encounter_key ??
  value?.Encounter_Key ??
  value?.linkedEncounterKey ??
  value?.linked_encounter_key;

const pickPatient = (value: any) => {
  const patient = value?.patient ?? {};
  return {
    patientId:
      patient?.patientId ??
      patient?.Patient_ID ??
      value?.patientId ??
      value?.patient_id ??
      value?.Patient_ID ??
      value?.serverPatientId,
    wholeName:
      patient?.wholeName ??
      patient?.WholeName ??
      patient?.whole_name ??
      value?.wholeName ??
      value?.patientName ??
      value?.serverPatientName,
    wholeNameKana:
      patient?.wholeNameKana ??
      patient?.WholeNameKana ??
      patient?.whole_name_kana ??
      value?.wholeNameKana ??
      value?.patientNameKana,
    birthDate: patient?.birthDate ?? patient?.BirthDate ?? value?.birthDate,
    sex: patient?.sex ?? patient?.Sex ?? value?.sex,
  };
};

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

const isSelectorOptionOnlyRow = (value: any): boolean => {
  if (!value || typeof value !== 'object') return false;
  const patient = pickPatient(value);
  const hasPatientContext = hasText(patient.patientId) || hasText(patient.wholeName) || hasText(patient.wholeNameKana);
  const hasBusinessIdentity =
    hasText(value.appointmentId) ||
    hasText(pickReceptionId(value)) ||
    hasText(pickScheduleKey(value)) ||
    hasText(pickEncounterKey(value)) ||
    hasText(value.voucherNumber) ||
    hasText(value.sequentialNumber);
  const hasTimelineContext =
    hasText(value.appointmentTime) ||
    hasText(value.acceptanceTime) ||
    hasText(value.acceptance_time) ||
    hasText(value.updateTime) ||
    hasText(value.update_time);
  const hasSelectorContext =
    hasText(value.departmentCode) ||
    hasText(value.departmentName) ||
    hasText(value.physicianCode) ||
    hasText(value.physicianName);

  return hasSelectorContext && !hasPatientContext && !hasBusinessIdentity && !hasTimelineContext;
};

const isLegacyLocalSmokePatient = (patient: ReturnType<typeof pickPatient>): boolean => {
  const patientId = typeof patient.patientId === 'string' ? patient.patientId.trim() : '';
  if (patientId !== '0000001') return false;
  const name = typeof patient.wholeName === 'string' ? patient.wholeName.trim() : '';
  const kana = typeof patient.wholeNameKana === 'string' ? patient.wholeNameKana.trim() : '';
  return name.includes('スモーク') || kana.includes('スモーク');
};

const hasDisplayablePatientContext = (patient: ReturnType<typeof pickPatient>): boolean =>
  hasText(patient.patientId) && hasText(patient.wholeName) && !isLegacyLocalSmokePatient(patient);

const toClaimStatus = (statusText?: unknown): ClaimBundleStatus | undefined => {
  if (typeof statusText !== 'string') return undefined;
  const normalized = statusText.toLowerCase();
  if (normalized.includes('済') || normalized.includes('paid') || normalized.includes('完了')) return '会計済み';
  if (normalized.includes('会計') || normalized.includes('billing') || normalized.includes('精算')) return '会計待ち';
  if (normalized.includes('waiting_payment') || normalized.includes('waiting-payment') || normalized.includes('waiting pay') || normalized.includes('waitingpayment') || normalized.includes('unpaid') || normalized.includes('pending')) return '会計待ち';
  if (normalized.includes('診療') || normalized.includes('診察')) return '診療中';
  if (normalized.includes('受付')) return '受付中';
  if (normalized.includes('予約')) return '予約';
  return undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const pickClaimHeader = (json: any): any | undefined =>
  json?.claimInformation ??
  json?.information ??
  json?.['claim:information'] ??
  json?.claim?.information ??
  json?.claim?.['claim:information'] ??
  json?.response?.['claim:information'] ??
  json?.response?.claim?.information;

const pickClaimBundlesRaw = (json: any): any[] =>
  (Array.isArray(json?.claimBundles) && json.claimBundles) ||
  (Array.isArray(json?.['claim:bundle']) && json['claim:bundle']) ||
  (Array.isArray(json?.bundles) && json.bundles) ||
  (Array.isArray(json?.claim?.bundles) && json.claim.bundles) ||
  (Array.isArray(json?.claim?.bundle) && json.claim.bundle) ||
  (Array.isArray(json?.claim?.['claim:bundle']) && json.claim['claim:bundle']) ||
  (Array.isArray(json?.response?.['claim:bundle']) && json.response['claim:bundle']) ||
  (Array.isArray(json?.claim) && json.claim) ||
  [];

const parseClaimItems = (rawItems: unknown): ClaimBundleItem[] => {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item: any) => ({
    code: item?.code ?? item?.itemCode ?? item?.['claim:code'] ?? item?.Item_Code ?? item?.ItemCode,
    tableId: item?.tableId ?? item?.itemTableId ?? item?.['claim:tableId'] ?? item?.Table_Id ?? item?.TableId,
    name: item?.name ?? item?.itemName ?? item?.['claim:name'] ?? item?.Item_Name ?? item?.ItemName,
    number: toNumber(item?.number ?? item?.itemNumber ?? item?.['claim:number'] ?? item?.Item_Number ?? item?.ItemNumber),
    unit: item?.unit ?? item?.itemUnit ?? item?.['claim:unit'] ?? item?.Item_Unit ?? item?.ItemUnit,
    claimRate: toNumber(item?.claimRate ?? item?.rate ?? item?.['claim:claimRate'] ?? item?.Claim_Rate ?? item?.ClaimRate),
    amount: toNumber(item?.amount ?? item?.price ?? item?.total ?? item?.['claim:amount'] ?? item?.Amount ?? item?.Total),
  }));
};

const parseBundle = (bundle: any, defaultStatus?: ClaimBundleStatus): ClaimBundle => {
  const statusText =
    bundle?.claimStatus ??
    bundle?.claim_status ??
    bundle?.status ??
    bundle?.statusText ??
    bundle?.bundleStatus ??
    bundle?.claim?.status;
  const claimStatus = toClaimStatus(statusText) ?? defaultStatus;
  return {
    bundleNumber:
      bundle?.bundleNumber ??
      bundle?.bundle_id ??
      bundle?.bundleId ??
      bundle?.Bundle_Number ??
      bundle?.BundleNumber ??
      bundle?.id,
    classCode: bundle?.classCode ?? bundle?.class_code ?? bundle?.class ?? bundle?.Class_Code ?? bundle?.ClassCode,
    patientId: bundle?.patientId ?? bundle?.patient_id ?? bundle?.Patient_ID ?? bundle?.patient?.patientId,
    appointmentId: bundle?.appointmentId ?? bundle?.appointment_id ?? bundle?.Appointment_Id ?? bundle?.sequentialNumber,
    performTime:
      bundle?.performTime ??
      bundle?.perform_time ??
      bundle?.Perform_Time ??
      bundle?.claim?.performTime ??
      bundle?.claimPerformTime,
    claimStatusText: typeof statusText === 'string' ? statusText : undefined,
    claimStatus,
    totalClaimAmount: toNumber(bundle?.totalClaimAmount ?? bundle?.totalAmount ?? bundle?.amount ?? bundle?.claimTotal),
    items: parseClaimItems(
      bundle?.items ??
        bundle?.claimItems ??
        bundle?.claim?.items ??
        bundle?.['claim:item'] ??
        bundle?.claimItem ??
        bundle?.Claim_Item,
    ),
  };
};

export const parseClaimBundles = (json: any): ClaimBundle[] => {
  const bundles: any[] = pickClaimBundlesRaw(json);
  const header = pickClaimHeader(json);
  const defaultStatus = toClaimStatus(
    json?.claimStatus ??
      json?.claim_status ??
      json?.status ??
      json?.claim?.status ??
      json?.claim?.information?.status ??
      header?.status ??
      header?.claimStatus ??
      header?.['claim:status'] ??
      json?.apiResult,
  );
  return bundles.map((bundle) => parseBundle(bundle, defaultStatus));
};

export const resolveClaimStatus = (statusText?: string) => toClaimStatus(statusText);

export const parseAppointmentEntries = (json: any): ReceptionEntry[] => {
  const entries: ReceptionEntry[] = [];

  const slots: any[] = Array.isArray(json?.slots) ? json.slots : [];
  slots.forEach((slot, index) => {
    if (isSelectorOptionOnlyRow(slot)) return;
    const patient = pickPatient(slot);
    if (!hasDisplayablePatientContext(patient)) return;
    const reservationTime = toDisplayTime(json?.appointmentDate, slot.appointmentTime);
    const scheduleKey = pickScheduleKey(slot);
    const encounterKey = pickEncounterKey(slot);
    entries.push({
      id: buildEntryId(slot.appointmentId ?? scheduleKey ?? encounterKey, `slot-${index}`),
      appointmentId: slot.appointmentId,
      receptionId: pickReceptionId(slot),
      scheduleKey,
      encounterKey,
      patientId: patient.patientId,
      departmentCode: slot.departmentCode,
      physicianCode: slot.physicianCode,
      voucherNumber: slot.voucherNumber,
      sequentialNumber: slot.sequentialNumber,
      insuranceCombinationNumber: slot.insuranceCombinationNumber,
      name: patient.wholeName,
      kana: patient.wholeNameKana,
      birthDate: patient.birthDate,
      sex: patient.sex,
      department: slot.departmentName ?? slot.departmentCode,
      physician: slot.physicianName ?? slot.physicianCode,
      appointmentTime: reservationTime,
      reservationTime,
      status: deriveStatus({ visitInformation: slot.visitInformation, appointmentDate: json?.appointmentDate, appointmentTime: slot.appointmentTime }),
      note: slot.medicalInformation,
      source: 'slots',
    });
  });

  const reservations: any[] = Array.isArray(json?.reservations) ? json.reservations : [];
  reservations.forEach((reservation, index) => {
    if (isSelectorOptionOnlyRow(reservation)) return;
    const patient = pickPatient({ ...reservation, patient: reservation.patient ?? json?.patient });
    if (!hasDisplayablePatientContext(patient)) return;
    const reservationTime = toDisplayTime(reservation.appointmentDate, reservation.appointmentTime);
    const scheduleKey = pickScheduleKey(reservation);
    const encounterKey = pickEncounterKey(reservation);
    entries.push({
      id: buildEntryId(reservation.appointmentId ?? scheduleKey ?? encounterKey, `reservation-${index}`),
      appointmentId: reservation.appointmentId,
      receptionId: pickReceptionId(reservation),
      scheduleKey,
      encounterKey,
      patientId: patient.patientId,
      departmentCode: reservation.departmentCode,
      physicianCode: reservation.physicianCode,
      voucherNumber: reservation.voucherNumber,
      sequentialNumber: reservation.sequentialNumber,
      insuranceCombinationNumber: reservation.insuranceCombinationNumber,
      name: patient.wholeName,
      kana: patient.wholeNameKana,
      birthDate: patient.birthDate,
      sex: patient.sex,
      department: reservation.departmentName ?? reservation.departmentCode,
      physician: reservation.physicianName ?? reservation.physicianCode,
      appointmentTime: reservationTime,
      reservationTime,
      status: deriveStatus({
        visitInformation: reservation.visitInformation,
        appointmentDate: reservation.appointmentDate,
        appointmentTime: reservation.appointmentTime,
      }),
      note: reservation.appointmentNote,
      source: 'reservations',
    });
  });

  const visits: any[] = Array.isArray(json?.visits) ? json.visits : [];
  visits.forEach((visit, index) => {
    if (isSelectorOptionOnlyRow(visit)) return;
    const patient = pickPatient(visit);
    if (!hasDisplayablePatientContext(patient)) return;
    const receptionId = pickReceptionId(visit);
    const scheduleKey = pickScheduleKey(visit);
    const encounterKey = pickEncounterKey(visit);
    const acceptanceTimeRaw =
      visit.acceptanceTime ?? visit.acceptance_time ?? visit.updateTime ?? visit.update_time ?? visit.appointmentTime;
    const acceptanceTime = toDisplayTime(json?.visitDate, acceptanceTimeRaw);
    entries.push({
      id: buildEntryId(receptionId ?? scheduleKey ?? encounterKey, `visit-${index}`),
      appointmentId: visit.sequentialNumber,
      receptionId,
      scheduleKey,
      encounterKey,
      patientId: patient.patientId,
      departmentCode: visit.departmentCode,
      physicianCode: visit.physicianCode,
      voucherNumber: visit.voucherNumber,
      sequentialNumber: visit.sequentialNumber,
      insuranceCombinationNumber: visit.insuranceCombinationNumber,
      name: patient.wholeName,
      kana: patient.wholeNameKana,
      birthDate: patient.birthDate,
      sex: patient.sex,
      department: visit.departmentName ?? visit.departmentCode,
      physician: visit.physicianName ?? visit.physicianCode,
      appointmentTime: acceptanceTime,
      acceptanceTime,
      visitDate: visit.visitDate ?? json?.visitDate,
      status: deriveStatus({
        visitInformation: visit.visitInformation,
        appointmentDate: json?.visitDate,
        appointmentTime: visit.updateTime,
        scheduledFallback: false,
      }),
      insurance: visit.insuranceCombinationNumber,
      source: 'visits',
    });
  });

  return dedupeEntries(entries);
};

export const mergeOutpatientMeta = (
  raw: Record<string, unknown>,
  defaults: Partial<OutpatientMeta> = {},
): OutpatientMeta => {
  const resolvedTransition = (raw.dataSourceTransition as DataSourceTransition | undefined) ?? defaults.dataSourceTransition;
  const resolvedSource = (defaults.resolveMasterSource ?? resolvedTransition) as ResolveMasterSource | undefined;
  const fallbackFlagMissing =
    raw.fallbackUsed === undefined && defaults.fallbackUsed === undefined ? true : defaults.fallbackFlagMissing;

  const recordsReturned =
    typeof raw.recordsReturned === 'number'
      ? (raw.recordsReturned as number)
      : defaults.recordsReturned;
  const size = typeof raw.size === 'number' ? (raw.size as number) : defaults.size;
  const page = typeof raw.page === 'number' ? (raw.page as number) : defaults.page;
  const hasNextPageRaw = typeof raw.hasNextPage === 'boolean' ? (raw.hasNextPage as boolean) : undefined;
  const hasNextPage =
    hasNextPageRaw !== undefined
      ? hasNextPageRaw
      : size !== undefined && recordsReturned !== undefined
        ? recordsReturned >= size
        : defaults.hasNextPage;

  return {
    runId: (raw.runId as string | undefined) ?? defaults.runId,
    traceId: (raw.traceId as string | undefined) ?? defaults.traceId,
    requestId: (raw.requestId as string | undefined) ?? defaults.requestId,
    dataSourceTransition: resolvedTransition,
    resolveMasterSource: resolvedSource,
    cacheHit: normalizeBoolean(raw.cacheHit ?? defaults.cacheHit),
    // When upstream omits flags, normalize to false so UI does not stay blocked by stale state.
    missingMaster: normalizeBoolean(raw.missingMaster) ?? false,
    fallbackUsed: normalizeBoolean(raw.fallbackUsed) ?? false,
    fallbackFlagMissing,
    fetchedAt: (raw.fetchedAt as string | undefined) ?? defaults.fetchedAt,
    recordsReturned,
    outcome: (raw.outcome as string | undefined) ?? defaults.outcome,
    size,
    page,
    hasNextPage,
    fromCache: defaults.fromCache,
    retryCount: defaults.retryCount,
    sourcePath: defaults.sourcePath,
    httpStatus: defaults.httpStatus,
    auditEvent: (raw.auditEvent as Record<string, unknown> | undefined) ?? defaults.auditEvent,
    abortRetryAttempted: defaults.abortRetryAttempted,
    abortRetryReason: defaults.abortRetryReason,
    abortSignalAborted: defaults.abortSignalAborted,
  };
};

export const attachAppointmentMeta = (
  payload: AppointmentPayload,
  meta: OutpatientMeta,
): AppointmentPayload => ({
  ...payload,
  runId: meta.runId,
  dataSourceTransition: meta.dataSourceTransition,
  resolveMasterSource: meta.resolveMasterSource,
  cacheHit: meta.cacheHit,
  missingMaster: meta.missingMaster,
  fallbackUsed: meta.fallbackUsed,
  fetchedAt: meta.fetchedAt,
  recordsReturned: meta.recordsReturned,
  fromCache: meta.fromCache,
  retryCount: meta.retryCount,
  sourcePath: meta.sourcePath,
  httpStatus: meta.httpStatus,
  auditEvent: meta.auditEvent ?? payload.auditEvent,
  abortRetryAttempted: meta.abortRetryAttempted,
  abortRetryReason: meta.abortRetryReason,
  abortSignalAborted: meta.abortSignalAborted,
});
