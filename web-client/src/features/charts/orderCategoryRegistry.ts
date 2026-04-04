import { resolveCanonicalChargeClassMeta } from './orderChargeClassSupport';
import type { OrderMasterSearchType } from './orderMasterSearchApi';

export type OrderGroupKey = 'prescription' | 'injection' | 'treatment' | 'test' | 'charge';
export type BundleNumberLabel = '日数' | '回数';
export type OrderTestSubtype = 'specimen' | 'physiology' | 'culture' | 'sensitivity';

export type OrderEntity =
  | 'medOrder'
  | 'injectionOrder'
  | 'treatmentOrder'
  | 'generalOrder'
  | 'surgeryOrder'
  | 'otherOrder'
  | 'testOrder'
  | 'laboTest'
  | 'physiologyOrder'
  | 'bacteriaOrder'
  | 'radiologyOrder'
  | 'baseChargeOrder'
  | 'instractionChargeOrder';

const ORDER_ENTITY_ALIASES: Record<string, OrderEntity> = {
  prescriptionOrder: 'medOrder',
  laboTest: 'testOrder',
  instructionChargeOrder: 'instractionChargeOrder',
};

const CANONICAL_ORDER_ENTITY_ALIASES: Record<OrderEntity, OrderEntity> = {
  medOrder: 'medOrder',
  injectionOrder: 'injectionOrder',
  treatmentOrder: 'treatmentOrder',
  generalOrder: 'treatmentOrder',
  surgeryOrder: 'surgeryOrder',
  otherOrder: 'otherOrder',
  testOrder: 'testOrder',
  laboTest: 'testOrder',
  physiologyOrder: 'physiologyOrder',
  bacteriaOrder: 'bacteriaOrder',
  radiologyOrder: 'radiologyOrder',
  baseChargeOrder: 'baseChargeOrder',
  instractionChargeOrder: 'instractionChargeOrder',
};

export type OrderEntityValidationRule = {
  itemLabel: string;
  requiresItems: boolean;
  requiresUsage: boolean;
  requiresBodyPart: boolean;
};

export type OrderEntityClassMeta = {
  classCode: string;
  className: string;
};

export type OrderEntityUiProfile = {
  bundleNamePlaceholder: string;
  instructionLabel: string;
  instructionPlaceholder: string;
  memoLabel: string;
  memoPlaceholder: string;
  masterSectionTitle: string;
  mainItemLabel: string;
  mainItemPlaceholder: string;
  supportsUsageSearch: boolean;
  supportsBodyPartSearch: boolean;
  supportsCommentCodes: boolean;
  supportsInjectionNoProcedure: boolean;
  masterSearchPresets: Array<{ type: OrderMasterSearchType; label: string }>;
  defaultMasterSearchType: OrderMasterSearchType;
  testSubtype?: {
    label: string;
    helpText: string;
    required: boolean;
    readOnly: boolean;
    defaultValue?: OrderTestSubtype;
    options: Array<{ value: OrderTestSubtype; label: string }>;
  };
};

export type OrderEntityMasterSearchPolicy = {
  masterSearchPresets: Array<{ type: OrderMasterSearchType; label: string }>;
  defaultMasterSearchType: OrderMasterSearchType;
  etensuCategory?: string;
  classMeta?: OrderEntityClassMeta;
};

export type OrderEntityEditorMeta = {
  title: string;
  bundleLabel: string;
  itemQuantityLabel: string;
};

type OrderEntityRegistryEntry = {
  label: string;
  group: OrderGroupKey;
  etensuCategory?: string;
  classMeta?: OrderEntityClassMeta;
  validation: OrderEntityValidationRule;
  ui: OrderEntityUiProfile;
  editor: OrderEntityEditorMeta;
};

const BASE_EDITOR_VALIDATION: OrderEntityValidationRule = {
  itemLabel: '項目',
  requiresItems: true,
  requiresUsage: false,
  requiresBodyPart: false,
};

