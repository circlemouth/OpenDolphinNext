import { beforeEach, describe, expect, it, vi } from 'vitest';

const shared = vi.hoisted(() => ({
  state: {
    meta: {
      runId: 'RUN-OLD',
      traceId: 'TRACE-OLD',
      cacheHit: true,
      missingMaster: true,
      fallbackUsed: true,
      dataSourceTransition: 'fallback',
    } as {
      runId?: string;
      traceId?: string;
      cacheHit?: boolean;
      missingMaster?: boolean;
      fallbackUsed?: boolean;
      dataSourceTransition?: string;
      fetchedAt?: string;
      recordsReturned?: number;
    },
  },
}));

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ ...shared.state.meta })),
  updateObservabilityMeta: vi.fn((next: Record<string, unknown>) => {
    const filtered = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
    shared.state.meta = { ...shared.state.meta, ...filtered };
  }),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { fetchWithResolver } from '../fetchWithResolver';

describe('fetchWithResolver observability flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shared.state.meta = {
      runId: 'RUN-OLD',
      traceId: 'TRACE-OLD',
      cacheHit: true,
      missingMaster: true,
      fallbackUsed: true,
      dataSourceTransition: 'fallback',
    };
  });

  it('レスポンスにフラグが無い場合は stale な missingMaster/fallbackUsed を引き継がない', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-NEW',
          traceId: 'TRACE-NEW',
          dataSourceTransition: 'server',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchWithResolver({
      candidates: [{ path: '/api/orca/appointments/list', source: 'server' }],
      body: { visitDate: '2026-02-18' },
    });

    expect(result.ok).toBe(true);
    expect(result.meta.missingMaster).toBe(false);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(shared.state.meta.missingMaster).toBe(false);
    expect(shared.state.meta.fallbackUsed).toBe(false);
  });

  it('レスポンスがフラグを返した場合は値を保持する', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-NEW',
          traceId: 'TRACE-NEW',
          dataSourceTransition: 'server',
          missingMaster: true,
          fallbackUsed: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchWithResolver({
      candidates: [{ path: '/api/orca/appointments/list', source: 'server' }],
      body: { visitDate: '2026-02-18' },
    });

    expect(result.ok).toBe(true);
    expect(result.meta.missingMaster).toBe(true);
    expect(result.meta.fallbackUsed).toBe(true);
  });
});
