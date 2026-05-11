import crypto from 'node:crypto';

export const BILLING_REPORT_PROFILE_CONTRACT = 'orca-billing-report-live-profile-dry-run-sanitized-only';
export const BILLING_REPORT_ENDPOINTS = [
  '/api/orca/official/chart-support/income-info',
  '/api/orca/official/reports/{type}',
];
export const BILLING_REPORT_ALLOWED_REPORT_TYPES = new Set([
  'invoicereceipt',
  'prescription',
  'statement',
]);

const VALUE_FLAGS = new Set([
  '--candidate-discovery-summary',
  '--exact-preflight-summary',
  '--artifact-dir',
  '--report-type',
]);
const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
]);
const FORBIDDEN_FLAGS = new Set([
  '--execute',
  '--execute-live',
  '--live',
  '--record-har',
  '--har',
  '--trace',
  '--video',
  '--screenshot',
  '--screenshots',
  '--raw-network',
  '--network-dump',
  '--dump-request',
  '--dump-response',
  '--request-xml',
  '--browser-artifacts',
]);

const normalize = (value) => String(value ?? '').trim();
const hashText = (value) => crypto.createHash('sha256').update(normalize(value)).digest('hex');
const isAccepted = (value) => value?.accepted === true && (value.verdict === undefined || value.verdict === 'accepted');
const mutationCount = (summary) => Number(summary?.mutationPolicy?.targetMutationRequestCount ?? 0);

export const parseBillingReportLiveProfileArgs = (argv) => {
  const options = {
    dryRun: false,
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
    reportType: 'invoicereceipt',
  };
  const errors = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_FLAGS.has(arg)) {
      errors.push(`forbidden flag: ${arg}`);
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        errors.push(`missing value for ${arg}`);
        continue;
      }
      index += 1;
      if (arg === '--candidate-discovery-summary') options.candidateDiscoverySummary = value;
      if (arg === '--exact-preflight-summary') options.exactPreflightSummary = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      if (arg === '--report-type') options.reportType = value;
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--dry-run') options.dryRun = true;
      if (arg === '--sanitized-evidence-only') options.sanitizedEvidenceOnly = true;
      if (arg === '--disable-browser-artifacts') options.disableBrowserArtifacts = true;
      continue;
    }
    errors.push(`unknown flag: ${arg}`);
  }

  return { options, errors };
};

export const validateBillingReportLiveProfileCommand = ({ argv = [] } = {}) => {
  const parsed = parseBillingReportLiveProfileArgs(argv);
  const blockers = [...parsed.errors];
  const options = parsed.options;

  if (!options.dryRun) blockers.push('--dry-run is required; this harness does not execute live ORCA traffic');
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.candidateDiscoverySummary) blockers.push('--candidate-discovery-summary is required');
  if (!options.exactPreflightSummary) blockers.push('--exact-preflight-summary is required');
  if (!BILLING_REPORT_ALLOWED_REPORT_TYPES.has(normalize(options.reportType))) {
    blockers.push('--report-type must be one of invoicereceipt, prescription, statement');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    options,
  };
};

const selectedCandidatePatientId = (summary) =>
  normalize(summary?.selectedCandidate?.patientId || summary?.selectedCandidatePatientId);

export const buildBillingReportLiveProfileSummary = ({
  runId,
  commandGate,
  candidateDiscoverySummary,
  exactPreflightSummary,
} = {}) => {
  const commandBlockers = commandGate?.blockers ?? [];
  const candidatePatientId = selectedCandidatePatientId(candidateDiscoverySummary);
  const exactPatientId = normalize(
    exactPreflightSummary?.phase3AttemptPatientId || exactPreflightSummary?.patientId,
  );
  const reportType = normalize(commandGate?.options?.reportType || 'invoicereceipt');
  const checks = {
    commandAccepted: commandGate?.ok === true,
    dryRunOnly: commandGate?.options?.dryRun === true,
    sanitizedEvidenceOnly: commandGate?.options?.sanitizedEvidenceOnly === true,
    browserArtifactsDisabled: commandGate?.options?.disableBrowserArtifacts === true,
    candidateDiscoverySource: candidateDiscoverySummary?.source === 'qa-weborca-candidate-discovery',
    candidateDiscoveryHasSelectedCandidate:
      Number(candidateDiscoverySummary?.acceptedCandidateCount ?? 0) > 0 && Boolean(candidatePatientId),
    candidateDiscoveryDoesNotAuthorizeAlone:
      candidateDiscoverySummary?.candidateDiscoveryAloneAuthorizesPhase3 === false,
    exactPreflightSource:
      exactPreflightSummary?.source === 'qa-weborca-readonly-preflight' &&
      exactPreflightSummary?.flowMode === 'exact-readonly-preflight',
    exactPreflightAccepted: exactPreflightSummary?.acceptedForPhase3Attempt === true,
    exactPreflightPatientMatchesCandidate:
      Boolean(candidatePatientId) && Boolean(exactPatientId) && candidatePatientId === exactPatientId,
    exactPreflightRawSensitiveExcluded: exactPreflightSummary?.rawSensitiveFieldsExcluded === true,
    exactPreflightNoMutationRequests: mutationCount(exactPreflightSummary) === 0,
    exactPreflightLocalSelectable: isAccepted(exactPreflightSummary?.localSelectableReadiness),
    exactPreflightInsuranceReady: isAccepted(exactPreflightSummary?.insuranceReadiness),
  };
  const blockers = [
    ...commandBlockers,
    ...Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([name]) => name),
  ];
  const ready = blockers.length === 0;

  return {
    runId: normalize(runId),
    source: 'qa-orca-billing-report-live-profile',
    commandContract: BILLING_REPORT_PROFILE_CONTRACT,
    dryRun: true,
    liveTrialOrca: {
      executed: false,
      permittedByThisHarness: false,
    },
    target: {
      patientIdHash: exactPatientId ? hashText(exactPatientId) : null,
      exactPreflightRunId: normalize(exactPreflightSummary?.runId),
    },
    endpoints: BILLING_REPORT_ENDPOINTS,
    reportType,
    checks,
    blockers,
    readyForBillingReportLiveProfile: ready,
    acceptedEvidenceFields: [
      'runId',
      'traceId',
      'source_system=ORCA',
      'requestHash',
      'responseHash',
      'rowCount',
      'invoiceDataIdHash',
      'serverGeneratedStorageKeyDigest',
      'storageUploadStatus',
      'reportBinaryAvailable',
      'sanitizedSummary',
    ],
    forbiddenEvidenceFields: [
      'rawOrcaBody',
      'reportBody',
      'rawInvoiceNumber',
      'rawDataId',
      'rawMedicalUid',
      'patientNameAddressPhone',
      'insuranceDetail',
      'credential',
      'sessionAuthHeaders',
      'browserDiagnosticArtifacts',
      'rawNetworkJson',
      'clientProvidedStorageKeyDigest',
    ],
    claimBoundary:
      'billing/report live profile proves only ORCA-derived cache/snapshot acquisition and sanitized storage metadata, not paid status or local source-of-truth',
    rawSensitiveFieldsExcluded: true,
  };
};
