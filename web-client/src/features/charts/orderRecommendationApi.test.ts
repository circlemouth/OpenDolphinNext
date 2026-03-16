import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchOrderRecommendations } from './orderRecommendationApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-TEST'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST' })),
  updateObservabilityMeta: vi.fn(),
}));

describe('fetchOrderRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('レスポンスを候補一覧として正規化する', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-SERVER',
          patientId: 'P-1',
          recordsScanned: 24,
          recordsReturned: 1,
          recommendations: [
            {
              key: 'abc',
              source: 'patient',
              count: 3,
              lastUsedAt: '2026-02-11',
              template: {
                bundleName: '降圧薬セット',
                admin: '1日1回 朝食後',
                bundleNumber: '14',
                adminMemo: '',
                memo: '',
                prescriptionLocation: 'out',
                prescriptionTiming: 'regular',
                items: [{ code: '100', name: 'アムロジピン', quantity: '1', unit: '錠' }],
                materialItems: [],
                commentItems: [],
                bodyPart: null,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderRecommendations({
      patientId: 'P-1',
      entity: 'medOrder',
      from: '2025-08-01',
      includeFacility: false,
      patientLimit: 8,
      facilityLimit: 0,
      scanLimit: 100,
    });

    expect(result.ok).toBe(true);
    expect(result.runId).toBe('RUN-SERVER');
    expect(result.recordsReturned).toBe(1);
    expect(result.recommendations[0]?.source).toBe('patient');
    expect(result.recommendations[0]?.template.bundleName).toBe('降圧薬セット');
    expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain('/api/orca/order/recommendations?patientId=P-1');
    expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain('includeFacility=false');
  });

  it('通信失敗時は空候補で復帰する', async () => {
    const { httpFetch } = await import('../../libs/http/httpClient');
    vi.mocked(httpFetch).mockRejectedValueOnce(new Error('network down'));

    const result = await fetchOrderRecommendations({ patientId: 'P-2', entity: 'medOrder' });

    expect(result.ok).toBe(false);
    expect(result.recommendations).toEqual([]);
    expect(result.message).toContain('network down');
  });
});
