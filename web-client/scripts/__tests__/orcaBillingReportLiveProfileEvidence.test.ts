import { describe, expect, it } from 'vitest';

import {
  buildBillingReportLiveProfileSummary,
  parseBillingReportLiveProfileArgs,
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
});
