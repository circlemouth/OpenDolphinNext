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

const countArrayByNames = (body, names) => {
  const stack = [{ key: '', value: body }];
  const visited = new Set();
  let count = 0;
  while (stack.length) {
    const current = stack.pop();
    if (!current || current.value == null) continue;
    const { key, value } = current;
    if (typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    if (Array.isArray(value) && names.some((name) => key.toLowerCase().includes(name))) {
      count += value.length;
    }
    if (Array.isArray(value)) {
      for (const entry of value) stack.push({ key, value: entry });
      continue;
    }
    for (const [childKey, entry] of Object.entries(value)) {
      if (entry && typeof entry === 'object') stack.push({ key: childKey, value: entry });
    }
  }
  return count;
};

const categorizeInitialPatientInfo = (body, requestedPatientId) => {
  const patientsFound = countPatientLike(body);
  const patientIds = extractPatientIdValues(body);
  const patientIdMatched = patientIds.includes(requestedPatientId);
  const insuranceCount = countArrayByNames(body, ['insurance', 'hoken']);
  if (containsPatientNotFound(body)) return 'not_found';
  if (!patientsFound && !patientIds.length) return 'empty';
  if (!patientIdMatched && patientIds.length) return 'different_patient_id_present';
  if (insuranceCount > 0) return 'present_with_insurance_category';
  return 'present_without_insurance_category';
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
  const apiResult = extractApiResult(response.body);
  const category = categorizeInitialPatientInfo(response.body, patientId);
  const patientIdMatched = extractPatientIdValues(response.body).includes(patientId);
  const accepted =
    response.status === 200 &&
    !containsPatientNotFound(response.body) &&
    category !== 'empty' &&
    category !== 'not_found' &&
    patientIdMatched;
  return {
    status: response.status,
    apiResult,
    apiResultMessageCategory: messageCategory(extractApiResultMessage(response.body)),
    category,
    patientIdMatched,
    patientLikeCount: countPatientLike(response.body),
    verdict: verdict(accepted),
    accepted,
  };
};

const evaluateInsuranceReadiness = async (context, patientId) => {
  const response = await recordApiCall(context, {
    method: 'POST',
    pathName: OFFICIAL_INSURANCE_PATH,
    body: { patientId, baseDate },
  });
  const apiResult = extractApiResult(response.body);
  const combinationsCount = Array.isArray(response.body?.combinations) ? response.body.combinations.length : 0;
  const accepted =
    response.status === 200 &&
    apiResultSuccess(apiResult) &&
    combinationsCount > 0 &&
    !containsPatientNotFound(response.body);
  return {
    status: response.status,
    apiResult,
    apiResultMessageCategory: messageCategory(extractApiResultMessage(response.body)),
    combinationsCount,
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
  const noPatientNotFound = !containsPatientNotFound(response.body);
  const accepted = response.status === 200 && noPatientNotFound;
  return {
    status: response.status,
    apiResult,
    apiResultMessageCategory: messageCategory(extractApiResultMessage(response.body)),
    reservationCount: reservationsCount,
    dependency: reservationsCount > 0 ? 'readonly_reservations_present' : 'no_trial_appointment_dependency_detected',
    verdict: verdict(accepted),
    accepted,
  };
};

const inspectSelectors = async (page) =>
  await page.evaluate(({ departmentCode, physicianCode, paymentMode, visitKind }) => {
    const inspect = (selector, desiredValue) => {
      const select = document.querySelector(selector);
      const options = select ? Array.from(select.querySelectorAll('option')).map((option) => option.value) : [];
      return {
        exists: Boolean(select),
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
  Object.values(selectors).every((item) => item.exists && item.optionCount > 0 && item.hasDesiredValue !== false);

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
      return {
        localSelectable: {
          selectable: false,
          selectableCount,
          exactResultCount,
          verdict: 'rejected',
          reason,
        },
        selectorReadiness: {
          verdict: 'not_verified',
          reason,
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
    return {
      localSelectable: {
        selectable: true,
        selectableCount,
        exactResultCount,
        verdict: 'accepted',
      },
      selectorReadiness: {
        verdict: verdict(ready),
        accepted: ready,
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
    return {
      localSelectable: {
        selectable: false,
        selectableCount: 0,
        exactResultCount: 0,
        verdict: 'rejected',
        errorCategory: 'ui-evaluation-error',
      },
      selectorReadiness: {
        verdict: 'not_verified',
        reason: 'ui evaluation failed before selector inspection',
        selectors: {},
      },
      diagnosticPatientNotFound: false,
      errorCategory: 'ui-evaluation-error',
    };
  } finally {
    await page.close().catch(() => {});
  }
};

const buildRejectedLegacySeedRow = (patientId) => ({
  patientId,
  acceptedForPhase3Attempt: false,
  rejectedWarning: 'legacy local smoke seed is not accepted as a Trial-native candidate',
  officialPatientExistence: {
    verdict: 'rejected',
    accepted: false,
    category: 'legacy_local_smoke_seed_rejected_without_probe',
  },
  insuranceReadiness: { verdict: 'not_verified' },
  selectorReadiness: { verdict: 'not_verified' },
  localSelectable: { verdict: 'not_verified' },
  appointmentDependency: { verdict: 'not_verified' },
  diagnosticNoPatientNotFound: { verdict: 'not_verified' },
  mutationProhibited: {
    verdict: 'accepted',
    blockedRequestCount: 0,
  },
});

const evaluateCandidate = async (context, medicalInformationProbe, patientId) => {
  logStep(`candidate ${patientId} evaluation start`);
  if (patientId === REJECTED_LEGACY_SEED) {
    logStep(`candidate ${patientId} rejected as legacy local smoke seed`);
    return buildRejectedLegacySeedRow(patientId);
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
  const acceptedForPhase3Attempt =
    medicalInformationProbe.accepted === true &&
    officialPatientExistence.accepted === true &&
    insuranceReadiness.accepted === true &&
    appointmentDependency.accepted === true &&
    uiReadiness.localSelectable.selectable === true &&
    uiReadiness.selectorReadiness.accepted === true &&
    diagnosticNoPatientNotFound.accepted === true &&
    blockedMutationRequests.length === 0;
  const row = {
    patientId,
    acceptedForPhase3Attempt,
    officialPatientExistence,
    insuranceReadiness,
    selectorReadiness: uiReadiness.selectorReadiness,
    localSelectable: uiReadiness.localSelectable,
    appointmentDependency,
    diagnosticNoPatientNotFound,
    mutationProhibited,
  };
  logStep(`candidate ${patientId} acceptedForPhase3Attempt=${acceptedForPhase3Attempt}`);
  return row;
};

const buildPreflightSummary = ({ acceptedRow, summary, medicalInformationProbe }) => {
  if (!acceptedRow) {
    return {
      runId,
      executedAt: new Date().toISOString(),
      source: 'qa-weborca-candidate-discovery',
      discoverySummaryPath: path.relative(preflightArtifactRoot, summaryJsonPath),
      baseURL: redactUrl(baseURL),
      facilityId,
      sessionRole,
      patientSearch: { patientId: '', selectable: false, selectableCount: 0, verdict: 'rejected' },
      selectors: {},
      medicalInformationProbe,
      acceptedForPhase3Attempt: null,
      phase3AttemptPatientId: null,
      verdict: 'rejected',
      blockerClassification: 'test-data-blocker',
      blockerReason: 'no_trial_native_mutation_ready_candidate',
      c7Gate: {
        status: 'not verified',
        reason: 'read-only candidate discovery does not execute visits mutation',
      },
      candidateDiscovery: {
        verdict: summary.releaseVerdict,
        candidateCount: summary.candidateCount,
        acceptedCandidateCount: 0,
      },
    };
  }
  return {
    runId,
    executedAt: new Date().toISOString(),
    source: 'qa-weborca-candidate-discovery',
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
    officialPatientExistence: acceptedRow.officialPatientExistence,
    insuranceReadiness: acceptedRow.insuranceReadiness,
    appointmentDependency: acceptedRow.appointmentDependency,
    diagnosticNoPatientNotFound: acceptedRow.diagnosticNoPatientNotFound,
    acceptedForPhase3Attempt: {
      patientId: acceptedRow.patientId,
      rowPath: path.relative(preflightArtifactRoot, rowsJsonPath),
    },
    phase3AttemptPatientId: acceptedRow.patientId,
    verdict: 'accepted',
    blockerClassification: 'none',
    c7Gate: {
      status: 'not verified',
      reason: 'read-only candidate discovery does not execute visits mutation',
    },
    candidateDiscovery: {
      verdict: summary.releaseVerdict,
      candidateCount: summary.candidateCount,
      acceptedCandidateCount: summary.acceptedCandidateCount,
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
  `- acceptedForPhase3Attempt: ${summary.acceptedForPhase3Attempt?.patientId ?? 'none'}\n` +
  `- preflightSummary: ${path.relative(artifactRoot, preflightSummaryJsonPath)}\n` +
  `- mutationBlockedRequests: ${summary.mutationPolicy.blockedRequestCount}\n\n` +
  `## Candidate rows\n\n` +
  summary.candidates
    .map(
      (candidate) =>
        `- ${candidate.patientId}: phase3=${candidate.acceptedForPhase3Attempt ? 'accepted' : 'rejected'}, ` +
        `official=${candidate.officialPatientExistence.verdict}, insurance=${candidate.insuranceReadiness.verdict}, ` +
        `local=${candidate.localSelectable.verdict}, selectors=${candidate.selectorReadiness.verdict}, ` +
        `appointment=${candidate.appointmentDependency.verdict}, noPatientNotFound=${candidate.diagnosticNoPatientNotFound.verdict}`,
    )
    .join('\n') +
  '\n';

const buildPreflightMarkdown = (summary) =>
  `# WebORCA read-only preflight\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- source: ${summary.source}\n` +
  `- verdict: ${summary.verdict}\n` +
  `- blockerClassification: ${summary.blockerClassification}\n` +
  `- blockerReason: ${summary.blockerReason ?? 'none'}\n` +
  `- acceptedForPhase3Attempt: ${summary.acceptedForPhase3Attempt?.patientId ?? 'none'}\n` +
  `- discoverySummaryPath: ${summary.discoverySummaryPath}\n`;

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
    rows.push(await evaluateCandidate(context, medicalInformationProbe, patientId));
  }

  const acceptedRow = rows.find((row) => row.acceptedForPhase3Attempt === true) ?? null;
  const acceptedCandidateCount = rows.filter((row) => row.acceptedForPhase3Attempt === true).length;
  const summary = {
    runId,
    executedAt: new Date().toISOString(),
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
    acceptedCandidateCount,
    acceptedForPhase3Attempt: acceptedRow
      ? {
          patientId: acceptedRow.patientId,
          rowPath: path.relative(artifactRoot, rowsJsonPath),
        }
      : null,
    phase3AttemptPatientId: acceptedRow?.patientId ?? null,
    releaseVerdict: acceptedRow ? 'ACCEPTED' : 'PARTIAL / TEST-DATA BLOCKER',
    verdict: acceptedRow ? 'accepted' : 'partial',
    blockerClassification: acceptedRow ? 'none' : 'test-data-blocker',
    blockerReason: acceptedRow ? undefined : 'no_trial_native_mutation_ready_candidate',
    mutationPolicy: {
      prohibited: true,
      blockedRequestCount: blockedMutationRequests.length,
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
    baseURL: redactUrl(baseURL),
    facilityId,
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
    source: 'qa-weborca-candidate-discovery',
    discoverySummaryPath: path.relative(preflightArtifactRoot, summaryJsonPath),
    baseURL: redactUrl(baseURL),
    facilityId,
    patientSearch: { patientId: '', selectable: false, selectableCount: 0, verdict: 'rejected' },
    selectors: {},
    acceptedForPhase3Attempt: null,
    phase3AttemptPatientId: null,
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
