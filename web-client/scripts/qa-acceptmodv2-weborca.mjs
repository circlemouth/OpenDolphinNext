import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  buildQaSession,
  createAuthenticatedContext,
  resolveQaFacilityId,
  resolveQaPasswordPlain,
  resolveQaUserId,
} from './qa-lib/session-auth.mjs';
import { evaluateMedicalInformationGate } from './qa-lib/medical-information-gate.mjs';
import {
  buildSanitizedAcceptmodv2Summary,
  redactHeaders,
  redactText,
  redactUrl,
  sanitizeNetworkRecord,
  sanitizeRequestRecord,
} from './qa-lib/acceptmodv2-business-evidence.mjs';
import {
  SELECTOR_OPTION_MISSING_BLOCKER,
  buildInputIdentity,
  resolveSelectableOption,
  summarizeSelectorGate,
  validatePreflightSummary,
} from './qa-lib/acceptmodv2-identity-gate.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const candidateId = process.env.QA_CANDIDATE_ID ?? process.env.QA_PATIENT_ID?.trim() ?? `${runId}:acceptmodv2`;
const scriptStartTime = now.toISOString();
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'https://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'acceptmodv2');
const screenshotDir = path.join(artifactRoot, 'screenshots');
const networkDir = path.join(artifactRoot, 'network');
const harDir = path.join(artifactRoot, 'har');
const recordHar = process.env.QA_RECORD_HAR === '1';
const harPath = path.join(harDir, 'network.har');
const stepLogPath = path.join(artifactRoot, 'steps.log');
const summaryJsonPath = path.join(artifactRoot, 'accept-summary.json');
const sanitizedSummaryJsonPath = path.join(artifactRoot, 'accept-summary.sanitized.json');
const summaryMdPath = path.join(artifactRoot, 'accept-summary.md');
const consoleJsonPath = path.join(artifactRoot, 'console.json');
const pageErrorsJsonPath = path.join(artifactRoot, 'page-errors.json');
const preflightSummaryPath =
  process.env.QA_READONLY_PREFLIGHT_SUMMARY ??
  path.resolve(process.cwd(), '..', 'artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'weborca-readonly-preflight', 'summary.json');
const requireReadonlyPreflight = process.env.QA_REQUIRE_READONLY_PREFLIGHT !== '0';

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(networkDir, { recursive: true });
fs.mkdirSync(artifactRoot, { recursive: true });
if (recordHar) {
  fs.mkdirSync(harDir, { recursive: true });
}

const logStep = (label) => {
  const entry = `[${new Date().toISOString()}] ${label}\n`;
  fs.appendFileSync(stepLogPath, entry);
};
const safeClose = async (closer) => {
  try {
    await closer();
  } catch {
    // Playwright transport may already be gone after artifacts are written.
  }
};

const facilityId = resolveQaFacilityId();

const sessionRole = process.env.QA_ROLE ?? 'admin';
const sessionRoles = process.env.QA_ROLES
  ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean)
  : [sessionRole];
const scenarioLabel = process.env.QA_SCENARIO ?? sessionRole;

const authUserId = resolveQaUserId();
const authPasswordPlain = resolveQaPasswordPlain();

const patientId = process.env.QA_PATIENT_ID?.trim() ?? '';
const departmentCode = process.env.QA_DEPARTMENT_CODE ?? '01';
const physicianCode = process.env.QA_PHYSICIAN_CODE ?? '10001';
const paymentMode = process.env.QA_PAYMENT_MODE ?? 'insurance';
const visitKind = process.env.QA_VISIT_KIND ?? '1';
const medicalInformation = (process.env.QA_MEDICAL_INFORMATION ?? '').trim();
const allowLocalOptionInjection = process.env.QA_ALLOW_LOCAL_OPTION_INJECTION === '1';
const optionInjectionMode = allowLocalOptionInjection ? 'local_permissive' : 'live';
let preflightGateResult = {
  ok: !requireReadonlyPreflight,
  mutationAllowed: !requireReadonlyPreflight,
  blockerClassification: requireReadonlyPreflight ? 'not_checked' : 'none',
  summaryPath: preflightSummaryPath,
};
let preflightSummarySha256 = '';
const startupErrors = [];

const resolvePreflightPhase3PatientId = (summary) =>
  summary?.phase3AttemptPatientId ??
  summary?.trialSourceCandidate?.selectedPatientId ??
  summary?.patientId ??
  summary?.patientSearch?.patientId;

