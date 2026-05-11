import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderDockPanel } from '../OrderDockPanel';
import { RightUtilityDock } from '../RightUtilityDock';

const renderWithClient = (ui: ReactElement) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const baseMeta = {
  runId: 'RUN-ORDER-DOCK',
  cacheHit: false,
  missingMaster: false,
  fallbackUsed: false,
  dataSourceTransition: 'server' as const,
};

describe('RightUtilityDock clinical icons', () => {
  it('right dock buttons keep accessible names while rendering generated clinical icons', async () => {
    const user = userEvent.setup();
    const onSelectTool = vi.fn();

    render(<RightUtilityDock activeTool="prescription" onSelectTool={onSelectTool} />);

    for (const label of ['処方', '注射', '処置', '検査', '算定']) {
      const button = screen.getByRole('button', { name: `${label}候補を開く` });
      expect(within(button).getByText(label)).toBeInTheDocument();
      expect(button.querySelector('.clinical-icon')).not.toBeNull();
    }

    await user.click(screen.getByRole('button', { name: '注射候補を開く' }));
    expect(onSelectTool).toHaveBeenCalledWith('injection');
  });
});

describe('OrderDockPanel category quick-add', () => {
  it('主要カテゴリ導線を常時表示し quick-add / group-add の data-test-id を保持する', () => {
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-17"
        orderBundles={[
          {
            entity: 'medOrder',
            bundleName: '内服セット',
            started: '2026-02-17',
            items: [{ name: 'A100 アムロジピン', quantity: '1', unit: '錠', memo: '' }],
          } as any,
        ]}
      />,
    );

    expect(screen.getByText('+処方')).toBeInTheDocument();
    expect(screen.getByText('+注射')).toBeInTheDocument();
    expect(screen.getByText('+処置')).toBeInTheDocument();
    expect(screen.getByText('+検査')).toBeInTheDocument();
    expect(screen.getByText('+算定')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="order-dock-quick-add-prescription"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-quick-add-injection"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-quick-add-treatment"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-quick-add-test"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-quick-add-charge"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-prescription"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-injection"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-treatment"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-test"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-charge"]')).not.toBeNull();
  });

  it('カテゴリ候補からインライン編集を開いても検索UIが残り、閉じるで閉じる', async () => {
    const user = userEvent.setup();
    renderWithClient(<OrderDockPanel patientId="P-100" meta={baseMeta} visitDate="2026-02-17" orderBundles={[]} />);

    const scenarios = [
      { category: 'prescription', keyword: '処方', candidateLabel: '処方を新規追加', expectedTitle: '処方' },
      { category: 'injection', keyword: '注射', candidateLabel: '注射を新規追加', expectedTitle: '注射' },
      { category: 'treatment', keyword: '処置', candidateLabel: '処置を新規追加', expectedTitle: '処置' },
      { category: 'test', keyword: '検査', candidateLabel: '検査を新規追加', expectedTitle: '検査' },
      { category: 'charge', keyword: '基本料', candidateLabel: '基本料を新規追加', expectedTitle: '基本料' },
    ] as const;

    for (const scenario of scenarios) {
      const searchInput = screen.getByRole('searchbox', { name: 'オーダー検索' });
      const categorySelect = screen.getByRole('combobox', { name: 'カテゴリ選択' });
      await user.selectOptions(categorySelect, scenario.category);
      await user.clear(searchInput);
      await user.type(searchInput, scenario.keyword);

      const listbox = await screen.findByRole('listbox', { name: '検索候補' });
      const candidateButton = within(listbox)
        .getAllByRole('button')
        .find((button) => within(button).queryByText(scenario.candidateLabel));
      if (!candidateButton) {
        throw new Error(`missing candidate: ${scenario.candidateLabel}`);
      }
      await user.click(candidateButton);

      expect(screen.getByLabelText(`${scenario.expectedTitle}入力`)).toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: 'オーダー検索' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '閉じる' }));
      const discardButton = screen.queryByRole('button', { name: '破棄して切替' });
      if (discardButton) {
        await user.click(discardButton);
      }
      expect(screen.queryByLabelText(`${scenario.expectedTitle}入力`)).not.toBeInTheDocument();
      expect(screen.getByRole('searchbox', { name: 'オーダー検索' })).toBeInTheDocument();
    }
  }, 10_000);

  it('検索仕様: 3文字候補表示・2文字入力は候補クリックで確定・前方/部分検索を切り替えられる', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-17"
        orderBundles={[
          {
            entity: 'medOrder',
            bundleName: '降圧薬RP',
            started: '2026-02-17',
            items: [{ name: 'A100 アムロジピン', quantity: '1', unit: '錠', memo: '' }],
          } as any,
          {
            entity: 'medOrder',
            bundleName: 'ARBセット',
            started: '2026-02-17',
            items: [{ name: 'A200 ロサルタン', quantity: '1', unit: '錠', memo: '' }],
          } as any,
          {
            entity: 'injectionOrder',
            bundleName: '注射セット',
            started: '2026-02-17',
            items: [{ name: '生食', quantity: '100', unit: 'mL', memo: '' }],
          } as any,
        ]}
      />,
    );

    const searchInput = screen.getByRole('searchbox', { name: 'オーダー検索' });
    const categorySelect = screen.getByRole('combobox', { name: 'カテゴリ選択' });

    await user.type(searchInput, '降圧薬');
    let listbox = await screen.findByRole('listbox', { name: '検索候補' });
    expect(within(listbox).getByRole('button', { name: /降圧薬RP/ })).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, 'サル');
    listbox = await screen.findByRole('listbox', { name: '検索候補' });
    expect(within(listbox).getByRole('button', { name: /ARBセット/ })).toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, '降圧');
    expect(screen.queryByLabelText('処方入力')).not.toBeInTheDocument();
    listbox = await screen.findByRole('listbox', { name: '検索候補' });
    await user.click(within(listbox).getByRole('button', { name: /降圧薬RP/ }));
    expect(screen.getByLabelText('処方入力')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '閉じる' }));
    const discardButton = screen.queryByRole('button', { name: '破棄して切替' });
    if (discardButton) {
      await user.click(discardButton);
    }

    await user.selectOptions(categorySelect, 'injection');
    await user.clear(searchInput);
    await user.type(searchInput, '降圧薬');
    expect(screen.queryByRole('listbox', { name: '検索候補' })).not.toBeInTheDocument();
    expect(screen.getByText('候補が見つかりません。カテゴリを変えて検索してください。')).toBeInTheDocument();
  });

  it('+RP導線（処方追加）で処方入力を開ける', async () => {
    const user = userEvent.setup();
    renderWithClient(<OrderDockPanel patientId="P-100" meta={baseMeta} visitDate="2026-02-17" orderBundles={[]} />);

    await user.click(screen.getByRole('button', { name: '処方を追加' }));
    expect(screen.getByLabelText('処方入力')).toBeInTheDocument();
  });

  it('編集不可時の quick-add は disabled だけにせず押下時に理由を表示する', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={{ ...baseMeta, missingMaster: true }}
        visitDate="2026-02-17"
        orderBundles={[]}
      />,
    );

    expect(screen.getByText('オーダー追加はブロックされています: マスター未同期のため操作できません。')).toBeInTheDocument();
    const quickAddButton = document.querySelector('[data-test-id="order-dock-quick-add-prescription"]') as HTMLButtonElement;
    expect(quickAddButton).not.toBeDisabled();
    expect(quickAddButton).toHaveAttribute('aria-disabled', 'true');
    expect(quickAddButton).toHaveAttribute('aria-describedby', 'order-dock-edit-block-reason');

    await user.click(quickAddButton);

    expect(screen.getByText('オーダー追加を停止: マスター未同期のため操作できません。')).toBeInTheDocument();
    expect(screen.queryByLabelText('処方入力')).not.toBeInTheDocument();
  });

  it('編集不可時の束操作は disabled だけにせず押下時に理由を表示する', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={{ ...baseMeta, missingMaster: true }}
        visitDate="2026-02-17"
        orderBundles={[
          {
            entity: 'medOrder',
            bundleName: '既存処方',
            started: '2026-02-17',
            items: [{ name: 'A100 アムロジピン', quantity: '1', unit: '錠', memo: '' }],
          } as any,
        ]}
      />,
    );

    const editButton = screen.getByRole('button', { name: '既存処方を編集' });
    expect(editButton).not.toBeDisabled();
    expect(editButton).toHaveAttribute('aria-disabled', 'true');
    expect(editButton).toHaveAttribute('aria-describedby', 'order-dock-edit-block-reason');
    await user.click(editButton);
    expect(screen.getByText('オーダー編集を停止: マスター未同期のため操作できません。')).toBeInTheDocument();
    expect(screen.queryByLabelText('処方入力')).not.toBeInTheDocument();

    const copyButton = screen.getByRole('button', { name: '既存処方をコピーして編集' });
    expect(copyButton).not.toBeDisabled();
    expect(copyButton).toHaveAttribute('aria-disabled', 'true');
    await user.click(copyButton);
    expect(screen.getByText('オーダーコピーを停止: マスター未同期のため操作できません。')).toBeInTheDocument();
    expect(screen.queryByLabelText('処方入力')).not.toBeInTheDocument();

    const deleteButton = screen.getByRole('button', { name: '既存処方を削除' });
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    await user.click(deleteButton);
    expect(screen.getByText('オーダー削除を停止: マスター未同期のため操作できません。')).toBeInTheDocument();
    expect(screen.queryByTestId('order-dock-delete-dialog')).not.toBeInTheDocument();
  });

  it('編集不可時の処方履歴取り込みは disabled だけにせず押下時に理由を表示する', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={{ ...baseMeta, missingMaster: true }}
        visitDate="2026-02-17"
        orderBundles={[]}
        rpHistory={[
          {
            issuedDate: '2026-02-10',
            rpList: [{ srycd: 'A100', name: 'アムロジピン', dose: '1', amount: '錠', usage: '分1', days: '7' }],
          },
        ]}
      />,
    );

    await user.click(screen.getByText('処方履歴（直近）'));

    const emptyNewButton = screen.getByRole('button', { name: '新規（空）' });
    expect(emptyNewButton).not.toBeDisabled();
    expect(emptyNewButton).toHaveAttribute('aria-disabled', 'true');
    expect(emptyNewButton).toHaveAttribute('aria-describedby', 'order-dock-edit-block-reason');
    await user.click(emptyNewButton);
    expect(screen.getByText('処方履歴取り込みを停止: マスター未同期のため操作できません。')).toBeInTheDocument();
    expect(screen.queryByLabelText('処方入力')).not.toBeInTheDocument();

    const copyButton = screen.getByRole('button', { name: '直近処方をコピーして開始' });
    expect(copyButton).not.toBeDisabled();
    expect(copyButton).toHaveAttribute('aria-disabled', 'true');
    await user.click(copyButton);
    expect(screen.getByText('直近処方コピーを停止: マスター未同期のため操作できません。')).toBeInTheDocument();
    expect(screen.queryByLabelText('処方入力')).not.toBeInTheDocument();
  });

  it('quick-add は主要カテゴリの新規入力を開く', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-17"
        orderBundles={[
          {
            entity: 'medOrder',
            bundleName: '既存処方',
            started: '2026-02-17',
            items: [{ name: 'A100 アムロジピン', quantity: '1', unit: '錠', memo: '' }],
          } as any,
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: '処置を追加' }));
    expect(screen.getByLabelText('処置入力')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'オーダー検索' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通常閲覧へ戻る' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '通常閲覧へ戻る' }));
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    const firstDiscardButton = screen.queryByRole('button', { name: '破棄して切替' });
    if (firstDiscardButton) {
      await user.click(firstDiscardButton);
    }

    await user.click(screen.getByRole('button', { name: '検査を追加' }));
    expect(screen.getByLabelText('検査入力')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'オーダー検索' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通常閲覧へ戻る' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '通常閲覧へ戻る' }));
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    const secondDiscardButton = screen.queryByRole('button', { name: '破棄して切替' });
    if (secondDiscardButton) {
      await user.click(secondDiscardButton);
    }

    await user.click(screen.getByRole('button', { name: '算定を追加' }));
    expect(screen.getByLabelText('基本料入力')).toBeInTheDocument();
  });

  it('サブカテゴリタブは role=tab/aria-selected で、矢印キーで切替できる', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-17"
        orderBundles={[
          {
            entity: 'treatmentOrder',
            bundleName: '処置セットA',
            started: '2026-02-17',
            items: [{ name: '創部処置', quantity: '1', unit: '回' }],
          } as any,
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: '処置を開く' }));
    const treatmentTabList = screen.getByRole('tablist', { name: '処置種類' });
    const treatmentTab = within(treatmentTabList).getByRole('tab', { name: '処置' });
    const surgeryTab = within(treatmentTabList).getByRole('tab', { name: '手術' });
    const allTreatmentTab = within(treatmentTabList).getByRole('tab', { name: 'すべて' });

    expect(treatmentTab).toHaveAttribute('aria-selected', 'true');
    expect(treatmentTab).toHaveAttribute('tabindex', '0');
    expect(surgeryTab).toHaveAttribute('aria-selected', 'false');
    expect(surgeryTab).toHaveAttribute('tabindex', '-1');

    treatmentTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(surgeryTab).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(allTreatmentTab).toHaveAttribute('aria-selected', 'true');
  });

  it('quick-add 新規入力中は押下カテゴリのみ表示し、通常閲覧へ戻れる', async () => {
    const user = userEvent.setup();
    renderWithClient(<OrderDockPanel patientId="P-100" meta={baseMeta} visitDate="2026-02-17" orderBundles={[]} />);

    await user.click(screen.getByRole('button', { name: '処置を追加' }));
    expect(screen.getByLabelText('処置入力')).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="order-dock-group-add-treatment"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-prescription"]')).toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-injection"]')).toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-test"]')).toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-charge"]')).toBeNull();
    expect(screen.queryByRole('tablist', { name: '処置種類' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: '検査種類' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: '算定種類' })).not.toBeInTheDocument();
    expect(screen.queryByText('まだありません。')).not.toBeInTheDocument();
    expect(screen.queryByText('この種類のオーダーはまだありません。')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: 'オーダー検索' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '処方を追加' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '算定を追加' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通常閲覧へ戻る' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '通常閲覧へ戻る' }));
    expect(screen.getByRole('searchbox', { name: 'オーダー検索' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '処方を追加' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '算定を追加' })).toBeInTheDocument();
    expect(document.querySelector('[data-test-id="order-dock-group-add-prescription"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-injection"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-treatment"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-test"]')).not.toBeNull();
    expect(document.querySelector('[data-test-id="order-dock-group-add-charge"]')).not.toBeNull();
  });

  it('medOrder item memo の userComment を表示し __orca_meta__ は露出しない', async () => {
    const user = userEvent.setup();
    const fullComment = '朝夕食後に服用してください。眠気が強い場合は中止してください。';
    renderWithClient(
      <OrderDockPanel
        patientId="P-100"
        meta={baseMeta}
        visitDate="2026-02-17"
        orderBundles={[
          {
            entity: 'medOrder',
            bundleName: 'コメント付き処方',
            started: '2026-02-17',
            items: [
              {
                name: 'A100 アムロジピン',
                quantity: '1',
                unit: '錠',
                memo: `__orca_meta__:${JSON.stringify({ userComment: fullComment })}\n内部メモ`,
              },
            ],
          } as any,
        ]}
      />,
    );

    const prescriptionGroup = document.querySelector('section.order-dock__group[data-group="prescription"]') as HTMLElement;
    const expandButton = prescriptionGroup.querySelector('.order-dock__group-toggle') as HTMLButtonElement;
    if (expandButton.getAttribute('aria-expanded') !== 'true') {
      await user.click(expandButton);
    }

    const commentChip = await screen.findByTitle(`アムロジピン 1錠 コメント:${fullComment}`);
    expect(commentChip).toHaveTextContent(/コメント:/);
    expect(commentChip.textContent).not.toBe(`アムロジピン 1錠 コメント:${fullComment}`);
    expect(screen.queryByText(/__orca_meta__/)).not.toBeInTheDocument();
  });
});
