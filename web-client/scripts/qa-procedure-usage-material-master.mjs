import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const now = new Date();
const runId = process.env.RUN_ID ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
// RUN_ID is used for artifact folder naming and may include cmd/task metadata (longer than UI/API accepts).
// Use a normalized short run id for app/session + x-run-id to:
// - keep DB audit columns (varchar(64)) safe
// - keep Charts URL `runId` meta recognized (expects `YYYYMMDDTHHMMSSZ`)
const appRunId =
  runId.match(/\d{8}T\d{6}Z/)?.[0] ?? now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
const runIdHeader = appRunId;
const traceId = process.env.TRACE_ID ?? `trace-${appRunId}`;
const baseURL = process.env.QA_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';
const artifactRoot =
  process.env.QA_ARTIFACT_DIR ??
  path.resolve(process.cwd(), '..', 'artifacts', 'webclient', 'e2e', runId, 'material-master');
const screenshotDir = path.join(artifactRoot, 'screenshots');
const networkDir = path.join(artifactRoot, 'network');
const stepLogPath = path.join(artifactRoot, 'steps.log');

fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(networkDir, { recursive: true });
fs.mkdirSync(artifactRoot, { recursive: true });

const facilityPath = path.resolve(process.cwd(), '..', 'facility.json');
const facilityJson = JSON.parse(fs.readFileSync(facilityPath, 'utf-8'));
const facilityId = String(facilityJson.facilityId ?? '0001');

const authUserId = 'doctor1';
const authPasswordPlain = 'doctor2025';

const envOrDefault = (value, fallback) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const patientId = envOrDefault(process.env.QA_PATIENT_ID, '01415');
const materialKeyword = envOrDefault(process.env.QA_MATERIAL_KEYWORD, 'ガーゼ');
// Charts のユーティリティドロワー（order-edit）は現状 `generalOrder` 編集を提供する。
// 旧スクリプト互換で env は残しつつ、未指定時は generalOrder を既定にする。
const preferredOrderEntity = process.env.QA_ORDER_ENTITY ?? 'generalOrder';
const dataSourceTransition = process.env.QA_DATASOURCE_TRANSITION ?? 'server';
const saveOrder = process.env.QA_SAVE_ORDER === '1';
const orderBundleName =
  process.env.QA_ORDER_BUNDLE_NAME ?? `QA material bundle ${runId}${materialKeyword ? ` (${materialKeyword})` : ''}`;
const orderItemName = process.env.QA_ORDER_ITEM_NAME ?? 'QA item';
const orderQuantity = process.env.QA_ORDER_QUANTITY ?? '1';
const materialQuantity = process.env.QA_MATERIAL_QUANTITY ?? '1';
const materialUnit = process.env.QA_MATERIAL_UNIT ?? '';
const forceMaterialTransition = process.env.QA_FORCE_MATERIAL_TRANSITION ?? '';
const beforeMaterialTransition = process.env.QA_BEFORE_MATERIAL_TRANSITION ?? '';
const outpatientScenarioId = process.env.QA_OUTPATIENT_SCENARIO_ID ?? 'server-handoff';
const outpatientOverrideMissingMasterRaw = process.env.QA_OUTPATIENT_OVERRIDE_MISSING_MASTER ?? '';
const scenarioReload = process.env.QA_SCENARIO_RELOAD === '1';
const openFromReception = process.env.QA_OPEN_FROM_RECEPTION !== '0';
const verifyServiceWorker = process.env.QA_VERIFY_SERVICE_WORKER === '1';
const allowServiceWorker = process.env.QA_ALLOW_SERVICE_WORKER === '1' || verifyServiceWorker;

const logStep = (label) => {
  fs.appendFileSync(stepLogPath, `[${new Date().toISOString()}] ${label}\n`);
};

logStep(
  `config runId=${runId} appRunId=${appRunId} runIdHeader=${runIdHeader} patientId=${patientId} keyword=${materialKeyword} openFromReception=${String(openFromReception)} saveOrder=${String(saveOrder)}`,
);

