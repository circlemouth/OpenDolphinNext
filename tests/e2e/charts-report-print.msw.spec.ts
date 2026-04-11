import { test, expect, type Page, type Route } from '../playwright/fixtures';
import { profile } from './helpers/orcaMaster';

const RUN_ID = process.env.RUN_ID ?? '20260113T210214Z';
process.env.RUN_ID ??= RUN_ID;

async function prepareSession(page: Page) {
  const facilityId = 'FAC-PRINT';
  const userId = 'doctor-print';

  await page.addInitScript(({ facilityId, userId, runId }) => {
    const session = {
      facilityId,
      userId,
      displayName: 'E2E Doctor',
      clientUuid: 'e2e-print',
      runId,
      role: 'doctor',
      roles: ['doctor'],
    };
    window.sessionStorage.setItem('opendolphin:web-client:auth', JSON.stringify(session));
    window.localStorage.setItem('devFacilityId', facilityId);
    window.localStorage.setItem('devUserId', userId);
    window.localStorage.setItem('devPasswordMd5', 'e2e');
    window.localStorage.setItem('devClientUuid', 'e2e-print');
    window.localStorage.setItem('devRole', 'doctor');
    if (!(window as unknown as { $RefreshReg$?: unknown }).$RefreshReg$) {
      (window as unknown & { $RefreshReg$?: () => void }).$RefreshReg$ = () => {};
    }
    if (!(window as unknown as { $RefreshSig$?: unknown }).$RefreshSig$) {
      (window as unknown & { $RefreshSig$?: () => (type: unknown) => unknown }).$RefreshSig$ = () => (type) => type;
    }
  }, { facilityId, userId, runId: RUN_ID });

  await page.route('**/api/user/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        facilityId,
        userId,
        displayName: 'E2E Doctor',
        role: 'doctor',
      }),
    }),
  );

  await page.goto(`/f/${encodeURIComponent(facilityId)}/reception?msw=1`);
  await page.waitForURL('**/reception**', { timeout: 15_000 });
}

async function mockOutpatientEndpoints(page: Page) {
  const meta = {
    runId: RUN_ID,
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server',
    recordsReturned: 1,
    fetchedAt: new Date().toISOString(),
  };

  const appointmentPayload = {
    appointmentDate: '2026-01-13',
    slots: [
      {
        appointmentId: 'APT-PRINT-1',
        appointmentTime: '0910',
        departmentName: '内科',
        physicianName: '医師',
        patient: {
          patientId: '000001',
          wholeName: '山田 花子',
          wholeNameKana: 'ヤマダ ハナコ',
          birthDate: '1985-04-12',
          sex: 'F',
        },
        visitInformation: '帳票テスト',
        medicalInformation: '帳票テスト',
      },
    ],
    reservations: [],
    ...meta,
  };

  const visitPayload = {
    visitDate: '2026-01-13',
    visits: [],
    ...meta,
  };

  await page.route('**/api/orca/official/appointments/list**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(appointmentPayload),
    }),
  );

  await page.route('**/api/orca/official/visits/list**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(visitPayload),
    }),
  );

  await page.route('**/orca21/medicalmodv2/outpatient**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...meta,
        outpatientList: [{}],
        apiResultMessage: 'ok',
      }),
    }),
  );

  await page.route('**/api01rv2/incomeinfv2**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/xml',
      body: `<?xml version="1.0" encoding="UTF-8"?>
<xmlio2>
  <private_objects type="record">
    <Information_Date type="string">2026-01-13</Information_Date>
    <Information_Time type="string">12:00:00</Information_Time>
    <Api_Result type="string">0000</Api_Result>
    <Api_Result_Message type="string">処理終了</Api_Result_Message>
    <Income_Information type="array">
      <Income_Information_child type="record">
        <Perform_Date type="string">2026-01-13</Perform_Date>
        <Invoice_Number type="string">0002375</Invoice_Number>
        <Insurance_Combination_Number type="string">0001</Insurance_Combination_Number>
        <Department_Name type="string">内科</Department_Name>
      </Income_Information_child>
    </Income_Information>
  </private_objects>
</xmlio2>`,
    }),
  );
}

async function mockReportEndpoints(page: Page) {
  await page.route('**/api01rv2/prescriptionv2', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'X-Run-Id': RUN_ID },
      contentType: 'application/json',
      body: JSON.stringify({
        prescriptionv2res: {
          Api_Result: '0000',
          Api_Result_Message: '処理終了',
          Data_Id: 'DATA-PRINT-1',
        },
      }),
    }),
  );

  const pdfBody = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<<>>\nstartxref\n0\n%%EOF',
    'utf-8',
  );
  await page.route('**/blobapi/**', (route: Route) =>
    route.fulfill({
      status: 200,
      headers: { 'X-Run-Id': RUN_ID },
      contentType: 'application/pdf',
      body: pdfBody,
    }),
  );
}

test.describe('Charts report print (MSW)', () => {
  test.skip(profile !== 'msw', 'MSW プロファイル専用');

  test('帳票出力→blobapi PDFプレビューまで到達し、runId を監査ログに残す', async ({ page }) => {
    test.setTimeout(60_000);
    await mockOutpatientEndpoints(page);
    await mockReportEndpoints(page);
    await prepareSession(page);

    const row = page.getByRole('row', { name: /山田\s*花子/ });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.dblclick();
    await expect(page).toHaveURL(/charts/);

    await page.getByRole('button', { name: '印刷/エクスポート' }).click();
    const dialog = page.getByRole('dialog', { name: '印刷/帳票出力の確認' });
    await expect(dialog).toBeVisible();

    await page.getByLabel('帳票種別').selectOption('prescription');
    await page.getByLabel('伝票番号（Invoice_Number）*').fill('0002375');
    await dialog.getByRole('button', { name: '開く' }).click();

    await page.waitForURL(/charts\/print\/document/);
    await expect(page.getByText('処方箋 PDFプレビュー')).toBeVisible();
    await expect(page.getByText('Data_Id=DATA-PRINT-1')).toBeVisible();
    await expect(page.locator('.charts-print__pdf-preview iframe')).toBeVisible({ timeout: 10_000 });

    await page.waitForFunction(
      () =>
        Array.isArray((window as any).__AUDIT_EVENTS__) &&
        (window as any).__AUDIT_EVENTS__.some((entry: any) => entry?.payload?.action === 'ORCA_REPORT_PRINT'),
    );

    const auditEvents = await page.evaluate(() => (window as any).__AUDIT_EVENTS__);
    const reportEvent = auditEvents.find((entry: any) => entry?.payload?.action === 'ORCA_REPORT_PRINT');
    expect(reportEvent).toBeTruthy();
    expect(reportEvent.runId).toBe(RUN_ID);
  });
});
