import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '../../playwright/fixtures';
import { baseUrl, expandChartsQuickActions, seedAuthSession } from '../helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20260120T232504Z';
const TRACE_ID = `trace-${RUN_ID}`;
const FACILITY_ID = '1.3.6.1.4.1.9414.72.103';
const CLAIM_DATE = '2026-01-20';
const RECEPTION_ID = 'RCPT-2401';
const SCHEDULE_KEY = 'F001:S2401';
const ENCOUNTER_KEY = 'F001:E2401';
const RECEPTION_ENTRY_SELECTOR = '[data-test-id="reception-entry-card"], [data-test-id="reception-entry-row"]';
type E2EPage = Parameters<typeof test>[0]['page'];

const buildArtifactRoot = () => {
  if (process.env.PLAYWRIGHT_ARTIFACT_DIR) return process.env.PLAYWRIGHT_ARTIFACT_DIR;
  return path.join(process.cwd(), 'artifacts', 'webclient', 'e2e', RUN_ID, 'claim-send');
};

const ensureDir = (target: string) => {
  fs.mkdirSync(target, { recursive: true });
};

const sanitizeTitle = (title: string) => title.replace(/[^0-9A-Za-z_-]+/g, '_');

const writeArtifact = (dir: string, name: string, body: string) => {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, name), body, 'utf8');
};

const appendMemo = (dir: string, name: string, body: string) => {
  ensureDir(dir);
  fs.appendFileSync(path.join(dir, name), body, 'utf8');
};

const receptionEntryByPatientSelector = (patientId: string) =>
  `[data-test-id="reception-entry-card"][data-patient-id="${patientId}"], [data-test-id="reception-entry-row"][data-patient-id="${patientId}"]`;

const expandReceptionSectionsSafely = async (page: E2EPage) => {
  const toggles = page.locator(
    '#reception-results button.reception-board__toggle, #reception-results button.reception-section__toggle',
  );
  const count = await toggles.count();
  for (let index = 0; index < count; index += 1) {
    const toggle = toggles.nth(index);
    if (!(await toggle.isVisible().catch(() => false))) continue;
    const label = (await toggle.innerText()).trim();
    if (label.includes('開く')) {
      await toggle.click();
    }
  }
};

const gotoReceptionForDate = async (page: E2EPage, date: string = CLAIM_DATE) => {
  const facility = encodeURIComponent(FACILITY_ID);
  const targetUrl = `${baseUrl}/f/${facility}/reception?sort=time&date=${date}`;
  await page.goto(targetUrl);
  if (!/\/reception/.test(page.url())) {
    const receptionShortcut = page.getByRole('button', { name: /^受付$/ }).first();
    await expect(receptionShortcut).toBeVisible({ timeout: 10_000 });
    await receptionShortcut.click();
    await expect(page).toHaveURL(/\/reception/, { timeout: 10_000 });
    await page.goto(targetUrl);
  }
  await expect(page).toHaveURL(/\/reception\?/, { timeout: 10_000 });
  await expect(page.locator('#reception-results')).toBeVisible({ timeout: 20_000 });
};

const findReceptionEntryByPatient = async (page: E2EPage, patientId: string) => {
  const byPatient = page.locator(receptionEntryByPatientSelector(patientId)).first();
  const byText = page.locator(RECEPTION_ENTRY_SELECTOR, { hasText: patientId }).first();
  await expect(byPatient.or(byText)).toBeVisible({ timeout: 15_000 });
  if (await byPatient.isVisible().catch(() => false)) return byPatient;
  return byText;
};

const seedChartsNavigationState = async (
  page: E2EPage,
  params: { patientId: string; appointmentId: string; receptionId: string; scheduleKey: string; encounterKey: string; visitDate: string; runId: string },
) => {
  await page.addInitScript((state) => {
    const current = window.history.state ?? {};
    window.history.replaceState(
      {
        ...current,
        usr: {
          ...(typeof current === 'object' && current ? (current as { usr?: Record<string, unknown> }).usr : {}),
          ...state,
        },
      },
      '',
      window.location.href,
    );
  }, params);
};

test.use({
  serviceWorkers: 'block',
});

