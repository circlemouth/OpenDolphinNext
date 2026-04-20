import { describe, expect, it } from 'vitest';

import {
  READINESS_FAILURE_CATEGORIES,
  TRIAL_NATIVE_PROBE_CANDIDATES,
  buildCandidateReadinessDecision,
  buildCandidateDiscoveryGate,
  buildOfficialPatientReadinessAxes,
  collectCandidateRejectionReasons,
  classifyReadinessFailureDiagnostic,
  classifyAcceptmodReadOnlyDiagnostic,
  evaluatePreflightSummary,
  officialPatientEvidenceAccepted,
  isRejectedTrialCandidate,
  sanitizeOfficialPatientExistenceEvidence,
  summarizeAppointmentDependency,
  summarizeInsuranceReadiness,
  summarizeLocalSelectableDiagnostic,
  summarizeLocalSelectableReadiness,
  summarizeMedicalInformationReadiness,
  summarizeOfficialPatientExistence,
  summarizeSelectorDiagnostic,
  summarizeSelectorReadiness,
  selectPreferredExactPreflightCandidate,
} from '../qa-lib/orca-trial-preflight.mjs';
import { buildQaUnsafeRequestHeaders } from '../qa-lib/session-auth.mjs';

const acceptedSelectors = {
  department: { exists: true, optionCount: 2, hasDesiredValue: true },
  physician: { exists: true, optionCount: 2, hasDesiredValue: true },
  medicalInformation: { exists: true, optionCount: 2, hasDesiredValue: true },
};

