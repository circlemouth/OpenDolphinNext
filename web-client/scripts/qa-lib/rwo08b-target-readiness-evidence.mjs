import crypto from 'node:crypto';

export const RWO08B_TARGET_READINESS_CONTRACT = 'rwo08b-fullflow-target-readiness-artifact-free-readonly';
export const RWO08B_IDENTIFIER_PREFLIGHT_ENDPOINT = '/api/orca/official/visits/identifier-preflight';
export const RWO08B_IDENTIFIER_PREFLIGHT_ORCA_ENDPOINTS = ['/api01rv2/acceptlstv2', '/api01rv2/medicalgetv2'];

const DUPLICATE_BLOCKED_PATIENT_IDS = new Set(['00001', '00005']);
const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;
const ALLOWED_ACCEPTANCE_CLASSES = new Set(['01', '02', '03']);
const ALLOWED_MEDICAL_GET_CLASSES = new Set(['01', '02', '03', '04']);
const BOOLEAN_FLAGS = new Set(['--dry-run', '--execute-readonly', '--sanitized-evidence-only', '--disable-browser-artifacts']);
const VALUE_FLAGS = new Set([
  '--artifact-dir',
  '--candidate-discovery-summary',
  '--exact-preflight-summary',
  '--identifier-preflight-summary',
  '--acceptance-date',
  '--class',
  '--medical-get-class',
  '--target-row-hash',
]);
const FORBIDDEN_FLAGS = new Set([
  '--execute-live',
  '--execute-mutation',
  '--record-har',
  '--har',
  '--trace',
  '--video',
  '--screenshot',
  '--screenshots',
  '--raw-network',
  '--dump-request',
  '--dump-response',
  '--request-xml',
  '--response-xml',
  '--browser-artifacts',
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
const normalizeClassCode = (value, fallback) => {
  const normalized = normalize(value || fallback);
  if (/^\d$/.test(normalized)) return `0${normalized}`;
  return normalized;
};
const bool = (value) => value === true;
const statusClass = (status) => {
  const code = Number(status || 0) || 0;
  return code ? `${Math.floor(code / 100)}xx` : 'not_observed';
};
const apiResultClass = (value) => {
  const normalized = normalize(value);
  if (!normalized) return 'blank';
  return /^0+$/.test(normalized) ? 'zero' : 'nonzero';
};
const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');

export const parseRwo08bTargetReadinessArgs = (argv = []) => {
  const options = {
    dryRun: false,
    executeReadonly: false,
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
    classCode: '01',
    medicalGetClassCode: '01',
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
      if (arg === '--artifact-dir') options.artifactDir = value;
      if (arg === '--candidate-discovery-summary') options.candidateDiscoverySummary = value;
      if (arg === '--exact-preflight-summary') options.exactPreflightSummary = value;
      if (arg === '--identifier-preflight-summary') options.identifierPreflightSummary = value;
      if (arg === '--acceptance-date') options.acceptanceDate = value;
      if (arg === '--class') options.classCode = value;
      if (arg === '--medical-get-class') options.medicalGetClassCode = value;
      if (arg === '--target-row-hash') options.targetRowHash = value;
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--dry-run') options.dryRun = true;
      if (arg === '--execute-readonly') options.executeReadonly = true;
      if (arg === '--sanitized-evidence-only') options.sanitizedEvidenceOnly = true;
      if (arg === '--disable-browser-artifacts') options.disableBrowserArtifacts = true;
      continue;
    }
    errors.push(`unknown flag: ${arg}`);
  }
  options.classCode = normalizeClassCode(options.classCode, '01');
  options.medicalGetClassCode = normalizeClassCode(options.medicalGetClassCode, '01');
  options.targetRowHash = normalize(options.targetRowHash).toLowerCase() || undefined;
  return { options, errors };
};

export const validateRwo08bTargetReadinessCommand = ({ argv = [], env = process.env } = {}) => {
  const { options, errors } = parseRwo08bTargetReadinessArgs(argv);
  const blockers = [...errors];
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (options.dryRun === options.executeReadonly) {
    blockers.push('exactly one of --dry-run or --execute-readonly is required');
  }
  if (!options.candidateDiscoverySummary) blockers.push('--candidate-discovery-summary is required');
  if (!options.exactPreflightSummary) blockers.push('--exact-preflight-summary is required');
  if (!ALLOWED_ACCEPTANCE_CLASSES.has(options.classCode)) blockers.push('--class must be one of 01, 02, or 03');
  if (!ALLOWED_MEDICAL_GET_CLASSES.has(options.medicalGetClassCode)) {
    blockers.push('--medical-get-class must be one of 01, 02, 03, or 04');
  }
  if (options.acceptanceDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalize(options.acceptanceDate))) {
    blockers.push('--acceptance-date must use YYYY-MM-DD');
  }
  if (options.targetRowHash && !SHA256_HEX_RE.test(options.targetRowHash)) {
    blockers.push('--target-row-hash must be a SHA-256 hex row hash');
  }
  if (options.executeReadonly) {
    if (!options.acceptanceDate) blockers.push('--acceptance-date is required for --execute-readonly');
    if (!options.targetRowHash) blockers.push('--target-row-hash is required for --execute-readonly');
  }
  return {
    ok: blockers.length === 0,
    blockers,
    options,
    contract: RWO08B_TARGET_READINESS_CONTRACT,
    endpoint: RWO08B_IDENTIFIER_PREFLIGHT_ENDPOINT,
    orcaEndpoints: RWO08B_IDENTIFIER_PREFLIGHT_ORCA_ENDPOINTS,
    readOnlyTrialOrcaExecuted: options.executeReadonly && blockers.length === 0,
    liveTrialMutationExecuted: false,
    credentialsCaptured: false,
    rawArtifactsCaptured: false,
    rawPayloadStored: false,
    rawOrcaBodyStored: false,
  };
};

