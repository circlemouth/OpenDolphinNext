import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5176';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(repoRoot, 'artifacts', 'webclient', 'order-bundle-save', runId);
const screenshotDir = path.join(artifactRoot, 'screenshots');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(artifactRoot, { recursive: true });

const facilityPath = path.resolve(repoRoot, 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

const authUserId = process.env.QA_USER_ID ?? 'doctor1';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'doctor2025';

const patientId = process.env.QA_PATIENT_ID ?? '01415';
const departmentCode = process.env.QA_DEPARTMENT_CODE ?? '01';
const physicianCode = process.env.QA_PHYSICIAN_CODE ?? '10001';
const paymentMode = process.env.QA_PAYMENT_MODE ?? 'insurance';
const visitKind = process.env.QA_VISIT_KIND ?? '1';
const bundleName = process.env.QA_ORDER_BUNDLE_NAME ?? `代表オーダー ${runId}`;
const itemName = process.env.QA_ORDER_ITEM_NAME ?? 'テストオーダー項目';
const itemQuantity = process.env.QA_ORDER_ITEM_QUANTITY ?? '1';

const session = {
  facilityId,
  userId: authUserId,
  displayName: `QA ${authUserId}`,
  clientUuid: `qa-${runId}`,
  runId,
  role: 'admin',
  roles: ['admin'],
};

const writeScreenshot = async (page, name) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots/${fileName}`;
};

const summary = {
  runId,
  baseURL,
  patientId,
  departmentCode,
  physicianCode,
  paymentMode,
  visitKind,
  bundleName,
  orderResponse: null,
  listCountText: null,
  recordsReturned: null,
  uiReflected: false,
  error: null,
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
  const context = await browser.newContext({ ignoreHTTPSErrors: true, baseURL });
  await context.addInitScript(
    ([key, value, auth]) => {
      window.sessionStorage.setItem(key, value);
      window.sessionStorage.setItem('devFacilityId', auth.facilityId);
      window.sessionStorage.setItem('devUserId', auth.userId);
      window.sessionStorage.setItem('devClientUuid', auth.clientUuid);
      window.sessionStorage.setItem(
        `opendolphin:web-client:charts:encounter-context:v2:${auth.facilityId}:${auth.userId}`,
        JSON.stringify({ patientId: auth.patientId }),
      );
      window.localStorage.setItem('devFacilityId', auth.facilityId);
      window.localStorage.setItem('devUserId', auth.userId);
      window.localStorage.setItem('devClientUuid', auth.clientUuid);
    },
    [
      'opendolphin:web-client:auth',
      JSON.stringify(session),
      {
        facilityId,
        userId: authUserId,
        passwordPlain: authPasswordPlain,
        clientUuid: session.clientUuid,
        patientId,
      },
    ],
  );

  const page = await context.newPage();
  try {
    const receptionPath = `/f/${encodeURIComponent(facilityId)}/reception`;
    await page.goto(receptionPath, { waitUntil: 'domcontentloaded' });
    const swReady = await page.evaluate(async (timeoutMs) => {
      if (!('serviceWorker' in navigator)) return false;
      const timeout = new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs));
      const ready = navigator.serviceWorker.ready
        .then(() => Boolean(navigator.serviceWorker.controller))
        .catch(() => false);
      return await Promise.race([ready, timeout]);
    }, 5000);
    if (!swReady) {
      await page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return;
        try {
          await navigator.serviceWorker.ready;
        } catch {}
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
    await page
      .waitForFunction(() => window.__OUTPATIENT_SCENARIO__?.select, { timeout: 5000 })
      .then(async () => {
        await page.evaluate(() => {
          window.__OUTPATIENT_SCENARIO__.select('server-handoff');
        });
        return true;
      })
      .catch(() => false);
    await page.locator('.reception-page').waitFor({ timeout: 20000 });
    const openWorkflowButton = page.getByRole('button', { name: '既存患者受付/患者検索' });
    await openWorkflowButton.waitFor({ timeout: 20000 });
    await openWorkflowButton.click();
    const workflowModal = page.locator('[data-test-id="reception-accept-workflow-modal"]');
    await workflowModal.waitFor({ timeout: 20000 });
    const patientSearchForm = workflowModal.locator('[data-test-id="reception-patient-search-form"]');
    await patientSearchForm.waitFor({ timeout: 20000 });
    await writeScreenshot(page, '00-reception-open');

    await patientSearchForm.locator('#reception-patient-search-patient-id').fill(patientId);
    await patientSearchForm.locator('[data-test-id="reception-patient-search-submit"]').click();
    const resultListItem = workflowModal.locator('[role="region"][aria-label="患者検索結果モーダル"] [role="listitem"]').first();
    await resultListItem.waitFor({ timeout: 20000 });
    await resultListItem.click();

    const acceptForm = workflowModal.locator('[data-test-id="reception-accept-detail-modal"]');
    await acceptForm.waitFor({ timeout: 20000 });
    await selectOptionFallback(acceptForm.locator('#reception-accept-department'), departmentCode);
    await acceptForm.locator('#reception-accept-payment-mode').selectOption(paymentMode);
    await selectOptionFallback(acceptForm.locator('#reception-accept-physician'), physicianCode);
    await selectOptionFallback(acceptForm.locator('#reception-accept-visit-kind'), visitKind);
    await selectOptionFallback(acceptForm.locator('#reception-accept-medical-information'), '');

    const acceptResponsePromise = page
      .waitForResponse((response) => response.url().includes('/api/orca/official/visits/mutation'), { timeout: 20000 })
      .catch(() => null);
    await workflowModal.locator('[data-test-id="reception-accept-register"]').click();
    await acceptResponsePromise;
    await page.waitForTimeout(2000);
    await writeScreenshot(page, '00-reception-after-accept');

    const targetRow = page.locator('tr.reception-table__row', { hasText: patientId }).first();
    const rowReady = await targetRow.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
    if (!rowReady) {
      const retryButton = page.getByRole('button', { name: '再取得' }).first();
      if (await retryButton.isVisible().catch(() => false)) {
        await retryButton.click();
      }
      const retryReady = await targetRow.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false);
      if (!retryReady) {
        throw new Error(`Reception row not found for patientId=${patientId}`);
      }
    }
    await targetRow.dblclick();
    await page.waitForURL('**/charts**', { timeout: 20000 });
    await page.locator('.charts-page').waitFor({ timeout: 20000 });
    await writeScreenshot(page, '01-charts-open');

    const orderTab = page.locator('button[data-utility-action="order-edit"]');
    await orderTab.waitFor({ state: 'visible', timeout: 20000 });
    await orderTab.click();

    const bundleNameInput = page.locator('#generalOrder-bundle-name');
    const inputReady = await bundleNameInput
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!inputReady) {
      await orderTab.click();
      await bundleNameInput.waitFor({ state: 'visible', timeout: 20000 });
    }
    await bundleNameInput.fill(bundleName);
    await page.locator('#generalOrder-item-name-0').fill(itemName);
    await page.locator('#generalOrder-item-quantity-0').fill(itemQuantity);

    const orderResponsePromise = page
      .waitForResponse((response) => response.url().includes('/api/local/order/bundles'), { timeout: 15000 })
      .catch(() => null);

    await page.locator('form.charts-side-panel__form button[type="submit"]').first().click();
    const orderResponse = await orderResponsePromise;
    if (orderResponse) {
      summary.orderResponse = {
        status: orderResponse.status(),
        url: orderResponse.url(),
      };
    }

    await page.waitForTimeout(2000);
    await writeScreenshot(page, '02-after-save');

    const listHeader = page.locator('.charts-side-panel__list-header span').nth(1);
    summary.listCountText = (await listHeader.textContent().catch(() => null)) ?? null;

    const orderBundlesUrl = `/api/local/order/bundles?patientId=${encodeURIComponent(patientId)}&entity=generalOrder`;
    const bundlesResponse = await page.request.get(orderBundlesUrl);
    if (bundlesResponse.ok()) {
      const payload = await bundlesResponse.json().catch(() => null);
      if (payload && typeof payload.recordsReturned === 'number') {
        summary.recordsReturned = payload.recordsReturned;
      }
    }

    const listLocator = page.locator('.charts-side-panel__items');
    const bundleText = listLocator.getByText(bundleName);
    const bundleVisible = await bundleText.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    summary.uiReflected = bundleVisible;
    if (bundleVisible) {
      await writeScreenshot(page, '03-bundle-listed');
    }
  } catch (error) {
    summary.error = String(error);
    await writeScreenshot(page, 'error');
  } finally {
    await context.close();
    await browser.close();
  }

  fs.writeFileSync(path.join(artifactRoot, 'summary.json'), JSON.stringify(summary, null, 2));
  const summaryMd = [
    `# Order Bundle Save Check`,
    `- runId: ${summary.runId}`,
    `- baseURL: ${summary.baseURL}`,
    `- patientId: ${summary.patientId}`,
    `- bundleName: ${summary.bundleName}`,
    `- orderResponse: ${summary.orderResponse ? `${summary.orderResponse.status} ${summary.orderResponse.url}` : 'none'}`,
    `- listCountText: ${summary.listCountText ?? 'n/a'}`,
    `- recordsReturned: ${summary.recordsReturned ?? 'n/a'}`,
    `- uiReflected: ${summary.uiReflected}`,
    summary.error ? `- error: ${summary.error}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  fs.writeFileSync(path.join(artifactRoot, 'summary.md'), summaryMd);
};

run();
