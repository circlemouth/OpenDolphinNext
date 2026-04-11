import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { fetchOrcaConnectionConfig, saveOrcaConnectionConfig, testOrcaConnection } from './orcaConnectionApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-BEFORE', traceId: 'TRACE-BEFORE' })),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-AFTER', traceId: 'TRACE-AFTER' })),
}));

const mockHttpFetch = vi.mocked(httpFetch);

beforeEach(() => {
  mockHttpFetch.mockReset();
});

describe('orcaConnectionApi', () => {
  it('設定取得で notifySessionExpired=false を指定する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchOrcaConnectionConfig();

    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/admin/orca/connection',
      expect.objectContaining({
        method: 'GET',
        notifySessionExpired: false,
      }),
    );
    expect(result.status).toBe(401);
    expect(result.ok).toBe(false);
  });

  it('設定取得レスポンスの facilityId を正規化する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          facilityId: '1234',
          port: '8000',
          username: 'trial-user',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrcaConnectionConfig();

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.facilityId).toBe('1234');
    expect(result.port).toBe(8000);
    expect(result.username).toBe('trial-user');
  });

  it('設定保存で notifySessionExpired=false を指定する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await saveOrcaConnectionConfig({
      useWeborca: true,
      serverUrl: 'https://example.invalid',
      port: 443,
      username: 'trial',
      password: 'secret',
      clientAuthEnabled: false,
    });

    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/admin/orca/connection',
      expect.objectContaining({
        method: 'PUT',
        notifySessionExpired: false,
        body: expect.any(FormData),
      }),
    );
    expect(result.status).toBe(401);
    expect(result.ok).toBe(false);
  });

  it('設定保存レスポンスの facilityId を正規化する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          facilityId: '9001',
          useWeborca: false,
          serverUrl: 'http://127.0.0.1',
          port: 8000,
          username: 'orca-admin',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await saveOrcaConnectionConfig({
      useWeborca: false,
      serverUrl: 'http://127.0.0.1',
      port: 8000,
      username: 'orca-admin',
      clientAuthEnabled: false,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.facilityId).toBe('9001');
    expect(result.useWeborca).toBe(false);
    expect(result.serverUrl).toBe('http://127.0.0.1');
    expect(result.port).toBe(8000);
    expect(result.username).toBe('orca-admin');
  });

  it('接続テストで notifySessionExpired=false を指定する', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await testOrcaConnection();

    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/admin/orca/connection/test',
      expect.objectContaining({
        method: 'POST',
        notifySessionExpired: false,
      }),
    );
    expect(result.status).toBe(401);
    expect(result.ok).toBe(false);
  });

  it('設定保存で pushUrl / pushTenantId を config payload に含める', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, facilityId: '9001' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await saveOrcaConnectionConfig({
      useWeborca: true,
      serverUrl: 'https://weborca.example.invalid',
      port: 443,
      username: 'orca-admin',
      pushUrl: 'wss://push.example.invalid/ws',
      pushTenantId: 'tenant-01',
      clientAuthEnabled: false,
    });

    const [, init] = mockHttpFetch.mock.calls[0];
    if (!init) throw new Error('fetch init is undefined');
    const formData = init.body as FormData;
    const config = JSON.parse(String(formData.get('config'))) as Record<string, unknown>;
    expect(config).toMatchObject({
      pushUrl: 'wss://push.example.invalid/ws',
      pushTenantId: 'tenant-01',
    });
  });
});
