import crypto from 'node:crypto';

export const BILLING_REPORT_PROFILE_CONTRACT = 'orca-billing-report-live-profile-dry-run-sanitized-only';
export const BILLING_REPORT_LIVE_HANDOFF_CONTRACT = 'orca-billing-report-live-handoff-sanitized-manual-approval';
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
const HANDOFF_VALUE_FLAGS = new Set([
  '--dry-run-summary',
  '--artifact-dir',
  '--approval-reference',
  '--report-types',
]);
const HANDOFF_BOOLEAN_FLAGS = new Set([
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
  '--require-manual-approval',
]);
const HANDOFF_FORBIDDEN_FLAGS = new Set([
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
  '--patient-id',
  '--invoice-number',
  '--data-id',
  '--medical-uid',
  '--storage-key',
  '--storage-digest',
]);
const FORBIDDEN_ENV = [
  ['QA_RECORD_HAR', '1'],
  ['QA_TRACE', '1'],
  ['QA_VIDEO', '1'],
  ['QA_SCREENSHOT', '1'],
  ['QA_SCREENSHOTS', '1'],
  ['QA_RAW_NETWORK', '1'],
  ['QA_CAPTURE_NETWORK_RAW', '1'],
];

const normalize = (value) => String(value ?? '').trim();
const hashText = (value) => crypto.createHash('sha256').update(normalize(value)).digest('hex');
const isAccepted = (value) => value?.accepted === true && (value.verdict === undefined || value.verdict === 'accepted');
const mutationCount = (summary) => Number(summary?.mutationPolicy?.targetMutationRequestCount ?? 0);
const splitReportTypes = (value) =>
  normalize(value)
    .split(',')
    .map((entry) => normalize(entry))
    .filter(Boolean);

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

export const validateBillingReportLiveProfileCommand = ({ argv = [], env = process.env } = {}) => {
  const parsed = parseBillingReportLiveProfileArgs(argv);
  const blockers = [...parsed.errors];
  const options = parsed.options;
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }

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

export const parseBillingReportLiveHandoffArgs = (argv) => {
  const options = {
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
    requireManualApproval: false,
    reportTypes: ['invoicereceipt'],
  };
  const errors = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (HANDOFF_FORBIDDEN_FLAGS.has(arg)) {
      errors.push(`forbidden flag: ${arg}`);
      continue;
    }
    if (HANDOFF_VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        errors.push(`missing value for ${arg}`);
        continue;
      }
      index += 1;
      if (arg === '--dry-run-summary') options.dryRunSummary = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      if (arg === '--approval-reference') options.approvalReference = value;
      if (arg === '--report-types') options.reportTypes = splitReportTypes(value);
      continue;
    }
    if (HANDOFF_BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--sanitized-evidence-only') options.sanitizedEvidenceOnly = true;
      if (arg === '--disable-browser-artifacts') options.disableBrowserArtifacts = true;
      if (arg === '--require-manual-approval') options.requireManualApproval = true;
      continue;
    }
    errors.push(`unknown flag: ${arg}`);
  }

  return { options, errors };
};

export const validateBillingReportLiveHandoffCommand = ({ argv = [], env = process.env } = {}) => {
  const parsed = parseBillingReportLiveHandoffArgs(argv);
  const blockers = [...parsed.errors];
  const options = parsed.options;
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }

  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.requireManualApproval) blockers.push('--require-manual-approval is required');
  if (!options.dryRunSummary) blockers.push('--dry-run-summary is required');
  if (!options.approvalReference) blockers.push('--approval-reference is required');
  if (options.reportTypes.length === 0) blockers.push('--report-types must include at least one report type');
  for (const reportType of options.reportTypes) {
    if (!BILLING_REPORT_ALLOWED_REPORT_TYPES.has(reportType)) {
      blockers.push('--report-types must contain only invoicereceipt, prescription, statement');
      break;
    }
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

export const buildBillingReportLiveHandoffSummary = ({
  runId,
  commandGate,
  dryRunSummary,
} = {}) => {
  const commandBlockers = commandGate?.blockers ?? [];
  const dryRunReady = dryRunSummary?.readyForBillingReportLiveProfile === true;
  const dryRunContract = dryRunSummary?.commandContract === BILLING_REPORT_PROFILE_CONTRACT;
  const dryRunDidNotExecuteLive = dryRunSummary?.liveTrialOrca?.executed === false;
  const dryRunSanitized = dryRunSummary?.rawSensitiveFieldsExcluded === true;
  const targetHash = normalize(dryRunSummary?.target?.patientIdHash);
  const targetHashValid = !targetHash || /^[a-f0-9]{64}$/.test(targetHash);
  const checks = {
    commandAccepted: commandGate?.ok === true,
    dryRunSummaryReady: dryRunReady,
    dryRunSummaryContract: dryRunContract,
    dryRunSummaryDidNotExecuteLive: dryRunDidNotExecuteLive,
    dryRunSummarySanitized: dryRunSanitized,
    targetHashValid,
    manualApprovalReferencePresent: Boolean(normalize(commandGate?.options?.approvalReference)),
    browserArtifactsDisabled: commandGate?.options?.disableBrowserArtifacts === true,
    sanitizedEvidenceOnly: commandGate?.options?.sanitizedEvidenceOnly === true,
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
    source: 'qa-orca-billing-report-live-handoff',
    commandContract: BILLING_REPORT_LIVE_HANDOFF_CONTRACT,
    dryRunSummary: {
      runId: normalize(dryRunSummary?.runId),
      source: normalize(dryRunSummary?.source),
      summaryHash: dryRunSummary ? hashText(JSON.stringify(dryRunSummary)) : null,
      patientIdHash: targetHash || null,
      exactPreflightRunId: normalize(dryRunSummary?.target?.exactPreflightRunId),
      readyForBillingReportLiveProfile: dryRunReady,
    },
    manualApproval: {
      required: true,
      referenceHash: commandGate?.options?.approvalReference
        ? hashText(commandGate.options.approvalReference)
        : null,
      referenceCapturedRaw: false,
    },
    liveTrialOrca: {
      executedByThisHandoff: false,
      nextStepRequiresHumanOperator: true,
      allowedOnlyAfterApproval: ready,
    },
    reportTypes: commandGate?.options?.reportTypes ?? ['invoicereceipt'],
    endpoints: BILLING_REPORT_ENDPOINTS,
    checks,
    blockers,
    readyForManualLiveExecution: ready,
    handoffSteps: [
      'Confirm sanitized runtime-ready smoke and ORCA readiness for the same RUN_ID.',
      'Run income-info only for the exact selected-candidate preflight target through server-side facility authority.',
      'Run each approved report type through /api/orca/official/reports/{type}.',
      'Accept only orca_billing_cache and orca_report_snapshot request/response hashes, counts, invoice/data-id hashes, storageUploadStatus, and reportBinaryAvailable.',
      'Stop and classify blocker if storage upload is enabled and OrcaReportBinaryStorageService fails digest/snapshot verification.',
    ],
    acceptedEvidenceFields: [
      'runId',
      'traceId',
      'dryRunSummaryHash',
      'approvalReferenceHash',
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
      'rawPatientId',
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
      'handoff authorizes only a human-approved next live validation attempt; it is not live success, paid status, receipt authority, or report source-of-truth evidence',
    rawSensitiveFieldsExcluded: true,
  };
};
