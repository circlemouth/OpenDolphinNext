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

  it('Request_Number=01 は入力コードを受け付ける', async () => {
    mockHttpFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          apiOk: true,
          apiResult: '000',
          apiResultMessage: '処理終了',
          selections: [],
          medication: {},
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const first = await fetchOrcaMedicationGet({
      requestNumber: '01',
      requestCode: 'ABC123',
      baseDate: '2026-03-09',
    });
    expect(first.ok).toBe(true);
    expect(mockHttpFetch).toHaveBeenCalledTimes(1);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/orca/official/chart-support/medication-get',
      expect.objectContaining({
        method: 'POST',
        notifySessionExpired: false,
        body: JSON.stringify({
          requestNumber: '01',
          requestCode: 'ABC123',
          baseDate: '20260309',
        }),
      }),
    );
  });

  it('Request_Number=02 は 9 桁診療行為コードを要求する', async () => {
    const result = await fetchOrcaMedicationGet({
      requestNumber: '02',
      requestCode: 'ABC123',
      baseDate: '2026-03-09',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.message).toBe('診療行為コードは9桁数字で指定してください。');
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });

  it('medicationgetv2 response の extra field を parser で落とさない', async () => {
    mockHttpFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          apiOk: true,
          apiResult: '000',
          apiResultMessage: '処理終了',
          informationDate: '2026-03-09',
          informationTime: '08:15:00',
          reskey: 'R-001',
          baseDate: '2026-03-09',
          medication: {
            medicationCode: '114030710',
            medicationName: '在医総管',
            medicationNameKana: 'ザイイソウカン',
            unitCode: '01',
            unitName: '回',
            startDate: '2026-03-09',
            endDate: '2026-03-31',
            requestCode: '114030710',
            extraFields: {
              Selection_Prompt: '算定日を選択',
            },
          },
          selections: [
            {
              commentCode: '850100106',
              commentName: '往診又は訪問診療年月日（在医総管）',
              category: 'C002',
              conditionCategory: '1',
              notUseComment: '非算定理由',
              processCategory: 'P1',
              selectionGrepName: '在医総管',
              itemNumber: '0166',
              itemNumberBranch: '01',
              extraFields: {
                Selection_Prompt: '算定日を選択',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await fetchOrcaMedicationGet({ requestCode: '114030710', baseDate: '2026-03-09' });

    expect(result.ok).toBe(true);
    expect(result.informationDate).toBe('2026-03-09');
    expect(result.informationTime).toBe('08:15:00');
    expect(result.reskey).toBe('R-001');
    expect(result.baseDate).toBe('2026-03-09');
    expect(result.medication).toEqual(
      expect.objectContaining({
        medicationCode: '114030710',
        medicationNameKana: 'ザイイソウカン',
        unitCode: '01',
        unitName: '回',
        extraFields: {
          Selection_Prompt: '算定日を選択',
        },
      }),
    );
    expect(result.selections).toEqual([
      expect.objectContaining({
        commentCode: '850100106',
        category: 'C002',
        conditionCategory: '1',
        notUseComment: '非算定理由',
        processCategory: 'P1',
        selectionGrepName: '在医総管',
        itemNumber: '0166',
        itemNumberBranch: '01',
        extraFields: {
          Selection_Prompt: '算定日を選択',
        },
      }),
    ]);
    expect(mockHttpFetch).toHaveBeenCalledWith(
      '/api/orca/official/chart-support/medication-get',
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

  it('baseDate が無い場合は暗黙補完せず fail-close する', async () => {
    const result = await fetchOrcaMedicationGet({ requestCode: '114030710' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.message).toBe('baseDate は YYYY-MM-DD の診療開始日で指定してください。');
    expect(mockHttpFetch).not.toHaveBeenCalled();
  });
});
