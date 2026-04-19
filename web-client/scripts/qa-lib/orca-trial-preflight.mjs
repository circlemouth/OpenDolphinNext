import crypto from 'node:crypto';

export const TRIAL_NATIVE_PROBE_CANDIDATES = [
  '00001',
  '00002',
  '00003',
  '00004',
  '00005',
  '00006',
  '00007',
  '00008',
  '00009',
  '00010',
  '00011',
];

export const REJECTED_TRIAL_CANDIDATES = new Set(['0000001']);

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeApiResult = (value) => normalizeText(value).toUpperCase();
const isAllZeroApiResult = (value) => /^0+$/.test(normalizeApiResult(value));
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);

const collectPatientRecords = (body) => {
  const records = [];
  const push = (value) => {
    if (value && typeof value === 'object') records.push(value);
  };
  for (const item of asArray(body?.patients)) push(item);
  for (const item of asArray(body?.Patients)) push(item);
  for (const item of asArray(body?.Patient_Information)) push(item);
  for (const item of asArray(body?.patientlst2res?.Patient_Information)) push(item);
  return records;
};

const patientIdOf = (record) =>
  normalizeText(
    record?.patientId ??
      record?.Patient_ID ??
      record?.summary?.patientId ??
      record?.summary?.Patient_ID ??
      record?.patient?.patientId ??
      record?.patient?.Patient_ID,
  );

const hasPatientNotFoundMessage = (body) => /患者番号がありません/.test(JSON.stringify(body ?? {}));

export const isRejectedTrialCandidate = (candidateId) => REJECTED_TRIAL_CANDIDATES.has(normalizeText(candidateId));

export const summarizeOfficialPatientExistence = ({ httpStatus, body, candidateId }) => {
  const apiResult = normalizeApiResult(body?.apiResult ?? body?.Api_Result);
  const records = collectPatientRecords(body);
  const exactIdMatched = records.some((record) => patientIdOf(record) === candidateId);
  const notFoundMessage = hasPatientNotFoundMessage(body);
  return {
    httpStatus,
    apiResult,
    exactIdMatched,
    recordCount: records.length,
    accepted: httpStatus === 200 && isAllZeroApiResult(apiResult) && exactIdMatched && !notFoundMessage,
    evidenceHash: hash(`${candidateId}:${apiResult}:${exactIdMatched}:${records.length}:${notFoundMessage}`),
    notFoundMessage,
  };
};

const collectInsuranceCombinations = (body) => {
  const combinations = [];
  const push = (value) => {
    if (value && typeof value === 'object') combinations.push(value);
  };
  for (const item of asArray(body?.combinations)) push(item);
  for (const patient of collectPatientRecords(body)) {
    for (const item of asArray(patient?.insurances)) push(item);
    for (const item of asArray(patient?.HealthInsurance_Information)) push(item);
  }
  for (const item of asArray(body?.HealthInsurance_Information)) push(item);
  for (const item of asArray(body?.patientlst2res?.HealthInsurance_Information)) push(item);
  return combinations;
};

const normalizeDate = (value) => {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
};

const combinationNumberOf = (combination) =>
  normalizeText(combination?.combinationNumber ?? combination?.Insurance_Combination_Number);

const dateInRange = (baseDate, startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (start && baseDate < start) return false;
  if (end && end !== '9999-12-31' && baseDate > end) return false;
  return true;
};

export const summarizeInsuranceReadiness = ({ httpStatus, body, baseDate }) => {
  const apiResult = normalizeApiResult(body?.apiResult ?? body?.Api_Result);
  const combinations = collectInsuranceCombinations(body);
  const eligible = combinations.filter((combination) =>
    dateInRange(
      baseDate,
      combination?.certificateStartDate ?? combination?.Certificate_StartDate,
      combination?.certificateExpiredDate ?? combination?.Certificate_ExpiredDate,
    ),
  );
  const selected = eligible.find((combination) => combinationNumberOf(combination)) ?? eligible[0];
  const selectedCombinationHash = selected ? hash(combinationNumberOf(selected) || JSON.stringify(Object.keys(selected))) : undefined;
  return {
    checked: true,
    httpStatus,
    apiResult,
    eligibleCount: eligible.length,
    selectedCombinationHash,
    accepted: httpStatus === 200 && isAllZeroApiResult(apiResult) && eligible.length > 0,
  };
};

