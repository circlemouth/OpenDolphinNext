import { resolveOrderEntityDefaultClassMeta, resolveOrderEntityLabel } from './orderCategoryRegistry';
import type { OrderBundle, OrderBundleItem } from './orderBundleApi';

export type RpRequiredField = 'Medical_Class' | 'Medical_Class_Number' | 'Medication_info';
export type RpRequiredEntity = 'medOrder' | 'injectionOrder';

export type RpRequiredIssue = {
  entity: RpRequiredEntity;
  bundleName?: string;
  documentId?: number;
  moduleId?: number;
  missing: RpRequiredField[];
};

export type OrderBundleCodeIssue = {
  entity?: string;
  bundleName?: string;
  documentId?: number;
  moduleId?: number;
  mixedRows: boolean;
  missingCodeItemIndexes: number[];
};

const RP_REQUIRED_ENTITIES = new Set<RpRequiredEntity>(['medOrder', 'injectionOrder']);

export const RP_REQUIRED_ERROR_LABEL = 'RP必須項目不足';
export const RP_REQUIRED_NEXT_ACTION =
  '処方RP/注射RPの Medical_Class / Medical_Class_Number（回数・日数）/ Medication_info（薬剤明細）を入力してください。';
export const RP_REQUIRED_FIELD_LABELS: Record<RpRequiredField, string> = {
  Medical_Class: 'Medical_Class（診療識別）',
  Medical_Class_Number: 'Medical_Class_Number（回数/日数）',
  Medication_info: 'Medication_info（薬剤明細）',
};

export const resolveRpRequiredFieldLabel = (field: RpRequiredField) => RP_REQUIRED_FIELD_LABELS[field] ?? field;

export const SENDABLE_USAGE_CODE_PATTERN = /^\d{4,}$/;

const trimValue = (value?: string | null) => value?.trim() ?? '';

export const isSendableUsageCode = (code?: string | null) => SENDABLE_USAGE_CODE_PATTERN.test(trimValue(code));

export const isSendableInjectionAdminCode = (code?: string | null) => isSendableUsageCode(code);

export const hasInjectionAdminText = (admin?: string | null) => trimValue(admin).length > 0;

export const hasInvalidInjectionAdminCode = (adminCode?: string | null) => {
  const normalized = trimValue(adminCode);
  return normalized.length > 0 && !isSendableInjectionAdminCode(normalized);
};

const RP_REQUIRED_ENTITY_ALIASES: Record<string, RpRequiredEntity> = {
  medorder: 'medOrder',
  prescription: 'medOrder',
  rp: 'medOrder',
  injectionorder: 'injectionOrder',
  injection: 'injectionOrder',
};

const normalizeEntity = (entity?: string | null): RpRequiredEntity | null => {
  const normalized = (entity ?? '').trim();
  if (!normalized) return null;
  if (RP_REQUIRED_ENTITIES.has(normalized as RpRequiredEntity)) return normalized as RpRequiredEntity;
  const alias = normalized.toLowerCase().replace(/[^a-z0-9]/g, '');
  return RP_REQUIRED_ENTITY_ALIASES[alias] ?? null;
};

const inferEntityFromClassCode = (classCode?: string | null): RpRequiredEntity | null => {
  const normalized = (classCode ?? '').trim();
  if (!normalized) return null;
  if (normalized.startsWith('2')) return 'medOrder';
  if (normalized.startsWith('3')) return 'injectionOrder';
  return null;
};

const hasMedicationInfo = (items?: Array<Pick<OrderBundleItem, 'code'>> | null) =>
  Boolean(items?.some((item) => Boolean(item.code?.trim())));

const hasItemValue = (item?: Pick<OrderBundleItem, 'name' | 'quantity' | 'unit' | 'memo'> | null) =>
  Boolean(item?.name?.trim() || item?.quantity?.trim() || item?.unit?.trim() || item?.memo?.trim());

const resolveMedicalClass = (entity: RpRequiredEntity, classCode?: string | null) => {
  const explicit = classCode?.trim();
  if (explicit) return explicit;
  return resolveOrderEntityDefaultClassMeta(entity)?.classCode?.trim() ?? '';
};