const BASE_EDITOR_UI: OrderEntityUiProfile = {
  bundleNamePlaceholder: '例: 創傷処置',
  instructionLabel: '処置指示',
  instructionPlaceholder: '例: 1日1回 実施',
  memoLabel: '処置メモ',
  memoPlaceholder: '実施手順・注意点を入力',
  masterSectionTitle: '処置マスタ検索',
  mainItemLabel: '処置項目',
  mainItemPlaceholder: '処置項目名',
  supportsUsageSearch: false,
  supportsBodyPartSearch: false,
  supportsCommentCodes: true,
  supportsInjectionNoProcedure: false,
  masterSearchPresets: [
    { type: 'etensu', label: '処置項目' },
    { type: 'drug', label: '使用薬剤' },
    { type: 'material', label: '処置材料' },
  ],
  defaultMasterSearchType: 'etensu',
};

const cloneMasterSearchPresets = (
  presets: OrderEntityUiProfile['masterSearchPresets'],
): Array<{ type: OrderMasterSearchType; label: string }> => presets.map((preset) => ({ ...preset }));

const TEST_SPECIMEN_SUBTYPE = {
  label: '600系 subtype',
  helpText: '検体・一般検査は specimen として保存し、ORCA送信 grouping には使いません。',
  required: false,
  readOnly: true,
  defaultValue: 'specimen' as OrderTestSubtype,
  options: [{ value: 'specimen' as OrderTestSubtype, label: '検体/一般検査' }],
};

const TEST_PHYSIOLOGY_SUBTYPE = {
  label: '600系 subtype',
  helpText: '生理検査は physiology 固定で扱い、検体系とは editor 上で分離します。',
  required: false,
  readOnly: true,
  defaultValue: 'physiology' as OrderTestSubtype,
  options: [{ value: 'physiology' as OrderTestSubtype, label: '生理' }],
};

const TEST_BACTERIA_SUBTYPE = {
  label: '細菌検査 subtype',
  helpText: '細菌検査は culture または sensitivity を選択してください。ORCA送信 grouping は classCode 600 を維持します。',
  required: true,
  readOnly: false,
  options: [
    { value: 'culture' as OrderTestSubtype, label: '培養' },
    { value: 'sensitivity' as OrderTestSubtype, label: '感受性' },
  ],
};

