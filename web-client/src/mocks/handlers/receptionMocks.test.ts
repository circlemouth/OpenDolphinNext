import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';

import { outpatientHandlers } from './outpatient';
import { orcaReceptionHandlers } from './orcaReception';

const mswServer = setupServer(...outpatientHandlers, ...orcaReceptionHandlers);

describe('reception mocks', () => {
  beforeAll(() => {
    mswServer.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    mswServer.close();
  });

  it('acceptmodv2 mock keeps Api_Result=21/60 mapping aligned with runtime semantics', async () => {
    const mismatchRes = await fetch('http://127.0.0.1/api/orca/official/visits/mutation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: '00021', requestNumber: '01' }),
    });
    expect(mismatchRes.ok).toBe(true);
    const mismatchJson = (await mismatchRes.json()) as Record<string, unknown>;
    expect(mismatchJson).toMatchObject({
      apiResult: '21',
      apiResultMessage: '保険不一致',
      warnings: ['保険不一致'],
    });
    expect(mismatchJson).not.toHaveProperty('acceptanceId');

    const missingRes = await fetch('http://127.0.0.1/api/orca/official/visits/mutation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: '00060', requestNumber: '02', acceptanceId: 'A-060' }),
    });
    expect(missingRes.ok).toBe(true);
    const missingJson = (await missingRes.json()) as Record<string, unknown>;
    expect(missingJson).toMatchObject({
      apiResult: '60',
      apiResultMessage: '受付なし',
      warnings: ['受付なし'],
    });
    expect(missingJson).not.toHaveProperty('acceptanceId');
  });

  it('official patient name-search mock exposes patientlst3res with patientId-bearing records', async () => {
    const response = await fetch('http://127.0.0.1/api/orca/official/patients/name-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '山田 太郎' }),
    });

    expect(response.ok).toBe(true);
    const json = (await response.json()) as {
      patientlst3res?: { patients?: Array<{ patientId?: string; wholeName?: string }> };
    };
    expect(json.patientlst3res?.patients?.[0]).toMatchObject({
      patientId: expect.any(String),
      wholeName: expect.any(String),
    });
  });
});
