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
import { evaluateMedicalInformationGate } from './qa-lib/medical-information-gate.mjs';
import {
  SELECTOR_OPTION_MISSING_BLOCKER,
  resolveSelectableOption,
  summarizeSelectorGate,
} from './qa-lib/acceptmodv2-identity-gate.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const traceId = process.env.TRACE_ID ?? `trace-${runId}`;
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'https://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'orca-remediation', 'closeout', runId, 'qa', 'fullflow');
const screenshotDir = path.join(artifactRoot, 'screenshots');
const networkDir = path.join(artifactRoot, 'network');
const harDir = path.join(artifactRoot, 'har');
const requestXmlDir = path.join(artifactRoot, 'request-xml');
const recordHar = process.env.QA_RECORD_HAR === '1';
const harPath = path.join(harDir, 'network.har');
const stepLogPath = path.join(artifactRoot, 'steps.log');
const summaryJsonPath = path.join(artifactRoot, 'summary.json');
const summaryMdPath = path.join(artifactRoot, 'summary.md');
const blockerSummaryJsonPath = path.join(artifactRoot, 'blocker-summary.json');
const handoffStateJsonPath = path.join(artifactRoot, 'handoff-state.json');
const selectedVisitRowJsonPath = path.join(artifactRoot, 'selected-visit-row.json');
const consoleJsonPath = path.join(artifactRoot, 'console.json');
const pageErrorsJsonPath = path.join(artifactRoot, 'page-errors.json');
const medicalmodv2XmlPath = path.join(requestXmlDir, 'medicalmodv2.xml');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(networkDir, { recursive: true });
fs.mkdirSync(artifactRoot, { recursive: true });
fs.mkdirSync(requestXmlDir, { recursive: true });
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
    // Playwright transport may already be gone after the scenario finishes.
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

// Target order entity (procedure/treatment by default).
const orderEntity = process.env.QA_ORDER_ENTITY ?? 'treatmentOrder';

const orderBundleName = process.env.QA_ORDER_BUNDLE_NAME ?? `代表オーダー ${runId}`;
const orderItemName = process.env.QA_ORDER_ITEM_NAME ?? 'テストオーダー項目';
const orderQuantity = process.env.QA_ORDER_ITEM_QUANTITY ?? '1';
const masterKeyword = process.env.QA_MASTER_KEYWORD ?? '';
const masterType = process.env.QA_MASTER_TYPE ?? 'material';
const materialKeyword = process.env.QA_MATERIAL_KEYWORD ?? '';
const materialQuantity = process.env.QA_MATERIAL_QUANTITY ?? '';
const materialUnit = process.env.QA_MATERIAL_UNIT ?? '';

const expectedMedicationCode = process.env.QA_EXPECT_MEDICATION_CODE ?? '';
const expectedMedicationNumber = process.env.QA_EXPECT_MEDICATION_NUMBER ?? '';

const resolveQaOrderGroup = (entity) => {
  switch (entity) {
    case 'medOrder':
      return 'prescription';
    case 'injectionOrder':
      return 'injection';
    case 'treatmentOrder':
    case 'surgeryOrder':
    case 'otherOrder':
      return 'treatment';
    case 'testOrder':
    case 'physiologyOrder':
    case 'bacteriaOrder':
    case 'radiologyOrder':
      return 'test';
    case 'baseChargeOrder':
    case 'instractionChargeOrder':
      return 'charge';
    default:
      return null;
  }
};

const ORDER_GROUP_LABELS = {
  prescription: '処方',
  injection: '注射',
  treatment: '処置',
  test: '検査',
  charge: '算定',
};

const openOrderEditorFromCurrentChartsUi = async (page, entity) => {
  const orderGroup = resolveQaOrderGroup(entity);
  if (!orderGroup) {
    return { opened: false, source: 'unsupported_entity' };
  }

  const legacyGroupAdd = page.locator(`[data-test-id="order-dock-group-add-${orderGroup}"]`);
  if (await legacyGroupAdd.isVisible({ timeout: 3000 }).catch(() => false)) {
    await legacyGroupAdd.click();
    return { opened: true, source: `legacy_order_dock_group:${orderGroup}` };
  }

  const groupLabel = ORDER_GROUP_LABELS[orderGroup] ?? orderGroup;
  const rightDockButton = page.locator(`.soap-note__right-dock-button[data-tool="${orderGroup}"]`);
  if (await rightDockButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rightDockButton.click();
    const drawer = page.locator('.soap-note__right-drawer[data-open="true"]');
    await drawer.waitFor({ state: 'visible', timeout: 10000 });
    const subtype = drawer.locator(`button[data-drawer-subtype-entity="${entity}"]`);
    if (await subtype.isVisible({ timeout: 2000 }).catch(() => false)) {
      await subtype.click();
    }
    const createButton = drawer.getByRole('button', { name: '新規作成を開く' }).last();
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();
      return { opened: true, source: `right_utility_drawer:${orderGroup}` };
    }
    return { opened: false, source: `right_utility_drawer_create_missing:${orderGroup}` };
  }

  return { opened: false, source: `no_visible_order_entry:${groupLabel}` };
};

if (!patientId) {
  throw new Error('QA_PATIENT_ID is required; pass a current local-searchable patient id with a unique active entry.');
}

const session = buildQaSession({ facilityId, userId: authUserId, runId, scenarioLabel, sessionRole, sessionRoles });

const consoleMessages = [];
const pageErrors = [];
const networkRecords = [];
const requestRecords = [];
const MEDICAL_INFORMATION_PROBE_PATH = '/api/orca/official/appointments/medical-information';

const redactHeaders = (headers) => {
  const out = { ...(headers ?? {}) };
  for (const key of Object.keys(out)) {
    if (
      /^authorization$/i.test(key) ||
      /^cookie$/i.test(key) ||
      /^set-cookie$/i.test(key) ||
      /^username$/i.test(key) ||
      /^password$/i.test(key)
    ) {
      out[key] = '<<redacted>>';
    }
  }
  return out;
};