const phase3PreflightFailures = (summary, expectedPatientId) => {
  const phase3PatientId = resolvePreflightPhase3PatientId(summary);
  const checks = {
    acceptedForPhase3Attempt: summary?.acceptedForPhase3Attempt === true,
    phase3PatientId: phase3PatientId === expectedPatientId,
    officialPatientExistence: summary?.officialPatientExistence?.candidates?.[phase3PatientId]?.verdict === 'accepted',
    insuranceReadiness: summary?.insuranceReadiness?.verdict === 'accepted',
    selectorReadiness: summary?.selectorReadiness?.verdict === 'accepted',
    localSelectableReadiness: summary?.localSelectableReadiness?.verdict === 'accepted',
    appointmentDependency: summary?.appointmentDependency?.required === false || summary?.appointmentDependency?.verdict === 'accepted',
    acceptmodv2ReadOnlyDiagnostic:
      summary?.acceptmodv2ReadOnlyDiagnostic?.acceptedForPhase3Attempt === true &&
      summary?.acceptmodv2ReadOnlyDiagnostic?.mutationSuccess === false,
  };
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
};

if (!patientId) {
  startupErrors.push('QA_PATIENT_ID is required; pass a current local-searchable patient id for the target facility.');
}
if (requireReadonlyPreflight) {
  if (!fs.existsSync(preflightSummaryPath)) {
    startupErrors.push(
      `read-only WebORCA preflight summary is required before acceptmodv2 mutation: ${preflightSummaryPath}. Run qa-weborca-readonly-preflight.mjs with the same RUN_ID first.`,
    );
  } else {
    try {
      const preflightBuffer = fs.readFileSync(preflightSummaryPath);
      preflightSummarySha256 = crypto.createHash('sha256').update(preflightBuffer).digest('hex');
      const preflightSummary = JSON.parse(preflightBuffer.toString('utf8'));
      const validation = validatePreflightSummary({
        summary: preflightSummary,
        expected: {
          runId,
          candidateId,
          facilityId,
          patientId,
          departmentCode,
          physicianCode,
          paymentMode,
          visitKind,
          medicalInformation,
        },
      });
      const readinessFailures = validation.ok ? phase3PreflightFailures(preflightSummary, patientId) : [];
      preflightGateResult = {
        ...validation,
        ...(readinessFailures.length > 0
          ? {
              ok: false,
              mutationAllowed: false,
              blockerClassification: 'preflight_phase3_not_accepted',
              phase3ReadinessFailures: readinessFailures,
              error: `read-only WebORCA preflight is not accepted for Phase 3 mutation: ${readinessFailures.join(',')}`,
            }
          : {}),
        summaryPath: preflightSummaryPath,
      };
      if (!preflightGateResult.ok) {
        startupErrors.push(preflightGateResult.error);
      }
    } catch (error) {
      startupErrors.push(`read-only WebORCA preflight summary could not be parsed: ${String(error)}`);
    }
  }
}

const session = buildQaSession({ facilityId, userId: authUserId, runId, scenarioLabel, sessionRole, sessionRoles });

const consoleMessages = [];
const pageErrors = [];
const networkRecords = [];
const requestRecords = [];
const MEDICAL_INFORMATION_PROBE_PATH = '/api/orca/official/appointments/medical-information';

const isTarget = (url) =>
  url.includes(MEDICAL_INFORMATION_PROBE_PATH) ||
  url.includes('/api/orca/official/visits/mutation') ||
  url.includes('/api/orca/queue') ||
  url.includes('/orca/queue');

const recordRequest = (request) => {
  const url = request.url();
  if (!isTarget(url)) return;
  requestRecords.push({
    url: redactUrl(url),
    method: request.method(),
    headers: redactHeaders(request.headers()),
    postData: request.postData() ?? '',
  });
};

