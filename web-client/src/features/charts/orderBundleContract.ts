import type { OrderBundleBodyPart, OrderBundleItem } from './orderBundleApi';
import { resolveCanonicalOrderEntity } from './orderCategoryRegistry';
import { isOrcaEntityClassAllowed } from './orcaMedicalClassCatalog';
import { resolveOrcaOrderBodyPartPolicy } from './orcaSendabilityPolicy';
import { resolveOrcaOrderItemFields } from './orcaOrderItemMeta';

export const ORDER_BUNDLE_BODY_PART_CODE_PREFIX = '002';
export const ORDER_BUNDLE_COMMENT_CODE_PATTERN = /^(008[1-6]|8[1-6]|098|099|98|99)/;

export type OrderBundleContractRowRole = 'main' | 'material' | 'comment' | 'bodyPart';

type ContractRow = Pick<
  OrderBundleItem,
  'code' | 'name' | 'quantity' | 'unit' | 'memo' | 'rowRole' | 'selectionCommentItemNumber' | 'selectionCommentItemNumberBranch'
>;
type ContractBodyPart = Pick<OrderBundleBodyPart, 'code' | 'name' | 'quantity' | 'unit' | 'memo' | 'rowRole'>;

type InjectionBundleContractMode = 'save' | 'send';

export type InjectionBundleContractIssueCode =
  | 'invalid_injection_class_code'
  | 'mixed_coded_uncoded'
  | 'uncoded_row'
  | 'missing_main_row'
  | 'unsupported_admin_memo'
  | 'unsupported_selection_comment_parameter'
  | 'unsupported_body_part';

export type InjectionBundleContractIssue = {
  code: InjectionBundleContractIssueCode;
  detail: string;
};

const hasText = (value?: string | null) => Boolean(value?.trim());

export const hasOrderBundleRowValue = (item?: ContractRow | ContractBodyPart | null) =>
  Boolean(item?.code?.trim() || item?.name?.trim() || item?.quantity?.trim() || item?.unit?.trim() || item?.memo?.trim());

export const hasBundleRowValue = hasOrderBundleRowValue;

export const isOrderBundleCommentCode = (code: string) => ORDER_BUNDLE_COMMENT_CODE_PATTERN.test(code.trim());

export const isCommentBundleCode = (code?: string | null) => Boolean(code?.trim() && isOrderBundleCommentCode(code.trim()));

export const isOrderBundleBodyPartCode = (code: string) => code.trim().startsWith(ORDER_BUNDLE_BODY_PART_CODE_PREFIX);

export const isBodyPartBundleCode = (code?: string | null) => Boolean(code?.trim() && isOrderBundleBodyPartCode(code.trim()));

export const shouldTreatAsMaterialItem = (entity?: string | null, code?: string | null) => {
  const normalizedCode = code?.trim();
  if (!normalizedCode || !normalizedCode.startsWith('7')) return false;
  const canonicalEntity = resolveCanonicalOrderEntity(entity);
  return canonicalEntity === 'treatmentOrder' || canonicalEntity === 'injectionOrder';
};

export const resolveOrderBundleItemRowRole = (
  entity?: string | null,
  item?: ContractRow | ContractBodyPart | null,
): OrderBundleContractRowRole => {
  const canonicalEntity = resolveCanonicalOrderEntity(entity);
  if (!item) return 'main';
  if (item.rowRole === 'main' || item.rowRole === 'material' || item.rowRole === 'comment' || item.rowRole === 'bodyPart') {
    if (item.rowRole === 'material' && canonicalEntity === 'surgeryOrder') {
      return 'main';
    }
    return item.rowRole;
  }
  const code = item.code?.trim();
  if (code && isOrderBundleBodyPartCode(code)) return 'bodyPart';
  if (shouldTreatAsMaterialItem(entity, code)) return 'material';
  if (code && isOrderBundleCommentCode(code)) return 'comment';
  return 'main';
};

export const resolveBundleItemRowRole = resolveOrderBundleItemRowRole;

const buildInjectionContractDetail = (code: InjectionBundleContractIssueCode, mode: InjectionBundleContractMode) => {
  switch (code) {
    case 'invalid_injection_class_code':
      return `注射 bundle は exact allowlist（310/311/312/320/321/330/331/334/340/350）のみ${mode === 'save' ? '保存' : '送信'}できます。`;
    case 'mixed_coded_uncoded':
      return 'コードあり行とコードなし行が混在しています。コードなし行を削除するか、すべてマスタ選択してください。';
    case 'uncoded_row':
      return 'コードなし行が含まれています。注射は材料行を含めて ORCA に送れないため、すべてマスタ選択してください。';
    case 'missing_main_row':
      return '注射は送信可能な本体行（薬剤または手技）を1件以上含める必要があります。材料・コメント・部位・ローカルメモだけでは保存/送信できません。';
    case 'unsupported_admin_memo':
      return '注射メモ（adminMemo/speed）が入った bundle は ORCA 送信できません。ORCA carrier 未対応のため、送信前に空にしてください。';
    case 'unsupported_selection_comment_parameter':
      return '選択式コメントの itemNumber / itemNumberBranch は local-only です。保存・送信には使えません。';
    case 'unsupported_body_part':
      return 'bodyPart はこの entity / class では local-only です。保存・送信には使えません。';
    default:
      return '注射 bundle の契約に違反しています。';
  }
};

