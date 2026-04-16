import { buildScopedStorageKey } from '../../libs/session/storageScope';

import { ORDER_SET_CANDIDATE_NOTE, type DiseaseEntry } from './diseaseApi';
import type { OrderBundle, OrderBundleItem } from './orderBundleApi';

export type ChartOrderSetDiagnosis = Pick<DiseaseEntry, 'diagnosisName' | 'diagnosisCode' | 'note'> & {
  layer: 'candidate';
  readOnly: true;
  candidateOnly: true;
};

export type ChartOrderSetBundle = Pick<OrderBundle, 'entity' | 'bundleName' | 'classCode' | 'className'> & {
  items: OrderBundleItem[];
};

export type ChartOrderSetTemplateSnapshot = {
  diagnoses: ChartOrderSetDiagnosis[];
  orderBundles: ChartOrderSetBundle[];
};

export type ChartOrderSetEntry = {
  id: string;
  facilityId: string;
  createdBy?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: ChartOrderSetTemplateSnapshot;
};

type ChartOrderSetStorage = {
  version: 2;
  updatedAt: string;
  items: ChartOrderSetEntry[];
};

const MAX_ENTRIES_PER_FACILITY = 200;

export const CHART_ORDER_SET_STORAGE_BASE = 'opendolphin:web-client:charts:order-sets';
export const CHART_ORDER_SET_STORAGE_VERSION = 'v2';
const LEGACY_STORAGE_KEY = `${CHART_ORDER_SET_STORAGE_BASE}:v1`;

const normalizeText = (value?: string | null) => value?.trim() ?? '';
const nowIso = () => new Date().toISOString();
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const sortByUpdatedAtDesc = (left: ChartOrderSetEntry, right: ChartOrderSetEntry) => right.updatedAt.localeCompare(left.updatedAt);

