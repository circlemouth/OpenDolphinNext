import { describe, expect, it } from 'vitest';

import {
  classifyAcceptmodReadOnlyDiagnostic,
  evaluatePreflightSummary,
  isRejectedTrialCandidate,
  summarizeInsuranceReadiness,
  summarizeLocalSelectableReadiness,
  summarizeOfficialPatientExistence,
  summarizeSelectorReadiness,
} from '../qa-lib/orca-trial-preflight.mjs';

const acceptedSelectors = {
  department: { exists: true, optionCount: 2, hasDesiredValue: true },
  physician: { exists: true, optionCount: 2, hasDesiredValue: true },
  medicalInformation: { exists: true, optionCount: 2, hasDesiredValue: true },
};

describe('orca trial-native preflight gates', () => {
  it('0000001 is an explicit rejected candidate', () => {
    expect(isRejectedTrialCandidate('0000001')).toBe(true);
  });

  it('accepts only exact official patient, eligible insurance, selectors, and local exact selectable', () => {
    const officialPatientExistence = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { apiResult: '00', patients: [{ summary: { patientId: '00001' } }] },
    });
    const insuranceReadiness = summarizeInsuranceReadiness({
      httpStatus: 200,
      baseDate: '2026-04-19',
      body: {
        apiResult: '00',
        combinations: [{ combinationNumber: '0001', certificateStartDate: '2020-01-01', certificateExpiredDate: '9999-12-31' }],
      },
    });
    const summary = {
      candidateId: '00001',
      officialPatientExistence,
      insuranceReadiness,
      selectorReadiness: summarizeSelectorReadiness(acceptedSelectors),
      localSelectableReadiness: summarizeLocalSelectableReadiness({ candidateId: '00001', selectableCount: 1, exactMatch: true }),
      appointmentDependency: { required: false, accepted: true },
      acceptmodv2ReadOnlyDiagnostic: classifyAcceptmodReadOnlyDiagnostic({ executed: true, httpStatus: 200, apiResult: '60' }),
      secretScanClean: true,
    };

    expect(evaluatePreflightSummary(summary)).toBe('none');
  });

  it('local selectable without official exact match is a test-data blocker', () => {
    const summary = {
      candidateId: '00001',
      officialPatientExistence: summarizeOfficialPatientExistence({
        httpStatus: 200,
        candidateId: '00001',
        body: { apiResult: '00', patients: [{ summary: { patientId: '99999' } }] },
      }),
      insuranceReadiness: { accepted: true },
      selectorReadiness: { accepted: true },
      localSelectableReadiness: { accepted: true },
      appointmentDependency: { required: false, accepted: true },
      acceptmodv2ReadOnlyDiagnostic: { classification: 'diagnostic_no_existing_acceptance' },
      secretScanClean: true,
    };

    expect(evaluatePreflightSummary(summary)).toBe('official_patient_missing');
  });

  it('patientlst2v2 patient-number-missing message is not an official match', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: {
        apiResult: '00',
        patients: [{ summary: { patientId: '00001', wholeName: '患者番号がありません' } }],
      },
    });

    expect(result.accepted).toBe(false);
  });

  it('apiResult=10 diagnostic rejects the candidate', () => {
    expect(classifyAcceptmodReadOnlyDiagnostic({ executed: true, httpStatus: 200, apiResult: '10' })).toMatchObject({
      classification: 'patient_not_found',
      accepted: false,
    });
  });

  it('apiResult=60 diagnostic means no existing acceptance, not mutation success', () => {
    expect(classifyAcceptmodReadOnlyDiagnostic({ executed: true, httpStatus: 200, apiResult: '60' })).toMatchObject({
      classification: 'diagnostic_no_existing_acceptance',
      accepted: true,
    });
  });

  it('missing insurance rejects the candidate', () => {
    const result = summarizeInsuranceReadiness({
      httpStatus: 200,
      baseDate: '2026-04-19',
      body: { apiResult: '00', combinations: [] },
    });

    expect(result.accepted).toBe(false);
  });

  it('missing selector rejects the candidate', () => {
    expect(summarizeSelectorReadiness({ ...acceptedSelectors, physician: { exists: true, optionCount: 0 } }).accepted).toBe(false);
  });
});
