import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

import {
  buildQaUnsafeRequestHeaders,
  buildQaSession,
  createAuthenticatedContext,
  resolveQaFacilityId,
  resolveQaPasswordPlain,
  resolveQaUserId,
} from './qa-lib/session-auth.mjs';
import {
  EXACT_PREFLIGHT_FLOW_MODE,
  EXACT_PREFLIGHT_KIND,
  EXACT_PREFLIGHT_SOURCE,
  SELECTOR_OPTION_MISSING_BLOCKER,
  buildInputIdentity,
  buildMedicalInformationState,
  createEvidenceRef,
} from './qa-lib/acceptmodv2-identity-gate.mjs';
import {
  buildOfficialPatientReadinessAxes,
  buildReadonlyMutationPolicy,
  isReadonlyBlockedMutationUrl,
  normalizeCandidateExclusionSet,
  officialPatientEvidenceAccepted,
  sanitizeOfficialPatientExistenceEvidence,
  selectPreferredExactPreflightCandidate,
  summarizeLocalSelectableDiagnostic,
  summarizeMedicalInformationReadiness,
  summarizeAppointmentDependency,
  summarizeInsuranceReadiness,
  summarizeOfficialPatientExistence,
  summarizeSelectorDiagnostic,
} from './qa-lib/orca-trial-preflight.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const requestedCandidateId = process.env.QA_CANDIDATE_ID?.trim() ?? '';
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'https://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'weborca-readonly-preflight');
const networkDir = path.join(artifactRoot, 'network');
const stepLogPath = path.join(artifactRoot, 'steps.log');
const summaryJsonPath = path.join(artifactRoot, 'summary.json');
const summaryMdPath = path.join(artifactRoot, 'summary.md');
const consoleJsonPath = path.join(artifactRoot, 'console.json');
const pageErrorsJsonPath = path.join(artifactRoot, 'page-errors.json');

fs.mkdirSync(networkDir, { recursive: true });

const facilityId = resolveQaFacilityId();
const authUserId = resolveQaUserId();
const authPasswordPlain = resolveQaPasswordPlain();
const requestedPatientId = process.env.QA_PATIENT_ID?.trim() ?? '';
const excludedPatientIds = normalizeCandidateExclusionSet(
  process.env.QA_EXCLUDED_PATIENT_IDS ?? process.env.QA_EXCLUDED_CANDIDATES ?? '',
);
const candidateId = requestedCandidateId || requestedPatientId || `${runId}:acceptmodv2`;
const departmentCode = process.env.QA_DEPARTMENT_CODE ?? '01';
const physicianCode = process.env.QA_PHYSICIAN_CODE ?? '10001';
const paymentMode = process.env.QA_PAYMENT_MODE ?? 'insurance';
const visitKind = process.env.QA_VISIT_KIND ?? '1';
const requestedAppointmentFlowMode = process.env.QA_APPOINTMENT_FLOW_MODE?.trim() ?? 'direct_acceptance';
const medicalInformation = (process.env.QA_MEDICAL_INFORMATION ?? '').trim();
const acceptanceDate =
  process.env.QA_ACCEPTANCE_DATE ??
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
const acceptanceTime = process.env.QA_ACCEPTANCE_TIME ?? '09:00:00';
const sessionRole = process.env.QA_ROLE ?? 'admin';
const sessionRoles = process.env.QA_ROLES
  ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean)
  : [sessionRole];
const session = buildQaSession({
  facilityId,
  userId: authUserId,
  runId,
  scenarioLabel: 'weborca-readonly-preflight',
  sessionRole,
  sessionRoles,
});

const TRIAL_INITIAL_PATIENT_IDS = Array.from({ length: 11 }, (_, index) => String(index + 1).padStart(5, '0'));
const REJECTED_PATIENT_IDS = new Set(['0000001']);
const MEDICAL_INFORMATION_PROBE_PATH = '/api/orca/official/appointments/medical-information';
const OFFICIAL_PATIENT_GET_PATH = '/api/orca/official/patientgetv2';
const OFFICIAL_INSURANCE_COMBINATIONS_PATH = '/api/orca/official/insurance/combinations';
const LOCAL_PATIENT_SEARCH_PATH = '/api/local/patients/search';
const APPOINTMENTS_LIST_PATH = '/api/orca/official/appointments/list';
const VISITS_LIST_PATH = '/api/orca/official/visits/list';
const TARGET_PATHS = [
  MEDICAL_INFORMATION_PROBE_PATH,
  OFFICIAL_PATIENT_GET_PATH,
  OFFICIAL_INSURANCE_COMBINATIONS_PATH,
  LOCAL_PATIENT_SEARCH_PATH,
  APPOINTMENTS_LIST_PATH,
  VISITS_LIST_PATH,
];
const ACCEPTMOD_PATIENT_NOT_FOUND = '10';
const PATIENT_NOT_FOUND_PATTERN =
  /(patient[-_\s]*not[-_\s]*found|no\s+patient|患者番号に該当する患者が存在しません|該当する患者が存在しません|患者.*存在しません)/i;

const consoleMessages = [];
const pageErrors = [];
const networkRecords = [];
const requestRecords = [];
const blockedMutationRequestKeys = new Set();
let unsafeRequestHeaders = { 'Content-Type': 'application/json' };

