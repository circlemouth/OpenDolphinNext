import './orca-env.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  loadPhase4Payload,
  summarizeInjectionMasterValidityNoLivePlan,
} from './phase4-medicalmodv2-safe-evidence.mjs';

export const MASTER_VALIDITY_CONTRACT = 'phase4-injection-master-validity-sanitized-readonly';
export const MASTER_VALIDITY_ALLOWED_HOST = 'weborca-trial.orca.med.or.jp';
export const MASTER_VALIDITY_READONLY_CHECKS = [
  { role: 'medication', endpoint: 'medicationgetv2', requestNumber: '02' },
  { role: 'procedure', endpoint: 'masterlastupdatev3' },
  { role: 'material', endpoint: 'masterlastupdatev3' },
  { role: 'comment', endpoint: 'masterlastupdatev3' },
];

const VALUE_FLAGS = new Set(['--payload', '--payload-sha256', '--artifact-dir', '--base-date', '--medication-code']);
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

export const parseMasterValidityArgs = (argv) => {
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
      if (arg === '--medication-code') options.medicationCode = value;
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

const normalizeBaseDate = (value) => {
  const raw = normalize(value);
  const dashed = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return '';
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
};

const normalizeMedicationCode = (value) => normalize(value).replace(/[^0-9]/g, '');

const applyReadonlyCandidateOverride = ({ plan, medicationCode }) => {
  if (!plan || typeof plan !== 'object') return plan;
  const normalizedMedicationCode = normalizeMedicationCode(medicationCode);
  if (!normalizedMedicationCode) return plan;
  const readOnlyChecksRequiredBeforeLive = Array.isArray(plan.readOnlyChecksRequiredBeforeLive)
    ? plan.readOnlyChecksRequiredBeforeLive.map((entry) =>
        entry?.role === 'medication' ? { ...entry, code: normalizedMedicationCode } : entry,
      )
    : plan.readOnlyChecksRequiredBeforeLive;
  return {
    ...plan,
    candidateCodes: {
      ...(plan.candidateCodes ?? {}),
      medication: normalizedMedicationCode,
    },
    readOnlyChecksRequiredBeforeLive,
    selectedReadonlyCandidate: {
      role: 'medication',
      endpoint: 'medicationgetv2',
      requestNumber: '02',
      code: normalizedMedicationCode,
      source: 'command_line_readonly_candidate_override',
      payloadMedicationCodeOverridden: plan.candidateCodes?.medication
        ? plan.candidateCodes.medication !== normalizedMedicationCode
        : false,
    },
  };
};

export const resolveTrialReadonlyConfig = (env = process.env) => {
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
    return { ok: false, blocker: 'invalid_orca_base_url', credentialConfigured: false };
  }
  const user = normalize(env.ORCA_API_USER) || normalize(env.ORCA_BASIC_USER);
  const password = normalize(env.ORCA_API_PASSWORD) || normalize(env.ORCA_BASIC_PASSWORD);
  const credentialConfigured = Boolean(user && password);
  const blockers = [];
  if (parsed.protocol !== 'https:') blockers.push('trial_requires_https');
  if (parsed.hostname !== MASTER_VALIDITY_ALLOWED_HOST) blockers.push('non_trial_orca_host_forbidden');
  if (!credentialConfigured) blockers.push('missing_trial_basic_credential');
  return {
    ok: blockers.length === 0,
    blockers,
    baseUrl: parsed,
    credentialConfigured,
    user,
    password,
  };
};

