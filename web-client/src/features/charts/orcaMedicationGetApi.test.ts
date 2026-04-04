import { beforeEach, describe, expect, it, vi } from 'vitest';

import { httpFetch } from '../../libs/http/httpClient';
import { fetchOrcaMedicationGet } from './orcaMedicationGetApi';

vi.mock('../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../libs/observability/observability', () => ({
  ensureObservabilityMeta: vi.fn(() => ({ runId: 'RUN-TEST', traceId: 'TRACE-TEST' })),
}));

const mockHttpFetch = vi.mocked(httpFetch);

describe('fetchOrcaMedicationGet', () => {
  beforeEach(() => {
    mockHttpFetch.mockReset();
  });

  it('9桁でない requestCode は fetch しない', async () => {
    const result = await fetchOrcaMedicationGet({ requestCode: '1234' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('medicationgetv2 response を選択式コメント metadata として正規化する', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          apiOk: true,
          apiResult: '000',
          apiResultMessage: '処理終了',
          medication: {
            medicationCode: '114030710',
            medicationName: '在医総管',
          },
          selections: [
            {
              commentCode: '850100106',
              commentName: '往診又は訪問診療年月日（在医総管）',
              category: 'C002',
              itemNumber: '0166',
              itemNumberBranch: '01',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchOrcaMedicationGet({ requestCode: '114030710', baseDate: '2026-03-09' });

    expect(result.ok).toBe(true);
    expect(result.selections).toEqual([
      expect.objectContaining({
        commentCode: '850100106',
        itemNumber: '0166',
        itemNumberBranch: '01',
      }),
    ]);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/orca/chart-support/medication-get',
      expect.objectContaining({
        method: 'POST',
        notifySessionExpired: false,
        body: JSON.stringify({
          requestNumber: '02',
          requestCode: '114030710',
          baseDate: '20260309',
        }),
      }),
    );
  });
});
