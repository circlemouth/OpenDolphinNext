import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Usage:
//   RUN_ID=... QA_BASE_URL=http://localhost:5174 QA_VARIANT=off node scripts/qa-charts-compact-ui-phasea.mjs
//   RUN_ID=... QA_BASE_URL=http://localhost:5174 QA_VARIANT=on  node scripts/qa-charts-compact-ui-phasea.mjs
//
// Notes:
// - This script assumes Vite dev server is already running at QA_BASE_URL.
// - It creates masked screenshots (blurs content) for layout evidence.

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';
const variant = process.env.QA_VARIANT ?? 'unknown';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'verification', runId, 'charts-compact-ui', variant);
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
  displayName: `QA ${variant}`,
  clientUuid: `qa-${runId}-${variant}`,
  runId,
  role: process.env.QA_ROLE ?? 'doctor',
  roles: (process.env.QA_ROLES ? process.env.QA_ROLES.split(',') : ['doctor']).map((v) => v.trim()).filter(Boolean),
};

const viewports = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
];

const maskCss = `
  /* Mask sensitive content while keeping layout visible. */
  #charts-patient-summary * { filter: blur(7px) !important; }
  #charts-patients-tab * { filter: blur(7px) !important; }
  #charts-diagnosis * { filter: blur(7px) !important; }
  #charts-soap-note * { filter: blur(7px) !important; }
  #charts-document-timeline * { filter: blur(7px) !important; }
  .charts-workbench__column--right * { filter: blur(7px) !important; }
`;

const createSessionContext = async (browser, viewport) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, baseURL, viewport });
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
  const measurements = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL,
    variant,
    facilityId,
    viewports: [],
  };

  try {
    for (const viewport of viewports) {
      const context = await createSessionContext(browser, { width: viewport.width, height: viewport.height });
      const page = await context.newPage();

      await page.goto(`/f/${encodeURIComponent(facilityId)}/charts`, { waitUntil: 'domcontentloaded' });
      await page.locator('.charts-page').waitFor({ timeout: 20000 });
      await page.locator('.charts-workbench').waitFor({ timeout: 20000 });

      // Ensure flags are observable from DOM for evidence.
      const compactAttr = await page.locator('.charts-workbench').getAttribute('data-charts-compact-ui');
      const compactHeaderAttr = await page.locator('.charts-page').getAttribute('data-charts-compact-header');
      const topbarCollapsedAttr = await page.locator('.charts-page').getAttribute('data-charts-topbar-collapsed');

      // Measure visibility at initial top-of-page before scrolling.
      await page.waitForTimeout(600);
      const soapNoteBoxAtTop = await page.locator('#charts-soap-note').boundingBox();
      const soapVisibleAtTop =
        soapNoteBoxAtTop ? soapNoteBoxAtTop.y < viewport.height && soapNoteBoxAtTop.y + soapNoteBoxAtTop.height > 0 : false;

      await page.addStyleTag({ content: maskCss });
      await page.waitForTimeout(600);

      const bodyBox = await page.locator('.charts-workbench__body').boundingBox();
      const soapNoteBox = await page.locator('#charts-soap-note').boundingBox();

      // Capture computed column widths for evidence.
      const gridTemplateColumns = await page.locator('.charts-workbench__body').evaluate((el) => window.getComputedStyle(el).gridTemplateColumns);

      // Ensure the workbench columns are visible in the screenshot.
      await page.locator('.charts-workbench__body').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      const screenshotWorkbench = `workbench-${variant}-${viewport.label}.png`;
      const screenshotWorkbenchPath = path.join(screenshotDir, screenshotWorkbench);
      await page.locator('.charts-workbench__body').screenshot({ path: screenshotWorkbenchPath });

      const screenshotTop = `charts-${variant}-${viewport.label}.png`;
      const screenshotTopPath = path.join(screenshotDir, screenshotTop);
      await page.screenshot({ path: screenshotTopPath, fullPage: false });

      measurements.viewports.push({
        viewport: viewport.label,
        dataChartsCompactUi: compactAttr,
        dataChartsCompactHeader: compactHeaderAttr,
        dataChartsTopbarCollapsed: topbarCollapsedAttr,
        screenshots: {
          top: `screenshots/${screenshotTop}`,
          workbench: `screenshots/${screenshotWorkbench}`,
        },
        gridTemplateColumns,
        soapVisibleAtTop,
        soapNoteAtTop: soapNoteBoxAtTop
          ? { top: Math.round(soapNoteBoxAtTop.y), bottom: Math.round(soapNoteBoxAtTop.y + soapNoteBoxAtTop.height) }
          : null,
        soapNote: soapNoteBox
          ? { width: Math.round(soapNoteBox.width), height: Math.round(soapNoteBox.height) }
          : null,
        workbenchBody: bodyBox ? { width: Math.round(bodyBox.width), height: Math.round(bodyBox.height) } : null,
        url: page.url(),
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(artifactRoot, 'measurements.json'), JSON.stringify(measurements, null, 2));
  fs.writeFileSync(
    path.join(artifactRoot, 'README.txt'),
    [
      `RUN_ID=${runId}`,
      `variant=${variant}`,
      `baseURL=${baseURL}`,
      `facilityId=${facilityId}`,
      `note=masked screenshots + measurements are in this directory.`,
      '',
    ].join('\n'),
  );

  // eslint-disable-next-line no-console
  console.log(`[qa] charts compact ui evidence saved: ${artifactRoot}`);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[qa] failed', error);
  process.exitCode = 1;
});
