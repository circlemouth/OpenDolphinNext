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
export const CANDIDATE_DISCOVERY_RELEASE_VERDICTS = {
  exactPreflightRequired: 'PARTIAL / EXACT PREFLIGHT REQUIRED',
  readinessBlocker: 'PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER',
  readonlyMutationBlocked: 'PARTIAL / READONLY MUTATION BLOCKER',
};

const normalizeText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};
const normalizePatientId = (value) => normalizeText(value).normalize('NFKC');
const normalizeApiResult = (value) => normalizeText(value).toUpperCase();
const isAllZeroApiResult = (value) => /^0+$/.test(normalizeApiResult(value));
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
const INSURANCE_BUSINESS_REJECTED_RESULTS = new Set(['21', '23']);
const AMBIGUOUS_READINESS_HTTP_STATUSES = new Set([0, 401, 403, 404]);
const APPOINTMENT_FLOW_MODES = new Set(['direct_acceptance', 'appointment_row']);

const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const asFiniteStatus = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};
const is2xx = (httpStatus) => Number(httpStatus) >= 200 && Number(httpStatus) < 300;

const findFirstDeep = (value, names) => {
  const stack = [value];
  const visited = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }
    for (const [key, entry] of Object.entries(current)) {
      if (names.includes(key)) return entry;
      if (entry && typeof entry === 'object') stack.push(entry);
    }
  }
  return undefined;
};

const collectByKeyDeep = (value, names) => {
  const out = [];
  const stack = [value];
  const visited = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }
    for (const [key, entry] of Object.entries(current)) {
      if (names.includes(key)) {
        out.push(...asArray(entry).filter(isRecord));
      }
      if (entry && typeof entry === 'object') stack.push(entry);
    }
  }
  return out;
};

const hasWrapperError = (body) =>
  Boolean(
    body?.error ??
      body?.errors ??
      body?.errorCategory ??
      body?.wrapperError ??
      body?.upstreamError ??
      body?.status?.error ??
      body?.status?.errors,
  );

const isAmbiguousReadinessStatus = (status) =>
  AMBIGUOUS_READINESS_HTTP_STATUSES.has(asFiniteStatus(status)) || asFiniteStatus(status) >= 500;

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

const collectOfficialPatientInformationRecords = (body) =>
  collectByKeyDeep(body, [
    'Patient_Information',
    'Patient_Information_child',
    'patientInformation',
    'PatientInformation',
    'patient_information',
    'patient_information_child',
  ]);

const patientIdOf = (record) =>
  normalizePatientId(
    record?.patientId ??
      record?.Patient_ID ??
      record?.PatientId ??
      record?.PatientID ??
      record?.Patient_No ??
      record?.Patient_Number ??
      record?.summary?.patientId ??
      record?.summary?.Patient_ID ??
      record?.summary?.PatientId ??
      record?.summary?.PatientID ??
      record?.summary?.Patient_No ??
      record?.summary?.Patient_Number ??
      record?.patient?.patientId ??
      record?.patient?.Patient_ID ??
      record?.patient?.PatientId ??
      record?.patient?.PatientID ??
      record?.patient?.Patient_No ??
      record?.patient?.Patient_Number,
  );

const hasPatientNotFoundMessage = (body) =>
  /(患者番号がありません|patient[-_\s]*not[-_\s]*found|no\s+patient|患者番号に該当する患者が存在しません|該当する患者が存在しません|患者.*存在しません)/i.test(
    JSON.stringify(body ?? {}),
  );

export const isRejectedTrialCandidate = (candidateId) => REJECTED_TRIAL_CANDIDATES.has(normalizeText(candidateId));

