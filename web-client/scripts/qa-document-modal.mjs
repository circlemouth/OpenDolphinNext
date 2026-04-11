import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const now = new Date();
const baseRunId = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const runId = process.env.RUN_ID ?? `${baseRunId}-document-modal`;
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(repoRoot, 'artifacts', 'webclient', 'document-modal', runId);

fs.mkdirSync(artifactRoot, { recursive: true });

const facilityId = process.env.QA_FACILITY_ID ?? '1.3.6.1.4.1.9414.10.1';
const authUserId = process.env.QA_USER_ID ?? 'dolphindev';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'dolphindev';
const authPasswordMd5 =
  process.env.QA_PASSWORD_MD5 ?? crypto.createHash('md5').update(authPasswordPlain).digest('hex');

const patientId = process.env.QA_PATIENT_ID ?? 'P0002';
const visitDate = process.env.QA_VISIT_DATE ?? new Date().toISOString().slice(0, 10);

const steps = [];
const logStep = (message) => {
  steps.push(`[${new Date().toISOString()}] ${message}`);
};

const runSummary = {
  runId,
  baseURL,
  facilityId,
  userId: authUserId,
  patientId,
  visitDate,
  results: {},
  error: null,
};

const networkLogPath = path.join(artifactRoot, 'odletter-network.jsonl');
const networkLogStream = fs.createWriteStream(networkLogPath, { flags: 'a' });

