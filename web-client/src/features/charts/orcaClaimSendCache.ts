type StorageScope = { facilityId?: string | null; userId?: string | null };
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

export type OrcaMedicalWarningUi = {
  medicalWarning?: string;
  message?: string;
  code?: string;
  groupPosition?: number;
  itemPosition?: number;
  entity?: string;
  documentId?: number;
  moduleId?: number;
  bundleName?: string;
  medicalClass?: string;
  medicationCode?: string;
  medicationName?: string;
  sourceKind?: 'bundle_item' | 'usage' | 'body_part';
  sourceItemIndex?: number;
  sourceSectionIndex?: number;
  sourceRowRole?: 'main' | 'auxiliary' | 'material' | 'comment' | 'bodyPart';
  sourceRowSubtype?: 'material' | 'contrastDrug';
};

export type OrcaClaimSendCacheEntry = {
  cacheKey?: string;
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  scheduleKey?: string;
  encounterKey?: string;
  performDate?: string;
  // NOTE: invoiceNumber/medicalWarnings は PHI になり得るため永続化しない（メモリのみ）。
  invoiceNumber?: string;
  dataId?: string;
  runId?: string;
  traceId?: string;
  apiResult?: string;
  sendStatus?: 'success' | 'error';
  errorMessage?: string;
  correctionKind?: 'confirm' | 'rebill';
  correctionReason?: string;
  medicalWarnings?: OrcaMedicalWarningUi[];
  savedAt: string;
};

export type OrcaClaimSendCacheInput = Omit<OrcaClaimSendCacheEntry, 'savedAt'>;
export type OrcaClaimSendCacheMatch = Pick<
  OrcaClaimSendCacheEntry,
  'patientId' | 'appointmentId' | 'receptionId' | 'scheduleKey' | 'encounterKey'
>;

type OrcaClaimSendCacheStore = Record<string, OrcaClaimSendCacheEntry>;
const AUTH_STORAGE_KEY = 'opendolphin:web-client:auth';
const volatileClaimSendCache = new Map<string, OrcaClaimSendCacheEntry>();

export function resetOrcaClaimSendCacheForTests() {
  volatileClaimSendCache.clear();
}

const buildKey = (scope: StorageScope) => {
  const facility = scope.facilityId ?? 'unknown-facility';
  const user = scope.userId ?? 'unknown-user';
  return `charts:orca-claim-send:${facility}:${user}`;
};

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveOrcaClaimSendMatchKey = (
  value?: Pick<OrcaClaimSendCacheEntry, 'encounterKey' | 'scheduleKey' | 'receptionId' | 'appointmentId'> | null,
) => {
  const encounterKey = normalizeOptionalString(value?.encounterKey);
  if (encounterKey) return `encounter:${encounterKey}`;
  const scheduleKey = normalizeOptionalString(value?.scheduleKey);
  if (scheduleKey) return `schedule:${scheduleKey}`;
  const receptionId = normalizeOptionalString(value?.receptionId);
  if (receptionId) return `reception:${receptionId}`;
  const appointmentId = normalizeOptionalString(value?.appointmentId);
  if (appointmentId) return `appointment:${appointmentId}`;
  return undefined;
};

export const resolveOrcaClaimSendMatchKeys = (
  value?: Pick<OrcaClaimSendCacheEntry, 'encounterKey' | 'scheduleKey' | 'receptionId' | 'appointmentId'> | null,
) => {
  const keys: string[] = [];
  const encounterKey = normalizeOptionalString(value?.encounterKey);
  if (encounterKey) keys.push(`encounter:${encounterKey}`);
  const scheduleKey = normalizeOptionalString(value?.scheduleKey);
  if (scheduleKey) keys.push(`schedule:${scheduleKey}`);
  const receptionId = normalizeOptionalString(value?.receptionId);
  if (receptionId) keys.push(`reception:${receptionId}`);
  const appointmentId = normalizeOptionalString(value?.appointmentId);
  if (appointmentId) keys.push(`appointment:${appointmentId}`);
  return keys;
};

export const hasOrcaClaimSendMatchKey = (
  value?: Pick<OrcaClaimSendCacheEntry, 'encounterKey' | 'scheduleKey' | 'receptionId' | 'appointmentId'> | null,
) => resolveOrcaClaimSendMatchKeys(value).length > 0;

const resolveStoreKey = (value: OrcaClaimSendCacheInput) =>
  resolveOrcaClaimSendMatchKey(value) ?? (normalizeOptionalString(value.patientId) ? `patient:${normalizeOptionalString(value.patientId)}` : undefined);

const buildVolatileKey = (scope: StorageScope, cacheKey: string) => `${buildKey(scope)}:${cacheKey}`;

