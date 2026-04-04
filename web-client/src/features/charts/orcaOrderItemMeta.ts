export type OrcaOrderItemMeta = {
  // "yes"/"no" only. When omitted, ORCA uses its own default setting.
  genericFlg?: 'yes' | 'no';
  // User comment for each medication row.
  userComment?: string;
  // Selection-expression comment metadata.
  category?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
};

export type OrcaOrderItemMetaCarrier = {
  memo?: string | null;
  genericFlg?: 'yes' | 'no';
  userComment?: string | null;
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

const hasItemNumber = (value: OrcaOrderItemMeta['itemNumber']) =>
  typeof value === 'string' && value.trim().length > 0;

const hasItemNumberBranch = (value: OrcaOrderItemMeta['itemNumberBranch']) =>
  typeof value === 'string' && value.trim().length > 0;

const isEmptyMeta = (meta: OrcaOrderItemMeta) =>
  !meta.genericFlg &&
  !hasUserComment(meta.userComment) &&
  !normalizeCategory(meta.category) &&
  !hasItemNumber(meta.itemNumber) &&
  !hasItemNumberBranch(meta.itemNumberBranch);

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
  if (normalizeCategory(meta.category)) json.category = normalizeCategory(meta.category);
  if (hasItemNumber(meta.itemNumber)) json.itemNumber = meta.itemNumber;
  if (hasItemNumberBranch(meta.itemNumberBranch)) json.itemNumberBranch = meta.itemNumberBranch;
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
  if (!normalizeCategory(next.category)) {
    delete next.category;
  }
  if (!hasItemNumber(next.itemNumber)) {
    delete next.itemNumber;
  }
  if (!hasItemNumberBranch(next.itemNumberBranch)) {
    delete next.itemNumberBranch;
  }
  return formatOrcaOrderItemMemo(next, memoText);
}

export function resolveOrcaOrderItemFields(item?: OrcaOrderItemMetaCarrier | null): {
  genericFlg?: 'yes' | 'no';
  userComment?: string;
  category?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
  memoText: string;
} {
  const parsed = parseOrcaOrderItemMemo(item?.memo);
  return {
    genericFlg: normalizeGenericFlg(item?.genericFlg ?? parsed.meta.genericFlg),
    userComment: normalizeUserComment(item?.userComment ?? parsed.meta.userComment),
    category: normalizeCategory(item?.category ?? parsed.meta.category),
    itemNumber: normalizeItemNumber(item?.itemNumber ?? parsed.meta.itemNumber),
    itemNumberBranch: normalizeItemNumberBranch(item?.itemNumberBranch ?? parsed.meta.itemNumberBranch),
    memoText: parsed.memoText,
  };
}
