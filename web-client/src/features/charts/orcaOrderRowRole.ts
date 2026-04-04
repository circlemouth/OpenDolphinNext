import { resolveCanonicalOrderEntity } from './orderCategoryRegistry';

export type OrcaOrderRowRole = 'main' | 'material' | 'comment' | 'bodyPart';
export type OrcaNormalizedRowSourceKind = 'bundle_item' | 'usage' | 'body_part';

type OrcaRowLike = {
  code?: string | null;
  name?: string | null;
  quantity?: string | null;
  unit?: string | null;
  memo?: string | null;
  genericFlg?: string | null;
  userComment?: string | null;
  rowRole?: string | null;
};

export const ORCA_COMMENT_CODE_PATTERN = /^(008[1-6]|8[1-6]|098|099|98|99)/;
export const ORCA_BODY_PART_CODE_PATTERN = /^002\d*$/;
const ORCA_NINE_DIGIT_CODE_PATTERN = /^\d{9}$/;
const ORCA_USAGE_CODE_PATTERN = /^\d+$/;

const normalizeCode = (value?: string | null) => value?.trim() ?? '';

export const normalizeOrcaOrderRowRole = (value?: string | null): OrcaOrderRowRole | null => {
  switch (value?.trim()) {
    case 'main':
    case 'material':
    case 'comment':
    case 'bodyPart':
      return value.trim() as OrcaOrderRowRole;
    default:
      return null;
  }
};

export const isOrcaCommentCode = (code?: string | null) => ORCA_COMMENT_CODE_PATTERN.test(normalizeCode(code));

export const isOrcaBodyPartCode = (code?: string | null) => ORCA_BODY_PART_CODE_PATTERN.test(normalizeCode(code));

export const isOrcaUsageCode = (code?: string | null) => ORCA_USAGE_CODE_PATTERN.test(normalizeCode(code));

export const isOrcaNineDigitCode = (code?: string | null) => ORCA_NINE_DIGIT_CODE_PATTERN.test(normalizeCode(code));

export const isSendableMedicalModV2Code = (
  code?: string | null,
  sourceKind?: OrcaNormalizedRowSourceKind,
) => {
  const normalized = normalizeCode(code);
  if (!normalized) return false;
  if (sourceKind === 'usage') return isOrcaUsageCode(normalized);
  if (sourceKind === 'body_part') return isOrcaBodyPartCode(normalized);
  return isOrcaNineDigitCode(normalized) || isOrcaCommentCode(normalized);
};

export const isSendableCodeForRowRole = (rowRole: OrcaOrderRowRole, code?: string | null) => {
  switch (rowRole) {
    case 'bodyPart':
      return isOrcaBodyPartCode(code);
    case 'comment':
      return isOrcaCommentCode(code);
    case 'main':
    case 'material':
      return isOrcaNineDigitCode(code);
    default:
      return false;
  }
};

const shouldTreatAsLegacyMaterialRow = (entity?: string | null, code?: string | null) => {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode.startsWith('7')) return false;
  const canonicalEntity = resolveCanonicalOrderEntity(entity ?? '');
  return canonicalEntity !== 'radiologyOrder';
};

export const resolveOrcaOrderRowRole = ({
  entity,
  item,
  masterType,
  fallbackToLegacyHeuristics = true,
}: {
  entity?: string | null;
  item?: OrcaRowLike | null;
  masterType?: string | null;
  fallbackToLegacyHeuristics?: boolean;
}): OrcaOrderRowRole => {
  const explicit = normalizeOrcaOrderRowRole(item?.rowRole);
  if (explicit) return explicit;
  const code = normalizeCode(item?.code);
  if (isOrcaBodyPartCode(code)) return 'bodyPart';
  if (isOrcaCommentCode(code)) return 'comment';
  if (masterType?.trim() === 'material') return 'material';
  if (fallbackToLegacyHeuristics && shouldTreatAsLegacyMaterialRow(entity, code)) return 'material';
  return 'main';
};

export const hasOrcaOrderRowValue = (item?: OrcaRowLike | null) =>
  Boolean(
    item?.name?.trim() ||
      item?.code?.trim() ||
      item?.quantity?.trim() ||
      item?.unit?.trim() ||
      item?.memo?.trim(),
  );
