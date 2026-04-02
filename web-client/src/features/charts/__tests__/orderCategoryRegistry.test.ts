import { describe, expect, it } from 'vitest';

import {
  ORCA_SEND_ORDER_ENTITIES,
  resolveCanonicalOrderEntity,
  resolveOrderDockCategoryLabel,
  resolveOrderEntity,
  resolveOrderEntityDefaultClassMeta,
  resolveOrderEntityEtensuCategory,
  resolveOrderEntityLabel,
  resolveOrderEntityMasterSearchPolicy,
  resolveOrderEntityUiProfile,
  resolveOrderEntityValidationRule,
  resolveOrderGroupKeyByEntity,
} from '../orderCategoryRegistry';

describe('orderCategoryRegistry', () => {
  it('カテゴリ/エンティティ解決を一元定義で返す', () => {
    expect(resolveOrderEntityLabel('medOrder')).toBe('処方');
    expect(resolveOrderGroupKeyByEntity('medOrder')).toBe('prescription');
    expect(resolveOrderGroupKeyByEntity('laboTest')).toBe('test');
    expect(resolveOrderEntity('prescriptionOrder')).toBe('medOrder');
    expect(resolveOrderEntity('laboTest')).toBe('testOrder');
    expect(resolveOrderEntity(' laboTest ')).toBe('testOrder');
    expect(resolveCanonicalOrderEntity('laboTest')).toBe('testOrder');
    expect(resolveCanonicalOrderEntity('generalOrder')).toBe('treatmentOrder');
    expect(resolveCanonicalOrderEntity(' generalOrder ')).toBe('treatmentOrder');
    expect(resolveOrderGroupKeyByEntity('prescriptionOrder')).toBe('prescription');
    expect(resolveOrderDockCategoryLabel('charge')).toBe('算定');
  });

  it('検索・バリデーション・送信向けメタを返す', () => {
    const medUi = resolveOrderEntityUiProfile('medOrder');
    const medRule = resolveOrderEntityValidationRule('medOrder');
    const injClass = resolveOrderEntityDefaultClassMeta('injectionOrder');

    expect(medUi.defaultMasterSearchType).toBe('drug');
    expect(medRule.requiresUsage).toBe(true);
    expect(resolveOrderEntityUiProfile('injectionOrder').supportsInjectionNoProcedure).toBe(false);
    expect(injClass?.classCode).toBe('310');
    expect(resolveOrderEntityEtensuCategory('radiologyOrder')).toBe('7');
    expect(ORCA_SEND_ORDER_ENTITIES).toContain('medOrder');
    expect(ORCA_SEND_ORDER_ENTITIES).toContain('injectionOrder');
    expect(ORCA_SEND_ORDER_ENTITIES).not.toContain('laboTest');
    expect(ORCA_SEND_ORDER_ENTITIES).not.toContain('generalOrder');
  });

  it('カテゴリ差分を維持した検索ポリシーを返す', () => {
    const injectionPolicy = resolveOrderEntityMasterSearchPolicy('injectionOrder');
    const treatmentPolicy = resolveOrderEntityMasterSearchPolicy('treatmentOrder');
    const testPolicy = resolveOrderEntityMasterSearchPolicy('testOrder');
    const chargePolicy = resolveOrderEntityMasterSearchPolicy('baseChargeOrder');
    const laboPolicy = resolveOrderEntityMasterSearchPolicy('laboTest');

    expect(injectionPolicy.masterSearchPresets.map((preset) => preset.type)).toEqual(['drug', 'etensu']);
    expect(injectionPolicy.defaultMasterSearchType).toBe('drug');
    expect(injectionPolicy.etensuCategory).toBe('3');

    expect(treatmentPolicy.etensuCategory).toBe('4');
    expect(testPolicy.etensuCategory).toBe('6');
    expect(chargePolicy.etensuCategory).toBe('1');

    expect(laboPolicy).toEqual(testPolicy);
  });
});
