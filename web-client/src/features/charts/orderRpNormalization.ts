import type { MedicalModV2Information } from './orcaClaimApi';
import {
  isChargeEntity,
  ORCA_SEND_PREFLIGHT_ORDER_ENTITIES,
  resolveCanonicalOrderEntity,
  resolveCanonicalChargeClassMeta,
  resolveCanonicalChargeClassName,
  resolveOrderEntityDefaultClassMeta,
} from './orderCategoryRegistry';
import {
  fetchOrderBundles,
  isOrderBundleBodyPartCode,
  normalizeOrderBundleBodyPart,
  type OrderBundle,
  type OrderBundleItem,
  type OrderBundleRowRole,
  type OrderBundleRowSubtype,
} from './orderBundleApi';
import {
  buildOrderBundleCodeBlockedMessage,
  buildRpRequiredBlockedMessage,
  collectOrderBundleCodeIssues,
  collectRpRequiredIssues,
  MEDICAL_MOD_V2_UNSUPPORTED_PHYSIOLOGY_ERROR_LABEL,
  MEDICAL_MOD_V2_UNSUPPORTED_PHYSIOLOGY_NEXT_ACTION,
  RP_REQUIRED_NEXT_ACTION,
} from './orderRpRequirements';
import { isOrderBundleCommentCode as isOrderBundleCommentCodeImpl } from './orcaCommentCarrierRules';
import { isAuxiliaryMaterialCode } from './orcaMedicalClassCatalog';
import { collectInjectionBundleContractIssues } from './orderBundleContract';
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';
import { buildPrescriptionOrderSendBundles, fetchPrescriptionOrder } from './prescriptionOrderApi';

const DRUG_CODE_PATTERN = /^6\d{8}$/;

const isCommentMedicationCode = (code: string) => isOrderBundleCommentCodeImpl(code);

const hasBundleItemValue = (item: OrderBundleItem) =>
  Boolean(item.code?.trim() || item.name?.trim() || item.quantity?.trim() || item.unit?.trim() || item.memo?.trim());

export type RpNormalizedMedication = {
  code: string;
  name?: string;
  number?: string;
  genericFlg?: 'yes' | 'no';
};

export type RpNormalizedRowSource =
  | { kind: 'body_part'; sectionIndex: 0 }
  | { kind: 'bundle_item'; itemIndex: number; rowRole: OrderBundleRowRole; rowSubtype?: OrderBundleRowSubtype; sectionIndex: number }
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
  | 'missing_admin_code'
  | 'invalid_injection_class_code'
  | 'uncoded_row'
  | 'mixed_coded_uncoded'
  | 'comment_only'
  | 'missing_main_row'
  | 'invalid_other_order_class'
  | 'unsupported_physiology_order'
  | 'unsupported_bacteria_subtype'
  | 'unsupported_selection_comment_parameter'
  | 'unsupported_admin_memo';

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
    masterCategory: item.masterCategory,
    selectionCommentItemNumber: item.selectionCommentItemNumber,
    selectionCommentItemNumberBranch: item.selectionCommentItemNumberBranch,
    rowRole: item.rowRole,
    rowSubtype: item.rowSubtype,
  };
};

const cloneBodyPartItem = (item?: OrderBundle['bodyPart'] | null): OrderBundleItem | null => {
  const normalized = normalizeOrderBundleBodyPart(item, { dropInvalid: true });
  if (!normalized) return null;
  return {
    code: normalized.code,
    name: normalized.name,
    quantity: normalized.quantity,
    unit: normalized.unit,
    memo: normalized.memo,
  };
};

const isBodyPartCodeValue = (code?: string | null) => isOrderBundleBodyPartCode(code);

const shouldTreatAsMaterialItem = (entity?: string | null, code?: string | null) => {
  const normalizedCode = code?.trim();
  if (!normalizedCode || !isAuxiliaryMaterialCode(normalizedCode)) return false;
  const canonicalEntity = resolveCanonicalOrderEntity(entity);
  return canonicalEntity === 'treatmentOrder' || canonicalEntity === 'injectionOrder';
};

const resolveBundleItemRowSubtype = (
  entity?: string | null,
  item?: OrderBundleItem | null,
  rowRole?: OrderBundleRowRole,
) => {
  const resolvedRole = rowRole ?? resolveBundleItemRowRole(entity, item);
  if (resolvedRole !== 'auxiliary') return undefined;
  if (item?.rowSubtype === 'material' || item?.rowSubtype === 'contrastDrug') {
    return item.rowSubtype;
  }
  const code = item?.code?.trim() ?? '';
  if ((resolveCanonicalOrderEntity(entity) ?? entity) === 'radiologyOrder' && DRUG_CODE_PATTERN.test(code)) {
    return 'contrastDrug' as const;
  }
  return 'material' as const;
};

