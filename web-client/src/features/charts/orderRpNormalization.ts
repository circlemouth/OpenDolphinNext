import type { MedicalModV2Information } from './orcaClaimApi';
import {
  ORCA_SEND_ORDER_ENTITIES,
  resolveCanonicalOrderEntity,
  resolveOrderEntityDefaultClassMeta,
} from './orderCategoryRegistry';
import { fetchOrderBundles, type OrderBundle, type OrderBundleItem } from './orderBundleApi';
import {
  buildOrderBundleCodeBlockedMessage,
  buildRpRequiredBlockedMessage,
  collectOrderBundleCodeIssues,
  collectRpRequiredIssues,
  RP_REQUIRED_NEXT_ACTION,
} from './orderRpRequirements';
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';
import {
  hasOrcaOrderRowValue,
  isOrcaBodyPartCode,
  isOrcaCommentCode,
  isOrcaNineDigitCode,
  isOrcaUsageCode,
  isSendableCodeForRowRole,
  resolveOrcaOrderRowRole,
  type OrcaOrderRowRole,
} from './orcaOrderRowRole';
import { buildPrescriptionOrderSendBundles, fetchPrescriptionOrder } from './prescriptionOrderApi';

const DRUG_CODE_PATTERN = /^6\d{8}$/;

export const isCommentMedicationCode = (code: string) => isOrcaCommentCode(code);
export const isBodyPartCode = (code: string) => isOrcaBodyPartCode(code);
export const isUsageMedicationCode = (code: string) => isOrcaUsageCode(code);
export const isNineDigitMedicationCode = (code: string) => isOrcaNineDigitCode(code);
export const isSendableMaterialOrderCode = (code?: string | null) => {
  const normalized = code?.trim() ?? '';
  if (!normalized) return false;
  return isSendableCodeForRowRole('material', normalized);
};
export const isSendableMainOrderCode = (entity?: string | null, code?: string | null) => {
  const normalized = code?.trim() ?? '';
  if (!normalized) return false;
  const canonicalEntity = resolveCanonicalOrderEntity(entity);
  if (canonicalEntity === 'otherOrder') {
    return /^(8|18)/.test(normalized);
  }
  return isSendableCodeForRowRole('main', normalized);
};

export type RpNormalizedMedication = {
  code: string;
  name?: string;
  number?: string;
  unit?: string;
  genericFlg?: 'yes' | 'no';
};

export type RpNormalizedRowSource =
  | { kind: 'body_part'; rowRole: 'bodyPart'; sectionIndex: 0 }
  | { kind: 'bundle_item'; itemIndex: number; rowRole: Exclude<OrcaOrderRowRole, 'bodyPart'>; sectionIndex: number }
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
  | 'missing_main_row'
  | 'unsupported_bacteria_subtype';

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
    rowRole: 'bodyPart',
  };
};

const isBodyPartCodeValue = (code?: string | null) => Boolean(code?.trim() && isBodyPartCode(code.trim()));

