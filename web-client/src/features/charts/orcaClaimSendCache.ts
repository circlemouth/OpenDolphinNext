type StorageScope = { facilityId?: string | null; userId?: string | null };
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

type OrcaClaimSendContext = {
  patientId?: string | null;
  appointmentId?: string | null;
  receptionId?: string | null;
  scheduleKey?: string | null;
  encounterKey?: string | null;
};

const normalizeOptionalString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const buildRowLocalKey = (context?: OrcaClaimSendContext | null) =>
  normalizeOptionalString(context?.encounterKey) ??
  normalizeOptionalString(context?.scheduleKey) ??
  normalizeOptionalString(context?.receptionId) ??
  normalizeOptionalString(context?.appointmentId);

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
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  scheduleKey?: string;
  encounterKey?: string;
  rowLocalKey?: string;
  performDate?: string;
  // NOTE: invoiceNumber/medicalWarnings は PHI になり得るため永続化しない（メモリのみ）。
  invoiceNumber?: string;
  dataId?: string;
  runId?: string;
  traceId?: string;
  apiResult?: string;
  sendStatus?: 'success' | 'error';
  errorMessage?: string;
  medicalWarnings?: OrcaMedicalWarningUi[];
  savedAt: string;
};

export type OrcaClaimSendCacheInput = Omit<OrcaClaimSendCacheEntry, 'savedAt'>;

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

const buildStoreKey = (value: OrcaClaimSendCacheInput | OrcaClaimSendCacheEntry) =>
  normalizeOptionalString(value.rowLocalKey) ??
  buildRowLocalKey(value) ??
  normalizeOptionalString(value.patientId);

const buildVolatileKey = (scope: StorageScope, value: OrcaClaimSendCacheInput | OrcaClaimSendCacheEntry) => {
  const storeKey = buildStoreKey(value);
  return storeKey ? `${buildKey(scope)}:${storeKey}` : null;
};

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
  const key = buildKey(resolvedScope);
  const savedAt = new Date().toISOString();
  const rowLocalKey = buildStoreKey(value);
  const volatilePayload: OrcaClaimSendCacheEntry = {
    ...value,
    rowLocalKey,
    savedAt,
  };
  const volatileKey = buildVolatileKey(resolvedScope, volatilePayload);
  if (volatileKey) {
    volatileClaimSendCache.set(volatileKey, volatilePayload);
  }
  const payload: OrcaClaimSendCacheEntry = {
    patientId: value.patientId,
    appointmentId: value.appointmentId,
    receptionId: value.receptionId,
    scheduleKey: value.scheduleKey,
    encounterKey: value.encounterKey,
    rowLocalKey,
    performDate: value.performDate,
    runId: value.runId,
    traceId: value.traceId,
    apiResult: value.apiResult,
    sendStatus: value.sendStatus,
    errorMessage: value.errorMessage,
    medicalWarnings: value.medicalWarnings,
    savedAt,
  };
  const store = loadOrcaClaimSendCache(resolvedScope) ?? {};
  if (!rowLocalKey) return;
  store[rowLocalKey] = payload;
  sessionStorage.setItem(key, JSON.stringify(store));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('orca-claim-send-cache-update', { detail: { patientId: value.patientId } }));
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
  const patientId = typeof entry.patientId === 'string' ? entry.patientId.trim() : '';
  if (!patientId) return null;
  const savedAt = typeof entry.savedAt === 'string' ? entry.savedAt : undefined;
  if (isExpired(savedAt)) return null;
  const resolvedSavedAt = savedAt ?? new Date().toISOString();
  const appointmentId = typeof entry.appointmentId === 'string' ? entry.appointmentId : undefined;
  const receptionId = typeof entry.receptionId === 'string' ? entry.receptionId : undefined;
  const scheduleKey = typeof entry.scheduleKey === 'string' ? entry.scheduleKey : undefined;
  const encounterKey = typeof entry.encounterKey === 'string' ? entry.encounterKey : undefined;
  const rowLocalKey =
    typeof entry.rowLocalKey === 'string' ? entry.rowLocalKey : buildRowLocalKey({ appointmentId, receptionId, scheduleKey, encounterKey });
  return {
    patientId,
    appointmentId,
    receptionId,
    scheduleKey,
    encounterKey,
    rowLocalKey,
    performDate: typeof entry.performDate === 'string' ? entry.performDate : undefined,
    runId: typeof entry.runId === 'string' ? entry.runId : undefined,
    traceId: typeof entry.traceId === 'string' ? entry.traceId : undefined,
    apiResult: typeof entry.apiResult === 'string' ? entry.apiResult : undefined,
    sendStatus: entry.sendStatus === 'success' || entry.sendStatus === 'error' ? entry.sendStatus : undefined,
    errorMessage: typeof entry.errorMessage === 'string' ? entry.errorMessage : undefined,
    medicalWarnings: Array.isArray(entry.medicalWarnings) ? entry.medicalWarnings : undefined,
    savedAt: resolvedSavedAt,
  };
};

