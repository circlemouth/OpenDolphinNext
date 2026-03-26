import type { StorageScope } from '../../libs/session/storageScope';
import { buildScopedStorageKey, toScopeSuffix } from '../../libs/session/storageScope';
import type { ReceptionEntry, ReceptionStatus } from '../outpatient/types';

const STORAGE_BASE_KEY = 'opendolphin:web-client:reception-daily-state';
const STORAGE_VERSION = 'v1';
const LEGACY_STORAGE_KEY = `${STORAGE_BASE_KEY}:v1`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 7;
const volatileReceptionDailyStores = new Map<string, ReceptionDailyStore>();

type ReceptionStatusOverrideSource =
  | 'api'
  | 'charts_open'
  | 'charts_start'
  | 'charts_pause'
  | 'charts_finish'
  | 'manual';

type ReceptionStatusOverride = {
  status: ReceptionStatus;
  updatedAt: string;
  source: ReceptionStatusOverrideSource;
  runId?: string;
};

type ReceptionDailyBucket = {
  updatedAt: string;
  entries: ReceptionEntry[];
  statusByPatientId: Record<string, ReceptionStatusOverride>;
};

type ReceptionDailyStore = {
  version: 1;
  updatedAt: string;
  days: Record<string, ReceptionDailyBucket>;
};

type ResolveEntriesResult = {
  entries: ReceptionEntry[];
  source: 'live' | 'merged' | 'snapshot' | 'empty';
  availableDates: string[];
};

const RECEPTION_STATUS_RANK: Record<ReceptionStatus, number> = {
  予約: 0,
  受付中: 1,
  診療中: 2,
  会計待ち: 3,
  会計済み: 4,
};

const RECEPTION_STATUS_SET = new Set<ReceptionStatus>(['予約', '受付中', '診療中', '会計待ち', '会計済み']);

const toLocalDateYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (DATE_RE.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return toLocalDateYmd(parsed);
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeReceptionStatus = (value: unknown): ReceptionStatus | undefined => {
  if (typeof value !== 'string') return undefined;
  return RECEPTION_STATUS_SET.has(value as ReceptionStatus) ? (value as ReceptionStatus) : undefined;
};

const normalizeReceptionSource = (value: unknown): ReceptionEntry['source'] => {
  if (value === 'slots' || value === 'reservations' || value === 'visits' || value === 'unknown') return value;
  return 'unknown';
};

const normalizeReceptionEntry = (value: unknown): ReceptionEntry | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const patientId = normalizeOptionalString(raw.patientId);
  const appointmentId = normalizeOptionalString(raw.appointmentId);
  const receptionId = normalizeOptionalString(raw.receptionId);
  const scheduleKey = normalizeOptionalString(raw.scheduleKey);
  const encounterKey = normalizeOptionalString(raw.encounterKey);
  const id =
    normalizeOptionalString(raw.id) ??
    receptionId ??
    appointmentId ??
    patientId ??
    `snapshot-${Math.random().toString(36).slice(2, 8)}`;
  const status = normalizeReceptionStatus(raw.status) ?? '受付中';
  const visitDate = normalizeDate(normalizeOptionalString(raw.visitDate));
  return {
    id,
    appointmentId,
    receptionId,
    scheduleKey,
    encounterKey,
    patientId,
    appointmentTime: normalizeOptionalString(raw.appointmentTime),
    reservationTime: normalizeOptionalString(raw.reservationTime),
    acceptanceTime: normalizeOptionalString(raw.acceptanceTime),
    visitDate,
    status,
    source: normalizeReceptionSource(raw.source),
  };
};

const toPersistedEntry = (entry: ReceptionEntry): ReceptionEntry => {
  return {
    id: normalizeOptionalString(entry.id) ?? `snapshot-${Math.random().toString(36).slice(2, 8)}`,
    appointmentId: normalizeOptionalString(entry.appointmentId),
    receptionId: normalizeOptionalString(entry.receptionId),
    scheduleKey: normalizeOptionalString(entry.scheduleKey),
    encounterKey: normalizeOptionalString(entry.encounterKey),
    patientId: normalizeOptionalString(entry.patientId),
    appointmentTime: normalizeOptionalString(entry.appointmentTime),
    reservationTime: normalizeOptionalString(entry.reservationTime),
    acceptanceTime: normalizeOptionalString(entry.acceptanceTime),
    visitDate: normalizeDate(entry.visitDate),
    status: normalizeReceptionStatus(entry.status) ?? '受付中',
    source: normalizeReceptionSource(entry.source),
  };
};

