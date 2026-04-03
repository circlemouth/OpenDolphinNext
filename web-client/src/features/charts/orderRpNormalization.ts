import type { MedicalModV2Information } from './orcaClaimApi';
import { resolveCanonicalOrderEntity, resolveOrderEntityDefaultClassMeta } from './orderCategoryRegistry';
import type { OrderBundle, OrderBundleItem } from './orderBundleApi';
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';

const COMMENT_CODE_PATTERN = /^(008[1-6]|8[1-6]|098|099|98|99)/;
const BODY_PART_CODE_PATTERN = /^002/;
const DRUG_CODE_PATTERN = /^6\d{8}$/;

const isCommentMedicationCode = (code: string) => COMMENT_CODE_PATTERN.test(code.trim());
const isBodyPartCode = (code: string) => BODY_PART_CODE_PATTERN.test(code.trim());

const hasBundleItemValue = (item: OrderBundleItem) =>
  Boolean(item.code?.trim() || item.name?.trim() || item.quantity?.trim() || item.unit?.trim() || item.memo?.trim());

export type RpNormalizedMedication = {
  code: string;
  name?: string;
  number?: string;
  unit?: string;
  genericFlg?: 'yes' | 'no';
};

export type RpNormalizedRowSource =
  | { kind: 'body_part' }
  | { kind: 'bundle_item'; itemIndex: number }
  | { kind: 'usage' };

export type RpNormalizedRow = {
  medication: RpNormalizedMedication;
  source: RpNormalizedRowSource;
};

export type RpNormalizedHeader = {
  entity?: string;
  documentId?: number;
  moduleId?: number;
  bundleName?: string;
  admin?: string;
  adminCode?: string;
  adminCodeSystem?: string;
  medicalClass: string;
  medicalClassName?: string;
  medicalClassNumber: string;
};

export type RpNormalizedBundle = {
  header: RpNormalizedHeader;
  rows: RpNormalizedRow[];
};

export type MedicalModV2BundleIssueCode =
  | 'uncoded_row'
  | 'mixed_coded_uncoded'
  | 'comment_only'
  | 'missing_main_row';

export type MedicalModV2BundleIssue = {
  code: MedicalModV2BundleIssueCode;
  entity?: string;
  bundleName?: string;
  documentId?: number;
  moduleId?: number;
  detail: string;
};

const resolveIssueBundleLabel = (bundle: OrderBundle) => bundle.bundleName?.trim() || '名称未設定';

const cloneBundleItem = (item?: OrderBundleItem | null): OrderBundleItem | null => {
  if (!item?.name?.trim()) return null;
  return {
    code: item.code?.trim() || undefined,
    name: item.name.trim(),
    quantity: item.quantity?.trim() || undefined,
    unit: item.unit?.trim() || undefined,
    memo: item.memo?.trim() || undefined,
    genericFlg: item.genericFlg,
    userComment: item.userComment,
    rowRole: item.rowRole,
  };
};

const cloneBodyPartItem = (item?: OrderBundle['bodyPart'] | null): OrderBundleItem | null => {
  if (!item?.name?.trim()) return null;
  return {
    code: item.code?.trim() || undefined,
    name: item.name.trim(),
    quantity: item.quantity?.trim() || undefined,
    unit: item.unit?.trim() || undefined,
    memo: item.memo?.trim() || undefined,
  };
};

const isBodyPartCodeValue = (code?: string | null) => Boolean(code?.trim() && isBodyPartCode(code.trim()));

const shouldTreatAsMaterialItem = (entity?: string | null, code?: string | null) => {
  const normalizedCode = code?.trim();
  if (!normalizedCode || !normalizedCode.startsWith('7')) return false;
  const canonicalEntity = resolveCanonicalOrderEntity(entity);
  return canonicalEntity !== 'radiologyOrder';
};

const resolveBundleItemRowRole = (entity?: string | null, item?: OrderBundleItem | null) => {
  if (!item) return 'main' as const;
  if (item.rowRole === 'main' || item.rowRole === 'material' || item.rowRole === 'comment' || item.rowRole === 'bodyPart') {
    return item.rowRole;
  }
  const code = item.code?.trim();
  if (isBodyPartCodeValue(code)) return 'bodyPart' as const;
  if (shouldTreatAsMaterialItem(entity, code)) return 'material' as const;
  if (code && isCommentMedicationCode(code)) return 'comment' as const;
  return 'main' as const;
};

