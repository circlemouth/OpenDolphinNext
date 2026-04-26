import './orca-env.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { loadPhase4Payload } from './phase4-medicalmodv2-safe-evidence.mjs';
import { resolveTrialReadonlyConfig } from './phase4-master-validity-evidence.mjs';

export const BASE_CHARGE_FIRST_VISIT_CONTRACT = 'phase4-base-charge-first-visit-sanitized-readonly';
export const BASE_CHARGE_WORKFLOW = 'base-charge';
export const BASE_CHARGE_ENTITY = 'baseChargeOrder';
export const BASE_CHARGE_CLAIM007_CLASS = '110';
export const BASE_CHARGE_CANDIDATE_CODE = '111000110';
export const BASE_CHARGE_TARGET_PATIENT_ID = '00001';
export const ACCEPTMOD_READONLY_REQUEST_NUMBER = '00';

const VALUE_FLAGS = new Set([
  '--payload',
  '--payload-sha256',
  '--artifact-dir',
  '--patient-id',
  '--acceptance-date',
]);
const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--execute-readonly',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
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
const sha256Text = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');

export const parseBaseChargeFirstVisitArgs = (argv) => {
  const options = {
    dryRun: false,
    executeReadonly: false,
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
      if (arg === '--payload') options.payload = value;
      if (arg === '--payload-sha256') options.payloadSha256 = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      if (arg === '--patient-id') options.patientId = value;
      if (arg === '--acceptance-date') options.acceptanceDate = value;
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
  return { options, errors };
};

const normalizeDate = (value) => {
  const digits = normalize(value).replace(/[^0-9]/g, '');
  return digits.length === 8 ? digits : '';
};

const tokyoDateDigits = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/[^0-9]/g, '');

const extractCandidateCode = (payload) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const direct = rows.find((row) => row?.entity === BASE_CHARGE_ENTITY || row?.role === 'baseCharge');
  const code = normalize(direct?.code ?? direct?.orcaCode ?? direct?.claimCode);
  if (code) return code;
  const medicalInformation = Array.isArray(payload?.medicalInformation) ? payload.medicalInformation : [];
  const baseCharge = medicalInformation.find((row) => row?.entity === BASE_CHARGE_ENTITY);
  const medicationCode = normalize(baseCharge?.medications?.[0]?.code);
  if (medicationCode) return medicationCode;
  return normalize(payload?.candidateCode ?? payload?.code ?? payload?.orderCode);
};

const extractClaim007Class = (payload) => {
  const medicalInformation = Array.isArray(payload?.medicalInformation) ? payload.medicalInformation : [];
  const baseCharge = medicalInformation.find((row) => row?.entity === BASE_CHARGE_ENTITY);
  return normalize(baseCharge?.medicalClass ?? payload?.claim007Class ?? payload?.claimClass);
};

export const validateBaseChargeFirstVisitCommand = ({ argv, env = process.env, cwd = process.cwd() }) => {
  const { options, errors } = parseBaseChargeFirstVisitArgs(argv);
  const blockers = [...errors];
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (options.dryRun === options.executeReadonly) {
    blockers.push('exactly one of --dry-run or --execute-readonly is required');
  }
  const patientId = normalize(options.patientId || BASE_CHARGE_TARGET_PATIENT_ID);
  if (patientId !== BASE_CHARGE_TARGET_PATIENT_ID) blockers.push('target patient must be 00001 for this checkpoint');
  const acceptanceDate = normalizeDate(options.acceptanceDate || env.QA_ACCEPTANCE_DATE || tokyoDateDigits());
  if (!acceptanceDate) blockers.push('--acceptance-date must resolve to YYYYMMDD');

  let payloadEvidence = null;
  try {
    const payloadPath = options.payload ? path.resolve(cwd, options.payload) : undefined;
    const loaded = loadPhase4Payload({ payloadPath });
    if (options.payloadSha256 && loaded.sha256 !== options.payloadSha256) {
      blockers.push('payload sha256 mismatch');
    }
    const workflow = normalize(loaded.payload?.workflow ?? loaded.payload?.workflowId);
    const entity = normalize(loaded.payload?.entity);
    const claim007Class = extractClaim007Class(loaded.payload);
    const candidateCode = extractCandidateCode(loaded.payload);
    const requestNumber = normalize(loaded.payload?.requestNumber ?? loaded.payload?.Request_Number);
    const classCode = normalize(loaded.payload?.classCode);
    if (workflow && workflow !== BASE_CHARGE_WORKFLOW) blockers.push('payload workflow is not base-charge');
    if (entity && entity !== BASE_CHARGE_ENTITY) blockers.push('payload entity is not baseChargeOrder');
    if (claim007Class && claim007Class !== BASE_CHARGE_CLAIM007_CLASS) {
      blockers.push('payload claim007 class is not 110');
    }
    if (requestNumber && requestNumber !== '01') blockers.push('payload medicalmodv2 request number is not 01');
    if (classCode && classCode !== '01') blockers.push('payload medicalmodv2 class code is not 01');
    if (candidateCode && candidateCode !== BASE_CHARGE_CANDIDATE_CODE) {
      blockers.push('payload candidate code is not 111000110');
    }
    payloadEvidence = {
      sha256: loaded.sha256,
      bytes: loaded.bytes,
      workflow: workflow || BASE_CHARGE_WORKFLOW,
      entity: entity || BASE_CHARGE_ENTITY,
      claim007Class: claim007Class || BASE_CHARGE_CLAIM007_CLASS,
      candidateCode: candidateCode || BASE_CHARGE_CANDIDATE_CODE,
    };
  } catch {
    blockers.push('payload could not be loaded as JSON');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    options: { ...options, patientId, acceptanceDate },
    payloadEvidence,
    contract: BASE_CHARGE_FIRST_VISIT_CONTRACT,
    requestNumber: ACCEPTMOD_READONLY_REQUEST_NUMBER,
    rawPayloadStored: false,
    rawOrcaBodyStored: false,
    credentialsCaptured: false,
    rawArtifactsCaptured: false,
  };
};

