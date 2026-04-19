import crypto from 'node:crypto';

export const SELECTOR_OPTION_MISSING_BLOCKER = 'selector_option_missing';
export const EXACT_PREFLIGHT_SOURCE = 'qa-weborca-readonly-preflight';
export const CANDIDATE_DISCOVERY_SOURCE = 'qa-weborca-candidate-discovery';
export const EXACT_PREFLIGHT_FLOW_MODE = 'exact-readonly-preflight';
export const PREFLIGHT_INPUT_MISMATCH_BLOCKER = 'preflight_input_mismatch';
export const PREFLIGHT_NOT_ACCEPTED_BLOCKER = 'preflight_not_accepted';
export const PREFLIGHT_ARTIFACT_INVALID_BLOCKER = 'preflight_artifact_invalid';
export const PREFLIGHT_DISCOVERY_ONLY_BLOCKER = 'candidate_discovery_only';
export const PREFLIGHT_DIAGNOSTIC_NOT_VERIFIED_BLOCKER = 'preflight_diagnostic_not_verified';

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const stableNormalize = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableNormalize(value[key])]),
  );
};

export const stableHash = (value) =>
  crypto.createHash('sha256').update(JSON.stringify(stableNormalize(value))).digest('hex');

export const createEvidenceRef = (id, value) => ({
  id,
  hash: stableHash(value ?? null),
});

export const buildMedicalInformationState = (medicalInformation) => {
  const value = normalizeString(medicalInformation);
  return value ? { state: 'selected', value } : { state: 'omitted' };
};

export const buildInputIdentity = ({
  runId,
  candidateId,
  facilityId,
  patientId,
  departmentCode,
  physicianCode,
  paymentMode,
  visitKind,
  medicalInformation,
}) => {
  const identity = {
    runId: normalizeString(runId),
    candidate: {
      candidateId: normalizeString(candidateId),
      facilityId: normalizeString(facilityId),
      patientId: normalizeString(patientId),
    },
    input: {
      patientId: normalizeString(patientId),
      departmentCode: normalizeString(departmentCode),
      physicianCode: normalizeString(physicianCode),
      paymentMode: normalizeString(paymentMode),
      visitKind: normalizeString(visitKind),
      medicalInformation: buildMedicalInformationState(medicalInformation),
    },
  };
  return {
    ...identity,
    hash: stableHash(identity),
  };
};

const preflightIdentityFromSummary = (summary) =>
  summary?.inputIdentity?.runId && summary?.inputIdentity?.candidate && summary?.inputIdentity?.input
    ? summary.inputIdentity
    : null;

const pushMismatch = (mismatches, field, preflightValue, expectedValue) => {
  if (JSON.stringify(stableNormalize(preflightValue)) !== JSON.stringify(stableNormalize(expectedValue))) {
    mismatches.push({ field, preflight: preflightValue, expected: expectedValue });
  }
};

const missingRequiredExactFields = (summary) => {
  const required = [
    'runId',
    'candidateId',
    'patientId',
    'phase3AttemptPatientId',
    'inputIdentity',
    'departmentCode',
    'physicianCode',
    'paymentMode',
    'visitKind',
    'medicalInformationState',
    'officialPatientEvidenceRef',
    'officialPatientEvidenceHash',
    'insuranceEvidenceRef',
    'insuranceEvidenceHash',
    'localSelectableEvidenceRef',
    'localSelectableEvidenceHash',
    'selectorEvidenceRef',
    'selectorEvidenceHash',
    'acceptmodv2ReadOnlyDiagnostic',
    'flowMode',
    'rawSensitiveFieldsExcluded',
  ];
  return required.filter((field) => {
    const value = summary?.[field];
    if (field === 'rawSensitiveFieldsExcluded') return value !== true;
    if (field === 'inputIdentity' || field === 'medicalInformationState' || field === 'acceptmodv2ReadOnlyDiagnostic') {
      return !value || typeof value !== 'object';
    }
    return !normalizeString(value);
  });
};

const exactPreflightDiagnosticFailure = (summary) => {
  const diagnostic = summary?.acceptmodv2ReadOnlyDiagnostic;
  if (!diagnostic || typeof diagnostic !== 'object') return 'missing';
  if (diagnostic.mutationSuccess !== false) return 'mutation_success_claimed';
  if (diagnostic.acceptedForPhase3Attempt !== true) return diagnostic.businessReason ?? diagnostic.classification ?? 'not_accepted';
  return '';
};

