import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Usage:
//   # Assumes Vite dev server already running at QA_BASE_URL with:
//   #   VITE_CHARTS_PAST_PANEL=1 VITE_CHARTS_DO_COPY=1
//   RUN_ID=... QA_BASE_URL=http://localhost:5195 node scripts/qa-charts-do-copy-phase1.mjs
//
// Evidence:
//   ../artifacts/verification/<RUN_ID>/charts-do-copy-phase1/

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'verification', runId, 'charts-do-copy-phase1');
const screenshotDir = path.join(artifactRoot, 'screenshots');

fs.mkdirSync(screenshotDir, { recursive: true });

const facilityPath = path.resolve(process.cwd(), '..', 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

const authUserId = 'doctor1';
const authPasswordPlain = 'doctor2025';

const session = {
  facilityId,
  userId: authUserId,
  displayName: 'QA do-copy',
  clientUuid: `qa-${runId}-do-copy`,
  runId,
  role: process.env.QA_ROLE ?? 'doctor',
  roles: (process.env.QA_ROLES ? process.env.QA_ROLES.split(',') : ['doctor']).map((v) => v.trim()).filter(Boolean),
};

const maskCss = `
  /* Mask sensitive content while keeping layout visible. */
  #charts-patient-summary * { filter: blur(7px) !important; }
  #charts-patients-tab * { filter: blur(7px) !important; }
  #charts-diagnosis * { filter: blur(7px) !important; }
  #charts-soap-note textarea { filter: blur(7px) !important; }
  #charts-document-timeline * { filter: blur(7px) !important; }
  #charts-past-hub .charts-past-hub__sub { filter: blur(7px) !important; }
  .charts-do-copy textarea { filter: blur(7px) !important; }
`;

const createSessionContext = async (browser) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, baseURL, viewport: { width: 1440, height: 900 } });
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
  const meta = {
    runId,
    baseURL,
    facilityId,
    executedAt: new Date().toISOString(),
    url: null,
    steps: [],
    checks: {},
  };

  try {
    const context = await createSessionContext(browser);
    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push({ type: msg.type(), text: msg.text() }));

    await page.goto(`/f/${encodeURIComponent(facilityId)}/charts?msw=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('.charts-page').waitFor({ timeout: 20000 });
    await page.locator('#charts-soap-note').waitFor({ timeout: 20000 });
    await page.locator('#charts-past-hub').waitFor({ timeout: 20000 });

    meta.url = page.url();
    meta.checks.flags = {
      dataChartsPastPanel: await page.locator('#charts-past-hub').count().then((n) => n > 0),
      dataChartsCompactUi: await page.locator('.charts-workbench').getAttribute('data-charts-compact-ui'),
      dataChartsCompactHeader: await page.locator('.charts-page').getAttribute('data-charts-compact-header'),
    };

    await page.addStyleTag({ content: maskCss });
    await page.waitForTimeout(500);

    const shot = async (name, locator = null) => {
      const file = path.join(screenshotDir, name);
      if (locator) {
        await locator.screenshot({ path: file });
      } else {
        await page.screenshot({ path: file, fullPage: false });
      }
      return `screenshots/${name}`;
    };

    meta.steps.push({ step: 'initial', screenshot: await shot('01-initial.png') });

    // Make a saved SOAP history entry (source).
    await page.locator('#soap-note-subjective').fill(`SRC: ${runId}`);
    await page.locator('#charts-soap-note .soap-note__primary').click();
    await page.waitForTimeout(400);
    meta.steps.push({ step: 'saved-source', screenshot: await shot('02-saved-source.png', page.locator('#charts-soap-note')) });

    // Modify current draft without saving (target).
    await page.locator('#soap-note-subjective').fill(`TARGET: ${runId}`);
    await page.waitForTimeout(200);
    meta.steps.push({ step: 'edited-target', screenshot: await shot('03-edited-target.png', page.locator('#charts-soap-note')) });

    // Open Past Hub -> Notes and launch Do copy preview.
    await page.locator('#charts-past-hub').getByRole('tab', { name: '記載', exact: true }).click();
    await page.waitForTimeout(300);
    meta.steps.push({ step: 'past-hub-notes', screenshot: await shot('04-past-hub-notes.png', page.locator('#charts-past-hub')) });

    const doButton = page.locator('li:has-text("Subjective") button:has-text("Do転記")').first();
    await doButton.click();
    await page.locator('[data-test-id="charts-do-copy-dialog"]').waitFor({ timeout: 5000 });
    meta.steps.push({ step: 'preview-open', screenshot: await shot('05-preview-open.png') });

    // Apply (overwrite target with source).
    await page.getByRole('button', { name: '適用' }).click();
    await page.waitForTimeout(300);
    meta.steps.push({ step: 'applied', screenshot: await shot('06-applied.png') });

    // Undo (restore target).
    await page.getByRole('button', { name: /Undo/ }).click();
    await page.waitForTimeout(300);
    meta.steps.push({ step: 'undone', screenshot: await shot('07-undone.png') });

    // Close dialog.
    await page.locator('[data-test-id="charts-do-copy-dialog"]').getByRole('button', { name: 'キャンセル', exact: true }).click();
    await page.waitForTimeout(200);
    meta.steps.push({ step: 'closed', screenshot: await shot('08-closed.png') });

    meta.checks.draftAfterUndo = await page.locator('#soap-note-subjective').inputValue();

    fs.writeFileSync(path.join(artifactRoot, 'meta.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(artifactRoot, 'console.json'), JSON.stringify(consoleLogs, null, 2));
    fs.writeFileSync(
      path.join(artifactRoot, 'notes.md'),
      [
        `RUN_ID=${runId}`,
        `baseURL=${baseURL}`,
        '',
        '手順:',
        '1) SOAP Subjective に SRC を入力し保存（履歴作成）',
        '2) Subjective を TARGET に変更（未保存）',
        '3) Past Hub -> 記載 -> Subjective の Do転記 を押下',
        '4) プレビューで適用 → Undo（1回）',
        '',
        '期待:',
        '- compact/非compactに関わらず Past Panel 操作で中央SOAPを壊さない',
        '- Do転記プレビューが転記元/転記先を明示',
        '- Undo が 1回できる',
        '',
      ].join('\n'),
    );

    await context.close();
  } finally {
    await browser.close();
  }

  // eslint-disable-next-line no-console
  console.log(`[qa] charts do-copy phase1 evidence saved: ${artifactRoot}`);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[qa] failed', error);
  process.exitCode = 1;
});
