import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'webclient', 'claim-deprecation', runId);
const screenshotDir = path.join(artifactRoot, 'screenshots-claim-deprecation');

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
const orcaRequests = [];
const orcaResponses = [];
const claimRequests = [];

const record = (bucket, entry) => bucket.push(entry);

const writeScreenshot = async (page, name) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots-claim-deprecation/${fileName}`;
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

const isOrcaRequest = (url) => url.includes('/orca/') || url.includes('/orca21/') || url.includes('/api/orca/');
const isClaimRequest = (url) => url.includes('claim/outpatient') && isOrcaRequest(url);

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await createSessionContext(browser);
  const page = await context.newPage();

  page.on('request', (request) => {
    const url = request.url();
    if (isOrcaRequest(url)) {
      orcaRequests.push({ method: request.method(), url });
    }
    if (isClaimRequest(url)) {
      claimRequests.push({ method: request.method(), url });
    }
  });

  page.on('response', (response) => {
    const url = response.url();
    if (!isOrcaRequest(url)) return;
    orcaResponses.push({ status: response.status(), statusText: response.statusText(), url });
  });

  await runStep({
    label: 'Reception: 外来リスト表示',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/reception`,
    expected: 'reception-page が表示され、CLAIM 呼び出しが存在しない',
    action: async () => {
      await page.goto(`/f/${encodeURIComponent(facilityId)}/reception`, { waitUntil: 'domcontentloaded' });
      await page.locator('.reception-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(2000);
      const shot = await writeScreenshot(page, '01-reception-claim-deprecation');
      return `url=${page.url()} / ${shot}`;
    },
  });

  await runStep({
    label: 'Charts: 外来カルテ表示',
    url: `${baseURL}/f/${encodeURIComponent(facilityId)}/charts`,
    expected: 'charts-page が表示され、CLAIM 呼び出しが存在しない',
    action: async () => {
      await page.getByRole('link', { name: /カルテ|Charts/i }).click();
      await page.waitForURL('**/charts');
      await page.locator('.charts-page').waitFor({ timeout: 20000 });
      await page.waitForTimeout(2000);
      const shot = await writeScreenshot(page, '02-charts-claim-deprecation');
      return `url=${page.url()} / ${shot}`;
    },
  });

  await context.close();
  await browser.close();

  const uniqueOrcaRequests = Array.from(new Set(orcaRequests.map((r) => r.url)));
  const uniqueClaimRequests = Array.from(new Set(claimRequests.map((r) => r.url)));

  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL,
    facilityId,
    sessionRole: session.role,
    scenario: scenarioLabel,
    orcaRequestCount: orcaRequests.length,
    orcaResponseCount: orcaResponses.length,
    claimRequestCount: claimRequests.length,
    claimDetected: claimRequests.length > 0,
  };

  const toRows = (items) =>
    items
      .map(
        (item) =>
          `| ${item.label} | ${item.url} | ${item.expected} | ${item.result} | ${item.actual || item.error} |`,
      )
      .join('\n');

  const log = `# CLAIM 廃止検証（legacy claim outpatient 呼び出しゼロ確認）\n\n` +
    `- RUN_ID: ${summary.runId}\n` +
    `- 実施日時: ${summary.executedAt}\n` +
    `- Base URL: ${summary.baseURL}\n` +
    `- Facility ID: ${summary.facilityId}\n` +
    `- セッションロール: ${summary.sessionRole}\n` +
    `- シナリオ: ${summary.scenario}\n` +
    `- ORCAリクエスト数: ${summary.orcaRequestCount}\n` +
    `- ORCAレスポンス数: ${summary.orcaResponseCount}\n` +
    `- CLAIMリクエスト数: ${summary.claimRequestCount}\n` +
    `- CLAIM検知: ${summary.claimDetected}\n\n` +
    `| 項目 | URL | 期待 | 結果 | 証跡/備考 |\n` +
    `| --- | --- | --- | --- | --- |\n` +
    `${toRows(results)}\n\n` +
    `## ORCA Request URLs（重複除外）\n\n` +
    (uniqueOrcaRequests.length
      ? uniqueOrcaRequests.map((url) => `- ${url}`).join('\n')
      : '- なし') +
    `\n\n` +
    `## CLAIM Request URLs（検知時のみ）\n\n` +
    (uniqueClaimRequests.length
      ? uniqueClaimRequests.map((url) => `- ${url}`).join('\n')
      : '- なし') +
    `\n\n` +
    `## ORCA Responses（抜粋）\n\n` +
    (orcaResponses.length
      ? orcaResponses.map((r) => `- ${r.status} ${r.url}`).join('\n')
      : '- なし') +
    `\n`;

  fs.mkdirSync(artifactRoot, { recursive: true });
  fs.writeFileSync(path.join(artifactRoot, 'qa-claim-deprecation.md'), log);
  fs.writeFileSync(
    path.join(artifactRoot, 'qa-claim-deprecation.json'),
    JSON.stringify({ summary, results, orcaRequests, orcaResponses, claimRequests }, null, 2),
  );

  console.log(`QA log written: ${path.join(artifactRoot, 'qa-claim-deprecation.md')}`);
  console.log(`Screenshots: ${screenshotDir}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
