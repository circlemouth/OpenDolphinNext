import type { OrcaOrderRowRole } from './orcaOrderRowRole';
import { normalizeOrcaOrderRowRole } from './orcaOrderRowRole';

export type OrcaOrderItemMeta = {
  // "yes"/"no" only. When omitted, ORCA uses its own default setting.
  genericFlg?: 'yes' | 'no';
  // User comment for each medication row.
  userComment?: string;
  // Stable row semantics carrier for save -> fetch -> reopen.
  rowRole?: OrcaOrderRowRole;
};

export type OrcaOrderItemMetaCarrier = {
  memo?: string | null;
  genericFlg?: 'yes' | 'no';
  userComment?: string | null;
  rowRole?: OrcaOrderRowRole | null;
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

const isEmptyMeta = (meta: OrcaOrderItemMeta) => !meta.genericFlg && !hasUserComment(meta.userComment) && !meta.rowRole;

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
        rowRole: normalizeOrcaOrderRowRole(parsed.rowRole as string | undefined) ?? undefined,
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
  return formatOrcaOrderItemMemo(next, memoText);
}

export function resolveOrcaOrderItemFields(item?: OrcaOrderItemMetaCarrier | null): {
  genericFlg?: 'yes' | 'no';
  userComment?: string;
  rowRole?: OrcaOrderRowRole;
  memoText: string;
} {
  const parsed = parseOrcaOrderItemMemo(item?.memo);
  return {
    genericFlg: normalizeGenericFlg(item?.genericFlg ?? parsed.meta.genericFlg),
    userComment: normalizeUserComment(item?.userComment ?? parsed.meta.userComment),
    rowRole: normalizeOrcaOrderRowRole(item?.rowRole ?? parsed.meta.rowRole) ?? undefined,
    memoText: parsed.memoText,
  };
}
