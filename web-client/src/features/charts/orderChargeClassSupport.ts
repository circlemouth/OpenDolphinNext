import {
  isOrcaEntityClassAllowed,
  normalizeOrcaClassCode,
  resolveCanonicalOrcaClassName,
  resolveOrcaDefaultClassMeta,
  resolveOrcaEntityFromClassCode,
} from './orcaMedicalClassCatalog';

export type ChargeOrderEntity = 'baseChargeOrder' | 'instractionChargeOrder';

export type ChargeClassMeta = {
  classCode: string;
  classCodeSystem: 'Claim007';
  className: string;
};

export const CHARGE_CLASS_CODE_SYSTEM: ChargeClassMeta['classCodeSystem'] = 'Claim007';

const isChargeOrderEntityValue = (entity?: string | null): entity is ChargeOrderEntity =>
  entity === 'baseChargeOrder' || entity === 'instractionChargeOrder';

export const resolveChargeEntityFromClassCode = (classCode?: string | null): ChargeOrderEntity | null => {
  const resolved = resolveOrcaEntityFromClassCode(classCode);
  return isChargeOrderEntityValue(resolved) ? resolved : null;
};

export const isChargeOrderEntity = (entity?: string | null): entity is ChargeOrderEntity =>
  isChargeOrderEntityValue(entity);

export const isChargeEntity = isChargeOrderEntity;

export const isChargeClassCompatible = (entity?: string | null, classCode?: string | null) =>
  isChargeOrderEntity(entity) && isOrcaEntityClassAllowed(entity, classCode);

export const isChargeItemCategoryCompatible = (entity?: string | null, category?: string | null) =>
  isChargeClassCompatible(entity, category);

export const deriveChargeClassCodeFromCategory = (entity: string, category?: string | null) => {
  if (!isChargeOrderEntity(entity)) return undefined;
  const normalizedCategory = normalizeOrcaClassCode(category);
  return normalizedCategory && isChargeClassCompatible(entity, normalizedCategory) ? normalizedCategory : undefined;
};

export const resolveCanonicalChargeClassName = (entity?: string | null, classCode?: string | null) => {
  if (!isChargeOrderEntity(entity)) {
    const resolvedEntity = resolveChargeEntityFromClassCode(classCode);
    return resolvedEntity ? resolveOrcaDefaultClassMeta(resolvedEntity)?.className : undefined;
  }
  return resolveCanonicalOrcaClassName(entity, classCode);
};

export const resolveCanonicalChargeClassMeta = (params: {
  entity?: string | null;
  classCode?: string | null;
  itemCategory?: string | null;
}): ChargeClassMeta | null => {
  const entity = params.entity;
  if (isChargeOrderEntity(entity)) {
    const defaultMeta = resolveOrcaDefaultClassMeta(entity);
    if (!defaultMeta) return null;
    const candidateClassCode =
      deriveChargeClassCodeFromCategory(entity, params.itemCategory) ??
      (isChargeClassCompatible(entity, params.classCode) ? normalizeOrcaClassCode(params.classCode) : undefined);
    return {
      classCode: candidateClassCode ?? defaultMeta.classCode,
      classCodeSystem: CHARGE_CLASS_CODE_SYSTEM,
      className: defaultMeta.className,
    };
  }

  const resolvedEntity = resolveChargeEntityFromClassCode(params.classCode);
  if (!resolvedEntity) return null;
  const defaultMeta = resolveOrcaDefaultClassMeta(resolvedEntity);
  const classCode = normalizeOrcaClassCode(params.classCode);
  if (!defaultMeta || !classCode) return null;
  return {
    classCode,
    classCodeSystem: CHARGE_CLASS_CODE_SYSTEM,
    className: defaultMeta.className,
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
  const hasChargeClassSource = Boolean(normalizeOrcaClassCode(value.classCode));
  if (!hasChargeClassSource) return value;
  const canonical = resolveCanonicalChargeClassMeta({ entity: value.entity, classCode: value.classCode });
  if (!canonical) return value;
  return {
    ...value,
    classCode: canonical.classCode,
    classCodeSystem: canonical.classCodeSystem,
    className: canonical.className,
  };
};
