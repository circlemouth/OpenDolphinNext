import { describe, expect, it } from 'vitest';

import { findOrcaClaimSendEntryForMatch, resolveOrcaClaimSendMatchKeys } from './orcaClaimSendCache';

describe('orcaClaimSendCache', () => {
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
});
