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

  it('treatmentOrder: 項目が必須で、用法は必須にしない', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        admin: '',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'treatmentOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues).toHaveLength(0);
  });

  it('treatmentOrder: コードあり/なし混在は明示的にブロックする', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [
          { code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' },
          { code: '', name: '未コード行', quantity: '1', unit: '回', memo: '' },
        ],
      },
      entity: 'treatmentOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['mixed_coded_uncoded']);
  });

  it('treatmentOrder: コードなし行のみは明示的にブロックする', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '', name: '未コード行', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'treatmentOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['uncoded_row']);
  });

  it('treatmentOrder: コメントだけの束は保存前に止める', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [],
        commentItems: [{ code: '0081', name: 'コメント', quantity: '', unit: '', memo: '注意' }],
      },
      entity: 'treatmentOrder',
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

  it('treatmentOrder: オーダー名が未入力でも項目があればエラーにしない', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'treatmentOrder',
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

  it('injectionOrder: 投与指示が未入力でも本体コード行があれば保存可能', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '',
        adminCode: '',
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

  it('injectionOrder: adminCode なしの自由入力用法も local-only として保存できる', () => {
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
    expect(issues).toHaveLength(0);
  });

  it('injectionOrder: allowlist 外 classCode は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '静注',
        adminCode: '4101',
        classCode: '399',
        items: [{ code: '620000001', name: 'ビタミン注射', quantity: '1', unit: '回', memo: '' }],
      } as BundleFormState & { classCode: string },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_injection_class_code']);
  });

  it('injectionOrder: 投与指示だけでも local-only 保存を阻害しない', () => {
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
    expect(issues).toHaveLength(0);
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
    expect(issues.map((issue) => issue.key)).toEqual(['missing_main_row']);
  });

  it('injectionOrder: coded main + uncoded material は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '静注',
        adminCode: '4101',
        items: [{ code: '620000001', name: '注射薬A', quantity: '1', unit: 'A', memo: '' }],
        materialItems: [{ code: '', name: '未コード材料', quantity: '1', unit: '式', memo: '' }],
      },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['mixed_coded_uncoded']);
  });

  it('injectionOrder: 材料だけの束は保存前に止める', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        admin: '静注',
        adminCode: '4101',
        materialItems: [{ code: '700000031', name: 'ドリップセット', quantity: '1', unit: '式', memo: '' }],
      },
      entity: 'injectionOrder',
      bundleLabel: '注射オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_main_row']);
  });

  it('radiologyOrder: classCode 700 では部位が未入力だとエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '胸部撮影',
        classCode: '700',
        items: [{ code: '700000001', name: '胸部X線', quantity: '1', unit: '回', memo: '' }],
        bodyPart: null,
      },
      entity: 'radiologyOrder',
      bundleLabel: '画像診断オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_body_part']);
  });

  it('radiologyOrder: 部位が入力済みならエラーなし', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '胸部撮影',
        classCode: '700',
        items: [{ code: '700000001', name: '胸部X線', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '002000', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'radiologyOrder',
      bundleLabel: '画像診断オーダー名',
    });
    expect(issues).toHaveLength(0);
  });

  it('radiologyOrder: 部位コードが欠ける場合はエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '胸部撮影',
        classCode: '700',
        items: [{ code: '700000001', name: '胸部X線', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'radiologyOrder',
      bundleLabel: '画像診断オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['missing_body_part_code']);
  });

  it('radiologyOrder: 002 以外の部位コードはエラー', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '胸部撮影',
        classCode: '700',
        items: [{ code: '700000001', name: '胸部X線', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '001001', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'radiologyOrder',
      bundleLabel: '画像診断オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_body_part_code']);
  });

  it('otherOrder: bodyPart を保存前に reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
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
      entity: 'treatmentOrder',
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
      entity: 'treatmentOrder',
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
      entity: 'treatmentOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues).toHaveLength(0);
  });

  it('materialItems: コードなし材料行は混在エラーとして保存前に止める', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        materialItems: [{ name: '', quantity: '1', unit: '枚', memo: '' }],
      },
      entity: 'treatmentOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['mixed_coded_uncoded']);
  });

  it('materialItems: 行を削除するとエラーが解消される', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        materialItems: [],
      },
      entity: 'treatmentOrder',
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

  it('physiologyOrder: bodyPart は保存前に reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: 'Physiology',
        subtype: 'physiology' as BundleFormState['subtype'],
        items: [{ code: '160000010', name: '生理検査', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '002001', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'physiologyOrder',
      bundleLabel: '生理検査オーダー',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['unsupported_body_part']);
  });

  it('otherOrder: bodyPart は front 契約で reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '文書料',
        items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
        bodyPart: { code: '002001', name: '胸部', quantity: '', unit: '', memo: '' },
      },
      entity: 'otherOrder',
      bundleLabel: 'その他',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['unsupported_body_part']);
  });

  it('otherOrder: explicit local-only code だけを保存できる', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '文書料',
        items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
      },
      entity: 'otherOrder',
      bundleLabel: 'その他',
    });
    expect(issues).toHaveLength(0);
  });

  it('otherOrder: old numeric shape は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '不正その他',
        items: [{ code: '912345678', name: '9系コード', quantity: '1', unit: '本', memo: '' }],
      },
      entity: 'otherOrder',
      bundleLabel: 'その他',
    });
    expect(issues.map((issue) => issue.key)).toContain('invalid_other_order_code');
  });

  it('otherOrder: classCode を保持しようとすると保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '文書料',
        classCode: '8A0',
        items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
      } as BundleFormState & { classCode: string },
      entity: 'otherOrder',
      bundleLabel: 'その他',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_other_order_class_code']);
  });

  it('testOrder: exact allowlist 外 classCode は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '検査',
        classCode: '640',
        items: [{ code: '160000010', name: 'Lab', quantity: '1', unit: 'count', memo: '' }],
      } as BundleFormState & { classCode: string },
      entity: 'testOrder',
      bundleLabel: '検査オーダー',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_class_code']);
  });

  it('surgeryOrder: 501/502 は standalone material のみでも保存前 block しない', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '手術材料',
        classCode: '501',
        materialItems: [{ code: '700000031', name: '縫合糸', quantity: '1', unit: '本', memo: '' }],
      } as BundleFormState & { classCode: string },
      entity: 'surgeryOrder',
      bundleLabel: '手術オーダー',
    });
    expect(issues).toHaveLength(0);
  });

  it('otherOrder: 材料行は front 契約で reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: 'その他',
        items: [{ code: 'LOCAL_OTHER:CERTIFICATE_FEE', name: '診断書料', quantity: '1', unit: '回', memo: '' }],
        materialItems: [{ code: 'LOCAL_OTHER:MATERIAL', name: '文書材料', quantity: '1', unit: '本', memo: '' }],
      },
      entity: 'otherOrder',
      bundleLabel: 'その他',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['unsupported_material_item']);
  });

  it('materialItems: non-sendable code は保存前に block する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '処置オーダー',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        materialItems: [{ code: 'M001', name: '処置材料A', quantity: '1', unit: '個', memo: '' }],
      },
      entity: 'generalOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toEqual(['invalid_material_code']);
  });

  it('baseChargeOrder: classCode 130 を reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '基本料',
        classCode: '130',
        items: [{ code: '110000110', name: '初診料', quantity: '1', unit: '回', memo: '', masterCategory: '110' }],
      } as BundleFormState & { classCode: string },
      entity: 'baseChargeOrder',
      bundleLabel: '算定',
    });
    expect(issues.map((issue) => issue.key)).toContain('invalid_charge_class_code');
  });

  it('baseChargeOrder: main row の masterCategory 130 を reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '基本料',
        classCode: '110',
        items: [{ code: '112007410', name: '在宅自己注射指導管理料', quantity: '1', unit: '回', memo: '', masterCategory: '130' }],
      } as BundleFormState & { classCode: string },
      entity: 'baseChargeOrder',
      bundleLabel: '算定',
    });
    expect(issues.map((issue) => issue.key)).toContain('invalid_charge_item_category');
  });

  it('instractionChargeOrder: canonical className を導出できる場合は空の className を許可する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '指導料',
        classCode: '130',
        className: '',
        items: [{ code: '112007410', name: '在宅自己注射指導管理料', quantity: '1', unit: '回', memo: '', masterCategory: '130' }],
      } as BundleFormState & { classCode: string; className: string },
      entity: 'instractionChargeOrder',
      bundleLabel: '算定',
    });
    expect(issues.map((issue) => issue.key)).not.toContain('missing_charge_class_name');
  });

  it('baseChargeOrder: canonical と一致しない className を reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: '基本料',
        classCode: '120',
        className: '医学管理等',
        items: [{ code: '110000110', name: '初診料', quantity: '1', unit: '回', memo: '', masterCategory: '120' }],
      } as BundleFormState & { classCode: string; className: string },
      entity: 'baseChargeOrder',
      bundleLabel: '算定',
    });
    expect(issues.map((issue) => issue.key)).toContain('invalid_charge_class_name');
  });

  it('parameter 付き選択式コメントは保存前に reject する', () => {
    const issues = validateBundleForm({
      form: {
        ...baseForm,
        bundleName: 'コメント付き処置',
        items: [{ code: '140000001', name: '処置A', quantity: '1', unit: '回', memo: '' }],
        commentItems: [
          {
            code: '0082',
            name: '服薬指示',
            quantity: '',
            unit: '',
            memo: '',
            selectionCommentItemNumber: '0166',
            selectionCommentItemNumberBranch: '01',
          },
        ],
      } as BundleFormState & {
        commentItems: Array<BundleFormState['commentItems'][number] & {
          selectionCommentItemNumber: string;
          selectionCommentItemNumberBranch: string;
        }>;
      },
      entity: 'treatmentOrder',
      bundleLabel: 'オーダー名',
    });
    expect(issues.map((issue) => issue.key)).toContain('unsupported_selection_comment_parameter');
  });
});
