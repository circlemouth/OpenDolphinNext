import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OrderSummaryPane } from '../OrderSummaryPane';
import type { OrderBundle } from '../orderBundleApi';

const requireElement = <T extends Element>(element: T | null): T => {
  expect(element).not.toBeNull();
  return element as T;
};

describe('OrderSummaryPane category display', () => {
  it('右側サマリはカテゴリチップを常時表示し、選択カテゴリだけに詳細カードを表示する', () => {
    const prescriptionBundle: OrderBundle = {
      entity: 'medOrder',
      bundleName: '降圧薬RP',
      bundleNumber: '1',
      started: '2026-02-27T09:00:00+09:00',
      documentId: 10,
      moduleId: 100,
      enteredByName: '山田太郎',
      enteredByRole: '医師',
      items: [
        { name: 'アムロジピン', quantity: '1', unit: '錠', memo: '__orca_meta__:{"genericFlg":"no","userComment":"食後"}\nレセコメントA' },
      ],
    };
    const injectionBundle: OrderBundle = {
      entity: 'injectionOrder',
      bundleName: '注射セットA',
      started: '2026-02-27T10:00:00+09:00',
      documentId: 11,
      moduleId: 101,
      items: [{ name: '生食 100mL', quantity: '1', unit: '本' }],
      admin: '皮下注射',
      adminMemo: '速度指定あり',
    };
    const treatmentBundle: OrderBundle = {
      entity: 'treatmentOrder',
      bundleName: '創傷処置',
      started: '2026-02-27T11:00:00+09:00',
      documentId: 12,
      moduleId: 102,
      items: [{ name: '創部洗浄', quantity: '1', unit: '回' }],
    };
    const testBundle: OrderBundle = {
      entity: 'testOrder',
      bundleName: '採血セット',
      started: '2026-02-27T12:00:00+09:00',
      documentId: 13,
      moduleId: 103,
      items: [{ name: '血算' }],
    };
    const chargeBundle: OrderBundle = {
      entity: 'baseChargeOrder',
      bundleName: '外来管理加算',
      started: '2026-02-27T12:30:00+09:00',
      documentId: 14,
      moduleId: 104,
      items: [{ name: '外来管理加算', quantity: '1', unit: '回', memo: '初診日' }],
    };

    render(
      <OrderSummaryPane
        orderBundles={[injectionBundle, treatmentBundle, testBundle, chargeBundle]}
        prescriptionBundles={[prescriptionBundle]}
      />,
    );

    const summaryPane = screen.getByLabelText('オーダー概要');
    const groups = summaryPane.querySelectorAll('.soap-note__order-group');
    expect(groups.length).toBe(1);

    const prescriptionGroup = requireElement(summaryPane.querySelector('.soap-note__order-group[data-group="prescription"]'));

    expect(screen.getByRole('button', { name: '処方 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '点滴・注射 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '処置 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '検査 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '算定 1' })).toBeInTheDocument();
    expect(prescriptionGroup).toHaveTextContent('処方');
    expect(summaryPane.querySelector('.soap-note__order-group[data-group="document"]')).toBeNull();

    expect(summaryPane).not.toHaveTextContent('降圧薬RP');
    expect(summaryPane).not.toHaveTextContent('注射セットA');

    expect(prescriptionGroup).toHaveTextContent('RP1');
    expect(prescriptionGroup).toHaveTextContent('【後発変更不可】');
    expect(prescriptionGroup).toHaveTextContent('薬剤量: 1錠');
    expect(summaryPane.querySelector('.soap-note__order-group-rail')).toBeNull();
    expect(summaryPane.querySelector('.soap-note__right-dock-button')).toBeNull();
    expect(summaryPane.querySelector('.order-dock__subtype-tab')).toBeNull();
  });

  it('カテゴリチップ選択と選択カテゴリの追加ボタンから新規編集ペイロードを返す', async () => {
    const user = userEvent.setup();
    const onCategorySelect = vi.fn();
    const onCategoryAdd = vi.fn();

    const { rerender } = render(
      <OrderSummaryPane
        orderBundles={[]}
        prescriptionBundles={[]}
        onCategorySelect={onCategorySelect}
        onCategoryAdd={onCategoryAdd}
      />,
    );

    await user.click(screen.getByRole('button', { name: '点滴・注射 0' }));
    expect(onCategorySelect).toHaveBeenCalledWith({ group: 'injection', entity: 'injectionOrder', hasRows: false });

    await user.click(screen.getByRole('button', { name: '＋処方入力' }));
    rerender(
      <OrderSummaryPane
        orderBundles={[]}
        prescriptionBundles={[]}
        selectedCategory="injection"
        onCategorySelect={onCategorySelect}
        onCategoryAdd={onCategoryAdd}
      />,
    );
    await user.click(screen.getByRole('button', { name: '＋注射入力' }));

    expect(onCategoryAdd).toHaveBeenNthCalledWith(1, { group: 'prescription', entity: 'medOrder' });
    expect(onCategoryAdd).toHaveBeenNthCalledWith(2, { group: 'injection', entity: 'injectionOrder' });
  });

  it('右ペイン内の候補導線から選択カテゴリの chooser 起動ペイロードを返す', async () => {
    const user = userEvent.setup();
    const onCandidateOpen = vi.fn();

    render(
      <OrderSummaryPane
        orderBundles={[]}
        prescriptionBundles={[]}
        selectedCategory="injection"
        onCandidateOpen={onCandidateOpen}
      />,
    );

    const summaryPane = screen.getByLabelText('オーダー概要');
    await user.click(within(summaryPane).getAllByRole('button', { name: '注射候補を探す' })[0]);

    expect(onCandidateOpen).toHaveBeenCalledWith({ group: 'injection', entity: 'injectionOrder', intent: 'search' });
  });

  it('編集中は候補から反映で active entity の chooser 起動ペイロードを返す', async () => {
    const user = userEvent.setup();
    const onCandidateOpen = vi.fn();

    render(
      <OrderSummaryPane
        orderBundles={[]}
        prescriptionBundles={[]}
        selectedCategory="injection"
        activeCategory="injection"
        activeOrderEntity="injectionOrder"
        activeOrderTitle="注射入力"
        activeOrderPanel={<div>コンパクト注射フォーム</div>}
        inlineEditorMode="edit"
        onCandidateOpen={onCandidateOpen}
      />,
    );

    await user.click(screen.getByRole('button', { name: '注射候補から反映' }));

    expect(onCandidateOpen).toHaveBeenCalledWith({ group: 'injection', entity: 'injectionOrder', intent: 'apply' });
  });

  it('空カテゴリ追加がブロック中でもnative disabledにせず近傍理由を示す', async () => {
    const user = userEvent.setup();
    const onCategoryAdd = vi.fn();

    render(
      <OrderSummaryPane
        orderBundles={[]}
        prescriptionBundles={[]}
        onCategoryAdd={onCategoryAdd}
        emptyCategoryAddState={{ prescription: { disabled: true, reason: 'マスター未同期のため編集できません。' } }}
      />,
    );

    const addButton = screen.getByRole('button', { name: '＋処方入力' });
    expect(addButton).not.toBeDisabled();
    expect(addButton).toHaveAttribute('aria-disabled', 'true');
    expect(addButton).toHaveAttribute('aria-describedby', 'charts-order-add-block-reason');
    expect(screen.getByText('編集はブロックされています: マスター未同期のため編集できません。')).toBeInTheDocument();

    await user.click(addButton);
    expect(onCategoryAdd).not.toHaveBeenCalled();
  });

  it('並行編集ロック時の空カテゴリ追加ブロック理由は近傍に重複表示しない', async () => {
    const user = userEvent.setup();
    const onCategoryAdd = vi.fn();

    render(
      <OrderSummaryPane
        orderBundles={[]}
        prescriptionBundles={[]}
        onCategoryAdd={onCategoryAdd}
        emptyCategoryAddState={{ prescription: { disabled: true, reason: '別タブが編集中です（runId=RUN-OWNER）' } }}
      />,
    );

    const addButton = screen.getByRole('button', { name: '＋処方入力' });
    expect(addButton).not.toBeDisabled();
    expect(addButton).toHaveAttribute('aria-disabled', 'true');
    expect(addButton).not.toHaveAttribute('aria-describedby');
    expect(addButton).toHaveAttribute('title', '別タブが編集中です（runId=RUN-OWNER）');
    expect(screen.queryByText('編集はブロックされています: 別タブが編集中です（runId=RUN-OWNER）')).not.toBeInTheDocument();

    await user.click(addButton);
    expect(onCategoryAdd).not.toHaveBeenCalled();
  });

  it('空カテゴリに activeOrderPanel がある場合はその場に直接フォームを表示する', () => {
    render(
      <OrderSummaryPane
        orderBundles={[]}
        prescriptionBundles={[]}
        selectedCategory="prescription"
        activeCategory="prescription"
        activeOrderTitle="処方入力"
        activeOrderPanel={<div>コンパクト処方フォーム</div>}
        inlineEditorMode="edit"
      />,
    );

    const summaryPane = screen.getByLabelText('オーダー概要');
    expect(summaryPane).toHaveAttribute('data-inline-editor-mode', 'edit');
    expect(screen.queryByText('入力欄をこの列で編集中')).not.toBeInTheDocument();
    expect(screen.getByText('コンパクト処方フォーム')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '＋処方入力' })).not.toBeInTheDocument();
  });

  it('処方は prescriptionBundles を優先してクリック時に編集ペイロードを返す', async () => {
    const user = userEvent.setup();
    const onBundleSelect = vi.fn();
    const orderBundlePrescription: OrderBundle = {
      entity: 'medOrder',
      bundleName: '旧経路の処方',
      bundleNumber: '1',
      started: '2026-02-27T09:00:00+09:00',
      documentId: 20,
      moduleId: 200,
      items: [{ name: '旧データ', quantity: '1', unit: '錠' }],
    };
    const dedicatedPrescriptionBundle: OrderBundle = {
      entity: 'legacyPrescription',
      bundleName: 'RP新経路',
      bundleNumber: '2',
      started: '2026-02-27T10:00:00+09:00',
      documentId: 21,
      moduleId: 201,
      items: [{ name: 'メトホルミン', quantity: '2', unit: '錠' }],
    };

    render(
      <OrderSummaryPane
        orderBundles={[orderBundlePrescription]}
        prescriptionBundles={[dedicatedPrescriptionBundle]}
        onBundleSelect={onBundleSelect}
      />,
    );

    expect(screen.queryByRole('button', { name: '旧経路の処方を編集' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'RP新経路を編集' }));

    expect(onBundleSelect).toHaveBeenCalledTimes(1);
    expect(onBundleSelect).toHaveBeenCalledWith({
      group: 'prescription',
      entity: 'medOrder',
      bundle: dedicatedPrescriptionBundle,
    });
  });

  it('文書編集ランチャーは右オーダーペインには表示しない', () => {
    render(<OrderSummaryPane orderBundles={[]} />);

    expect(screen.queryByRole('button', { name: '文書を編集' })).not.toBeInTheDocument();
  });

  it('処方の bundleNumber ラベルは classCode/timing 規約に従って 日数/回数 を表示する', () => {
    const regularPrescription: OrderBundle = {
      entity: 'medOrder',
      bundleName: '内服RP',
      classCode: '212',
      bundleNumber: '14',
      admin: '1日1回 朝食後',
      started: '2026-02-27T09:00:00+09:00',
      documentId: 30,
      moduleId: 300,
      items: [{ name: 'アムロジピン', quantity: '1', unit: '錠' }],
    };
    const tonyoPrescription: OrderBundle = {
      entity: 'medOrder',
      bundleName: '頓用RP',
      classCode: '221',
      bundleNumber: '3',
      admin: '必要時',
      started: '2026-02-27T10:00:00+09:00',
      documentId: 31,
      moduleId: 301,
      items: [{ name: 'ロキソニン', quantity: '1', unit: '錠' }],
    };

    render(<OrderSummaryPane orderBundles={[]} prescriptionBundles={[regularPrescription, tonyoPrescription]} />);

    const summaryPane = screen.getByLabelText('オーダー概要');
    const prescriptionGroup = requireElement(summaryPane.querySelector('.soap-note__order-group[data-group="prescription"]'));

    expect(prescriptionGroup).toHaveTextContent('用法: 1日1回 朝食後 / 日数: 14');
    expect(prescriptionGroup).toHaveTextContent('用法: 必要時 / 回数: 3');
  });

  it('カテゴリ内カードは started desc -> documentId desc -> index desc で並ぶ', () => {
    const injectionBundles: OrderBundle[] = [
      {
        entity: 'injectionOrder',
        bundleName: '前日',
        started: '2026-02-27T09:00:00+09:00',
        documentId: 1,
        moduleId: 1,
        items: [{ name: '生食', quantity: '1', unit: '本' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '同日doc小',
        started: '2026-02-28T09:00:00+09:00',
        documentId: 5,
        moduleId: 2,
        items: [{ name: 'ブドウ糖', quantity: '1', unit: '本' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '同日doc大',
        started: '2026-02-28T09:00:00+09:00',
        documentId: 9,
        moduleId: 3,
        items: [{ name: '乳酸リンゲル', quantity: '1', unit: '本' }],
      },
    ];

    render(<OrderSummaryPane orderBundles={injectionBundles} prescriptionBundles={[]} />);

    const summaryPane = screen.getByLabelText('オーダー概要');
    const injectionGroup = requireElement(summaryPane.querySelector('.soap-note__order-group[data-group="injection"]'));
    const labels = Array.from(injectionGroup.querySelectorAll('button.soap-note__summary-card')).map((button) =>
      button.getAttribute('aria-label'),
    );

    expect(labels).toEqual(['同日doc大を編集', '同日doc小を編集', '前日を編集']);
  });
});
