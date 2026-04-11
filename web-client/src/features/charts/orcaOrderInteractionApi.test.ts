import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { checkOrcaMasterStaticOrderInteractions, checkOrcaOrderInteractions } from './orcaOrderInteractionApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST', traceId: 'TRACE-TEST' })),
}));

const mockHttpFetch = vi.mocked(httpFetch);

describe('checkOrcaOrderInteractions', () => {
  beforeEach(() => {
    mockHttpFetch.mockReset();
  });

  it('code を dedupe して送信する', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          totalCount: 1,
          pairs: [{ code1: '620000001', code2: '620000003', interactionName: '併用注意' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await checkOrcaMasterStaticOrderInteractions({
      codes: ['620000001', '620000001', '620000002'],
      existingCodes: ['620000003', '620000003', ' '],
    });

    expect(result.ok).toBe(true);
    expect(result.totalCount).toBe(1);
    const body = mockHttpFetch.mock.calls[0]?.[1]?.body;
    expect(body).toBe('{"codes":["620000001","620000002"],"existingCodes":["620000003"]}');
  });

  it('API エラーは result object で返す', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'failed' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await checkOrcaMasterStaticOrderInteractions({ codes: ['620000001', '620000002'] });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.pairs).toEqual([]);
  });

  it('backward-compatible alias は master static 実装を指す', () => {
    expect(checkOrcaOrderInteractions).toBe(checkOrcaMasterStaticOrderInteractions);
  });
});
