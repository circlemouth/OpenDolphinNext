import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderDockPanel } from '../OrderDockPanel';
vi.mock('../OrderBundleEditPanel', () => ({
  OrderBundleEditPanel: ({ title, onClose }: any) => (
    <div aria-label={`${title}入力`}>
      <button type="button" onClick={() => onClose?.()}>
        保存して閉じる
      </button>
      <button type="button" onClick={() => onClose?.()}>
        閉じる
      </button>
    </div>
  ),
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

const baseMeta = {
  runId: 'RUN-ORDER-DOCK-REGRESSION',
  cacheHit: false,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: 'server' as const,
};

const buildPrescriptionBundle = (suffix: string) =>
  ({
    entity: 'medOrder',
    documentId: `DOC-${suffix}`,
    moduleId: `MOD-${suffix}`,
    bundleName: `降圧薬RP-${suffix}`,
    classCode: '212',
    bundleNumber: '7',
    admin: '1日1回 朝食後',
    started: '2026-02-24',
    items: [{ code: `62000140${suffix}`, name: `62000140${suffix} アムロジピン`, quantity: '1', unit: '錠', memo: '' }],
  }) as any;

const injectionBundle = {
  entity: 'injectionOrder',
  documentId: 'DOC-IJ-1',
  moduleId: 'MOD-IJ-1',
  bundleName: '注射RP-1',
  classCode: '310',
  bundleNumber: '1',
  started: '2026-02-24',
  items: [{ code: '620009999', name: '620009999 生食', quantity: '1', unit: '本', memo: '' }],
} as any;

const treatmentBundle = {
  entity: 'treatmentOrder',
  documentId: 'DOC-TM-1',
  moduleId: 'MOD-TM-1',
  bundleName: '創傷処置',
  classCode: '400',
  bundleNumber: '1',
  started: '2026-02-24',
  items: [{ code: '400000001', name: '400000001 創傷処置', quantity: '1', unit: '回', memo: '' }],
} as any;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('OrderDockPanel state compatibility', () => {
  it('quick-add/group-add data-test-id を維持しつつ onStateChange(hasEditing/targetCategory/count/source) を通知する', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-24"
        orderBundles={[buildPrescriptionBundle('1'), injectionBundle]}
        onStateChange={onStateChange}
      />,
    );

    expect(document.querySelector('[data-test-id="order-dock-quick-add-prescription"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-quick-add-injection"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-prescription"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-injection"]')).not.toBeNull();

    await waitFor(() =>
      expect(onStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          hasEditing: false,
          targetCategory: null,
          count: 2,
          source: null,
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: '処方を追加' }));
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hasEditing: true,
          targetCategory: 'prescription',
          count: 1,
          editingLabel: '処方',
          source: expect.stringMatching(/^(right-panel|bottom-floating)$/),
        }),
      ),
    );

    await user.click(screen.getByRole('button', { name: '閉じる' }));
    const contextGuardDialog = document.querySelector('[data-test-id="order-dock-context-guard-dialog"]') as HTMLElement | null;
    if (contextGuardDialog) {
      await user.click(within(contextGuardDialog).getByRole('button', { name: '破棄して切替' }));
    }
    await waitFor(() =>
      expect(onStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          hasEditing: false,
          source: null,
        }),
      ),
    );

    const backToBrowseButton = screen.queryByRole('button', { name: '通常閲覧へ戻る' });
    if (backToBrowseButton) {
      await user.click(backToBrowseButton);
      await waitFor(() =>
        expect(onStateChange).toHaveBeenLastCalledWith(
          expect.objectContaining({
            hasEditing: false,
            targetCategory: null,
            count: 2,
            source: null,
          }),
        ),
      );
    }
  });

  it('laboTest エイリアスを検査タブへ正規化して表示できる', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-24"
        orderBundles={[
          {
            entity: 'laboTest',
            documentId: 'DOC-LAB-1',
            moduleId: 'MOD-LAB-1',
            bundleName: '旧検査セット',
            classCode: '600',
            bundleNumber: '1',
            started: '2026-02-24',
            items: [{ code: '160000010', name: '血液一般', quantity: '1', unit: '式', memo: '' }],
          } as any,
        ]}
      />,
    );

    const testGroup = document.querySelector('section.order-dock__group[data-group="test"]') as HTMLElement;
    await user.click(testGroup.querySelector('.order-dock__group-toggle') as HTMLButtonElement);

    expect(within(testGroup).getByText('旧検査セット')).toBeInTheDocument();
    expect(within(testGroup).getByRole('button', { name: '旧検査セットを編集' })).toBeInTheDocument();
  });

  it('処置タブへ戻すと treatmentOrder 束が canonical match で消えない', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-24"
        orderBundles={[treatmentBundle]}
      />,
    );

    const treatmentGroup = document.querySelector('section.order-dock__group[data-group="treatment"]') as HTMLElement;
    const toggle = within(treatmentGroup).getByRole('button', { name: /処置を(開く|閉じる)/ });
    if (toggle.getAttribute('aria-expanded') !== 'true') {
      await user.click(toggle);
    }
    await waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('true'));

    await user.click(within(treatmentGroup).getByRole('tab', { name: 'すべて' }));
    await user.click(within(treatmentGroup).getByRole('tab', { name: '処置' }));
    expect(within(treatmentGroup).getByRole('button', { name: '創傷処置を編集' })).toBeInTheDocument();
  });
});

