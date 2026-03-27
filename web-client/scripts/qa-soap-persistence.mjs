import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'verification', runId, 'soap-persistence');
const screenshotDir = path.join(artifactRoot, 'screenshots');
const networkDir = path.join(artifactRoot, 'network');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(networkDir, { recursive: true });

const facilityPath = path.resolve(process.cwd(), '..', 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

const sessionRole = process.env.QA_ROLE ?? 'admin';
const sessionRoles = process.env.QA_ROLES
  ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean)
  : [sessionRole];
const scenarioLabel = process.env.QA_SCENARIO ?? sessionRole;

const authUserId = 'doctor1';
const authPasswordPlain = 'doctor2025';

const patientId = process.env.QA_PATIENT_ID ?? '01415';
const soapText = `SOAPテスト ${runId}`;

const session = {
  facilityId,
  userId: authUserId,
  displayName: `QA ${scenarioLabel}`,
  clientUuid: `qa-${runId}`,
  runId,
  role: sessionRole,
  roles: sessionRoles,
};

const consoleMessages = [];
const pageErrors = [];
const soapRequests = [];
const soapResponses = [];
const soapRequestFailures = [];

const writeScreenshot = async (page, name) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots/${fileName}`;
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

const SOAP_ENDPOINTS = ['/orca/chart/subjectives', '/orca25/subjectivesv2', '/orca/subjectiveslstv2'];

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

  await page.route('**/api/admin/config**', (route) => respondJson(route, adminConfigPayload));
  await page.route('**/api/admin/delivery**', (route) => respondJson(route, adminConfigPayload));

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('request', (request) => {
    const url = request.url();
    if (SOAP_ENDPOINTS.some((endpoint) => url.includes(endpoint))) {
      soapRequests.push({ url, method: request.method(), postData: request.postData() ?? '' });
    }
  });
  page.on('response', async (response) => {
    const url = response.url();
    if (!SOAP_ENDPOINTS.some((endpoint) => url.includes(endpoint))) return;
    let body = '';
    try {
      body = await response.text();
    } catch (error) {
      body = `<<failed to read response body: ${String(error)}>>`;
    }
    soapResponses.push({ url, status: response.status(), statusText: response.statusText(), body });
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!SOAP_ENDPOINTS.some((endpoint) => url.includes(endpoint))) return;
    soapRequestFailures.push({
      url,
      errorText: request.failure()?.errorText ?? 'unknown',
    });
  });

  const chartUrl = `/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(patientId)}`;
  await page.goto(chartUrl, { waitUntil: 'commit', timeout: 30000 });
  await page.locator('.charts-page').waitFor({ timeout: 20000 });

  const soapPanel = page.locator('#charts-soap-note');
  await soapPanel.waitFor({ timeout: 20000 });

  const subjectTabButton = soapPanel.getByRole('button', { name: 'SOAP 記載' });
  if (await subjectTabButton.count()) {
    await subjectTabButton.click().catch(() => undefined);
  }

  const subjectiveTextArea = page.locator('#soap-note-subjective');
  await subjectiveTextArea.fill(soapText);
  await page.evaluate(
    ({ selector, value }) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(el, value);
      } else if ('value' in el) {
        // fallback
        el.value = value;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { selector: '#soap-note-subjective', value: soapText },
  );
  await page.waitForTimeout(300);
  const subjectiveEditable = await subjectiveTextArea.isEditable().catch(() => false);
  const subjectiveReadOnly = await subjectiveTextArea.getAttribute('readonly').catch(() => null);
  let subjectiveValue = await subjectiveTextArea.inputValue().catch(() => '');

  const saveButton = soapPanel.getByRole('button', { name: /保存|更新/ });
  const saveButtonDisabled = await saveButton.isDisabled().catch(() => true);
  const serverResponsePromise = page
    .waitForResponse((response) => response.url().includes('/orca/chart/subjectives'), { timeout: 15000 })
    .catch(() => null);
  if (!saveButtonDisabled) {
    await saveButton.click();
  }
  await serverResponsePromise;

  await page.waitForTimeout(1000);
  const shotSaved = await writeScreenshot(page, '01-soap-saved');

  const soapGuardText = await soapPanel.locator('.soap-note__guard').textContent().catch(() => null);
  const soapFeedbackText = await soapPanel.locator('.soap-note__feedback').textContent().catch(() => null);

  const sessionStorageSnapshot = await page.evaluate(() => {
    const keys = Object.keys(sessionStorage);
    const soapKey = keys.find((key) => key.startsWith('opendolphin:web-client:soap-history')) ?? null;
    const raw = soapKey ? sessionStorage.getItem(soapKey) : null;
    const encounterKey = keys.find((key) => key.startsWith('opendolphin:web-client:charts:encounter-context')) ?? null;
    const encounterRaw = encounterKey ? sessionStorage.getItem(encounterKey) : null;
    return {
      soapKey,
      rawLength: raw ? raw.length : 0,
      raw: raw ?? '',
      encounterKey,
      encounterRawLength: encounterRaw ? encounterRaw.length : 0,
      encounterRaw: encounterRaw ?? '',
    };
  });

  const soapHistoryEntry = page.locator('.document-timeline__soap-entry').first();
  const soapHistoryText = (await soapHistoryEntry.textContent().catch(() => '')) ?? '';
  const soapHistoryCount = await page.locator('.document-timeline__soap-entry').count().catch(() => 0);
  const shotReloaded = await writeScreenshot(page, '02-soap-history');

  await context.close();
  await browser.close();

  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL,
    facilityId,
    patientId,
    soapText,
    soapSaved: soapHistoryText.includes(soapText),
    reloadSucceeded: false,
    reloadError: 'reload not attempted (history view used)',
    soapHistoryMatched: soapHistoryText.includes(soapText),
    soapHistoryCount,
    saveButtonDisabled,
    subjectiveValue,
    subjectiveEditable,
    subjectiveReadOnly,
    soapGuardText,
    soapFeedbackText,
    sessionStorage: {
      key: sessionStorageSnapshot.soapKey,
      rawLength: sessionStorageSnapshot.rawLength,
      encounterKey: sessionStorageSnapshot.encounterKey,
      encounterRawLength: sessionStorageSnapshot.encounterRawLength,
    },
    soapRequestCount: soapRequests.length,
    soapResponseCount: soapResponses.length,
    soapRequestFailureCount: soapRequestFailures.length,
    consoleErrorCount: consoleMessages.filter((m) => m.type === 'error').length,
    consoleWarningCount: consoleMessages.filter((m) => m.type === 'warning').length,
    pageErrorCount: pageErrors.length,
    screenshots: {
      saved: shotSaved,
      reloaded: shotReloaded,
    },
  };

  fs.writeFileSync(path.join(networkDir, 'soap-requests.json'), JSON.stringify(soapRequests, null, 2));
  fs.writeFileSync(path.join(networkDir, 'soap-responses.json'), JSON.stringify(soapResponses, null, 2));
  fs.writeFileSync(path.join(networkDir, 'soap-request-failures.json'), JSON.stringify(soapRequestFailures, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'soap-sessionStorage.json'), JSON.stringify(sessionStorageSnapshot, null, 2));

  const log = `# SOAP 入力の保存/再表示（server-modernized 連携確認）\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- 実施日時: ${summary.executedAt}\n` +
    `- Base URL: ${summary.baseURL}\n` +
    `- Facility ID: ${summary.facilityId}\n` +
    `- Patient ID: ${summary.patientId}\n` +
    `- SOAP テキスト: ${summary.soapText}\n` +
    `- 再表示結果: ${summary.soapSaved ? 'OK' : 'NG'}\n` +
    `- 再表示方法: DocumentTimeline の SOAP履歴\n` +
    `- リロード: 未実施（履歴表示で確認）\n` +
    `- 保存ボタン disabled: ${summary.saveButtonDisabled}\n` +
    `- Subjective editable: ${summary.subjectiveEditable}\n` +
    `- Subjective readonly attr: ${summary.subjectiveReadOnly ?? 'none'}\n` +
    `- 入力後Subjective値: ${summary.subjectiveValue}\n` +
    `- SOAP guard: ${summary.soapGuardText ?? 'none'}\n` +
    `- SOAP feedback: ${summary.soapFeedbackText ?? 'none'}\n` +
    `- sessionStorage key: ${summary.sessionStorage.key ?? 'none'}\n` +
    `- sessionStorage length: ${summary.sessionStorage.rawLength}\n` +
    `- encounter context key: ${summary.sessionStorage.encounterKey ?? 'none'}\n` +
    `- encounter context length: ${summary.sessionStorage.encounterRawLength ?? 0}\n` +
    `- SOAP history count: ${summary.soapHistoryCount}\n` +
    `- SOAP endpoint requests: ${summary.soapRequestCount}\n` +
    `- SOAP endpoint responses: ${summary.soapResponseCount}\n` +
    `- SOAP request failures: ${summary.soapRequestFailureCount}\n` +
    `- console error count: ${summary.consoleErrorCount}\n` +
    `- console warning count: ${summary.consoleWarningCount}\n` +
    `- page error count: ${summary.pageErrorCount}\n\n` +
    `## Screenshots\n\n` +
    `- ${summary.screenshots.saved}\n` +
    `- ${summary.screenshots.reloaded}\n\n` +
    `## SOAP Endpoint Requests\n\n` +
    (soapRequests.length ? soapRequests.map((req) => `- ${req.method} ${req.url}`).join('\n') : '- なし') +
    `\n\n` +
    `## SOAP Endpoint Responses\n\n` +
    (soapResponses.length ? soapResponses.map((res) => `- ${res.status} ${res.url}`).join('\n') : '- なし') +
    `\n\n` +
    `## SOAP Endpoint Failures\n\n` +
    (soapRequestFailures.length
      ? soapRequestFailures.map((entry) => `- ${entry.errorText} ${entry.url}`).join('\n')
      : '- なし') +
    `\n`;

  fs.writeFileSync(path.join(artifactRoot, 'qa-soap-persistence.md'), log);
  fs.writeFileSync(path.join(artifactRoot, 'qa-soap-persistence.json'), JSON.stringify(summary, null, 2));

  console.log(`QA log written: ${path.join(artifactRoot, 'qa-soap-persistence.md')}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
