const ORDER_BUNDLE_COMMENT_CODE_PATTERN = /^(?:008[1-6]|8[1-6]|098|099|98|99)/;
const BACTERIA_842_PATTERN = /^842\d{6}$/;
const BACTERIA_830_PATTERN = /^830\d{6}$/;

export type PrescriptionStructuredCommentFamily = '85' | '831';

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
  if (/^831\d{6}$/.test(normalized)) return '831';
  if (/^85(?:01|11|21)\d{5}$/.test(normalized)) return '85';
  if (/^(?:83|85)\d+$/.test(normalized)) return 'unknown';
  return null;
};

export const supportsStructuredPrescriptionClaimCommentNote = (value?: string | null) => {
  const family = resolvePrescriptionStructuredCommentFamily(value);
  return family === '85' || family === '831';
};

export const requiresStructuredPrescriptionClaimCommentNote = (value?: string | null) =>
  supportsStructuredPrescriptionClaimCommentNote(value);

export const isUnknownStructuredPrescriptionClaimCommentFamily = (value?: string | null) =>
  resolvePrescriptionStructuredCommentFamily(value) === 'unknown';
