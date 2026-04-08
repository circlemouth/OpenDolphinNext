import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';
import type { OrderBundle, OrderBundleItem } from './orderBundleApi';
import {
  ORDER_GROUP_REGISTRY,
  resolveBundleNumberLabel,
  resolveOrderEntity,
  resolveOrderGroupKeyByEntity,
  type BundleNumberLabel,
  type OrderEntity,
  type OrderGroupKey,
} from './orderCategoryRegistry';
import {
  extractIngredientAmount,
  formatBodyPartLine,
  formatQuantityWithUnit,
  normalizeInline,
  resolvePrescriptionTiming,
  resolveBundleBodyPart,
  resolveDisplayItemsWithoutBodyPart,
  resolveOperatorLine,
  stripLeadingCode,
  toSafeMemoText,
} from './orderDetailFormatters';

export type OrderDetailDisplayCategoryKey = OrderGroupKey | 'document';

export type OrderDetailDisplayItem = {
  primary: string;
  genericNote?: string;
  secondary: string[];
};

export type OrderDetailDisplayViewModel = {
  id: string;
  group: OrderGroupKey;
  entity: OrderEntity;
  bundle: OrderBundle;
  bundleLabel: string;
  operatorLine: string;
  title: string;
  detailLines: string[];
  items: OrderDetailDisplayItem[];
  chips: string[];
  bundleNumberLabel: BundleNumberLabel;
  bundleNumberValue: string;
  warnings: string[];
  missingFlags: string[];
};

export type OrderDetailDisplayCategoryViewModel = {
  key: OrderDetailDisplayCategoryKey;
  label: string;
  groupKey?: OrderGroupKey;
  defaultEntity: OrderEntity | null;
  rows: OrderDetailDisplayViewModel[];
};

type SummaryCategorySpec = {
  key: OrderDetailDisplayCategoryKey;
  label: string;
  groupKey?: OrderGroupKey;
};

type BundleSortMeta = {
  bundle: OrderBundle;
  index: number;
  startedTimestamp: number | null;
  documentId: number | null;
};

const SUMMARY_CATEGORIES: SummaryCategorySpec[] = [
  { key: 'prescription', label: '処方', groupKey: 'prescription' },
  { key: 'injection', label: '点滴・注射', groupKey: 'injection' },
  { key: 'treatment', label: '処置', groupKey: 'treatment' },
  { key: 'test', label: '検査', groupKey: 'test' },
  { key: 'charge', label: '算定', groupKey: 'charge' },
  { key: 'document', label: '文書' },
];

const RADIOLOGY_CLASS_NAMES = {
  '700': '画像診断',
  '701': '画像診断薬剤',
  '702': '画像診断材料',
  '703': 'X線フィルム',
  '704': '画像診断加算料',
  '731': '造影剤・注入手技',
  '732': '造影剤・注入手技',
} as const;
const BASE_CHARGE_CLASS_NAMES = {
  '110': '初診料',
  '114': '初診加算料',
  '120': '再診',
  '124': '再診加算料',
} as const;
const INSTRUCTION_CHARGE_CLASS_NAMES = {
  '130': '管理料',
  '132': '管理材料',
  '133': '管理加算料',
  '140': '在宅料',
  '141': '在宅薬剤',
  '142': '在宅材料',
  '143': '在宅加算料',
  '148': '在宅薬剤（院外処方）',
  '149': '在宅材料（院外処方）',
} as const;

const resolveBundleDisplayClassName = (bundle: OrderBundle) => {
  const entity = bundle.entity?.trim() ?? '';
  const classCode = bundle.classCode?.trim() ?? '';
  if (entity === 'radiologyOrder') {
    return RADIOLOGY_CLASS_NAMES[classCode as keyof typeof RADIOLOGY_CLASS_NAMES] ?? RADIOLOGY_CLASS_NAMES['700'];
  }
  if (entity === 'baseChargeOrder') {
    return BASE_CHARGE_CLASS_NAMES[classCode as keyof typeof BASE_CHARGE_CLASS_NAMES] ?? BASE_CHARGE_CLASS_NAMES['110'];
  }
  if (entity === 'instractionChargeOrder') {
    return INSTRUCTION_CHARGE_CLASS_NAMES[classCode as keyof typeof INSTRUCTION_CHARGE_CLASS_NAMES] ?? INSTRUCTION_CHARGE_CLASS_NAMES['130'];
  }
  return bundle.className?.trim() || undefined;
};

