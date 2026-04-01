import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyEncounterTabState,
  buildPatientTabKey,
  clearChartsPatientTabsStorage,
  readChartsPatientTabsStorage,
  writeChartsPatientTabsStorage,
  type ChartsPatientTabsStorage,
} from '../patientTabsStorage';

const scope = { facilityId: '0001', userId: 'doctor01' };

describe('patientTabsStorage security', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T00:00:00.000Z'));
    sessionStorage.clear();
    localStorage.clear();
    clearChartsPatientTabsStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    localStorage.clear();
    clearChartsPatientTabsStorage();
  });

  it('write は browser storage に保存せず volatile state のみ更新する', () => {
    const tabKey = buildPatientTabKey('P-001', '2026-03-04', {
      scheduleKey: 'F001:S100',
      encounterKey: 'F001:E100',
    });
    if (!tabKey) throw new Error('tabKey must exist');
    const state: ChartsPatientTabsStorage = {
      version: 1,
      updatedAt: '2026-03-04T00:00:00.000Z',
      savedAt: '2026-03-04T00:00:00.000Z',
      activeKey: tabKey,
      tabs: [
        {
          key: tabKey,
          patientId: 'P-001',
          visitDate: '2026-03-04',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          openedAt: '2026-03-04T00:00:00.000Z',
          lastActivatedAt: '2026-03-04T00:05:00.000Z',
          name: '山田 太郎',
          department: '内科',
        },
      ],
    };

    writeChartsPatientTabsStorage(state, scope);

    expect(sessionStorage.length).toBe(0);
    expect(readChartsPatientTabsStorage(scope)).toEqual(state);
  });

  it('read は legacy storage を削除して復元しない', () => {
    sessionStorage.setItem(
      'opendolphin:web-client:charts:patient-tabs:v1:0001:doctor01',
      JSON.stringify({
        version: 1,
        updatedAt: '2026-03-04T00:10:00.000Z',
        savedAt: '2026-03-04T00:10:00.000Z',
        activeKey: 'P-001::2026-03-04',
        tabs: [
          {
            key: 'P-001::2026-03-04',
            patientId: 'P-001',
            visitDate: '2026-03-04',
            openedAt: '2026-03-04T00:10:00.000Z',
            name: '旧氏名',
            department: '旧科',
          },
        ],
      }),
    );

    expect(readChartsPatientTabsStorage(scope)).toBeNull();
    expect(sessionStorage.getItem('opendolphin:web-client:charts:patient-tabs:v1:0001:doctor01')).toBeNull();
  });

  it('clear で volatile state も破棄する', () => {
    const tabKey = buildPatientTabKey('P-001', '2026-03-04', {
      encounterKey: 'F001:E100',
    });
    if (!tabKey) throw new Error('tabKey must exist');
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

    clearChartsPatientTabsStorage(scope);

    expect(readChartsPatientTabsStorage(scope)).toBeNull();
  });

  it('handoff key を持たない tab は write 時に prune する', () => {
    writeChartsPatientTabsStorage(
      {
        version: 1,
        updatedAt: '2026-03-04T00:00:00.000Z',
        savedAt: '2026-03-04T00:00:00.000Z',
        activeKey: 'P-001::2026-03-04',
        tabs: [
          {
            key: 'P-001::2026-03-04',
            patientId: 'P-001',
            visitDate: '2026-03-04',
            openedAt: '2026-03-04T00:00:00.000Z',
          },
        ],
      },
      scope,
    );

    expect(readChartsPatientTabsStorage(scope)).toBeNull();
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('applyEncounterTabState は encounter/schedule 単位で canonical key を生成し識別情報を保持する', () => {
    const initial: ChartsPatientTabsStorage = {
      version: 1,
      updatedAt: '2026-03-04T00:00:00.000Z',
      savedAt: '2026-03-04T00:00:00.000Z',
      activeKey: undefined,
      tabs: [],
    };

    const next = applyEncounterTabState(initial, {
      patientId: 'P-001',
      visitDate: '2026-03-04',
      scheduleKey: 'F001:S100',
      encounterKey: 'F001:E100',
      name: '山田 太郎',
      department: '内科',
    });

    expect(next.activeKey).toBe('encounter:F001:E100');
    expect(next.tabs).toEqual([
      expect.objectContaining({
        key: 'encounter:F001:E100',
        patientId: 'P-001',
        visitDate: '2026-03-04',
        scheduleKey: 'F001:S100',
        encounterKey: 'F001:E100',
        name: '山田 太郎',
        department: '内科',
      }),
    ]);
  });

  it('applyEncounterTabState は handoff key がない encounter を workspace tab 化しない', () => {
    const initial: ChartsPatientTabsStorage = {
      version: 1,
      updatedAt: '2026-03-04T00:00:00.000Z',
      savedAt: '2026-03-04T00:00:00.000Z',
      activeKey: undefined,
      tabs: [],
    };

    const next = applyEncounterTabState(initial, {
      patientId: 'P-001',
      visitDate: '2026-03-04',
      name: '山田 太郎',
      department: '内科',
    });

    expect(next).toEqual(initial);
  });
});
