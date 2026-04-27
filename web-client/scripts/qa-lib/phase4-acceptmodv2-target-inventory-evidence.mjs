import crypto from 'node:crypto';

export const ACCEPTMOD_TARGET_INVENTORY_CONTRACT = 'phase4-acceptmodv2-target-inventory-sanitized-no-live';
export const ACCEPTMOD_TARGET_INVENTORY_ENDPOINT = '/api/orca/official/visits/acceptance-list';
export const ACCEPTMOD_TARGET_INVENTORY_ORCA_ENDPOINT = '/api01rv2/acceptlstv2';

const ALLOWED_CLASSES = new Set(['01', '02', '03']);
const VALUE_FLAGS = new Set([
  '--acceptance-date',
  '--artifact-dir',
  '--class',
  '--source-summary',
]);
const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
]);
const FORBIDDEN_FLAGS = new Set([
  '--execute-live',
  '--execute-mutation',
  '--execute-readonly',
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
const padTwoDigits = (value) => {
  const normalized = normalize(value);
  return /^\d$/.test(normalized) ? `0${normalized}` : normalized;
};
const zeroLike = (value) => /^0+$/.test(normalize(value));
const sha256 = (value) => crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');

export const parseAcceptmodTargetInventoryArgs = (argv) => {
  const options = {
    dryRun: false,
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
    classCode: '01',
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
      if (arg === '--acceptance-date') options.acceptanceDate = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      if (arg === '--class') options.classCode = value;
      if (arg === '--source-summary') options.sourceSummary = value;
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
  options.classCode = padTwoDigits(options.classCode);
  return { options, errors };
};

export const validateAcceptmodTargetInventoryCommand = ({ argv, env = process.env }) => {
  const { options, errors } = parseAcceptmodTargetInventoryArgs(argv);
  const blockers = [...errors];
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.dryRun) blockers.push('--dry-run is required; read-only acceptlstv2 execution is not implemented by this wrapper');
  if (!ALLOWED_CLASSES.has(options.classCode)) blockers.push('--class must be one of 01, 02, or 03');
  if (options.acceptanceDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalize(options.acceptanceDate))) {
    blockers.push('--acceptance-date must use YYYY-MM-DD');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    options,
    contract: ACCEPTMOD_TARGET_INVENTORY_CONTRACT,
    endpoint: ACCEPTMOD_TARGET_INVENTORY_ENDPOINT,
    orcaEndpoint: ACCEPTMOD_TARGET_INVENTORY_ORCA_ENDPOINT,
    readOnlyTrialOrcaExecuted: false,
    liveTrialMutationExecuted: false,
    rawPayloadStored: false,
    rawOrcaBodyStored: false,
    credentialsCaptured: false,
    rawArtifactsCaptured: false,
  };
};

const readFirst = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && normalize(value)) return normalize(value);
  }
  return '';
};