const selectedCandidateIdFromDiscovery = (summary) =>
  normalize(summary?.selectedCandidate?.patientId) ||
  normalize(summary?.preflightSummary?.selectedCandidate?.patientId) ||
  normalize(summary?.phase3AttemptPatientId) ||
  '';

const exactPreflightPatientId = (summary) =>
  normalize(summary?.phase3AttemptPatientId) ||
  normalize(summary?.patientId) ||
  normalize(summary?.inputIdentity?.patientId) ||
  '';

export const sanitizeIdentifierPreflightRouteResponse = ({ httpStatus = 0, responseJson = {} } = {}) => {
  const medicalRows = Array.isArray(responseJson?.medicalRows) ? responseJson.medicalRows : [];
  const visitRows = Array.isArray(responseJson?.visitRows) ? responseJson.visitRows : [];
  const details = responseJson?.details && typeof responseJson.details === 'object' ? responseJson.details : {};
  const sanitizedErrorCode = normalize(responseJson?.sanitizedErrorCode || responseJson?.errorCode || responseJson?.code || responseJson?.error);
  const sanitizedValidationError = normalize(
    responseJson?.sanitizedValidationError || responseJson?.validationError || details.validationError,
  );
  const sanitizedRows = medicalRows.map((row) => ({
    rowHash: SHA256_HEX_RE.test(normalize(row?.rowHash)) ? normalize(row.rowHash).toLowerCase() : '',
    hasPerformDate: bool(row?.hasPerformDate),
    hasDepartmentCode: bool(row?.hasDepartmentCode),
    hasSequentialNumber: bool(row?.hasSequentialNumber),
    hasInsuranceCombinationNumber: bool(row?.hasInsuranceCombinationNumber),
    hasInvoiceNumber: bool(row?.hasInvoiceNumber),
    rawSensitiveFieldsExcluded: row?.rawSensitiveFieldsExcluded !== false,
  }));
  const readyRows = sanitizedRows.filter((row) =>
    row.rowHash &&
    row.hasPerformDate &&
    row.hasDepartmentCode &&
    row.hasSequentialNumber &&
    row.hasInsuranceCombinationNumber &&
    row.rawSensitiveFieldsExcluded);
  const sanitizedVisitRows = visitRows.map((row) => ({
    rowHash: SHA256_HEX_RE.test(normalize(row?.rowHash)) ? normalize(row.rowHash).toLowerCase() : '',
    hasPatientId: bool(row?.hasPatientId),
    hasVisitDate: bool(row?.hasVisitDate),
    hasDepartmentCode: bool(row?.hasDepartmentCode),
    hasVoucherNumber: bool(row?.hasVoucherNumber),
    hasSequentialNumber: bool(row?.hasSequentialNumber),
    hasInsuranceCombinationNumber: bool(row?.hasInsuranceCombinationNumber),
    rawSensitiveFieldsExcluded: row?.rawSensitiveFieldsExcluded !== false,
  }));
  const readyVisitRows = sanitizedVisitRows.filter((row) =>
    row.rowHash &&
    row.hasPatientId &&
    row.hasVisitDate &&
    row.hasDepartmentCode &&
    row.hasVoucherNumber &&
    row.hasSequentialNumber &&
    row.hasInsuranceCombinationNumber &&
    row.rawSensitiveFieldsExcluded);
  return {
    endpoint: RWO08B_IDENTIFIER_PREFLIGHT_ENDPOINT,
    mutation: false,
    httpStatus: Number(httpStatus || responseJson?.httpStatus || responseJson?.status || 0) || 0,
    transportStatusClass: statusClass(httpStatus || responseJson?.httpStatus || responseJson?.status),
    apiResult: normalize(responseJson?.apiResult),
    apiResultClass: apiResultClass(responseJson?.apiResult),
    requestClass: normalize(responseJson?.requestClass) || `identifier_preflight_readonly`,
    acceptanceEndpoint: normalize(responseJson?.acceptanceEndpoint) || '/api01rv2/acceptlstv2',
    medicalGetEndpoint: normalize(responseJson?.medicalGetEndpoint) || '/api01rv2/medicalgetv2',
    acceptanceClassCode: normalizeClassCode(responseJson?.acceptanceClassCode, ''),
    medicalGetClassCode: normalizeClassCode(responseJson?.medicalGetClassCode, ''),
    acceptanceDate: normalize(responseJson?.acceptanceDate),
    selectedAcceptanceRowHash: SHA256_HEX_RE.test(normalize(responseJson?.selectedAcceptanceRowHash))
      ? normalize(responseJson.selectedAcceptanceRowHash).toLowerCase()
      : '',
    selectedAcceptanceTargetReady: bool(responseJson?.selectedAcceptanceTargetReady),
    acceptanceSourceRowCount: Number(responseJson?.acceptanceSourceRowCount ?? 0) || 0,
    acceptanceTargetReadyRowCount: Number(responseJson?.acceptanceTargetReadyRowCount ?? 0) || 0,
    medicalSourceRowCount: Number(responseJson?.medicalSourceRowCount ?? medicalRows.length) || 0,
    medicalSanitizedRowCount: Number(responseJson?.medicalSanitizedRowCount ?? sanitizedRows.length) || 0,
    medicalReadyRowCount: readyRows.length,
    visitListEndpoint: normalize(responseJson?.visitListEndpoint),
    visitListRequestClass: normalize(responseJson?.visitListRequestClass),
    visitSourceRowCount: Number(responseJson?.visitSourceRowCount ?? visitRows.length) || 0,
    visitSanitizedRowCount: Number(responseJson?.visitSanitizedRowCount ?? sanitizedVisitRows.length) || 0,
    visitReadyRowCount: readyVisitRows.length,
    identifierPreflightReady: bool(responseJson?.identifierPreflightReady) && (readyRows.length > 0 || readyVisitRows.length > 0),
    artifactFree: responseJson?.artifactFree !== false,
    rawSensitiveFieldsExcluded: responseJson?.rawSensitiveFieldsExcluded !== false,
    clientProvidedIdentifiersTrusted: bool(responseJson?.clientProvidedIdentifiersTrusted),
    serverDerivedAuthorityRequired: responseJson?.serverDerivedAuthorityRequired !== false,
    sanitizedErrorCode,
    sanitizedValidationError,
    medicalRows: sanitizedRows,
    visitRows: sanitizedVisitRows,
  };
};

