import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Manual regression helper for cmd_20260206_21_sub_10.
//
// Usage:
//   # Assumes Vite dev server already running at QA_BASE_URL with:
//   #   VITE_CHARTS_PAST_PANEL=1 and (optionally) VITE_CHARTS_DO_COPY=1
//   RUN_ID=... QA_BASE_URL=http://127.0.0.1:5195 QA_LABEL=flag-off node scripts/qa-charts-do-copy-manual-regression.mjs
//
// Evidence:
//   ../artifacts/verification/<RUN_ID>/charts-do-copy-manual-regression/<QA_LABEL>/

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174';
const label = (process.env.QA_LABEL ?? 'run').replace(/[^A-Za-z0-9._-]/g, '_');

const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'verification', runId, 'charts-do-copy-manual-regression', label);
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
  displayName: `QA do-copy regression (${label})`,
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
  .charts-do-copy textarea { filter: blur(7px) !important; }
  [data-test-id="charts-print-dialog"] * { filter: blur(7px) !important; }
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
    viewport: null,
    flags: {},
    steps: [],
    checks: {},
  };

  try {
    const viewport = { width: 1440, height: 900 };
    meta.viewport = viewport;
    const context = await createSessionContext(browser, viewport);
    const page = await context.newPage();
    const consoleLogs = [];
    page.on('console', (msg) => consoleLogs.push({ type: msg.type(), text: msg.text() }));

    await page.goto(`/f/${encodeURIComponent(facilityId)}/charts?msw=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('.charts-page').waitFor({ timeout: 25000 });
    await page.locator('#charts-soap-note').waitFor({ timeout: 25000 });
    await page.locator('#charts-actionbar').waitFor({ timeout: 25000 });
    await page.locator('#charts-patients-tab').waitFor({ timeout: 25000 });
    // Past panel is optional based on VITE_CHARTS_PAST_PANEL.
    await page.locator('#charts-document-timeline').waitFor({ timeout: 25000 });
    // Utility drawer tabs can render slightly after the main layout.
    await page.locator('#charts-docked-tab-document').waitFor({ timeout: 25000 });

    meta.url = page.url();
    meta.flags = {
      dataChartsCompactUi: await page.locator('.charts-workbench').getAttribute('data-charts-compact-ui'),
      dataChartsCompactHeader: await page.locator('.charts-page').getAttribute('data-charts-compact-header'),
      hasPastPanel: (await page.locator('#charts-past-hub').count()) > 0,
      hasDoCopyButton: (await page.locator('button:has-text("Do転記")').count()) > 0,
    };

    await page.addStyleTag({ content: maskCss });
    await page.waitForTimeout(400);

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

    // 1) Input + draft save (smoke).
    await page.locator('#soap-note-subjective').fill(`REG(${label}): ${runId}`);
    await page.locator('#charts-action-draft').click();
    await page.waitForTimeout(600);
    meta.steps.push({ step: 'draft-saved', screenshot: await shot('02-draft-saved.png') });

    // 2) Print dialog opens or guard is visible.
    const printButton = page.locator('#charts-action-print');
    const printDisabled = (await printButton.getAttribute('disabled')) !== null;
    if (!printDisabled) {
      await printButton.click();
      await page.locator('[data-test-id="charts-print-dialog"]').waitFor({ timeout: 8000 });
      meta.steps.push({ step: 'print-dialog-open', screenshot: await shot('03-print-dialog-open.png') });
      await page.locator('[data-test-id="charts-print-dialog"]').getByRole('button', { name: 'キャンセル', exact: true }).click();
      await page.waitForTimeout(300);
    } else {
      meta.steps.push({ step: 'print-guard-disabled', screenshot: await shot('03-print-guard-disabled.png', page.locator('#charts-actionbar')) });
    }

    // 3) Document panel (utility drawer) opens.
    // The tab id is stable and avoids brittle role/name matching (label can include shortcut text).
    const docTab = page.locator('#charts-docked-tab-document');
    const docTabExists = (await docTab.count()) > 0;
    const docTabDisabled = docTabExists ? (await docTab.getAttribute('disabled')) !== null : false;
    if (docTabExists && !docTabDisabled) {
      await docTab.click();
      await page.waitForTimeout(700);
      meta.steps.push({ step: 'document-panel-open', screenshot: await shot('04-document-panel-open.png') });
    } else if (docTabExists && docTabDisabled) {
      meta.steps.push({
        step: 'document-tab-disabled',
        screenshot: await shot('04-document-tab-disabled.png', page.locator('.charts-docked-panel__tabs')),
      });
    } else {
      meta.steps.push({ step: 'document-tab-not-found', screenshot: await shot('04-document-tab-not-found.png') });
    }

    // 4) Left/right panels presence (layout smoke).
    meta.checks.panels = {
      hasPatientsTab: (await page.locator('#charts-patients-tab').count()) > 0,
      hasSoapNote: (await page.locator('#charts-soap-note').count()) > 0,
      hasOrcaSummary: (await page.locator('#charts-orca-summary').count()) > 0,
      hasPastHub: (await page.locator('#charts-past-hub').count()) > 0,
    };
    meta.steps.push({ step: 'panels', screenshot: await shot('05-panels.png') });

    fs.writeFileSync(path.join(artifactRoot, 'meta.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(artifactRoot, 'console.json'), JSON.stringify(consoleLogs, null, 2));
    fs.writeFileSync(
      path.join(artifactRoot, 'notes.md'),
      [
        `RUN_ID=${runId}`,
        `QA_LABEL=${label}`,
        `baseURL=${baseURL}`,
        '',
        '手動回帰（最小）:',
        '- 入力: SOAP Subjective を入力',
        '- ドラフト保存: ActionBar の「ドラフト保存」を実行（toast/状態変化の有無を確認）',
        '- 印刷: 「印刷/エクスポート」を開く（disabled の場合は guard 表示を確認）',
        '- 文書モーダル: ユーティリティドロワーの「文書」タブを開き、文書作成パネルが落ちないことを確認',
        '- 左右パネル: PatientsTab / SOAP / Timeline / ORCA Summary / PastHub の存在を確認',
        '',
        '証跡:',
        '- screenshots/01..05',
        '- meta.json（flags/panelsチェック）',
        '- console.json（consoleログ）',
        '',
      ].join('\n'),
    );

    await context.close();
  } finally {
    await browser.close();
  }

  // eslint-disable-next-line no-console
  console.log(`[qa] charts do-copy manual regression evidence saved: ${artifactRoot}`);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[qa] failed', error);
  process.exitCode = 1;
});
