import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5176';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(repoRoot, 'artifacts', 'verification', runId, 'order-001-mvp');
const screenshotDir = path.join(artifactRoot, 'screenshots');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(artifactRoot, { recursive: true });

const facilityPath = path.resolve(repoRoot, 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

const authUserId = process.env.QA_USER_ID ?? 'doctor1';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'doctor2025';

// Default is an MSW fixture patientId.
const patientId = process.env.QA_PATIENT_ID ?? '01415';

const session = {
  facilityId,
  userId: authUserId,
  displayName: `QA ${authUserId}`,
  clientUuid: `qa-${runId}`,
  runId,
  role: 'admin',
  roles: ['admin'],
};

const writeLocatorShot = async (locator, name, opts = {}) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await locator.screenshot({ path: filePath, ...opts });
  return `screenshots/${fileName}`;
};

// NOTE:
// Playwright's network hooks may miss requests served by ServiceWorker (MSW).
// To keep evidence stable, we log fetch() calls for /api/local/order/bundles in-page via addInitScript.
const toNetworkMemo = (events) => {
  const lines = [];
  lines.push('# /api/local/order/bundles network memo');
  lines.push('');
  lines.push(`- RUN_ID: ${runId}`);
  lines.push(`- baseURL: ${baseURL}`);
  lines.push('');
  events.forEach((event, index) => {
    if (event.kind === 'request') {
      const post = event.postData ? String(event.postData) : '';
      const postPreview = post.length > 400 ? `${post.slice(0, 400)}...` : post;
      lines.push(`## ${index + 1}. request ${event.method} ${event.url}`);
      if (postPreview) {
        lines.push('');
        lines.push('```json');
        lines.push(postPreview);
        lines.push('```');
      }
      lines.push('');
      return;
    }
    lines.push(`## ${index + 1}. response ${event.method} ${event.status} ${event.url}`);
    lines.push('');
    if (event.body != null) {
      const bodyText = typeof event.body === 'string' ? event.body : JSON.stringify(event.body, null, 2);
      const preview = bodyText.length > 1200 ? `${bodyText.slice(0, 1200)}...` : bodyText;
      lines.push('```');
      lines.push(preview);
      lines.push('```');
    }
    lines.push('');
  });
  return lines.join('\n');
};

