export const INJECTION_LOCAL_META_PREFIX = '__injection_local_meta__:';

export type InjectionSpeedMode = 'specified' | 'unspecified';

export type InjectionLocalMeta = {
  speedMode?: InjectionSpeedMode;
  dripSpeedMlPerHour?: string;
};

export type ParsedInjectionAdminMemo = {
  meta: InjectionLocalMeta;
  memoText: string;
  hasMeta: boolean;
  invalidMeta: boolean;
};

const normalizeNewlines = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const normalizeSpeedMode = (value: unknown): InjectionSpeedMode | undefined => {
  if (value === 'specified') return 'specified';
  if (value === 'unspecified') return 'unspecified';
  return undefined;
};

const normalizeDripSpeed = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  return normalized.slice(0, 24);
};

export const normalizeInjectionLocalMeta = (meta: InjectionLocalMeta | null | undefined): InjectionLocalMeta => {
  const speedMode = normalizeSpeedMode(meta?.speedMode);
  const dripSpeedMlPerHour = normalizeDripSpeed(meta?.dripSpeedMlPerHour);
  return {
    ...(speedMode ? { speedMode } : {}),
    ...(dripSpeedMlPerHour ? { dripSpeedMlPerHour } : {}),
  };
};

const hasMeaningfulMeta = (meta: InjectionLocalMeta) =>
  meta.speedMode === 'specified' || Boolean(meta.dripSpeedMlPerHour?.trim());

export const parseInjectionAdminMemo = (rawMemo: string | null | undefined): ParsedInjectionAdminMemo => {
  const raw = normalizeNewlines(rawMemo ?? '');
  if (!raw.startsWith(INJECTION_LOCAL_META_PREFIX)) {
    return { meta: {}, memoText: raw, hasMeta: false, invalidMeta: false };
  }

  const [firstLine = '', ...memoLines] = raw.split('\n');
  const json = firstLine.slice(INJECTION_LOCAL_META_PREFIX.length);
  try {
    const parsed = JSON.parse(json) as InjectionLocalMeta;
    return {
      meta: normalizeInjectionLocalMeta(parsed),
      memoText: memoLines.join('\n'),
      hasMeta: true,
      invalidMeta: false,
    };
  } catch {
    return { meta: {}, memoText: raw, hasMeta: false, invalidMeta: true };
  }
};

export const formatInjectionAdminMemo = (
  meta: InjectionLocalMeta | null | undefined,
  memoText: string | null | undefined,
): string => {
  const normalizedMeta = normalizeInjectionLocalMeta(meta);
  const normalizedMemo = normalizeNewlines(memoText ?? '');
  if (!hasMeaningfulMeta(normalizedMeta)) {
    return normalizedMemo;
  }
  return `${INJECTION_LOCAL_META_PREFIX}${JSON.stringify(normalizedMeta)}${normalizedMemo ? `\n${normalizedMemo}` : ''}`;
};