const writeScreenshot = async (page, name) => {
  if (!page || page.isClosed()) return null;
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots/${fileName}`;
};

const safeText = async (locator, timeout = 5000) => {
  try {
    return (await locator.textContent({ timeout })) ?? '';
  } catch {
    return '';
  }
};

const safeInnerText = async (locator, timeout = 5000) => {
  try {
    return await locator.innerText({ timeout });
  } catch {
    return '';
  }
};

const collectResponse = async (response) => {
  const url = response.url();
  if (!isTarget(url)) return;
  const request = response.request();
  let responseText = '';
  try {
    responseText = await response.text();
  } catch (error) {
    responseText = `<<failed to read response body: ${String(error)}>>`;
  }
  const record = {
    url: redactUrl(url),
    status: response.status(),
    statusText: response.statusText(),
    request: {
      method: request.method(),
      headers: redactHeaders(request.headers()),
      postData: request.postData() ?? '',
    },
    response: {
      headers: redactHeaders(response.headers()),
      body: responseText,
    },
  };
  networkRecords.push(record);
};

const probeMedicalInformationOptions = async (context) => {
  const url = new URL(MEDICAL_INFORMATION_PROBE_PATH, baseURL).toString();
  logStep(`medical information probe start url=${redactUrl(url)}`);
  requestRecords.push({
    url: redactUrl(url),
    method: 'GET',
    headers: {},
    postData: '',
  });
  try {
    const response = await context.request.get(url);
    const body = await response.text().catch(() => '');
    const record = {
      url: redactUrl(url),
      status: response.status(),
      statusText: response.statusText(),
      request: {
        method: 'GET',
        headers: {},
        postData: '',
      },
      response: {
        headers: redactHeaders(response.headers()),
        body,
      },
    };
    networkRecords.push(record);
    logStep(`medical information probe status=${response.status()}`);
    return {
      status: response.status(),
      ok: response.ok(),
      url: redactUrl(url),
    };
  } catch (error) {
    const message = String(error);
    networkRecords.push({
      url: redactUrl(url),
      status: 0,
      statusText: 'probe-error',
      request: {
        method: 'GET',
        headers: {},
        postData: '',
      },
      response: {
        headers: {},
        body: message,
      },
    });
    logStep(`medical information probe error=${message}`);
    return {
      status: 0,
      ok: false,
      url: redactUrl(url),
      error: message,
    };
  }
};

const setTextInputValue = async (locator, value) => {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  try {
    await locator.fill(value, { timeout: 5000 });
    return 'fill';
  } catch {
    await locator.evaluate((el, nextValue) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(el, nextValue);
      } else {
        el.value = nextValue;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    return 'dom-event-fallback';
  }
};

const injectLocalOption = async (selectLocator, desiredValue) => {
  try {
    await selectLocator.evaluate((select, value) => {
      const options = Array.from(select.options || []);
      if (options.some((option) => option.value === value)) return;
      const option = document.createElement('option');
      option.value = value;
      option.text = value;
      select.appendChild(option);
    }, desiredValue);
    return true;
  } catch {
    return false;
  }
};

const selectOptionWithGate = async (selectLocator, field, desiredValue) => {
  const options = await selectLocator.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => node.value ?? ''),
  );
  const gate = resolveSelectableOption({
    field,
    desiredValue,
    options,
    allowLocalOptionInjection,
  });
  if (!gate.ok) {
    return gate;
  }
  if (gate.injected) {
    await injectLocalOption(selectLocator, gate.resolved);
  }
  if (gate.resolved) {
    await selectLocator.selectOption(gate.resolved);
  }
  return gate;
};

let activeBrowser = null;
let activeContext = null;
let activePage = null;
let lastSummary = null;

const ACCEPTMOD_SUCCESS_RESULT = /^0+$/;
const ACCEPTMOD_OFFICIAL_WARNING_RESULTS = new Set(['K1', 'K2', 'K3']);

const normalizeApiResult = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim().toUpperCase();
  if (typeof value === 'string') return value.trim().toUpperCase();
  return '';
};

const hasValue = (value) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return false;
};

const acceptanceEvidenceKeys = new Set([
  'acceptanceId',
  'Acceptance_Id',
  'acceptance_id',
  'receptionId',
  'voucherNumber',
  'Voucher_Number',
  'visitNumber',
  'Visit_Number',
  'sequentialNumber',
  'Sequential_Number',
  'scheduleKey',
  'Schedule_Key',
  'encounterKey',
  'Encounter_Key',
]);
const acceptanceInfoKeys = new Set(['acceptanceInfo', 'Acceptance_Info', 'acceptance_info']);
const patientInfoKeys = new Set(['patient', 'Patient', 'patientInformation', 'Patient_Information', 'patient_information']);
const patientEvidenceKeys = new Set([
  'patientId',
  'Patient_ID',
  'patient_id',
  'name',
  'wholeName',
  'WholeName',
  'wholeNameKana',
  'WholeName_inKana',
  'birthDate',
  'BirthDate',
]);

const hasAnyNonEmptyScalar = (value, depth = 0) => {
  if (depth > 6 || value == null) return false;
  if (hasValue(value)) return true;
  if (Array.isArray(value)) return value.some((entry) => hasAnyNonEmptyScalar(entry, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.values(value).some((entry) => hasAnyNonEmptyScalar(entry, depth + 1));
};

const hasPatientEvidence = (value, depth = 0) => {
  if (depth > 6 || value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => hasPatientEvidence(entry, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => {
    if (patientEvidenceKeys.has(key) && hasValue(entry)) return true;
    if (patientInfoKeys.has(key)) return hasPatientEvidence(entry, depth + 1);
    return typeof entry === 'object' && entry != null && hasPatientEvidence(entry, depth + 1);
  });
};

const hasAcceptanceEvidence = (value, depth = 0) => {
  if (depth > 6 || value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => hasAcceptanceEvidence(entry, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => {
    if (acceptanceEvidenceKeys.has(key) && hasValue(entry)) return true;
    if (acceptanceInfoKeys.has(key)) return hasAnyNonEmptyScalar(entry, depth + 1);
    return typeof entry === 'object' && entry != null && hasAcceptanceEvidence(entry, depth + 1);
  });
};

const hasRegistrationEvidence = (raw) => hasAcceptanceEvidence(raw) || hasPatientEvidence(raw);

const classifyAcceptmodBusinessResult = ({ ok = true, apiResult, raw }) => {
  const normalized = normalizeApiResult(apiResult);
  const evidence = hasRegistrationEvidence(raw);
  if (!ok) {
    return { businessStatus: 'businessRejected', businessReason: 'transport_error', hasRegistrationEvidence: evidence };
  }
  if (normalized === '10') {
    return { businessStatus: 'businessRejected', businessReason: 'patient_not_found', hasRegistrationEvidence: evidence };
  }
  if (normalized === '60') {
    return {
      businessStatus: 'diagnosticNoExistingAcceptance',
      businessReason: 'no_existing_acceptance',
      hasRegistrationEvidence: evidence,
    };
  }
  if (normalized === '21') {
    return { businessStatus: 'businessRejected', businessReason: 'insurance_mismatch', hasRegistrationEvidence: evidence };
  }
  if (normalized === '16') {
    return { businessStatus: 'businessRejected', businessReason: 'duplicate_acceptance', hasRegistrationEvidence: evidence };
  }
  if (ACCEPTMOD_OFFICIAL_WARNING_RESULTS.has(normalized)) {
    return evidence
      ? {
          businessStatus: 'businessAcceptedWithWarnings',
          businessReason: 'official_warning_with_registration_evidence',
          hasRegistrationEvidence: evidence,
        }
      : {
          businessStatus: 'notVerified',
          businessReason: 'warning_without_registration_evidence',
          hasRegistrationEvidence: evidence,
        };
  }
  if (ACCEPTMOD_SUCCESS_RESULT.test(normalized)) {
    return evidence
      ? {
          businessStatus: 'businessAccepted',
          businessReason: 'accepted_with_registration_evidence',
          hasRegistrationEvidence: evidence,
        }
      : {
          businessStatus: 'notVerified',
          businessReason: 'success_code_without_registration_evidence',
          hasRegistrationEvidence: evidence,
        };
  }
  if (!normalized) {
    return {
      businessStatus: 'notVerified',
      businessReason: evidence ? 'registration_evidence_without_success_code' : 'missing_api_result',
      hasRegistrationEvidence: evidence,
    };
  }
  return { businessStatus: 'businessRejected', businessReason: 'api_result_rejected', hasRegistrationEvidence: evidence };
};

const isBusinessAccepted = (status) => status === 'businessAccepted' || status === 'businessAcceptedWithWarnings';

const parseMutationResponse = () => {
  const mutationRecord = [...networkRecords]
    .reverse()
    .find((record) => record.url.includes('/api/orca/official/visits/mutation'));
  if (!mutationRecord) {
    return null;
  }
  try {
    const body = JSON.parse(mutationRecord.response?.body ?? '{}');
    const apiResult = body.apiResult ?? '';
    const business = classifyAcceptmodBusinessResult({
      ok: mutationRecord.status >= 200 && mutationRecord.status < 300,
      apiResult,
      raw: body,
    });
    return {
      status: mutationRecord.status,
      apiResult,
      apiResultMessage: body.apiResultMessage ?? '',
      acceptanceId: body.acceptanceId ?? '',
      encounterKey: body.encounterKey ?? '',
      scheduleKey: body.scheduleKey ?? '',
      businessStatus: body.businessStatus ?? business.businessStatus,
      businessReason: body.businessReason ?? business.businessReason,
      hasRegistrationEvidence: body.hasRegistrationEvidence ?? business.hasRegistrationEvidence,
      responsePath: 'network/network.json',
    };
  } catch {
    const business = classifyAcceptmodBusinessResult({ ok: false, apiResult: '', raw: null });
    return {
      status: mutationRecord.status,
      apiResult: '',
      apiResultMessage: '',
      acceptanceId: '',
      encounterKey: '',
      scheduleKey: '',
      businessStatus: business.businessStatus,
      businessReason: business.businessReason,
      hasRegistrationEvidence: business.hasRegistrationEvidence,
      responsePath: 'network/network.json',
    };
  }
};

const classifyAcceptBlocker = (mutationResponse) => {
  if (networkRecords.some((record) => record.status >= 500)) {
    return 'environment-blocker';
  }
  if (pageErrors.length > 0) {
    return 'repo-defect';
  }
  if (!mutationResponse) {
    return 'test-data-blocker';
  }
  if (isBusinessAccepted(mutationResponse.businessStatus)) return 'none';
  if (mutationResponse.businessStatus === 'notVerified') return 'repo-defect';
  if (mutationResponse.businessStatus === 'businessRejected' || mutationResponse.businessStatus === 'diagnosticNoExistingAcceptance') {
    return 'test-data-blocker';
  }
  return 'none';
};

const toEvidencePath = (filePath) => {
  if (!filePath) return '';
  const repoRoot = path.basename(process.cwd()) === 'web-client' ? path.dirname(process.cwd()) : process.cwd();
  const relative = path.relative(repoRoot, filePath);
  return relative.startsWith('..') ? path.basename(filePath) : relative;
};

const commandForEvidence = () => [path.basename(process.execPath), ...process.argv.slice(1).map((arg) => path.basename(arg))].join(' ');

const cwdForEvidence = () => path.basename(process.cwd()) || '.';

const patientIdMatchedForEvidence = () => {
  if (!requireReadonlyPreflight) return null;
  if (!preflightGateResult?.preflightIdentity?.input?.patientId) return false;
  return !preflightGateResult.mismatches?.some((item) => item.field === 'input.patientId' || item.field === 'candidate');
};

const buildSanitizedSummary = (summary, exitCode) => buildSanitizedAcceptmodv2Summary({
  runId,
  candidateId,
  preflightPath: toEvidencePath(preflightGateResult?.summaryPath ?? preflightSummaryPath),
  preflightSha256: preflightSummarySha256,
  command: commandForEvidence(),
  cwd: cwdForEvidence(),
  startTime: scriptStartTime,
  endTime: new Date().toISOString(),
  exitCode,
  acceptResponse: summary?.acceptResponse ?? null,
  medicalInformationGate: summary?.medicalInformationGate ?? evaluateMedicalInformationGate({
    requestRecords,
    medicalInformation,
  }),
  patientIdMatched: patientIdMatchedForEvidence(),
});

const writeFinalEvidenceLog = (sanitizedSummary) => {
  const c7 = sanitizedSummary.c7 ?? {};
  const finalEntry =
    `sanitizedSummary=${toEvidencePath(sanitizedSummaryJsonPath)} ` +
    `responseClassification=${sanitizedSummary.responseClassification} ` +
    `c7CheckedRequests=${c7.checkedRequests ?? 0} ` +
    `c7ViolationCount=${c7.violationCount ?? 0} ` +
    `businessAccepted=${sanitizedSummary.business?.businessAccepted === true}`;
  logStep(finalEntry);
  console.log(finalEntry);
};

const persistArtifacts = (summary) => {
  lastSummary = summary;
  const exitCode = summary.blockerClassification && summary.blockerClassification !== 'none' ? 1 : 0;
  const sanitizedSummary = buildSanitizedSummary(summary, exitCode);
  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords.map(sanitizeNetworkRecord), null, 2), 'utf8');
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords.map(sanitizeRequestRecord), null, 2), 'utf8');
  fs.writeFileSync(consoleJsonPath, JSON.stringify(consoleMessages, null, 2), 'utf8');
  fs.writeFileSync(pageErrorsJsonPath, JSON.stringify(pageErrors, null, 2), 'utf8');
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(sanitizedSummaryJsonPath, JSON.stringify(sanitizedSummary, null, 2), 'utf8');
  writeFinalEvidenceLog(sanitizedSummary);
};

const buildMarkdownSummary = (summary) =>
  `# Reception 既存患者受付（acceptmodv2）\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- 実施日時: ${summary.executedAt}\n` +
  `- Base URL: ${summary.baseURL}\n` +
  `- Facility ID: ${summary.facilityId}\n` +
  `- Session Role: ${summary.sessionRole}\n` +
  `- 患者ID: ${summary.patientId}\n` +
  `- 診療科: ${summary.selection?.department?.resolved || summary.departmentCode}\n` +
  `- 担当医: ${summary.selection?.physician?.resolved || summary.physicianCode}\n` +
  `- 保険/自費: ${summary.selection?.paymentMode?.resolved || summary.paymentMode}\n` +
  `- 来院区分: ${summary.visitKind}\n` +
  `- Preflight Gate: ${summary.preflightGate?.ok ? 'passed' : 'failed'}\n` +
  `- Option Injection Mode: ${summary.optionInjection?.mode ?? 'live'}\n` +
  `- Accepted Live Evidence: ${summary.acceptedLiveEvidence === false ? 'false' : 'true'}\n` +
  `- Medical Information Probe: ${summary.medicalInformationProbe?.status ?? '—'}\n` +
  `- Medical Information Gate: ${summary.medicalInformationGate?.ok === false ? 'failed' : summary.medicalInformationGate?.enforced ? 'passed' : 'skipped'}\n` +
  `- Medical Information Checked Requests: ${summary.medicalInformationGate?.checkedRequests ?? 0}\n` +
  `- Blocker: ${summary.blockerClassification}\n` +
  (summary.fatalError ? `- Fatal Error: ${summary.fatalError}\n` : '') +
  `\n## 送信結果\n\n` +
  `- Tone: ${summary.acceptResult?.toneText ?? '—'}\n` +
  `- API Result Code: ${summary.acceptResponse?.apiResult || '—'}\n` +
  `- API Result Message: ${summary.acceptResponse?.apiResultMessage || '—'}\n` +
  `- Acceptance ID: ${summary.acceptResponse?.acceptanceId || '—'}\n` +
  `- Encounter Key: ${summary.acceptResponse?.encounterKey || '—'}\n` +
  `- Schedule Key: ${summary.acceptResponse?.scheduleKey || '—'}\n` +
  `- Business Status: ${summary.acceptResponse?.businessStatus || '—'}\n` +
  `- Business Reason: ${summary.acceptResponse?.businessReason || '—'}\n` +
  `- Registration Evidence: ${summary.acceptResponse?.hasRegistrationEvidence === true ? 'yes' : 'no'}\n` +
  `- ${summary.acceptResult?.apiResultText ?? '—'}\n` +
  `- ${summary.acceptResult?.durationText ?? '—'}\n` +
  `- XHR Debug: ${summary.acceptResult?.xhrDebugText ?? '—'}\n` +
  `\n## Evidence\n\n` +
  `- Network: network/network.json\n` +
  `- Requests: network/requests.json\n` +
  `- Sanitized summary: accept-summary.sanitized.json\n` +
  `- Console: console.json\n` +
  `- Page errors: page-errors.json\n` +
  `- Steps: steps.log\n` +
  `\n## HAR\n\n` +
  `${recordHar ? `- ${harPath}\n` : '- なし\n'}` +
  `\n## Rerun\n\n` +
  `- QA_BASE_URL=${baseURL} RUN_ID=${summary.runId} QA_PATIENT_ID=${summary.patientId} node scripts/qa-acceptmodv2-weborca.mjs\n`;

const run = async () => {
  if (startupErrors.length > 0) {
    const blockerClassification = preflightGateResult?.blockerClassification && preflightGateResult.blockerClassification !== 'none'
      ? preflightGateResult.blockerClassification
      : 'test-data-blocker';
    const summary = {
      runId,
      executedAt: new Date().toISOString(),
      baseURL: redactUrl(baseURL),
      facilityId,
      sessionRole,
      patientId,
      departmentCode,
      physicianCode,
      paymentMode,
      visitKind,
      medicalInformation: medicalInformation || undefined,
      inputIdentity: buildInputIdentity({
        runId,
        candidateId,
        facilityId,
        patientId,
        departmentCode,
        physicianCode,
        paymentMode,
        visitKind,
        medicalInformation,
      }),
      preflightGate: preflightGateResult,
      optionInjection: {
        mode: optionInjectionMode,
        allowLocalOptionInjection,
        envFlag: 'QA_ALLOW_LOCAL_OPTION_INJECTION',
      },
      acceptedLiveEvidence: false,
      selection: {},
      medicalInformationProbe: undefined,
      medicalInformationGate: evaluateMedicalInformationGate({
        requestRecords,
        medicalInformation,
      }),
      acceptResult: {},
      acceptResponse: null,
      harPath: recordHar ? harPath : undefined,
      consoleMessages,
      pageErrors,
      fatalError: redactText(startupErrors.join('; ')),
      blockerClassification,
    };
    persistArtifacts(summary);
    fs.writeFileSync(summaryMdPath, buildMarkdownSummary(summary), 'utf8');
    console.error(`acceptmodv2 rejected before browser launch: blockerClassification=${blockerClassification}`);
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true });
  activeBrowser = browser;
  const { context, page, sessionMe } = await createAuthenticatedContext(browser, {
    baseURL,
    facilityId,
    userId: authUserId,
    password: authPasswordPlain,
    session,
    recordHar: recordHar ? { path: harPath, content: 'omit' } : undefined,
  });
  activeContext = context;
  activePage = page;

  const medicalInformationProbe = await probeMedicalInformationOptions(context);

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('response', collectResponse);
  page.on('request', recordRequest);

  await page.goto(`/f/${encodeURIComponent(facilityId)}/reception`, { waitUntil: 'domcontentloaded' });
  logStep('goto reception');
  await page.locator('.reception-page').waitFor({ timeout: 20000 });
  const openWorkflowButton = page.getByRole('button', { name: '既存患者受付/患者検索' });
  await openWorkflowButton.waitFor({ timeout: 20000 });
  await openWorkflowButton.click();
  logStep('opened workflow modal');

  const workflowModal = page.locator('[data-test-id="reception-accept-workflow-modal"]');
  await workflowModal.waitFor({ timeout: 20000 });
  const patientSearchForm = workflowModal.locator('[data-test-id="reception-patient-search-form"]');
  await patientSearchForm.waitFor({ timeout: 20000 });
  logStep('patient search form ready');

  const patientSearchInputMethod = await setTextInputValue(
    patientSearchForm.locator('#reception-patient-search-patient-id'),
    patientId,
  );
  logStep(`filled patient search id method=${patientSearchInputMethod}`);
  await patientSearchForm.locator('[data-test-id="reception-patient-search-submit"]').click();
  logStep('submitted patient search');
  const resultListItem = workflowModal.locator('[role="region"][aria-label="患者検索結果モーダル"] [role="listitem"]').first();
  await resultListItem.waitFor({ timeout: 20000 }).catch(() => {
    throw new Error(
      `patient search returned no selectable result for QA_PATIENT_ID=${patientId}; set QA_PATIENT_ID to an ORCA-searchable patient in the current environment`,
    );
  });
  await resultListItem.click();
  logStep('selected patient result');

  const acceptForm = workflowModal.locator('[data-test-id="reception-accept-detail-modal"]');
  await acceptForm.waitFor({ timeout: 20000 });
  logStep('accept form ready');
  const departmentSelection = await selectOptionWithGate(
    acceptForm.locator('#reception-accept-department'),
    'departmentCode',
    departmentCode,
  );
  const paymentModeSelection = await selectOptionWithGate(
    acceptForm.locator('#reception-accept-payment-mode'),
    'paymentMode',
    paymentMode,
  );
  const physicianSelection = await selectOptionWithGate(
    acceptForm.locator('#reception-accept-physician'),
    'physicianCode',
    physicianCode,
  );
  const visitKindSelection = await selectOptionWithGate(
    acceptForm.locator('#reception-accept-visit-kind'),
    'visitKind',
    visitKind,
  );
  const medicalInformationSelection = await selectOptionWithGate(
    acceptForm.locator('#reception-accept-medical-information'),
    'medicalInformation',
    medicalInformation,
  );
  const selection = {
    department: departmentSelection,
    paymentMode: paymentModeSelection,
    physician: physicianSelection,
    visitKind: visitKindSelection,
    medicalInformation: medicalInformationSelection,
    patientSearchInputMethod,
  };
  const selectorGate = summarizeSelectorGate(selection);
  const acceptedLiveEvidence = selectorGate.acceptedLiveEvidence && preflightGateResult.ok;
  if (!selectorGate.ok) {
    const summary = {
      runId,
      executedAt: new Date().toISOString(),
      baseURL: redactUrl(baseURL),
      facilityId,
      sessionRole,
      login: {
        sessionMeStatus: sessionMe.status,
      },
      patientId,
      departmentCode,
      physicianCode,
      paymentMode,
      visitKind,
      medicalInformation: medicalInformation || undefined,
      inputIdentity: buildInputIdentity({
        runId,
        candidateId,
        facilityId,
        patientId,
        departmentCode,
        physicianCode,
        paymentMode,
        visitKind,
        medicalInformation,
      }),
      preflightGate: preflightGateResult,
      optionInjection: {
        mode: optionInjectionMode,
        allowLocalOptionInjection,
        envFlag: 'QA_ALLOW_LOCAL_OPTION_INJECTION',
      },
      acceptedLiveEvidence,
      selection,
      medicalInformationProbe,
      medicalInformationGate: {
        ok: false,
        enforced: false,
        checkedRequests: 0,
        violationCount: 0,
        reason: 'mutation_not_attempted_selector_option_missing',
      },
      acceptResult: {},
      acceptResponse: null,
      harPath: recordHar ? harPath : undefined,
      consoleMessages,
      pageErrors,
      blockerClassification: SELECTOR_OPTION_MISSING_BLOCKER,
    };
    persistArtifacts(summary);
    fs.writeFileSync(summaryMdPath, buildMarkdownSummary(summary), 'utf8');
    await safeClose(() => context.close());
    await safeClose(() => browser.close());
    activeContext = null;
    activeBrowser = null;
    activePage = null;
    console.error(`acceptmodv2 rejected before mutation: blockerClassification=${SELECTOR_OPTION_MISSING_BLOCKER}`);
    process.exitCode = 1;
    return;
  }

  const beforeShot = await writeScreenshot(page, '01-reception-before-accept');

  const acceptResponsePromise = page
    .waitForResponse((response) => response.url().includes('/api/orca/official/visits/mutation'), { timeout: 20000 })
    .catch(() => null);

  await workflowModal.locator('[data-test-id="reception-accept-register"]').click();
  logStep('clicked accept register');

  await acceptResponsePromise;
  logStep('accept response observed');

  await page.waitForTimeout(2000);

  const afterShot = await writeScreenshot(page, '02-reception-after-accept');
  const toneBanner = page.locator('.reception-accept .tone-banner');
  const toneText = await safeText(toneBanner.first());
  const apiResultText = await safeInnerText(page.locator('[data-test-id="accept-api-result"]'), 3000);
  const durationText = await safeInnerText(page.locator('[data-test-id="accept-duration-ms"]'), 3000);
  const xhrDebugText = await safeInnerText(page.locator('[data-test-id="accept-xhr-debug"]'), 3000);
  const acceptResponse = parseMutationResponse();

  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL: redactUrl(baseURL),
    facilityId,
    sessionRole,
    login: {
      sessionMeStatus: sessionMe.status,
    },
    patientId,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformation: medicalInformation || undefined,
    inputIdentity: buildInputIdentity({
      runId,
      candidateId,
      facilityId,
      patientId,
      departmentCode,
      physicianCode,
      paymentMode,
      visitKind,
      medicalInformation,
    }),
    preflightGate: preflightGateResult,
    optionInjection: {
      mode: optionInjectionMode,
      allowLocalOptionInjection,
      envFlag: 'QA_ALLOW_LOCAL_OPTION_INJECTION',
    },
    acceptedLiveEvidence,
    selection,
    medicalInformationProbe,
    medicalInformationGate: evaluateMedicalInformationGate({
      requestRecords,
      medicalInformation,
    }),
    acceptResult: {
      toneText,
      apiResultText,
      durationText,
      xhrDebugText,
    },
    acceptResponse,
    harPath: recordHar ? harPath : undefined,
    consoleMessages,
    pageErrors,
    blockerClassification: classifyAcceptBlocker(acceptResponse),
  };
  if (summary.medicalInformationGate.ok === false) {
    summary.blockerClassification = 'repo-defect';
  }

  persistArtifacts(summary);
  fs.writeFileSync(summaryMdPath, buildMarkdownSummary(summary), 'utf8');
  await safeClose(() => context.close());
  await safeClose(() => browser.close());
  activeContext = null;
  activeBrowser = null;
  activePage = null;

  if (summary.medicalInformationGate.ok === false) {
    throw new Error(summary.medicalInformationGate.error);
  }

  console.log(`Artifacts written to ${artifactRoot}`);
  if (summary.blockerClassification !== 'none') {
    console.error(
      `acceptmodv2 rejected: blockerClassification=${summary.blockerClassification} apiResult=${summary.acceptResponse?.apiResult ?? 'none'}`,
    );
    process.exitCode = 1;
  }
};

