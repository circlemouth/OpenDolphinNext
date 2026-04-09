import { getAllowedClassCodesForEntity } from './orcaMedicalClassCatalog';

export type ChargeOrderEntity = 'baseChargeOrder' | 'instractionChargeOrder';

export type ChargeClassMeta = {
  classCode: string;
  classCodeSystem: 'Claim007';
  className: string;
};

type ChargeRule = {
  entity: ChargeOrderEntity;
  defaultClassCode: string;
  className: string;
  allowedClassCodes: readonly string[];
};

export const CHARGE_CLASS_CODE_SYSTEM: ChargeClassMeta['classCodeSystem'] = 'Claim007';

const CHARGE_RULES: readonly ChargeRule[] = [
  {
    entity: 'baseChargeOrder',
    defaultClassCode: '110',
    className: '基本診療料',
    allowedClassCodes: getAllowedClassCodesForEntity('baseChargeOrder'),
  },
  {
    entity: 'instractionChargeOrder',
    defaultClassCode: '130',
    className: '医学管理等',
    allowedClassCodes: getAllowedClassCodesForEntity('instractionChargeOrder'),
  },
] as const;

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseClassCode = (value?: string | null) => {
  const normalized = trimToNull(value);
  if (!normalized || !/^\d+$/.test(normalized)) return null;
  return Number.parseInt(normalized, 10);
};

export const normalizeChargeClassCode = (value?: string | null) => {
  const parsed = parseClassCode(value);
  return parsed === null ? null : trimToNull(value);
};

const findChargeRuleByCode = (value?: string | null) => {
  const normalized = trimToNull(value);
  if (!normalized) return null;
  return CHARGE_RULES.find((rule) => rule.allowedClassCodes.includes(normalized)) ?? null;
};

const findChargeRuleByEntity = (entity?: string | null) => {
  const normalized = trimToNull(entity);
  if (!normalized) return null;
  return CHARGE_RULES.find((rule) => rule.entity === normalized) ?? null;
};

export const resolveChargeEntityFromClassCode = (classCode?: string | null): ChargeOrderEntity | null =>
  findChargeRuleByCode(classCode)?.entity ?? null;

export const isChargeOrderEntity = (entity?: string | null): entity is ChargeOrderEntity =>
  Boolean(findChargeRuleByEntity(entity));

export const isChargeEntity = isChargeOrderEntity;

export const isChargeClassCompatible = (entity?: string | null, classCode?: string | null) => {
  const rule = findChargeRuleByEntity(entity);
  if (!rule) return false;
  return resolveChargeEntityFromClassCode(classCode) === rule.entity;
};

export const isChargeItemCategoryCompatible = (entity?: string | null, category?: string | null) =>
  isChargeClassCompatible(entity, category);

export const deriveChargeClassCodeFromCategory = (entity: string, category?: string | null) => {
  const rule = findChargeRuleByEntity(entity);
  if (!rule) return undefined;
  const normalized = trimToNull(category);
  if (!normalized || !/^\d+$/.test(normalized)) return undefined;
  if (!rule.allowedClassCodes.includes(normalized)) return undefined;
  return normalized;
};

export const resolveCanonicalChargeClassName = (entity?: string | null, classCode?: string | null) => {
  const explicitRule = findChargeRuleByCode(classCode);
  if (explicitRule && isChargeOrderEntity(entity) && explicitRule.entity !== entity) {
    return undefined;
  }
  return explicitRule?.className ?? findChargeRuleByEntity(entity)?.className;
};

export const resolveCanonicalChargeClassMeta = (params: {
  entity?: string | null;
  classCode?: string | null;
  itemCategory?: string | null;
}): ChargeClassMeta | null => {
  const entityRule = findChargeRuleByEntity(params.entity);
  if (entityRule) {
    const categoryRule = findChargeRuleByCode(params.itemCategory);
    if (categoryRule?.entity === entityRule.entity) {
      return {
        classCode: trimToNull(params.itemCategory) ?? categoryRule.defaultClassCode,
        classCodeSystem: CHARGE_CLASS_CODE_SYSTEM,
        className: entityRule.className,
      };
    }
    const codeRule = findChargeRuleByCode(params.classCode);
    const effectiveRule = codeRule?.entity === entityRule.entity ? codeRule : entityRule;
    const effectiveClassCode = codeRule?.entity === entityRule.entity
      ? trimToNull(params.classCode) ?? effectiveRule.defaultClassCode
      : effectiveRule.defaultClassCode;
    return {
      classCode: effectiveClassCode,
      classCodeSystem: CHARGE_CLASS_CODE_SYSTEM,
      className: effectiveRule.className,
    };
  }
  const codeRule = findChargeRuleByCode(params.classCode);
  if (!codeRule) return null;
  return {
    classCode: trimToNull(params.classCode) ?? codeRule.defaultClassCode,
    classCodeSystem: CHARGE_CLASS_CODE_SYSTEM,
    className: codeRule.className,
  };
};

export const resolveChargeClassMetaFromItemCategory = (entity?: string | null, category?: string | null) =>
  resolveCanonicalChargeClassMeta({ entity, itemCategory: category });

export const canonicalizeChargeBundleMeta = <
  T extends {
    entity?: string | null;
    classCode?: string | null;
    classCodeSystem?: string | null;
    className?: string | null;
  },
>(
  value: T,
): T => {
  const canonical = resolveCanonicalChargeClassMeta({ entity: value.entity, classCode: value.classCode });
  if (!canonical) return value;
  return {
    ...value,
    classCode: canonical.classCode,
    classCodeSystem: canonical.classCodeSystem,
    className: canonical.className,
  };
};
