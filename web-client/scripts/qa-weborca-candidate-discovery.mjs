import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  buildQaSession,
  createAuthenticatedContext,
  resolveQaFacilityId,
  resolveQaPasswordPlain,
  resolveQaUserId,
} from './qa-lib/session-auth.mjs';
import {
  buildCandidateDiscoveryGate,
  summarizeLocalSelectableDiagnostic,
  summarizeMedicalInformationReadiness,
  summarizeAppointmentDependency,
  summarizeInsuranceReadiness,
  summarizeOfficialPatientExistence,
  summarizeSelectorDiagnostic,
} from './qa-lib/orca-trial-preflight.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'https://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'weborca-candidate-discovery');
const preflightArtifactRoot =
  process.env.QA_PREFLIGHT_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'weborca-readonly-preflight');
const networkDir = path.join(artifactRoot, 'network');
const stepLogPath = path.join(artifactRoot, 'steps.log');
const summaryJsonPath = path.join(artifactRoot, 'summary.json');
const summaryMdPath = path.join(artifactRoot, 'summary.md');
const rowsJsonPath = path.join(artifactRoot, 'candidate-rows.json');
const consoleJsonPath = path.join(artifactRoot, 'console.json');
const pageErrorsJsonPath = path.join(artifactRoot, 'page-errors.json');
const preflightSummaryJsonPath = path.join(preflightArtifactRoot, 'summary.json');
const preflightSummaryMdPath = path.join(preflightArtifactRoot, 'summary.md');

fs.mkdirSync(networkDir, { recursive: true });
fs.mkdirSync(preflightArtifactRoot, { recursive: true });

const facilityId = resolveQaFacilityId();
const authUserId = resolveQaUserId();
const authPasswordPlain = resolveQaPasswordPlain();
const departmentCode = process.env.QA_DEPARTMENT_CODE ?? '01';
const physicianCode = process.env.QA_PHYSICIAN_CODE ?? '10001';
const paymentMode = process.env.QA_PAYMENT_MODE ?? 'insurance';
const visitKind = process.env.QA_VISIT_KIND ?? '1';
const requestedAppointmentFlowMode = process.env.QA_APPOINTMENT_FLOW_MODE?.trim() ?? 'direct_acceptance';
const sessionRole = process.env.QA_ROLE ?? 'admin';
const sessionRoles = process.env.QA_ROLES
  ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean)
  : [sessionRole];
const session = buildQaSession({
  facilityId,
  userId: authUserId,
  runId,
  scenarioLabel: 'weborca-candidate-discovery',
  sessionRole,
  sessionRoles,
});

const DEFAULT_CANDIDATES = Array.from({ length: 11 }, (_, index) => String(index + 1).padStart(5, '0'));
const REJECTED_LEGACY_SEED = '0000001';
const CANDIDATE_DISCOVERY_SOURCE = 'qa-weborca-candidate-discovery';
const CANDIDATE_DISCOVERY_FLOW_MODE = 'candidate-discovery-proposal';
const MUTATION_ROUTE_PATTERN =
  /\/api\/orca\/official\/(?:visits\/mutation|appointments\/mutation|patientmodv2\/outpatient\/(?:create|update)|patients\/(?:import|sync\/run))/;
const PATIENT_NOT_FOUND_PATTERN =
  /(patient[-_\s]*not[-_\s]*found|no\s+patient|患者番号に該当する患者が存在しません|該当する患者が存在しません|患者.*存在しません)/i;
const MEDICAL_INFORMATION_PROBE_PATH = '/api/orca/official/appointments/medical-information';
const OFFICIAL_PATIENT_GET_PATH = '/api/orca/official/patientgetv2';
const OFFICIAL_INSURANCE_PATH = '/api/orca/official/insurance/combinations';
const OFFICIAL_PATIENT_APPOINTMENTS_PATH = '/api/orca/official/appointments/patient';
const LOCAL_PATIENT_SEARCH_PATH = '/api/local/patients/search';

const consoleMessages = [];
const pageErrors = [];
const networkRecords = [];
const requestRecords = [];
const blockedMutationRequests = [];

const logStep = (label) => {
  fs.appendFileSync(stepLogPath, `[${new Date().toISOString()}] ${label}\n`, 'utf8');
};

const tokyoDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.QA_TIMEZONE ?? 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const baseDate = process.env.QA_BASE_DATE ?? process.env.QA_ACCEPTANCE_DATE ?? tokyoDate();

const unique = (values) => Array.from(new Set(values));

const parseCandidateEnv = () => {
  const raw = process.env.QA_WEBORCA_CANDIDATES ?? process.env.QA_CANDIDATE_PATIENT_IDS;
  if (!raw?.trim()) {
    return { source: 'default', candidates: DEFAULT_CANDIDATES };
  }
  const candidates = unique(
    raw
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  return { source: raw.includes(',') || raw.includes(' ') ? 'env-list' : 'env-single', candidates };
};

const redactHeaders = (headers) => {
  const out = { ...(headers ?? {}) };
  for (const key of Object.keys(out)) {
    if (/^(authorization|cookie|set-cookie|x-csrf-token|csrf-token|username|password)$/i.test(key)) {
      out[key] = '<<redacted>>';
    }
  }
  return out;
};

const redactUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.username) url.username = 'redacted';
    if (url.password) url.password = 'redacted';
    for (const key of [...url.searchParams.keys()]) {
      if (/auth|token|password|passwd|cookie|session|jsessionid/i.test(key)) {
        url.searchParams.set(key, '<<redacted>>');
      }
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return String(value).replace(/(Authorization|Cookie|JSESSIONID|password|passwd|token)=([^&\s]+)/gi, '$1=<<redacted>>');
  }
};

const asRecord = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const normalizeString = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const extractApiResult = (body) =>
  normalizeString(asRecord(body).apiResult ?? asRecord(body).Api_Result ?? asRecord(body).result ?? asRecord(body).Result);

const extractApiResultMessage = (body) =>
  normalizeString(
    asRecord(body).apiResultMessage ??
      asRecord(body).Api_Result_Message ??
      asRecord(body).message ??
      asRecord(body).Result_Message,
  );

