import { describe, expect, it } from 'vitest';

import { validateBundleForm } from '../OrderBundleEditPanel';

type BundleFormState = Parameters<typeof validateBundleForm>[0]['form'];

const baseForm: BundleFormState = {
  bundleName: '',
  admin: '',
  adminCode: '',
  adminCodeSystem: undefined,
  bundleNumber: '1',
  subtype: '',
  adminMemo: '',
  memo: '',
  startDate: '2025-12-29',
  prescriptionLocation: 'out',
  prescriptionTiming: 'regular',
  items: [{ name: '', quantity: '', unit: '', memo: '' }],
  materialItems: [],
  commentItems: [],
  bodyPart: null,
};

describe('validateBundleForm', () => {
  it('medOrder: 薬剤/項目・用法を必須として判定する', () => {
    const issues = validateBundleForm({ form: baseForm, entity: 'medOrder', bundleLabel: 'RP名' });
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.key)).toEqual(expect.arrayContaining(['missing_items', 'missing_usage']));
  });

  it('medOrder: 必須条件を満たす場合はエラーなし', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '降圧薬RP',
        admin: '1日1回',
        items: [{ code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
      },
      entity: 'medOrder',
      bundleLabel: 'RP名',
    });
    expect(issues).toHaveLength(0);
  });

  it('medOrder: 用法が未入力の場合にエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '降圧薬RP',
        admin: '',
        items: [{ code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
      },
      entity: 'medOrder',
      bundleLabel: 'RP名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_usage']);
  });

  it('medOrder: RP名未入力でも項目/用法があればエラーにしない', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '',
        admin: '1日1回',
        items: [{ code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
      },
      entity: 'medOrder',
      bundleLabel: 'RP名',
    });
    expect(issues.map((issue) => issue.key)).toEqual([]);
  });

  it('medOrder: 内服/外用で用法上限日数を超過するとエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '1日1回',
        bundleNumber: '15',
        items: [{ code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
        prescriptionTiming: 'regular',
      },
      entity: 'medOrder',
      bundleLabel: 'RP名',
      usageDaysLimit: 14,
    });
    expect(issues.map((issue) => issue.key)).toEqual(['usage_days_limit_exceeded']);
  });

  it('medOrder: 頓用は用法上限日数の判定対象外', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '必要時',
        bundleNumber: '15',
        items: [{ code: '620000002', name: 'ロキソニン', quantity: '1', unit: '錠', memo: '' }],
        prescriptionTiming: 'tonyo',
      },
      entity: 'medOrder',
      bundleLabel: 'RP名',
      usageDaysLimit: 7,
    });
    expect(issues).toHaveLength(0);
  });

  it('generalOrder: 項目が必須で、用法は必須にしない', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        admin: '',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues).toHaveLength(0);
  });

  it('generalOrder: コードあり/なし混在は明示的にブロックする', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [
          { code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' },
          { code: '', name: '未コード行', quantity: '1', unit: '回', memo: '' },
        ],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['mixed_coded_uncoded']);
  });

  it('generalOrder: コードなし行のみは明示的にブロックする', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '', name: '未コード行', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['uncoded_row']);
  });

  it('generalOrder: コメントだけの束は保存前に止める', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [],
        commentItems: [{ code: '0081', name: 'コメント', quantity: '', unit: '', memo: '注意' }],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['comment_only']);
  });

  it.each(['treatmentOrder', 'testOrder'])('BaseEditor系 %s は項目必須', (entity) => {
    const issues = validateBundleForm({
      form: { ...baseForm, bundleName: 'BaseEditor', admin: '' },
      entity,
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_items']);
  });

  it('laboTest alias も testOrder と同じ必須判定になる', () => {
    const aliasIssues = validateBundleForm({
      form: { ...baseForm, bundleName: 'BaseEditor', admin: '' },
      entity: 'laboTest',
      bundleLabel: 'オーダー名',
    });
    const canonicalIssues = validateBundleForm({
      form: { ...baseForm, bundleName: 'BaseEditor', admin: '' },
      entity: 'testOrder',
      bundleLabel: 'オーダー名',
    });

    expect(aliasIssues).toEqual(canonicalIssues);
  });

  it('generalOrder: オーダー名が未入力でも項目があればエラーにしない', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual([]);
  });

  it('injectionOrder: メモの自由記述は保存可能', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        memo: '手技料なし',
        items: [{ code: '310000001', name: 'ビタミン注射', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues).toHaveLength(0);
  });

  it('injectionOrder: コードなし行は送信前にブロックする', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        items: [{ code: '', name: 'ビタミン注射', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['uncoded_row']);
  });

  it('injectionOrder: adminCode が無い自由入力用法は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '静注',
        adminCode: '',
        items: [{ code: '620000001', name: 'ビタミン注射', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_admin_code']);
  });

  it('injectionOrder: classCode 310 以外は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '静注',
        adminCode: '4101',
        classCode: '320',
        items: [{ code: '620000001', name: 'ビタミン注射', quantity: '1', unit: '回', memo: '' }],
      } as BundleFormState & { classCode: string },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_injection_class_code']);
  });

  it('injectionOrder: 投与指示がある場合は adminCode も必須', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '静注',
        adminCode: '',
        items: [{ code: '620000010', name: '注射薬A', quantity: '1', unit: 'A', memo: '' }],
      },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_admin_code']);
  });

  it('injectionOrder: コメントだけの束は保存前に止める', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        items: [],
        commentItems: [{ code: '0081', name: 'コメント', quantity: '', unit: '', memo: '注意' }],
      },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['comment_only']);
  });

  it('radiologyOrder: 部位が未入力の場合にエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '胸部撮影',
        items: [{ code: '700000001', name: '胸部X線', quantity: '1', unit: '回', memo: '' }],
        bodyPart: null,
      },
      entity: 'radiologyOrder',
      bundleLabel: '放射線オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_body_part']);
  });

  it('radiologyOrder: 部位が入力済みならエラーなし', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '胸部撮影',
        items: [{ code: '700000001', name: '胸部X線', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '002000', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'radiologyOrder',
      bundleLabel: '放射線オーダー名',
    });
    expect(issues).toHaveLength(0);
  });

  it('radiologyOrder: 部位コードが欠ける場合はエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '胸部撮影',
        items: [{ code: '700000001', name: '胸部X線', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'radiologyOrder',
      bundleLabel: '放射線オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_body_part_code']);
  });

  it('radiologyOrder: 002 以外の部位コードはエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '胸部撮影',
        items: [{ code: '700000001', name: '胸部X線', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: 'BP001', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'radiologyOrder',
      bundleLabel: '放射線オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_body_part_code']);
  });

  it('otherOrder: bodyPart を保存前に reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        items: [{ code: '180000210', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '002001', name: '胸部', quantity: '1', unit: '部位', memo: '' },
      },
      entity: 'otherOrder',
      bundleLabel: 'その他オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['unsupported_body_part']);
  });

  it('commentItems: コメントコードか内容が欠ける場合はエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        commentItems: [{ code: '0081', name: '', quantity: '', unit: '', memo: '' }],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_comment_item']);
  });

  it('commentItems: 不正なコメントコードはエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        commentItems: [{ code: '123', name: '注意事項', quantity: '', unit: '', memo: '' }],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_comment_code']);
  });

  it('commentItems: 行を削除するとエラーが解消される', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        commentItems: [],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues).toHaveLength(0);
  });

  it('materialItems: 材料名が空でもエラーにしない（材料は項目行へ統合）', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        materialItems: [{ name: '', quantity: '1', unit: '枚', memo: '' }],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual([]);
  });

  it('materialItems: 行を削除するとエラーが解消される', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        materialItems: [],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues).toHaveLength(0);
  });
  it('bacteriaOrder: subtype が無い場合は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: 'Bacteria',
        subtype: '',
        items: [{ code: '160000010', name: 'Culture', quantity: '1', unit: 'count', memo: '' }],
      },
      entity: 'bacteriaOrder',
      bundleLabel: '検査オーダー',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_test_subtype']);
  });

  it('bacteriaOrder: 許可されない subtype は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: 'Bacteria',
        subtype: 'specimen' as BundleFormState['subtype'],
        items: [{ code: '160000010', name: 'Culture', quantity: '1', unit: 'count', memo: '' }],
      },
      entity: 'bacteriaOrder',
      bundleLabel: '検査オーダー',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_test_subtype', 'invalid_test_subtype']);
  });

  it('testOrder: hidden bodyPart が残っている場合は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: 'Test',
        items: [{ code: '160000010', name: 'Lab', quantity: '1', unit: 'count', memo: '' }],
        bodyPart: { code: '002001', name: 'Chest', quantity: '', unit: '', memo: '' },
      },
      entity: 'testOrder',
      bundleLabel: '検査オーダー',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['unsupported_body_part']);
  });

  it('otherOrder: bodyPart は front 契約で reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '文書料',
        items: [{ code: '180000210', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '002001', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'otherOrder',
      bundleLabel: 'その他',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['unsupported_body_part']);
  });

  it('otherOrder: 8系以外の main code は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '不正その他',
        items: [{ code: '700000001', name: '造影剤', quantity: '1', unit: '本', memo: '' }],
      },
      entity: 'otherOrder',
      bundleLabel: 'その他',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_other_order_code']);
  });

  it('otherOrder: 材料行は front 契約で reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: 'その他',
        items: [{ code: '180000210', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
        materialItems: [{ code: '180000211', name: '文書材料', quantity: '1', unit: '本', memo: '' }],
      },
      entity: 'otherOrder',
      bundleLabel: 'その他',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['unsupported_material_item']);
  });
});