export const resolveRpRequiredIssue = (input: {
  entity?: string | null;
  bundleName?: string | null;
  documentId?: number;
  moduleId?: number;
  classCode?: string | null;
  bundleNumber?: string | null;
  items?: Array<Pick<OrderBundleItem, 'code'>> | null;
}): RpRequiredIssue | null => {
  const entity = normalizeEntity(input.entity) ?? inferEntityFromClassCode(input.classCode);
  if (!entity) return null;
  const missing: RpRequiredField[] = [];
  if (!resolveMedicalClass(entity, input.classCode)) missing.push('Medical_Class');
  if (!(input.bundleNumber ?? '').trim()) missing.push('Medical_Class_Number');
  if (!hasMedicationInfo(input.items)) missing.push('Medication_info');
  if (missing.length === 0) return null;
  return {
    entity,
    bundleName: input.bundleName?.trim() || undefined,
    documentId: input.documentId,
    moduleId: input.moduleId,
    missing,
  };
};

export const resolveRpRequiredIssueFromBundle = (bundle: OrderBundle): RpRequiredIssue | null =>
  resolveRpRequiredIssue({
    entity: bundle.entity,
    bundleName: bundle.bundleName,
    documentId: bundle.documentId,
    moduleId: bundle.moduleId,
    classCode: bundle.classCode,
    bundleNumber: bundle.bundleNumber,
    items: bundle.items ?? [],
  });

export const collectRpRequiredIssues = (bundles: OrderBundle[]): RpRequiredIssue[] =>
  bundles
    .map(resolveRpRequiredIssueFromBundle)
    .filter((issue): issue is RpRequiredIssue => Boolean(issue));

export const formatRpRequiredIssueLine = (issue: RpRequiredIssue) => {
  const entityLabel = resolveOrderEntityLabel(issue.entity);
  const bundleLabel = issue.bundleName?.trim() || '名称未設定';
  return `${entityLabel}/${bundleLabel}: ${issue.missing.map(resolveRpRequiredFieldLabel).join(' + ')}`;
};

export const buildRpRequiredUnifiedMessage = (issues: RpRequiredIssue[], previewLimit = 4) => {
  if (issues.length === 0) return RP_REQUIRED_ERROR_LABEL;
  const preview = issues.slice(0, previewLimit).map(formatRpRequiredIssueLine).join(' / ');
  const remaining = issues.length - previewLimit;
  return `${RP_REQUIRED_ERROR_LABEL}（${preview}${remaining > 0 ? ` / 他${remaining}件` : ''}）`;
};

export const buildRpRequiredBlockedMessage = (issues: RpRequiredIssue[], previewLimit = 4) =>
  `ORCA送信を停止: ${buildRpRequiredUnifiedMessage(issues, previewLimit)}`;

export const buildRpRequiredEditorMessage = (issue: RpRequiredIssue) => buildRpRequiredUnifiedMessage([issue], 1);

export const resolveOrderBundleCodeIssue = (bundle: OrderBundle): OrderBundleCodeIssue | null => {
  const missingCodeItemIndexes: number[] = [];
  let hasCodedItem = false;
  (bundle.items ?? []).forEach((item, index) => {
    if (!hasItemValue(item)) return;
    if (item.code?.trim()) {
      hasCodedItem = true;
      return;
    }
    missingCodeItemIndexes.push(index);
  });
  if (missingCodeItemIndexes.length === 0) return null;
  return {
    entity: bundle.entity,
    bundleName: bundle.bundleName,
    documentId: bundle.documentId,
    moduleId: bundle.moduleId,
    mixedRows: hasCodedItem,
    missingCodeItemIndexes,
  };
};

export const collectOrderBundleCodeIssues = (bundles: OrderBundle[]): OrderBundleCodeIssue[] =>
  bundles
    .map(resolveOrderBundleCodeIssue)
    .filter((issue): issue is OrderBundleCodeIssue => Boolean(issue));

export const formatOrderBundleCodeIssueLine = (issue: OrderBundleCodeIssue) => {
  const entityLabel = issue.entity ? resolveOrderEntityLabel(issue.entity as Parameters<typeof resolveOrderEntityLabel>[0]) : 'order';
  const bundleLabel = issue.bundleName?.trim() || '名称未設定';
  const rowLabel = issue.missingCodeItemIndexes.map((index) => `行${index + 1}`).join(' / ');
  return `${entityLabel}/${bundleLabel}: ${issue.mixedRows ? 'コードあり/なし混在' : 'コード未入力'}（${rowLabel}）`;
};

export const buildOrderBundleCodeBlockedMessage = (issues: OrderBundleCodeIssue[], previewLimit = 4) => {
  if (issues.length === 0) return 'ORCA送信を停止: コード未入力行があります。';
  const preview = issues.slice(0, previewLimit).map(formatOrderBundleCodeIssueLine).join(' / ');
  const remaining = issues.length - previewLimit;
  return `ORCA送信を停止: コード未入力行があります（${preview}${remaining > 0 ? ` / 他${remaining}件` : ''}）`;
};
