import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { fetchOrcaGenericPrice } from './orcaGenericPriceApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST', traceId: 'TRACE-TEST' })),
}));

const mockHttpFetch = vi.mocked(httpFetch);

describe('fetchOrcaGenericPrice', () => {
  beforeEach(() => {
    mockHttpFetch.mockReset();
  });

  it('9桁でない code は fetch しない', async () => {
    const result = await fetchOrcaGenericPrice({ srycd: '123' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('最低薬価レスポンスを正規化する', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: '620000001',
          name: 'アムロジピン',
          minPrice: 12.34,
          unit: '錠',
          validFrom: '20240401',
          validTo: '99991231',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchOrcaGenericPrice({ srycd: '620000001', effective: '2026-03-09' });

    expect(result.ok).toBe(true);
    expect(result.item?.minPrice).toBe(12.34);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/orca/master/generic-price?srycd=620000001&effective=20260309',
      expect.objectContaining({ notifySessionExpired: false }),
    );
  });
});