const run = async () => {
  const summary = {
    runId,
    executedAt: new Date().toISOString(),
    baseURL,
    facilityId,
    patientId,
    flags: {
      VITE_ORDER_EDIT_MVP: process.env.VITE_ORDER_EDIT_MVP ?? null,
    },
    mvp: {
      entitySelectorVisible: null,
      generalOrder: { saved: false, autoFilledBundleName: null },
      treatmentOrder: { saved: false, autoFilledBundleName: null },
    },
    actionBar: { sendDialogOpened: false },
    errors: [],
    evidence: {
      screenshots: [],
      networkJson: 'orca-order-bundles.network.json',
      networkMemo: 'orca-order-bundles.network.memo.md',
      summaryJson: 'summary.json',
      summaryMd: 'summary.md',
    },
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, baseURL });
  await context.addInitScript(
    ([key, value, auth]) => {
      window.sessionStorage.setItem(key, value);
      window.sessionStorage.setItem('devFacilityId', auth.facilityId);
      window.sessionStorage.setItem('devUserId', auth.userId);
      window.sessionStorage.setItem('devClientUuid', auth.clientUuid);
      window.localStorage.setItem('devFacilityId', auth.facilityId);
      window.localStorage.setItem('devUserId', auth.userId);
      window.localStorage.setItem('devClientUuid', auth.clientUuid);

      // Log /api/local/order/bundles traffic at fetch() level (works even when MSW intercepts).
      window.__QA_ORDER_BUNDLE_LOG__ = [];
      const toStringSafe = (value) => {
        try {
          if (typeof value === 'string') return value;
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      };
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input?.url;
        const method = init?.method ?? (typeof input === 'string' ? 'GET' : input?.method ?? 'GET');
        const shouldLog = typeof url === 'string' && url.includes('/api/local/order/bundles');
        const entry = shouldLog
          ? {
              kind: 'request',
              at: new Date().toISOString(),
              method,
              url,
              postData:
                typeof init?.body === 'string'
                  ? init.body
                  : init?.body != null
                    ? toStringSafe(init.body)
                    : null,
            }
          : null;
        if (entry) window.__QA_ORDER_BUNDLE_LOG__.push(entry);
        const res = await originalFetch(input, init);
        if (shouldLog) {
          try {
            const cloned = res.clone();
            const text = await cloned.text();
            window.__QA_ORDER_BUNDLE_LOG__.push({
              kind: 'response',
              at: new Date().toISOString(),
              method,
              url,
              status: res.status,
              statusText: res.statusText,
              body: text.length > 4000 ? `${text.slice(0, 4000)}...` : text,
            });
          } catch (error) {
            window.__QA_ORDER_BUNDLE_LOG__.push({
              kind: 'response',
              at: new Date().toISOString(),
              method,
              url,
              status: res.status,
              statusText: res.statusText,
              body: `<<failed to read body: ${String(error)}>>`,
            });
          }
        }
        return res;
      };
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

  const page = await context.newPage();
  const traffic = [];

  const takeShot = async (locator, name) => {
    try {
      const shotPath = await writeLocatorShot(locator, name);
      summary.evidence.screenshots.push(shotPath);
      return shotPath;
    } catch (error) {
      summary.errors.push(`screenshot_failed:${name} ${String(error)}`);
      return null;
    }
  };

  const clickSave = async (label) => {
    const panel = page.locator('#charts-docked-panel');
    const submitBtn = panel.locator('form.charts-side-panel__form button[type="submit"]').first();
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    const disabled = await submitBtn.isDisabled().catch(() => null);
    if (disabled) {
      summary.errors.push(`save_button_disabled:${label}`);
      await takeShot(panel, `error-${label}-save-disabled`);
      return false;
    }

    const respPromise = page
      .waitForResponse(
        (response) => response.url().includes('/api/local/order/bundles') && response.request().method() === 'POST',
        { timeout: 20000 },
      )
      .catch(() => null);

    await submitBtn.click({ force: true });
    const resp = await respPromise;
    return Boolean(resp && resp.ok());
  };

  try {
    const chartUrl = `/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(patientId)}&runId=${encodeURIComponent(runId)}`;
    await page.goto(chartUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.charts-page').waitFor({ timeout: 30000 });

    await takeShot(page.locator('#charts-actionbar .charts-actions__controls'), '00-action-controls');

    // Open order-edit via shortcut (more reliable than click under sticky overlays).
    await page.keyboard.press('Control+Shift+3').catch(() => {});
    await page.locator('#charts-docked-panel').waitFor({ timeout: 15000 });

    const selector = page.locator('#charts-order-edit-entity');
    summary.mvp.entitySelectorVisible = await selector.isVisible().catch(() => false);
    if (!summary.mvp.entitySelectorVisible) {
      summary.errors.push('order_edit_mvp_selector_not_visible (check VITE_ORDER_EDIT_MVP=1)');
      await takeShot(page.locator('#charts-docked-panel'), '01-order-edit-no-selector');
    } else {
      await takeShot(page.locator('#charts-docked-panel'), '01-order-edit-selector');
    }

    // (A) generalOrder: bundleName auto-fill from item name
    if (summary.mvp.entitySelectorVisible) {
      await selector.selectOption('generalOrder');
    }
    await page.locator('#generalOrder-item-name-0').waitFor({ timeout: 15000 });

    const generalItemName = `MVP一般-${runId}`;
    await page.locator('#generalOrder-item-name-0').fill(generalItemName);
    await page.locator('#generalOrder-item-quantity-0').fill('1');
    await page.locator('#generalOrder-item-unit-0').fill('回');
    await page.locator('#generalOrder-bundle-name').fill('');

    await takeShot(page.locator('#charts-docked-panel'), '02-generalOrder-before-save');

    summary.mvp.generalOrder.saved = await clickSave('generalOrder');
    await page.waitForTimeout(500);
    await takeShot(page.locator('#charts-docked-panel'), '03-generalOrder-after-save');

    summary.mvp.generalOrder.autoFilledBundleName = generalItemName;

    // (B) treatmentOrder: entity selector + bundleName auto-fill
    if (summary.mvp.entitySelectorVisible) {
      await selector.selectOption('treatmentOrder');
      await page.locator('#treatmentOrder-item-name-0').waitFor({ timeout: 15000 });

      const treatmentItemName = `MVP処置-${runId}`;
      await page.locator('#treatmentOrder-item-name-0').fill(treatmentItemName);
      await page.locator('#treatmentOrder-item-quantity-0').fill('1');
      await page.locator('#treatmentOrder-item-unit-0').fill('回');
      await page.locator('#treatmentOrder-bundle-name').fill('');

      await takeShot(page.locator('#charts-docked-panel'), '04-treatmentOrder-before-save');

      summary.mvp.treatmentOrder.saved = await clickSave('treatmentOrder');
      await page.waitForTimeout(500);
      await takeShot(page.locator('#charts-docked-panel'), '05-treatmentOrder-after-save');

      summary.mvp.treatmentOrder.autoFilledBundleName = treatmentItemName;
    }

    // Send dialog evidence (best-effort).
    const sendBtn = page.locator('#charts-action-send');
    const sendDisabled = await sendBtn.isDisabled().catch(() => true);
    if (!sendDisabled) {
      await sendBtn.click().catch(() => {});
      const dialog = page.locator('[data-test-id="charts-send-dialog"]');
      summary.actionBar.sendDialogOpened = await dialog
        .waitFor({ timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (summary.actionBar.sendDialogOpened) {
        await takeShot(dialog, '06-send-dialog');
        await dialog.getByRole('button', { name: 'キャンセル' }).click().catch(() => {});
      }
    }
  } catch (error) {
    summary.errors.push(String(error));
    try {
      const fallback = page.locator('#charts-actionbar .charts-actions__controls');
      if (await fallback.isVisible().catch(() => false)) {
        summary.evidence.screenshots.push(await writeLocatorShot(fallback, 'error-action-controls'));
      }
    } catch {}
  } finally {
    try {
      const fetchLog = await page.evaluate(() => window.__QA_ORDER_BUNDLE_LOG__ ?? []);
      if (Array.isArray(fetchLog)) {
        traffic.push(...fetchLog);
      }
    } catch (error) {
      summary.errors.push(`network_log_failed ${String(error)}`);
    }

    fs.writeFileSync(path.join(artifactRoot, summary.evidence.networkJson), JSON.stringify(traffic, null, 2));
    fs.writeFileSync(path.join(artifactRoot, summary.evidence.networkMemo), toNetworkMemo(traffic));
    fs.writeFileSync(path.join(artifactRoot, summary.evidence.summaryJson), JSON.stringify(summary, null, 2));

    const md = [
      '# ORDER-001 MVP Evidence',
      `- RUN_ID: ${summary.runId}`,
      `- baseURL: ${summary.baseURL}`,
      `- facilityId: ${summary.facilityId}`,
      `- patientId: ${summary.patientId}`,
      `- VITE_ORDER_EDIT_MVP: ${summary.flags.VITE_ORDER_EDIT_MVP ?? 'n/a'}`,
      '',
      '## MVP Items',
      `- (1) order-edit entity selector visible: ${String(summary.mvp.entitySelectorVisible)}`,
      `- (2) bundleName auto-fill (generalOrder): saved=${String(summary.mvp.generalOrder.saved)} expectedBundleName=${summary.mvp.generalOrder.autoFilledBundleName ?? 'n/a'}`,
      `- (3) entity select + auto-fill (treatmentOrder): saved=${String(summary.mvp.treatmentOrder.saved)} expectedBundleName=${summary.mvp.treatmentOrder.autoFilledBundleName ?? 'n/a'}`,
      `- (4) send dialog: opened=${String(summary.actionBar.sendDialogOpened)}`,
      '',
      '## Evidence',
      `- screenshots: ${summary.evidence.screenshots.length} files under screenshots/`,
      `- network: ${summary.evidence.networkJson}`,
      `- network memo: ${summary.evidence.networkMemo}`,
      `- summary: ${summary.evidence.summaryJson}`,
      '',
      summary.errors.length ? '## Errors\n' + summary.errors.map((e) => `- ${e}`).join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n');
    fs.writeFileSync(path.join(artifactRoot, summary.evidence.summaryMd), md);

    await context.close();
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
