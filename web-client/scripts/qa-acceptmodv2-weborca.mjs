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
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'webclient', 'e2e', runId, 'reception-send');
const screenshotDir = path.join(artifactRoot, 'screenshots');
const networkDir = path.join(artifactRoot, 'network');
const harDir = path.join(artifactRoot, 'har');
const recordHar = process.env.QA_RECORD_HAR === '1';
const harPath = path.join(harDir, 'network.har');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(networkDir, { recursive: true });
if (recordHar) {
  fs.mkdirSync(harDir, { recursive: true });
}

const facilityId = resolveQaFacilityId();

const sessionRole = process.env.QA_ROLE ?? 'admin';
const sessionRoles = process.env.QA_ROLES
  ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean)
  : [sessionRole];
const scenarioLabel = process.env.QA_SCENARIO ?? sessionRole;

const authUserId = resolveQaUserId();
const authPasswordPlain = resolveQaPasswordPlain();

const patientId = process.env.QA_PATIENT_ID ?? '01414';
const departmentCode = process.env.QA_DEPARTMENT_CODE ?? '01';
const physicianCode = process.env.QA_PHYSICIAN_CODE ?? '10001';
const paymentMode = process.env.QA_PAYMENT_MODE ?? 'insurance';
const visitKind = process.env.QA_VISIT_KIND ?? '1';
const medicalInformation = (process.env.QA_MEDICAL_INFORMATION ?? '').trim();

const session = buildQaSession({ facilityId, userId: authUserId, runId, scenarioLabel, sessionRole, sessionRoles });

const consoleMessages = [];
const pageErrors = [];
const networkRecords = [];
const requestRecords = [];

const isTarget = (url) =>
  url.includes('/api/orca/official/visits/mutation') ||
  url.includes('/api/orca/queue') ||
  url.includes('/orca/queue');

const recordRequest = (request) => {
  const url = request.url();
  if (!isTarget(url)) return;
  requestRecords.push({
    url,
    method: request.method(),
    headers: request.headers(),
    postData: request.postData() ?? '',
  });
};

