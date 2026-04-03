import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { OrderBundleEditPanel } from './OrderBundleEditPanel';

vi.mock('./orderBundleApi', async () => ({
  fetchOrderBundles: vi.fn().mockResolvedValue({
    ok: true,
    bundles: [],
    patientId: 'P-1',
  }),
  mutateOrderBundles: vi.fn(),
}));

vi.mock('./orderMasterSearchApi', async () => ({
  fetchOrderMasterSearch: vi.fn().mockResolvedValue({ ok: true, items: [], totalCount: 0 }),
}));

vi.mock('./stampApi', async () => ({
  fetchUserProfile: vi.fn().mockResolvedValue({ ok: true, id: 1, userId: 'facility:doctor' }),
  fetchStampTree: vi.fn().mockResolvedValue({ ok: true, trees: [] }),
  fetchStampDetail: vi.fn(),
}));

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
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
  meta: {
    runId: 'RUN-ORDER',
    cacheHit: false,
    missingMaster: false,
    fallbackUsed: false,
    dataSourceTransition: 'server' as const,
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('OrderBundleEditPanel 600 subtype ui', () => {
  it('physiologyOrder shows a fixed subtype field and physiology-specific placeholder', () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    const { container } = renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="physiologyOrder"
        title="生理検査"
        bundleLabel="検査オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const subtypeInput = container.querySelector<HTMLInputElement>('input[id$="-test-subtype"]');
    const itemNameInput = container.querySelector<HTMLInputElement>('input[id$="-item-name-0"]');

    expect(subtypeInput).not.toBeNull();
    expect(subtypeInput?.disabled).toBe(true);
    expect(subtypeInput?.value).toBe('生理');
    expect(itemNameInput?.placeholder).toBe('生理検査項目名');
  });

  it('bacteriaOrder shows a subtype selector and bacteria-specific placeholder', () => {
    localStorage.setItem('devFacilityId', 'facility');
    localStorage.setItem('devUserId', 'doctor');

    const { container } = renderWithClient(
      <OrderBundleEditPanel
        {...baseProps}
        entity="bacteriaOrder"
        title="細菌検査"
        bundleLabel="検査オーダー名"
        itemQuantityLabel="数量"
      />,
    );

    const subtypeSelect = container.querySelector<HTMLSelectElement>('select[id$="-test-subtype"]');
    const itemNameInput = container.querySelector<HTMLInputElement>('input[id$="-item-name-0"]');

    expect(subtypeSelect).not.toBeNull();
    expect(Array.from(subtypeSelect?.options ?? []).map((option) => option.value)).toEqual(['', 'culture', 'sensitivity']);
    expect(itemNameInput?.placeholder).toBe('細菌検査項目名');
  });
});
