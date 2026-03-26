import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../../libs/http/httpClient';
import { openChartEncounter } from '../encounterTransitionApi';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  ensureObservabilityMeta: () => ({ runId: 'RUN-START', traceId: 'TRACE-START' }),
}));

describe('encounterTransitionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'crypto',
      {
        randomUUID: vi.fn(() => 'uuid-1234'),
        getRandomValues: vi.fn(),
        subtle: {},
      } as unknown as Crypto,
    );
  });

  it('start で operation=chart_open を current contract に送る', async () => {
    vi.mocked(httpFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          encounterKey: 'F001:E100',
          scheduleKey: 'F001:S100',
          patientId: 'P-100',
          karteId: 1001,
          businessState: 'chart_opened',
          requestId: 'req-server-1',
          traceId: 'trace-server-1',
          idempotencyKey: 'idem-server-1',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'x-trace-id': 'trace-server-1',
          },
        },
      ),
    );

    const result = await openChartEncounter({
      encounterKey: 'F001:E100',
      patientId: 'P-100',
      karteId: 1001,
    });

    expect(httpFetch).toHaveBeenCalledWith(
      '/api/encounters/F001%3AE100/transitions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        notifySessionExpired: false,
        body: JSON.stringify({
          operation: 'chart_open',
          patientId: 'P-100',
          karteId: 1001,
          requestId: 'encounter-start-uuid-1234',
          traceId: 'TRACE-START',
          idempotencyKey: 'encounter-start-idem-uuid-1234',
        }),
      }),
    );
    expect(result.businessState).toBe('chart_opened');
    expect(result.requestId).toBe('req-server-1');
  });

  it('encounterKey 無しでは fail-closed する', async () => {
    await expect(
      openChartEncounter({ patientId: 'P-100', karteId: 1001 }),
    ).rejects.toMatchObject({
      code: 'missing_encounter_key',
      message: expect.stringContaining('encounterKey がないため診察開始を実行できません'),
    });
    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('karteId 無しでは fail-closed する', async () => {
    await expect(
      openChartEncounter({ encounterKey: 'F001:E100', patientId: 'P-100', karteId: null }),
    ).rejects.toMatchObject({
      code: 'missing_karte_id',
      message: expect.stringContaining('karteId がないため診察開始を実行できません'),
    });
    expect(httpFetch).not.toHaveBeenCalled();
  });

  it('patientId 無しでは fail-closed する', async () => {
    await expect(
      openChartEncounter({ encounterKey: 'F001:E100', karteId: 1001 }),
    ).rejects.toMatchObject({
      code: 'missing_patient_id',
      message: expect.stringContaining('patientId がないため診察開始を実行できません'),
    });
    expect(httpFetch).not.toHaveBeenCalled();
  });
});
