import { describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { OrderDockPanel } from '../OrderDockPanel';

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