const collectNormalizedRows = (bundle: OrderBundle) => {
  const rows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const explicitBodyPart = cloneBodyPartItem(bundle.bodyPart);
  const legacyBodyPart = explicitBodyPart
    ? null
    : (bundle.items ?? [])
        .map(cloneBundleItem)
        .find((item): item is OrderBundleItem => Boolean(item && isBodyPartCodeValue(item.code)));
  if (explicitBodyPart) {
    rows.push({ item: explicitBodyPart, source: { kind: 'body_part', rowRole: 'bodyPart', sectionIndex: 0 } });
  } else if (legacyBodyPart) {
    rows.push({ item: legacyBodyPart, source: { kind: 'body_part', rowRole: 'bodyPart', sectionIndex: 0 } });
  }
  const mainRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const materialRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const commentRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  (bundle.items ?? []).forEach((item, itemIndex) => {
    const cloned = cloneBundleItem(item);
    if (!cloned || !hasOrcaOrderRowValue(cloned)) return;
    const code = cloned.code?.trim() ?? '';
    if (isBodyPartCodeValue(code) && (explicitBodyPart || legacyBodyPart)) return;
    const rowRole = resolveOrcaOrderRowRole({ entity: bundle.entity, item: cloned });
    if (rowRole === 'comment') {
      commentRows.push({
        item: cloned,
        source: { kind: 'bundle_item', itemIndex, rowRole: 'comment', sectionIndex: commentRows.length },
      });
      return;
    }
    if (rowRole === 'material') {
      materialRows.push({
        item: cloned,
        source: { kind: 'bundle_item', itemIndex, rowRole: 'material', sectionIndex: materialRows.length },
      });
      return;
    }
    mainRows.push({
      item: cloned,
      source: { kind: 'bundle_item', itemIndex, rowRole: 'main', sectionIndex: mainRows.length },
    });
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
  if (canonicalEntity === 'bacteriaOrder' && bundle.subtype?.trim()) {
    return [
      buildBundleIssue(
        bundle,
        'unsupported_bacteria_subtype',
        '細菌検査 subtype は ORCA 送信 carrier 未対応のため、送信前に停止します。',
      ),
    ];
  }
  const rows = collectNormalizedRows(bundle);
  const valuedRows = rows.filter((row) => hasOrcaOrderRowValue(row.item));
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

  const semanticMainRows = codedRows.filter((row) => {
    const rowRole = resolveOrcaOrderRowRole({ entity: bundle.entity, item: row.item });
    return rowRole === 'main';
  });
  const requireMainRow = canonicalEntity !== 'medOrder' && canonicalEntity !== 'injectionOrder';
  if (requireMainRow && semanticMainRows.length === 0) {
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

export const toMedicalModV2Information = (bundle: OrderBundle): MedicalModV2Information | null =>
  toMedicalModV2InformationWithSource(bundle)?.info ?? null;

export const fetchMedicalModV2OrderBundles = async (patientId: string, from: string) => {
  const results = await Promise.allSettled(
    ORCA_SEND_ORDER_ENTITIES.map(async (entity) => {
      if (entity === 'medOrder') {
        const prescriptionOrder = await fetchPrescriptionOrder({ patientId, from });
        if (!prescriptionOrder.ok) {
          return {
            ok: false,
            message: prescriptionOrder.message,
            status: prescriptionOrder.status,
            errorCode: prescriptionOrder.errorCode,
            bundles: [] as OrderBundle[],
          };
        }
        return {
          ok: true,
          message: prescriptionOrder.message,
          status: prescriptionOrder.status,
          errorCode: undefined,
          bundles: buildPrescriptionOrderSendBundles(prescriptionOrder.order),
        };
      }
      return fetchOrderBundles({ patientId, entity, from });
    }),
  );
  const bundles: OrderBundle[] = [];
  const errors: string[] = [];
  results.forEach((result, index) => {
    const entity = ORCA_SEND_ORDER_ENTITIES[index];
    if (result.status === 'fulfilled') {
      if (!result.value.ok) {
        const status = typeof result.value.status === 'number' ? `HTTP ${result.value.status}` : 'request_failed';
        const reason = result.value.message?.trim() || result.value.errorCode?.trim() || status;
        errors.push(`${entity}: ${reason}`);
        return;
      }
      bundles.push(
        ...(result.value.bundles ?? []).map((bundle) => ({
          ...bundle,
          entity: resolveCanonicalOrderEntity(bundle.entity) ?? entity,
        })),
      );
      return;
    }
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    errors.push(`${entity}: ${reason}`);
  });
  return { bundles, errors };
};

const isAllowedMedicalModV2Code = (code: string, sourceKind?: RpNormalizedRowSource['kind']) => {
  const normalized = code.trim();
  if (!normalized) return false;
  if (sourceKind === 'usage') return isUsageMedicationCode(normalized);
  if (sourceKind === 'body_part') return isBodyPartCode(normalized);
  return isNineDigitMedicationCode(normalized) || isCommentMedicationCode(normalized);
};

export const formatMedicalModV2BundleIssue = (issue: MedicalModV2BundleIssue) => {
  const entity = issue.entity?.trim() || 'order';
  const bundleName = issue.bundleName?.trim() || '名称未設定';
  return `${entity}/${bundleName}: ${issue.detail}`;
};

export const prepareMedicalModV2SendData = (bundles: OrderBundle[]) => {
  const requiredIssues = collectRpRequiredIssues(bundles);
  const bundleIssues = collectMedicalModV2BundleIssues(bundles);
  const codeIssues = collectOrderBundleCodeIssues(bundles);
  const medicalInformationWithSource = bundles
    .map(toMedicalModV2InformationWithSource)
    .filter(
      (entry): entry is NonNullable<ReturnType<typeof toMedicalModV2InformationWithSource>> => Boolean(entry),
    );
  const medicalInformationSources = medicalInformationWithSource.map((entry) => entry.source);
  const medicalInformation = medicalInformationWithSource.map((entry) => entry.info);

  const groupLimit = 40;
  const rowLimit = 40;
  const totalGroups = medicalInformation.length;
  const groupLimitExceeded = totalGroups > groupLimit;
  const rowLimitExceeded = medicalInformation.some((info) => (info.medications?.length ?? 0) > rowLimit);
  const limitReasons: string[] = [];
  if (groupLimitExceeded) {
    limitReasons.push(`Medical_Information=${totalGroups}/${groupLimit}`);
  }
  if (rowLimitExceeded) {
    limitReasons.push(`Medication_info>${rowLimit}`);
  }

  const invalidCodes: Array<{ code: string; name?: string; group: number; row: number }> = [];
  medicalInformation.forEach((info, groupIndex) => {
    info.medications.forEach((item, rowIndex) => {
      const code = item.code?.trim() ?? '';
      if (!code) return;
      const rowSource = medicalInformationSources[groupIndex]?.rows[rowIndex];
      if (isAllowedMedicalModV2Code(code, rowSource?.source.kind)) return;
      if (invalidCodes.length >= 12) return;
      invalidCodes.push({ code, name: item.name?.trim() || undefined, group: groupIndex + 1, row: rowIndex + 1 });
    });
  });

  return {
    requiredIssues,
    bundleIssues,
    codeIssues,
    medicalInformationWithSource,
    medicalInformationSources,
    medicalInformation,
    totalGroups,
    groupLimitExceeded,
    rowLimitExceeded,
    limitReasons,
    invalidCodes,
  };
};

export const buildMedicalModV2BlockNotice = (prepared: ReturnType<typeof prepareMedicalModV2SendData>) => {
  if (prepared.requiredIssues.length > 0) {
    return {
      message: buildRpRequiredBlockedMessage(prepared.requiredIssues),
      nextAction: RP_REQUIRED_NEXT_ACTION,
    };
  }
  if (prepared.invalidCodes.length > 0) {
    const preview = prepared.invalidCodes
      .slice(0, 5)
      .map((entry) => `G${entry.group}-L${entry.row}:${entry.code}${entry.name ? `(${entry.name})` : ''}`)
      .join(' / ');
    return {
      message: `ORCA送信を停止: 9桁コード/コメント/部位コード/用法数字コード以外の入力コードがあります: ${preview}`,
      nextAction: 'オーダー入力に戻り、候補選択またはコード補正候補を適用してください。',
    };
  }
  if (prepared.bundleIssues.length > 0) {
    const preview = prepared.bundleIssues.slice(0, 4).map(formatMedicalModV2BundleIssue).join(' / ');
    const remaining = prepared.bundleIssues.length - 4;
    return {
      message: `ORCA送信を停止: 非送信データを検出（${preview}${remaining > 0 ? ` / 他${remaining}件` : ''}）`,
      nextAction: 'コードなし行、コメントのみ束、部位のみ束を修正してから再送してください。',
    };
  }
  if (prepared.codeIssues.length > 0) {
    return {
      message: buildOrderBundleCodeBlockedMessage(prepared.codeIssues),
      nextAction: 'コード未入力の行を補正してから再送してください。',
    };
  }
  if (prepared.groupLimitExceeded || prepared.rowLimitExceeded) {
    return {
      message: `ORCA送信を停止: 中途データ上限を超過（${prepared.limitReasons.join(' / ')}）`,
      nextAction: 'RP/オーダー束を分割して再送してください。',
    };
  }
  return null;
};
