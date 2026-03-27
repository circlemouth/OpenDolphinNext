import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Minimal UI regression for cmd_20260207_13_sub_6 (Charts UI opt B).
// - Run this script twice:
//   1) flag OFF server  (VITE_CHARTS_UI_OPT_B=0 or unset)
//   2) flag ON server   (VITE_CHARTS_UI_OPT_B=1)
//
// Usage:
//   # Assumes Vite dev server already running at QA_BASE_URL with desired flags.
//   RUN_ID=... QA_BASE_URL=http://127.0.0.1:5178 QA_LABEL=flag-off node scripts/qa-charts-ui-opt-b-regression.mjs
//
// Evidence:
//   ../artifacts/verification/<RUN_ID>/charts-ui-opt-b-regression/<QA_LABEL>/

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174';
const label = (process.env.QA_LABEL ?? process.env.QA_VARIANT ?? 'run').replace(/[^A-Za-z0-9._-]/g, '_');

const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'verification', runId, 'charts-ui-opt-b-regression', label);
const screenshotDir = path.join(artifactRoot, 'screenshots');

fs.mkdirSync(screenshotDir, { recursive: true });

const facilityPath = path.resolve(process.cwd(), '..', 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

const authUserId = process.env.QA_USER_ID ?? 'doctor1';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'doctor2025';

const patientId = process.env.QA_PATIENT_ID ?? '01415';
const visitDate = process.env.QA_VISIT_DATE ?? new Date().toISOString().slice(0, 10);

const session = {
  facilityId,
  userId: authUserId,
  displayName: `QA charts-ui-opt-b-regression (${label})`,
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
  [data-test-id="charts-send-dialog"] * { filter: blur(7px) !important; }
  [data-test-id="charts-print-dialog"] * { filter: blur(7px) !important; }
`;

const blurAllCss = `
  /* For print preview popup. */
  body * { filter: blur(7px) !important; }
`;

const createSessionContext = async (browser, viewport) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, baseURL, viewport });
  await ctx.addInitScript(
    ([authKey, authPayload, devAuth, encounterKey, encounterPayload]) => {
      window.sessionStorage.setItem(authKey, authPayload);
      window.sessionStorage.setItem('devFacilityId', devAuth.facilityId);
      window.sessionStorage.setItem('devUserId', devAuth.userId);
      window.sessionStorage.setItem('devClientUuid', devAuth.clientUuid);
      window.sessionStorage.setItem(encounterKey, encounterPayload);

      window.localStorage.setItem(authKey, authPayload);
      window.localStorage.setItem('devFacilityId', devAuth.facilityId);
      window.localStorage.setItem('devUserId', devAuth.userId);
      window.localStorage.setItem('devClientUuid', devAuth.clientUuid);
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
      `opendolphin:web-client:charts:encounter-context:v2:${facilityId}:${authUserId}`,
      JSON.stringify({ patientId, visitDate }),
    ],
  );
  return ctx;
};

const safeText = async (locator) => {
  try {
    const text = await locator.textContent();
    return text?.trim() ?? null;
  } catch {
    return null;
  }
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });

  const meta = {
    runId,
    label,
    baseURL,
    facilityId,
    patientId,
    visitDate,
    executedAt: new Date().toISOString(),
    url: null,
    results: {},
    errors: [],
    shots: [],
  };

  const shot = async (page, name) => {
    const file = path.join(screenshotDir, name);
    await page.screenshot({ path: file, fullPage: false });
    meta.shots.push(`screenshots/${name}`);
    return `screenshots/${name}`;
  };

  const step = async (key, fn) => {
    try {
      const out = await fn();
      meta.results[key] = { ok: true, ...out };
    } catch (error) {
      const msg = `${key}: ${String(error)}`;
      meta.results[key] = { ok: false, error: msg };
      meta.errors.push(msg);
    }
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
      await page.locator('.charts-page').waitFor({ timeout: 30000 });
      await page.locator('#charts-actionbar').waitFor({ timeout: 30000 });
      await page.locator('#charts-soap-note').waitFor({ timeout: 30000 });

      if (!meta.url) meta.url = page.url();

      await page.addStyleTag({ content: maskCss });
      await page.waitForTimeout(300);

      // Capture flags for this viewport.
      meta.results[`flags:${entry.key}`] = {
        ok: true,
        dataChartsUiOptB: await page.locator('.charts-page').getAttribute('data-charts-ui-opt-b'),
        dataChartsCompactUi: await page.locator('.charts-workbench').getAttribute('data-charts-compact-ui'),
        dataUtilityState: await page.locator('.charts-workbench').getAttribute('data-utility-state'),
      };

      await step(`${entry.key}:patient-select`, async () => {
        const buttons = page.locator('button.patients-tab__row');
        const count = await buttons.count();
        if (count > 0) {
          await buttons.first().click();
          await page.waitForTimeout(700);
        }
        const selected = await page.locator('button.patients-tab__row--selected').count();
        return { buttonCount: count, selectedCount: selected };
      });

      await shot(page, `${entry.key}-01-initial.png`);

      await step(`${entry.key}:topbar-toggle`, async () => {
        const toggle = page.locator('.charts-topbar__toggle');
        await toggle.click();
        await page.waitForTimeout(250);
        const collapsed = await page.locator('.charts-page').getAttribute('data-charts-topbar-collapsed');
        await shot(page, `${entry.key}-02-topbar-toggled.png`);
        // Toggle back for subsequent steps.
        await toggle.click();
        await page.waitForTimeout(200);
        return { collapsedAfterToggle: collapsed };
      });

      await step(`${entry.key}:utility-document-panel`, async () => {
        await page.keyboard.press('Control+Shift+U');
        await page.locator('#charts-docked-panel').waitFor({ timeout: 10000 });
        const documentTab = page.locator('button[data-utility-action="document"]');
        const docTabCount = await documentTab.count();
        if (docTabCount > 0) {
          await documentTab.click();
          await page.locator('[data-test-id="document-create-panel"]').first().waitFor({ timeout: 15000 });
        }
        await page.waitForTimeout(250);
        await shot(page, `${entry.key}-03-utility-document.png`);
        // Close utility panel.
        await page.keyboard.press('Control+Shift+U');
        await page.waitForTimeout(250);
        await shot(page, `${entry.key}-04-utility-closed.png`);
        return { documentTabFound: docTabCount > 0 };
      });

      await step(`${entry.key}:soap-input`, async () => {
        await page.locator('#soap-note-subjective').fill(`UI regression ${runId} ${label} ${entry.key}`);
        await page.waitForTimeout(250);
        await shot(page, `${entry.key}-05-soap-typed.png`);
        return { subjectiveFilled: true };
      });

      await step(`${entry.key}:draft-save`, async () => {
        const btn = page.locator('#charts-action-draft');
        const disabled = await btn.isDisabled().catch(() => null);
        const disabledReason = await btn.getAttribute('data-disabled-reason').catch(() => null);
        if (disabled) {
          await shot(page, `${entry.key}-06-draft-disabled.png`);
          return { draftButtonDisabled: disabled, disabledReason };
        }
        await btn.click();
        await page.waitForTimeout(700);
        const banner = await safeText(page.locator('.charts-actions__banner').first());
        await shot(page, `${entry.key}-06-draft-clicked.png`);
        return { draftButtonDisabled: disabled, disabledReason, bannerText: banner };
      });

      await step(`${entry.key}:send-dialog`, async () => {
        const btn = page.locator('#charts-action-send');
        const disabled = await btn.isDisabled().catch(() => null);
        const disabledReason = await btn.getAttribute('data-disabled-reason').catch(() => null);
        if (disabled) {
          await shot(page, `${entry.key}-07-send-disabled.png`);
          const banner = await safeText(page.locator('.charts-actions__banner').first());
          return { sendButtonDisabled: disabled, disabledReason, dialogOpened: false, bannerText: banner };
        }
        await btn.click();
        // Either open dialog or show banner (blocked).
        const dialog = page.locator('[data-test-id="charts-send-dialog"]');
        const opened = await dialog.waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
        if (opened) {
          await page.waitForTimeout(150);
          await shot(page, `${entry.key}-07-send-dialog.png`);
          await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click();
          await page.waitForTimeout(250);
        } else {
          await page.waitForTimeout(250);
          await shot(page, `${entry.key}-07-send-blocked.png`);
        }
        const banner = await safeText(page.locator('.charts-actions__banner').first());
        return { sendButtonDisabled: disabled, disabledReason, dialogOpened: opened, bannerText: banner };
      });

      await step(`${entry.key}:print-dialog`, async () => {
        const btn = page.locator('#charts-action-print');
        const disabled = await btn.isDisabled().catch(() => null);
        const disabledReason = await btn.getAttribute('data-disabled-reason').catch(() => null);
        if (disabled) {
          await shot(page, `${entry.key}-08-print-disabled.png`);
          const banner = await safeText(page.locator('.charts-actions__banner').first());
          return { printButtonDisabled: disabled, disabledReason, dialogOpened: false, bannerText: banner };
        }
        await btn.click();
        const dialog = page.locator('[data-test-id="charts-print-dialog"]');
        const opened = await dialog.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
        if (!opened) {
          await page.waitForTimeout(250);
          await shot(page, `${entry.key}-08-print-blocked.png`);
          const banner = await safeText(page.locator('.charts-actions__banner').first());
          return { printButtonDisabled: disabled, disabledReason, dialogOpened: false, bannerText: banner };
        }

        await page.waitForTimeout(200);
        await shot(page, `${entry.key}-08-print-dialog.png`);

        // Best-effort: open outpatient preview (may open popup or navigate).
        const openPromise = Promise.race([
          page.waitForEvent('popup', { timeout: 8000 }).catch(() => null),
          page.waitForURL('**/charts/print/**', { timeout: 8000 }).then(() => page).catch(() => null),
        ]);
        await dialog.getByRole('button', { name: '開く', exact: true }).click();
        const maybePopup = await openPromise;
        let preview = { opened: false, mode: null, url: null, screenshot: null };
        if (maybePopup) {
          const previewPage = maybePopup;
          preview.opened = true;
          preview.mode = previewPage === page ? 'same-page' : 'popup';
          await previewPage.waitForTimeout(600);
          await previewPage.addStyleTag({ content: blurAllCss }).catch(() => {});
          await previewPage.waitForTimeout(200);
          const fileName = `${entry.key}-09-print-preview.png`;
          const file = path.join(screenshotDir, fileName);
          await previewPage.screenshot({ path: file, fullPage: false }).catch(() => {});
          meta.shots.push(`screenshots/${fileName}`);
          preview.url = previewPage.url();
          preview.screenshot = `screenshots/${fileName}`;
          if (previewPage !== page) {
            await previewPage.close().catch(() => {});
            await page.bringToFront().catch(() => {});
          } else {
            // navigate back to keep remaining checks stable.
            await page.goBack().catch(() => {});
            await page.waitForTimeout(400);
          }
        }

        // Ensure dialog is closed (it should auto-close before opening preview).
        await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click().catch(() => {});
        await page.waitForTimeout(200);
        return { printButtonDisabled: disabled, disabledReason, dialogOpened: true, preview };
      });

      await context.close();
    }

    fs.writeFileSync(path.join(artifactRoot, 'meta.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(
      path.join(artifactRoot, 'notes.md'),
      [
        `RUN_ID=${runId}`,
        `QA_LABEL=${label}`,
        `baseURL=${baseURL}`,
        `facilityId=${facilityId}`,
        `patientId=${patientId}`,
        `visitDate=${visitDate}`,
        '',
        '目的:',
        '- Charts UI opt B の flag OFF/ON で、最小UI回帰（入力/保存/送信/印刷/文書/パネル）を実測し証跡化する。',
        '',
        '実施内容（最小）:',
        '- Charts 画面表示（msw=1）',
        '- Topbar 開閉',
        '- Utility panel: document を開く→閉じる（右パネルの開閉）',
        '- SOAP Subjective 入力',
        '- ドラフト保存（結果は banner/toast を目視）',
        '- ORCA送信ダイアログの開閉（blocked の場合は banner 証跡）',
        '- 印刷/帳票ダイアログの開閉 + outpatient preview の best-effort',
        '',
        'スクリーンショット:',
        '- screenshots/*.png（1366x768 / 1440x900）',
        '',
        meta.errors.length ? 'エラー:' : 'エラー: なし',
        ...(meta.errors.length ? meta.errors.map((e) => `- ${e}`) : []),
        '',
      ].join('\n'),
    );
  } finally {
    await browser.close();
  }

  // eslint-disable-next-line no-console
  console.log(`[qa] charts ui-opt-b regression evidence saved: ${artifactRoot}`);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[qa] failed', error);
  process.exitCode = 1;
});
