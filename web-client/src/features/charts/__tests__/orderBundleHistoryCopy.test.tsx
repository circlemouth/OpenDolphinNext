import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderBundleEditPanel } from '../OrderBundleEditPanel';
import { mutateOrderBundles } from '../orderBundleApi';

const mockHistoryBundle = vi.hoisted(() => ({
  documentId: 100,
  moduleId: 200,
  bundleName: '降圧薬セット',
  admin: '1日1回 朝',
  bundleNumber: '7',
  started: '2025-12-01',
  items: [
    {
      code: '620001402',
      name: 'アムロジピン',
      quantity: '1',
      unit: '錠',
    },
  ],
}));

vi.mock('../orderBundleApi', async () => {
  const actual = await vi.importActual<typeof import('../orderBundleApi')>('../orderBundleApi');
  return {
    ...actual,
    fetchOrderBundles: vi.fn().mockResolvedValue({
      ok: true,
      bundles: [mockHistoryBundle],
      patientId: 'P-1',
    }),
    mutateOrderBundles: vi.fn().mockResolvedValue({ ok: true, runId: 'RUN-ORDER' }),
  };
});

vi.mock('../stampApi', async () => ({
  fetchUserProfile: vi.fn().mockResolvedValue({ ok: true, id: 1, userId: 'facility:doctor' }),
  fetchStampTree: vi.fn().mockResolvedValue({ ok: true, trees: [] }),
  fetchStampDetail: vi.fn(),
}));

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const baseProps = {
  patientId: 'P-1',
  entity: 'medOrder',
  title: '処方編集',
  bundleLabel: 'RP名',
  itemQuantityLabel: '用量',
  variant: 'utility' as const,
  meta: {
    runId: 'RUN-ORDER',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server' as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const requestUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (requestUrl.includes('/api/orca/official/chart-support/contraindication-check')) {
      return new Response(
        JSON.stringify({
          ok: true,
          apiOk: true,
          apiResult: '0000',
          apiResultMessage: 'OK',
          results: [],
          symptomInfo: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    throw new Error(`unexpected fetch: ${requestUrl}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('OrderBundleEditPanel history copy', () => {
  it('履歴コピー後は新規作成として保存される', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        historyCopyRequest={{ requestId: 'history-copy-1', bundle: mockHistoryBundle }}
        onHistoryCopyConsumed={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByDisplayValue('降圧薬セット')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /保存して追加/ }));

    const mutateMock = vi.mocked(mutateOrderBundles);
    await waitFor(() => expect(mutateMock).toHaveBeenCalled());

    const payload = mutateMock.mock.calls[0]?.[0];
    const operation = payload?.operations?.[0];
    expect(operation?.operation).toBe('create');
    expect(operation?.documentId).toBeUndefined();
    expect(operation?.moduleId).toBeUndefined();
  });

  it('編集ガード中は履歴コピーが無効になる', async () => {
    renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        meta={{ ...baseProps.meta, readOnly: true, readOnlyReason: '閲覧専用です' }}
      />,
    );

    await screen.findByText('編集はブロックされています: 閲覧専用です');

    const copyButton = await screen.findByRole('button', { name: 'コピー' });
    expect(copyButton).toBeDisabled();
  });
});