const logStep = (label) => {
  fs.appendFileSync(stepLogPath, `[${new Date().toISOString()}] ${label}\n`, 'utf8');
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

const normalizeString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const normalizeApiResult = (value) => (value === null || value === undefined ? '' : String(value).trim());
const isAllZeroApiResult = (apiResult) => Boolean(apiResult && /^[0]+$/.test(apiResult));
const messageCategory = (message) => {
  if (!message) return 'none';
  if (PATIENT_NOT_FOUND_PATTERN.test(String(message))) return 'patient-not-found';
  return 'other';
};
const errorCategory = (error) => {
  const text = String(error?.message ?? error ?? '');
  const name = String(error?.name ?? '');
  if (/timeout/i.test(name) || /timeout/i.test(text)) return 'timeout';
  if (/abort|blocked/i.test(name) || /abort|blocked/i.test(text)) return 'aborted';
  return 'request-error';
};
const verdict = (accepted, verified = true) => {
  if (!verified) return 'not_verified';
  return accepted ? 'accepted' : 'rejected';
};
const isTarget = (url) => TARGET_PATHS.some((pathName) => url.includes(pathName));
const sanitizedReadonlyMutationRequest = (url, method) => buildReadonlyMutationPolicy([{ url, method }]).blockedRequests[0];
const recordReadonlyMutationRequest = (url, method) => {
  const record = sanitizedReadonlyMutationRequest(url, method);
  if (!record) return;
  const key = `${record.method}:${record.path}:${record.reason}`;
  if (blockedMutationRequestKeys.has(key)) return;
  blockedMutationRequestKeys.add(key);
  requestRecords.push(record);
};
const urlFor = (pathName, query) => {
  const url = new URL(pathName, baseURL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

const summarizeBody = (body) => {
  if (!body) return { bodyChars: 0 };
  try {
    const parsed = JSON.parse(body);
    return {
      bodyChars: body.length,
      keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 20) : [],
      apiResult: parsed?.apiResult,
      apiResultMessageCategory: messageCategory(parsed?.apiResultMessage ?? parsed?.Api_Result_Message),
      recordsReturned: parsed?.recordsReturned,
      patientsCount: Array.isArray(parsed?.patients) ? parsed.patients.length : undefined,
      combinationsCount: Array.isArray(parsed?.combinations) ? parsed.combinations.length : undefined,
      itemsCount: Array.isArray(parsed?.items) ? parsed.items.length : undefined,
      slotsCount: Array.isArray(parsed?.slots) ? parsed.slots.length : undefined,
      visitsCount: Array.isArray(parsed?.visits) ? parsed.visits.length : undefined,
    };
  } catch {
    return { bodyChars: body.length };
  }
};

const recordRequest = (request) => {
  const url = request.url();
  if (isReadonlyBlockedMutationUrl(url)) {
    recordReadonlyMutationRequest(url, request.method());
    return;
  }
  if (!isTarget(url)) return;
  requestRecords.push({
    url: redactUrl(url),
    method: request.method(),
    headers: redactHeaders(request.headers()),
    postData: summarizeBody(request.postData() ?? ''),
  });
};

const collectResponse = async (response) => {
  const url = response.url();
  if (!isTarget(url)) return;
  let body = '';
  try {
    body = await response.text();
  } catch {
    body = '';
  }
  networkRecords.push({
    url: redactUrl(url),
    status: response.status(),
    statusText: response.statusText(),
    request: {
      method: response.request().method(),
      headers: redactHeaders(response.request().headers()),
      postData: summarizeBody(response.request().postData() ?? ''),
    },
    response: {
      headers: redactHeaders(response.headers()),
      body: summarizeBody(body),
    },
  });
};

const recordDirectExchange = async ({ pathName, method, requestBody, query, response, responseText }) => {
  requestRecords.push({
    url: redactUrl(urlFor(pathName, query)),
    method,
    headers: {},
    postData: summarizeBody(requestBody ? JSON.stringify(requestBody) : ''),
  });
  networkRecords.push({
    url: redactUrl(urlFor(pathName, query)),
    status: response.status(),
    statusText: response.statusText(),
    request: {
      method,
      headers: {},
      postData: summarizeBody(requestBody ? JSON.stringify(requestBody) : ''),
    },
    response: {
      headers: redactHeaders(response.headers()),
      body: summarizeBody(responseText),
    },
  });
};

const parseJson = (body) => {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
};

const parseJsonWithStatus = (body) => {
  try {
    return { body: JSON.parse(body), ok: true };
  } catch {
    return { body: {}, ok: false };
  }
};

const normalizeDateDigits = (value) => {
  const normalized = normalizeString(value)?.replace(/\D/g, '');
  return normalized && normalized.length >= 8 ? normalized.slice(0, 8) : undefined;
};

const isCombinationEffectiveOn = (combination, baseDate) => {
  const base = normalizeDateDigits(baseDate);
  if (!base) return false;
  const start = normalizeDateDigits(combination?.certificateStartDate);
  const end = normalizeDateDigits(combination?.certificateExpiredDate);
  return (!start || start <= base) && (!end || end >= base || /^9+$/.test(end));
};

const buildCandidateIds = () => {
  const ids = requestedPatientId ? [requestedPatientId, ...TRIAL_INITIAL_PATIENT_IDS] : TRIAL_INITIAL_PATIENT_IDS;
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
};

const probeMedicalInformationOptions = async (context) => {
  logStep('medical-information read-only probe start');
  try {
    const response = await context.request.get(urlFor(MEDICAL_INFORMATION_PROBE_PATH));
    const body = await response.text().catch(() => '');
    await recordDirectExchange({
      pathName: MEDICAL_INFORMATION_PROBE_PATH,
      method: 'GET',
      response,
      responseText: body,
    });
    const parsed = parseJson(body);
    const apiResult = normalizeApiResult(parsed?.apiResult);
    const accepted = response.status() === 200 && apiResult === '00';
    return {
      status: response.status(),
      ok: response.ok(),
      apiResult,
      apiResultMessageCategory: messageCategory(parsed?.apiResultMessage ?? parsed?.Api_Result_Message),
      optionCount: Array.isArray(parsed?.items) ? parsed.items.length : 0,
      verdict: verdict(accepted),
      accepted,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      apiResult: '',
      apiResultMessageCategory: 'none',
      optionCount: 0,
      verdict: 'rejected',
      accepted: false,
      errorCategory: errorCategory(error),
    };
  }
};

const buildNotVerifiedOfficialEvidence = (rejectionReason = 'not_verified') =>
  sanitizeOfficialPatientExistenceEvidence({
    httpStatus: 0,
    parsedOrcaBody: false,
    apiResult: '',
    apiResultAccepted: false,
    patientInformationPresent: false,
    exactIdMatched: false,
    notFoundMessage: false,
    responseCategory: 'not_verified',
    rejectionReason,
  });

const probeOfficialPatientgetv2 = async (context, candidateId) => {
  const query = { id: candidateId, class: '01', format: 'json' };
  logStep(`official patientgetv2 exact probe start patient=${candidateId}`);
  try {
    const response = await context.request.get(urlFor(OFFICIAL_PATIENT_GET_PATH, query));
    const text = await response.text().catch(() => '');
    await recordDirectExchange({
      pathName: OFFICIAL_PATIENT_GET_PATH,
      method: 'GET',
      query,
      response,
      responseText: text,
    });
    const parsed = parseJsonWithStatus(text);
    const existence = summarizeOfficialPatientExistence({
      httpStatus: response.status(),
      body: parsed.body,
      candidateId,
      parsedOrcaBody: parsed.ok,
      method: 'GET',
      endpointKind: 'official_patientgetv2',
      responseHeaders: response.headers(),
    });
    const evidence = sanitizeOfficialPatientExistenceEvidence(existence);
    return {
      status: response.status(),
      ok: response.ok(),
      ...evidence,
      accepted: officialPatientEvidenceAccepted(evidence),
      verdict: verdict(officialPatientEvidenceAccepted(evidence)),
      exactMatch: evidence.exactIdMatched,
    };
  } catch (error) {
    const evidence = buildNotVerifiedOfficialEvidence('patientgetv2_probe_failed');
    return {
      status: 0,
      ok: false,
      ...evidence,
      accepted: false,
      verdict: 'rejected',
      errorCategory: errorCategory(error),
    };
  }
};

const probeOfficialPatients = async (context, candidateIds) => {
  logStep(`official patientgetv2 exact probe set start candidates=${candidateIds.length}`);
  const candidates = {};
  for (const candidateId of candidateIds) {
    candidates[candidateId] = await probeOfficialPatientgetv2(context, candidateId);
  }
  const exactMatchedPatientIds = candidateIds.filter((candidateId) => candidates[candidateId]?.accepted === true);
  const missingPatientIds = candidateIds.filter((candidateId) => !exactMatchedPatientIds.includes(candidateId));
  const statuses = Object.values(candidates).map((candidate) => candidate.httpStatus ?? candidate.status ?? 0);
  const failedStatus = statuses.find((status) => status >= 500 || status === 0);
  const status = failedStatus ?? statuses[0] ?? 0;
  return {
    status,
    httpStatus: status,
    requestedCount: candidateIds.length,
    returnedCount: exactMatchedPatientIds.length,
    exactMatchedPatientIds,
    missingPatientIds,
    candidates,
    readinessAxes: buildOfficialPatientReadinessAxes(candidates),
    verdict: verdict(exactMatchedPatientIds.length > 0),
    accepted: exactMatchedPatientIds.length > 0,
  };
};

const probeInsuranceReadiness = async (context, patientId) => {
  const body = { patientId, baseDate: acceptanceDate };
  logStep(`insurance read-only probe start patient=${patientId}`);
  try {
    const response = await context.request.post(urlFor(OFFICIAL_INSURANCE_COMBINATIONS_PATH), {
      data: body,
      headers: unsafeRequestHeaders,
    });
    const text = await response.text().catch(() => '');
    await recordDirectExchange({
      pathName: OFFICIAL_INSURANCE_COMBINATIONS_PATH,
      method: 'POST',
      requestBody: body,
      response,
      responseText: text,
    });
    const parsedResult = parseJsonWithStatus(text);
    const parsed = parsedResult.body;
    const apiResult = normalizeApiResult(parsed?.apiResult);
    const combinations = Array.isArray(parsed?.combinations) ? parsed.combinations : [];
    const effectiveCount = combinations.filter((combination) => isCombinationEffectiveOn(combination, acceptanceDate)).length;
    const readiness = summarizeInsuranceReadiness({
      httpStatus: response.status(),
      body: parsed,
      baseDate: acceptanceDate,
      method: 'POST',
      expectedMethod: 'POST',
      pathName: OFFICIAL_INSURANCE_COMBINATIONS_PATH,
      expectedPath: OFFICIAL_INSURANCE_COMBINATIONS_PATH,
      responseBodyChars: text.length,
      parsedBodyOk: parsedResult.ok,
    });
    const accepted = readiness.accepted;
    return {
      status: response.status(),
      apiResult,
      classification: readiness.classification,
      diagnosticCategory: readiness.diagnosticCategory,
      readinessFailureCategory: readiness.readinessFailureCategory,
      diagnostic: readiness.diagnostic,
      count: combinations.length,
      effectiveCount,
      selectedCombinationId: effectiveCount > 0 ? '<<redacted>>' : undefined,
      verdict: verdict(accepted),
      accepted,
      transportOk: response.ok(),
      businessOk: isAllZeroApiResult(apiResult),
    };
  } catch (error) {
    return {
      status: 0,
      apiResult: '',
      classification: 'ambiguous_readiness_failure',
      count: 0,
      effectiveCount: 0,
      selectedCombinationId: undefined,
      verdict: 'rejected',
      accepted: false,
      transportOk: false,
      businessOk: false,
      errorCategory: errorCategory(error),
    };
  }
};

const probeLocalSelectable = async (context, patientId) => {
  const body = { keyword: patientId, searchType: 'patient-id', runId };
  logStep(`local exact patient search probe start patient=${patientId}`);
  try {
    const response = await context.request.post(urlFor(LOCAL_PATIENT_SEARCH_PATH), {
      data: body,
      headers: unsafeRequestHeaders,
    });
    const text = await response.text().catch(() => '');
    await recordDirectExchange({
      pathName: LOCAL_PATIENT_SEARCH_PATH,
      method: 'POST',
      requestBody: body,
      response,
      responseText: text,
    });
    const parsed = parseJson(text);
    const apiResult = normalizeApiResult(parsed?.apiResult);
    const patients = Array.isArray(parsed?.patients) ? parsed.patients : [];
    const localIds = patients.map((patient) => normalizeString(patient?.patientId)).filter(Boolean);
    const exactMatchCount = localIds.filter((localId) => localId === patientId).length;
    const recordsReturned = typeof parsed?.recordsReturned === 'number' ? parsed.recordsReturned : patients.length;
    const accepted = response.ok() && isAllZeroApiResult(apiResult) && exactMatchCount === 1;
    const diagnostic = summarizeLocalSelectableDiagnostic({
      patientId,
      recordsReturned,
      exactMatchCount,
      accepted,
      verdict: verdict(accepted),
      reason:
        exactMatchCount === 0
          ? 'local_exact_match_missing'
          : exactMatchCount > 1
            ? 'local_exact_match_ambiguous'
            : undefined,
    });
    return {
      ...diagnostic,
      patientId,
      recordsReturned,
      exactMatchCount,
      verdict: verdict(accepted),
      accepted,
      reason:
        exactMatchCount === 0
          ? 'local_exact_match_missing'
          : exactMatchCount > 1
            ? 'local_exact_match_ambiguous'
            : undefined,
    };
  } catch (error) {
    const diagnostic = summarizeLocalSelectableDiagnostic({
      patientId,
      recordsReturned: 0,
      exactMatchCount: 0,
      verdict: 'rejected',
      reason: 'local_search_failed',
    });
    return {
      ...diagnostic,
      patientId,
      recordsReturned: 0,
      exactMatchCount: 0,
      verdict: 'rejected',
      accepted: false,
      reason: 'local_search_failed',
      errorCategory: errorCategory(error),
    };
  }
};

const probeAcceptmodv2ReadOnlyDiagnostic = async (context, patientId) => {
  logStep(`acceptmodv2 diagnostic skipped by read-only no-mutation policy patient=${patientId}`);
  return {
    apiResult: '',
    status: 'not_run',
    verdict: 'accepted',
    businessStatus: 'notRun',
    businessReason: 'mutation_route_not_called_by_policy',
    accepted: true,
    mutationSuccess: false,
    classification: 'mutation_diagnostic_not_run_by_policy',
    acceptedForPhase3Attempt: true,
    routeCalled: false,
    rawSensitiveFieldsExcluded: true,
  };
};

const selectEvidence = async (page) =>
  await page.evaluate(({ departmentCode, physicianCode, paymentMode, visitKind, medicalInformation }) => {
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
      medicalInformation: {
        ...inspect('#reception-accept-medical-information', medicalInformation),
        selectedState: medicalInformation ? 'selected' : 'omitted',
        selectedValue: medicalInformation || undefined,
      },
    };
  }, { departmentCode, physicianCode, paymentMode, visitKind, medicalInformation });

const buildSelectorReadiness = (selectors, localSelectableDiagnostic) => {
  const selectorDiagnostic = summarizeSelectorDiagnostic({
    selectors,
    localSelectableDiagnostic,
  });
  const details = Object.fromEntries(
    Object.entries(selectors).map(([key, item]) => [
      key,
      {
        ...item,
        verdict: item.notVerifiedReason
          ? verdict(false, false)
          : verdict(item.exists && item.optionCount > 0 && item.hasDesiredValue !== false),
      },
    ]),
  );
  return {
    ...selectorDiagnostic,
    details,
    verdict: selectorDiagnostic.status,
    accepted: selectorDiagnostic.accepted,
  };
};

const buildAppointmentDependency = async (context, patientId) => {
  if (requestedAppointmentFlowMode === 'appointment_row' && patientId) {
    const body = {
      appointmentDate: acceptanceDate,
      departmentCode,
      physicianCode,
      page: 1,
      size: 50,
    };
    logStep(`appointment row dependency probe start patient=${patientId}`);
    try {
      const response = await context.request.post(urlFor(APPOINTMENTS_LIST_PATH), {
        data: body,
        headers: unsafeRequestHeaders,
      });
      const text = await response.text().catch(() => '');
      await recordDirectExchange({
        pathName: APPOINTMENTS_LIST_PATH,
        method: 'POST',
        requestBody: body,
        response,
        responseText: text,
      });
      const parsedResult = parseJsonWithStatus(text);
      const parsed = parsedResult.body;
      return summarizeAppointmentDependency({
        flowMode: requestedAppointmentFlowMode,
        httpStatus: response.status(),
        body: parsed,
        patientId,
        baseDate: acceptanceDate,
        method: 'POST',
        expectedMethod: 'POST',
        pathName: APPOINTMENTS_LIST_PATH,
        expectedPath: APPOINTMENTS_LIST_PATH,
        responseBodyChars: text.length,
        parsedBodyOk: parsedResult.ok,
      });
    } catch (error) {
      return {
        flowMode: 'appointment_row',
        mode: 'appointment_row',
        required: true,
        absenceBlocker: true,
        status: 0,
        httpStatus: 0,
        apiResult: '',
        rowCount: 0,
        exactRowCount: 0,
        classification: 'ambiguous_readiness_failure',
        verdict: 'rejected',
        accepted: false,
        errorCategory: errorCategory(error),
      };
    }
  }
  const appointmentRecord = [...networkRecords].reverse().find((record) => record.url.includes(APPOINTMENTS_LIST_PATH));
  const visitRecord = [...networkRecords].reverse().find((record) => record.url.includes(VISITS_LIST_PATH));
  const appointmentDependency = summarizeAppointmentDependency({
    flowMode: requestedAppointmentFlowMode,
    httpStatus: appointmentRecord?.status,
    body: {
      apiResult: appointmentRecord?.response?.body?.apiResult,
      recordsReturned: appointmentRecord?.response?.body?.recordsReturned,
    },
    patientId,
    baseDate: acceptanceDate,
  });
  return {
    ...appointmentDependency,
    visitApiResult: visitRecord?.response?.body?.apiResult,
    visitRecordsReturned: visitRecord?.response?.body?.recordsReturned,
    appointmentApiResult: appointmentRecord?.response?.body?.apiResult,
    appointmentRecordsReturned: appointmentRecord?.response?.body?.recordsReturned,
  };
};

const chooseCandidate = async ({ context, candidateIds, officialPatientExistence }) => {
  const candidates = {};
  for (const candidateId of candidateIds) {
    const rejected = REJECTED_PATIENT_IDS.has(candidateId);
    const inTrialInitialRange = TRIAL_INITIAL_PATIENT_IDS.includes(candidateId);
    const explicitNonTrial = Boolean(requestedPatientId && candidateId === requestedPatientId && !inTrialInitialRange);
    const officialExact = officialPatientExistence.exactMatchedPatientIds.includes(candidateId);
    const candidate = {
      patientId: candidateId,
      source: inTrialInitialRange ? 'weborca-trial-initial-patient-range' : 'qa-patient-id',
      inTrialInitialRange,
      rejected,
      rejectReason: rejected ? '0000001 is local smoke seed, not WebORCA Trial initial Patient_ID' : explicitNonTrial ? 'not_in_trial_initial_range' : undefined,
      officialExactMatch: officialExact,
      officialVerdict: verdict(!rejected && !explicitNonTrial && officialExact && officialPatientExistence.accepted),
      insurance: { verdict: 'not_verified', accepted: false },
      local: { verdict: 'not_verified', accepted: false },
    };
    if (!rejected && !explicitNonTrial && officialExact && officialPatientExistence.accepted) {
      candidate.insurance = await probeInsuranceReadiness(context, candidateId);
    }
    if (!rejected && !explicitNonTrial && ((officialExact && officialPatientExistence.accepted) || candidateId === requestedPatientId)) {
      candidate.local = await probeLocalSelectable(context, candidateId);
    }
    candidate.verdict = verdict(candidate.officialVerdict === 'accepted' && candidate.insurance.accepted && candidate.local.accepted);
    candidates[candidateId] = candidate;
  }
  const selectedCandidate = selectPreferredExactPreflightCandidate(
    candidates,
    (candidate) => candidate?.verdict === 'accepted' && (!requestedPatientId || candidate.patientId === requestedPatientId),
    { excludedPatientIds },
  );
  const selectedPatientId = selectedCandidate?.patientId ?? '';
  return {
    requestedPatientId: requestedPatientId || undefined,
    probeCandidates: candidateIds,
    fixedTrialInitialRange: TRIAL_INITIAL_PATIENT_IDS,
    rejectedCandidates: Object.values(candidates)
      .filter((candidate) => candidate.rejected || candidate.rejectReason)
      .map((candidate) => ({ patientId: candidate.patientId, reason: candidate.rejectReason })),
    excludedPatientIds: [...excludedPatientIds].sort(),
    selectedPatientId: selectedPatientId || undefined,
    selectedSource: selectedPatientId ? candidates[selectedPatientId].source : undefined,
    selectionPolicy: requestedPatientId
      ? 'QA_PATIENT_ID must be an accepted official Trial initial candidate and not excluded by QA_EXCLUDED_CANDIDATES/QA_EXCLUDED_PATIENT_IDS'
      : 'prefer 00001/00005 among accepted official+insurance+local Trial initial candidates unless excluded, otherwise first accepted candidate',
    verdict: selectedPatientId ? 'accepted' : 'rejected',
    candidates,
  };
};

const classify = ({
  sessionMe,
  medicalInformationProbe,
  trialSourceCandidate,
  officialPatientExistence,
  insuranceReadiness,
  localSelectableReadiness,
  selectorReadiness,
  medicalInformationReadiness,
  acceptmodv2ReadOnlyDiagnostic,
  appointmentDependency,
  mutationPolicy,
}) => {
  if (Number(mutationPolicy?.blockedRequestCount ?? 0) > 0) {
    return { blockerClassification: 'readonly-mutation-blocker', blockerReason: 'readonly_mutation_attempt_blocked' };
  }
  if (sessionMe.status === 401 || sessionMe.status === 403 || medicalInformationProbe.status === 401 || medicalInformationProbe.status === 403) {
    return { blockerClassification: 'auth-blocker', blockerReason: 'authentication_or_authorization_failed' };
  }
  if (medicalInformationProbe.status === 0 || medicalInformationProbe.status >= 500 || officialPatientExistence.status >= 500) {
    return { blockerClassification: 'environment-blocker', blockerReason: 'official_readonly_probe_failed' };
  }
  if (requestedPatientId && REJECTED_PATIENT_IDS.has(requestedPatientId)) {
    return { blockerClassification: 'test-data-blocker', blockerReason: 'rejected_trial_candidate' };
  }
  if (!medicalInformationProbe.accepted) {
    return { blockerClassification: 'external-trial-ambiguity', blockerReason: 'medical_information_probe_not_accepted' };
  }
  if (!trialSourceCandidate.selectedPatientId) {
    const requestedCandidate = requestedPatientId ? trialSourceCandidate.candidates[requestedPatientId] : undefined;
    if (requestedCandidate?.local?.exactMatchCount > 0 && requestedCandidate?.officialVerdict !== 'accepted') {
      return { blockerClassification: 'test-data-blocker', blockerReason: 'local_sync_required' };
    }
    return { blockerClassification: 'external-trial-ambiguity', blockerReason: 'no_official_trial_candidate_accepted' };
  }
  if (localSelectableReadiness.verdict !== 'accepted') {
    return { blockerClassification: 'test-data-blocker', blockerReason: localSelectableReadiness.reason ?? 'local_sync_required' };
  }
  if (insuranceReadiness.verdict !== 'accepted') {
    if (insuranceReadiness.classification === 'ambiguous_readiness_failure') {
      return { blockerClassification: 'external-trial-ambiguity', blockerReason: 'ambiguous_readiness_failure' };
    }
    if (
      insuranceReadiness.classification === 'request_contract_rejected' ||
      insuranceReadiness.classification === 'unknown_nonzero'
    ) {
      return { blockerClassification: 'external-trial-ambiguity', blockerReason: insuranceReadiness.classification };
    }
    return { blockerClassification: 'test-data-blocker', blockerReason: insuranceReadiness.classification ?? 'insurance_missing_or_not_effective' };
  }
  if (
    appointmentDependency?.classification === 'ambiguous_readiness_failure' ||
    appointmentDependency?.classification === 'request_contract_rejected' ||
    appointmentDependency?.classification === 'unknown_nonzero'
  ) {
    return { blockerClassification: 'external-trial-ambiguity', blockerReason: appointmentDependency.classification };
  }
  if (appointmentDependency?.verdict === 'rejected' || appointmentDependency?.accepted === false) {
    return { blockerClassification: 'test-data-blocker', blockerReason: appointmentDependency.classification ?? 'appointment_dependency_not_ready' };
  }
  if (selectorReadiness.verdict !== 'accepted') {
    return { blockerClassification: SELECTOR_OPTION_MISSING_BLOCKER, blockerReason: 'selector_missing' };
  }
  if (medicalInformationReadiness?.accepted === false) {
    return {
      blockerClassification: 'test-data-blocker',
      blockerReason: `medical_information_not_ready:${medicalInformationReadiness.failedSubdimensions?.join(',') || 'unknown'}`,
    };
  }
  if (acceptmodv2ReadOnlyDiagnostic.verdict !== 'accepted') {
    return {
      blockerClassification: 'test-data-blocker',
      blockerReason:
        acceptmodv2ReadOnlyDiagnostic.apiResult === ACCEPTMOD_PATIENT_NOT_FOUND
          ? 'diagnostic_patient_not_found'
          : 'diagnostic_not_no_existing_acceptance',
    };
  }
  if (pageErrors.length > 0) {
    return { blockerClassification: 'repo-defect', blockerReason: 'page_errors_observed' };
  }
  return { blockerClassification: 'none', blockerReason: 'none' };
};

const buildMarkdownSummary = (summary) =>
  `# WebORCA read-only preflight\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- verdict: ${summary.verdict}\n` +
  `- acceptedForPhase3Attempt: ${summary.acceptedForPhase3Attempt ? 'yes' : 'no'}\n` +
  `- phase3AttemptPatientId: ${summary.phase3AttemptPatientId ?? 'none'}\n` +
  `- medicalInformationState: ${summary.medicalInformationState?.state ?? 'omitted'}${summary.medicalInformationState?.value ? `/${summary.medicalInformationState.value}` : ''}\n` +
  `- blockerClassification: ${summary.blockerClassification}\n` +
  `- blockerReason: ${summary.blockerReason}\n` +
  `- trialSourceCandidate: ${summary.trialSourceCandidate.verdict}\n` +
  `- officialPatientExistence: ${verdict(officialPatientEvidenceAccepted(summary.officialPatientExistence))} reason=${summary.officialPatientExistence.rejectionReason ?? 'none'}\n` +
  `- insuranceReadiness: ${summary.insuranceReadiness.verdict} status=${summary.insuranceReadiness.status ?? 'none'} apiResult=${summary.insuranceReadiness.apiResult || 'none'} classification=${summary.insuranceReadiness.classification ?? 'none'} accepted=${summary.insuranceReadiness.accepted ? 'yes' : 'no'} count=${summary.insuranceReadiness.count ?? 0} effective=${summary.insuranceReadiness.effectiveCount ?? 0}\n` +
  `- localSelectableReadiness: ${summary.localSelectableReadiness.verdict} reason=${summary.localSelectableReadiness.reason ?? 'none'} count=${summary.localSelectableReadiness.localCandidateCount ?? summary.localSelectableReadiness.recordsReturned ?? 0} exact=${summary.localSelectableReadiness.exactMatchCount ?? 0}\n` +
  `- selectorReadiness: ${summary.selectorReadiness.verdict} reason=${summary.selectorReadiness.reason ?? 'none'}\n` +
  `- medicalInformationReadiness: ${summary.medicalInformationReadiness?.verdict ?? 'not_verified'} failed=${summary.medicalInformationReadiness?.failedSubdimensions?.join(',') || 'none'}\n` +
  `- appointmentDependency: ${summary.appointmentDependency.verdict} flowMode=${summary.appointmentDependency.flowMode ?? 'unknown'} required=${summary.appointmentDependency.required ? 'yes' : 'no'} status=${summary.appointmentDependency.status ?? 'none'} apiResult=${summary.appointmentDependency.apiResult || 'none'} classification=${summary.appointmentDependency.classification ?? 'none'} accepted=${summary.appointmentDependency.accepted ? 'yes' : 'no'}\n` +
  `- acceptmodv2ReadOnlyDiagnostic: ${summary.acceptmodv2ReadOnlyDiagnostic.verdict} apiResult=${summary.acceptmodv2ReadOnlyDiagnostic.apiResult || 'none'} mutationSuccess=${summary.acceptmodv2ReadOnlyDiagnostic.mutationSuccess ? 'yes' : 'no'}\n`;

let browser;
let context;

try {
  browser = await chromium.launch({ headless: true });
  const auth = await createAuthenticatedContext(browser, {
    baseURL,
    facilityId,
    userId: authUserId,
    password: authPasswordPlain,
    session,
  });
  context = auth.context;
  unsafeRequestHeaders = buildQaUnsafeRequestHeaders({ baseURL, csrfToken: auth.csrfToken });
  const page = auth.page;
  const sessionMe = auth.sessionMe;

  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!isReadonlyBlockedMutationUrl(request.url())) {
      await route.continue();
      return;
    }
    recordReadonlyMutationRequest(request.url(), request.method());
    await route.abort('blockedbyclient');
  });

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push({ category: errorCategory(error) }));
  page.on('request', recordRequest);
  page.on('response', collectResponse);

  const candidateIds = buildCandidateIds();
  const medicalInformationProbe = await probeMedicalInformationOptions(context);
  const officialPatientExistence = await probeOfficialPatients(context, candidateIds);
  const trialSourceCandidate = await chooseCandidate({
    context,
    candidateIds,
    officialPatientExistence,
  });
  const selectedPatientId = trialSourceCandidate.selectedPatientId;

  let uiSelectableCount = 0;
  let uiFirstSelectable = false;
  let selectors = {
    department: { exists: false, optionCount: 0, hasDesiredValue: false, notVerifiedReason: 'no accepted trial candidate' },
    physician: { exists: false, optionCount: 0, hasDesiredValue: false, notVerifiedReason: 'no accepted trial candidate' },
    visitKind: { exists: false, optionCount: 0, hasDesiredValue: false, notVerifiedReason: 'no accepted trial candidate' },
    paymentMode: { exists: false, optionCount: 0, hasDesiredValue: false, notVerifiedReason: 'no accepted trial candidate' },
    medicalInformation: { exists: false, optionCount: 0, hasDesiredValue: true, notVerifiedReason: 'no accepted trial candidate' },
  };

  if (selectedPatientId) {
    await page.goto(`/f/${encodeURIComponent(facilityId)}/reception`, { waitUntil: 'domcontentloaded' });
    logStep('goto reception');
    await page.locator('.reception-page').waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: '既存患者受付/患者検索' }).click();
    logStep('opened workflow modal');
    const workflowModal = page.locator('[data-test-id="reception-accept-workflow-modal"]');
    await workflowModal.waitFor({ timeout: 20_000 });
    const patientSearchForm = workflowModal.locator('[data-test-id="reception-patient-search-form"]');
    await patientSearchForm.locator('#reception-patient-search-patient-id').fill(selectedPatientId);
    await patientSearchForm.locator('[data-test-id="reception-patient-search-submit"]').click();
    logStep('submitted read-only patient search');
    const resultListItems = workflowModal.locator('[role="region"][aria-label="患者検索結果モーダル"] [role="listitem"]');
    await resultListItems.first().waitFor({ timeout: 20_000 }).catch(() => null);
    uiSelectableCount = await resultListItems.count().catch(() => 0);
    uiFirstSelectable =
      uiSelectableCount > 0
        ? await resultListItems
            .first()
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
            .catch(() => false)
        : false;
    if (uiFirstSelectable) {
      await resultListItems.first().click();
      logStep('selected read-only patient search result');
      await page
        .waitForFunction(
          () =>
            ['#reception-accept-department', '#reception-accept-physician', '#reception-accept-visit-kind', '#reception-accept-payment-mode'].every(
              (selector) => document.querySelector(selector)?.querySelectorAll('option').length,
            ),
          { timeout: 20_000 },
        )
        .catch(() => null);
      selectors = await selectEvidence(page);
    } else {
      logStep('selected candidate was not selectable in UI result list');
    }
  }

  const selectedCandidate = selectedPatientId ? trialSourceCandidate.candidates[selectedPatientId] : undefined;
  const requestedCandidate = requestedPatientId ? trialSourceCandidate.candidates[requestedPatientId] : undefined;
  const readinessCandidate = selectedCandidate ?? requestedCandidate;
  const localUiVerdict = selectedCandidate?.local?.accepted
    ? uiFirstSelectable
      ? 'accepted'
      : 'rejected'
    : (readinessCandidate?.local?.verdict ?? 'not_verified');
  const localUiReason =
    selectedCandidate?.local?.accepted && !uiFirstSelectable
      ? 'local_exact_match_not_selectable'
      : (readinessCandidate?.local?.reason ?? 'no accepted trial candidate');
  const localSelectableReadiness = {
    ...(readinessCandidate?.local ?? {
      patientId: selectedPatientId ?? requestedPatientId,
      recordsReturned: 0,
      exactMatchCount: 0,
      verdict: 'not_verified',
      accepted: false,
      reason: 'no accepted trial candidate',
    }),
    uiSelectableCount,
    uiFirstSelectable,
    verdict: localUiVerdict,
    reason: localUiReason,
  };
  localSelectableReadiness.accepted = localSelectableReadiness.verdict === 'accepted';
  localSelectableReadiness.status = localSelectableReadiness.verdict;

  const insuranceReadiness = selectedCandidate?.insurance ?? {
    count: 0,
    effectiveCount: 0,
    selectedCombinationId: undefined,
    verdict: 'not_verified',
    accepted: false,
  };
  const localSelectableDiagnostic = summarizeLocalSelectableDiagnostic(localSelectableReadiness);
  const selectorReadiness = buildSelectorReadiness(selectors, localSelectableDiagnostic);
  const appointmentDependency = await buildAppointmentDependency(context, selectedPatientId);
  const acceptmodv2ReadOnlyDiagnostic = selectedPatientId
    ? await probeAcceptmodv2ReadOnlyDiagnostic(context, selectedPatientId)
    : {
        apiResult: '',
        status: 0,
        verdict: 'not_verified',
        businessStatus: 'notVerified',
        businessReason: 'no accepted trial candidate',
        accepted: false,
        mutationSuccess: false,
        acceptedForPhase3Attempt: false,
      };
  const selectedOfficialPatientEvidence = selectedPatientId
    ? sanitizeOfficialPatientExistenceEvidence(officialPatientExistence.candidates?.[selectedPatientId])
    : buildNotVerifiedOfficialEvidence('no_accepted_trial_candidate');
  const officialPatientAccepted = officialPatientEvidenceAccepted(selectedOfficialPatientEvidence);
  const rawSensitiveFieldsExcluded = selectedOfficialPatientEvidence.rawSensitiveFieldsExcluded === true;

  const patientId = selectedPatientId ?? requestedPatientId;
  const phaseCandidateId = requestedCandidateId || patientId || candidateId;
  const medicalInformationState = buildMedicalInformationState(medicalInformation);
  const medicalInformationReadiness = summarizeMedicalInformationReadiness({
    patientId,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformation,
    medicalInformationState,
    medicalInformationProbe,
    selectorDiagnostic: selectorReadiness,
    localSelectableDiagnostic,
  });
  const mutationPolicy = buildReadonlyMutationPolicy(requestRecords);
  const classification = classify({
    sessionMe,
    medicalInformationProbe,
    trialSourceCandidate,
    officialPatientExistence,
    insuranceReadiness,
    localSelectableReadiness,
    selectorReadiness,
    medicalInformationReadiness,
    appointmentDependency,
    acceptmodv2ReadOnlyDiagnostic,
    mutationPolicy,
  });
  const acceptedForPhase3Attempt =
    classification.blockerClassification === 'none' &&
    Boolean(selectedPatientId) &&
    medicalInformationProbe.accepted &&
    medicalInformationReadiness.accepted === true &&
    trialSourceCandidate.verdict === 'accepted' &&
    officialPatientAccepted &&
    insuranceReadiness.verdict === 'accepted' &&
    localSelectableReadiness.verdict === 'accepted' &&
    selectorReadiness.verdict === 'accepted' &&
    appointmentDependency.verdict === 'accepted' &&
    acceptmodv2ReadOnlyDiagnostic.acceptedForPhase3Attempt === true &&
    mutationPolicy.blockedRequestCount === 0 &&
    rawSensitiveFieldsExcluded === true;
  const inputIdentity = buildInputIdentity({
    runId,
    candidateId: phaseCandidateId,
    facilityId,
    patientId,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformation,
  });
  const insuranceReadinessWithEvidence = {
    ...insuranceReadiness,
    key: `${facilityId}:${patientId || 'unresolved'}:${paymentMode}:${acceptanceDate}`,
    ...createEvidenceRef('preflight:insurance-readiness', {
      facilityId,
      patientId,
      paymentMode,
      acceptanceDate,
      insuranceReadiness,
    }),
  };
  const officialPatientEvidence = selectedOfficialPatientEvidence;
  const officialPatientEvidenceRef = 'summary.json#/officialPatientExistence';
  const officialPatientEvidenceHash = createEvidenceRef(officialPatientEvidenceRef, officialPatientEvidence).hash;
  const insuranceEvidence = createEvidenceRef('summary.json#/insuranceReadiness', {
    patientId,
    paymentMode,
    acceptanceDate,
    count: insuranceReadiness.count,
    effectiveCount: insuranceReadiness.effectiveCount,
    verdict: insuranceReadiness.verdict,
  });
  const localSelectableEvidence = createEvidenceRef('summary.json#/localSelectableReadiness', {
    patientId,
    localSelectableReadiness,
  });
  const selectorEvidence = createEvidenceRef('summary.json#/selectorReadiness', {
    patientId,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformationState,
    selectorReadiness,
    medicalInformationReadiness,
  });

  const summary = {
    runId,
    source: EXACT_PREFLIGHT_SOURCE,
    flowMode: EXACT_PREFLIGHT_FLOW_MODE,
    kind: EXACT_PREFLIGHT_KIND,
    candidateId: phaseCandidateId,
    executedAt: new Date().toISOString(),
    baseURL: redactUrl(baseURL),
    facilityId,
    patientId,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformation: medicalInformation || undefined,
    medicalInformationState,
    inputIdentity,
    officialPatientEvidence,
    officialPatientEvidenceRef,
    officialPatientEvidenceHash,
    insuranceEvidence,
    insuranceEvidenceRef: insuranceEvidence.id,
    insuranceEvidenceHash: insuranceEvidence.hash,
    localSelectableEvidence,
    localSelectableEvidenceRef: localSelectableEvidence.id,
    localSelectableEvidenceHash: localSelectableEvidence.hash,
    selectorEvidence,
    selectorEvidenceRef: selectorEvidence.id,
    selectorEvidenceHash: selectorEvidence.hash,
    sessionRole,
    login: {
      sessionMeStatus: sessionMe.status,
    },
    acceptanceDate,
    requestedPatientId: requestedPatientId || undefined,
    phase3AttemptPatientId: acceptedForPhase3Attempt ? selectedPatientId : null,
    trialSourceCandidate,
    officialPatientExistence: officialPatientEvidence,
    officialPatientReadinessAxes: officialPatientExistence.readinessAxes,
    insuranceReadiness: insuranceReadinessWithEvidence,
    selectorReadiness,
    localSelectableReadiness,
    localSelectableDiagnostic,
    medicalInformationReadiness,
    appointmentDependency,
    acceptmodv2ReadOnlyDiagnostic,
    acceptedForPhase3Attempt,
    mutationPolicy,
    verdict: acceptedForPhase3Attempt ? 'accepted' : 'rejected',
    blockerClassification: classification.blockerClassification,
    blockerReason: classification.blockerReason,
    rawSensitiveFieldsExcluded,
    consoleMessages,
    pageErrors,
  };

  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords, null, 2), 'utf8');
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords, null, 2), 'utf8');
  fs.writeFileSync(consoleJsonPath, JSON.stringify(consoleMessages, null, 2), 'utf8');
  fs.writeFileSync(pageErrorsJsonPath, JSON.stringify(pageErrors, null, 2), 'utf8');
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(summaryMdPath, buildMarkdownSummary(summary), 'utf8');

  await context.close();
  await browser.close();
  console.log(JSON.stringify(summary, null, 2));
  if (!acceptedForPhase3Attempt) {
    process.exit(1);
  }
} catch (error) {
  logStep(`fatal errorCategory=${errorCategory(error)}`);
  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords, null, 2), 'utf8');
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords, null, 2), 'utf8');
  fs.writeFileSync(consoleJsonPath, JSON.stringify(consoleMessages, null, 2), 'utf8');
  fs.writeFileSync(pageErrorsJsonPath, JSON.stringify(pageErrors, null, 2), 'utf8');
  const officialPatientEvidence = buildNotVerifiedOfficialEvidence('fatal_error');
  const officialPatientEvidenceRef = 'summary.json#/officialPatientExistence';
  const officialPatientEvidenceHash = createEvidenceRef(officialPatientEvidenceRef, officialPatientEvidence).hash;
  const summary = {
    runId,
    source: EXACT_PREFLIGHT_SOURCE,
    flowMode: EXACT_PREFLIGHT_FLOW_MODE,
    kind: EXACT_PREFLIGHT_KIND,
    executedAt: new Date().toISOString(),
    baseURL: redactUrl(baseURL),
    facilityId,
    candidateId,
    patientId: requestedPatientId || null,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformation: medicalInformation || undefined,
    medicalInformationState: buildMedicalInformationState(medicalInformation),
    inputIdentity: buildInputIdentity({
      runId,
      candidateId,
      facilityId,
      patientId: requestedPatientId,
      departmentCode,
      physicianCode,
      paymentMode,
      visitKind,
      medicalInformation,
    }),
    officialPatientEvidence,
    officialPatientEvidenceRef,
    officialPatientEvidenceHash,
    insuranceEvidence: createEvidenceRef('summary.json#/insuranceReadiness', null),
    insuranceEvidenceRef: 'summary.json#/insuranceReadiness',
    insuranceEvidenceHash: createEvidenceRef('summary.json#/insuranceReadiness', null).hash,
    localSelectableEvidence: createEvidenceRef('summary.json#/localSelectableReadiness', null),
    localSelectableEvidenceRef: 'summary.json#/localSelectableReadiness',
    localSelectableEvidenceHash: createEvidenceRef('summary.json#/localSelectableReadiness', null).hash,
    selectorEvidence: createEvidenceRef('summary.json#/selectorReadiness', null),
    selectorEvidenceRef: 'summary.json#/selectorReadiness',
    selectorEvidenceHash: createEvidenceRef('summary.json#/selectorReadiness', null).hash,
    requestedPatientId: requestedPatientId || undefined,
    phase3AttemptPatientId: null,
    trialSourceCandidate: {
      requestedPatientId: requestedPatientId || undefined,
      probeCandidates: buildCandidateIds(),
      fixedTrialInitialRange: TRIAL_INITIAL_PATIENT_IDS,
      selectedPatientId: undefined,
      verdict: 'rejected',
    },
    officialPatientExistence: officialPatientEvidence,
    officialPatientReadinessAxes: buildOfficialPatientReadinessAxes(
      Object.fromEntries(buildCandidateIds().map((candidateId) => [candidateId, officialPatientEvidence])),
    ),
    insuranceReadiness: {
      verdict: 'not_verified',
      count: 0,
      effectiveCount: 0,
      key: `${facilityId}:${requestedPatientId || 'unresolved'}:${paymentMode}:${acceptanceDate}`,
      ...createEvidenceRef('preflight:insurance-readiness', null),
    },
    selectorReadiness: { status: 'not_verified', verdict: 'not_verified', accepted: false, reason: 'unknown', details: {} },
    localSelectableReadiness: {
      status: 'not_verified',
      verdict: 'not_verified',
      accepted: false,
      reason: 'unknown',
      exactMatchCount: 0,
      recordsReturned: 0,
      normalizedTargetPatientId: requestedPatientId || '',
      rawSensitiveFieldsExcluded: true,
    },
    medicalInformationReadiness: {
      status: 'not_verified',
      verdict: 'not_verified',
      accepted: false,
      reason: 'fatal_error',
      failedSubdimensions: [
        'department_ready',
        'physician_ready',
        'payment_ready',
        'visitKind_ready',
        'medicalInformation_input_ready',
        'required_identity_fields_match',
      ],
      rawSensitiveFieldsExcluded: true,
    },
    appointmentDependency: {
      flowMode: requestedAppointmentFlowMode,
      required: requestedAppointmentFlowMode === 'appointment_row',
      absenceBlocker: requestedAppointmentFlowMode === 'appointment_row',
      status: 0,
      apiResult: '',
      classification: 'ambiguous_readiness_failure',
      verdict: 'not_verified',
      accepted: false,
    },
    acceptmodv2ReadOnlyDiagnostic: {
      verdict: 'not_verified',
      apiResult: '',
      businessStatus: 'notVerified',
      businessReason: 'fatal_error',
      accepted: false,
      mutationSuccess: false,
      acceptedForPhase3Attempt: false,
    },
    mutationPolicy: buildReadonlyMutationPolicy(requestRecords),
    acceptedForPhase3Attempt: false,
    verdict: 'rejected',
    blockerClassification: 'environment-blocker',
    blockerReason: 'fatal_error',
    rawSensitiveFieldsExcluded: true,
    fatalErrorCategory: errorCategory(error),
  };
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(summaryMdPath, buildMarkdownSummary(summary), 'utf8');
  await context?.close?.().catch(() => {});
  await browser?.close?.().catch(() => {});
  console.error(error);
  process.exit(1);
}
