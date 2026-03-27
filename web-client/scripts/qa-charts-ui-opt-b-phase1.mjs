import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Evidence capture for cmd_20260207_13_sub_5 (Charts UI opt B Phase1).
//
// Usage:
//   # Assumes Vite dev server already running at QA_BASE_URL with desired flags.
//   RUN_ID=... QA_BASE_URL=http://127.0.0.1:5174 QA_LABEL=flag-off node scripts/qa-charts-ui-opt-b-phase1.mjs
//
// Evidence:
//   ../artifacts/verification/<RUN_ID>/charts-ui-opt-b-phase1/<QA_LABEL>/

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174';
const label = (process.env.QA_LABEL ?? 'run').replace(/[^A-Za-z0-9._-]/g, '_');

const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'verification', runId, 'charts-ui-opt-b-phase1', label);
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
  displayName: `QA charts-ui-opt-b (${label})`,
  clientUuid: `qa-${runId}-${label}`,
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
  const meta = {
    runId,
    label,
    baseURL,
    facilityId,
    executedAt: new Date().toISOString(),
    url: null,
    shots: [],
    flags: {},
  };

  try {
    const viewports = [
      { key: '1366x768', viewport: { width: 1366, height: 768 } },
      { key: '1440x900', viewport: { width: 1440, height: 900 } },
    ];

    for (const entry of viewports) {
      const context = await createSessionContext(browser, entry.viewport);
      const page = await context.newPage();

      await page.goto(`/f/${encodeURIComponent(facilityId)}/charts?msw=1`, { waitUntil: 'domcontentloaded' });
      await page.locator('.charts-page').waitFor({ timeout: 25000 });
      await page.locator('#charts-soap-note').waitFor({ timeout: 25000 });
      await page.locator('.charts-workbench').waitFor({ timeout: 25000 });

      if (!meta.url) meta.url = page.url();
      meta.flags[entry.key] = {
        dataChartsUiOptB: await page.locator('.charts-page').getAttribute('data-charts-ui-opt-b'),
        dataChartsCompactUi: await page.locator('.charts-workbench').getAttribute('data-charts-compact-ui'),
        dataUtilityState: await page.locator('.charts-workbench').getAttribute('data-utility-state'),
      };

      await page.addStyleTag({ content: maskCss });
      await page.waitForTimeout(400);

      const file = path.join(screenshotDir, `${entry.key}.png`);
      await page.screenshot({ path: file, fullPage: false });
      meta.shots.push({ viewport: entry.key, file: `screenshots/${entry.key}.png` });

      await context.close();
    }

    fs.writeFileSync(path.join(artifactRoot, 'meta.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(
      path.join(artifactRoot, 'notes.md'),
      [
        `RUN_ID=${runId}`,
        `QA_LABEL=${label}`,
        `baseURL=${baseURL}`,
        '',
        '目的:',
        '- Charts UI opt B Phase1 の見た目差分（OFF/ON）を証跡化（UIのみ、機能変更なし）。',
        '',
        'スクリーンショット:',
        '- screenshots/1366x768.png',
        '- screenshots/1440x900.png',
        '',
        '確認観点（UIのみ）:',
        '- 3カラム維持のまま中央（SOAP）が広めに見える',
        '- 余白/ギャップ/罫線/影が軽量化されている',
        '- SOAPカードが薄いティント/アクセント枠で主役化されている',
        '- utility compact 時はショートカット一覧が表示されない',
        '',
      ].join('\n'),
    );
  } finally {
    await browser.close();
  }

  // eslint-disable-next-line no-console
  console.log(`[qa] charts ui-opt-b phase1 evidence saved: ${artifactRoot}`);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[qa] failed', error);
  process.exitCode = 1;
});

