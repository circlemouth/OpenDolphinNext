import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Usage:
//   # Assumes Vite dev server already running at QA_BASE_URL with desired flags.
//   RUN_ID=... QA_BASE_URL=http://localhost:5193 QA_VARIANT=flag-on node scripts/qa-charts-compact-header-draft-save.mjs
//
// Evidence:
//   ../artifacts/verification/<RUN_ID>/charts-compact-header-draft-save/<QA_VARIANT>/

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';
const variant = process.env.QA_VARIANT ?? 'unknown';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'verification', runId, 'charts-compact-header-draft-save', variant);

fs.mkdirSync(artifactRoot, { recursive: true });

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

const maskCss = `
  /* Mask sensitive content while keeping layout visible. */
  #charts-patient-summary * { filter: blur(7px) !important; }
  #charts-patients-tab * { filter: blur(7px) !important; }
  #charts-diagnosis * { filter: blur(7px) !important; }
  #charts-soap-note * { filter: blur(7px) !important; }
  #charts-document-timeline * { filter: blur(7px) !important; }
  .charts-workbench__column--right * { filter: blur(7px) !important; }
`;

const createSessionContext = async (browser) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, baseURL, viewport: { width: 1366, height: 768 } });
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

const safeBoundingBox = async (locator) => {
  try {
    const box = await locator.boundingBox();
    if (!box) return null;
    return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
  } catch {
    return null;
  }
};

const dumpConsole = async (page) => {
  const logs = [];
  page.on('console', (msg) => logs.push({ type: msg.type(), text: msg.text() }));
  return logs;
};

const checkDraftVisibility = async (page) => {
  const button = page.locator('#charts-action-draft');
  const count = await button.count();
  const visible = count > 0 ? await button.isVisible() : false;
  const enabled = count > 0 ? await button.isEnabled().catch(() => false) : false;
  const box = count > 0 ? await safeBoundingBox(button) : null;
  const disabledAttr = count > 0 ? await button.getAttribute('disabled') : null;
  const hiddenAncestor = await page.evaluate(() => {
    const el = document.getElementById('charts-action-draft');
    if (!el) return null;
    let cur = el;
    while (cur) {
      if (cur instanceof HTMLElement && cur.hidden) return cur.id || cur.tagName;
      cur = cur.parentElement;
    }
    return null;
  });

  return { count, visible, enabled, box, disabledAttr, hiddenAncestor };
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const result = {
    runId,
    variant,
    baseURL,
    facilityId,
    url: null,
    flags: {},
    scenarios: {},
    executedAt: new Date().toISOString(),
  };

  try {
    const context = await createSessionContext(browser);
    const page = await context.newPage();
    const consoleLogs = await dumpConsole(page);

    await page.goto(`/f/${encodeURIComponent(facilityId)}/charts?msw=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('.charts-page').waitFor({ timeout: 20000 });
    await page.locator('#charts-actionbar').waitFor({ timeout: 20000 });

    result.url = page.url();
    result.flags = {
      dataChartsCompactUi: await page.locator('.charts-workbench').getAttribute('data-charts-compact-ui'),
      dataChartsCompactHeader: await page.locator('.charts-page').getAttribute('data-charts-compact-header'),
      dataChartsTopbarCollapsed: await page.locator('.charts-page').getAttribute('data-charts-topbar-collapsed'),
    };

    await page.addStyleTag({ content: maskCss });
    await page.waitForTimeout(500);

    // Scenario A: patient not selected (initial state)
    const aDir = path.join(artifactRoot, 'patient-unselected');
    fs.mkdirSync(aDir, { recursive: true });
    const unselectedDraft = await checkDraftVisibility(page);
    await page.locator('#charts-actionbar').screenshot({ path: path.join(aDir, 'actionbar.png') });
    await page.screenshot({ path: path.join(aDir, 'screen.png'), fullPage: false });
    result.scenarios.patientUnselected = {
      draft: unselectedDraft,
      notes: 'initial load without selecting a patient row',
    };

    // Scenario B: select first patient row if available
    const bDir = path.join(artifactRoot, 'patient-selected');
    fs.mkdirSync(bDir, { recursive: true });
    const rows = page.locator('.patients-tab__row');
    const rowCount = await rows.count();
    let selectedDraft = null;
    let selected = false;
    if (rowCount > 0) {
      await rows.first().click();
      // Wait for selected marker (best-effort; the list can be empty depending on MSW timing).
      await page.waitForTimeout(800);
      selected = true;
      selectedDraft = await checkDraftVisibility(page);
    } else {
      selectedDraft = await checkDraftVisibility(page);
    }
    await page.locator('#charts-actionbar').screenshot({ path: path.join(bDir, 'actionbar.png') });
    await page.screenshot({ path: path.join(bDir, 'screen.png'), fullPage: false });
    result.scenarios.patientSelected = {
      attempted: rowCount > 0,
      selected,
      rowCount,
      draft: selectedDraft,
      notes: rowCount > 0 ? 'clicked first .patients-tab__row' : 'no rows available; selection skipped',
    };

    fs.writeFileSync(path.join(artifactRoot, 'console.json'), JSON.stringify(consoleLogs, null, 2));
    fs.writeFileSync(path.join(artifactRoot, 'meta.json'), JSON.stringify(result, null, 2));
    fs.writeFileSync(
      path.join(artifactRoot, 'README.txt'),
      [
        `RUN_ID=${runId}`,
        `variant=${variant}`,
        `baseURL=${baseURL}`,
        `facilityId=${facilityId}`,
        'note=masked screenshots + meta.json are in this directory.',
        '',
      ].join('\n'),
    );

    await context.close();
  } finally {
    await browser.close();
  }

  // eslint-disable-next-line no-console
  console.log(`[qa] charts compact header draft-save evidence saved: ${artifactRoot}`);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[qa] failed', error);
  process.exitCode = 1;
});

