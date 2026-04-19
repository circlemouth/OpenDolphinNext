import { describe, expect, it } from 'vitest';

import {
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
  return {
    runId: input.runId,
    verdict: 'accepted',
    blockerClassification: 'none',
    facilityId: input.facilityId,
    patientId: input.patientId,
    departmentCode: input.departmentCode,
    physicianCode: input.physicianCode,
    paymentMode: input.paymentMode,
    visitKind: input.visitKind,
    medicalInformation: input.medicalInformation || undefined,
    inputIdentity: buildInputIdentity(input),
  };
};

describe('acceptmodv2 preflight identity gate', () => {
  it('same runId/candidate/input proceeds', () => {
    const result = validatePreflightSummary({
      summary: acceptedSummary(),
      expected: baseInput,
    });

    expect(result.ok).toBe(true);
    expect(result.mutationAllowed).toBe(true);
    expect(result.blockerClassification).toBe('none');
  });

  it.each([
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
      expected: { ...baseInput, ...expectedOverride },
    });

    expect(result.ok).toBe(false);
    expect(result.mutationAllowed).toBe(false);
    expect(result.blockerClassification).toBe('preflight_input_mismatch');
    expect(result.mismatches.map((item) => item.field)).toContain(mismatchField);
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
