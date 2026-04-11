import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  buildQaSession,
  createAuthenticatedContext,
  resolveQaArtifactRoot,
  resolveQaFacilityId,
  resolveQaPasswordPlain,
  resolveQaUserId,
} from './qa-lib/session-auth.mjs';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const traceId = process.env.TRACE_ID ?? `trace-${runId}`;
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  resolveQaArtifactRoot('webclient', 'e2e', runId, 'fullflow');
const screenshotDir = path.join(artifactRoot, 'screenshots');
const networkDir = path.join(artifactRoot, 'network');
const harDir = path.join(artifactRoot, 'har');
const recordHar = process.env.QA_RECORD_HAR === '1';
const harPath = path.join(harDir, 'network.har');
const stepLogPath = path.join(artifactRoot, 'steps.log');

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

const patientId = process.env.QA_PATIENT_ID ?? '01416';
const departmentCode = process.env.QA_DEPARTMENT_CODE ?? '01';
const physicianCode = process.env.QA_PHYSICIAN_CODE ?? '10001';
const paymentMode = process.env.QA_PAYMENT_MODE ?? 'insurance';
const visitKind = process.env.QA_VISIT_KIND ?? '1';
const medicalInformation = process.env.QA_MEDICAL_INFORMATION ?? '01';

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

const session = buildQaSession({ facilityId, userId: authUserId, runId, scenarioLabel, sessionRole, sessionRoles });

const consoleMessages = [];
const pageErrors = [];
const networkRecords = [];
const requestRecords = [];

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

