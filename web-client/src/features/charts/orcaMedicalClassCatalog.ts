export type OrcaOrderEntity =
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

export type OrcaClassMode =
  | 'procedure-capable'
  | 'drug-only'
  | 'material-only'
  | 'add-on-only'
  | 'main-test'
  | 'standalone-class';

export type OrcaMedicalClassMeta = {
  classCode: string;
  className: string;
};

type EntityCatalog = {
  allowlist: readonly string[];
  blockedClasses?: readonly string[];
  classModes?: Readonly<Record<string, OrcaClassMode>>;
};

export const ORCA_ORDER_ENTITY_ALIASES = {
  generalOrder: 'treatmentOrder',
  laboTest: 'testOrder',
  instructionChargeOrder: 'instractionChargeOrder',
} as const satisfies Record<string, OrcaOrderEntity>;

export const ORCA_MEDICAL_CLASS_NAME_MAP = {
  '110': '初診料',
  '114': '初診加算料',
  '120': '再診',
  '124': '再診加算料',
  '130': '管理料',
  '132': '管理材料',
  '133': '管理加算料',
  '140': '在宅料',
  '141': '在宅薬剤',
  '142': '在宅材料',
  '143': '在宅加算料',
  '148': '在宅薬剤（院外処方）',
  '149': '在宅材料（院外処方）',
  '400': '処置',
  '401': '処置薬剤',
  '402': '処置材料',
  '403': '処置加算料',
  '409': '処置',
  '500': '手術',
  '501': '手術薬剤',
  '502': '手術材料',
  '510': '輸血',
  '600': '検査',
  '601': '検査薬剤',
  '602': '検査材料',
  '603': '検査加算料',
  '610': '検査',
  '700': '画像診断',
  '701': '画像診断薬剤',
  '702': '画像診断材料',
  '703': 'X線フィルム',
  '704': '画像診断加算料',
  '731': '造影剤・注入手技',
  '732': '造影剤・注入手技',
} as const satisfies Record<string, string>;

export const ORCA_MEDICAL_CLASS_CATALOG: Record<OrcaOrderEntity, EntityCatalog> = {
  medOrder: {
    allowlist: ['210', '211', '212', '213', '220', '221', '222', '223', '230', '231', '232', '233', '290', '291', '292', '293', '294', '295', '296', '297', '298'],
  },
  injectionOrder: {
    allowlist: ['310', '311', '312', '320', '321', '330', '331', '334', '340', '350'],
    blockedClasses: ['332', '335', '352'],
  },
  treatmentOrder: {
    allowlist: ['400', '401', '402', '403', '409'],
    classModes: {
      '400': 'procedure-capable',
      '401': 'drug-only',
      '402': 'material-only',
      '403': 'add-on-only',
      '409': 'procedure-capable',
    },
  },
  surgeryOrder: {
    allowlist: ['500', '501', '502', '510'],
    blockedClasses: ['520', '540', '541', '542'],
    classModes: {
      '500': 'procedure-capable',
      '501': 'drug-only',
      '502': 'material-only',
      '510': 'procedure-capable',
    },
  },
  otherOrder: {
    allowlist: [],
  },
  testOrder: {
    allowlist: ['600', '601', '602', '603', '610'],
    blockedClasses: ['640', '643'],
    classModes: {
      '600': 'main-test',
      '601': 'drug-only',
      '602': 'material-only',
      '603': 'add-on-only',
      '610': 'main-test',
    },
  },
  physiologyOrder: {
    allowlist: [],
  },
  bacteriaOrder: {
    allowlist: [],
  },
  radiologyOrder: {
    allowlist: ['700', '701', '702', '703', '704', '731', '732'],
    blockedClasses: ['710', '711', '712', '713', '720', '721', '723', '724'],
    classModes: {
      '701': 'standalone-class',
      '702': 'standalone-class',
      '703': 'standalone-class',
      '704': 'standalone-class',
      '731': 'standalone-class',
      '732': 'standalone-class',
    },
  },
  baseChargeOrder: {
    allowlist: ['110', '114', '120', '124'],
  },
  instractionChargeOrder: {
    allowlist: ['130', '132', '133', '140', '141', '142', '143', '148', '149'],
    blockedClasses: ['131', '144', '145', '146', '147', '150'],
  },
};

