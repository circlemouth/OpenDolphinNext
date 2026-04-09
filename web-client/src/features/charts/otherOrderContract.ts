export const OTHER_ORDER_LOCAL_ONLY_SENTINEL_CLASS_CODE = 'LOCAL_OTHER';
export const OTHER_ORDER_LOCAL_ONLY_CODE_PREFIX = 'LOCAL_OTHER:';

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

const isOtherOrderLocalOnlyToken = (value: string) =>
  [...value].every((character) => {
    const isUpperAlpha = character >= 'A' && character <= 'Z';
    const isDigit = character >= '0' && character <= '9';
    return isUpperAlpha || isDigit || character === '.' || character === '_' || character === '-';
  });

export const isOtherOrderLocalOnlyCode = (value?: string | null) => {
  const normalized = trimToNull(value);
  if (!normalized || !normalized.startsWith(OTHER_ORDER_LOCAL_ONLY_CODE_PREFIX)) {
    return false;
  }
  const suffix = normalized.slice(OTHER_ORDER_LOCAL_ONLY_CODE_PREFIX.length);
  return suffix.length > 0 && isOtherOrderLocalOnlyToken(suffix);
};
