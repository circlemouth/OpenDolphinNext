import { describe, expect, it } from 'vitest';

import {
  buildRwo08bTargetReadinessSummary,
  sanitizeIdentifierPreflightRouteResponse,
  validateRwo08bTargetReadinessCommand,
} from '../qa-lib/rwo08b-target-readiness-evidence.mjs';

const commandGate = validateRwo08bTargetReadinessCommand({
  argv: [
    '--dry-run',
    '--sanitized-evidence-only',
    '--disable-browser-artifacts',
    '--candidate-discovery-summary',
    'candidate.json',
    '--exact-preflight-summary',
    'exact.json',
  ],
});

const candidateDiscovery = (overrides = {}) => ({
  source: 'qa-weborca-candidate-discovery',
  flowMode: 'candidate-discovery-proposal',
  acceptedCandidateCount: 1,
  selectedCandidate: { patientId: '00002' },
  candidateDiscoveryAloneAuthorizesPhase3: false,
  mutationPolicy: { targetMutationRequestCount: 0 },
  ...overrides,
});

const exactPreflight = (overrides = {}) => ({
  source: 'qa-weborca-readonly-preflight',
  flowMode: 'exact-readonly-preflight',
  verdict: 'accepted',
  acceptedForPhase3Attempt: true,
  patientId: '00002',
  phase3AttemptPatientId: '00002',
  localSelectableReadiness: {
    accepted: true,
    verdict: 'accepted',
    exactMatchCount: 1,
  },
  selectorReadiness: { accepted: true, verdict: 'accepted' },
  medicalInformationReadiness: { accepted: true, verdict: 'accepted' },
  mutationPolicy: { targetMutationRequestCount: 0 },
  rawSensitiveFieldsExcluded: true,
  ...overrides,
});

const identifierPreflight = (overrides = {}) => ({
  httpStatus: 200,
  requestClass: 'medicalgetv2_class_01_identifier_snapshot_readonly',
  acceptanceEndpoint: '/api01rv2/acceptlstv2',
  medicalGetEndpoint: '/api01rv2/medicalgetv2',
  acceptanceClassCode: '01',
  medicalGetClassCode: '01',
  acceptanceDate: '2026-04-28',
  selectedAcceptanceRowHash: 'a'.repeat(64),
  selectedAcceptanceTargetReady: true,
  acceptanceSourceRowCount: 1,
  acceptanceTargetReadyRowCount: 1,
  medicalSourceRowCount: 1,
  medicalSanitizedRowCount: 1,
  identifierPreflightReady: true,
  artifactFree: true,
  rawSensitiveFieldsExcluded: true,
  clientProvidedIdentifiersTrusted: false,
  serverDerivedAuthorityRequired: true,
  medicalRows: [
    {
      rowHash: 'b'.repeat(64),
      hasPerformDate: true,
      hasDepartmentCode: true,
      hasSequentialNumber: true,
      hasInsuranceCombinationNumber: true,
      hasInvoiceNumber: false,
      rawSensitiveFieldsExcluded: true,
    },
  ],
  ...overrides,
});