export const summarizeOfficialPatientExistence = ({ httpStatus, body, candidateId }) => {
  const parsedOrcaBody = isRecord(body);
  const apiResult = normalizeApiResult(
    body?.apiResult ?? body?.Api_Result ?? findFirstDeep(body, ['apiResult', 'Api_Result', 'result', 'Result']),
  );
  const apiResultAccepted = isAllZeroApiResult(apiResult);
  const records = collectOfficialPatientInformationRecords(body);
  const patientInformationPresent = records.length > 0;
  const normalizedCandidateId = normalizePatientId(candidateId);
  const exactIdMatched = records.some((record) => patientIdOf(record) === normalizedCandidateId);
  const notFoundMessage = hasPatientNotFoundMessage(body);
  const category = notFoundMessage
    ? 'not_found'
    : !patientInformationPresent
      ? 'empty'
      : exactIdMatched
        ? 'present'
        : 'different_patient_id_present';
  const rejectionReason =
    !is2xx(httpStatus)
      ? 'http_not_2xx'
      : !parsedOrcaBody
        ? 'orca_body_not_parsed'
      : !apiResultAccepted
        ? apiResult
          ? 'api_result_not_all_zero'
          : 'api_result_missing'
        : !patientInformationPresent
          ? 'patient_information_missing'
          : !exactIdMatched
            ? 'exact_patient_id_mismatch'
            : notFoundMessage
              ? 'patient_not_found_wording_present'
              : category === 'empty' || category === 'not_found'
                ? `response_category_${category}`
                : 'none';
  const accepted =
    is2xx(httpStatus) &&
    parsedOrcaBody &&
    apiResultAccepted &&
    patientInformationPresent &&
    exactIdMatched &&
    !notFoundMessage &&
    category !== 'empty' &&
    category !== 'not_found';
  return {
    status: httpStatus,
    httpStatus,
    parsedOrcaBody,
    apiResult,
    apiResultAccepted,
    patientInformationPresent,
    exactIdMatched,
    patientIdMatched: exactIdMatched,
    category,
    responseCategory: category,
    recordCount: records.length,
    accepted,
    verdict: accepted ? 'accepted' : 'rejected',
    rejectionReason,
    evidenceHash: hash(
      `${normalizedCandidateId}:${httpStatus}:${apiResult}:${apiResultAccepted}:${patientInformationPresent}:${exactIdMatched}:${records.length}:${notFoundMessage}:${category}`,
    ),
    notFoundMessage,
  };
};

export const sanitizeOfficialPatientExistenceEvidence = (summary) => {
  const httpStatus = asFiniteStatus(summary?.httpStatus ?? summary?.status);
  const parsedOrcaBody = summary?.parsedOrcaBody === true;
  const apiResult = normalizeApiResult(summary?.apiResult);
  const apiResultAccepted = summary?.apiResultAccepted === true;
  const patientInformationPresent = summary?.patientInformationPresent === true;
  const exactIdMatched = summary?.exactIdMatched === true;
  const notFoundMessage = summary?.notFoundMessage === true;
  const responseCategory = normalizeText(summary?.responseCategory ?? summary?.category) || 'not_verified';
  const rejectionReason = normalizeText(summary?.rejectionReason) || 'not_verified';
  const evidenceHash =
    normalizeText(summary?.evidenceHash) ||
    hash(
      `${httpStatus}:${parsedOrcaBody}:${apiResult}:${apiResultAccepted}:${patientInformationPresent}:${exactIdMatched}:${notFoundMessage}:${responseCategory}:${rejectionReason}`,
    );
  return {
    httpStatus,
    parsedOrcaBody,
    apiResult,
    apiResultAccepted,
    patientInformationPresent,
    exactIdMatched,
    notFoundMessage,
    responseCategory,
    rejectionReason,
    evidenceHash,
    rawSensitiveFieldsExcluded: true,
  };
};

export const officialPatientEvidenceAccepted = (evidence) =>
  is2xx(evidence?.httpStatus) &&
  evidence?.parsedOrcaBody === true &&
  evidence?.apiResultAccepted === true &&
  evidence?.patientInformationPresent === true &&
  evidence?.exactIdMatched === true &&
  evidence?.notFoundMessage !== true &&
  evidence?.rawSensitiveFieldsExcluded === true;

