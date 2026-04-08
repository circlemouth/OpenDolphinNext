export type OrcaCommentCarrier = 'Medication_Name' | 'Medication_Number';
export type OrcaCommentValueType = 'text' | 'number' | 'date' | 'time' | 'duration' | 'procedureCode9';

export type OrcaCommentCarrierRule = {
  family: string;
  carrier: OrcaCommentCarrier;
  valueType: OrcaCommentValueType;
  required: true;
};

export const ORCA_COMMENT_CARRIER_RULES = {
  '830': { family: '830', carrier: 'Medication_Name', valueType: 'text', required: true },
  '842': { family: '842', carrier: 'Medication_Number', valueType: 'number', required: true },
  '8501': { family: '8501', carrier: 'Medication_Number', valueType: 'date', required: true },
  '8511': { family: '8511', carrier: 'Medication_Number', valueType: 'time', required: true },
  '8521': { family: '8521', carrier: 'Medication_Number', valueType: 'duration', required: true },
  '831': { family: '831', carrier: 'Medication_Number', valueType: 'procedureCode9', required: true },
} as const satisfies Record<string, OrcaCommentCarrierRule>;

const COMMENT_FAMILIES = ['8501', '8511', '8521', '830', '842', '831'] as const;
const STRUCTURED_COMMENT_CODE_PATTERN = /^(?:83|84|85)\d+$/;

export const resolveOrcaCommentFamily = (code?: string | null): string | undefined => {
  const normalized = code?.trim();
  if (!normalized) return undefined;
  return COMMENT_FAMILIES.find((family) => normalized.startsWith(family));
};

export const resolveOrcaCommentCarrierRule = (code?: string | null): OrcaCommentCarrierRule | undefined => {
  const family = resolveOrcaCommentFamily(code);
  return family ? ORCA_COMMENT_CARRIER_RULES[family as keyof typeof ORCA_COMMENT_CARRIER_RULES] : undefined;
};

export const isSupportedOrcaCommentFamily = (code?: string | null) => Boolean(resolveOrcaCommentCarrierRule(code));
export const isStructuredOrcaCommentCode = (code?: string | null) => Boolean(code?.trim() && STRUCTURED_COMMENT_CODE_PATTERN.test(code.trim()));
export const hasUnknownStructuredOrcaCommentFamily = (code?: string | null) =>
  isStructuredOrcaCommentCode(code) && !isSupportedOrcaCommentFamily(code);
export const isBacteriaStructuredCommentFamilyAllowed = (code?: string | null) => {
  const family = resolveOrcaCommentFamily(code);
  return family === '830' || family === '842';
};

export const ORCA_SELECTION_COMMENT_BLOCK_REASON =
  '選択式コメントの itemNumber / branch は official medicalmodv2 request に carrier がないため ORCA送信できません。';
export const ORCA_UNKNOWN_STRUCTURED_COMMENT_FAMILY_BLOCK_REASON =
  '未対応の structured comment family は fail-close します。対応済みの family のみ選択してください。';