const writeScreenshot = async (page, fileName) => {
  const filePath = path.join(artifactRoot, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return fileName;
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, baseURL });
  const clientUuid = `qa-${runId}`;
  const session = {
    facilityId,
    userId: authUserId,
    displayName: `QA ${authUserId}`,
    clientUuid,
    runId,
    role: 'admin',
    roles: ['admin'],
  };

  await context.addInitScript(
    ([authKey, authPayload, devAuth, encounterKey, encounterPayload]) => {
      window.sessionStorage.setItem(authKey, authPayload);
      window.sessionStorage.setItem('devFacilityId', devAuth.facilityId);
      window.sessionStorage.setItem('devUserId', devAuth.userId);
      window.sessionStorage.setItem('devClientUuid', devAuth.clientUuid);
      window.sessionStorage.setItem(encounterKey, encounterPayload);

      window.localStorage.setItem(authKey, authPayload);
      window.localStorage.setItem('devFacilityId', devAuth.facilityId);
      window.localStorage.setItem('devUserId', devAuth.userId);
      window.localStorage.setItem('devClientUuid', devAuth.clientUuid);
    },
    [
      'opendolphin:web-client:auth',
      JSON.stringify(session),
      {
        facilityId,
        userId: authUserId,
        passwordPlain: authPasswordPlain,
        clientUuid,
      },
      `opendolphin:web-client:charts:encounter-context:v2:${facilityId}:${authUserId}`,
      JSON.stringify({ patientId, visitDate }),
    ],
  );

  const page = await context.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/odletter/')) return;
    const request = response.request();
    const entry = {
      ts: new Date().toISOString(),
      url,
      method: request.method(),
      status: response.status(),
    };
    const body = request.postData();
    if (body) entry.requestBody = body;
    try {
      entry.responseBody = await response.text();
    } catch {
      entry.responseBody = null;
    }
    networkLogStream.write(`${JSON.stringify(entry)}\n`);
  });

  try {
    logStep('Charts を開く');
    const chartsPath = `/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(
      patientId,
    )}&visitDate=${encodeURIComponent(visitDate)}&runId=${encodeURIComponent(runId)}`;
    await page.goto(chartsPath, { waitUntil: 'domcontentloaded' });
    await page.locator('.charts-page').waitFor({ timeout: 20000 });

    logStep('ユーティリティを開く');
    await page.keyboard.press('Control+Shift+U');
    const documentTab = page.locator('button[data-utility-action="document"]');
    await documentTab.waitFor({ timeout: 10000 });
    const userProfilePromise = page.waitForResponse(
      (response) => response.url().includes('/user/') && response.request().method() === 'GET',
      { timeout: 20000 },
    );
    const kartePromise = page.waitForResponse(
      (response) => response.url().includes('/karte/pid/') && response.request().method() === 'GET',
      { timeout: 20000 },
    );
    await documentTab.click();

    const documentPanel = page.locator('[data-test-id="document-create-panel"]').first();
    await documentPanel.waitFor({ timeout: 10000 });

    logStep('文書を入力して保存');
    const userProfileResponse = await userProfilePromise.catch(() => null);
    const karteResponse = await kartePromise.catch(() => null);
    runSummary.results.userProfileStatus = userProfileResponse ? userProfileResponse.status() : null;
    runSummary.results.karteStatus = karteResponse ? karteResponse.status() : null;
    await page.waitForTimeout(500);
    await documentPanel.locator('#document-template').selectOption('REF-ODT-STD');
    await documentPanel.locator('#referral-hospital').fill('紹介状テスト病院');
    await documentPanel.locator('#referral-doctor').fill('テスト医師');
    await documentPanel.locator('#referral-purpose').fill('精査依頼');
    await documentPanel.locator('#referral-diagnosis').fill('高血圧症');
    await documentPanel.locator('#referral-body').fill(`紹介状テスト ${runId}`);

    const saveResponsePromise = page
      .waitForResponse(
        (response) => response.url().includes('/odletter/letter') && response.request().method() === 'PUT',
        { timeout: 20000 },
      )
      .catch(() => null);
    await documentPanel.getByRole('button', { name: '保存' }).click();
    const saveResponse = await saveResponsePromise;
    if (!saveResponse) {
      const errorNotice = await documentPanel
        .locator('.charts-side-panel__notice--error')
        .textContent()
        .catch(() => null);
      runSummary.results.documentSaveError = errorNotice?.trim() || 'no_response';
      throw new Error(`document save no response: ${runSummary.results.documentSaveError}`);
    }
    runSummary.results.documentSaveStatus = saveResponse.status();
    logStep(`文書保存レスポンス: HTTP ${saveResponse.status()}`);

    await documentPanel
      .getByText('文書を保存しました', { exact: false })
      .waitFor({ timeout: 20000 })
      .catch(() => {});
    await documentPanel.locator('.charts-document-list__items li').first().waitFor({ timeout: 20000 });
    await writeScreenshot(page, 'document-create.png');

    logStep('オーダー編集を開く');
    const orderTab = page.locator('button[data-utility-action="order-edit"]');
    await orderTab.click();
    const bundleNameInput = page.locator('#generalOrder-bundle-name');
    await bundleNameInput.waitFor({ timeout: 20000 });
    await bundleNameInput.fill(`文書オーダー ${runId}`);

    const itemNameInput = page.locator('#generalOrder-item-name-0');
    await itemNameInput.fill('紹介状');

    logStep('オーダーを保存して文書項目を作成');
    const orderSaveResponsePromise = page
      .waitForResponse(
        (response) => response.url().includes('/api/local/order/bundles') && response.request().method() !== 'GET',
        { timeout: 20000 },
      )
      .catch(() => null);
    const orderForm = page.locator('form').filter({ has: bundleNameInput });
    await orderForm.getByRole('button', { name: '保存して追加' }).click();
    const orderSaveResponse = await orderSaveResponsePromise;
    if (orderSaveResponse) {
      runSummary.results.orderSaveStatus = orderSaveResponse.status();
      logStep(`オーダー保存レスポンス: HTTP ${orderSaveResponse.status()}`);
      const orderSaveBody = await orderSaveResponse.json().catch(() => null);
      runSummary.results.orderSaveBody = orderSaveBody;
      runSummary.results.orderSaveRequestBody = orderSaveResponse.request().postData() ?? null;
    }
    const orderFetchResponse = await page
      .waitForResponse(
        (response) => response.url().includes('/api/local/order/bundles') && response.request().method() === 'GET',
        { timeout: 20000 },
      )
      .catch(() => null);
    if (orderFetchResponse) {
      runSummary.results.orderFetchStatus = orderFetchResponse.status();
      const orderFetchBody = await orderFetchResponse.json().catch(() => null);
      runSummary.results.orderFetchBody = orderFetchBody;
    }

    const openDocumentButton = page.locator('button.charts-side-panel__bundle-item--document', { hasText: '紹介状' }).first();
    await openDocumentButton.waitFor({ timeout: 20000 });
    await openDocumentButton.click();

    const modal = page.locator('[data-test-id="charts-document-modal"]');
    await modal.waitFor({ timeout: 10000 });
    await modal.locator('[data-test-id="document-create-panel"]').waitFor({ timeout: 10000 });
    runSummary.results.modalOpened = true;
    await writeScreenshot(page, 'document-modal.png');

    logStep('モーダルで編集を開始');
    const modalDocList = modal.locator('.charts-document-list__items');
    const firstDoc = modalDocList.locator('li').first();
    await firstDoc.getByRole('button', { name: '編集', exact: true }).click();
    await modal
      .locator('.charts-side-panel__notice', { hasText: '編集中:' })
      .waitFor({ timeout: 10000 })
      .catch(() => {});

    const modalPurpose = modal.locator('#referral-purpose');
    if (await modalPurpose.isVisible().catch(() => false)) {
      await modalPurpose.fill('精査依頼（更新）');
    }

    const updateResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/odletter/letter') && response.request().method() === 'PUT',
      { timeout: 20000 },
    );
    await modal.getByRole('button', { name: '更新' }).click();
    const updateResponse = await updateResponsePromise;
    runSummary.results.documentUpdateStatus = updateResponse.status();
    logStep(`文書更新レスポンス: HTTP ${updateResponse.status()}`);
    await writeScreenshot(page, 'document-edit.png');

    logStep('モーダルから印刷プレビューを開く');
    await firstDoc.getByRole('button', { name: '印刷', exact: true }).click();
    await page.waitForURL('**/charts/print/document**', { timeout: 20000 });
    await page.locator('[data-test-id="charts-document-print-dialog"]').waitFor({ timeout: 10000 });
    runSummary.results.printDialogVisible = true;
    await writeScreenshot(page, 'document-print-preview.png');
  } catch (error) {
    runSummary.error = error instanceof Error ? error.message : String(error);
    logStep(`エラー: ${runSummary.error}`);
  } finally {
    await browser.close();
    networkLogStream.end();
    fs.writeFileSync(path.join(artifactRoot, 'steps.txt'), steps.join('\n'));
    fs.writeFileSync(path.join(artifactRoot, 'run.json'), JSON.stringify(runSummary, null, 2));
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  fs.writeFileSync(path.join(artifactRoot, 'steps.txt'), `fatal: ${message}\n`);
  fs.writeFileSync(
    path.join(artifactRoot, 'run.json'),
    JSON.stringify({ runId, baseURL, facilityId, userId: authUserId, patientId, visitDate, error: message }, null, 2),
  );
  throw error;
});
