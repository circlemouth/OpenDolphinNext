import { buildScopedStorageKey, toScopeSuffix } from '../../libs/session/storageScope';

import { normalizeEncounterId, normalizeEncounterKey, normalizeVisitDate } from './encounterContext';

export type ChartsPatientTab = {
  key: string;
  patientId: string;
  visitDate: string; // YYYY-MM-DD
  scheduleKey?: string;
  encounterKey?: string;
  appointmentId?: string;
  receptionId?: string;
  name?: string;
  department?: string;
  openedAt: string; // ISO
  lastActivatedAt?: string; // ISO
};

type EncounterTabIdentity = {
  scheduleKey?: string;
  encounterKey?: string;
};

export type ChartsPatientTabsStorage = {
  version: 1;
  updatedAt: string;
  savedAt: string;
  activeKey?: string;
  tabs: ChartsPatientTab[];
};

export const PATIENT_TABS_STORAGE_BASE = 'opendolphin:web-client:charts:patient-tabs';
export const PATIENT_TABS_STORAGE_VERSION = 'v1';
export const PATIENT_TABS_TTL_MS = 2 * 60 * 60 * 1000;
const GLOBAL_SCOPE_KEY = '__global__';
const volatilePatientTabsByScope = new Map<string, ChartsPatientTabsStorage>();

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const buildLegacyPatientTabKey = (patientId: string, visitDate: string) => `${patientId}::${visitDate}`;

export const hasChartsPatientTabHandoffKey = (identity?: EncounterTabIdentity | ChartsPatientTab | null): boolean =>
  Boolean(normalizeEncounterKey(identity?.encounterKey) ?? normalizeEncounterKey(identity?.scheduleKey));

export const buildPatientTabKey = (
  _patientId: string,
  _visitDate: string,
  identity?: EncounterTabIdentity,
): string | null => {
  const encounterKey = normalizeEncounterKey(identity?.encounterKey);
  if (encounterKey) return `encounter:${encounterKey}`;
  const scheduleKey = normalizeEncounterKey(identity?.scheduleKey);
  if (scheduleKey) return `schedule:${scheduleKey}`;
  return null;
};

const resolveScopeKey = (scope?: { facilityId?: string; userId?: string }) => toScopeSuffix(scope) ?? GLOBAL_SCOPE_KEY;

const cloneState = (state: ChartsPatientTabsStorage): ChartsPatientTabsStorage => ({
  version: state.version,
  updatedAt: state.updatedAt,
  savedAt: state.savedAt,
  activeKey: state.activeKey,
  tabs: state.tabs.map((tab) => ({ ...tab })),
});

const sanitizeVolatileTab = (tab: ChartsPatientTab): ChartsPatientTab | null => {
  const patientId = normalizeEncounterId(tab.patientId);
  const visitDate = normalizeVisitDate(tab.visitDate);
  const scheduleKey = normalizeEncounterKey(tab.scheduleKey);
  const encounterKey = normalizeEncounterKey(tab.encounterKey);
  if (!patientId || !visitDate) return null;
  const key = buildPatientTabKey(patientId, visitDate, { scheduleKey, encounterKey });
  if (!key) return null;
  const openedAt = normalizeText(tab.openedAt) ?? new Date().toISOString();
  return {
    key,
    patientId,
    visitDate,
    scheduleKey,
    encounterKey,
    appointmentId: normalizeEncounterId(tab.appointmentId),
    receptionId: normalizeEncounterId(tab.receptionId),
    name: normalizeText(tab.name),
    department: normalizeText(tab.department),
    openedAt,
    lastActivatedAt: normalizeText(tab.lastActivatedAt) ?? openedAt,
  };
};

const sanitizeVolatileState = (state: ChartsPatientTabsStorage): ChartsPatientTabsStorage | null => {
  const tabs = state.tabs
    .map(sanitizeVolatileTab)
    .filter((tab): tab is ChartsPatientTab => tab !== null);
  if (tabs.length === 0) return null;
  const activeKey = tabs.some((tab) => tab.key === state.activeKey) ? state.activeKey : tabs[0]?.key;
  return {
    version: 1,
    updatedAt: state.updatedAt,
    savedAt: state.savedAt,
    activeKey,
    tabs,
  };
};

const cleanupLegacyPatientTabsStorage = (scope?: { facilityId?: string; userId?: string }) => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const scopedKey = buildScopedStorageKey(PATIENT_TABS_STORAGE_BASE, PATIENT_TABS_STORAGE_VERSION, scope);
    if (scopedKey) {
      sessionStorage.removeItem(scopedKey);
    }
    sessionStorage.removeItem(`${PATIENT_TABS_STORAGE_BASE}:v1`);
  } catch {
    // ignore cleanup errors
  }
};

