import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
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
    clearChartsPatientTabsStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    clearChartsPatientTabsStorage();
  });

  it('write は browser storage に保存せず volatile state のみ更新する', () => {
    const state: ChartsPatientTabsStorage = {
      version: 1,
      updatedAt: '2026-03-04T00:00:00.000Z',
      savedAt: '2026-03-04T00:00:00.000Z',
      activeKey: 'P-001::2026-03-04',
      tabs: [
        {
          key: 'P-001::2026-03-04',
          patientId: 'P-001',
          visitDate: '2026-03-04',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          openedAt: '2026-03-04T00:00:00.000Z',
          name: '山田 太郎',
          department: '内科',
        },
      ],
    };

    writeChartsPatientTabsStorage(state, scope);

    expect(sessionStorage.length).toBe(0);
    expect(readChartsPatientTabsStorage(scope)).toEqual({
      ...state,
      tabs: [
        {
          key: 'P-001::2026-03-04',
          patientId: 'P-001',
          visitDate: '2026-03-04',
          scheduleKey: 'F001:S100',
          encounterKey: 'F001:E100',
          openedAt: '2026-03-04T00:00:00.000Z',
        },
      ],
    });
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

    clearChartsPatientTabsStorage(scope);

    expect(readChartsPatientTabsStorage(scope)).toBeNull();
  });
});