const escapeXml = (value) =>
  normalize(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const buildAcceptmodReadonlyXml = ({ patientId, acceptanceDate }) =>
  '<data><acceptreq>' +
  `<Request_Number>${ACCEPTMOD_READONLY_REQUEST_NUMBER}</Request_Number>` +
  `<Patient_ID>${escapeXml(patientId)}</Patient_ID>` +
  `<Acceptance_Date>${escapeXml(acceptanceDate)}</Acceptance_Date>` +
  '</acceptreq></data>';

const tagText = (xml, tagName) => {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = String(xml ?? '').match(pattern);
  return normalize(match?.[1]?.replace(/<[^>]+>/g, ''));
};

const classifyHttpStatus = (status) => {
  const numeric = Number(status) || 0;
  if (numeric >= 200 && numeric < 300) return '2xx';
  if (numeric >= 300 && numeric < 400) return '3xx';
  if (numeric >= 400 && numeric < 500) return '4xx';
  if (numeric >= 500 && numeric < 600) return '5xx';
  return 'not_observed';
};

const classifyApiResult = (apiResult) => {
  const normalized = normalize(apiResult).toUpperCase();
  if (!normalized) return 'missing';
  if (/^0+$/.test(normalized)) return 'success_zero';
  if (normalized === '60') return 'no_existing_acceptance';
  if (normalized === '10') return 'patient_not_found';
  if (normalized === '16') return 'duplicate_or_already_accepted';
  if (/^\d+$/.test(normalized)) return 'nonzero_numeric';
  return 'other_present';
};

export const sanitizeAcceptmodReadonlyResult = ({ httpStatus, xml }) => {
  const apiResult = tagText(xml, 'Api_Result');
  const apiResultClass = classifyApiResult(apiResult);
  const acceptanceIdPresent = Boolean(tagText(xml, 'Acceptance_Id'));
  const acceptanceInfoPresent = /<Acceptance_Info(?:\s[^>]*)?>/i.test(String(xml ?? ''));
  const patientInfoPresent = /<Patient_Information(?:\s[^>]*)?>/i.test(String(xml ?? ''));
  const requestNumber = tagText(xml, 'Request_Number') || ACCEPTMOD_READONLY_REQUEST_NUMBER;
  const observedRequest00 = requestNumber === ACCEPTMOD_READONLY_REQUEST_NUMBER;
  const httpStatusClass = classifyHttpStatus(httpStatus);
  const firstVisitCompatible =
    httpStatusClass === '2xx' &&
    observedRequest00 &&
    apiResultClass === 'no_existing_acceptance' &&
    !acceptanceIdPresent &&
    !acceptanceInfoPresent;
  const classification = firstVisitCompatible
    ? 'first_visit_compatible_no_existing_acceptance'
    : apiResultClass === 'success_zero' && (acceptanceIdPresent || acceptanceInfoPresent)
      ? 'existing_acceptance_not_first_visit_compatible'
      : apiResultClass === 'patient_not_found'
        ? 'patient_not_found'
        : apiResultClass === 'duplicate_or_already_accepted'
          ? 'duplicate_or_already_accepted'
          : httpStatusClass !== '2xx'
            ? 'transport_not_2xx'
            : 'not_verified_or_not_first_visit_compatible';
  const sanitized = {
    endpoint: '/api/orca11/acceptmodv2',
    requestClass: 'acceptmodv2_readonly_request_00',
    requestNumber: ACCEPTMOD_READONLY_REQUEST_NUMBER,
    observedRequest00,
    httpStatusClass,
    apiResultClass,
    classification,
    firstVisitCompatible,
    mutationSuccess: false,
    acceptanceEvidencePresent: acceptanceIdPresent || acceptanceInfoPresent,
    patientInfoPresent,
    rawOrcaBodyStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
  return {
    ...sanitized,
    evidenceHash: sha256Text(JSON.stringify(sanitized)),
  };
};

const endpointUrl = (baseUrl) => new URL('/api/orca11/acceptmodv2', baseUrl).toString();

export const executeReadonlyFirstVisitCheck = async ({ config, patientId, acceptanceDate, fetchImpl = fetch }) => {
  const auth = Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64');
  const response = await fetchImpl(endpointUrl(config.baseUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/xml',
      'Content-Type': 'application/xml',
      Authorization: `Basic ${auth}`,
    },
    body: buildAcceptmodReadonlyXml({ patientId, acceptanceDate }),
  });
  const xml = await response.text();
  return sanitizeAcceptmodReadonlyResult({ httpStatus: response.status, xml });
};

export const buildBaseChargeFirstVisitSummary = ({ guard, runId, traceId, readonlyResult, verdict, blocker }) => {
  const accepted = readonlyResult?.firstVisitCompatible === true;
  return {
    schemaVersion: 1,
    runId,
    traceId,
    taskId: 'RWO-06G_READONLY_FIRST_VISIT_CHECK',
    workOrder: 'RWO-06G',
    contract: BASE_CHARGE_FIRST_VISIT_CONTRACT,
    verdict: verdict || (accepted ? 'readonly_first_visit_compatible' : 'readonly_first_visit_not_validated'),
    blocker: blocker || (accepted ? '' : 'first_visit_compatibility_not_validated'),
    endpoint: '/api/orca11/acceptmodv2',
    requestClass: 'acceptmodv2_readonly_request_00',
    target: {
      patientId: guard?.options?.patientId || BASE_CHARGE_TARGET_PATIENT_ID,
      acceptanceDate: guard?.options?.acceptanceDate || '',
    },
    payload: {
      path: guard?.options?.payload || '',
      sha256: guard?.payloadEvidence?.sha256 || '',
      bytes: guard?.payloadEvidence?.bytes || 0,
      workflow: guard?.payloadEvidence?.workflow || BASE_CHARGE_WORKFLOW,
      entity: guard?.payloadEvidence?.entity || BASE_CHARGE_ENTITY,
      claim007Class: guard?.payloadEvidence?.claim007Class || BASE_CHARGE_CLAIM007_CLASS,
      candidateCode: guard?.payloadEvidence?.candidateCode || BASE_CHARGE_CANDIDATE_CODE,
    },
    commandGuard: {
      ok: guard?.ok === true,
      blockers: guard?.blockers || [],
      dryRun: guard?.options?.dryRun === true,
      executeReadonly: guard?.options?.executeReadonly === true,
      sanitizedEvidenceOnly: guard?.options?.sanitizedEvidenceOnly === true,
      disableBrowserArtifacts: guard?.options?.disableBrowserArtifacts === true,
    },
    readonlyResult: readonlyResult || null,
    successCriteria: {
      readOnlyOnly: true,
      firstVisitCompatible: accepted,
      mutationSuccess: false,
      http200AloneIsNotBusinessSuccess: true,
      requestNumber00IsNotMutationSuccess: true,
    },
    liveTrialOrca: {
      executed: false,
      businessSuccessClassification: accepted
        ? 'readonly_first_visit_compatible_precondition_only'
        : 'not_applicable_or_readonly_first_visit_not_validated',
      businessAccepted: false,
    },
    claimBoundary:
      'Sanitized acceptmodv2 Request_Number=00 read-only first-visit compatibility evidence only; not baseChargeOrder Trial acceptance, acceptmodv2 mutation success, fullflow success, production ORCA readiness, S3/object-storage readiness, rollback rehearsal, owner final GO/NO-GO, or final release readiness.',
    credentialsCaptured: false,
    diagnosticArtifactsCaptured: false,
    rawArtifactsCommittedOrPackaged: false,
    rawOrcaBodyStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const writeBaseChargeFirstVisitSummary = ({ artifactDir, summary }) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, 'base-charge-first-visit-readonly-summary.sanitized.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
  return { jsonPath };
};

export { resolveTrialReadonlyConfig };
