import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META' })),
  updateObservabilityMeta: vi.fn(),
}));

import { httpFetch } from '../../libs/http/httpClient';
import { fetchOrderBundles, mutateOrderBundles } from './orderBundleApi';

describe('orderBundleApi 600 subtype contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetch preserves subtype for class 600 bundles', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-SUBTYPE-FETCH',
          patientId: '000001',
          bundles: [
            {
              entity: 'bacteriaOrder',
              bundleName: 'bacteria bundle',
              bundleNumber: '2',
              subtype: 'culture',
              classCode: '600',
              classCodeSystem: 'Claim007',
              className: 'test class',
              items: [{ code: '160000010', name: 'culture item', quantity: '1', unit: 'count' }],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await fetchOrderBundles({ patientId: '000001', entity: 'bacteriaOrder' });

    expect(result.ok).toBe(true);
    expect(result.bundles[0]).toEqual(
      expect.objectContaining({
        entity: 'bacteriaOrder',
        subtype: 'culture',
        classCode: '600',
      }),
    );
  });

  it('mutation sends subtype for class 600 bundles', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-SUBTYPE-MUT',
          createdDocumentIds: [105],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await mutateOrderBundles({
      patientId: '000001',
      operations: [
        {
          operation: 'create',
          entity: 'bacteriaOrder',
          bundleName: 'bacteria bundle',
          bundleNumber: '2',
          subtype: 'sensitivity',
          classCode: '600',
          classCodeSystem: 'Claim007',
          className: 'test class',
          items: [{ code: '160000011', name: 'sensitivity item', quantity: '1', unit: 'count' }],
        },
      ],
    });

    const request = vi.mocked(httpFetch).mock.calls[0]?.[1];
    const body = JSON.parse(String((request as RequestInit | undefined)?.body ?? '{}')) as Record<string, any>;

    expect(body.operations[0]).toEqual(
      expect.objectContaining({
        entity: 'bacteriaOrder',
        subtype: 'sensitivity',
        classCode: '600',
      }),
    );
  });
});