const collectNormalizedRows = (bundle: OrderBundle) => {
  const rows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const explicitBodyPart = cloneBodyPartItem(bundle.bodyPart);
  const legacyBodyPart = explicitBodyPart
    ? null
    : (bundle.items ?? [])
        .map(cloneBundleItem)
        .find((item): item is OrderBundleItem => Boolean(item && isBodyPartCodeValue(item.code)));
  if (explicitBodyPart) {
    rows.push({ item: explicitBodyPart, source: { kind: 'body_part' } });
  } else if (legacyBodyPart) {
    rows.push({ item: legacyBodyPart, source: { kind: 'body_part' } });
  }
  const mainRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const materialRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const commentRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  (bundle.items ?? []).forEach((item, itemIndex) => {
    const cloned = cloneBundleItem(item);
    if (!cloned || !hasBundleItemValue(cloned)) return;
    const code = cloned.code?.trim() ?? '';
    if (isBodyPartCodeValue(code) && (explicitBodyPart || legacyBodyPart)) return;
    const row = { item: cloned, source: { kind: 'bundle_item', itemIndex } as const };
    const rowRole = resolveBundleItemRowRole(bundle.entity, cloned);
    if (rowRole === 'comment') {
      commentRows.push(row);
      return;
    }
    if (rowRole === 'material') {
      materialRows.push(row);
      return;
    }
    mainRows.push(row);
  });
  rows.push(...mainRows, ...materialRows, ...commentRows);
  return rows;
};

const buildBundleIssue = (bundle: OrderBundle, code: MedicalModV2BundleIssueCode, detail: string): MedicalModV2BundleIssue => ({
  code,
  entity: resolveCanonicalOrderEntity(bundle.entity) ?? (bundle.entity?.trim() || undefined),
  bundleName: resolveIssueBundleLabel(bundle),
  documentId: bundle.documentId,
  moduleId: bundle.moduleId,
  detail,
});

export const collectMedicalModV2BundleIssuesForBundle = (bundle: OrderBundle): MedicalModV2BundleIssue[] => {
  const canonicalEntity = resolveCanonicalOrderEntity(bundle.entity) ?? bundle.entity?.trim() ?? '';
  const rows = collectNormalizedRows(bundle);
  const valuedRows = rows.filter((row) => hasBundleItemValue(row.item));
  if (valuedRows.length === 0) {
    return [buildBundleIssue(bundle, 'missing_main_row', '送信対象の行がありません。')];
  }

  const codedRows = valuedRows.filter((row) => Boolean(row.item.code?.trim()));
  const uncodedRows = valuedRows.filter((row) => !row.item.code?.trim());
  if (uncodedRows.length > 0 && codedRows.length > 0) {
    return [
      buildBundleIssue(
        bundle,
        'mixed_coded_uncoded',
        'コードあり行とコードなし行が混在しています。コードなし行を削除するか、必ずマスタ選択してください。',
      ),
    ];
  }
  if (uncodedRows.length > 0) {
    return [
      buildBundleIssue(
        bundle,
        'uncoded_row',
        'コードなし行が含まれています。名前だけの行は ORCA へ送れないため、マスタ選択してください。',
      ),
    ];
  }

  const sendableMainRows = codedRows.filter((row) => {
    const code = row.item.code?.trim() ?? '';
    return !isCommentMedicationCode(code) && !isBodyPartCode(code);
  });
  const requireMainRow = canonicalEntity !== 'medOrder' && canonicalEntity !== 'injectionOrder';
  if (requireMainRow && sendableMainRows.length === 0) {
    return [
      buildBundleIssue(
        bundle,
        'comment_only',
        '部位やコメントだけでは送信できません。本体となるコード行を1件以上追加してください。',
      ),
    ];
  }
  return [];
};

export const collectMedicalModV2BundleIssues = (bundles: OrderBundle[]): MedicalModV2BundleIssue[] =>
  bundles.flatMap((bundle) => collectMedicalModV2BundleIssuesForBundle(bundle));

const toRpNormalizedMedication = (item: OrderBundleItem): RpNormalizedMedication | null => {
  const code = item.code?.trim();
  if (!code) return null;
  const { genericFlg: resolvedGenericFlg } = resolveOrcaOrderItemFields(item);
  const genericFlg = DRUG_CODE_PATTERN.test(code) ? resolvedGenericFlg : undefined;
  return {
    code,
    name: item.name?.trim() || undefined,
    number: item.quantity?.trim() || undefined,
    unit: item.unit?.trim() || undefined,
    genericFlg,
  };
};

