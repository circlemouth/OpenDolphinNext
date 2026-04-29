import { buildScopedStorageKey, toScopeSuffix, type StorageScope } from '../../libs/session/storageScope';

export type OutpatientEncounterContext = {
  patientId?: string;
  appointmentId?: string;
  receptionId?: string;
  scheduleKey?: string;
  encounterKey?: string;
  visitDate?: string; // YYYY-MM-DD
  departmentCode?: string;
  physicianCode?: string;
  insuranceCombinationNumber?: string;
  voucherNumber?: string;
  sequentialNumber?: string;
};

export type ChartsNavigationMeta = {
  runId?: string;
};

export type ReceptionCarryoverParams = {
  kw?: string;
  dept?: string;
  phys?: string;
  pay?: string;
  sort?: string;
  date?: string;
};

const STORAGE_BASE_KEY = 'opendolphin:web-client:charts:encounter-context';
const STORAGE_VERSION = 'v2';
const LEGACY_STORAGE_KEY = `${STORAGE_BASE_KEY}:v1`;
const GLOBAL_SCOPE_KEY = '__global__';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RUN_ID_RE = /^\d{8}T\d{6}Z$/;
const volatileEncounterContexts = new Map<string, OutpatientEncounterContext>();

const cloneContext = (context: OutpatientEncounterContext): OutpatientEncounterContext => ({
  patientId: context.patientId,
  appointmentId: context.appointmentId,
  receptionId: context.receptionId,
  scheduleKey: context.scheduleKey,
  encounterKey: context.encounterKey,
  visitDate: context.visitDate,
  departmentCode: context.departmentCode,
  physicianCode: context.physicianCode,
  insuranceCombinationNumber: context.insuranceCombinationNumber,
  voucherNumber: context.voucherNumber,
  sequentialNumber: context.sequentialNumber,
});

const resolveScopeKey = (scope?: StorageScope) => toScopeSuffix(scope) ?? GLOBAL_SCOPE_KEY;

const cleanupLegacyEncounterStorage = (scope?: StorageScope) => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const scopedKey = buildScopedStorageKey(STORAGE_BASE_KEY, STORAGE_VERSION, scope);
    if (scopedKey) {
      sessionStorage.removeItem(scopedKey);
    }
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore cleanup errors
  }
};

export const normalizeEncounterId = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeEncounterKey = normalizeEncounterId;

export const normalizeEncounterContext = (context?: OutpatientEncounterContext | null): OutpatientEncounterContext => {
  if (!context) {
    return {
      patientId: undefined,
      appointmentId: undefined,
      receptionId: undefined,
      scheduleKey: undefined,
      encounterKey: undefined,
      visitDate: undefined,
    };
  }
  const normalized: OutpatientEncounterContext = {
    patientId: normalizeEncounterId(context.patientId),
    appointmentId: normalizeEncounterId(context.appointmentId),
    receptionId: normalizeEncounterId(context.receptionId),
    scheduleKey: undefined,
    encounterKey: undefined,
    visitDate: normalizeVisitDate(context.visitDate),
    departmentCode: normalizeEncounterId(context.departmentCode),
    physicianCode: normalizeEncounterId(context.physicianCode),
    insuranceCombinationNumber: normalizeEncounterId(context.insuranceCombinationNumber),
    voucherNumber: normalizeEncounterId(context.voucherNumber),
    sequentialNumber: normalizeEncounterId(context.sequentialNumber),
  };
  const scheduleKey = normalizeEncounterId(context.scheduleKey);
  const encounterKey = normalizeEncounterId(context.encounterKey);
  if (scheduleKey) {
    normalized.scheduleKey = scheduleKey;
  }
  if (encounterKey) {
    normalized.encounterKey = encounterKey;
  }
  return normalized;
};

export const CHARTS_CONTEXT_QUERY_KEYS = {
  patientId: 'patientId',
  appointmentId: 'appointmentId',
  receptionId: 'receptionId',
  visitDate: 'visitDate',
} as const;

export const CHARTS_META_QUERY_KEYS = {
  runId: 'runId',
} as const;

export const RECEPTION_CARRYOVER_QUERY_KEYS = {
  keyword: 'kw',
  department: 'dept',
  physician: 'phys',
  payment: 'pay',
  sort: 'sort',
  date: 'date',
} as const;

export const normalizeVisitDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) return undefined;
  return trimmed;
};

export const normalizeRunId = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!RUN_ID_RE.test(trimmed)) return undefined;
  return trimmed;
};

export const hasEncounterContext = (context?: OutpatientEncounterContext | null): boolean => {
  const normalized = normalizeEncounterContext(context);
  return Boolean(
    normalized.receptionId ||
      normalized.appointmentId ||
      normalized.patientId ||
      normalized.visitDate ||
      normalized.scheduleKey ||
      normalized.encounterKey,
  );
};

export const hasHandoffEncounterKey = (context?: OutpatientEncounterContext | null): boolean => {
  const normalized = normalizeEncounterContext(context);
  return Boolean(normalized.scheduleKey || normalized.encounterKey);
};