const createOrderSetId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `order-set-${crypto.randomUUID()}`;
  }
  return `order-set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const resolveScopedStorageKey = (scope?: { facilityId?: string; userId?: string }) =>
  buildScopedStorageKey(CHART_ORDER_SET_STORAGE_BASE, CHART_ORDER_SET_STORAGE_VERSION, scope);

const cloneOrderItem = (item: Partial<OrderBundleItem>): OrderBundleItem => ({
  code: normalizeText(item.code) || undefined,
  name: normalizeText(item.name),
  quantity: normalizeText(item.quantity) || undefined,
  unit: normalizeText(item.unit) || undefined,
  memo: normalizeText(item.memo) || undefined,
});

const sanitizeOrderBundle = (bundle: Partial<OrderBundle> | null | undefined): ChartOrderSetBundle | null => {
  if (!bundle) return null;
  const items = (Array.isArray(bundle.items) ? bundle.items : [])
    .map((item) => cloneOrderItem(item ?? {}))
    .filter((item) => Boolean(item.name || item.code));
  if (items.length === 0) return null;
  return {
    entity: normalizeText(bundle.entity) || undefined,
    bundleName: normalizeText(bundle.bundleName) || undefined,
    classCode: normalizeText(bundle.classCode) || undefined,
    className: normalizeText(bundle.className) || undefined,
    items,
  };
};

const sanitizeDisease = (entry: Partial<DiseaseEntry> | null | undefined): ChartOrderSetDiagnosis | null => {
  if (!entry) return null;
  const diagnosisName = normalizeText(entry.diagnosisName) || undefined;
  const diagnosisCode = normalizeText(entry.diagnosisCode) || undefined;
  if (!diagnosisName && !diagnosisCode) return null;
  return {
    diagnosisName,
    diagnosisCode,
    layer: 'candidate',
    readOnly: true,
    candidateOnly: true,
    note: ORDER_SET_CANDIDATE_NOTE,
  };
};

export const toChartOrderSetDiagnoses = (entries: Array<Partial<DiseaseEntry> | null | undefined>): ChartOrderSetDiagnosis[] =>
  entries.map((entry) => sanitizeDisease(entry ?? {})).filter((entry): entry is ChartOrderSetDiagnosis => entry !== null);

const sanitizeSnapshot = (
  snapshot: Partial<ChartOrderSetTemplateSnapshot> | null | undefined,
): ChartOrderSetTemplateSnapshot => ({
  diagnoses: toChartOrderSetDiagnoses(Array.isArray(snapshot?.diagnoses) ? snapshot.diagnoses : []),
  orderBundles: (Array.isArray(snapshot?.orderBundles) ? snapshot.orderBundles : [])
    .map((item) => sanitizeOrderBundle(item ?? {}))
    .filter((item): item is ChartOrderSetBundle => item !== null),
});

const sanitizeEntry = (raw: unknown): ChartOrderSetEntry | null => {
  if (!isRecord(raw)) return null;
  const facilityId = normalizeText(typeof raw.facilityId === 'string' ? raw.facilityId : undefined);
  if (!facilityId) return null;
  const updatedAt = normalizeText(typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined) || nowIso();
  const createdAt = normalizeText(typeof raw.createdAt === 'string' ? raw.createdAt : undefined) || updatedAt;
  const name = normalizeText(typeof raw.name === 'string' ? raw.name : undefined) || '名称未設定';
  return {
    id: normalizeText(typeof raw.id === 'string' ? raw.id : undefined) || createOrderSetId(),
    facilityId,
    createdBy: normalizeText(typeof raw.createdBy === 'string' ? raw.createdBy : undefined) || undefined,
    name,
    createdAt,
    updatedAt,
    snapshot: sanitizeSnapshot(isRecord(raw.snapshot) ? (raw.snapshot as Partial<ChartOrderSetTemplateSnapshot>) : undefined),
  };
};

const createEmptyStorage = (): ChartOrderSetStorage => ({
  version: 2,
  updatedAt: nowIso(),
  items: [],
});

const parseStorage = (raw: string | null): ChartOrderSetStorage => {
  if (!raw) return createEmptyStorage();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 2 || !Array.isArray(parsed.items)) {
      return createEmptyStorage();
    }
    return {
      version: 2,
      updatedAt: normalizeText(typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined) || nowIso(),
      items: parsed.items.map((item) => sanitizeEntry(item)).filter((item): item is ChartOrderSetEntry => item !== null),
    };
  } catch {
    return createEmptyStorage();
  }
};

const readStorageByKey = (storageKey: string): ChartOrderSetStorage => {
  if (typeof localStorage === 'undefined') return createEmptyStorage();
  try {
    return parseStorage(localStorage.getItem(storageKey));
  } catch {
    return createEmptyStorage();
  }
};

const writeStorageByKey = (storageKey: string, storage: ChartOrderSetStorage) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(storage));
  } catch {
    // ignore storage errors
  }
};

const pruneFacilityItems = (items: ChartOrderSetEntry[], facilityId: string) => {
  const target = items.filter((item) => item.facilityId === facilityId);
  if (target.length <= MAX_ENTRIES_PER_FACILITY) return items;

  const sorted = target.slice().sort(sortByUpdatedAtDesc).slice(0, MAX_ENTRIES_PER_FACILITY);
  const keepIds = new Set(sorted.map((item) => item.id));
  return items.filter((item) => item.facilityId !== facilityId || keepIds.has(item.id));
};

const collectScopedStorageKeysByFacility = (facilityId: string) => {
  if (typeof localStorage === 'undefined') return [] as string[];
  const prefix = `${CHART_ORDER_SET_STORAGE_BASE}:${CHART_ORDER_SET_STORAGE_VERSION}:${facilityId}:`;
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
};

const listItemsFromAllScopedKeys = (facilityId: string): ChartOrderSetEntry[] => {
  const byId = new Map<string, ChartOrderSetEntry>();
  for (const key of collectScopedStorageKeysByFacility(facilityId)) {
    const storage = readStorageByKey(key);
    for (const item of storage.items) {
      if (normalizeText(item.facilityId) !== facilityId) continue;
      const prev = byId.get(item.id);
      if (!prev || item.updatedAt >= prev.updatedAt) {
        byId.set(item.id, item);
      }
    }
  }
  return [...byId.values()].sort(sortByUpdatedAtDesc);
};

const migrateLegacyStorageToScoped = (scope?: { facilityId?: string; userId?: string }) => {
  if (typeof localStorage === 'undefined') return;
  const facilityId = normalizeText(scope?.facilityId);
  const userId = normalizeText(scope?.userId);
  const scopedKey = resolveScopedStorageKey({ facilityId, userId });

  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw || !facilityId || !userId || !scopedKey) return;
    const parsed = JSON.parse(legacyRaw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) return;

    const current = readStorageByKey(scopedKey);
    const merged = new Map<string, ChartOrderSetEntry>(current.items.map((item) => [item.id, item]));
    for (const item of parsed.items) {
      const normalized = sanitizeEntry(item);
      if (!normalized || normalizeText(normalized.facilityId) !== facilityId) continue;
      const prev = merged.get(normalized.id);
      if (!prev || normalized.updatedAt >= prev.updatedAt) {
        merged.set(normalized.id, {
          ...normalized,
          facilityId,
          createdBy: normalized.createdBy ?? userId,
        });
      }
    }

    const nextItems = pruneFacilityItems([...merged.values()], facilityId);
    writeStorageByKey(scopedKey, {
      version: 2,
      updatedAt: nowIso(),
      items: nextItems,
    });
  } catch {
    // ignore migration errors
  } finally {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore remove errors
    }
  }
};

const readStorage = (scope: { facilityId?: string; userId?: string }): ChartOrderSetStorage => {
  const scopedKey = resolveScopedStorageKey(scope);
  if (!scopedKey) return createEmptyStorage();
  migrateLegacyStorageToScoped(scope);
  return readStorageByKey(scopedKey);
};

const deleteFromStorageKey = (storageKey: string, facilityId: string, id: string) => {
  const storage = readStorageByKey(storageKey);
  const before = storage.items.length;
  storage.items = storage.items.filter((item) => !(item.facilityId === facilityId && item.id === id));
  if (storage.items.length === before) return false;
  storage.updatedAt = nowIso();
  writeStorageByKey(storageKey, storage);
  return true;
};

export const listChartOrderSets = (facilityId?: string, userId?: string): ChartOrderSetEntry[] => {
  const resolvedFacilityId = normalizeText(facilityId);
  if (!resolvedFacilityId) return [];
  const resolvedUserId = normalizeText(userId) || undefined;

  const items = resolvedUserId
    ? readStorage({ facilityId: resolvedFacilityId, userId: resolvedUserId }).items
    : (migrateLegacyStorageToScoped({ facilityId: resolvedFacilityId }), listItemsFromAllScopedKeys(resolvedFacilityId));

  return items
    .filter((item) => normalizeText(item.facilityId) === resolvedFacilityId)
    .map((item) => ({
      ...item,
      name: normalizeText(item.name) || '名称未設定',
      snapshot: sanitizeSnapshot(item.snapshot),
    }))
    .sort(sortByUpdatedAtDesc);
};

export const getChartOrderSet = (params: { facilityId?: string; userId?: string; id?: string }): ChartOrderSetEntry | null => {
  const facilityId = normalizeText(params.facilityId);
  const id = normalizeText(params.id);
  if (!facilityId || !id) return null;
  const found = listChartOrderSets(facilityId, params.userId).find((item) => item.id === id);
  return found ?? null;
};

export const saveChartOrderSet = (params: {
  facilityId?: string;
  userId?: string;
  name?: string;
  snapshot: ChartOrderSetTemplateSnapshot;
  id?: string;
}) => {
  const facilityId = normalizeText(params.facilityId);
  const userId = normalizeText(params.userId);
  if (!facilityId) throw new Error('facilityId is required');
  if (!userId) throw new Error('userId is required');

  const scopedKey = resolveScopedStorageKey({ facilityId, userId });
  if (!scopedKey) throw new Error('facilityId/userId scope is required');

  const now = nowIso();
  const storage = readStorage({ facilityId, userId });
  const id = normalizeText(params.id) || createOrderSetId();
  const normalizedName = normalizeText(params.name) || `${now.slice(0, 10)} セット`;
  const snapshot = sanitizeSnapshot(params.snapshot);
  const existing = storage.items.find((item) => item.id === id && item.facilityId === facilityId);

  const nextEntry: ChartOrderSetEntry = {
    id,
    facilityId,
    createdBy: existing?.createdBy ?? userId,
    name: normalizedName,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    snapshot,
  };

  if (existing) {
    storage.items = storage.items.map((item) => (item.id === existing.id ? nextEntry : item));
  } else {
    storage.items = [nextEntry, ...storage.items];
  }

  storage.items = pruneFacilityItems(storage.items, facilityId);
  storage.updatedAt = now;
  writeStorageByKey(scopedKey, storage);
  return {
    ...nextEntry,
    snapshot: sanitizeSnapshot(nextEntry.snapshot),
  };
};

export const deleteChartOrderSet = (params: { facilityId?: string; userId?: string; id?: string }) => {
  const facilityId = normalizeText(params.facilityId);
  const userId = normalizeText(params.userId);
  const id = normalizeText(params.id);
  if (!facilityId || !id) return false;

  if (userId) {
    const scopedKey = resolveScopedStorageKey({ facilityId, userId });
    if (!scopedKey) return false;
    return deleteFromStorageKey(scopedKey, facilityId, id);
  }

  let deleted = false;
  for (const key of collectScopedStorageKeysByFacility(facilityId)) {
    if (deleteFromStorageKey(key, facilityId, id)) {
      deleted = true;
    }
  }
  return deleted;
};

export const clearChartOrderSetStorage = (scope?: { facilityId?: string; userId?: string }) => {
  if (typeof localStorage === 'undefined') return;
  const facilityId = normalizeText(scope?.facilityId);
  const userId = normalizeText(scope?.userId);
  try {
    if (facilityId && userId) {
      const scopedKey = resolveScopedStorageKey({ facilityId, userId });
      if (scopedKey) localStorage.removeItem(scopedKey);
    } else if (facilityId) {
      for (const key of collectScopedStorageKeysByFacility(facilityId)) {
        localStorage.removeItem(key);
      }
    } else {
      const prefix = `${CHART_ORDER_SET_STORAGE_BASE}:${CHART_ORDER_SET_STORAGE_VERSION}:`;
      const removeTargets: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith(prefix)) removeTargets.push(key);
      }
      for (const key of removeTargets) {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
};
