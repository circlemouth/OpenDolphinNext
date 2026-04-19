import { describe, expect, it } from 'vitest';

import {
  TRIAL_NATIVE_PROBE_CANDIDATES,
  classifyAcceptmodReadOnlyDiagnostic,
  evaluatePreflightSummary,
  isRejectedTrialCandidate,
  summarizeAppointmentDependency,
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

  it('00001 through 00011 are probe candidates only and exclude the legacy seed', () => {
    expect(TRIAL_NATIVE_PROBE_CANDIDATES).toEqual([
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
    ]);
    expect(TRIAL_NATIVE_PROBE_CANDIDATES).not.toContain('0000001');
  });

  it('accepts only exact official patient, eligible insurance, selectors, and local exact selectable', () => {
    const officialPatientExistence = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { apiResult: '00', Patient_Information: { Patient_ID: '00001' } },
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

  it('rejects apiResult=10 even when Patient_Information has the exact ID', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { apiResult: '10', Patient_Information: { Patient_ID: '00001' } },
    });

    expect(result).toMatchObject({
      apiResult: '10',
      apiResultAccepted: false,
      patientInformationPresent: true,
      exactIdMatched: true,
      accepted: false,
      rejectionReason: 'api_result_not_all_zero',
    });
  });

  it('rejects missing or blank apiResult even with patient-like exact ID bodies', () => {
    expect(
      summarizeOfficialPatientExistence({
        httpStatus: 200,
        candidateId: '00001',
        body: { Patient_Information: { Patient_ID: '00001' } },
      }),
    ).toMatchObject({
      apiResult: '',
      apiResultAccepted: false,
      patientInformationPresent: true,
      exactIdMatched: true,
      accepted: false,
      rejectionReason: 'api_result_missing',
    });

    expect(
      summarizeOfficialPatientExistence({
        httpStatus: 200,
        candidateId: '00001',
        body: { apiResult: ' ', Patient_Information: { Patient_ID: '00001' } },
      }),
    ).toMatchObject({
      apiResult: '',
      apiResultAccepted: false,
      accepted: false,
      rejectionReason: 'api_result_missing',
    });
  });

  it('rejects apiResult=00 when Patient_Information is absent', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { apiResult: '00', patients: [{ summary: { patientId: '00001' } }] },
    });

    expect(result).toMatchObject({
      apiResultAccepted: true,
      patientInformationPresent: false,
      exactIdMatched: false,
      accepted: false,
      rejectionReason: 'patient_information_missing',
    });
  });

  it('accepts apiResult=00 with Patient_Information and exact Patient_ID after canonical normalization', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 204,
      candidateId: '00001',
      body: { Api_Result: '00', patientlst2res: { Patient_Information: { Patient_ID: ' ００００１ ' } } },
    });

    expect(result).toMatchObject({
      httpStatus: 204,
      apiResult: '00',
      apiResultAccepted: true,
      patientInformationPresent: true,
      exactIdMatched: true,
      category: 'present',
      accepted: true,
      rejectionReason: 'none',
    });
  });

  it('does not treat zero-padded digit length differences as exact Patient_ID matches', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { apiResult: '00', Patient_Information: { Patient_ID: '000001' } },
    });

    expect(result).toMatchObject({
      patientInformationPresent: true,
      exactIdMatched: false,
      accepted: false,
      rejectionReason: 'exact_patient_id_mismatch',
    });
  });

  it('local selectable without official exact match is a test-data blocker', () => {
    const summary = {
      candidateId: '00001',
      officialPatientExistence: summarizeOfficialPatientExistence({
        httpStatus: 200,
      candidateId: '00001',
      body: { apiResult: '00', Patient_Information: { Patient_ID: '99999' } },
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
        Patient_Information: { Patient_ID: '00001', WholeName: '患者番号がありません' },
      },
    });

    expect(result).toMatchObject({
      patientInformationPresent: true,
      exactIdMatched: true,
      accepted: false,
      rejectionReason: 'patient_not_found_wording_present',
    });
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

  it('classifies insurance 403 as ambiguous readiness failure, not missing', () => {
    const result = summarizeInsuranceReadiness({
      httpStatus: 403,
      baseDate: '2026-04-19',
      body: { apiResult: '', combinations: [] },
    });

    expect(result).toMatchObject({
      status: 403,
      apiResult: '',
      classification: 'ambiguous_readiness_failure',
      accepted: false,
    });
    expect(evaluatePreflightSummary({
      candidateId: '00001',
      officialPatientExistence: { accepted: true },
      insuranceReadiness: result,
      selectorReadiness: { accepted: true },
      localSelectableReadiness: { accepted: true },
      appointmentDependency: { flowMode: 'direct_acceptance', required: false, accepted: true },
      secretScanClean: true,
    })).toBe('ambiguous_readiness_failure');
  });

  it.each(['21', '23'])('classifies insurance apiResult=%s as business rejected insurance', (apiResult) => {
    const result = summarizeInsuranceReadiness({
      httpStatus: 200,
      baseDate: '2026-04-19',
      body: { apiResult, combinations: [{ combinationNumber: '0001' }] },
    });

    expect(result).toMatchObject({
      apiResult,
      classification: 'business_rejected_insurance',
      accepted: false,
    });
  });

  it('does not block direct acceptance only because no appointment row exists', () => {
    const result = summarizeAppointmentDependency({
      flowMode: 'direct_acceptance',
      httpStatus: 200,
      baseDate: '2026-04-19',
      patientId: '00001',
      body: { apiResult: '00', reservations: [] },
    });

    expect(result).toMatchObject({
      flowMode: 'direct_acceptance',
      required: false,
      classification: 'direct_acceptance_no_appointment_required',
      accepted: true,
    });
  });

  it.each(['direct_acceptance', 'appointment_row'])('classifies appointment 403 in %s as ambiguous readiness failure', (flowMode) => {
    const result = summarizeAppointmentDependency({
      flowMode,
      httpStatus: 403,
      baseDate: '2026-04-19',
      patientId: '00001',
      body: { apiResult: '', reservations: [] },
    });

    expect(result).toMatchObject({
      flowMode,
      status: 403,
      classification: 'ambiguous_readiness_failure',
      accepted: false,
    });
    expect(evaluatePreflightSummary({
      candidateId: '00001',
      officialPatientExistence: { accepted: true },
      insuranceReadiness: { accepted: true },
      selectorReadiness: { accepted: true },
      localSelectableReadiness: { accepted: true },
      appointmentDependency: result,
      secretScanClean: true,
    })).toBe('ambiguous_readiness_failure');
  });

  it('requires exact appointment row evidence in appointment_row mode', () => {
    const result = summarizeAppointmentDependency({
      flowMode: 'appointment_row',
      httpStatus: 200,
      baseDate: '2026-04-19',
      patientId: '00001',
      body: {
        apiResult: '00',
        reservations: [{ appointmentId: 'A-2', appointmentDate: '2026-04-19', patient: { patientId: '99999' } }],
      },
    });

    expect(result).toMatchObject({
      flowMode: 'appointment_row',
      required: true,
      exactRowCount: 0,
      classification: 'appointment_row_missing',
      accepted: false,
    });
    expect(evaluatePreflightSummary({
      candidateId: '00001',
      officialPatientExistence: { accepted: true },
      insuranceReadiness: { accepted: true },
      selectorReadiness: { accepted: true },
      localSelectableReadiness: { accepted: true },
      appointmentDependency: result,
      secretScanClean: true,
    })).toBe('appointment_row_missing');
  });

  it('missing selector rejects the candidate', () => {
    expect(summarizeSelectorReadiness({ ...acceptedSelectors, physician: { exists: true, optionCount: 0 } }).accepted).toBe(false);
  });
});