const resolveMedicalClass = (bundle: OrderBundle) => {
  const explicit = bundle.classCode?.trim();
  if (explicit) return explicit;
  const classMeta = resolveOrderEntityDefaultClassMeta(bundle.entity?.trim());
  return classMeta?.classCode?.trim() || '';
};

const buildUsageRow = (bundle: OrderBundle, rows: RpNormalizedRow[]): RpNormalizedRow | null => {
  const canonicalEntity = resolveCanonicalOrderEntity(bundle.entity) ?? bundle.entity?.trim() ?? '';
  const isPrescription = canonicalEntity === 'medOrder';
  const isInjection = canonicalEntity === 'injectionOrder';
  if (!isPrescription && !isInjection) return null;
  const usageCodeCandidate =
    bundle.adminCode?.trim() || (isPrescription && bundle.admin?.trim() ? bundle.admin.trim().split(/\s+/)[0] : '');
  const usageCode = /^\d{4,}$/.test(usageCodeCandidate) ? usageCodeCandidate : '';
  if (!usageCode) return null;
  const hasUsageAlready = rows.some((row) => row.medication.code.trim() === usageCode);
  if (hasUsageAlready) return null;
  const usageName =
    bundle.admin?.trim()
      ? bundle.admin.trim().startsWith(`${usageCode} `)
        ? bundle.admin.trim().slice(usageCode.length).trim() || undefined
        : bundle.admin.trim()
      : undefined;
  return {
    medication: {
      code: usageCode,
      name: usageName,
      number: '',
      unit: undefined,
      genericFlg: undefined,
    },
    source: { kind: 'usage' },
  };
};

export const normalizeOrderBundleToRp = (bundle: OrderBundle): RpNormalizedBundle | null => {
  const bundleRows: RpNormalizedRow[] = collectNormalizedRows(bundle).flatMap(({ item, source }) => {
    const medication = toRpNormalizedMedication(item);
    if (!medication) return [];
    return [{ medication, source }];
  });
  if (bundleRows.length === 0) return null;

  const medicalClass = resolveMedicalClass(bundle);
  if (!medicalClass) return null;

  const usageRow = buildUsageRow(bundle, bundleRows);
  const canonicalEntity = resolveCanonicalOrderEntity(bundle.entity) ?? bundle.entity?.trim() ?? '';
  const isPrescription = canonicalEntity === 'medOrder';
  const isInjection = canonicalEntity === 'injectionOrder';
  const bodyPartRows = bundleRows.filter((row) => row.source.kind === 'body_part');
  const nonBodyPartRows = bundleRows.filter((row) => row.source.kind !== 'body_part');
  const head = isPrescription ? nonBodyPartRows.filter((row) => !isCommentMedicationCode(row.medication.code)) : nonBodyPartRows;
  const tail = isPrescription ? nonBodyPartRows.filter((row) => isCommentMedicationCode(row.medication.code)) : [];
  const rows = isInjection
    ? [...(usageRow ? [usageRow] : []), ...bodyPartRows, ...head]
    : [...bodyPartRows, ...head, ...(usageRow ? [usageRow] : []), ...tail];

  return {
    header: {
      entity: resolveCanonicalOrderEntity(bundle.entity) ?? (bundle.entity?.trim() || undefined),
      documentId: bundle.documentId,
      moduleId: bundle.moduleId,
      bundleName: bundle.bundleName?.trim() || undefined,
      admin: bundle.admin?.trim() || undefined,
      adminCode: bundle.adminCode?.trim() || undefined,
      adminCodeSystem: bundle.adminCodeSystem?.trim() || undefined,
      medicalClass,
      medicalClassName: bundle.className?.trim() || undefined,
      medicalClassNumber: bundle.bundleNumber?.trim() || '1',
    },
    rows,
  };
};

export type MedicalModV2InformationSource = RpNormalizedHeader & {
  rows: RpNormalizedRow[];
};

export const toMedicalModV2InformationWithSource = (
  bundle: OrderBundle,
): { info: MedicalModV2Information; source: MedicalModV2InformationSource } | null => {
  const normalized = normalizeOrderBundleToRp(bundle);
  if (!normalized) return null;

  const info: MedicalModV2Information = {
    medicalClass: normalized.header.medicalClass,
    medicalClassName: normalized.header.medicalClassName,
    medicalClassNumber: normalized.header.medicalClassNumber,
    medications: normalized.rows.map((row) => row.medication),
  };
  const source: MedicalModV2InformationSource = {
    ...normalized.header,
    rows: normalized.rows,
  };
  return { info, source };
};