export const validateMasterValidityCommand = ({ argv, env = process.env, cwd = process.cwd() }) => {
  const { options, errors } = parseMasterValidityArgs(argv);
  const blockers = [...errors];
  for (const [key, forbiddenValue] of FORBIDDEN_ENV) {
    if (env[key] === forbiddenValue) blockers.push(`forbidden env enabled: ${key}`);
  }
  if (!options.sanitizedEvidenceOnly) blockers.push('--sanitized-evidence-only is required');
  if (!options.disableBrowserArtifacts) blockers.push('--disable-browser-artifacts is required');
  if (options.dryRun === options.executeReadonly) {
    blockers.push('exactly one of --dry-run or --execute-readonly is required');
  }
  const baseDate = normalizeBaseDate(options.baseDate ?? '2026-04-22');
  if (!baseDate) blockers.push('--base-date must resolve to YYYYMMDD');
  const medicationCode = normalizeMedicationCode(options.medicationCode);
  if (options.medicationCode && !/^\d{9}$/.test(medicationCode)) {
    blockers.push('--medication-code must be a 9 digit ORCA medication code');
  }
  if (!options.dryRun && !medicationCode) {
    blockers.push('--medication-code is required for readonly injectable row proof');
  }
  if (!options.dryRun && medicationCode === '620000012') {
    blockers.push('620000012 must not be retried unchanged as injectable medication evidence');
  }

  let payloadEvidence = null;
  try {
    const payloadPath = options.payload ? path.resolve(cwd, options.payload) : undefined;
    const loaded = loadPhase4Payload({ payloadPath });
    if (options.payloadSha256 && loaded.sha256 !== options.payloadSha256) {
      blockers.push('payload sha256 mismatch');
    }
    const rawPlan = summarizeInjectionMasterValidityNoLivePlan(loaded.payload);
    const plan = applyReadonlyCandidateOverride({ plan: rawPlan, medicationCode });
    if (!plan.ok) blockers.push(...plan.blockers);
    payloadEvidence = {
      sha256: loaded.sha256,
      bytes: loaded.bytes,
      plan,
    };
  } catch {
    blockers.push('payload could not be loaded as JSON');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    options: { ...options, baseDate },
    payloadEvidence,
    contract: MASTER_VALIDITY_CONTRACT,
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

export const buildMedicationGetXml = ({ requestCode, baseDate }) =>
  `<data><medicationgetreq type="record"><Request_Number type="string">02</Request_Number><Request_Code type="string">${escapeXml(
    requestCode,
  )}</Request_Code><Base_Date type="string">${escapeXml(baseDate)}</Base_Date></medicationgetreq></data>`;

export const buildMasterLastUpdateXml = () =>
  '<data><masterlastupdatev3req type="record"></masterlastupdatev3req></data>';

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
  const normalized = normalize(apiResult);
  if (!normalized) return 'missing';
  if (/^0+$/.test(normalized)) return 'success_zero';
  if (/^E\d{2}$/i.test(normalized)) return 'official_error';
  if (/^W\d{2}$/i.test(normalized)) return 'official_warning';
  if (/^\d+$/.test(normalized)) return 'nonzero_numeric';
  return 'other_present';
};

const classifyMedicationGetRequest02Result = ({ apiResultClass, medicationCode, expectedCode }) => {
  if (apiResultClass === 'success_zero' && medicationCode === expectedCode) return 'row_found_with_selection_comments';
  if (apiResultClass === 'official_error') return 'official_error_no_row_proof';
  if (apiResultClass === 'official_warning') return 'official_warning_no_row_proof';
  return 'not_proven';
};

export const sanitizeReadonlyXmlResult = ({ role, endpoint, code, httpStatus, xml }) => {
  const apiResult = tagText(xml, 'Api_Result');
  const apiResultClass = classifyApiResult(apiResult);
  const medicationCode = endpoint === 'medicationgetv2' ? tagText(xml, 'Medication_Code') : '';
  const lastUpdate = endpoint === 'masterlastupdatev3' ? tagText(xml, 'Last_Update_Date') || tagText(xml, 'Last_Update') : '';
  const startDate = endpoint === 'medicationgetv2' ? tagText(xml, 'StartDate') : '';
  const endDate = endpoint === 'medicationgetv2' ? tagText(xml, 'EndDate') : '';
  const sanitized = {
    role,
    endpoint,
    code,
    httpStatusClass: classifyHttpStatus(httpStatus),
    apiResultClass,
    masterFound: endpoint === 'medicationgetv2' ? apiResultClass === 'success_zero' && medicationCode === code : apiResultClass === 'success_zero',
    request02ResultClass: endpoint === 'medicationgetv2'
      ? classifyMedicationGetRequest02Result({ apiResultClass, medicationCode, expectedCode: code })
      : undefined,
    effectiveDateClass: startDate ? 'present' : 'missing',
    endDateClass: endDate ? 'present' : 'missing',
    lastUpdateDateClass: lastUpdate ? 'present' : 'missing',
    rawOrcaBodyStored: false,
    rawPatientOrInsuranceDetailStored: false,
  };
  return {
    ...sanitized,
    evidenceHash: sha256Text(JSON.stringify(sanitized)),
  };
};

const endpointUrl = (baseUrl, endpoint) => {
  const pathName = endpoint === 'medicationgetv2' ? '/api/api01rv2/medicationgetv2?class=01' : '/api/orca51/masterlastupdatev3';
  return new URL(pathName, baseUrl).toString();
};

export const executeReadonlyMasterChecks = async ({ config, plan, baseDate, fetchImpl = fetch }) => {
  const auth = Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64');
  const checks = [];
  for (const check of MASTER_VALIDITY_READONLY_CHECKS) {
    const code = plan.candidateCodes[check.role] ?? '';
    const body =
      check.endpoint === 'medicationgetv2'
        ? buildMedicationGetXml({ requestCode: code, baseDate })
        : buildMasterLastUpdateXml();
    const response = await fetchImpl(endpointUrl(config.baseUrl, check.endpoint), {
      method: 'POST',
      headers: {
        Accept: 'application/xml',
        'Content-Type': 'application/xml',
        Authorization: `Basic ${auth}`,
      },
      body,
    });
    const xml = await response.text();
    checks.push(sanitizeReadonlyXmlResult({
      role: check.role,
      endpoint: check.endpoint,
      code,
      httpStatus: response.status,
      xml,
    }));
  }
  return checks;
};

export const buildMasterValiditySummary = ({ guard, runId, traceId, readonlyChecks = [], verdict, blocker }) => {
  const allMasterVerified =
    readonlyChecks.length === MASTER_VALIDITY_READONLY_CHECKS.length &&
    readonlyChecks.every((entry) => entry.httpStatusClass === '2xx' && entry.apiResultClass === 'success_zero' && entry.masterFound);
  return {
    runId,
    traceId,
    contract: MASTER_VALIDITY_CONTRACT,
    verdict,
    blocker,
    liveTrialMutation: 'not_run',
    readOnlyTrialAction: readonlyChecks.length > 0 ? 'executed_readonly_once' : 'not_run',
    payload: {
      sha256: guard.payloadEvidence?.sha256 ?? null,
      bytes: guard.payloadEvidence?.bytes ?? 0,
      rawPayloadStored: false,
    },
    masterValidity: {
      plan: guard.payloadEvidence?.plan ?? null,
      readonlyChecks,
      allMasterVerified,
      businessSuccessClassification: allMasterVerified
        ? 'readonly_master_validity_validated_not_business_acceptance'
        : 'not_applicable_or_readonly_master_validity_not_validated',
    },
    security: {
      trialHostAllowlist: MASTER_VALIDITY_ALLOWED_HOST,
      credentialsCaptured: false,
      rawArtifactsCaptured: false,
      rawArtifactsCommittedOrPackaged: false,
      rawOrcaBodyStored: false,
      rawPatientOrInsuranceDetailStored: false,
      diagnosticArtifactsCaptured: false,
      productionOrcaAttempted: false,
      s3ObjectStorageUsed: false,
    },
  };
};

export const writeMasterValiditySummary = ({ artifactDir, summary }) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const jsonPath = path.join(artifactDir, 'master-validity-readonly-summary.sanitized.json');
  const mdPath = path.join(artifactDir, 'master-validity-readonly-summary.sanitized.md');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(
    mdPath,
    `# Injection Master Validity Readonly Wrapper\n\n` +
      `- RUN_ID: ${summary.runId}\n` +
      `- Contract: ${summary.contract}\n` +
      `- Verdict: ${summary.verdict}\n` +
      `- Read-only Trial action: ${summary.readOnlyTrialAction}\n` +
      `- Live Trial mutation: ${summary.liveTrialMutation}\n` +
      `- All master verified: ${summary.masterValidity.allMasterVerified ? 'yes' : 'no'}\n` +
      `- Business classification: ${summary.masterValidity.businessSuccessClassification}\n` +
      `- Credentials captured: no\n` +
      `- Raw artifacts captured: no\n` +
      `- Raw ORCA body stored: no\n`,
    'utf8',
  );
  return { jsonPath, mdPath };
};