const normalizeOverride = (value: unknown): ReceptionStatusOverride | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const status = normalizeReceptionStatus(raw.status);
  if (!status) return null;
  const source =
    raw.source === 'api' ||
    raw.source === 'charts_open' ||
    raw.source === 'charts_start' ||
    raw.source === 'charts_pause' ||
    raw.source === 'charts_finish' ||
    raw.source === 'manual'
      ? raw.source
      : 'manual';
  return {
    status,
    updatedAt: normalizeOptionalString(raw.updatedAt) ?? new Date().toISOString(),
    source,
    runId: normalizeOptionalString(raw.runId),
  };
};

const normalizeBucket = (value: unknown): ReceptionDailyBucket | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const entriesRaw = Array.isArray(raw.entries) ? raw.entries : [];
  const entries = entriesRaw.map((entry) => normalizeReceptionEntry(entry)).filter((entry): entry is ReceptionEntry => Boolean(entry));
  const statusByPatientId: Record<string, ReceptionStatusOverride> = {};
  const overridesRaw = raw.statusByPatientId;
  if (overridesRaw && typeof overridesRaw === 'object') {
    Object.entries(overridesRaw as Record<string, unknown>).forEach(([patientId, override]) => {
      const normalizedPatientId = normalizeOptionalString(patientId);
      if (!normalizedPatientId) return;
      const normalizedOverride = normalizeOverride(override);
      if (!normalizedOverride) return;
      statusByPatientId[normalizedPatientId] = normalizedOverride;
    });
  }
  return {
    updatedAt: normalizeOptionalString(raw.updatedAt) ?? new Date().toISOString(),
    entries,
    statusByPatientId,
  };
};

const normalizeStore = (value: unknown): ReceptionDailyStore => {
  if (!value || typeof value !== 'object') {
    return { version: 1, updatedAt: new Date().toISOString(), days: {} };
  }
  const raw = value as Record<string, unknown>;
  const daysRaw = raw.days;
  const days: Record<string, ReceptionDailyBucket> = {};
  if (daysRaw && typeof daysRaw === 'object') {
    Object.entries(daysRaw as Record<string, unknown>).forEach(([date, bucket]) => {
      const normalizedDate = normalizeDate(date);
      if (!normalizedDate) return;
      const normalizedBucket = normalizeBucket(bucket);
      if (!normalizedBucket) return;
      days[normalizedDate] = normalizedBucket;
    });
  }
  return {
    version: 1,
    updatedAt: normalizeOptionalString(raw.updatedAt) ?? new Date().toISOString(),
    days,
  };
};

const createEmptyStore = (): ReceptionDailyStore => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  days: {},
});

const cloneStore = (store: ReceptionDailyStore): ReceptionDailyStore =>
  normalizeStore(JSON.parse(JSON.stringify(store)) as unknown);

const resolveStorageKey = (scope?: StorageScope): string | null => {
  return buildScopedStorageKey(STORAGE_BASE_KEY, STORAGE_VERSION, scope);
};

const resolveLegacyFallbackKey = (scope?: StorageScope): string | null => {
  const scoped = resolveStorageKey(scope);
  if (!scoped) return null;
  return LEGACY_STORAGE_KEY;
};

const resolveVolatileScopeKey = (scope?: StorageScope): string | null => {
  return toScopeSuffix(scope);
};

const removeSessionStorage = (key: string) => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore cleanup errors
  }
};

const removeLocalStorage = (key: string) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore cleanup errors
  }
};

const removeLegacyLocalStorage = (scope?: StorageScope) => {
  const scopedKey = resolveStorageKey(scope);
  if (scopedKey) removeSessionStorage(scopedKey);
  removeSessionStorage(LEGACY_STORAGE_KEY);
  if (scopedKey) removeLocalStorage(scopedKey);
  const fallbackKey = resolveLegacyFallbackKey(scope);
  if (fallbackKey) removeLocalStorage(fallbackKey);
};

const readStore = (scope?: StorageScope): ReceptionDailyStore => {
  const scopeKey = resolveVolatileScopeKey(scope);
  removeLegacyLocalStorage(scope);
  if (!scopeKey) return createEmptyStore();
  const store = volatileReceptionDailyStores.get(scopeKey);
  return store ? cloneStore(store) : createEmptyStore();
};

const trimDays = (days: Record<string, ReceptionDailyBucket>) => {
  const dates = Object.keys(days).sort((left, right) => right.localeCompare(left));
  const removeTargets = dates.slice(MAX_DAYS);
  removeTargets.forEach((date) => {
    delete days[date];
  });
};

