import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { fetchOperationsReadiness } from './api';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-OLD', traceId: 'TRACE-OLD' })),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-OLD', traceId: 'TRACE-OLD' })),
  updateObservabilityMeta: vi.fn(),
}));

const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockHttpFetch.mockReset();
});

describe('administration api', () => {
  it('readiness は正式 public route /api/health/readiness を参照する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP', checks: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOperationsReadiness();

    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/health/readiness',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
        notifySessionExpired: false,
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.summaryStatus).toBe('UP');
  });
});
