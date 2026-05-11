import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../libs/http/httpClient', () => ({
  httpFetch: vi.fn(),
}));

vi.mock('../../../libs/observability/observability', () => ({
  generateRunId: vi.fn(() => 'RUN-GEN'),
  getObservabilityMeta: vi.fn(() => ({ runId: 'RUN-META' })),
  updateObservabilityMeta: vi.fn(),
}));

import { httpFetch } from '../../../libs/http/httpClient';
import { prepareOrcaMedicalCandidateFromChart } from '../orcaMedicalCandidateApi';

describe('orcaMedicalCandidateApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts only chartRevisionId in the route and sends no client authority body', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runId: 'RUN-CAND',
          candidateId: 10,
          candidateStatus: 'READY_TO_SEND',
          sendable: true,
          nonAuthoritative: true,
          patientId: 'P-1',
          encounterId: 'E-1',
          chartRevisionId: 'REV-1',
          prescriptionId: 20,
          prescriptionRevisionId: 30,
          prescriptionContentHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          medicalInformation: [
            {
              entity: 'medOrder',
              rpSequence: 1,
              medicalClass: '211',
              usageCode: '001000',
              usageName: 'after meal',
              medications: [{ itemSequence: 1, code: '620000001', name: '薬剤A', number: '1' }],
            },
          ],
          issues: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await prepareOrcaMedicalCandidateFromChart({ chartRevisionId: 'REV-1' });

    expect(result.ok).toBe(true);
    expect(result.candidateId).toBe(10);
    expect(result.prescriptionContentHash).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(result.nonAuthoritative).toBe(true);
    expect(result.medicalInformation).toHaveLength(1);
    expect(result.medicalInformation[0]).toEqual(expect.objectContaining({ rpSequence: 1, usageCode: '001000', usageName: 'after meal' }));
    expect(result.medicalInformation[0]?.medications?.[0]).toEqual(expect.objectContaining({ itemSequence: 1, code: '620000001' }));
    expect(httpFetch).toHaveBeenCalledWith('/api/local/orca/medical-candidates/from-chart/REV-1', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      signal: undefined,
    });
    const init = vi.mocked(httpFetch).mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(JSON.stringify(init)).not.toMatch(/facility|owner|role|voucher|sequential|insurance|digest|url/i);
  });

  it('fails closed before network when chartRevisionId is missing', async () => {
    const result = await prepareOrcaMedicalCandidateFromChart({ chartRevisionId: '   ' });

    expect(result.ok).toBe(false);
    expect(result.sendable).toBe(false);
    expect(result.issues[0]?.code).toBe('chart_revision_missing');
    expect(httpFetch).not.toHaveBeenCalled();
  });
});