const writeStore = (scope: StorageScope | undefined, store: ReceptionDailyStore) => {
  const scopeKey = resolveVolatileScopeKey(scope);
  if (!scopeKey) return;
  const next: ReceptionDailyStore = {
    version: 1,
    updatedAt: new Date().toISOString(),
    days: { ...store.days },
  };
  trimDays(next.days);
  volatileReceptionDailyStores.set(scopeKey, cloneStore(next));
  removeLegacyLocalStorage(scope);
};

export const clearReceptionDailyState = (scope?: StorageScope) => {
  removeLegacyLocalStorage(scope);
  if (!scope) {
    volatileReceptionDailyStores.clear();
    return;
  }
  const scopeKey = resolveVolatileScopeKey(scope);
  if (scopeKey) {
    volatileReceptionDailyStores.delete(scopeKey);
  }
};

const entryIdentity = (entry: ReceptionEntry): string =>
  entry.receptionId ?? entry.appointmentId ?? entry.patientId ?? entry.id;

const mergeEntry = (base: ReceptionEntry, override: ReceptionEntry): ReceptionEntry => {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(override).filter(([, value]) => value !== undefined)),
  } as ReceptionEntry;
};

const applyStatusOverrides = (
  entries: ReceptionEntry[],
  statusByPatientId: Record<string, ReceptionStatusOverride>,
): ReceptionEntry[] => {
  return entries.map((entry) => {
    const patientId = normalizeOptionalString(entry.patientId);
    if (!patientId) return entry;
    const override = statusByPatientId[patientId];
    if (!override || override.status === entry.status) return entry;
    return { ...entry, status: override.status };
  });
};

const dedupeEntries = (entries: ReceptionEntry[]): ReceptionEntry[] => {
  const map = new Map<string, ReceptionEntry>();
  entries.forEach((entry) => {
    const key = entryIdentity(entry);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, entry);
      return;
    }
    map.set(key, mergeEntry(existing, entry));
  });
  return Array.from(map.values());
};

const updateBucketWithEntries = (
  bucket: ReceptionDailyBucket,
  incomingEntries: ReceptionEntry[],
): { entries: ReceptionEntry[]; source: 'live' | 'merged' } => {
  const existingEntries = bucket.entries ?? [];
  const existingById = new Map(existingEntries.map((entry) => [entryIdentity(entry), entry]));
  const mergedEntries = incomingEntries.map((entry) => {
    const previous = existingById.get(entryIdentity(entry));
    return previous ? mergeEntry(previous, entry) : entry;
  });
  const withOverrides = applyStatusOverrides(dedupeEntries(mergedEntries), bucket.statusByPatientId);
  bucket.entries = withOverrides.map((entry) => toPersistedEntry(entry));
  bucket.updatedAt = new Date().toISOString();
  return { entries: withOverrides, source: existingEntries.length > 0 ? 'merged' : 'live' };
};

const ensureBucket = (store: ReceptionDailyStore, date: string): ReceptionDailyBucket => {
  const existing = store.days[date];
  if (existing) return existing;
  const created: ReceptionDailyBucket = {
    updatedAt: new Date().toISOString(),
    entries: [],
    statusByPatientId: {},
  };
  store.days[date] = created;
  return created;
};

const compareRank = (left: ReceptionStatus, right: ReceptionStatus): number => {
  return RECEPTION_STATUS_RANK[left] - RECEPTION_STATUS_RANK[right];
};

export const resolveReceptionEntriesForDate = (params: {
  date: string;
  incomingEntries: ReceptionEntry[];
  scope?: StorageScope;
}): ResolveEntriesResult => {
  const date = normalizeDate(params.date);
  if (!date) {
    return { entries: [], source: 'empty', availableDates: [] };
  }
  const store = readStore(params.scope);
  const availableDates = Object.keys(store.days).sort((left, right) => right.localeCompare(left));
  const normalizedIncoming = dedupeEntries(params.incomingEntries ?? []);
  if (normalizedIncoming.length > 0) {
    const bucket = ensureBucket(store, date);
    const next = updateBucketWithEntries(bucket, normalizedIncoming);
    writeStore(params.scope, store);
    return {
      entries: next.entries,
      source: next.source,
      availableDates: Object.keys(store.days).sort((left, right) => right.localeCompare(left)),
    };
  }
  const bucket = store.days[date];
  if (!bucket || bucket.entries.length === 0) {
    return {
      entries: [],
      source: 'empty',
      availableDates,
    };
  }
  const snapshotEntries = applyStatusOverrides(dedupeEntries(bucket.entries), bucket.statusByPatientId);
  return {
    entries: snapshotEntries,
    source: 'snapshot',
    availableDates,
  };
};

