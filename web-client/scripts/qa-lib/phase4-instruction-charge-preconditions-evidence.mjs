import './orca-env.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  PHASE4_ENDPOINT_PATH,
  PHASE4_REQUEST_CLASS,
  PHASE4_TARGET_PATIENT_ID,
  loadPhase4Payload,
  summarizeInstructionChargePreconditionNoLivePlan,
} from './phase4-medicalmodv2-safe-evidence.mjs';

export const INSTRUCTION_CHARGE_PRECONDITION_CONTRACT =
  'phase4-instruction-charge-preconditions-sanitized-readonly';
export const INSTRUCTION_CHARGE_ALLOWED_HOST = 'weborca-trial.orca.med.or.jp';

const VALUE_FLAGS = new Set(['--payload', '--payload-sha256', '--artifact-dir', '--base-date']);
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

const normalizeBaseDate = (value) => {
  const raw = normalize(value);
  const dashed = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const normalizeBaseMonth = (baseDate) => normalizeBaseDate(baseDate).slice(0, 7);
const instructionChargeDuplicateCheckpoint = (payloadSha256) =>
  `rwo06f:medicalmodv2:rwo06f-instruction-charge-medicalmodv2-v1:target-${PHASE4_TARGET_PATIENT_ID}:request-01:class-01:payload-sha256-${payloadSha256}`;

export const parseInstructionChargePreconditionArgs = (argv) => {
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
      if (arg === '--base-date') options.baseDate = value;
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

const payloadBaseDate = (payload) => {
  const visitDate = normalize(payload?.encounterContext?.visitDate || payload?.performDate);
  if (!visitDate) return '2026-04-25';
  return normalizeBaseDate(visitDate) || '2026-04-25';
};

const payloadContext = (payload) => ({
  patientId: normalize(payload?.encounterContext?.patientId || payload?.patientId),
  departmentCode: normalize(payload?.encounterContext?.departmentCode || payload?.departmentCode),
  physicianCode: normalize(payload?.encounterContext?.physicianCode || payload?.physicianCode),
  insuranceCombinationNumber: normalize(
    payload?.encounterContext?.insuranceCombinationNumber || payload?.insuranceCombinationNumber,
  ),
  baseDate: payloadBaseDate(payload),
});

export const validateInstructionChargePreconditionCommand = ({ argv, env = process.env, cwd = process.cwd() }) => {
  const { options, errors } = parseInstructionChargePreconditionArgs(argv);
  const blockers = [...errors];
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (options.dryRun === options.executeReadonly) {
    blockers.push('exactly one of --dry-run or --execute-readonly is required');
  }

  let payloadEvidence = null;
  try {
    const payloadPath = options.payload ? path.resolve(cwd, options.payload) : undefined;
    const loaded = loadPhase4Payload({ payloadPath });
    if (options.payloadSha256 && loaded.sha256 !== options.payloadSha256) {
      blockers.push('payload sha256 mismatch');
    }
    const plan = summarizeInstructionChargePreconditionNoLivePlan(loaded.payload);
    if (!plan.ok) blockers.push(...plan.blockers);
    const context = payloadContext(loaded.payload);
    if (!context.patientId) blockers.push('payload encounterContext.patientId is required');
    if (!context.departmentCode) blockers.push('payload encounterContext.departmentCode is required');
    if (!context.physicianCode) blockers.push('payload encounterContext.physicianCode is required');
    if (!context.insuranceCombinationNumber) {
      blockers.push('payload encounterContext.insuranceCombinationNumber is required');
    }
    const baseDate = normalizeBaseDate(options.baseDate ?? context.baseDate);
    if (!baseDate) blockers.push('--base-date must resolve to YYYYMMDD');
    payloadEvidence = {
      sha256: loaded.sha256,
      bytes: loaded.bytes,
      plan,
      duplicateLiveCheckpoint: {
        key: instructionChargeDuplicateCheckpoint(loaded.sha256),
        status: 'not_checked_no_live_packet_hardening',
        identity: {
          endpoint: PHASE4_ENDPOINT_PATH,
          requestClass: PHASE4_REQUEST_CLASS,
          target: PHASE4_TARGET_PATIENT_ID,
          requestNumber: '01',
          classCode: '01',
          payloadSha256: loaded.sha256,
        },
      },
      context: {
        ...context,
        baseDate,
        baseMonth: normalizeBaseMonth(baseDate),
      },
    };
  } catch {
    blockers.push('payload could not be loaded as JSON');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    options: {
      ...options,
      baseDate: payloadEvidence?.context?.baseDate ?? normalizeBaseDate(options.baseDate ?? ''),
    },
    payloadEvidence,
    contract: INSTRUCTION_CHARGE_PRECONDITION_CONTRACT,
    rawPayloadStored: false,
    rawOrcaBodyStored: false,
    credentialsCaptured: false,
    rawArtifactsCaptured: false,
  };
};

export const resolveInstructionChargeReadonlyConfig = (env = process.env) => {
  const baseUrl =
    normalize(env.ORCA_BASE_URL) ||
    (normalize(env.ORCA_API_HOST)
      ? `${normalize(env.ORCA_API_SCHEME) || 'https'}://${normalize(env.ORCA_API_HOST)}${
          normalize(env.ORCA_API_PORT) ? `:${normalize(env.ORCA_API_PORT)}` : ''
        }/`
      : 'https://weborca-trial.orca.med.or.jp/');
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { ok: false, blockers: ['invalid_orca_base_url'], credentialConfigured: false };
  }
  const user = normalize(env.ORCA_API_USER) || normalize(env.ORCA_BASIC_USER);
  const password = normalize(env.ORCA_API_PASSWORD) || normalize(env.ORCA_BASIC_PASSWORD);
  const blockers = [];
  if (parsed.protocol !== 'https:') blockers.push('trial_requires_https');
  if (parsed.hostname !== INSTRUCTION_CHARGE_ALLOWED_HOST) blockers.push('non_trial_orca_host_forbidden');
  if (!user || !password) blockers.push('missing_trial_basic_credential');
  return {
    ok: blockers.length === 0,
    blockers,
    baseUrl: parsed,
    user,
    password,
    credentialConfigured: Boolean(user && password),
  };
};

const escapeXml = (value) =>
  normalize(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const buildDiseaseGetXml = ({ patientId, baseMonth }) =>
  `<data><disease_inforeq type="record"><Patient_ID type="string">${escapeXml(
    patientId,
  )}</Patient_ID><Base_Date type="string">${escapeXml(baseMonth)}</Base_Date></disease_inforeq></data>`;

export const buildMedicalGetMonthlyXml = ({ patientId, baseDate, departmentCode, insuranceCombinationNumber }) =>
  `<data><medicalgetreq type="record"><InOut type="string">O</InOut><Patient_ID type="string">${escapeXml(
    patientId,
  )}</Patient_ID><Perform_Date type="string">${escapeXml(
    baseDate,
  )}</Perform_Date><Medical_Information type="record"><Department_Code type="string">${escapeXml(
    departmentCode,
  )}</Department_Code><Insurance_Combination_Number type="string">${escapeXml(
    insuranceCombinationNumber,
  )}</Insurance_Combination_Number></Medical_Information></medicalgetreq></data>`;

export const buildSystem01DailyXml = ({ baseDate }) =>
  `<data><system01_dailyreq type="record"><Request_Number type="string">01</Request_Number><Base_Date type="string">${escapeXml(
    baseDate,
  )}</Base_Date></system01_dailyreq></data>`;

export const buildSystem01ManageXml = ({ baseDate }) =>
  `<data><system01_managereq type="record"><Request_Number type="string">04</Request_Number><Base_Date type="string">${escapeXml(
    baseDate,
  )}</Base_Date></system01_managereq></data>`;

export const buildMedicationGetCodeXml = ({ candidateCode, baseDate }) =>
  `<data><medicationgetreq type="record"><Request_Number type="string">02</Request_Number><Request_Code type="string">${escapeXml(
    candidateCode,
  )}</Request_Code><Base_Date type="string">${escapeXml(baseDate)}</Base_Date></medicationgetreq></data>`;

export const buildSystem01PhysicianXml = () =>
  '<data><system01lstv2req type="record"><Request_Number type="string">02</Request_Number></system01lstv2req></data>';

export const buildPatientInsuranceCombinationXml = ({ patientId, baseDate }) =>
  `<data><patientlst6req><Reqest_Number>01</Reqest_Number><Patient_ID>${escapeXml(
    patientId,
  )}</Patient_ID><Base_Date>${escapeXml(baseDate)}</Base_Date><Start_Date>${escapeXml(
    baseDate,
  )}</Start_Date><End_Date>${escapeXml(baseDate)}</End_Date></patientlst6req></data>`;

export const buildMasterLastUpdateXml = () =>
  '<data><masterlastupdatev3req type="record"></masterlastupdatev3req></data>';

const tagText = (xml, tagName) => {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = String(xml ?? '').match(pattern);
  return normalize(match?.[1]?.replace(/<[^>]+>/g, ''));
};

const allTagText = (xml, tagName) => {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'gi');
  const values = [];
  for (const match of String(xml ?? '').matchAll(pattern)) {
    const value = normalize(match?.[1]?.replace(/<[^>]+>/g, ''));
    if (value) values.push(value);
  }
  return values;
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
  const normalized = normalize(apiResult);
  if (!normalized) return 'missing';
  if (/^0+$/.test(normalized)) return 'success_zero';
  if (/^E\d{2}$/i.test(normalized)) return 'official_error';
  if (/^W\d{2}$/i.test(normalized)) return 'official_warning';
  if (/^\d+$/.test(normalized)) return 'nonzero_numeric';
  return 'other_present';
};

const classForPresence = (value) => (normalize(value) ? 'present' : 'missing');
const countClass = (count) => {
  if (count <= 0) return 'zero';
  if (count === 1) return 'one';
  return 'multiple';
};

export const sanitizeInstructionChargeReadonlyXmlResult = ({ role, endpoint, httpStatus, xml, context }) => {
  const apiResultClass = classifyApiResult(tagText(xml, 'Api_Result'));
  const base = {
    role,
    endpoint,
    httpStatusClass: classifyHttpStatus(httpStatus),
    apiResultClass,
    rawOrcaBodyStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };

  if (role === 'diseaseContext') {
    const diseaseClasses = allTagText(xml, 'Disease_Class');
    const departmentCodes = allTagText(xml, 'Department_Code');
    const insuranceCombinationNumbers = allTagText(xml, 'Insurance_Combination_Number');
    const sanitized = {
      ...base,
      diseaseRowCountClass: countClass(diseaseClasses.length),
      managementFeeDiseaseClassPresent: diseaseClasses.includes('05'),
      targetDepartmentReferenced: departmentCodes.includes(context.departmentCode),
      targetInsuranceCombinationReferenced: insuranceCombinationNumbers.includes(context.insuranceCombinationNumber),
      rawDiseaseNameStored: false,
    };
    return { ...sanitized, evidenceHash: sha256Text(JSON.stringify(sanitized)) };
  }

  if (role === 'monthlyDuplicateContext') {
    const candidateCode = context.candidateCode;
    const medicationCodes = allTagText(xml, 'Medication_Code');
    const medicalCodes = allTagText(xml, 'Medical_Code');
    const allCodes = [...medicationCodes, ...medicalCodes];
    const departmentCodes = allTagText(xml, 'Department_Code');
    const insuranceCombinationNumbers = allTagText(xml, 'Insurance_Combination_Number');
    const sanitized = {
      ...base,
      candidateCodeReferenced: Boolean(candidateCode && allCodes.includes(candidateCode)),
      candidateReferenceCountClass: countClass(allCodes.filter((code) => code === candidateCode).length),
      targetDepartmentReferenced: departmentCodes.includes(context.departmentCode),
      targetInsuranceCombinationReferenced: insuranceCombinationNumbers.includes(context.insuranceCombinationNumber),
      departmentInsuranceAuthority: 'readonly_orca_response_sanitized_not_client_authority',
      rawMedicalRowsStored: false,
    };
    return { ...sanitized, evidenceHash: sha256Text(JSON.stringify(sanitized)) };
  }

  if (role === 'candidateCodeValidity') {
    const medicationCodes = allTagText(xml, 'Medication_Code');
    const startDate = tagText(xml, 'StartDate');
    const endDate = tagText(xml, 'EndDate');
    const candidateCode = context.candidateCode;
    const candidateCodeValid =
      apiResultClass === 'success_zero' && Boolean(candidateCode && medicationCodes.includes(candidateCode));
    const sanitized = {
      ...base,
      requestNumber: '02',
      candidateCodeValid,
      candidateCodeReferenceCountClass: countClass(medicationCodes.filter((code) => code === candidateCode).length),
      effectiveStartDatePresence: classForPresence(startDate),
      effectiveEndDatePresence: classForPresence(endDate),
      requestSemantics: 'medicationgetv2_request_02_code_lookup_sanitized',
      rawMasterRowsStored: false,
    };
    return { ...sanitized, evidenceHash: sha256Text(JSON.stringify(sanitized)) };
  }

  if (role === 'selectableCommentStatus') {
    const medicationCodes = allTagText(xml, 'Medication_Code');
    const candidateCode = context.candidateCode;
    const selectableCommentValid =
      apiResultClass === 'success_zero' && Boolean(candidateCode && medicationCodes.includes(candidateCode));
    const sanitized = {
      ...base,
      requestNumber: '02',
      status: selectableCommentValid
        ? 'readonly_selectable_comment_valid_sanitized'
        : 'readonly_selectable_comment_invalid_stop_before_live',
      selectableCommentValid,
      selectableCommentProof: true,
      rawMasterRowsStored: false,
    };
    return { ...sanitized, evidenceHash: sha256Text(JSON.stringify(sanitized)) };
  }

  if (role === 'physicianContext') {
    const physicianCodes = [...allTagText(xml, 'Code'), ...allTagText(xml, 'Physician_Code')];
    const sanitized = {
      ...base,
      targetPhysicianReferenced: physicianCodes.includes(context.physicianCode),
      physicianCountClass: countClass(physicianCodes.length),
      rawPhysicianNamesStored: false,
    };
    return { ...sanitized, evidenceHash: sha256Text(JSON.stringify(sanitized)) };
  }

  if (role === 'insuranceCombinationContext') {
    const insuranceCombinationNumbers = allTagText(xml, 'Insurance_Combination_Number');
    const sanitized = {
      ...base,
      targetInsuranceCombinationReferenced: insuranceCombinationNumbers.includes(context.insuranceCombinationNumber),
      insuranceCombinationCountClass: countClass(insuranceCombinationNumbers.length),
      insuranceAuthority: 'patientlst6v2_readonly_orca_response_sanitized_not_client_authority',
      rawInsuranceDetailStored: false,
    };
    return { ...sanitized, evidenceHash: sha256Text(JSON.stringify(sanitized)) };
  }

  if (role === 'facilityContext') {
    const sanitized = {
      ...base,
      medicalAutoClassPresence: classForPresence(tagText(xml, 'Medical_Auto_Class')),
      diseaseMedAutoClassPresence: classForPresence(tagText(xml, 'Disease_Med_Auto_Class')),
      combinationNumberCheckClassPresence: classForPresence(tagText(xml, 'Combination_Number_Chk_Class')),
      institutionCodePresence: classForPresence(tagText(xml, 'Institution_Code')),
      facilitySummaryOnly: true,
    };
    return { ...sanitized, evidenceHash: sha256Text(JSON.stringify(sanitized)) };
  }

  if (role === 'masterFreshnessStatus') {
    const lastUpdate =
      tagText(xml, 'Last_Update_Date') ||
      tagText(xml, 'Last_Update') ||
      tagText(xml, 'Information_Date') ||
      tagText(xml, 'Information_Time');
    const sanitized = {
      ...base,
      masterFreshnessObserved: apiResultClass === 'success_zero',
      lastUpdatePresence: classForPresence(lastUpdate),
      freshnessStatusOnly: true,
      rawMasterRowsStored: false,
    };
    return { ...sanitized, evidenceHash: sha256Text(JSON.stringify(sanitized)) };
  }

  return { ...base, evidenceHash: sha256Text(JSON.stringify(base)) };
};

const endpointUrl = (baseUrl, endpoint) => {
  const pathName = {
    medicationgetv2: '/api01rv2/medicationgetv2?class=01',
    diseasegetv2: '/api01rv2/diseasegetv2?class=01',
    medicalgetv2: '/api01rv2/medicalgetv2?class=03',
    system01dailyv2: '/api01rv2/system01dailyv2',
    system01physicianv2: '/api01rv2/system01lstv2?class=02',
    system01lstv2: '/api01rv2/system01lstv2?class=04',
    patientlst6v2: '/api01rv2/patientlst6v2',
    masterlastupdatev3: '/api/orca51/masterlastupdatev3',
  }[endpoint];
  return new URL(pathName, baseUrl).toString();
};

const readonlyRequestsForContext = (context) => [
  {
    role: 'candidateCodeValidity',
    endpoint: 'medicationgetv2',
    body: buildMedicationGetCodeXml({ candidateCode: context.candidateCode, baseDate: context.baseDate }),
  },
  {
    role: 'selectableCommentStatus',
    endpoint: 'medicationgetv2',
    body: buildMedicationGetCodeXml({ candidateCode: context.candidateCode, baseDate: context.baseDate }),
  },
  {
    role: 'diseaseContext',
    endpoint: 'diseasegetv2',
    body: buildDiseaseGetXml({ patientId: context.patientId, baseMonth: context.baseMonth }),
  },
  {
    role: 'monthlyDuplicateContext',
    endpoint: 'medicalgetv2',
    body: buildMedicalGetMonthlyXml({
      patientId: context.patientId,
      baseDate: context.baseDate,
      departmentCode: context.departmentCode,
      insuranceCombinationNumber: context.insuranceCombinationNumber,
    }),
  },
  {
    role: 'facilityContext',
    endpoint: 'system01dailyv2',
    body: buildSystem01DailyXml({ baseDate: context.baseDate }),
  },
  {
    role: 'facilityContext',
    endpoint: 'system01lstv2',
    body: buildSystem01ManageXml({ baseDate: context.baseDate }),
  },
  {
    role: 'physicianContext',
    endpoint: 'system01physicianv2',
    body: buildSystem01PhysicianXml(),
  },
  {
    role: 'insuranceCombinationContext',
    endpoint: 'patientlst6v2',
    body: buildPatientInsuranceCombinationXml({ patientId: context.patientId, baseDate: context.baseDate }),
  },
  {
    role: 'masterFreshnessStatus',
    endpoint: 'masterlastupdatev3',
    body: buildMasterLastUpdateXml(),
  },
];

export const executeInstructionChargeReadonlyPreconditionChecks = async ({ config, context, fetchImpl = fetch }) => {
  const auth = Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64');
  const checks = [];
  for (const request of readonlyRequestsForContext(context)) {
    const response = await fetchImpl(endpointUrl(config.baseUrl, request.endpoint), {
      method: 'POST',
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/xml',
        Authorization: `Basic ${auth}`,
      },
      body: request.body,
    });
    const xml = await response.text();
    checks.push(sanitizeInstructionChargeReadonlyXmlResult({
      role: request.role,
      endpoint: request.endpoint,
      httpStatus: response.status,
      xml,
      context,
    }));
  }
  return checks;
};

