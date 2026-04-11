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
  path.resolve(repoRoot, 'artifacts', 'verification', runId, 'order-001-parity');
const screenshotDir = path.join(artifactRoot, 'screenshots');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(artifactRoot, { recursive: true });

const facilityPath = path.resolve(repoRoot, 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

const authUserId = process.env.QA_USER_ID ?? 'doctor1';
const authPasswordPlain = process.env.QA_PASSWORD_PLAIN ?? 'doctor2025';

// Default is an MSW fixture patient (see src/mocks/fixtures/outpatient.ts).
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

const jsonOrText = async (response) => {
  try {
    return await response.json();
  } catch {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
};

// NOTE:
// Playwright's network hooks may miss requests served by ServiceWorker (MSW).
// To keep evidence stable, we log fetch() calls for /api/local/order/bundles in-page via addInitScript.

const escapeForMd = (value) => String(value ?? '').replaceAll('`', '\\`');

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
      const bodyText =
        typeof event.body === 'string' ? event.body : JSON.stringify(event.body, null, 2);
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
    medOrder: {
      bundleName: `ORDER-001 処方 ${runId}`,
      saved: false,
      uiListed: false,
      recordsReturned: null,
    },
    generalOrder: {
      bundleName: `ORDER-001 オーダー ${runId}`,
      saved: false,
      uiListed: false,
      recordsReturned: null,
    },
    actionBar: {
      sendDisabled: null,
      sendDisabledReason: null,
      finishDisabled: null,
      finishDisabledReason: null,
      sendDialogOpened: false,
    },
    errors: [],
    evidence: {
      // PII回避のため「画面全体」は撮らない。サイドパネル/アクション操作/ガード表示のみ。
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
      window.sessionStorage.setItem(
        `opendolphin:web-client:charts:encounter-context:v2:${auth.facilityId}:${auth.userId}`,
        JSON.stringify({ patientId: auth.patientId }),
      );
      window.localStorage.setItem('devFacilityId', auth.facilityId);
      window.localStorage.setItem('devUserId', auth.userId);
      window.localStorage.setItem('devClientUuid', auth.clientUuid);

      // Log /api/local/order/bundles traffic at fetch() level (works even when MSW intercepts).
      // eslint-disable-next-line no-underscore-dangle
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
        const method =
          init?.method ??
          (typeof input === 'string'
            ? 'GET'
            : input?.method ?? 'GET');
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
        patientId,
      },
    ],
  );

  const page = await context.newPage();
  const traffic = [];

  try {
    const chartUrl = `/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(patientId)}`;
    const receptionUrl = `/f/${encodeURIComponent(facilityId)}/reception`;
    await page.goto(receptionUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.reception-page').waitFor({ timeout: 30000 });

    // Best-effort: if MSW scenario controller exists, prefer server-handoff for /orca/* passthrough.
    await page
      .waitForFunction(() => window.__OUTPATIENT_SCENARIO__?.select, { timeout: 3000 })
      .then(async () => {
        await page.evaluate(() => {
          window.__OUTPATIENT_SCENARIO__.select('server-handoff');
        });
      })
      .catch(() => {});

    // Ensure there is a selected patient/visit by navigating Reception -> Charts.
    // If the patient is missing in the list, this run will fail with a clear error (evidence still saved).
    // Prefer Reception -> Charts navigation (mirrors daily flow). If the row is missing, fall back to direct Charts URL.
    const openCharts = async () => {
      await page.locator('#reception-search-keyword').fill(patientId);
      await page.locator('form.reception-search__form button[type="submit"]').first().click();
      const targetRow = page.locator('tr.reception-table__row', { hasText: patientId }).first();
      await targetRow.waitFor({ state: 'visible', timeout: 8000 });
      await targetRow.dblclick();
      await page.waitForURL('**/charts**', { timeout: 20000 });
    };

    await openCharts()
      .catch(async () => {
        summary.errors.push(`reception_row_missing_or_open_failed: patientId=${patientId}`);
        await page.goto(chartUrl, { waitUntil: 'domcontentloaded' });
      });

    await page.locator('.charts-page').waitFor({ timeout: 30000 });

    // Utility tabs for editor entry.
    const prescriptionTab = page.locator('[data-utility-action="prescription-edit"]');
    const orderTab = page.locator('[data-utility-action="order-edit"]');
    await prescriptionTab.waitFor({ state: 'visible', timeout: 30000 });
    await orderTab.waitFor({ state: 'visible', timeout: 30000 });

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

    const readNoticeText = async () => {
      const notice = page.locator('.charts-side-panel__notice');
      const isVisible = await notice.isVisible().catch(() => false);
      if (!isVisible) return null;
      const text = await notice.innerText().catch(() => null);
      return text ? text.trim() : null;
    };

    const assertInputValue = async (selector, expectedNonEmpty = true) => {
      const value = await page.locator(selector).inputValue().catch(() => null);
      const ok = expectedNonEmpty ? Boolean(value && value.trim()) : value != null;
      if (!ok) summary.errors.push(`input_value_unexpected selector=${selector} value=${escapeForMd(value)}`);
      return value;
    };

    const clickSaveAndCapture = async (label) => {
      const panel = page.locator('#charts-docked-panel');
      const submitBtn = panel.locator('form.charts-side-panel__form button[type="submit"]').first();
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
      const disabled = await submitBtn.isDisabled().catch(() => null);
      if (disabled) {
        summary.errors.push(`save_button_disabled:${label}`);
        const noticeText = await readNoticeText();
        if (noticeText) summary.errors.push(`notice:${label} ${escapeForMd(noticeText)}`);
        await takeShot(panel, `error-${label}-save-disabled`);
        return { resp: null, ok: false };
      }

      const respPromise = page
        .waitForResponse(
          (response) =>
            response.url().includes('/api/local/order/bundles') && response.request().method() === 'POST',
          { timeout: 20000 },
        )
        .catch(() => null);

      await submitBtn.click({ force: true });

      const resp = await respPromise;
      const ok = Boolean(resp && resp.ok());
      if (!ok) {
        const noticeText = await readNoticeText();
        if (noticeText) summary.errors.push(`notice:${label} ${escapeForMd(noticeText)}`);
      }
      return { resp, ok };
    };

    // Action entry evidence (no patient pill).
    await takeShot(page.locator('#charts-actionbar .charts-actions__controls'), '00-action-controls');
    await takeShot(page.locator('.charts-docked-panel__tabs'), '00-utility-tabs');

    // Capture disabled state (if any) for triage.
    const prescriptionTabDisabled = await prescriptionTab.isDisabled().catch(() => null);
    const orderTabDisabled = await orderTab.isDisabled().catch(() => null);
    if (prescriptionTabDisabled) {
      summary.errors.push(
        `prescription_tab_disabled title=${(await prescriptionTab.getAttribute('title').catch(() => null)) ?? 'n/a'}`,
      );
    }
    if (orderTabDisabled) {
      summary.errors.push(
        `order_tab_disabled title=${(await orderTab.getAttribute('title').catch(() => null)) ?? 'n/a'}`,
      );
    }

    const openMedOrderPanel = async () => {
      await prescriptionTab.click({ force: true });
      await page.locator('#medOrder-bundle-name').waitFor({ timeout: 30000 });
      await page.waitForTimeout(50);
    };

    const openGeneralOrderPanel = async () => {
      // Click may be blocked by sticky overlays; prefer keyboard shortcut, then click fallback.
      await page.keyboard.press('Control+Shift+3').catch(() => {});
      const openedByShortcut = await page
        .locator('#generalOrder-bundle-name')
        .waitFor({ timeout: 2500 })
        .then(() => true)
        .catch(() => false);
      if (openedByShortcut) {
        await page.waitForTimeout(50);
        return;
      }

      await orderTab.click({ force: true });
      await page.locator('#generalOrder-bundle-name').waitFor({ timeout: 8000 });
      await page.waitForTimeout(50);
    };

    // 1) medOrder create/save (hand input minimal; master search parity is covered by separate docs/tests)
    await openMedOrderPanel();

    await page.locator('#medOrder-bundle-name').fill(summary.medOrder.bundleName);
    await page.locator('#medOrder-admin').fill('1日1回');
    await page.locator('#medOrder-item-name-0').fill('アムロジピン');
    await page.locator('#medOrder-item-quantity-0').fill('1');
    await page.locator('#medOrder-item-unit-0').fill('錠');
    await page.waitForTimeout(50);
    await assertInputValue('#medOrder-bundle-name');
    await assertInputValue('#medOrder-admin');
    await assertInputValue('#medOrder-item-name-0');
    await assertInputValue('#medOrder-item-quantity-0');
    await assertInputValue('#medOrder-item-unit-0');

    await takeShot(page.locator('#charts-docked-panel'), '01-medOrder-filled');
    const medSave = await clickSaveAndCapture('medOrder');
    summary.medOrder.saved = medSave.ok;

    await page.waitForTimeout(800);
    await takeShot(page.locator('#charts-docked-panel'), '02-medOrder-after-save');

    const medList = page.locator('.charts-side-panel__items');
    summary.medOrder.uiListed = await medList
      .getByText(summary.medOrder.bundleName)
      .first()
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    const medBundlesResp = await page.request.get(
      `/api/local/order/bundles?patientId=${encodeURIComponent(patientId)}&entity=medOrder`,
    );
    if (medBundlesResp.ok()) {
      const payload = await medBundlesResp.json().catch(() => null);
      if (payload && typeof payload.recordsReturned === 'number') {
        summary.medOrder.recordsReturned = payload.recordsReturned;
      }
    }

    // 2) generalOrder create/save
    // In some layouts, the order-edit panel may fail to mount. In that case, capture evidence and continue.
    await openGeneralOrderPanel().catch(async () => {
      summary.errors.push('generalOrder_panel_open_failed');
      await takeShot(page.locator('.charts-docked-panel__tabs'), 'error-generalOrder-open-tabs');
      await takeShot(page.locator('#charts-docked-panel'), 'error-generalOrder-open-drawer');
    });

    // If the panel is still not open, skip the rest of generalOrder steps but keep actionbar evidence.
    const hasGeneralOrderPanel = await page.locator('#generalOrder-bundle-name').isVisible().catch(() => false);
    if (!hasGeneralOrderPanel) {
      summary.errors.push('generalOrder_panel_not_visible_after_open');
      summary.generalOrder.saved = false;
      summary.generalOrder.uiListed = false;
      summary.generalOrder.recordsReturned = null;
    }

    if (hasGeneralOrderPanel) {
      await page.locator('#generalOrder-bundle-name').fill(summary.generalOrder.bundleName);
      await page.locator('#generalOrder-item-name-0').fill('処置A');
      await page.locator('#generalOrder-item-quantity-0').fill('1');
      await page.locator('#generalOrder-item-unit-0').fill('回');
      await page.waitForTimeout(50);
      await assertInputValue('#generalOrder-bundle-name');
      await assertInputValue('#generalOrder-item-name-0');
      await assertInputValue('#generalOrder-item-quantity-0');
      await assertInputValue('#generalOrder-item-unit-0');

      await takeShot(page.locator('#charts-docked-panel'), '03-generalOrder-filled');
      const generalSave = await clickSaveAndCapture('generalOrder');
      summary.generalOrder.saved = generalSave.ok;

      await page.waitForTimeout(800);
      await takeShot(page.locator('#charts-docked-panel'), '04-generalOrder-after-save');

      const generalList = page.locator('.charts-side-panel__items');
      summary.generalOrder.uiListed = await generalList
        .getByText(summary.generalOrder.bundleName)
        .first()
        .waitFor({ timeout: 8000 })
        .then(() => true)
        .catch(() => false);

      const generalBundlesResp = await page.request.get(
        `/api/local/order/bundles?patientId=${encodeURIComponent(patientId)}&entity=generalOrder`,
      );
      if (generalBundlesResp.ok()) {
        const payload = await generalBundlesResp.json().catch(() => null);
        if (payload && typeof payload.recordsReturned === 'number') {
          summary.generalOrder.recordsReturned = payload.recordsReturned;
        }
      }
    }

    // 3) send/finish entry: it is OK if blocked; we must show reasons.
    const actionBar = page.locator('#charts-actionbar');
    await actionBar.waitFor({ timeout: 20000 });

    const sendBtn = page.locator('#charts-action-send');
    const finishBtn = page.locator('#charts-action-finish');

    const sendDisabled = await sendBtn.isDisabled().catch(() => null);
    const finishDisabled = await finishBtn.isDisabled().catch(() => null);
    summary.actionBar.sendDisabled = sendDisabled;
    summary.actionBar.finishDisabled = finishDisabled;
    summary.actionBar.sendDisabledReason =
      (await sendBtn.getAttribute('data-disabled-reason').catch(() => null)) ?? null;
    summary.actionBar.finishDisabledReason =
      (await finishBtn.getAttribute('data-disabled-reason').catch(() => null)) ?? null;

    if (sendDisabled === false) {
      await sendBtn.click();
      const dialog = page.locator('[data-test-id="charts-send-dialog"]');
      summary.actionBar.sendDialogOpened = await dialog
        .waitFor({ timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (summary.actionBar.sendDialogOpened) {
        await takeShot(dialog, '05-send-dialog');
        await dialog.getByRole('button', { name: 'キャンセル' }).click().catch(() => {});
      }
    } else {
      const guard = actionBar.locator('.charts-actions__guard-summary');
      const guardVisible = await guard.isVisible().catch(() => false);
      if (guardVisible) {
        await takeShot(guard, '05-send-guard-summary');
      } else {
        await takeShot(actionBar.locator('.charts-actions__controls'), '05-action-controls-after');
      }
    }

    if (finishDisabled === false) {
      await finishBtn.click().catch(() => {});
      const finishDialog = page.locator('[data-test-id="charts-finish-dialog"]');
      const opened = await finishDialog
        .waitFor({ timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      if (opened) {
        await takeShot(finishDialog, '06-finish-dialog');
        await finishDialog.getByRole('button', { name: /キャンセル|閉じる/ }).first().click().catch(() => {});
      } else {
        await takeShot(actionBar.locator('.charts-actions__controls'), '06-finish-no-dialog');
      }
    }
  } catch (error) {
    summary.errors.push(String(error));
    // Avoid full-page screenshots (PII). Capture only the action controls if possible.
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
      '# ORDER-001 Parity Evidence (Order Edit Minimal Ops)',
      `- RUN_ID: ${summary.runId}`,
      `- baseURL: ${summary.baseURL}`,
      `- facilityId: ${summary.facilityId}`,
      `- patientId: ${summary.patientId}`,
      '',
      '## Minimal Operation Set',
      `- (1) Charts open: OK (charts-page)`,
      `- (2) medOrder add/save: saved=${summary.medOrder.saved} uiListed=${summary.medOrder.uiListed} recordsReturned=${summary.medOrder.recordsReturned ?? 'n/a'}`,
      `- (3) generalOrder add/save: saved=${summary.generalOrder.saved} uiListed=${summary.generalOrder.uiListed} recordsReturned=${summary.generalOrder.recordsReturned ?? 'n/a'}`,
      `- (4) Persistence: GET /api/local/order/bundles recordsReturned captured above (if n/a, rely on UI list evidence)`,
      `- (5) Send/finish: sendDisabled=${String(summary.actionBar.sendDisabled)} reason=${summary.actionBar.sendDisabledReason ?? 'n/a'} finishDisabled=${String(summary.actionBar.finishDisabled)} reason=${summary.actionBar.finishDisabledReason ?? 'n/a'}`,
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
