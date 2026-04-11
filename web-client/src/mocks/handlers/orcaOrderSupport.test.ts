import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';

import { orcaOrderSupportHandlers } from './orcaOrderSupport';

const mswServer = setupServer(...orcaOrderSupportHandlers);

describe('orcaOrderSupportHandlers', () => {
  beforeAll(() => {
    mswServer.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    mswServer.close();
  });

  it('inputsets 一覧/詳細と相互作用チェックを mock する', async () => {
    const listRes = await fetch('http://127.0.0.1/api/orca/master/order/inputsets?keyword=%E9%99%8D%E5%9C%A7&entity=medOrder');
    expect(listRes.ok).toBe(true);
    await expect(listRes.json()).resolves.toMatchObject({
      totalCount: 1,
      items: [expect.objectContaining({ setCode: 'P01001', name: '降圧セット' })],
    });

    const detailRes = await fetch('http://127.0.0.1/api/orca/master/order/inputsets/P01001?effective=20260309&entity=medOrder');
    expect(detailRes.ok).toBe(true);
    await expect(detailRes.json()).resolves.toMatchObject({
      setCode: 'P01001',
      bundle: expect.objectContaining({
        entity: 'medOrder',
        bundleName: '降圧セット',
      }),
    });

    const interactionRes = await fetch('http://127.0.0.1/api/orca/master/order/interactions/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: ['620000001', '620000002', '620000001'] }),
    });
    expect(interactionRes.ok).toBe(true);
    await expect(interactionRes.json()).resolves.toMatchObject({
      totalCount: 1,
      pairs: [expect.objectContaining({ code1: '620000001', code2: '620000002', interactionCode: 'INT001' })],
    });
  });
});
