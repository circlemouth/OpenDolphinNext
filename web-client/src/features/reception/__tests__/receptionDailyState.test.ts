import { beforeEach, describe, expect, it } from 'vitest';

import type { ReceptionEntry } from '../../outpatient/types';
import {
  clearReceptionDailyState,
  clearReceptionStatusOverridesForDate,
  listReceptionSnapshotDates,
  resolveReceptionEntriesForDate,
  upsertReceptionStatusOverride,
} from '../receptionDailyState';

const buildEntry = (overrides: Partial<ReceptionEntry> = {}): ReceptionEntry => ({
  id: overrides.id ?? 'row-1',
  appointmentId: overrides.appointmentId,
  receptionId: overrides.receptionId ?? 'R-001',
  patientId: overrides.patientId ?? 'P-001',
  name: overrides.name ?? '山田太郎',
  status: overrides.status ?? '受付中',
  visitDate: overrides.visitDate ?? '2026-02-11',
  appointmentTime: overrides.appointmentTime ?? '09:00',
  acceptanceTime: overrides.acceptanceTime ?? '09:00',
  source: overrides.source ?? 'visits',
  department: overrides.department ?? '内科',
  physician: overrides.physician ?? '10001',
  insurance: overrides.insurance ?? '保険',
  kana: overrides.kana,
  birthDate: overrides.birthDate,
  sex: overrides.sex,
  reservationTime: overrides.reservationTime,
  note: overrides.note,
});

const scope = { facilityId: 'fac-1', userId: 'user-1' };
const scopedStorageKey = 'opendolphin:web-client:reception-daily-state:v1:fac-1:user-1';
const legacyStorageKey = 'opendolphin:web-client:reception-daily-state:v1';

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

const ensureWebStorage = () => {
  if (typeof localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new StorageMock(),
      configurable: true,
      writable: true,
    });
  }
  if (typeof sessionStorage === 'undefined') {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: new StorageMock(),
      configurable: true,
      writable: true,
    });
  }
};

