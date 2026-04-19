import { describe, expect, it } from 'vitest';

import {
  CANDIDATE_DISCOVERY_SOURCE,
  EXACT_PREFLIGHT_FLOW_MODE,
  EXACT_PREFLIGHT_SOURCE,
  SELECTOR_OPTION_MISSING_BLOCKER,
  buildInputIdentity,
  resolveSelectableOption,
  validatePreflightSummary,
} from '../qa-lib/acceptmodv2-identity-gate.mjs';

const baseInput = {
  runId: '20260419T013630Z',
  candidateId: '20260419T013630Z:acceptmodv2',
  facilityId: 'FACILITY-1',
  patientId: '0000001',
  departmentCode: '01',
  physicianCode: '10001',
  paymentMode: 'insurance',
  visitKind: '1',
  medicalInformation: '',
};

const acceptedSummary = (overrides = {}) => {
  const input = { ...baseInput, ...overrides };
  const medicalInformationState = input.medicalInformation
    ? { state: 'selected', value: input.medicalInformation }
    : { state: 'omitted' };
  return {
    runId: input.runId,
    source: EXACT_PREFLIGHT_SOURCE,
    flowMode: EXACT_PREFLIGHT_FLOW_MODE,
    candidateId: input.candidateId,
    verdict: 'accepted',
    blockerClassification: 'none',
    acceptedForPhase3Attempt: true,
    facilityId: input.facilityId,
    patientId: input.patientId,
    phase3AttemptPatientId: input.patientId,
    departmentCode: input.departmentCode,
    physicianCode: input.physicianCode,
    paymentMode: input.paymentMode,
    visitKind: input.visitKind,
    medicalInformation: input.medicalInformation || undefined,
    medicalInformationState,
    inputIdentity: buildInputIdentity(input),
    officialPatientEvidenceRef: 'summary.json#/officialPatientExistence',
    officialPatientEvidenceHash: 'official-hash',
    insuranceEvidenceRef: 'summary.json#/insuranceReadiness',
    insuranceEvidenceHash: 'insurance-hash',
    localSelectableEvidenceRef: 'summary.json#/localSelectableReadiness',
    localSelectableEvidenceHash: 'local-hash',
    selectorEvidenceRef: 'summary.json#/selectorReadiness',
    selectorEvidenceHash: 'selector-hash',
    acceptmodv2ReadOnlyDiagnostic: {
      apiResult: '60',
      classification: 'diagnostic_no_existing_acceptance',
      businessStatus: 'diagnosticNoExistingAcceptance',
      businessReason: 'no_existing_acceptance',
      mutationSuccess: false,
      acceptedForPhase3Attempt: true,
    },
    rawSensitiveFieldsExcluded: true,
  };
};