const rowsFrom = (source) => {
  if (!source || typeof source !== 'object') return [];
  for (const key of ['entries', 'acceptances', 'rows', 'visits', 'Acceptlst_Information']) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

export const sanitizeAcceptlstInventoryResponse = (source = {}) => {
  const rows = rowsFrom(source);
  const sanitizedRows = rows.map((row) => {
    const acceptanceId = readFirst(row, ['acceptanceId', 'Acceptance_Id']);
    const patientId = readFirst(row?.patient || row?.Patient_Information || row, ['patientId', 'Patient_ID']);
    const acceptanceDate = readFirst(row, ['acceptanceDate', 'Acceptance_Date']);
    const acceptanceTime = readFirst(row, ['acceptanceTime', 'Acceptance_Time']);
    const departmentCode = readFirst(row, ['departmentCode', 'Department_Code']);
    const physicianCode = readFirst(row, ['physicianCode', 'Physician_Code']);
    const medicalInformation = readFirst(row, ['medicalInformation', 'Medical_Information']);
    const insuranceCombinationNumber = readFirst(row, [
      'insuranceCombinationNumber',
      'Insurance_Combination_Number',
      'healthInsuranceCombinationNumber',
    ]);
    const identitySeed = [
      acceptanceId,
      patientId,
      acceptanceDate,
      acceptanceTime,
      departmentCode,
      physicianCode,
      medicalInformation,
      insuranceCombinationNumber,
    ].join('|');
    return {
      rowHash: sha256(identitySeed),
      hasAcceptanceId: Boolean(acceptanceId),
      hasPatientId: Boolean(patientId),
      hasAcceptanceDate: Boolean(acceptanceDate),
      hasAcceptanceTime: Boolean(acceptanceTime),
      hasDepartmentCode: Boolean(departmentCode),
      hasPhysicianCode: Boolean(physicianCode),
      hasMedicalInformation: Boolean(medicalInformation),
      hasInsuranceCombinationNumber: Boolean(insuranceCombinationNumber),
      rawSensitiveFieldsExcluded: true,
    };
  });

  const targetReadyRows = sanitizedRows.filter((row) =>
    row.hasAcceptanceId &&
    row.hasPatientId &&
    row.hasAcceptanceDate &&
    row.hasAcceptanceTime &&
    row.hasDepartmentCode &&
    row.hasPhysicianCode &&
    row.hasInsuranceCombinationNumber);

  const apiResult = readFirst(source, ['apiResult', 'Api_Result']);
  const httpStatus = Number(source.httpStatus || source.status || 0) || 0;
  const transportStatusClass = httpStatus ? `${Math.floor(httpStatus / 100)}xx` : 'not_observed';
  return {
    apiResultClass: apiResult ? (zeroLike(apiResult) ? 'zero' : 'nonzero') : 'not_observed',
    transportStatusClass,
    sourceRowCount: rows.length,
    sanitizedRowCount: sanitizedRows.length,
    targetReadyRowCount: targetReadyRows.length,
    targetReady: targetReadyRows.length > 0,
    rows: sanitizedRows,
    rawSensitiveFieldsExcluded: true,
    clientProvidedIdentifiersTrusted: false,
    serverDerivedAuthorityRequired: true,
  };
};

export const buildAcceptmodTargetInventoryDryRunSummary = ({ runId, commandGate, sourceSummary }) => {
  const inventory = sourceSummary ? sanitizeAcceptlstInventoryResponse(sourceSummary) : null;
  return {
    schemaVersion: 1,
    runId,
    workOrder: 'ACCEPTMODV2',
    taskId: 'ACCEPTMODV2_RN02_03_04_TARGET_INVENTORY',
    contract: ACCEPTMOD_TARGET_INVENTORY_CONTRACT,
    endpoint: ACCEPTMOD_TARGET_INVENTORY_ENDPOINT,
    orcaEndpoint: ACCEPTMOD_TARGET_INVENTORY_ORCA_ENDPOINT,
    requestClass: `acceptlstv2_class_${commandGate.options.classCode}_target_inventory_no_live_contract`,
    method: 'POST',
    serializer: 'acceptlstreq_xml2_sanitized_no_live_contract',
    parser: 'acceptlstres_allowlisted_presence_flags_and_hashes_only',
    sanitizer: 'drop_patient_names_insurance_numbers_and_raw_orca_body',
    commandGate: {
      ok: commandGate.ok,
      blockers: commandGate.blockers,
    },
    noLivePacket: {
      classCode: commandGate.options.classCode,
      acceptanceDate: commandGate.options.acceptanceDate || '',
      requiredServerDerivedFields: [
        'Acceptance_Id',
        'Patient_ID',
        'Acceptance_Date',
        'Acceptance_Time',
        'Department_Code',
        'Physician_Code',
        'Insurance_Combination_Number',
      ],
      clientProvidedIdentifiersTrusted: false,
      endpointSpecificCompletionEvidenceRequired: true,
      http2xxAloneIsNotSuccess: true,
      apiResultZeroAloneIsNotSuccess: true,
    },
    inventory,
    readOnlyTrialOrca: {
      executed: false,
      mutation: false,
      businessSuccessClassification: 'not_applicable_no_live_contract_only',
    },
    liveTrialOrca: {
      executed: false,
      businessAccepted: false,
      businessSuccessClassification: 'not_applicable_no_live_contract_only',
    },
    credentialsCaptured: false,
    diagnosticArtifactsCaptured: false,
    rawArtifactsCommittedOrPackaged: false,
    rawOrcaBodiesCaptured: false,
    patientInsuranceDetailsCaptured: false,
    claimBoundary:
      'No-live acceptlstv2 target inventory wrapper/sanitizer contract only; not server-derived target proof, RN02/RN03/RN04 live readiness, acceptmodv2 mutation success, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.',
  };
};