const selectOptionFallback = async (selectLocator, desiredValue) => {
  const options = await selectLocator.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => node.value ?? ''),
  );
  const resolved = options.includes(desiredValue)
    ? desiredValue
    : options.find((value) => value && value !== '') ?? '';
  if (resolved) {
    await selectLocator.selectOption(resolved);
  }
  return { desired: desiredValue, resolved, options };
};

const redactHeaders = (headers) => {
  const out = { ...(headers ?? {}) };
  for (const key of Object.keys(out)) {
    if (
      /^authorization$/i.test(key) ||
      /^cookie$/i.test(key) ||
      /^set-cookie$/i.test(key) ||
      /^username$/i.test(key) ||
      /^password$/i.test(key)
    ) {
      out[key] = '<<redacted>>';
    }
  }
  return out;
};

const isTarget = (url) =>
  url.includes('/api/orca/master/material') ||
  url.includes('/api/orca/master/material') ||
  url.includes('/api/local/order/bundles') ||
  url.includes('/api/local/order/bundles');

const shouldRewriteRunIdHeader = (urlString) => {
  try {
    const url = new URL(urlString);
    const base = new URL(baseURL);
    if (url.origin !== base.origin) return false;
    return (
      url.pathname.startsWith('/orca/') ||
      url.pathname.startsWith('/api/') ||
      url.pathname === '/chart-events'
    );
  } catch {
    return false;
  }
};

const writeScreenshot = async (page, name) => {
  const fileName = `${name}.png`;
  const filePath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return `screenshots/${fileName}`;
};