describe('orca trial-native preflight gates', () => {
  it('builds same-origin CSRF headers for QA direct read-only POST probes without cookie or authorization', () => {
    const headers = buildQaUnsafeRequestHeaders({
      baseURL: 'https://localhost:5173/f/1.2.3/reception',
      csrfToken: '  csrf-token-123  ',
    });

    expect(headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'csrf-token-123',
      Origin: 'https://localhost:5173',
      Referer: 'https://localhost:5173/f/1.2.3/reception',
    });
    expect(headers).not.toHaveProperty('Cookie');
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('omits blank QA CSRF token while preserving JSON content type', () => {
    const headers = buildQaUnsafeRequestHeaders({ baseURL: 'https://localhost:5173', csrfToken: '   ' });

    expect(headers).toMatchObject({
      'Content-Type': 'application/json',
      Origin: 'https://localhost:5173',
    });
    expect(headers).not.toHaveProperty('X-CSRF-Token');
  });

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
      acceptmodv2ReadOnlyDiagnostic: classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        apiResult: '60',
        body: { apiResult: '60' },
        parsedOrcaBody: true,
      }),
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

  it('rejects official patients batch DTO shape without raw ORCA Patient_Information as exact existence evidence', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: {
        apiResult: '00',
        recordsReturned: 1,
        patients: [{ patientId: '00001', fullName: 'SHOULD_NOT_LEAK' }],
      },
    });
    const evidence = sanitizeOfficialPatientExistenceEvidence(result);

    expect(result).toMatchObject({
      parsedOrcaBody: true,
      apiResultAccepted: true,
      patientInformationPresent: false,
      exactIdMatched: false,
      accepted: false,
      rejectionReason: 'patient_information_missing',
    });
    expect(officialPatientEvidenceAccepted(evidence)).toBe(false);
    expect(Object.keys(evidence)).toEqual([
      'httpStatus',
      'localStatus',
      'upstreamStatus',
      'endpointKind',
      'method',
      'diagnosticCategory',
      'errorCategory',
      'exceptionClassName',
      'hasParsedBody',
      'hasPatientInformation',
      'apiResultCategory',
      'exactPatientIdMatch',
      'bodyHash',
      'parsedOrcaBody',
      'apiResult',
      'apiResultAccepted',
      'patientInformationPresent',
      'exactIdMatched',
      'notFoundMessage',
      'responseCategory',
      'rejectionReason',
      'evidenceHash',
      'rawSensitiveFieldsExcluded',
    ]);
    expect(JSON.stringify(evidence)).not.toContain('SHOULD_NOT_LEAK');
  });

  it('classifies local route exceptions without accepting official patientget evidence', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 500,
      candidateId: '00001',
      body: {
        errorCategory: 'server_error',
        errorCode: 'internal_error',
        exceptionClassName: 'IllegalStateException',
      },
    });
    const evidence = sanitizeOfficialPatientExistenceEvidence(result);

    expect(result).toMatchObject({
      localStatus: 500,
      upstreamStatus: undefined,
      diagnosticCategory: 'local_exception',
      exceptionClassName: 'IllegalStateException',
      accepted: false,
      rejectionReason: 'local_exception',
    });
    expect(officialPatientEvidenceAccepted(evidence)).toBe(false);
  });

  it('classifies upstream ORCA non-2xx wrapped by the local route', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 502,
      candidateId: '00001',
      body: {
        errorCategory: 'server_error',
        code: 'orca_gateway_error',
        message: 'ORCA HTTP response status 500',
      },
    });

    expect(result).toMatchObject({
      localStatus: 502,
      upstreamStatus: 500,
      diagnosticCategory: 'upstream_http_not_2xx',
      accepted: false,
      rejectionReason: 'upstream_http_not_2xx',
    });
  });

  it('rejects upstream ORCA non-2xx even if a local wrapper status is 2xx', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      upstreamStatus: 500,
      candidateId: '00001',
      body: { apiResult: '00', Patient_Information: { Patient_ID: '00001' } },
    });

    expect(result).toMatchObject({
      localStatus: 200,
      upstreamStatus: 500,
      diagnosticCategory: 'upstream_http_not_2xx',
      accepted: false,
      rejectionReason: 'upstream_http_not_2xx',
    });
  });

  it('keeps a local 500 with unknown upstream status rejected and unknown when no safe clue exists', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 500,
      candidateId: '00001',
      body: {},
    });

    expect(result).toMatchObject({
      localStatus: 500,
      upstreamStatus: undefined,
      diagnosticCategory: 'unknown',
      accepted: false,
      rejectionReason: 'unknown',
    });
  });

  it('classifies local parser failures separately from upstream failures', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 500,
      candidateId: '00001',
      body: {
        errorCategory: 'server_error',
        message: 'JSON parser failed',
        exceptionClassName: 'JsonParseException',
      },
    });

    expect(result).toMatchObject({
      localStatus: 500,
      diagnosticCategory: 'parser_error',
      accepted: false,
      rejectionReason: 'parser_error',
    });
  });

  it('accepts patientgetv2 parsed ORCA body with Api_Result=00, Patient_Information, and exact Patient_ID', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { Api_Result: '00', Patient_Information: { Patient_ID: '00001', WholeName: 'SHOULD_NOT_LEAK' } },
    });
    const evidence = sanitizeOfficialPatientExistenceEvidence(result);

    expect(result).toMatchObject({
      httpStatus: 200,
      parsedOrcaBody: true,
      apiResult: '00',
      apiResultAccepted: true,
      patientInformationPresent: true,
      exactIdMatched: true,
      diagnosticCategory: 'accepted',
      accepted: true,
      rejectionReason: 'none',
    });
    expect(officialPatientEvidenceAccepted(evidence)).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain('SHOULD_NOT_LEAK');
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
      parsedOrcaBody: true,
      patientInformationPresent: true,
      exactIdMatched: true,
      category: 'present',
      diagnosticCategory: 'accepted',
      accepted: true,
      rejectionReason: 'none',
    });
  });

  it('rejects unparsed official patient bodies even when transport is 2xx', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: 'apiResult=00 Patient_ID=00001',
    });

    expect(result).toMatchObject({
      parsedOrcaBody: false,
      apiResultAccepted: false,
      patientInformationPresent: false,
      exactIdMatched: false,
      diagnosticCategory: 'orca_body_missing',
      accepted: false,
      rejectionReason: 'orca_body_not_parsed',
    });
  });

  it('rejects HTTP 200 with missing parsed body as official patientget evidence', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: {},
      parsedOrcaBody: false,
    });

    expect(result).toMatchObject({
      localStatus: 200,
      parsedOrcaBody: false,
      diagnosticCategory: 'orca_body_missing',
      accepted: false,
      rejectionReason: 'orca_body_not_parsed',
    });
  });

  it('rejects HTTP 200 with missing apiResult as official patientget evidence', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { Patient_Information: { Patient_ID: '00001' } },
    });

    expect(result).toMatchObject({
      localStatus: 200,
      apiResult: '',
      apiResultCategory: 'missing',
      diagnosticCategory: 'api_result_missing',
      accepted: false,
      rejectionReason: 'api_result_missing',
    });
  });

  it('rejects HTTP 200 with non-zero apiResult as official patientget evidence', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { apiResult: '10', Patient_Information: { Patient_ID: '00001' } },
    });

    expect(result).toMatchObject({
      localStatus: 200,
      apiResult: '10',
      apiResultCategory: 'non_zero',
      diagnosticCategory: 'api_result_non_zero',
      accepted: false,
      rejectionReason: 'api_result_not_all_zero',
    });
  });

  it('rejects HTTP 200 all-zero apiResult when Patient_Information is missing', () => {
    const result = summarizeOfficialPatientExistence({
      httpStatus: 200,
      candidateId: '00001',
      body: { apiResult: '00', patients: [{ patientId: '00001' }] },
    });

    expect(result).toMatchObject({
      localStatus: 200,
      apiResultCategory: 'all_zero',
      patientInformationPresent: false,
      diagnosticCategory: 'patient_information_missing',
      accepted: false,
      rejectionReason: 'patient_information_missing',
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
      diagnosticCategory: 'exact_patient_id_mismatch',
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
      diagnosticCategory: 'patient_not_found_wording_present',
      accepted: false,
      rejectionReason: 'patient_not_found_wording_present',
    });
  });

  it('classifies credential unavailable and local auth failures before upstream evidence', () => {
    expect(
      summarizeOfficialPatientExistence({
        httpStatus: 503,
        candidateId: '00001',
        body: { errorCategory: 'server_error', message: 'ORCA transport settings are incomplete' },
      }),
    ).toMatchObject({
      diagnosticCategory: 'credential_unavailable',
      localStatus: 503,
      accepted: false,
      rejectionReason: 'credential_unavailable',
    });

    expect(
      summarizeOfficialPatientExistence({
        httpStatus: 403,
        candidateId: '00001',
        body: { errorCategory: 'forbidden', code: 'csrf_validation_failed' },
      }),
    ).toMatchObject({
      diagnosticCategory: 'local_auth_failure',
      localStatus: 403,
      accepted: false,
      rejectionReason: 'local_auth_failure',
    });
  });

  it('builds exact preflight official patient failure dimensions without raw patient details or nonexistence claims', () => {
    const accepted = sanitizeOfficialPatientExistenceEvidence(
      summarizeOfficialPatientExistence({
        httpStatus: 200,
        candidateId: '00001',
        body: { Api_Result: '00', Patient_Information: { Patient_ID: '00001', WholeName: 'SHOULD_NOT_LEAK' } },
      }),
    );
    const rejected = sanitizeOfficialPatientExistenceEvidence(
      summarizeOfficialPatientExistence({
        httpStatus: 200,
        candidateId: '00002',
        body: { Api_Result: '10', Patient_Information: { Patient_ID: '00002', WholeName: 'OTHER_SHOULD_NOT_LEAK' } },
      }),
    );

    const axes = buildOfficialPatientReadinessAxes({ '00001': accepted, '00002': rejected });

    expect(axes.rawSensitiveFieldsExcluded).toBe(true);
    expect(axes.meaning).toContain('do not contradict official initial patient registration');
    expect(axes.meaning).not.toMatch(/do not exist|nonexistent|存在しない/);
    expect(axes.patientgetv2).toEqual([
      expect.objectContaining({
        patientId: '00001',
        parsedOrcaBody: true,
        apiResultAccepted: true,
        patientInformationPresent: true,
        exactIdMatched: true,
        accepted: true,
        rawSensitiveFieldsExcluded: true,
      }),
      expect.objectContaining({
        patientId: '00002',
        apiResult: '10',
        accepted: false,
        rejectionReason: 'api_result_not_all_zero',
        rawSensitiveFieldsExcluded: true,
      }),
    ]);
    expect(JSON.stringify(axes)).not.toContain('SHOULD_NOT_LEAK');
    expect(JSON.stringify(axes)).not.toContain('OTHER_SHOULD_NOT_LEAK');
  });

  it('apiResult=10 diagnostic rejects the candidate', () => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        apiResult: '10',
        body: { apiResult: '10' },
        parsedOrcaBody: true,
      }),
    ).toMatchObject({
      classification: 'patient_not_found',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
    });
  });

  it('apiResult=60 diagnostic means no existing acceptance, not mutation success', () => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        apiResult: '60',
        body: { apiResult: '60' },
        parsedOrcaBody: true,
      }),
    ).toMatchObject({
      classification: 'diagnostic_no_existing_acceptance',
      accepted: true,
      acceptedForPhase3Attempt: true,
      mutationSuccess: false,
      rejectionReason: 'none',
    });
  });

  it('Request_Number=00 apiResult=00 is an existing-acceptance diagnostic, not Phase 3 authorization', () => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        apiResult: '00',
        body: { apiResult: '00' },
        parsedOrcaBody: true,
      }),
    ).toMatchObject({
      classification: 'diagnostic_existing_acceptance',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
    });
  });

  it.each([500, 403, 404, 0, 302])('rejects apiResult=60 diagnostic on HTTP status %s', (httpStatus) => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus,
        apiResult: '60',
        body: { apiResult: '60' },
        parsedOrcaBody: true,
      }),
    ).toMatchObject({
      httpStatus,
      apiResult: '60',
      classification: 'diagnostic_no_existing_acceptance',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
      rejectionReason: 'http_not_2xx',
    });
  });

  it.each([
    ['wrapperError', { wrapperError: 'failed' }],
    ['upstreamError', { upstreamError: 'failed' }],
    ['errors', { errors: ['failed'] }],
    ['errorCategory', { errorCategory: 'UPSTREAM' }],
  ])('rejects apiResult=60 diagnostic when %s is present', (_field, errorShape) => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        apiResult: '60',
        body: { apiResult: '60', ...errorShape },
        parsedOrcaBody: true,
      }),
    ).toMatchObject({
      apiResult: '60',
      classification: 'diagnostic_no_existing_acceptance',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
      rejectionReason: 'wrapper_or_upstream_error',
    });
  });

  it('rejects apiResult=60 diagnostic when the ORCA body was not parsed', () => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        apiResult: '60',
        parsedOrcaBody: false,
      }),
    ).toMatchObject({
      apiResult: '60',
      classification: 'diagnostic_no_existing_acceptance',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
      rejectionReason: 'orca_body_not_parsed',
    });
  });

  it('rejects apiResult=60 diagnostic when parsed marker is true but body evidence is absent', () => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        apiResult: '60',
        parsedOrcaBody: true,
      }),
    ).toMatchObject({
      apiResult: '60',
      classification: 'diagnostic_no_existing_acceptance',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
      rejectionReason: 'orca_body_not_parsed',
    });
  });

  it.each(['21', '23'])('does not accept diagnostic apiResult=%s', (apiResult) => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        apiResult,
        body: { apiResult },
        parsedOrcaBody: true,
      }),
    ).toMatchObject({
      apiResult,
      classification: 'not_verified',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
    });
  });

  it('does not accept message-only success without diagnostic business evidence', () => {
    expect(
      classifyAcceptmodReadOnlyDiagnostic({
        executed: true,
        httpStatus: 200,
        body: { apiResultMessage: '正常終了' },
        parsedOrcaBody: true,
      }),
    ).toMatchObject({
      apiResult: '',
      classification: 'not_verified',
      accepted: false,
      acceptedForPhase3Attempt: false,
      mutationSuccess: false,
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

  it('classifies local route guard 403 as ambiguous readiness failure with localGuard category', () => {
    const result = summarizeInsuranceReadiness({
      httpStatus: 403,
      baseDate: '2026-04-19',
      body: { errorCode: 'blocked_route_guard', errorCategory: 'forbidden' },
      responseBodyChars: 96,
      parsedBodyOk: true,
    });

    expect(result).toMatchObject({
      classification: 'ambiguous_readiness_failure',
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.localGuard,
      diagnosticCategory: READINESS_FAILURE_CATEGORIES.localGuard,
      accepted: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|authorization|cookie|csrf-token/i);
  });

  it('classifies CSRF 403 as ambiguous readiness failure with csrf category', () => {
    const result = summarizeInsuranceReadiness({
      httpStatus: 403,
      baseDate: '2026-04-19',
      body: { errorCode: 'csrf_validation_failed', errorCategory: 'forbidden', details: { reason: 'csrf_validation_failed' } },
      responseBodyChars: 128,
      parsedBodyOk: true,
    });

    expect(result).toMatchObject({
      classification: 'ambiguous_readiness_failure',
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.csrf,
      diagnostic: expect.objectContaining({
        category: READINESS_FAILURE_CATEGORIES.csrf,
        rawSensitiveFieldsExcluded: true,
      }),
      accepted: false,
    });
  });

  it('classifies upstream ORCA 403 as ambiguous readiness failure with upstream category', () => {
    const result = summarizeInsuranceReadiness({
      httpStatus: 502,
      baseDate: '2026-04-19',
      body: { errorCode: 'orca_http_error', errorCategory: 'bad_gateway', source: 'orca_gateway', details: { orcaHttpStatus: 403 } },
      responseBodyChars: 128,
      parsedBodyOk: true,
    });

    expect(result).toMatchObject({
      classification: 'ambiguous_readiness_failure',
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.upstream,
      diagnostic: expect.objectContaining({
        category: READINESS_FAILURE_CATEGORIES.upstream,
        upstreamStatus: 403,
      }),
      accepted: false,
    });
  });

  it('classifies local session/auth/role 403 separately from upstream 403', () => {
    expect(
      classifyReadinessFailureDiagnostic({
        httpStatus: 403,
        body: { errorCode: 'forbidden', errorCategory: 'forbidden' },
        responseBodyChars: 96,
        parsedBodyOk: true,
      }),
    ).toMatchObject({
      category: READINESS_FAILURE_CATEGORIES.sessionAuthRole,
      upstreamErrorPresent: false,
      rawSensitiveFieldsExcluded: true,
    });
  });

  it('classifies method/path mismatch, credential failure, empty upstream non-2xx, and unknown ambiguous 403 without raw details', () => {
    expect(
      classifyReadinessFailureDiagnostic({
        httpStatus: 405,
        method: 'GET',
        expectedMethod: 'POST',
        body: { errorCode: 'method_not_allowed' },
      }),
    ).toMatchObject({ category: READINESS_FAILURE_CATEGORIES.methodPathMismatch });

    expect(
      classifyReadinessFailureDiagnostic({
        httpStatus: 503,
        body: { errorCode: 'orca_gateway_error', message: 'ORCA facility configuration is not available' },
      }),
    ).toMatchObject({ category: READINESS_FAILURE_CATEGORIES.credentialUnavailable });

    expect(
      classifyReadinessFailureDiagnostic({
        httpStatus: 502,
        body: {},
        responseBodyChars: 0,
        parsedBodyOk: false,
      }),
    ).toMatchObject({ category: READINESS_FAILURE_CATEGORIES.upstreamNon2xxNoBody });

    expect(
      classifyReadinessFailureDiagnostic({
        httpStatus: 403,
        body: { errorCode: 'unexpected_denial' },
        responseBodyChars: 64,
        parsedBodyOk: true,
      }),
    ).toMatchObject({ category: READINESS_FAILURE_CATEGORIES.unknownAmbiguous403 });
  });

  it('accepts insurance only for HTTP 200 with all-zero apiResult and usable combination evidence', () => {
    expect(
      summarizeInsuranceReadiness({
        httpStatus: 200,
        baseDate: '2026-04-19',
        body: {
          apiResult: '0000',
          combinations: [
            { combinationNumber: '0001', certificateStartDate: '2020-01-01', certificateExpiredDate: '9999-12-31' },
          ],
        },
      }),
    ).toMatchObject({
      classification: 'accepted',
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.none,
      effectiveCount: 1,
      accepted: true,
    });

    expect(
      summarizeInsuranceReadiness({
        httpStatus: 204,
        baseDate: '2026-04-19',
        body: {
          apiResult: '0000',
          combinations: [
            { combinationNumber: '0001', certificateStartDate: '2020-01-01', certificateExpiredDate: '9999-12-31' },
          ],
        },
      }),
    ).toMatchObject({
      classification: 'ambiguous_readiness_failure',
      accepted: false,
    });
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

  it('classifies blank insurance apiResult as ambiguous readiness failure with parserBlankApiResult category', () => {
    const result = summarizeInsuranceReadiness({
      httpStatus: 200,
      baseDate: '2026-04-19',
      body: { apiResult: '', combinations: [{ combinationNumber: '0001' }] },
      responseBodyChars: 64,
      parsedBodyOk: true,
    });

    expect(result).toMatchObject({
      classification: 'ambiguous_readiness_failure',
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.parserBlankApiResult,
      accepted: false,
    });
  });

  it('classifies wrapper error with any insurance apiResult as ambiguous readiness failure', () => {
    const result = summarizeInsuranceReadiness({
      httpStatus: 200,
      baseDate: '2026-04-19',
      body: {
        apiResult: '00',
        wrapperError: { category: 'before-upstream' },
        combinations: [{ combinationNumber: '0001' }],
      },
    });

    expect(result).toMatchObject({
      classification: 'ambiguous_readiness_failure',
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.wrapperErrorBeforeUpstream,
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

  it('accepts direct appointment flow without probing an appointment row', () => {
    const result = summarizeAppointmentDependency({
      flowMode: 'direct_acceptance',
      patientId: '00001',
      baseDate: '2026-04-19',
    });

    expect(result).toMatchObject({
      flowMode: 'direct_acceptance',
      required: false,
      absenceBlocker: false,
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

  it('accepts appointment_row only with exact appointment row evidence', () => {
    const result = summarizeAppointmentDependency({
      flowMode: 'appointment_row',
      httpStatus: 200,
      baseDate: '2026-04-19',
      patientId: '00001',
      body: {
        apiResult: '00',
        reservations: [{ appointmentId: 'A-1', appointmentDate: '2026-04-19', patient: { patientId: '00001' } }],
      },
    });

    expect(result).toMatchObject({
      flowMode: 'appointment_row',
      required: true,
      exactRowCount: 1,
      classification: 'appointment_row_present',
      accepted: true,
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.none,
    });
  });

  it('does not classify appointment 403 as appointment missing', () => {
    const result = summarizeAppointmentDependency({
      flowMode: 'appointment_row',
      httpStatus: 403,
      baseDate: '2026-04-19',
      patientId: '00001',
      body: { errorCode: 'forbidden', errorCategory: 'forbidden' },
    });

    expect(result).toMatchObject({
      classification: 'ambiguous_readiness_failure',
      readinessFailureCategory: READINESS_FAILURE_CATEGORIES.sessionAuthRole,
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

  it('missing selector rejects the candidate', () => {
    expect(summarizeSelectorReadiness({ ...acceptedSelectors, physician: { exists: true, optionCount: 0 } }).accepted).toBe(false);
  });

  it('reports local selectable accepted plus selector rejected without accepting Phase 3 readiness', () => {
    const local = summarizeLocalSelectableDiagnostic({
      patientId: '00001',
      selectableCount: 1,
      exactResultCount: 1,
      selectable: true,
      verdict: 'accepted',
    });
    const selector = summarizeSelectorDiagnostic({
      localSelectableDiagnostic: local,
      selectors: {
        ...acceptedSelectors,
        physician: { exists: true, optionCount: 2, hasDesiredValue: false },
        paymentMode: { exists: true, optionCount: 1, hasDesiredValue: true },
        visitKind: { exists: true, optionCount: 1, hasDesiredValue: true },
      },
    });
    const medicalInformationReadiness = summarizeMedicalInformationReadiness({
      patientId: '00001',
      departmentCode: '01',
      physicianCode: '10001',
      paymentMode: 'insurance',
      visitKind: '1',
      medicalInformation: '',
      medicalInformationState: { state: 'omitted' },
      medicalInformationProbe: { accepted: true },
      selectorDiagnostic: selector,
      localSelectableDiagnostic: local,
    });

    expect(local).toMatchObject({
      status: 'accepted',
      normalizedTargetPatientId: '00001',
      localCandidateCount: 1,
      exactNormalizedPatientIdMatchCount: 1,
      exactMatch: true,
      reason: 'none',
    });
    expect(selector).toMatchObject({
      status: 'rejected',
      reason: 'selector_exact_match_missing',
      accepted: false,
    });
    expect(selector.fields.physician).toMatchObject({
      optionCount: 2,
      targetMatch: false,
      reason: 'selector_exact_match_missing',
    });
    expect(selector.selectorOptionCounts).toMatchObject({
      physician: 2,
      paymentMode: 1,
      visitKind: 1,
    });
    expect(selector.selectorTargetMatches).toMatchObject({
      physician: false,
      paymentMode: true,
      visitKind: true,
    });
    expect(medicalInformationReadiness).toMatchObject({
      accepted: false,
      reason: 'medical_information_not_ready',
    });
    expect(medicalInformationReadiness.failedSubdimensions).toContain('physician_ready');
  });

  it('reports local_exact_match_missing as selector not_verified without declaring official absence', () => {
    const local = summarizeLocalSelectableDiagnostic({
      patientId: '00002',
      recordsReturned: 0,
      exactMatchCount: 0,
      verdict: 'rejected',
      reason: 'local_exact_match_missing',
    });
    const selector = summarizeSelectorDiagnostic({
      localSelectableDiagnostic: local,
      selectors: {},
    });

    expect(local).toMatchObject({
      status: 'rejected',
      reason: 'local_exact_match_missing',
      normalizedTargetPatientId: '00002',
      localCandidateCount: 0,
      exactNormalizedPatientIdMatchCount: 0,
      rawSensitiveFieldsExcluded: true,
    });
    expect(selector).toMatchObject({
      status: 'not_verified',
      reason: 'local_exact_match_missing',
      accepted: false,
    });
    expect(evaluatePreflightSummary({
      candidateId: '00002',
      officialPatientExistence: { accepted: true },
      insuranceReadiness: { accepted: true },
      selectorReadiness: selector,
      localSelectableReadiness: { accepted: false },
      appointmentDependency: { flowMode: 'direct_acceptance', required: false, accepted: true },
      secretScanClean: true,
    })).toBe('selector_missing');
  });

  it('splits medical_information_not_ready into sanitized subdimensions', () => {
    const local = summarizeLocalSelectableDiagnostic({
      patientId: '00005',
      selectableCount: 1,
      exactResultCount: 1,
      selectable: true,
      verdict: 'accepted',
    });
    const selector = summarizeSelectorDiagnostic({
      localSelectableDiagnostic: local,
      selectors: {
        department: { exists: true, optionCount: 1, hasDesiredValue: true },
        physician: { exists: true, optionCount: 1, hasDesiredValue: true },
        paymentMode: { exists: true, optionCount: 1, hasDesiredValue: true },
        visitKind: { exists: true, optionCount: 1, hasDesiredValue: true },
        medicalInformation: { exists: true, optionCount: 0, hasDesiredValue: true },
      },
    });
    const readiness = summarizeMedicalInformationReadiness({
      patientId: '00005',
      departmentCode: '01',
      physicianCode: '10001',
      paymentMode: 'insurance',
      visitKind: '1',
      medicalInformation: '',
      medicalInformationState: { state: 'omitted' },
      medicalInformationProbe: { accepted: true },
      selectorDiagnostic: selector,
      localSelectableDiagnostic: local,
    });

    expect(readiness).toMatchObject({
      status: 'rejected',
      accepted: false,
      reason: 'medical_information_not_ready',
      rawSensitiveFieldsExcluded: true,
    });
    expect(readiness.failedSubdimensions).toEqual(['medicalInformation_input_ready']);
    expect(readiness.dimensions.medicalInformation_input_ready).toMatchObject({
      ready: false,
      reason: 'selector_option_missing',
    });
    expect(JSON.stringify(readiness)).not.toMatch(/WholeName|Address|Phone|Insurance_Symbol/);
  });

  it('keeps a 00001-like row with accepted local selector medical-info but rejected insurance out of mutation readiness', () => {
    const local = summarizeLocalSelectableDiagnostic({
      patientId: '00001',
      selectableCount: 1,
      exactResultCount: 1,
      selectable: true,
      verdict: 'accepted',
    });
    const selector = summarizeSelectorDiagnostic({
      localSelectableDiagnostic: local,
      selectors: {
        department: { exists: true, optionCount: 2, hasDesiredValue: true },
        physician: { exists: true, optionCount: 2, hasDesiredValue: true },
        paymentMode: { exists: true, optionCount: 1, hasDesiredValue: true },
        visitKind: { exists: true, optionCount: 1, hasDesiredValue: true },
        medicalInformation: { exists: true, optionCount: 1, hasDesiredValue: true },
      },
    });
    const medicalInformationReadiness = summarizeMedicalInformationReadiness({
      patientId: '00001',
      departmentCode: '01',
      physicianCode: '10001',
      paymentMode: 'insurance',
      visitKind: '1',
      medicalInformation: '',
      medicalInformationState: { state: 'omitted' },
      medicalInformationProbe: { accepted: true },
      selectorDiagnostic: selector,
      localSelectableDiagnostic: local,
    });
    const decision = buildCandidateReadinessDecision({
      officialPatientExistence: { accepted: true },
      insuranceReadiness: { accepted: false, classification: 'business_rejected_insurance' },
      appointmentDependency: { accepted: true },
      localSelectable: local,
      selectorReadiness: selector,
      medicalInformationProbe: { accepted: true },
      medicalInformationReadiness,
      diagnosticNoPatientNotFound: { accepted: true },
      mutationProhibited: { blockedRequestCount: 0 },
    });

    expect(local.accepted).toBe(true);
    expect(selector.accepted).toBe(true);
    expect(medicalInformationReadiness.accepted).toBe(true);
    expect(decision).toMatchObject({
      acceptedForExactPreflightProposal: false,
      primaryRejectionReason: 'business_rejected_insurance',
      rejectionReasons: ['business_rejected_insurance'],
    });
  });

  it('reports multiple candidate blockers without hiding them behind one primary reason', () => {
    const reasons = collectCandidateRejectionReasons({
      officialPatientExistence: { accepted: true },
      insuranceReadiness: { accepted: false, classification: 'business_rejected_insurance' },
      appointmentDependency: { accepted: false, classification: 'appointment_row_missing' },
      localSelectable: { accepted: false, reason: 'local_exact_match_missing' },
      selectorReadiness: { accepted: false, verdict: 'not_verified', reason: 'local_exact_match_missing' },
      medicalInformationProbe: { accepted: true },
      medicalInformationReadiness: {
        accepted: false,
        failedSubdimensions: ['required_identity_fields_match'],
      },
      diagnosticNoPatientNotFound: { accepted: true },
      mutationProhibited: { blockedRequestCount: 0 },
    });
    const decision = buildCandidateReadinessDecision({
      officialPatientExistence: { accepted: true },
      insuranceReadiness: { accepted: false, classification: 'business_rejected_insurance' },
      appointmentDependency: { accepted: false, classification: 'appointment_row_missing' },
      localSelectable: { accepted: false, reason: 'local_exact_match_missing' },
      selectorReadiness: { accepted: false, verdict: 'not_verified', reason: 'local_exact_match_missing' },
      medicalInformationProbe: { accepted: true },
      medicalInformationReadiness: {
        accepted: false,
        failedSubdimensions: ['required_identity_fields_match'],
      },
      diagnosticNoPatientNotFound: { accepted: true },
      mutationProhibited: { blockedRequestCount: 0 },
    });

    expect(reasons).toEqual([
      'business_rejected_insurance',
      'appointment_row_missing',
      'local_exact_match_missing',
      'medical_information_not_ready:required_identity_fields_match',
    ]);
    expect(decision.primaryRejectionReason).toBe('business_rejected_insurance');
    expect(decision.acceptedForExactPreflightProposal).toBe(false);
  });

  it('prefers 00001 and 00005 only after full exact-preflight proposal readiness is accepted', () => {
    const selected = selectPreferredExactPreflightCandidate([
      {
        patientId: '00001',
        acceptedForExactPreflightProposal: false,
        primaryRejectionReason: 'business_rejected_insurance',
      },
      { patientId: '00002', acceptedForExactPreflightProposal: true },
      { patientId: '00005', acceptedForExactPreflightProposal: true },
    ]);

    expect(selected?.patientId).toBe('00005');
  });

  it('candidate discovery with zero accepted candidates is readiness-blocked without contradicting Trial registration', () => {
    const gate = buildCandidateDiscoveryGate({
      candidateCount: 11,
      acceptedCandidateCount: 0,
      blockedRequestCount: 0,
      selectedCandidate: null,
    });

    expect(gate).toMatchObject({
      candidateDiscoveryAloneAuthorizesPhase3: false,
      acceptedForPhase3Attempt: false,
      phase3AttemptPatientId: null,
      releaseVerdict: 'PARTIAL / TEST-DATA OR HARNESS READINESS BLOCKER',
      blockerClassification: 'test-data-or-harness-readiness-blocker',
      blockerReason: 'phase3_mutation_ready_readonly_evidence_missing',
      mutationPolicy: {
        prohibited: true,
        blockedRequestCount: 0,
      },
      exactSelectedCandidatePreflight: {
        ran: false,
      },
      phase3: {
        ran: false,
      },
      phase4: {
        ran: false,
      },
      candidateDiscovery: {
        acceptedCandidateCount: 0,
      },
    });
  });
});