const ORDER_ENTITY_REGISTRY: Record<OrderEntity, OrderEntityRegistryEntry> = {
  medOrder: {
    label: '処方',
    group: 'prescription',
    validation: {
      itemLabel: '薬剤/項目',
      requiresItems: true,
      requiresUsage: true,
      requiresBodyPart: false,
    },
    ui: {
      bundleNamePlaceholder: '例: 降圧薬RP',
      instructionLabel: '用法',
      instructionPlaceholder: '例: 1日1回 朝',
      memoLabel: '処方メモ',
      memoPlaceholder: '服薬上の補足を入力',
      masterSectionTitle: '処方薬剤マスタ検索',
      mainItemLabel: '処方薬剤',
      mainItemPlaceholder: '薬剤名',
      supportsUsageSearch: true,
      supportsBodyPartSearch: false,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [{ type: 'drug', label: '処方薬剤' }],
      defaultMasterSearchType: 'drug',
    },
    editor: { title: '処方', bundleLabel: 'RP名', itemQuantityLabel: '用量' },
  },
  injectionOrder: {
    label: '注射',
    group: 'injection',
    etensuCategory: '3',
    classMeta: { classCode: '310', className: '注射' },
    validation: BASE_EDITOR_VALIDATION,
    ui: {
      bundleNamePlaceholder: '例: 点滴セット',
      instructionLabel: '投与指示',
      instructionPlaceholder: '例: 静注 / 点滴 / 1日1回',
      memoLabel: '注射メモ',
      memoPlaceholder: '投与速度・ルートなど（院内メモ / ORCA送信しない）',
      masterSectionTitle: '注射マスタ検索',
      mainItemLabel: '注射薬剤/手技',
      mainItemPlaceholder: '注射薬剤または手技名',
      supportsUsageSearch: true,
      supportsBodyPartSearch: false,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [
        { type: 'drug', label: '注射薬剤' },
        { type: 'etensu', label: '注射手技' },
      ],
      defaultMasterSearchType: 'drug',
    },
    editor: { title: '注射', bundleLabel: '注射名', itemQuantityLabel: '数量' },
  },
  treatmentOrder: {
    label: '処置',
    group: 'treatment',
    etensuCategory: '4',
    classMeta: { classCode: '400', className: '処置' },
    validation: BASE_EDITOR_VALIDATION,
    ui: { ...BASE_EDITOR_UI, supportsBodyPartSearch: true },
    editor: { title: '処置', bundleLabel: '処置名', itemQuantityLabel: '数量' },
  },
  generalOrder: {
    label: '一般',
    group: 'treatment',
    etensuCategory: '4',
    classMeta: { classCode: '400', className: '処置' },
    validation: BASE_EDITOR_VALIDATION,
    ui: { ...BASE_EDITOR_UI, supportsBodyPartSearch: true },
    editor: { title: '一般オーダー（処置400別表示）', bundleLabel: 'オーダー名', itemQuantityLabel: '数量' },
  },
  surgeryOrder: {
    label: '手術',
    group: 'treatment',
    etensuCategory: '5',
    classMeta: { classCode: '500', className: '手術' },
    validation: BASE_EDITOR_VALIDATION,
    ui: BASE_EDITOR_UI,
    editor: { title: '手術', bundleLabel: '手技', itemQuantityLabel: '数量' },
  },
  otherOrder: {
    label: 'その他',
    group: 'treatment',
    etensuCategory: '8',
    classMeta: { classCode: '800', className: 'その他' },
    validation: BASE_EDITOR_VALIDATION,
    ui: {
      ...BASE_EDITOR_UI,
      bundleNamePlaceholder: '例: 診断書料',
      instructionPlaceholder: '院内補足として保持します',
      memoPlaceholder: '院内メモとして保持します',
      masterSectionTitle: 'その他オーダーマスタ検索',
      mainItemLabel: 'その他オーダー項目',
      mainItemPlaceholder: 'その他オーダー項目名',
      supportsBodyPartSearch: false,
      masterSearchPresets: [{ type: 'etensu', label: 'その他オーダー' }],
      defaultMasterSearchType: 'etensu',
    },
    editor: { title: 'その他', bundleLabel: '項目', itemQuantityLabel: '数量' },
  },
  testOrder: {
    label: '検査',
    group: 'test',
    etensuCategory: '6',
    classMeta: { classCode: '600', className: '検査' },
    validation: BASE_EDITOR_VALIDATION,
    ui: {
      bundleNamePlaceholder: '例: 生化学検査',
      instructionLabel: '検査指示',
      instructionPlaceholder: '例: 至急 / 空腹時',
      memoLabel: '検査メモ',
      memoPlaceholder: '採取条件・備考を入力',
      masterSectionTitle: '検査マスタ検索',
      mainItemLabel: '検査項目',
      mainItemPlaceholder: '検査項目名',
      supportsUsageSearch: false,
      supportsBodyPartSearch: false,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [
        { type: 'etensu', label: '検査項目' },
        { type: 'kensa-sort', label: '検査区分' },
      ],
      defaultMasterSearchType: 'etensu',
      testSubtype: TEST_SPECIMEN_SUBTYPE,
    },
    editor: { title: '検査', bundleLabel: '検査名', itemQuantityLabel: '数量' },
  },
  laboTest: {
    label: '検査',
    group: 'test',
    etensuCategory: '6',
    classMeta: { classCode: '600', className: '検査' },
    validation: BASE_EDITOR_VALIDATION,
    ui: {
      bundleNamePlaceholder: '例: 生化学検査',
      instructionLabel: '検査指示',
      instructionPlaceholder: '例: 至急 / 空腹時',
      memoLabel: '検査メモ',
      memoPlaceholder: '採取条件・備考を入力',
      masterSectionTitle: '検査マスタ検索',
      mainItemLabel: '検査項目',
      mainItemPlaceholder: '検査項目名',
      supportsUsageSearch: false,
      supportsBodyPartSearch: false,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [
        { type: 'etensu', label: '検査項目' },
        { type: 'kensa-sort', label: '検査区分' },
      ],
      defaultMasterSearchType: 'etensu',
      testSubtype: TEST_SPECIMEN_SUBTYPE,
    },
    editor: { title: '検査', bundleLabel: '検査名', itemQuantityLabel: '数量' },
  },
  physiologyOrder: {
    label: '生理',
    group: 'test',
    etensuCategory: '6',
    classMeta: { classCode: '600', className: '検査' },
    validation: BASE_EDITOR_VALIDATION,
    ui: {
      bundleNamePlaceholder: '例: 心電図検査',
      instructionLabel: '生理検査指示',
      instructionPlaceholder: '例: 安静時 / 12誘導',
      memoLabel: '生理検査メモ',
      memoPlaceholder: '実施条件・備考を入力',
      masterSectionTitle: '生理検査マスタ検索',
      mainItemLabel: '生理検査項目',
      mainItemPlaceholder: '生理検査項目名',
      supportsUsageSearch: false,
      supportsBodyPartSearch: false,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [
        { type: 'etensu', label: '検査項目' },
        { type: 'kensa-sort', label: '検査区分' },
      ],
      defaultMasterSearchType: 'etensu',
      testSubtype: TEST_PHYSIOLOGY_SUBTYPE,
    },
    editor: { title: '生理検査', bundleLabel: '検査名', itemQuantityLabel: '数量' },
  },
  bacteriaOrder: {
    label: '細菌',
    group: 'test',
    etensuCategory: '6',
    classMeta: { classCode: '600', className: '検査' },
    validation: BASE_EDITOR_VALIDATION,
    ui: {
      bundleNamePlaceholder: '例: 細菌培養',
      instructionLabel: '細菌検査指示',
      instructionPlaceholder: '例: 喀痰 / 至急',
      memoLabel: '細菌検査メモ',
      memoPlaceholder: '採取条件・備考を入力',
      masterSectionTitle: '細菌検査マスタ検索',
      mainItemLabel: '細菌検査項目',
      mainItemPlaceholder: '細菌検査項目名',
      supportsUsageSearch: false,
      supportsBodyPartSearch: false,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [
        { type: 'etensu', label: '検査項目' },
        { type: 'kensa-sort', label: '検査区分' },
      ],
      defaultMasterSearchType: 'etensu',
      testSubtype: TEST_BACTERIA_SUBTYPE,
    },
    editor: { title: '細菌検査', bundleLabel: '検査名', itemQuantityLabel: '数量' },
  },
  radiologyOrder: {
    label: '放射線',
    group: 'test',
    etensuCategory: '7',
    classMeta: { classCode: '700', className: '画像診断' },
    validation: {
      itemLabel: '画像検査項目',
      requiresItems: true,
      requiresUsage: false,
      requiresBodyPart: true,
    },
    ui: {
      bundleNamePlaceholder: '例: 胸部CT（造影）',
      instructionLabel: '検査指示',
      instructionPlaceholder: '例: 造影あり / 単純',
      memoLabel: '画像検査メモ',
      memoPlaceholder: '撮影条件・依頼目的を入力',
      masterSectionTitle: '画像検査マスタ検索',
      mainItemLabel: '画像検査項目',
      mainItemPlaceholder: '画像検査名',
      supportsUsageSearch: false,
      supportsBodyPartSearch: true,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [
        { type: 'etensu', label: '画像検査' },
        { type: 'material', label: '画像器材' },
        { type: 'drug', label: '造影薬剤' },
      ],
      defaultMasterSearchType: 'etensu',
    },
    editor: { title: '放射線', bundleLabel: '検査名', itemQuantityLabel: '数量' },
  },
  baseChargeOrder: {
    label: '基本料',
    group: 'charge',
    etensuCategory: '1',
    classMeta: resolveCanonicalChargeClassMeta({ entity: 'baseChargeOrder' })!,
    validation: BASE_EDITOR_VALIDATION,
    ui: {
      bundleNamePlaceholder: '例: 初診料算定',
      instructionLabel: '算定指示',
      instructionPlaceholder: '例: 初再診 / 指導料',
      memoLabel: '算定メモ',
      memoPlaceholder: '算定条件・補足を入力',
      masterSectionTitle: '算定マスタ検索',
      mainItemLabel: '算定項目',
      mainItemPlaceholder: '算定項目名',
      supportsUsageSearch: false,
      supportsBodyPartSearch: false,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [{ type: 'etensu', label: '算定項目' }],
      defaultMasterSearchType: 'etensu',
    },
    editor: { title: '基本料', bundleLabel: '算定', itemQuantityLabel: '数量' },
  },
  instractionChargeOrder: {
    label: '指導料',
    group: 'charge',
    etensuCategory: '1',
    classMeta: resolveCanonicalChargeClassMeta({ entity: 'instractionChargeOrder' })!,
    validation: BASE_EDITOR_VALIDATION,
    ui: {
      bundleNamePlaceholder: '例: 初診料算定',
      instructionLabel: '算定指示',
      instructionPlaceholder: '例: 初再診 / 指導料',
      memoLabel: '算定メモ',
      memoPlaceholder: '算定条件・補足を入力',
      masterSectionTitle: '算定マスタ検索',
      mainItemLabel: '算定項目',
      mainItemPlaceholder: '算定項目名',
      supportsUsageSearch: false,
      supportsBodyPartSearch: false,
      supportsCommentCodes: true,
      supportsInjectionNoProcedure: false,
      masterSearchPresets: [{ type: 'etensu', label: '算定項目' }],
      defaultMasterSearchType: 'etensu',
    },
    editor: { title: '指導料', bundleLabel: '算定', itemQuantityLabel: '数量' },
  },
};