const registerBaseRoutes = async (
  page: E2EPage,
  baseFlags: Record<string, unknown>,
) => {
  await page.route('**/api/user/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilityId: FACILITY_ID,
        userId: 'doctor1',
        displayName: 'Playwright Doctor',
        roles: ['doctor'],
      }),
    }),
  );
  const adminConfig = {
    runId: RUN_ID,
    chartsDisplayEnabled: true,
    chartsSendEnabled: true,
    chartsMasterSource: 'auto',
    verified: true,
    source: 'mock',
  };
  await page.route('**/api/admin/config', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
  );
  await page.route('**/api/admin/delivery', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adminConfig) }),
  );
  await page.route('**/api/session/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilityId: FACILITY_ID,
        userId: 'doctor1',
        clientUuid: 'e2e-playwright',
        runId: RUN_ID,
        roles: ['admin'],
        displayName: 'Playwright Doctor',
      }),
    }),
  );
  await page.route('**/api/orca/official/appointments/list', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...baseFlags,
        appointmentDate: CLAIM_DATE,
        slots: [
          {
            appointmentId: 'APT-2401',
            appointmentTime: '0910',
            departmentName: '01 内科',
            departmentCode: '01',
            physicianName: '藤井',
            physicianCode: '10001',
            scheduleKey: SCHEDULE_KEY,
            encounterKey: ENCOUNTER_KEY,
            patient: {
              patientId: '000001',
              wholeName: '山田 花子',
              wholeNameKana: 'ヤマダ ハナコ',
              birthDate: '1985-04-12',
              sex: 'F',
            },
          },
        ],
        reservations: [],
        visits: [],
      }),
    }),
  );
  await page.route('**/api/orca/official/visits/list', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...baseFlags,
        visitDate: CLAIM_DATE,
        visits: [
          {
            receptionId: RECEPTION_ID,
            patientId: '000001',
            sequentialNumber: 'APT-2401',
            scheduleKey: SCHEDULE_KEY,
            encounterKey: ENCOUNTER_KEY,
            acceptanceTime: '0910',
            departmentCode: '01',
            departmentName: '01 内科',
            physicianCode: '10001',
            physician: '10001 藤井',
            physicianName: '藤井',
            visitInformation: '受付',
            patient: {
              patientId: '000001',
              wholeName: '山田 花子',
              wholeNameKana: 'ヤマダ ハナコ',
              birthDate: '1985-04-12',
              sex: 'F',
            },
          },
        ],
      }),
    }),
  );
  await page.route('**/api/local/patients/search**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...baseFlags, patients: [] }),
    }),
  );
  await page.route('**/orca21/medicalmodv2/outpatient', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...baseFlags, recordsReturned: 0, outpatientList: [] }),
    }),
  );
  await page.route('**/api01rv2/incomeinfv2', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: '<xmlio2><incomeinfv2res><Api_Result>00</Api_Result></incomeinfv2res></xmlio2>',
    }),
  );
  await page.route('**/api01rv2/pusheventgetv2', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pusheventgetv2res: { Api_Result: '0000', Api_Result_Message: 'OK', Event_Information: [] },
      }),
    }),
  );
  await page.route('**/api/orca/queue**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...baseFlags, source: 'mock', fetchedAt: new Date().toISOString(), queue: [] }),
    }),
  );
  await page.route('**/orca/disease/import/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );
};

const setupSession = async (page: E2EPage) => {
  await seedAuthSession(page);
  await page.addInitScript(({ runId, facilityId }) => {
    window.localStorage.setItem('devFacilityId', facilityId);
    window.localStorage.setItem('devUserId', 'doctor1');
    window.localStorage.setItem('devPasswordMd5', '632080fabdb968f9ac4f31fb55104648');
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth',
      JSON.stringify({
        facilityId,
        userId: 'doctor1',
        role: 'admin',
        runId,
        clientUuid: 'e2e-playwright',
      }),
    );
    window.sessionStorage.setItem(
      'opendolphin:web-client:auth-flags',
      JSON.stringify({
        sessionKey: `${facilityId}:doctor1`,
        flags: {
          runId,
          cacheHit: true,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
        updatedAt: new Date().toISOString(),
      }),
    );
    const approvalPrefix = 'opendolphin:web-client:charts:approval:v1:';
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(approvalPrefix)) {
        window.localStorage.removeItem(key);
      }
    });
  }, { runId: RUN_ID, facilityId: FACILITY_ID });
};

