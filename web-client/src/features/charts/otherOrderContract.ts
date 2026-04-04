const OTHER_ORDER_MAIN_CODE_PATTERN = /^(?:8\d{8}|18\d{7})$/;

export const OTHER_ORDER_CLASS_CODE_MIN = 800;
export const OTHER_ORDER_CLASS_CODE_MAX = 890;

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const isValidOtherOrderMainCode = (code?: string | null) => {
  const normalized = trimToNull(code);
  return normalized !== null && OTHER_ORDER_MAIN_CODE_PATTERN.test(normalized);
};

export const isValidOtherOrderClassCode = (classCode?: string | null) => {
  const normalized = trimToNull(classCode);
  if (normalized === null || !/^\d{3}$/.test(normalized)) return false;
  const value = Number.parseInt(normalized, 10);
  return value >= OTHER_ORDER_CLASS_CODE_MIN && value <= OTHER_ORDER_CLASS_CODE_MAX;
};
