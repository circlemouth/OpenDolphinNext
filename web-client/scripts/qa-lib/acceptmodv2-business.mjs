const ACCEPTMOD_API_RESULT_PATIENT_NOT_FOUND = '10';
const ACCEPTMOD_API_RESULT_NO_ACCEPTANCE = '60';
const ACCEPTMOD_API_RESULT_INSURANCE_MISMATCH = '21';
const ACCEPTMOD_API_RESULT_ALREADY_ACCEPTED = '16';
const ACCEPTMOD_WARNING_RESULTS = new Set(['K1', 'K2', 'K3']);
const ACCEPTMOD_ALLOWED_MUTATION_REQUEST_NUMBER = '01';
const ACCEPTMOD_DIAGNOSTIC_REQUEST_NUMBER = '00';
const ACCEPTMOD_FORBIDDEN_MUTATION_REQUEST_NUMBERS = new Set(['02', '03', '04']);

const normalizeApiResult = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim().toUpperCase();
  if (typeof value === 'string') return value.trim().toUpperCase();
  return '';
};

const hasValue = (value) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return false;
};

const hasNestedValueForKeys = (value, keys, depth = 0) => {
  if (depth > 6 || value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => hasNestedValueForKeys(entry, keys, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => {
    if (keys.has(key) && hasValue(entry)) return true;
    return typeof entry === 'object' && entry != null && hasNestedValueForKeys(entry, keys, depth + 1);
  });
};

const ACCEPTANCE_EVIDENCE_KEYS = new Set([
  'acceptanceId',
  'Acceptance_Id',
  'acceptance_id',
  'receptionId',
  'voucherNumber',
  'Voucher_Number',
  'visitNumber',
  'Visit_Number',
  'sequentialNumber',
  'Sequential_Number',
  'scheduleKey',
  'Schedule_Key',
  'encounterKey',
  'Encounter_Key',
]);

const PATIENT_EVIDENCE_KEYS = new Set([
  'patientId',
  'Patient_ID',
  'patient_id',
  'name',
  'wholeName',
  'WholeName',
  'wholeNameKana',
  'WholeName_inKana',
  'birthDate',
  'BirthDate',
]);

export const hasAcceptmodRegistrationEvidence = (raw) =>
  hasNestedValueForKeys(raw, ACCEPTANCE_EVIDENCE_KEYS) || hasNestedValueForKeys(raw, PATIENT_EVIDENCE_KEYS);

export const classifyAcceptmodv2BusinessResult = ({ ok = true, apiResult, raw } = {}) => {
  const normalized = normalizeApiResult(apiResult);
  const hasRegistrationEvidence = hasAcceptmodRegistrationEvidence(raw);
  const requestNumber =
    typeof raw?.requestNumber === 'string'
      ? raw.requestNumber.trim()
      : typeof raw?.Request_Number === 'string'
        ? raw.Request_Number.trim()
        : '';
  const observedNonPhase3RegistrationRequest =
    requestNumber === ACCEPTMOD_DIAGNOSTIC_REQUEST_NUMBER ||
    ACCEPTMOD_FORBIDDEN_MUTATION_REQUEST_NUMBERS.has(requestNumber) ||
    (requestNumber.length > 0 && requestNumber !== ACCEPTMOD_ALLOWED_MUTATION_REQUEST_NUMBER);

  if (!ok) {
    return {
      businessStatus: 'businessRejected',
      businessReason: 'transport_error',
      apiResult: normalized,
      hasRegistrationEvidence,
    };
  }
  if (observedNonPhase3RegistrationRequest) {
    return {
      businessStatus: 'notVerified',
      businessReason: 'non_phase3_registration_request_number_without_mutation_success',
      apiResult: normalized,
      hasRegistrationEvidence,
    };
  }
  if (normalized === ACCEPTMOD_API_RESULT_PATIENT_NOT_FOUND) {
    return {
      businessStatus: 'businessRejected',
      businessReason: 'patient_not_found',
      apiResult: normalized,
      hasRegistrationEvidence,
    };
  }
  if (normalized === ACCEPTMOD_API_RESULT_NO_ACCEPTANCE) {
    return {
      businessStatus: 'diagnosticNoExistingAcceptance',
      businessReason: 'no_existing_acceptance',
      apiResult: normalized,
      hasRegistrationEvidence,
    };
  }
  if (normalized === ACCEPTMOD_API_RESULT_INSURANCE_MISMATCH) {
    return {
      businessStatus: 'businessRejected',
      businessReason: 'insurance_mismatch',
      apiResult: normalized,
      hasRegistrationEvidence,
    };
  }
  if (normalized === ACCEPTMOD_API_RESULT_ALREADY_ACCEPTED) {
    return {
      businessStatus: 'businessRejected',
      businessReason: 'duplicate_acceptance',
      apiResult: normalized,
      hasRegistrationEvidence,
    };
  }
  if (ACCEPTMOD_WARNING_RESULTS.has(normalized)) {
    return hasRegistrationEvidence
      ? {
          businessStatus: 'businessAcceptedWithWarnings',
          businessReason: 'official_warning_with_registration_evidence',
          apiResult: normalized,
          hasRegistrationEvidence,
        }
      : {
          businessStatus: 'notVerified',
          businessReason: 'warning_without_registration_evidence',
          apiResult: normalized,
          hasRegistrationEvidence,
        };
  }
  if (/^0+$/.test(normalized)) {
    return hasRegistrationEvidence
      ? {
          businessStatus: 'businessAccepted',
          businessReason: 'accepted_with_registration_evidence',
          apiResult: normalized,
          hasRegistrationEvidence,
        }
      : {
          businessStatus: 'notVerified',
          businessReason: 'success_code_without_registration_evidence',
          apiResult: normalized,
          hasRegistrationEvidence,
        };
  }
  if (!normalized) {
    return {
      businessStatus: 'notVerified',
      businessReason: hasRegistrationEvidence ? 'registration_evidence_without_success_code' : 'missing_api_result',
      apiResult: normalized,
      hasRegistrationEvidence,
    };
  }
  return {
    businessStatus: 'businessRejected',
    businessReason: 'api_result_rejected',
    apiResult: normalized,
    hasRegistrationEvidence,
  };
};

export const isAcceptmodBusinessAccepted = (status) =>
  status === 'businessAccepted' || status === 'businessAcceptedWithWarnings';