export const ORDER_GROUP_REGISTRY: Array<{
  key: OrderGroupKey;
  label: string;
  entities: readonly OrderEntity[];
  defaultEntity: OrderEntity;
}> = [
  { key: 'prescription', label: '処方', entities: ['medOrder'], defaultEntity: 'medOrder' },
  { key: 'injection', label: '注射', entities: ['injectionOrder'], defaultEntity: 'injectionOrder' },
  {
    key: 'treatment',
    label: '処置',
    entities: ['treatmentOrder', 'generalOrder', 'surgeryOrder', 'otherOrder'],
    defaultEntity: 'treatmentOrder',
  },
  {
    key: 'test',
    label: '検査',
    entities: ['testOrder', 'physiologyOrder', 'bacteriaOrder', 'radiologyOrder'],
    defaultEntity: 'testOrder',
  },
  { key: 'charge', label: '算定', entities: ['baseChargeOrder', 'instractionChargeOrder'], defaultEntity: 'baseChargeOrder' },
];

export const ORCA_SEND_ORDER_ENTITIES: readonly OrderEntity[] = [
  'treatmentOrder',
  'testOrder',
  'physiologyOrder',
  'bacteriaOrder',
  'instractionChargeOrder',
  'surgeryOrder',
  'otherOrder',
  'radiologyOrder',
  'baseChargeOrder',
  'injectionOrder',
  'medOrder',
] as const;