const gotoCharts = async (page: E2EPage) => {
  const facilityId = encodeURIComponent(FACILITY_ID);
  await seedChartsNavigationState(page, {
    patientId: '000001',
    appointmentId: 'APT-2401',
    receptionId: RECEPTION_ID,
    scheduleKey: SCHEDULE_KEY,
    encounterKey: ENCOUNTER_KEY,
    visitDate: CLAIM_DATE,
    runId: RUN_ID,
  });
  await page.goto(`${baseUrl}/f/${facilityId}/charts`);
  await expect(page).toHaveURL(/charts/, { timeout: 10_000 });
  const patientStartButton = page.getByRole('button', { name: '診察開始' }).first();
  if (await patientStartButton.isVisible().catch(() => false)) {
    await patientStartButton.click();
  }
  await expandChartsQuickActions(page);
  await expect(page.locator('[data-test-id="charts-actionbar"]')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(async ({ runId, traceId }) => {
    const mod = await import('/src/libs/observability/observability');
    mod.updateObservabilityMeta({ runId, traceId });
  }, { runId: RUN_ID, traceId: TRACE_ID });
};

test.describe('ORCA公式経路 送信本線化 (medicalmodv2)', () => {
  test('伝票番号とData_Idを取得してトースト表示する', async ({ page }, testInfo) => {
    const telemetryLogs: string[] = [];
    let medicalmodv2Response = '';
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[telemetry]')) {
        telemetryLogs.push(text);
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api21/medicalmodv2')) {
        medicalmodv2Response = await response.text();
      }
    });
    await page.context().setExtraHTTPHeaders({
      'x-msw-scenario': 'cache-hit',
      'x-msw-cache-hit': '1',
      'x-msw-missing-master': '0',
      'x-msw-transition': 'server',
      'x-msw-fallback-used': '0',
    });
    const baseFlags = {
      runId: RUN_ID,
      traceId: TRACE_ID,
      cacheHit: true,
      missingMaster: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
    };
    await registerBaseRoutes(page, baseFlags);
    const medicalmodv2Xml = [
      '<xmlio2>',
      '  <medicalres>',
      '    <Api_Result>00</Api_Result>',
      '    <Api_Result_Message>OK</Api_Result_Message>',
      `    <Information_Date>${CLAIM_DATE}</Information_Date>`,
      '    <Information_Time>09:00:00</Information_Time>',
      '    <Invoice_Number>INV-000001</Invoice_Number>',
      '    <Data_Id>DATA-000001</Data_Id>',
      '  </medicalres>',
      '</xmlio2>',
    ].join('');
    await page.route('**/api21/medicalmodv2**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/xml',
        body: medicalmodv2Xml,
      }),
    );
    await setupSession(page);
    await gotoCharts(page);

    const startTime = Date.now();
    await page.getByRole('button', { name: 'ORCA 送信' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'ORCA送信の確認' });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: '送信する' }).click();

    const toast = page.locator('.charts-actions__toast');
    await expect(toast).toContainText('ORCA送信を完了', { timeout: 10_000 });
    const durationMs = Date.now() - startTime;

    const statusLine = page.locator('.charts-actions__status');
    await expect(statusLine).toHaveText(/承認済み（署名確定）: 編集不可|送信状態:|アクションを選択できます/, { timeout: 5_000 });
    await page.waitForFunction(
      () => Object.keys(sessionStorage).some((key) => key.startsWith('charts:orca-claim-send:')),
      null,
      { timeout: 5_000 },
    );
    const cacheKeys = await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith('charts:orca-claim-send:')),
    );
    const cacheKey = cacheKeys.length > 0 ? cacheKeys[0] : null;
    const cacheRaw = cacheKey
      ? await page.evaluate((key) => sessionStorage.getItem(key), cacheKey)
      : null;
    const cacheEntry = cacheRaw ? (JSON.parse(cacheRaw) as Record<string, any>) : null;
    const cached = cacheEntry?.['000001'];

    const artifactRoot = buildArtifactRoot();
    const safeTitle = sanitizeTitle(testInfo.title);
    const telemetryDir = path.join(artifactRoot, 'telemetry');
    const auditDir = path.join(artifactRoot, 'audit');
    const screenshotsDir = path.join(artifactRoot, 'screenshots');
    const memoDir = path.join(artifactRoot, 'notes');
    const memoName = `${RUN_ID}-claim-send-note.md`;
    const telemetryName = `${RUN_ID}-${safeTitle}-telemetry.txt`;
    const auditName = `${RUN_ID}-${safeTitle}-audit.json`;
    const responseName = `${RUN_ID}-${safeTitle}-orca-response.txt`;
    const cacheName = `${RUN_ID}-${safeTitle}-cache.json`;

    await gotoReceptionForDate(page, CLAIM_DATE);
    await expandReceptionSectionsSafely(page);
    const receptionEntry = await findReceptionEntryByPatient(page, '000001');
    await receptionEntry.click();
    await expect(receptionEntry).toContainText('000001');
    await expect(receptionEntry).toContainText('APT-2401');
    await expect(receptionEntry).toContainText(/未取得|invoice:\s*INV-000001|I:\s*INV-000001/);
    await expect(receptionEntry).not.toContainText('再送待ち');

    const auditEvents = await page.evaluate(() => (window as any).__AUDIT_EVENTS__ ?? []);
    const auditText = JSON.stringify(auditEvents, null, 2);
    const telemetrySnapshot = await page.evaluate(() => (window as any).__OUTPATIENT_FUNNEL__ ?? []);
    const telemetryText = JSON.stringify(telemetrySnapshot, null, 2);

    if (telemetryLogs.length === 0) {
      telemetryLogs.push('[telemetry] log not captured');
    }
    writeArtifact(
      telemetryDir,
      telemetryName,
      [`RUN_ID=${RUN_ID}`, `TRACE_ID=${TRACE_ID}`, ...telemetryLogs, '', telemetryText].join('\n'),
    );
    writeArtifact(auditDir, auditName, auditText);
    writeArtifact(
      auditDir,
      responseName,
      ['medicalmodv2:', medicalmodv2Response || '(empty)'].join('\n'),
    );
    writeArtifact(
      auditDir,
      cacheName,
      JSON.stringify({ cacheKey, cacheRaw, cached }, null, 2),
    );

    await page.screenshot({
      path: path.join(screenshotsDir, `${RUN_ID}-${safeTitle}-success.png`),
      fullPage: true,
    });
    appendMemo(
      memoDir,
      memoName,
      [
        `# ORCA Claim Send Trial Evidence (${RUN_ID})`,
        '',
        `- scenario: success`,
        `- durationMs: ${durationMs}`,
        `- cacheKey: ${cacheKey ?? 'missing'}`,
        `- cacheEntry: ${cached ? JSON.stringify(cached) : 'missing'}`,
        `- telemetryLog: ${telemetryName}`,
        `- auditLog: ${auditName}`,
        `- orcaResponse: ${responseName}`,
        '',
      ].join('\n'),
    );
    expect(JSON.stringify(telemetrySnapshot)).toContain(RUN_ID);
    expect(JSON.stringify(telemetrySnapshot)).toContain(TRACE_ID);
  });

  test('送信失敗時に再送キュー/バナー整合とaria-liveを確認する', async ({ page }, testInfo) => {
    const telemetryLogs: string[] = [];
    const auditLogs: string[] = [];
    let medicalmodv2Response = '';
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[telemetry]')) telemetryLogs.push(text);
      if (text.includes('[audit]')) auditLogs.push(text);
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api21/medicalmodv2')) {
        medicalmodv2Response = await response.text();
      }
    });
    await page.context().setExtraHTTPHeaders({
      'x-msw-scenario': 'cache-hit',
      'x-msw-cache-hit': '1',
      'x-msw-missing-master': '0',
      'x-msw-transition': 'server',
      'x-msw-fallback-used': '0',
    });
    const baseFlags = {
      runId: RUN_ID,
      traceId: TRACE_ID,
      cacheHit: true,
      missingMaster: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
    };
    await registerBaseRoutes(page, baseFlags);
    await page.route('**/api/orca/queue**retry=1**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          runId: RUN_ID,
          traceId: TRACE_ID,
          retryApplied: true,
          retryReason: 'msw-queue-retry',
        }),
      }),
    );
    await page.route('**/api/orca/queue**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...baseFlags,
          source: 'mock',
          fetchedAt: new Date().toISOString(),
          queue: [
            {
              id: 'queue-1',
              phase: 'retry',
              retryCount: 1,
              patientId: '000001',
              appointmentId: 'APT-2401',
              requestId: 'REQ-1',
              status: 'retry',
              lastDispatchAt: new Date().toISOString(),
            },
          ],
        }),
      }),
    );
    await setupSession(page);
    await gotoCharts(page);
    const medicalmodv2ErrorXml = [
      '<xmlio2>',
      '  <medicalres>',
      '    <Api_Result>E99</Api_Result>',
      '    <Api_Result_Message>Error</Api_Result_Message>',
      `    <Information_Date>${CLAIM_DATE}</Information_Date>`,
      '    <Information_Time>09:00:00</Information_Time>',
      '    <Invoice_Number>INV-000001</Invoice_Number>',
      '    <Data_Id>DATA-000001</Data_Id>',
      '  </medicalres>',
      '</xmlio2>',
    ].join('');
    await page.route('**/api21/medicalmodv2**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/xml',
        body: medicalmodv2ErrorXml,
      }),
    );

    const debugInfo = await page.evaluate(() => {
      const button = document.querySelector('#charts-action-send') as HTMLButtonElement | null;
      return {
        sendDisabled: button?.disabled ?? null,
        sendDisabledReason: button?.getAttribute('data-disabled-reason'),
        statusLine: document.querySelector('.charts-actions__status')?.textContent ?? null,
        transition: document.querySelector('[data-test-id=\"charts-actionbar\"]')?.getAttribute('data-run-id') ?? null,
      };
    });
    const debugRoot = buildArtifactRoot();
    const debugMemoDir = path.join(debugRoot, 'notes');
    const debugMemoName = `${RUN_ID}-claim-send-note.md`;
    appendMemo(
      debugMemoDir,
      debugMemoName,
      [
        `- pre-send debug: ${JSON.stringify(debugInfo)}`,
      ].join('\n'),
    );

    const startTime = Date.now();
    await page.getByRole('button', { name: 'ORCA 送信' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'ORCA送信の確認' });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole('button', { name: '送信する' }).click();

    const toast = page.locator('.charts-actions__toast');
    await expect(toast).toContainText('ORCA送信に失敗', { timeout: 10_000 });
    await expect(toast).toHaveAttribute('aria-live', 'assertive');
    const banner = page.getByRole('alert').first();
    await expect(banner).toContainText('ORCA送信に警告/失敗', { timeout: 10_000 });
    const durationMs = Date.now() - startTime;

    const auditEvents = await page.evaluate(() => (window as any).__AUDIT_EVENTS__ ?? []);
    const auditText = JSON.stringify(auditEvents, null, 2);
    const telemetrySnapshot = await page.evaluate(() => (window as any).__OUTPATIENT_FUNNEL__ ?? []);
    const telemetryText = JSON.stringify(telemetrySnapshot, null, 2);
    const hasRetryLog = auditEvents.some(
      (event) => (event as any)?.payload?.details?.retryQueue?.retryRequested === true,
    );
    const hasOrcaClaimSend = auditText.includes('orca_claim_send');

    await gotoReceptionForDate(page, CLAIM_DATE);
    await expandReceptionSectionsSafely(page);
    const receptionEntry = await findReceptionEntryByPatient(page, '000001');
    await receptionEntry.click();
    await expect(receptionEntry).toContainText(/再送待ち|会計送信:\s*失敗/);

    const artifactRoot = buildArtifactRoot();
    const safeTitle = sanitizeTitle(testInfo.title);
    const telemetryDir = path.join(artifactRoot, 'telemetry');
    const auditDir = path.join(artifactRoot, 'audit');
    const screenshotsDir = path.join(artifactRoot, 'screenshots');
    const memoDir = path.join(artifactRoot, 'notes');
    const memoName = `${RUN_ID}-claim-send-note.md`;
    const telemetryName = `${RUN_ID}-${safeTitle}-telemetry.txt`;
    const auditName = `${RUN_ID}-${safeTitle}-audit.json`;
    const responseName = `${RUN_ID}-${safeTitle}-orca-response.txt`;

    if (telemetryLogs.length === 0) telemetryLogs.push('[telemetry] log not captured');
    writeArtifact(
      telemetryDir,
      telemetryName,
      [`RUN_ID=${RUN_ID}`, `TRACE_ID=${TRACE_ID}`, ...telemetryLogs, '', telemetryText].join('\n'),
    );
    writeArtifact(auditDir, auditName, auditText);
    writeArtifact(
      auditDir,
      responseName,
      ['medicalmodv2:', medicalmodv2Response || '(empty)'].join('\n'),
    );
    await page.screenshot({
      path: path.join(screenshotsDir, `${RUN_ID}-${safeTitle}-error.png`),
      fullPage: true,
    });
    appendMemo(
      memoDir,
      memoName,
      [
        `- scenario: failure (msw fault http-500)`,
        `- durationMs: ${durationMs}`,
        `- retryQueueLogged: ${hasRetryLog}`,
        `- orcaClaimSendAudit: ${hasOrcaClaimSend}`,
        `- telemetryLog: ${telemetryName}`,
        `- auditLog: ${auditName}`,
        `- orcaResponse: ${responseName}`,
        '',
      ].join('\n'),
    );
    expect(JSON.stringify(telemetrySnapshot)).toContain(RUN_ID);
    expect(JSON.stringify(telemetrySnapshot)).toContain(TRACE_ID);
    expect(hasRetryLog).toBeTruthy();
    expect(hasOrcaClaimSend).toBeTruthy();
  });
});
