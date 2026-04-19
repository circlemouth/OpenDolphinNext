import crypto from 'node:crypto';

export const SELECTOR_OPTION_MISSING_BLOCKER = 'selector_option_missing';
export const PREFLIGHT_INPUT_MISMATCH_BLOCKER = 'preflight_input_mismatch';
export const PREFLIGHT_NOT_ACCEPTED_BLOCKER = 'preflight_not_accepted';

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

const inputIdentityFromSummary = (summary) => {
  if (summary?.inputIdentity?.runId && summary?.inputIdentity?.input) {
    return summary.inputIdentity;
  }
  return buildInputIdentity({
    runId: summary?.runId,
    candidateId: summary?.candidateId ?? summary?.inputIdentity?.candidate?.candidateId,
    facilityId: summary?.facilityId,
    patientId: summary?.patientId ?? summary?.patientSearch?.patientId,
    departmentCode: summary?.departmentCode,
    physicianCode: summary?.physicianCode,
    paymentMode: summary?.paymentMode,
    visitKind: summary?.visitKind,
    medicalInformation: summary?.medicalInformationState?.state === 'selected'
      ? summary.medicalInformationState.value
      : summary?.medicalInformation,
  });
};

const pushMismatch = (mismatches, field, preflightValue, expectedValue) => {
  if (JSON.stringify(stableNormalize(preflightValue)) !== JSON.stringify(stableNormalize(expectedValue))) {
    mismatches.push({ field, preflight: preflightValue, expected: expectedValue });
  }
};

export const validatePreflightSummary = ({ summary, expected }) => {
  const accepted = summary?.verdict === 'accepted' && summary?.blockerClassification === 'none';
  const expectedIdentity = buildInputIdentity(expected);
  const preflightIdentity = inputIdentityFromSummary(summary);

  if (!accepted) {
    return {
      ok: false,
      mutationAllowed: false,
      blockerClassification: PREFLIGHT_NOT_ACCEPTED_BLOCKER,
      expectedIdentity,
      preflightIdentity,
      mismatches: [],
      error: `read-only WebORCA preflight was not accepted; verdict=${summary?.verdict ?? 'unknown'} blocker=${summary?.blockerClassification ?? 'unknown'}`,
    };
  }

  const mismatches = [];
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
