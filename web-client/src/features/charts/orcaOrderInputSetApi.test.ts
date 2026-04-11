import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { fetchOrcaOrderInputSetDetail, fetchOrcaOrderInputSets } from './orcaOrderInputSetApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST', traceId: 'TRACE-TEST' })),
}));

const mockHttpFetch = vi.mocked(httpFetch);

describe('orcaOrderInputSetApi', () => {
  beforeEach(() => {
    mockHttpFetch.mockReset();
  });

  it('入力セット一覧を正規化する', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          totalCount: 1,
          items: [{ setCode: 'P01001', name: '降圧セット', entity: 'medOrder', itemCount: 3 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchOrcaOrderInputSets({ keyword: '降圧', entity: 'medOrder', effective: '2026-03-09' });

    expect(result.ok).toBe(true);
    expect(result.items[0]?.setCode).toBe('P01001');
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/orca/master/order/inputsets?keyword=%E9%99%8D%E5%9C%A7&entity=medOrder&effective=20260309&page=1&size=20',
      expect.objectContaining({ notifySessionExpired: false }),
    );
  });

  it('入力セット詳細の 404 を notFound として返す', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'inputset_not_found', message: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrcaOrderInputSetDetail({ setCode: 'P01001', entity: 'medOrder' });

    expect(result.ok).toBe(false);
    expect(result.notFound).toBe(true);
    expect(result.bundle?.items).toEqual([]);
  });

  it('入力セット詳細を正規化する', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          setCode: 'P01001',
          bundle: {
            entity: 'medOrder',
            bundleName: '降圧セット',
            bundleNumber: '14',
            admin: '毎食後',
            items: [{ code: '620000001', name: 'アムロジピン', quantity: '1', unit: '錠', memo: '' }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchOrcaOrderInputSetDetail({ setCode: 'P01001', entity: 'medOrder' });

    expect(result.ok).toBe(true);
    expect(result.bundle?.entity).toBe('medOrder');
    expect(result.bundle?.items[0]?.code).toBe('620000001');
  });
});