const parseStartedTimestamp = (bundle: OrderBundle): number | null => {
  const raw = bundle.started?.trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const parseDocumentId = (bundle: OrderBundle): number | null => {
  return typeof bundle.documentId === 'number' && Number.isFinite(bundle.documentId) ? bundle.documentId : null;
};

const compareBundleSortMeta = (left: BundleSortMeta, right: BundleSortMeta) => {
  const leftHasStarted = left.startedTimestamp !== null;
  const rightHasStarted = right.startedTimestamp !== null;
  if (leftHasStarted && rightHasStarted) {
    if (left.startedTimestamp !== right.startedTimestamp) {
      return (right.startedTimestamp ?? 0) - (left.startedTimestamp ?? 0);
    }
    if (left.documentId !== right.documentId) {
      return (right.documentId ?? Number.NEGATIVE_INFINITY) - (left.documentId ?? Number.NEGATIVE_INFINITY);
    }
    return right.index - left.index;
  }
  if (leftHasStarted !== rightHasStarted) return leftHasStarted ? -1 : 1;
  if (left.documentId !== right.documentId) {
    return (right.documentId ?? Number.NEGATIVE_INFINITY) - (left.documentId ?? Number.NEGATIVE_INFINITY);
  }
  return right.index - left.index;
};

const normalizeBundleName = (bundle: OrderBundle) => {
  const value = normalizeInline(bundle.bundleName) || normalizeInline(resolveBundleDisplayClassName(bundle));
  return value || '名称未設定';
};

export const normalizeBundleEntity = (bundle: OrderBundle, fallback: OrderEntity): OrderEntity => {
  const raw = bundle.entity?.trim() ?? '';
  const resolved = resolveOrderEntity(raw);
  if (resolved) return resolved;
  return fallback;
};

const resolveBundleNumberMeta = (group: OrderGroupKey, bundle: OrderBundle) => {
  const bundleNumberValue = normalizeInline(bundle.bundleNumber);
  const bundleNumberLabel = resolveBundleNumberLabel({
    group,
    classCode: bundle.classCode,
    prescriptionTiming: resolvePrescriptionTiming(bundle),
  });
  return { bundleNumberLabel, bundleNumberValue };
};

const buildPrescriptionItems = (
  bundle: OrderBundle,
  bundleNumberLabel: BundleNumberLabel,
  bundleNumberValue: string,
): {
  items: OrderDetailDisplayItem[];
  missingFlags: string[];
  warnings: string[];
} => {
  const usage = normalizeInline(bundle.admin);
  let missingGeneric = false;
  let missingIngredient = false;
  let missingReceiptComment = false;

  const items = resolveDisplayItemsWithoutBodyPart(bundle)
    .map((item) => {
      const parsed = resolveOrcaOrderItemFields(item);
      const quantity = formatQuantityWithUnit(item.quantity, item.unit);
      const ingredientAmount = extractIngredientAmount(item);
      const userComment = normalizeInline(parsed.userComment);
      const receiptComment = toSafeMemoText(parsed.memoText);

      if (!parsed.genericFlg) missingGeneric = true;
      if (!ingredientAmount) missingIngredient = true;
      if (!receiptComment) missingReceiptComment = true;

      const genericNote =
        parsed.genericFlg === 'no'
          ? '【後発変更不可】'
          : parsed.genericFlg === 'yes'
            ? '【後発変更可】'
            : '【後発可否不明】';

      const usageLine = bundleNumberValue
        ? `用法: ${usage || '未設定'} / ${bundleNumberLabel}: ${bundleNumberValue}`
        : `用法: ${usage || '未設定'}`;

      return {
        primary: stripLeadingCode(item.name) || '薬剤名未設定',
        genericNote,
        secondary: [
          `薬剤量: ${quantity || '不明'} / 成分量: ${ingredientAmount || '未設定'}`,
          usageLine,
          `薬剤コメント: ${userComment || 'なし'}`,
          `レセプトコメント: ${receiptComment || 'なし'}`,
        ],
      } satisfies OrderDetailDisplayItem;
    })
    .filter((item) => Boolean(item.primary));

  const missingFlags: string[] = [];
  if (items.length === 0) missingFlags.push('missing_items');
  if (missingGeneric) missingFlags.push('missing_generic_flag');
  if (missingIngredient) missingFlags.push('missing_ingredient_amount');
  if (missingReceiptComment) missingFlags.push('missing_receipt_comment');

  const warnings: string[] = [];
  if (!bundleNumberValue) warnings.push('RP回数/日数が未設定です。');

  return { items, missingFlags, warnings };
};

const buildSimpleItems = (
  sourceItems: OrderBundleItem[],
  options: {
    includeQuantity: boolean;
    quantityPrefix?: string;
    includeItemMemo: boolean;
    emptyLabel: string;
  },
): { items: OrderDetailDisplayItem[]; missingFlags: string[] } => {
  const items = sourceItems
    .filter((item) => Boolean(normalizeInline(item.name)))
    .map((item) => {
      const name = stripLeadingCode(item.name) || '項目名未設定';
      const quantity = formatQuantityWithUnit(item.quantity, item.unit);
      const memo = normalizeInline(item.memo);
      const secondary: string[] = [];
      if (options.includeQuantity) {
        const quantityLabel = options.quantityPrefix ?? '';
        secondary.push(`${quantityLabel}${quantity || '不明'}`);
      }
      if (options.includeItemMemo && memo) {
        secondary.push(`メモ:${memo}`);
      }
      return {
        primary: name,
        secondary,
      } satisfies OrderDetailDisplayItem;
    });

  const missingFlags = items.length === 0 ? ['missing_items'] : [];
  if (items.length === 0) {
    return {
      items: [{ primary: options.emptyLabel, secondary: [] }],
      missingFlags,
    };
  }
  return { items, missingFlags };
};

const buildBundleDetailLines = (group: OrderGroupKey, bundle: OrderBundle, bundleNumberLabel: BundleNumberLabel) => {
  const detailLines: string[] = [];
  const { bundleNumberValue } = resolveBundleNumberMeta(group, bundle);
  const bundleMemo = normalizeInline(bundle.memo);
  const admin = normalizeInline(bundle.admin);
  const adminMemo = normalizeInline(bundle.adminMemo);
  const sourceSetCode = normalizeInline((bundle as OrderBundle & { sourceSetCode?: string }).sourceSetCode);

  if (group === 'injection') {
    const adminLine = [admin || null, adminMemo || null].filter(Boolean).join(' ');
    detailLines.push(adminLine || '投与情報なし');
  }

  if (group === 'charge') {
    const adminLine = [admin || null, adminMemo ? `院内補足:${adminMemo}` : null].filter(Boolean).join(' / ');
    if (adminLine) detailLines.push(adminLine);
    if (sourceSetCode) detailLines.push(`反映元 setCode: ${sourceSetCode}`);
    if (bundle.started?.trim()) detailLines.push(`開始: ${bundle.started.trim()}`);
  }

  if (group === 'charge' || group === 'injection') {
    if (bundleNumberValue) detailLines.push(`${bundleNumberLabel}: ${bundleNumberValue}`);
  }

  if ((group === 'charge' || group === 'test' || group === 'treatment') && bundleMemo) {
    detailLines.push(`メモ:${bundleMemo}`);
  }

  const bodyPart = resolveBundleBodyPart(bundle);
  if (bodyPart && (group === 'test' || group === 'treatment')) {
    detailLines.push(formatBodyPartLine(bodyPart));
  }

  return detailLines;
};

const buildGroupSpecificModel = (
  group: OrderGroupKey,
  bundle: OrderBundle,
  bundleNumberLabel: BundleNumberLabel,
  bundleNumberValue: string,
): Pick<OrderDetailDisplayViewModel, 'title' | 'items' | 'detailLines' | 'chips' | 'warnings' | 'missingFlags'> => {
  if (group === 'prescription') {
    const { items, missingFlags, warnings } = buildPrescriptionItems(bundle, bundleNumberLabel, bundleNumberValue);
    return {
      title: bundleNumberValue ? `RP${bundleNumberValue}` : 'RP',
      items: items.length > 0 ? items : [{ primary: '薬剤情報なし', secondary: [] }],
      detailLines: [],
      chips: items.map((item) => item.primary).slice(0, 6),
      warnings,
      missingFlags,
    };
  }

  if (group === 'injection') {
    const { items, missingFlags } = buildSimpleItems(resolveDisplayItemsWithoutBodyPart(bundle), {
      includeQuantity: true,
      quantityPrefix: '薬剤量: ',
      includeItemMemo: false,
      emptyLabel: '薬剤情報なし',
    });
    return {
      title: '点滴・注射',
      items,
      detailLines: buildBundleDetailLines(group, bundle, bundleNumberLabel),
      chips: items.map((item) => item.primary).slice(0, 5),
      warnings: [],
      missingFlags,
    };
  }

  if (group === 'treatment') {
    const { items, missingFlags } = buildSimpleItems(resolveDisplayItemsWithoutBodyPart(bundle), {
      includeQuantity: true,
      includeItemMemo: false,
      emptyLabel: '項目情報なし',
    });
    return {
      title: '処置',
      items,
      detailLines: buildBundleDetailLines(group, bundle, bundleNumberLabel),
      chips: items.map((item) => item.primary).slice(0, 5),
      warnings: [],
      missingFlags,
    };
  }

  if (group === 'test') {
    const { items, missingFlags } = buildSimpleItems(resolveDisplayItemsWithoutBodyPart(bundle), {
      includeQuantity: false,
      includeItemMemo: false,
      emptyLabel: '項目情報なし',
    });
    const detailLines = buildBundleDetailLines(group, bundle, bundleNumberLabel);
    const resolvedMissingFlags = [...missingFlags];
    return {
      title: '',
      items,
      detailLines,
      chips: items.map((item) => item.primary).slice(0, 5),
      warnings: [],
      missingFlags: resolvedMissingFlags,
    };
  }

  const { items, missingFlags } = buildSimpleItems(resolveDisplayItemsWithoutBodyPart(bundle), {
    includeQuantity: true,
    includeItemMemo: true,
    emptyLabel: '項目情報なし',
  });
  return {
    title: '',
    items,
    detailLines: buildBundleDetailLines(group, bundle, bundleNumberLabel),
    chips: items.map((item) => item.primary).slice(0, 5),
    warnings: [],
    missingFlags,
  };
};

const buildRowId = (group: OrderGroupKey, bundle: OrderBundle, index: number) => {
  const doc = bundle.documentId ?? 'doc';
  const mod = bundle.moduleId ?? 'mod';
  return `${group}-${doc}-${mod}-${index}`;
};

const buildOrderDetailDisplayRow = (
  group: OrderGroupKey,
  bundle: OrderBundle,
  fallbackEntity: OrderEntity,
  index: number,
): OrderDetailDisplayViewModel => {
  const entity = normalizeBundleEntity(bundle, fallbackEntity);
  const { bundleNumberLabel, bundleNumberValue } = resolveBundleNumberMeta(group, bundle);
  const grouped = buildGroupSpecificModel(group, bundle, bundleNumberLabel, bundleNumberValue);
  return {
    id: buildRowId(group, bundle, index),
    group,
    entity,
    bundle,
    bundleLabel: normalizeBundleName(bundle),
    operatorLine: resolveOperatorLine(bundle),
    title: grouped.title,
    detailLines: grouped.detailLines,
    items: grouped.items,
    chips: grouped.chips,
    bundleNumberLabel,
    bundleNumberValue,
    warnings: grouped.warnings,
    missingFlags: grouped.missingFlags,
  };
};

export const sortBundlesByLatestRule = (bundles: OrderBundle[]): OrderBundle[] => {
  const metas = bundles.map<BundleSortMeta>((bundle, index) => ({
    bundle,
    index,
    startedTimestamp: parseStartedTimestamp(bundle),
    documentId: parseDocumentId(bundle),
  }));
  metas.sort(compareBundleSortMeta);
  return metas.map((meta) => meta.bundle);
};

export const resolveLatestBundle = (bundles: OrderBundle[]): OrderBundle | null => {
  if (bundles.length === 0) return null;
  return sortBundlesByLatestRule(bundles)[0] ?? bundles[bundles.length - 1] ?? null;
};

export const buildOrderDetailDisplayRowsForGroup = (params: {
  group: OrderGroupKey;
  bundles: OrderBundle[];
  defaultEntity: OrderEntity;
}): OrderDetailDisplayViewModel[] => {
  return sortBundlesByLatestRule(params.bundles).map((bundle, index) =>
    buildOrderDetailDisplayRow(params.group, bundle, params.defaultEntity, index),
  );
};

export const buildOrderDetailDisplayCategories = (params: {
  orderBundles?: OrderBundle[];
  prescriptionBundles?: OrderBundle[];
}): OrderDetailDisplayCategoryViewModel[] => {
  const groupMap = new Map(ORDER_GROUP_REGISTRY.map((group) => [group.key, group]));
  const baseBundles = params.orderBundles ?? [];

  return SUMMARY_CATEGORIES.map((category) => {
    if (category.key === 'document') {
      return {
        ...category,
        defaultEntity: null,
        rows: [],
      } satisfies OrderDetailDisplayCategoryViewModel;
    }

    const groupSpec = groupMap.get(category.groupKey ?? category.key);
    if (!groupSpec) {
      return {
        ...category,
        defaultEntity: null,
        rows: [],
      } satisfies OrderDetailDisplayCategoryViewModel;
    }

    const sourceBundles =
      groupSpec.key === 'prescription' && params.prescriptionBundles
        ? params.prescriptionBundles
        : baseBundles.filter((bundle) => {
            const raw = bundle.entity?.trim() ?? '';
            return resolveOrderGroupKeyByEntity(raw) === groupSpec.key;
          });

    return {
      ...category,
      defaultEntity: groupSpec.defaultEntity,
      rows: buildOrderDetailDisplayRowsForGroup({
        group: groupSpec.key,
        bundles: sourceBundles,
        defaultEntity: groupSpec.defaultEntity,
      }),
    } satisfies OrderDetailDisplayCategoryViewModel;
  });
};
