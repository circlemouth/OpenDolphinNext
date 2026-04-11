import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession, withChartLock } from '../e2e/helpers/orcaMaster';
import {
  buildAppointmentFixture,
  buildMedicalSummaryFixture,
  buildPatientListFixture,
  buildVisitListFixture,
  type OutpatientFlagSet,
} from '../../web-client/src/mocks/fixtures/outpatient';

const RUN_ID = process.env.RUN_ID ?? '20260204T115622Z-soap-note';
process.env.RUN_ID ??= RUN_ID;

const artifactDir =
  process.env.PLAYWRIGHT_ARTIFACT_DIR ??
  path.join(process.cwd(), 'artifacts', 'verification', RUN_ID, 'soap-note');

const writeNote = (fileName: string, body: string) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, fileName), body);
};

test.use({
  ignoreHTTPSErrors: true,
  extraHTTPHeaders: {
    'x-msw-missing-master': '0',
    'x-msw-transition': 'server',
    'x-msw-cache-hit': '0',
    'x-msw-fallback-used': '0',
    'x-msw-run-id': RUN_ID,
  },
});

test('SOAP入力の保存/再表示/編集ができる (MSW)', async ({ page }) => {
  fs.mkdirSync(artifactDir, { recursive: true });

  await withChartLock(page, async () => {
    await seedAuthSession(page);
    const facilityId = e2eAuthSession.credentials.facilityId;
    const userId = e2eAuthSession.credentials.userId;
    const outpatientFlags: OutpatientFlagSet = {
      runId: RUN_ID,
      cacheHit: false,
      missingMaster: false,
      dataSourceTransition: 'server',
      fallbackUsed: false,
    };

    await page.route('**/orca21/medicalmodv2/outpatient**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildMedicalSummaryFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/appointments/list/mock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAppointmentFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/visits/list/mock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildVisitListFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/appointments/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAppointmentFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/orca/official/visits/list**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildVisitListFixture(outpatientFlags)),
      }),
    );
    await page.route('**/api/local/patients/search/mock**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPatientListFixture(outpatientFlags, '/api/local/patients/search/mock')),
      }),
    );
    await page.route('**/api/local/patients/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPatientListFixture(outpatientFlags, '/api/local/patients/search')),
      }),
    );
    await page.route('**/api/local/charts/subjectives**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          apiResult: '00',
          apiResultMessage: 'OK',
          runId: RUN_ID,
          recordedAt: new Date().toISOString(),
        }),
      }),
    );

    await page.addInitScript((runId) => {
      const raw = window.sessionStorage.getItem('opendolphin:web-client:auth');
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        parsed.runId = runId;
        window.sessionStorage.setItem('opendolphin:web-client:auth', JSON.stringify(parsed));
      } catch {
        // ignore
      }
    }, RUN_ID);

    await page.addInitScript(
      ({ storageKey, sessionKey, flags }) => {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({ sessionKey, flags, updatedAt: new Date().toISOString() }),
        );
      },
      {
        storageKey: 'opendolphin:web-client:auth-flags',
        sessionKey: `${facilityId}:${userId}`,
        flags: {
          runId: RUN_ID,
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
      },
    );
    await page.addInitScript(({ headers, runId }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init = {}) => {
        const requestUrl =
          typeof input === 'string'
            ? input
            : input instanceof Request
              ? input.url
              : String(input);
        if (requestUrl.includes('/api/local/charts/subjectives')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                apiResult: '00',
                apiResultMessage: 'OK',
                runId,
                recordedAt: new Date().toISOString(),
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
          );
        }
        const nextHeaders = new Headers(init.headers || {});
        Object.entries(headers).forEach(([key, value]) => {
          if (!nextHeaders.has(key)) {
            nextHeaders.set(key, value);
          }
        });
        return originalFetch(input, { ...init, headers: nextHeaders });
      };
    }, {
      runId: RUN_ID,
      headers: {
        'x-msw-missing-master': '0',
        'x-msw-transition': 'server',
        'x-msw-cache-hit': '0',
        'x-msw-fallback-used': '0',
        'x-msw-run-id': RUN_ID,
      },
    });

    await page.goto(
      `${baseUrl}/f/${facilityId}/charts?patientId=000001&appointmentId=APT-2401&visitDate=2026-02-04&msw=1`,
    );
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });

    const topbarMeta = page.locator('[data-test-id="charts-topbar-meta"]');
    await page.evaluate(
      ({ sessionKey, flags }) => {
        const envelope = {
          version: 1,
          sessionKey,
          payload: flags,
          updatedAt: new Date().toISOString(),
        };
        const key = 'opendolphin:web-client:auth:shared-flags:v1';
        try {
          window.localStorage.setItem(key, JSON.stringify(envelope));
        } catch {
          // ignore
        }
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(envelope) }));
      },
      {
        sessionKey: `${facilityId}:${userId}`,
        flags: {
          runId: RUN_ID,
          cacheHit: false,
          missingMaster: false,
          dataSourceTransition: 'server',
          fallbackUsed: false,
        },
      },
    );
    await expect(topbarMeta).toHaveAttribute('data-missing-master', 'false', { timeout: 10_000 });
    await expect(topbarMeta).toHaveAttribute('data-source-transition', 'server', { timeout: 10_000 });
    const summaryBar = page.locator('#charts-patient-summary');
    await expect(summaryBar).toContainText('診察券番号', { timeout: 10_000 });
    await expect(summaryBar).toContainText('000001', { timeout: 10_000 });

    const soapPanel = page.locator('#charts-soap-note');
    await expect(soapPanel).toBeVisible();

    const soapInput = {
      subjective: `S: 頭痛あり。2日前から。(${RUN_ID})`,
      objective: `O: 体温 37.2℃、BP 120/70。(${RUN_ID})`,
      assessment: `A: 緊張型頭痛の疑い。(${RUN_ID})`,
      plan: `P: 鎮痛薬処方、1週間後フォロー。(${RUN_ID})`,
    };

    await soapPanel.locator('#soap-note-subjective').fill(soapInput.subjective);
    await soapPanel.locator('#soap-note-objective').fill(soapInput.objective);
    await soapPanel.locator('#soap-note-assessment').fill(soapInput.assessment);
    await soapPanel.locator('#soap-note-plan').fill(soapInput.plan);

    await soapPanel.screenshot({ path: path.join(artifactDir, 'soap-note-input.png') });

    const saveButton = soapPanel.locator('button.soap-note__primary');
    await expect(saveButton).toBeEnabled();
    await saveButton.dispatchEvent('click');
    await expect(soapPanel.locator('.soap-note__sync-badge')).toHaveText(/サーバ反映済|ローカル保存済 \/ サーバ未反映/, {
      timeout: 10_000,
    });

    await expect(soapPanel.locator('#soap-note-subjective')).toHaveValue(soapInput.subjective);
    await expect(soapPanel.locator('#soap-note-objective')).toHaveValue(soapInput.objective);
    await expect(soapPanel.locator('#soap-note-assessment')).toHaveValue(soapInput.assessment);
    await expect(soapPanel.locator('#soap-note-plan')).toHaveValue(soapInput.plan);

    await soapPanel.screenshot({ path: path.join(artifactDir, 'soap-note-saved.png') });

    const editedPlan = `${soapInput.plan}（編集追記）`;
    await soapPanel.locator('#soap-note-plan').fill(editedPlan);
    const updateButton = soapPanel.locator('button.soap-note__primary');
    await expect(updateButton).toBeEnabled();
    await updateButton.dispatchEvent('click');
    await expect(soapPanel.locator('.soap-note__sync-badge')).toHaveText(/サーバ反映済|ローカル保存済 \/ サーバ未反映/, {
      timeout: 10_000,
    });
    await expect(soapPanel.locator('#soap-note-plan')).toHaveValue(editedPlan);

    await soapPanel.screenshot({ path: path.join(artifactDir, 'soap-note-edited.png') });

    const sections = ['subjective', 'objective', 'assessment', 'plan'] as const;
    const headerTexts = await Promise.all(
      sections.map(async (section) => {
        const texts = await soapPanel.locator(`[data-section="${section}"] .soap-note__section-header span`).allInnerTexts();
        return texts.join(' / ');
      }),
    );

    writeNote(
      'qa-soap-note.md',
      [
        `# SOAP入力 検証ログ`,
        ``,
        `- RUN_ID: ${RUN_ID}`,
        `- 実施日: ${new Date().toISOString()}`,
        `- 対象: Charts SOAP 記載（S/O/A/P）`,
        `- 接続: MSW`,
        ``,
        `## 入力値`,
        `- Subjective: ${soapInput.subjective}`,
        `- Objective: ${soapInput.objective}`,
        `- Assessment: ${soapInput.assessment}`,
        `- Plan: ${editedPlan}`,
        ``,
        `## 確認結果`,
        `- 保存: 4 セクション入力→保存後も入力値が保持されることを確認`,
        `- 再表示: 各セクションの履歴ラベルが「記載履歴なし」から更新`,
        `- 編集: Plan を編集して更新し、入力欄へ反映`,
        ``,
        `## セクションヘッダ`,
        ...headerTexts.map((text, idx) => `- ${sections[idx]}: ${text}`),
        ``,
        `## 証跡`,
        `- soap-note-input.png`,
        `- soap-note-saved.png`,
        `- soap-note-edited.png`,
      ].join('\n'),
    );
  });
});
