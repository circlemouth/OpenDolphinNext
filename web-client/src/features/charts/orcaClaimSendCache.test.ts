import { beforeEach, describe, expect, it } from 'vitest';

import {
  findOrcaClaimSendEntryForMatch,
  getOrcaClaimSendEntry,
  resetOrcaClaimSendCacheForTests,
  resolveOrcaClaimSendMatchKeys,
  saveOrcaClaimSendCache,
} from './orcaClaimSendCache';

const STORAGE_SCOPE = { facilityId: 'F-1', userId: 'U-1' };
const STORAGE_KEY = 'charts:orca-claim-send:F-1:U-1';

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

const ensureSessionStorage = () => {
  if (typeof sessionStorage !== 'undefined') return;
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: new StorageMock(),
    configurable: true,
    writable: true,
  });
};

describe('orcaClaimSendCache', () => {
  beforeEach(() => {
    ensureSessionStorage();
    resetOrcaClaimSendCacheForTests();
    sessionStorage.clear();
  });

  it('候補 key を canonical priority の順で返す', () => {
    expect(
      resolveOrcaClaimSendMatchKeys({
        encounterKey: 'ENC-1',
        scheduleKey: 'SCH-1',
        receptionId: 'R-1',
        appointmentId: 'APT-1',
      }),
    ).toEqual(['encounter:ENC-1', 'schedule:SCH-1', 'reception:R-1', 'appointment:APT-1']);
  });

  it('encounter key が無くても reception key の送信成功 cache を拾う', () => {
    const matched = findOrcaClaimSendEntryForMatch(
      {
        'reception:R-2402': {
          cacheKey: 'reception:R-2402',
          patientId: 'P-2402',
          receptionId: 'R-2402',
          sendStatus: 'success',
          savedAt: '2026-04-17T00:00:00.000Z',
        },
      },
      {
        patientId: 'P-2402',
        receptionId: 'R-2402',
        scheduleKey: 'SCH-2402',
        encounterKey: 'ENC-2402',
      },
    );

    expect(matched?.sendStatus).toBe('success');
    expect(matched?.cacheKey).toBe('reception:R-2402');
  });

  it('patient fallback は複数 row 候補では適用しない', () => {
    const matched = findOrcaClaimSendEntryForMatch(
      {
        'patient:P-2402': {
          cacheKey: 'patient:P-2402',
          patientId: 'P-2402',
          sendStatus: 'success',
          savedAt: '2026-04-17T00:00:00.000Z',
        },
      },
      {
        patientId: 'P-2402',
      },
      { allowPatientFallback: false },
    );

    expect(matched).toBeNull();
  });

  it('sessionStorage には請求番号と警告詳細を保存しない', () => {
    saveOrcaClaimSendCache(
      {
        patientId: 'P-2402',
        appointmentId: 'A-2402',
        performDate: '2026-04-17',
        invoiceNumber: 'INV-2402',
        dataId: 'DATA-2402',
        runId: 'RUN-2402',
        traceId: 'TRACE-2402',
        apiResult: '80',
        sendStatus: 'success',
        medicalWarnings: [{ message: '補正候補があります', code: 'W01' }],
      },
      STORAGE_SCOPE,
    );

    const raw = sessionStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw ?? '{}') as Record<string, Record<string, unknown>>;
    expect(parsed['appointment:A-2402']).toMatchObject({
      cacheKey: 'appointment:A-2402',
      patientId: 'P-2402',
      appointmentId: 'A-2402',
      runId: 'RUN-2402',
      traceId: 'TRACE-2402',
      apiResult: '80',
      sendStatus: 'success',
    });
    expect(parsed['appointment:A-2402']).not.toHaveProperty('invoiceNumber');
    expect(parsed['appointment:A-2402']).not.toHaveProperty('medicalWarnings');

    const volatile = getOrcaClaimSendEntry(STORAGE_SCOPE, 'P-2402');
    expect(volatile?.invoiceNumber).toBe('INV-2402');
    expect(volatile?.medicalWarnings).toEqual([{ message: '補正候補があります', code: 'W01' }]);
  });

  it('旧 persisted payload を読み戻す時も請求番号と警告詳細を復元しない', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'appointment:A-2402': {
          cacheKey: 'appointment:A-2402',
          patientId: 'P-2402',
          appointmentId: 'A-2402',
          performDate: '2026-04-17',
          invoiceNumber: 'INV-2402',
          dataId: 'DATA-2402',
          runId: 'RUN-2402',
          traceId: 'TRACE-2402',
          apiResult: '80',
          sendStatus: 'success',
          correctionKind: 'confirm',
          correctionReason: '要確認',
          medicalWarnings: [{ message: '補正候補があります', code: 'W01' }],
          savedAt: new Date().toISOString(),
        },
      }),
    );

    const entry = getOrcaClaimSendEntry(STORAGE_SCOPE, 'P-2402');
    expect(entry?.invoiceNumber).toBeUndefined();
    expect(entry?.medicalWarnings).toBeUndefined();
    expect(entry?.correctionKind).toBe('confirm');
    expect(entry?.correctionReason).toBe('要確認');

    const rewritten = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Record<string, unknown>>;
    expect(rewritten['appointment:A-2402']).not.toHaveProperty('invoiceNumber');
    expect(rewritten['appointment:A-2402']).not.toHaveProperty('medicalWarnings');
  });
});