const apiResultSuccess = (apiResult) => Boolean(apiResult && /^[0]+$/.test(String(apiResult)));

const messageCategory = (message) => {
  if (!message) return 'none';
  if (PATIENT_NOT_FOUND_PATTERN.test(message)) return 'patient-not-found';
  return 'other';
};

const containsPatientNotFound = (value) => {
  if (value == null) return false;
  if (typeof value === 'string') return PATIENT_NOT_FOUND_PATTERN.test(value);
  if (typeof value !== 'object') return false;
  const stack = [value];
  const visited = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }
    for (const [key, entry] of Object.entries(current)) {
      if (/name|kana|address|phone|zip|memo/i.test(key)) continue;
      if (typeof entry === 'string' && PATIENT_NOT_FOUND_PATTERN.test(entry)) return true;
      if (entry && typeof entry === 'object') stack.push(entry);
    }
  }
  return false;
};

const isPatientLike = (value) => {
  if (!value || typeof value !== 'object') return false;
  const record = value;
  return Boolean(
    record.patientId ??
      record.Patient_ID ??
      record.PatientId ??
      record.PatientID ??
      record.Patient_No ??
      record.Patient_Number ??
      record.summary?.patientId ??
      record.summary?.Patient_ID ??
      record.Patient_Information ??
      record.patientInformation,
  );
};

const countPatientLike = (value) => {
  const stack = [value];
  const visited = new Set();
  let count = 0;
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (isPatientLike(current)) count += 1;
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }
    for (const entry of Object.values(current)) {
      if (entry && typeof entry === 'object') stack.push(entry);
    }
  }
  return count;
};

const extractPatientIdValues = (value) => {
  const out = [];
  const stack = [value];
  const visited = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const entry of current) stack.push(entry);
      continue;
    }
    const record = current;
    const direct =
      record.patientId ??
      record.Patient_ID ??
      record.PatientId ??
      record.PatientID ??
      record.Patient_No ??
      record.Patient_Number ??
      record.summary?.patientId ??
      record.summary?.Patient_ID;
    const resolved = normalizeString(direct);
    if (resolved) out.push(resolved);
    for (const entry of Object.values(record)) {
      if (entry && typeof entry === 'object') stack.push(entry);
    }
  }
  return unique(out);
};

const summarizeBody = (bodyText) => {
  if (!bodyText) return { bodyChars: 0 };
  try {
    const parsed = JSON.parse(bodyText);
    return {
      bodyChars: bodyText.length,
      keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 20) : [],
      apiResult: extractApiResult(parsed) || undefined,
      apiResultMessageCategory: messageCategory(extractApiResultMessage(parsed)),
      recordsReturned: typeof parsed?.recordsReturned === 'number' ? parsed.recordsReturned : undefined,
      patientLikeCount: countPatientLike(parsed),
      patientIdCount: extractPatientIdValues(parsed).length,
      combinationsCount: Array.isArray(parsed?.combinations) ? parsed.combinations.length : undefined,
      reservationsCount: Array.isArray(parsed?.reservations) ? parsed.reservations.length : undefined,
      itemsCount: Array.isArray(parsed?.items) ? parsed.items.length : undefined,
      patientNotFound: containsPatientNotFound(parsed),
    };
  } catch {
    return { bodyChars: bodyText.length };
  }
};

const parseJsonBody = (bodyText) => {
  if (!bodyText) return {};
  try {
    return JSON.parse(bodyText);
  } catch {
    return {};
  }
};

const recordApiCall = async (context, { method, pathName, body, query }) => {
  const url = new URL(pathName, baseURL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value));
    }
  }
  requestRecords.push({
    url: redactUrl(url.toString()),
    method,
    headers: {},
    postData: body ? summarizeBody(JSON.stringify(body)) : { bodyChars: 0 },
  });
  const startedAt = Date.now();
  try {
    const response =
      method === 'GET'
        ? await context.request.get(url.toString())
        : await context.request.post(url.toString(), {
            data: body ?? {},
            headers: { 'Content-Type': 'application/json' },
          });
    const bodyText = await response.text().catch(() => '');
    const parsed = parseJsonBody(bodyText);
    networkRecords.push({
      url: redactUrl(url.toString()),
      status: response.status(),
      statusText: response.statusText(),
      durationMs: Date.now() - startedAt,
      request: {
        method,
        headers: {},
        postData: body ? summarizeBody(JSON.stringify(body)) : { bodyChars: 0 },
      },
      response: {
        headers: redactHeaders(response.headers()),
        body: summarizeBody(bodyText),
      },
    });
    return { status: response.status(), ok: response.ok(), body: parsed, error: '' };
  } catch (error) {
    networkRecords.push({
      url: redactUrl(url.toString()),
      status: 0,
      statusText: 'request-error',
      durationMs: Date.now() - startedAt,
      request: {
        method,
        headers: {},
        postData: body ? summarizeBody(JSON.stringify(body)) : { bodyChars: 0 },
      },
      response: { headers: {}, body: { bodyChars: 0, errorCategory: 'request-error' } },
    });
    return { status: 0, ok: false, body: {}, error: String(error) };
  }
};

const verdict = (accepted, verified = true) => {
  if (!verified) return 'not_verified';
  return accepted ? 'accepted' : 'rejected';
};

const evaluateMedicalInformation = async (context) => {
  const response = await recordApiCall(context, {
    method: 'GET',
    pathName: MEDICAL_INFORMATION_PROBE_PATH,
  });
  const apiResult = extractApiResult(response.body);
  const accepted = response.status === 200 && apiResultSuccess(apiResult);
  return {
    status: response.status,
    apiResult,
    itemsCount: Array.isArray(response.body?.items) ? response.body.items.length : undefined,
    verdict: verdict(accepted),
    accepted,
  };
};