const exactPreflightAccepted = (summary) =>
  summary?.source === 'qa-weborca-readonly-preflight' &&
  summary?.flowMode === 'exact-readonly-preflight' &&
  summary?.acceptedForPhase3Attempt === true &&
  summary?.verdict === 'accepted' &&
  summary?.mutationPolicy?.targetMutationRequestCount === 0 &&
  summary?.rawSensitiveFieldsExcluded === true;

const localExactAccepted = (summary) => {
  const local = summary?.localSelectableReadiness ?? {};
  return (
    (local.accepted === true || local.verdict === 'accepted' || local.status === 'accepted') &&
    Number(local.exactMatchCount ?? local.exactNormalizedPatientIdMatchCount ?? 0) === 1
  );
};

const classifyTargetReadiness = ({ commandGate, candidateDiscoverySummary, exactPreflightSummary, identifierPreflight }) => {
  if (!commandGate?.ok) return 'command_blocked';
  const discoveryCandidateId = selectedCandidateIdFromDiscovery(candidateDiscoverySummary);
  if (!candidateDiscoverySummary) return 'candidate_discovery_missing';
  if (!discoveryCandidateId) return 'candidate_discovery_no_selected_candidate';
  if (DUPLICATE_BLOCKED_PATIENT_IDS.has(discoveryCandidateId)) return 'duplicate_blocked_candidate_selected';

  const exactPatientId = exactPreflightPatientId(exactPreflightSummary);
  if (!exactPreflightAccepted(exactPreflightSummary)) return 'exact_selected_candidate_preflight_missing_or_rejected';
  if (!exactPatientId) return 'exact_selected_candidate_patient_missing';
  if (DUPLICATE_BLOCKED_PATIENT_IDS.has(exactPatientId)) return 'duplicate_blocked_candidate_selected';
  if (discoveryCandidateId && exactPatientId && discoveryCandidateId !== exactPatientId) return 'candidate_discovery_exact_preflight_mismatch';
  if (!localExactAccepted(exactPreflightSummary)) return 'local_exact_match_missing';

  if (!identifierPreflight) return 'identifier_preflight_not_run';
  if (identifierPreflight.clientProvidedIdentifiersTrusted) return 'identifier_preflight_unsafe_client_authority';
  if (identifierPreflight.rawSensitiveFieldsExcluded !== true || identifierPreflight.artifactFree !== true) {
    return 'identifier_preflight_sanitizer_not_proven';
  }
  if (identifierPreflight.identifierPreflightReady !== true) return 'identifier_preflight_target_blocked';
  return 'target_ready_for_diagnostic_fullflow';
};

