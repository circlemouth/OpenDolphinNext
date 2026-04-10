import { describe, expect, it } from 'vitest';

import {
  ORCA_SEND_ORDER_ENTITIES,
  normalizeOrderTestSubtype,
  resolveCanonicalOrderEntity,
  resolveCanonicalChargeClassMeta,
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
import { resolveCanonicalChargeClassMeta as resolveCanonicalChargeClassMetaRaw } from '../orcaMedicalClassCatalog';

describe('orderCategoryRegistry', () => {
  it('normalizes aliases and group keys consistently', () => {
    expect(resolveOrderEntityLabel('medOrder')).toBe('\u51e6\u65b9');
    expect(resolveOrderGroupKeyByEntity('medOrder')).toBe('prescription');
    expect(resolveOrderGroupKeyByEntity('laboTest')).toBe('test');
    expect(resolveOrderEntity('prescriptionOrder')).toBe('medOrder');
    expect(resolveOrderEntity('laboTest')).toBe('testOrder');
    expect(resolveOrderEntity(' laboTest ')).toBe('testOrder');
    expect(resolveCanonicalOrderEntity('laboTest')).toBe('testOrder');
    expect(resolveCanonicalOrderEntity('instructionChargeOrder')).toBe('instractionChargeOrder');
    expect(resolveCanonicalOrderEntity('generalOrder')).toBe('treatmentOrder');
    expect(resolveCanonicalOrderEntity(' generalOrder ')).toBe('treatmentOrder');
    expect(resolveOrderGroupKeyByEntity('prescriptionOrder')).toBe('prescription');
    expect(resolveOrderDockCategoryLabel('charge')).toBe('\u7b97\u5b9a');
  });

  it('returns entity specific ui, validation, and send metadata', () => {
    const medUi = resolveOrderEntityUiProfile('medOrder');
    const medRule = resolveOrderEntityValidationRule('medOrder');
    const injClass = resolveOrderEntityDefaultClassMeta('injectionOrder');
    const baseClass = resolveOrderEntityDefaultClassMeta('baseChargeOrder');
    const instructionClass = resolveOrderEntityDefaultClassMeta('instractionChargeOrder');
    const physiologyClass = resolveOrderEntityDefaultClassMeta('physiologyOrder');
    const radiologyClass = resolveOrderEntityDefaultClassMeta('radiologyOrder');

    expect(medUi.defaultMasterSearchType).toBe('drug');
    expect(medRule.requiresUsage).toBe(true);
    expect(resolveOrderEntityUiProfile('injectionOrder').supportsInjectionNoProcedure).toBe(false);
    expect(injClass?.classCode).toBe('310');
    expect(baseClass).toEqual({ classCode: '110', classCodeSystem: 'Claim007', className: '\u57fa\u672c\u8a3a\u7642\u6599' });
    expect(instructionClass).toEqual({ classCode: '130', classCodeSystem: 'Claim007', className: '\u533b\u5b66\u7ba1\u7406\u7b49' });
    expect(physiologyClass).toEqual({ classCode: '600', className: '\u691c\u67fb' });
    expect(radiologyClass).toEqual({ classCode: '700', className: '\u753b\u50cf\u8a3a\u65ad' });
    expect(resolveOrderEntityEtensuCategory('radiologyOrder')).toBe('7');
    expect([...ORCA_SEND_ORDER_ENTITIES].sort()).toEqual(
      [
        'medOrder',
        'injectionOrder',
        'treatmentOrder',
        'surgeryOrder',
        'testOrder',
        'radiologyOrder',
        'baseChargeOrder',
        'instractionChargeOrder',
      ].sort(),
    );
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
    expect(specimen?.label).toBe('\u0036\u0030\u0030\u7cfb subtype');
    expect(specimen?.helpText).toContain('specimen');
    expect(specimen?.helpText).toContain('bundle');
    expect(specimen?.helpText).toContain('local-only');
    expect(specimen?.options.map((option) => option.value)).toEqual(['specimen']);

    expect(physiology?.readOnly).toBe(true);
    expect(physiology?.defaultValue).toBe('physiology');
    expect(physiology?.label).toBe('\u751f\u7406\u691c\u67fb subtype');
    expect(physiology?.helpText).toContain('explicit block');
    expect(physiology?.helpText).toContain('bodyPart');
    expect(physiology?.helpText).toContain('ORCA');
    expect(physiology?.options.map((option) => option.value)).toEqual(['physiology']);

    expect(bacteria?.required).toBe(true);
    expect(bacteria?.label).toBe('\u7d30\u83cc\u691c\u67fb subtype');
    expect(bacteria?.helpText).toContain('local-only');
    expect(bacteria?.helpText).toContain('carrier');
    expect(bacteria?.helpText).toContain('block');
    expect(bacteria?.options.map((option) => option.value)).toEqual(['culture', 'sensitivity']);
    expect(testUi.instructionLabel).toBe('\u691c\u67fb\u6307\u793a\uff08\u9662\u5185\uff09');
    expect(testUi.memoLabel).toBe('\u691c\u67fb\u30e1\u30e2\uff08\u9662\u5185\uff09');
  });

  it('normalizes class 600 subtype by entity contract', () => {
    expect(normalizeOrderTestSubtype('testOrder', undefined)).toBe('specimen');
    expect(normalizeOrderTestSubtype('physiologyOrder', 'PHYSIOLOGY')).toBe('physiology');
    expect(normalizeOrderTestSubtype('bacteriaOrder', 'culture')).toBe('culture');
    expect(normalizeOrderTestSubtype('bacteriaOrder', 'invalid')).toBeUndefined();
  });

  it('keeps charge canonical meta fail-closed for invalid explicit input and preserves valid explicit mappings', () => {
    expect(resolveCanonicalChargeClassMetaRaw({ entity: 'baseChargeOrder', classCode: '130' })).toBeNull();
    expect(resolveCanonicalChargeClassMetaRaw({ entity: 'instractionChargeOrder', itemCategory: '110' })).toBeNull();
    expect(resolveCanonicalChargeClassMetaRaw({ entity: 'baseChargeOrder', classCode: '120', itemCategory: '110' })).toBeNull();
    expect(resolveCanonicalChargeClassMetaRaw({ entity: 'instractionChargeOrder', classCode: '140', itemCategory: '130' })).toBeNull();
    expect(resolveCanonicalChargeClassMetaRaw({ entity: 'baseChargeOrder', classCode: '120' })).toEqual({
      classCode: '120',
      classCodeSystem: 'Claim007',
      className: '\u57fa\u672c\u8a3a\u7642\u6599',
    });
    expect(resolveCanonicalChargeClassMetaRaw({ entity: 'instractionChargeOrder', classCode: '140', itemCategory: '140' })).toEqual({
      classCode: '140',
      classCodeSystem: 'Claim007',
      className: '\u533b\u5b66\u7ba1\u7406\u7b49',
    });
    expect(resolveCanonicalChargeClassMeta({ entity: 'baseChargeOrder' })).toBeUndefined();
    expect(resolveCanonicalChargeClassMeta({ entity: 'instractionChargeOrder' })).toBeUndefined();
  });
});