const evaluateOfficialPatientExistence = async (context, patientId) => {
  const response = await recordApiCall(context, {
    method: 'GET',
    pathName: OFFICIAL_PATIENT_GET_PATH,
    query: { id: patientId, class: '01', format: 'json' },
  });
  const officialSummary = summarizeOfficialPatientExistence({
    httpStatus: response.status,
    body: response.body,
    candidateId: patientId,
  });
  return {
    ...officialSummary,
    status: officialSummary.httpStatus,
    apiResultMessageCategory: messageCategory(extractApiResultMessage(response.body)),
    patientLikeCount: countPatientLike(response.body),
  };
};

const evaluateInsuranceReadiness = async (context, patientId) => {
  const response = await recordApiCall(context, {
    method: 'POST',
    pathName: OFFICIAL_INSURANCE_PATH,
    body: { patientId, baseDate },
  });
  const apiResult = extractApiResult(response.body);
  const readiness = summarizeInsuranceReadiness({
    httpStatus: response.status,
    body: response.body,
    baseDate,
  });
  const accepted = readiness.accepted && !containsPatientNotFound(response.body);
  return {
    status: response.status,
    apiResult,
    classification: containsPatientNotFound(response.body) ? 'business_rejected_insurance' : readiness.classification,
    apiResultMessageCategory: messageCategory(extractApiResultMessage(response.body)),
    combinationsCount: readiness.combinationsCount,
    effectiveCount: readiness.effectiveCount,
    verdict: verdict(accepted),
    accepted,
  };
};

const evaluateAppointmentDependency = async (context, patientId) => {
  const response = await recordApiCall(context, {
    method: 'POST',
    pathName: OFFICIAL_PATIENT_APPOINTMENTS_PATH,
    body: { patientId, baseDate, departmentCode },
  });
  const apiResult = extractApiResult(response.body);
  const reservationsCount = Array.isArray(response.body?.reservations) ? response.body.reservations.length : 0;
  const dependency = summarizeAppointmentDependency({
    flowMode: requestedAppointmentFlowMode,
    httpStatus: response.status,
    body: response.body,
    apiResult,
    patientId,
    baseDate,
  });
  return {
    flowMode: dependency.flowMode,
    mode: dependency.mode,
    required: dependency.required,
    absenceBlocker: dependency.absenceBlocker,
    status: response.status,
    apiResult,
    classification: containsPatientNotFound(response.body) ? 'business_rejected_appointment' : dependency.classification,
    apiResultMessageCategory: messageCategory(extractApiResultMessage(response.body)),
    reservationCount: reservationsCount,
    exactRowCount: dependency.exactRowCount,
    dependency:
      dependency.flowMode === 'direct_acceptance'
        ? dependency.classification
        : reservationsCount > 0
          ? 'readonly_reservations_present'
          : 'appointment_row_missing',
    verdict: verdict(dependency.accepted && !containsPatientNotFound(response.body)),
    accepted: dependency.accepted && !containsPatientNotFound(response.body),
  };
};

const inspectSelectors = async (page) =>
  await page.evaluate(({ departmentCode, physicianCode, paymentMode, visitKind }) => {
    const inspect = (selector, desiredValue) => {
      const select = document.querySelector(selector);
      const options = select ? Array.from(select.querySelectorAll('option')).map((option) => option.value) : [];
      return {
        exists: Boolean(select),
        disabled: Boolean(select?.disabled || select?.getAttribute('aria-disabled') === 'true'),
        optionCount: options.length,
        hasDesiredValue: desiredValue ? options.includes(desiredValue) : true,
      };
    };
    return {
      department: inspect('#reception-accept-department', departmentCode),
      physician: inspect('#reception-accept-physician', physicianCode),
      visitKind: inspect('#reception-accept-visit-kind', visitKind),
      paymentMode: inspect('#reception-accept-payment-mode', paymentMode),
      medicalInformation: inspect('#reception-accept-medical-information', ''),
    };
  }, { departmentCode, physicianCode, paymentMode, visitKind });

const selectorReady = (selectors) =>
  Object.values(selectors).every(
    (item) => item.exists && item.disabled !== true && item.optionCount > 0 && item.hasDesiredValue !== false,
  );

