export const ACCEPTMOD_OPERATION_CONTRACT = 'phase4-acceptmodv2-operation-sanitized-no-live';
export const ACCEPTMOD_OPERATION_ENDPOINT = '/orca11/acceptmodv2';

const ALLOWED_REQUEST_NUMBERS = new Set(['02', '03', '04']);
const VALUE_FLAGS = new Set([
  '--request-number',
  '--artifact-dir',
  '--precondition-summary',
]);
const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
]);
const FORBIDDEN_FLAGS = new Set([
  '--execute-live',
  '--execute-mutation',
  '--execute-approved-phase4',
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
const normalizeUpper = (value) => normalize(value).toUpperCase();
const zeroLike = (value) => /^0+$/.test(normalizeUpper(value));

export const requestNumberLabel = (requestNumber) => {
  if (requestNumber === '02') return 'reception_delete_or_cancel';
  if (requestNumber === '03') return 'reception_update_or_change';
  if (requestNumber === '04') return 'claim_send_information_update_or_supporting_action';
  return 'unsupported';
};

export const parseAcceptmodOperationArgs = (argv) => {
  const options = {
    dryRun: false,
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
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
      if (arg === '--request-number') options.requestNumber = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      if (arg === '--precondition-summary') options.preconditionSummary = value;
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

export const validateAcceptmodOperationCommand = ({ argv, env = process.env }) => {
  const { options, errors } = parseAcceptmodOperationArgs(argv);
  const blockers = [...errors];
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }
  const requestNumber = normalize(options.requestNumber);
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.dryRun) blockers.push('--dry-run is required; live acceptmodv2 RN02/03/04 is not implemented by this wrapper');
  if (!ALLOWED_REQUEST_NUMBERS.has(requestNumber)) blockers.push('--request-number must be one of 02, 03, or 04');

  return {
    ok: blockers.length === 0,
    blockers,
    options: {
      ...options,
      requestNumber,
      operation: requestNumberLabel(requestNumber),
    },
    contract: ACCEPTMOD_OPERATION_CONTRACT,
    endpoint: ACCEPTMOD_OPERATION_ENDPOINT,
    liveTrialMutationExecuted: false,
    rawPayloadStored: false,
    rawOrcaBodyStored: false,
    credentialsCaptured: false,
    rawArtifactsCaptured: false,
  };
};

export const requiredPreconditionsForRequestNumber = (requestNumber) => {
  if (requestNumber === '02') {
    return [
      'active_acceptance_row',
      'server_derived_acceptance_id',
      'matching_patient_id',
      'acceptance_date',
      'department_physician_scope',
      'duplicate_live_checkpoint',
      'parser_sanitizer_contract',
    ];
  }
  if (requestNumber === '03') {
    return [
      'active_acceptance_row',
      'server_derived_acceptance_id',
      'server_authoritative_update_fields',
      'server_state_insurance_combination_when_needed',
      'duplicate_live_checkpoint',
      'parser_sanitizer_contract',
    ];
  }
  if (requestNumber === '04') {
    return [
      'active_acceptance_row',
      'server_derived_acceptance_identifiers',
      'explicit_claim_send_info_policy',
      'duplicate_live_checkpoint',
      'rollback_duplicate_policy',
      'parser_sanitizer_contract',
    ];
  }
  return [];
};

const preconditionsSatisfied = (requestNumber, preconditions = {}) => {
  if (requestNumber === '02') {
    return Boolean(
      preconditions.activeAcceptanceRow &&
        preconditions.serverDerivedAcceptanceId &&
        preconditions.matchingPatientId &&
        preconditions.acceptanceDate &&
        preconditions.departmentPhysicianScope &&
        preconditions.duplicateLiveCheckpoint &&
        preconditions.parserSanitizerContract,
    );
  }
  if (requestNumber === '03') {
    return Boolean(
      preconditions.activeAcceptanceRow &&
        preconditions.serverDerivedAcceptanceId &&
        preconditions.serverAuthoritativeUpdateFields &&
        preconditions.duplicateLiveCheckpoint &&
        preconditions.parserSanitizerContract,
    );
  }
  if (requestNumber === '04') {
    return Boolean(
      preconditions.activeAcceptanceRow &&
        preconditions.serverDerivedAcceptanceIdentifiers &&
        preconditions.explicitClaimSendInfoPolicy &&
        preconditions.duplicateLiveCheckpoint &&
        preconditions.rollbackDuplicatePolicy &&
        preconditions.parserSanitizerContract,
    );
  }
  return false;
};

const completionEvidenceSatisfied = (requestNumber, completionEvidence = {}) => {
  if (requestNumber === '02') return completionEvidence.cancellationEvidencePresent === true;
  if (requestNumber === '03') return completionEvidence.updateEvidencePresent === true;
  if (requestNumber === '04') return completionEvidence.claimSendInfoEvidencePresent === true;
  return false;
};

export const classifyAcceptmodOperationResponse = ({
  httpStatus,
  requestNumber,
  apiResult,
  preconditions = {},
  completionEvidence = {},
  parserAmbiguous = false,
}) => {
  const normalizedRequestNumber = normalize(requestNumber);
  const status = Number(httpStatus) || 0;
  const http2xx = status >= 200 && status < 300;
  const operationPreconditionsSatisfied = preconditionsSatisfied(normalizedRequestNumber, preconditions);
  const operationCompletionEvidenceSatisfied = completionEvidenceSatisfied(normalizedRequestNumber, completionEvidence);

  if (!ALLOWED_REQUEST_NUMBERS.has(normalizedRequestNumber)) {
    return {
      responseClassification: 'unsupportedRequestNumber',
      businessAccepted: false,
      mutationSuccess: false,
    };
  }
  if (!status) {
    return {
      responseClassification: 'notObserved',
      businessAccepted: false,
      mutationSuccess: false,
    };
  }
  if (status >= 500 || status < 200) {
    return {
      responseClassification: 'transportRejected',
      businessAccepted: false,
      mutationSuccess: false,
    };
  }
  if (parserAmbiguous) {
    return {
      responseClassification: 'parserAmbiguous',
      businessAccepted: false,
      mutationSuccess: false,
    };
  }
  if (!operationPreconditionsSatisfied) {
    return {
      responseClassification: 'preconditionNotVerified',
      businessAccepted: false,
      mutationSuccess: false,
    };
  }
  if (!http2xx || !zeroLike(apiResult)) {
    return {
      responseClassification: 'businessRejected',
      businessAccepted: false,
      mutationSuccess: false,
    };
  }
  if (!operationCompletionEvidenceSatisfied) {
    return {
      responseClassification: 'notVerified',
      businessAccepted: false,
      mutationSuccess: false,
    };
  }
  return {
    responseClassification: 'businessAccepted',
    businessAccepted: true,
    mutationSuccess: true,
  };
};

export const buildAcceptmodOperationDryRunSummary = ({ runId, requestNumber, commandGate }) => {
  const normalizedRequestNumber = normalize(requestNumber);
  return {
    schemaVersion: 1,
    runId,
    workOrder: 'RWO-07',
    taskId: 'RWO-07_ACCEPTMODV2_OPERATION_WRAPPER_CONTRACT',
    contract: ACCEPTMOD_OPERATION_CONTRACT,
    endpoint: ACCEPTMOD_OPERATION_ENDPOINT,
    requestClass: `acceptmodv2_request_${normalizedRequestNumber}_no_live_contract`,
    requestNumber: normalizedRequestNumber,
    operation: requestNumberLabel(normalizedRequestNumber),
    commandGate: {
      ok: commandGate.ok,
      blockers: commandGate.blockers,
    },
    noLivePacket: {
      requiredPreconditions: requiredPreconditionsForRequestNumber(normalizedRequestNumber),
      serverDerivedAuthorityRequired: true,
      clientProvidedIdentifiersTrusted: false,
      endpointSpecificCompletionEvidenceRequired: true,
      http2xxAloneIsNotSuccess: true,
      apiResultZeroAloneIsNotSuccess: true,
    },
    liveTrialOrca: {
      executed: false,
      businessSuccessClassification: 'not_applicable_no_live_contract_only',
      businessAccepted: false,
    },
    credentialsCaptured: false,
    diagnosticArtifactsCaptured: false,
    rawArtifactsCommittedOrPackaged: false,
    claimBoundary:
      `No-live acceptmodv2 Request_Number ${normalizedRequestNumber} operation wrapper/parser contract only; not Trial mutation success, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.`,
  };
};
