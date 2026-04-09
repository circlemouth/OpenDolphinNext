export const OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE = 'LOCAL_OTHER_ORDER';

export const OTHER_ORDER_ALLOWED_ROW_ROLES = ['main', 'comment'] as const;

export type OtherOrderRowRole = (typeof OTHER_ORDER_ALLOWED_ROW_ROLES)[number];

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const isOtherOrderRowRole = (value?: string | null): value is OtherOrderRowRole =>
  value === 'main' || value === 'comment';

export const isOtherOrderSentinelClassCode = (value?: string | null) =>
  trimToNull(value) === OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE;

export const isOtherOrderBodyPartCode = (value?: string | null) => (trimToNull(value) ?? '').startsWith('002');

const isOtherOrderReservedCommentCode = (value?: string | null) => /^(?:008[1-6]|098|099|98|99)/.test(trimToNull(value) ?? '');

export const isOtherOrderOpaqueLocalCode = (value?: string | null) => {
  const normalized = trimToNull(value);
  return Boolean(normalized && !isOtherOrderBodyPartCode(normalized) && !isOtherOrderReservedCommentCode(normalized));
};
