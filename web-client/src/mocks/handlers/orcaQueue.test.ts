import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createServer } from 'node:http';

import { MOCK_ONLY_LEGACY_ORCA_QUEUE_ROUTE, orcaQueueHandlers } from './orcaQueue';

const mswServer = setupServer(...orcaQueueHandlers);

const listen = (server: ReturnType<typeof createServer>) =>
  new Promise<{ port: number }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve({ port: address.port });
        return;
      }
      resolve({ port: 0 });
    });
  });

describe('orcaQueueHandlers', () => {
  beforeAll(() => {
    mswServer.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    mswServer.close();
  });

  it('passes through to the actual server when x-datasource-transition=server', async () => {
    const upstream = createServer((req, res) => {
      const url = req.url ?? '';
      res.setHeader('Content-Type', 'application/json');
      if (url.startsWith(MOCK_ONLY_LEGACY_ORCA_QUEUE_ROUTE) && req.method === 'GET') {
        res.end(JSON.stringify({ source: 'upstream', ok: true, queue: [{ patientId: '01415' }] }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ source: 'upstream', ok: false }));
    });
    const { port } = await listen(upstream);
    try {
      const base = `http://127.0.0.1:${port}`;
      const res = await fetch(`${base}${MOCK_ONLY_LEGACY_ORCA_QUEUE_ROUTE}?patientId=01415`, {
        headers: { 'x-datasource-transition': 'server' },
      });
      expect(res.ok).toBe(true);
      await expect(res.json()).resolves.toMatchObject({ source: 'upstream', ok: true });
    } finally {
      upstream.close();
    }
  });

  it('mocks when x-datasource-transition is not server', async () => {
    const res = await fetch(`http://127.0.0.1${MOCK_ONLY_LEGACY_ORCA_QUEUE_ROUTE}?patientId=01415`, {
      headers: { 'x-run-id': 'TEST-RUN-ID', 'x-trace-id': 'TEST-TRACE-ID' },
    });
    expect(res.ok).toBe(true);
    const json = (await res.json()) as any;
    expect(json.source).toBe('mock');
    expect(Array.isArray(json.queue)).toBe(true);
  });
});