const nextActionFor = (classification) => {
  switch (classification) {
    case 'target_ready_for_diagnostic_fullflow':
      return 'Queue one diagnostic Fullflow retry for the same non-duplicate target only after artifact containment and endpoint packet checks are recorded.';
    case 'identifier_preflight_not_run':
      return 'Run /api/orca/official/visits/identifier-preflight in artifact-free read-only mode for the accepted non-duplicate local-exact target row hash.';
    case 'identifier_preflight_target_blocked':
      return 'Investigate the sanitized identifier-preflight presence flags and target row hash before any diagnostic Fullflow retry.';
    case 'local_exact_match_missing':
    case 'exact_selected_candidate_preflight_missing_or_rejected':
    case 'candidate_discovery_no_selected_candidate':
      return 'Refresh candidate discovery and exact selected-candidate preflight until a non-duplicate local-exact target is proven.';
    case 'duplicate_blocked_candidate_selected':
      return 'Exclude duplicate-blocked 00001/00005 and select a fresh non-duplicate target before preflight.';
    default:
      return 'Resolve the recorded target-readiness blocker before any diagnostic Fullflow retry.';
  }
};

export const buildRwo08bTargetReadinessSummary = ({
  runId,
  commandGate,
  candidateDiscoverySummary,
  exactPreflightSummary,
  identifierPreflight,
  runtimeReadiness,
} = {}) => {
  const sanitizedIdentifierPreflight = identifierPreflight
    ? sanitizeIdentifierPreflightRouteResponse({ responseJson: identifierPreflight, httpStatus: identifierPreflight.httpStatus })
    : null;
  const classification = classifyTargetReadiness({
    commandGate,
    candidateDiscoverySummary,
    exactPreflightSummary,
    identifierPreflight: sanitizedIdentifierPreflight,
  });
  const targetReady = classification === 'target_ready_for_diagnostic_fullflow';
  const discoveryCandidateId = selectedCandidateIdFromDiscovery(candidateDiscoverySummary);
  const exactPatientId = exactPreflightPatientId(exactPreflightSummary);
  return {
    schemaVersion: 1,
    runId,
    workOrder: 'RWO-08B',
    taskId: 'RWO-08B_COMBINED_TARGET_READINESS_WRAPPER',
    contract: RWO08B_TARGET_READINESS_CONTRACT,
    endpoint: RWO08B_IDENTIFIER_PREFLIGHT_ENDPOINT,
    orcaEndpoints: RWO08B_IDENTIFIER_PREFLIGHT_ORCA_ENDPOINTS,
    commandGate: {
      ok: commandGate?.ok === true,
      blockers: commandGate?.blockers ?? [],
    },
    duplicateBlockedCandidateIdsExcluded: ['00001', '00005'],
    candidateDiscovery: {
      present: Boolean(candidateDiscoverySummary),
      source: candidateDiscoverySummary?.source ?? '',
      flowMode: candidateDiscoverySummary?.flowMode ?? '',
      selectedCandidatePatientId: discoveryCandidateId || null,
      acceptedCandidateCount: Number(candidateDiscoverySummary?.acceptedCandidateCount ?? 0) || 0,
      aloneAuthorizesFullflow: false,
      mutation: false,
      targetMutationRequestCount: Number(candidateDiscoverySummary?.mutationPolicy?.targetMutationRequestCount ?? 0) || 0,
    },
    exactSelectedCandidatePreflight: {
      present: Boolean(exactPreflightSummary),
      source: exactPreflightSummary?.source ?? '',
      flowMode: exactPreflightSummary?.flowMode ?? '',
      accepted: exactPreflightAccepted(exactPreflightSummary),
      patientId: exactPatientId || null,
      localExactMatchAccepted: localExactAccepted(exactPreflightSummary),
      localExactMatchCount: Number(
        exactPreflightSummary?.localSelectableReadiness?.exactMatchCount ??
          exactPreflightSummary?.localSelectableReadiness?.exactNormalizedPatientIdMatchCount ??
          0,
      ) || 0,
      selectorAccepted: exactPreflightSummary?.selectorReadiness?.accepted === true,
      medicalInformationAccepted: exactPreflightSummary?.medicalInformationReadiness?.accepted === true,
      targetMutationRequestCount: Number(exactPreflightSummary?.mutationPolicy?.targetMutationRequestCount ?? 0) || 0,
    },
    identifierPreflight: sanitizedIdentifierPreflight ?? {
      executed: false,
      mutation: false,
      endpoint: RWO08B_IDENTIFIER_PREFLIGHT_ENDPOINT,
      identifierPreflightReady: false,
      reason: 'not_run',
    },
    runtimeReadiness: runtimeReadiness ?? {
      checked: false,
      statusOnly: 'not_checked',
      blockers: [],
    },
    targetReadiness: {
      readyForDiagnosticFullflow: targetReady,
      businessSuccessClassification: classification,
      nextConcreteSafeAction: nextActionFor(classification),
    },
    diagnosticFullflow: {
      executed: false,
      orderSendReached: false,
      businessSuccessClassification: 'not_run_by_target_readiness_wrapper',
    },
    liveTrialOrca: {
      executed: false,
      businessAccepted: false,
    },
    readOnlyTrialOrca: {
      executed: commandGate?.options?.executeReadonly === true && commandGate?.ok === true && Boolean(sanitizedIdentifierPreflight),
      mutation: false,
      businessSuccessClassification: sanitizedIdentifierPreflight
        ? (sanitizedIdentifierPreflight.identifierPreflightReady ? 'readonly_identifier_preflight_target_ready' : 'readonly_identifier_preflight_target_blocked')
        : 'not_run',
    },
    checks: {
      http2xxAloneIsNotSuccess: true,
      readOnlyDiscoveryAloneIsNotSuccess: true,
      identifierPreflightAloneIsNotFullflowSuccess: true,
      diagnosticFullflowRequiresTargetReady: true,
    },
    evidenceHashes: {
      candidateDiscoverySummaryHash: candidateDiscoverySummary ? sha256(JSON.stringify(candidateDiscoverySummary)) : '',
      exactPreflightSummaryHash: exactPreflightSummary ? sha256(JSON.stringify(exactPreflightSummary)) : '',
      identifierPreflightSummaryHash: sanitizedIdentifierPreflight ? sha256(JSON.stringify(sanitizedIdentifierPreflight)) : '',
    },
    credentialsCaptured: false,
    diagnosticArtifactsCaptured: false,
    rawArtifactsCommittedOrPackaged: false,
    rawOrcaBodiesCaptured: false,
    patientInsuranceDetailsCaptured: false,
    productionOrcaAttempted: false,
    s3ObjectStorageUsed: false,
    claimBoundary:
      'Combined artifact-free read-only target-readiness wrapper only. This is not diagnostic Fullflow success, Trial order-send business acceptance, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO/PENDING, or final release readiness.',
  };
};
