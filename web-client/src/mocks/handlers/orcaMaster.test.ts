import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';

import { orcaMasterHandlers } from './orcaMaster';

const mswServer = setupServer(...orcaMasterHandlers);

describe('orcaMasterHandlers', () => {
  beforeAll(() => {
    mswServer.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    mswServer.close();
  });

  it('住所・保険者・最低薬価を mock し、etensu の点数レンジも反映する', async () => {
    const addressRes = await fetch('http://127.0.0.1/api/orca/master/address?zip=1000001&effective=20260309');
    expect(addressRes.ok).toBe(true);
    await expect(addressRes.json()).resolves.toMatchObject({
      zip: '1000001',
      fullAddress: '東京都千代田区千代田',
    });

    const hokenjaRes = await fetch('http://127.0.0.1/api/orca/master/hokenja?keyword=%E6%9D%B1%E4%BA%AC&pref=13');
    expect(hokenjaRes.ok).toBe(true);
    await expect(hokenjaRes.json()).resolves.toMatchObject({
      totalCount: 1,
      items: [expect.objectContaining({ payerCode: '06123456', payerName: '東京保険者' })],
    });

    const priceRes = await fetch('http://127.0.0.1/api/orca/master/generic-price?srycd=620000001&effective=20260309');
    expect(priceRes.ok).toBe(true);
    await expect(priceRes.json()).resolves.toMatchObject({
      code: '620000001',
      minPrice: 12.34,
    });

    const etensuRes = await fetch('http://127.0.0.1/api/orca/master/etensu?pointsMin=20&pointsMax=40');
    expect(etensuRes.ok).toBe(true);
    const etensuJson = (await etensuRes.json()) as { items?: Array<{ points?: number }> };
    expect(etensuJson.items?.every((item) => typeof item.points === 'number' && item.points >= 20 && item.points <= 40)).toBe(true);
  });
});