export const validatePreflightSummary = ({ summary, expected, artifactPath = '', artifactSha256 = '' }) => {
  const expectedIdentity = buildInputIdentity(expected);
  const preflightIdentity = preflightIdentityFromSummary(summary);
  const artifactMissing = [];
  if (!normalizeString(artifactPath)) artifactMissing.push('artifactPath');
  if (!normalizeString(artifactSha256)) artifactMissing.push('artifactSha256');
  if (artifactMissing.length > 0) {
    return {
      ok: false,
      mutationAllowed: false,
      blockerClassification: PREFLIGHT_ARTIFACT_INVALID_BLOCKER,
      expectedIdentity,
      preflightIdentity,
      mismatches: [],
      missingFields: artifactMissing,
      error: `exact read-only WebORCA preflight artifact metadata is required: ${artifactMissing.join(', ')}`,
    };
  }

  if (summary?.source === CANDIDATE_DISCOVERY_SOURCE || summary?.candidateDiscoveryAloneAuthorizesPhase3 === false) {
    return {
      ok: false,
      mutationAllowed: false,
      blockerClassification: PREFLIGHT_DISCOVERY_ONLY_BLOCKER,
      expectedIdentity,
      preflightIdentity,
      mismatches: [],
      error: 'candidate discovery output is only a proposal and cannot authorize Phase 3 mutation',
    };
  }

  if (summary?.source !== EXACT_PREFLIGHT_SOURCE || summary?.flowMode !== EXACT_PREFLIGHT_FLOW_MODE) {
    return {
      ok: false,
      mutationAllowed: false,
      blockerClassification: PREFLIGHT_ARTIFACT_INVALID_BLOCKER,
      expectedIdentity,
      preflightIdentity,
      mismatches: [],
      error: `exact read-only WebORCA preflight source/flow is required; source=${summary?.source ?? 'unknown'} flowMode=${summary?.flowMode ?? 'unknown'}`,
    };
  }

  const missingFields = missingRequiredExactFields(summary);
  if (!preflightIdentity) missingFields.push('inputIdentity.runId/inputIdentity.candidate/inputIdentity.input');
  if (missingFields.length > 0) {
    return {
      ok: false,
      mutationAllowed: false,
      blockerClassification: PREFLIGHT_ARTIFACT_INVALID_BLOCKER,
      expectedIdentity,
      preflightIdentity,
      mismatches: [],
      missingFields,
      error: `exact read-only WebORCA preflight summary is missing required fields: ${missingFields.join(', ')}`,
    };
  }

  const accepted =
    summary?.acceptedForPhase3Attempt === true &&
    summary?.verdict === 'accepted' &&
    summary?.blockerClassification === 'none';

  if (!accepted) {
    return {
      ok: false,
      mutationAllowed: false,
      blockerClassification: PREFLIGHT_NOT_ACCEPTED_BLOCKER,
      expectedIdentity,
      preflightIdentity,
      mismatches: [],
      error: `PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER: exact read-only WebORCA preflight was not accepted; acceptedForPhase3Attempt=${JSON.stringify(summary?.acceptedForPhase3Attempt)} verdict=${summary?.verdict ?? 'unknown'} blocker=${summary?.blockerClassification ?? 'unknown'}. Do not conclude WebORCA Trial initial patients 00001-00011 are nonexistent.`,
    };
  }

  const diagnosticFailure = exactPreflightDiagnosticFailure(summary);
  if (diagnosticFailure) {
    return {
      ok: false,
      mutationAllowed: false,
      blockerClassification: PREFLIGHT_DIAGNOSTIC_NOT_VERIFIED_BLOCKER,
      expectedIdentity,
      preflightIdentity,
      mismatches: [],
      error: `exact read-only WebORCA preflight diagnostic is not verified: ${diagnosticFailure}`,
    };
  }

  const mismatches = [];
  pushMismatch(mismatches, 'summary.runId', summary.runId, expectedIdentity.runId);
  pushMismatch(mismatches, 'summary.candidateId', summary.candidateId, expectedIdentity.candidate.candidateId);
  pushMismatch(mismatches, 'summary.patientId', summary.patientId, expectedIdentity.input.patientId);
  pushMismatch(mismatches, 'summary.phase3AttemptPatientId', summary.phase3AttemptPatientId, expectedIdentity.input.patientId);
  pushMismatch(mismatches, 'summary.departmentCode', summary.departmentCode, expectedIdentity.input.departmentCode);
  pushMismatch(mismatches, 'summary.physicianCode', summary.physicianCode, expectedIdentity.input.physicianCode);
  pushMismatch(mismatches, 'summary.paymentMode', summary.paymentMode, expectedIdentity.input.paymentMode);
  pushMismatch(mismatches, 'summary.visitKind', summary.visitKind, expectedIdentity.input.visitKind);
  pushMismatch(mismatches, 'summary.medicalInformationState', summary.medicalInformationState, expectedIdentity.input.medicalInformation);
  pushMismatch(mismatches, 'runId', preflightIdentity.runId, expectedIdentity.runId);
  pushMismatch(mismatches, 'candidate.candidateId', preflightIdentity.candidate?.candidateId, expectedIdentity.candidate.candidateId);
  pushMismatch(mismatches, 'candidate', preflightIdentity.candidate, expectedIdentity.candidate);
  pushMismatch(mismatches, 'input.patientId', preflightIdentity.input?.patientId, expectedIdentity.input.patientId);
  pushMismatch(mismatches, 'input.departmentCode', preflightIdentity.input?.departmentCode, expectedIdentity.input.departmentCode);
  pushMismatch(mismatches, 'input.physicianCode', preflightIdentity.input?.physicianCode, expectedIdentity.input.physicianCode);
  pushMismatch(mismatches, 'input.paymentMode', preflightIdentity.input?.paymentMode, expectedIdentity.input.paymentMode);
  pushMismatch(mismatches, 'input.visitKind', preflightIdentity.input?.visitKind, expectedIdentity.input.visitKind);
  pushMismatch(
    mismatches,
    'input.medicalInformation',
    preflightIdentity.input?.medicalInformation,
    expectedIdentity.input.medicalInformation,
  );
  if (preflightIdentity.hash && preflightIdentity.hash !== stableHash({
    runId: preflightIdentity.runId,
    candidate: preflightIdentity.candidate,
    input: preflightIdentity.input,
  })) {
    mismatches.push({ field: 'inputIdentity.hash', preflight: preflightIdentity.hash, expected: 'hash of preflight identity fields' });
  }

  if (mismatches.length > 0) {
    return {
      ok: false,
      mutationAllowed: false,
      blockerClassification: PREFLIGHT_INPUT_MISMATCH_BLOCKER,
      expectedIdentity,
      preflightIdentity,
      mismatches,
      error: `read-only WebORCA preflight identity mismatch: ${mismatches.map((item) => item.field).join(', ')}`,
    };
  }

  return {
    ok: true,
    mutationAllowed: true,
    blockerClassification: 'none',
    artifactPath,
    artifactSha256,
    expectedIdentity,
    preflightIdentity,
    mismatches: [],
  };
};