const resolveScope = (scope: StorageScope): StorageScope => {
  if (scope.facilityId && scope.userId) return scope;
  if (typeof sessionStorage === 'undefined') return scope;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return scope;
    const parsed = JSON.parse(raw) as { facilityId?: string; userId?: string };
    return {
      facilityId: scope.facilityId ?? parsed.facilityId ?? undefined,
      userId: scope.userId ?? parsed.userId ?? undefined,
    };
  } catch {
    return scope;
  }
};

export function saveOrcaClaimSendCache(value: OrcaClaimSendCacheInput, scope: StorageScope) {
  if (typeof sessionStorage === 'undefined') return;
  if (!value.patientId) return;
  const resolvedScope = resolveScope(scope);
  const cacheKey = resolveStoreKey(value);
  if (!cacheKey) return;
  const key = buildKey(resolvedScope);
  const savedAt = new Date().toISOString();
  const volatilePayload: OrcaClaimSendCacheEntry = {
    ...value,
    cacheKey,
    savedAt,
  };
  volatileClaimSendCache.set(buildVolatileKey(resolvedScope, cacheKey), volatilePayload);
  const payload: OrcaClaimSendCacheEntry = {
    cacheKey,
    patientId: value.patientId,
    appointmentId: value.appointmentId,
    receptionId: value.receptionId,
    scheduleKey: value.scheduleKey,
    encounterKey: value.encounterKey,
    performDate: value.performDate,
    runId: value.runId,
    traceId: value.traceId,
    apiResult: value.apiResult,
    sendStatus: value.sendStatus,
    errorMessage: value.errorMessage,
    correctionKind: value.correctionKind,
    correctionReason: value.correctionReason,
    savedAt,
  };
  const store = loadOrcaClaimSendCache(resolvedScope) ?? {};
  store[cacheKey] = payload;
  sessionStorage.setItem(key, JSON.stringify(store));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('orca-claim-send-cache-update', { detail: { patientId: value.patientId, cacheKey } }),
    );
  }
}

const isExpired = (savedAt?: string) => {
  if (!savedAt) return true;
  const timestamp = Date.parse(savedAt);
  if (Number.isNaN(timestamp)) return true;
  return Date.now() - timestamp > CACHE_TTL_MS;
};

const normalizeEntry = (entry: Partial<OrcaClaimSendCacheEntry> | null | undefined): OrcaClaimSendCacheEntry | null => {
  if (!entry) return null;
  const patientId = normalizeOptionalString(entry.patientId);
  if (!patientId) return null;
  const savedAt = typeof entry.savedAt === 'string' ? entry.savedAt : undefined;
  if (isExpired(savedAt)) return null;
  const resolvedSavedAt = savedAt ?? new Date().toISOString();
  const appointmentId = normalizeOptionalString(entry.appointmentId);
  const receptionId = normalizeOptionalString(entry.receptionId);
  const scheduleKey = normalizeOptionalString(entry.scheduleKey);
  const encounterKey = normalizeOptionalString(entry.encounterKey);
  const cacheKey =
    normalizeOptionalString(entry.cacheKey) ??
    resolveOrcaClaimSendMatchKey({ appointmentId, receptionId, scheduleKey, encounterKey }) ??
    `patient:${patientId}`;
  return {
    cacheKey,
    patientId,
    appointmentId,
    receptionId,
    scheduleKey,
    encounterKey,
    performDate: typeof entry.performDate === 'string' ? entry.performDate : undefined,
    runId: typeof entry.runId === 'string' ? entry.runId : undefined,
    traceId: typeof entry.traceId === 'string' ? entry.traceId : undefined,
    apiResult: typeof entry.apiResult === 'string' ? entry.apiResult : undefined,
    sendStatus: entry.sendStatus === 'success' || entry.sendStatus === 'error' ? entry.sendStatus : undefined,
    errorMessage: typeof entry.errorMessage === 'string' ? entry.errorMessage : undefined,
    correctionKind: entry.correctionKind === 'confirm' || entry.correctionKind === 'rebill' ? entry.correctionKind : undefined,
    correctionReason: typeof entry.correctionReason === 'string' ? entry.correctionReason : undefined,
    savedAt: resolvedSavedAt,
  };
};

const getScopedVolatileEntries = (scope: StorageScope) => {
  const scopePrefix = `${buildKey(scope)}:`;
  const values: OrcaClaimSendCacheEntry[] = [];
  for (const [volatileKey, entry] of volatileClaimSendCache.entries()) {
    if (!volatileKey.startsWith(scopePrefix)) continue;
    if (isExpired(entry.savedAt)) {
      volatileClaimSendCache.delete(volatileKey);
      continue;
    }
    values.push(entry);
  }
  return values;
};

