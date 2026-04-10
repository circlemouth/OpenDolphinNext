export type CanonicalOrcaOrderEntity =
  | 'medOrder'
  | 'injectionOrder'
  | 'treatmentOrder'
  | 'surgeryOrder'
  | 'otherOrder'
  | 'testOrder'
  | 'physiologyOrder'
  | 'bacteriaOrder'
  | 'radiologyOrder'
  | 'baseChargeOrder'
  | 'instractionChargeOrder';

export type OrcaOrderEntity = CanonicalOrcaOrderEntity | 'laboTest' | 'prescriptionOrder' | 'generalOrder' | 'instructionChargeOrder';

export type OrcaEntityClassMeta = {
  classCode: string;
  className: string;
};

export type OrcaResolvedClassMeta = OrcaEntityClassMeta & {
  entity: CanonicalOrcaOrderEntity;
};

export type ChargeOrderEntity = Extract<CanonicalOrcaOrderEntity, 'baseChargeOrder' | 'instractionChargeOrder'>;

export type ChargeClassMeta = OrcaEntityClassMeta & {
  classCodeSystem: 'Claim007';
};

type OrcaEntityContract = {
  label: string;
  defaultClassMeta?: OrcaEntityClassMeta;
  allowedClassCodes?: readonly string[];
  bodyPartAllowedClassCodes?: readonly string[];
  classCodeRequired: boolean;
  sendable: boolean;
  localOnly?: boolean;
  importOnly?: boolean;
};

const EXACT_MED_CLASS_CODES = ['211', '212', '221', '222', '231', '232'] as const;
const EXACT_INJECTION_CLASS_CODES = ['310', '311', '312', '320', '321', '330', '331', '334', '340', '350'] as const;
const EXACT_TREATMENT_CLASS_CODES = ['400', '401', '402', '403', '409'] as const;
const EXACT_SURGERY_CLASS_CODES = ['500', '501', '502', '510'] as const;
const EXACT_TEST_CLASS_CODES = ['600', '601', '602', '603', '610'] as const;
const EXACT_RADIOLOGY_CLASS_CODES = ['700', '701', '702', '703', '704', '731', '732'] as const;
const EXACT_BASE_CHARGE_CLASS_CODES = ['110', '114', '120', '124'] as const;
const EXACT_INSTRUCTION_CHARGE_CLASS_CODES = ['130', '132', '133', '140', '141', '142', '143', '148', '149'] as const;

const ENTITY_ALIASES: Record<string, CanonicalOrcaOrderEntity> = {
  prescriptionOrder: 'medOrder',
  medOrder: 'medOrder',
  injectionOrder: 'injectionOrder',
  treatmentOrder: 'treatmentOrder',
  surgeryOrder: 'surgeryOrder',
  otherOrder: 'otherOrder',
  testOrder: 'testOrder',
  laboTest: 'testOrder',
  physiologyOrder: 'physiologyOrder',
  bacteriaOrder: 'bacteriaOrder',
  radiologyOrder: 'radiologyOrder',
  baseChargeOrder: 'baseChargeOrder',
  instractionChargeOrder: 'instractionChargeOrder',
  instructionChargeOrder: 'instractionChargeOrder',
  generalOrder: 'treatmentOrder',
} as const;

const ENTITY_CONTRACTS: Record<CanonicalOrcaOrderEntity, OrcaEntityContract> = {
  medOrder: {
    label: '処方',
    defaultClassMeta: { classCode: '212', className: '処方' },
    allowedClassCodes: EXACT_MED_CLASS_CODES,
    classCodeRequired: true,
    sendable: true,
  },
  injectionOrder: {
    label: '注射',
    defaultClassMeta: { classCode: '310', className: '注射' },
    allowedClassCodes: EXACT_INJECTION_CLASS_CODES,
    classCodeRequired: true,
    sendable: true,
  },
  treatmentOrder: {
    label: '処置',
    defaultClassMeta: { classCode: '400', className: '処置' },
    allowedClassCodes: EXACT_TREATMENT_CLASS_CODES,
    classCodeRequired: true,
    sendable: true,
  },
  surgeryOrder: {
    label: '手術',
    defaultClassMeta: { classCode: '500', className: '手術' },
    allowedClassCodes: EXACT_SURGERY_CLASS_CODES,
    classCodeRequired: true,
    sendable: true,
  },
  otherOrder: {
    label: 'その他',
    classCodeRequired: false,
    sendable: false,
    localOnly: true,
  },
  testOrder: {
    label: '検査',
    defaultClassMeta: { classCode: '600', className: '検査' },
    allowedClassCodes: EXACT_TEST_CLASS_CODES,
    classCodeRequired: true,
    sendable: true,
  },
  physiologyOrder: {
    label: '生理検査',
    defaultClassMeta: { classCode: '600', className: '検査' },
    allowedClassCodes: ['600'],
    classCodeRequired: true,
    sendable: false,
    importOnly: true,
  },
  bacteriaOrder: {
    label: '細菌検査',
    defaultClassMeta: { classCode: '600', className: '検査' },
    allowedClassCodes: ['600'],
    classCodeRequired: true,
    sendable: false,
    localOnly: true,
  },
  radiologyOrder: {
    label: '画像診断',
    defaultClassMeta: { classCode: '700', className: '画像診断' },
    allowedClassCodes: EXACT_RADIOLOGY_CLASS_CODES,
    bodyPartAllowedClassCodes: ['700'],
    classCodeRequired: true,
    sendable: true,
  },
  baseChargeOrder: {
    label: '基本料',
    defaultClassMeta: { classCode: '110', className: '基本診療料' },
    allowedClassCodes: EXACT_BASE_CHARGE_CLASS_CODES,
    classCodeRequired: true,
    sendable: true,
  },
  instractionChargeOrder: {
    label: '指導料',
    defaultClassMeta: { classCode: '130', className: '医学管理等' },
    allowedClassCodes: EXACT_INSTRUCTION_CHARGE_CLASS_CODES,
    classCodeRequired: true,
    sendable: true,
  },
};

