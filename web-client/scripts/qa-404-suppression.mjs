import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'webclient', 'screen-structure-plan', runId);
const screenshotDir = path.join(artifactRoot, 'screenshots-404-suppression');

fs.mkdirSync(screenshotDir, { recursive: true });

const facilityPath = path.resolve(process.cwd(), '..', 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

const authUserId = 'doctor1';
const authPasswordPlain = 'doctor2025';

const sessionRole = process.env.QA_ROLE ?? 'admin';
const sessionRoles = process.env.QA_ROLES ? process.env.QA_ROLES.split(',').map((role) => role.trim()).filter(Boolean) : [sessionRole];
const scenarioLabel = process.env.QA_SCENARIO ?? sessionRole;

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
const responses = [];
const consoleMessages = [];
const pageErrors = [];

const record = (bucket, entry) => bucket.push(entry);

const writeScreenshot = async (page, name) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots-404-suppression/${fileName}`;
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
      },
    ],
  );
  return ctx;
};

const isTarget = (url) =>
  url.includes('/api/orca/official/appointments/list') ||
  url.includes('/api/orca/official/visits/list') ||
  url.includes('/orca21/medicalmodv2/outpatient');

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await createSessionContext(browser);
  const page = await context.newPage();

  page.on('response', (response) => {
    const url = response.url();
    if (!isTarget(url)) return;
    responses.push({
      url,
      status: response.status(),
      statusText: response.statusText(),
    });
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

  await runStep({
    label: 'Reception: 外来リスト取得(404抑止パッチ確認)',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/reception`,
    expected: 'reception-page が表示され、console error が抑止される',
    action: async () => {
      await page.goto(`/f/${encodeURIComponent(facilityId)}/reception`, { waitUntil: 'domcontentloaded' });
      await page.locator('.reception-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(2000);
      const shot = await writeScreenshot(page, '01-reception-404-suppression');
      return `url=${page.url()} / ${shot}`;
    },
  });

  await runStep({
    label: 'Charts: 外来カルテ取得(404抑止パッチ確認)',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/charts`,
    expected: 'charts-page が表示され、console error が抑止される',
    action: async () => {
      await page.getByRole('link', { name: /カルテ|Charts/i }).click();
      await page.waitForURL('**/charts');
      await page.locator('.charts-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(2000);
      const shot = await writeScreenshot(page, '02-charts-404-suppression');
      return `url=${page.url()} / ${shot}`;
    },
  });

  await runStep({
    label: 'Patients: サムネイル 404 抑止確認',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/patients`,
    expected: 'patients-page が表示され、console error が抑止される',
    action: async () => {
      await page.goto(`/f/${encodeURIComponent(facilityId)}/patients`, { waitUntil: 'domcontentloaded' });
      await page.locator('.patients-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(2000);
      const shot = await writeScreenshot(page, '03-patients-404-suppression');
      return `url=${page.url()} / ${shot}`;
    },
  });

  await context.close();
  await browser.close();

  const responseSummary = responses.map((r) => `${r.status} ${r.url}`);
  const consoleSummary = consoleMessages.map((m) => `${m.type} ${m.text}`);
  const console404 = consoleMessages.filter((m) => /404|Not Found|not_found/i.test(m.text));

  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL,
    facilityId,
    sessionRole: session.role,
    scenario: scenarioLabel,
    consoleErrorCount: consoleMessages.filter((m) => m.type === 'error').length,
    consoleWarningCount: consoleMessages.filter((m) => m.type === 'warning').length,
    console404Count: console404.length,
    responseCount: responses.length,
  };

  const toRows = (items) =>
    items
      .map(
        (item) =>
          `| ${item.label} | ${item.url} | ${item.expected} | ${item.result} | ${item.actual || item.error} |`,
      )
      .join('\n');

  const log = `# 404抑止パッチ再検証（Reception/Charts）\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- 実施日時: ${summary.executedAt}\n` +
    `- Base URL: ${summary.baseURL}\n` +
    `- Facility ID: ${summary.facilityId}\n` +
    `- セッションロール: ${summary.sessionRole}\n` +
    `- シナリオ: ${summary.scenario}\n` +
    `- console error count: ${summary.consoleErrorCount}\n` +
    `- console warning count: ${summary.consoleWarningCount}\n` +
    `- console 404-ish count: ${summary.console404Count}\n` +
    `- network response count: ${summary.responseCount}\n\n` +
    `| 項目 | URL | 期待 | 結果 | 証跡/備考 |\n` +
    `| --- | --- | --- | --- | --- |\n` +
    `${toRows(results)}\n\n` +
    `## Network Responses\n\n` +
    `${responseSummary.map((line) => `- ${line}`).join('\n') || '- (none)'}\n\n` +
    `## Console Messages (error/warn)\n\n` +
    `${consoleSummary.map((line) => `- ${line}`).join('\n') || '- (none)'}\n\n` +
    `## Page Errors\n\n` +
    `${pageErrors.map((line) => `- ${line}`).join('\n') || '- (none)'}\n`;

  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'qa-404-suppression.md'), log);
  fs.writeFileSync(path.join(artifactRoot, 'qa-404-suppression.json'), JSON.stringify({ summary, results, responses, consoleMessages, pageErrors }, null, 2));

  console.log(`QA log written: ${path.join(artifactRoot, 'qa-404-suppression.md')}`);
  console.log(`Screenshots: ${screenshotDir}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
