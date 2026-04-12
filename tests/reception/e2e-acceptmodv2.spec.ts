import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../playwright/fixtures';
import { baseUrl, runId, seedAuthSession } from '../e2e/helpers/orcaMaster';

const buildArtifactRoot = (): string => {
  // Allow overriding the artifact root from the outside (CI / local runs).
  // Default: local-only artifacts under artifacts/webclient/e2e/<RUN_ID>/...
  if (process.env.PLAYWRIGHT_ARTIFACT_DIR) return process.env.PLAYWRIGHT_ARTIFACT_DIR;
  return path.join(process.cwd(), 'artifacts', 'webclient', 'e2e', runId, 'reception', 'acceptmodv2');
};

const artifactRoot = buildArtifactRoot();

const receptionEntrySelector = '[data-test-id="reception-entry-card"], [data-test-id="reception-entry-row"]';

const receptionEntryByPatientSelector = (patientId: string) =>
  `[data-test-id="reception-entry-card"][data-patient-id="${patientId}"], [data-test-id="reception-entry-row"][data-patient-id="${patientId}"]`;

const receptionEntryByPatientAndStatusSelector = (patientId: string, status: string) =>
  `[data-test-id="reception-entry-card"][data-patient-id="${patientId}"][data-reception-status="${status}"], [data-test-id="reception-entry-row"][data-patient-id="${patientId}"][data-reception-status="${status}"]`;

const ensureAcceptRequiredSelections = async (acceptSection: Locator) => {
  const details = acceptSection.locator('[data-test-id="reception-accept-details"]');
  if ((await details.count()) === 0) {
    await acceptSection.locator('[data-test-id="reception-accept-toggle-details"]').click();
  }

  const department = acceptSection.locator('#reception-accept-department');
  if ((await department.inputValue()) === '') {
    await department.selectOption({ index: 1 });
  }
  const physician = acceptSection.locator('#reception-accept-physician');
  if ((await physician.inputValue()) === '') {
    await physician.selectOption({ index: 1 });
  }
};