const evaluateLocalUiReadiness = async (context, patientId) => {
  const page = await context.newPage();
  const localRequests = [];
  const localResponses = [];
  try {
    await page.route(MUTATION_ROUTE_PATTERN, async (route) => {
      const request = route.request();
      const row = {
        url: redactUrl(request.url()),
        method: request.method(),
        reason: 'mutation route blocked during read-only candidate discovery',
      };
      blockedMutationRequests.push(row);
      localRequests.push(row);
      await route.abort('blockedbyclient');
    });
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleMessages.push({ type, text: msg.text(), location: msg.location(), patientId });
      }
    });
    page.on('pageerror', (error) => pageErrors.push({ text: String(error), patientId }));
    page.on('request', (request) => {
      if (request.url().includes(LOCAL_PATIENT_SEARCH_PATH) || MUTATION_ROUTE_PATTERN.test(request.url())) {
        const record = {
          url: redactUrl(request.url()),
          method: request.method(),
          headers: redactHeaders(request.headers()),
          postData: summarizeBody(request.postData() ?? ''),
        };
        requestRecords.push(record);
        localRequests.push(record);
      }
    });
    page.on('response', async (response) => {
      if (!response.url().includes(LOCAL_PATIENT_SEARCH_PATH)) return;
      const bodyText = await response.text().catch(() => '');
      const record = {
        url: redactUrl(response.url()),
        status: response.status(),
        statusText: response.statusText(),
        request: {
          method: response.request().method(),
          headers: redactHeaders(response.request().headers()),
          postData: summarizeBody(response.request().postData() ?? ''),
        },
        response: {
          headers: redactHeaders(response.headers()),
          body: summarizeBody(bodyText),
        },
      };
      networkRecords.push(record);
      localResponses.push(record);
    });

    await page.goto(`/f/${encodeURIComponent(facilityId)}/reception`, { waitUntil: 'domcontentloaded' });
    await page.locator('.reception-page').waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: '既存患者受付/患者検索' }).click();
    const workflowModal = page.locator('[data-test-id="reception-accept-workflow-modal"]');
    await workflowModal.waitFor({ timeout: 20_000 });
    const patientSearchForm = workflowModal.locator('[data-test-id="reception-patient-search-form"]');
    await patientSearchForm.locator('#reception-patient-search-patient-id').fill(patientId);
    await patientSearchForm.locator('[data-test-id="reception-patient-search-submit"]').click();
    const resultListItems = workflowModal.locator('[role="region"][aria-label="患者検索結果モーダル"] [role="listitem"]');
    await resultListItems.first().waitFor({ timeout: 12_000 }).catch(() => null);
    const selectableCount = await resultListItems.count().catch(() => 0);
    const exactResult = resultListItems.filter({ hasText: patientId }).first();
    const exactResultCount = await resultListItems.filter({ hasText: patientId }).count().catch(() => 0);
    const selectable =
      exactResultCount === 1 &&
      (await exactResult
        .evaluate((node) => {
          if (!(node instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(node);
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            node.getClientRects().length > 0 &&
            node.getAttribute('aria-disabled') !== 'true'
          );
        })
        .catch(() => false));
    if (!selectable) {
      const reason =
        exactResultCount === 0
          ? 'local_exact_match_missing'
          : exactResultCount > 1
            ? 'local_exact_match_ambiguous'
            : 'local_exact_match_not_selectable';
      const localDiagnostic = summarizeLocalSelectableDiagnostic({
        patientId,
        selectableCount,
        exactResultCount,
        selectable: false,
        verdict: 'rejected',
        reason,
      });
      const selectorDiagnostic = summarizeSelectorDiagnostic({
        selectors: {},
        localSelectableDiagnostic: localDiagnostic,
      });
      return {
        localSelectable: {
          ...localDiagnostic,
          selectable: false,
          selectableCount,
          exactResultCount,
          verdict: 'rejected',
          reason,
        },
        selectorReadiness: {
          ...selectorDiagnostic,
          verdict: selectorDiagnostic.status,
          reason: selectorDiagnostic.reason,
          selectors: {},
        },
        diagnosticPatientNotFound: localResponses.some((record) => record.response?.body?.patientNotFound),
      };
    }
    await exactResult.click();
    const acceptForm = workflowModal.locator('[data-test-id="reception-accept-detail-modal"]');
    await acceptForm.waitFor({ timeout: 20_000 });
    await page
      .waitForFunction(
        () =>
          ['#reception-accept-department', '#reception-accept-physician', '#reception-accept-visit-kind', '#reception-accept-payment-mode'].every(
            (selector) => document.querySelector(selector)?.querySelectorAll('option').length,
          ),
        { timeout: 20_000 },
      )
      .catch(() => null);
    const selectors = await inspectSelectors(page);
    const ready = selectorReady(selectors);
    const localDiagnostic = summarizeLocalSelectableDiagnostic({
      patientId,
      selectableCount,
      exactResultCount,
      selectable: true,
      verdict: 'accepted',
    });
    const selectorDiagnostic = summarizeSelectorDiagnostic({
      selectors,
      localSelectableDiagnostic: localDiagnostic,
    });
    return {
      localSelectable: {
        ...localDiagnostic,
        selectable: true,
        selectableCount,
        exactResultCount,
        verdict: 'accepted',
      },
      selectorReadiness: {
        ...selectorDiagnostic,
        verdict: verdict(ready),
        status: selectorDiagnostic.status,
        reason: selectorDiagnostic.reason,
        accepted: ready && selectorDiagnostic.accepted,
        selectors: Object.fromEntries(
          Object.entries(selectors).map(([key, item]) => [
            key,
            {
              ...item,
              verdict: verdict(item.exists && item.optionCount > 0 && item.hasDesiredValue !== false),
            },
          ]),
        ),
      },
      diagnosticPatientNotFound: localResponses.some((record) => record.response?.body?.patientNotFound),
    };
  } catch (error) {
    const localDiagnostic = summarizeLocalSelectableDiagnostic({
      patientId,
      selectableCount: 0,
      exactResultCount: 0,
      verdict: 'rejected',
      reason: 'local_search_failed',
    });
    const selectorDiagnostic = summarizeSelectorDiagnostic({
      selectors: {},
      localSelectableDiagnostic: localDiagnostic,
    });
    return {
      localSelectable: {
        ...localDiagnostic,
        selectable: false,
        selectableCount: 0,
        exactResultCount: 0,
        verdict: 'rejected',
        errorCategory: 'ui-evaluation-error',
      },
      selectorReadiness: {
        ...selectorDiagnostic,
        verdict: selectorDiagnostic.status,
        reason: selectorDiagnostic.reason,
        selectors: {},
      },
      diagnosticPatientNotFound: false,
      errorCategory: 'ui-evaluation-error',
    };
  } finally {
    await page.close().catch(() => {});
  }
};

const buildRejectedLegacySeedRow = (patientId, source) => ({
  candidateId: patientId,
  patientId,
  source,
  accepted: false,
  rejectionReason: 'legacy_local_smoke_seed_rejected',
  acceptedForExactPreflightProposal: false,
  acceptedForPhase3Attempt: false,
  rejectedWarning: 'legacy local smoke seed is not accepted as a Trial-native candidate',
  officialPatientExistence: {
    httpStatus: 0,
    status: 0,
    apiResult: '',
    apiResultAccepted: false,
    patientInformationPresent: false,
    exactIdMatched: false,
    verdict: 'rejected',
    accepted: false,
    category: 'legacy_local_smoke_seed_rejected_without_probe',
    responseCategory: 'legacy_local_smoke_seed_rejected_without_probe',
    rejectionReason: 'legacy_local_smoke_seed_rejected',
  },
  insuranceReadiness: {
    status: 0,
    apiResult: '',
    classification: 'not_verified',
    accepted: false,
    verdict: 'not_verified',
  },
  selectorReadiness: { verdict: 'not_verified' },
  localSelectable: { verdict: 'not_verified' },
  medicalInformationReadiness: {
    verdict: 'not_verified',
    accepted: false,
    reason: 'legacy_local_smoke_seed_rejected',
    failedSubdimensions: ['required_identity_fields_match'],
  },
  appointmentDependency: {
    flowMode: requestedAppointmentFlowMode,
    required: requestedAppointmentFlowMode === 'appointment_row',
    status: 0,
    apiResult: '',
    classification: 'not_verified',
    accepted: false,
    verdict: 'not_verified',
  },
  diagnosticNoPatientNotFound: { verdict: 'not_verified' },
  mutationProhibited: {
    verdict: 'accepted',
    blockedRequestCount: 0,
  },
});

