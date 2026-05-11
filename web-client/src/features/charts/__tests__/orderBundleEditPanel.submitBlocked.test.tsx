import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderBundleEditPanel } from '../OrderBundleEditPanel';
import { mutateOrderBundles } from '../orderBundleApi';

vi.mock('../orderBundleApi', async () => {
  const actual = await vi.importActual<typeof import('../orderBundleApi')>('../orderBundleApi');
  return {
    ...actual,
    fetchOrderBundles: vi.fn().mockResolvedValue({
      ok: true,
      bundles: [],
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

vi.mock('../orderMasterSearchApi', async () => ({
  fetchOrderMasterSearch: vi.fn().mockResolvedValue({
    ok: true,
    items: [],
    totalCount: 0,
  }),
}));

vi.mock('../orcaMedicationGetApi', async () => ({
  fetchOrcaMedicationGet: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    selections: [],
  }),
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
  entity: 'medOrder' as const,
  title: '処方編集',
  bundleLabel: 'RP名',
  itemQuantityLabel: '用量',
  meta: {
    runId: 'RUN-ORDER',
    cacheHit: false,
    missingMaster: true,
    fallbackUsed: false,
    dataSourceTransition: 'server' as const,
  },
  variant: 'embedded' as const,
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
});

describe('OrderBundleEditPanel submit blocked reasons', () => {
  it('編集ガード中の embedded submit は native disabled だけにせず押下時に理由を表示する', async () => {
    const user = userEvent.setup();
    renderWithClient(<OrderBundleEditPanel {...baseProps} />);

    expect(screen.getByText('編集はブロックされています: マスター未同期のため編集できません。')).toBeInTheDocument();
    const saveButton = screen.getByRole('button', { name: '保存して追加する' });
    expect(saveButton).not.toBeDisabled();
    expect(saveButton).toHaveAttribute('aria-disabled', 'true');
    expect(saveButton).toHaveAttribute('aria-describedby', 'medOrder-edit-block-reason');
    expect(saveButton).toHaveAttribute('data-disabled-reason', 'order_detail_submit_blocked');

    await user.click(saveButton);

    expect(screen.getByText('保存操作を停止: マスター未同期のため編集できません。')).toBeInTheDocument();
    expect(mutateOrderBundles).not.toHaveBeenCalled();
  });
});
