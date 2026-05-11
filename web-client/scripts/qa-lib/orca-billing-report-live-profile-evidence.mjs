import crypto from 'node:crypto';

export const BILLING_REPORT_PROFILE_CONTRACT = 'orca-billing-report-live-profile-dry-run-sanitized-only';
export const BILLING_REPORT_LIVE_HANDOFF_CONTRACT = 'orca-billing-report-live-handoff-sanitized-manual-approval';
export const BILLING_REPORT_LIVE_RESULT_CONTRACT = 'orca-billing-report-live-result-sanitized-operator-record';
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
const RESULT_VALUE_FLAGS = new Set([
  '--handoff-summary',
  '--operator-result-summary',
  '--artifact-dir',
]);
const RESULT_BOOLEAN_FLAGS = new Set([
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
]);
const RESULT_FORBIDDEN_FLAGS = new Set([
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
const RESULT_OUTCOMES = new Set([
  'live_success_sanitized',
  'live_failed_sanitized',
  'blocked_before_live',
]);
const STORAGE_UPLOAD_STATUSES = new Set([
  'NOT_UPLOADED',
  'UPLOADED',
  'UPLOAD_FAILED',
  'RETENTION_BLOCKED',
  'EXPIRED',
]);
const FORBIDDEN_RESULT_KEY_NAMES = new Set([
  'authorization',
  'cookie',
  'csrf',
  'dataid',
  'data_id',
  'insurancecombinationnumber',
  'insurance_combination_number',
  'invoicenumber',
  'invoice_number',
  'jsessionid',
  'medicaluid',
  'medical_uid',
  'patientid',
  'patient_id',
  'patientname',
  'patient_name',
  'rawdataid',
  'rawinvoice',
  'rawinvoicenumber',
  'rawmedicaluid',
  'rawpatientid',
  'rawpatientname',
  'storagekey',
  'storage_key',
  'storagedigest',
  'storage_digest',
  'whole_name',
  'wholename',
]);

const normalize = (value) => String(value ?? '').trim();
const hashText = (value) => crypto.createHash('sha256').update(normalize(value)).digest('hex');
const isAccepted = (value) => value?.accepted === true && (value.verdict === undefined || value.verdict === 'accepted');
const mutationCount = (summary) => Number(summary?.mutationPolicy?.targetMutationRequestCount ?? 0);
const isSha256Hex = (value) => /^[a-f0-9]{64}$/.test(normalize(value));
const splitReportTypes = (value) =>
  normalize(value)
    .split(',')
    .map((entry) => normalize(entry))
    .filter(Boolean);
const collectForbiddenResultKeys = (value, pathSegments = [], offenders = []) => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectForbiddenResultKeys(entry, [...pathSegments, String(index)], offenders));
    return offenders;
  }
  if (!value || typeof value !== 'object') return offenders;
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalized = key.replace(/[^a-z0-9_]/gi, '').toLowerCase();
    if (FORBIDDEN_RESULT_KEY_NAMES.has(normalized)) offenders.push([...pathSegments, key].join('.'));
    collectForbiddenResultKeys(nestedValue, [...pathSegments, key], offenders);
  }
  return offenders;
};

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

export const parseBillingReportLiveResultArgs = (argv) => {
  const options = {
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
  };
  const errors = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (RESULT_FORBIDDEN_FLAGS.has(arg)) {
      errors.push(`forbidden flag: ${arg}`);
      continue;
    }
    if (RESULT_VALUE_FLAGS.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        errors.push(`missing value for ${arg}`);
        continue;
      }
      index += 1;
      if (arg === '--handoff-summary') options.handoffSummary = value;
      if (arg === '--operator-result-summary') options.operatorResultSummary = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      continue;
    }
    if (RESULT_BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--sanitized-evidence-only') options.sanitizedEvidenceOnly = true;
      if (arg === '--disable-browser-artifacts') options.disableBrowserArtifacts = true;
      continue;
    }
    errors.push(`unknown flag: ${arg}`);
  }

  return { options, errors };
};