export const resolveOrderEntity = (value: string): OrderEntity | null => {
  const normalized = value.trim();
  if (!normalized) return null;
  const alias = ORDER_ENTITY_ALIASES[normalized];
  if (alias) return alias;
  if (normalized in ORDER_ENTITY_REGISTRY) return normalized as OrderEntity;
  return null;
};

export const resolveCanonicalOrderEntity = (value?: string | null): OrderEntity | null => {
  if (!value) return null;
  const resolved = resolveOrderEntity(value);
  if (!resolved) return null;
  return CANONICAL_ORDER_ENTITY_ALIASES[resolved] ?? resolved;
};

export const isOrderEntity = (value: string): value is OrderEntity => {
  const normalized = value.trim();
  return normalized in ORDER_ENTITY_REGISTRY;
};

export const resolveOrderEntityLabel = (entity: string): string => {
  const resolved = resolveOrderEntity(entity);
  if (resolved) return ORDER_ENTITY_REGISTRY[resolved].label;
  return entity;
};

export const resolveOrderGroupKeyByEntity = (entity: string): OrderGroupKey | null => {
  const resolved = resolveOrderEntity(entity);
  if (!resolved) return null;
  return ORDER_ENTITY_REGISTRY[resolved].group;
};

export const resolveOrderDockCategoryLabel = (group: OrderGroupKey | null): string | null => {
  if (!group) return null;
  const matched = ORDER_GROUP_REGISTRY.find((spec) => spec.key === group);
  return matched?.label ?? group;
};