run().catch(async (error) => {
  logStep(`fatal error=${String(error)}`);
  const failureShot = await writeScreenshot(activePage, '99-failure').catch(() => null);
  const blockerClassification = networkRecords.some((record) => record.status >= 500)
    ? 'environment-blocker'
    : pageErrors.length > 0
      ? 'repo-defect'
      : classifyAcceptBlocker(parseMutationResponse()) || 'test-data-blocker';
  const summary =
    lastSummary ?? {
      runId,
      executedAt: new Date().toISOString(),
      baseURL: redactUrl(baseURL),
      facilityId,
      sessionRole,
      patientId,
      departmentCode,
      physicianCode,
      paymentMode,
      visitKind,
      medicalInformation: medicalInformation || undefined,
      inputIdentity: buildInputIdentity({
        runId,
        candidateId,
        facilityId,
        patientId,
        departmentCode,
        physicianCode,
        paymentMode,
        visitKind,
        medicalInformation,
      }),
      preflightGate: preflightGateResult,
      optionInjection: {
        mode: optionInjectionMode,
        allowLocalOptionInjection,
        envFlag: 'QA_ALLOW_LOCAL_OPTION_INJECTION',
      },
      acceptedLiveEvidence: false,
      medicalInformationProbe: undefined,
      medicalInformationGate: evaluateMedicalInformationGate({
        requestRecords,
        medicalInformation,
      }),
      selection: {},
      acceptResult: {},
      acceptResponse: parseMutationResponse(),
      harPath: recordHar ? harPath : undefined,
      consoleMessages,
      pageErrors,
      fatalError: redactText(error),
      blockerClassification,
      screenshots: {
        failure: failureShot,
      },
    };
  if (summary.medicalInformationGate?.ok === false) {
    summary.blockerClassification = 'repo-defect';
  }
  if (!lastSummary) {
    persistArtifacts(summary);
    fs.writeFileSync(summaryMdPath, buildMarkdownSummary(summary), 'utf8');
  }
  await safeClose(() => activeContext?.close?.());
  await safeClose(() => activeBrowser?.close?.());
  console.error(error);
  process.exit(1);
});