const CLASS_META_BY_CODE = new Map<string, OrcaResolvedClassMeta>();

for (const [entity, contract] of Object.entries(ENTITY_CONTRACTS) as Array<[CanonicalOrcaOrderEntity, OrcaEntityContract]>) {
  const defaultClassMeta = contract.defaultClassMeta;
  if (!defaultClassMeta) continue;
  for (const classCode of contract.allowedClassCodes ?? [defaultClassMeta.classCode]) {
    if (!CLASS_META_BY_CODE.has(classCode)) {
      CLASS_META_BY_CODE.set(classCode, {
        entity,
        classCode,
        className: defaultClassMeta.className,
      });
    }
  }
}

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const CHARGE_CLASS_CODE_SYSTEM: ChargeClassMeta['classCodeSystem'] = 'Claim007';

export const resolveCanonicalOrcaOrderEntity = (value?: string | null): CanonicalOrcaOrderEntity | null => {
  const normalized = trimToNull(value);
  if (!normalized) return null;
  return ENTITY_ALIASES[normalized] ?? null;
};

export const resolveOrcaEntityContract = (value?: string | null): OrcaEntityContract | null => {
  const canonical = resolveCanonicalOrcaOrderEntity(value);
  return canonical ? ENTITY_CONTRACTS[canonical] : null;
};

export const resolveOrcaEntityLabel = (value?: string | null): string | undefined =>
  resolveOrcaEntityContract(value)?.label;

export const resolveOrcaDefaultClassMeta = (value?: string | null): OrcaEntityClassMeta | undefined => {
  const meta = resolveOrcaEntityContract(value)?.defaultClassMeta;
  return meta ? { ...meta } : undefined;
};

export const normalizeOrcaClassCode = (value?: string | null) => trimToNull(value) ?? undefined;

export const requiresOrcaClassCode = (value?: string | null) => {
  const contract = resolveOrcaEntityContract(value);
  return Boolean(contract?.classCodeRequired);
};

export const resolveOrcaClassMetaByCode = (classCode?: string | null): OrcaResolvedClassMeta | undefined => {
  const normalized = trimToNull(classCode);
  if (!normalized) return undefined;
  const meta = CLASS_META_BY_CODE.get(normalized);
  return meta ? { ...meta } : undefined;
};

export const resolveOrcaEntityFromClassCode = (classCode?: string | null): CanonicalOrcaOrderEntity | null =>
  resolveOrcaClassMetaByCode(classCode)?.entity ?? null;

export const isOrcaClassCodeCompatible = (value?: string | null, classCode?: string | null) => {
  const contract = resolveOrcaEntityContract(value);
  const normalizedClassCode = trimToNull(classCode);
  if (!contract) return false;
  if (normalizedClassCode == null) {
    return !requiresOrcaClassCode(value);
  }
  if (!contract.allowedClassCodes) return false;
  return contract.allowedClassCodes.includes(normalizedClassCode);
};

export const isOrcaEntityClassAllowed = (value?: string | null, classCode?: string | null) => {
  const normalizedClassCode = trimToNull(classCode);
  return normalizedClassCode != null && isOrcaClassCodeCompatible(value, normalizedClassCode);
};

export const supportsOrcaBodyPartField = (value?: string | null, classCode?: string | null) => {
  const contract = resolveOrcaEntityContract(value);
  const normalizedClassCode = trimToNull(classCode);
  if (!contract?.bodyPartAllowedClassCodes || !normalizedClassCode) return false;
  return contract.bodyPartAllowedClassCodes.includes(normalizedClassCode);
};

