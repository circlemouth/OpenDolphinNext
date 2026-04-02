import { toScopeSuffix, type StorageScope } from './storageScope';
import { clearChartsEncounterContext } from '../../features/charts/encounterContext';
import { clearChartsPatientTabsStorage } from '../../features/charts/patientTabsStorage';
import { clearReceptionDailyState } from '../../features/reception/receptionDailyState';
import { clearDeepLinkContext } from '../../routes/deepLinkContextStorage';

const SESSION_BASE_KEYS = [
  // PHI関連(sessionStorage): ログアウト時に必ず除去する
  'opendolphin:web-client:charts:encounter-context',
  'opendolphin:web-client:charts:patient-tabs',
  'opendolphin:web-client:soap-history',
  'opendolphin:web-client:charts:printPreview:document',
  'opendolphin:web-client:charts:printPreview:outpatient',
  'opendolphin:web-client:charts:printPreview:report',
  'opendolphin:web-client:charts:printResult:document',
  'opendolphin:web-client:charts:printResult:outpatient',
  'opendolphin:web-client:tab-session-id',
  'opendolphin:web-client:auth',
  'opendolphin:web-client:auth-flags',
  'opendolphin:web-client:reception-daily-state',
];

const SESSION_DIRECT_KEYS = [
  'opendolphin:web-client:deeplink-context',
];

const LOCAL_BASE_KEYS = [
  'opendolphin:web-client:charts:lock',
  'opendolphin:web-client:charts:approval',
  'opendolphin:web-client:charts:order-sets',
  'opendolphin:web-client:reception-daily-state',
  'opendolphin:web-client:auth:shared-session',
  'opendolphin:web-client:auth:shared-flags',
];

const LOCAL_DIRECT_KEYS = [
  // PHI関連(localStorage): 患者検索導線や保存ビューはログアウト時に消去する
  'opendolphin:web-client:outpatient-saved-views:v1',
  'patients-filter-state',
  'reception-filter-state',
  'opendolphin:web-client:charts:order-sets:v1',
  'useMockOrcaQueue',
  'verifyAdminDelivery',
  'mswFault',
  'mswDelayMs',
];

const VERSIONS = ['v2', 'v1'];
const SESSION_SCOPED_EXACT_KEY_PREFIXES = ['charts:orca-claim-send', 'charts:orca-income-info'];
const LOCAL_SCOPED_EXACT_KEY_PREFIXES = ['web-client:order-stamps', 'web-client:order-stamps:clipboard'];

const removeIfMatch = (storage: Storage, predicate: (key: string) => boolean) => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && predicate(key)) keys.push(key);
  }
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // ignore removal failures
    }
  });
};

const removeExactKeys = (storage: Storage, keys: string[]) => {
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // ignore removal failures
    }
  });
};

const buildScopedExactKeys = (scope: StorageScope, keyPrefixes: string[]) => {
  const suffix = toScopeSuffix(scope);
  if (!suffix) return [];
  return keyPrefixes.map((prefix) => `${prefix}:${suffix}`);
};

const matchScopedKey = (base: string, scope: StorageScope, versions = VERSIONS) => {
  const suffix = toScopeSuffix(scope);
  if (!suffix) return () => false;
  return (key: string) =>
    versions.some((ver) => {
      const prefixWithScope = `${base}:${ver}:${suffix}`;
      if (key === prefixWithScope || key.startsWith(`${prefixWithScope}:`)) return true;

      // legacy v1 keys lacked user/facility suffix
      if (ver === 'v1') {
        const legacyPrefix = `${base}:${ver}`;
        if (key === legacyPrefix || key.startsWith(`${legacyPrefix}:`)) return true;
      }

      return false;
    });
};

export const clearScopedStorage = (scope: StorageScope) => {
  if (typeof window === 'undefined') return;

  clearChartsEncounterContext(scope);
  clearChartsPatientTabsStorage(scope);
  clearReceptionDailyState(scope);
  clearDeepLinkContext();

  // sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    removeIfMatch(sessionStorage, (key) => SESSION_BASE_KEYS.some((base) => matchScopedKey(base, scope)(key)));
    removeExactKeys(sessionStorage, SESSION_DIRECT_KEYS);
    removeExactKeys(sessionStorage, buildScopedExactKeys(scope, SESSION_SCOPED_EXACT_KEY_PREFIXES));
  }

  // localStorage
  if (typeof localStorage !== 'undefined') {
    removeIfMatch(localStorage, (key) => {
      if (LOCAL_BASE_KEYS.some((base) => matchScopedKey(base, scope)(key))) return true;
      return false;
    });
    removeExactKeys(localStorage, buildScopedExactKeys(scope, LOCAL_SCOPED_EXACT_KEY_PREFIXES));
    LOCAL_DIRECT_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore removal failures
      }
    });
  }
};

export const clearAllAuthShared = () => {
  if (typeof localStorage === 'undefined') return;
  ['opendolphin:web-client:auth:shared-session:v1', 'opendolphin:web-client:auth:shared-flags:v1'].forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
};
