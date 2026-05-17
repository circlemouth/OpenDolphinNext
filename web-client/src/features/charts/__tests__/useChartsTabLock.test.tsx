import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useChartsTabLock } from '../useChartsTabLock';

vi.mock('../editLock', () => ({
  acquireChartsTabLock: vi.fn(({ storageKey, owner, ttlMs, now }) => ({
    ok: true,
    record: {
      key: storageKey,
      owner,
      ttlMs,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    },
  })),
  buildChartsTabLockStorageKey: vi.fn((target: { patientId?: string; appointmentId?: string; receptionId?: string }) =>
    target.patientId ? `lock:${target.patientId}:${target.appointmentId ?? 'none'}:${target.receptionId ?? 'none'}` : null,
  ),
  buildLegacyChartsTabLockStorageKey: vi.fn(() => null),
  getOrCreateTabSessionId: vi.fn(() => 'tab-session-1'),
  isChartsTabLockExpired: vi.fn(() => false),
  readChartsTabLock: vi.fn(() => null),
  releaseChartsTabLock: vi.fn(),
  renewChartsTabLock: vi.fn(() => ({ ok: true })),
  subscribeChartsTabLock: vi.fn(() => () => undefined),
}));

vi.mock('../chartEditSessionApi', () => ({
  acquireChartEditSession: vi.fn(() =>
    Promise.resolve({
      ok: false,
      supported: false,
      status: 404,
      runId: 'RUN-LOCK',
      error: 'NOT_SUPPORTED',
    }),
  ),
  heartbeatChartEditSession: vi.fn(() =>
    Promise.resolve({
      ok: true,
      supported: true,
      status: 200,
      runId: 'RUN-LOCK',
      lockStatus: 'owned',
      leaseId: 'lease-test',
    }),
  ),
  releaseChartEditSession: vi.fn(() =>
    Promise.resolve({
      ok: true,
      supported: true,
      status: 200,
      runId: 'RUN-LOCK',
      lockStatus: 'released',
    }),
  ),
}));

import { releaseChartsTabLock } from '../editLock';

describe('useChartsTabLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('target が変わると旧 lock を即時解放する', () => {
    const { rerender } = renderHook(
      ({ patientId, appointmentId, receptionId }) =>
        useChartsTabLock({
          runId: 'RUN-LOCK',
          target: { facilityId: 'facility', patientId, appointmentId, receptionId },
          enabled: true,
          scope: { facilityId: 'facility', userId: 'doctor' },
        }),
      {
        initialProps: {
          patientId: 'P-001',
          appointmentId: 'A-001',
          receptionId: 'R-001',
        },
      },
    );

    rerender({
      patientId: 'P-002',
      appointmentId: 'A-002',
      receptionId: 'R-002',
    });

    expect(vi.mocked(releaseChartsTabLock)).toHaveBeenCalledWith({
      storageKey: 'lock:P-001:A-001:R-001',
      ownerTabSessionId: 'tab-session-1',
    });
  });

  it('enabled=false で current lock を解放する', () => {
    const { rerender } = renderHook(
      ({ enabled }) =>
        useChartsTabLock({
          runId: 'RUN-LOCK',
          target: { facilityId: 'facility', patientId: 'P-001', appointmentId: 'A-001', receptionId: 'R-001' },
          enabled,
          scope: { facilityId: 'facility', userId: 'doctor' },
        }),
      {
        initialProps: { enabled: true },
      },
    );

    rerender({ enabled: false });

    expect(vi.mocked(releaseChartsTabLock)).toHaveBeenCalledWith({
      storageKey: 'lock:P-001:A-001:R-001',
      ownerTabSessionId: 'tab-session-1',
    });
  });

  it('unmount 時に current lock を解放する', () => {
    const { unmount } = renderHook(() =>
      useChartsTabLock({
        runId: 'RUN-LOCK',
        target: { facilityId: 'facility', patientId: 'P-001', appointmentId: 'A-001', receptionId: 'R-001' },
        enabled: true,
        scope: { facilityId: 'facility', userId: 'doctor' },
      }),
    );

    unmount();

    expect(vi.mocked(releaseChartsTabLock)).toHaveBeenCalledWith({
      storageKey: 'lock:P-001:A-001:R-001',
      ownerTabSessionId: 'tab-session-1',
    });
  });
});