const resolveCandidateRejectionReason = ({
  medicalInformationProbe,
  medicalInformationReadiness,
  officialPatientExistence,
  insuranceReadiness,
  appointmentDependency,
  uiReadiness,
  diagnosticNoPatientNotFound,
  mutationProhibited,
}) => {
  if (medicalInformationProbe.accepted !== true || medicalInformationReadiness?.accepted === false) return 'medical_information_not_ready';
  if (officialPatientExistence.accepted !== true) return officialPatientExistence.rejectionReason ?? 'official_patient_missing';
  if (insuranceReadiness.accepted !== true) return insuranceReadiness.classification ?? 'insurance_not_ready';
  if (appointmentDependency.accepted !== true) return appointmentDependency.classification ?? 'appointment_dependency_not_ready';
  if (uiReadiness.localSelectable.selectable !== true) return uiReadiness.localSelectable.reason ?? 'local_selectable_not_ready';
  if (uiReadiness.selectorReadiness.accepted !== true) return uiReadiness.selectorReadiness.reason ?? 'selector_not_ready';
  if (diagnosticNoPatientNotFound.accepted !== true) return 'patient_not_found_wording_detected';
  if (mutationProhibited.blockedRequestCount > 0) return 'readonly_mutation_attempt_blocked';
  return 'none';
};

const evaluateCandidate = async (context, medicalInformationProbe, patientId, source) => {
  logStep(`candidate ${patientId} evaluation start`);
  if (patientId === REJECTED_LEGACY_SEED) {
    logStep(`candidate ${patientId} rejected as legacy local smoke seed`);
    return buildRejectedLegacySeedRow(patientId, source);
  }
  const officialPatientExistence = await evaluateOfficialPatientExistence(context, patientId);
  const insuranceReadiness = await evaluateInsuranceReadiness(context, patientId);
  const appointmentDependency = await evaluateAppointmentDependency(context, patientId);
  const uiReadiness = await evaluateLocalUiReadiness(context, patientId);
  const patientNotFoundDetected =
    officialPatientExistence.category === 'not_found' ||
    officialPatientExistence.apiResultMessageCategory === 'patient-not-found' ||
    insuranceReadiness.apiResultMessageCategory === 'patient-not-found' ||
    appointmentDependency.apiResultMessageCategory === 'patient-not-found' ||
    uiReadiness.diagnosticPatientNotFound === true;
  const diagnosticNoPatientNotFound = {
    verdict: verdict(!patientNotFoundDetected),
    accepted: !patientNotFoundDetected,
  };
  const mutationProhibited = {
    verdict: verdict(blockedMutationRequests.length === 0),
    blockedRequestCount: blockedMutationRequests.length,
  };
  const medicalInformationReadiness = summarizeMedicalInformationReadiness({
    patientId,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformation: '',
    medicalInformationState: { state: 'omitted' },
    medicalInformationProbe,
    selectorDiagnostic: uiReadiness.selectorReadiness,
    localSelectableDiagnostic: uiReadiness.localSelectable,
  });
  const rejectionReason = resolveCandidateRejectionReason({
    medicalInformationProbe,
    medicalInformationReadiness,
    officialPatientExistence,
    insuranceReadiness,
    appointmentDependency,
    uiReadiness,
    diagnosticNoPatientNotFound,
    mutationProhibited,
  });
  const acceptedForExactPreflightProposal =
    medicalInformationProbe.accepted === true &&
    medicalInformationReadiness.accepted === true &&
    officialPatientExistence.accepted === true &&
    insuranceReadiness.accepted === true &&
    appointmentDependency.accepted === true &&
    uiReadiness.localSelectable.selectable === true &&
    uiReadiness.selectorReadiness.accepted === true &&
    diagnosticNoPatientNotFound.accepted === true &&
    blockedMutationRequests.length === 0;
  const row = {
    candidateId: patientId,
    patientId,
    source,
    accepted: acceptedForExactPreflightProposal,
    rejectionReason: acceptedForExactPreflightProposal ? 'none' : rejectionReason,
    acceptedForExactPreflightProposal,
    acceptedForPhase3Attempt: false,
    officialPatientExistence,
    insuranceReadiness,
    selectorReadiness: uiReadiness.selectorReadiness,
    localSelectable: uiReadiness.localSelectable,
    medicalInformationReadiness,
    appointmentDependency,
    diagnosticNoPatientNotFound,
    mutationProhibited,
  };
  logStep(`candidate ${patientId} acceptedForExactPreflightProposal=${acceptedForExactPreflightProposal}`);
  return row;
};

