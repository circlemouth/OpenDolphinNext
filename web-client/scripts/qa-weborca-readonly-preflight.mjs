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
const patientId = process.env.QA_PATIENT_ID?.trim() ?? '';
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
  scenarioLabel: 'weborca-readonly-preflight',
  sessionRole,
  sessionRoles,
});

if (!patientId) {
  throw new Error('QA_PATIENT_ID is required for read-only WebORCA preflight.');
}

const MEDICAL_INFORMATION_PROBE_PATH = '/api/orca/official/appointments/medical-information';
const TARGET_PATHS = [
  MEDICAL_INFORMATION_PROBE_PATH,
  '/api/local/patients/search',
  '/api/orca/official/appointments/list',
  '/api/orca/official/visits/list',
];

const consoleMessages = [];
const pageErrors = [];
const networkRecords = [];
const requestRecords = [];

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

const isTarget = (url) => TARGET_PATHS.some((pathName) => url.includes(pathName));

const summarizeBody = (body) => {
  if (!body) return { bodyChars: 0 };
  try {
    const parsed = JSON.parse(body);
    return {
      bodyChars: body.length,
      keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 20) : [],
      apiResult: parsed?.apiResult,
      apiResultMessage: parsed?.apiResultMessage,
      recordsReturned: parsed?.recordsReturned,
      patientsCount: Array.isArray(parsed?.patients) ? parsed.patients.length : undefined,
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
  if (!isTarget(url)) return;
  requestRecords.push({
    url: redactUrl(url),
    method: request.method(),
    headers: redactHeaders(request.headers()),
    postData: summarizeBody(request.postData() ?? ''),
  });
};

const statusLabel = (accepted, verified = true) => {
  if (!verified) return 'not_verified';
  return accepted ? 'accepted' : 'rejected';
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

const parseApiResult = (body) => {
  try {
    const parsed = JSON.parse(body);
    return {
      apiResult: parsed?.apiResult ?? '',
      apiResultMessage: parsed?.apiResultMessage ?? '',
      itemsCount: Array.isArray(parsed?.items) ? parsed.items.length : undefined,
    };
  } catch {
    return { apiResult: '', apiResultMessage: '', itemsCount: undefined };
  }
};

const probeMedicalInformationOptions = async (context) => {
  const url = new URL(MEDICAL_INFORMATION_PROBE_PATH, baseURL).toString();
  logStep('medical-information read-only probe start');
  try {
    const response = await context.request.get(url);
    const body = await response.text().catch(() => '');
    const parsed = parseApiResult(body);
    networkRecords.push({
      url: redactUrl(url),
      status: response.status(),
      statusText: response.statusText(),
      request: { method: 'GET', headers: {}, postData: { bodyChars: 0 } },
      response: { headers: redactHeaders(response.headers()), body: summarizeBody(body) },
    });
    return {
      status: response.status(),
      ok: response.ok(),
      ...parsed,
      verdict: statusLabel(response.status() === 200 && parsed.apiResult === '00'),
      accepted: response.status() === 200 && parsed.apiResult === '00',
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      apiResult: '',
      apiResultMessage: '',
      verdict: 'rejected',
      accepted: false,
      error: String(error),
    };
  }
};

const selectEvidence = async (page) =>
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

const classify = ({ sessionMe, medicalInformationProbe, patientSearch, selectors }) => {
  if (sessionMe.status === 401 || sessionMe.status === 403 || medicalInformationProbe.status === 401 || medicalInformationProbe.status === 403) {
    return 'auth-blocker';
  }
  if (medicalInformationProbe.status === 0 || medicalInformationProbe.status >= 500) {
    return 'environment-blocker';
  }
  if (!medicalInformationProbe.accepted) {
    return 'external-trial-ambiguity';
  }
  if (!patientSearch.selectable) {
    return 'test-data-blocker';
  }
  if (Object.values(selectors).some((item) => !item.exists || item.optionCount < 1 || item.hasDesiredValue === false)) {
    return 'test-data-blocker';
  }
  if (pageErrors.length > 0) {
    return 'repo-defect';
  }
  return 'none';
};

const buildMarkdownSummary = (summary) =>
  `# WebORCA read-only preflight\n\n` +
  `- RUN_ID: ${summary.runId}\n` +
  `- verdict: ${summary.verdict}\n` +
  `- blockerClassification: ${summary.blockerClassification}\n` +
  `- medical-information: HTTP ${summary.medicalInformationProbe.status}, apiResult=${summary.medicalInformationProbe.apiResult || 'none'}\n` +
  `- patient search selectable: ${summary.patientSearch.selectable ? 'yes' : 'no'}\n` +
  `- C7 accepted: not verified (mutation not executed)\n` +
  `- visitptlstv2 business success: ${summary.visitListBusinessSuccess === true ? 'accepted' : summary.visitListBusinessSuccess === false ? 'rejected' : 'not verified'}\n`;

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
  const page = auth.page;
  const sessionMe = auth.sessionMe;

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('request', recordRequest);
  page.on('response', collectResponse);

  const medicalInformationProbe = await probeMedicalInformationOptions(context);

  await page.goto(`/f/${encodeURIComponent(facilityId)}/reception`, { waitUntil: 'domcontentloaded' });
  logStep('goto reception');
  await page.locator('.reception-page').waitFor({ timeout: 20_000 });
  await page.getByRole('button', { name: '既存患者受付/患者検索' }).click();
  logStep('opened workflow modal');
  const workflowModal = page.locator('[data-test-id="reception-accept-workflow-modal"]');
  await workflowModal.waitFor({ timeout: 20_000 });
  const patientSearchForm = workflowModal.locator('[data-test-id="reception-patient-search-form"]');
  await patientSearchForm.locator('#reception-patient-search-patient-id').fill(patientId);
  await patientSearchForm.locator('[data-test-id="reception-patient-search-submit"]').click();
  logStep('submitted read-only patient search');
  const resultListItems = workflowModal.locator('[role="region"][aria-label="患者検索結果モーダル"] [role="listitem"]');
  await resultListItems.first().waitFor({ timeout: 20_000 }).catch(() => null);
  const selectableCount = await resultListItems.count().catch(() => 0);
  const firstResultSelectable =
    selectableCount > 0
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
  const patientSearch = {
    patientId,
    selectable: firstResultSelectable,
    selectableCount,
    verdict: statusLabel(firstResultSelectable),
  };
  if (firstResultSelectable) {
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
  }
  const selectors = firstResultSelectable
    ? await selectEvidence(page)
    : {
        department: { exists: false, optionCount: 0, hasDesiredValue: false, notVerifiedReason: 'patient search returned no selectable result' },
        physician: { exists: false, optionCount: 0, hasDesiredValue: false, notVerifiedReason: 'patient search returned no selectable result' },
        visitKind: { exists: false, optionCount: 0, hasDesiredValue: false, notVerifiedReason: 'patient search returned no selectable result' },
        paymentMode: { exists: false, optionCount: 0, hasDesiredValue: false, notVerifiedReason: 'patient search returned no selectable result' },
        medicalInformation: { exists: false, optionCount: 0, hasDesiredValue: true, notVerifiedReason: 'patient search returned no selectable result' },
      };

  const visitListRecord = [...networkRecords].reverse().find((record) => record.url.includes('/api/orca/official/visits/list'));
  const visitListApiResult = visitListRecord?.response?.body?.apiResult;
  const visitListBusinessSuccess = visitListApiResult ? visitListApiResult === '00' : undefined;
  const selectorVerdicts = Object.fromEntries(
    Object.entries(selectors).map(([key, item]) => [
      key,
      {
        ...item,
        verdict: item.notVerifiedReason
          ? statusLabel(false, false)
          : statusLabel(item.exists && item.optionCount > 0 && item.hasDesiredValue !== false),
      },
    ]),
  );
  const visitListVerdict =
    visitListBusinessSuccess === undefined ? 'not_verified' : statusLabel(visitListBusinessSuccess);
  const blockerClassification = classify({ sessionMe, medicalInformationProbe, patientSearch, selectors });
  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL: redactUrl(baseURL),
    facilityId,
    sessionRole,
    login: {
      sessionMeStatus: sessionMe.status,
    },
    patientSearch,
    selectors: selectorVerdicts,
    medicalInformationProbe,
    visitListApiResult,
    visitListBusinessSuccess,
    visitListVerdict,
    verdict: blockerClassification === 'none' ? 'accepted' : 'rejected',
    blockerClassification,
    c7Gate: {
      status: 'not verified',
      reason: 'read-only preflight does not execute visits mutation',
    },
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
  if (blockerClassification !== 'none') {
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
    patientSearch: { patientId, selectable: false, selectableCount: 0 },
    verdict: 'rejected',
    blockerClassification: 'environment-blocker',
    fatalError: String(error),
    c7Gate: {
      status: 'not verified',
      reason: 'read-only preflight does not execute visits mutation',
    },
  };
  fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(summaryMdPath, buildMarkdownSummary(summary), 'utf8');
  await context?.close?.().catch(() => {});
  await browser?.close?.().catch(() => {});
  console.error(error);
  process.exit(1);
}
