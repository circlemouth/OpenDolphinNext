import {
  resolveAllowedMedicalClasses,
  resolveCanonicalOrcaOrderEntity,
  resolveMedicalClassMeta,
} from './orcaMedicalClassCatalog';

export type ChargeOrderEntity = 'baseChargeOrder' | 'instractionChargeOrder';

export type ChargeClassMeta = {
  classCode: string;
  classCodeSystem: 'Claim007';
  className: string;
};

export const CHARGE_CLASS_CODE_SYSTEM: ChargeClassMeta['classCodeSystem'] = 'Claim007';

const CHARGE_ENTITIES = ['baseChargeOrder', 'instractionChargeOrder'] as const satisfies readonly ChargeOrderEntity[];

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const isChargeEntityValue = (entity?: string | null): entity is ChargeOrderEntity =>
  Boolean(entity && CHARGE_ENTITIES.includes(entity as ChargeOrderEntity));

export const normalizeChargeClassCode = (value?: string | null) => {
  const normalized = trimToNull(value);
  return normalized && resolveChargeEntityFromClassCode(normalized) ? normalized : null;
};

export const resolveChargeEntityFromClassCode = (classCode?: string | null): ChargeOrderEntity | null => {
  const normalizedClassCode = trimToNull(classCode);
  if (!normalizedClassCode) return null;
  return CHARGE_ENTITIES.find((entity) => resolveAllowedMedicalClasses(entity).includes(normalizedClassCode)) ?? null;
};

export const isChargeOrderEntity = (entity?: string | null): entity is ChargeOrderEntity =>
  isChargeEntityValue(resolveCanonicalOrcaOrderEntity(entity));

export const isChargeEntity = isChargeOrderEntity;

export const isChargeClassCompatible = (entity?: string | null, classCode?: string | null) => {
  const canonicalEntity = resolveCanonicalOrcaOrderEntity(entity);
  const normalizedClassCode = trimToNull(classCode);
  return Boolean(
    isChargeEntityValue(canonicalEntity) &&
      normalizedClassCode &&
      resolveAllowedMedicalClasses(canonicalEntity).includes(normalizedClassCode),
  );
};

export const isChargeItemCategoryCompatible = (entity?: string | null, category?: string | null) =>
  isChargeClassCompatible(entity, category);

export const deriveChargeClassCodeFromCategory = (entity: string, category?: string | null) =>
  isChargeClassCompatible(entity, category) ? trimToNull(category) ?? undefined : undefined;

export const resolveCanonicalChargeClassMeta = (params: {
  entity?: string | null;
  classCode?: string | null;
  itemCategory?: string | null;
}): ChargeClassMeta | null => {
  const canonicalEntity = resolveCanonicalOrcaOrderEntity(params.entity);
  const normalizedClassCode = trimToNull(params.classCode);
  const normalizedItemCategory = trimToNull(params.itemCategory);
  if (!isChargeEntityValue(canonicalEntity)) {
    const directMeta = resolveMedicalClassMeta(normalizedClassCode ?? normalizedItemCategory);
    return directMeta ? { ...directMeta, classCodeSystem: CHARGE_CLASS_CODE_SYSTEM } : null;
  }
  if (normalizedClassCode) {
    if (!resolveAllowedMedicalClasses(canonicalEntity).includes(normalizedClassCode)) return null;
    const meta = resolveMedicalClassMeta(normalizedClassCode);
    return meta ? { ...meta, classCodeSystem: CHARGE_CLASS_CODE_SYSTEM } : null;
  }
  if (normalizedItemCategory) {
    if (!resolveAllowedMedicalClasses(canonicalEntity).includes(normalizedItemCategory)) return null;
    const meta = resolveMedicalClassMeta(normalizedItemCategory);
    return meta ? { ...meta, classCodeSystem: CHARGE_CLASS_CODE_SYSTEM } : null;
  }
  const defaultClassCode = resolveAllowedMedicalClasses(canonicalEntity)[0];
  if (!defaultClassCode) {
    return null;
  }
  const meta = resolveMedicalClassMeta(defaultClassCode);
  return meta ? { ...meta, classCodeSystem: CHARGE_CLASS_CODE_SYSTEM } : null;
};

export const resolveCanonicalChargeClassName = (entity?: string | null, classCode?: string | null) =>
  resolveCanonicalChargeClassMeta({ entity, classCode })?.className;

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