describe('OrderDockPanel RP regression', () => {
  it('複数RPを連続編集でき、保存後に別RPを再編集できる', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-24"
        orderBundles={[buildPrescriptionBundle('1'), buildPrescriptionBundle('2')]}
      />,
    );

    const prescriptionGroup = document.querySelector('section.order-dock__group[data-group="prescription"]') as HTMLElement;
    const firstToggle = within(prescriptionGroup).getByRole('button', { name: /処方RPを(開く|閉じる)/ });
    if (firstToggle.getAttribute('aria-expanded') !== 'true') {
      await user.click(firstToggle);
    }
    await waitFor(() => expect(firstToggle.getAttribute('aria-expanded')).toBe('true'));

    const firstEditButtons = within(prescriptionGroup).getAllByRole('button', { name: /を編集$/ });
    await user.click(firstEditButtons[0]);
    expect(screen.getAllByLabelText('処方入力').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '保存して閉じる' }));
    const firstContextGuardDialog = document.querySelector(
      '[data-test-id="order-dock-context-guard-dialog"]',
    ) as HTMLElement | null;
    if (firstContextGuardDialog) {
      await user.click(within(firstContextGuardDialog).getByRole('button', { name: '破棄して切替' }));
    }
    await waitFor(() => expect(screen.queryAllByLabelText('処方入力')).toHaveLength(0));

    const secondEditButtons = within(prescriptionGroup).getAllByRole('button', { name: /を編集$/ });
    await user.click(secondEditButtons[1]);
    expect(screen.getAllByLabelText('処方入力').length).toBeGreaterThan(0);
  });

  it('単独RPでも保存して閉じる後に再編集できる', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-24"
        orderBundles={[buildPrescriptionBundle('1')]}
      />,
    );

    const prescriptionGroup = document.querySelector('section.order-dock__group[data-group="prescription"]') as HTMLElement;
    const firstToggle = within(prescriptionGroup).getByRole('button', { name: /処方RPを(開く|閉じる)/ });
    if (firstToggle.getAttribute('aria-expanded') !== 'true') {
      await user.click(firstToggle);
    }
    await waitFor(() => expect(firstToggle.getAttribute('aria-expanded')).toBe('true'));

    await user.click(within(prescriptionGroup).getByRole('button', { name: /を編集$/ }));
    expect(screen.getAllByLabelText('処方入力').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '保存して閉じる' }));
    const contextGuardDialog = document.querySelector('[data-test-id="order-dock-context-guard-dialog"]') as HTMLElement | null;
    if (contextGuardDialog) {
      await user.click(within(contextGuardDialog).getByRole('button', { name: '破棄して切替' }));
    }
    await waitFor(() => expect(screen.queryAllByLabelText('処方入力')).toHaveLength(0));

    await user.click(within(prescriptionGroup).getByRole('button', { name: /を編集$/ }));
    expect(screen.getAllByLabelText('処方入力').length).toBeGreaterThan(0);
  });
});
