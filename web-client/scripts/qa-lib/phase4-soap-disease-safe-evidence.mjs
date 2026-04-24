import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const SOAP_DISEASE_WRAPPER_CONTRACT = 'phase4-safe-subjectivesv2-diseasev3-no-live-sanitized-only';
export const SOAP_DISEASE_TARGET_PATIENT_ID = '00001';
export const SOAP_DISEASE_FORBIDDEN_REQUEST_NUMBERS = ['02', '03', '04'];

export const SOAP_DISEASE_ENDPOINTS = {
  subjectivesv2: {
    workflowId: 'rwo06b-subjectivesv2-no-live-v1',
    requestClass: 'subjectivesv2',
    endpoint: '/orca25/subjectivesv2',
    localProductRoute: '/api/local/charts/subjectives',
    allowedOperation: 'create',
    payloadRequiredFields: ['patientId', 'performDate', 'subjectivesCode', 'subjectivesDetailRecord'],
    fixtureResponseRoot: 'subjectivesmodres',
    completionEvidenceKeys: ['subjectivesCompletionMarkerPresent'],
  },
  diseasev3: {
    workflowId: 'rwo06b-diseasev3-create-no-live-v1',
    requestClass: 'diseasev3',
    endpoint: '/orca22/diseasev3',
    localProductRoute: '/api/local/diagnoses',
    allowedOperation: 'create',
    payloadRequiredFields: ['patientId', 'performDate', 'diagnosisInformation', 'diseaseInformation'],
    fixtureResponseRoot: 'diseaseres',
    completionEvidenceKeys: ['diseaseMutationMarkerPresent'],
  },
};

const FORBIDDEN_FLAGS = new Set([
  '--execute',
  '--execute-live',
  '--execute-approved-phase4',
  '--live',
  '--phase3',
  '--run-phase3',
  '--acceptmodv2',
  '--medicalmodv2',
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
  '--response-xml',
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
];

const VALUE_FLAGS = new Set(['--workflow', '--payload', '--payload-sha256', '--fixture', '--artifact-dir']);
const BOOLEAN_FLAGS = new Set(['--dry-run', '--mock', '--sanitized-evidence-only', '--disable-browser-artifacts', '--phase4-only']);
const ZERO_API_RESULT_PATTERN = /^0+$/;
const SENSITIVE_MESSAGE_PATTERN =
  /患者|保険|番号|氏名|住所|電話|記号|cookie|authorization|password|passwd|token|session|csrf|jsessionid/i;

const normalizeCode = (value) => String(value ?? '').trim();

export const repoRootFromCwd = (cwd = process.cwd()) =>
  path.basename(cwd) === 'web-client' ? path.dirname(cwd) : cwd;

export const sha256Buffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

export const parseSoapDiseaseSafeArgs = (argv) => {
  const options = {
    dryRun: false,
    mock: false,
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
      if (arg === '--workflow') options.workflow = value;
      if (arg === '--payload') options.payload = value;
      if (arg === '--payload-sha256') options.payloadSha256 = value;
      if (arg === '--fixture') options.fixture = value;
      if (arg === '--artifact-dir') options.artifactDir = value;
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      if (arg === '--dry-run') options.dryRun = true;
      if (arg === '--mock') options.mock = true;
      if (arg === '--sanitized-evidence-only') options.sanitizedEvidenceOnly = true;
      if (arg === '--disable-browser-artifacts') options.disableBrowserArtifacts = true;
      if (arg === '--phase4-only') options.phase4Only = true;
      continue;
    }
    errors.push(`unknown flag: ${arg}`);
  }

  return { options, errors };
};

const endpointContract = (workflow) => SOAP_DISEASE_ENDPOINTS[normalizeCode(workflow)] ?? null;

const readJsonPayload = (payloadPath) => {
  if (!payloadPath) return { payload: {}, sha256: '', bytes: 0 };
  const buffer = fs.readFileSync(payloadPath);
  return {
    payload: JSON.parse(buffer.toString('utf8')),
    sha256: sha256Buffer(buffer),
    bytes: buffer.length,
  };
};