const hasUnsupportedSelectionCommentParameter = (item?: ContractRow | ContractBodyPart | null) => {
  if (!item) return false;
  const fields = resolveOrcaOrderItemFields(item);
  return Boolean(fields.itemNumber?.trim() || fields.itemNumberBranch?.trim());
};

export const collectOrderBundleContractStats = ({
  entity,
  items,
  bodyPart,
  admin,
  adminCode,
}: {
  entity?: string | null;
  items?: Array<ContractRow | null | undefined>;
  bodyPart?: ContractBodyPart | null;
  admin?: string | null;
  adminCode?: string | null;
}) => {
  const valuedRows = (items ?? [])
    .filter((item): item is ContractRow => hasOrderBundleRowValue(item))
    .map((item) => ({
      item,
      rowRole: resolveOrderBundleItemRowRole(entity, item),
      code: item.code?.trim() || '',
    }));
  const clinicalRows = valuedRows.filter((row) => row.rowRole === 'main' || row.rowRole === 'material');
  const codedRows = clinicalRows.filter((row) => Boolean(row.code));
  const uncodedRows = clinicalRows.filter((row) => !row.code);
  const sendableMainRows = clinicalRows.filter((row) => row.rowRole === 'main' && Boolean(row.code));
  const valuedBodyPart = hasOrderBundleRowValue(bodyPart)
    ? {
        item: bodyPart as ContractBodyPart,
        rowRole: 'bodyPart' as const,
        code: bodyPart?.code?.trim() || '',
      }
    : null;
  const auxiliaryRows = [
    ...valuedRows.filter((row) => row.rowRole !== 'main'),
    ...(valuedBodyPart ? [valuedBodyPart] : []),
  ];
  const hasSelectionCommentParameter = [...valuedRows, ...(valuedBodyPart ? [valuedBodyPart] : [])].some((row) =>
    hasUnsupportedSelectionCommentParameter(row.item),
  );
  return {
    valuedRows,
    clinicalRows,
    codedRows,
    uncodedRows,
    sendableMainRows,
    auxiliaryRows,
    hasAdmin: hasText(admin),
    hasAdminCode: hasText(adminCode),
    hasBodyPartValue: Boolean(valuedBodyPart),
    hasSelectionCommentParameter,
  };
};

export const collectInjectionBundleContractIssues = (
  {
    entity,
    classCode,
    admin,
    adminCode,
    adminMemo,
    items,
    bodyPart,
  }: {
    entity?: string | null;
    classCode?: string | null;
    admin?: string | null;
    adminCode?: string | null;
    adminMemo?: string | null;
    items?: Array<ContractRow | null | undefined>;
    bodyPart?: ContractBodyPart | null;
  },
  options: { mode?: InjectionBundleContractMode; blockAdminMemo?: boolean } = {},
): InjectionBundleContractIssue[] => {
  const canonicalEntity = resolveCanonicalOrderEntity(entity) ?? entity?.trim() ?? '';
  if (canonicalEntity !== 'injectionOrder') return [];

  const mode = options.mode ?? 'send';
  const stats = collectOrderBundleContractStats({
    entity: canonicalEntity,
    items,
    bodyPart,
    admin,
    adminCode,
  });
  const issues: InjectionBundleContractIssue[] = [];

  if (hasText(classCode)) {
    const normalizedClassCode = classCode?.trim() ?? '';
    if (!isOrcaEntityClassAllowed('injectionOrder', normalizedClassCode)) {
      issues.push({
        code: 'invalid_injection_class_code',
        detail: buildInjectionContractDetail('invalid_injection_class_code', mode),
      });
    }
  }
  if (stats.uncodedRows.length > 0 && stats.codedRows.length > 0) {
    issues.push({ code: 'mixed_coded_uncoded', detail: buildInjectionContractDetail('mixed_coded_uncoded', mode) });
  } else if (stats.uncodedRows.length > 0) {
    issues.push({ code: 'uncoded_row', detail: buildInjectionContractDetail('uncoded_row', mode) });
  }
  if (stats.hasSelectionCommentParameter) {
    issues.push({
      code: 'unsupported_selection_comment_parameter',
      detail: buildInjectionContractDetail('unsupported_selection_comment_parameter', mode),
    });
  }
  if (stats.hasBodyPartValue && resolveOrcaOrderBodyPartPolicy(canonicalEntity, classCode) === 'blocked') {
    issues.push({
      code: 'unsupported_body_part',
      detail: buildInjectionContractDetail('unsupported_body_part', mode),
    });
  }
  if (
    !issues.some(
      (issue) =>
        issue.code === 'mixed_coded_uncoded' ||
        issue.code === 'uncoded_row' ||
        issue.code === 'unsupported_selection_comment_parameter' ||
        issue.code === 'unsupported_body_part',
    ) &&
    (stats.clinicalRows.length > 0 || stats.auxiliaryRows.length > 0 || stats.hasAdmin || stats.hasAdminCode) &&
    stats.sendableMainRows.length === 0
  ) {
    issues.push({ code: 'missing_main_row', detail: buildInjectionContractDetail('missing_main_row', mode) });
  }
  if (options.blockAdminMemo && hasText(adminMemo)) {
    issues.push({
      code: 'unsupported_admin_memo',
      detail: buildInjectionContractDetail('unsupported_admin_memo', mode),
    });
  }

  return issues;
};
