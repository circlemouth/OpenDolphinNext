const ORDER_BUNDLE_COMMENT_CODE_PATTERN = /^(?:008[1-6]|8[1-6]|098|099|98|99)/;
const BACTERIA_842_PATTERN = /^842\d{6}$/;
const BACTERIA_830_PATTERN = /^830\d{6}$/;
const STRUCTURED_COMMENT_TEXT_PATTERN = /^830\d{6}$/;
const STRUCTURED_COMMENT_NUMBER_PATTERN = /^842\d{6}$/;
const STRUCTURED_COMMENT_DATE_PATTERN = /^8501\d{5}$/;
const STRUCTURED_COMMENT_MMDD_PATTERN = /^8511\d{5}$/;
const STRUCTURED_COMMENT_INTEGER_PATTERN = /^8521\d{5}$/;
const STRUCTURED_COMMENT_NINE_DIGIT_PATTERN = /^831\d{6}$/;
const UNKNOWN_STRUCTURED_COMMENT_PATTERN = /^8(?:30|31|42|50|51|52)\d+$/;

export type PrescriptionStructuredCommentFamily = '830' | '842' | '8501' | '8511' | '8521' | '831';
export type PrescriptionStructuredCommentCarrier = 'Medication_Name' | 'Medication_Number';

export type PrescriptionStructuredCommentSpec = {
  family: PrescriptionStructuredCommentFamily;
  carrier: PrescriptionStructuredCommentCarrier;
  placeholder: string;
  hint: string;
};

const STRUCTURED_COMMENT_SPECS: Record<PrescriptionStructuredCommentFamily, PrescriptionStructuredCommentSpec> = {
  '830': {
    family: '830',
    carrier: 'Medication_Name',
    placeholder: '自由記載（50文字以内）',
    hint: '830 は補足値を Medication_Name に送ります。50文字以内で入力してください。',
  },
  '842': {
    family: '842',
    carrier: 'Medication_Number',
    placeholder: '例: 1 / 1.5 / -2',
    hint: '842 は数値を Medication_Number に送ります。',
  },
  '8501': {
    family: '8501',
    carrier: 'Medication_Number',
    placeholder: '例: 2026-04-09',
    hint: '8501 は日付を Medication_Number に送ります。YYY-MM-DD または YYYY-MM-DD を受け付けます。',
  },
  '8511': {
    family: '8511',
    carrier: 'Medication_Number',
    placeholder: '例: 04-09',
    hint: '8511 は MM-DD 形式を Medication_Number に送ります。',
  },
  '8521': {
    family: '8521',
    carrier: 'Medication_Number',
    placeholder: '例: 12',
    hint: '8521 は整数を Medication_Number に送ります。',
  },
  '831': {
    family: '831',
    carrier: 'Medication_Number',
    placeholder: '例: 123456789',
    hint: '831 は9桁数値を Medication_Number に送ります。',
  },
};

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const pad2 = (value: string) => value.padStart(2, '0');