export const summarizeSelectorReadiness = (selectors) => {
  const summarize = (item) => ({
    exists: item?.exists === true,
    optionCount: Number(item?.optionCount ?? 0),
    hasDesiredValue: item?.hasDesiredValue !== false,
    accepted: item?.exists === true && Number(item?.optionCount ?? 0) > 0 && item?.hasDesiredValue !== false,
  });
  const department = summarize(selectors?.department);
  const physician = summarize(selectors?.physician);
  const medicalInformation = summarize(selectors?.medicalInformation);
  return {
    department,
    physician,
    medicalInformation,
    accepted: department.accepted && physician.accepted && medicalInformation.accepted,
  };
};

export const summarizeLocalSelectableReadiness = ({ candidateId, selectableCount, exactMatch }) => ({
  selectableCount: Number(selectableCount ?? 0),
  exactMatch: exactMatch === true,
  accepted: Number(selectableCount ?? 0) === 1 && exactMatch === true,
  evidenceHash: hash(`${candidateId}:${selectableCount}:${exactMatch}`),
});

export const classifyAcceptmodReadOnlyDiagnostic = ({ executed, httpStatus, apiResult }) => {
  if (!executed) {
    return { executed: false, apiResult: '', classification: 'not_verified', accepted: false };
  }
  const normalized = normalizeApiResult(apiResult);
  if (normalized === '10') {
    return { executed: true, httpStatus, apiResult: normalized, classification: 'patient_not_found', accepted: false };
  }
  if (normalized === '60') {
    return {
      executed: true,
      httpStatus,
      apiResult: normalized,
      classification: 'diagnostic_no_existing_acceptance',
      accepted: true,
    };
  }
  if (httpStatus === 200 && isAllZeroApiResult(normalized)) {
    return { executed: true, httpStatus, apiResult: normalized, classification: 'diagnostic_existing_acceptance', accepted: true };
  }
  return { executed: true, httpStatus, apiResult: normalized, classification: 'not_verified', accepted: false };
};

export const evaluatePreflightSummary = (summary) => {
  if (isRejectedTrialCandidate(summary?.candidateId)) return 'rejected_candidate';
  if (!summary?.officialPatientExistence?.accepted) return 'official_patient_missing';
  if (!summary?.insuranceReadiness?.accepted) return 'insurance_missing';
  if (!summary?.selectorReadiness?.accepted) return 'selector_missing';
  if (!summary?.localSelectableReadiness?.accepted) return 'local_selectable_missing';
  if (summary?.appointmentDependency?.required && !summary?.appointmentDependency?.accepted) return 'appointment_missing';
  if (summary?.acceptmodv2ReadOnlyDiagnostic?.classification === 'patient_not_found') return 'diagnostic_patient_not_found';
  if (summary?.secretScanClean === false) return 'secret_scan_failed';
  return 'none';
};

export const buildInputIdentity = ({
  patientId,
  departmentCode,
  physicianCode,
  paymentMode,
  visitKind,
  medicalInformation,
  insuranceReadiness,
  officialPatientExistence,
  localSelectableReadiness,
}) => ({
  patientId,
  departmentCode,
  physicianCode,
  paymentMode,
  visitKind,
  medicalInformationState: normalizeText(medicalInformation) ? 'selected' : 'omitted',
  medicalInformationHash: normalizeText(medicalInformation) ? hash(normalizeText(medicalInformation)) : undefined,
  insuranceReadinessHash: insuranceReadiness?.selectedCombinationHash,
  officialPatientEvidenceHash: officialPatientExistence?.evidenceHash,
  localSelectableEvidenceHash: localSelectableReadiness?.evidenceHash,
});

export const verifyAcceptmodInputIdentity = ({ preflightSummary, current }) => {
  if (!preflightSummary?.acceptedForPhase3Attempt) {
    return `preflight_not_accepted:${preflightSummary?.blockerClassification ?? 'unknown'}`;
  }
  if (preflightSummary.runId !== current.runId) return `runId_mismatch:${preflightSummary.runId ?? 'none'}:${current.runId}`;
  const expected = preflightSummary.inputIdentity ?? {};
  for (const key of ['patientId', 'departmentCode', 'physicianCode', 'paymentMode', 'visitKind', 'medicalInformationState']) {
    if ((expected[key] ?? '') !== (current[key] ?? '')) {
      return `input_identity_mismatch:${key}`;
    }
  }
  return 'none';
};
