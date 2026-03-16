import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { fetchOrcaHokenja } from './orcaHokenjaApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST', traceId: 'TRACE-TEST' })),
}));

const mockHttpFetch = vi.mocked(httpFetch);

describe('fetchOrcaHokenja', () => {
  beforeEach(() => {
    mockHttpFetch.mockReset();
  });

  it('keyword が空なら fetch しない', async () => {
    const result = await fetchOrcaHokenja({ keyword: '   ' });

    expect(result.ok).toBe(false);
    expect(result.items).toEqual([]);
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('pref と paging を正規化して結果を返す', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          totalCount: 1,
          items: [
            {
              payerCode: '06123456',
              payerName: '東京都保険者',
              payerType: '社保',
              payerRatio: 30,
              addressLine: '東京都千代田区',
            },
          ],
          runId: 'RUN-SERVER',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchOrcaHokenja({
      keyword: '東京',
      pref: '13-',
      effective: '2026-03-09',
      page: 2,
      size: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.items[0]?.payerCode).toBe('06123456');
    expect(result.totalCount).toBe(1);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/orca/master/hokenja?keyword=%E6%9D%B1%E4%BA%AC&effective=20260309&page=2&size=10&pref=13',
      expect.objectContaining({ notifySessionExpired: false }),
    );
  });

  it('0件でも正常応答として扱う', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ totalCount: 0, items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrcaHokenja({ keyword: '該当なし' });

    expect(result.ok).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
  });
});
