import type { OrderBundle, OrderBundleItem } from './orderBundleApi';
import { supportsOrcaBodyPartField } from './orcaMedicalClassCatalog';

const BODY_PART_CODE_PREFIX = '002';

export type OrderBodyPart = {
  code?: string;
  name: string;
  quantity?: string;
  unit?: string;
  memo?: string;
};

export const normalizeInline = (value?: string | null) => (value ?? '').replace(/\s+/g, ' ').trim();

export const stripLeadingCode = (value?: string | null) => {
  const normalized = normalizeInline(value);
  if (!normalized) return '';
  const tokens = normalized.split(' ');
  if (tokens.length >= 2 && /^[A-Za-z0-9]{4,}$/.test(tokens[0] ?? '')) {
    return tokens.slice(1).join(' ');
  }
  return normalized;
};

export const formatQuantityWithUnit = (quantity?: string | null, unit?: string | null) => {
  const q = normalizeInline(quantity);
  const u = normalizeInline(unit);
  if (!q && !u) return '';
  return `${q}${u}`;
};

export const resolvePrescriptionTiming = (bundle: OrderBundle): string | undefined => {
  const source = bundle as unknown as Record<string, unknown>;
  const timing = source.prescriptionTiming;
  if (typeof timing === 'string' && timing.trim()) return timing.trim().toLowerCase();
  const fallback = source.timing;
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim().toLowerCase();
  return undefined;
};

export const pickFirstString = (source: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const formatDateTime = (raw?: string | null) => {
  const source = normalizeInline(raw);
  if (!source) return '日時不明';
  const parsed = Date.parse(source);
  if (Number.isNaN(parsed)) return source;
  const hasTime = /[T\s]\d{1,2}:\d{2}/.test(source);
  const date = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
  if (!hasTime) return date;
  const time = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
  return `${date} ${time}`;
};

export const resolveOperatorLine = (bundle?: OrderBundle | null) => {
  if (!bundle) return '入力者不明 医師 日時不明';
  const source = bundle as Record<string, unknown>;
  const author = pickFirstString(source, [
    'enteredByName',
    'enteredName',
    'authorName',
    'inputByName',
    'createdByName',
    'userName',
  ]);
  const role = pickFirstString(source, [
    'enteredByRole',
    'enteredRole',
    'authorRole',
    'inputByRole',
    'createdByRole',
    'role',
  ]);
  const datetimeRaw = pickFirstString(source, [
    'enteredAt',
    'inputAt',
    'authoredAt',
    'createdAt',
    'updatedAt',
    'started',
  ]);
  return `${author || '入力者不明'} ${role || '医師'} ${formatDateTime(datetimeRaw)}`;
};

export const toSafeMemoText = (memoText: string) => {
  return memoText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('__'))
    .join(' / ');
};

export const extractIngredientAmount = (item: OrderBundleItem) => {
  const source = item as unknown as Record<string, unknown>;
  const quantity = pickFirstString(source, [
    'ingredientQuantity',
    'componentQuantity',
    'contentQuantity',
    'activeIngredientQuantity',
  ]);
  const unit = pickFirstString(source, [
    'ingredientUnit',
    'componentUnit',
    'contentUnit',
    'activeIngredientUnit',
  ]);
  return formatQuantityWithUnit(quantity, unit);
};

export const isBodyPartItem = (item: OrderBundleItem) => {
  const code = normalizeInline(item.code);
  if (!code) return false;
  return code.startsWith(BODY_PART_CODE_PREFIX);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toBodyPart = (value: unknown): OrderBodyPart | null => {
  if (!isRecord(value)) return null;
  const code = pickFirstString(value, ['code']);
  const name = pickFirstString(value, ['name']);
  const quantity = pickFirstString(value, ['quantity']);
  const unit = pickFirstString(value, ['unit']);
  const memo = pickFirstString(value, ['memo']);
  if (!name) return null;
  return {
    code: code || undefined,
    name,
    quantity: quantity || undefined,
    unit: unit || undefined,
    memo: memo || undefined,
  };
};

export const resolveBundleBodyPart = (bundle: OrderBundle): OrderBodyPart | null => {
  const source = bundle as unknown as Record<string, unknown>;
  if (!supportsOrcaBodyPartField(bundle.entity, bundle.classCode)) return null;
  const explicit = toBodyPart(source.bodyPart);
  if (explicit) return explicit;
  return null;
};

export const resolveDisplayItemsWithoutBodyPart = (bundle: OrderBundle): OrderBundleItem[] => {
  return (bundle.items ?? []).filter((item) => !isBodyPartItem(item));
};

export const formatBodyPartLine = (bodyPart: OrderBodyPart) => {
  const name = normalizeInline(bodyPart.name) || '部位未設定';
  const quantity = formatQuantityWithUnit(bodyPart.quantity, bodyPart.unit);
  const memo = normalizeInline(bodyPart.memo);
  const suffix = [quantity || null, memo ? `メモ:${memo}` : null].filter(Boolean).join(' / ');
  return suffix ? `部位: ${name} / ${suffix}` : `部位: ${name}`;
};
