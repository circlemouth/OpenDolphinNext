import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { ChartsActionBar } from '../ChartsActionBar';
import { postOrcaMedicalModV2Xml } from '../orcaClaimApi';
import { fetchOrderBundles } from '../orderBundleApi';
import type { ReceptionEntry } from '../../reception/api';

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

vi.mock('../orderBundleApi', () => ({
  fetchOrderBundles: vi.fn().mockResolvedValue({ ok: true, bundles: [] }),
}));

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
        {...baseProps}
        patientId="000001"
        visitDate="2026-01-20"
        selectedEntry={selectedEntry ? { ...defaultSelectedEntry, ...selectedEntry } : defaultSelectedEntry}
      />
    </MemoryRouter>,
  );

describe('ChartsActionBar ORCA send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOrderBundles).mockResolvedValue({ ok: true, bundles: [] } as any);
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
                className: 'Radiology',
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
});