export const parseChartsEncounterContext = (search: string): OutpatientEncounterContext => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const patientId = normalizeEncounterId(params.get(CHARTS_CONTEXT_QUERY_KEYS.patientId));
  const appointmentId = normalizeEncounterId(params.get(CHARTS_CONTEXT_QUERY_KEYS.appointmentId));
  const receptionId = normalizeEncounterId(params.get(CHARTS_CONTEXT_QUERY_KEYS.receptionId));
  const visitDate = normalizeVisitDate(params.get(CHARTS_CONTEXT_QUERY_KEYS.visitDate) ?? undefined);
  return {
    patientId,
    appointmentId,
    receptionId,
    scheduleKey: undefined,
    encounterKey: undefined,
    visitDate,
  };
};

export const stripChartsEncounterParams = (search: string): string => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  params.delete(CHARTS_CONTEXT_QUERY_KEYS.patientId);
  params.delete(CHARTS_CONTEXT_QUERY_KEYS.appointmentId);
  params.delete(CHARTS_CONTEXT_QUERY_KEYS.receptionId);
  params.delete(CHARTS_CONTEXT_QUERY_KEYS.visitDate);
  params.delete(RECEPTION_CARRYOVER_QUERY_KEYS.keyword);
  params.delete('keyword');
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const persistChartsEncounterContextFromSearch = (
  search: string,
  scope?: StorageScope,
): OutpatientEncounterContext | null => {
  const context = parseChartsEncounterContext(search);
  if (!hasEncounterContext(context)) return null;
  storeChartsEncounterContext(context, scope);
  return context;
};

export const parseChartsNavigationMeta = (search: string): ChartsNavigationMeta => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const runId = normalizeRunId(params.get(CHARTS_META_QUERY_KEYS.runId) ?? undefined);
  return { runId };
};

export const parseReceptionCarryoverParams = (search: string): ReceptionCarryoverParams => {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const keyword = params.get(RECEPTION_CARRYOVER_QUERY_KEYS.keyword) ?? undefined;
  const department = params.get(RECEPTION_CARRYOVER_QUERY_KEYS.department) ?? undefined;
  const physician = params.get(RECEPTION_CARRYOVER_QUERY_KEYS.physician) ?? undefined;
  const payment = params.get(RECEPTION_CARRYOVER_QUERY_KEYS.payment) ?? undefined;
  const sort = params.get(RECEPTION_CARRYOVER_QUERY_KEYS.sort) ?? undefined;
  const date = params.get(RECEPTION_CARRYOVER_QUERY_KEYS.date) ?? undefined;
  return { kw: keyword, dept: department, phys: physician, pay: payment, sort, date };
};

export const buildChartsEncounterSearch = (
  context: OutpatientEncounterContext,
  carryover: ReceptionCarryoverParams = {},
  meta: ChartsNavigationMeta = {},
): string => {
  void normalizeEncounterContext(context);
  const params = new URLSearchParams();
  const normalizedRunId = normalizeRunId(meta.runId);
  if (normalizedRunId) params.set(CHARTS_META_QUERY_KEYS.runId, normalizedRunId);
  if (carryover.dept) params.set(RECEPTION_CARRYOVER_QUERY_KEYS.department, carryover.dept);
  if (carryover.phys) params.set(RECEPTION_CARRYOVER_QUERY_KEYS.physician, carryover.phys);
  if (carryover.pay) params.set(RECEPTION_CARRYOVER_QUERY_KEYS.payment, carryover.pay);
  if (carryover.sort) params.set(RECEPTION_CARRYOVER_QUERY_KEYS.sort, carryover.sort);
  if (carryover.date) params.set(RECEPTION_CARRYOVER_QUERY_KEYS.date, carryover.date);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const buildChartsUrl = (
  context: OutpatientEncounterContext,
  carryover?: ReceptionCarryoverParams,
  meta?: ChartsNavigationMeta,
  basePath = '/charts',
): string => `${basePath}${buildChartsEncounterSearch(context, carryover, meta)}`;

export const storeChartsEncounterContext = (context: OutpatientEncounterContext, scope?: StorageScope) => {
  const normalized = normalizeEncounterContext(context);
  const scopeKey = resolveScopeKey(scope);
  cleanupLegacyEncounterStorage(scope);
  if (hasEncounterContext(normalized)) {
    volatileEncounterContexts.set(scopeKey, cloneContext(normalized));
    return;
  }
  volatileEncounterContexts.delete(scopeKey);
};

export const loadChartsEncounterContext = (scope?: StorageScope): OutpatientEncounterContext | null => {
  cleanupLegacyEncounterStorage(scope);
  const scopeKey = resolveScopeKey(scope);
  const scoped = volatileEncounterContexts.get(scopeKey);
  if (scoped) {
    return cloneContext(scoped);
  }
  if (scopeKey === GLOBAL_SCOPE_KEY) {
    return null;
  }
  const global = volatileEncounterContexts.get(GLOBAL_SCOPE_KEY);
  if (!global) {
    return null;
  }
  const normalized = cloneContext(global);
  volatileEncounterContexts.set(scopeKey, normalized);
  volatileEncounterContexts.delete(GLOBAL_SCOPE_KEY);
  return cloneContext(normalized);
};

export const clearChartsEncounterContext = (scope?: StorageScope) => {
  cleanupLegacyEncounterStorage(scope);
  if (!scope) {
    volatileEncounterContexts.clear();
    return;
  }
  volatileEncounterContexts.delete(resolveScopeKey(scope));
  volatileEncounterContexts.delete(GLOBAL_SCOPE_KEY);
};
