import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { fetchMasterUpdateDatasetDetail } from './masterUpdateApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

const mockHttpFetch = vi.mocked(httpFetch);

describe('masterUpdateApi', () => {
  beforeEach(() => {
    mockHttpFetch.mockReset();
  });

  it('preserves master type counts in dataset version responses', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          dataset: {
            code: 'local_orca_master_cache',
            name: 'OpenDolphin local ORCA master cache',
            versions: [
              {
                versionId: 'v1',
                recordCount: 5,
                masterTypeCounts: { drug: 2, comment: 3 },
                current: true,
              },
            ],
            localArtifacts: {
              currentMasterTypeCounts: { drug: 2, comment: 3 },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchMasterUpdateDatasetDetail('local_orca_master_cache');

    expect(mockHttpFetch).toHaveBeenCalledWith('/api/admin/master-updates/datasets/local_orca_master_cache', {
      method: 'GET',
      notifySessionExpired: false,
    });
    expect(result.dataset.versions?.[0]?.masterTypeCounts).toEqual({ drug: 2, comment: 3 });
    expect(result.dataset.localArtifacts?.currentMasterTypeCounts).toEqual({ drug: 2, comment: 3 });
  });
});
