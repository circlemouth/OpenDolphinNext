// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PrescriptionOrderEditorPanel } from '../PrescriptionOrderEditorPanel';
import { fetchOrcaGenericPrice } from '../orcaGenericPriceApi';
import { fetchOrcaOrderInputSetDetail, fetchOrcaOrderInputSets } from '../orcaOrderInputSetApi';
import { checkOrcaMasterStaticOrderInteractions } from '../orcaOrderInteractionApi';
import { fetchOrderMasterSearch } from '../orderMasterSearchApi';
import { savePrescriptionOrder } from '../prescriptionOrderApi';

vi.mock('../orderMasterSearchApi', async () => {
  const actual = await vi.importActual<typeof import('../orderMasterSearchApi')>('../orderMasterSearchApi');
  return {
    ...actual,
    fetchOrderMasterSearch: vi.fn(),
  };
});

vi.mock('../orcaGenericPriceApi', () => ({
  fetchOrcaGenericPrice: vi.fn(),
}));

vi.mock('../orcaOrderInputSetApi', () => ({
  fetchOrcaOrderInputSets: vi.fn(),
  fetchOrcaOrderInputSetDetail: vi.fn(),
}));

vi.mock('../orcaOrderInteractionApi', () => ({
  checkOrcaMasterStaticOrderInteractions: vi.fn(),
}));

vi.mock('../prescriptionOrderApi', async () => {
  const actual = await vi.importActual<typeof import('../prescriptionOrderApi')>('../prescriptionOrderApi');
  return {
    ...actual,
    savePrescriptionOrder: vi.fn().mockResolvedValue({ ok: true }),
  };
});

const baseMeta = {
  runId: 'RUN-RX-LOCAL-ONLY',
  cacheHit: true,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: 'server' as const,
  encounterId: 'F001:E777',
  visitDate: '2026-03-09',
};

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderPanel = (bundlesOverride: any[] = []) =>
  render(
    <QueryClientProvider client={createClient()}>
      <PrescriptionOrderEditorPanel
        patientId="P-RX-LOCAL"
        meta={baseMeta}
        active
        bundlesOverride={bundlesOverride}
      />
    </QueryClientProvider>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PrescriptionOrderEditorPanel local-only usage contract', () => {
  it('ORCA入力セット取込は用法コードを投与コードから復元し、注記テキストへは依存しない', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaGenericPrice).mockResolvedValue({ ok: false, status: 404 });
    vi.mocked(checkOrcaMasterStaticOrderInteractions).mockResolvedValue({ ok: true, status: 200, totalCount: 0, pairs: [] });
    vi.mocked(fetchOrcaOrderInputSets).mockResolvedValue({
      ok: true,
      status: 200,
      totalCount: 1,
      items: [{ setCode: 'P02221', name: '頓服セット', entity: 'medOrder', itemCount: 1 }],
    });
    vi.mocked(fetchOrcaOrderInputSetDetail).mockResolvedValue({
      ok: true,
      status: 200,
      setCode: 'P02221',
      bundle: {
        entity: 'medOrder',
        bundleName: '頓服セット',
        bundleNumber: '3',
        classCode: '221',
        admin: '頓服',
        adminCode: '200',
        adminMemo: '院内補足メモ',
        started: '2026-03-09',
        items: [{ code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
      },
    });

    renderPanel([
      {
        entity: 'medOrder',
        bundleName: '既存RP',
        bundleNumber: '7',
        admin: '毎食後',
        adminCode: '001000',
        adminMemo: '',
        classCode: '212',
        started: '2026-03-09',
        items: [{ code: '620000099', name: '既存薬', quantity: '1', unit: '錠', memo: '' }],
      },
    ]);

    await user.type(screen.getByPlaceholderText('入力セット名またはコード'), '頓服');
    await user.click(screen.getByRole('button', { name: '入力セット検索' }));
    await user.click(await screen.findByRole('button', { name: /P02221.*頓服セット.*RPへ反映/ }));
    await user.click(await screen.findByRole('button', { name: /RP2: 頓服セット/ }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(savePrescriptionOrder).mock.calls[0]?.[0];
    expect(payload?.order?.rps[1]).toEqual(
      expect.objectContaining({
        usage: '頓服',
        usageCode: '200',
      }),
    );
  });

  it('usageCode が無くても自由入力用法を local-only として保存する', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrderMasterSearch).mockResolvedValue({ ok: true, items: [], totalCount: 0 });
    vi.mocked(fetchOrcaGenericPrice).mockResolvedValue({ ok: false, status: 404 });
    vi.mocked(checkOrcaMasterStaticOrderInteractions).mockResolvedValue({ ok: true, status: 200, totalCount: 0, pairs: [] });

    renderPanel([
      {
        entity: 'medOrder',
        bundleName: '自由用法RP',
        bundleNumber: '5',
        admin: '食後すぐ',
        adminCode: '',
        adminMemo: '院内補足メモ',
        classCode: '212',
        started: '2026-03-09',
        items: [{ code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
      },
    ]);

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(savePrescriptionOrder).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(savePrescriptionOrder).mock.calls[0]?.[0];
    expect(payload?.order?.rps[0]).toEqual(
      expect.objectContaining({
        usage: '食後すぐ',
      }),
    );
    expect(payload?.order?.rps[0]?.usageCode).toBeUndefined();
  });
});