const writeScreenshot = async (page, name) => {
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

const setObservabilityMeta = async (page) => {
  await page.evaluate(
    async ({ nextRunId, nextTraceId }) => {
      const mod = await import('/src/libs/observability/observability');
      mod.updateObservabilityMeta({ runId: nextRunId, traceId: nextTraceId, cacheHit: true, missingMaster: false, dataSourceTransition: 'server' });
    },
    { nextRunId: runId, nextTraceId: traceId },
  );
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const { context, page } = await createAuthenticatedContext(browser, {
    baseURL,
    facilityId,
    userId: authUserId,
    password: authPasswordPlain,
    session,
    serviceWorkers: 'allow',
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
  const acceptForm = page.locator('[data-test-id="reception-accept-form"]');
  await acceptForm.waitFor({ timeout: 20000 });
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

  await acceptForm.locator('#reception-accept-patient-id').fill(patientId);
  logStep('filled patient id');
  const departmentSelection = await selectOptionFallback(
    acceptForm.locator('#reception-accept-department'),
    departmentCode,
  );
  logStep(`department selected=${departmentSelection.resolved}`);
  await acceptForm.locator('#reception-accept-payment-mode').selectOption(paymentMode);
  const physicianSelection = await selectOptionFallback(
    acceptForm.locator('#reception-accept-physician'),
    physicianCode,
  );
  logStep(`physician selected=${physicianSelection.resolved}`);
  const visitKindSelection = await selectOptionFallback(
    acceptForm.locator('#reception-accept-visit-kind'),
    visitKind,
  );
  logStep(`visit kind selected=${visitKindSelection.resolved}`);
  await acceptForm.locator('#reception-accept-note').fill(medicalInformation);
  logStep('filled note');

  const beforeShot = await writeScreenshot(page, '01-reception-before-accept');

  const acceptResponsePromise = page
    .waitForResponse((response) => response.url().includes('/api/orca/official/visits/mutation'), { timeout: 20000 })
    .catch(() => null);

  await page.getByRole('button', { name: '受付送信' }).click();
  logStep('clicked reception send');
  await acceptResponsePromise;
  await page.waitForTimeout(2000);

  const afterShot = await writeScreenshot(page, '02-reception-after-accept');
  const toneBanner = page.locator('.reception-accept .tone-banner');
  const toneText = await safeText(toneBanner.first());
  const apiResultText = await page.locator('[data-test-id="accept-api-result"]').innerText().catch(() => '');
  const durationText = await page.locator('[data-test-id="accept-duration-ms"]').innerText().catch(() => '');
  const xhrDebugText = await page.locator('[data-test-id="accept-xhr-debug"]').innerText().catch(() => '');

  let receptionRowStatus = 'found';
  const receptionRow = page.locator('.reception-table tbody tr', { hasText: patientId }).first();
  const retryButton = page.getByRole('button', { name: '再取得' }).first();
  try {
    await receptionRow.waitFor({ timeout: 15000 });
  } catch {
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click();
    }
    try {
      await receptionRow.waitFor({ timeout: 15000 });
    } catch {
      receptionRowStatus = 'not-found';
    }
  }

  await writeScreenshot(page, '03-reception-list');
  logStep(`reception row status=${receptionRowStatus}`);

  if (receptionRowStatus === 'found') {
    await receptionRow.dblclick();
    await page.waitForURL('**/charts**');
  } else {
    await page.goto(`/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(patientId)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/charts**');
  }
  logStep('navigated to charts');
  await page.locator('.charts-page').waitFor({ timeout: 20000 });
  logStep('charts page ready');
  logStep(`charts url=${page.url()}`);
  const encounterContextDump = await page
    .evaluate(() => {
      const matches = [];
      try {
        for (let i = 0; i < window.sessionStorage.length; i += 1) {
          const key = window.sessionStorage.key(i);
          if (!key) continue;
          if (!key.startsWith('opendolphin:web-client:charts:encounter-context:v2:')) continue;
          matches.push({ key, value: window.sessionStorage.getItem(key) });
        }
      } catch {}
      return matches.slice(0, 3);
    })
    .catch(() => []);
  if (Array.isArray(encounterContextDump) && encounterContextDump.length > 0) {
    logStep(`charts encounterContext keys=${encounterContextDump.map((m) => m.key).join(',')}`);
  } else {
    logStep('charts encounterContext keys=none');
  }
  await Promise.race([
    setObservabilityMeta(page),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]).catch(() => null);
  logStep('observability meta updated');

  const chartsMeta = page.locator('[data-test-id="charts-topbar-meta"]');
  const chartsRunId = await chartsMeta.getAttribute('data-run-id');
  const chartsTraceId = await chartsMeta.getAttribute('data-trace-id');

  const chartsShot = await writeScreenshot(page, '04-charts-open');

  let orderResult = { status: 'skipped', detail: 'not attempted' };
  try {
    await page.keyboard.press('Control+Shift+U');
    const orderShortcut = orderEntity === 'treatmentOrder' ? 'Control+Shift+5' : 'Control+Shift+3';
    await page.keyboard.press(orderShortcut);
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
    medicalInformation,
    selection: {
      department: departmentSelection,
      physician: physicianSelection,
      visitKind: visitKindSelection,
    },
    acceptResult: {
      toneText,
      apiResultText,
      durationText,
      xhrDebugText,
    },
    receptionRowStatus,
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
      validation,
    },
    billingResult,
    harPath: recordHar ? harPath : undefined,
    consoleMessages,
    pageErrors,
    screenshots: {
      beforeReception: beforeShot,
      afterReception: afterShot,
    },
  };

  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords, null, 2));
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords, null, 2));

  const log = `# WebORCA Full Flow (Reception -> Charts -> Order -> Finish -> ORCA Send)\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- TRACE_ID: ${summary.traceId}\n` +
    `- 実施日時: ${summary.executedAt}\n` +
    `- Base URL: ${summary.baseURL}\n` +
    `- Facility ID: ${summary.facilityId}\n` +
    `- Patient ID: ${summary.patientId}\n` +
    `- Department Code: ${summary.departmentCode}\n` +
    `- Physician Code: ${summary.physicianCode}\n` +
    `- Payment Mode: ${summary.paymentMode}\n` +
    `- Visit Kind: ${summary.visitKind}\n` +
    `- Reception Result: ${summary.acceptResult.toneText}\n` +
    `- Reception Row: ${summary.receptionRowStatus}\n` +
    `- Charts runId: ${summary.charts.chartsRunId ?? 'n/a'}\n` +
    `- Charts traceId: ${summary.charts.chartsTraceId ?? 'n/a'}\n` +
    `- Order Result: ${summary.orderResult.status} (${summary.orderResult.detail})\n` +
    `- Finish Toast: ${summary.finishToastText}\n` +
    `- ORCA Send: ${summary.sendResult.status} ${summary.sendResult.url}\n` +
    `- ORCA Send Disabled: ${summary.sendResult.disabled ? 'true' : 'false'}${summary.sendResult.disabledReason ? ` (${summary.sendResult.disabledReason})` : ''}\n` +
    `- ORCA Send Guard: ${summary.sendResult.guard ?? '—'}\n` +
    `- ORCA Send Guard Summary: ${summary.sendResult.guardSummary ?? '—'}\n` +
    `- ORCA Send Dialog: ${summary.sendResult.dialog ?? 'n/a'}\n` +
    `- ORCA Send Toast: ${summary.sendResult.toast}\n` +
    `- Billing: ${summary.billingResult.status} (${summary.billingResult.detail})\n` +
    `\n## Screenshots\n` +
    `- ${summary.screenshots.beforeReception}\n` +
    `- ${summary.screenshots.afterReception}\n` +
    `- ${summary.charts.chartsShot}\n` +
    (summary.sendResult.dialogShot ? `- ${summary.sendResult.dialogShot}\n` : '') +
    `\n## Notes\n` +
    `- Network/requests: ${networkDir}\n` +
    `- Console errors: ${consoleMessages.length}\n` +
    `- Page errors: ${pageErrors.length}\n`;

  fs.writeFileSync(path.join(artifactRoot, 'fullflow-summary.md'), log);
  fs.writeFileSync(path.join(artifactRoot, 'fullflow-summary.json'), JSON.stringify(summary, null, 2));

  console.log(`QA log written: ${path.join(artifactRoot, 'fullflow-summary.md')}`);
  console.log(`Screenshots: ${screenshotDir}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