const mergeScopedStoreWithVolatile = (scope: StorageScope) => {
  const persisted = loadOrcaClaimSendCache(scope) ?? {};
  const combined: OrcaClaimSendCacheStore = { ...persisted };
  for (const entry of getScopedVolatileEntries(scope)) {
    if (!entry.cacheKey) continue;
    const previous = combined[entry.cacheKey];
    if (!previous || Date.parse(entry.savedAt) >= Date.parse(previous.savedAt)) {
      combined[entry.cacheKey] = entry;
    }
  }
  return combined;
};

export function loadOrcaClaimSendCache(scope: StorageScope): OrcaClaimSendCacheStore | null {
  if (typeof sessionStorage === 'undefined') return null;
  const resolvedScope = resolveScope(scope);
  const key = buildKey(resolvedScope);
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OrcaClaimSendCacheStore | OrcaClaimSendCacheEntry | null;
    if (!parsed || typeof parsed !== 'object') {
      sessionStorage.removeItem(key);
      return null;
    }

    const normalizedStore: OrcaClaimSendCacheStore = {};
    let changed = false;

    if ('savedAt' in parsed || 'patientId' in parsed) {
      const single = normalizeEntry(parsed as OrcaClaimSendCacheEntry);
      if (single) {
        const cacheKey = single.cacheKey;
        if (!cacheKey) {
          sessionStorage.removeItem(key);
          return null;
        }
        normalizedStore[cacheKey] = single;
        changed = true;
      } else {
        sessionStorage.removeItem(key);
        return null;
      }
    } else {
      Object.entries(parsed as OrcaClaimSendCacheStore).forEach(([patientId, entry]) => {
        const normalized = normalizeEntry({
          ...(entry ?? {}),
          patientId: normalizeOptionalString(entry?.patientId) ?? patientId,
        });
        if (!normalized) {
          changed = true;
          return;
        }
        if (normalized.cacheKey !== patientId) {
          changed = true;
        }
        const normalizedCacheKey = normalized.cacheKey;
        if (!normalizedCacheKey) {
          changed = true;
          return;
        }
        normalizedStore[normalizedCacheKey] = normalized;
      });
    }

    const values = Object.values(normalizedStore);
    if (values.length === 0) {
      sessionStorage.removeItem(key);
      return null;
    }

    if (changed || JSON.stringify(parsed) !== JSON.stringify(normalizedStore)) {
      try {
        sessionStorage.setItem(key, JSON.stringify(normalizedStore));
      } catch {
        // ignore rewrite failures
      }
    }
    return normalizedStore;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function getOrcaClaimSendEntry(scope: StorageScope, patientId?: string | null) {
  if (!patientId) return null;
  const resolvedScope = resolveScope(scope);
  const normalizedPatientId = patientId.trim();
  const volatileEntries = Array.from(volatileClaimSendCache.entries())
    .filter(([key, entry]) => key.startsWith(`${buildKey(resolvedScope)}:`) && entry.patientId === normalizedPatientId)
    .sort(([, left], [, right]) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  for (const [volatileKey, volatile] of volatileEntries) {
    if (!isExpired(volatile.savedAt)) return volatile;
    volatileClaimSendCache.delete(volatileKey);
  }
  const store = loadOrcaClaimSendCache(resolvedScope);
  if (!store) return null;
  const matches = Object.values(store)
    .filter((entry) => entry.patientId === normalizedPatientId)
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  return matches[0] ?? null;
}

export function getOrcaClaimSendEntryForRow(scope: StorageScope, match?: OrcaClaimSendCacheMatch | null) {
  if (!match || !hasOrcaClaimSendMatchKey(match)) return null;
  const resolvedScope = resolveScope(scope);
  const combinedStore = mergeScopedStoreWithVolatile(resolvedScope);
  return findOrcaClaimSendEntryForMatch(combinedStore, match, { allowPatientFallback: false });
}

export function findOrcaClaimSendEntryForMatch(
  store: OrcaClaimSendCacheStore | null | undefined,
  match: OrcaClaimSendCacheMatch,
  options?: { allowPatientFallback?: boolean },
) {
  if (!store) return null;
  const entries = Object.values(store).sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  const matchKeys = resolveOrcaClaimSendMatchKeys(match);
  for (const matchKey of matchKeys) {
    const direct = entries.find((entry) => entry.cacheKey === matchKey);
    if (direct) return direct;
  }
  if (!options?.allowPatientFallback) return null;
  const patientId = normalizeOptionalString(match.patientId);
  if (!patientId) return null;
  const patientMatches = entries.filter((entry) => entry.patientId === patientId);
  return patientMatches.length === 1 ? patientMatches[0] ?? null : null;
}
