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

// CHART-010/020 regression guard (compact header/ui flags)
// Definition (compact flags ON):
// - At 1366x768, immediately after opening Charts, SOAP textarea (#soap-note-free) is visible in viewport.
// - Draft save button (#charts-action-draft) is visible in viewport and clickable.
const RUN_ID = process.env.RUN_ID ?? '20260207T000000Z-charts-compact-visibility';
process.env.RUN_ID ??= RUN_ID;

const LABEL = process.env.CHARTS_VIS_LABEL ?? 'unknown';
const artifactDir =
  process.env.PLAYWRIGHT_ARTIFACT_DIR ??
  path.join(process.cwd(), 'artifacts', 'verification', RUN_ID, 'chart-010-020-compact-visibility');

const writeNote = (fileName: string, body: string) => {
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, fileName), body);
};

test.use({
  viewport: { width: 1366, height: 768 },
  ignoreHTTPSErrors: true,
  extraHTTPHeaders: {
    'x-msw-missing-master': '0',
    'x-msw-transition': 'server',
    'x-msw-cache-hit': '0',
    'x-msw-fallback-used': '0',
    'x-msw-run-id': RUN_ID,
  },
});

test('CHART-010/020: compact flags下でもSOAP/ドラフト保存が可視で操作できる (MSW)', async ({ page }) => {
  fs.mkdirSync(artifactDir, { recursive: true });

  await withChartLock(page, async () => {
    await seedAuthSession(page);
    const facilityId = e2eAuthSession.credentials.facilityId;
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

    await page.goto(`${baseUrl}/f/${facilityId}/charts?patientId=000001&visitDate=2026-01-21&msw=1`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('.charts-page')).toBeVisible({ timeout: 20_000 });

    // Mask potentially sensitive identifiers for screenshots.
    await page.addStyleTag({
      content: `
        .charts-patient-summary, .patients-tab__table, .patients-tab__history-row { filter: blur(6px) saturate(0.8); }
        #charts-soap-note, #charts-actionbar { filter: none; }
      `,
    });

    const compactHeader = (await page.locator('.charts-page').getAttribute('data-charts-compact-header')) ?? '0';
    const compactUi = (await page.locator('.charts-workbench').getAttribute('data-charts-compact-ui')) ?? '0';
    const topbarCollapsed = (await page.locator('.charts-page').getAttribute('data-charts-topbar-collapsed')) ?? '0';

    // CHART-010: SOAP editor visible/usable.
    const soapTextarea = page.locator('#soap-note-free');
    await expect(soapTextarea).toBeVisible({ timeout: 20_000 });
    await expect(soapTextarea).toBeEditable();

    // CHART-020: Draft save action visible/usable.
    const draftButton = page.locator('#charts-action-draft');
    await expect(draftButton).toBeVisible({ timeout: 20_000 });
    await expect(draftButton).toBeEnabled();

    const before = await page.evaluate(() => {
      const snap = (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return { found: false as const };
        const rect = el.getBoundingClientRect();
        return {
          found: true as const,
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        };
      };
      return {
        compactHeader: document.querySelector('.charts-page')?.getAttribute('data-charts-compact-header') ?? '0',
        compactUi: document.querySelector('.charts-workbench')?.getAttribute('data-charts-compact-ui') ?? '0',
        topbarCollapsed: document.querySelector('.charts-page')?.getAttribute('data-charts-topbar-collapsed') ?? '0',
        soap: snap('#soap-note-free'),
        draft: snap('#charts-action-draft'),
      };
    });

    // Strict viewport constraints only apply when compact header mode is enabled.
    if (compactHeader === '1') {
      expect(before.soap.found).toBe(true);
      expect(before.draft.found).toBe(true);
      // "Visible in viewport" (no scroll): element intersects the viewport.
      expect((before.soap as any).top).toBeLessThan((before.soap as any).innerHeight);
      expect((before.soap as any).bottom).toBeGreaterThan(0);
      expect((before.draft as any).top).toBeLessThan((before.draft as any).innerHeight);
      expect((before.draft as any).bottom).toBeGreaterThan(0);
    } else {
      // Non-compact mode: still must be usable, but may require scroll depending on layout.
      await soapTextarea.scrollIntoViewIfNeeded();
      await draftButton.scrollIntoViewIfNeeded();
    }

    await soapTextarea.fill(`compact-visibility ${RUN_ID} ${LABEL}`);
    await draftButton.click();
    // Draft save should render a completion message (it may be visually hidden in compact mode).
    await expect(page.getByText('ドラフト保存を完了')).toBeAttached();

    const after = await page.evaluate(() => {
      const snap = (selector: string) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return { found: false as const };
        const rect = el.getBoundingClientRect();
        return {
          found: true as const,
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        };
      };
      const audit = (window as any).__AUDIT_EVENTS__ as Array<Record<string, any>> | undefined;
      return {
        soap: snap('#soap-note-free'),
        draft: snap('#charts-action-draft'),
        auditEvents: Array.isArray(audit) ? audit.slice(-5) : [],
      };
    });

    writeNote(
      `meta-${LABEL}.json`,
      JSON.stringify(
        {
          runId: RUN_ID,
          label: LABEL,
          compactHeader,
          compactUi,
          topbarCollapsed,
          before,
          after,
        },
        null,
        2,
      ),
    );

    await page.screenshot({
      path: path.join(artifactDir, `charts-compact-visibility-${LABEL}-full.png`),
      fullPage: true,
    });
  });
});