export const validateBillingReportLiveResultCommand = ({ argv = [], env = process.env } = {}) => {
  const parsed = parseBillingReportLiveResultArgs(argv);
  const blockers = [...parsed.errors];
  const options = parsed.options;
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }

  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.handoffSummary) blockers.push('--handoff-summary is required');
  if (!options.operatorResultSummary) blockers.push('--operator-result-summary is required');

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

const classifyReportSnapshotEvidence = (snapshot) => {
  const storageUploadStatus = normalize(snapshot?.storageUploadStatus || 'NOT_UPLOADED');
  const blockers = [];
  if (!BILLING_REPORT_ALLOWED_REPORT_TYPES.has(normalize(snapshot?.reportType))) {
    blockers.push('unsupported_report_type');
  }
  if (!isSha256Hex(snapshot?.requestHash)) blockers.push('report_request_hash_missing_or_invalid');
  if (snapshot?.responseHash !== null && snapshot?.responseHash !== undefined && !isSha256Hex(snapshot.responseHash)) {
    blockers.push('report_response_hash_invalid');
  }
  if (snapshot?.invoiceDataIdHash !== null && snapshot?.invoiceDataIdHash !== undefined && !isSha256Hex(snapshot.invoiceDataIdHash)) {
    blockers.push('report_invoice_data_hash_invalid');
  }
  if (!STORAGE_UPLOAD_STATUSES.has(storageUploadStatus)) blockers.push('report_storage_upload_status_invalid');
  if (snapshot?.serverGeneratedStorageKeyDigestPresent !== true) {
    blockers.push('server_generated_storage_key_digest_missing');
  }
  if (storageUploadStatus === 'UPLOAD_FAILED') blockers.push('report_storage_upload_failed');
  if (storageUploadStatus === 'EXPIRED') blockers.push('report_storage_expired');

  return {
    reportType: normalize(snapshot?.reportType),
    requestHashValid: isSha256Hex(snapshot?.requestHash),
    responseHashPresent: Boolean(normalize(snapshot?.responseHash)),
    invoiceDataIdHashPresent: Boolean(normalize(snapshot?.invoiceDataIdHash)),
    storageUploadStatus,
    reportBinaryAvailable: snapshot?.reportBinaryAvailable === true,
    serverGeneratedStorageKeyDigestPresent: snapshot?.serverGeneratedStorageKeyDigestPresent === true,
    blockers,
  };
};