export const resolveSelectableOption = ({
  field,
  desiredValue,
  options,
  allowLocalOptionInjection = false,
}) => {
  const desired = normalizeString(desiredValue);
  const normalizedOptions = Array.isArray(options) ? options.map((option) => normalizeString(option)) : [];

  if (!desired) {
    return {
      field,
      ok: true,
      mutationAllowed: true,
      desired,
      resolved: '',
      options: normalizedOptions,
      optionCount: normalizedOptions.length,
      omitted: true,
      injected: false,
      acceptedLiveEvidence: true,
    };
  }

  if (normalizedOptions.includes(desired)) {
    return {
      field,
      ok: true,
      mutationAllowed: true,
      desired,
      resolved: desired,
      options: normalizedOptions,
      optionCount: normalizedOptions.length,
      omitted: false,
      injected: false,
      acceptedLiveEvidence: true,
    };
  }

  if (allowLocalOptionInjection) {
    return {
      field,
      ok: true,
      mutationAllowed: true,
      desired,
      resolved: desired,
      options: normalizedOptions,
      optionCount: normalizedOptions.length,
      omitted: false,
      injected: true,
      acceptedLiveEvidence: false,
    };
  }

  return {
    field,
    ok: false,
    mutationAllowed: false,
    desired,
    resolved: '',
    options: normalizedOptions,
    optionCount: normalizedOptions.length,
    omitted: false,
    injected: false,
    acceptedLiveEvidence: false,
    blockerClassification: SELECTOR_OPTION_MISSING_BLOCKER,
    error: `${field} desired option is missing: ${desired}`,
  };
};

export const summarizeSelectorGate = (selection) => {
  const items = Object.values(selection ?? {}).filter((item) => item && typeof item === 'object' && 'ok' in item);
  const missing = items.filter((item) => item.ok === false);
  return {
    ok: missing.length === 0,
    mutationAllowed: missing.length === 0,
    blockerClassification: missing.length === 0 ? 'none' : SELECTOR_OPTION_MISSING_BLOCKER,
    missingFields: missing.map((item) => item.field),
    acceptedLiveEvidence: items.every((item) => item.acceptedLiveEvidence !== false),
  };
};
