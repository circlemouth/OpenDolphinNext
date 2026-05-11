import { describe, expect, it } from 'vitest';

import {
  buildBillingReportLiveProfileSummary,
  buildBillingReportLiveHandoffSummary,
  buildBillingReportLiveResultSummary,
  parseBillingReportLiveProfileArgs,
  validateBillingReportLiveHandoffCommand,
  validateBillingReportLiveProfileCommand,
  validateBillingReportLiveResultCommand,
} from '../qa-lib/orca-billing-report-live-profile-evidence.mjs';

const commandGate = validateBillingReportLiveProfileCommand({
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
  selectedCandidate: {
    patientId: '00002',
    WholeName: 'must-not-leak',
  },
  candidateDiscoveryAloneAuthorizesPhase3: false,
  mutationPolicy: { targetMutationRequestCount: 0 },
  ...overrides,
});

const exactPreflight = (overrides = {}) => ({
  runId: '20260511T014209Z',
  source: 'qa-weborca-readonly-preflight',
  flowMode: 'exact-readonly-preflight',
  acceptedForPhase3Attempt: true,
  patientId: '00002',
  phase3AttemptPatientId: '00002',
  localSelectableReadiness: { accepted: true, verdict: 'accepted', exactMatchCount: 1 },
  insuranceReadiness: {
    accepted: true,
    verdict: 'accepted',
    Insurance_Combination_Number: 'must-not-leak',
  },
  mutationPolicy: { targetMutationRequestCount: 0 },
  rawSensitiveFieldsExcluded: true,
  ...overrides,
});

