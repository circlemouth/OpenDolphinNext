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
  sourceRowRole?: 'main' | 'auxiliary' | 'comment' | 'bodyPart';
  sourceRowSubtype?: 'material' | 'contrastDrug';
};

export type OrcaClaimSendCacheEntry = {
  patientId?: string;
  appointmentId?: string;
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

const buildKey = (scope: StorageScope) => {
  const facility = scope.facilityId ?? 'unknown-facility';
  const user = scope.userId ?? 'unknown-user';
  return `charts:orca-claim-send:${facility}:${user}`;
};

const buildVolatileKey = (scope: StorageScope, patientId: string) => `${buildKey(scope)}:${patientId}`;

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
  const volatilePayload: OrcaClaimSendCacheEntry = {
    ...value,
    savedAt,
  };
  volatileClaimSendCache.set(buildVolatileKey(resolvedScope, value.patientId), volatilePayload);
  const payload: OrcaClaimSendCacheEntry = {
    patientId: value.patientId,
    appointmentId: value.appointmentId,
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
  store[value.patientId] = payload;
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
  return {
    patientId,
    appointmentId: typeof entry.appointmentId === 'string' ? entry.appointmentId : undefined,
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
        const patientId = single.patientId;
        if (!patientId) {
          sessionStorage.removeItem(key);
          return null;
        }
        normalizedStore[patientId] = single;
        changed = true;
      } else {
        sessionStorage.removeItem(key);
        return null;
      }
    } else {
      Object.entries(parsed as OrcaClaimSendCacheStore).forEach(([patientId, entry]) => {
        const normalized = normalizeEntry({
          ...(entry ?? {}),
          patientId,
        });
        if (!normalized) {
          changed = true;
          return;
        }
        if (normalized.patientId !== patientId) {
          changed = true;
        }
        const normalizedPatientId = normalized.patientId;
        if (!normalizedPatientId) {
          changed = true;
          return;
        }
        normalizedStore[normalizedPatientId] = normalized;
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
  const volatileKey = buildVolatileKey(resolvedScope, patientId);
  const volatile = volatileClaimSendCache.get(volatileKey);
  if (volatile) {
    if (!isExpired(volatile.savedAt)) return volatile;
    volatileClaimSendCache.delete(volatileKey);
  }
  const store = loadOrcaClaimSendCache(resolvedScope);
  return store?.[patientId] ?? null;
}
