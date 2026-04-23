import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PHASE4_WRAPPER_CONTRACT = 'phase4-safe-medicalmodv2-sanitized-only';
export const PHASE4_ENDPOINT_PATH = '/api/orca/official/chart-support/medical-mod-v2';
export const PHASE4_REQUEST_CLASS = 'medicalmodv2';
export const PHASE4_TARGET_PATIENT_ID = '00001';
export const PHASE4_TARGET_CANDIDATE_ID = '00001';
export const PHASE4_ALLOWED_REQUEST_NUMBER = '01';
export const PHASE4_ALLOWED_CLASS_CODE = '01';
export const PHASE4_FORBIDDEN_REQUEST_NUMBERS = ['02', '03', '04'];

const FORBIDDEN_FLAGS = new Set([
  '--phase3',
  '--run-phase3',
  '--acceptmodv2',
  '--fullflow',
  '--run-fullflow',
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

const FORBIDDEN_ENV = [
  ['QA_RECORD_HAR', '1', 'HAR recording is forbidden'],
  ['QA_TRACE', '1', 'trace recording is forbidden'],
  ['QA_VIDEO', '1', 'video recording is forbidden'],
  ['QA_SCREENSHOT', '1', 'screenshot recording is forbidden'],
  ['QA_SCREENSHOTS', '1', 'screenshot recording is forbidden'],
  ['QA_RAW_NETWORK', '1', 'raw network capture is forbidden'],
  ['QA_CAPTURE_NETWORK_RAW', '1', 'raw network capture is forbidden'],
  ['QA_PHASE3_APPROVED_MODE', '1', 'Phase 3 mode is forbidden'],
  ['QA_FULLFLOW', '1', 'fullflow is forbidden'],
  ['QA_ALLOW_LOCAL_OPTION_INJECTION', '1', 'local option injection is forbidden'],
];

const VALUE_FLAGS = new Set(['--payload', '--payload-sha256', '--artifact-dir']);
const BOOLEAN_FLAGS = new Set([
  '--dry-run',
  '--mock',
  '--execute-approved-phase4',
  '--sanitized-evidence-only',
  '--disable-browser-artifacts',
  '--phase4-only',
]);

const SENSITIVE_MESSAGE_PATTERN =
  /患者|保険|番号|氏名|住所|電話|記号|cookie|authorization|password|passwd|token|session|csrf|jsessionid/i;
const ZERO_API_RESULT_PATTERN = /^0+$/;

export const repoRootFromCwd = (cwd = process.cwd()) =>
  path.basename(cwd) === 'web-client' ? path.dirname(cwd) : cwd;

export const sha256Buffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

export const sha256File = (filePath) => sha256Buffer(fs.readFileSync(filePath));

export const parsePhase4SafeArgs = (argv) => {
  const options = {
    dryRun: false,
    mock: false,
    executeApprovedPhase4: false,
    sanitizedEvidenceOnly: false,
    disableBrowserArtifacts: false,
    phase4Only: false,
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
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--dry-run') options.dryRun = true;
      if (arg === '--mock') options.mock = true;
      if (arg === '--execute-approved-phase4') options.executeApprovedPhase4 = true;
      if (arg === '--sanitized-evidence-only') options.sanitizedEvidenceOnly = true;
      if (arg === '--disable-browser-artifacts') options.disableBrowserArtifacts = true;
      if (arg === '--phase4-only') options.phase4Only = true;
      continue;
    }
    errors.push(`unknown flag: ${arg}`);
  }

  return { options, errors };
};

const normalizeCode = (value) => String(value ?? '').trim();

const normalizeRequestNumber = (payload) => normalizeCode(payload?.requestNumber || PHASE4_ALLOWED_REQUEST_NUMBER);

const normalizeClassCode = (payload) => {
  const raw = normalizeCode(payload?.classCode || PHASE4_ALLOWED_CLASS_CODE);
  if (raw.length === 1) return `0${raw}`;
  if (raw.toLowerCase().startsWith('class=')) return normalizeClassCode({ classCode: raw.slice('class='.length) });
  return raw;
};

const readPayloadBuffer = (payloadPath) => {
  if (!payloadPath) {
    return Buffer.from(JSON.stringify(buildSyntheticPayloadFixture()), 'utf8');
  }
  return fs.readFileSync(payloadPath);
};

export const buildSyntheticPayloadFixture = () => ({
  classCode: PHASE4_ALLOWED_CLASS_CODE,
  requestNumber: PHASE4_ALLOWED_REQUEST_NUMBER,
  encounterContext: {
    patientId: PHASE4_TARGET_PATIENT_ID,
    visitDate: '2026-04-22',
    departmentCode: '01',
    physicianCode: '10001',
    insuranceCombinationNumber: 'SYNTHETIC',
    voucherNumber: 'SYNTHETIC',
    sequentialNumber: 'SYNTHETIC',
  },
  includeInitialConsultation: false,
  medicalInformation: [
    {
      entity: 'treatmentOrder',
      medicalClass: '700',
      medicalClassNumber: '1',
      medications: [
        {
          code: 'SYNTHETIC',
          number: '1',
        },
      ],
    },
  ],
});

export const loadPhase4Payload = ({ payloadPath } = {}) => {
  const buffer = readPayloadBuffer(payloadPath);
  const sha256 = sha256Buffer(buffer);
  const payload = JSON.parse(buffer.toString('utf8'));
  return { payload, sha256, bytes: buffer.length };
};

export const summarizePayload = (payload) => {
  const encounter = payload?.encounterContext ?? {};
  const requestNumber = normalizeRequestNumber(payload);
  const classCode = normalizeClassCode(payload);
  const medicalInformation = Array.isArray(payload?.medicalInformation) ? payload.medicalInformation : [];
  const medications = medicalInformation.flatMap((entry) => Array.isArray(entry?.medications) ? entry.medications : []);
  const entityKinds = [...new Set(medicalInformation.map((entry) => normalizeCode(entry?.entity)).filter(Boolean))].sort();
  const medicalClasses = [...new Set(medicalInformation.map((entry) => normalizeCode(entry?.medicalClass)).filter(Boolean))].sort();
  return {
    patientIdMatched: normalizeCode(encounter?.patientId || payload?.patientId) === PHASE4_TARGET_PATIENT_ID,
    candidateIdMatched: true,
    requestNumber,
    classCode,
    requiredFieldsPresent: {
      visitDate: Boolean(normalizeCode(encounter?.visitDate || payload?.performDate)),
      departmentCode: Boolean(normalizeCode(encounter?.departmentCode || payload?.departmentCode)),
      physicianCode: Boolean(normalizeCode(encounter?.physicianCode || payload?.physicianCode)),
      insuranceCombinationNumber: Boolean(normalizeCode(encounter?.insuranceCombinationNumber || payload?.insuranceCombinationNumber)),
      voucherNumber: Boolean(normalizeCode(encounter?.voucherNumber || payload?.voucherNumber)),
      sequentialNumber: Boolean(normalizeCode(encounter?.sequentialNumber || payload?.sequentialNumber)),
    },
    medicalInformation: {
      groupCount: medicalInformation.length,
      medicationCount: medications.length,
      entityKinds,
      medicalClasses,
      unsupportedPhysiologyOrderPresent: entityKinds.includes('physiologyOrder'),
    },
    rawPayloadStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const validatePhase4Payload = ({ payload, payloadSha256, expectedPayloadSha256 = '' }) => {
  const summary = summarizePayload(payload);
  const blockers = [];
  if (!summary.patientIdMatched) blockers.push(`target patient must be ${PHASE4_TARGET_PATIENT_ID}`);
  if (summary.requestNumber !== PHASE4_ALLOWED_REQUEST_NUMBER) {
    blockers.push(`requestNumber must be ${PHASE4_ALLOWED_REQUEST_NUMBER}`);
  }
  if (PHASE4_FORBIDDEN_REQUEST_NUMBERS.includes(summary.requestNumber)) {
    blockers.push('Request_Number 02/03/04 is forbidden for this Phase 4 wrapper');
  }
  if (summary.classCode !== PHASE4_ALLOWED_CLASS_CODE) {
    blockers.push(`classCode must be ${PHASE4_ALLOWED_CLASS_CODE}`);
  }
  for (const [field, present] of Object.entries(summary.requiredFieldsPresent)) {
    if (!present) blockers.push(`encounterContext.${field} is required`);
  }
  if (summary.medicalInformation.unsupportedPhysiologyOrderPresent) {
    blockers.push('physiologyOrder is not supported by medicalmodv2 carrier');
  }
  if (summary.medicalInformation.groupCount === 0 || summary.medicalInformation.medicationCount === 0) {
    blockers.push('medicalInformation with at least one medication is required');
  }
  if (expectedPayloadSha256 && payloadSha256 !== expectedPayloadSha256) {
    blockers.push('payload sha256 mismatch');
  }
  return {
    ok: blockers.length === 0,
    blockers,
    summary,
  };
};

export const classifyMessageCategory = (message) => {
  const value = normalizeCode(message);
  if (!value) return 'none';
  if (SENSITIVE_MESSAGE_PATTERN.test(value)) return 'present_redacted_sensitive_shape';
  if (/正常|完了|ok|success/i.test(value)) return 'ok_like';
  if (/警告|warning/i.test(value)) return 'warning_like';
  if (/error|エラー|失敗|不可|reject/i.test(value)) return 'error_like';
  return 'present_redacted';
};

export const classifyPhase4BusinessResult = ({ httpStatus, responseJson }) => {
  const apiResult = normalizeCode(responseJson?.apiResult ?? responseJson?.Api_Result).toUpperCase();
  const httpOk = Number(httpStatus) >= 200 && Number(httpStatus) < 300;
  const apiOk = responseJson?.apiOk === true || ZERO_API_RESULT_PATTERN.test(apiResult);
  const completionEvidence = {
    informationTimestampPresent: Boolean(normalizeCode(responseJson?.informationDate) && normalizeCode(responseJson?.informationTime)),
    medicalUidPresent: Boolean(normalizeCode(responseJson?.medicalUid)),
    invoiceNumberPresent: Boolean(normalizeCode(responseJson?.invoiceNumber)),
    dataIdPresent: Boolean(normalizeCode(responseJson?.dataId)),
  };
  const completionEvidencePresent = Object.values(completionEvidence).some(Boolean);

  if (!httpStatus) return { responseClassification: 'notObserved', businessAccepted: false, completionEvidence };
  if (!httpOk) return { responseClassification: 'transportRejected', businessAccepted: false, completionEvidence };
  if (!apiOk) return { responseClassification: 'businessRejected', businessAccepted: false, completionEvidence };
  if (!completionEvidencePresent) return { responseClassification: 'notVerified', businessAccepted: false, completionEvidence };
  return { responseClassification: 'businessAccepted', businessAccepted: true, completionEvidence };
};

export const sanitizePhase4Response = ({ httpStatus, responseJson }) => {
  const business = classifyPhase4BusinessResult({ httpStatus, responseJson });
  const warnings = Array.isArray(responseJson?.medicalWarnings) ? responseJson.medicalWarnings : [];
  return {
    httpStatus: Number(httpStatus) || 0,
    apiResult: normalizeCode(responseJson?.apiResult ?? responseJson?.Api_Result),
    apiOk: responseJson?.apiOk === true,
    ok: responseJson?.ok === true,
    apiResultMessageCategory: classifyMessageCategory(responseJson?.apiResultMessage ?? responseJson?.Api_Result_Message),
    warningCount: warnings.length,
    responseClassification: business.responseClassification,
    businessAccepted: business.businessAccepted,
    completionEvidence: business.completionEvidence,
    rawResponseBodyStored: false,
    rawApiResultMessageStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const summarizeRuntimeReadiness = ({ healthStatus = 0, readinessStatus = 0 } = {}) => {
  const healthHttpStatus = Number(healthStatus) || 0;
  const readinessHttpStatus = Number(readinessStatus) || 0;
  const healthOk = healthHttpStatus >= 200 && healthHttpStatus < 300;
  const readinessOk = readinessHttpStatus >= 200 && readinessHttpStatus < 300;
  const blockers = [];
  if (!healthOk) blockers.push('backend health endpoint is not reachable');
  if (!readinessOk) blockers.push('backend readiness endpoint is not ready');
  return {
    ok: healthOk && readinessOk,
    healthHttpStatus,
    readinessHttpStatus,
    blockers,
    rawReadinessBodyStored: false,
    rawHealthBodyStored: false,
  };
};

export const validatePhase4SafeCommand = ({
  argv = [],
  env = process.env,
  cwd = process.cwd(),
  now = new Date(),
} = {}) => {
  const repoRoot = repoRootFromCwd(cwd);
  const { options, errors } = parsePhase4SafeArgs(argv);
  const blockers = [...errors];
  const modeCount = [options.dryRun, options.mock, options.executeApprovedPhase4].filter(Boolean).length;
  if (modeCount !== 1) {
    blockers.push('exactly one of --dry-run, --mock, or --execute-approved-phase4 is required');
  }
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.phase4Only) blockers.push('--phase4-only is required');
  if (options.executeApprovedPhase4 && !options.payload) blockers.push('--payload is required for live Phase 4 execution');
  if (options.executeApprovedPhase4 && !options.payloadSha256) {
    blockers.push('--payload-sha256 is required for live Phase 4 execution');
  }

  for (const [key, forbiddenValue, reason] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`${key}=${forbiddenValue}: ${reason}`);
  }

  let payload = null;
  let payloadSha256 = '';
  let payloadBytes = 0;
  let payloadGate = {
    ok: false,
    blockers: ['payload was not parsed'],
    summary: summarizePayload(buildSyntheticPayloadFixture()),
  };
  try {
    const loaded = loadPhase4Payload({ payloadPath: options.payload });
    payload = loaded.payload;
    payloadSha256 = loaded.sha256;
    payloadBytes = loaded.bytes;
    payloadGate = validatePhase4Payload({
      payload,
      payloadSha256,
      expectedPayloadSha256: options.payloadSha256 ?? '',
    });
    blockers.push(...payloadGate.blockers);
  } catch (error) {
    blockers.push(`payload cannot be parsed: ${String(error)}`);
  }

  const ok = blockers.length === 0;
  const evidence = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    commandContract: PHASE4_WRAPPER_CONTRACT,
    endpoint: PHASE4_ENDPOINT_PATH,
    requestClass: PHASE4_REQUEST_CLASS,
    target: {
      candidateId: PHASE4_TARGET_CANDIDATE_ID,
      patientId: PHASE4_TARGET_PATIENT_ID,
      candidateOnly00001: true,
    },
    verdict: ok ? 'accepted' : 'rejected_before_live_orca',
    dryRun: options.dryRun === true,
    mock: options.mock === true,
    liveTrialAction: options.executeApprovedPhase4 && ok ? 'approved_to_execute_by_command_contract' : 'not_run',
    phase3: 'not_run',
    fullflow: 'not_run',
    browserNetworkArtifactMode: 'disabled',
    sanitizedEvidenceOnly: true,
    rawSensitiveFieldsExcluded: true,
    payload: {
      sha256: payloadSha256,
      bytes: payloadBytes,
      pathRecorded: false,
      rawPayloadStored: false,
      summary: payloadGate.summary,
    },
    requestSemantics: {
      requestNumber01Only: true,
      requestNumber02To04Forbidden: true,
      classCode01Only: true,
      http200AloneIsNotBusinessSuccess: true,
      apiResultZeroAloneIsNotBusinessSuccess: true,
      completionEvidenceRequired: true,
    },
    guard: {
      ok,
      blockers,
    },
  };

  return {
    ok,
    options,
    blockers,
    repoRoot,
    payload,
    payloadSha256,
    payloadBytes,
    payloadGate,
    evidence,
  };
};