export const resolveCanonicalOrcaOrderEntity = (value?: string | null): OrcaOrderEntity | null => {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized in ORCA_ORDER_ENTITY_ALIASES) {
    return ORCA_ORDER_ENTITY_ALIASES[normalized as keyof typeof ORCA_ORDER_ENTITY_ALIASES];
  }
  if (normalized === 'prescriptionOrder') return 'medOrder';
  if (normalized === 'generalOrder') return 'treatmentOrder';
  if (normalized === 'instructionChargeOrder') return 'instractionChargeOrder';
  if (normalized === 'laboTest') return 'testOrder';
  if (normalized in ORCA_MEDICAL_CLASS_CATALOG) {
    return normalized as OrcaOrderEntity;
  }
  return null;
};

export const resolveOrcaEntityCatalog = (entity?: string | null) => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  return canonical ? ORCA_MEDICAL_CLASS_CATALOG[canonical] : null;
};

export const resolveAllowedMedicalClasses = (entity?: string | null): string[] =>
  [...(resolveOrcaEntityCatalog(entity)?.allowlist ?? [])];

export const resolveBlockedMedicalClasses = (entity?: string | null): string[] =>
  [...(resolveOrcaEntityCatalog(entity)?.blockedClasses ?? [])];

export const isAllowedMedicalClassForEntity = (entity?: string | null, classCode?: string | null) => {
  const normalizedClassCode = classCode?.trim();
  if (!normalizedClassCode) return true;
  const catalog = resolveOrcaEntityCatalog(entity);
  if (!catalog) return false;
  if (catalog.blockedClasses?.includes(normalizedClassCode)) return false;
  if (catalog.allowlist.length === 0) return false;
  return catalog.allowlist.includes(normalizedClassCode);
};

export const isBlockedMedicalClassForEntity = (entity?: string | null, classCode?: string | null) => {
  const normalizedClassCode = classCode?.trim();
  if (!normalizedClassCode) return false;
  const catalog = resolveOrcaEntityCatalog(entity);
  return Boolean(catalog?.blockedClasses?.includes(normalizedClassCode));
};

export const resolveMedicalClassName = (classCode?: string | null): string | undefined => {
  const normalizedClassCode = classCode?.trim();
  if (!normalizedClassCode) return undefined;
  return ORCA_MEDICAL_CLASS_NAME_MAP[normalizedClassCode as keyof typeof ORCA_MEDICAL_CLASS_NAME_MAP];
};

export const resolveMedicalClassMeta = (classCode?: string | null): OrcaMedicalClassMeta | undefined => {
  const normalizedClassCode = classCode?.trim();
  const className = resolveMedicalClassName(normalizedClassCode);
  if (!normalizedClassCode || !className) return undefined;
  return { classCode: normalizedClassCode, className };
};

export const resolveDefaultMedicalClassMeta = (entity?: string | null): OrcaMedicalClassMeta | undefined => {
  const allowlist = resolveAllowedMedicalClasses(entity);
  return allowlist.length > 0 ? resolveMedicalClassMeta(allowlist[0]) : undefined;
};

export const resolveMedicalClassMode = (entity?: string | null, classCode?: string | null): OrcaClassMode | undefined => {
  const normalizedClassCode = classCode?.trim();
  if (!normalizedClassCode) return undefined;
  return resolveOrcaEntityCatalog(entity)?.classModes?.[normalizedClassCode];
};

export const resolveOrcaEntityDefaultClassMeta = resolveDefaultMedicalClassMeta;
export const isOrcaEntityClassAllowed = isAllowedMedicalClassForEntity;
export const isOrcaEntityClassBlocked = isBlockedMedicalClassForEntity;
export const resolveOrcaEntityClassMeta = (entity?: string | null, classCode?: string | null) => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  if (!canonical) return undefined;
  if (!classCode?.trim()) return resolveDefaultMedicalClassMeta(canonical);
  return isAllowedMedicalClassForEntity(canonical, classCode) ? resolveMedicalClassMeta(classCode) : undefined;
};
