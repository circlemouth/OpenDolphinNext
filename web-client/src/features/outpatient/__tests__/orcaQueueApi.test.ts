import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shared = vi.hoisted(() => ({
  state: {
    meta: {
      runId: 'RUN-OLD',
      traceId: 'TRACE-OLD',
    } as {
      runId?: string;
      traceId?: string;
    },
  },
}));

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  getObservabilityMeta: vi.fn(() => ({ ...shared.state.meta })),
  updateObservabilityMeta: vi.fn((next: Record<string, unknown>) => {
    const filtered = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
    shared.state.meta = { ...shared.state.meta, ...filtered };
  }),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { fetchOrcaPushEvents, fetchOrcaQueue, resolveOrcaQueueRetryUiFeedback, retryOrcaQueue } from '../orcaQueueApi';

const mockHttpFetch = vi.mocked(httpFetch);

describe('orcaQueueApi fetchOrcaPushEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_DISABLE_ORCA_POLLING', '0');
    shared.state.meta = {
      runId: 'RUN-OLD',
      traceId: 'TRACE-OLD',
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('pusheventgetv2 public route は fail-closed で network call しない', async () => {
    const result = await fetchOrcaPushEvents();

    expect(mockHttpFetch).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.status).toBe(410);
    expect(result.warning).toContain('現行 contract');
    expect(result.events).toEqual([]);
  });
});

describe('orcaQueueApi fetchOrcaQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_DISABLE_ORCA_POLLING', '0');
    shared.state.meta = {
      runId: 'RUN-OLD',
      traceId: 'TRACE-OLD',
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('enabled=false のとき queue API を呼ばず空レスポンスを返す', async () => {
    const result = await fetchOrcaQueue(undefined, { enabled: false });

    expect(mockHttpFetch).not.toHaveBeenCalled();
    expect(result.queue).toEqual([]);
    expect(result.runId).toBe('RUN-OLD');
    expect(result.traceId).toBe('TRACE-OLD');
  });

  it('queue public route は fail-closed で network call しない', async () => {
    const result = await fetchOrcaQueue();

    expect(mockHttpFetch).not.toHaveBeenCalled();
    expect(result.queue).toEqual([]);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(410);
    expect(result.message).toContain('現行 contract');
  });

  it('retry も fail-closed で network call しない', async () => {
    const result = await retryOrcaQueue('P001');

    expect(mockHttpFetch).not.toHaveBeenCalled();
    expect(result.status).toBe(410);
    expect(result.retrySupported).toBe(false);
  });

  it('retry feedback は 200 + retryApplied=true のときだけ成功になる', () => {
    expect(
      resolveOrcaQueueRetryUiFeedback({
        ok: true,
        status: 200,
        queue: [],
        retryApplied: true,
      }),
    ).toMatchObject({ tone: 'success' });

    expect(
      resolveOrcaQueueRetryUiFeedback({
        ok: true,
        status: 200,
        queue: [],
        retryApplied: false,
        retryReason: 'mock_noop',
      }),
    ).toMatchObject({ tone: 'info' });

    expect(
      resolveOrcaQueueRetryUiFeedback({
        ok: false,
        status: 501,
        queue: [],
        retryApplied: false,
        retryReason: 'not_implemented',
      }),
    ).toMatchObject({ tone: 'info', message: 'この環境では ORCA 再送は未実装です。' });
  });

  it('fail-closed 応答は unavailable 状態を保持する', async () => {
    const result = await fetchOrcaQueue();

    expect(result.queue).toEqual([]);
    expect(result.status).toBe(410);
    expect(result.ok).toBe(false);
    expect(result.retrySupported).toBe(false);
    expect(result.discardSupported).toBe(false);
  });
});
