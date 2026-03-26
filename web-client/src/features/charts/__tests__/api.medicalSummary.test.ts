import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildUnavailableMedicalSummary, fetchChartsMedicalSummary } from '../api';

const BLOCKED_MEDICAL_ROUTE = ['/api', 'orca', 'medical', 'outpatient'].join('/');
const { httpFetch } = vi.hoisted(() => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch,
}));

vi.mock('../../../libs/audit/auditLogger', () => ({
  logAuditEvent: vi.fn(),
  logUiState: vi.fn(),
}));

vi.mock('../../../libs/telemetry/telemetryClient', () => ({
  recordOutpatientFunnel: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  ensureObservabilityMeta: () => ({ runId: 'RUN-OBS', traceId: 'TRACE-OBS' }),
  updateObservabilityMeta: vi.fn(),
}));

describe('charts medical summary api', () => {
  beforeEach(() => {
    httpFetch.mockReset();
  });

  it('encounterKey 不在時は key_unavailable placeholder を返す', async () => {
    const summary = await fetchChartsMedicalSummary(undefined, {});

    expect(httpFetch).not.toHaveBeenCalled();
    expect(summary.recordsReturned).toBe(0);
    expect(summary.outcome).toBe('MISSING');
    expect(summary.sourcePath).toBe('key_unavailable');
    expect(summary.payload).toEqual({ outpatientList: [] });
  });

  it('formal GET route を encounterKey 主体で呼び出す', async () => {
    httpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: 'req-1',
          traceId: 'trace-1',
          runId: 'run-1',
          fetchedAt: '2026-03-26T01:00:00.000Z',
          recordsReturned: 1,
          outcome: 'SUCCESS',
          sourcePath: '/api/local-summary/encounters/{encounterKey}/medical-summary',
          payload: {
            outpatientList: [
              {
                encounterKey: 'F001:E100',
                patient: { patientId: '00001', wholeName: 'テスト患者' },
                recordsReturned: 3,
                outcome: 'SUCCESS',
                sections: {
                  diagnosis: { outcome: 'SUCCESS', recordsReturned: 1, items: [] },
                  prescription: { outcome: 'SUCCESS', recordsReturned: 1, items: [] },
                  lab: { outcome: 'SUCCESS', recordsReturned: 1, items: [] },
                  procedure: { outcome: 'SUCCESS', recordsReturned: 0, items: [] },
                  memo: { outcome: 'SUCCESS', recordsReturned: 0, items: [] },
                },
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const summary = await fetchChartsMedicalSummary(undefined, { encounterKey: 'F001:E100' });

    expect(httpFetch).toHaveBeenCalledWith('/api/local-summary/encounters/F001%3AE100/medical-summary', { method: 'GET' });
    expect(summary.sourcePath).toBe('/api/local-summary/encounters/{encounterKey}/medical-summary');
    expect(summary.recordsReturned).toBe(1);
    expect(summary.outcome).toBe('SUCCESS');
    expect(summary.requestId).toBe('req-1');
    expect(summary.payload).toEqual(
      expect.objectContaining({
        outpatientList: expect.arrayContaining([
          expect.objectContaining({
            encounterKey: 'F001:E100',
          }),
        ]),
      }),
    );
  });

  it('404 を renderable error shape に正規化する', async () => {
    httpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'LOCAL_SUMMARY_TARGET_NOT_FOUND',
            message: 'not found',
            httpStatus: 404,
            requestId: 'req-404',
            traceId: 'trace-404',
          },
        }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const summary = await fetchChartsMedicalSummary(undefined, { encounterKey: 'F001:E404' });

    expect(summary.httpStatus).toBe(404);
    expect(summary.outcome).toBe('ERROR');
    expect(summary.requestId).toBe('req-404');
    expect(summary.sourcePath).toBe('/api/local-summary/encounters/{encounterKey}/medical-summary');
    expect(summary.payload).toEqual({ outpatientList: [] });
  });

  it.each([
    [409, 'LOCAL_SUMMARY_PROJECTION_CONFLICT'],
    [503, 'LOCAL_SUMMARY_READ_MODEL_UNAVAILABLE'],
  ])('%s を renderable error shape に正規化する', async (status, code) => {
    httpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code,
            message: code,
            httpStatus: status,
            requestId: `req-${status}`,
          },
        }),
        {
          status,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const summary = await fetchChartsMedicalSummary(undefined, { encounterKey: 'F001:E100' });

    expect(summary.httpStatus).toBe(status);
    expect(summary.outcome).toBe('ERROR');
    expect(summary.payload).toEqual({ outpatientList: [] });
  });

  it('buildUnavailableMedicalSummary は encounterKey ありでも blocked route に戻さない', () => {
    const summary = buildUnavailableMedicalSummary(undefined, { encounterKey: 'F001:E100' });

    expect(summary.sourcePath).toBe('/api/local-summary/encounters/{encounterKey}/medical-summary');
    expect(JSON.stringify(summary)).not.toContain(BLOCKED_MEDICAL_ROUTE);
  });
});