const classifyPreconditionStatus = (readonlyChecks) => {
  const disease = readonlyChecks.find((entry) => entry.role === 'diseaseContext');
  const monthly = readonlyChecks.find((entry) => entry.role === 'monthlyDuplicateContext');
  const facilityChecks = readonlyChecks.filter((entry) => entry.role === 'facilityContext');
  const candidateCode = readonlyChecks.find((entry) => entry.role === 'candidateCodeValidity');
  const selectableComment = readonlyChecks.find((entry) => entry.role === 'selectableCommentStatus');
  const physician = readonlyChecks.find((entry) => entry.role === 'physicianContext');
  const insurance = readonlyChecks.find((entry) => entry.role === 'insuranceCombinationContext');
  const masterFreshness = readonlyChecks.find((entry) => entry.role === 'masterFreshnessStatus');
  const readonlyProbeRan = readonlyChecks.length > 0;
  return {
    candidateCodeValidity:
      candidateCode?.httpStatusClass === '2xx' && candidateCode?.apiResultClass === 'success_zero' &&
      candidateCode?.candidateCodeValid === true
        ? 'readonly_code_valid_sanitized'
        : 'static_shape_valid_readonly_probe_required',
    selectableCommentStatus:
      selectableComment?.status ?? 'not_applicable_candidate_is_not_selectable_comment',
    diseaseContext:
      disease?.httpStatusClass === '2xx' && disease?.apiResultClass === 'success_zero' && disease?.managementFeeDiseaseClassPresent
        ? 'proven_sanitized'
        : 'not_proven',
    monthlyDuplicateContext:
      monthly?.httpStatusClass === '2xx' && monthly?.apiResultClass === 'success_zero'
        ? monthly.candidateCodeReferenced
          ? 'duplicate_or_existing_candidate_observed_stop_before_live'
          : 'no_candidate_duplicate_observed_sanitized'
        : 'not_proven',
    departmentContext:
      monthly?.targetDepartmentReferenced && monthly?.targetInsuranceCombinationReferenced
        ? 'observed_in_readonly_orca_response_sanitized'
        : 'not_proven',
    physicianContext:
      physician?.httpStatusClass === '2xx' && physician?.apiResultClass === 'success_zero' &&
      physician?.targetPhysicianReferenced
        ? 'observed_in_readonly_orca_response_sanitized'
        : 'not_proven',
    insuranceCombinationContext:
      (insurance?.httpStatusClass === '2xx' && insurance?.apiResultClass === 'success_zero' &&
        insurance?.targetInsuranceCombinationReferenced) ||
      (monthly?.targetInsuranceCombinationReferenced && readonlyProbeRan)
        ? 'observed_in_readonly_orca_response_sanitized'
        : 'not_proven',
    facilityContext:
      facilityChecks.some((entry) => entry.httpStatusClass === '2xx' && entry.apiResultClass === 'success_zero')
        ? 'facility_summary_observed_sanitized'
        : 'not_proven',
    masterFreshnessStatus:
      masterFreshness?.httpStatusClass === '2xx' && masterFreshness?.apiResultClass === 'success_zero' &&
      masterFreshness?.masterFreshnessObserved
        ? 'readonly_master_freshness_observed_sanitized'
        : 'not_proven',
  };
};

