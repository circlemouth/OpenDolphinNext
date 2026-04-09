import type { CanonicalOrcaOrderEntity } from './orcaMedicalClassCatalog';
import { resolveCanonicalOrcaOrderEntity, supportsBodyPartForEntityClass } from './orcaMedicalClassCatalog';

export type OrcaEntityMode = 'sendable' | 'local-only' | 'import-only';

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

const ENTITY_SENDABILITY: Record<CanonicalOrcaOrderEntity, SendabilityEntry> = {
  medOrder: { mode: 'sendable', blocksBodyPart: true },
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
  return mode === 'sendable';
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
  medUsageLocalOnly: '処方の usage は local-only persisted / outbound strip です。ORCA送信では保持しません。',
  injectionAdminLocalOnly:
    '投与指示は院内ローカル保存です。最近使った投与指示を含めて、admin/adminCode/adminMemo は ORCA送信では保持しません。',
  selectionCommentBlocked: '選択式コメントの itemNumber / branch は official medicalmodv2 request に carrier がないため ORCA送信できません。',
} as const;

const SEND_CONTRACT_NOTES: Partial<Record<CanonicalOrcaOrderEntity, string>> = {
  injectionOrder:
    '注射では admin/adminCode/adminMemo は local-only persisted / outbound strip です。ORCA送信では classCode・回数・coded row・generic flag・rowRole だけを使い、bodyPart は reject します。',
  treatmentOrder:
    '処置送信では classCode と coded row のみを使います。bodyPart は受け付けず、オーダー名・処置指示・自由メモは院内ローカル情報として保持します。',
  otherOrder:
    'setCode は展開専用です。otherOrder は explicit local-only 契約で保存し、ORCA 送信しません。bodyPart は保持せず、オーダー名・指示・自由メモは院内補足として保存します。',
  baseChargeOrder:
    'setCode は展開専用です。数量は ORCA 送信しますが、単位・算定指示・院内補足・自由メモは院内補足としてのみ保持します。選択式コメントの parameter 付き候補は追加できません。',
  instractionChargeOrder:
    'setCode は展開専用です。数量は ORCA 送信しますが、単位・算定指示・院内補足・自由メモは院内補足としてのみ保持します。選択式コメントの parameter 付き候補は追加できません。',
  bacteriaOrder:
    '細菌検査では admin(検査指示)・subtype・院内補足・自由メモ・item memo は bundle 共通の院内ローカル情報です。bacteriaOrder 自体が local-only 契約のため、ORCA送信は entity 単位で fail-close します。',
  physiologyOrder:
    '生理検査は official ORCA carrier 不足のため、保存/表示 continuity のみ維持し、ORCA送信は fail-closed で停止します。bodyPart は reject し、送信候補と院内ローカル項目を明確に分離してください。',
  testOrder:
    '600系では admin(検査指示)・院内補足・自由メモ・item memo・subtype は bundle 共通の院内ローカル情報です。ORCA送信では classCode 600 とコード付き行（複数検査項目・コメントコードを含む）だけを使用します。',
  radiologyOrder:
    '画像診断送信では classCode と coded row を使います。bodyPart は classCode=700 のときだけ保持し、検査指示・自由メモ・item memo は院内ローカル情報として保持します。',
};

const INSTRUCTION_LOCAL_ONLY_HELP: Partial<Record<CanonicalOrcaOrderEntity, string>> = {
  physiologyOrder: '検査指示は院内ローカル保存のみです。official ORCA carrier 不足のため ORCA送信は停止します。',
  testOrder: 'admin(検査指示) は bundle 共通の院内ローカル情報です。複数検査項目をまとめても ORCA へは送信しません。',
  bacteriaOrder:
    'admin(検査指示) は bundle 共通の院内ローカル情報です。複数検査項目をまとめても ORCA へは送信しません。',
  radiologyOrder: '検査指示は画像診断の院内ローカル情報です。ORCA送信では保持しません。',
};

const MEMO_LOCAL_ONLY_HELP: Partial<Record<CanonicalOrcaOrderEntity, string>> = {
  physiologyOrder: '院内補足・自由メモ・item memo は院内ローカル保存のみです。official ORCA carrier 不足のため ORCA送信は停止します。',
  testOrder: '院内補足・自由メモ・item memo は bundle 共通の院内ローカル情報です。ORCA 送信 payload には含めません。',
  bacteriaOrder: '院内補足・自由メモ・item memo は bundle 共通の院内ローカル情報です。ORCA 送信 payload には含めません。',
  radiologyOrder: '画像検査メモは院内ローカル保存のみです。ORCA送信では保持しません。',
};

const ADMIN_MEMO_LOCAL_ONLY_HELP: Partial<Record<CanonicalOrcaOrderEntity, string>> = {
  radiologyOrder: '院内補足は画像診断の院内ローカル情報です。ORCA送信では保持しません。',
};

const ITEM_MEMO_LOCAL_ONLY_HELP: Partial<Record<CanonicalOrcaOrderEntity, string>> = {
  radiologyOrder: 'item memo は画像診断の院内ローカル情報です。ORCA送信では保持しません。',
};

const USAGE_LOCAL_ONLY_HELP: Partial<Record<CanonicalOrcaOrderEntity, string>> = {
  medOrder: ORCA_POLICY_MESSAGES.medUsageLocalOnly,
  injectionOrder: ORCA_POLICY_MESSAGES.injectionAdminLocalOnly,
};

const resolveEntityMessage = (
  entity: string | null | undefined,
  messages: Partial<Record<CanonicalOrcaOrderEntity, string>>,
) => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  if (!canonical) return null;
  return messages[canonical] ?? null;
};

export const resolveOrcaOrderEntitySendabilityPolicy = (entity?: string | null) => {
  const canonical = resolveCanonicalOrcaOrderEntity(entity);
  if (!canonical) return undefined;
  const entry = ENTITY_SENDABILITY[canonical];
  return {
    entity: canonical,
    mode: entry.mode,
    sendable: entry.mode === 'sendable',
    localOnly: entry.mode === 'local-only',
    importOnly: entry.mode === 'import-only',
    blocksBodyPart: Boolean(entry.blocksBodyPart),
    localOnlyFields: ORCA_LOCAL_ONLY_FIELDS,
  };
};

export const resolveOrcaSendContractNote = (entity?: string | null) => resolveEntityMessage(entity, SEND_CONTRACT_NOTES);

export const resolveOrcaInstructionLocalOnlyHelp = (entity?: string | null) =>
  resolveEntityMessage(entity, INSTRUCTION_LOCAL_ONLY_HELP);

export const resolveOrcaMemoLocalOnlyHelp = (entity?: string | null) => resolveEntityMessage(entity, MEMO_LOCAL_ONLY_HELP);

export const resolveOrcaAdminMemoLocalOnlyHelp = (entity?: string | null) =>
  resolveEntityMessage(entity, ADMIN_MEMO_LOCAL_ONLY_HELP);

export const resolveOrcaItemMemoLocalOnlyHelp = (entity?: string | null) =>
  resolveEntityMessage(entity, ITEM_MEMO_LOCAL_ONLY_HELP);

export const resolveOrcaUsageLocalOnlyHelp = (entity?: string | null) =>
  resolveEntityMessage(entity, USAGE_LOCAL_ONLY_HELP);

export const isOrcaOrderEntitySendable = (entity?: string | null) => isEntitySendableToOrca(entity);
export const isOrcaOrderEntityLocalOnly = (entity?: string | null) => isEntityLocalOnly(entity);
export const isOrcaOrderEntityImportOnly = (entity?: string | null) => isEntityImportOnly(entity);
