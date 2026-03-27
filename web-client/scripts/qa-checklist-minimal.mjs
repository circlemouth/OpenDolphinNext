import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'webclient', 'checklist-minimal', runId);
const screenshotDir = path.join(artifactRoot, 'screenshots-checklist-minimal');

fs.mkdirSync(screenshotDir, { recursive: true });

const facilityPath = path.resolve(process.cwd(), '..', 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

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
const consoleMessages = [];
const pageErrors = [];

const record = (bucket, entry) => bucket.push(entry);

const writeScreenshot = async (page, name) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots-checklist-minimal/${fileName}`;
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

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await createSessionContext(browser);
  const page = await context.newPage();

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
    label: 'Reception: 初回表示',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/reception`,
    expected: 'reception-page が表示される',
    action: async () => {
      await page.goto(`/f/${encodeURIComponent(facilityId)}/reception`, { waitUntil: 'domcontentloaded' });
      await page.locator('.reception-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(1500);
      const shot = await writeScreenshot(page, '01-reception');
      return `url=${page.url()} / ${shot}`;
    },
  });

  await runStep({
    label: 'Reception: reload',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/reception`,
    expected: 'reload 後も reception-page が表示される',
    action: async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.reception-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(1500);
      const shot = await writeScreenshot(page, '02-reception-reload');
      return `url=${page.url()} / ${shot}`;
    },
  });

  await runStep({
    label: 'Charts: 遷移',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/charts`,
    expected: 'charts-page が表示される',
    action: async () => {
      await page.getByRole('link', { name: /カルテ|Charts/i }).click();
      await page.waitForURL('**/charts');
      await page.locator('.charts-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(1500);
      const shot = await writeScreenshot(page, '03-charts');
      return `url=${page.url()} / ${shot}`;
    },
  });

  await runStep({
    label: 'Charts: back/forward',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/charts`,
    expected: 'back で reception、forward で charts が表示される',
    action: async () => {
      await page.goBack();
      await page.locator('.reception-page').waitFor({ timeout: 20000 });
      const backShot = await writeScreenshot(page, '04-back-to-reception');
      await page.goForward();
      await page.locator('.charts-page').waitFor({ timeout: 20000 });
      const forwardShot = await writeScreenshot(page, '05-forward-to-charts');
      return `back=${backShot} / forward=${forwardShot}`;
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

  const log = `# チェックリスト最小検証（遷移/リロード）\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- 実施日時: ${summary.executedAt}\n` +
    `- Base URL: ${summary.baseURL}\n` +
    `- Facility ID: ${summary.facilityId}\n` +
    `- セッションロール: ${summary.sessionRole}\n` +
    `- シナリオ: ${summary.scenario}\n` +
    `- console error count: ${summary.consoleErrorCount}\n` +
    `- console warning count: ${summary.consoleWarningCount}\n` +
    `- page error count: ${summary.pageErrorCount}\n\n` +
    `| 項目 | URL | 期待 | 結果 | 証跡/備考 |\n` +
    `| --- | --- | --- | --- | --- |\n` +
    `${toRows(results)}\n\n` +
    `## Console Errors/Warnings\n\n` +
    (consoleMessages.length
      ? consoleMessages.map((m) => `- ${m.type}: ${m.text}`).join('\n')
      : '- なし') +
    `\n\n` +
    `## Page Errors\n\n` +
    (pageErrors.length ? pageErrors.map((e) => `- ${e}`).join('\n') : '- なし') +
    `\n`;

  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'qa-checklist-minimal.md'), log);
  fs.writeFileSync(
    path.join(artifactRoot, 'qa-checklist-minimal.json'),
    JSON.stringify({ summary, results, consoleMessages, pageErrors }, null, 2),
  );

  console.log(`QA log written: ${path.join(artifactRoot, 'qa-checklist-minimal.md')}`);
  console.log(`Screenshots: ${screenshotDir}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
