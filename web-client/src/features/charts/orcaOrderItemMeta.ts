export type OrcaOrderItemRowRole = 'main' | 'auxiliary' | 'comment' | 'bodyPart';
export type OrcaOrderItemRowSubtype = 'material' | 'contrastDrug';

export type OrcaOrderItemMeta = {
  // "yes"/"no" only. When omitted, ORCA uses its own default setting.
  genericFlg?: 'yes' | 'no';
  // User comment for each medication row.
  userComment?: string;
  // Explicit row metadata is persisted in memo meta so save -> fetch does not fall back to heuristics.
  rowRole?: OrcaOrderItemRowRole;
  rowSubtype?: OrcaOrderItemRowSubtype;
  // Selection-expression comment metadata.
  category?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
};

export type OrcaOrderItemMetaCarrier = {
  memo?: string | null;
  genericFlg?: 'yes' | 'no';
  userComment?: string | null;
  rowRole?: OrcaOrderItemRowRole | null;
  rowSubtype?: OrcaOrderItemRowSubtype | null;
  category?: string | null;
  itemNumber?: string | null;
  itemNumberBranch?: string | null;
};

const META_PREFIX = '__orca_meta__:';

const normalizeGenericFlg = (value: unknown): OrcaOrderItemMeta['genericFlg'] => {
  if (value === 'yes' || value === 'no') return value;
  return undefined;
};

const normalizeUserComment = (value: unknown): OrcaOrderItemMeta['userComment'] => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeRowRole = (value: unknown): OrcaOrderItemMeta['rowRole'] => {
  if (value === 'main' || value === 'auxiliary' || value === 'comment' || value === 'bodyPart') {
    return value;
  }
  if (value === 'material') {
    return 'auxiliary';
  }
  return undefined;
};

const normalizeRowSubtype = (value: unknown): OrcaOrderItemMeta['rowSubtype'] => {
  if (value === 'material' || value === 'contrastDrug') {
    return value;
  }
  return undefined;
};

const normalizeCategory = (value: unknown): OrcaOrderItemMeta['category'] => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeItemNumber = (value: unknown): OrcaOrderItemMeta['itemNumber'] => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeItemNumberBranch = (value: unknown): OrcaOrderItemMeta['itemNumberBranch'] => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const hasUserComment = (value: OrcaOrderItemMeta['userComment']) =>
  typeof value === 'string' && value.trim().length > 0;

const isEmptyMeta = (meta: OrcaOrderItemMeta) =>
  !meta.genericFlg &&
  !hasUserComment(meta.userComment) &&
  !meta.rowRole &&
  !meta.rowSubtype &&
  !normalizeCategory(meta.category) &&
  !normalizeItemNumber(meta.itemNumber) &&
  !normalizeItemNumberBranch(meta.itemNumberBranch);

export function parseOrcaOrderItemMemo(memo?: string | null): { meta: OrcaOrderItemMeta; memoText: string } {
  const raw = typeof memo === 'string' ? memo : '';
  if (!raw || !raw.startsWith(META_PREFIX)) {
    return { meta: {}, memoText: raw };
  }
  const [firstLine, ...rest] = raw.split('\n');
  const jsonPart = firstLine.slice(META_PREFIX.length).trim();
  const memoText = rest.join('\n');
  if (!jsonPart) return { meta: {}, memoText };
  try {
    const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
    return {
      meta: {
        genericFlg: normalizeGenericFlg(parsed.genericFlg),
        userComment: normalizeUserComment(parsed.userComment),
        rowRole: normalizeRowRole(parsed.rowRole),
        rowSubtype: normalizeRowSubtype(parsed.rowSubtype),
        category: normalizeCategory(parsed.category),
        itemNumber: normalizeItemNumber(parsed.itemNumber),
        itemNumberBranch: normalizeItemNumberBranch(parsed.itemNumberBranch),
      },
      memoText,
    };
  } catch {
    // If parsing fails, treat the whole memo as user text to avoid accidental data loss.
    return { meta: {}, memoText: raw };
  }
}

export function formatOrcaOrderItemMemo(meta: OrcaOrderItemMeta, memoText: string): string {
  const body = memoText ?? '';
  if (isEmptyMeta(meta)) return body;
  const json: OrcaOrderItemMeta = {};
  if (meta.genericFlg) json.genericFlg = meta.genericFlg;
  if (hasUserComment(meta.userComment)) json.userComment = meta.userComment;
  if (meta.rowRole) json.rowRole = meta.rowRole;
  if (meta.rowSubtype) json.rowSubtype = meta.rowSubtype;
  if (normalizeCategory(meta.category)) json.category = normalizeCategory(meta.category);
  if (normalizeItemNumber(meta.itemNumber)) json.itemNumber = normalizeItemNumber(meta.itemNumber);
  if (normalizeItemNumberBranch(meta.itemNumberBranch)) json.itemNumberBranch = normalizeItemNumberBranch(meta.itemNumberBranch);
  const metaLine = `${META_PREFIX}${JSON.stringify(json)}`;
  if (!body.trim()) return metaLine;
  return `${metaLine}\n${body}`;
}

export function updateOrcaOrderItemMeta(memo: string | undefined, patch: Partial<OrcaOrderItemMeta>): string {
  const { meta, memoText } = parseOrcaOrderItemMemo(memo);
  const next: OrcaOrderItemMeta = { ...meta, ...patch };
  if (!next.genericFlg) {
    delete next.genericFlg;
  }
  if (!hasUserComment(next.userComment)) {
    delete next.userComment;
  }
  if (!next.rowRole) {
    delete next.rowRole;
  }
  if (!next.rowSubtype) {
    delete next.rowSubtype;
  }
  if (!normalizeCategory(next.category)) {
    delete next.category;
  }
  if (!normalizeItemNumber(next.itemNumber)) {
    delete next.itemNumber;
  }
  if (!normalizeItemNumberBranch(next.itemNumberBranch)) {
    delete next.itemNumberBranch;
  }
  return formatOrcaOrderItemMemo(next, memoText);
}

export function resolveOrcaOrderItemFields(item?: OrcaOrderItemMetaCarrier | null): {
  genericFlg?: 'yes' | 'no';
  userComment?: string;
  rowRole?: OrcaOrderItemRowRole;
  rowSubtype?: OrcaOrderItemRowSubtype;
  category?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
  memoText: string;
} {
  const parsed = parseOrcaOrderItemMemo(item?.memo);
  return {
    genericFlg: normalizeGenericFlg(item?.genericFlg ?? parsed.meta.genericFlg),
    userComment: normalizeUserComment(item?.userComment ?? parsed.meta.userComment),
    rowRole: normalizeRowRole(item?.rowRole ?? parsed.meta.rowRole),
    rowSubtype: normalizeRowSubtype(item?.rowSubtype ?? parsed.meta.rowSubtype),
    category: normalizeCategory(item?.category ?? parsed.meta.category),
    itemNumber: normalizeItemNumber(item?.itemNumber ?? parsed.meta.itemNumber),
    itemNumberBranch: normalizeItemNumberBranch(item?.itemNumberBranch ?? parsed.meta.itemNumberBranch),
    memoText: parsed.memoText,
  };
}
