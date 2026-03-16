import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createServer } from 'node:http';

import { orcaOrderBundleHandlers } from './orcaOrderBundles';

const mswServer = setupServer(...orcaOrderBundleHandlers);

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

describe('orcaOrderBundleHandlers', () => {
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
      if (url.startsWith('/api/orca/order/bundles') && req.method === 'GET') {
        res.end(JSON.stringify({ source: 'upstream', ok: true }));
        return;
      }
      if (url.startsWith('/api/orca/order/bundles') && req.method === 'POST') {
        res.end(JSON.stringify({ source: 'upstream', ok: true }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ source: 'upstream', ok: false }));
    });
    const { port } = await listen(upstream);
    try {
      const base = `http://127.0.0.1:${port}`;
      const getRes = await fetch(`${base}/api/orca/order/bundles?patientId=01415`, {
        headers: { 'x-datasource-transition': 'server' },
      });
      expect(getRes.ok).toBe(true);
      await expect(getRes.json()).resolves.toMatchObject({ source: 'upstream', ok: true });

      const postRes = await fetch(`${base}/api/orca/order/bundles`, {
        method: 'POST',
        headers: { 'x-datasource-transition': 'server', 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: '01415', operations: [{ operation: 'create' }] }),
      });
      expect(postRes.ok).toBe(true);
      await expect(postRes.json()).resolves.toMatchObject({ source: 'upstream', ok: true });
    } finally {
      upstream.close();
    }
  });

  it('mocks when x-datasource-transition is not server', async () => {
    const res = await fetch('http://127.0.0.1/orca/order/bundles?patientId=01415', {
      headers: { 'x-run-id': 'TEST-RUN-ID', 'x-trace-id': 'TEST-TRACE-ID' },
    });
    expect(res.ok).toBe(true);
    const json = (await res.json()) as any;
    expect(json.apiResult).toBe('00');
    expect(json.recordsReturned).toBe(0);
    expect(Array.isArray(json.bundles)).toBe(true);
  });
});

