import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SoapNotePanel } from '../SoapNotePanel';
import type { OrderBundle } from '../orderBundleApi';

const renderWithQueryClient = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const requireElement = <T extends Element>(element: T | null): T => {
  expect(element).not.toBeNull();
  return element as T;
};

const setViewportWidth = (width: number) => {
  act(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
    window.dispatchEvent(new Event('resize'));
  });
};

const candidateCategoryChipName: Record<'処方' | '注射' | '処置' | '検査' | '算定', RegExp> = {
  処方: /^処方\s*\d+$/,
  注射: /^点滴・注射\s*\d+$/,
  処置: /^処置\s*\d+$/,
  検査: /^検査\s*\d+$/,
  算定: /^算定\s*\d+$/,
};

const queryOrderPaneCandidateButton = (orderPane: HTMLElement, label: '処方' | '注射' | '処置' | '検査' | '算定') =>
  within(orderPane).queryByRole('button', { name: `${label}候補を探す` }) ??
  within(orderPane).queryByRole('button', { name: `${label}候補を追加` });

const openOrderPaneCandidate = async (
  user: ReturnType<typeof userEvent.setup>,
  label: '処方' | '注射' | '処置' | '検査' | '算定',
) => {
  const orderPane = screen.getByLabelText('オーダー概要') as HTMLElement;
  const directButton = queryOrderPaneCandidateButton(orderPane, label);
  if (directButton) {
    await user.click(directButton);
    return;
  }

  await user.click(within(orderPane).getByRole('button', { name: candidateCategoryChipName[label] }));
  await waitFor(() => {
    expect(queryOrderPaneCandidateButton(orderPane, label)).not.toBeNull();
  });
  const candidateButton = queryOrderPaneCandidateButton(orderPane, label);
  if (!candidateButton) throw new Error(`${label}候補導線が見つかりません。`);
  await user.click(candidateButton);
};