const buildPreflightSummary = ({ acceptedRow, summary, medicalInformationProbe }) => {
  const selectedCandidate = acceptedRow
    ? {
        kind: 'proposal',
        patientId: acceptedRow.patientId,
        rowPath: path.relative(preflightArtifactRoot, rowsJsonPath),
        requiredNextStep: 'run qa-weborca-readonly-preflight.mjs for exact selected-candidate preflight with the same RUN_ID before Phase 3',
      }
    : null;
  const gate = buildCandidateDiscoveryGate({
    candidateCount: summary.candidateCount,
    acceptedCandidateCount: summary.acceptedCandidateCount ?? 0,
    blockedRequestCount: summary.mutationPolicy?.blockedRequestCount ?? 0,
    selectedCandidate,
  });
  if (!acceptedRow) {
    return {
      runId,
      executedAt: new Date().toISOString(),
      source: CANDIDATE_DISCOVERY_SOURCE,
      flowMode: CANDIDATE_DISCOVERY_FLOW_MODE,
      candidateDiscoveryAloneAuthorizesPhase3: false,
      discoverySummaryPath: path.relative(preflightArtifactRoot, summaryJsonPath),
      baseURL: redactUrl(baseURL),
      facilityId,
      sessionRole,
      patientSearch: { patientId: '', selectable: false, selectableCount: 0, verdict: 'rejected' },
      selectors: {},
      medicalInformationProbe,
      medicalInformationReadiness: {
        status: 'not_verified',
        verdict: 'not_verified',
        accepted: false,
        reason: 'no_accepted_candidate',
        failedSubdimensions: ['required_identity_fields_match'],
        rawSensitiveFieldsExcluded: true,
      },
      acceptedForPhase3Attempt: gate.acceptedForPhase3Attempt,
      selectedCandidate,
      phase3AttemptPatientId: gate.phase3AttemptPatientId,
      exactSelectedCandidatePreflight: gate.exactSelectedCandidatePreflight,
      phase3: gate.phase3,
      phase4: gate.phase4,
      mutationPolicy: summary.mutationPolicy ?? gate.mutationPolicy,
      verdict: 'rejected',
      blockerClassification: gate.blockerClassification,
      blockerReason: gate.blockerReason,
      c7Gate: {
        status: 'not verified',
        reason: 'read-only candidate discovery does not execute visits mutation',
      },
      candidateDiscovery: {
        ...gate.candidateDiscovery,
        verdict: gate.releaseVerdict,
        readinessAxes: summary.readinessAxes,
      },
    };
  }
  return {
    runId,
    executedAt: new Date().toISOString(),
    source: CANDIDATE_DISCOVERY_SOURCE,
    flowMode: CANDIDATE_DISCOVERY_FLOW_MODE,
    candidateDiscoveryAloneAuthorizesPhase3: false,
    discoverySummaryPath: path.relative(preflightArtifactRoot, summaryJsonPath),
    baseURL: redactUrl(baseURL),
    facilityId,
    sessionRole,
    login: summary.login,
    patientSearch: {
      patientId: acceptedRow.patientId,
      selectable: acceptedRow.localSelectable.selectable,
      selectableCount: acceptedRow.localSelectable.selectableCount,
      verdict: acceptedRow.localSelectable.verdict,
    },
    selectors: acceptedRow.selectorReadiness.selectors ?? {},
    medicalInformationProbe,
    medicalInformationReadiness: acceptedRow.medicalInformationReadiness,
    officialPatientExistence: acceptedRow.officialPatientExistence,
    insuranceReadiness: acceptedRow.insuranceReadiness,
    appointmentDependency: acceptedRow.appointmentDependency,
    diagnosticNoPatientNotFound: acceptedRow.diagnosticNoPatientNotFound,
    acceptedForPhase3Attempt: gate.acceptedForPhase3Attempt,
    selectedCandidate,
    phase3AttemptPatientId: gate.phase3AttemptPatientId,
    exactSelectedCandidatePreflight: gate.exactSelectedCandidatePreflight,
    phase3: gate.phase3,
    phase4: gate.phase4,
    mutationPolicy: summary.mutationPolicy ?? gate.mutationPolicy,
    verdict: 'rejected',
    blockerClassification: gate.blockerClassification,
    blockerReason: 'candidate discovery proposes a patient but exact read-only preflight is still required',
    c7Gate: {
      status: 'not verified',
      reason: 'read-only candidate discovery does not execute visits mutation',
    },
    candidateDiscovery: {
      ...gate.candidateDiscovery,
      verdict: gate.releaseVerdict,
      readinessAxes: summary.readinessAxes,
    },
  };
};

const buildMarkdownSummary = (summary) =>
  `# WebORCA Trial candidate discovery\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- verdict: ${summary.releaseVerdict}\n` +
  `- blockerClassification: ${summary.blockerClassification}\n` +
  `- blockerReason: ${summary.blockerReason ?? 'none'}\n` +
  `- candidates: ${summary.candidateCount}\n` +
  `- acceptedForPhase3Attempt: ${summary.acceptedForPhase3Attempt === true ? 'true' : 'false'}\n` +
  `- selectedCandidate: ${summary.selectedCandidate?.patientId ?? 'none'}\n` +
  `- candidateDiscoveryAloneAuthorizesPhase3: ${summary.candidateDiscoveryAloneAuthorizesPhase3 === false ? 'false' : 'unknown'}\n` +
  `- preflightSummary: ${path.relative(artifactRoot, preflightSummaryJsonPath)}\n` +
  `- mutationBlockedRequests: ${summary.mutationPolicy.blockedRequestCount}\n\n` +
  `## Candidate rows\n\n` +
  summary.candidates
    .map(
      (candidate) =>
        `- ${candidate.patientId}: proposal=${candidate.acceptedForExactPreflightProposal ? 'accepted' : 'rejected'}, phase3=rejected, ` +
        `official=${candidate.officialPatientExistence.verdict}, ` +
        `insurance=${candidate.insuranceReadiness.verdict}/${candidate.insuranceReadiness.status ?? 'none'}/${candidate.insuranceReadiness.apiResult || 'none'}/${candidate.insuranceReadiness.classification ?? 'none'}/${candidate.insuranceReadiness.accepted ? 'accepted' : 'rejected'}, ` +
        `local=${candidate.localSelectable.verdict}/${candidate.localSelectable.reason ?? 'none'}, selectors=${candidate.selectorReadiness.verdict}/${candidate.selectorReadiness.reason ?? 'none'}, ` +
        `medicalInfo=${candidate.medicalInformationReadiness?.verdict ?? 'not_verified'}/${candidate.medicalInformationReadiness?.failedSubdimensions?.join('|') || 'none'}, ` +
        `appointment=${candidate.appointmentDependency.verdict}/${candidate.appointmentDependency.flowMode ?? 'unknown'}/${candidate.appointmentDependency.required ? 'required' : 'not_required'}/${candidate.appointmentDependency.status ?? 'none'}/${candidate.appointmentDependency.apiResult || 'none'}/${candidate.appointmentDependency.classification ?? 'none'}/${candidate.appointmentDependency.accepted ? 'accepted' : 'rejected'}, ` +
        `noPatientNotFound=${candidate.diagnosticNoPatientNotFound.verdict}`,
    )
    .join('\n') +
  '\n';

