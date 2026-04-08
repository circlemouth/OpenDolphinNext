import type { OrcaOrderEntity } from './orcaMedicalClassCatalog';
import { resolveCanonicalOrcaOrderEntity, supportsBodyPartForEntityClass } from './orcaMedicalClassCatalog';

export type OrcaEntityMode = 'sendable' | 'sendable-with-blocked-usage' | 'local-only' | 'import-only';

type SendabilityEntry = {
  mode: OrcaEntityMode;
  blocksBodyPart?: boolean;
};

const LOCAL_ONLY_FIELDS = [
  'bundleName',
  'admin',
  'adminCode',
  'adminCodeSystem',
  'adminMemo',
  'memo',
  'usage',
  'started',
  'startDate',
  'rowRole',
  'rowSubtype',
  'unit',
  'sourceSetCode',
  'itemMemo',
  'itemNumber',
  'itemNumberBranch',
  'selectionCommentItemNumber',
  'selectionCommentItemNumberBranch',
  'genericChangeAllowed',
  'doctorComment',
  'remarks',
  'prescriptionSettings',
  'numberCode',
  'numberCodeSystem',
  'numberCodeName',
  'lowerCode',
  'lowerCodeSystem',
  'lowerName',
  'subtype',
  'specimen',
] as const;

const ENTITY_SENDABILITY: Record<OrcaOrderEntity, SendabilityEntry> = {
  medOrder: { mode: 'sendable-with-blocked-usage', blocksBodyPart: true },
  injectionOrder: { mode: 'sendable', blocksBodyPart: true },
  treatmentOrder: { mode: 'sendable', blocksBodyPart: true },
  surgeryOrder: { mode: 'sendable', blocksBodyPart: true },
  otherOrder: { mode: 'local-only', blocksBodyPart: true },
  testOrder: { mode: 'sendable', blocksBodyPart: false },
  physiologyOrder: { mode: 'import-only', blocksBodyPart: true },
  bacteriaOrder: { mode: 'local-only', blocksBodyPart: true },
  radiologyOrder: { mode: 'sendable', blocksBodyPart: false },
  baseChargeOrder: { mode: 'sendable', blocksBodyPart: true },
  instractionChargeOrder: { mode: 'sendable', blocksBodyPart: true },
};

export const ORCA_LOCAL_ONLY_FIELDS = [...LOCAL_ONLY_FIELDS];

export const resolveOrcaEntityMode = (entity?: string | null): OrcaEntityMode | undefined => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  return canonical ? ENTITY_SENDABILITY[canonical].mode : undefined;
};

export const isEntitySendableToOrca = (entity?: string | null) => {
  const mode = resolveOrcaEntityMode(entity);
  return mode === 'sendable' || mode === 'sendable-with-blocked-usage';
};

export const isEntityLocalOnly = (entity?: string | null) => resolveOrcaEntityMode(entity) === 'local-only';

export const isEntityImportOnly = (entity?: string | null) => resolveOrcaEntityMode(entity) === 'import-only';

export const blocksBodyPartForEntity = (entity?: string | null) => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  return canonical ? Boolean(ENTITY_SENDABILITY[canonical].blocksBodyPart) : false;
};

export const resolveOrcaOrderBodyPartPolicy = (entity?: string | null, classCode?: string | null) => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  if (!canonical) return undefined;
  if (ENTITY_SENDABILITY[canonical].blocksBodyPart || !supportsBodyPartForEntityClass(canonical, classCode)) {
    return 'blocked';
  }
  return canonical === 'radiologyOrder' ? 'plain_xray_or_photo' : 'optional';
};

export const isLocalOnlyField = (field: string) => LOCAL_ONLY_FIELDS.includes(field as (typeof LOCAL_ONLY_FIELDS)[number]);

export const ORCA_POLICY_MESSAGES = {
  physiologyBlocked: 'ORCA送信を停止: physiologyOrder は import-only です。generic 600 送信には対応していません。',
  bacteriaBlocked: 'ORCA送信を停止: bacteriaOrder は local-only です。ORCA outbound には対応していません。',
  otherBlocked: 'ORCA送信を停止: otherOrder は local-only です。ORCA outbound には対応していません。',
  medUsageBlocked: '処方の usage は current release では ORCA送信できません。候補選択済みでも send-block します。',
  selectionCommentBlocked: '選択式コメントの itemNumber / branch は official medicalmodv2 request に carrier がないため ORCA送信できません。',
} as const;

export const resolveOrcaOrderEntitySendabilityPolicy = (entity?: string | null) => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  if (!canonical) return undefined;
  const entry = ENTITY_SENDABILITY[canonical];
  return {
    entity: canonical,
    mode: entry.mode,
    sendable: entry.mode === 'sendable' || entry.mode === 'sendable-with-blocked-usage',
    localOnly: entry.mode === 'local-only',
    importOnly: entry.mode === 'import-only',
    blocksBodyPart: Boolean(entry.blocksBodyPart),
    localOnlyFields: ORCA_LOCAL_ONLY_FIELDS,
  };
};

export const isOrcaOrderEntitySendable = (entity?: string | null) => isEntitySendableToOrca(entity);
export const isOrcaOrderEntityLocalOnly = (entity?: string | null) => isEntityLocalOnly(entity);
export const isOrcaOrderEntityImportOnly = (entity?: string | null) => isEntityImportOnly(entity);