const isMedicalModV2Url = (url) => {
  if (!url) return false;
  // Match the exact v2 route only and avoid partial-path collisions.
  if (url.includes('/api21/medicalmodv2?')) return true;
  return /\/api21\/medicalmodv2(?:$|#)/.test(url);
};

const isTarget = (url) =>
  url.includes(MEDICAL_INFORMATION_PROBE_PATH) ||
  url.includes('/api/orca/official/visits/mutation') ||
  url.includes('/api/orca/queue') ||
  url.includes('/orca/queue') ||
  isMedicalModV2Url(url) ||
  url.includes('/orca21/medicalmodv2/outpatient') ||
  url.includes('/api/orca/official/appointments/list') ||
  url.includes('/api/orca/official/visits/list') ||
  // Order master search (materials, drugs, etc).
  url.includes('/api/orca/master/generic-class') ||
  url.includes('/api/orca/master/etensu') ||
  url.includes('/api/orca/master/material') ||
  url.includes('/api/orca/master/material') ||
  url.includes('/api/local/order/bundles') ||
  (url.includes('claim/outpatient') && url.includes('/orca/'));

const recordRequest = (request) => {
  const url = request.url();
  if (!isTarget(url)) return;
  requestRecords.push({
    url,
    method: request.method(),
    headers: redactHeaders(request.headers()),
    postData: request.postData() ?? '',
  });
};

const writeScreenshot = async (page, name, options = {}) => {
  if (!page || page.isClosed()) return null;
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  const fullPage = options.fullPage ?? true;
  try {
    await page.screenshot({ path: filePath, fullPage, timeout: 10000 });
  } catch (error) {
    if (!fullPage) {
      throw error;
    }
    await page.screenshot({ path: filePath, fullPage: false, timeout: 10000 });
  }
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

const normalizeSummaryString = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const readFirstString = (value, keys) => {
  if (!value || typeof value !== 'object') return undefined;
  for (const key of keys) {
    const direct = normalizeSummaryString(value[key]);
    if (direct) return direct;
  }
  return undefined;
};

const hasNestedScalarForKeys = (value, keys, depth = 0) => {
  if (depth > 6 || value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => hasNestedScalarForKeys(entry, keys, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => {
    if (keys.has(key) && normalizeSummaryString(String(entry ?? ''))) return true;
    return typeof entry === 'object' && entry != null && hasNestedScalarForKeys(entry, keys, depth + 1);
  });
};

const summarizeAcceptMutationResponse = async (response) => {
  if (!response) {
    return {
      observed: false,
      httpStatusClass: 'not_observed',
      businessSuccessClassification: 'not_observed',
    };
  }
  let raw = null;
  try {
    raw = await response.json();
  } catch {
    raw = null;
  }
  const httpStatus = response.status();
  const httpStatusClass = httpStatus >= 500 ? '5xx' : httpStatus >= 400 ? '4xx' : httpStatus >= 300 ? '3xx' : '2xx';
  const apiResult = readFirstString(raw, ['apiResult', 'Api_Result', 'result', 'Result']);
  const businessStatus = readFirstString(raw, ['businessStatus']);
  const businessReason = readFirstString(raw, ['businessReason']);
  const evidenceKeys = new Set([
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
    'acceptanceInfo',
    'Acceptance_Info',
    'acceptance_info',
  ]);
  const patientEvidenceKeys = new Set(['patient', 'Patient', 'patientInformation', 'Patient_Information', 'patient_information']);
  const acceptanceEvidencePresent =
    raw && typeof raw === 'object'
      ? Boolean(raw.hasRegistrationEvidence) || hasNestedScalarForKeys(raw, evidenceKeys)
      : false;
  const patientEvidencePresent = raw && typeof raw === 'object' ? hasNestedScalarForKeys(raw, patientEvidenceKeys) : false;
  const scheduleKeyPresent = Boolean(readFirstString(raw, ['scheduleKey', 'Schedule_Key', 'schedule_key']));
  const encounterKeyPresent = Boolean(readFirstString(raw, ['encounterKey', 'Encounter_Key', 'encounter_key']));
  const acceptanceIdPresent = Boolean(readFirstString(raw, ['acceptanceId', 'Acceptance_Id', 'acceptance_id']));
  const visitNumberPresent = Boolean(readFirstString(raw, ['visitNumber', 'Visit_Number', 'visit_number']));
  const businessSuccessClassification =
    businessStatus === 'businessAccepted' || businessStatus === 'businessAcceptedWithWarnings'
      ? 'business_accepted'
      : businessStatus === 'notVerified'
        ? 'not_verified'
        : businessStatus === 'businessRejected'
          ? 'business_rejected'
          : businessStatus === 'diagnosticNoExistingAcceptance'
            ? 'diagnostic_no_existing_acceptance'
            : apiResult === '16'
              ? 'business_rejected_duplicate_acceptance'
              : apiResult === '21'
                ? 'business_rejected_insurance_mismatch'
                : apiResult === '10'
                  ? 'business_rejected_patient_not_found'
                  : apiResult === '60'
                    ? 'diagnostic_no_existing_acceptance'
            : apiResult
              ? 'api_result_observed_unclassified'
              : 'no_parsed_business_result';

  return {
    observed: true,
    httpStatus,
    httpStatusClass,
    apiResult,
    businessStatus,
    businessReason,
    businessSuccessClassification,
    acceptanceEvidencePresent,
    patientEvidencePresent,
    canonicalKeyPresence: {
      acceptanceId: acceptanceIdPresent,
      visitNumber: visitNumberPresent,
      scheduleKey: scheduleKeyPresent,
      encounterKey: encounterKeyPresent,
    },
    rawSensitiveFieldsExcluded: true,
  };
};

const readReceptionEntryDiagnostics = async (page, targetPatientId) =>
  page
    .evaluate((patientId) => {
      const rows = Array.from(document.querySelectorAll('[data-test-id="reception-entry-row"], [data-test-id="reception-entry-card"]'))
        .filter((node) => node instanceof HTMLElement)
        .map((node) => ({
          patientId: node.dataset.patientId ?? '',
          status: node.dataset.receptionStatus ?? '',
          scheduleKeyPresent: Boolean(node.dataset.scheduleKey),
          encounterKeyPresent: Boolean(node.dataset.encounterKey),
          receptionIdPresent: Boolean(node.dataset.receptionId),
          appointmentIdPresent: Boolean(node.dataset.appointmentId),
        }));
      const matching = rows.filter((row) => row.patientId === patientId);
      const active = matching.filter((row) => row.status !== '予約');
      const keyed = active.filter((row) => row.scheduleKeyPresent || row.encounterKeyPresent);
      return {
        totalRenderedRows: rows.length,
        matchingRows: matching.length,
        activeRows: active.length,
        keyedActiveRows: keyed.length,
        statuses: Array.from(new Set(matching.map((row) => row.status).filter(Boolean))).sort(),
        anyReceptionIdPresent: active.some((row) => row.receptionIdPresent),
        anyAppointmentIdPresent: active.some((row) => row.appointmentIdPresent),
        anyScheduleKeyPresent: active.some((row) => row.scheduleKeyPresent),
        anyEncounterKeyPresent: active.some((row) => row.encounterKeyPresent),
        rawSensitiveFieldsExcluded: true,
      };
    }, targetPatientId)
    .catch(() => ({
      totalRenderedRows: 0,
      matchingRows: 0,
      activeRows: 0,
      keyedActiveRows: 0,
      statuses: [],
      rawSensitiveFieldsExcluded: true,
    }));

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
    url,
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
  logStep(`medical information probe start url=${url}`);
  requestRecords.push({
    url,
    method: 'GET',
    headers: {},
    postData: '',
  });
  try {
    const response = await context.request.get(url);
    const body = await response.text().catch(() => '');
    networkRecords.push({
      url,
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
    });
    logStep(`medical information probe status=${response.status()}`);
    return {
      status: response.status(),
      ok: response.ok(),
      url,
    };
  } catch (error) {
    const message = String(error);
    networkRecords.push({
      url,
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
      url,
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

const selectOptionWithGate = async (selectLocator, field, desiredValue) => {
  const options = await selectLocator.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => node.value ?? ''),
  );
  const gate = resolveSelectableOption({
    field,
    desiredValue,
    options,
    allowLocalOptionInjection: false,
  });
  if (gate.ok && gate.resolved) {
    await selectLocator.selectOption(gate.resolved);
  }
  return gate;
};

const setObservabilityMeta = async (page) => {
  await page.evaluate(
    async ({ nextRunId, nextTraceId }) => {
      const mod = await import('/src/libs/observability/observability');
      mod.updateObservabilityMeta({ runId: nextRunId, traceId: nextTraceId, cacheHit: true, missingMaster: false, dataSourceTransition: 'server' });
    },
    { nextRunId: runId, nextTraceId: traceId },
  );
};

let activeBrowser = null;
let activeContext = null;
let activePage = null;
let lastMedicalmodv2RequestXml = '';
let lastSummary = null;
let lastHandoffState = { status: 'not-started' };
let lastSelectedVisitRow = null;
let allowExistingAcceptanceHandoffGate = false;

const readSelectedVisitRow = async (page) =>
  await page
    .evaluate(() => {
      const normalize = (value) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.replace(/\s+/g, ' ').trim();
        return trimmed || null;
      };
      const row = document.querySelector('.patients-tab__row--selected');
      if (!(row instanceof HTMLElement)) {
        return null;
      }
      return {
        name: normalize(row.querySelector('.patients-tab__row-name')?.textContent),
        patientId: normalize(row.querySelector('.patients-tab__row-patientid')?.textContent),
        timeLabel: normalize(row.querySelector('.patients-tab__row-time-label')?.textContent),
        timeValue: normalize(row.querySelector('.patients-tab__row-time-value')?.textContent),
        statusPills: Array.from(row.querySelectorAll('.patients-tab__row-pill'))
          .map((node) => normalize(node.textContent))
          .filter(Boolean),
        subitems: Array.from(row.querySelectorAll('.patients-tab__row-subitem'))
          .map((node) => normalize(node.textContent))
          .filter(Boolean),
        memo: normalize(row.querySelector('.patients-tab__row-memo')?.textContent),
      };
    })
    .catch(() => null);

const buildBlockerSummary = (summary) => ({
  runId: summary.runId,
  traceId: summary.traceId,
  blockerClassification: summary.blockerClassification,
  blockerReason: summary.blockerReason,
  medicalInformationProbe: summary.medicalInformationProbe,
  acceptMutation: summary.acceptResult?.acceptMutation,
  receptionEntryDiagnostics: summary.receptionEntryDiagnostics,
  chartsHandoff: summary.chartsHandoff,
  visitRowReadiness: summary.visitRowReadiness,
  sendResult: {
    status: summary.sendResult?.status,
    disabled: summary.sendResult?.disabled,
    disabledReason: summary.sendResult?.disabledReason,
    guard: summary.sendResult?.guard,
    guardSummary: summary.sendResult?.guardSummary,
    dialog: summary.sendResult?.dialog,
    requestXmlPath: summary.sendResult?.requestXmlPath,
    validation: summary.sendResult?.validation,
  },
  orderResult: summary.orderResult,
  billingResult: summary.billingResult,
  handoffStatePath: 'handoff-state.json',
  selectedVisitRowPath: 'selected-visit-row.json',
  evidencePaths: summary.evidencePaths,
});

const evaluateFullflowMedicalInformationGate = () =>
  evaluateMedicalInformationGate({
    requestRecords,
    medicalInformation,
    expectedPatientId: patientId,
    expectedCandidateId: patientId,
    requireMutation: !allowExistingAcceptanceHandoffGate,
  });

const classifyMedicalInformationGateFailure = (gate) => {
  if (gate?.ok !== false) {
    return undefined;
  }
  const violatedKeys = Array.isArray(gate.violatedKeys) ? gate.violatedKeys : [];
  const medicalInformationViolation = violatedKeys.some((key) =>
    /medicalInformation|Medical_Information/i.test(String(key)),
  );
  if (medicalInformationViolation) {
    return 'medical_information_omission_violation';
  }
  if (violatedKeys.includes('patientId')) {
    return 'target_patient_identity_violation';
  }
  if (violatedKeys.includes('candidateId')) {
    return 'target_candidate_identity_violation';
  }
  if (violatedKeys.includes('requestNumber')) {
    return 'request_number_identity_violation';
  }
  if (violatedKeys.includes('targetMutationRequest')) {
    return 'target_mutation_request_missing_or_duplicate';
  }
  if (violatedKeys.includes('rawBodyDecisionRequired')) {
    return 'raw_body_decision_required';
  }
  return 'acceptmodv2_identity_gate_violation';
};

const persistArtifacts = (summary) => {
  lastSummary = summary;
  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords, null, 2));
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords, null, 2));
  fs.writeFileSync(consoleJsonPath, JSON.stringify(consoleMessages, null, 2));
  fs.writeFileSync(pageErrorsJsonPath, JSON.stringify(pageErrors, null, 2));
  if (lastMedicalmodv2RequestXml) {
    fs.writeFileSync(medicalmodv2XmlPath, lastMedicalmodv2RequestXml, 'utf8');
  }
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(blockerSummaryJsonPath, JSON.stringify(buildBlockerSummary(summary), null, 2));
  fs.writeFileSync(handoffStateJsonPath, JSON.stringify(lastHandoffState, null, 2));
  fs.writeFileSync(selectedVisitRowJsonPath, JSON.stringify(lastSelectedVisitRow, null, 2));
};