export const resolveOrderEntityUiProfile = (entity: string): OrderEntityUiProfile => {
  const resolved = resolveOrderEntity(entity);
  if (resolved) return ORDER_ENTITY_REGISTRY[resolved].ui;
  return BASE_EDITOR_UI;
};

export const resolveOrderEntityTestSubtypeConfig = (entity: string): OrderEntityUiProfile['testSubtype'] => {
  const resolved = resolveOrderEntity(entity);
  if (!resolved) return undefined;
  const config = ORDER_ENTITY_REGISTRY[resolved].ui.testSubtype;
  if (!config) return undefined;
  return {
    ...config,
    options: config.options.map((option) => ({ ...option })),
  };
};

export const resolveOrderEntityMasterSearchPolicy = (entity: string): OrderEntityMasterSearchPolicy => {
  const resolved = resolveOrderEntity(entity);
  if (!resolved) {
    return {
      masterSearchPresets: cloneMasterSearchPresets(BASE_EDITOR_UI.masterSearchPresets),
      defaultMasterSearchType: BASE_EDITOR_UI.defaultMasterSearchType,
    };
  }
  const entry = ORDER_ENTITY_REGISTRY[resolved];
  return {
    masterSearchPresets: cloneMasterSearchPresets(entry.ui.masterSearchPresets),
    defaultMasterSearchType: entry.ui.defaultMasterSearchType,
    etensuCategory: entry.etensuCategory,
    classMeta: entry.classMeta ? { ...entry.classMeta } : undefined,
  };
};

export const resolveOrderEntityValidationRule = (entity: string): OrderEntityValidationRule => {
  const resolved = resolveOrderEntity(entity);
  if (resolved) return ORDER_ENTITY_REGISTRY[resolved].validation;
  return BASE_EDITOR_VALIDATION;
};

export const resolveOrderEntityEtensuCategory = (entity: string): string | undefined => {
  const resolved = resolveOrderEntity(entity);
  if (!resolved) return undefined;
  return ORDER_ENTITY_REGISTRY[resolved].etensuCategory;
};

export const resolveOrderEntityDefaultClassMeta = (entity?: string): OrderEntityClassMeta | undefined => {
  if (!entity) return undefined;
  const resolved = resolveOrderEntity(entity);
  if (!resolved) return undefined;
  return ORDER_ENTITY_REGISTRY[resolved].classMeta;
};

export const resolveOrderEntityEditorMeta = (entity: string): OrderEntityEditorMeta | null => {
  const resolved = resolveOrderEntity(entity);
  if (!resolved) return null;
  return ORDER_ENTITY_REGISTRY[resolved].editor;
};

export const normalizeOrderTestSubtype = (entity: string, subtype?: string | null): OrderTestSubtype | undefined => {
  const config = resolveOrderEntityTestSubtypeConfig(entity);
  if (!config) return undefined;
  const normalized = subtype?.trim().toLowerCase();
  const matched = config.options.find((option) => option.value === normalized);
  if (matched) return matched.value;
  return config.defaultValue;
};

type PrescriptionTiming = 'regular' | 'tonyo' | 'gaiyo';

const normalizePrescriptionTiming = (timing?: string | null): PrescriptionTiming | null => {
  if (!timing) return null;
  const normalized = timing.trim().toLowerCase();
  if (normalized === 'regular' || normalized === 'tonyo' || normalized === 'gaiyo') return normalized;
  return null;
};

export const resolveBundleNumberLabel = (params: {
  group: OrderGroupKey;
  classCode?: string | null;
  prescriptionTiming?: string | null;
}): BundleNumberLabel => {
  if (params.group !== 'prescription') return '回数';

  const classCode = (params.classCode ?? '').trim();
  if (classCode.startsWith('22')) return '回数';
  if (classCode.startsWith('21') || classCode.startsWith('23')) return '日数';

  const timing = normalizePrescriptionTiming(params.prescriptionTiming);
  if (timing === 'tonyo') return '回数';
  if (timing === 'regular' || timing === 'gaiyo') return '日数';

  return '日数';
};