const expandReceptionSections = async (page: Page) => {
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

const clickCancelActionForEntry = async (page: Page, entry: Locator) => {
  const inlineCancelButton = entry.getByRole('button', { name: '受付取消' }).first();
  if ((await inlineCancelButton.count()) > 0 && (await inlineCancelButton.isVisible().catch(() => false))) {
    await inlineCancelButton.click();
    return;
  }

  const menuToggle = entry.getByRole('button', { name: 'その他' }).first();
  await expect(menuToggle).toBeVisible();
  await menuToggle.click();
  const menuCancelButton = page.getByRole('menuitem', { name: '受付取消' }).first();
  await expect(menuCancelButton).toBeVisible();
  await menuCancelButton.click();
};

test.use({ trace: 'off' });

test.describe('Reception acceptmodv2 (/api/orca/official/visits/mutation)', () => {
  test.beforeEach(async ({ page }) => {
    fs.mkdirSync(artifactRoot, { recursive: true });
    await seedAuthSession(page);
    let registeredVisits: Array<{
      acceptanceId: string;
      patientId: string;
      acceptanceDate: string;
      acceptanceTime: string;
    }> = [];
    // Stub backend endpoints to keep tests self-contained (MSWに依存せず成功/21を制御)
    const fulfillIfFetch = async (route: any, handler: (route: any) => Promise<void>) => {
      const type = route.request().resourceType();
      if (type !== 'xhr' && type !== 'fetch') {
        await route.continue();
        return;
      }
      await handler(route);
    };

    await page.route('**/api/orca/official/visits/mutation**', async (route) =>
      fulfillIfFetch(route, async (routed) => {
        const body = JSON.parse(routed.request().postData() ?? '{}') as Record<string, any>;
        const patientId = body.patientId ?? '';
        const requestNumber = body.requestNumber ?? '01';
        const isWarning = patientId === '00021';
        const isCancel = requestNumber === '02';
        const apiResult = isWarning ? '21' : '00';
        const response = {
          apiResult,
          apiResultMessage: isWarning ? '受付なし' : '正常終了',
          runId,
          traceId: 'trace-accept-e2e',
          acceptanceId: isWarning ? undefined : `A-${patientId || '000001'}`,
          acceptanceDate: body.acceptanceDate ?? '2026-01-20',
          acceptanceTime: body.acceptanceTime ?? '09:00:00',
          departmentCode: body.departmentCode ?? '01',
          physicianCode: body.physicianCode ?? '1001',
          medicalInformation: body.medicalInformation ?? (isCancel ? '受付取消' : '外来受付'),
          patient: {
            patientId: patientId || '000000',
            name: 'MSW 患者',
            kana: 'エムエスダブリュ',
            birthDate: '1990-01-01',
            sex: 'F',
          },
        };
        await routed.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
          headers: {
            'x-run-id': response.runId,
            'x-trace-id': response.traceId,
          },
        });

        if (!isCancel && response.apiResult === '00' && response.acceptanceId) {
          registeredVisits = [
            {
              acceptanceId: response.acceptanceId,
              patientId: response.patient.patientId,
              acceptanceDate: response.acceptanceDate,
              acceptanceTime: response.acceptanceTime,
            },
            ...registeredVisits.filter((entry) => entry.acceptanceId !== response.acceptanceId),
          ];
        }
        if (isCancel && response.apiResult === '00') {
          registeredVisits = registeredVisits.filter((entry) => entry.acceptanceId !== response.acceptanceId);
        }
      }),
    );

    const fulfillJson = (route: any, body: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    await page.route('**/orca/deptinfo', (route) =>
      fulfillIfFetch(route, async (routed) => {
        await routed.fulfill({ status: 404, contentType: 'text/plain', body: '' });
      }),
    );

    await page.route('**/api/user/**', async (route) =>
      fulfillIfFetch(route, async (routed) => {
        await fulfillJson(routed, {
          facilityId: '1.3.6.1.4.1.9414.72.103',
          userId: 'doctor1',
          displayName: 'E2E Admin',
        });
      }),
    );
	    await page.route('**/api/orca/official/appointments/list**', (route) =>
	      fulfillIfFetch(route, (r) =>
	        fulfillJson(r, {
	          visitDate: '2026-01-20',
	          visits: registeredVisits.map((visit, index) => ({
	            sequentialNumber: `SEQ-${index + 1}`,
	            acceptanceId: visit.acceptanceId,
	            receptionId: visit.acceptanceId,
	            patient: {
	              patientId: visit.patientId,
	              wholeName: 'MSW 患者',
	              wholeNameKana: 'エムエスダブリュ',
	              birthDate: '1990-01-01',
	              sex: 'F',
	            },
	            appointmentTime: visit.acceptanceTime,
	            visitDate: visit.acceptanceDate,
	            departmentCode: '01',
	            physicianCode: '1001',
	            visitInformation: '01',
	          })),
	          apiResult: '00',
	          recordsReturned: registeredVisits.length,
	        }),
	      ),
	    );
	    await page.route('**/api/orca/official/visits/list**', (route) =>
	      fulfillIfFetch(route, (r) =>
	        fulfillJson(r, {
	          visitDate: '2026-01-20',
	          visits: registeredVisits.map((visit, index) => ({
	            sequentialNumber: `SEQ-${index + 1}`,
	            acceptanceId: visit.acceptanceId,
	            receptionId: visit.acceptanceId,
	            patient: {
	              patientId: visit.patientId,
	              wholeName: 'MSW 患者',
	              wholeNameKana: 'エムエスダブリュ',
	              birthDate: '1990-01-01',
	              sex: 'F',
	            },
	            appointmentTime: visit.acceptanceTime,
	            visitDate: visit.acceptanceDate,
	            departmentCode: '01',
	            physicianCode: '1001',
	            visitInformation: '01',
	          })),
	          apiResult: '00',
	          recordsReturned: registeredVisits.length,
	        }),
	      ),
	    );
    await page.route('**/orca/queue**', (route) =>
      fulfillIfFetch(route, (r) => fulfillJson(r, { queue: [], apiResult: '00' })),
    );
    await page.route('**/admin/**', (route) => fulfillIfFetch(route, (r) => fulfillJson(r, {})));
    await page.route('**/api01rv2/**', (route) => fulfillIfFetch(route, (r) => fulfillJson(r, {})));

    const facility = encodeURIComponent('1.3.6.1.4.1.9414.72.103');
    // MSW を有効化すると SW 側の fixture が先に応答し、page.route の stub と競合する。
    // この spec は stubbed routes で自己完結させるため、?msw=1 は付けない。
    // NOTE: 日付は固定し、一覧フィルタと stub の整合を保つ。
    await page.goto(`${baseUrl}/f/${facility}/reception?date=2026-01-20`);
    await expect(page.locator('[data-test-id="reception-accept"]')).toBeVisible({ timeout: 15_000 });
  });

  test('Api_Result=00 で受付登録がリストへ反映される', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    await page.context().tracing.start({ screenshots: true, snapshots: true });

    const entries = page.locator(receptionEntrySelector);
    const dataCountBefore = await entries.count();

    const acceptSection = page.locator('[data-test-id="reception-accept"]');
    await expect(acceptSection.locator('[data-test-id="reception-accept-details"]')).toHaveCount(0);
    await acceptSection.locator('#reception-patient-search-patient-id').fill('000123');
    await ensureAcceptRequiredSelections(acceptSection);

    const registerRequest = page.waitForRequest((request) => {
      if (!request.url().includes('/api/orca/official/visits/mutation')) return false;
      try {
        const body = JSON.parse(request.postData() ?? '{}') as Record<string, any>;
        return body.requestNumber === '01' && body.patientId === '000123';
      } catch {
        return false;
      }
    });

    await Promise.all([registerRequest, acceptSection.locator('[data-test-id="reception-accept-register"]').click()]);

    const registerBody = JSON.parse((await registerRequest).postData() ?? '{}') as Record<string, any>;
    expect(registerBody.requestNumber).toBe('01');
    expect(registerBody.patientId).toBe('000123');

    const banner = acceptSection.locator('.tone-banner--info');
    await expect(banner).toContainText(/受付登録が完了しました/);
    await expect(page.locator('[data-test-id="accept-api-result"]')).toContainText(/Api_Result:\s*(00|0000)/);

    const durationText = await page.locator('[data-test-id="accept-duration-ms"]').innerText();
    const durationMs = Number(durationText.replace(/\D+/g, ''));
    expect(durationMs).toBeLessThan(1000);
    const auditEvents = await page.evaluate(() => (window as any).__AUDIT_EVENTS__ ?? []);
    const receptionAudits = auditEvents.filter((event: any) => event?.payload?.action === 'reception_accept');
    const hasReceptionAudit = receptionAudits.length > 0;
    expect(hasReceptionAudit).toBeTruthy();
    fs.writeFileSync(
      path.join(artifactRoot, 'audit-reception_accept.json'),
      JSON.stringify(receptionAudits, null, 2),
      'utf8',
    );
    await expandReceptionSections(page);

    const newEntry = page.locator(receptionEntryByPatientSelector('000123')).first();
    await expect(newEntry).toBeVisible({ timeout: 10_000 });
    const dataCountAfter = await entries.count();
    expect(dataCountAfter).toBe(dataCountBefore + 1);

    // Charts へ遷移し runId / traceId を確認
    await newEntry.dblclick();
    await expect(page).toHaveURL(/charts/);
    const chartsMain = page.locator('.charts-page');
    await expect(chartsMain).toBeVisible({ timeout: 15_000 });
    const chartsRunId = await chartsMain.getAttribute('data-run-id');
    const chartsTraceId = await chartsMain.getAttribute('data-trace-id');
    const metaRunId = await page.locator('[data-test-id="charts-topbar-meta"]').getAttribute('data-run-id');
    const metaTraceId = await page.locator('[data-test-id="charts-topbar-meta"]').getAttribute('data-trace-id');
    expect(chartsRunId).toBe(metaRunId);
    expect(chartsTraceId).toBe(metaTraceId);
    expect(chartsRunId).toBeTruthy();
    expect(chartsTraceId).toBeTruthy();

    await page.screenshot({ path: path.join(artifactRoot, 'acceptmodv2-register.png'), fullPage: true });
    await page.context().tracing.stop({ path: path.join(artifactRoot, 'acceptmodv2-register-trace.zip') });
    fs.writeFileSync(path.join(artifactRoot, 'console-register.log'), consoleLogs.join('\n'), 'utf8');
  });

  test('Api_Result=21 は警告バナーを表示しリストは変更しない', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    await page.context().tracing.start({ screenshots: true, snapshots: true });

    const entries = page.locator(receptionEntrySelector);
    const dataCountBefore = await entries.count();

    const acceptSection = page.locator('[data-test-id="reception-accept"]');
    await acceptSection.locator('#reception-patient-search-patient-id').fill('00021');
    await ensureAcceptRequiredSelections(acceptSection);

    const warningRequest = page.waitForRequest((request) => {
      if (!request.url().includes('/api/orca/official/visits/mutation')) return false;
      try {
        const body = JSON.parse(request.postData() ?? '{}') as Record<string, any>;
        return body.requestNumber === '01' && body.patientId === '00021';
      } catch {
        return false;
      }
    });

    await Promise.all([warningRequest, acceptSection.locator('[data-test-id="reception-accept-register"]').click()]);

    const warning = acceptSection.locator('.tone-banner--warning').filter({ hasText: '受付なし' });
    await expect(warning).toBeVisible({ timeout: 10_000 });
    await expect(warning).toContainText(/受付なし/);
    const dataCountAfter = await entries.count();
    expect(dataCountAfter).toBe(dataCountBefore);

    await page.screenshot({ path: path.join(artifactRoot, 'acceptmodv2-api21.png'), fullPage: true });
    await page.context().tracing.stop({ path: path.join(artifactRoot, 'acceptmodv2-api21-trace.zip') });
    fs.writeFileSync(path.join(artifactRoot, 'console-api21.log'), consoleLogs.join('\n'), 'utf8');
  });

  test('受付取消(02)で件数が減る（取消は一覧選択から行う）', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));

    await page.context().tracing.start({ screenshots: true, snapshots: true });

    const acceptSection = page.locator('[data-test-id="reception-accept"]');

    // まず登録して1件増やす
    await acceptSection.locator('#reception-patient-search-patient-id').fill('000555');
    await ensureAcceptRequiredSelections(acceptSection);
    await acceptSection.locator('[data-test-id="reception-accept-register"]').click();
    await expect(acceptSection.locator('.tone-banner--info')).toContainText(/受付登録が完了しました/, { timeout: 10_000 });
    await expandReceptionSections(page);

    const entries = page.locator(receptionEntrySelector);
    const dataCountAfterRegister = await entries.count();

    const targetEntry = page.locator(receptionEntryByPatientAndStatusSelector('000555', '受付中')).first();
    await expect(targetEntry).toBeVisible({ timeout: 10_000 });
    await targetEntry.click();

    await clickCancelActionForEntry(page, targetEntry);
    const cancelModal = page.locator('[data-test-id="reception-cancel-confirm-modal"]');
    await expect(cancelModal).toBeVisible();

    const cancelRequest = page.waitForRequest((request) => {
      if (!request.url().includes('/api/orca/official/visits/mutation')) return false;
      try {
        const body = JSON.parse(request.postData() ?? '{}') as Record<string, any>;
        return body.requestNumber === '02' && body.patientId === '000555';
      } catch {
        return false;
      }
    });

    await Promise.all([cancelRequest, cancelModal.getByRole('button', { name: '取消を実行' }).click()]);
    const cancelBody = JSON.parse((await cancelRequest).postData() ?? '{}') as Record<string, any>;
    expect(cancelBody.requestNumber).toBe('02');
    expect(cancelBody.patientId).toBe('000555');
    expect(cancelBody.acceptanceId).toBeTruthy();

    await expect(acceptSection.locator('.tone-banner--info')).toContainText(/受付取消が完了しました/, { timeout: 10_000 });
    await expect(page.locator(receptionEntryByPatientSelector('000555'))).toHaveCount(0, {
      timeout: 10_000,
    });
    const dataCountAfterCancel = await entries.count();
    expect(dataCountAfterCancel).toBe(dataCountAfterRegister - 1);
    const cancelDurationText = await page.locator('[data-test-id="accept-duration-ms"]').innerText();
    const cancelDurationMs = Number(cancelDurationText.replace(/\D+/g, ''));
    expect(cancelDurationMs).toBeLessThan(1000);

    await page.screenshot({ path: path.join(artifactRoot, 'acceptmodv2-cancel.png'), fullPage: true });
    await page.context().tracing.stop({ path: path.join(artifactRoot, 'acceptmodv2-cancel-trace.zip') });
    fs.writeFileSync(path.join(artifactRoot, 'console-cancel.log'), consoleLogs.join('\n'), 'utf8');
  });
});