describe('RWO-08B target-readiness evidence wrapper', () => {
  it('blocks when candidate discovery has no fresh selected candidate', () => {
    const summary = buildRwo08bTargetReadinessSummary({
      runId: '20260428T204909Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery({ selectedCandidate: null, acceptedCandidateCount: 0 }),
      exactPreflightSummary: exactPreflight(),
    });

    expect(summary.targetReadiness.readyForDiagnosticFullflow).toBe(false);
    expect(summary.targetReadiness.businessSuccessClassification).toBe('candidate_discovery_no_selected_candidate');
    expect(summary.readOnlyTrialOrca.mutation).toBe(false);
  });

  it('does not allow duplicate-blocked candidates even when exact preflight claims acceptance', () => {
    const summary = buildRwo08bTargetReadinessSummary({
      runId: '20260428T204909Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery({ selectedCandidate: { patientId: '00005' } }),
      exactPreflightSummary: exactPreflight({ patientId: '00005', phase3AttemptPatientId: '00005' }),
      identifierPreflight: identifierPreflight(),
    });

    expect(summary.targetReadiness.readyForDiagnosticFullflow).toBe(false);
    expect(summary.targetReadiness.businessSuccessClassification).toBe('duplicate_blocked_candidate_selected');
  });

  it('requires exact selected-candidate local exact match before identifier-preflight can unblock Fullflow', () => {
    const summary = buildRwo08bTargetReadinessSummary({
      runId: '20260428T204909Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery(),
      exactPreflightSummary: exactPreflight({
        localSelectableReadiness: { accepted: false, verdict: 'rejected', exactMatchCount: 0, reason: 'local_exact_match_missing' },
      }),
      identifierPreflight: identifierPreflight(),
    });

    expect(summary.targetReadiness.readyForDiagnosticFullflow).toBe(false);
    expect(summary.targetReadiness.businessSuccessClassification).toBe('local_exact_match_missing');
  });

  it('requires identifier-preflight after candidate discovery and exact preflight pass', () => {
    const summary = buildRwo08bTargetReadinessSummary({
      runId: '20260428T204909Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery(),
      exactPreflightSummary: exactPreflight(),
    });

    expect(summary.targetReadiness.readyForDiagnosticFullflow).toBe(false);
    expect(summary.targetReadiness.businessSuccessClassification).toBe('identifier_preflight_not_run');
  });

  it('marks target ready only with sanitized server-derived identifier-preflight evidence', () => {
    const summary = buildRwo08bTargetReadinessSummary({
      runId: '20260428T204909Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery(),
      exactPreflightSummary: exactPreflight(),
      identifierPreflight: identifierPreflight(),
    });

    expect(summary.targetReadiness.readyForDiagnosticFullflow).toBe(true);
    expect(summary.targetReadiness.businessSuccessClassification).toBe('target_ready_for_diagnostic_fullflow');
    expect(summary.diagnosticFullflow.executed).toBe(false);
    expect(summary.liveTrialOrca.executed).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(/Authorization|Cookie|JSESSIONID|CSRF|WholeName|Insurance_/);
  });

  it('sanitizes identifier-preflight rows to presence flags and hashes only', () => {
    const sanitized = sanitizeIdentifierPreflightRouteResponse({
      httpStatus: 200,
      responseJson: identifierPreflight({
      medicalRows: [
        {
          rowHash: 'c'.repeat(64),
            hasPerformDate: true,
            hasDepartmentCode: true,
            hasSequentialNumber: true,
            hasInsuranceCombinationNumber: true,
            serverPerformDate: 'must-not-leak',
            serverInsuranceCombinationNumber: 'must-not-leak',
          },
        ],
      }),
    });

    expect(sanitized.identifierPreflightReady).toBe(true);
    expect(sanitized.apiResultClass).toBe('blank');
    expect(sanitized.medicalRows[0]).toEqual({
      rowHash: 'c'.repeat(64),
      hasPerformDate: true,
      hasDepartmentCode: true,
      hasSequentialNumber: true,
      hasInsuranceCombinationNumber: true,
      hasInvoiceNumber: false,
      rawSensitiveFieldsExcluded: true,
    });
  });

  it('keeps allowlisted medicalgetv2 apiResult classification without raw messages', () => {
    const sanitized = sanitizeIdentifierPreflightRouteResponse({
      httpStatus: 200,
      responseJson: identifierPreflight({
        apiResult: '15',
        apiResultMessage: 'must-not-leak message',
        identifierPreflightReady: false,
        medicalRows: [
          {
            rowHash: 'd'.repeat(64),
            hasPerformDate: true,
            hasDepartmentCode: false,
            hasSequentialNumber: false,
            hasInsuranceCombinationNumber: false,
            rawSensitiveFieldsExcluded: true,
          },
        ],
      }),
    });

    expect(sanitized.httpStatus).toBe(200);
    expect(sanitized.apiResult).toBe('15');
    expect(sanitized.apiResultClass).toBe('nonzero');
    expect(sanitized.identifierPreflightReady).toBe(false);
    expect(JSON.stringify(sanitized)).not.toContain('must-not-leak');
  });

  it('accepts official visit list identifier rows as sanitized alternative proof', () => {
    const sanitized = sanitizeIdentifierPreflightRouteResponse({
      httpStatus: 200,
      responseJson: identifierPreflight({
        apiResult: '15',
        identifierPreflightReady: true,
        medicalRows: [
          {
            rowHash: 'd'.repeat(64),
            hasPerformDate: true,
            hasDepartmentCode: false,
            hasSequentialNumber: false,
            hasInsuranceCombinationNumber: false,
            rawSensitiveFieldsExcluded: true,
          },
        ],
        visitRows: [
          {
            rowHash: 'e'.repeat(64),
            hasPatientId: true,
            hasVisitDate: true,
            hasDepartmentCode: true,
            hasVoucherNumber: true,
            hasSequentialNumber: true,
            hasInsuranceCombinationNumber: true,
            serverVoucherNumber: 'must-not-leak',
            serverSequentialNumber: 'must-not-leak',
          },
        ],
      }),
    });

    expect(sanitized.medicalReadyRowCount).toBe(0);
    expect(sanitized.visitReadyRowCount).toBe(1);
    expect(sanitized.identifierPreflightReady).toBe(true);
    expect(sanitized.visitRows[0]).toEqual({
      rowHash: 'e'.repeat(64),
      hasPatientId: true,
      hasVisitDate: true,
      hasDepartmentCode: true,
      hasVoucherNumber: true,
      hasSequentialNumber: true,
      hasInsuranceCombinationNumber: true,
      rawSensitiveFieldsExcluded: true,
    });
    expect(JSON.stringify(sanitized)).not.toContain('must-not-leak');
  });

  it('keeps sanitized error classifications from identifier-preflight 4xx responses', () => {
    const sanitized = sanitizeIdentifierPreflightRouteResponse({
      httpStatus: 400,
      responseJson: {
        errorCode: 'orca_gateway_error',
        message: 'must-not-leak free text',
        details: {
          validationError: 'upstream_rejected',
          message: 'must-not-leak detail',
        },
      },
    });

    expect(sanitized.httpStatus).toBe(400);
    expect(sanitized.sanitizedErrorCode).toBe('orca_gateway_error');
    expect(sanitized.sanitizedValidationError).toBe('upstream_rejected');
    expect(JSON.stringify(sanitized)).not.toContain('must-not-leak');
  });

  it('rejects execute-readonly without a pinned server-derived target row hash', () => {
    const gate = validateRwo08bTargetReadinessCommand({
      argv: [
        '--execute-readonly',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--candidate-discovery-summary',
        'candidate.json',
        '--exact-preflight-summary',
        'exact.json',
        '--acceptance-date',
        '2026-04-28',
      ],
    });

    expect(gate.ok).toBe(false);
    expect(gate.blockers).toContain('--target-row-hash is required for --execute-readonly');
  });
});