const resolveBundleItemRowRole = (entity?: string | null, item?: OrderBundleItem | null) => {
  if (!item) return 'main' as const;
  if (item.rowRole === 'main' || item.rowRole === 'auxiliary' || item.rowRole === 'comment' || item.rowRole === 'bodyPart') {
    return item.rowRole;
  }
  if (item.rowRole === 'material') return 'auxiliary' as const;
  const code = item.code?.trim();
  if (isBodyPartCodeValue(code)) return 'bodyPart' as const;
  if ((resolveCanonicalOrderEntity(entity) ?? entity) === 'radiologyOrder' && DRUG_CODE_PATTERN.test(code ?? '')) {
    return 'auxiliary' as const;
  }
  if (shouldTreatAsMaterialItem(entity, code)) return 'auxiliary' as const;
  if (code && isCommentMedicationCode(code)) return 'comment' as const;
  return 'main' as const;
};

const collectNormalizedRows = (bundle: OrderBundle) => {
  const rows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const hasExplicitMaterial = Boolean(bundle.materialItems && bundle.materialItems.length > 0);
  const hasExplicitComment = Boolean(bundle.commentItems && bundle.commentItems.length > 0);
  const explicitBodyPart = cloneBodyPartItem(bundle.bodyPart);
  if (explicitBodyPart) {
    rows.push({ item: explicitBodyPart, source: { kind: 'body_part', sectionIndex: 0 } });
  }
  const mainRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const materialRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  const commentRows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }> = [];
  (bundle.items ?? []).forEach((item, itemIndex) => {
    const cloned = cloneBundleItem(item);
    if (!cloned || !hasBundleItemValue(cloned)) return;
    const code = cloned.code?.trim() ?? '';
    if (isBodyPartCodeValue(code) && explicitBodyPart) return;
    const rowRole = resolveBundleItemRowRole(bundle.entity, cloned);
    const rowSubtype = resolveBundleItemRowSubtype(bundle.entity, cloned, rowRole);
    const row = {
      item: cloned,
      source: {
        kind: 'bundle_item',
        itemIndex,
        rowRole,
        rowSubtype,
        sectionIndex: rowRole === 'comment' ? commentRows.length : rowRole === 'auxiliary' ? materialRows.length : mainRows.length,
      } as const,
    };
    if (rowRole === 'comment') {
      if (hasExplicitComment) return;
      commentRows.push(row);
      return;
    }
    if (rowRole === 'auxiliary') {
      if (hasExplicitMaterial) return;
      materialRows.push(row);
      return;
    }
    mainRows.push(row);
  });
  (bundle.materialItems ?? []).forEach((item, itemIndex) => {
    const cloned = cloneBundleItem(item);
    if (!cloned || !hasBundleItemValue(cloned)) return;
    const rowSubtype = resolveBundleItemRowSubtype(bundle.entity, cloned, 'auxiliary');
    materialRows.push({
      item: { ...cloned, rowRole: 'auxiliary', rowSubtype },
      source: {
        kind: 'bundle_item',
        itemIndex: (bundle.items?.length ?? 0) + itemIndex,
        rowRole: 'auxiliary',
        rowSubtype,
        sectionIndex: materialRows.length,
      },
    });
  });
  (bundle.commentItems ?? []).forEach((item, itemIndex) => {
    const cloned = cloneBundleItem(item);
    if (!cloned || !hasBundleItemValue(cloned)) return;
    commentRows.push({
      item: { ...cloned, rowRole: 'comment' },
      source: {
        kind: 'bundle_item',
        itemIndex: (bundle.items?.length ?? 0) + (bundle.materialItems?.length ?? 0) + itemIndex,
        rowRole: 'comment',
        rowSubtype: undefined,
        sectionIndex: commentRows.length,
      },
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

const resolveMedicalModV2BlockedBundleIssue = (bundle: OrderBundle) => {
  const canonicalEntity = resolveCanonicalOrderEntity(bundle.entity) ?? bundle.entity?.trim() ?? '';
  if (hasUnsupportedSelectionCommentParameterInBundle(bundle)) {
    return buildBundleIssue(
      bundle,
      'unsupported_selection_comment_parameter',
      '選択式コメントの itemNumber / branch は official medicalmodv2 request に carrier がないため ORCA送信できません。',
    );
  }
  if (canonicalEntity === 'physiologyOrder') {
    return buildBundleIssue(
      bundle,
      'unsupported_physiology_order',
      MEDICAL_MOD_V2_UNSUPPORTED_PHYSIOLOGY_ERROR_LABEL,
    );
  }
  if (canonicalEntity === 'otherOrder') {
    return buildBundleIssue(
      bundle,
      'invalid_other_order_class',
      'otherOrder は explicit local-only 契約のため ORCA 送信しません。',
    );
  }
  if (canonicalEntity === 'bacteriaOrder' && Boolean(bundle.subtype?.trim())) {
    return buildBundleIssue(
      bundle,
      'unsupported_bacteria_subtype',
      '細菌検査 subtype に対応する ORCA carrier はありません。院内ローカル情報として保持し、送信前に解消してください。',
    );
  }
  return null;
};

const buildInjectionContractItems = (rows: Array<{ item: OrderBundleItem; source: RpNormalizedRowSource }>) =>
  rows
    .filter((row): row is { item: OrderBundleItem; source: Extract<RpNormalizedRowSource, { kind: 'bundle_item' }> } => row.source.kind === 'bundle_item')
    .map(({ item, source }) => ({
      ...item,
      rowRole: source.rowRole === 'auxiliary' ? ('material' as const) : source.rowRole,
    }));

const hasUnsupportedSelectionCommentParameterInBundle = (bundle: OrderBundle) =>
  collectNormalizedRows(bundle).some(({ item }) => {
    const fields = resolveOrcaOrderItemFields(item);
    return Boolean(
      item.selectionCommentItemNumber?.trim() ||
        item.selectionCommentItemNumberBranch?.trim() ||
        fields.itemNumber?.trim() ||
        fields.itemNumberBranch?.trim(),
    );
  });

export const collectMedicalModV2BundleIssuesForBundle = (bundle: OrderBundle): MedicalModV2BundleIssue[] => {
  const canonicalEntity = resolveCanonicalOrderEntity(bundle.entity) ?? bundle.entity?.trim() ?? '';
  const blockedIssue = resolveMedicalModV2BlockedBundleIssue(bundle);
  if (blockedIssue) {
    return [blockedIssue];
  }
  const rows = collectNormalizedRows(bundle);
  if (canonicalEntity === 'injectionOrder') {
    const injectionIssues = collectInjectionBundleContractIssues(
      {
        entity: bundle.entity,
        classCode: resolveMedicalClass(bundle),
        admin: bundle.admin,
        adminCode: bundle.adminCode,
        adminMemo: bundle.adminMemo,
        items: buildInjectionContractItems(rows),
        bodyPart: bundle.bodyPart?.name
          ? {
              code: bundle.bodyPart.code?.trim() || undefined,
              name: bundle.bodyPart.name.trim(),
              quantity: bundle.bodyPart.quantity?.trim() || undefined,
              unit: bundle.bodyPart.unit?.trim() || undefined,
              memo: bundle.bodyPart.memo?.trim() || undefined,
              rowRole: 'bodyPart',
            }
          : undefined,
      },
      { mode: 'send', blockAdminMemo: true },
    );
    if (injectionIssues.length > 0) {
      return injectionIssues.map((issue) => buildBundleIssue(bundle, issue.code, issue.detail));
    }
  }
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
    if (isCommentMedicationCode(code) || isOrderBundleBodyPartCode(code)) return false;
    if (row.source.kind !== 'bundle_item') return false;
    return row.source.rowRole === 'main';
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
    genericFlg,
  };
};

const resolveMedicalClass = (bundle: OrderBundle) => {
  const chargeClassMeta = resolveCanonicalChargeClassMeta({
    entity: bundle.entity,
    classCode: bundle.classCode,
    itemCategory: bundle.items.find((item) => item.name?.trim() || item.code?.trim())?.masterCategory,
  });
  if (chargeClassMeta?.classCode) return chargeClassMeta.classCode;
  const explicit = bundle.classCode?.trim();
  if (explicit) return explicit;
  const classMeta = resolveOrderEntityDefaultClassMeta(bundle.entity?.trim());
  return classMeta?.classCode?.trim() || '';
};

const resolveMedicalClassName = (bundle: OrderBundle, medicalClass: string) => {
  const explicit = bundle.className?.trim();
  if (explicit && (!isChargeEntity(bundle.entity) || resolveCanonicalChargeClassName(bundle.entity, medicalClass) === explicit)) {
    return explicit;
  }
  const canonicalChargeClassName = resolveCanonicalChargeClassName(bundle.entity, medicalClass);
  if (canonicalChargeClassName) return canonicalChargeClassName;
  return explicit || undefined;
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
      genericFlg: undefined,
    },
    source: { kind: 'usage' },
  };
};

export const normalizeOrderBundleToRp = (bundle: OrderBundle): RpNormalizedBundle | null => {
  if (resolveMedicalModV2BlockedBundleIssue(bundle)) return null;
  const bundleRows: RpNormalizedRow[] = collectNormalizedRows(bundle).flatMap(({ item, source }) => {
    const medication = toRpNormalizedMedication(item);
    if (!medication) return [];
    return [{ medication, source }];
  });
  if (bundleRows.length === 0) return null;

  const medicalClass = resolveMedicalClass(bundle);
  if (!medicalClass) return null;
  const medicalClassName = resolveMedicalClassName(bundle, medicalClass);

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
      medicalClassName,
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

  // ORCA medicalmodv2 request has no Medication_Unit_Code carrier.
  const info: MedicalModV2Information = {
    entity: normalized.header.entity,
    medicalClass: normalized.header.medicalClass,
    medicalClassName: normalized.header.medicalClassName,
    medicalClassNumber: normalized.header.medicalClassNumber,
    medications: normalized.rows.map((row) => ({
      code: row.medication.code,
      name: row.medication.name,
      number: row.medication.number,
      genericFlg: row.medication.genericFlg,
    })),
  };
  const source: MedicalModV2InformationSource = {
    ...normalized.header,
    rows: normalized.rows,
  };
  return { info, source };
};

export const toMedicalModV2Information = (bundle: OrderBundle): MedicalModV2Information | null =>
  toMedicalModV2InformationWithSource(bundle)?.info ?? null;

export const fetchMedicalModV2OrderBundles = async (patientId: string, from: string, encounterId?: string) => {
  const results = await Promise.allSettled(
    ORCA_SEND_PREFLIGHT_ORDER_ENTITIES.map(async (entity) => {
      if (entity === 'medOrder') {
        const prescriptionOrder = await fetchPrescriptionOrder({ patientId, from, encounterId });
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
    const entity = ORCA_SEND_PREFLIGHT_ORDER_ENTITIES[index];
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
  if (sourceKind === 'usage') return /^\d+$/.test(normalized);
  if (sourceKind === 'body_part') return isOrderBundleBodyPartCode(normalized);
  return /^\d{9}$/.test(normalized) || isCommentMedicationCode(normalized);
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
  // physiologyOrder / bacteriaOrder subtype は sendable payload に落とさず、ここで明示的に除外する。
  const sendableBundles = bundles.filter((bundle) => !resolveMedicalModV2BlockedBundleIssue(bundle));
  const medicalInformationWithSource = sendableBundles
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
  if (prepared.bundleIssues.length > 0) {
    const preview = prepared.bundleIssues.slice(0, 4).map(formatMedicalModV2BundleIssue).join(' / ');
    const remaining = prepared.bundleIssues.length - 4;
    const unsupportedPhysiologyIssue = prepared.bundleIssues.some((issue) => issue.code === 'unsupported_physiology_order');
    const unsupportedBacteriaIssue = prepared.bundleIssues.some((issue) => issue.code === 'unsupported_bacteria_subtype');
    const unsupportedSelectionCommentIssue = prepared.bundleIssues.some(
      (issue) => issue.code === 'unsupported_selection_comment_parameter',
    );
    return {
      message: `ORCA送信を停止: 非送信データを検出（${preview}${remaining > 0 ? ` / 他${remaining}件` : ''}）`,
      nextAction: unsupportedPhysiologyIssue
        ? MEDICAL_MOD_V2_UNSUPPORTED_PHYSIOLOGY_NEXT_ACTION
        : unsupportedBacteriaIssue
          ? '細菌検査 subtype は official ORCA carrier がないため送信できません。院内ローカル情報として保持し、ORCA送信対象から外してください。'
          : unsupportedSelectionCommentIssue
            ? '選択式コメントの itemNumber / branch は official medicalmodv2 carrier がないため送信できません。parameter 付きコメントを削除してください。'
          : 'コードなし行、adminCode 未設定、adminMemo/speed、コメントのみ束、材料のみ束、部位のみ束を修正してから再送してください。',
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
  return null;
};