export const summarizeSoapDiseasePayload = ({ workflow, payload }) => {
  const contract = endpointContract(workflow);
  const diseaseInformation = Array.isArray(payload?.diseaseInformation) ? payload.diseaseInformation : [];
  const requestNumber = normalizeCode(payload?.requestNumber ?? payload?.Request_Number);
  return {
    endpointMatched: Boolean(contract) && normalizeCode(payload?.endpoint) === contract.endpoint,
    patientIdMatched: normalizeCode(payload?.patientId) === SOAP_DISEASE_TARGET_PATIENT_ID,
    requestNumber,
    requestNumber02To04Present: SOAP_DISEASE_FORBIDDEN_REQUEST_NUMBERS.includes(requestNumber),
    operation: contract?.allowedOperation ?? 'unknown',
    requiredFieldsPresent: Object.fromEntries(
      (contract?.payloadRequiredFields ?? []).map((field) => [field, payload?.[field] !== undefined && payload?.[field] !== null && normalizeCode(payload?.[field]) !== '']),
    ),
    disease: {
      recordCount: diseaseInformation.length,
      createOnly: normalizeCode(workflow) === 'diseasev3',
      updateDeleteNotAuthorized: true,
    },
    subjectives: {
      codePresent: Boolean(normalizeCode(payload?.subjectivesCode)),
      detailRecordPresent: Boolean(normalizeCode(payload?.subjectivesDetailRecord)),
    },
    rawPayloadStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const validateSoapDiseasePayload = ({ workflow, payload, payloadSha256 = '', expectedPayloadSha256 = '' }) => {
  const contract = endpointContract(workflow);
  const summary = summarizeSoapDiseasePayload({ workflow, payload });
  const blockers = [];

  if (!contract) {
    blockers.push(`--workflow must be one of: ${Object.keys(SOAP_DISEASE_ENDPOINTS).join(', ')}`);
    return { ok: false, blockers, summary };
  }
  if (!summary.endpointMatched) blockers.push(`endpoint must be ${contract.endpoint}`);
  if (!summary.patientIdMatched) blockers.push(`target patient must be ${SOAP_DISEASE_TARGET_PATIENT_ID}`);
  if (summary.requestNumber02To04Present) {
    blockers.push('Request_Number 02/03/04 is forbidden for subjectivesv2/diseasev3 no-live wrappers');
  }
  if (normalizeCode(workflow) === 'diseasev3' && summary.requestNumber && summary.requestNumber !== '01') {
    blockers.push('diseasev3 no-live wrapper allows only create semantics; Request_Number must be absent or 01');
  }
  for (const [field, present] of Object.entries(summary.requiredFieldsPresent)) {
    if (!present) blockers.push(`${field} is required`);
  }
  if (normalizeCode(workflow) === 'diseasev3' && summary.disease.recordCount === 0) {
    blockers.push('diseaseInformation must include at least one create candidate');
  }
  if (expectedPayloadSha256 && payloadSha256 !== expectedPayloadSha256) {
    blockers.push('payload sha256 mismatch');
  }

  return { ok: blockers.length === 0, blockers, summary };
};

const extractXmlTag = (xml, tagName) => {
  const pattern = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*</${tagName}>`, 'i');
  const match = pattern.exec(xml);
  return normalizeCode(match?.[1]);
};

export const classifySoapDiseaseMessageCategory = (message) => {
  const value = normalizeCode(message);
  if (!value) return 'none';
  if (SENSITIVE_MESSAGE_PATTERN.test(value)) return 'present_redacted_sensitive_shape';
  if (/正常|完了|ok|success/i.test(value)) return 'ok_like';
  if (/警告|warning/i.test(value)) return 'warning_like';
  if (/error|エラー|失敗|不可|reject/i.test(value)) return 'error_like';
  return 'present_redacted';
};

export const parseSoapDiseaseStubResponse = ({ workflow, xml }) => {
  const contract = endpointContract(workflow);
  const rootTagPresent = Boolean(contract && new RegExp(`<${contract.fixtureResponseRoot}>`, 'i').test(xml));
  const apiResult = extractXmlTag(xml, 'Api_Result');
  const apiResultMessage = extractXmlTag(xml, 'Api_Result_Message');
  return {
    apiResult,
    apiResultZeroEquivalent: ZERO_API_RESULT_PATTERN.test(apiResult),
    apiResultMessageCategory: classifySoapDiseaseMessageCategory(apiResultMessage),
    rootTagPresent,
    completionEvidence: {
      subjectivesCompletionMarkerPresent: false,
      diseaseMutationMarkerPresent: false,
    },
    parserAmbiguous: !contract || !rootTagPresent || !apiResult,
    rawResponseBodyStored: false,
    rawApiResultMessageStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
};

export const classifySoapDiseaseBusinessResult = ({ httpStatus = 200, parsedResponse }) => {
  const httpOk = Number(httpStatus) >= 200 && Number(httpStatus) < 300;
  const completionEvidencePresent = Object.values(parsedResponse?.completionEvidence ?? {}).some(Boolean);
  if (!httpOk) return { responseClassification: 'transportRejected', businessAccepted: false };
  if (parsedResponse?.parserAmbiguous) return { responseClassification: 'parserAmbiguous', businessAccepted: false };
  if (!parsedResponse?.apiResultZeroEquivalent) return { responseClassification: 'businessRejected', businessAccepted: false };
  if (!completionEvidencePresent) return { responseClassification: 'notVerified', businessAccepted: false };
  return { responseClassification: 'businessAccepted', businessAccepted: true };
};

export const sanitizeSoapDiseaseResponse = ({ workflow, httpStatus = 200, xml = '' }) => {
  const parsedResponse = parseSoapDiseaseStubResponse({ workflow, xml });
  const business = classifySoapDiseaseBusinessResult({ httpStatus, parsedResponse });
  return {
    httpStatus: Number(httpStatus) || 0,
    ...parsedResponse,
    responseClassification: business.responseClassification,
    businessAccepted: business.businessAccepted,
  };
};

export const buildSoapDiseaseDuplicateCheckpointKey = ({ workflow, payloadSha256 }) => {
  const contract = endpointContract(workflow);
  const hash = normalizeCode(payloadSha256) || 'no-payload-sha256';
  return [
    'rwo06b',
    contract?.requestClass ?? 'unknown',
    contract?.workflowId ?? 'unknown-workflow',
    `target-${SOAP_DISEASE_TARGET_PATIENT_ID}`,
    `operation-${contract?.allowedOperation ?? 'unknown'}`,
    `payload-sha256-${hash}`,
  ].join(':');
};

export const validateSoapDiseaseSafeCommand = ({
  argv = [],
  env = process.env,
  cwd = process.cwd(),
  now = new Date(),
} = {}) => {
  const repoRoot = repoRootFromCwd(cwd);
  const { options, errors } = parseSoapDiseaseSafeArgs(argv);
  const blockers = [...errors];
  const modeCount = [options.dryRun, options.mock].filter(Boolean).length;
  if (modeCount !== 1) blockers.push('exactly one of --dry-run or --mock is required');
  if (!options.workflow) blockers.push('--workflow is required');
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (!options.phase4Only) blockers.push('--phase4-only is required');

  for (const [key, forbiddenValue, reason] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`${key}=${forbiddenValue}: ${reason}`);
  }

  let payload = {};
  let payloadSha256 = '';
  let payloadBytes = 0;
  let payloadGate = {
    ok: false,
    blockers: ['payload was not parsed'],
    summary: summarizeSoapDiseasePayload({ workflow: options.workflow, payload: {} }),
  };
  try {
    const loaded = readJsonPayload(options.payload);
    payload = loaded.payload;
    payloadSha256 = loaded.sha256;
    payloadBytes = loaded.bytes;
    payloadGate = validateSoapDiseasePayload({
      workflow: options.workflow,
      payload,
      payloadSha256,
      expectedPayloadSha256: options.payloadSha256 ?? '',
    });
    blockers.push(...payloadGate.blockers);
  } catch (error) {
    blockers.push(`payload cannot be parsed: ${String(error)}`);
  }

  let response = sanitizeSoapDiseaseResponse({ workflow: options.workflow, httpStatus: 0, xml: '' });
  if (options.fixture) {
    try {
      const xml = fs.readFileSync(options.fixture, 'utf8');
      response = sanitizeSoapDiseaseResponse({ workflow: options.workflow, httpStatus: 200, xml });
    } catch (error) {
      blockers.push(`fixture cannot be parsed: ${String(error)}`);
    }
  }

  const contract = endpointContract(options.workflow);
  const checkpointKey = buildSoapDiseaseDuplicateCheckpointKey({ workflow: options.workflow, payloadSha256 });
  const ok = blockers.length === 0;
  const evidence = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    commandContract: SOAP_DISEASE_WRAPPER_CONTRACT,
    workflow: normalizeCode(options.workflow),
    workflowId: contract?.workflowId ?? 'unknown',
    endpoint: contract?.endpoint ?? 'unknown',
    localProductRoute: contract?.localProductRoute ?? 'unknown',
    requestClass: contract?.requestClass ?? 'unknown',
    target: {
      patientId: SOAP_DISEASE_TARGET_PATIENT_ID,
      candidateOnly00001: true,
    },
    dryRun: options.dryRun === true,
    mock: options.mock === true,
    liveTrialAction: 'not_run_forbidden_by_contract',
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
    response,
    duplicateCheckpoint: {
      key: checkpointKey,
      status: 'not_checked_no_live',
      liveMutationPermittedWhenReady: false,
    },
    requestSemantics: {
      createOnly: true,
      updateDeleteNotAuthorized: true,
      requestNumber02To04Forbidden: true,
      http200AloneIsNotBusinessSuccess: true,
      apiResultZeroAloneIsNotBusinessSuccess: true,
      completionEvidenceRequired: true,
    },
    guard: {
      ok,
      blockers,
    },
    credentialsCaptured: false,
    rawArtifactsCaptured: false,
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