const buildPreflightMarkdown = (summary) =>
  `# WebORCA read-only preflight\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- source: ${summary.source}\n` +
  `- verdict: ${summary.verdict}\n` +
  `- candidateDiscoveryAloneAuthorizesPhase3: ${summary.candidateDiscoveryAloneAuthorizesPhase3 === false ? 'false' : 'unknown'}\n` +
  `- blockerClassification: ${summary.blockerClassification}\n` +
  `- blockerReason: ${summary.blockerReason ?? 'none'}\n` +
  `- acceptedForPhase3Attempt: ${summary.acceptedForPhase3Attempt === true ? 'true' : 'false'}\n` +
  `- selectedCandidate: ${summary.selectedCandidate?.patientId ?? 'none'}\n` +
  `- discoverySummaryPath: ${summary.discoverySummaryPath}\n`;

const buildReadinessAxes = (rows) => ({
  meaning:
    '00001-00011 are official ORCA Trial initial patients; zero accepted candidates means Phase 3 mutation-ready read-only evidence is incomplete and does not contradict official initial patient registration.',
  officialTrialInitialPatientsExistenceAssumption: 'registered_by_official_orca_trial_docs',
  patientgetv2: rows.map((row) => ({
    patientId: row.patientId,
    status: row.officialPatientExistence?.status ?? row.officialPatientExistence?.httpStatus ?? 0,
    parsedOrcaBody: row.officialPatientExistence?.parsedOrcaBody === true,
    apiResult: row.officialPatientExistence?.apiResult ?? '',
    apiResultAccepted: row.officialPatientExistence?.apiResultAccepted === true,
    patientInformationPresent: row.officialPatientExistence?.patientInformationPresent === true,
    exactPatientIdMatched: row.officialPatientExistence?.exactIdMatched === true,
    patientNotFoundWordingAbsent: row.officialPatientExistence?.notFoundMessage !== true,
    category: row.officialPatientExistence?.category ?? row.officialPatientExistence?.responseCategory ?? '',
    accepted: row.officialPatientExistence?.accepted === true,
    rejectionReason: row.officialPatientExistence?.rejectionReason ?? '',
  })),
  insuranceReadiness: rows.map((row) => ({
    patientId: row.patientId,
    status: row.insuranceReadiness?.status ?? 0,
    apiResult: row.insuranceReadiness?.apiResult ?? '',
    classification: row.insuranceReadiness?.classification ?? '',
    combinationsCount: row.insuranceReadiness?.combinationsCount ?? 0,
    effectiveCount: row.insuranceReadiness?.effectiveCount ?? 0,
    accepted: row.insuranceReadiness?.accepted === true,
  })),
  appointmentDependency: rows.map((row) => ({
    patientId: row.patientId,
    flowMode: row.appointmentDependency?.flowMode ?? 'unknown',
    required: row.appointmentDependency?.required === true,
    status: row.appointmentDependency?.status ?? 0,
    apiResult: row.appointmentDependency?.apiResult ?? '',
    classification: row.appointmentDependency?.classification ?? '',
    exactRowCount: row.appointmentDependency?.exactRowCount ?? 0,
    accepted: row.appointmentDependency?.accepted === true,
  })),
  localSelectableReadiness: rows.map((row) => ({
    patientId: row.patientId,
    selectableCount: row.localSelectable?.selectableCount ?? 0,
    exactResultCount: row.localSelectable?.exactResultCount ?? 0,
    verdict: row.localSelectable?.verdict ?? 'not_verified',
    accepted: row.localSelectable?.selectable === true,
    reason: row.localSelectable?.reason ?? '',
  })),
  selectorReadiness: rows.map((row) => ({
    patientId: row.patientId,
    requested: {
      departmentCode,
      physicianCode,
      paymentMode,
      visitKind,
    },
    verdict: row.selectorReadiness?.verdict ?? 'not_verified',
    accepted: row.selectorReadiness?.accepted === true,
    selectors: row.selectorReadiness?.selectors ?? {},
    diagnostic: {
      status: row.selectorReadiness?.status ?? row.selectorReadiness?.verdict ?? 'not_verified',
      reason: row.selectorReadiness?.reason ?? 'unknown',
      fields: row.selectorReadiness?.fields ?? {},
    },
  })),
  medicalInformationReadiness: rows.map((row) => ({
    patientId: row.patientId,
    status: row.medicalInformationReadiness?.status ?? row.medicalInformationReadiness?.verdict ?? 'not_verified',
    accepted: row.medicalInformationReadiness?.accepted === true,
    reason: row.medicalInformationReadiness?.reason ?? 'unknown',
    failedSubdimensions: row.medicalInformationReadiness?.failedSubdimensions ?? [],
    dimensions: row.medicalInformationReadiness?.dimensions ?? {},
  })),
  diagnostics: rows.map((row) => ({
    patientId: row.patientId,
    acceptedForExactPreflightProposal: row.acceptedForExactPreflightProposal === true,
    acceptedForPhase3Attempt: row.acceptedForPhase3Attempt === true,
    patientNotFoundWordingAbsent: row.diagnosticNoPatientNotFound?.accepted === true,
    verdict: row.diagnosticNoPatientNotFound?.verdict ?? 'not_verified',
    mutationProhibited: true,
    blockedRequestCount: row.mutationProhibited?.blockedRequestCount ?? 0,
  })),
});

let browser;
let context;