export const buildOfficialPatientReadinessAxes = (candidateEvidenceMap) => {
  const entries = Object.entries(candidateEvidenceMap ?? {});
  return {
    meaning:
      '00001-00011 are official ORCA Trial initial patients; rejected exact preflight rows mean Phase 3 mutation-ready read-only evidence is incomplete and do not contradict official initial patient registration.',
    officialTrialInitialPatientsExistenceAssumption: 'registered_by_official_orca_trial_docs',
    rawSensitiveFieldsExcluded: true,
    patientgetv2: entries.map(([patientId, value]) => {
      const evidence = sanitizeOfficialPatientExistenceEvidence(value);
      return {
        patientId,
        httpStatus: evidence.httpStatus,
        parsedOrcaBody: evidence.parsedOrcaBody,
        apiResult: evidence.apiResult,
        apiResultAccepted: evidence.apiResultAccepted,
        patientInformationPresent: evidence.patientInformationPresent,
        exactIdMatched: evidence.exactIdMatched,
        patientNotFoundWordingAbsent: evidence.notFoundMessage !== true,
        responseCategory: evidence.responseCategory,
        rejectionReason: evidence.rejectionReason,
        accepted: officialPatientEvidenceAccepted(evidence),
        evidenceHash: evidence.evidenceHash,
        rawSensitiveFieldsExcluded: true,
      };
    }),
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return '';
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
  const status = asFiniteStatus(httpStatus);
  const classification = (() => {
    if (hasWrapperError(body) || isAmbiguousReadinessStatus(status)) return 'ambiguous_readiness_failure';
    if (!apiResult) return 'ambiguous_readiness_failure';
    if (INSURANCE_BUSINESS_REJECTED_RESULTS.has(apiResult)) return 'business_rejected_insurance';
    if (status !== 200) return 'ambiguous_readiness_failure';
    if (!isAllZeroApiResult(apiResult)) return 'business_rejected_insurance';
    if (eligible.length === 0) return 'insurance_not_usable';
    return 'accepted';
  })();
  return {
    checked: true,
    status,
    httpStatus,
    apiResult,
    classification,
    combinationsCount: combinations.length,
    eligibleCount: eligible.length,
    effectiveCount: eligible.length,
    selectedCombinationHash,
    accepted: classification === 'accepted',
  };
};

const collectAppointmentRows = (body) => {
  const rows = [];
  const push = (value) => {
    if (value && typeof value === 'object') rows.push(value);
  };
  for (const item of asArray(body?.slots)) push(item);
  for (const item of asArray(body?.reservations)) push(item);
  for (const item of asArray(body?.appointments)) push(item);
  for (const item of asArray(body?.items)) push(item);
  for (const item of asArray(body?.Appointment_Information)) push(item);
  for (const item of asArray(body?.Reservation_Information)) push(item);
  return rows;
};

const appointmentPatientIdOf = (row, body) =>
  normalizeText(
    row?.patientId ??
      row?.Patient_ID ??
      row?.patient?.patientId ??
      row?.patient?.Patient_ID ??
      row?.Patient_Information?.Patient_ID ??
      body?.patient?.patientId ??
      body?.patient?.Patient_ID,
  );

const appointmentDateOf = (row, body) =>
  normalizeDate(
    row?.appointmentDate ??
      row?.Appointment_Date ??
      row?.visitDate ??
      row?.Visit_Date ??
      row?.date ??
      body?.appointmentDate ??
      body?.baseDate,
  );

const appointmentRowMatches = (row, body, { patientId, baseDate } = {}) => {
  const expectedPatientId = normalizeText(patientId);
  const expectedDate = normalizeDate(baseDate);
  const rowPatientId = appointmentPatientIdOf(row, body);
  const rowDate = appointmentDateOf(row, body);
  if (expectedPatientId && rowPatientId !== expectedPatientId) return false;
  if (expectedDate && rowDate && rowDate !== expectedDate) return false;
  return Boolean(rowPatientId || !expectedPatientId);
};

export const summarizeAppointmentDependency = ({
  flowMode,
  httpStatus,
  body,
  apiResult,
  patientId,
  baseDate,
}) => {
  const normalizedFlowMode = APPOINTMENT_FLOW_MODES.has(normalizeText(flowMode)) ? normalizeText(flowMode) : 'unknown';
  const hasProbe = httpStatus !== undefined && httpStatus !== null;
  const status = hasProbe ? asFiniteStatus(httpStatus) : undefined;
  const normalizedApiResult = normalizeApiResult(apiResult ?? body?.apiResult ?? body?.Api_Result);
  const rows = collectAppointmentRows(body);
  const exactRowCount = rows.filter((row) => appointmentRowMatches(row, body, { patientId, baseDate })).length;
  const base = {
    flowMode: normalizedFlowMode,
    mode: normalizedFlowMode === 'direct_acceptance' ? 'direct_patient_acceptance_flow' : normalizedFlowMode,
    required: normalizedFlowMode === 'appointment_row',
    absenceBlocker: normalizedFlowMode === 'appointment_row',
    status,
    httpStatus: status,
    apiResult: normalizedApiResult,
    rowCount: rows.length,
    exactRowCount,
  };

  if (normalizedFlowMode === 'unknown') {
    return { ...base, classification: 'unknown_flow_mode', verdict: 'not_verified', accepted: false };
  }

  if (!hasProbe && normalizedFlowMode === 'direct_acceptance') {
    return {
      ...base,
      required: false,
      absenceBlocker: false,
      classification: 'direct_acceptance_no_appointment_required',
      verdict: 'accepted',
      accepted: true,
      reason: 'direct flow does not require an existing appointment row',
    };
  }

  if (hasWrapperError(body) || isAmbiguousReadinessStatus(status)) {
    return { ...base, classification: 'ambiguous_readiness_failure', verdict: 'rejected', accepted: false };
  }
  if (!normalizedApiResult) {
    return { ...base, classification: 'ambiguous_readiness_failure', verdict: 'rejected', accepted: false };
  }
  if (status !== 200) {
    return { ...base, classification: 'ambiguous_readiness_failure', verdict: 'rejected', accepted: false };
  }
  if (!isAllZeroApiResult(normalizedApiResult)) {
    return { ...base, classification: 'business_rejected_appointment', verdict: 'rejected', accepted: false };
  }

  if (normalizedFlowMode === 'direct_acceptance') {
    return {
      ...base,
      required: false,
      absenceBlocker: false,
      classification: exactRowCount > 0 ? 'appointment_row_present' : 'direct_acceptance_no_appointment_required',
      verdict: 'accepted',
      accepted: true,
      reason: exactRowCount > 0
        ? 'direct flow observed an appointment row but does not require it'
        : 'direct flow does not require an existing appointment row',
    };
  }

  if (exactRowCount > 0) {
    return { ...base, classification: 'appointment_row_present', verdict: 'accepted', accepted: true };
  }
  return { ...base, classification: 'appointment_row_missing', verdict: 'rejected', accepted: false };
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

export const classifyAcceptmodReadOnlyDiagnostic = ({
  executed,
  httpStatus,
  apiResult,
  body,
  parsedOrcaBody,
  diagnosticBodyParseSucceeded,
  wrapperError,
  upstreamError,
  errors,
  errorCategory,
}) => {
  if (!executed) {
    return {
      executed: false,
      apiResult: '',
      classification: 'not_verified',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
    };
  }
  const status = asFiniteStatus(httpStatus);
  const normalized = normalizeApiResult(
    apiResult ?? body?.apiResult ?? body?.Api_Result ?? findFirstDeep(body, ['apiResult', 'Api_Result', 'result', 'Result']),
  );
  const parseStateProvided = parsedOrcaBody !== undefined || diagnosticBodyParseSucceeded !== undefined;
  const diagnosticBodyParsed = parseStateProvided
    ? parsedOrcaBody === true || diagnosticBodyParseSucceeded === true
    : isRecord(body);
  const wrapperRejected =
    hasWrapperError(body) ||
    hasWrapperError({
      wrapperError,
      upstreamError,
      errors,
      errorCategory,
    });
  const acceptedDiagnosticTransport = is2xx(status) && !wrapperRejected && diagnosticBodyParsed;
  const rejectionReason =
    wrapperRejected
      ? 'wrapper_or_upstream_error'
      : !is2xx(status)
        ? 'http_not_2xx'
        : !diagnosticBodyParsed
          ? 'orca_body_not_parsed'
          : 'none';
  if (normalized === '10') {
    return {
      executed: true,
      httpStatus: status,
      apiResult: normalized,
      classification: 'patient_not_found',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
      rejectionReason,
    };
  }
  if (normalized === '60') {
    const acceptedForPhase3Attempt = acceptedDiagnosticTransport;
    return {
      executed: true,
      httpStatus: status,
      apiResult: normalized,
      classification: 'diagnostic_no_existing_acceptance',
      accepted: acceptedForPhase3Attempt,
      acceptedForPhase3Attempt,
      mutationSuccess: false,
      rejectionReason,
    };
  }
  if (acceptedDiagnosticTransport && isAllZeroApiResult(normalized)) {
    return {
      executed: true,
      httpStatus: status,
      apiResult: normalized,
      classification: 'diagnostic_existing_acceptance',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
      rejectionReason: 'existing_acceptance',
    };
  }
  return {
    executed: true,
    httpStatus: status,
    apiResult: normalized,
    classification: 'not_verified',
    accepted: false,
    acceptedForPhase3Attempt: false,
    mutationSuccess: false,
    rejectionReason,
  };
};

export const buildCandidateDiscoveryGate = ({
  candidateCount,
  acceptedCandidateCount,
  blockedRequestCount = 0,
  selectedCandidate = null,
}) => {
  const acceptedCount = Number(acceptedCandidateCount ?? 0);
  const blockedCount = Number(blockedRequestCount ?? 0);
  const readonlyMutationBlocked = blockedCount > 0;
  const hasProposal = acceptedCount > 0 && selectedCandidate;
  const releaseVerdict = readonlyMutationBlocked
    ? CANDIDATE_DISCOVERY_RELEASE_VERDICTS.readonlyMutationBlocked
    : hasProposal
      ? CANDIDATE_DISCOVERY_RELEASE_VERDICTS.exactPreflightRequired
      : CANDIDATE_DISCOVERY_RELEASE_VERDICTS.readinessBlocker;
  const blockerClassification = readonlyMutationBlocked
    ? 'readonly-mutation-blocker'
    : hasProposal
      ? 'candidate_discovery_only'
      : 'test-data-or-harness-readiness-blocker';
  const blockerReason = readonlyMutationBlocked
    ? 'readonly_mutation_attempt_blocked'
    : hasProposal
      ? 'exact_selected_candidate_preflight_required'
      : 'phase3_mutation_ready_readonly_evidence_missing';
  return {
    candidateDiscoveryAloneAuthorizesPhase3: false,
    acceptedForPhase3Attempt: false,
    phase3AttemptPatientId: null,
    releaseVerdict,
    verdict: 'partial',
    blockerClassification,
    blockerReason,
    mutationPolicy: {
      prohibited: true,
      blockedRequestCount: blockedCount,
    },
    exactSelectedCandidatePreflight: {
      ran: false,
      reason: hasProposal ? 'exact_selected_candidate_preflight_required' : 'phase3_mutation_ready_readonly_evidence_missing',
    },
    phase3: {
      ran: false,
      reason: hasProposal ? 'exact_selected_candidate_preflight_required' : 'phase3_mutation_ready_readonly_evidence_missing',
    },
    phase4: { ran: false, reason: 'phase3_not_run' },
    candidateDiscovery: {
      candidateCount: Number(candidateCount ?? 0),
      acceptedCandidateCount: acceptedCount,
    },
  };
};

export const evaluatePreflightSummary = (summary) => {
  if (isRejectedTrialCandidate(summary?.candidateId)) return 'rejected_candidate';
  if (!summary?.officialPatientExistence?.accepted) return 'official_patient_missing';
  if (!summary?.insuranceReadiness?.accepted) {
    if (summary?.insuranceReadiness?.classification === 'ambiguous_readiness_failure') return 'ambiguous_readiness_failure';
    if (summary?.insuranceReadiness?.classification === 'business_rejected_insurance') return 'business_rejected_insurance';
    return 'insurance_missing';
  }
  if (!summary?.selectorReadiness?.accepted) return 'selector_missing';
  if (!summary?.localSelectableReadiness?.accepted) return 'local_selectable_missing';
  if (summary?.appointmentDependency?.classification === 'ambiguous_readiness_failure') return 'ambiguous_readiness_failure';
  if (summary?.appointmentDependency?.required && !summary?.appointmentDependency?.accepted) {
    if (summary?.appointmentDependency?.classification === 'appointment_row_missing') return 'appointment_row_missing';
    return 'appointment_missing';
  }
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