const createSessionContext = async (browser) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    baseURL,
    // Default to blocking Service Workers so MSW won't intercept requests during "real API" verification.
    // Opt-in via QA_ALLOW_SERVICE_WORKER=1 (or QA_VERIFY_SERVICE_WORKER=1).
    serviceWorkers: allowServiceWorker ? 'allow' : 'block',
  });
  await ctx.addInitScript(
    ([key, value, auth]) => {
      window.sessionStorage.setItem(key, value);
      window.sessionStorage.setItem('devFacilityId', auth.facilityId);
      window.sessionStorage.setItem('devUserId', auth.userId);
      window.sessionStorage.setItem('devClientUuid', auth.clientUuid);
      if (auth.seedChartsContext) {
        window.sessionStorage.setItem(
          `opendolphin:web-client:charts:encounter-context:v2:${auth.facilityId}:${auth.userId}`,
          JSON.stringify({ patientId: auth.patientId }),
        );
      }
      window.localStorage.setItem('devFacilityId', auth.facilityId);
      window.localStorage.setItem('devUserId', auth.userId);
      window.localStorage.setItem('devClientUuid', auth.clientUuid);

      // Seed auth-service flags so initial requests use the server route (avoid being stuck on snapshot/missingMaster=true).
      const sessionKey = `${auth.facilityId}:${auth.userId}`;
      const authFlags = {
        sessionKey,
        flags: {
          runId: auth.runId,
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
        updatedAt: new Date().toISOString(),
      };
      window.sessionStorage.setItem('opendolphin:web-client:auth-flags', JSON.stringify(authFlags));

      // Seed Charts encounter context so the URL rewrite won't drop patientId before Reception entries arrive.
      if (auth.patientId) {
        try {
          window.sessionStorage.setItem(
            `opendolphin:web-client:charts:encounter-context:v2:${auth.facilityId}:${auth.userId}`,
            JSON.stringify({ patientId: auth.patientId }),
          );
        } catch {
          // ignore
        }
      }

      // Ensure Charts uses the live server route (avoids being stuck in snapshot due to a stale admin:broadcast).
      // This only affects the local browser profile used by this QA run.
      const broadcast = {
        runId: auth.runId,
        facilityId: auth.facilityId,
        userId: auth.userId,
        action: 'config',
        chartsMasterSource: 'server',
        chartsDisplayEnabled: true,
        chartsSendEnabled: true,
        source: 'qa',
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem('admin:broadcast', JSON.stringify(broadcast));
      try {
        window.dispatchEvent(new CustomEvent('admin:broadcast', { detail: broadcast }));
      } catch {
        // ignore
      }
    },
    [
      'opendolphin:web-client:auth',
      JSON.stringify({
        facilityId,
        userId: authUserId,
        displayName: `QA material master ${runId}`,
        clientUuid: `qa-${runId}`,
        runId: appRunId,
        role: 'admin',
        roles: ['admin'],
      }),
      {
        facilityId,
        userId: authUserId,
        passwordPlain: authPasswordPlain,
        clientUuid: `qa-${runId}`,
        patientId,
        seedChartsContext: true,
        runId: appRunId,
        runIdHeader,
      },
    ],
  );
  return ctx;
};

const setObservabilityMeta = async (page) => {
  await page.evaluate(
    async ({ nextRunId, nextTraceId, nextTransition }) => {
      const mod = await import('/src/libs/observability/observability');
      mod.updateObservabilityMeta({
        runId: nextRunId,
        traceId: nextTraceId,
        cacheHit: true,
        missingMaster: false,
        dataSourceTransition: nextTransition,
      });
    },
    { nextRunId: appRunId, nextTraceId: traceId, nextTransition: dataSourceTransition },
  );
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await createSessionContext(browser);
  const page = await context.newPage();

  const seedEncounterContext = async (reason) => {
    await page
      .evaluate(
        ({ facilityId, userId, patientId }) => {
          const key = `opendolphin:web-client:charts:encounter-context:v2:${facilityId}:${userId}`;
          try {
            window.sessionStorage.setItem(key, JSON.stringify({ patientId }));
          } catch {
            // ignore
          }
        },
        { facilityId, userId: authUserId, patientId },
      )
      .catch(() => null);
    logStep(`seed encounter-context patientId=${patientId} reason=${reason}`);
  };

  const debugChartsState = async (label) => {
    const state = await page
      .evaluate(
        ({ facilityId, userId }) => {
          const read = (key) => {
            try {
              return window.sessionStorage.getItem(key);
            } catch {
              return null;
            }
          };
          const safeParse = (raw) => {
            if (!raw) return null;
            try {
              return JSON.parse(raw);
            } catch {
              return { raw: String(raw).slice(0, 200) };
            }
          };
          const session = safeParse(read('opendolphin:web-client:auth'));
          const flags = safeParse(read('opendolphin:web-client:auth-flags'));
          const encounter = safeParse(
            read(`opendolphin:web-client:charts:encounter-context:v2:${facilityId}:${userId}`),
          );
          return {
            href: window.location.href,
            search: window.location.search,
            patientIdParam: new URLSearchParams(window.location.search).get('patientId'),
            visitDateParam: new URLSearchParams(window.location.search).get('visitDate'),
            runIdParam: new URLSearchParams(window.location.search).get('runId'),
            session: session
              ? { facilityId: session.facilityId, userId: session.userId, role: session.role, runId: session.runId }
              : null,
            flags: flags?.flags
              ? { sessionKey: flags.sessionKey, runId: flags.flags.runId, dataSourceTransition: flags.flags.dataSourceTransition }
              : null,
            encounter,
          };
        },
        { facilityId, userId: authUserId },
      )
      .catch(() => null);
    if (state) logStep(`debug ${label} state=${JSON.stringify(state)}`);
  };

  const networkRecords = [];
  const requestRecords = [];
  const consoleMessages = [];
  const pageErrors = [];

  // Capture additional API activity needed to debug "patient not selected" / empty patients tab.
  const shouldRecordDebug = (url) =>
    isTarget(url) ||
    url.includes('/api/orca/official/appointments/list') ||
    url.includes('/api/orca/official/visits/list') ||
    url.includes('/api/orca/official/appointments/list') ||
    url.includes('/api/orca/official/visits/list');

  // Force `x-run-id` to be within DB constraints for any API calls hitting the dev server origin.
  // Without this, audit logging can fail with "value too long for type character varying(64)" and break verification.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (!shouldRewriteRunIdHeader(url)) return route.continue();
    const headers = { ...request.headers(), 'x-run-id': runIdHeader };
    return route.continue({ headers });
  });

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({ type, text: msg.text(), location: msg.location() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('request', (request) => {
    const url = request.url();
    if (!shouldRecordDebug(url)) return;
    requestRecords.push({
      url,
      method: request.method(),
      headers: redactHeaders(request.headers()),
      postData: request.postData() ?? '',
    });
  });
  page.on('response', async (response) => {
    const url = response.url();
    if (!shouldRecordDebug(url)) return;
    const request = response.request();
    let responseText = '';
    try {
      responseText = await response.text();
    } catch (error) {
      responseText = `<<failed to read response body: ${String(error)}>>`;
    }
    networkRecords.push({
      url,
      status: response.status(),
      statusText: response.statusText(),
      request: {
        method: request.method(),
        headers: redactHeaders(request.headers()),
        postData: request.postData() ?? '',
      },
      response: {
        headers: redactHeaders(response.headers()),
        body: responseText,
      },
    });
  });

  // Capture failed requests (e.g., network error) where no response event is fired.
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!shouldRecordDebug(url)) return;
    requestRecords.push({
      url,
      method: request.method(),
      headers: redactHeaders(request.headers()),
      postData: request.postData() ?? '',
      failed: true,
      failure: request.failure() ?? null,
    });
    logStep(`request failed method=${request.method()} url=${url} error=${request.failure()?.errorText ?? 'unknown'}`);
  });

  if (forceMaterialTransition) {
    // Force the transition header for material master requests so we can validate
    // MSW/UI behaviors deterministically (e.g. snapshot -> MSW 200 items=[]).
    await page.route('**/api/orca/master/material**', async (route) => {
      const headers = {
        ...route.request().headers(),
        'x-run-id': runIdHeader,
        'x-trace-id': traceId,
        'x-datasource-transition': forceMaterialTransition,
      };
      await route.continue({ headers });
    });
    logStep(`route override material transition=${forceMaterialTransition}`);
  }

  if (openFromReception) {
    const receptionUrl = `/f/${encodeURIComponent(facilityId)}/reception`;
    await page.goto(receptionUrl, { waitUntil: 'domcontentloaded' });
    logStep(`goto reception url=${page.url()}`);
    await page.locator('.reception-page').waitFor({ timeout: 20000 });
    await writeScreenshot(page, '00-reception-open');

    const allRows = page.locator('tr.reception-table__row');
    // Reception は非同期で rows を埋めるため、短時間だけ待つ（ポーリングではなく単発待ち）。
    const hasRows = await allRows
      .first()
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    const refreshButton = page.getByRole('button', { name: '再取得' }).first();
    if (!hasRows && (await refreshButton.isVisible().catch(() => false))) {
      await refreshButton.click().catch(() => null);
      logStep('reception refresh clicked (no rows initially)');
      await allRows
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => true)
        .catch(() => false);
    }
    const acceptForm = page.locator('[data-test-id="reception-accept-form"]');
    await acceptForm.waitFor({ timeout: 20000 });

    const attemptAccept = async () => {
      logStep('attempt accept submit to seed reception row');
      await acceptForm.locator('#reception-accept-patient-id').fill(patientId);
      await selectOptionFallback(acceptForm.locator('#reception-accept-department'), '01');
      await acceptForm.locator('#reception-accept-payment-mode').selectOption('insurance').catch(async () => {
        await selectOptionFallback(acceptForm.locator('#reception-accept-payment-mode'), 'insurance');
      });
      await selectOptionFallback(acceptForm.locator('#reception-accept-physician'), '10001');
      await acceptForm.locator('#reception-accept-visit-kind').selectOption('1').catch(async () => {
        await selectOptionFallback(acceptForm.locator('#reception-accept-visit-kind'), '1');
      });
      await acceptForm.locator('#reception-accept-note').fill(`qa material master ${runId}`);
      await writeScreenshot(page, '00c-reception-accept-filled');

      const acceptResponsePromise = page
        .waitForResponse((response) => response.url().includes('/api/orca/official/visits/mutation'), { timeout: 20000 })
        .catch(() => null);
      await acceptForm.locator('button[type="submit"]').first().click();
      const resp = await acceptResponsePromise;
      if (resp) {
        logStep(`accept response=${resp.status()} url=${resp.url()}`);
      } else {
        logStep('accept response=none');
      }
      await page.waitForTimeout(1500);
      await writeScreenshot(page, '00d-reception-after-accept');
    };

    const ensureTargetReceptionRow = async () => {
      const row = page.locator('tr.reception-table__row', { hasText: patientId }).first();
      const ok = await row
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      return ok ? row : null;
    };

    // Ensure a row for this patient exists. If not present, try `accept` once to create it.
    let targetRow = await ensureTargetReceptionRow();
    if (!targetRow) {
      logStep(`reception target row missing patientId=${patientId}; attempting accept+refresh`);
      await attemptAccept();
      if (await refreshButton.isVisible().catch(() => false)) {
        await refreshButton.click().catch(() => null);
        logStep('reception refresh clicked (after accept)');
      }
      targetRow = await ensureTargetReceptionRow();
    }

    // If still missing, click the first row that can open Charts (patientId exists) and proceed.
    const findFirstChartsCapableRow = async () => {
      const rows = page.locator('tr.reception-table__row');
      const count = await rows.count().catch(() => 0);
      for (let i = 0; i < Math.min(count, 12); i += 1) {
        const row = rows.nth(i);
        const text = ((await row.innerText().catch(() => '')) ?? '').replaceAll('\n', ' ');
        if (text.includes('未登録')) continue;
        // Rough heuristic: the ID column prints `患者ID:` when patientId exists.
        if (!/患者ID\\s*:\\s*\\d+/.test(text) && !text.includes(patientId)) continue;
        return row;
      }
      return null;
    };

    if (!targetRow) {
      const fallbackRow = await findFirstChartsCapableRow();
      if (fallbackRow) {
        logStep('reception fallback row selected (patientId row not found)');
        targetRow = fallbackRow;
      } else {
        const shot = await writeScreenshot(page, '00b-reception-row-not-found');
        throw new Error(`reception row for patientId=${patientId} not found screenshot=${shot}`);
      }
    }

    logStep(`reception target row found patientId=${patientId}`);
    await targetRow.dblclick();
    await page.waitForURL('**/charts**', { timeout: 20000 });
    await page.locator('.charts-page').waitFor({ timeout: 20000 });
    logStep(`navigated to charts url=${page.url()}`);
  } else {
    const chartsUrl = `/f/${encodeURIComponent(facilityId)}/charts?patientId=${encodeURIComponent(patientId)}`;
    await page.goto(chartsUrl, { waitUntil: 'domcontentloaded' });
    logStep(`goto charts url=${page.url()}`);
  }

  const isControlled = async () =>
    await page
      .evaluate(() => ('serviceWorker' in navigator ? Boolean(navigator.serviceWorker.controller) : false))
      .catch(() => false);
  let controlled = await isControlled();
  if (verifyServiceWorker) {
    for (let attempt = 0; attempt < 3 && !controlled; attempt += 1) {
      await page.waitForTimeout(1200);
      controlled = await isControlled();
      if (controlled) break;
      await page.reload({ waitUntil: 'domcontentloaded' });
      controlled = await isControlled();
      logStep(`serviceWorker retry attempt=${attempt + 1} controlled=${String(controlled)}`);
    }
  }
  logStep(`serviceWorker controlled=${String(controlled)} verify=${String(verifyServiceWorker)}`);
  logStep(`serviceWorker mode=${allowServiceWorker ? 'allow' : 'block'}`);

  const scenarioApplied = await page
    .waitForFunction(() => window.__OUTPATIENT_SCENARIO__?.select, { timeout: 15000 })
    .then(async () => {
      await page.evaluate(() => {
        window.__OUTPATIENT_SCENARIO__.select('server-handoff');
      });
      return true;
    })
    .catch(() => false);
  logStep(`outpatient scenario selectable=${String(scenarioApplied)}`);

  if (scenarioApplied) {
    const overrideMissingMaster =
      outpatientOverrideMissingMasterRaw.trim() === ''
        ? null
        : ['1', 'true', 'yes', 'on'].includes(outpatientOverrideMissingMasterRaw.trim().toLowerCase());
    const overrideLabel = overrideMissingMaster === null ? 'none' : String(overrideMissingMaster);
    await page
      .evaluate(
        ({ scenarioId, overrideMissingMaster }) => {
          window.__OUTPATIENT_SCENARIO__.select(scenarioId);
          if (overrideMissingMaster !== null) {
            window.__OUTPATIENT_SCENARIO__.update({ missingMaster: overrideMissingMaster });
          }
        },
        { scenarioId: outpatientScenarioId, overrideMissingMaster },
      )
      .catch(() => null);
    logStep(`outpatient scenario selected=${outpatientScenarioId} overrideMissingMaster=${overrideLabel}`);
    if (scenarioReload) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      logStep('reloaded after scenario selection');
      await page.locator('.charts-page').waitFor({ timeout: 20000 });
    }
  }

  await page.locator('.charts-page').waitFor({ timeout: 20000 });
  await Promise.race([setObservabilityMeta(page), new Promise((resolve) => setTimeout(resolve, 5000))]).catch(() => null);
  logStep(`charts ready & observability meta updated url=${page.url()}`);
  await debugChartsState('charts-ready');
  await writeScreenshot(page, '00-charts-open');

  const ensurePatientSelected = async () => {
    const trigger = page.locator('button[data-utility-action="order-edit"]').first();
    const disabled = await trigger.isDisabled().catch(() => false);
    if (!disabled) return true;
    const title = (await trigger.getAttribute('title').catch(() => '')) ?? '';
    logStep(`utility order-edit disabled title=${title.replaceAll('\n', ' ').trim()}`);
    if (!title.includes('患者が未選択')) return false;

    // Wait (single timeout) for any selectable patient row to appear.
    const rows = page.locator('button.patients-tab__row');
    const hasAnyRow = await rows
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!hasAnyRow) {
      await debugChartsState('no-patients-row');
      return false;
    }

    // Prefer the requested patientId. If it's not available, pick the first row whose patientId is not empty ('—').
    const pickRowIndex = async () => {
      const all = await rows.evaluateAll((nodes) =>
        nodes.map((node) => {
          const patientIdValue =
            node.querySelector('.patients-tab__row-id .patient-meta-row__value')?.textContent?.trim() ?? '';
          const text = node.textContent?.replaceAll('\\n', ' ').trim() ?? '';
          return { patientIdValue, text };
        }),
      );
      const exact = all.findIndex((row) => row.patientIdValue === String(patientId));
      if (exact >= 0) return { index: exact, reason: `exact:${patientId}` };
      const valid = all.findIndex((row) => row.patientIdValue && row.patientIdValue !== '—');
      if (valid >= 0) return { index: valid, reason: `first-valid:${all[valid]?.patientIdValue ?? 'unknown'}` };
      return null;
    };

    const pick = await pickRowIndex();
    if (!pick) {
      await debugChartsState('patient-select-no-valid-rows');
      return false;
    }
    await rows.nth(pick.index).click().catch(() => null);
    logStep(`patients-tab row clicked index=${pick.index} reason=${pick.reason}`);

    await page.waitForTimeout(800);
    const enabled = !(await trigger.isDisabled().catch(() => true));
    logStep(`utility order-edit enabled after patient select=${String(enabled)}`);
    if (!enabled) {
      await debugChartsState('patient-select-failed');
    }
    return enabled;
  };

  // Some navigation paths (e.g. Reception deep link without patientId) can land on Charts with patient unselected.
  // Ensure the patient is selected before opening the order-edit utility.
  const okPatient = await ensurePatientSelected();
  if (!okPatient) {
    const shot = await writeScreenshot(page, '00z-patient-not-selected');
    throw new Error(`patient not selected (cannot open order panel) screenshot=${shot}`);
  }

  // Ensure shortcuts aren't blocked by a focused input element.
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => null);

  // Open the utility drawer via UI click first (more robust than relying on keyboard focus).
  // Fallback to shortcut if needed.
  const orderEntity = 'generalOrder';
  let panel = null;
  const openViaClick = async () => {
    const trigger = page.locator('button[data-utility-action="order-edit"]').first();
    const ok = await trigger
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!ok) return false;
    const disabled = await trigger.isDisabled().catch(() => false);
    if (disabled) {
      const title = await trigger.getAttribute('title').catch(() => '');
      logStep(`utility tab order-edit disabled title=${(title ?? '').replaceAll('\\n', ' ').trim()}`);
      return false;
    }
    await trigger.click().catch(() => null);
    logStep('clicked utility tab order-edit (enabled)');
    return true;
  };

  const waitForPanel = async () => {
    const locator = page.locator(`[data-test-id="${orderEntity}-edit-panel"]`);
    const ok = await locator
      .waitFor({ timeout: 12000 })
      .then(() => true)
      .catch(() => false);
    return ok ? locator : null;
  };

  await openViaClick();
  panel = await waitForPanel();
  if (!panel) {
    logStep('utility click did not open panel; fallback to shortcut Ctrl+Shift+3');
    await page.keyboard.press('Control+Shift+3').catch(() => null);
    panel = await waitForPanel();
  }

  if (!panel) {
    const shot = await writeScreenshot(page, '01-order-panel-missing');
    throw new Error(`order panel not available (entity=${orderEntity}) screenshot=${shot}`);
  }

  logStep(`order panel opened entity=${orderEntity}`);
  await writeScreenshot(page, '01-order-panel-open');

  const blockNotice = panel.locator('text=編集はブロックされています').first();
  if (await blockNotice.isVisible().catch(() => false)) {
    const message = (await blockNotice.innerText().catch(() => '')).replaceAll('\n', ' ').trim();
    logStep(`order panel blocked notice=${message}`);
  }

  if (saveOrder) {
    await panel.locator(`#${orderEntity}-bundle-name`).fill(orderBundleName);
    const itemNameLocator = panel.locator(`#${orderEntity}-item-name-0`);
    const currentItemName = await itemNameLocator.inputValue().catch(() => '');
    if (!currentItemName.trim()) {
      await itemNameLocator.fill(orderItemName);
      logStep(`order item name fallback filled value=${orderItemName}`);
    }
    await panel.locator(`#${orderEntity}-item-quantity-0`).fill(orderQuantity);
    logStep(`order base fields filled bundleName=${orderBundleName} orderQuantity=${orderQuantity}`);
    await writeScreenshot(page, '01b-order-base-fields');
  } else {
    logStep('order save skipped (QA_SAVE_ORDER!=1)');
  }

  const materialKeywordInput = panel.locator(`#${orderEntity}-material-keyword`);
  const materialSection = materialKeywordInput.locator(
    'xpath=ancestor::div[contains(@class,"charts-side-panel__subsection")]',
  );
  const materialResult = materialSection.locator('button.charts-side-panel__search-row').first();
  const materialError = materialSection.locator('.charts-side-panel__notice--error').first();
  const materialEmpty = materialSection.locator('.charts-side-panel__empty').first();

  const materialResponsePromise = page
    .waitForResponse((response) => response.url().includes('/api/orca/master/material') && response.request().method() === 'GET', { timeout: 15000 })
    .catch(() => null);

  if (beforeMaterialTransition) {
    await page
      .evaluate(
        async ({ nextTransition }) => {
          const mod = await import('/src/libs/observability/observability');
          mod.updateObservabilityMeta({ dataSourceTransition: nextTransition });
        },
        { nextTransition: beforeMaterialTransition },
      )
      .catch(() => null);
    logStep(`observability override before material transition=${beforeMaterialTransition}`);
  }

  await materialKeywordInput.fill(materialKeyword);
  logStep(`material keyword filled keyword=${materialKeyword}`);
  const materialResponse = await materialResponsePromise;
  if (materialResponse) {
    logStep(`material master response=${materialResponse.status()} url=${materialResponse.url()}`);
  } else {
    logStep('material master response=none');
  }

  await Promise.race([
    materialResult.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
    materialError.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
    materialEmpty.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null),
  ]);

  if (await materialResult.isVisible().catch(() => false)) {
    const label = (await materialResult.innerText().catch(() => '')).replaceAll('\n', ' ').trim();
    logStep(`material result row visible label=${label}`);
    if (saveOrder) {
      await materialResult.click();
      logStep('material row clicked (selected)');

      if (materialQuantity) {
        const q = panel.locator(`#${orderEntity}-material-quantity-0`);
        if (await q.isVisible().catch(() => false)) {
          await q.fill(materialQuantity);
          logStep(`material quantity filled value=${materialQuantity}`);
        } else {
          logStep('material quantity input not visible (material row not created)');
        }
      }
      if (materialUnit) {
        const u = panel.locator(`#${orderEntity}-material-unit-0`);
        if (await u.isVisible().catch(() => false)) {
          await u.fill(materialUnit);
          logStep(`material unit filled value=${materialUnit}`);
        } else {
          logStep('material unit input not visible (material row not created)');
        }
      }

      await writeScreenshot(page, '02b-material-selected');

      const orderResponsePromise = page
        .waitForResponse((response) => {
          const url = response.url();
          return (
            (url.includes('/api/local/order/bundles') || url.includes('/api/local/order/bundles')) &&
            response.request().method() === 'POST'
          );
        }, { timeout: 15000 })
        .catch(() => null);

      await panel.locator('button[type="submit"]').first().click();
      const orderResponse = await orderResponsePromise;
      if (orderResponse) {
        logStep(`order bundles response=${orderResponse.status()} url=${orderResponse.url()}`);
      } else {
        logStep('order bundles response=none');
      }
      await page.waitForTimeout(1500);
      await writeScreenshot(page, '03-order-after-submit');
    }
  } else if (await materialError.isVisible().catch(() => false)) {
    const message = (await materialError.innerText().catch(() => '')).replaceAll('\n', ' ').trim();
    logStep(`material error notice=${message}`);
  } else if (await materialEmpty.isVisible().catch(() => false)) {
    const message = (await materialEmpty.innerText().catch(() => '')).replaceAll('\n', ' ').trim();
    logStep(`material empty notice=${message}`);
  } else {
    logStep('material result not available (no row/notice visible)');
  }

  await writeScreenshot(page, '02-material-master-result');

  fs.writeFileSync(path.join(networkDir, 'network.json'), JSON.stringify(networkRecords, null, 2));
  fs.writeFileSync(path.join(networkDir, 'requests.json'), JSON.stringify(requestRecords, null, 2));

  const orderBundlePosts = requestRecords
    .filter(
      (record) =>
        (record.url.includes('/api/local/order/bundles') || record.url.includes('/api/local/order/bundles')) &&
        record.method === 'POST',
    )
    .map((record) => ({
      url: record.url,
      method: record.method,
      // Keep raw postData for later inspection.
      postData: record.postData ?? '',
    }));

  const summary = {
    runId,
    runIdHeader,
    traceId,
    executedAt: new Date().toISOString(),
    baseURL,
    facilityId,
    patientId,
    orderEntity,
    materialKeyword,
    dataSourceTransition,
    saveOrder,
    orderBundleName: saveOrder ? orderBundleName : null,
    orderBundlePostCount: orderBundlePosts.length,
    networkRecordCount: networkRecords.length,
    requestRecordCount: requestRecords.length,
    consoleMessages,
    pageErrors,
  };
  fs.writeFileSync(path.join(artifactRoot, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'order-bundles-posts.json'), JSON.stringify(orderBundlePosts, null, 2));

  await context.close();
  await browser.close();

  console.log(`QA log written: ${artifactRoot}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