export const buildInstructionChargePreconditionSummary = ({
  guard,
  runId,
  traceId,
  readonlyChecks = [],
  verdict,
  blocker,
}) => {
  const context = guard.payloadEvidence?.context ?? {};
  const candidateCode = guard.payloadEvidence?.plan?.candidateCodes?.[0] ?? '';
  const readonlyContext = {
    patientIdMatched: context.patientId === '00001',
    departmentCodePresent: Boolean(context.departmentCode),
    insuranceCombinationNumberPresent: Boolean(context.insuranceCombinationNumber),
    baseMonth: context.baseMonth ?? null,
    candidateCodeHash: candidateCode ? sha256Text(candidateCode) : null,
  };
  const preconditionStatus = classifyPreconditionStatus(readonlyChecks);
  const allProven =
    preconditionStatus.candidateCodeValidity === 'readonly_code_valid_sanitized' &&
    preconditionStatus.selectableCommentStatus !== 'not_proven' &&
    preconditionStatus.selectableCommentStatus !== 'readonly_selectable_comment_invalid_stop_before_live' &&
    preconditionStatus.diseaseContext === 'proven_sanitized' &&
    preconditionStatus.monthlyDuplicateContext === 'no_candidate_duplicate_observed_sanitized' &&
    preconditionStatus.departmentContext === 'observed_in_readonly_orca_response_sanitized' &&
    preconditionStatus.physicianContext === 'observed_in_readonly_orca_response_sanitized' &&
    preconditionStatus.insuranceCombinationContext === 'observed_in_readonly_orca_response_sanitized' &&
    preconditionStatus.facilityContext === 'facility_summary_observed_sanitized' &&
    preconditionStatus.masterFreshnessStatus === 'readonly_master_freshness_observed_sanitized';

  return {
    runId,
    traceId,
    contract: INSTRUCTION_CHARGE_PRECONDITION_CONTRACT,
    verdict,
    blocker,
    liveTrialMutation: 'not_run',
    readOnlyTrialAction: readonlyChecks.length > 0 ? 'executed_readonly_once' : 'not_run',
    payload: {
      sha256: guard.payloadEvidence?.sha256 ?? null,
      bytes: guard.payloadEvidence?.bytes ?? 0,
      rawPayloadStored: false,
    },
    endpointPacket: {
      endpoint: PHASE4_ENDPOINT_PATH,
      requestClass: PHASE4_REQUEST_CLASS,
      target: PHASE4_TARGET_PATIENT_ID,
      requestNumber: '01',
      classCode: '01',
      duplicateLiveCheckpoint: guard.payloadEvidence?.duplicateLiveCheckpoint ?? null,
      parserSanitizerContract: {
        commandContract: guard.contract,
        contextStatusSchemaPresent: Boolean(guard.payloadEvidence?.plan?.contextStatusSchema),
        rawPayloadStored: false,
        rawOrcaBodyStored: false,
        rawPatientOrInsuranceDetailStored: false,
        rawDiseaseNameStored: false,
        rawMedicalRowsStored: false,
      },
      endpointSpecificBusinessSuccessCriteria:
        guard.payloadEvidence?.plan?.endpointSpecificBusinessSuccessCriteria ?? [],
      stopConditions: guard.payloadEvidence?.plan?.stopConditions ?? [],
      businessSuccessSeparation: {
        readonlyPreflightIsBusinessSuccess: false,
        dryRunIsBusinessSuccess: false,
        http200OrApiResultZeroAloneIsBusinessSuccess: false,
      },
    },
    preconditions: {
      plan: guard.payloadEvidence?.plan ?? null,
      readonlyContext,
      readonlyChecks,
      preconditionStatus,
      allPreconditionsProven: allProven,
      businessSuccessClassification: allProven
        ? 'readonly_preconditions_proven_not_business_acceptance'
        : 'not_applicable_or_readonly_preconditions_not_proven',
      stopBeforeLiveUntilAllPreconditionsProven: !allProven,
    },
    security: {
      trialHostAllowlist: INSTRUCTION_CHARGE_ALLOWED_HOST,
      credentialsCaptured: false,
      rawArtifactsCaptured: false,
      rawArtifactsCommittedOrPackaged: false,
      rawOrcaBodyStored: false,
      rawPatientOrInsuranceDetailStored: false,
      rawDiseaseNameStored: false,
      diagnosticArtifactsCaptured: false,
      productionOrcaAttempted: false,
      s3ObjectStorageUsed: false,
    },
  };
};

export const writeInstructionChargePreconditionSummary = ({ artifactDir, summary }) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, 'instruction-charge-preconditions-readonly-summary.sanitized.json');
  const mdPath = path.join(artifactDir, 'instruction-charge-preconditions-readonly-summary.sanitized.md');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(
    mdPath,
    `# Instruction Charge Preconditions Readonly Wrapper\n\n` +
      `- RUN_ID: ${summary.runId}\n` +
      `- Contract: ${summary.contract}\n` +
      `- Verdict: ${summary.verdict}\n` +
      `- Read-only Trial action: ${summary.readOnlyTrialAction}\n` +
      `- Live Trial mutation: ${summary.liveTrialMutation}\n` +
      `- All preconditions proven: ${summary.preconditions.allPreconditionsProven ? 'yes' : 'no'}\n` +
      `- Business classification: ${summary.preconditions.businessSuccessClassification}\n` +
      `- Credentials captured: no\n` +
      `- Raw artifacts captured: no\n` +
      `- Raw ORCA body stored: no\n`,
    'utf8',
  );
  return { jsonPath, mdPath };
};
