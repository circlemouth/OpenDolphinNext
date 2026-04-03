import { describe, expect, it } from 'vitest';

import type { OrderBundle } from '../orderBundleApi';

const ORDER_DETAIL_VIEW_MODEL_MODULE_PATH = '../orderDetailDisplayViewModel';

const loadOrderDetailDisplayViewModelModule = async (): Promise<Record<string, unknown>> => {
  try {
    return (await import(/* @vite-ignore */ ORDER_DETAIL_VIEW_MODEL_MODULE_PATH)) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `orderDetailDisplayViewModel.ts の実装が未完了です。` +
        ` ViewModelビルダー/ソート/bundleNumberラベル判定を追加してください。 原因: ${String(error)}`,
    );
  }
};

const resolveRequiredFunction = <T extends (...args: any[]) => unknown>(
  module: Record<string, unknown>,
  names: string[],
  requirementLabel: string,
): T => {
  for (const name of names) {
    const candidate = module[name];
    if (typeof candidate === 'function') return candidate as T;
  }
  throw new Error(`${requirementLabel} を満たす公開関数が見つかりません。候補: ${names.join(', ')}`);
};

const resolveCategoryBuilder = (module: Record<string, unknown>) =>
  resolveRequiredFunction<(...args: any[]) => unknown>(
    module,
    ['buildOrderDetailDisplayCategories', 'buildOrderDetailDisplayViewModels', 'buildOrderDetailDisplayViewModelList'],
    'カテゴリViewModel生成',
  );

const resolveRowsBuilder = (module: Record<string, unknown>) =>
  resolveRequiredFunction<(...args: any[]) => unknown>(
    module,
    ['buildOrderDetailDisplayRowsForGroup', 'buildOrderDetailDisplayRows', 'buildOrderDetailDisplayViewModels'],
    'グループViewModel生成',
  );

const invokeCategoryBuilder = (
  fn: (...args: any[]) => unknown,
  input: { orderBundles?: OrderBundle[]; prescriptionBundles?: OrderBundle[] },
) => {
  const attempts: Array<() => unknown> = [
    () => fn(input),
    () => fn(input.orderBundles ?? [], input.prescriptionBundles ?? []),
    () => fn(input.orderBundles ?? []),
  ];
  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
    } catch {
      // try next signature
    }
  }
  throw new Error('カテゴリViewModelビルダーの呼び出し契約を解決できません。');
};

const invokeRowsBuilder = (
  fn: (...args: any[]) => unknown,
  input: { group: string; bundles: OrderBundle[]; defaultEntity: string },
) => {
  const attempts: Array<() => unknown> = [
    () => fn(input),
    () => fn(input.group, input.bundles, input.defaultEntity),
    () => fn(input.bundles),
  ];
  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
    } catch {
      // try next signature
    }
  }
  throw new Error('グループViewModelビルダーの呼び出し契約を解決できません。');
};

