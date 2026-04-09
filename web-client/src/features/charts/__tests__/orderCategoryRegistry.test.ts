import { describe, expect, it } from 'vitest';

import {
  ORCA_SEND_ORDER_ENTITIES,
  normalizeOrderTestSubtype,
  resolveCanonicalOrderEntity,
  resolveOrderDockCategoryLabel,
  resolveOrderEntity,
  resolveOrderEntityDefaultClassMeta,
  resolveOrderEntityEtensuCategory,
  resolveOrderEntityPhysiologySendContractGuidance,
  resolveOrderEntityLabel,
  resolveOrderEntityMasterSearchPolicy,
  resolveOrderEntityTestSubtypeConfig,
  resolveOrderEntityUiProfile,
  resolveOrderEntityValidationRule,
  resolveOrderGroupKeyByEntity,
} from '../orderCategoryRegistry';

describe('orderCategoryRegistry', () => {
  it('normalizes aliases and group keys consistently', () => {
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

  it('returns entity specific ui, validation, and send metadata', () => {
    const medUi = resolveOrderEntityUiProfile('medOrder');
    const medRule = resolveOrderEntityValidationRule('medOrder');
    const injClass = resolveOrderEntityDefaultClassMeta('injectionOrder');
    const baseClass = resolveOrderEntityDefaultClassMeta('baseChargeOrder');
    const instructionClass = resolveOrderEntityDefaultClassMeta('instractionChargeOrder');

    expect(medUi.defaultMasterSearchType).toBe('drug');
    expect(medRule.requiresUsage).toBe(true);
    expect(resolveOrderEntityUiProfile('injectionOrder').supportsInjectionNoProcedure).toBe(false);
    expect(injClass?.classCode).toBe('310');
    expect(baseClass).toEqual({ classCode: '110', className: '初診料' });
    expect(instructionClass).toEqual({ classCode: '130', className: '管理料' });
    expect(resolveOrderEntityEtensuCategory('radiologyOrder')).toBe('7');
    expect(ORCA_SEND_ORDER_ENTITIES).toEqual([
      'medOrder',
      'injectionOrder',
      'treatmentOrder',
      'surgeryOrder',
      'testOrder',
      'radiologyOrder',
      'baseChargeOrder',
      'instractionChargeOrder',
    ]);
    expect(ORCA_SEND_ORDER_ENTITIES).not.toContain('otherOrder');
    expect(ORCA_SEND_ORDER_ENTITIES).not.toContain('physiologyOrder');
    expect(ORCA_SEND_ORDER_ENTITIES).not.toContain('bacteriaOrder');
  });

  it('returns search policy aligned with each entity', () => {
    const injectionPolicy = resolveOrderEntityMasterSearchPolicy('injectionOrder');
    const treatmentPolicy = resolveOrderEntityMasterSearchPolicy('treatmentOrder');
    const otherPolicy = resolveOrderEntityMasterSearchPolicy('otherOrder');
    const testPolicy = resolveOrderEntityMasterSearchPolicy('testOrder');
    const chargePolicy = resolveOrderEntityMasterSearchPolicy('baseChargeOrder');
    const laboPolicy = resolveOrderEntityMasterSearchPolicy('laboTest');
    const physiologyGuidance = resolveOrderEntityPhysiologySendContractGuidance('physiologyOrder');

    expect(injectionPolicy.masterSearchPresets.map((preset) => preset.type)).toEqual(['drug', 'etensu']);
    expect(injectionPolicy.defaultMasterSearchType).toBe('drug');
    expect(injectionPolicy.etensuCategory).toBe('3');
    expect(treatmentPolicy.etensuCategory).toBe('4');
    expect(otherPolicy.masterSearchPresets.map((preset) => preset.type)).toEqual(['etensu']);
    expect(otherPolicy.defaultMasterSearchType).toBe('etensu');
    expect(otherPolicy.etensuCategory).toBeUndefined();
    expect(resolveOrderEntityUiProfile('otherOrder').supportsBodyPartSearch).toBe(false);
    expect(testPolicy.etensuCategory).toBe('6');
    expect(chargePolicy.etensuCategory).toBe('1');
    expect(laboPolicy).toEqual(testPolicy);
    expect(physiologyGuidance).toEqual(
      expect.objectContaining({
        blocked: true,
        reason: expect.stringContaining('fail-closed'),
      }),
    );
  });

  it('exposes class 600 subtype config by entity', () => {
    const specimen = resolveOrderEntityTestSubtypeConfig('testOrder');
    const physiology = resolveOrderEntityTestSubtypeConfig('physiologyOrder');
    const bacteria = resolveOrderEntityTestSubtypeConfig('bacteriaOrder');
    const testUi = resolveOrderEntityUiProfile('testOrder');

    expect(specimen?.readOnly).toBe(true);
    expect(specimen?.defaultValue).toBe('specimen');
    expect(specimen?.helpText).toContain('bundle 共通');
    expect(physiology?.readOnly).toBe(true);
    expect(physiology?.defaultValue).toBe('physiology');
    expect(physiology?.helpText).toContain('保存');
    expect(physiology?.helpText).toContain('表示');
    expect(physiology?.helpText).toContain('ORCA送信');
    expect(physiology?.helpText).toMatch(/(explicit block|停止|使いません|block)/);
    expect(bacteria?.required).toBe(true);
    expect(bacteria?.helpText).toContain('local-only');
    expect(bacteria?.options.map((option) => option.value)).toEqual(['culture', 'sensitivity']);
    expect(testUi.instructionLabel).toBe('検査指示（院内）');
    expect(testUi.memoLabel).toBe('検査メモ（院内）');
  });

  it('normalizes class 600 subtype by entity contract', () => {
    expect(normalizeOrderTestSubtype('testOrder', undefined)).toBe('specimen');
    expect(normalizeOrderTestSubtype('physiologyOrder', 'PHYSIOLOGY')).toBe('physiology');
    expect(normalizeOrderTestSubtype('bacteriaOrder', 'culture')).toBe('culture');
    expect(normalizeOrderTestSubtype('bacteriaOrder', 'invalid')).toBeUndefined();
  });
});