try {
  const { source: candidateSource, candidates } = parseCandidateEnv();
  if (candidates.includes(REJECTED_LEGACY_SEED)) {
    logStep(`${REJECTED_LEGACY_SEED} was provided and will be rejected without probing`);
  }
  browser = await chromium.launch({ headless: true });
  const auth = await createAuthenticatedContext(browser, {
    baseURL,
    facilityId,
    userId: authUserId,
    password: authPasswordPlain,
    session,
  });
  context = auth.context;
  const sessionMe = auth.sessionMe;
  await auth.page.close().catch(() => {});

  const medicalInformationProbe = await evaluateMedicalInformation(context);
  const rows = [];
  for (const patientId of candidates) {
    rows.push(await evaluateCandidate(context, medicalInformationProbe, patientId, candidateSource));
  }

  const acceptedRow = rows.find((row) => row.acceptedForExactPreflightProposal === true) ?? null;
  const acceptedCandidateCount = rows.filter((row) => row.acceptedForExactPreflightProposal === true).length;
  const selectedCandidate = acceptedRow
    ? {
        kind: 'proposal',
        patientId: acceptedRow.patientId,
        rowPath: path.relative(artifactRoot, rowsJsonPath),
        requiredNextStep: 'run qa-weborca-readonly-preflight.mjs for exact selected-candidate preflight with the same RUN_ID before Phase 3',
      }
    : null;
  const discoveryGate = buildCandidateDiscoveryGate({
    candidateCount: rows.length,
    acceptedCandidateCount,
    blockedRequestCount: blockedMutationRequests.length,
    selectedCandidate,
  });
  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    source: CANDIDATE_DISCOVERY_SOURCE,
    flowMode: CANDIDATE_DISCOVERY_FLOW_MODE,
    baseURL: redactUrl(baseURL),
    facilityId,
    sessionRole,
    login: { sessionMeStatus: sessionMe.status },
    candidateSource,
    candidateCount: rows.length,
    baseDate,
    requestedSelectorValues: {
      departmentCode,
      physicianCode,
      paymentMode,
      visitKind,
    },
    medicalInformationProbe,
    candidates: rows,
    readinessAxes: buildReadinessAxes(rows),
    acceptedCandidateCount,
    selectedCandidate,
    ...discoveryGate,
    mutationPolicy: {
      ...discoveryGate.mutationPolicy,
      blockedRequests: blockedMutationRequests,
    },
    preflightSummaryPath: path.relative(artifactRoot, preflightSummaryJsonPath),
    consoleMessages,
    pageErrors,
  };
  const preflightSummary = buildPreflightSummary({ acceptedRow, summary, medicalInformationProbe });

  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords, null, 2), 'utf8');
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords, null, 2), 'utf8');
  fs.writeFileSync(consoleJsonPath, JSON.stringify(consoleMessages, null, 2), 'utf8');
  fs.writeFileSync(pageErrorsJsonPath, JSON.stringify(pageErrors, null, 2), 'utf8');
  fs.writeFileSync(rowsJsonPath, JSON.stringify(rows, null, 2), 'utf8');
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(summaryMdPath, buildMarkdownSummary(summary), 'utf8');
  fs.writeFileSync(preflightSummaryJsonPath, JSON.stringify(preflightSummary, null, 2), 'utf8');
  fs.writeFileSync(preflightSummaryMdPath, buildPreflightMarkdown(preflightSummary), 'utf8');

  await context.close();
  await browser.close();
  console.log(JSON.stringify(summary, null, 2));
  if (!acceptedRow) {
    process.exit(1);
  }
} catch (error) {
  logStep(`fatal error=${String(error)}`);
  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords, null, 2), 'utf8');
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords, null, 2), 'utf8');
  fs.writeFileSync(consoleJsonPath, JSON.stringify(consoleMessages, null, 2), 'utf8');
  fs.writeFileSync(pageErrorsJsonPath, JSON.stringify(pageErrors, null, 2), 'utf8');
  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    source: CANDIDATE_DISCOVERY_SOURCE,
    flowMode: CANDIDATE_DISCOVERY_FLOW_MODE,
    baseURL: redactUrl(baseURL),
    facilityId,
    acceptedForPhase3Attempt: false,
    selectedCandidate: null,
    candidateDiscoveryAloneAuthorizesPhase3: false,
    releaseVerdict: 'PARTIAL / ENVIRONMENT BLOCKER',
    verdict: 'rejected',
    blockerClassification: 'environment-blocker',
    fatalError: String(error),
    mutationPolicy: {
      prohibited: true,
      blockedRequestCount: blockedMutationRequests.length,
      blockedRequests: blockedMutationRequests,
    },
  };
  const preflightSummary = {
    runId,
    executedAt: new Date().toISOString(),
    source: CANDIDATE_DISCOVERY_SOURCE,
    flowMode: CANDIDATE_DISCOVERY_FLOW_MODE,
    candidateDiscoveryAloneAuthorizesPhase3: false,
    discoverySummaryPath: path.relative(preflightArtifactRoot, summaryJsonPath),
    baseURL: redactUrl(baseURL),
    facilityId,
    patientSearch: { patientId: '', selectable: false, selectableCount: 0, verdict: 'rejected' },
    selectors: {},
    acceptedForPhase3Attempt: false,
    selectedCandidate: null,
    phase3AttemptPatientId: null,
    phase3: { ran: false, reason: 'candidate_discovery_environment_failure' },
    phase4: { ran: false, reason: 'phase3_not_run' },
    verdict: 'rejected',
    blockerClassification: 'environment-blocker',
    blockerReason: 'candidate_discovery_environment_failure',
    c7Gate: {
      status: 'not verified',
      reason: 'read-only candidate discovery does not execute visits mutation',
    },
  };
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(summaryMdPath, buildMarkdownSummary({ ...summary, candidates: [], candidateCount: 0, acceptedForPhase3Attempt: null }), 'utf8');
  fs.writeFileSync(preflightSummaryJsonPath, JSON.stringify(preflightSummary, null, 2), 'utf8');
  fs.writeFileSync(preflightSummaryMdPath, buildPreflightMarkdown(preflightSummary), 'utf8');
  await context?.close?.().catch(() => {});
  await browser?.close?.().catch(() => {});
  console.error(error);
  process.exit(1);
}