export const supportsBodyPartForEntityClass = (value?: string | null, classCode?: string | null) =>
  supportsOrcaBodyPartField(value, classCode);

export const isLocalOnlyOrcaEntity = (value?: string | null) => Boolean(resolveOrcaEntityContract(value)?.localOnly);

export const isImportOnlyOrcaEntity = (value?: string | null) => Boolean(resolveOrcaEntityContract(value)?.importOnly);

export const isSendableOrcaEntity = (value?: string | null) => Boolean(resolveOrcaEntityContract(value)?.sendable);

export const isRadiologyClassCode = (value?: string | null) => Boolean(trimToNull(value) && EXACT_RADIOLOGY_CLASS_CODES.includes(trimToNull(value)! as (typeof EXACT_RADIOLOGY_CLASS_CODES)[number]));

export const resolveCanonicalOrcaClassName = (
  entity?: string | null,
  classCode?: string | null,
  _className?: string | null,
) => {
  const normalizedEntity = resolveCanonicalOrcaOrderEntity(entity);
  const normalizedClassCode = trimToNull(classCode);
  if (normalizedEntity) {
    if (!normalizedClassCode) return undefined;
    return isOrcaEntityClassAllowed(normalizedEntity, normalizedClassCode)
      ? resolveOrcaDefaultClassMeta(normalizedEntity)?.className
      : undefined;
  }
  return normalizedClassCode ? resolveOrcaClassMetaByCode(normalizedClassCode)?.className : undefined;
};

export const isChargeEntity = (entity?: string | null): entity is ChargeOrderEntity => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  return canonical === 'baseChargeOrder' || canonical === 'instractionChargeOrder';
};

export const resolveChargeEntityFromClassCode = (
  classCode?: string | null,
): ChargeOrderEntity | null => {
  const resolved = resolveOrcaEntityFromClassCode(classCode);
  return resolved === 'baseChargeOrder' || resolved === 'instractionChargeOrder' ? resolved : null;
};

export const isChargeClassCompatible = (entity?: string | null, classCode?: string | null) =>
  isChargeEntity(entity) && isOrcaEntityClassAllowed(entity, classCode);

export const isChargeItemCategoryCompatible = (entity?: string | null, category?: string | null) =>
  isChargeClassCompatible(entity, category);

export const resolveCanonicalChargeClassMeta = (params: {
  entity?: string | null;
  classCode?: string | null;
  itemCategory?: string | null;
}): ChargeClassMeta | null => {
  const normalizedEntity = resolveCanonicalOrcaOrderEntity(params.entity);
  if (!isChargeEntity(normalizedEntity)) return null;
  const explicitCategory = normalizeOrcaClassCode(params.itemCategory);
  const explicitClassCode = normalizeOrcaClassCode(params.classCode);
  if (!explicitClassCode || !isChargeClassCompatible(normalizedEntity, explicitClassCode)) return null;
  if (explicitCategory && !isChargeItemCategoryCompatible(normalizedEntity, explicitCategory)) return null;
  if (explicitCategory && explicitCategory !== explicitClassCode) return null;
  const className = resolveCanonicalOrcaClassName(normalizedEntity, explicitClassCode);
  return className ? { classCode: explicitClassCode, classCodeSystem: CHARGE_CLASS_CODE_SYSTEM, className } : null;
};

export const resolveChargeClassMetaFromItemCategory = (entity?: string | null, category?: string | null) => {
  const normalizedEntity = resolveCanonicalOrcaOrderEntity(entity);
  const explicitCategory = normalizeOrcaClassCode(category);
  if (!isChargeEntity(normalizedEntity) || !explicitCategory || !isChargeItemCategoryCompatible(normalizedEntity, explicitCategory)) {
    return null;
  }
  const className = resolveCanonicalOrcaClassName(normalizedEntity, explicitCategory);
  return className ? { classCode: explicitCategory, classCodeSystem: CHARGE_CLASS_CODE_SYSTEM, className } : null;
};

export const resolveCanonicalChargeClassName = (entity?: string | null, classCode?: string | null) =>
  resolveCanonicalChargeClassMeta({ entity, classCode })?.className;

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

export const resolveMedicalClassName = (classCode?: string | null) => {
  return resolveOrcaClassMetaByCode(classCode)?.className;
};

export const isAuxiliaryMaterialCode = (value?: string | null) => /^7\d{8}$/.test(trimToNull(value) ?? '');

export const getAllowedClassCodesForEntity = (value?: string | null) => {
  const allowed = resolveOrcaEntityContract(value)?.allowedClassCodes;
  return allowed ? [...allowed] : [];
};