export const buildBillingReportLiveResultSummary = ({
  runId,
  commandGate,
  handoffSummary,
  operatorResultSummary,
} = {}) => {
  const commandBlockers = commandGate?.blockers ?? [];
  const operatorOutcome = normalize(operatorResultSummary?.operatorOutcome);
  const liveExecuted = operatorResultSummary?.liveTrialOrca?.executed === true;
  const reportSnapshots = Array.isArray(operatorResultSummary?.reportSnapshots)
    ? operatorResultSummary.reportSnapshots
    : [];
  const reportSnapshotEvidence = reportSnapshots.map(classifyReportSnapshotEvidence);
  const resultKeyOffenders = collectForbiddenResultKeys(operatorResultSummary);
  const checks = {
    commandAccepted: commandGate?.ok === true,
    handoffContract: handoffSummary?.commandContract === BILLING_REPORT_LIVE_HANDOFF_CONTRACT,
    handoffReady: handoffSummary?.readyForManualLiveExecution === true,
    operatorResultSource: operatorResultSummary?.source === 'orca-billing-report-live-operator-result',
    operatorOutcomeAllowed: RESULT_OUTCOMES.has(operatorOutcome),
    rawSensitiveFieldsExcluded: operatorResultSummary?.rawSensitiveFieldsExcluded === true,
    resultHasNoForbiddenRawKeys: resultKeyOffenders.length === 0,
    liveExecutionMatchesOutcome:
      operatorOutcome === 'blocked_before_live' ? operatorResultSummary?.liveTrialOrca?.executed === false : liveExecuted,
    incomeInfoStoredWhenLive:
      operatorOutcome === 'blocked_before_live'
        ? true
        : operatorResultSummary?.incomeInfo?.sourceSystem === 'ORCA' &&
          isSha256Hex(operatorResultSummary?.incomeInfo?.requestHash) &&
          (operatorResultSummary?.incomeInfo?.responseHash === null ||
            operatorResultSummary?.incomeInfo?.responseHash === undefined ||
            isSha256Hex(operatorResultSummary?.incomeInfo?.responseHash)) &&
          Number(operatorResultSummary?.incomeInfo?.rowCount ?? -1) >= 0,
    reportSnapshotsPresentWhenLive:
      operatorOutcome === 'blocked_before_live' ? true : reportSnapshotEvidence.length > 0,
    reportSnapshotsValid:
      operatorOutcome === 'blocked_before_live'
        ? true
        : reportSnapshotEvidence.every((entry) => entry.blockers.length === 0),
  };
  const evidenceBlockers = reportSnapshotEvidence.flatMap((entry) =>
    entry.blockers.map((blocker) => `${entry.reportType || 'unknown_report'}:${blocker}`),
  );
  const blockers = [
    ...commandBlockers,
    ...Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([name]) => name),
    ...resultKeyOffenders.map((key) => `forbidden_result_key:${key}`),
    ...evidenceBlockers,
  ];
  const accepted = blockers.length === 0 && operatorOutcome === 'live_success_sanitized';

  return {
    runId: normalize(runId),
    source: 'qa-orca-billing-report-live-result',
    commandContract: BILLING_REPORT_LIVE_RESULT_CONTRACT,
    handoff: {
      runId: normalize(handoffSummary?.runId),
      summaryHash: handoffSummary ? hashText(JSON.stringify(handoffSummary)) : null,
      readyForManualLiveExecution: handoffSummary?.readyForManualLiveExecution === true,
    },
    operatorOutcome,
    liveTrialOrca: {
      executed: liveExecuted,
      acceptedAsBillingReportEvidence: accepted,
    },
    checks,
    blockers,
    incomeInfoEvidence:
      operatorOutcome === 'blocked_before_live'
        ? null
        : {
            sourceSystem: normalize(operatorResultSummary?.incomeInfo?.sourceSystem),
            requestHashValid: isSha256Hex(operatorResultSummary?.incomeInfo?.requestHash),
            responseHashPresent: Boolean(normalize(operatorResultSummary?.incomeInfo?.responseHash)),
            rowCount: Number(operatorResultSummary?.incomeInfo?.rowCount ?? 0),
          },
    reportSnapshotEvidence,
    acceptedEvidenceFields: [
      'runId',
      'traceId',
      'handoffSummaryHash',
      'source_system=ORCA',
      'requestHash',
      'responseHash',
      'rowCount',
      'invoiceDataIdHash',
      'serverGeneratedStorageKeyDigestPresent',
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
      'operator result records only sanitized ORCA-derived cache/snapshot evidence; it does not make billing, payment, receipt, or report body authoritative in OpenDolphinNext',
    rawSensitiveFieldsExcluded: true,
  };
};

export const buildBillingReportLiveOperatorResultTemplate = ({ reportType = 'invoicereceipt' } = {}) => ({
  source: 'orca-billing-report-live-operator-result',
  operatorOutcome: 'live_success_sanitized',
  rawSensitiveFieldsExcluded: true,
  liveTrialOrca: {
    executed: true,
  },
  incomeInfo: {
    sourceSystem: 'ORCA',
    requestHash: '0'.repeat(64),
    responseHash: '1'.repeat(64),
    rowCount: 0,
  },
  reportSnapshots: [
    {
      reportType: normalize(reportType) || 'invoicereceipt',
      requestHash: '2'.repeat(64),
      responseHash: '3'.repeat(64),
      invoiceDataIdHash: '4'.repeat(64),
      storageUploadStatus: 'NOT_UPLOADED',
      reportBinaryAvailable: false,
      serverGeneratedStorageKeyDigestPresent: true,
    },
  ],
  claimBoundary:
    'operator input template records only sanitized ORCA-derived cache/snapshot hashes and status fields; do not add raw patient, invoice, Data_Id, Medical_Uid, ORCA body, report body, storage key, storage digest, credential, HAR, trace, video, screenshot, or raw network data',
});