const resolveMatchingEntries = (
  store: OrcaClaimSendCacheStore | null | undefined,
  context?: OrcaClaimSendContext | null,
): OrcaClaimSendCacheEntry[] => {
  const patientId = normalizeOptionalString(context?.patientId);
  if (!patientId || !store) return [];
  const rowLocalKey = buildRowLocalKey(context);
  return Object.values(store)
    .filter((entry) => entry.patientId === patientId)
    .filter((entry) => {
      if (rowLocalKey) {
        if (entry.rowLocalKey) return entry.rowLocalKey === rowLocalKey;
        if (context?.encounterKey && entry.encounterKey === normalizeOptionalString(context.encounterKey)) return true;
        if (context?.scheduleKey && entry.scheduleKey === normalizeOptionalString(context.scheduleKey)) return true;
        if (context?.receptionId && entry.receptionId === normalizeOptionalString(context.receptionId)) return true;
        if (context?.appointmentId && entry.appointmentId === normalizeOptionalString(context.appointmentId)) return true;
        return false;
      }
      return true;
    })
    .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
};

export function findOrcaClaimSendEntryForContext(
  store: OrcaClaimSendCacheStore | null | undefined,
  context?: OrcaClaimSendContext | null,
) {
  const matches = resolveMatchingEntries(store, context);
  const rowLocalKey = buildRowLocalKey(context);
  if (rowLocalKey) {
    return matches.length === 1 ? matches[0] : null;
  }
  return matches.length === 1 ? matches[0] : null;
}

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
        const storeKey = buildStoreKey(single);
        if (!storeKey) {
          sessionStorage.removeItem(key);
          return null;
        }
        normalizedStore[storeKey] = single;
        changed = true;
      } else {
        sessionStorage.removeItem(key);
        return null;
      }
    } else {
      Object.entries(parsed as OrcaClaimSendCacheStore).forEach(([storeKey, entry]) => {
        const normalized = normalizeEntry({
          ...(entry ?? {}),
          rowLocalKey: typeof entry?.rowLocalKey === 'string' ? entry.rowLocalKey : storeKey,
          patientId: typeof entry?.patientId === 'string' ? entry.patientId : undefined,
        });
        if (!normalized) {
          changed = true;
          return;
        }
        const normalizedStoreKey = buildStoreKey(normalized);
        if (!normalizedStoreKey || normalizedStoreKey !== storeKey) {
          changed = true;
        }
        normalizedStore[normalizedStoreKey ?? storeKey] = normalized;
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
  const store = loadOrcaClaimSendCache(resolvedScope);
  const context = { patientId };
  const volatileMatches = Array.from(volatileClaimSendCache.entries())
    .filter(([key, entry]) => key.startsWith(`${buildKey(resolvedScope)}:`) && entry.patientId === patientId)
    .sort((left, right) => Date.parse(right[1].savedAt) - Date.parse(left[1].savedAt));
  for (const [volatileKey, volatile] of volatileMatches) {
    if (!isExpired(volatile.savedAt)) {
      const candidate = findOrcaClaimSendEntryForContext({ [volatileKey]: volatile }, context);
      if (candidate) return candidate;
      break;
    }
    volatileClaimSendCache.delete(volatileKey);
  }
  return findOrcaClaimSendEntryForContext(store, context);
}
