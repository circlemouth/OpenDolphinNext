export type BacteriaCarrierCommentRole = 'specimen' | 'condition' | 'instruction' | 'remark';

export type BacteriaCarrierComment = {
  role?: BacteriaCarrierCommentRole;
  code?: string;
  name?: string;
  inputValue?: string;
  category?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
};

export type BacteriaOrderMetadata = {
  specimen?: BacteriaCarrierComment;
  carrierComments?: BacteriaCarrierComment[];
};

type CommentLikeItem = {
  code?: string;
  name?: string;
  quantity?: string;
  unit?: string;
  rowRole?: 'main' | 'material' | 'comment' | 'bodyPart';
  commentValue?: string;
  category?: string;
  itemNumber?: string;
  itemNumberBranch?: string;
};

const trimOrUndefined = (value?: string | null) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeCarrierComment = (comment?: BacteriaCarrierComment | null): BacteriaCarrierComment | undefined => {
  if (!comment) return undefined;
  const normalized: BacteriaCarrierComment = {
    role:
      comment.role === 'specimen' || comment.role === 'condition' || comment.role === 'instruction' || comment.role === 'remark'
        ? comment.role
        : undefined,
    code: trimOrUndefined(comment.code),
    name: trimOrUndefined(comment.name),
    inputValue: trimOrUndefined(comment.inputValue),
    category: trimOrUndefined(comment.category),
    itemNumber: trimOrUndefined(comment.itemNumber),
    itemNumberBranch: trimOrUndefined(comment.itemNumberBranch),
  };
  if (!normalized.code && !normalized.name && !normalized.inputValue) return undefined;
  return normalized;
};

export const normalizeBacteriaOrderMetadata = (metadata?: BacteriaOrderMetadata | null): BacteriaOrderMetadata | undefined => {
  if (!metadata) return undefined;
  const specimen = normalizeCarrierComment(metadata.specimen);
  const carrierComments = (metadata.carrierComments ?? [])
    .map((comment) => normalizeCarrierComment(comment))
    .filter((comment): comment is BacteriaCarrierComment => Boolean(comment));
  if (!specimen && carrierComments.length === 0) return undefined;
  return {
    specimen,
    carrierComments,
  };
};

const is842Comment = (code?: string) => /^842\d{6}$/.test(code?.trim() ?? '');
const is830Comment = (code?: string) => /^830\d{6}$/.test(code?.trim() ?? '');

export const bacteriaCarrierCommentToOrderItem = (comment?: BacteriaCarrierComment | null): CommentLikeItem | null => {
  const normalized = normalizeCarrierComment(comment);
  if (!normalized?.code) return null;
  if (is842Comment(normalized.code)) {
    return {
      code: normalized.code,
      name: normalized.name ?? '',
      quantity: normalized.inputValue ?? '',
      commentValue: normalized.inputValue ?? '',
      unit: '',
      rowRole: 'comment',
      category: normalized.category,
      itemNumber: normalized.itemNumber,
      itemNumberBranch: normalized.itemNumberBranch,
    };
  }
  if (is830Comment(normalized.code)) {
    return {
      code: normalized.code,
      name: normalized.inputValue ?? normalized.name ?? '',
      quantity: '',
      unit: '',
      rowRole: 'comment',
      category: normalized.category,
      itemNumber: normalized.itemNumber,
      itemNumberBranch: normalized.itemNumberBranch,
    };
  }
  return {
    code: normalized.code,
    name: normalized.name ?? normalized.inputValue ?? '',
    quantity: '',
    unit: '',
    rowRole: 'comment',
    category: normalized.category,
    itemNumber: normalized.itemNumber,
    itemNumberBranch: normalized.itemNumberBranch,
  };
};

export const bacteriaMetadataToCommentItems = (metadata?: BacteriaOrderMetadata | null): CommentLikeItem[] => {
  const normalized = normalizeBacteriaOrderMetadata(metadata);
  if (!normalized) return [];
  const items: CommentLikeItem[] = [];
  const specimenItem = bacteriaCarrierCommentToOrderItem(normalized.specimen);
  if (specimenItem) items.push(specimenItem);
  normalized.carrierComments?.forEach((comment) => {
    const item = bacteriaCarrierCommentToOrderItem(comment);
    if (!item) return;
    if (
      normalized.specimen?.code &&
      normalized.specimen.code === comment.code &&
      (normalized.specimen.inputValue ?? '') === (comment.inputValue ?? '') &&
      (normalized.specimen.name ?? '') === (comment.name ?? '')
    ) {
      return;
    }
    items.push(item);
  });
  return items;
};

export const commentItemsToBacteriaMetadata = (
  items: Array<CommentLikeItem | null | undefined>,
  current?: BacteriaOrderMetadata | null,
): BacteriaOrderMetadata | undefined => {
  const normalizedCurrent = normalizeBacteriaOrderMetadata(current);
  const normalizedItems = (items ?? [])
    .filter((item): item is CommentLikeItem => Boolean(item))
    .filter((item) => item.rowRole === 'comment' || (!item.rowRole && (item.code?.trim() ?? '').length > 0))
    .map((item): BacteriaCarrierComment | undefined => {
      const code = trimOrUndefined(item.code);
      if (!code) return undefined;
      return normalizeCarrierComment({
        code,
        name: is830Comment(code) ? normalizedCurrent?.carrierComments?.find((entry) => entry.code === code)?.name ?? undefined : item.name,
        inputValue: is842Comment(code) ? trimOrUndefined(item.commentValue) ?? trimOrUndefined(item.quantity) : is830Comment(code) ? item.name : undefined,
        category: trimOrUndefined(item.category),
        itemNumber: trimOrUndefined(item.itemNumber),
        itemNumberBranch: trimOrUndefined(item.itemNumberBranch),
      });
    })
    .filter((item): item is BacteriaCarrierComment => Boolean(item));
  if (normalizedItems.length === 0 && !normalizedCurrent?.specimen) return normalizedCurrent ?? undefined;
  return normalizeBacteriaOrderMetadata({
    specimen: normalizedCurrent?.specimen,
    carrierComments: normalizedItems,
  });
};
