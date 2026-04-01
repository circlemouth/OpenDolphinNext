import { afterEach, describe, expect, it } from 'vitest';

import { loadChartsEncounterContext, storeChartsEncounterContext } from '../../../features/charts/encounterContext';
import {
  buildPatientTabKey,
  readChartsPatientTabsStorage,
  writeChartsPatientTabsStorage,
} from '../../../features/charts/patientTabsStorage';
import { loadDeepLinkContext, saveDeepLinkContext } from '../../../routes/deepLinkContextStorage';
import { clearAllAuthShared, clearScopedStorage } from '../storageCleanup';

class StorageMock implements Storage {
  private data = new Map<string, string>();

  get length() {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const scope = { facilityId: 'fac-1', userId: 'user-1' };
const otherScopeSuffix = 'fac-2:user-2';

describe('storageCleanup', () => {
  const setup = () => {
    const session = new StorageMock();
    const local = new StorageMock();

    // sessionStorage targets (v2 + legacy)
    session.setItem('opendolphin:web-client:charts:printPreview:document:v2:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:charts:printResult:document:v2:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:charts:printPreview:outpatient:v2:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:charts:printPreview:report:v2:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:charts:encounter-context:v2:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:charts:patient-tabs:v1:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:soap-history:v2:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:patients:returnTo:v2:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:reception-daily-state:v1:fac-1:user-1', 'x');
    session.setItem('opendolphin:web-client:deeplink-context', '{"savedAt":"2026-03-04T00:00:00.000Z","values":{"patientId":"123"}}');
    session.setItem('charts:orca-claim-send:fac-1:user-1', 'x');
    session.setItem('charts:orca-income-info:fac-1:user-1', 'x');
    // legacy (v1, w/o scope)
    session.setItem('opendolphin:web-client:charts:printPreview:document:v1', 'legacy');
    session.setItem('opendolphin:web-client:charts:printResult:document:v1', 'legacy');
    session.setItem('opendolphin:web-client:soap-history:v1', 'legacy');

    // other scope should survive
    session.setItem('opendolphin:web-client:charts:printPreview:document:v2:' + otherScopeSuffix, 'keep');
    session.setItem('charts:orca-claim-send:' + otherScopeSuffix, 'keep');
    session.setItem('charts:orca-income-info:' + otherScopeSuffix, 'keep');

    // localStorage targets
    local.setItem('opendolphin:web-client:charts:lock:v2:fac-1:user-1:facility:fac-1:patient:123:patient:123', 'x');
    local.setItem('opendolphin:web-client:charts:order-sets:v2:fac-1:user-1', 'x');
    local.setItem('opendolphin:web-client:auth:shared-session:v1', 'x');
    local.setItem('opendolphin:web-client:auth:shared-flags:v1', 'x');
    local.setItem('opendolphin:web-client:charts:order-sets:v1', 'x');
    local.setItem('opendolphin:web-client:outpatient-saved-views:v1', 'x');
    local.setItem('web-client:order-stamps:fac-1:user-1', 'x');
    local.setItem('web-client:order-stamps:clipboard:fac-1:user-1', 'x');
    local.setItem('useMockOrcaQueue', '1');
    local.setItem('verifyAdminDelivery', '1');
    local.setItem('mswFault', 'timeout');
    local.setItem('mswDelayMs', '1500');

    // non-target local
    local.setItem('opendolphin:web-client:charts:order-sets:v2:' + otherScopeSuffix, 'keep');
    local.setItem('web-client:order-stamps:' + otherScopeSuffix, 'keep');
    local.setItem('web-client:order-stamps:clipboard:' + otherScopeSuffix, 'keep');
    local.setItem('custom-key', 'keep');

    // expose globals
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = session;
    (globalThis as unknown as { localStorage: Storage }).localStorage = local;
    (globalThis as unknown as { window: Window & typeof globalThis }).window =
      globalThis as unknown as Window & typeof globalThis;

    return { session, local };
  };

  afterEach(() => {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
    delete (globalThis as { localStorage?: Storage }).localStorage;
    delete (globalThis as { window?: Window & typeof globalThis }).window;
  });

  it('removes scoped and legacy keys for the given user/facility', () => {
    const { session, local } = setup();
    const tabKey = buildPatientTabKey('P-001', '2026-03-04', { encounterKey: 'F001:E100' });
    if (!tabKey) throw new Error('tabKey must exist');
    storeChartsEncounterContext({ patientId: 'P-001', visitDate: '2026-03-04' }, scope);
    writeChartsPatientTabsStorage(
      {
        version: 1,
        updatedAt: '2026-03-04T00:00:00.000Z',
        savedAt: '2026-03-04T00:00:00.000Z',
        activeKey: tabKey,
        tabs: [
          {
            key: tabKey,
            patientId: 'P-001',
            visitDate: '2026-03-04',
            encounterKey: 'F001:E100',
            openedAt: '2026-03-04T00:00:00.000Z',
          },
        ],
      },
      scope,
    );
    saveDeepLinkContext({ patientId: 'P-001' });

    clearScopedStorage(scope);

    expect(session.getItem('opendolphin:web-client:charts:printPreview:document:v2:fac-1:user-1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:charts:printResult:document:v2:fac-1:user-1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:charts:printPreview:outpatient:v2:fac-1:user-1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:charts:printPreview:report:v2:fac-1:user-1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:charts:encounter-context:v2:fac-1:user-1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:charts:patient-tabs:v1:fac-1:user-1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:reception-daily-state:v1:fac-1:user-1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:deeplink-context')).toBeNull();
    expect(session.getItem('opendolphin:web-client:soap-history:v1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:charts:printPreview:document:v1')).toBeNull();
    expect(session.getItem('opendolphin:web-client:charts:printResult:document:v1')).toBeNull();
    expect(session.getItem('charts:orca-claim-send:fac-1:user-1')).toBeNull();
    expect(session.getItem('charts:orca-income-info:fac-1:user-1')).toBeNull();

    // other scope untouched
    expect(session.getItem('opendolphin:web-client:charts:printPreview:document:v2:' + otherScopeSuffix)).toBe('keep');
    expect(session.getItem('charts:orca-claim-send:' + otherScopeSuffix)).toBe('keep');
    expect(session.getItem('charts:orca-income-info:' + otherScopeSuffix)).toBe('keep');

    // localStorage entries cleared for target scope
    expect(local.getItem('opendolphin:web-client:charts:lock:v2:fac-1:user-1:facility:fac-1:patient:123:patient:123')).toBeNull();
    expect(local.getItem('opendolphin:web-client:charts:order-sets:v2:fac-1:user-1')).toBeNull();
    expect(local.getItem('opendolphin:web-client:charts:order-sets:v1')).toBeNull();
    expect(local.getItem('opendolphin:web-client:outpatient-saved-views:v1')).toBeNull();
    expect(local.getItem('web-client:order-stamps:fac-1:user-1')).toBeNull();
    expect(local.getItem('web-client:order-stamps:clipboard:fac-1:user-1')).toBeNull();
    expect(local.getItem('useMockOrcaQueue')).toBeNull();
    expect(local.getItem('verifyAdminDelivery')).toBeNull();
    expect(local.getItem('mswFault')).toBeNull();
    expect(local.getItem('mswDelayMs')).toBeNull();
    expect(local.getItem('opendolphin:web-client:charts:order-sets:v2:' + otherScopeSuffix)).toBe('keep');
    expect(local.getItem('web-client:order-stamps:' + otherScopeSuffix)).toBe('keep');
    expect(local.getItem('web-client:order-stamps:clipboard:' + otherScopeSuffix)).toBe('keep');
    expect(local.getItem('custom-key')).toBe('keep');
    expect(loadChartsEncounterContext(scope)).toBeNull();
    expect(readChartsPatientTabsStorage(scope)).toBeNull();
    expect(loadDeepLinkContext()).toBeNull();
  });

  it('clearAllAuthShared removes shared auth keys', () => {
    const { local } = setup();

    clearAllAuthShared();

    expect(local.getItem('opendolphin:web-client:auth:shared-session:v1')).toBeNull();
    expect(local.getItem('opendolphin:web-client:auth:shared-flags:v1')).toBeNull();
  });
});