const writeScreenshot = async (page, name) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots/${fileName}`;
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
    url,
    status: response.status(),
    statusText: response.statusText(),
    request: {
      method: request.method(),
      headers: request.headers(),
      postData: request.postData() ?? '',
    },
    response: {
      headers: response.headers(),
      body: responseText,
    },
  };
  networkRecords.push(record);
};

const ensureOption = async (selectLocator, desiredValue) => {
  if (!desiredValue) return false;
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

const selectOptionFallback = async (selectLocator, desiredValue) => {
  const options = await selectLocator.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => node.value ?? ''),
  );
  let resolved = options.includes(desiredValue)
    ? desiredValue
    : options.find((value) => value && value !== '') ?? '';
  if (desiredValue && !options.includes(desiredValue)) {
    const injected = await ensureOption(selectLocator, desiredValue);
    if (injected) {
      resolved = desiredValue;
    }
  }
  if (resolved) {
    await selectLocator.selectOption(resolved);
  }
  return { desired: desiredValue, resolved, options };
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const { context, page, sessionMe } = await createAuthenticatedContext(browser, {
    baseURL,
    facilityId,
    userId: authUserId,
    password: authPasswordPlain,
    session,
    recordHar: recordHar ? { path: harPath, content: 'embed' } : undefined,
  });

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
  await page.locator('.reception-page').waitFor({ timeout: 20000 });
  const openWorkflowButton = page.getByRole('button', { name: '既存患者受付/患者検索' });
  await openWorkflowButton.waitFor({ timeout: 20000 });
  await openWorkflowButton.click();

  const workflowModal = page.locator('[data-test-id="reception-accept-workflow-modal"]');
  await workflowModal.waitFor({ timeout: 20000 });
  const patientSearchForm = workflowModal.locator('[data-test-id="reception-patient-search-form"]');
  await patientSearchForm.waitFor({ timeout: 20000 });

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

  await patientSearchForm.locator('#reception-patient-search-patient-id').fill(patientId);
  await patientSearchForm.locator('[data-test-id="reception-patient-search-submit"]').click();
  const resultListItem = workflowModal.locator('[role="region"][aria-label="患者検索結果モーダル"] [role="listitem"]').first();
  await resultListItem.waitFor({ timeout: 20000 }).catch(() => {
    throw new Error(
      `patient search returned no selectable result for QA_PATIENT_ID=${patientId}; set QA_PATIENT_ID to an ORCA-searchable patient in the current environment`,
    );
  });
  await resultListItem.click();

  const acceptForm = workflowModal.locator('[data-test-id="reception-accept-detail-modal"]');
  await acceptForm.waitFor({ timeout: 20000 });
  const departmentSelection = await selectOptionFallback(
    acceptForm.locator('#reception-accept-department'),
    departmentCode,
  );
  await acceptForm.locator('#reception-accept-payment-mode').selectOption(paymentMode);
  const physicianSelection = await selectOptionFallback(
    acceptForm.locator('#reception-accept-physician'),
    physicianCode,
  );
  const visitKindSelection = await selectOptionFallback(
    acceptForm.locator('#reception-accept-visit-kind'),
    visitKind,
  );
  const medicalInformationSelection = await selectOptionFallback(
    acceptForm.locator('#reception-accept-medical-information'),
    medicalInformation,
  );

  const beforeShot = await writeScreenshot(page, '01-reception-before-accept');

  const acceptResponsePromise = page
    .waitForResponse((response) => response.url().includes('/api/orca/official/visits/mutation'), { timeout: 20000 })
    .catch(() => null);

  await workflowModal.locator('[data-test-id="reception-accept-register"]').click();

  await acceptResponsePromise;

  await page.waitForTimeout(2000);

  const afterShot = await writeScreenshot(page, '02-reception-after-accept');
  const toneBanner = page.locator('.reception-accept .tone-banner');
  const toneText = (await toneBanner.first().textContent()) ?? '';
  const apiResultText = await page.locator('[data-test-id="accept-api-result"]').innerText();
  const durationText = await page.locator('[data-test-id="accept-duration-ms"]').innerText();
  const xhrDebugText = await page.locator('[data-test-id="accept-xhr-debug"]').innerText();

  await context.close();
  await browser.close();

  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL,
    facilityId,
    sessionRole,
    login: {
      sessionMeStatus: sessionMe.status,
      sessionMeBody: sessionMe.body,
    },
    patientId,
    departmentCode,
    physicianCode,
    paymentMode,
    visitKind,
    medicalInformation: medicalInformation || undefined,
    selection: {
      department: departmentSelection,
      physician: physicianSelection,
      visitKind: visitKindSelection,
      medicalInformation: medicalInformationSelection,
    },
    acceptResult: {
      toneText,
      apiResultText,
      durationText,
      xhrDebugText,
    },
    harPath: recordHar ? harPath : undefined,
    consoleMessages,
    pageErrors,
  };

  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords, null, 2), 'utf8');
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords, null, 2), 'utf8');
  fs.writeFileSync(path.join(artifactRoot, 'accept-summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  const log =
    `# Reception 既存患者受付（acceptmodv2）\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- 実施日時: ${summary.executedAt}\n` +
    `- Base URL: ${summary.baseURL}\n` +
    `- Facility ID: ${summary.facilityId}\n` +
    `- Session Role: ${summary.sessionRole}\n` +
    `- 患者ID: ${summary.patientId}\n` +
    `- 診療科: ${summary.selection.department.resolved || departmentCode}\n` +
    `- 担当医: ${summary.selection.physician.resolved || physicianCode}\n` +
    `- 保険/自費: ${summary.paymentMode}\n` +
    `- 来院区分: ${summary.visitKind}\n` +
    `- Before: ${beforeShot}\n` +
    `- After: ${afterShot}\n\n` +
    `## 送信結果\n\n` +
    `- Tone: ${summary.acceptResult.toneText}\n` +
    `- ${summary.acceptResult.apiResultText}\n` +
    `- ${summary.acceptResult.durationText}\n` +
    `- XHR Debug: ${summary.acceptResult.xhrDebugText}\n\n` +
    `## Network\n\n` +
    networkRecords.map((record) => `- ${record.status} ${record.url}`).join('\n') +
    `\n\n` +
    `## HAR\n\n` +
    `${recordHar ? `- ${harPath}` : '- なし'}\n\n` +
    `## Console Warnings/Errors\n\n` +
    (consoleMessages.length
      ? consoleMessages.map((entry) => `- [${entry.type}] ${entry.text}`).join('\n')
      : '- なし') +
    `\n\n` +
    `## Page Errors\n\n` +
    (pageErrors.length ? pageErrors.map((entry) => `- ${entry}`).join('\n') : '- なし') +
    `\n`;

  fs.writeFileSync(path.join(artifactRoot, 'accept-summary.md'), log, 'utf8');

  console.log(`Artifacts written to ${artifactRoot}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
