import { normalizeOrcaApiResult } from '../../libs/orca/orcaApiResultPolicy';

export type Acceptmodv2BusinessStatus =
  | 'businessAccepted'
  | 'businessAcceptedWithWarnings'
  | 'businessRejected'
  | 'diagnosticNoExistingAcceptance'
  | 'notVerified';

export type Acceptmodv2BusinessReason =
  | 'accepted_with_registration_evidence'
  | 'official_warning_with_registration_evidence'
  | 'patient_not_found'
  | 'insurance_mismatch'
  | 'duplicate_acceptance'
  | 'no_existing_acceptance'
  | 'api_result_rejected'
  | 'transport_error'
  | 'success_code_without_registration_evidence'
  | 'warning_without_registration_evidence'
  | 'registration_evidence_without_success_code'
  | 'missing_api_result';

export type Acceptmodv2BusinessResult = {
  businessStatus: Acceptmodv2BusinessStatus;
  businessReason: Acceptmodv2BusinessReason;
  apiResult: string;
  hasRegistrationEvidence: boolean;
};

type Acceptmodv2BusinessInput = {
  ok?: boolean;
  apiResult?: string | number | null;
  raw?: unknown;
};

const ACCEPTMOD_API_RESULT_ALREADY_ACCEPTED = '16';
const ACCEPTMOD_API_RESULT_SUCCESS = /^0+$/;
const ACCEPTMOD_OFFICIAL_WARNING_RESULTS = new Set(['K1', 'K2', 'K3']);

export const ACCEPTMOD_API_RESULT_INSURANCE_MISMATCH = '21';
export const ACCEPTMOD_API_RESULT_NO_ACCEPTANCE = '60';
export const ACCEPTMOD_API_RESULT_PATIENT_NOT_FOUND = '10';

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

const ACCEPTANCE_INFO_KEYS = new Set(['acceptanceInfo', 'Acceptance_Info', 'acceptance_info']);
const hasValue = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return false;
};

const hasAnyNonEmptyScalar = (value: unknown, depth = 0): boolean => {
  if (depth > 6 || value == null) return false;
  if (hasValue(value)) return true;
  if (Array.isArray(value)) return value.some((entry) => hasAnyNonEmptyScalar(entry, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.values(value as Record<string, unknown>).some((entry) => hasAnyNonEmptyScalar(entry, depth + 1));
};

const hasAcceptanceEvidence = (value: unknown, depth = 0): boolean => {
  if (depth > 6 || value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => hasAcceptanceEvidence(entry, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, entry]) => {
    if (ACCEPTANCE_EVIDENCE_KEYS.has(key) && hasValue(entry)) return true;
    if (ACCEPTANCE_INFO_KEYS.has(key)) return hasAnyNonEmptyScalar(entry, depth + 1);
    return typeof entry === 'object' && entry != null && hasAcceptanceEvidence(entry, depth + 1);
  });
};

export const hasAcceptmodRegistrationEvidence = (raw: unknown) =>
  hasAcceptanceEvidence(raw);

export const classifyAcceptmodv2BusinessResult = ({
  ok = true,
  apiResult,
  raw,
}: Acceptmodv2BusinessInput): Acceptmodv2BusinessResult => {
  const normalized = normalizeOrcaApiResult(apiResult);
  const hasRegistrationEvidence = hasAcceptmodRegistrationEvidence(raw);

  if (!ok) {
    return {
      businessStatus: 'businessRejected',
      businessReason: 'transport_error',
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

  if (ACCEPTMOD_OFFICIAL_WARNING_RESULTS.has(normalized)) {
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

  if (ACCEPTMOD_API_RESULT_SUCCESS.test(normalized)) {
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

export const isAcceptmodBusinessAccepted = (status?: Acceptmodv2BusinessStatus) =>
  status === 'businessAccepted' || status === 'businessAcceptedWithWarnings';

export const resolveAcceptmodFallbackMessage = (apiResult?: string) => {
  const normalized = normalizeOrcaApiResult(apiResult);
  if (normalized === ACCEPTMOD_API_RESULT_PATIENT_NOT_FOUND) return '患者が見つかりません';
  if (normalized === ACCEPTMOD_API_RESULT_INSURANCE_MISMATCH) return '保険不一致';
  if (normalized === ACCEPTMOD_API_RESULT_NO_ACCEPTANCE) return '受付なし';
  return undefined;
};

export const isAcceptmodInsuranceMismatch = (apiResult?: string) =>
  normalizeOrcaApiResult(apiResult) === ACCEPTMOD_API_RESULT_INSURANCE_MISMATCH;

export const isAcceptmodNoAcceptance = (apiResult?: string) =>
  normalizeOrcaApiResult(apiResult) === ACCEPTMOD_API_RESULT_NO_ACCEPTANCE;
