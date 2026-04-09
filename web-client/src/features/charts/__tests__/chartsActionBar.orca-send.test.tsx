// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChartsActionBar } from '../ChartsActionBar';
import { postOrcaMedicalModV2Xml } from '../orcaClaimApi';
import { fetchOrderBundles } from '../orderBundleApi';
import { getOrcaClaimSendEntry } from '../orcaClaimSendCache';
import { buildEmptyPrescriptionOrder, fetchPrescriptionOrder } from '../prescriptionOrderApi';
import type { ReceptionEntry } from '../../reception/api';

vi.mock('../../../AppRouter', () => ({
  useOptionalSession: () => ({
    facilityId: 'F-1',
    userId: 'U-1',
    role: 'doctor',
  }),
}));

vi.mock('../../../routes/useAppNavigation', () => ({
  useAppNavigation: () => ({
    currentUrl: '/f/F-1/charts',
    currentScreen: 'charts',
    fromCandidate: undefined,
    returnToCandidate: undefined,
    safeReturnToCandidate: undefined,
    carryover: {},
    external: {},
    encounter: {},
    openReception: vi.fn(),
    openPatients: vi.fn(),
    openCharts: vi.fn(),
    openOrderSets: vi.fn(),
    openPrintOutpatient: vi.fn(),
    openPrintDocument: vi.fn(),
    openMobileImages: vi.fn(),
  }),
}));

vi.mock('../orcaClaimApi', async () => {
  const actual = await vi.importActual<typeof import('../orcaClaimApi')>('../orcaClaimApi');
  return {
    ...actual,
    postOrcaMedicalModV2Xml: vi.fn(),
    buildMedicalModV2RequestXml: vi.fn(actual.buildMedicalModV2RequestXml),
  };
});

vi.mock('../orcaMedicalModApi', () => ({
  buildMedicalModV23RequestXml: vi.fn().mockReturnValue('<data></data>'),
  postOrcaMedicalModV23Xml: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    apiResult: '00',
    rawXml: '<xml></xml>',
    missingTags: [],
  }),
}));

vi.mock('../orderBundleApi', async () => {
  const actual = await vi.importActual<typeof import('../orderBundleApi')>('../orderBundleApi');
  return {
    ...actual,
    fetchOrderBundles: vi.fn().mockResolvedValue({ ok: true, bundles: [] }),
  };
});

vi.mock('../prescriptionOrderApi', async () => {
  const actual = await vi.importActual<typeof import('../prescriptionOrderApi')>('../prescriptionOrderApi');
  return {
    ...actual,
    fetchPrescriptionOrder: vi.fn(),
  };
});

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../audit', () => ({
  recordChartsAuditEvent: vi.fn(),
}));

const baseProps = {
  runId: 'RUN-CLAIM',
  cacheHit: false,
  missingMaster: false,
  dataSourceTransition: 'server' as const,
  fallbackUsed: false,
};

const buildInjectionAdminCode = (suffix: 1 | 3) => `410${suffix}`;
const NON_SENDABLE_INJECTION_ADMIN_CODE = 'Y100';

const buildSendablePrescriptionOrder = () => {
  const order = buildEmptyPrescriptionOrder('000001', '2026-01-20') as ReturnType<typeof buildEmptyPrescriptionOrder> & {
    encounterId: string;
  };
  order.encounterId = 'F001:E100';
  order.rps = [
    {
      ...order.rps[0],
      name: 'RP1',
      usage: '毎食後',
      usageCode: '001000',
      daysOrTimes: '7',
      drugs: [
        {
          rowId: 'drug-1',
          code: '620000001',
          name: '薬剤A',
          quantity: '3',
          unit: '錠',
          genericChangeAllowed: true,
          isGeneralNamePrescription: false,
          drugComment: '',
          claimComments: [],
          patientRequest: false,
        },
      ],
    },
  ];
  return order;
};

const defaultSelectedEntry: ReceptionEntry = {
  id: 'reception-001',
  status: '受付中',
  source: 'visits',
  department: '01',
  physician: '10001',
  patientId: '000001',
};