describe('orderDetailDisplayViewModel requirements', () => {
  it('表示統一に必要な公開関数を提供する', async () => {
    const module = await loadOrderDetailDisplayViewModelModule();
    const buildCategories = resolveCategoryBuilder(module);
    const buildRows = resolveRowsBuilder(module);
    const sortFn = resolveRequiredFunction<(...args: any[]) => unknown>(
      module,
      ['sortBundlesByLatestRule'],
      '共通ソート',
    );

    expect(typeof buildCategories).toBe('function');
    expect(typeof buildRows).toBe('function');
    expect(typeof sortFn).toBe('function');
  });

  it('共通ソートは started desc -> documentId desc -> index desc を適用する', async () => {
    const module = await loadOrderDetailDisplayViewModelModule();
    const sortBundlesByLatestRule = resolveRequiredFunction<(bundles: OrderBundle[]) => OrderBundle[]>(
      module,
      ['sortBundlesByLatestRule'],
      '共通ソート',
    );

    const sorted = sortBundlesByLatestRule([
      {
        entity: 'injectionOrder',
        bundleName: '前日',
        started: '2026-02-27T09:00:00+09:00',
        documentId: 1,
        moduleId: 1,
        items: [{ name: 'A' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '同日doc小',
        started: '2026-02-28T09:00:00+09:00',
        documentId: 5,
        moduleId: 2,
        items: [{ name: 'B' }],
      },
      {
        entity: 'injectionOrder',
        bundleName: '同日doc大',
        started: '2026-02-28T09:00:00+09:00',
        documentId: 9,
        moduleId: 3,
        items: [{ name: 'C' }],
      },
    ]);

    expect(sorted.map((bundle) => bundle.bundleName)).toEqual(['同日doc大', '同日doc小', '前日']);
  });

  it('bundleNumber ラベル規約: 処方(22x/tonyo=回数, 21x/23x/regular/gaiyo=日数), 注射/算定=回数', async () => {
    const module = await loadOrderDetailDisplayViewModelModule();
    const buildRows = resolveRowsBuilder(module);

    const prescriptionRows = invokeRowsBuilder(buildRows, {
      group: 'prescription',
      defaultEntity: 'medOrder',
      bundles: [
        {
          entity: 'medOrder',
          bundleName: 'regular',
          classCode: '212',
          bundleNumber: '14',
          admin: '1日1回',
          started: '2026-02-28T09:00:00+09:00',
          items: [{ name: '薬A' }],
        } as any,
        {
          entity: 'medOrder',
          bundleName: 'tonyo',
          classCode: '221',
          bundleNumber: '3',
          admin: '必要時',
          started: '2026-02-27T09:00:00+09:00',
          items: [{ name: '薬B' }],
        } as any,
      ],
    });
    const regular = prescriptionRows.find((row) => row.bundleLabel === 'regular');
    const tonyo = prescriptionRows.find((row) => row.bundleLabel === 'tonyo');

    expect(regular?.bundleNumberLabel).toBe('日数');
    expect(tonyo?.bundleNumberLabel).toBe('回数');

    const injectionRows = invokeRowsBuilder(buildRows, {
      group: 'injection',
      defaultEntity: 'injectionOrder',
      bundles: [
        {
          entity: 'injectionOrder',
          bundleName: '注射',
          bundleNumber: '2',
          started: '2026-02-28T10:00:00+09:00',
          items: [{ name: '注射A' }],
        },
      ],
    });
    const chargeRows = invokeRowsBuilder(buildRows, {
      group: 'charge',
      defaultEntity: 'baseChargeOrder',
      bundles: [
        {
          entity: 'baseChargeOrder',
          bundleName: '算定',
          bundleNumber: '1',
          started: '2026-02-28T10:00:00+09:00',
          items: [{ name: '算定A' }],
        },
      ],
    });

    expect(injectionRows[0]?.bundleNumberLabel).toBe('回数');
    expect(chargeRows[0]?.bundleNumberLabel).toBe('回数');
  });

  it('処方 ViewModel は SOAP右基準の必須項目を欠落させない', async () => {
    const module = await loadOrderDetailDisplayViewModelModule();
    const buildRows = resolveRowsBuilder(module);
    const rows = invokeRowsBuilder(buildRows, {
      group: 'prescription',
      defaultEntity: 'medOrder',
      bundles: [
        {
          entity: 'medOrder',
          bundleName: '詳細処方',
          classCode: '212',
          bundleNumber: '7',
          admin: '1日2回',
          started: '2026-02-28T09:00:00+09:00',
          items: [
            {
              name: '620000001 メトホルミン',
              quantity: '2',
              unit: '錠',
              memo: '__orca_meta__:{"genericFlg":"no","userComment":"食後に服用"}\nレセプトコメントA',
              ingredientQuantity: '500',
              ingredientUnit: 'mg',
            } as any,
          ],
        },
      ],
    });

    const model = rows[0] as Record<string, unknown>;
    const firstItem = (Array.isArray(model.items) ? model.items[0] : null) as Record<string, unknown> | null;
    const secondary = Array.isArray(firstItem?.secondary) ? firstItem?.secondary.join(' ') : '';

    expect(model).toEqual(
      expect.objectContaining({
        group: expect.any(String),
        entity: expect.any(String),
        operatorLine: expect.any(String),
        detailLines: expect.any(Array),
        chips: expect.any(Array),
        bundleNumberLabel: expect.any(String),
        bundleNumberValue: expect.any(String),
        warnings: expect.any(Array),
        missingFlags: expect.any(Array),
      }),
    );
    expect(firstItem?.genericNote).toContain('後発');
    expect(secondary).toContain('成分量');
    expect(secondary).toContain('レセプトコメント');
    expect(model.bundleNumberLabel).toBe('日数');
    expect(model.bundleNumberValue).toBe('7');
  });

  it('charge ViewModel は local-only review 導線として admin/adminMemo/sourceSetCode/started を detailLines に残す', async () => {
    const module = await loadOrderDetailDisplayViewModelModule();
    const buildRows = resolveRowsBuilder(module);
    const rows = invokeRowsBuilder(buildRows, {
      group: 'charge',
      defaultEntity: 'baseChargeOrder',
      bundles: [
        {
          entity: 'baseChargeOrder',
          bundleName: '外来管理加算',
          bundleNumber: '1',
          started: '2026-02-28T10:00:00+09:00',
          admin: '算定指示',
          adminMemo: '算定前確認',
          memo: '自由メモ',
          sourceSetCode: 'C13001',
          items: [{ name: '外来管理加算', quantity: '1', unit: '回' }],
        } as any,
      ],
    });

    const model = rows[0] as Record<string, unknown>;
    const detailLines = Array.isArray(model.detailLines) ? model.detailLines.join(' / ') : '';

    expect(detailLines).toContain('算定指示');
    expect(detailLines).toContain('院内補足:算定前確認');
    expect(detailLines).toContain('メモ:自由メモ');
    expect(detailLines).toContain('反映元 setCode: C13001');
    expect(detailLines).toContain('開始: 2026-02-28T10:00:00+09:00');
  });

  it('処方は prescriptionBundles を優先し、orderBundles の処方はフォールバック扱いにする', async () => {
    const module = await loadOrderDetailDisplayViewModelModule();
    const buildCategories = resolveCategoryBuilder(module);

    const categories = invokeCategoryBuilder(buildCategories, {
      orderBundles: [
        {
          entity: 'medOrder',
          bundleName: '旧経路処方',
          started: '2026-02-27T09:00:00+09:00',
          documentId: 410,
          moduleId: 41,
          items: [{ name: '旧データ' }],
        },
      ],
      prescriptionBundles: [
        {
          entity: 'legacyPrescription',
          bundleName: '新経路処方',
          started: '2026-02-28T09:00:00+09:00',
          documentId: 420,
          moduleId: 42,
          items: [{ name: '新データ' }],
        },
      ],
    });

    const prescription = categories.find((category) => category.key === 'prescription');
    const rows = (prescription?.rows ?? []) as Array<Record<string, unknown>>;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.bundleLabel).toBe('新経路処方');
  });
});