const normalizeStructuredDateNote = (note?: string | null) => {
  const normalized = trimToNull(note)?.replace(/[/.]/g, '-');
  if (!normalized) return null;
  const match = normalized.match(/^(\d{3,4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const numericMonth = Number(month);
  const numericDay = Number(day);
  if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return null;
  if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const normalizeStructuredMonthDayNote = (note?: string | null) => {
  const normalized = trimToNull(note)?.replace(/[/.]/g, '-');
  if (!normalized) return null;
  const match = normalized.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, month, day] = match;
  const numericMonth = Number(month);
  const numericDay = Number(day);
  if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) return null;
  if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) return null;
  return `${pad2(month)}-${pad2(day)}`;
};

export const isOrderBundleCommentCode = (value?: string | null) => ORDER_BUNDLE_COMMENT_CODE_PATTERN.test(trimToNull(value) ?? '');

export const isBacteria842CommentCode = (value?: string | null) => BACTERIA_842_PATTERN.test(trimToNull(value) ?? '');

export const isBacteria830CommentCode = (value?: string | null) => BACTERIA_830_PATTERN.test(trimToNull(value) ?? '');

export const isStrictBacteriaStructuredCommentCode = (value?: string | null) =>
  isBacteria842CommentCode(value) || isBacteria830CommentCode(value);

export const resolvePrescriptionStructuredCommentFamily = (
  value?: string | null,
): PrescriptionStructuredCommentFamily | 'unknown' | null => {
  const normalized = trimToNull(value);
  if (!normalized) return null;
  if (STRUCTURED_COMMENT_TEXT_PATTERN.test(normalized)) return '830';
  if (STRUCTURED_COMMENT_NUMBER_PATTERN.test(normalized)) return '842';
  if (STRUCTURED_COMMENT_DATE_PATTERN.test(normalized)) return '8501';
  if (STRUCTURED_COMMENT_MMDD_PATTERN.test(normalized)) return '8511';
  if (STRUCTURED_COMMENT_INTEGER_PATTERN.test(normalized)) return '8521';
  if (STRUCTURED_COMMENT_NINE_DIGIT_PATTERN.test(normalized)) return '831';
  if (UNKNOWN_STRUCTURED_COMMENT_PATTERN.test(normalized)) return 'unknown';
  return null;
};

export const resolvePrescriptionStructuredCommentSpec = (
  value?: string | null,
): PrescriptionStructuredCommentSpec | null => {
  const family = resolvePrescriptionStructuredCommentFamily(value);
  if (!family || family === 'unknown') return null;
  return STRUCTURED_COMMENT_SPECS[family];
};

export const supportsStructuredPrescriptionClaimCommentNote = (value?: string | null) => {
  return Boolean(resolvePrescriptionStructuredCommentSpec(value));
};

export const requiresStructuredPrescriptionClaimCommentNote = (value?: string | null) =>
  supportsStructuredPrescriptionClaimCommentNote(value);

export const isUnknownStructuredPrescriptionClaimCommentFamily = (value?: string | null) =>
  resolvePrescriptionStructuredCommentFamily(value) === 'unknown';

export const normalizeStructuredPrescriptionClaimCommentNote = (value?: string | null, note?: string | null) => {
  const family = resolvePrescriptionStructuredCommentFamily(value);
  if (!family || family === 'unknown') return trimToNull(note);
  if (family === '830') {
    const normalized = trimToNull(note)?.replace(/\s+/g, ' ');
    if (!normalized || normalized.length > 50) return null;
    return normalized;
  }
  if (family === '842') {
    const normalized = trimToNull(note);
    return normalized && /^[+-]?\d+(?:\.\d+)?$/.test(normalized) ? normalized : null;
  }
  if (family === '8501') {
    return normalizeStructuredDateNote(note);
  }
  if (family === '8511') {
    return normalizeStructuredMonthDayNote(note);
  }
  if (family === '8521') {
    const normalized = trimToNull(note);
    return normalized && /^\d+$/.test(normalized) ? normalized : null;
  }
  if (family === '831') {
    const normalized = trimToNull(note);
    return normalized && /^\d{9}$/.test(normalized) ? normalized : null;
  }
  return null;
};

export const validateStructuredPrescriptionClaimCommentNote = (value?: string | null, note?: string | null) => {
  const family = resolvePrescriptionStructuredCommentFamily(value);
  if (!family || family === 'unknown') return null;
  const normalized = normalizeStructuredPrescriptionClaimCommentNote(value, note);
  if (normalized) return null;
  switch (family) {
    case '830':
      return '補足値は50文字以内の自由記載で入力してください。';
    case '842':
      return '補足値は数値で入力してください。';
    case '8501':
      return '補足値は YYY-MM-DD または YYYY-MM-DD 形式で入力してください。';
    case '8511':
      return '補足値は MM-DD 形式で入力してください。';
    case '8521':
      return '補足値は整数で入力してください。';
    case '831':
      return '補足値は9桁数値で入力してください。';
    default:
      return '補足値の形式が不正です。';
  }
};
