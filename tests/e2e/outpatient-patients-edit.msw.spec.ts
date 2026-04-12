import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '../playwright/fixtures';
import { baseUrl, e2eAuthSession, seedAuthSession } from './helpers/orcaMaster';
import { OUTPATIENT_PATIENTS, type OutpatientFlagSet } from '../../web-client/src/mocks/fixtures/outpatient';

const RUN_ID = process.env.RUN_ID ?? '20260204T132654Z-patients-edit';
process.env.RUN_ID ??= RUN_ID;

const artifactDir =
  process.env.PLAYWRIGHT_ARTIFACT_DIR
    ? path.join(process.env.PLAYWRIGHT_ARTIFACT_DIR, 'patients-edit')
    : path.join(process.cwd(), 'artifacts', 'verification', RUN_ID, 'patients-edit');

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

test('Patients 検索→詳細→編集→保存→再表示 (MSW)', async ({ page }) => {
  fs.mkdirSync(artifactDir, { recursive: true });

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

  await page.addInitScript(
    ({ headers, flags, initialPatients }) => {
      let patientsState = Array.isArray(initialPatients)
        ? initialPatients.map((entry) => ({ ...entry }))
        : [];
      (window as any).__PATIENTS_EDIT_LAST_PAYLOAD__ = null;

      const buildPatientResponse = (endpoint: string) => {
        const now = new Date().toISOString();
        return {
          patients: patientsState,
          runId: flags.runId,
          cacheHit: flags.cacheHit,
          missingMaster: flags.missingMaster,
          dataSourceTransition: flags.dataSourceTransition,
          fallbackUsed: flags.fallbackUsed,
          fetchedAt: now,
          recordsReturned: patientsState.length,
          status: 200,
          apiResult: '00',
          apiResultMessage: '処理終了',
          auditEvent: {
            runId: flags.runId,
            endpoint,
            recordedAt: now,
            details: {
              runId: flags.runId,
              dataSourceTransition: flags.dataSourceTransition,
              cacheHit: flags.cacheHit,
              missingMaster: flags.missingMaster,
              fallbackUsed: flags.fallbackUsed,
              fetchedAt: now,
              recordsReturned: patientsState.length,
            },
          },
        };
      };

      const updatePatientState = (payload: Record<string, any>, operation: string) => {
        const patientId = payload.patientId ? String(payload.patientId) : '';
        if (!patientId) return null;
        if (operation === 'delete') {
          patientsState = patientsState.filter((item) => String(item.patientId) !== patientId);
          return null;
        }
        const index = patientsState.findIndex((item) => String(item.patientId) === patientId);
        const next = { ...(index >= 0 ? patientsState[index] : {}), ...payload, patientId } as Record<string, any>;
        if (index >= 0) {
          patientsState[index] = next as any;
        } else {
          patientsState.unshift(next as any);
        }
        return next;
      };

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const request = new Request(input as RequestInfo, init as RequestInit);
        const url = request.url;

        if (url.includes('/api/local/patients/search')) {
          const endpoint = url.includes('/mock') ? '/api/local/patients/search/mock' : '/api/local/patients/search';
          return new Response(JSON.stringify(buildPatientResponse(endpoint)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.includes('/api/local/patients/mutation')) {
          const endpoint = url.includes('/mock')
            ? '/api/local/patients/mutation/mock'
            : '/api/local/patients/mutation';
          let body: Record<string, any> = {};
          try {
            const text = await request.clone().text();
            body = text ? (JSON.parse(text) as Record<string, any>) : {};
          } catch {
            body = {};
          }
          const payload =
            body.patient && typeof body.patient === 'object' ? (body.patient as Record<string, any>) : body;
          if (payload.memoText && !payload.memo) payload.memo = payload.memoText;
          if (payload.Patient_Memo && !payload.memo) payload.memo = payload.Patient_Memo;
          const operation = (body.operation ?? payload.operation ?? 'update') as string;
          const updated = updatePatientState(payload, operation);
          (window as any).__PATIENTS_EDIT_LAST_PAYLOAD__ = { endpoint, body, payload };

          return new Response(
            JSON.stringify({
              runId: flags.runId,
              cacheHit: flags.cacheHit,
              missingMaster: flags.missingMaster,
              dataSourceTransition: flags.dataSourceTransition,
              fallbackUsed: flags.fallbackUsed,
              apiResultMessage: '保存しました',
              patient: updated,
              auditEvent: {
                action: 'LOCAL_PATIENT_MUTATION',
                outcome: 'success',
                runId: flags.runId,
                details: {
                  operation,
                  patientId: updated?.patientId ?? payload.patientId,
                  status: 200,
                  sourcePath: endpoint,
                },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
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
    },
    {
      headers: {
        'x-msw-missing-master': '0',
        'x-msw-transition': 'server',
        'x-msw-cache-hit': '0',
        'x-msw-fallback-used': '0',
        'x-msw-run-id': RUN_ID,
      },
      flags: {
        runId: RUN_ID,
        cacheHit: false,
        missingMaster: false,
        dataSourceTransition: 'server',
        fallbackUsed: false,
      },
      initialPatients: OUTPATIENT_PATIENTS,
    },
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
      window.sessionStorage.setItem(storageKey, JSON.stringify({ sessionKey, flags, updatedAt: new Date().toISOString() }));
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

  await page.goto(`${baseUrl}/patients?msw=1`);
  await expect(page.getByRole('heading', { name: '患者管理' })).toBeVisible();

  await page.locator('#patients-filter-keyword').fill('000001');
  await page.locator('#patients-filter-department').fill('内科');
  await page.locator('#patients-filter-physician').fill('藤井');
  await page.locator('#patients-filter-payment-mode').selectOption('insurance');

  await page.getByRole('button', { name: '検索を更新' }).click();

  await expect(page.locator('#patients-filter-keyword')).toHaveValue('000001');
  await expect(page.locator('#patients-filter-department')).toHaveValue('内科');
  await expect(page.locator('#patients-filter-physician')).toHaveValue('藤井');
  await expect(page.locator('#patients-filter-payment-mode')).toHaveValue('insurance');

  const targetRow = page.locator('.patients-page__row').filter({ hasText: '000001' }).first();
  await expect(targetRow).toBeVisible();
  await targetRow.click();

  await expect(page.locator('#patients-form-patientId')).toHaveValue('000001');
  await expect(page.locator('#patients-form-name')).toHaveValue('山田 花子');

  const phoneField = page.locator('#patients-form-phone');
  const newPhone = '03-9999-0001';
  await phoneField.fill(newPhone);
  await expect(phoneField).toHaveValue(newPhone);

  await page.locator('.patients-page__form').screenshot({ path: path.join(artifactDir, 'patients-edit-input.png') });

  await page.locator('.patients-page__form').getByRole('button', { name: '既存患者更新を実行' }).click();

  await expect(page.locator('.patients-page__toast')).toContainText('保存しました');
  const payloadLog = await page.evaluate(() => (window as any).__PATIENTS_EDIT_LAST_PAYLOAD__);
  if (payloadLog) {
    fs.writeFileSync(path.join(artifactDir, 'patients-edit-save-payload.json'), JSON.stringify(payloadLog, null, 2));
  }
  await expect(phoneField).toHaveValue(newPhone);

  await page.locator('.patients-page__form').screenshot({ path: path.join(artifactDir, 'patients-edit-saved.png') });

  const otherRow = page.locator('.patients-page__row').filter({ hasText: '000002' }).first();
  await otherRow.click();
  await targetRow.click();
  await expect(phoneField).toHaveValue(newPhone);

  await page.locator('.patients-page__form').screenshot({ path: path.join(artifactDir, 'patients-edit-reopen.png') });

  writeNote(
    'qa-patients-edit.md',
    [
      '# Patients 検索/編集 検証ログ',
      '',
      `- RUN_ID: ${RUN_ID}`,
      '- 画面: Patients（患者一覧と編集）',
      '- 目的: 検索→詳細→編集→保存→再表示の主要フローを確認',
      '',
      '## 実施内容',
      '- 検索条件: キーワード=000001 / 診療科=内科 / 担当医=藤井 / 保険=保険',
      '- 患者詳細: 000001 山田 花子 を選択',
      `- 編集: 電話番号を「${newPhone}」へ更新`,
      '- 保存: 保存後に一覧再取得が走り、フォーム値が保持されることを確認',
      '- 再表示: 000002 を選択後、再度 000001 を選択し電話番号が保持されることを確認',
      '',
      '## 結果',
      '- 検索条件入力/保存の基本動作は OK（入力値保持）',
      '- 保存トースト表示 OK',
      '- 再表示で電話番号の更新内容が保持されることを確認',
      '',
      '## 証跡',
      '- patients-edit-input.png',
      '- patients-edit-saved.png',
      '- patients-edit-reopen.png',
    ].join('\n'),
  );
});