export const applyEncounterTabState = (
  prev: ChartsPatientTabsStorage,
  params: {
    patientId: string;
    visitDate: string;
    scheduleKey?: string;
    encounterKey?: string;
    appointmentId?: string;
    receptionId?: string;
    name?: string;
    department?: string;
  },
): ChartsPatientTabsStorage => {
  const patientId = normalizeEncounterId(params.patientId);
  const visitDate = normalizeVisitDate(params.visitDate);
  if (!patientId || !visitDate) return prev;
  const legacyKey = buildLegacyPatientTabKey(patientId, visitDate);
  const fallbackExisting = prev.tabs.find((tab) => tab.key === legacyKey);
  const scheduleKey = normalizeEncounterKey(params.scheduleKey);
  const encounterKey = normalizeEncounterKey(params.encounterKey);
  const key = buildPatientTabKey(patientId, visitDate, { scheduleKey, encounterKey });
  if (!key) return prev;
  const existing = prev.tabs.find((tab) => tab.key === key) ?? fallbackExisting;
  const appointmentId = normalizeEncounterId(params.appointmentId) ?? existing?.appointmentId;
  const receptionId = normalizeEncounterId(params.receptionId) ?? existing?.receptionId;
  const name = typeof params.name === 'string' && params.name.trim() ? params.name.trim() : existing?.name;
  const department =
    typeof params.department === 'string' && params.department.trim()
      ? params.department.trim()
      : existing?.department;
  const now = new Date().toISOString();
  const nextTab: ChartsPatientTab = {
    key,
    patientId,
    visitDate,
    scheduleKey,
    encounterKey,
    appointmentId,
    receptionId,
    name,
    department,
    openedAt: existing?.openedAt ?? now,
    lastActivatedAt: now,
  };
  const tabUnchanged =
    existing !== undefined &&
    existing.patientId === nextTab.patientId &&
    existing.visitDate === nextTab.visitDate &&
    (existing.scheduleKey ?? undefined) === (nextTab.scheduleKey ?? undefined) &&
    (existing.encounterKey ?? undefined) === (nextTab.encounterKey ?? undefined) &&
    (existing.appointmentId ?? undefined) === (nextTab.appointmentId ?? undefined) &&
    (existing.receptionId ?? undefined) === (nextTab.receptionId ?? undefined) &&
    (existing.name ?? undefined) === (nextTab.name ?? undefined) &&
    (existing.department ?? undefined) === (nextTab.department ?? undefined);
  const activeUnchanged = prev.activeKey === key;
  if (tabUnchanged && activeUnchanged && (existing?.lastActivatedAt ?? '') === now) return prev;

  const nextTabs = existing
    ? tabUnchanged
      ? prev.tabs.map((tab) => (tab.key === existing.key ? { ...tab, lastActivatedAt: now } : tab))
      : prev.tabs.map((tab) => (tab.key === existing.key ? nextTab : tab))
    : [...prev.tabs, nextTab];
  return {
    ...prev,
    activeKey: key,
    tabs: nextTabs,
  };
};

export const readChartsPatientTabsStorage = (
  scope?: { facilityId?: string; userId?: string },
): ChartsPatientTabsStorage | null => {
  cleanupLegacyPatientTabsStorage(scope);
  const scopeKey = resolveScopeKey(scope);
  const scopedState = volatilePatientTabsByScope.get(scopeKey);
  if (scopedState) {
    const sanitized = sanitizeVolatileState(scopedState);
    if (!sanitized) {
      volatilePatientTabsByScope.delete(scopeKey);
      return null;
    }
    volatilePatientTabsByScope.set(scopeKey, cloneState(sanitized));
    return cloneState(sanitized);
  }
  if (scopeKey === GLOBAL_SCOPE_KEY) {
    return null;
  }
  const globalState = volatilePatientTabsByScope.get(GLOBAL_SCOPE_KEY);
  if (!globalState) {
    return null;
  }
  const sanitized = sanitizeVolatileState(globalState);
  if (!sanitized) {
    volatilePatientTabsByScope.delete(GLOBAL_SCOPE_KEY);
    return null;
  }
  const cloned = cloneState(sanitized);
  volatilePatientTabsByScope.set(scopeKey, cloneState(cloned));
  volatilePatientTabsByScope.delete(GLOBAL_SCOPE_KEY);
  return cloned;
};

export const writeChartsPatientTabsStorage = (
  state: ChartsPatientTabsStorage,
  scope?: { facilityId?: string; userId?: string },
) => {
  cleanupLegacyPatientTabsStorage(scope);
  const normalized = sanitizeVolatileState(state);
  const scopeKey = resolveScopeKey(scope);
  if (!normalized) {
    volatilePatientTabsByScope.delete(scopeKey);
    return;
  }
  volatilePatientTabsByScope.set(scopeKey, cloneState(normalized));
};

export const clearChartsPatientTabsStorage = (scope?: { facilityId?: string; userId?: string }) => {
  cleanupLegacyPatientTabsStorage(scope);
  if (!scope) {
    volatilePatientTabsByScope.clear();
    return;
  }
  volatilePatientTabsByScope.delete(resolveScopeKey(scope));
  volatilePatientTabsByScope.delete(GLOBAL_SCOPE_KEY);
};
