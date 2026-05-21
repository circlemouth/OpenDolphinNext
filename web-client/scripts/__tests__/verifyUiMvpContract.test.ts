import { describe, expect, it } from 'vitest';

import {
  countVisibleSupportMetaExposures,
  scanFocusTrapDialogBackdropDefault,
  scanMobileImagesHeaderLeaks,
  scanRawOrcaBodyExposure,
  scanUndefinedCustomProperties,
  scanVisibleSupportMetaExposure,
} from '../verify-ui-mvp-contract.mjs';

describe('verify-ui-mvp-contract', () => {
  it('detects undefined CSS custom properties', () => {
    const findings = scanUndefinedCustomProperties([
      {
        relativePath: 'web-client/src/styles/test.css',
        content: ':root { --ui-defined: #fff; } .card { color: var(--ui-defined); border-color: var(--ui-missing); }',
      },
    ]);

    expect(findings).toEqual([
      {
        file: 'web-client/src/styles/test.css',
        reason: 'undefined CSS custom property --ui-missing',
      },
    ]);
  });

  it('accepts React style object definitions and var() fallbacks', () => {
    const findings = scanUndefinedCustomProperties([
      {
        relativePath: 'web-client/src/page.tsx',
        content: `
          const layoutStyle = { '--charts-utility-left': '24px' };
          const css = '.drawer { left: var(--charts-utility-left); width: var(--patients-sidebar-width, 380px); }';
        `,
      },
    ]);

    expect(findings).toEqual([]);
  });

  it('rejects FocusTrapDialog when backdrop close becomes the default again', () => {
    const findings = scanFocusTrapDialogBackdropDefault({
      relativePath: 'web-client/src/components/modals/FocusTrapDialog.tsx',
      content: 'export function FocusTrapDialog({ closeOnBackdrop = true }) { return null; }',
    });

    expect(findings[0]?.reason).toContain('closeOnBackdrop defaulted to false');
  });

  it('caps visible RUN_ID / traceId / requestId copy in normal UI files', () => {
    const baselineFiles = [
      'web-client/src/AppRouter.tsx',
      'web-client/src/features/reception/components/ReceptionAuditPanel.tsx',
      'web-client/src/features/reception/components/ToneBanner.tsx',
      'web-client/src/features/patients/PatientsPage.tsx',
      'web-client/src/features/charts/ChartsActionBar.tsx',
      'web-client/src/features/charts/OrcaSummary.tsx',
      'web-client/src/features/charts/PatientsTab.tsx',
      'web-client/src/features/administration/MasterVisibilityPanel.tsx',
      'web-client/src/features/administration/MasterUpdatesPanel.tsx',
    ];
    const findings = scanVisibleSupportMetaExposure(
      baselineFiles.map((relativePath) => ({
        relativePath,
        content: relativePath === 'web-client/src/AppRouter.tsx' ? Array.from({ length: 9 }, () => '<p>RUN_ID: visible</p>').join('\n') : '',
      })),
    );

    expect(findings).toEqual([
      {
        file: 'web-client/src/AppRouter.tsx',
        reason: 'visible RUN_ID/traceId/requestId exposure cap exceeded (9 > 8)',
      },
    ]);
  });

  it('detects raw ORCA body wording in production UI sources', () => {
    const findings = scanRawOrcaBodyExposure([
      {
        relativePath: 'web-client/src/features/reception/pages/ReceptionPage.tsx',
        content: '<p>raw ORCA body を表示します</p>',
      },
    ]);

    expect(findings[0]?.reason).toContain('raw ORCA body wording');
  });

  it('rejects Mobile Images support identifiers in the patient header source', () => {
    const findings = scanMobileImagesHeaderLeaks({
      relativePath: 'web-client/src/features/images/pages/MobileImagesUploadPage.tsx',
      content: `
        <PatientIdentityBar internalPatientId={internalPatientId} encounterKey={encounterKey} />
        <button>RUN_ID をコピー</button>
      `,
    });

    expect(findings.map((finding) => finding.reason)).toEqual(
      expect.arrayContaining([
        'Mobile Images patient header must not pass internalPatientId into PatientIdentityBar',
        'Mobile Images patient header must not pass encounterKey into PatientIdentityBar',
        'Mobile Images normal header must not expose RUN_ID/traceId/requestId copy',
      ]),
    );
  });

  it('counts only visible support meta patterns, not traceId object keys', () => {
    const source = `
      const payload = { traceId: meta.traceId, requestId: meta.requestId };
      <StatusPill label="traceId" value="abc" />
      <p>traceId: abc</p>
    `;

    expect(countVisibleSupportMetaExposures(source)).toBe(2);
  });
});