const buildSummaryMarkdown = (summary) =>
  `# WebORCA Full Flow\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- TRACE_ID: ${summary.traceId}\n` +
  `- 実施日時: ${summary.executedAt}\n` +
  `- Base URL: ${summary.baseURL}\n` +
  `- Facility ID: ${summary.facilityId}\n` +
  `- Patient ID: ${summary.patientId}\n` +
  `- Reception Row: ${summary.receptionRowStatus ?? 'unknown'}\n` +
  `- Medical Information Probe: ${summary.medicalInformationProbe?.status ?? '—'}\n` +
  `- Medical Information Gate: ${summary.medicalInformationGate?.ok === false ? 'failed' : summary.medicalInformationGate?.enforced ? 'passed' : 'skipped'}\n` +
  `- Medical Information Checked Requests: ${summary.medicalInformationGate?.checkedRequests ?? 0}\n` +
  `- Accept Mutation: ${summary.acceptResult?.acceptMutation?.businessSuccessClassification ?? 'unknown'}\n` +
  `- Reception Active Entries: ${summary.receptionEntryDiagnostics?.activeRows ?? 'unknown'} / keyed ${summary.receptionEntryDiagnostics?.keyedActiveRows ?? 'unknown'}\n` +
  `- Charts Handoff: ${summary.chartsHandoff?.status ?? 'unknown'}\n` +
  `- Visit Row Readiness: ${summary.visitRowReadiness ?? 'unknown'}\n` +
  `- Order Result: ${summary.orderResult?.status ?? 'unknown'}\n` +
  `- ORCA Send: ${summary.sendResult?.status ?? 'unknown'}\n` +
  `- Blocker: ${summary.blockerClassification}\n` +
  (summary.blockerReason ? `- Blocker Reason: ${summary.blockerReason}\n` : '') +
  (summary.fatalError ? `- Fatal Error: ${summary.fatalError}\n` : '') +
  `\n## Evidence\n\n` +
  `- Summary JSON: summary.json\n` +
  `- Blocker Summary: blocker-summary.json\n` +
  `- Handoff State: handoff-state.json\n` +
  `- Selected Visit Row: selected-visit-row.json\n` +
  `- Steps: steps.log\n` +
  `- Network: network/network.json\n` +
  `- Requests: network/requests.json\n` +
  `- Console: console.json\n` +
  `- Page errors: page-errors.json\n` +
  `- Request XML: request-xml/medicalmodv2.xml\n` +
  `- Screenshots: screenshots/\n` +
  `${recordHar ? '- HAR: har/network.har\n' : ''}` +
  `\n## Rerun\n\n` +
  `- QA_BASE_URL=${baseURL} RUN_ID=${summary.runId} TRACE_ID=${summary.traceId} QA_PATIENT_ID=${summary.patientId} node scripts/qa-fullflow-weborca.mjs\n`;

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  activeBrowser = browser;
  const { context, page } = await createAuthenticatedContext(browser, {
    baseURL,
    facilityId,
    userId: authUserId,
    password: authPasswordPlain,
    session,
    serviceWorkers: 'allow',
    recordHar: recordHar ? { path: harPath, content: 'embed' } : undefined,
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
  if (process.env.QA_SKIP_SW === '1') {
    logStep('serviceWorker check skipped');
  } else {
    // Ensure MSW service worker is controlling the page.
    // Avoid awaiting navigator.serviceWorker.ready in page context (can hang).
    const isControlled = async () =>
      await page
        .evaluate(() => ('serviceWorker' in navigator ? Boolean(navigator.serviceWorker.controller) : false))
        .catch(() => false);
    let controlled = await isControlled();
    for (let attempt = 0; attempt < 3 && !controlled; attempt += 1) {
      await page.waitForTimeout(1200);
      controlled = await isControlled();
      if (controlled) break;
      await page.reload({ waitUntil: 'domcontentloaded' });
      controlled = await isControlled();
      logStep(`serviceWorker retry attempt=${attempt + 1} controlled=${String(controlled)}`);
    }
    logStep(`serviceWorker controlled=${String(controlled)}`);
  }
  const scenarioApplied = await page
    .waitForFunction(() => window.__OUTPATIENT_SCENARIO__?.select, { timeout: 15000 })
    .then(async () => {
      await page.evaluate(() => {
        window.__OUTPATIENT_SCENARIO__.select('server-handoff');
      });
      return true;
    })
    .catch(() => false);
  logStep(`outpatient scenario server-handoff=${String(scenarioApplied)}`);
  await page.locator('.reception-page').waitFor({ timeout: 20000 });
  logStep('reception page ready');
  const openWorkflowButton = page.getByRole('button', { name: '既存患者受付/患者検索' });
  await openWorkflowButton.waitFor({ timeout: 20000 });
  await openWorkflowButton.click();
  logStep('opened reception workflow modal');

  const workflowModal = page.locator('[data-test-id="reception-accept-workflow-modal"]');
  await workflowModal.waitFor({ timeout: 20000 });
  const patientSearchForm = workflowModal.locator('[data-test-id="reception-patient-search-form"]');
  await patientSearchForm.waitFor({ timeout: 20000 });
  logStep('patient search form ready');
  logStep('accept form ready');

  await page
    .waitForFunction(() => {
      const select = document.querySelector('#reception-accept-department');
      return select && select.querySelectorAll('option').length >= 1;
    }, { timeout: 20000 })
    .catch(() => null);
  await page
    .waitForFunction(() => {
      const select = document.querySelector('#reception-accept-physician');
      return select && select.querySelectorAll('option').length >= 1;
    }, { timeout: 20000 })
    .catch(() => null);

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
  logStep('selected patient search result');

  let handoffMode = 'accept-mutation';
  let departmentSelection = { ok: true, resolved: '', skipped: 'existing-acceptance-handoff-not-used' };
  let paymentModeSelection = { ok: true, resolved: '', skipped: 'existing-acceptance-handoff-not-used' };
  let physicianSelection = { ok: true, resolved: '', skipped: 'existing-acceptance-handoff-not-used' };
  let visitKindSelection = { ok: true, resolved: '', skipped: 'existing-acceptance-handoff-not-used' };
  let medicalInformationSelection = { ok: true, resolved: '', skipped: 'existing-acceptance-handoff-not-used' };
  let selectorGate = {
    ok: true,
    missingFields: [],
    skipped: 'existing-acceptance-handoff-not-used',
  };
  let beforeShot = null;
  let afterShot = null;
  let toneText = '';
  let apiResultText = '';
  let durationText = '';
  let xhrDebugText = '';
  let acceptMutationSummary = {
    observed: false,
    httpStatusClass: 'not_run',
    businessSuccessClassification: 'not_run_existing_acceptance_handoff',
  };
  let receptionRowStatus = 'not-run-existing-acceptance-handoff';
  let receptionEntryDiagnostics = await readReceptionEntryDiagnostics(page, patientId);
  let chartsHandoff = {
    status: 'pending',
    scheduleKey: null,
    encounterKey: null,
    title: null,
  };
  const acceptForm = workflowModal.locator('[data-test-id="reception-accept-detail-modal"]');
  const patientSearchOpenChartsButton = workflowModal.locator('[data-test-id="reception-patient-search-open-charts"]').first();

  await patientSearchOpenChartsButton.waitFor({ timeout: 5000 }).catch(() => null);
  await page
    .waitForFunction(() => {
      const button = document.querySelector('[data-test-id="reception-patient-search-open-charts"]');
      if (!(button instanceof HTMLButtonElement)) return false;
      return !button.disabled && Boolean(button.dataset.scheduleKey || button.dataset.encounterKey);
    }, { timeout: 5000 })
    .catch(() => null);
  const existingChartsHandoff = await patientSearchOpenChartsButton
    .evaluate((button) => ({
      disabled: button.disabled,
      scheduleKey: button.getAttribute('data-schedule-key'),
      encounterKey: button.getAttribute('data-encounter-key'),
      title: button.getAttribute('title'),
    }))
    .catch(() => null);
  logStep(`existing acceptance charts handoff candidate=${JSON.stringify(existingChartsHandoff)}`);
  if (
    existingChartsHandoff &&
    existingChartsHandoff.disabled === false &&
    (existingChartsHandoff.scheduleKey || existingChartsHandoff.encounterKey)
  ) {
    handoffMode = 'existing-acceptance';
    allowExistingAcceptanceHandoffGate = true;
    chartsHandoff = {
      status: 'ready',
      scheduleKey: existingChartsHandoff.scheduleKey,
      encounterKey: existingChartsHandoff.encounterKey,
      title: existingChartsHandoff.title,
    };
    lastHandoffState = {
      status: 'ready',
      source: 'patient-search-existing-acceptance',
      acceptMutation: acceptMutationSummary,
      receptionEntryDiagnostics,
      ...chartsHandoff,
    };
    logStep(
      `existing acceptance charts handoff ready scheduleKey=${chartsHandoff.scheduleKey ?? '—'} encounterKey=${
        chartsHandoff.encounterKey ?? '—'
      }`,
    );
    await patientSearchOpenChartsButton.click();
    await page.waitForURL('**/charts**');
  }

  if (handoffMode !== 'existing-acceptance') {
    await acceptForm.waitFor({ timeout: 20000 });
    logStep('accept detail ready');
    departmentSelection = await selectOptionWithGate(
      acceptForm.locator('#reception-accept-department'),
      'departmentCode',
      departmentCode,
    );
    logStep(`department selected=${departmentSelection.resolved}`);
    paymentModeSelection = await selectOptionWithGate(
      acceptForm.locator('#reception-accept-payment-mode'),
      'paymentMode',
      paymentMode,
    );
    logStep(`payment mode selected=${paymentModeSelection.resolved}`);
    physicianSelection = await selectOptionWithGate(
      acceptForm.locator('#reception-accept-physician'),
      'physicianCode',
      physicianCode,
    );
    logStep(`physician selected=${physicianSelection.resolved}`);
    visitKindSelection = await selectOptionWithGate(
      acceptForm.locator('#reception-accept-visit-kind'),
      'visitKind',
      visitKind,
    );
    logStep(`visit kind selected=${visitKindSelection.resolved}`);
    medicalInformationSelection = await selectOptionWithGate(
      acceptForm.locator('#reception-accept-medical-information'),
      'medicalInformation',
      medicalInformation,
    );
    logStep(`medical information selected=${medicalInformationSelection.resolved || 'unselected'}`);
    selectorGate = summarizeSelectorGate({
      department: departmentSelection,
      paymentMode: paymentModeSelection,
      physician: physicianSelection,
      visitKind: visitKindSelection,
      medicalInformation: medicalInformationSelection,
    });
    if (!selectorGate.ok) {
      lastSummary = {
        runId,
        traceId,
        executedAt: new Date().toISOString(),
        baseURL,
        facilityId,
        sessionRole,
        patientId,
        departmentCode,
        physicianCode,
        paymentMode,
        visitKind,
        medicalInformation: medicalInformation || undefined,
        medicalInformationProbe,
        medicalInformationGate: evaluateFullflowMedicalInformationGate(),
        selection: {
          department: departmentSelection,
          paymentMode: paymentModeSelection,
          physician: physicianSelection,
          visitKind: visitKindSelection,
          medicalInformation: medicalInformationSelection,
          selectorGate,
          patientSearchInputMethod,
        },
        acceptResult: {},
        receptionRowStatus: 'not-run-selector-option-missing',
        chartsHandoff: { status: 'not-run' },
        visitRowReadiness: 'not-run',
        orderResult: { status: 'not-run' },
        sendResult: {
          status: 'not-run',
          validation: { ok: false, reason: 'selector_option_missing' },
        },
        billingResult: { status: 'not-run' },
        harPath: recordHar ? harPath : undefined,
        consoleMessages,
        pageErrors,
        blockerReason: `selector_missing:${selectorGate.missingFields.join(',') || 'unknown'}`,
        blockerClassification: SELECTOR_OPTION_MISSING_BLOCKER,
        evidencePaths: {
          summaryJson: 'summary.json',
          summaryMd: 'summary.md',
          blockerSummary: 'blocker-summary.json',
          handoffState: 'handoff-state.json',
          selectedVisitRow: 'selected-visit-row.json',
          stepsLog: 'steps.log',
          network: 'network/network.json',
          requests: 'network/requests.json',
          console: 'console.json',
          pageErrors: 'page-errors.json',
          screenshots: 'screenshots',
          har: recordHar ? 'har/network.har' : undefined,
        },
      };
      throw new Error(lastSummary.blockerReason);
    }

    beforeShot = await writeScreenshot(page, '01-reception-before-accept');

    const acceptResponsePromise = page
      .waitForResponse((response) => response.url().includes('/api/orca/official/visits/mutation'), { timeout: 20000 })
      .catch(() => null);

    await workflowModal.locator('[data-test-id="reception-accept-register"]').click();
    logStep('clicked reception send');
    const acceptResponse = await acceptResponsePromise;
    logStep('accept response observed');
    acceptMutationSummary = await summarizeAcceptMutationResponse(acceptResponse);
    logStep(`accept response classification=${JSON.stringify(acceptMutationSummary)}`);
    await page.waitForTimeout(2000);

    afterShot = await writeScreenshot(page, '02-reception-after-accept');
    const toneBanner = page.locator('.reception-accept .tone-banner');
    toneText = await safeText(toneBanner.first());
    apiResultText = await safeInnerText(page.locator('[data-test-id="accept-api-result"]'), 3000);
    durationText = await safeInnerText(page.locator('[data-test-id="accept-duration-ms"]'), 3000);
    xhrDebugText = await safeInnerText(page.locator('[data-test-id="accept-xhr-debug"]'), 3000);

    receptionRowStatus = 'found';
    const receptionRow = page.locator('.reception-table tbody tr', { hasText: patientId }).first();
    const retryButton = page.getByRole('button', { name: '再取得' }).first();
    try {
      await receptionRow.waitFor({ timeout: 15000 });
    } catch {
      if (await retryButton.isVisible().catch(() => false)) {
        await retryButton.click({ force: true }).catch((error) => {
          logStep(`retry click error=${String(error)}`);
        });
      }
      try {
        await receptionRow.waitFor({ timeout: 15000 });
      } catch {
        receptionRowStatus = 'not-found';
      }
    }

    await writeScreenshot(page, '03-reception-list');
    logStep(`reception row status=${receptionRowStatus}`);
    receptionEntryDiagnostics = await readReceptionEntryDiagnostics(page, patientId);
    logStep(`reception active diagnostics=${JSON.stringify(receptionEntryDiagnostics)}`);

    try {
    await patientSearchOpenChartsButton.waitFor({ timeout: 10000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-test-id="reception-patient-search-open-charts"]');
      if (!(button instanceof HTMLButtonElement)) return false;
      const hasCanonicalKey = Boolean(button.dataset.scheduleKey || button.dataset.encounterKey);
      return !button.disabled && hasCanonicalKey;
    }, { timeout: 20000 });
    chartsHandoff = await patientSearchOpenChartsButton.evaluate((button) => ({
      status: button.disabled ? 'disabled' : 'ready',
      scheduleKey: button.getAttribute('data-schedule-key'),
      encounterKey: button.getAttribute('data-encounter-key'),
      title: button.getAttribute('title'),
    }));
    lastHandoffState = {
      status: 'ready',
      source: 'patient-search-open-charts',
      acceptMutation: acceptMutationSummary,
      receptionEntryDiagnostics,
      ...chartsHandoff,
    };
    logStep(
      `charts handoff status=${chartsHandoff.status} scheduleKey=${chartsHandoff.scheduleKey ?? '—'} encounterKey=${
        chartsHandoff.encounterKey ?? '—'
      }`,
    );
    await patientSearchOpenChartsButton.click();
    await page.waitForURL('**/charts**');
  } catch (error) {
    const buttonState = await patientSearchOpenChartsButton
      .evaluate((button) => ({
        disabled: button.disabled,
        scheduleKey: button.getAttribute('data-schedule-key'),
        encounterKey: button.getAttribute('data-encounter-key'),
        title: button.getAttribute('title'),
      }))
      .catch(() => null);
    lastHandoffState = {
      status: 'error',
      source: 'patient-search-open-charts',
      error: String(error),
      buttonState,
      acceptMutation: acceptMutationSummary,
      receptionEntryDiagnostics,
    };
    logStep(`charts handoff error=${String(error)} state=${JSON.stringify(buttonState)}`);
    throw new Error(`canonical charts handoff did not become available after accept: ${String(error)}`);
  }
  }
  logStep('navigated to charts');
  await page.locator('.charts-page').waitFor({ timeout: 20000 });
  logStep('charts page ready');
  logStep(`charts url=${page.url()}`);
  const chartsUrl = new URL(page.url());
  const leakedQueryKeys = ['patientId', 'appointmentId', 'receptionId', 'visitDate'].filter((key) =>
    chartsUrl.searchParams.has(key),
  );
  logStep(`charts query leakedKeys=${leakedQueryKeys.join(',') || 'none'}`);
  if (leakedQueryKeys.length > 0) {
    throw new Error(`charts URL leaked scrubbed encounter params: ${leakedQueryKeys.join(', ')}`);
  }
  lastSelectedVisitRow = await readSelectedVisitRow(page);
  lastHandoffState = {
    ...lastHandoffState,
    status: 'navigated',
    chartsUrl: page.url(),
    leakedQueryKeys,
    selectedVisitRowPresent: Boolean(lastSelectedVisitRow),
  };
  await Promise.race([
    setObservabilityMeta(page),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]).catch(() => null);
  logStep('observability meta updated');

  const chartsMeta = page.locator('[data-test-id="charts-topbar-meta"]');
  const chartsRunId = await chartsMeta.getAttribute('data-run-id', { timeout: 5000 }).catch(() => null);
  const chartsTraceId = await chartsMeta.getAttribute('data-trace-id', { timeout: 5000 }).catch(() => null);

  const chartsShot = await writeScreenshot(page, '04-charts-open');

  let orderResult = { status: 'skipped', detail: 'not attempted' };
  try {
    const openResult = await openOrderEditorFromCurrentChartsUi(page, orderEntity);
    if (openResult.opened) {
      logStep(`order editor opened source=${openResult.source}`);
    } else {
      await page.keyboard.press('Control+Shift+U');
      const orderShortcut = orderEntity === 'treatmentOrder' ? 'Control+Shift+5' : 'Control+Shift+3';
      await page.keyboard.press(orderShortcut);
      logStep(`order editor shortcut fallback attempted after=${openResult.source}`);
    }
    const orderPanel = page.locator(`[data-test-id="${orderEntity}-edit-panel"]`);
    await orderPanel.waitFor({ timeout: 10000 });
    logStep('order panel ready');

    await orderPanel.locator(`#${orderEntity}-bundle-name`).fill(orderBundleName);
    if (masterKeyword) {
      try {
        await orderPanel.locator(`#${orderEntity}-master-type`).selectOption(masterType);
        await orderPanel.locator(`#${orderEntity}-master-keyword`).fill(masterKeyword);
        const masterKeywordInput = orderPanel.locator(`#${orderEntity}-master-keyword`);
        const masterSection = masterKeywordInput.locator(
          'xpath=ancestor::div[contains(@class,"charts-side-panel__subsection--search")]',
        );
        const masterResult = masterSection.locator('button.charts-side-panel__search-row').first();
        await masterResult.waitFor({ state: 'visible', timeout: 20000 });
        await masterResult.click();
        logStep(`master selected type=${masterType} keyword=${masterKeyword}`);
      } catch (error) {
        logStep(`master selection error=${String(error)}`);
      }
    }
    const itemNameLocator = orderPanel.locator(`#${orderEntity}-item-name-0`);
    const currentItemName = await itemNameLocator.inputValue().catch(() => '');
    if (!currentItemName.trim()) {
      await itemNameLocator.fill(orderItemName);
      logStep('order item name fallback filled');
    }
    await orderPanel.locator(`#${orderEntity}-item-quantity-0`).fill(orderQuantity);
    if (materialKeyword) {
      try {
        const materialKeywordInput = orderPanel.locator(`#${orderEntity}-material-keyword`);
        const materialResponsePromise = page
          .waitForResponse((response) => {
            const url = response.url();
            return (
              (url.includes('/api/orca/master/material') || url.includes('/api/orca/master/material')) &&
              response.request().method() === 'GET'
            );
          }, { timeout: 15000 })
          .catch(() => null);
        await materialKeywordInput.fill(materialKeyword);
        const materialSection = materialKeywordInput.locator(
          'xpath=ancestor::div[contains(@class,"charts-side-panel__subsection")]',
        );
        const materialResponse = await materialResponsePromise;
        if (materialResponse) {
          logStep(`material master response=${materialResponse.status()} url=${materialResponse.url()}`);
        } else {
          logStep('material master response=none');
        }

        const materialResult = materialSection.locator('button.charts-side-panel__search-row').first();
        const materialError = materialSection.locator('.charts-side-panel__notice--error').first();
        const materialEmpty = materialSection.locator('.charts-side-panel__empty').first();

        // Prefer confirming either results or an error/empty notice, so the run doesn't misclassify
        // "no results due to 503" as "UI missing".
        await Promise.race([
          materialResult.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
          materialError.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
          materialEmpty.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
        ]);

        if (await materialResult.isVisible().catch(() => false)) {
          await materialResult.click();
          logStep(`material selected keyword=${materialKeyword}`);
        } else if (await materialError.isVisible().catch(() => false)) {
          const message = await materialError.innerText().catch(() => '');
          logStep(`material result not available errorNotice=${message.replaceAll('\n', ' ').trim()}`);
        } else if (await materialEmpty.isVisible().catch(() => false)) {
          const message = await materialEmpty.innerText().catch(() => '');
          logStep(`material result empty notice=${message.replaceAll('\n', ' ').trim()}`);
        } else {
          logStep('material result not available (no row/notice visible)');
        }
        if (materialQuantity) {
          const q = orderPanel.locator(`#${orderEntity}-material-quantity-0`);
          if (await q.isVisible().catch(() => false)) {
            await q.fill(materialQuantity);
          } else {
            logStep('material quantity input not visible (material row not created)');
          }
        }
        if (materialUnit) {
          const u = orderPanel.locator(`#${orderEntity}-material-unit-0`);
          if (await u.isVisible().catch(() => false)) {
            await u.fill(materialUnit);
          } else {
            logStep('material unit input not visible (material row not created)');
          }
        }
      } catch (error) {
        logStep(`material selection error=${String(error)}`);
      }
    }

    const orderResponsePromise = page
      .waitForResponse((response) => response.url().includes('/api/local/order/bundles'), { timeout: 15000 })
      .catch(() => null);

    await orderPanel.locator('button[type="submit"]').first().click();
    const orderResponse = await orderResponsePromise;
    if (orderResponse) {
      orderResult = { status: String(orderResponse.status()), detail: orderResponse.url() };
    } else {
      orderResult = { status: 'no-response', detail: 'order API response not captured' };
    }
    logStep(`order result=${orderResult.status}`);
    await page.waitForTimeout(1500);
    await writeScreenshot(page, '05-order-edit');
    await page.keyboard.press('Escape');
  } catch (error) {
    orderResult = { status: 'error', detail: String(error) };
    logStep(`order error=${String(error)}`);
  }

  const finishButton = page.getByRole('button', { name: '診療終了' });
  const finishDisabled = await finishButton.isDisabled().catch(() => false);
  const finishDisabledReason = await finishButton.getAttribute('data-disabled-reason').catch(() => null);
  if (!finishDisabled) {
    await finishButton.click({ force: true }).catch((error) => {
      logStep(`finish click error=${String(error)}`);
    });
    logStep('clicked finish');
  } else {
    logStep(`finish disabled=${finishDisabledReason ?? 'unknown'}`);
  }
  const finishToast = page.locator('.charts-actions__toast');
  await finishToast.waitFor({ timeout: 15000 }).catch(() => null);
  const finishToastText = (await finishToast.textContent().catch(() => '')) ?? '';
  logStep(`finish toast=${finishToastText}`);
  await writeScreenshot(page, '06-charts-finish');

  const sendResponsePromise = page
    .waitForResponse(
      (response) =>
        isMedicalModV2Url(response.url()) ||
        response.url().includes('/orca21/medicalmodv2/outpatient'),
      { timeout: 20000 },
    )
    .catch(() => null);

  const requestCapturePromise = page
    .waitForEvent('request', {
      predicate: (request) =>
        isMedicalModV2Url(request.url()) || request.url().includes('/orca21/medicalmodv2/outpatient'),
      timeout: 20000,
    })
    .catch(() => null);

  const sendButton = page.getByRole('button', { name: 'ORCA 送信' });
  const approvalUnlockButton = page.getByRole('button', { name: '承認ロック解除' });
  const approvalUnlockVisible = await approvalUnlockButton.isVisible().catch(() => false);
  if (approvalUnlockVisible) {
    const approvalUnlockDisabled = await approvalUnlockButton.isDisabled().catch(() => false);
    if (!approvalUnlockDisabled) {
      await approvalUnlockButton.click();
      logStep('approval unlock clicked');
      await page.waitForTimeout(1200);
    } else {
      logStep('approval unlock disabled');
    }
  }
  const sendDisabled = await sendButton.isDisabled().catch(() => false);
  const sendDisabledReason = await sendButton.getAttribute('data-disabled-reason').catch(() => null);
  const sendGuard = page.locator('#charts-actions-send-guard');
  const sendGuardText = (await sendGuard.textContent().catch(() => '')) ?? '';
  const guardSummaryText = (await page.locator('.charts-actions__guard-summary').textContent().catch(() => '')) ?? '';
  const visitRowReadiness =
    sendDisabled && /(Insurance_Combination_Number|Voucher_Number|Sequential_Number)/.test(`${sendGuardText} ${sendDisabledReason ?? ''}`)
      ? 'missing_official_visit_identifiers'
      : sendDisabled
        ? 'blocked_for_other_reason'
        : 'ready';
  logStep(`orca send precheck disabled=${String(sendDisabled)} reason=${sendDisabledReason ?? '—'}`);
  if (sendGuardText.trim()) logStep(`orca send guard=${sendGuardText.replaceAll('\n', ' ').trim()}`);
  if (guardSummaryText.trim()) logStep(`orca send guardSummary=${guardSummaryText.replaceAll('\n', ' ').trim()}`);
  let dialogVisible = false;
  if (!sendDisabled) {
    await sendButton.click({ force: true }).catch((error) => {
      logStep(`orca send click error=${String(error)}`);
    });
    logStep('clicked orca send');
    const dialog = page.getByRole('alertdialog', { name: 'ORCA送信の確認' });
    dialogVisible = await dialog
      .waitFor({ timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (dialogVisible) {
      await dialog.getByRole('button', { name: '送信する' }).click();
      logStep('confirmed orca send');
    } else {
      logStep('orca send dialog not shown');
      // Fallback: force-run send handler if dialog was not rendered.
      const fallbackTriggered = await page
        .evaluate(() => {
          const hook = window.__chartsActionBarDebug;
          if (hook && typeof hook.triggerSend === 'function') {
            hook.triggerSend();
            return true;
          }
          return false;
        })
        .catch(() => false);
      logStep(`orca send fallback=${fallbackTriggered ? 'triggered' : 'unavailable'}`);
    }
  } else {
    logStep(`orca send disabled=${sendDisabledReason ?? 'unknown'}`);
  }

  const [sendResponse, sendRequest] = await Promise.all([sendResponsePromise, requestCapturePromise]);
  await page.waitForTimeout(2000);
  logStep(`orca send response=${sendResponse ? sendResponse.status() : 'none'}`);
  if (sendRequest) {
    const reqBody = sendRequest.postData() ?? '';
    logStep(`orca send request=${sendRequest.url()} bodyBytes=${reqBody.length}`);
  } else {
    logStep('orca send request=none');
  }

  // Fallback: resolve the latest captured record if Playwright waiters missed it.
  const fallbackMedicalModRecord = [...networkRecords]
    .reverse()
    .find((r) => typeof r?.url === 'string' && isMedicalModV2Url(r.url));

  const medicalmodv2RequestXml =
    (sendRequest && isMedicalModV2Url(sendRequest.url()) ? sendRequest.postData() : null) ??
    (fallbackMedicalModRecord?.request?.postData ? String(fallbackMedicalModRecord.request.postData) : '');
  lastMedicalmodv2RequestXml = medicalmodv2RequestXml;

  const validation = (() => {
    const xml = medicalmodv2RequestXml ?? '';
    if (!xml) return { ok: false, reason: 'no_request_xml' };
    const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hasXmlTagValue = (tagName, expectedValue) => {
      if (!expectedValue) return undefined;
      const pattern = new RegExp(`<${tagName}[^>]*>\\s*${escapeRegex(expectedValue)}\\s*</${tagName}>`);
      return pattern.test(xml);
    };
    const codeOk = expectedMedicationCode ? hasXmlTagValue('Medication_Code', expectedMedicationCode) : undefined;
    const numOk = expectedMedicationNumber ? hasXmlTagValue('Medication_Number', expectedMedicationNumber) : undefined;
    return {
      ok: Boolean(xml) && (codeOk ?? true) && (numOk ?? true),
      expectedMedicationCode: expectedMedicationCode || undefined,
      expectedMedicationNumber: expectedMedicationNumber || undefined,
      codeFound: codeOk,
      numberFound: numOk,
      requestXmlBytes: xml.length,
    };
  })();
  logStep(`medicalmodv2 validation=${JSON.stringify(validation)}`);

  const sendToastText = (await finishToast.textContent().catch(() => '')) ?? '';
  await writeScreenshot(page, '07-charts-orca-send');
  const sendDialogShot = dialogVisible ? await writeScreenshot(page, '07a-charts-orca-send-dialog') : null;
  const sendButtonAttrs = await sendButton
    .evaluate((button) => ({
      className: button.className,
      ariaDisabled: button.getAttribute('aria-disabled'),
      ariaDescribedBy: button.getAttribute('aria-describedby'),
      dataDisabledReason: button.getAttribute('data-disabled-reason'),
    }))
    .catch(() => null);
  if (sendButtonAttrs) {
    logStep(`orca send attrs=${JSON.stringify(sendButtonAttrs)}`);
  }

  let billingResult = { status: 'skipped', detail: 'not attempted' };
  try {
    const billingButton = page.getByRole('button', { name: '会計へ' });
    if (await billingButton.isVisible().catch(() => false)) {
      await billingButton.click();
      await page.waitForURL('**/reception**', { timeout: 10000 });
      await page.waitForTimeout(1500);
      await writeScreenshot(page, '08-reception-billing');
      billingResult = { status: 'clicked', detail: page.url() };
      logStep('clicked billing');
    }
  } catch (error) {
    billingResult = { status: 'error', detail: String(error) };
    logStep(`billing error=${String(error)}`);
  }

  await safeClose(() => context.close());
  await safeClose(() => browser.close());

  const blockerReason =
    sendResponse && sendResponse.status() >= 200 && sendResponse.status() < 300
      ? undefined
      : leakedQueryKeys.length > 0
        ? `privacy_contract_violation:${leakedQueryKeys.join(',')}`
        : visitRowReadiness === 'missing_official_visit_identifiers'
          ? 'visit_row_official_identifiers_missing'
          : networkRecords.some((record) => record.status >= 500)
            ? 'upstream_or_environment_failure'
            : pageErrors.length > 0
              ? 'repo_runtime_error'
              : sendDisabled
                ? 'send_guard_blocked'
                : 'unknown';

  const summary = {
    runId,
    traceId,
    executedAt: new Date().toISOString(),
    baseURL,
    facilityId,
    sessionRole,
    patientId,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformation: medicalInformation || undefined,
    medicalInformationProbe,
    medicalInformationGate: evaluateFullflowMedicalInformationGate(),
    handoffMode,
    selection: {
      department: departmentSelection,
      paymentMode: paymentModeSelection,
      physician: physicianSelection,
      visitKind: visitKindSelection,
      medicalInformation: medicalInformationSelection,
      selectorGate,
      patientSearchInputMethod,
    },
    acceptResult: {
      toneText,
      apiResultText,
      durationText,
      xhrDebugText,
      acceptMutation: acceptMutationSummary,
    },
    receptionRowStatus,
    receptionEntryDiagnostics,
    chartsHandoff,
    visitRowReadiness,
    charts: {
      chartsRunId,
      chartsTraceId,
      chartsShot,
    },
    orderResult,
    finishToastText,
    sendResult: {
      status: sendResponse ? String(sendResponse.status()) : 'no-response',
      url: sendResponse ? sendResponse.url() : '',
      toast: sendToastText,
      disabled: sendDisabled,
      disabledReason: sendDisabledReason ?? undefined,
      guard: sendGuardText.trim() || undefined,
      guardSummary: guardSummaryText.trim() || undefined,
      dialog: dialogVisible ? 'shown' : 'not-shown',
      dialogShot: sendDialogShot ?? undefined,
      buttonAttrs: sendButtonAttrs ?? undefined,
      requestUrl: sendRequest?.url() ?? undefined,
      requestBodyBytes: sendRequest?.postData()?.length ?? undefined,
      requestXmlPath: lastMedicalmodv2RequestXml ? 'request-xml/medicalmodv2.xml' : undefined,
      validation,
    },
    billingResult,
    harPath: recordHar ? harPath : undefined,
    consoleMessages,
    pageErrors,
    screenshots: {
      beforeReception: beforeShot,
      afterReception: afterShot,
      charts: chartsShot,
    },
    blockerReason,
    blockerClassification:
      sendResponse && sendResponse.status() >= 200 && sendResponse.status() < 300
        ? 'none'
        : leakedQueryKeys.length > 0
          ? 'repo-defect'
        : visitRowReadiness === 'missing_official_visit_identifiers'
          ? 'official-visit-row-blocker'
        : networkRecords.some((record) => record.status >= 500)
          ? 'environment-blocker'
          : pageErrors.length > 0
            ? 'repo-defect'
            : sendDisabled
              ? 'test-data-blocker'
              : 'repo-defect',
    evidencePaths: {
      summaryJson: 'summary.json',
      summaryMd: 'summary.md',
      blockerSummary: 'blocker-summary.json',
      handoffState: 'handoff-state.json',
      selectedVisitRow: 'selected-visit-row.json',
      stepsLog: 'steps.log',
      network: 'network/network.json',
      requests: 'network/requests.json',
      console: 'console.json',
      pageErrors: 'page-errors.json',
      requestXml: lastMedicalmodv2RequestXml ? 'request-xml/medicalmodv2.xml' : undefined,
      screenshots: 'screenshots',
      har: recordHar ? 'har/network.har' : undefined,
    },
  };
  if (summary.blockerClassification !== SELECTOR_OPTION_MISSING_BLOCKER && summary.medicalInformationGate.ok === false) {
    summary.blockerClassification = 'repo-defect';
    summary.blockerReason = classifyMedicalInformationGateFailure(summary.medicalInformationGate);
  }

  persistArtifacts(summary);
  fs.writeFileSync(summaryMdPath, buildSummaryMarkdown(summary));

  console.log(`QA log written: ${summaryMdPath}`);
  console.log(`Screenshots: ${screenshotDir}`);
  activeContext = null;
  activeBrowser = null;
  activePage = null;

  if (summary.medicalInformationGate.ok === false) {
    throw new Error(summary.medicalInformationGate.error);
  }
};

run().catch(async (error) => {
  logStep(`fatal error=${String(error)}`);
  const failureShot = await writeScreenshot(activePage, '99-failure').catch(() => null);
  const blockerClassification = networkRecords.some((record) => record.status >= 500)
    ? 'environment-blocker'
    : pageErrors.length > 0
      ? 'repo-defect'
      : 'test-data-blocker';
  const blockerReason = pageErrors.length > 0 ? 'repo_runtime_error' : 'fatal_before_send';
  const summary =
    lastSummary ?? {
      runId,
      traceId,
      executedAt: new Date().toISOString(),
      baseURL,
      facilityId,
      sessionRole,
      patientId,
      departmentCode,
      physicianCode,
      paymentMode,
      visitKind,
      medicalInformation: medicalInformation || undefined,
      medicalInformationProbe: undefined,
      medicalInformationGate: evaluateFullflowMedicalInformationGate(),
      receptionRowStatus: 'unknown',
      acceptResult: {
        acceptMutation: lastHandoffState?.acceptMutation,
      },
      receptionEntryDiagnostics: lastHandoffState?.receptionEntryDiagnostics,
      chartsHandoff: { status: 'error' },
      visitRowReadiness: 'unknown',
      orderResult: { status: 'not-run' },
      sendResult: {
        status: 'error',
        validation: lastMedicalmodv2RequestXml
          ? { ok: true, requestXmlBytes: lastMedicalmodv2RequestXml.length }
          : { ok: false, reason: 'no_request_xml' },
        requestXmlPath: lastMedicalmodv2RequestXml ? 'request-xml/medicalmodv2.xml' : undefined,
      },
      screenshots: {
        failure: failureShot,
      },
      consoleMessages,
      pageErrors,
      blockerReason,
      blockerClassification,
      fatalError: String(error),
      evidencePaths: {
        summaryJson: 'summary.json',
        summaryMd: 'summary.md',
        blockerSummary: 'blocker-summary.json',
        handoffState: 'handoff-state.json',
        selectedVisitRow: 'selected-visit-row.json',
        stepsLog: 'steps.log',
        network: 'network/network.json',
        requests: 'network/requests.json',
        console: 'console.json',
        pageErrors: 'page-errors.json',
        requestXml: lastMedicalmodv2RequestXml ? 'request-xml/medicalmodv2.xml' : undefined,
        screenshots: 'screenshots',
      },
    };
  if (summary.blockerClassification !== SELECTOR_OPTION_MISSING_BLOCKER && summary.medicalInformationGate?.ok === false) {
    summary.blockerClassification = 'repo-defect';
    summary.blockerReason = classifyMedicalInformationGateFailure(summary.medicalInformationGate);
  }
  persistArtifacts(summary);
  fs.writeFileSync(summaryMdPath, buildSummaryMarkdown(summary));
  await safeClose(() => activeContext?.close?.());
  await safeClose(() => activeBrowser?.close?.());
  console.error(error);
  process.exit(1);
});
