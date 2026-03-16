import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { fetchOrcaAddress } from './orcaAddressApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST', traceId: 'TRACE-TEST' })),
}));

const mockHttpFetch = vi.mocked(httpFetch);

describe('fetchOrcaAddress', () => {
  beforeEach(() => {
    mockHttpFetch.mockReset();
  });

  it('7桁でない zip は fetch しない', async () => {
    const result = await fetchOrcaAddress({ zip: '160-00' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('郵便番号を正規化して住所を返す', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          zip: '1600023',
          city: '新宿区',
          town: '西新宿',
          fullAddress: '東京都新宿区西新宿',
          runId: 'RUN-SERVER',
          traceId: 'TRACE-SERVER',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchOrcaAddress({ zip: '160-0023', effective: '2026-03-09' });

    expect(result.ok).toBe(true);
    expect(result.item?.zip).toBe('1600023');
    expect(result.item?.fullAddress).toBe('東京都新宿区西新宿');
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/orca/master/address?zip=1600023&effective=20260309',
      expect.objectContaining({ notifySessionExpired: false }),
    );
  });

  it('404 は notFound として返す', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'MASTER_ADDRESS_NOT_FOUND', message: 'not found', runId: 'RUN-SERVER' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrcaAddress({ zip: '1600023' });

    expect(result.ok).toBe(false);
    expect(result.notFound).toBe(true);
    expect(result.status).toBe(404);
  });
});