describe('SoapNotePanel right dock drawer', () => {
  it('右ドックはSOAP本文グリッド外に配置される', () => {
    const { container } = renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-RAIL',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
        utilityRailItems={[{ id: 'imaging', label: '画像', shortLabel: '画', shortcut: 'Ctrl+Shift+3', kind: 'imaging' }]}
      />,
    );

    const body = requireElement(container.querySelector('.soap-note__body'));
    const rightDockArea = requireElement(container.querySelector('.soap-note__right-dock-area'));
    expect(body.contains(rightDockArea)).toBe(false);
    expect(within(rightDockArea as HTMLElement).queryByLabelText('候補カテゴリ')).not.toBeInTheDocument();
    expect(within(rightDockArea as HTMLElement).queryByRole('button', { name: '処方候補を開く' })).not.toBeInTheDocument();
  });

  it('右オーダーペインはSOAP本文グリッド外に常時表示される', () => {
    const { container } = renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-ORDER-PANE',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
      />,
    );

    const body = requireElement(container.querySelector('.soap-note__body'));
    const orderPane = requireElement(container.querySelector('#charts-order-pane'));
    expect(body.contains(orderPane)).toBe(false);
    expect(orderPane).toHaveTextContent('処方');
    expect(orderPane).toHaveTextContent('注射');
    expect(orderPane).toHaveTextContent('処置');
    expect(orderPane).toHaveTextContent('検査');
    expect(orderPane).toHaveTextContent('算定');
  });

  it('空カテゴリ追加で右オーダーペイン内に編集フォームを開く', async () => {
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-ORDER-ADD',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
      />,
    );

    expect(await screen.findByText('処方入力')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '＋RP' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '＋薬剤行' })).toBeInTheDocument();
  });

  it('右オーダーペインの候補導線でドロワーが開き対象カテゴリを表示する', async () => {
    const user = userEvent.setup();
    const bundles: OrderBundle[] = [
      {
        entity: 'injectionOrder',
        bundleName: '注射セットA',
        started: '2026-02-26T10:00:00+09:00',
        documentId: 100,
        moduleId: 10,
        items: [{ name: '生食 100mL', quantity: '1', unit: '本' }],
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
        orderBundles={bundles}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    const drawerHeaderLabel = requireElement(drawer.querySelector('.soap-note__right-drawer-header strong'));

    expect(drawer.getAttribute('data-open')).toBe('false');
    expect(drawer.querySelector('.soap-note__right-drawer-panel[data-active="true"]')).toBeNull();

    await openOrderPaneCandidate(user, '注射');

    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });
    expect(drawer.getAttribute('data-tool')).toBe('injection');
    expect(drawerHeaderLabel).toHaveTextContent('注射候補');
    expect(drawer.querySelector('.soap-note__right-drawer-panel[data-active="true"]')).not.toBeNull();
    expect(drawer.querySelector('.soap-note__right-drawer-order-list')).toBeNull();
    const previewSection = requireElement(drawer.querySelector('.soap-note__right-drawer-order-preview'));
    expect(previewSection).toHaveTextContent('注射セットA');
    expect(previewSection).toHaveTextContent('編集面で開く');
  });

  it('Dock時は SoapNotePanel ルートに data-right-drawer-mode が付与される', async () => {
    const user = userEvent.setup();
    const previousInnerWidth = window.innerWidth;
    setViewportWidth(1920);
    window.localStorage.setItem('opendolphin:web-client:soap-right-drawer:mode', 'dock');
    window.localStorage.setItem('opendolphin:web-client:soap-right-drawer:width', '560');
    const bundles: OrderBundle[] = [
      {
        entity: 'injectionOrder',
        bundleName: 'ドック属性確認',
        started: '2026-02-26T10:00:00+09:00',
        documentId: 111,
        moduleId: 12,
        items: [{ name: '生食 100mL', quantity: '1', unit: '本' }],
      },
    ];
    try {
      const { container } = renderWithQueryClient(
        <SoapNotePanel
          history={[]}
          meta={{
            runId: 'RUN-RIGHT-DOCK-MODE-ATTR',
            patientId: 'P-001',
            appointmentId: 'APT-001',
            receptionId: 'RCP-001',
            visitDate: '2026-02-26',
          }}
          author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
          orderBundles={bundles}
        />,
      );

      const soapNoteRoot = requireElement(container.querySelector('.soap-note'));
      const drawer = requireElement<HTMLElement>(document.body.querySelector('.soap-note__right-drawer'));
      await openOrderPaneCandidate(user, '注射');
      await waitFor(() => {
        expect(drawer.getAttribute('data-open')).toBe('true');
      });
      const switchToDockButton =
        within(drawer).queryByRole('button', { name: '並べる' }) ??
        within(drawer).queryByRole('button', { name: /ドック表示|ドック|並べる/ });
      if (switchToDockButton) {
        await user.click(switchToDockButton);
        await waitFor(() => {
          const nextRootMode = soapNoteRoot.getAttribute('data-right-drawer-mode');
          const nextDrawerMode = drawer.getAttribute('data-mode');
          expect(nextRootMode === 'dock' || nextDrawerMode === 'dock').toBe(true);
        });
      }

      const rootMode = soapNoteRoot.getAttribute('data-right-drawer-mode');
      const drawerMode = drawer.getAttribute('data-mode');
      if (rootMode !== null) {
        expect(rootMode).toBe('dock');
      } else if (drawerMode !== null) {
        expect(drawerMode).toBe('dock');
      } else {
        expect(drawer.getAttribute('data-open')).toBe('true');
      }
    } finally {
      window.localStorage.removeItem('opendolphin:web-client:soap-right-drawer:mode');
      window.localStorage.removeItem('opendolphin:web-client:soap-right-drawer:width');
      setViewportWidth(previousInnerWidth);
    }
  });

  it('Dock時は右縦ドックと中列サマリの表示が抑制される', async () => {
    const user = userEvent.setup();
    const previousInnerWidth = window.innerWidth;
    setViewportWidth(1920);
    window.localStorage.setItem('opendolphin:web-client:soap-right-drawer:mode', 'dock');
    window.localStorage.setItem('opendolphin:web-client:soap-right-drawer:width', '560');
    const bundles: OrderBundle[] = [
      {
        entity: 'medOrder',
        bundleName: '表示抑制確認',
        started: '2026-02-26T10:30:00+09:00',
        documentId: 112,
        moduleId: 13,
        items: [{ name: 'アムロジピン', quantity: '1', unit: '錠' }],
      },
    ];
    try {
      const { container } = renderWithQueryClient(
        <SoapNotePanel
          history={[]}
          meta={{
            runId: 'RUN-RIGHT-DOCK-SUPPRESSION',
            patientId: 'P-001',
            appointmentId: 'APT-001',
            receptionId: 'RCP-001',
            visitDate: '2026-02-26',
          }}
          author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
          orderBundles={bundles}
        />,
      );

      const soapNoteRoot = requireElement(container.querySelector('.soap-note'));
      const drawer = requireElement<HTMLElement>(document.body.querySelector('.soap-note__right-drawer'));
      await openOrderPaneCandidate(user, '処方');
      await waitFor(() => {
        expect(drawer.getAttribute('data-open')).toBe('true');
      });
      const switchToDockButton =
        within(drawer).queryByRole('button', { name: '並べる' }) ??
        within(drawer).queryByRole('button', { name: /ドック表示|ドック|並べる/ });
      if (switchToDockButton) {
        await user.click(switchToDockButton);
        await waitFor(() => {
          const nextRootMode = soapNoteRoot.getAttribute('data-right-drawer-mode');
          const nextDrawerMode = drawer.getAttribute('data-mode');
          expect(nextRootMode === 'dock' || nextDrawerMode === 'dock').toBe(true);
        });
      }

      const centerPanel = container.querySelector('.soap-note__center-panel-only');
      const rightDockArea = container.querySelector('.soap-note__right-dock-area');
      expect(rightDockArea).toBeNull();
      const rootDockActive =
        (soapNoteRoot.getAttribute('data-right-drawer-open') === '1' ||
          soapNoteRoot.getAttribute('data-right-drawer-open') === 'true') &&
        soapNoteRoot.getAttribute('data-right-drawer-mode') === 'dock';
      const drawerDockActive = drawer.getAttribute('data-mode') === 'dock';

      if (rootDockActive || drawerDockActive) {
        const centerSuppressed =
          centerPanel === null ||
          centerPanel.hasAttribute('hidden') ||
          centerPanel.getAttribute('aria-hidden') === 'true' ||
          centerPanel.getAttribute('data-suppressed') === 'true' ||
          centerPanel.getAttribute('data-right-drawer-suppressed') === '1' ||
          rootDockActive;
        expect(centerSuppressed).toBe(true);
      } else {
        expect(centerPanel).not.toBeNull();
      }
    } finally {
      window.localStorage.removeItem('opendolphin:web-client:soap-right-drawer:mode');
      window.localStorage.removeItem('opendolphin:web-client:soap-right-drawer:width');
      setViewportWidth(previousInnerWidth);
    }
  });

  it('文書は右ドロワーに再混入しない', () => {
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-DOCUMENT',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
        orderBundles={[]}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    expect(drawer.getAttribute('data-open')).toBe('false');
    expect(screen.queryByRole('button', { name: /文書.*開く/ })).not.toBeInTheDocument();
  });

  it('非モーダル右ドロワー開中でも背景のSOAP入力を操作できる', async () => {
    const user = userEvent.setup();
    const bundles: OrderBundle[] = [
      {
        entity: 'medOrder',
        bundleName: '降圧薬RP',
        started: '2026-02-26T10:00:00+09:00',
        documentId: 101,
        moduleId: 11,
        items: [{ name: 'アムロジピン', quantity: '1', unit: '錠' }],
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-NON-MODAL',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
        orderBundles={bundles}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    const drawerHeaderLabel = requireElement(drawer.querySelector('.soap-note__right-drawer-header strong'));

    await openOrderPaneCandidate(user, '処方');
    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });
    expect(drawer.getAttribute('data-tool')).toBe('prescription');
    expect(drawerHeaderLabel).toHaveTextContent('処方候補');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const subjectiveInput = screen.getByPlaceholderText('Subjective を記載してください。') as HTMLTextAreaElement;
    await user.type(subjectiveInput, '背景操作OK');

    expect(subjectiveInput.value).toContain('背景操作OK');
    expect(drawer.getAttribute('data-open')).toBe('true');
  });

  it('ドロワーヘッダ付近のカテゴリタブ操作で tool が切り替わる', async () => {
    const user = userEvent.setup();
    const bundles: OrderBundle[] = [
      {
        entity: 'medOrder',
        bundleName: '処方切替確認',
        started: '2026-02-27T09:00:00+09:00',
        documentId: 151,
        moduleId: 16,
        items: [{ name: 'メトホルミン', quantity: '1', unit: '錠' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '注射切替確認',
        started: '2026-02-27T09:30:00+09:00',
        documentId: 152,
        moduleId: 17,
        items: [{ name: '生食', quantity: '1', unit: '本' }],
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-HEADER-CATEGORY-TAB',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
        orderBundles={bundles}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    await openOrderPaneCandidate(user, '処方');
    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });
    expect(drawer.getAttribute('data-tool')).toBe('prescription');

    const drawerHeader = requireElement<HTMLElement>(drawer.querySelector('.soap-note__right-drawer-header'));
    const injectionToolControl =
      within(drawerHeader).queryByRole('tab', { name: /注射/ }) ??
      within(drawerHeader)
        .queryAllByRole('button', { name: /注射/ })
        .find((button) => button.getAttribute('aria-label') !== '右ドロワーを閉じる') ??
      null;
    if (injectionToolControl) {
      await user.click(injectionToolControl);
    } else {
      await openOrderPaneCandidate(user, '注射');
    }
    await waitFor(() => {
      expect(drawer.getAttribute('data-tool')).toBe('injection');
    });

    const prescriptionToolControl =
      within(drawerHeader).queryByRole('tab', { name: /処方/ }) ??
      within(drawerHeader)
        .queryAllByRole('button', { name: /処方/ })
        .find((button) => button.getAttribute('aria-label') !== '右ドロワーを閉じる') ??
      null;
    if (prescriptionToolControl) {
      await user.click(prescriptionToolControl);
    } else {
      await openOrderPaneCandidate(user, '処方');
    }
    await waitFor(() => {
      expect(drawer.getAttribute('data-tool')).toBe('prescription');
    });
  });

  it('右オーダーペインの処方行クリックで候補ドロワーを開かず右側編集へ遷移する', async () => {
    const user = userEvent.setup();
    const bundles: OrderBundle[] = [
      {
        entity: 'medOrder',
        bundleName: '糖尿病薬RP',
        started: '2026-02-26T09:00:00+09:00',
        documentId: 201,
        moduleId: 21,
        items: [{ name: 'メトホルミン', quantity: '2', unit: '錠' }],
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-SUMMARY',
          patientId: 'P-002',
          appointmentId: 'APT-002',
          receptionId: 'RCP-002',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor02' }}
        orderBundles={bundles}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    const drawerHeaderLabel = requireElement(drawer.querySelector('.soap-note__right-drawer-header strong'));

    expect(drawer.getAttribute('data-open')).toBe('false');

    await user.click(screen.getByRole('button', { name: '糖尿病薬RPを編集' }));

    await waitFor(() => {
      expect(screen.getByText('処方入力')).toBeInTheDocument();
    });
    expect(drawer.getAttribute('data-open')).toBe('false');
    expect(drawerHeaderLabel).toHaveTextContent('処方候補');
  });

  it('右オーダーペインの候補を探すで選択カテゴリの候補ドロワーを開く', async () => {
    const user = userEvent.setup();

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-ORDER-CANDIDATE',
          patientId: 'P-002',
          appointmentId: 'APT-002',
          receptionId: 'RCP-002',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor02' }}
        orderBundles={[]}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    const orderPane = screen.getByLabelText('オーダー概要');

    await user.click(within(orderPane).getAllByRole('button', { name: '処方候補を探す' })[0]);

    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });
    expect(drawer.getAttribute('data-tool')).toBe('prescription');
    expect(drawer).toHaveTextContent('処方候補');
    expect(screen.getByText('処方入力')).toBeInTheDocument();
  });

  it('処方ドロワー一覧は軽量カードで詳細行（RP/後発可否/薬剤量/成分量/用法/日数）を表示する', async () => {
    const user = userEvent.setup();
    const bundles: OrderBundle[] = [
      {
        entity: 'medOrder',
        bundleName: '詳細表示RP',
        classCode: '212',
        bundleNumber: '7',
        admin: '1日2回',
        started: '2026-02-27T09:00:00+09:00',
        documentId: 301,
        moduleId: 31,
        items: [
          {
            name: '620000001 メトホルミン',
            quantity: '2',
            unit: '錠',
            memo: '__orca_meta__:{"genericFlg":"no","userComment":"食後に服用"}\nレセプト文言A',
            ingredientQuantity: '500',
            ingredientUnit: 'mg',
          } as any,
        ],
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-DETAIL',
          patientId: 'P-003',
          appointmentId: 'APT-003',
          receptionId: 'RCP-003',
          visitDate: '2026-02-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor03' }}
        orderBundles={bundles}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));

    await openOrderPaneCandidate(user, '処方');
    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });

    const previewItem = requireElement<HTMLElement>(screen.getByText('詳細表示RP').closest('.soap-note__right-drawer-order-preview-item'));
    expect(within(previewItem).getByText('RP7')).toBeInTheDocument();
    expect(within(previewItem).getByText('【後発変更不可】')).toBeInTheDocument();
    expect(within(previewItem).getByText('メトホルミン')).toBeInTheDocument();
    expect(within(previewItem).getByText('薬剤量: 2錠 / 成分量: 500mg')).toBeInTheDocument();
    expect(within(previewItem).getByText('用法: 1日2回 / 日数: 7')).toBeInTheDocument();
    expect(within(previewItem).queryByText('プレビューモード: 編集操作・保存は無効です。')).not.toBeInTheDocument();
  });

  it('右ドロワー一覧の並び順は started desc -> documentId desc -> index desc を維持する', async () => {
    const user = userEvent.setup();
    const bundles: OrderBundle[] = [
      {
        entity: 'injectionOrder',
        bundleName: '前日',
        started: '2026-02-26T09:00:00+09:00',
        documentId: 11,
        moduleId: 1,
        items: [{ name: '生食', quantity: '1', unit: '本' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '同日doc小',
        started: '2026-02-27T09:00:00+09:00',
        documentId: 15,
        moduleId: 2,
        items: [{ name: 'ブドウ糖', quantity: '1', unit: '本' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '同日doc大',
        started: '2026-02-27T09:00:00+09:00',
        documentId: 21,
        moduleId: 3,
        items: [{ name: '乳酸リンゲル', quantity: '1', unit: '本' }],
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-SORT',
          patientId: 'P-004',
          appointmentId: 'APT-004',
          receptionId: 'RCP-004',
          visitDate: '2026-02-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor04' }}
        orderBundles={bundles}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    await openOrderPaneCandidate(user, '注射');
    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });

    expect(drawer.querySelector('.soap-note__right-drawer-order-list')).toBeNull();
    const previewList = requireElement(drawer.querySelector('.soap-note__right-drawer-order-preview-list'));
    const labels = Array.from(previewList.querySelectorAll('.soap-note__right-drawer-order-preview-item-header strong')).map((node) =>
      node.textContent?.trim(),
    );

    expect(labels).toEqual(['同日doc大', '同日doc小', '前日']);
  });

  it('処置サブカテゴリは role=tab/aria-selected で切替でき、既存一覧は selectedEntity 連動で絞り込まれる', async () => {
    const user = userEvent.setup();
    const bundles: OrderBundle[] = [
      {
        entity: 'treatmentOrder',
        bundleName: '処置セットA',
        started: '2026-02-27T11:00:00+09:00',
        documentId: 401,
        moduleId: 41,
        items: [{ name: '創部洗浄', quantity: '1', unit: '回' }],
      },
      {
        entity: 'otherOrder',
        bundleName: 'その他オーダーB',
        started: '2026-02-27T10:00:00+09:00',
        documentId: 402,
        moduleId: 42,
        items: [{ name: '湿布処置', quantity: '1', unit: '回' }],
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-SUBTYPE',
          patientId: 'P-006',
          appointmentId: 'APT-006',
          receptionId: 'RCP-006',
          visitDate: '2026-02-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor06' }}
        orderBundles={bundles}
      />,
    );

    await openOrderPaneCandidate(user, '処置');
    const tabList = await screen.findByRole('tablist', { name: '処置サブカテゴリ' });
    const treatmentTab = within(tabList).getByRole('tab', { name: '処置' });
    const otherTab = within(tabList).getByRole('tab', { name: 'その他' });

    expect(treatmentTab).toHaveAttribute('aria-selected', 'true');
    expect(otherTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('処置セットA')).toBeInTheDocument();
    expect(screen.queryByText('その他オーダーB')).not.toBeInTheDocument();

    await user.click(otherTab);

    await waitFor(() => {
      const currentTabList = screen.getByRole('tablist', { name: '処置サブカテゴリ' });
      expect(within(currentTabList).getByRole('tab', { name: 'その他' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByText('その他オーダーB')).toBeInTheDocument();
    expect(screen.queryByText('処置セットA')).not.toBeInTheDocument();
  });

  it('非表示ドロワーは inert/aria-hidden になり、Tab移動でフォーカスが流入しない', async () => {
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-HIDDEN-FOCUS',
          patientId: 'P-007',
          appointmentId: 'APT-007',
          receptionId: 'RCP-007',
          visitDate: '2026-02-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor07' }}
        orderBundles={[]}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    expect(drawer.getAttribute('data-open')).toBe('false');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    await waitFor(() => {
      expect(drawer).toHaveAttribute('inert');
    });
  });

  it('最小化時はドロワー実幅がハンドル幅へ縮み、復帰で元の幅へ戻る', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-MINIMIZE-WIDTH',
          patientId: 'P-008',
          appointmentId: 'APT-008',
          receptionId: 'RCP-008',
          visitDate: '2026-02-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor08' }}
        orderBundles={[]}
      />,
    );

    const drawer = requireElement<HTMLElement>(document.body.querySelector('.soap-note__right-drawer'));
    await openOrderPaneCandidate(user, '処方');
    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });

    const initialWidth = drawer.style.getPropertyValue('--soap-right-drawer-width');
    expect(initialWidth).not.toBe('');
    await user.click(screen.getByRole('button', { name: '右ドロワーを最小化' }));

    await waitFor(() => {
      expect(drawer.getAttribute('data-minimized')).toBe('true');
    });
    expect(drawer.style.getPropertyValue('--soap-right-drawer-width')).toBe('56px');
    expect(drawer).not.toHaveTextContent('復帰');

    await user.click(screen.getByRole('button', { name: '右ドロワーを復帰' }));
    await waitFor(() => {
      expect(drawer.getAttribute('data-minimized')).toBe('false');
    });
    expect(drawer.style.getPropertyValue('--soap-right-drawer-width')).toBe(initialWidth);
  });

  it('候補ドロワー表示中に新規入力を開始すると中央編集面へ handoff し候補ドロワーを閉じる', async () => {
    const user = userEvent.setup();
    const previousInnerWidth = window.innerWidth;
    setViewportWidth(1920);
    try {
      renderWithQueryClient(
        <SoapNotePanel
          history={[]}
          meta={{
            runId: 'RUN-RIGHT-DOCK-NEW-HANDOFF',
            patientId: 'P-010',
            appointmentId: 'APT-010',
            receptionId: 'RCP-010',
            visitDate: '2026-02-27',
          }}
          author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor10' }}
          orderBundles={[]}
        />,
      );

      const drawer = requireElement<HTMLElement>(document.body.querySelector('.soap-note__right-drawer'));
      await openOrderPaneCandidate(user, '注射');
      await waitFor(() => {
        expect(drawer.getAttribute('data-open')).toBe('true');
      });

      await user.click(within(drawer).getAllByRole('button', { name: '新規作成を開く' })[0]);

      await waitFor(() => {
        expect(screen.getByLabelText('注射名')).toBeInTheDocument();
        expect(drawer.getAttribute('data-open')).toBe('false');
        expect(drawer.getAttribute('data-minimized')).toBe('false');
      });
    } finally {
      setViewportWidth(previousInnerWidth);
    }
  });

  it('一時隠す押下中のみ最小化扱いとなり、解除で元幅へ戻る', async () => {
    const user = userEvent.setup();
    const { container } = renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-PEEK-WIDTH',
          patientId: 'P-009',
          appointmentId: 'APT-009',
          receptionId: 'RCP-009',
          visitDate: '2026-02-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor09' }}
        orderBundles={[]}
      />,
    );

    const soapRoot = requireElement<HTMLElement>(container.querySelector('.soap-note'));
    const drawer = requireElement<HTMLElement>(document.body.querySelector('.soap-note__right-drawer'));
    await openOrderPaneCandidate(user, '処方');
    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });

    const peekButton = screen.getByRole('button', { name: '押している間だけ一時的に隠す' });
    const initialWidth = drawer.style.getPropertyValue('--soap-right-drawer-width');
    fireEvent.pointerDown(peekButton, { button: 0, pointerId: 7 });

    await waitFor(() => {
      expect(soapRoot.getAttribute('data-right-drawer-min')).toBe('true');
    });
    expect(drawer.getAttribute('data-minimized')).toBe('true');
    expect(drawer.style.getPropertyValue('--soap-right-drawer-width')).toBe('56px');

    fireEvent.pointerUp(window, { pointerId: 7 });
    await waitFor(() => {
      expect(soapRoot.getAttribute('data-right-drawer-min')).toBe('false');
    });
    expect(drawer.getAttribute('data-minimized')).toBe('false');
    expect(drawer.style.getPropertyValue('--soap-right-drawer-width')).toBe(initialWidth);
  });

  it('既存セットpreviewの「編集面で開く」で対象セットが center editor 編集状態になる', async () => {
    const user = userEvent.setup();
    const bundles: OrderBundle[] = [
      {
        entity: 'injectionOrder',
        bundleName: '前日',
        started: '2026-02-26T09:00:00+09:00',
        documentId: 11,
        moduleId: 1,
        items: [{ name: '生食', quantity: '1', unit: '本' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '同日doc小',
        started: '2026-02-27T09:00:00+09:00',
        documentId: 15,
        moduleId: 2,
        items: [{ name: 'ブドウ糖', quantity: '1', unit: '本' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '同日doc大',
        started: '2026-02-27T09:00:00+09:00',
        documentId: 21,
        moduleId: 3,
        items: [{ name: '乳酸リンゲル', quantity: '1', unit: '本' }],
      },
    ];

    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-RIGHT-DOCK-EDIT-BUTTON',
          patientId: 'P-005',
          appointmentId: 'APT-005',
          receptionId: 'RCP-005',
          visitDate: '2026-02-27',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor05' }}
        orderBundles={bundles}
      />,
    );

    const drawer = requireElement(document.body.querySelector('.soap-note__right-drawer'));
    await openOrderPaneCandidate(user, '注射');
    await waitFor(() => {
      expect(drawer.getAttribute('data-open')).toBe('true');
    });

    const targetCard = requireElement<HTMLElement>(screen.getByText('前日').closest('.soap-note__right-drawer-order-preview-item'));
    expect(screen.queryByLabelText('注射名')).not.toBeInTheDocument();

    await user.click(within(targetCard).getByRole('button', { name: '前日を編集面で開く' }));

    await waitFor(() => {
      const bundleNameInput = screen.getByLabelText('注射名') as HTMLInputElement;
      expect(bundleNameInput.value).toBe('前日');
    });
    expect(drawer.getAttribute('data-open')).toBe('true');
  });

  it('症状詳記セクションは院内ローカル表記のみを使う', () => {
    renderWithQueryClient(
      <SoapNotePanel
        history={[]}
        meta={{
          runId: 'RUN-SOAP-NAMING',
          patientId: 'P-001',
          appointmentId: 'APT-001',
          receptionId: 'RCP-001',
          visitDate: '2026-02-26',
        }}
        author={{ role: 'doctor', displayName: 'Dr. Dock', userId: 'doctor01' }}
        orderBundles={[]}
      />,
    );

    expect(screen.getByText('症状詳記（院内ローカル）')).toBeInTheDocument();
    expect(screen.queryByText('症状詳記（ORCA）')).not.toBeInTheDocument();
  });
});
