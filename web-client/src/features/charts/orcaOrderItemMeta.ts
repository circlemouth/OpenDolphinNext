export type OrcaOrderItemMeta = {
  // "yes"/"no" only. When omitted, ORCA uses its own default setting.
  genericFlg?: 'yes' | 'no';
  // User comment for each medication row.
  userComment?: string;
  // Original ORCA master category for charge row classification.
  masterCategory?: string;
  // medicationgetv2 selection metadata. This is local-only and not sent to ORCA.
  itemNumber?: string;
  itemNumberBranch?: string;
};

export type OrcaOrderItemMetaCarrier = {
  memo?: string | null;
  genericFlg?: 'yes' | 'no';
  userComment?: string | null;
  masterCategory?: string | null;
  itemNumber?: string | null;
  itemNumberBranch?: string | null;
  selectionCommentItemNumber?: string | null;
  selectionCommentItemNumberBranch?: string | null;
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

const hasUserComment = (value: OrcaOrderItemMeta['userComment']) =>
  typeof value === 'string' && value.trim().length > 0;

const normalizeMasterCategory = (value: unknown): OrcaOrderItemMeta['masterCategory'] => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^\d{3}$/.test(trimmed) ? trimmed : undefined;
};

const normalizeMetaText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const isEmptyMeta = (meta: OrcaOrderItemMeta) =>
  !meta.genericFlg &&
  !hasUserComment(meta.userComment) &&
  !meta.masterCategory &&
  !meta.itemNumber &&
  !meta.itemNumberBranch;

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
        masterCategory: normalizeMasterCategory(parsed.masterCategory),
        itemNumber: normalizeMetaText(parsed.itemNumber),
        itemNumberBranch: normalizeMetaText(parsed.itemNumberBranch),
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
  if (meta.masterCategory) json.masterCategory = meta.masterCategory;
  if (meta.itemNumber) json.itemNumber = meta.itemNumber;
  if (meta.itemNumberBranch) json.itemNumberBranch = meta.itemNumberBranch;
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
  if (!normalizeMasterCategory(next.masterCategory)) {
    delete next.masterCategory;
  } else {
    next.masterCategory = normalizeMasterCategory(next.masterCategory);
  }
  if (!normalizeMetaText(next.itemNumber)) {
    delete next.itemNumber;
  } else {
    next.itemNumber = normalizeMetaText(next.itemNumber);
  }
  if (!normalizeMetaText(next.itemNumberBranch)) {
    delete next.itemNumberBranch;
  } else {
    next.itemNumberBranch = normalizeMetaText(next.itemNumberBranch);
  }
  return formatOrcaOrderItemMemo(next, memoText);
}

export function resolveOrcaOrderItemFields(item?: OrcaOrderItemMetaCarrier | null): {
  genericFlg?: 'yes' | 'no';
  userComment?: string;
  masterCategory?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
  memoText: string;
} {
  const parsed = parseOrcaOrderItemMemo(item?.memo);
  return {
    genericFlg: normalizeGenericFlg(item?.genericFlg ?? parsed.meta.genericFlg),
    userComment: normalizeUserComment(item?.userComment ?? parsed.meta.userComment),
    masterCategory: normalizeMasterCategory(item?.masterCategory ?? parsed.meta.masterCategory),
    itemNumber: normalizeMetaText(item?.itemNumber ?? item?.selectionCommentItemNumber ?? parsed.meta.itemNumber),
    itemNumberBranch: normalizeMetaText(
      item?.itemNumberBranch ?? item?.selectionCommentItemNumberBranch ?? parsed.meta.itemNumberBranch,
    ),
    memoText: parsed.memoText,
  };
}