describe('acceptmodv2 preflight identity gate', () => {
  it('same runId/candidate/input proceeds', () => {
    const result = validatePreflightSummary({
      summary: acceptedSummary(),
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: baseInput,
    });

    expect(result.ok).toBe(true);
    expect(result.mutationAllowed).toBe(true);
    expect(result.blockerClassification).toBe('none');
  });

  it.each([
    ['runId', { runId: '20260419T999999Z' }, 'runId'],
    ['candidate', { candidateId: 'other-candidate' }, 'candidate.candidateId'],
    ['patient', { patientId: '9999999' }, 'input.patientId'],
    ['department', { departmentCode: '02' }, 'input.departmentCode'],
    ['physician', { physicianCode: '20002' }, 'input.physicianCode'],
    ['payment', { paymentMode: 'self-pay' }, 'input.paymentMode'],
    ['visitKind', { visitKind: '2' }, 'input.visitKind'],
    ['medicalInformation selected value', { medicalInformation: '01' }, 'input.medicalInformation'],
  ])('%s mismatch fails closed before mutation', (_label, expectedOverride, mismatchField) => {
    const result = validatePreflightSummary({
      summary: acceptedSummary(),
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: { ...baseInput, ...expectedOverride },
    });

    expect(result.ok).toBe(false);
    expect(result.mutationAllowed).toBe(false);
    expect(result.blockerClassification).toBe('preflight_input_mismatch');
    expect(result.mismatches.map((item) => item.field)).toContain(mismatchField);
  });

  it('rejects candidate discovery summary even when it proposes a selected candidate', () => {
    const result = validatePreflightSummary({
      summary: {
        runId: baseInput.runId,
        source: CANDIDATE_DISCOVERY_SOURCE,
        flowMode: 'candidate-discovery-proposal',
        candidateDiscoveryAloneAuthorizesPhase3: false,
        acceptedForPhase3Attempt: false,
        selectedCandidate: { kind: 'proposal', patientId: baseInput.patientId },
      },
      artifactPath: '/tmp/discovery-summary.json',
      artifactSha256: 'def456',
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.mutationAllowed).toBe(false);
    expect(result.blockerClassification).toBe('candidate_discovery_only');
  });

  it('rejects candidate discovery summary even if it claims acceptedForPhase3Attempt=true', () => {
    const result = validatePreflightSummary({
      summary: {
        ...acceptedSummary(),
        source: CANDIDATE_DISCOVERY_SOURCE,
        flowMode: 'candidate-discovery-proposal',
        candidateDiscoveryAloneAuthorizesPhase3: false,
        acceptedForPhase3Attempt: true,
      },
      artifactPath: '/tmp/discovery-summary.json',
      artifactSha256: 'def456',
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.mutationAllowed).toBe(false);
    expect(result.blockerClassification).toBe('candidate_discovery_only');
  });

  it('does not reject exact preflight solely because it carries candidate discovery safety metadata', () => {
    const result = validatePreflightSummary({
      summary: {
        ...acceptedSummary(),
        source: EXACT_PREFLIGHT_SOURCE,
        flowMode: EXACT_PREFLIGHT_FLOW_MODE,
        candidateDiscoveryAloneAuthorizesPhase3: false,
      },
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: baseInput,
    });

    expect(result.ok).toBe(true);
    expect(result.mutationAllowed).toBe(true);
    expect(result.blockerClassification).toBe('none');
  });

  it.each([
    ['false', false],
    ['string true', 'true'],
    ['object', { patientId: baseInput.patientId }],
    ['null', null],
  ])('rejects non-boolean true acceptedForPhase3Attempt value: %s', (_label, acceptedForPhase3Attempt) => {
    const result = validatePreflightSummary({
      summary: { ...acceptedSummary(), acceptedForPhase3Attempt },
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.mutationAllowed).toBe(false);
    expect(result.blockerClassification).toBe('preflight_not_accepted');
  });

  it('rejects exact preflight when inputIdentity is missing', () => {
    const summary = acceptedSummary();
    delete (summary as Record<string, unknown>).inputIdentity;
    const result = validatePreflightSummary({
      summary,
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.blockerClassification).toBe('preflight_artifact_invalid');
    expect(result.missingFields).toContain('inputIdentity');
  });

  it('rejects exact preflight when diagnostic is missing', () => {
    const summary = acceptedSummary();
    delete (summary as Record<string, unknown>).acceptmodv2ReadOnlyDiagnostic;
    const result = validatePreflightSummary({
      summary,
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.blockerClassification).toBe('preflight_artifact_invalid');
    expect(result.missingFields).toContain('acceptmodv2ReadOnlyDiagnostic');
  });

  it('rejects exact preflight when raw sensitive field exclusion is not asserted', () => {
    const result = validatePreflightSummary({
      summary: { ...acceptedSummary(), rawSensitiveFieldsExcluded: false },
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.blockerClassification).toBe('preflight_artifact_invalid');
    expect(result.missingFields).toContain('rawSensitiveFieldsExcluded');
  });

  it('rejects exact preflight when Request_Number=00 found an existing acceptance', () => {
    const result = validatePreflightSummary({
      summary: {
        ...acceptedSummary(),
        acceptmodv2ReadOnlyDiagnostic: {
          apiResult: '00',
          classification: 'diagnostic_existing_acceptance',
          businessStatus: 'diagnosticExistingAcceptance',
          businessReason: 'existing_acceptance',
          mutationSuccess: false,
          acceptedForPhase3Attempt: false,
        },
      },
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.mutationAllowed).toBe(false);
    expect(result.blockerClassification).toBe('preflight_diagnostic_not_verified');
  });

  it('requires exact preflight artifact path and hash', () => {
    const result = validatePreflightSummary({
      summary: acceptedSummary(),
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.blockerClassification).toBe('preflight_artifact_invalid');
    expect(result.missingFields).toEqual(['artifactPath', 'artifactSha256']);
  });

  it('rejects selected preflight when current run omits medicalInformation', () => {
    const result = validatePreflightSummary({
      summary: acceptedSummary({ medicalInformation: '01' }),
      artifactPath: '/tmp/summary.json',
      artifactSha256: 'abc123',
      expected: baseInput,
    });

    expect(result.ok).toBe(false);
    expect(result.mutationAllowed).toBe(false);
    expect(result.blockerClassification).toBe('preflight_input_mismatch');
    expect(result.mismatches.map((item) => item.field)).toContain('summary.medicalInformationState');
    expect(result.mismatches.map((item) => item.field)).toContain('input.medicalInformation');
  });
});

describe('acceptmodv2 selector gate', () => {
  it('live option missing blocks mutation and does not inject', () => {
    const result = resolveSelectableOption({
      field: 'departmentCode',
      desiredValue: '01',
      options: ['02', '03'],
      allowLocalOptionInjection: false,
    });

    expect(result.ok).toBe(false);
    expect(result.mutationAllowed).toBe(false);
    expect(result.injected).toBe(false);
    expect(result.blockerClassification).toBe(SELECTOR_OPTION_MISSING_BLOCKER);
  });

  it('local permissive injection is explicit and not accepted as live evidence', () => {
    const result = resolveSelectableOption({
      field: 'departmentCode',
      desiredValue: '01',
      options: ['02', '03'],
      allowLocalOptionInjection: true,
    });

    expect(result.ok).toBe(true);
    expect(result.mutationAllowed).toBe(true);
    expect(result.injected).toBe(true);
    expect(result.acceptedLiveEvidence).toBe(false);
  });
});