export const saveReceptionEntriesForDate = (params: {
  date: string;
  entries: ReceptionEntry[];
  scope?: StorageScope;
}) => {
  const date = normalizeDate(params.date);
  if (!date) return;
  const store = readStore(params.scope);
  const bucket = ensureBucket(store, date);
  const merged = dedupeEntries(params.entries ?? []);
  bucket.entries = applyStatusOverrides(merged, bucket.statusByPatientId).map((entry) => toPersistedEntry(entry));
  bucket.updatedAt = new Date().toISOString();
  writeStore(params.scope, store);
};

export const clearReceptionStatusOverridesForDate = (params: {
  date: string;
  patientId?: string;
  scope?: StorageScope;
}) => {
  const date = normalizeDate(params.date);
  if (!date) return;
  const store = readStore(params.scope);
  const bucket = store.days[date];
  if (!bucket) return;
  const patientId = normalizeOptionalString(params.patientId);
  if (patientId) {
    if (!(patientId in bucket.statusByPatientId)) return;
    delete bucket.statusByPatientId[patientId];
  } else {
    if (Object.keys(bucket.statusByPatientId).length === 0) return;
    bucket.statusByPatientId = {};
  }
  bucket.entries = dedupeEntries(bucket.entries ?? []);
  bucket.updatedAt = new Date().toISOString();
  writeStore(params.scope, store);
};

export const upsertReceptionStatusOverride = (params: {
  date: string;
  patientId: string;
  status: ReceptionStatus;
  source: ReceptionStatusOverrideSource;
  runId?: string;
  scope?: StorageScope;
  allowDemotion?: boolean;
  fallbackEntry?: Partial<ReceptionEntry>;
}) => {
  const date = normalizeDate(params.date);
  const patientId = normalizeOptionalString(params.patientId);
  if (!date || !patientId) return;
  const store = readStore(params.scope);
  const bucket = ensureBucket(store, date);
  const previous = bucket.statusByPatientId[patientId];
  const shouldKeepPrevious =
    !params.allowDemotion &&
    previous &&
    compareRank(previous.status, params.status) > 0;
  const nextStatus = shouldKeepPrevious ? previous.status : params.status;
  bucket.statusByPatientId[patientId] = {
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    source: params.source,
    runId: params.runId,
  };

  let matched = false;
  const nextEntries = (bucket.entries ?? []).map((entry) => {
    const entryPatientId = normalizeOptionalString(entry.patientId);
    if (!entryPatientId || entryPatientId !== patientId) return entry;
    matched = true;
    if (entry.status === nextStatus) return entry;
    return { ...entry, status: nextStatus };
  });
  if (!matched && params.fallbackEntry) {
    const fallbackVisitDate = normalizeDate(params.fallbackEntry.visitDate) ?? date;
    const fallbackSource = normalizeReceptionSource(params.fallbackEntry.source);
    const fallbackEntry: ReceptionEntry = {
      id:
        normalizeOptionalString(params.fallbackEntry.id) ??
        normalizeOptionalString(params.fallbackEntry.receptionId) ??
        normalizeOptionalString(params.fallbackEntry.appointmentId) ??
        patientId,
      appointmentId: normalizeOptionalString(params.fallbackEntry.appointmentId),
      receptionId: normalizeOptionalString(params.fallbackEntry.receptionId),
      patientId,
      appointmentTime: normalizeOptionalString(params.fallbackEntry.appointmentTime),
      reservationTime: normalizeOptionalString(params.fallbackEntry.reservationTime),
      acceptanceTime:
        normalizeOptionalString(params.fallbackEntry.acceptanceTime) ??
        normalizeOptionalString(params.fallbackEntry.appointmentTime),
      visitDate: fallbackVisitDate,
      status: nextStatus,
      source: fallbackSource,
    };
    nextEntries.unshift(fallbackEntry);
  }
  bucket.entries = applyStatusOverrides(dedupeEntries(nextEntries), bucket.statusByPatientId).map((entry) => toPersistedEntry(entry));
  bucket.updatedAt = new Date().toISOString();
  writeStore(params.scope, store);
};

export const listReceptionSnapshotDates = (scope?: StorageScope, limit = 30): string[] => {
  const store = readStore(scope);
  const dates = Object.keys(store.days).sort((left, right) => right.localeCompare(left));
  return limit > 0 ? dates.slice(0, limit) : dates;
};
