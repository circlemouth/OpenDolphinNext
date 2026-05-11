import { describe, expect, it } from 'vitest';

import {
  buildBillingReportLiveProfileSummary,
  buildBillingReportLiveHandoffSummary,
  parseBillingReportLiveProfileArgs,
  validateBillingReportLiveHandoffCommand,
  validateBillingReportLiveProfileCommand,
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
    expect(JSON.stringify(summary)).not.toMatch(
      /00002|WholeName|Insurance_Combination_Number|must-not-leak|Authorization|Cookie|JSESSIONID|CSRF|HAR|trace|video|screenshot|Medical_Uid/,
    );
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
    expect(JSON.stringify(handoff)).not.toMatch(/owner-approved-ticket-123|00002|WholeName|Insurance_Combination_Number|must-not-leak/);
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
});