describe('receptionDailyState', () => {
  beforeEach(() => {
    ensureWebStorage();
    localStorage.clear();
    sessionStorage.clear();
    clearReceptionDailyState();
  });

  it('stores daily entries and restores them when incoming entries are empty', () => {
    const date = '2026-02-11';
    const first = resolveReceptionEntriesForDate({
      date,
      incomingEntries: [buildEntry()],
      scope,
    });
    expect(first.source).toBe('live');
    expect(first.entries).toHaveLength(1);

    const restored = resolveReceptionEntriesForDate({
      date,
      incomingEntries: [],
      scope,
    });
    expect(restored.source).toBe('snapshot');
    expect(restored.entries).toHaveLength(1);
    expect(restored.entries[0]?.patientId).toBe('P-001');
    expect(restored.entries[0]?.name).toBe('山田太郎');
    expect(restored.entries[0]?.department).toBe('内科');
    expect(sessionStorage.getItem(scopedStorageKey)).toBeNull();
    expect(localStorage.getItem(legacyStorageKey)).toBeNull();
  });

  it('keeps higher-priority status when demotion is not allowed', () => {
    const date = '2026-02-11';
    resolveReceptionEntriesForDate({
      date,
      incomingEntries: [buildEntry({ status: '会計待ち' })],
      scope,
    });

    upsertReceptionStatusOverride({
      date,
      rowKey: 'reception:R-001',
      status: '再計待',
      source: 'charts_open',
      scope,
    });
    upsertReceptionStatusOverride({
      date,
      rowKey: 'reception:R-001',
      status: '会計待ち',
      source: 'manual',
      scope,
    });

    const resolved = resolveReceptionEntriesForDate({
      date,
      incomingEntries: [],
      scope,
    });
    expect(resolved.entries[0]?.status).toBe('再計待');
  });

  it('returns snapshot dates in descending order', () => {
    resolveReceptionEntriesForDate({
      date: '2026-02-10',
      incomingEntries: [buildEntry({ id: 'row-a', patientId: 'P-A', visitDate: '2026-02-10' })],
      scope,
    });
    resolveReceptionEntriesForDate({
      date: '2026-02-11',
      incomingEntries: [buildEntry({ id: 'row-b', patientId: 'P-B', visitDate: '2026-02-11' })],
      scope,
    });

    expect(listReceptionSnapshotDates(scope, 10).slice(0, 2)).toEqual(['2026-02-11', '2026-02-10']);
  });

  it('clears status override for the specified patient', () => {
    const date = '2026-02-11';
    resolveReceptionEntriesForDate({
      date,
      incomingEntries: [buildEntry({ status: '受付中' })],
      scope,
    });
    upsertReceptionStatusOverride({
      date,
      rowKey: 'reception:R-001',
      status: '再計待',
      source: 'manual',
      scope,
    });

    clearReceptionStatusOverridesForDate({
      date,
      patientId: 'P-001',
      scope,
    });

    const resolved = resolveReceptionEntriesForDate({
      date,
      incomingEntries: [buildEntry({ status: '受付中' })],
      scope,
    });
    expect(resolved.entries[0]?.status).toBe('受付中');
  });

  it('applies override only to the matching row when the same patient has multiple receptions', () => {
    const date = '2026-02-11';
    resolveReceptionEntriesForDate({
      date,
      incomingEntries: [
        buildEntry({ id: 'row-a', receptionId: 'R-100', patientId: 'P-100', appointmentTime: '09:00', status: '会計待ち' }),
        buildEntry({ id: 'row-b', receptionId: 'R-101', patientId: 'P-100', appointmentTime: '11:00', status: '会計待ち' }),
      ],
      scope,
    });

    upsertReceptionStatusOverride({
      date,
      rowKey: 'reception:R-101',
      patientId: 'P-100',
      status: '再計待',
      source: 'manual',
      scope,
    });

    const resolved = resolveReceptionEntriesForDate({
      date,
      incomingEntries: [],
      scope,
    });

    expect(resolved.entries.find((entry) => entry.receptionId === 'R-100')?.status).toBe('会計待ち');
    expect(resolved.entries.find((entry) => entry.receptionId === 'R-101')?.status).toBe('再計待');
  });

  it('legacy storage snapshot は cleanup するが復元しない', () => {
    const date = '2026-02-11';
    localStorage.setItem(
      legacyStorageKey,
      JSON.stringify({
        version: 1,
        updatedAt: '2026-02-11T00:00:00.000Z',
        days: {
          [date]: {
            updatedAt: '2026-02-11T00:00:00.000Z',
            entries: [buildEntry({ id: 'legacy-1', visitDate: date })],
            statusByPatientId: {},
          },
        },
      }),
    );

    const restored = resolveReceptionEntriesForDate({
      date,
      incomingEntries: [],
      scope,
    });

    expect(restored.source).toBe('empty');
    expect(restored.entries).toHaveLength(0);
    expect(sessionStorage.getItem(scopedStorageKey)).toBeNull();
    expect(localStorage.getItem(legacyStorageKey)).toBeNull();
  });

  it('returns empty snapshot and does not persist when scope is missing', () => {
    const date = '2026-02-11';
    const first = resolveReceptionEntriesForDate({
      date,
      incomingEntries: [buildEntry({ id: 'no-scope-1' })],
    });
    expect(first.source).toBe('live');
    expect(first.entries).toHaveLength(1);

    const restored = resolveReceptionEntriesForDate({
      date,
      incomingEntries: [],
    });
    expect(restored.source).toBe('empty');
    expect(restored.entries).toHaveLength(0);
    expect(sessionStorage.getItem(scopedStorageKey)).toBeNull();
    expect(localStorage.getItem(legacyStorageKey)).toBeNull();
  });
});
