import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'webclient', 'order-master-ui', runId);
const screenshotDir = path.join(artifactRoot, 'screenshots-order-master');

fs.mkdirSync(screenshotDir, { recursive: true });

const facilityPath = path.resolve(process.cwd(), '..', 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');
const patientId = process.env.QA_PATIENT_ID ?? '01415';

const sessionRole = process.env.QA_ROLE ?? 'admin';
const sessionRoles = process.env.QA_ROLES ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean) : [sessionRole];
const scenarioLabel = process.env.QA_SCENARIO ?? sessionRole;

const authUserId = 'doctor1';
const authPasswordPlain = 'doctor2025';

const session = {
  facilityId,
  userId: authUserId,
  displayName: `QA ${scenarioLabel}`,
  clientUuid: `qa-${runId}`,
  runId,
  role: sessionRole,
  roles: sessionRoles,
};

const results = [];
const masterResponses = [];
const httpErrors = [];
const consoleMessages = [];
const pageErrors = [];

const record = (bucket, entry) => bucket.push(entry);

const writeScreenshot = async (page, name) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots-order-master/${fileName}`;
};

const runStep = async ({ label, url, expected, action }) => {
  try {
    const actual = await action();
    record(results, { label, url, expected, result: 'OK', actual, error: '' });
  } catch (error) {
    record(results, { label, url, expected, result: 'NG', actual: '', error: String(error) });
  }
};

const createSessionContext = async (browser) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, baseURL });
  await ctx.addInitScript(
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
  return ctx;
};

const respondJson = (route, payload) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await createSessionContext(browser);
  const page = await context.newPage();

  const adminConfigPayload = {
    runId,
    source: 'mock',
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'auto',
    note: 'qa override',
  };
  const genericItems = [
    { code: '630002010', name: 'テスト薬剤A', unit: '錠', category: '内服', note: 'mock' },
  ];
  const materialItems = [
    { code: 'M-001', name: '処置テストA', unit: '回', category: '処置', note: 'mock' },
  ];
  const youhouItems = [
    { youhouCode: 'Y001', name: '1日1回', unit: '回', category: '用法', note: 'mock' },
  ];

  await page.route('**/api/admin/config**', (route) => {
    respondJson(route, adminConfigPayload);
  });
  await page.route('**/api/orca/master/generic-class**', (route) => {
    respondJson(route, { items: genericItems, totalCount: genericItems.length, runId });
  });
  await page.route('**/api/orca/master/material**', (route) => {
    respondJson(route, { items: materialItems, totalCount: materialItems.length, runId });
  });
  await page.route('**/api/orca/master/youhou**', (route) => {
    respondJson(route, { items: youhouItems, totalCount: youhouItems.length, runId });
  });

  page.on('response', (response) => {
    const url = response.url();
    if (response.status() >= 400) {
      httpErrors.push({ url, status: response.status(), statusText: response.statusText() });
    }
    if (!url.includes('/api/orca/master/')) return;
    masterResponses.push({ url, status: response.status(), statusText: response.statusText() });
  });

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: msg.text(), location: msg.location() });
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  const chartUrl = `/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(patientId)}`;

  await runStep({
    label: 'Charts: 薬剤マスタ表示と入力',
    url: `${baseURL}${chartUrl}`,
    expected: '処方編集で薬剤マスタ表示・選択・用量/用法入力が可能',
    action: async () => {
      await page.goto(chartUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('.charts-page').waitFor({ timeout: 20000 });
      const prescriptionTab = page.locator('[data-utility-action="prescription-edit"]');
      await prescriptionTab.waitFor({ state: 'visible', timeout: 20000 });
      if (await prescriptionTab.isDisabled()) {
        const shot = await writeScreenshot(page, '00-prescription-tab-disabled');
        throw new Error(`処方編集タブが無効: ${shot}`);
      }
      await prescriptionTab.click();
      await page.locator('[data-test-id="medOrder-edit-panel"]').waitFor({ timeout: 20000 });

      await page.locator('#medOrder-bundle-name').fill('降圧薬RP');
      await page.locator('#medOrder-master-keyword').fill('テスト薬剤');
      await page.getByRole('button', { name: /テスト薬剤A/ }).first().click();
      await page.locator('#medOrder-item-quantity-0').fill('1');
      await page.locator('#medOrder-admin').fill('1日1回');
      await page.locator('#medOrder-usage-keyword').fill('1日1回');
      await page.getByRole('button', { name: /1日1回/ }).first().click();

      const shot1 = await writeScreenshot(page, '01-med-master-input');
      return `url=${page.url()} / ${shot1}`;
    },
  });

  await runStep({
    label: 'Charts: 処置マスタ表示と入力',
    url: `${baseURL}${chartUrl}`,
    expected: 'オーダー編集で処置マスタ表示・選択・数量入力が可能',
    action: async () => {
      const orderTab = page.locator('[data-utility-action="order-edit"]');
      await orderTab.waitFor({ state: 'visible', timeout: 20000 });
      if (await orderTab.isDisabled()) {
        const shot = await writeScreenshot(page, '00-order-tab-disabled');
        throw new Error(`オーダー編集タブが無効: ${shot}`);
      }
      await orderTab.click();
      await page.locator('[data-test-id="generalOrder-edit-panel"]').waitFor({ timeout: 20000 });

      await page.locator('#generalOrder-bundle-name').fill('処置オーダー');
      await page.locator('#generalOrder-master-type').selectOption('material');
      await page.locator('#generalOrder-master-keyword').fill('処置テスト');
      await page.getByRole('button', { name: /処置テストA/ }).first().click();
      await page.locator('#generalOrder-item-quantity-0').fill('1');

      const shot2 = await writeScreenshot(page, '02-treatment-master-input');
      return `url=${page.url()} / ${shot2}`;
    },
  });

  await context.close();
  await browser.close();

  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL,
    facilityId,
    sessionRole: session.role,
    scenario: scenarioLabel,
    masterResponseCount: masterResponses.length,
    httpErrorCount: httpErrors.length,
    consoleErrorCount: consoleMessages.filter((m) => m.type === 'error').length,
    consoleWarningCount: consoleMessages.filter((m) => m.type === 'warning').length,
    pageErrorCount: pageErrors.length,
  };

  const toRows = (items) =>
    items
      .map(
        (item) =>
          `| ${item.label} | ${item.url} | ${item.expected} | ${item.result} | ${item.actual || item.error} |`,
      )
      .join('\n');

  const log = `# オーダー画面（薬剤/処置マスタ）UI確認\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- 実施日時: ${summary.executedAt}\n` +
    `- Base URL: ${summary.baseURL}\n` +
    `- Facility ID: ${summary.facilityId}\n` +
    `- セッションロール: ${summary.sessionRole}\n` +
    `- シナリオ: ${summary.scenario}\n` +
    `- master response count: ${summary.masterResponseCount}\n` +
    `- http error count: ${summary.httpErrorCount}\n` +
    `- console error count: ${summary.consoleErrorCount}\n` +
    `- console warning count: ${summary.consoleWarningCount}\n` +
    `- page error count: ${summary.pageErrorCount}\n\n` +
    `| 項目 | URL | 期待 | 結果 | 証跡/備考 |\n` +
    `| --- | --- | --- | --- | --- |\n` +
    `${toRows(results)}\n\n` +
    `## Master Responses\n\n` +
    (masterResponses.length
      ? masterResponses.map((r) => `- ${r.status} ${r.url}`).join('\n')
      : '- なし') +
    `\n\n` +
    `## HTTP Errors\n\n` +
    (httpErrors.length
      ? httpErrors.map((e) => `- ${e.status} ${e.url}`).join('\n')
      : '- なし') +
    `\n\n` +
    `## Console Errors/Warnings\n\n` +
    (consoleMessages.length
      ? consoleMessages.map((m) => `- ${m.type}: ${m.text}`).join('\n')
      : '- なし') +
    `\n\n` +
    `## Page Errors\n\n` +
    (pageErrors.length ? pageErrors.map((e) => `- ${e}`).join('\n') : '- なし') +
    `\n`;

  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'qa-order-master-ui.md'), log);
  fs.writeFileSync(
    path.join(artifactRoot, 'qa-order-master-ui.json'),
    JSON.stringify({ summary, results, masterResponses, httpErrors, consoleMessages, pageErrors }, null, 2),
  );

  console.log(`QA log written: ${path.join(artifactRoot, 'qa-order-master-ui.md')}`);
  console.log(`Screenshots: ${screenshotDir}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