const expectNoRawEvidenceLeak = (value: unknown) => {
  const serialized = JSON.stringify(value);

  expect(serialized).not.toMatch(
    /00002|WholeName|Insurance_Combination_Number|must-not-leak|Authorization|Cookie|JSESSIONID|CSRF|Medical_Uid/,
  );
  expect(serialized).not.toMatch(/(?:^|[/"'\s])trace[^/"'\s]*\.zip\b/i);
  expect(serialized).not.toMatch(/\b(?:har\/|[^/"'\s]+\.har\b|[^/"'\s]+\.(?:webm|mp4|png|jpe?g)\b)/i);
};

describe('ORCA billing/report live profile dry-run evidence', () => {
  it('requires dry-run sanitized mode and no browser artifacts', () => {
    const parsed = parseBillingReportLiveProfileArgs([
      '--dry-run',
      '--sanitized-evidence-only',
      '--disable-browser-artifacts',
      '--candidate-discovery-summary',
      'candidate.json',
      '--exact-preflight-summary',
      'exact.json',
    ]);

    expect(parsed.errors).toEqual([]);
    expect(parsed.options.dryRun).toBe(true);
    expect(parsed.options.reportType).toBe('invoicereceipt');
  });

  it('rejects live/artifact capture flags before any ORCA traffic', () => {
    const result = validateBillingReportLiveProfileCommand({
      argv: [
        '--live',
        '--trace',
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--candidate-discovery-summary',
        'candidate.json',
        '--exact-preflight-summary',
        'exact.json',
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('forbidden flag: --live');
    expect(result.blockers).toContain('forbidden flag: --trace');
  });

  it('rejects artifact capture environment before dry-run evidence generation', () => {
    const result = validateBillingReportLiveProfileCommand({
      argv: [
        '--dry-run',
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--candidate-discovery-summary',
        'candidate.json',
        '--exact-preflight-summary',
        'exact.json',
      ],
      env: { QA_RECORD_HAR: '1' },
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('forbidden env enabled: QA_RECORD_HAR');
  });

  it('marks the profile ready only after candidate discovery and exact preflight pass', () => {
    const summary = buildBillingReportLiveProfileSummary({
      runId: '20260511T014209Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery(),
      exactPreflightSummary: exactPreflight(),
    });

    expect(summary.readyForBillingReportLiveProfile).toBe(true);
    expect(summary.liveTrialOrca.executed).toBe(false);
    expect(summary.endpoints).toContain('/api/orca/official/chart-support/income-info');
    expect(summary.endpoints).toContain('/api/orca/official/reports/{type}');
    expect(summary.acceptedEvidenceFields).toContain('serverGeneratedStorageKeyDigest');
    expect(summary.forbiddenEvidenceFields).toContain('rawOrcaBody');
    expect(summary.claimBoundary).toContain('not paid status');
    expectNoRawEvidenceLeak(summary);
  });

  it('blocks when discovery is only a proposal or preflight is not exact accepted evidence', () => {
    const summary = buildBillingReportLiveProfileSummary({
      runId: '20260511T014209Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery({
        candidateDiscoveryAloneAuthorizesPhase3: true,
      }),
      exactPreflightSummary: exactPreflight({
        acceptedForPhase3Attempt: false,
        mutationPolicy: { targetMutationRequestCount: 1 },
      }),
    });

    expect(summary.readyForBillingReportLiveProfile).toBe(false);
    expect(summary.blockers).toContain('candidateDiscoveryDoesNotAuthorizeAlone');
    expect(summary.blockers).toContain('exactPreflightAccepted');
    expect(summary.blockers).toContain('exactPreflightNoMutationRequests');
  });

  it('builds a manual live handoff only from a ready sanitized dry-run summary', () => {
    const dryRunSummary = buildBillingReportLiveProfileSummary({
      runId: '20260511T014209Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery(),
      exactPreflightSummary: exactPreflight(),
    });
    const handoffGate = validateBillingReportLiveHandoffCommand({
      argv: [
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--require-manual-approval',
        '--dry-run-summary',
        'summary.sanitized.json',
        '--approval-reference',
        'owner-approved-ticket-123',
        '--report-types',
        'invoicereceipt,statement',
      ],
      env: {},
    });
    const handoff = buildBillingReportLiveHandoffSummary({
      runId: '20260511T022207Z',
      commandGate: handoffGate,
      dryRunSummary,
    });

    expect(handoff.readyForManualLiveExecution).toBe(true);
    expect(handoff.liveTrialOrca.executedByThisHandoff).toBe(false);
    expect(handoff.liveTrialOrca.nextStepRequiresHumanOperator).toBe(true);
    expect(handoff.manualApproval.referenceCapturedRaw).toBe(false);
    expect(handoff.reportTypes).toEqual(['invoicereceipt', 'statement']);
    expect(handoff.acceptedEvidenceFields).toContain('approvalReferenceHash');
    expect(JSON.stringify(handoff)).not.toMatch(/owner-approved-ticket-123/);
    expectNoRawEvidenceLeak(handoff);
  });

  it('blocks manual live handoff when the dry-run summary is not ready or raw artifact capture is requested', () => {
    const handoffGate = validateBillingReportLiveHandoffCommand({
      argv: [
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--require-manual-approval',
        '--dry-run-summary',
        'summary.sanitized.json',
        '--approval-reference',
        'owner-approved-ticket-123',
        '--trace',
      ],
      env: { QA_TRACE: '1' },
    });
    const handoff = buildBillingReportLiveHandoffSummary({
      runId: '20260511T022207Z',
      commandGate: handoffGate,
      dryRunSummary: {
        commandContract: 'orca-billing-report-live-profile-dry-run-sanitized-only',
        readyForBillingReportLiveProfile: false,
        rawSensitiveFieldsExcluded: true,
        liveTrialOrca: { executed: false },
      },
    });

    expect(handoff.readyForManualLiveExecution).toBe(false);
    expect(handoff.blockers).toContain('forbidden flag: --trace');
    expect(handoff.blockers).toContain('forbidden env enabled: QA_TRACE');
    expect(handoff.blockers).toContain('dryRunSummaryReady');
  });

  it('records a sanitized operator live result without making billing authority claims', () => {
    const dryRunSummary = buildBillingReportLiveProfileSummary({
      runId: '20260511T014209Z',
      commandGate,
      candidateDiscoverySummary: candidateDiscovery(),
      exactPreflightSummary: exactPreflight(),
    });
    const handoffGate = validateBillingReportLiveHandoffCommand({
      argv: [
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--require-manual-approval',
        '--dry-run-summary',
        'summary.sanitized.json',
        '--approval-reference',
        'owner-approved-ticket-123',
      ],
      env: {},
    });
    const handoff = buildBillingReportLiveHandoffSummary({
      runId: '20260511T022207Z',
      commandGate: handoffGate,
      dryRunSummary,
    });
    const resultGate = validateBillingReportLiveResultCommand({
      argv: [
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--handoff-summary',
        'handoff.sanitized.json',
        '--operator-result-summary',
        'operator-result.sanitized.json',
      ],
      env: {},
    });
    const result = buildBillingReportLiveResultSummary({
      runId: '20260511T024210Z',
      commandGate: resultGate,
      handoffSummary: handoff,
      operatorResultSummary: {
        source: 'orca-billing-report-live-operator-result',
        operatorOutcome: 'live_success_sanitized',
        rawSensitiveFieldsExcluded: true,
        liveTrialOrca: { executed: true },
        incomeInfo: {
          sourceSystem: 'ORCA',
          requestHash: 'a'.repeat(64),
          responseHash: 'b'.repeat(64),
          rowCount: 1,
        },
        reportSnapshots: [
          {
            reportType: 'invoicereceipt',
            requestHash: 'c'.repeat(64),
            responseHash: 'd'.repeat(64),
            invoiceDataIdHash: 'e'.repeat(64),
            storageUploadStatus: 'NOT_UPLOADED',
            reportBinaryAvailable: false,
            serverGeneratedStorageKeyDigestPresent: true,
          },
        ],
      },
    });

    expect(result.blockers).toEqual([]);
    expect(result.liveTrialOrca.executed).toBe(true);
    expect(result.liveTrialOrca.acceptedAsBillingReportEvidence).toBe(true);
    expect(result.claimBoundary).toContain('does not make billing');
    expect(JSON.stringify(result)).not.toMatch(/owner-approved-ticket-123/);
    expectNoRawEvidenceLeak(result);
  });

  it('blocks operator result evidence with raw identifiers or storage upload failure', () => {
    const resultGate = validateBillingReportLiveResultCommand({
      argv: [
        '--sanitized-evidence-only',
        '--disable-browser-artifacts',
        '--handoff-summary',
        'handoff.sanitized.json',
        '--operator-result-summary',
        'operator-result.sanitized.json',
        '--raw-network',
      ],
      env: { QA_RAW_NETWORK: '1' },
    });
    const result = buildBillingReportLiveResultSummary({
      runId: '20260511T024210Z',
      commandGate: resultGate,
      handoffSummary: {
        commandContract: 'orca-billing-report-live-handoff-sanitized-manual-approval',
        readyForManualLiveExecution: true,
      },
      operatorResultSummary: {
        source: 'orca-billing-report-live-operator-result',
        operatorOutcome: 'live_success_sanitized',
        rawSensitiveFieldsExcluded: true,
        liveTrialOrca: { executed: true },
        rawDataId: 'must-not-leak',
        incomeInfo: {
          sourceSystem: 'ORCA',
          requestHash: 'a'.repeat(64),
          rowCount: 1,
        },
        reportSnapshots: [
          {
            reportType: 'invoicereceipt',
            requestHash: 'c'.repeat(64),
            storageUploadStatus: 'UPLOAD_FAILED',
            reportBinaryAvailable: false,
            serverGeneratedStorageKeyDigestPresent: true,
          },
        ],
      },
    });

    expect(result.liveTrialOrca.acceptedAsBillingReportEvidence).toBe(false);
    expect(result.blockers).toContain('forbidden flag: --raw-network');
    expect(result.blockers).toContain('forbidden env enabled: QA_RAW_NETWORK');
    expect(result.blockers).toContain('forbidden_result_key:rawDataId');
    expect(result.blockers).toContain('invoicereceipt:report_storage_upload_failed');
  });
});