const renderActionBar = (selectedEntry?: Partial<ReceptionEntry>) =>
  render(
    <MemoryRouter>
      <ChartsActionBar
        {...({
          ...baseProps,
          patientId: '000001',
          encounterId: 'F001:E100',
          visitDate: '2026-01-20',
          selectedEntry: selectedEntry ? { ...defaultSelectedEntry, ...selectedEntry } : defaultSelectedEntry,
        } as any)}
      />
    </MemoryRouter>,
  );

describe('ChartsActionBar ORCA send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    vi.mocked(fetchOrderBundles).mockResolvedValue({ ok: true, bundles: [] } as any);
    vi.mocked(fetchPrescriptionOrder).mockResolvedValue({
      ok: true,
      patientId: '000001',
      sourceBundles: [],
      order: buildSendablePrescriptionOrder(),
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('sends a valid medicalmodv2 payload', async () => {
    const user = userEvent.setup();
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      invoiceNumber: 'INV-999',
      dataId: 'DATA-999',
      runId: 'RUN-API',
      traceId: 'TRACE-API',
      rawXml: '<xml></xml>',
      missingTags: [],
    });

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    expect(fetchPrescriptionOrder).toHaveBeenCalledWith({ patientId: '000001', from: '2026-01-20', encounterId: 'F001:E100' });
    expect(screen.getByText(/ORCA送信/)).toBeInTheDocument();
    expect(screen.queryByText(/Invoice_Number=INV-999/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Data_Id=DATA-999/)).not.toBeInTheDocument();
  });

  it('blocks missing physician code', async () => {
    const user = userEvent.setup();

    renderActionBar({ department: '01', physician: undefined, patientId: '000001' });

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/Physician_Code/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('blocks invalid treatment codes', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: 'bad-code',
                bundleNumber: '1',
                items: [{ code: '12345', name: 'invalid item' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/9桁コード/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('blocks comment-only treatment rows', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: 'comment-only',
                bundleNumber: '1',
                items: [{ code: '0082', name: 'comment row', quantity: '', unit: '' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

  await waitFor(() => expect(screen.getByText(/本体となるコード行/)).toBeInTheDocument());
  expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
});

  it('blocks saved otherOrder bundles before send with explicit local-only notice', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'otherOrder'
          ? [
              {
                entity: 'otherOrder',
                bundleName: 'invalid-other-class',
                bundleNumber: '1',
                classCode: '8A0',
                items: [{ code: '180000210', name: '診断書料', quantity: '1', unit: '回' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/otherOrder.*explicit local-only 契約.*ORCA 送信しません/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('sends injection bundles for allowed non-310 classCode and strips local-only admin fields', async () => {
    const user = userEvent.setup();
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      runId: 'RUN-API',
      traceId: 'TRACE-API',
      rawXml: '<xml></xml>',
      missingTags: [],
    });
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'allowed-class',
                bundleNumber: '1',
                classCode: '320',
                admin: '静注',
                adminCode: buildInjectionAdminCode(1),
                adminMemo: '20ml/h',
                items: [{ code: '620000010', name: 'drug-a', quantity: '1', unit: 'A' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    const payload = vi.mocked(postOrcaMedicalModV2Xml).mock.calls[0]?.[0];
    expect(JSON.stringify(payload)).not.toContain(buildInjectionAdminCode(1));
    expect(JSON.stringify(payload)).not.toContain('静注');
    expect(JSON.stringify(payload)).not.toContain('20ml/h');
  });

  it('sends injection bundles when adminCode is missing because admin fields are local-only', async () => {
    const user = userEvent.setup();
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      runId: 'RUN-API',
      traceId: 'TRACE-API',
      rawXml: '<xml></xml>',
      missingTags: [],
    });
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'missing-admin-code',
                bundleNumber: '1',
                classCode: '310',
                admin: '静注',
                adminCode: '',
                items: [{ code: '620000010', name: 'drug-a', quantity: '1', unit: 'A' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    const payload = vi.mocked(postOrcaMedicalModV2Xml).mock.calls[0]?.[0];
    expect(JSON.stringify(payload)).not.toContain('静注');
    expect(JSON.stringify(payload)).not.toContain('"adminCode"');
  });

  it('blocks comment-only injection bundles', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'comment-only-injection',
                bundleNumber: '1',
                classCode: '310',
                admin: '静注',
                adminCode: buildInjectionAdminCode(1),
                items: [{ code: '0082', name: 'comment row', quantity: '', unit: '' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() =>
      expect(
        screen.getByText(/注射は送信可能な本体行（薬剤または手技）を1件以上含める必要があります/),
      ).toBeInTheDocument(),
    );
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it.skip('blocks material-only injection bundles', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'material-only-injection',
                bundleNumber: '1',
                classCode: '310',
                admin: '点滴',
                adminCode: buildInjectionAdminCode(3),
                items: [{ code: '700000031', name: 'drip-set', quantity: '1', unit: 'set', rowRole: 'auxiliary' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/本体となる注射薬剤\/手技コード行/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('sends injection bundles even when stored adminCode is non-sendable', async () => {
    const user = userEvent.setup();
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      runId: 'RUN-API',
      traceId: 'TRACE-API',
      rawXml: '<xml></xml>',
      missingTags: [],
    });
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'invalid-admin-code',
                bundleNumber: '1',
                classCode: '310',
                admin: '静注',
                adminCode: NON_SENDABLE_INJECTION_ADMIN_CODE,
                items: [{ code: '620000010', name: 'drug-a', quantity: '1', unit: 'A' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    const payload = vi.mocked(postOrcaMedicalModV2Xml).mock.calls[0]?.[0];
    expect(JSON.stringify(payload)).not.toContain(NON_SENDABLE_INJECTION_ADMIN_CODE);
  });

  it('sends fetched injection bundles when admin exists without adminCode', async () => {
    const user = userEvent.setup();
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      runId: 'RUN-API',
      traceId: 'TRACE-API',
      rawXml: '<xml></xml>',
      missingTags: [],
    });
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'missing-admin-code',
                bundleNumber: '1',
                classCode: '310',
                admin: '点滴',
                adminCode: '',
                items: [{ code: '620000001', name: '注射薬A', quantity: '1', unit: 'A', rowRole: 'main' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    const payload = vi.mocked(postOrcaMedicalModV2Xml).mock.calls[0]?.[0];
    expect(JSON.stringify(payload)).not.toContain('点滴');
    expect(JSON.stringify(payload)).not.toContain('"adminCode"');
  });

  it('blocks fetched injection bundles when only comment rows are present', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'comment-only',
                bundleNumber: '1',
                classCode: '310',
                admin: '点滴',
                adminCode: buildInjectionAdminCode(1),
                items: [{ code: '0085001', name: 'COMMENT', quantity: '', unit: '', rowRole: 'comment' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/本体行/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('blocks fetched injection bundles when only material rows are present', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'material-only',
                bundleNumber: '1',
                classCode: '310',
                admin: '点滴',
                adminCode: buildInjectionAdminCode(1),
                items: [{ code: '700000031', name: 'DRIP_SET', quantity: '1', unit: 'set', rowRole: 'material' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(screen.getByText(/本体行/)).toBeInTheDocument());
    expect(postOrcaMedicalModV2Xml).not.toHaveBeenCalled();
  });

  it('sends fetched injection bundles when adminMemo is present because it is local-only', async () => {
    const user = userEvent.setup();
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      runId: 'RUN-API',
      traceId: 'TRACE-API',
      rawXml: '<xml></xml>',
      missingTags: [],
    });
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'injectionOrder'
          ? [
              {
                entity: 'injectionOrder',
                bundleName: 'admin-memo',
                bundleNumber: '1',
                classCode: '310',
                admin: '点滴',
                adminCode: buildInjectionAdminCode(1),
                adminMemo: '20ml/h',
                items: [{ code: '620000001', name: '注射薬A', quantity: '1', unit: 'A', rowRole: 'main' }],
              },
            ]
          : [],
    }));

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    const payload = vi.mocked(postOrcaMedicalModV2Xml).mock.calls[0]?.[0];
    expect(JSON.stringify(payload)).not.toContain('20ml/h');
  });

  it('accepts bodyPart and material rows on valid payloads', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'radiologyOrder'
          ? [
              {
                entity: 'radiologyOrder',
                bundleName: 'chest-ct',
                bundleNumber: '3',
                classCode: '700',
                classCodeSystem: 'Claim007',
                className: '画像診断',
                bodyPart: { code: '002001', name: 'chest', quantity: '1', unit: 'part', memo: '' },
                items: [
                  { code: '170017510', name: 'ct', quantity: '1', unit: 'times', memo: '' },
                  { code: '700000001', name: 'contrast', quantity: '1', unit: 'bottle', memo: '' },
                ],
              },
            ]
          : [],
    }));
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '00',
      apiResultMessage: 'OK',
      runId: 'RUN-API',
      traceId: 'TRACE-API',
      rawXml: '<xml></xml>',
      missingTags: [],
    });

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    expect(screen.queryByText(/送信を停止/)).not.toBeInTheDocument();
  });

  it('caches warning positions for treatment bodyPart main material and comment rows', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderBundles).mockImplementation(async ({ entity }) => ({
      ok: true,
      bundles:
        entity === 'treatmentOrder'
          ? [
              {
                entity: 'treatmentOrder',
                bundleName: 'wound-care',
                bundleNumber: '3',
                classCode: '400',
                classCodeSystem: 'Claim007',
                className: 'Treatment',
                bodyPart: { code: '002001', name: 'knee', quantity: '1', unit: 'part', memo: '', rowRole: 'bodyPart' },
                items: [
                  { code: '140000610', name: 'wound-care', quantity: '1', unit: 'times', memo: '', rowRole: 'main' },
                  { code: '700000021', name: 'gauze', quantity: '2', unit: 'sheet', memo: '', rowRole: 'auxiliary' },
                  { code: '0085002', name: 'comment', quantity: '', unit: '', memo: 'after-cleaning', rowRole: 'comment' },
                ],
              },
            ]
          : [],
    }));
    vi.mocked(postOrcaMedicalModV2Xml).mockResolvedValue({
      ok: true,
      status: 200,
      apiResult: '80',
      apiResultMessage: 'warning',
      runId: 'RUN-API-WARN',
      traceId: 'TRACE-API-WARN',
      rawXml: '<xml></xml>',
      missingTags: [],
      medicalWarnings: [
        {
          medicalWarning: 'body-part-warning',
          medicalWarningMessage: 'body-part-warning',
          medicalWarningCode: 'BP01',
          medicalWarningPosition: 1,
          medicalWarningItemPosition: 1,
        },
        {
          medicalWarning: 'main-warning',
          medicalWarningMessage: 'main-warning',
          medicalWarningCode: 'MAIN01',
          medicalWarningPosition: 1,
          medicalWarningItemPosition: 2,
        },
        {
          medicalWarning: 'material-warning',
          medicalWarningMessage: 'material-warning',
          medicalWarningCode: 'MAT01',
          medicalWarningPosition: 1,
          medicalWarningItemPosition: 3,
        },
        {
          medicalWarning: 'comment-warning',
          medicalWarningMessage: 'comment-warning',
          medicalWarningCode: 'COM01',
          medicalWarningPosition: 1,
          medicalWarningItemPosition: 4,
        },
      ],
    } as any);

    renderActionBar();

    await user.click(screen.getByRole('button', { name: 'ORCA 送信' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    await waitFor(() => expect(postOrcaMedicalModV2Xml).toHaveBeenCalled());
    await waitFor(() =>
      expect(getOrcaClaimSendEntry({ facilityId: 'F-1', userId: 'U-1' }, '000001')?.medicalWarnings).toBeDefined(),
    );

    const entry = getOrcaClaimSendEntry({ facilityId: 'F-1', userId: 'U-1' }, '000001');
    expect(entry?.medicalWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceKind: 'body_part', sourceItemIndex: undefined }),
        expect.objectContaining({ sourceKind: 'bundle_item', sourceItemIndex: 0, sourceRowRole: 'main', sourceSectionIndex: 0 }),
        expect.objectContaining({
          sourceKind: 'bundle_item',
          sourceItemIndex: 1,
          sourceRowRole: 'auxiliary',
          sourceRowSubtype: 'material',
          sourceSectionIndex: 1,
        }),
        expect.objectContaining({ sourceKind: 'bundle_item', sourceItemIndex: 2, sourceRowRole: 'comment', sourceSectionIndex: 0 }),
      ]),
    );
  });
});
